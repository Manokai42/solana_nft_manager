import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import { LRUCache } from 'lru-cache';
import * as log from 'electron-log';
import { NFTData, CollectionStats, NFTGroup, BatchOperationResult, TransactionResult } from '../types/nft';
import { 
    TOKEN_PROGRAM_ID,
    createTransferInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import {
    METADATA_CACHE_SIZE,
    METADATA_CACHE_TTL,
    STATS_CACHE_SIZE,
    STATS_CACHE_TTL,
    MAX_BATCH_SIZE,
    MAX_RETRIES,
    RETRY_DELAY,
    TRANSACTION_TIMEOUT,
    ERROR_MESSAGES
} from '../utils/constants';
import { NFTMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { TensorService } from './tensorService';
import { HeliusService } from './heliusService';
import { logger } from '../utils/logger';

export class NFTManager {
    private connection: Connection;
    private tensorService: TensorService;
    private heliusService: HeliusService;
    private metadataCache: LRUCache<string, NFTMetadata>;
    private collectionCache: LRUCache<string, any>;
    private batchSize: number = 50;
    private processingQueue: Map<string, Promise<any>> = new Map();

    constructor(connection: Connection) {
        this.connection = connection;
        this.tensorService = new TensorService();
        this.heliusService = new HeliusService();
        
        // Initialize caches with optimized settings
        this.metadataCache = new LRUCache({
            max: 10000,
            ttl: 1000 * 60 * 60, // 1 hour
            updateAgeOnGet: true,
            dispose: (key) => {
                logger.debug(`Disposing metadata cache entry: ${key}`);
            }
        });

        this.collectionCache = new LRUCache({
            max: 1000,
            ttl: 1000 * 60 * 5, // 5 minutes
            updateAgeOnGet: true,
            dispose: (key) => {
                logger.debug(`Disposing collection cache entry: ${key}`);
            }
        });
    }

    async loadNFTsByPage(walletAddress: string, page: number = 0, itemsPerPage: number = 50): Promise<any> {
        const cacheKey = `nfts_${walletAddress}_${page}_${itemsPerPage}`;
        
        // Check cache first
        const cachedData = this.metadataCache.get(cacheKey);
        if (cachedData) {
            logger.debug(`Cache hit for NFTs page ${page}`);
            return cachedData;
        }

        // Check if this page is already being processed
        if (this.processingQueue.has(cacheKey)) {
            return this.processingQueue.get(cacheKey);
        }

        // Create new processing promise
        const processingPromise = this._processNFTPage(walletAddress, page, itemsPerPage);
        this.processingQueue.set(cacheKey, processingPromise);

        try {
            const result = await processingPromise;
            this.metadataCache.set(cacheKey, result);
            return result;
        } finally {
            this.processingQueue.delete(cacheKey);
        }
    }

    private async _processNFTPage(walletAddress: string, page: number, itemsPerPage: number): Promise<any> {
        try {
            const start = page * itemsPerPage;
            const response = await this.heliusService.getNFTsByOwner(walletAddress, start, itemsPerPage);
            
            // Process NFTs in parallel batches
            const nfts = response.nfts || [];
            const batchPromises = [];
            
            for (let i = 0; i < nfts.length; i += this.batchSize) {
                const batch = nfts.slice(i, Math.min(i + this.batchSize, nfts.length));
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
                totalPages: Math.ceil(response.total / itemsPerPage),
                currentPage: page,
                timestamp: Date.now()
            };
        } catch (error) {
            logger.error(`Error processing NFT page: ${error.message}`);
            throw error;
        }
    }

    private async _processBatch(nfts: any[]): Promise<Map<string, any>> {
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
                logger.error(`Error processing NFT in batch: ${error.message}`);
            }
        }));

        return groups;
    }

    private async _getCollectionStatsFromCache(collectionAddress: string): Promise<any> {
        if (!collectionAddress) return null;
        
        const cachedStats = this.collectionCache.get(collectionAddress);
        if (cachedStats) return cachedStats;

        try {
            const stats = await this.tensorService.getCollectionStats(collectionAddress);
            this.collectionCache.set(collectionAddress, stats);
            return stats;
        } catch (error) {
            logger.error(`Error fetching collection stats: ${error.message}`);
            return null;
        }
    }

    private _generateMetadataKey(metadata: any): string {
        const relevantProps = [
            metadata.collection?.address,
            metadata.collection?.name,
            metadata.creators?.map(c => c.address).join(','),
            metadata.symbol
        ];
        return relevantProps.filter(Boolean).join('|');
    }

    async batchTransfer(nfts: any[], toAddress: string): Promise<any> {
        const transactions = [];
        const batchSize = 8; // Solana's limit for transactions in a batch

        for (let i = 0; i < nfts.length; i += batchSize) {
            const batch = nfts.slice(i, i + batchSize);
            const batchTxs = await Promise.all(
                batch.map(nft => this._createTransferTransaction(nft, toAddress))
            );
            transactions.push(...batchTxs);
        }

        return transactions;
    }

    private async _createTransferTransaction(nft: any, toAddress: string): Promise<any> {
        // Implementation for creating transfer transaction
        // This will be implemented based on your specific requirements
        return {};
    }

    async cleanup(): Promise<void> {
        try {
            this.metadataCache.clear();
            this.collectionCache.clear();
            this.processingQueue.clear();
            logger.info('Successfully cleaned up NFT manager resources');
        } catch (error) {
            logger.error(`Error during cleanup: ${error.message}`);
            throw error;
        }
    }
} 