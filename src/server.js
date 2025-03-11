const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const { Server } = require('socket.io');
const http = require('http');
const winston = require('winston');
const { Connection } = require('@solana/web3.js');
const { LRUCache } = require('lru-cache');
const rateLimit = require('express-rate-limit');
const cluster = require('cluster');
const os = require('os');
require('dotenv').config();

// Initialize logger with better formatting
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: process.env.LOG_FILE_PATH || 'logs/error.log',
            level: 'error'
        }),
        new winston.transports.File({ 
            filename: process.env.LOG_FILE_PATH || 'logs/combined.log'
        })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Enhanced cache configuration
const cache = new LRUCache({
    max: parseInt(process.env.CACHE_MAX_ITEMS) || 1000,
    ttl: parseInt(process.env.CACHE_TTL) || 1000 * 60 * 5,
    updateAgeOnGet: true,
    dispose: (key, value) => {
        logger.debug(`Cache entry disposed: ${key}`);
    }
});

// Initialize Solana connection pool
const connectionPool = [];
const RPC_ENDPOINTS = [
    process.env.SOLANA_RPC_ENDPOINT,
    process.env.RPC_ENDPOINT,
    'https://api.mainnet-beta.solana.com'
].filter(Boolean);

RPC_ENDPOINTS.forEach(endpoint => {
    connectionPool.push(new Connection(endpoint, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000
    }));
});

let currentConnectionIndex = 0;

function getNextConnection() {
    const connection = connectionPool[currentConnectionIndex];
    currentConnectionIndex = (currentConnectionIndex + 1) % connectionPool.length;
    return connection;
}

// Use cluster for better performance
if (cluster.isMaster) {
    const numCPUs = os.cpus().length;
    logger.info(`Master process is running on PID: ${process.pid}`);

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        logger.warn(`Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });
} else {
    // Initialize express app
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST'],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // Enhanced middleware
    app.use(helmet({
        contentSecurityPolicy: process.env.NODE_ENV === 'production'
    }));
    app.use(compression());
    app.use(cors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        credentials: true
    }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.static(path.join(__dirname, '../public')));

    // Enhanced rate limiting
    const limiter = rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false
    });
    app.use(limiter);

    // Health check endpoint
    app.get('/api/health', (req, res) => {
        res.json({ 
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: Date.now()
        });
    });

    // Enhanced error handling for collection endpoints
    app.get('/api/collections/:address', async (req, res) => {
        try {
            const { address } = req.params;
            const cached = cache.get(address);
            
            if (cached) {
                logger.debug(`Cache hit for collection: ${address}`);
                return res.json(cached);
            }

            const response = await fetch(
                `https://api.helius.xyz/v0/addresses/${address}/nfts?api-key=${process.env.HELIUS_API_KEY}`,
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

            // Cache the response
            cache.set(address, data);
            logger.debug(`Cached collection data for: ${address}`);
            
            res.json(data);
        } catch (error) {
            logger.error('Error fetching collection:', error);
            res.status(500).json({ 
                error: 'Failed to fetch collection data',
                message: error.message
            });
        }
    });

    // Enhanced stats endpoint
    app.get('/api/stats/:collection', async (req, res) => {
        try {
            const { collection } = req.params;
            const cached = cache.get(`stats_${collection}`);
            
            if (cached) {
                logger.debug(`Cache hit for stats: ${collection}`);
                return res.json(cached);
            }

            const response = await fetch(
                `https://api.helius.xyz/v0/collections/${collection}/stats?api-key=${process.env.HELIUS_API_KEY}`,
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

            // Cache the response
            cache.set(`stats_${collection}`, data);
            logger.debug(`Cached stats for collection: ${collection}`);
            
            res.json(data);
        } catch (error) {
            logger.error('Error fetching stats:', error);
            res.status(500).json({ 
                error: 'Failed to fetch collection stats',
                message: error.message
            });
        }
    });

    // WebSocket connection handling with better error handling
    io.on('connection', (socket) => {
        logger.info(`Client connected: ${socket.id}`);
        
        socket.on('subscribe_collection', async (collectionAddress) => {
            try {
                // Add to subscription room
                socket.join(`collection:${collectionAddress}`);
                logger.debug(`Socket ${socket.id} subscribed to collection: ${collectionAddress}`);
                
                // Send initial data
                const cachedData = cache.get(collectionAddress);
                if (cachedData) {
                    socket.emit('collection_update', cachedData);
                } else {
                    const data = await fetchCollectionData(collectionAddress);
                    cache.set(collectionAddress, data);
                    socket.emit('collection_update', data);
                }
            } catch (error) {
                logger.error('Subscription error:', error);
                socket.emit('error', { 
                    message: 'Failed to subscribe to collection updates',
                    error: error.message
                });
            }
        });

        socket.on('disconnect', () => {
            logger.info(`Client disconnected: ${socket.id}`);
        });

        // Handle errors
        socket.on('error', (error) => {
            logger.error(`Socket error for ${socket.id}:`, error);
        });
    });

    // Enhanced collection data fetching
    async function fetchCollectionData(address) {
        try {
            const response = await fetch(
                `https://api.helius.xyz/v0/token-metadata/${address}?api-key=${process.env.HELIUS_API_KEY}`,
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
            return {
                address,
                ...data,
                timestamp: Date.now()
            };
        } catch (error) {
            logger.error('Error fetching collection data:', error);
            throw error;
        }
    }

    // Cleanup old cache entries periodically
    setInterval(() => {
        try {
            const stats = cache.dump();
            logger.info('Cache stats:', {
                size: cache.size,
                maxSize: cache.max,
                keys: Object.keys(stats).length
            });
        } catch (error) {
            logger.error('Error logging cache stats:', error);
        }
    }, parseInt(process.env.UPDATE_INTERVAL) || 60000);

    // Error handling middleware
    app.use((err, req, res, next) => {
        logger.error('Unhandled error:', err);
        res.status(500).json({ 
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    });

    // Serve index.html for all other routes
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // Start server with enhanced logging
    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || '0.0.0.0';
    server.listen(PORT, HOST, () => {
        logger.info(`Worker ${process.pid} started`);
        logger.info(`Server running on http://${HOST}:${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Handle process termination
    process.on('SIGTERM', () => {
        logger.info('SIGTERM received. Shutting down gracefully...');
        server.close(() => {
            logger.info('Server closed');
            process.exit(0);
        });
    });
}
