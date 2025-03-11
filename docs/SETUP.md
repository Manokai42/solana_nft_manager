# Setup Guide

## Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- Git
- Solana CLI tools (optional but recommended)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Manokai42/solana_nft_manager.git
cd solana_nft_manager
```

### 2. Main Application Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Build the application
npm run build

# Start the development server
npm run dev
```

### 3. Desktop Application Setup

```bash
# Navigate to desktop directory
cd desktop

# Install dependencies
npm install

# Build the desktop app
npm run build

# Start the desktop app in development mode
npm start
```

## Configuration

### Environment Variables

1. Create a `.env` file in the root directory:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta

# API Keys (Required for production)
CHROME_STORE_CLIENT_ID=your_client_id
CHROME_STORE_CLIENT_SECRET=your_client_secret
CHROME_STORE_REFRESH_TOKEN=your_refresh_token
```

2. Create a `.env` file in the desktop directory:
```env
# Desktop App Configuration
APP_ENV=development
MAIN_SERVER_URL=http://localhost:3000
```

## Development Setup

### Code Quality Tools

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Run tests
npm test
```

### Git Hooks

The project uses Husky for Git hooks:
- Pre-commit: Runs linting
- Pre-push: Runs tests

### Building for Production

#### Main Application
```bash
# Build for production
npm run build

# Start production server
npm start
```

#### Desktop Application
```bash
# Build for production
cd desktop
npm run dist
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Clear npm cache: `npm cache clean --force`
   - Delete node_modules: `rm -rf node_modules`
   - Reinstall dependencies: `npm install`

2. **Desktop App Issues**
   - Check electron logs
   - Verify environment variables
   - Clear application cache

### Getting Help

- Create an issue on GitHub
- Check existing issues for solutions
- Contact the development team

## Additional Resources

- [Solana Documentation](https://docs.solana.com)
- [Electron Documentation](https://www.electronjs.org/docs)
- [Project Wiki](link-to-your-wiki) 