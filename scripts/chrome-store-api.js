const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

/**
 * Chrome Web Store API Integration
 * Documentation: https://developer.chrome.com/docs/webstore/api_index/
 */

class ChromeStoreAPI {
    constructor() {
        this.webstore = google.chromewebstore('v1.1');
        this.oauth2Client = new google.auth.OAuth2(
            process.env.CHROME_CLIENT_ID,
            process.env.CHROME_CLIENT_SECRET,
            'http://localhost:8080/oauth2callback'
        );
    }

    /**
     * Initialize OAuth2 authentication
     */
    async authenticate() {
        const scopes = [
            'https://www.googleapis.com/auth/chromewebstore'
        ];

        // Generate authentication URL
        const authUrl = this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
        });

        console.log('Please visit this URL to authorize the application:', authUrl);
        // Note: In a real application, you would handle the OAuth callback
    }

    /**
     * Upload the extension package
     * @param {string} extensionId - The ID of your extension
     * @param {string} zipPath - Path to the extension ZIP file
     */
    async uploadPackage(extensionId, zipPath) {
        try {
            const fileContent = fs.readFileSync(zipPath);
            const response = await this.webstore.items.upload({
                auth: this.oauth2Client,
                extensionId: extensionId,
                media: {
                    body: fileContent,
                    mimeType: 'application/zip'
                }
            });
            console.log('Upload response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    }

    /**
     * Publish the extension
     * @param {string} extensionId - The ID of your extension
     * @param {string} target - The publish target ('trustedTesters' or 'default')
     */
    async publish(extensionId, target = 'trustedTesters') {
        try {
            const response = await this.webstore.items.publish({
                auth: this.oauth2Client,
                extensionId: extensionId,
                publishTarget: target
            });
            console.log('Publish response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Publishing failed:', error);
            throw error;
        }
    }

    /**
     * Get the current status of your extension
     * @param {string} extensionId - The ID of your extension
     */
    async getStatus(extensionId) {
        try {
            const response = await this.webstore.items.get({
                auth: this.oauth2Client,
                extensionId: extensionId,
                projection: 'DRAFT'
            });
            console.log('Status:', response.data);
            return response.data;
        } catch (error) {
            console.error('Status check failed:', error);
            throw error;
        }
    }
}

// Example usage
async function main() {
    const api = new ChromeStoreAPI();
    
    // Initialize authentication
    await api.authenticate();

    // Replace with your extension ID once you have it
    const extensionId = process.env.EXTENSION_ID;
    
    // Upload the beta package
    const zipPath = path.join(__dirname, '../dist/brave-solana-nft-manager-beta.zip');
    await api.uploadPackage(extensionId, zipPath);

    // Publish to trusted testers (beta)
    await api.publish(extensionId, 'trustedTesters');

    // Check status
    await api.getStatus(extensionId);
}

// Export the class and main function
module.exports = {
    ChromeStoreAPI,
    main
}; 