import { Connection, Commitment, ConnectionConfig } from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import log from 'electron-log';
import {
    RPC_ENDPOINTS,
    WS_ENDPOINTS,
    MAX_RETRIES,
    RETRY_DELAY,
    ERROR_MESSAGES,
    PERFORMANCE_MONITORING_INTERVAL
} from '../utils/constants';

export class ConnectionManager {
    private connections: Connection[] = [];
    private currentIndex = 0;
    private wallet: WalletAdapter | null = null;
    private monitoringInterval: NodeJS.Timeout | null = null;

    constructor(
        endpoints: string[] = RPC_ENDPOINTS,
        commitment: Commitment = 'confirmed',
        config?: Partial<ConnectionConfig>
    ) {
        this.initializeConnections(endpoints, commitment, config);
        this.startMonitoring();
    }

    private initializeConnections(
        endpoints: string[],
        commitment: Commitment,
        config?: Partial<ConnectionConfig>
    ): void {
        this.connections = endpoints.map(endpoint => {
            const wsEndpoint = WS_ENDPOINTS[RPC_ENDPOINTS.indexOf(endpoint)];
            return new Connection(endpoint, {
                commitment,
                wsEndpoint,
                ...config
            });
        });
    }

    private startMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        this.monitoringInterval = setInterval(
            () => this.monitorConnections(),
            PERFORMANCE_MONITORING_INTERVAL
        );
    }

    private async monitorConnections(): Promise<void> {
        for (let i = 0; i < this.connections.length; i++) {
            try {
                const start = Date.now();
                await this.connections[i].getLatestBlockhash();
                const latency = Date.now() - start;

                if (latency > 2000) { // 2 seconds threshold
                    log.warn(`High latency (${latency}ms) detected for connection ${i}`);
                }
            } catch (error) {
                log.error(`Connection ${i} health check failed:`, error);
                await this.handleConnectionFailure(i);
            }
        }
    }

    private async handleConnectionFailure(index: number): Promise<void> {
        const endpoint = RPC_ENDPOINTS[index];
        let retryCount = 0;

        while (retryCount < MAX_RETRIES) {
            try {
                const newConnection = new Connection(endpoint, {
                    commitment: this.connections[index].commitment,
                    wsEndpoint: WS_ENDPOINTS[index]
                });

                // Test the new connection
                await newConnection.getLatestBlockhash();
                
                // Replace the failed connection
                this.connections[index] = newConnection;
                log.info(`Successfully reconnected to ${endpoint}`);
                return;
            } catch (error) {
                retryCount++;
                if (retryCount === MAX_RETRIES) {
                    log.error(`Failed to reconnect to ${endpoint} after ${MAX_RETRIES} attempts`);
                    // Remove the failed connection
                    this.connections.splice(index, 1);
                    if (this.connections.length === 0) {
                        throw new Error(ERROR_MESSAGES.NO_CONNECTION);
                    }
                } else {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
                }
            }
        }
    }

    public getConnection(): Connection {
        if (this.connections.length === 0) {
            throw new Error(ERROR_MESSAGES.NO_CONNECTION);
        }

        // Round-robin selection
        const connection = this.connections[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.connections.length;
        return connection;
    }

    public setWallet(wallet: WalletAdapter): void {
        this.wallet = wallet;
    }

    public getWallet(): WalletAdapter {
        if (!this.wallet) {
            throw new Error(ERROR_MESSAGES.NO_WALLET);
        }
        return this.wallet;
    }

    public isWalletConnected(): boolean {
        return this.wallet !== null && this.wallet.connected;
    }

    public disconnectWallet(): void {
        if (this.wallet && this.wallet.connected) {
            this.wallet.disconnect();
        }
        this.wallet = null;
    }

    public cleanup(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.disconnectWallet();
        this.connections = [];
    }
} 