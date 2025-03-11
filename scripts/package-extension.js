const fs = require('fs');
const archiver = require('archiver');
const path = require('path');

/**
 * Script to package the Solana NFT Manager extension for Brave Browser Store
 * Package Modes:
 * 1. Private Testing (Beta) - Limited distribution for testing
 * 2. Public Paid Version - For final store submission
 * 
 * Requirements:
 * - ZIP file containing all extension files
 * - manifest.json must be in the root
 * - All referenced files must be included
 * - Icons in required sizes (16, 32, 48, 128px)
 * - Screenshots and promotional images
 * - Detailed description and privacy policy
 */

// Ensure the dist directory exists
const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}

// Create a file to stream archive data to
const output = fs.createWriteStream(path.join(distDir, 'brave-solana-nft-manager-beta.zip'));
const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level
});

// Listen for all archive data to be written
output.on('close', function() {
    console.log('Extension has been packaged successfully for Brave Store Beta Testing!');
    console.log(`Total bytes: ${archive.pointer()}`);
    console.log('\nNext Steps for Private Beta Testing:');
    console.log('1. Go to https://chrome.google.com/webstore/devconsole/');
    console.log('2. Sign up for a developer account ($5 one-time fee)');
    console.log('3. Click "New Item" and upload the generated ZIP file');
    console.log('4. In the Visibility options, select "Unlisted"');
    console.log('5. Fill in required testing information:');
    console.log('   - Extension name: Solana NFT Manager (Beta)');
    console.log('   - Short description: Private beta test version');
    console.log('   - Detailed description: Include beta testing disclaimer');
    console.log('   - Upload at least 1 screenshot');
    console.log('   - Provide privacy policy URL');
    console.log('6. Submit for review (usually faster for private listings)');
    console.log('\nAfter Beta Testing:');
    console.log('1. Update manifest version number');
    console.log('2. Prepare store assets:');
    console.log('   - High-quality icon in all sizes');
    console.log('   - At least 3 screenshots (1280x800 or 640x400)');
    console.log('   - Promotional images (optional but recommended)');
    console.log('   - Detailed description with features');
    console.log('   - Privacy policy document');
    console.log('3. Set up payment details in developer dashboard');
    console.log('4. Price your extension appropriately');
    console.log('5. Submit for public paid listing\n');
});

// Handle warnings during archiving
archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
        console.warn('Warning:', err);
    } else {
        throw err;
    }
});

// Handle errors
archive.on('error', function(err) {
    throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Add the extension directory contents to the archive
archive.directory(path.join(__dirname, '../extension/'), false);

// Finalize the archive
archive.finalize(); 