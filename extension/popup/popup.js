// State management
let state = {
    isConnected: false,
    walletAddress: null,
    collections: [],
    selectedNFTs: new Set(),
    currentPage: 0,
    isLoading: false
};

// DOM Elements
const connectButton = document.getElementById('connect-wallet');
const refreshButton = document.getElementById('refresh');
const batchActionsButton = document.getElementById('batch-actions');
const settingsButton = document.getElementById('settings');
const searchInput = document.getElementById('search');
const collectionsContainer = document.getElementById('collections-container');
const loadingOverlay = document.getElementById('loading-overlay');
const totalNFTsElement = document.getElementById('total-nfts');
const totalCollectionsElement = document.getElementById('total-collections');
const totalValueElement = document.getElementById('total-value');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check if wallet is already connected
        const provider = getProvider();
        if (provider?.isConnected) {
            await handleConnection(provider.publicKey);
        }

        // Set up event listeners
        connectButton.addEventListener('click', connectWallet);
        refreshButton.addEventListener('click', refreshData);
        batchActionsButton.addEventListener('click', toggleBatchActions);
        settingsButton.addEventListener('click', openSettings);
        searchInput.addEventListener('input', handleSearch);

        // Set up infinite scroll
        const observer = new IntersectionObserver(handleIntersection, {
            root: collectionsContainer,
            threshold: 0.5
        });

        const sentinel = document.createElement('div');
        sentinel.id = 'scroll-sentinel';
        collectionsContainer.appendChild(sentinel);
        observer.observe(sentinel);

    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize the application');
    }
});

// Wallet connection
async function connectWallet() {
    try {
        const provider = getProvider();
        if (!provider) {
            showError('Please install Phantom wallet');
            return;
        }

        state.isLoading = true;
        updateUI();

        const resp = await provider.connect();
        await handleConnection(resp.publicKey);

    } catch (error) {
        console.error('Wallet connection error:', error);
        showError('Failed to connect wallet');
    } finally {
        state.isLoading = false;
        updateUI();
    }
}

async function handleConnection(publicKey) {
    state.isConnected = true;
    state.walletAddress = publicKey.toString();
    connectButton.textContent = `${state.walletAddress.slice(0, 4)}...${state.walletAddress.slice(-4)}`;
    await loadNFTs();
}

// Data loading
async function loadNFTs(page = 0) {
    try {
        state.isLoading = true;
        updateUI();

        const response = await chrome.runtime.sendMessage({
            type: 'LOAD_NFTS',
            payload: {
                walletAddress: state.walletAddress,
                page,
                pageSize: 50
            }
        });

        if (!response.success) {
            throw new Error(response.error);
        }

        if (page === 0) {
            state.collections = response.data;
        } else {
            state.collections = [...state.collections, ...response.data];
        }

        state.currentPage = page;
        updateCollectionsDisplay();
        updateStats();

    } catch (error) {
        console.error('Error loading NFTs:', error);
        showError('Failed to load NFTs');
    } finally {
        state.isLoading = false;
        updateUI();
    }
}

// UI Updates
function updateCollectionsDisplay() {
    const container = document.getElementById('collections-container');
    const searchTerm = searchInput.value.toLowerCase();
    
    const filteredCollections = state.collections.filter(collection => 
        collection.metadata.name.toLowerCase().includes(searchTerm)
    );

    const fragment = document.createDocumentFragment();

    filteredCollections.forEach(collection => {
        const element = createCollectionElement(collection);
        fragment.appendChild(element);
    });

    // Clear existing content except the sentinel
    const sentinel = document.getElementById('scroll-sentinel');
    container.innerHTML = '';
    container.appendChild(fragment);
    container.appendChild(sentinel);
}

function createCollectionElement(collection) {
    const div = document.createElement('div');
    div.className = 'collection-item';
    div.dataset.address = collection.metadata.collection?.address;

    const image = document.createElement('img');
    image.className = 'collection-image';
    image.src = collection.metadata.image || 'default-nft.png';
    image.alt = collection.metadata.name;
    image.loading = 'lazy';

    const info = document.createElement('div');
    info.className = 'collection-info';

    const name = document.createElement('div');
    name.className = 'collection-name';
    name.textContent = collection.metadata.name;

    const stats = document.createElement('div');
    stats.className = 'collection-stats';
    stats.textContent = `${collection.items.length} NFTs`;

    info.appendChild(name);
    info.appendChild(stats);
    div.appendChild(image);
    div.appendChild(info);

    div.addEventListener('click', () => toggleCollectionSelection(collection));

    return div;
}

function updateStats() {
    const totalNFTs = state.collections.reduce((sum, col) => sum + col.items.length, 0);
    const totalValue = state.collections.reduce((sum, col) => sum + (col.stats?.floorPrice || 0), 0);

    totalNFTsElement.textContent = totalNFTs;
    totalCollectionsElement.textContent = state.collections.length;
    totalValueElement.textContent = `${totalValue.toFixed(2)} SOL`;
}

function updateUI() {
    loadingOverlay.classList.toggle('hidden', !state.isLoading);
    connectButton.disabled = state.isLoading;
    refreshButton.disabled = !state.isConnected || state.isLoading;
    batchActionsButton.disabled = !state.isConnected || state.isLoading;
}

// Event Handlers
function handleSearch(event) {
    updateCollectionsDisplay();
}

function handleIntersection(entries) {
    const entry = entries[0];
    if (entry.isIntersecting && !state.isLoading && state.isConnected) {
        loadNFTs(state.currentPage + 1);
    }
}

function toggleCollectionSelection(collection) {
    const address = collection.metadata.collection?.address;
    if (!address) return;

    const element = document.querySelector(`[data-address="${address}"]`);
    if (!element) return;

    if (state.selectedNFTs.has(address)) {
        state.selectedNFTs.delete(address);
        element.classList.remove('selected');
    } else {
        state.selectedNFTs.add(address);
        element.classList.add('selected');
    }

    batchActionsButton.textContent = state.selectedNFTs.size > 0 
        ? `Batch Actions (${state.selectedNFTs.size})`
        : 'Batch Actions';
}

async function refreshData() {
    state.collections = [];
    state.currentPage = 0;
    await loadNFTs();
}

function toggleBatchActions() {
    if (state.selectedNFTs.size === 0) {
        showError('Please select collections first');
        return;
    }

    // Show batch actions menu
    chrome.runtime.sendMessage({
        type: 'SHOW_BATCH_MENU',
        payload: {
            collections: Array.from(state.selectedNFTs)
        }
    });
}

function openSettings() {
    chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
}

// Utilities
function getProvider() {
    if ('phantom' in window) {
        return window.phantom?.solana;
    }
    return null;
}

function showError(message) {
    // You can implement a more sophisticated error display system
    alert(message);
} 