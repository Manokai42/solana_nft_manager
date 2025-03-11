# Solana NFT Manager Browser Extension Installation Guide

## Overview
The Solana NFT Manager browser extension is available for Brave, Chrome, and Firefox browsers. This guide will walk you through the installation process for each browser and explain how to connect it with the desktop application.

## Prerequisites
- Brave, Chrome, or Firefox browser
- Solana NFT Manager Desktop App installed
- Phantom or Solflare wallet installed
- Minimum browser version requirements:
  - Brave: 1.0.0 or later
  - Chrome: 88 or later
  - Firefox: 78 or later

## Installation Steps

### For Brave/Chrome Users

1. **Download the Extension**
   - Visit the Chrome Web Store: [Solana NFT Manager](https://chrome.google.com/webstore/detail/solana-nft-manager)
   - Click "Add to Brave/Chrome"
   - Confirm the installation

2. **Configure the Extension**
   - Click the extension icon in your browser toolbar
   - Click "Settings" (gear icon)
   - Enter your desktop app connection details:
     ```
     Desktop App URL: http://localhost:3000
     API Key: [Your API Key]
     ```
   - Save the settings

3. **Connect Wallet**
   - Click "Connect Wallet" in the extension popup
   - Select your preferred wallet (Phantom/Solflare)
   - Approve the connection request

### For Firefox Users

1. **Download the Extension**
   - Visit the Firefox Add-ons Store: [Solana NFT Manager](https://addons.mozilla.org/firefox/addon/solana-nft-manager)
   - Click "Add to Firefox"
   - Confirm the installation

2. **Configure the Extension**
   - Click the extension icon in your browser toolbar
   - Click "Settings" (gear icon)
   - Enter your desktop app connection details:
     ```
     Desktop App URL: http://localhost:3000
     API Key: [Your API Key]
     ```
   - Save the settings

3. **Connect Wallet**
   - Click "Connect Wallet" in the extension popup
   - Select your preferred wallet (Phantom/Solflare)
   - Approve the connection request

## Desktop App Connection

1. **Install Desktop App**
   - Download the desktop app from [releases page](https://github.com/manokai/solana_nft_manager/releases)
   - Install the application
   - Launch the app

2. **Configure Desktop App**
   - Open the desktop app settings
   - Enable "Browser Extension Connection"
   - Set the port (default: 3000)
   - Generate an API key if not already done

3. **Verify Connection**
   - The extension should show "Connected" status
   - Test by viewing your NFT collection

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Ensure desktop app is running
   - Check if port 3000 is available
   - Verify API key is correct
   - Check firewall settings

2. **Wallet Connection Issues**
   - Ensure wallet extension is installed
   - Try disconnecting and reconnecting
   - Clear browser cache and cookies
   - Check wallet permissions

3. **Performance Issues**
   - Reduce batch size in settings
   - Clear extension cache
   - Update to latest version

### Support

For additional support:
- Visit our [GitHub Issues](https://github.com/manokai/solana_nft_manager/issues)
- Join our [Discord Community](https://discord.gg/solana-nft-manager)
- Contact support at support@solana-nft-manager.com

## Security Considerations

1. **API Key Security**
   - Never share your API key
   - Rotate keys regularly
   - Use environment variables when possible

2. **Wallet Security**
   - Only connect to trusted dApps
   - Review transaction details carefully
   - Keep wallet software updated

3. **Network Security**
   - Use HTTPS for all connections
   - Enable browser security features
   - Keep browser updated

## Updates and Maintenance

1. **Extension Updates**
   - Updates are automatic
   - Check version in extension details
   - Clear cache after major updates

2. **Desktop App Updates**
   - Check for updates in app settings
   - Backup data before updating
   - Follow update instructions

## Premium Features

### Available in Paid Version
- Advanced analytics
- Bulk operations
- Priority support
- Custom RPC endpoints
- Advanced security features

### Upgrade Process
1. Visit extension settings
2. Click "Upgrade to Premium"
3. Choose subscription plan
4. Complete payment
5. Restart extension

## Development Mode

For developers:
1. Enable developer mode in browser
2. Load unpacked extension
3. Select extension directory
4. Use development tools for debugging

## License and Terms

- Free version: MIT License
- Premium version: Commercial License
- See [LICENSE.md](../LICENSE.md) for details 