import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Container, Grid, Typography, CircularProgress, TextField } from '@mui/material';
import { NFTCard } from './NFTCard';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSnackbar } from 'notistack';

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

export const NFTManager: React.FC = () => {
    const [nfts, setNfts] = useState<NFTData[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedNFTs, setSelectedNFTs] = useState<string[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [transferAddress, setTransferAddress] = useState('');
    const [listPrice, setListPrice] = useState('');
    const { publicKey } = useWallet();
    const { enqueueSnackbar } = useSnackbar();

    const loadNFTs = useCallback(async () => {
        if (!publicKey) return;

        try {
            setLoading(true);
            const newNFTs = await window.api.loadNFTs(publicKey.toString(), page);
            
            if (newNFTs.length === 0) {
                setHasMore(false);
            } else {
                setNfts(prev => [...prev, ...newNFTs]);
                setPage(prev => prev + 1);
            }
        } catch (error) {
            enqueueSnackbar('Failed to load NFTs', { variant: 'error' });
            console.error('Error loading NFTs:', error);
        } finally {
            setLoading(false);
        }
    }, [publicKey, page, enqueueSnackbar]);

    useEffect(() => {
        if (publicKey) {
            loadNFTs();
        }
    }, [publicKey, loadNFTs]);

    useEffect(() => {
        const handleNFTUpdate = (data: NFTData) => {
            setNfts(prev => prev.map(nft => 
                nft.mint === data.mint ? data : nft
            ));
        };

        window.api.onNFTUpdate(handleNFTUpdate);
        window.api.onError((error: Error) => {
            enqueueSnackbar(error.message, { variant: 'error' });
        });
    }, [enqueueSnackbar]);

    const handleSelect = (mint: string) => {
        setSelectedNFTs(prev => 
            prev.includes(mint) 
                ? prev.filter(id => id !== mint)
                : [...prev, mint]
        );
    };

    const handleTransfer = async () => {
        if (!transferAddress || selectedNFTs.length === 0) return;

        try {
            setLoading(true);
            await window.api.batchTransfer(selectedNFTs, transferAddress);
            enqueueSnackbar('Transfer initiated', { variant: 'success' });
            setSelectedNFTs([]);
            setTransferAddress('');
        } catch (error) {
            enqueueSnackbar('Transfer failed', { variant: 'error' });
            console.error('Transfer error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleList = async () => {
        if (!listPrice || selectedNFTs.length === 0) return;

        try {
            setLoading(true);
            await window.api.batchList(selectedNFTs, Number(listPrice));
            enqueueSnackbar('Listing initiated', { variant: 'success' });
            setSelectedNFTs([]);
            setListPrice('');
        } catch (error) {
            enqueueSnackbar('Listing failed', { variant: 'error' });
            console.error('Listing error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelist = async () => {
        if (selectedNFTs.length === 0) return;

        try {
            setLoading(true);
            await window.api.batchDelist(selectedNFTs);
            enqueueSnackbar('Delisting initiated', { variant: 'success' });
            setSelectedNFTs([]);
        } catch (error) {
            enqueueSnackbar('Delisting failed', { variant: 'error' });
            console.error('Delisting error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBurn = async () => {
        if (selectedNFTs.length === 0) return;

        try {
            setLoading(true);
            await window.api.batchBurn(selectedNFTs);
            enqueueSnackbar('Burn initiated', { variant: 'success' });
            setSelectedNFTs([]);
        } catch (error) {
            enqueueSnackbar('Burn failed', { variant: 'error' });
            console.error('Burn error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!publicKey) {
        return (
            <Container>
                <Typography variant="h6" align="center" sx={{ mt: 4 }}>
                    Please connect your wallet to view your NFTs
                </Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg">
            <Box sx={{ my: 4 }}>
                <Grid container spacing={2} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            label="Transfer Address"
                            value={transferAddress}
                            onChange={(e) => setTransferAddress(e.target.value)}
                            disabled={loading}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            label="List Price (SOL)"
                            value={listPrice}
                            onChange={(e) => setListPrice(e.target.value)}
                            type="number"
                            disabled={loading}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="contained"
                                onClick={handleTransfer}
                                disabled={loading || !transferAddress || selectedNFTs.length === 0}
                            >
                                Transfer
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleList}
                                disabled={loading || !listPrice || selectedNFTs.length === 0}
                            >
                                List
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleDelist}
                                disabled={loading || selectedNFTs.length === 0}
                            >
                                Delist
                            </Button>
                            <Button
                                variant="contained"
                                color="error"
                                onClick={handleBurn}
                                disabled={loading || selectedNFTs.length === 0}
                            >
                                Burn
                            </Button>
                        </Box>
                    </Grid>
                </Grid>

                <Grid container spacing={2}>
                    {nfts.map((nft) => (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={nft.mint}>
                            <NFTCard
                                nft={nft}
                                selected={selectedNFTs.includes(nft.mint)}
                                onSelect={() => handleSelect(nft.mint)}
                                disabled={loading}
                            />
                        </Grid>
                    ))}
                </Grid>

                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                        <CircularProgress />
                    </Box>
                )}

                {hasMore && !loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                        <Button variant="outlined" onClick={loadNFTs}>
                            Load More
                        </Button>
                    </Box>
                )}
            </Box>
        </Container>
    );
}; 