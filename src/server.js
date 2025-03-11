const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const { Server } = require('socket.io');
const http = require('http');
const winston = require('winston');
require('dotenv').config();

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// API endpoints
app.get('/api/config', (req, res) => {
    res.json({
        rpcEndpoint: process.env.SOLANA_RPC_ENDPOINT,
        wsEndpoint: process.env.SOLANA_WS_ENDPOINT
    });
});

// WebSocket connection handling
io.on('connection', (socket) => {
    logger.info('Client connected');

    socket.on('subscribe_collection', (collectionAddress) => {
        socket.join(`collection_${collectionAddress}`);
        logger.info(`Client subscribed to collection: ${collectionAddress}`);
    });

    socket.on('unsubscribe_collection', (collectionAddress) => {
        socket.leave(`collection_${collectionAddress}`);
        logger.info(`Client unsubscribed from collection: ${collectionAddress}`);
    });

    socket.on('disconnect', () => {
        logger.info('Client disconnected');
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).send('Something broke!');
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
