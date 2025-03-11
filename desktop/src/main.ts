import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as log from 'electron-log';
import Store from 'electron-store';
import { Connection, PublicKey } from '@solana/web3.js';
import { NFTManager } from './services/nftManager';
import { setupIPC } from './ipc';
import { ConnectionManager } from './services/connectionManager';
import { WalletService } from './services/walletService';
import {
    WINDOW_DEFAULT_WIDTH,
    WINDOW_DEFAULT_HEIGHT,
    WINDOW_MIN_WIDTH,
    WINDOW_MIN_HEIGHT
} from './constants';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Initialize store
const store = new Store({
    name: 'solana-nft-manager',
    defaults: {
        windowBounds: { 
            width: WINDOW_DEFAULT_WIDTH, 
            height: WINDOW_DEFAULT_HEIGHT 
        },
        rpcEndpoint: 'https://api.mainnet-beta.solana.com',
        theme: 'dark'
    }
});

// Global state
let mainWindow: BrowserWindow | null = null;
let connectionManager: ConnectionManager;
let nftManager: NFTManager;
let walletService: WalletService;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: WINDOW_DEFAULT_WIDTH,
        height: WINDOW_DEFAULT_HEIGHT,
        minWidth: WINDOW_MIN_WIDTH,
        minHeight: WINDOW_MIN_HEIGHT,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    // Load the index.html file
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Initialize services
function initializeServices() {
    connectionManager = new ConnectionManager();
    nftManager = new NFTManager(connectionManager.getConnection());
    walletService = new WalletService(connectionManager, nftManager);
}

// IPC handlers
ipcMain.handle('connect-wallet', async (event, wallet) => {
    try {
        connectionManager.setWallet(wallet);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-nfts', async (event, { walletAddress, page, itemsPerPage }) => {
    try {
        const result = await nftManager.loadNFTsByPage(walletAddress, page, itemsPerPage);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('batch-transfer', async (event, { nfts, toAddress }) => {
    try {
        const result = await nftManager.batchTransfer(nfts, toAddress);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('batch-list', async (event, { nfts, price }) => {
    try {
        const result = await nftManager.batchList(nfts, price);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// App lifecycle events
app.whenReady().then(() => {
    initializeServices();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Cleanup on app quit
app.on('before-quit', async () => {
    if (connectionManager) {
        connectionManager.cleanup();
    }
    if (nftManager) {
        await nftManager.cleanup();
    }
});

// Error handling
process.on('uncaughtException', (error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log.error('Uncaught Exception:', errorMessage);
});

process.on('unhandledRejection', (error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    log.error('Unhandled Rejection:', errorMessage);
});

// Memory management
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        event.preventDefault();
        log.warn('Navigation prevented:', navigationUrl);
    });
});

setInterval(() => {
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.85) {
        log.warn('High memory usage detected:', memoryUsage);
        if (global.gc) {
            global.gc();
            log.info('Garbage collection triggered');
        }
    }
}, 60000); // Check every minute

// Additional IPC handlers for wallet operations
ipcMain.handle('disconnect-wallet', async () => {
    try {
        walletService.disconnectWallet();
        return { success: true };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        log.error('Error disconnecting wallet:', errorMessage);
        return { success: false, error: errorMessage };
    }
});

ipcMain.handle('get-wallet-state', () => {
    return walletService.getState();
});

ipcMain.handle('refresh-balance', async () => {
    try {
        const balance = await walletService.refreshBalance();
        return { success: true, balance };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        log.error('Error refreshing balance:', errorMessage);
        return { success: false, error: errorMessage };
    }
});