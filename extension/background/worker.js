// Import required libraries
importScripts('../src/lib/web3.min.js');
importScripts('../src/lib/buffer.min.js');

// Constants
const HELIUS_API_KEY = '10fb665e-d935-450e-8543-fcfed0f94554';
const RPC_ENDPOINTS = [
    `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com'
];

// State management
let state = {
    connection: null,
    currentEndpointIndex: 0,
    collections: new Map(),
    metadataCache: new Map(),
    statsCache: new Map(),
    processingQueue: [],
    isProcessing: false
};

// Initialize IndexedDB for persistent storage
let db;
const request = indexedDB.open('SolanaNFTManager', 1);

request.onerror = (event) => {
    console.error('Database error:', event.target.error);
};

request.onupgradeneeded = (event) => {
    db = event.target.result;
    
    // Create object stores
    if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'mint' });
    }
    if (!db.objectStoreNames.contains('collections')) {
        db.createObjectStore('collections', { keyPath: 'address' });
    }
    if (!db.objectStoreNames.contains('stats')) {
        db.createObjectStore('stats', { keyPath: 'collection' });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    initializeConnection();
};

// Connection management
function initializeConnection() {
    try {
        state.connection = new solanaWeb3.Connection(
            RPC_ENDPOINTS[state.currentEndpointIndex],
            'confirmed'
        );
    } catch (error) {
        console.error('Connection initialization error:', error);
        rotateEndpoint();
    }
}

function rotateEndpoint() {
    state.currentEndpointIndex = (state.currentEndpointIndex + 1) % RPC_ENDPOINTS.length;
    initializeConnection();
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.type) {
        case 'LOAD_NFTS':
            handleLoadNFTs(request.payload).then(sendResponse);
            return true;
        case 'BATCH_TRANSFER':
            handleBatchTransfer(request.payload).then(sendResponse);
            return true;
        case 'UPDATE_STATS':
            handleUpdateStats(request.payload).then(sendResponse);
            return true;
        default:
            console.error('Unknown message type:', request.type);
            return false;
    }
});

// NFT loading with pagination and caching
async function handleLoadNFTs({ walletAddress, page = 0, pageSize = 50 }) {
    try {
        const cacheKey = `${walletAddress}_${page}_${pageSize}`;
        const cachedData = await getFromCache('metadata', cacheKey);
        
        if (cachedData) {
            return { success: true, data: cachedData };
        }

        const response = await fetch(
            `https://api.helius.xyz/v0/addresses/${walletAddress}/nfts?api-key=${HELIUS_API_KEY}&pagination=${page * pageSize},${pageSize}`,
            { timeout: 10000 }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const processedData = await processNFTData(data.nfts);
        
        // Cache the results
        await saveToCache('metadata', cacheKey, processedData);
        
        return { success: true, data: processedData };
    } catch (error) {
        console.error('Error loading NFTs:', error);
        return { success: false, error: error.message };
    }
}

// Batch processing with memory optimization
async function processNFTData(nfts) {
    const BATCH_SIZE = 10;
    const processedNFTs = [];
    
    for (let i = 0; i < nfts.length; i += BATCH_SIZE) {
        const batch = nfts.slice(i, i + BATCH_SIZE);
        const processedBatch = await Promise.all(
            batch.map(async (nft) => {
                try {
                    const metadata = await fetchMetadata(nft.mint);
                    return {
                        mint: nft.mint,
                        metadata,
                        collection: nft.collection,
                        lastAccessed: Date.now()
                    };
                } catch (error) {
                    console.error(`Error processing NFT ${nft.mint}:`, error);
                    return null;
                }
            })
        );
        processedNFTs.push(...processedBatch.filter(Boolean));
    }

    return processedNFTs;
}

// IndexedDB operations
async function saveToCache(store, key, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([store], 'readwrite');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.put({ id: key, data, timestamp: Date.now() });
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function getFromCache(store, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([store], 'readonly');
        const objectStore = transaction.objectStore(store);
        const request = objectStore.get(key);
        
        request.onsuccess = () => {
            const record = request.result;
            if (!record || Date.now() - record.timestamp > 1000 * 60 * 60) {
                resolve(null);
            } else {
                resolve(record.data);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// Cleanup old cache entries periodically
setInterval(async () => {
    try {
        const stores = ['metadata', 'collections', 'stats'];
        const ONE_HOUR = 1000 * 60 * 60;
        
        for (const store of stores) {
            const transaction = db.transaction([store], 'readwrite');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (Date.now() - cursor.value.timestamp > ONE_HOUR) {
                        cursor.delete();
                    }
                    cursor.continue();
                }
            };
        }
    } catch (error) {
        console.error('Cache cleanup error:', error);
    }
}, 1000 * 60 * 30); // Run every 30 minutes 