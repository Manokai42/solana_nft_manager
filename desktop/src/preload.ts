import { contextBridge, ipcRenderer } from 'electron/renderer';
import type { IpcRendererEvent } from 'electron/renderer';

interface NFTData {
    mint: string;
    name: string;
    symbol: string;
    uri: string;
    collection?: {
        address: string;
        name: string;
    };
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'api', {
        // NFT Management
        loadNFTs: async (walletAddress: string, page: number = 0, pageSize: number = 50) => {
            return await ipcRenderer.invoke('load-nfts', walletAddress, page, pageSize);
        },
        batchTransfer: async (nfts: string[], toAddress: string) => {
            return await ipcRenderer.invoke('batch-transfer', nfts, toAddress);
        },
        batchList: async (nfts: string[], price: number) => {
            return await ipcRenderer.invoke('batch-list', nfts, price);
        },
        batchDelist: async (nfts: string[]) => {
            return await ipcRenderer.invoke('batch-delist', nfts);
        },
        batchBurn: async (nfts: string[]) => {
            return await ipcRenderer.invoke('batch-burn', nfts);
        },

        // Connection Management
        getHealth: async () => {
            return await ipcRenderer.invoke('get-health');
        },
        getCurrentEndpoint: () => {
            return ipcRenderer.invoke('get-current-endpoint');
        },
        switchEndpoint: async (newEndpoint: string) => {
            return await ipcRenderer.invoke('switch-endpoint', newEndpoint);
        },
        getBalance: async (publicKey: string) => {
            return await ipcRenderer.invoke('get-balance', publicKey);
        },

        // System Events
        onError: (callback: (error: Error) => void) => {
            ipcRenderer.on('error', (_event: IpcRendererEvent, error: Error) => callback(error));
        },
        onNetworkChange: (callback: (endpoint: string) => void) => {
            ipcRenderer.on('network-change', (_event: IpcRendererEvent, endpoint: string) => callback(endpoint));
        },
        onNFTUpdate: (callback: (data: NFTData) => void) => {
            ipcRenderer.on('nft-update', (_event: IpcRendererEvent, data: NFTData) => callback(data));
        }
    }
);

// Type declarations for TypeScript
declare global {
    interface Window {
        api: {
            // NFT Management
            loadNFTs: (walletAddress: string, page?: number, pageSize?: number) => Promise<NFTData[]>;
            batchTransfer: (nfts: string[], toAddress: string) => Promise<void>;
            batchList: (nfts: string[], price: number) => Promise<void>;
            batchDelist: (nfts: string[]) => Promise<void>;
            batchBurn: (nfts: string[]) => Promise<void>;

            // Connection Management
            getHealth: () => Promise<boolean>;
            getCurrentEndpoint: () => Promise<string>;
            switchEndpoint: (newEndpoint: string) => Promise<void>;
            getBalance: (publicKey: string) => Promise<number>;

            // System Events
            onError: (callback: (error: Error) => void) => void;
            onNetworkChange: (callback: (endpoint: string) => void) => void;
            onNFTUpdate: (callback: (data: NFTData) => void) => void;
        }
    }
} 