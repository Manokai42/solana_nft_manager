# Solana NFT Manager Project Structure

```
solana_nft_manager/
├── desktop/                      # Desktop application (Electron)
│   ├── src/
│   │   ├── main/                # Main process code
│   │   ├── renderer/            # Renderer process code
│   │   ├── services/            # Shared services
│   │   │   └── nftManager.ts    # NFT management service
│   │   └── types/               # TypeScript type definitions
│   ├── assets/                  # Application assets
│   ├── package.json            
│   ├── tsconfig.json           
│   └── webpack.config.js       
│
├── extension/                    # Browser extension
│   ├── src/
│   │   ├── background/          # Background scripts
│   │   ├── content/             # Content scripts
│   │   ├── popup/               # Extension popup UI
│   │   └── services/            # Shared services
│   ├── manifest.json
│   └── package.json
│
├── src/                         # Core application code
│   ├── server.js                # Main server
│   └── nftCollectionManager.js  # NFT collection management
│
├── scripts/                     # Utility scripts
│   └── ai_installer.py          # AI-powered installer
│
├── docs/                        # Documentation
│   ├── browser-extension/       # Extension documentation
│   └── desktop/                 # Desktop app documentation
│
├── public/                      # Public assets
│   └── index.html              # Main web interface
│
├── tests/                       # Test files
│   ├── unit/                    # Unit tests
│   └── integration/             # Integration tests
│
├── .env                         # Environment configuration
├── docker-compose.yml           # Docker configuration
├── Dockerfile                   # Docker build file
├── package.json                 # Project dependencies
├── README.md                    # Project documentation
├── CHANGELOG.md                 # Version history
├── CONTRIBUTING.md              # Contribution guidelines
└── LICENSE                      # Project license
```

## Components to Remove

1. `.cursor/` - IDE-specific directory
2. `.vscode/` - IDE-specific directory
3. `coverage/` - Generated test coverage (can be regenerated)
4. `.husky/` - Git hooks (will be reinstalled)
5. `.github/` - GitHub specific files (unless needed for CI/CD)
6. `.hintrc` - Not needed for core functionality
7. Duplicate `node_modules/` directories (will be reinstalled)

## Components to Keep

1. Core Application:
   - `src/` - Main application code
   - `desktop/` - Desktop application
   - `extension/` - Browser extension
   - `public/` - Public assets

2. Configuration:
   - `.env` - Environment variables
   - `package.json` - Dependencies
   - `tsconfig.json` - TypeScript configuration
   - `webpack.config.js` - Build configuration

3. Documentation:
   - `README.md`
   - `CHANGELOG.md`
   - `CONTRIBUTING.md`
   - `docs/`

4. Development:
   - `tests/` - Test files
   - `scripts/` - Utility scripts
   - `.pre-commit-config.yaml` - Code quality checks

5. Deployment:
   - `Dockerfile`
   - `docker-compose.yml`

## Next Steps

1. Run cleanup script to remove unnecessary files
2. Reinstall dependencies
3. Verify all components work after cleanup
4. Update documentation to reflect new structure 