// Mock @solana/web3.js
jest.mock('@solana/web3.js', () => ({
    Connection: jest.fn().mockImplementation(() => ({
        getBalance: jest.fn().mockResolvedValue(1000000),
        getAccountInfo: jest.fn().mockResolvedValue(null)
    })),
    PublicKey: jest.fn().mockImplementation((key) => ({
        toBase58: () => key,
        toString: () => key
    }))
}));

// Mock @metaplex-foundation/mpl-token-metadata
jest.mock('@metaplex-foundation/mpl-token-metadata', () => ({
    Metadata: {
        load: jest.fn().mockResolvedValue({
            data: {
                data: {
                    name: 'Test NFT',
                    symbol: 'TEST',
                    uri: 'https://test.uri'
                }
            }
        })
    }
}));

// Mock node-fetch
jest.mock('node-fetch', () => 
    jest.fn().mockImplementation(() => 
        Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ 
                nfts: [],
                total: 0
            })
        })
    )
);

const { Connection } = require('@solana/web3.js');
const NFTCollectionManager = require('../../src/nftCollectionManager');

describe('NFTCollectionManager', () => {
    let manager;
    const mockWalletAddress = 'mock-wallet-address';
    
    beforeEach(() => {
        jest.clearAllMocks();
        const mockConnection = new Connection();
        manager = new NFTCollectionManager(mockConnection, mockWalletAddress);
    });

    describe('initialization', () => {
        it('should initialize with correct properties', () => {
            expect(manager.walletAddress).toBe(mockWalletAddress);
            expect(manager.collections).toBeDefined();
            expect(manager.floorPrices).toBeDefined();
            expect(manager.activityHistory).toBeDefined();
        });

        it('should initialize caches with correct configuration', () => {
            expect(manager.metadataCache).toBeDefined();
            expect(manager.statsCache).toBeDefined();
        });
    });

    describe('loadNFTsByPage', () => {
        it('should return cached data if available', async () => {
            const mockData = { nfts: [] };
            manager.metadataCache.set('nfts_mock-wallet-address_0_50', mockData);
            
            const result = await manager.loadNFTsByPage(0, 50);
            expect(result).toEqual(mockData);
        });

        it('should fetch and cache new data if not in cache', async () => {
            const result = await manager.loadNFTsByPage(0, 50);
            expect(result).toBeDefined();
            expect(result.nfts).toBeDefined();
        });
    });

    describe('_processNFTData', () => {
        it('should process NFT data correctly', async () => {
            const mockData = {
                nfts: [
                    {
                        metadata: {
                            collection: { address: 'col1' },
                            creators: [{ address: 'creator1' }],
                            symbol: 'SYMBOL'
                        }
                    }
                ]
            };
            
            const result = await manager._processNFTData(mockData);
            expect(result.nfts).toBeDefined();
            expect(result.timestamp).toBeDefined();
        });
    });

    describe('cleanup', () => {
        it('should clear all caches and collections', async () => {
            await manager.cleanup();
            
            expect(manager.collections.size).toBe(0);
            expect(manager.activityHistory.size).toBe(0);
            expect(manager.metadataCache.size).toBe(0);
            expect(manager.statsCache.size).toBe(0);
        });
    });
}); 