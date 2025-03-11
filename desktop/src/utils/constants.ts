// Network Configuration
export const RPC_ENDPOINTS = [
    process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
    'https://rpc.ankr.com/solana'
];

export const WS_ENDPOINTS = RPC_ENDPOINTS.map(endpoint => endpoint.replace('https', 'wss'));

// Transaction Configuration
export const MAX_RETRIES = 3;
export const RETRY_DELAY = 1000; // 1 second
export const TRANSACTION_TIMEOUT = 60000; // 1 minute
export const MAX_BATCH_SIZE = 8; // Solana's limit for transactions in a batch

// Cache Configuration
export const METADATA_CACHE_SIZE = 10000;
export const METADATA_CACHE_TTL = 1000 * 60 * 60; // 1 hour
export const STATS_CACHE_SIZE = 1000;
export const STATS_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

// API Configuration
export const HELIUS_API_ENDPOINT = 'https://api.helius.xyz/v0';
export const TENSOR_PROGRAM_ID = 'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN';

// UI Configuration
export const ITEMS_PER_PAGE = 50;
export const INFINITE_SCROLL_THRESHOLD = 0.8;
export const ANIMATION_DURATION = 300;

// Error Messages
export const ERROR_MESSAGES = {
    NO_WALLET: 'No wallet connected',
    NO_CONNECTION: 'No available connections',
    TRANSACTION_TIMEOUT: 'Transaction confirmation timeout',
    INSUFFICIENT_FUNDS: 'Insufficient funds for transaction',
    INVALID_MINT: 'Invalid NFT mint address',
    LISTING_FAILED: 'Failed to list NFT',
    TRANSFER_FAILED: 'Failed to transfer NFT',
    METADATA_FETCH_FAILED: 'Failed to fetch NFT metadata'
};

// Analytics Configuration
export const ANALYTICS_ENABLED = process.env.NODE_ENV === 'production';
export const PERFORMANCE_MONITORING_INTERVAL = 60000; // 1 minute

// Memory Management
export const MAX_MEMORY_USAGE = 0.85; // 85% of available memory
export const CLEANUP_INTERVAL = 1000 * 60 * 60; // 1 hour

// Feature Flags
export const FEATURES = {
    BATCH_OPERATIONS: true,
    REAL_TIME_UPDATES: true,
    PRICE_ALERTS: true,
    RARITY_ANALYSIS: true,
    PERFORMANCE_OPTIMIZATION: true
}; 