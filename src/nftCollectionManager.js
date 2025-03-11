const { Connection, PublicKey } = require('@solana/web3.js');
const { Metadata } = require('@metaplex-foundation/mpl-token-metadata');
const fetch = require('node-fetch');
const { LRUCache } = require('lru-cache');
const winston = require('winston');

class NFTCollectionManager {
    constructor(connection, walletAddress) {
        this.connection = connection;
        this.walletAddress = walletAddress;
        this.collections = new Map();
        this.floorPrices = new Map();
        this.activityHistory = new Map();
        this.connectionPool = [];
        this.currentConnectionIndex = 0;

        // Enhanced logging
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ 
                    filename: process.env.LOG_FILE_PATH || 'logs/nft-manager.log'
                })
            ]
        });

        // Initialize connection pool
        this._initializeConnectionPool();

        // Initialize enhanced caches with better memory management
        this.metadataCache = new LRUCache({
            max: parseInt(process.env.METADATA_CACHE_MAX_SIZE) || 10000,
            ttl: parseInt(process.env.METADATA_CACHE_TTL) || 1000 * 60 * 60,
            updateAgeOnGet: true,
            dispose: (key, value) => {
                this.logger.debug(`Disposing metadata cache entry: ${key}`);
            }
        });

        this.statsCache = new LRUCache({
            max: parseInt(process.env.CACHE_MAX_ITEMS) || 1000,
            ttl: parseInt(process.env.CACHE_TTL) || 1000 * 60 * 5,
            updateAgeOnGet: true,
            dispose: (key, value) => {
                this.logger.debug(`Disposing stats cache entry: ${key}`);
            }
        });

        this.BATCH_SIZE = parseInt(process.env.MAX_BATCH_SIZE) || 50;
        
        // Initialize cleanup interval
        this._initializeCleanupInterval();
    }

    _initializeConnectionPool() {
        const endpoints = [
            process.env.SOLANA_RPC_ENDPOINT,
            process.env.RPC_ENDPOINT,
            'https://api.mainnet-beta.solana.com'
        ].filter(Boolean);

        this.connectionPool = endpoints.map(endpoint => 
            new Connection(endpoint, { commitment: 'confirmed' })
        );
    }

    _getNextConnection() {
        const connection = this.connectionPool[this.currentConnectionIndex];
        this.currentConnectionIndex = (this.currentConnectionIndex + 1) % this.connectionPool.length;
        return connection;
    }

    _initializeCleanupInterval() {
        // Cleanup unused resources every hour
        setInterval(() => {
            this._cleanupUnusedResources();
        }, 1000 * 60 * 60);
    }

    async _cleanupUnusedResources() {
        try {
            // Clean up old collection data
            const now = Date.now();
            for (const [key, value] of this.collections.entries()) {
                if (now - value.lastAccessed > 24 * 60 * 60 * 1000) {
                    this.collections.delete(key);
                }
            }

            // Clean up old activity history
            for (const [key, value] of this.activityHistory.entries()) {
                if (now - value.timestamp > 24 * 60 * 60 * 1000) {
                    this.activityHistory.delete(key);
                }
            }

            this.logger.info('Completed resource cleanup');
        } catch (error) {
            this.logger.error('Error during resource cleanup:', error);
        }
    }

    async loadNFTsByPage(page = 0, itemsPerPage = 50) {
        const cacheKey = `nfts_${this.walletAddress}_${page}_${itemsPerPage}`;
        
        try {
            // Check cache first
            const cachedData = this.metadataCache.get(cacheKey);
            if (cachedData) {
                this.logger.debug(`Cache hit for NFTs page ${page}`);
                return cachedData;
            }

            const start = page * itemsPerPage;
            const response = await fetch(
                `https://api.helius.xyz/v0/addresses/${this.walletAddress}/nfts?api-key=${process.env.HELIUS_API_KEY}&pagination=${start},${itemsPerPage}`,
                {
                    timeout: 10000,
                    retry: 3,
                    retryDelay: 1000
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const processedData = await this._processNFTData(data);
            
            // Cache the results
            this.metadataCache.set(cacheKey, processedData);
            
            return processedData;
        } catch (error) {
            this.logger.error(`Error loading NFTs by page: ${error.message}`);
            throw error;
        }
    }

    async _processNFTData(data) {
        try {
            const nfts = data.nfts || [];
            const totalItems = data.total || nfts.length;
            const totalPages = Math.ceil(totalItems / this.BATCH_SIZE);

            // Process NFTs in parallel batches
            const batchPromises = [];
            for (let i = 0; i < nfts.length; i += this.BATCH_SIZE) {
                const batch = nfts.slice(i, Math.min(i + this.BATCH_SIZE, nfts.length));
                batchPromises.push(this._processBatch(batch));
            }

            const processedBatches = await Promise.all(batchPromises);
            const groupedNFTs = new Map();
            
            // Merge batch results
            processedBatches.forEach(batch => {
                for (const [key, value] of batch.entries()) {
                    if (groupedNFTs.has(key)) {
                        groupedNFTs.get(key).items.push(...value.items);
                    } else {
                        groupedNFTs.set(key, value);
                    }
                }
            });

            return {
                nfts: groupedNFTs,
                totalPages,
                currentPage: data.page || 0,
                timestamp: Date.now()
            };
        } catch (error) {
            this.logger.error(`Error processing NFT data: ${error.message}`);
            throw error;
        }
    }

    async _processBatch(nfts) {
        const groups = new Map();
        
        await Promise.all(nfts.map(async (nft) => {
            try {
                const key = this._generateMetadataKey(nft.metadata);
                if (!groups.has(key)) {
                    groups.set(key, {
                        metadata: nft.metadata,
                        items: [],
                        stats: await this._getCollectionStatsFromCache(nft.collection?.address),
                        lastAccessed: Date.now()
                    });
                }
                groups.get(key).items.push(nft);
            } catch (error) {
                this.logger.error(`Error processing NFT in batch: ${error.message}`);
            }
        }));

        return groups;
    }

    async _getCollectionStatsFromCache(collectionAddress) {
        if (!collectionAddress) return null;
        return this.statsCache.get(collectionAddress) || {
            totalCount: 0,
            floorPrice: 0,
            lastSalePrice: 0,
            volumeLast24h: 0
        };
    }

    _generateMetadataKey(metadata) {
        const relevantProps = [
            metadata.collection?.address,
            metadata.collection?.name,
            metadata.creators?.map(c => c.address).join(','),
            metadata.symbol
        ];
        return relevantProps.filter(Boolean).join('|');
    }

    async getCollectionStats(collectionAddress) {
        try {
            const cachedStats = this.statsCache.get(collectionAddress);
            if (cachedStats) return cachedStats;

            const response = await fetch(
                `https://api.helius.xyz/v0/collections/${collectionAddress}/stats?api-key=${process.env.HELIUS_API_KEY}`
            );
            const stats = await response.json();
            this.statsCache.set(collectionAddress, stats);
            return stats;
        } catch (error) {
            console.error('Error fetching collection stats:', error);
            return null;
        }
    }

    async trackCollectionActivity(collectionAddress) {
        try {
            const response = await fetch(
                `https://api.helius.xyz/v0/collections/${collectionAddress}/transactions?api-key=${process.env.HELIUS_API_KEY}`
            );
            const activity = await response.json();
            this.activityHistory.set(collectionAddress, activity);
            return activity;
        } catch (error) {
            console.error('Error tracking collection activity:', error);
            return null;
        }
    }

    // Batch operations
    async batchTransfer(nfts, toAddress) {
        const transactions = [];
        const batchSize = 8; // Solana's limit for transactions in a batch

        for (let i = 0; i < nfts.length; i += batchSize) {
            const batch = nfts.slice(i, i + batchSize);
            const batchTxs = await Promise.all(
                batch.map(nft => this.createTransferTransaction(nft, toAddress))
            );
            transactions.push(...batchTxs);
        }

        return transactions;
    }

    async batchBurn(nfts) {
        const transactions = [];
        const batchSize = 8;

        for (let i = 0; i < nfts.length; i += batchSize) {
            const batch = nfts.slice(i, i + batchSize);
            const batchTxs = await Promise.all(
                batch.map(nft => this.createBurnTransaction(nft))
            );
            transactions.push(...batchTxs);
        }

        return transactions;
    }

    // Analytics
    calculateCollectionPerformance(collectionAddress) {
        const activity = this.activityHistory.get(collectionAddress);
        if (!activity) return null;

        return {
            volumeLast24h: this._calculate24hVolume(activity),
            priceChange: this._calculatePriceChange(activity),
            totalTransactions: activity.length,
            averagePrice: this._calculateAveragePrice(activity)
        };
    }

    _calculate24hVolume(activity) {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return activity
            .filter(tx => tx.timestamp >= oneDayAgo)
            .reduce((sum, tx) => sum + tx.price, 0);
    }

    _calculatePriceChange(activity) {
        if (activity.length < 2) return 0;
        const oldestPrice = activity[activity.length - 1].price;
        const latestPrice = activity[0].price;
        return ((latestPrice - oldestPrice) / oldestPrice) * 100;
    }

    _calculateAveragePrice(activity) {
        if (!activity.length) return 0;
        const sum = activity.reduce((total, tx) => total + tx.price, 0);
        return sum / activity.length;
    }

    // Security features
    validateTransaction(transaction, spendingLimit) {
        const isWhitelisted = this._checkWhitelist(transaction.to);
        const withinLimit = transaction.value <= spendingLimit;
        const isSuspicious = this._detectSuspiciousActivity(transaction);

        return {
            isValid: isWhitelisted && withinLimit && !isSuspicious,
            warnings: {
                notWhitelisted: !isWhitelisted,
                exceedsLimit: !withinLimit,
                suspicious: isSuspicious
            }
        };
    }

    _checkWhitelist(address) {
        // Implement whitelist checking logic
        return true; // Placeholder
    }

    _detectSuspiciousActivity(transaction) {
        // Implement suspicious activity detection
        return false; // Placeholder
    }

    async cleanup() {
        try {
            // Clear caches
            this.metadataCache.clear();
            this.statsCache.clear();
            
            // Clear collections and history
            this.collections.clear();
            this.activityHistory.clear();
            
            // Close connections
            this.connectionPool.forEach(conn => {
                try {
                    conn.disconnect();
                } catch (error) {
                    this.logger.error(`Error disconnecting connection: ${error.message}`);
                }
            });
            
            this.logger.info('Successfully cleaned up NFT manager resources');
        } catch (error) {
            this.logger.error(`Error during cleanup: ${error.message}`);
            throw error;
        }
    }
}

module.exports = NFTCollectionManager;
