"""
Enhanced configuration settings for the Solana NFT Manager
Includes advanced monitoring, caching, and performance optimization settings
"""
import os
import json
from pathlib import Path
from typing import Dict, Optional, List
from dataclasses import dataclass, field
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base directory for the application
BASE_DIR = Path(__file__).parent.parent.absolute()
CACHE_DIR = BASE_DIR / "cache"
LOG_DIR = BASE_DIR / "logs"
DATA_DIR = BASE_DIR / "data"

# Create necessary directories
for directory in [CACHE_DIR, LOG_DIR, DATA_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

@dataclass
class SolanaConfig:
    RPC_ENDPOINTS: List[str] = field(default_factory=lambda: [
        os.getenv('SOLANA_RPC_ENDPOINT', 'https://api.mainnet-beta.solana.com'),
        os.getenv('SOLANA_BACKUP_RPC', 'https://solana-api.projectserum.com'),
    ])
    COMMITMENT: str = 'confirmed'
    TIMEOUT: int = 30
    MAX_RETRIES: int = 3
    RETRY_DELAY: int = 1
    PREFLIGHT_COMMITMENT: str = 'processed'
    TRANSACTION_TIMEOUT: int = 60
    WEBSOCKET_ENDPOINT: str = os.getenv(
        'SOLANA_WS_ENDPOINT',
        'wss://api.mainnet-beta.solana.com'
    )

@dataclass
class TensorConfig:
    API_BASE: str = "https://api.tensor.market/v1/"
    ENDPOINTS: Dict[str, str] = field(default_factory=lambda: {
        "list_nft": "listing/create",
        "get_stats": "stats/",
        "get_orders": "orders/",
        "create_order": "order/create",
        "get_collections": "collections/",
        "get_activities": "activities/"
    })
    API_KEY: Optional[str] = os.getenv('TENSOR_API_KEY')
    RATE_LIMIT: int = 100  # requests per minute
    CACHE_TTL: int = 300  # 5 minutes

@dataclass
class WalletConfig:
    ADDRESS: str = os.getenv(
        'WALLET_ADDRESS',
        "5DoTMq5ZLhfUUeJKdfwMGGTzaLUhog5UJHQpq2TqsRyu"
    )
    KEY_PATH: Optional[str] = os.getenv('WALLET_KEY_PATH')
    AUTO_APPROVE_BELOW: float = float(os.getenv('AUTO_APPROVE_BELOW', '0.1'))
    TRANSACTION_SIGNING_MODE: str = os.getenv('SIGNING_MODE', 'local')

@dataclass
class PerformanceConfig:
    MAX_MEMORY_USAGE: int = 4 * 1024 * 1024 * 1024  # 4GB in bytes
    BATCH_SIZE: int = 50
    CACHE_TTL: int = 300  # 5 minutes
    UPDATE_INTERVAL: int = 30  # seconds
    MAX_CONCURRENT_REQUESTS: int = 10
    WEBSOCKET_RECONNECT_DELAY: int = 5
    MEMORY_WARNING_THRESHOLD: float = 0.85
    MEMORY_CRITICAL_THRESHOLD: float = 0.95
    CACHE_CLEANUP_INTERVAL: int = 600  # 10 minutes
    DB_CONNECTION_POOL_SIZE: int = 5

@dataclass
class GUIConfig:
    ITEMS_PER_PAGE: int = 50
    REFRESH_INTERVAL: int = 30000  # 30 seconds in milliseconds
    THEME: str = os.getenv('GUI_THEME', 'dark')
    WINDOW_SIZE: tuple = (1024, 768)
    FONT_SIZE: int = 10
    TABLE_ROW_HEIGHT: int = 30
    ENABLE_ANIMATIONS: bool = True
    CUSTOM_STYLES: Dict = field(default_factory=lambda: {
        'dark': {
            'background': '#2E2E2E',
            'text': '#FFFFFF',
            'accent': '#007AFF'
        },
        'light': {
            'background': '#FFFFFF',
            'text': '#000000',
            'accent': '#007AFF'
        }
    })

@dataclass
class MonitoringConfig:
    ENABLE_PROMETHEUS: bool = True
    PROMETHEUS_PORT: int = 9090
    ENABLE_OPENTELEMETRY: bool = True
    METRICS_INTERVAL: int = 60  # seconds
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    ENABLE_PERFORMANCE_LOGGING: bool = True
    TRACE_SLOW_OPERATIONS: bool = True
    SLOW_OPERATION_THRESHOLD: float = 1.0  # seconds

@dataclass
class CacheConfig:
    ENABLE_REDIS: bool = bool(os.getenv('ENABLE_REDIS', 'false').lower() == 'true')
    REDIS_URL: str = os.getenv('REDIS_URL', 'redis://localhost:6379')
    LOCAL_CACHE_SIZE: int = 10000
    METADATA_CACHE_TTL: int = 3600  # 1 hour
    MARKET_DATA_CACHE_TTL: int = 300  # 5 minutes
    COLLECTION_CACHE_TTL: int = 1800  # 30 minutes

@dataclass
class BackupConfig:
    ENABLE_AUTO_BACKUP: bool = True
    BACKUP_INTERVAL: int = 86400  # 24 hours
    BACKUP_PATH: Path = DATA_DIR / "backups"
    MAX_BACKUPS: int = 7
    COMPRESSION_ENABLED: bool = True

class Config:
    def __init__(self):
        self.SOLANA = SolanaConfig()
        self.TENSOR = TensorConfig()
        self.WALLET = WalletConfig()
        self.PERFORMANCE = PerformanceConfig()
        self.GUI = GUIConfig()
        self.MONITORING = MonitoringConfig()
        self.CACHE = CacheConfig()
        self.BACKUP = BackupConfig()

    def save_to_file(self, filepath: str):
        """Save current configuration to a JSON file"""
        config_dict = {
            section: vars(getattr(self, section))
            for section in vars(self)
        }
        with open(filepath, 'w') as f:
            json.dump(config_dict, f, indent=4)

    @classmethod
    def load_from_file(cls, filepath: str) -> 'Config':
        """Load configuration from a JSON file"""
        with open(filepath, 'r') as f:
            config_dict = json.load(f)
        
        config = cls()
        for section, values in config_dict.items():
            if hasattr(config, section):
                section_instance = getattr(config, section)
                for key, value in values.items():
                    if hasattr(section_instance, key):
                        setattr(section_instance, key, value)
        return config

# Create global configuration instance
config = Config()

# Logging configuration
LOG_CONFIG = {
    "handlers": [
        {
            "sink": LOG_DIR / "app.log",
            "rotation": "100 MB",
            "compression": "zip",
            "retention": "1 week",
            "level": config.MONITORING.LOG_LEVEL,
            "format": "{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}"
        },
        {
            "sink": LOG_DIR / "error.log",
            "rotation": "50 MB",
            "compression": "zip",
            "retention": "2 weeks",
            "level": "ERROR",
            "format": "{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}\n{exception}"
        }
    ],
    "extra": {
        "app_name": "solana_nft_manager",
        "version": "1.0.0"
    }
} 