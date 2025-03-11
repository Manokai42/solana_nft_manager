#!/usr/bin/env python3
import os
import sys
import shutil
from pathlib import Path
import subprocess
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('cleanup.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ProjectCleaner:
    def __init__(self, root_dir: Path):
        self.root_dir = root_dir
        self.dirs_to_remove = [
            '.cursor',
            '.vscode',
            'coverage',
            '.husky',
            '.github',
            'node_modules',
            'desktop/node_modules',
            'extension/node_modules',
            'dist',
            'desktop/dist',
            'extension/dist',
            '__pycache__'
        ]
        self.files_to_remove = [
            '.hintrc',
            'package-lock.json',
            'desktop/package-lock.json',
            'extension/package-lock.json'
        ]

    def clean(self):
        """Clean up the project directory."""
        try:
            logger.info("Starting project cleanup...")
            
            # Remove unnecessary directories
            self._remove_directories()
            
            # Remove unnecessary files
            self._remove_files()
            
            # Create necessary directories if they don't exist
            self._create_directories()
            
            # Reinstall dependencies
            self._reinstall_dependencies()
            
            logger.info("Project cleanup completed successfully!")
            
        except Exception as e:
            logger.error(f"Cleanup failed: {str(e)}")
            raise

    def _remove_directories(self):
        """Remove unnecessary directories."""
        for dir_name in self.dirs_to_remove:
            dir_path = self.root_dir / dir_name
            if dir_path.exists():
                logger.info(f"Removing directory: {dir_path}")
                shutil.rmtree(dir_path)

    def _remove_files(self):
        """Remove unnecessary files."""
        for file_name in self.files_to_remove:
            file_path = self.root_dir / file_name
            if file_path.exists():
                logger.info(f"Removing file: {file_path}")
                file_path.unlink()

    def _create_directories(self):
        """Create necessary directory structure."""
        directories = [
            'desktop/src/main',
            'desktop/src/renderer',
            'desktop/src/services',
            'desktop/src/types',
            'desktop/assets',
            'extension/src/background',
            'extension/src/content',
            'extension/src/popup',
            'extension/src/services',
            'docs/browser-extension',
            'docs/desktop',
            'tests/unit',
            'tests/integration',
            'logs'
        ]
        
        for dir_path in directories:
            full_path = self.root_dir / dir_path
            if not full_path.exists():
                logger.info(f"Creating directory: {full_path}")
                full_path.mkdir(parents=True, exist_ok=True)

    def _reinstall_dependencies(self):
        """Reinstall project dependencies."""
        try:
            # Main project dependencies
            logger.info("Installing main project dependencies...")
            subprocess.run(['npm', 'install'], cwd=self.root_dir, check=True)
            
            # Desktop app dependencies
            logger.info("Installing desktop app dependencies...")
            subprocess.run(['npm', 'install'], cwd=self.root_dir / 'desktop', check=True)
            
            # Extension dependencies
            logger.info("Installing extension dependencies...")
            subprocess.run(['npm', 'install'], cwd=self.root_dir / 'extension', check=True)
            
            # Try to install pre-commit hooks if available
            try:
                logger.info("Installing pre-commit hooks...")
                subprocess.run(['pip', 'install', 'pre-commit'], check=True)
                subprocess.run(['pre-commit', 'install'], cwd=self.root_dir, check=True)
            except subprocess.CalledProcessError:
                logger.warning("Pre-commit installation skipped - not available")
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to install dependencies: {str(e)}")
            raise

def main():
    try:
        # Get project root directory
        root_dir = Path(__file__).parent.parent.resolve()
        
        # Create and run cleaner
        cleaner = ProjectCleaner(root_dir)
        cleaner.clean()
        
        print("\nCleanup completed successfully!")
        print("Please check cleanup.log for detailed information.")
        
    except Exception as e:
        print(f"\nCleanup failed: {str(e)}")
        print("Please check cleanup.log for error details.")
        sys.exit(1)

if __name__ == "__main__":
    main() 