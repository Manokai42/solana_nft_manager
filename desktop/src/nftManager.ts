import { PublicKey } from '@solana/web3.js';
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import fetch from 'node-fetch';
import * as log from 'electron-log';
import { ConnectionManager } from './connectionManager';
import {
    createTransferInstructions,
    createListingInstructions,
    createDelistInstructions,
    createBurnInstructions,
    sendAndConfirmTransaction,
    TransactionResult
} from './utils/transactions';
import { MAX_BATCH_SIZE } from './constants';

interface NFTMetadata {
    mint: string;
    name: string;
    symbol: string;
    uri: string;
    lastAccessed: number;
    collection?: {
        address: string;
        name: string;
    };
    creators?: Array<{
        address: string;
        share: number;
        verified: boolean;
    }>;
}

interface CollectionStats {
    floorPrice: number;
    listedCount: number;
    volumeLast24h: number;
    avgPrice24h: number;
    lastUpdated: number;
}

interface NFTBatch {
    items: NFTMetadata[];
    stats?: CollectionStats;
    lastUpdated: number;
}

export class NFTManager {
    private collections: Map<string, NFTBatch>;
    private metadataCache: Map<string, NFTMetadata>;
    private statsCache: Map<string, CollectionStats>;
    private processingQueue: string[];
    private isProcessing: boolean;
    private readonly BATCH_SIZE = 10;
    private readonly HELIUS_API_KEY = '10fb665e-d935-450e-8543-fcfed0f94554';

    constructor(private connectionManager: ConnectionManager) {
        this.collections = new Map();
        this.metadataCache = new Map();
        this.statsCache = new Map();
        this.processingQueue = [];
        this.isProcessing = false;

        // Start background processing
        this.startProcessingQueue();
    }

