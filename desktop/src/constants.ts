// Solana Program IDs
export const TENSOR_PROGRAM_ID = 'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hf73pjqU8';

// API Endpoints
export const HELIUS_API_ENDPOINT = 'https://api.helius.xyz/v0';

// Cache Configuration
export const METADATA_CACHE_MAX_SIZE = 10000;
export const METADATA_CACHE_TTL = 1000 * 60 * 60; // 1 hour
export const STATS_CACHE_MAX_SIZE = 1000;
export const STATS_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

// Batch Processing
export const MAX_BATCH_SIZE = 8; // Solana's limit for transactions in a batch
export const PROCESSING_INTERVAL = 100; // milliseconds

// Network Configuration
export const DEFAULT_COMMITMENT = 'confirmed';
export const TRANSACTION_TIMEOUT = 60000; // 1 minute
export const MAX_RETRIES = 3;
export const RETRY_DELAY = 1000; // 1 second

// UI Configuration
export const WINDOW_DEFAULT_WIDTH = 1200;
export const WINDOW_DEFAULT_HEIGHT = 800;
export const WINDOW_MIN_WIDTH = 800;
export const WINDOW_MIN_HEIGHT = 600; 