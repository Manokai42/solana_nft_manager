export interface NFTData {
    mint: string;
    name: string;
    symbol: string;
    uri: string;
    collection?: string;
    attributes?: NFTAttribute[];
    image?: string;
    price?: number;
    lastUpdated: number;
}

export interface NFTAttribute {
    trait_type: string;
    value: string | number;
    rarity?: number;
}

export interface CollectionStats {
    floorPrice: number;
    listedCount: number;
    volumeAll: number;
    volume24h: number;
    avgPrice24h: number;
    totalItems: number;
    holders: number;
    lastUpdated: number;
}

export interface NFTGroup {
    collection: string;
    nfts: NFTData[];
    stats: CollectionStats;
    totalValue: number;
}

export interface TransactionResult {
    signature: string;
    error?: Error;
}

export interface BatchOperationResult {
    successful: string[];
    failed: Array<{
        mint: string;
        error: string;
    }>;
    totalProcessed: number;
}

export interface NFTManagerConfig {
    batchSize?: number;
    maxCacheSize?: number;
    cacheTTL?: number;
    retryAttempts?: number;
    retryDelay?: number;
 