    async loadNFTs(walletAddress: string, page = 0, pageSize = 50): Promise<NFTBatch[]> {
        try {
            const start = page * pageSize;
            const response = await fetch(
                `https://api.helius.xyz/v0/addresses/${walletAddress}/nfts?api-key=${this.HELIUS_API_KEY}&pagination=${start},${pageSize}`,
                { timeout: 10000 }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const processedData = await this.processNFTBatch(data.nfts);
            return processedData;

        } catch (error) {
            log.error('Error loading NFTs:', error);
            throw error;
        }
    }

    private async processNFTBatch(nfts: any[]): Promise<NFTBatch[]> {
        const batches: Map<string, NFTBatch> = new Map();

        for (let i = 0; i < nfts.length; i += this.BATCH_SIZE) {
            const batch = nfts.slice(i, i + this.BATCH_SIZE);
            await Promise.all(batch.map(async (nft) => {
                try {
                    const metadata = await this.getMetadata(nft.mint);
                    if (!metadata) return;

                    const collectionAddress = metadata.collection?.address;
                    if (!collectionAddress) return;

                    if (!batches.has(collectionAddress)) {
                        batches.set(collectionAddress, {
                            items: [],
                            stats: await this.getCollectionStats(collectionAddress),
                            lastUpdated: Date.now()
                        });
                    }

                    batches.get(collectionAddress)!.items.push(metadata);

                } catch (error) {
                    log.error(`Error processing NFT ${nft.mint}:`, error);
                }
            }));
        }

        return Array.from(batches.values());
    }

    private async getMetadata(mint: string): Promise<NFTMetadata | null> {
        try {
            // Check cache first
            if (this.metadataCache.has(mint)) {
                return this.metadataCache.get(mint)!;
            }

            const response = await fetch(
                `https://api.helius.xyz/v0/token-metadata/${mint}?api-key=${this.HELIUS_API_KEY}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const metadata: NFTMetadata = {
                mint,
                name: data.name,
                symbol: data.symbol,
                uri: data.uri,
                collection: data.collection,
                creators: data.creators,
                lastAccessed: Date.now()
            };

            // Cache the metadata
            this.metadataCache.set(mint, metadata);

            return metadata;

        } catch (error) {
            log.error(`Error fetching metadata for ${mint}:`, error);
            return null;
        }
    }

    private async getCollectionStats(collectionAddress: string): Promise<CollectionStats | undefined> {
        try {
            // Check cache first
            if (this.statsCache.has(collectionAddress)) {
                return this.statsCache.get(collectionAddress);
            }

            const response = await fetch(
                `https://api.helius.xyz/v0/collections/${collectionAddress}/stats?api-key=${this.HELIUS_API_KEY}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const stats: CollectionStats = {
                floorPrice: data.floorPrice || 0,
                listedCount: data.listedCount || 0,
                volumeLast24h: data.volumeLast24h || 0,
                avgPrice24h: data.avgPrice24h || 0,
                lastUpdated: Date.now()
            };

            // Cache the stats
            this.statsCache.set(collectionAddress, stats);

            return stats;

        } catch (error) {
            log.error(`Error fetching stats for collection ${collectionAddress}:`, error);
            return undefined;
        }
    }

    private startProcessingQueue() {
        setInterval(async () => {
            if (this.isProcessing || this.processingQueue.length === 0) return;

            this.isProcessing = true;
            const mint = this.processingQueue.shift();

            try {
                if (mint) {
                    await this.getMetadata(mint);
                }
            } catch (error) {
                log.error('Error processing queue item:', error);
            } finally {
                this.isProcessing = false;
            }
        }, 100);
    }

    // Memory management
    private cleanupOldCacheEntries() {
        const ONE_HOUR = 60 * 60 * 1000;
        const now = Date.now();

        // Cleanup metadata cache
        for (const [key, value] of this.metadataCache.entries()) {
            if (now - value.lastAccessed > ONE_HOUR) {
                this.metadataCache.delete(key);
            }
        }

        // Cleanup stats cache
        for (const [key, value] of this.statsCache.entries()) {
            if (now - value.lastUpdated > ONE_HOUR) {
                this.statsCache.delete(key);
            }
        }

        // Cleanup collections
        for (const [key, value] of this.collections.entries()) {
            if (now - value.lastUpdated > ONE_HOUR) {
                this.collections.delete(key);
            }
        }
    }

    // Public methods for batch operations
    async batchTransfer(nfts: string[], toAddress: string): Promise<TransactionResult[]> {
        try {
            const connection = this.connectionManager.getConnection();
            const results: TransactionResult[] = [];
            const wallet = this.connectionManager.getWallet();

            for (let i = 0; i < nfts.length; i += MAX_BATCH_SIZE) {
                const batch = nfts.slice(i, i + MAX_BATCH_SIZE);
                const batchResults = await Promise.all(
                    batch.map(async (mint) => {
                        try {
                            const metadata = await this.getMetadata(mint);
                            if (!metadata) throw new Error(`No metadata found for NFT ${mint}`);

                            const instructions = await createTransferInstructions(
                                connection,
                                wallet.publicKey,
                                new PublicKey(toAddress),
                                new PublicKey(mint)
                            );

                            return await sendAndConfirmTransaction(
                                connection,
                                wallet,
                                instructions
                            );
                        } catch (error) {
                            log.error(`Error transferring NFT ${mint}:`, error);
                            return {
                                signature: '',
                                error: error as Error
                            };
                        }
                    })
                );
                results.push(...batchResults);
            }

            return results;
        } catch (error) {
            log.error('Error in batch transfer:', error);
            throw error;
        }
    }

    async batchList(nfts: string[], price: number): Promise<TransactionResult[]> {
        try {
            const connection = this.connectionManager.getConnection();
            const results: TransactionResult[] = [];
            const wallet = this.connectionManager.getWallet();

            for (let i = 0; i < nfts.length; i += MAX_BATCH_SIZE) {
                const batch = nfts.slice(i, i + MAX_BATCH_SIZE);
                const batchResults = await Promise.all(
                    batch.map(async (mint) => {
                        try {
                            const metadata = await this.getMetadata(mint);
                            if (!metadata) throw new Error(`No metadata found for NFT ${mint}`);

                            const instructions = await createListingInstructions(
                                connection,
                                wallet.publicKey,
                                new PublicKey(mint),
                                price
                            );

                            return await sendAndConfirmTransaction(
                                connection,
                                wallet,
                                instructions
                            );
                        } catch (error) {
                            log.error(`Error listing NFT ${mint}:`, error);
                            return {
                                signature: '',
                                error: error as Error
                            };
                        }
                    })
                );
                results.push(...batchResults);
            }

            return results;
        } catch (error) {
            log.error('Error in batch listing:', error);
            throw error;
        }
    }

    async batchDelist(nfts: string[]): Promise<TransactionResult[]> {
        try {
            const connection = this.connectionManager.getConnection();
            const results: TransactionResult[] = [];
            const wallet = this.connectionManager.getWallet();

            for (let i = 0; i < nfts.length; i += MAX_BATCH_SIZE) {
                const batch = nfts.slice(i, i + MAX_BATCH_SIZE);
                const batchResults = await Promise.all(
                    batch.map(async (mint) => {
                        try {
                            const metadata = await this.getMetadata(mint);
                            if (!metadata) throw new Error(`No metadata found for NFT ${mint}`);

                            const instructions = await createDelistInstructions(
                                connection,
                                wallet.publicKey,
                                new PublicKey(mint)
                            );

                            return await sendAndConfirmTransaction(
                                connection,
                                wallet,
                                instructions
                            );
                        } catch (error) {
                            log.error(`Error delisting NFT ${mint}:`, error);
                            return {
                                signature: '',
                                error: error as Error
                            };
                        }
                    })
                );
                results.push(...batchResults);
            }

            return results;
        } catch (error) {
            log.error('Error in batch delisting:', error);
            throw error;
        }
    }

    async batchBurn(nfts: string[]): Promise<TransactionResult[]> {
        try {
            const connection = this.connectionManager.getConnection();
            const results: TransactionResult[] = [];
            const wallet = this.connectionManager.getWallet();

            for (let i = 0; i < nfts.length; i += MAX_BATCH_SIZE) {
                const batch = nfts.slice(i, i + MAX_BATCH_SIZE);
                const batchResults = await Promise.all(
                    batch.map(async (mint) => {
                        try {
                            const metadata = await this.getMetadata(mint);
                            if (!metadata) throw new Error(`No metadata found for NFT ${mint}`);

                            const instructions = await createBurnInstructions(
                                connection,
                                wallet.publicKey,
                                new PublicKey(mint)
                            );

                            return await sendAndConfirmTransaction(
                                connection,
                                wallet,
                                instructions
                            );
                        } catch (error) {
                            log.error(`Error burning NFT ${mint}:`, error);
                            return {
                                signature: '',
                                error: error as Error
                            };
                        }
                    })
                );
                results.push(...batchResults);
            }

            return results;
        } catch (error) {
            log.error('Error in batch burning:', error);
            throw error;
        }
    }
} 