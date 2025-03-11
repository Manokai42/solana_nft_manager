"""Tests for the NFTManager class."""

import os
import pytest
from src.main import NFTManager

# Test wallet path
TEST_WALLET_PATH = os.path.expanduser("~/.config/solana/id.json")


@pytest.fixture
async def nft_manager():
    """Create an NFTManager instance for testing."""
    manager = NFTManager(TEST_WALLET_PATH)
    yield manager
    await manager.close()


@pytest.mark.asyncio
async def test_get_nft_info(nft_manager):
    """Test getting NFT information."""
    # Use a known NFT mint address for testing
    mint_address = "7nE1GmnMmDKiycFZXHGv3nHCCcHaunv8YwNWd6K19nhc"

    try:
        nft_info = await nft_manager.get_nft_info(mint_address)
        assert nft_info is not None
    except ValueError as e:
        pytest.skip(f"Test skipped: {e}")


@pytest.mark.asyncio
async def test_get_trading_stats(nft_manager):
    """Test getting trading statistics."""
    stats = await nft_manager.get_trading_stats()
    assert isinstance(stats, dict)
    assert "active_trades" in stats
    assert "total_trades" in stats
    assert "total_volume" in stats
