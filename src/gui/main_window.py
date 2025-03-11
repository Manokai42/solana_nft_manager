import sys
from typing import Dict, List, Optional
from datetime import datetime
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout,
                           QHBoxLayout, QLabel, QPushButton, QTableWidget,
                           QTableWidgetItem, QProgressBar, QComboBox,
                           QLineEdit, QMessageBox, QTabWidget, QFrame)
from PyQt5.QtCore import Qt, QTimer, pyqtSignal, QThread
from PyQt5.QtGui import QPalette, QColor, QFont
import asyncio
from loguru import logger
from ..core.nft_cache import NFTCacheManager, NFTMetadata
from ..trading.trade_manager import NFTTradeManager, MarketMetrics

class AsyncUpdateThread(QThread):
    update_signal = pyqtSignal(dict)
    
    def __init__(self, trade_manager: NFTTradeManager):
        super().__init__()
        self.trade_manager = trade_manager
        self.running = True
    
    def run(self):
        while self.running:
            stats = self.trade_manager.get_trading_stats()
            self.update_signal.emit(stats)
            self.msleep(1000)  # Update every second
    
    def stop(self):
        self.running = False

class NFTManagerGUI(QMainWindow):
    def __init__(self, cache_manager: NFTCacheManager, trade_manager: NFTTradeManager):
        super().__init__()
        self.cache_manager = cache_manager
        self.trade_manager = trade_manager
        
        # Setup UI
        self.setWindowTitle("Solana NFT Manager")
        self.setMinimumSize(1200, 800)
        self.setup_dark_theme()
        
        # Create main widget and layout
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        layout = QVBoxLayout(main_widget)
        
        # Create tab widget
        tabs = QTabWidget()
        layout.addWidget(tabs)
        
        # Add tabs
        tabs.addTab(self.create_portfolio_tab(), "Portfolio")
        tabs.addTab(self.create_trading_tab(), "Trading")
        tabs.addTab(self.create_market_tab(), "Market Analysis")
        tabs.addTab(self.create_settings_tab(), "Settings")
        
        # Setup status bar
        self.statusBar().showMessage("Ready")
        
        # Setup update thread
        self.update_thread = AsyncUpdateThread(self.trade_manager)
        self.update_thread.update_signal.connect(self.update_stats)
        self.update_thread.start()
        
        logger.info("GUI initialized")
    
    def setup_dark_theme(self):
        """Setup dark theme for the application"""
        palette = QPalette()
        palette.setColor(QPalette.Window, QColor(53, 53, 53))
        palette.setColor(QPalette.WindowText, Qt.white)
        palette.setColor(QPalette.Base, QColor(25, 25, 25))
        palette.setColor(QPalette.AlternateBase, QColor(53, 53, 53))
        palette.setColor(QPalette.ToolTipBase, Qt.white)
        palette.setColor(QPalette.ToolTipText, Qt.white)
        palette.setColor(QPalette.Text, Qt.white)
        palette.setColor(QPalette.Button, QColor(53, 53, 53))
        palette.setColor(QPalette.ButtonText, Qt.white)
        palette.setColor(QPalette.BrightText, Qt.red)
        palette.setColor(QPalette.Link, QColor(42, 130, 218))
        palette.setColor(QPalette.Highlight, QColor(42, 130, 218))
        palette.setColor(QPalette.HighlightedText, Qt.black)
        
        QApplication.setPalette(palette)
    
    def create_portfolio_tab(self) -> QWidget:
        """Create the portfolio management tab"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Portfolio summary
        summary_frame = QFrame()
        summary_frame.setFrameStyle(QFrame.StyledPanel)
        summary_layout = QHBoxLayout(summary_frame)
        
        # Add summary widgets
        total_value_label = QLabel("Total Portfolio Value: 0 SOL")
        total_value_label.setFont(QFont("Arial", 14, QFont.Bold))
        summary_layout.addWidget(total_value_label)
        
        nft_count_label = QLabel("Total NFTs: 0")
        nft_count_label.setFont(QFont("Arial", 14, QFont.Bold))
        summary_layout.addWidget(nft_count_label)
        
        layout.addWidget(summary_frame)
        
        # NFT list table
        self.nft_table = QTableWidget()
        self.nft_table.setColumnCount(6)
        self.nft_table.setHorizontalHeaderLabels([
            "Name", "Collection", "Floor Price", "Last Sale",
            "Rarity Rank", "Actions"
        ])
        layout.addWidget(self.nft_table)
        
        # Refresh button
        refresh_btn = QPushButton("Refresh Portfolio")
        refresh_btn.clicked.connect(self.refresh_portfolio)
        layout.addWidget(refresh_btn)
        
        return widget
    
    def create_trading_tab(self) -> QWidget:
        """Create the trading management tab"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Trading controls
        controls_frame = QFrame()
        controls_frame.setFrameStyle(QFrame.StyledPanel)
        controls_layout = QHBoxLayout(controls_frame)
        
        # Add trading controls
        self.collection_combo = QComboBox()
        self.collection_combo.setMinimumWidth(200)
        controls_layout.addWidget(QLabel("Collection:"))
        controls_layout.addWidget(self.collection_combo)
        
        self.price_input = QLineEdit()
        self.price_input.setPlaceholderText("Price in SOL")
        controls_layout.addWidget(QLabel("Price:"))
        controls_layout.addWidget(self.price_input)
        
        buy_btn = QPushButton("Buy")
        buy_btn.clicked.connect(self.place_buy_order)
        controls_layout.addWidget(buy_btn)
        
        sell_btn = QPushButton("Sell")
        sell_btn.clicked.connect(self.place_sell_order)
        controls_layout.addWidget(sell_btn)
        
        layout.addWidget(controls_frame)
        
        # Trading history table
        self.trade_table = QTableWidget()
        self.trade_table.setColumnCount(5)
        self.trade_table.setHorizontalHeaderLabels([
            "Time", "Type", "NFT", "Price", "Status"
        ])
        layout.addWidget(self.trade_table)
        
        return widget
    
    def create_market_tab(self) -> QWidget:
        """Create the market analysis tab"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Market metrics
        metrics_frame = QFrame()
        metrics_frame.setFrameStyle(QFrame.StyledPanel)
        metrics_layout = QVBoxLayout(metrics_frame)
        
        # Add metric widgets
        self.floor_price_label = QLabel("Floor Price: --")
        self.volume_label = QLabel("24h Volume: --")
        self.listings_label = QLabel("Active Listings: --")
        
        metrics_layout.addWidget(self.floor_price_label)
        metrics_layout.addWidget(self.volume_label)
        metrics_layout.addWidget(self.listings_label)
        
        layout.addWidget(metrics_frame)
        
        # Market activity table
        self.market_table = QTableWidget()
        self.market_table.setColumnCount(4)
        self.market_table.setHorizontalHeaderLabels([
            "Time", "NFT", "Price", "Event"
        ])
        layout.addWidget(self.market_table)
        
        return widget
    
    def create_settings_tab(self) -> QWidget:
        """Create the settings tab"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # RPC endpoint settings
        rpc_frame = QFrame()
        rpc_frame.setFrameStyle(QFrame.StyledPanel)
        rpc_layout = QHBoxLayout(rpc_frame)
        
        rpc_layout.addWidget(QLabel("RPC Endpoint:"))
        self.rpc_input = QLineEdit()
        self.rpc_input.setText("https://api.mainnet-beta.solana.com")
        rpc_layout.addWidget(self.rpc_input)
        
        layout.addWidget(rpc_frame)
        
        # Cache settings
        cache_frame = QFrame()
        cache_frame.setFrameStyle(QFrame.StyledPanel)
        cache_layout = QVBoxLayout(cache_frame)
        
        cache_layout.addWidget(QLabel("Cache Settings"))
        clear_cache_btn = QPushButton("Clear Cache")
        clear_cache_btn.clicked.connect(self.clear_cache)
        cache_layout.addWidget(clear_cache_btn)
        
        layout.addWidget(cache_frame)
        
        # Add spacer
        layout.addStretch()
        
        return widget
    
    def refresh_portfolio(self):
        """Refresh the portfolio display"""
        try:
            # Clear existing items
            self.nft_table.setRowCount(0)
            
            # Add loading indicator
            self.statusBar().showMessage("Refreshing portfolio...")
            
            # TODO: Implement async portfolio refresh
            
            self.statusBar().showMessage("Portfolio refreshed", 3000)
            
        except Exception as e:
            logger.error(f"Error refreshing portfolio: {e}")
            QMessageBox.critical(self, "Error", f"Failed to refresh portfolio: {str(e)}")
    
    def place_buy_order(self):
        """Place a buy order"""
        try:
            price = float(self.price_input.text())
            collection = self.collection_combo.currentText()
            
            # TODO: Implement async buy order
            
            QMessageBox.information(self, "Success", "Buy order placed successfully")
            
        except ValueError:
            QMessageBox.warning(self, "Error", "Please enter a valid price")
        except Exception as e:
            logger.error(f"Error placing buy order: {e}")
            QMessageBox.critical(self, "Error", f"Failed to place buy order: {str(e)}")
    
    def place_sell_order(self):
        """Place a sell order"""
        try:
            price = float(self.price_input.text())
            collection = self.collection_combo.currentText()
            
            # TODO: Implement async sell order
            
            QMessageBox.information(self, "Success", "Sell order placed successfully")
            
        except ValueError:
            QMessageBox.warning(self, "Error", "Please enter a valid price")
        except Exception as e:
            logger.error(f"Error placing sell order: {e}")
            QMessageBox.critical(self, "Error", f"Failed to place sell order: {str(e)}")
    
    def clear_cache(self):
        """Clear the NFT cache"""
        try:
            self.cache_manager.clear_cache()
            QMessageBox.information(self, "Success", "Cache cleared successfully")
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")
            QMessageBox.critical(self, "Error", f"Failed to clear cache: {str(e)}")
    
    def update_stats(self, stats: Dict):
        """Update trading statistics display"""
        try:
            self.statusBar().showMessage(
                f"Active Trades: {stats['active_trades']} | "
                f"Total Trades: {stats['total_trades']} | "
                f"Volume: {stats['total_volume']:.2f} SOL"
            )
        except Exception as e:
            logger.error(f"Error updating stats: {e}")
    
    def closeEvent(self, event):
        """Handle application closure"""
        self.update_thread.stop()
        self.update_thread.wait()
        super().closeEvent(event)

def launch_gui(cache_manager: NFTCacheManager, trade_manager: NFTTradeManager):
    """Launch the NFT Manager GUI"""
    app = QApplication(sys.argv)
    window = NFTManagerGUI(cache_manager, trade_manager)
    window.show()
    sys.exit(app.exec_()) 