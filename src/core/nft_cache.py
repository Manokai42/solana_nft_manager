from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime
import json
from pathlib import Path
import threading
from cachetools import LRUCache, TTLCache
from loguru import logger
import psutil
from prometheus_client import Counter, Gauge

@dataclass
class NFTMetadata:
    mint: str
    name: str
    symbol: str
    uri: str
    seller_fee_basis_points: int
    creators: List[Dict]
    collection: Optional[Dict]
    attributes: List[Dict]
    last_updated: datetime
    floor_price: float = 0.0
    last_sale_price: float = 0.0

class NFTCacheManager:
    def __init__(self, cache_dir: str = "cache", max_memory_percent: float = 75.0):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        
        # Metrics
        self.cache_hits = Counter('nft_cache_hits', 'Number of cache hits')
        self.cache_misses = Counter('nft_cache_misses', 'Number of cache misses')
        self.memory_usage = Gauge('nft_cache_memory_mb', 'Memory usage in MB')
        
        # Calculate cache size based on available memory
        available_memory = psutil.virtual_memory().available
        max_cache_size = int((available_memory * max_memory_percent / 100) / 1024)  # Approximate NFT object size
        
        # Initialize caches
        self.metadata_cache = LRUCache(maxsize=max_cache_size)
        self.price_cache = TTLCache(maxsize=100000, ttl=300)  # 5-minute TTL for prices
        
        # Thread lock for cache operations
        self.cache_lock = threading.Lock()
        
        logger.info(f"Initialized NFT cache with max size: {max_cache_size} entries")
        
    def get_nft(self, mint_address: str) -> Optional[NFTMetadata]:
        with self.cache_lock:
            if mint_address in self.metadata_cache:
                self.cache_hits.inc()
                return self.metadata_cache[mint_address]
            
            self.cache_misses.inc()
            # Try to load from disk cache
            cache_file = self.cache_dir / f"{mint_address}.json"
            if cache_file.exists():
                try:
                    with open(cache_file, 'r') as f:
                        data = json.load(f)
                        nft = NFTMetadata(**data)
                        self.metadata_cache[mint_address] = nft
                        return nft
                except Exception as e:
                    logger.error(f"Error loading NFT from cache: {e}")
            
            return None
    
    def cache_nft(self, nft: NFTMetadata):
        with self.cache_lock:
            self.metadata_cache[nft.mint] = nft
            # Save to disk cache
            cache_file = self.cache_dir / f"{nft.mint}.json"
            try:
                with open(cache_file, 'w') as f:
                    json.dump(vars(nft), f)
            except Exception as e:
                logger.error(f"Error saving NFT to cache: {e}")
            
            # Update memory usage metric
            self.memory_usage.set(psutil.Process().memory_info().rss / 1024 / 1024)
    
    def update_price(self, mint_address: str, floor_price: float, last_sale_price: float):
        with self.cache_lock:
            self.price_cache[mint_address] = {
                'floor_price': floor_price,
                'last_sale_price': last_sale_price,
                'updated_at': datetime.now().isoformat()
            }
    
    def get_price(self, mint_address: str) -> Optional[Dict]:
        with self.cache_lock:
            return self.price_cache.get(mint_address)
    
    def clear_cache(self):
        with self.cache_lock:
            self.metadata_cache.clear()
            self.price_cache.clear()
            logger.info("Cache cleared")
    
    def get_cache_stats(self) -> Dict:
        return {
            'metadata_cache_size': len(self.metadata_cache),
            'price_cache_size': len(self.price_cache),
            'memory_usage_mb': psutil.Process().memory_info().rss / 1024 / 1024,
            'cache_hits': self.cache_hits._value.get(),
            'cache_misses': self.cache_misses._value.get()
        } 