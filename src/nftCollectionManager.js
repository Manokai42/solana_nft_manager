const { Connection, PublicKey } = require('@solana/web3.js');
const { Metadata } = require('@metaplex-foundation/mpl-token-metadata');
const fetch = require('node-fetch');
const LRUCache = require('lru-cache');

class NFTCollectionManager {
    constructor(connection, walletAddress) {
        this.connection = connection;
        this.walletAddress = walletAddress;
        this.collections = new Map();
        this.floorPrices = new Map();
        this.activityHistory = new Map();

        // Initialize caches
        this.metadataCache = new LRUCache({
            max: 10000, // Cache size
            maxAge: 1000 * 60 * 60 // 1 hour
        });

        this.statsCache = new LRUCache({
            max: 1000,
            maxAge: 1000 * 60 * 5 // 5 minutes
        });

        this.BATCH_SIZE = 50; // Number of NFTs to load at once
    }

    async loadNFTsByPage(page = 0, itemsPerPage = 50) {
        try {
            const start = page * itemsPerPage;
            const response = await fetch(
                `https://api.helius.xyz/v0/addresses/${this.walletAddress}/nfts?api-key=${process.env.HELIUS_API_KEY}&pagination=${start},${itemsPerPage}`
            );
            const data = await response.json();
            return this._processNFTData(data);
        } catch (error) {
            console.error('Error loading NFTs by page:', error);
            return { nfts: [], totalPages: 0 };
        }
    }

    async _processNFTData(data) {
        const nfts = data.nfts || [];
        const totalItems = data.total || nfts.length;
        const totalPages = Math.ceil(totalItems / this.BATCH_SIZE);

        // Group NFTs by collection
        const groupedNFTs = await this.groupNFTsByMetadata(nfts);

        // Update collection stats in batches
        const collectionAddresses = [...new Set(nfts.map(nft => nft.collection?.address).filter(Boolean))];
        await this._updateCollectionStats(collectionAddresses);

        return {
            nfts: groupedNFTs,
            totalPages,
            currentPage: data.page || 0
        };
    }

    async _updateCollectionStats(collectionAddresses) {
        const batchSize = 10;
        for (let i = 0; i < collectionAddresses.length; i += batchSize) {
            const batch = collectionAddresses.slice(i, i + batchSize);
            await Promise.all(
                batch.map(async (address) => {
                    if (!this.statsCache.has(address)) {
                        const stats = await this.getCollectionStats(address);
                        if (stats) {
                            this.statsCache.set(address, stats);
                        }
                    }
                })
            );
        }
    }

    async groupNFTsByMetadata(nfts) {
        const groups = new Map();

        for (const nft of nfts) {
            const key = this._generateMetadataKey(nft.metadata);
            if (!groups.has(key)) {
                groups.set(key, {
                    metadata: nft.metadata,
                    items: [],
                    stats: await this._getCollectionStatsFromCache(nft.collection?.address)
                });
            }
            groups.get(key).items.push(nft);
        }

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
}

module.exports = NFTCollectionManager;
