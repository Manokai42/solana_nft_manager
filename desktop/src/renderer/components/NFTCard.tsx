import React, { useState } from 'react';
import {
    Card,
    CardContent,
    CardMedia,
    Typography,
    Box,
    Checkbox,
    Skeleton,
    IconButton,
    Collapse,
    CardActionArea
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

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

interface NFTCardProps {
    nft: NFTData;
    selected: boolean;
    onSelect: () => void;
    disabled: boolean;
}

const ExpandMore = styled(IconButton, {
    shouldForwardProp: (prop) => prop !== 'expanded',
})<{ expanded: boolean }>(({ theme, expanded }) => ({
    transform: !expanded ? 'rotate(0deg)' : 'rotate(180deg)',
    marginLeft: 'auto',
    transition: theme.transitions.create('transform', {
        duration: theme.transitions.duration.shortest,
    }),
}));

export const NFTCard: React.FC<NFTCardProps> = ({ nft, selected, onSelect, disabled }) => {
    const [expanded, setExpanded] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    const handleExpandClick = () => {
        setExpanded(!expanded);
    };

    const handleImageLoad = () => {
        setImageLoaded(true);
    };

    const handleImageError = () => {
        setImageError(true);
        setImageLoaded(true);
    };

    return (
        <Card 
            sx={{ 
                position: 'relative',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                opacity: disabled ? 0.7 : 1
            }}
        >
            <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
                <Checkbox
                    checked={selected}
                    onChange={onSelect}
                    disabled={disabled}
                    sx={{ 
                        bgcolor: 'rgba(255, 255, 255, 0.8)',
                        borderRadius: '50%',
                        '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 0.9)',
                        }
                    }}
                />
            </Box>

            <CardActionArea onClick={onSelect} disabled={disabled}>
                <Box sx={{ position: 'relative', paddingTop: '100%' }}>
                    {!imageLoaded && (
                        <Skeleton 
                            variant="rectangular" 
                            sx={{ 
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%'
                            }} 
                        />
                    )}
                    {!imageError ? (
                        <CardMedia
                            component="img"
                            image={nft.uri}
                            alt={nft.name}
                            onLoad={handleImageLoad}
                            onError={handleImageError}
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: imageLoaded ? 'block' : 'none'
                            }}
                        />
                    ) : (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'grey.200'
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                Image not available
                            </Typography>
                        </Box>
                    )}
                </Box>
            </CardActionArea>

            <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h6" component="div" noWrap>
                    {nft.name}
                </Typography>
                {nft.collection && (
                    <Typography variant="body2" color="text.secondary" noWrap>
                        Collection: {nft.collection.name}
                    </Typography>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                        {nft.symbol}
                    </Typography>
                    <ExpandMore
                        expanded={expanded}
                        onClick={handleExpandClick}
                        aria-expanded={expanded}
                        aria-label="show more"
                        size="small"
                    >
                        <ExpandMoreIcon />
                    </ExpandMore>
                </Box>
            </CardContent>

            <Collapse in={expanded} timeout="auto" unmountOnExit>
                <CardContent>
                    <Typography paragraph variant="body2">
                        Mint Address: {nft.mint}
                    </Typography>
                    {nft.collection && (
                        <Typography paragraph variant="body2">
                            Collection Address: {nft.collection.address}
                        </Typography>
                    )}
                </CardContent>
            </Collapse>
        </Card>
    );
}; 