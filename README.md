# Solana NFT Manager

A high-performance, production-ready NFT management solution for Solana blockchain, optimized for older MacBook hardware and enterprise use.

## Features

### Core Functionality
- **NFT Collection Management**
  - Automatic metadata retrieval and caching
  - Collection statistics tracking
  - Real-time floor price monitoring
  - Trading activity analysis
  - Batch operations support (up to 8 NFTs)

### Performance Optimizations
- **Memory Management**
  - LRU caching with configurable TTL
  - Memory usage monitoring
  - Automatic cleanup for unused resources
  - Connection pooling for RPC endpoints

- **Network Optimization**
  - Multiple RPC endpoint support with failover
  - WebSocket connections for real-time updates
  - Batch processing for NFT operations
  - Automatic retry mechanism with exponential backoff

### Security Features
- **Transaction Safety**
  - Spending limit controls
  - Whitelist management
  - Suspicious activity detection
  - Transaction validation
  - Secure wallet integration

### Monitoring & Analytics
- **System Health**
  - Prometheus metrics integration
  - OpenTelemetry tracing
  - Comprehensive logging system
  - Performance analytics

## System Requirements

- MacOS Monterey 12.7.6 or later
- Python 3.9+
- 4GB available RAM
- Redis (optional, for distributed caching)

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/manokai/solana_nft_manager.git
   cd solana_nft_manager
   ```

2. **Create and activate virtual environment:**
   ```bash
   python3.9 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment:**
   Create a `.env` file with the following configuration:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   HOST=localhost

   # Solana Configuration
   SOLANA_NETWORK=mainnet-beta
   SOLANA_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
   SOLANA_WS_ENDPOINT=wss://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

   # API Keys
   HELIUS_API_KEY=your_helius_api_key_here

   # Cache Configuration
   CACHE_MAX_ITEMS=10000
   CACHE_TTL=300000 # 5 minutes
   METADATA_CACHE_MAX_SIZE=50000
   METADATA_CACHE_TTL=3600000 # 1 hour

   # Rate Limiting
   RATE_LIMIT_WINDOW=900000 # 15 minutes
   RATE_LIMIT_MAX_REQUESTS=100

   # Performance
   MAX_BATCH_SIZE=8
   MAX_CONCURRENT_REQUESTS=50
   REQUEST_TIMEOUT=10000
   RETRY_ATTEMPTS=3
   RETRY_DELAY=1000

   # Security
   HELMET_ENABLED=true
   TRUST_PROXY=true
   MAX_REQUEST_SIZE=10485760 # 10MB
   ```

## API Endpoints

### Collection Management
- `GET /api/collections/:address`
  - Retrieves collection metadata and NFTs
  - Supports pagination and filtering
  - Caches results for performance

### Statistics
- `GET /api/stats/:collection`
  - Returns collection statistics
  - Floor price, volume, activity
  - Real-time updates via WebSocket

### NFT Operations
- `POST /api/nft/transfer`
  - Batch transfer up to 8 NFTs
  - Transaction validation
  - Whitelist checking

- `POST /api/nft/burn`
  - Secure NFT burning
  - Batch operations support
  - Transaction verification

## Development

### Setup Pre-commit Hooks
```bash
pre-commit install
```

### Running Tests
```bash
pytest tests/
```

### Code Formatting
```bash
black src/
```

### Type Checking
```bash
mypy src/
```

## Deployment

### Docker
```bash
docker-compose up -d
```

### Manual Deployment
1. Build the application:
   ```bash
   npm run build
   ```

2. Start the server:
   ```bash
   npm start
   ```

## Monitoring

### Prometheus Metrics
- API request counts and latencies
- Memory usage tracking
- Cache hit/miss rates
- Operation durations

### Logging
- Rotating log files
- Different log levels
- Error tracking
- Performance logging

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check memory statistics
   - Reduce batch size
   - Enable Redis caching
   - Adjust cache TTL

2. **Slow Performance**
   - Monitor network latency
   - Check RPC endpoint health
   - Adjust connection pool size
   - Review cache hit rates

3. **Connection Issues**
   - Verify RPC endpoint availability
   - Check network connectivity
   - Review retry configuration
   - Validate API keys

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Submit a pull request

## Security

Please report security issues directly to the maintainers. Do not create public issues for security vulnerabilities.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
