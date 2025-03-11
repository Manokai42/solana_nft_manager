from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import asyncio
from loguru import logger
from prometheus_client import Counter, Gauge, Histogram
from solana.rpc.async_api import AsyncClient
from solana.transaction import Transaction
from anchorpy import Program, Provider, Wallet
import numpy as np
from ..core.nft_cache import NFTCacheManager, NFTMetadata
from .tensor_client import TensorClient

@dataclass
class MarketMetrics:
    floor_price: float
    volume_24h: float
    listed_count: int
    avg_price_24h: float
    price_change_24h: float
    market_cap: float
    last_update: datetime

class NFTTradeManager:
    def __init__(self, 
                 wallet: Wallet,
                 cache_manager: NFTCacheManager,
                 rpc_endpoint: str = "https://api.mainnet-beta.solana.com",
                 max_concurrent_trades: int = 5):
        
        self.wallet = wallet
        self.cache_manager = cache_manager
        self.client = AsyncClient(rpc_endpoint)
        self.tensor_client = TensorClient()
        self.max_concurrent_trades = max_concurrent_trades
        
        # Trading metrics
        self.trades_executed = Counter('nft_trades_executed', 'Number of trades executed')
        self.trade_volume = Counter('nft_trade_volume_sol', 'Trading volume in SOL')
        self.active_trades = Gauge('nft_active_trades', 'Number of active trades')
        self.trade_duration = Histogram('nft_trade_duration_seconds', 'Time taken to execute trades')
        
        # Trading pools and queues
        self.trade_semaphore = asyncio.Semaphore(max_concurrent_trades)
        self.pending_trades: List[Transaction] = []
        self.market_data: Dict[str, MarketMetrics] = {}
        
        logger.info("NFT Trade Manager initialized with Tensor.trade integration")
    
    async def analyze_market(self, collection_address: str) -> MarketMetrics:
        """Analyze market conditions for a collection using Tensor.trade data"""
        try:
            # Fetch collection stats from Tensor
            stats = await self.tensor_client.get_collection_stats(collection_address)
            if not stats:
                return None
            
            # Fetch recent trades for price change calculation
            trades = await self.tensor_client.get_recent_trades(collection_address)
            
            # Calculate price change
            prev_avg = self.market_data.get(collection_address, None)
            price_change_24h = 0
            if prev_avg and prev_avg.avg_price_24h:
                price_change_24h = ((stats['avg_price_24h'] - prev_avg.avg_price_24h) / prev_avg.avg_price_24h) * 100
            
            metrics = MarketMetrics(
                floor_price=stats['floor_price'],
                volume_24h=stats['volume_24h'],
                listed_count=stats['listed_count'],
                avg_price_24h=stats['avg_price_24h'],
                price_change_24h=price_change_24h,
                market_cap=stats['market_cap'],
                last_update=datetime.now()
            )
            
            self.market_data[collection_address] = metrics
            return metrics
            
        except Exception as e:
            logger.error(f"Error analyzing market: {e}")
            return None
    
    async def place_buy_order(self, nft: NFTMetadata, price: float) -> bool:
        """Place a buy order for an NFT using Tensor.trade"""
        async with self.trade_semaphore:
            try:
                self.active_trades.inc()
                start_time = datetime.now()
                
                # Validate price against market conditions
                collection = nft.collection.get('address') if nft.collection else None
                if collection:
                    metrics = await self.analyze_market(collection)
                    if metrics and price > metrics.floor_price * 1.1:  # 10% above floor price
                        logger.warning(f"Buy price {price} SOL is significantly above floor price {metrics.floor_price} SOL")
                        return False
                
                # Place bid on Tensor
                signature = await self.tensor_client.place_bid(nft.mint, price)
                if signature:
                    self.trades_executed.inc()
                    self.trade_volume.inc(price)
                    self.cache_manager.update_price(nft.mint, price, price)
                    
                    duration = (datetime.now() - start_time).total_seconds()
                    self.trade_duration.observe(duration)
                    
                    logger.info(f"Successfully placed bid for NFT {nft.mint} at {price} SOL")
                    return True
                
                return False
                
            except Exception as e:
                logger.error(f"Error placing buy order: {e}")
                return False
            finally:
                self.active_trades.dec()
    
    async def place_sell_order(self, nft: NFTMetadata, price: float) -> bool:
        """Place a sell order for an NFT using Tensor.trade"""
        async with self.trade_semaphore:
            try:
                self.active_trades.inc()
                start_time = datetime.now()
                
                # Validate price against market conditions
                collection = nft.collection.get('address') if nft.collection else None
                if collection:
                    metrics = await self.analyze_market(collection)
                    if metrics and price < metrics.floor_price * 0.9:  # 10% below floor price
                        logger.warning(f"Sell price {price} SOL is significantly below floor price {metrics.floor_price} SOL")
                        return False
                
                # Create listing on Tensor
                signature = await self.tensor_client.create_listing(nft.mint, price)
                if signature:
                    self.trades_executed.inc()
                    self.trade_volume.inc(price)
                    self.cache_manager.update_price(nft.mint, price, price)
                    
                    duration = (datetime.now() - start_time).total_seconds()
                    self.trade_duration.observe(duration)
                    
                    logger.info(f"Successfully listed NFT {nft.mint} for {price} SOL")
                    return True
                
                return False
                
            except Exception as e:
                logger.error(f"Error placing sell order: {e}")
                return False
            finally:
                self.active_trades.dec()
    
    async def get_nft_data(self, mint_address: str) -> Optional[Dict]:
        """Get NFT data from Tensor.trade"""
        try:
            # Check cache first
            cached_nft = self.cache_manager.get_nft(mint_address)
            if cached_nft:
                return cached_nft
            
            # Fetch from Tensor if not in cache
            nft_data = await self.tensor_client.get_nft_data(mint_address)
            if nft_data:
                # Create NFT metadata and cache it
                metadata = NFTMetadata(
                    mint=nft_data['mint'],
                    name=nft_data['name'],
                    symbol="",  # Tensor API might not provide this
                    uri="",  # Tensor API might not provide this
                    seller_fee_basis_points=0,  # Tensor API might not provide this
                    creators=[],  # Tensor API might not provide this
                    collection=nft_data['collection'],
                    attributes=nft_data['attributes'],
                    last_updated=datetime.now(),
                    floor_price=0.0,
                    last_sale_price=nft_data['last_sale']
                )
                self.cache_manager.cache_nft(metadata)
                return metadata
            
            return None
            
        except Exception as e:
            logger.error(f"Error fetching NFT data: {e}")
            return None
    
    async def get_collection_listings(self, collection_address: str) -> List[Dict]:
        """Get active listings for a collection from Tensor.trade"""
        try:
            return await self.tensor_client.get_nft_listings(collection_address)
        except Exception as e:
            logger.error(f"Error fetching collection listings: {e}")
            return []
    
    async def get_recent_trades(self, collection_address: str, hours: int = 24) -> List[Dict]:
        """Get recent trades for a collection from Tensor.trade"""
        try:
            return await self.tensor_client.get_recent_trades(collection_address, hours)
        except Exception as e:
            logger.error(f"Error fetching recent trades: {e}")
            return []
    
    def get_trading_stats(self) -> Dict:
        """Get current trading statistics"""
        return {
            'active_trades': self.active_trades._value.get(),
            'total_trades': self.trades_executed._value.get(),
            'total_volume': self.trade_volume._value.get(),
            'pending_trades': len(self.pending_trades),
        } 