import { Connection, Commitment, ConnectionConfig, PublicKey } from '@solana/web3.js';
import * as log from 'electron-log';

export interface Wallet {
    publicKey: PublicKey;
    signTransaction: (transaction: any) => Promise<any>;
    signAllTransactions: (transactions: any[]) => Promise<any[]>;
}

export class ConnectionManager {
    private connection: Connection | null = null;
    private readonly defaultEndpoint = 'https://api.mainnet-beta.solana.com';
    private currentEndpoint: string;
    private readonly commitmentLevel: Commitment = 'confirmed';
    private wallet: Wallet | null = null;

    constructor(endpoint?: string) {
        this.currentEndpoint = endpoint || this.defaultEndpoint;
        this.initializeConnection();
    }

    private initializeConnection() {
        try {
            const config: ConnectionConfig = {
                commitment: this.commitmentLevel,
                confirmTransactionInitialTimeout: 60000,
                disableRetryOnRateLimit: false,
            };

            this.connection = new Connection(this.currentEndpoint, config);
            log.info(`Initialized Solana connection to ${this.currentEndpoint}`);
        } catch (error) {
            log.error('Failed to initialize Solana connection:', error);
            throw error;
        }
    }

    public getConnection(): Connection {
        if (!this.connection) {
            this.initializeConnection();
        }
        return this.connection!;
    }

    public async switchEndpoint(newEndpoint: string) {
        try {
            // Test the new endpoint before switching
            const testConnection = new Connection(newEndpoint, {
                commitment: this.commitmentLevel
            });
            await testConnection.getVersion();

            this.currentEndpoint = newEndpoint;
            this.initializeConnection();
            log.info(`Successfully switched to new endpoint: ${newEndpoint}`);
        } catch (error) {
            log.error(`Failed to switch to endpoint ${newEndpoint}:`, error);
            throw error;
        }
    }

    public async getHealth(): Promise<boolean> {
        try {
            if (!this.connection) {
                return false;
            }
            const version = await this.connection.getVersion();
            return version !== null;
        } catch (error) {
            log.error('Health check failed:', error);
            return false;
        }
    }

    public getCurrentEndpoint(): string {
        return this.currentEndpoint;
    }

    public async getSlot(): Promise<number> {
        try {
            if (!this.connection) {
                throw new Error('Connection not initialized');
            }
            return await this.connection.getSlot();
        } catch (error) {
            log.error('Failed to get current slot:', error);
            throw error;
        }
    }

    public async getBalance(publicKey: string): Promise<number> {
        try {
            if (!this.connection) {
                throw new Error('Connection not initialized');
            }
            return await this.connection.getBalance(new PublicKey(publicKey));
        } catch (error) {
            log.error(`Failed to get balance for ${publicKey}:`, error);
            throw error;
        }
    }

    public setWallet(wallet: Wallet) {
        this.wallet = wallet;
        log.info('Wallet set successfully');
    }

    public getWallet(): Wallet {
        if (!this.wallet) {
            throw new Error('Wallet not connected');
        }
        return this.wallet;
    }

    public isWalletConnected(): boolean {
        return this.wallet !== null;
    }

    public disconnectWallet() {
        this.wallet = null;
        log.info('Wallet disconnected');
    }
} 