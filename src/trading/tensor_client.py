from typing import Dict, List, Optional
import aiohttp
import asyncio
from datetime import datetime, timedelta
from loguru import logger

class TensorClient:
    """Client for interacting with Tensor.trade API"""
    
    def __init__(self, api_endpoint: str = "https://api.tensor.trade"):
        self.api_endpoint = api_endpoint
        self.session = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    async def get_collection_stats(self, collection_address: str) -> Optional[Dict]:
        """Get collection statistics from Tensor"""
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
                
            url = f"{self.api_endpoint}/v1/collections/{collection_address}/stats"
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        'floor_price': data.get('floor_price', 0) / 1e9,  # Convert lamports to SOL
                        'volume_24h': data.get('volume_24h', 0) / 1e9,
                        'listed_count': data.get('listed_count', 0),
                        'avg_price_24h': data.get('avg_price_24h', 0) / 1e9,
                        'market_cap': data.get('market_cap', 0) / 1e9
                    }
                return None
                
        except Exception as e:
            logger.error(f"Error fetching collection stats: {e}")
            return None
            
    async def get_nft_listings(self, collection_address: str) -> List[Dict]:
        """Get active listings for a collection"""
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
                
            url = f"{self.api_endpoint}/v1/collections/{collection_address}/listings"
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return [{
                        'mint': item['mint'],
                        'price': item['price'] / 1e9,  # Convert lamports to SOL
                        'seller': item['seller'],
                        'attributes': item.get('attributes', {}),
                        'rarity_rank': item.get('rarity_rank'),
                        'listed_at': datetime.fromtimestamp(item['listed_at'])
                    } for item in data.get('listings', [])]
                return []
                
        except Exception as e:
            logger.error(f"Error fetching listings: {e}")
            return []
            
    async def get_recent_trades(self, collection_address: str, hours: int = 24) -> List[Dict]:
        """Get recent trades for a collection"""
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
                
            url = f"{self.api_endpoint}/v1/collections/{collection_address}/trades"
            params = {
                'from': int((datetime.now() - timedelta(hours=hours)).timestamp()),
                'to': int(datetime.now().timestamp())
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return [{
                        'mint': trade['mint'],
                        'price': trade['price'] / 1e9,  # Convert lamports to SOL
                        'buyer': trade['buyer'],
                        'seller': trade['seller'],
                        'timestamp': datetime.fromtimestamp(trade['timestamp']),
                        'signature': trade['signature']
                    } for trade in data.get('trades', [])]
                return []
                
        except Exception as e:
            logger.error(f"Error fetching recent trades: {e}")
            return []
            
    async def get_nft_data(self, mint_address: str) -> Optional[Dict]:
        """Get detailed data for a specific NFT"""
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
                
            url = f"{self.api_endpoint}/v1/nfts/{mint_address}"
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        'mint': data['mint'],
                        'name': data.get('name'),
                        'collection': data.get('collection'),
                        'attributes': data.get('attributes', {}),
                        'rarity_rank': data.get('rarity_rank'),
                        'image_url': data.get('image_url'),
                        'last_sale': data.get('last_sale', {}).get('price', 0) / 1e9 if data.get('last_sale') else 0
                    }
                return None
                
        except Exception as e:
            logger.error(f"Error fetching NFT data: {e}")
            return None
            
    async def place_bid(self, mint_address: str, price: float) -> Optional[str]:
        """Place a bid on an NFT"""
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
                
            url = f"{self.api_endpoint}/v1/nfts/{mint_address}/bids"
            payload = {
                'price': int(price * 1e9),  # Convert SOL to lamports
                'expiry': int((datetime.now() + timedelta(days=7)).timestamp())  # 7-day expiry
            }
            
            async with self.session.post(url, json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('signature')
                return None
                
        except Exception as e:
            logger.error(f"Error placing bid: {e}")
            return None
            
    async def create_listing(self, mint_address: str, price: float) -> Optional[str]:
        """Create a listing for an NFT"""
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
                
            url = f"{self.api_endpoint}/v1/nfts/{mint_address}/listings"
            payload = {
                'price': int(price * 1e9)  # Convert SOL to lamports
            }
            
            async with self.session.post(url, json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('signature')
                return None
                
        except Exception as e:
            logger.error(f"Error creating listing: {e}")
            return None
            
    async def cancel_listing(self, mint_address: str) -> bool:
        """Cancel an active listing"""
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
                
            url = f"{self.api_endpoint}/v1/nfts/{mint_address}/listings/cancel"
            async with self.session.post(url) as response:
                return response.status == 200
                
        except Exception as e:
            logger.error(f"Error canceling listing: {e}")
            return False 