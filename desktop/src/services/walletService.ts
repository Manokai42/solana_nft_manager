import { PublicKey } from '@solana/web3.js';
import * as log from 'electron-log';
import { ConnectionManager, Wallet } from '../connectionManager';
import { NFTManager } from '../nftManager';
import Store from 'electron-store';

interface WalletState {
    isConnected: boolean;
    publicKey: string | null;
    balance: number;
    lastConnected: number;
}

interface StoreSchema {
    walletState: WalletState;
}

export class WalletService {
    private store: Store<StoreSchema>;
    private state: WalletState;

    constructor(
        private connectionManager: ConnectionManager,
        private nftManager: NFTManager
    ) {
        this.store = new Store<StoreSchema>({
            name: 'wallet-state',
            defaults: {
                walletState: {
                    isConnected: false,
                    publicKey: null,
                    balance: 0,
                    lastConnected: 0
                }
            }
        });

        this.state = this.store.get('walletState');
    }

    public async connectWallet(wallet: Wallet): Promise<void> {
        try {
            this.connectionManager.setWallet(wallet);
            
            const balance = await this.connectionManager.getBalance(
                wallet.publicKey.toString()
            );

            this.state = {
                isConnected: true,
                publicKey: wallet.publicKey.toString(),
                balance,
                lastConnected: Date.now()
            };

            this.store.set('walletState', this.state);
            log.info('Wallet connected successfully');

        } catch (error) {
            log.error('Error connecting wallet:', error);
            throw error;
        }
    }

    public disconnectWallet(): void {
        try {
            this.connectionManager.disconnectWallet();
            this.state = {
                isConnected: false,
                publicKey: null,
                balance: 0,
                lastConnected: 0
            };
            this.store.set('walletState', this.state);
            log.info('Wallet disconnected successfully');
        } catch (error) {
            log.error('Error disconnecting wallet:', error);
            throw error;
        }
    }

    public async refreshBalance(): Promise<number> {
        try {
            if (!this.state.publicKey) {
                throw new Error('Wallet not connected');
            }

            const balance = await this.connectionManager.getBalance(
                this.state.publicKey
            );

            this.state.balance = balance;
            this.store.set('walletState', this.state);

            return balance;
        } catch (error) {
            log.error('Error refreshing balance:', error);
            throw error;
        }
    }

    public getState(): WalletState {
        return { ...this.state };
    }

    public isConnected(): boolean {
        return this.state.isConnected && this.connectionManager.isWalletConnected();
    }

    public async validateConnection(): Promise<boolean> {
        try {
            if (!this.state.isConnected || !this.state.publicKey) {
                return false;
            }

            const isHealthy = await this.connectionManager.getHealth();
            if (!isHealthy) {
                this.disconnectWallet();
                return false;
            }

            return true;
        } catch (error) {
            log.error('Error validating connection:', error);
            return false;
        }
    }

    public async signTransaction(transaction: any): Promise<any> {
        try {
            const wallet = this.connectionManager.getWallet();
            return await wallet.signTransaction(transaction);
        } catch (error) {
            log.error('Error signing transaction:', error);
            throw error;
        }
    }

    public async signAllTransactions(transactions: any[]): Promise<any[]> {
        try {
            const wallet = this.connectionManager.getWallet();
            return await wallet.signAllTransactions(transactions);
        } catch (error) {
            log.error('Error signing transactions:', error);
            throw error;
        }
    }
} 