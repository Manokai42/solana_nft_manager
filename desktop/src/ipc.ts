import { BrowserWindow, ipcMain } from 'electron';
import { NFTManager } from './nftManager';
import { ConnectionManager } from './connectionManager';
import { WalletService } from './services/walletService';
import * as log from 'electron-log';

export function setupIPC(
    mainWindow: BrowserWindow, 
    nftManager: NFTManager, 
    connectionManager: ConnectionManager,
    walletService: WalletService
) {
    // NFT Management IPC handlers
    ipcMain.handle('load-nfts', async (_event, walletAddress: string, page: number, pageSize: number) => {
        try {
            return await nftManager.loadNFTs(walletAddress, page, pageSize);
        } catch (error) {
            log.error('Error loading NFTs:', error);
            throw error;
        }
    });

    ipcMain.handle('batch-transfer', async (_event, nfts: string[], toAddress: string) => {
        try {
            return await nftManager.batchTransfer(nfts, toAddress);
        } catch (error) {
            log.error('Error in batch transfer:', error);
            throw error;
        }
    });

    ipcMain.handle('batch-list', async (_event, nfts: string[], price: number) => {
        try {
            return await nftManager.batchList(nfts, price);
        } catch (error) {
            log.error('Error in batch listing:', error);
            throw error;
        }
    });

    ipcMain.handle('batch-delist', async (_event, nfts: string[]) => {
        try {
            return await nftManager.batchDelist(nfts);
        } catch (error) {
            log.error('Error in batch delisting:', error);
            throw error;
        }
    });

    ipcMain.handle('batch-burn', async (_event, nfts: string[]) => {
        try {
            return await nftManager.batchBurn(nfts);
        } catch (error) {
            log.error('Error in batch burning:', error);
            throw error;
        }
    });

    // Connection Management IPC handlers
    ipcMain.handle('switch-endpoint', async (_event, endpoint: string) => {
        try {
            await connectionManager.switchEndpoint(endpoint);
            return { success: true };
        } catch (error) {
            log.error('Error switching endpoint:', error);
            throw error;
        }
    });

    ipcMain.handle('get-connection-health', async () => {
        try {
            return await connectionManager.getHealth();
        } catch (error) {
            log.error('Error checking connection health:', error);
            throw error;
        }
    });

    // Wallet Management IPC handlers
    ipcMain.handle('connect-wallet', async (_event, wallet) => {
        try {
            await walletService.connectWallet(wallet);
            return { success: true };
        } catch (error) {
            log.error('Error connecting wallet:', error);
            throw error;
        }
    });

    ipcMain.handle('disconnect-wallet', () => {
        try {
            walletService.disconnectWallet();
            return { success: true };
        } catch (error) {
            log.error('Error disconnecting wallet:', error);
            throw error;
        }
    });

    ipcMain.handle('get-wallet-state', () => {
        return walletService.getState();
    });

    ipcMain.handle('refresh-balance', async () => {
        try {
            const balance = await walletService.refreshBalance();
            return { success: true, balance };
        } catch (error) {
            log.error('Error refreshing balance:', error);
            throw error;
        }
    });

    // Error handling
    ipcMain.on('error', (event, error) => {
        log.error('IPC Error:', error);
        mainWindow.webContents.send('error', error);
    });

    // Cleanup on window close
    mainWindow.on('closed', () => {
        ipcMain.removeAllListeners();
    });
} 