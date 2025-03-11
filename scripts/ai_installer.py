#!/usr/bin/env python3
import os
import sys
import subprocess
import platform
import json
import requests
import time
from typing import Dict, List, Optional
from pathlib import Path
import logging
from crewai import Agent, Task, Crew, Process
from langchain.tools import Tool
from langchain.agents import AgentExecutor, create_react_agent
from langchain.memory import ConversationBufferMemory
from langchain.chat_models import ChatOpenAI
from langchain.prompts import MessagesPlaceholder
from langchain.schema import SystemMessage, HumanMessage, AIMessage
import openai
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('installation.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class InstallationCrew:
    def __init__(self):
        load_dotenv()
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        self.llm = ChatOpenAI(
            temperature=0.7,
            model="gpt-4",
            openai_api_key=self.openai_api_key
        )
        
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True
        )

    def create_agents(self):
        # System Checker Agent
        system_checker = Agent(
            role='System Checker',
            goal='Verify system requirements and compatibility',
            backstory="""You are an expert system analyst specialized in checking 
            system requirements and compatibility for software installations.""",
            verbose=True,
            allow_delegation=False,
            llm=self.llm,
            tools=[
                Tool(
                    name="check_system",
                    func=self.check_system_requirements,
                    description="Check if the system meets all requirements"
                )
            ]
        )

        # Browser Extension Installer Agent
        extension_installer = Agent(
            role='Browser Extension Installer',
            goal='Install and configure browser extensions',
            backstory="""You are an expert in browser extension installation and 
            configuration, specializing in cross-browser compatibility.""",
            verbose=True,
            allow_delegation=False,
            llm=self.llm,
            tools=[
                Tool(
                    name="install_extension",
                    func=self.install_browser_extension,
                    description="Install browser extension for specified browser"
                )
            ]
        )

        # Desktop App Installer Agent
        desktop_installer = Agent(
            role='Desktop App Installer',
            goal='Install and configure the desktop application',
            backstory="""You are an expert in desktop application installation and 
            configuration, with deep knowledge of system integration.""",
            verbose=True,
            allow_delegation=False,
            llm=self.llm,
            tools=[
                Tool(
                    name="install_desktop",
                    func=self.install_desktop_app,
                    description="Install and configure desktop application"
                )
            ]
        )

        # Configuration Agent
        config_agent = Agent(
            role='Configuration Manager',
            goal='Configure and verify all components',
            backstory="""You are an expert in software configuration and integration,
            ensuring all components work together seamlessly.""",
            verbose=True,
            allow_delegation=False,
            llm=self.llm,
            tools=[
                Tool(
                    name="configure_components",
                    func=self.configure_components,
                    description="Configure and verify all components"
                )
            ]
        )

        return [system_checker, extension_installer, desktop_installer, config_agent]

    def create_tasks(self):
        return [
            Task(
                description="""Check system requirements and compatibility.
                Verify browser versions, operating system, and available resources.""",
                agent=self.agents[0]
            ),
            Task(
                description="""Install browser extensions for all supported browsers.
                Configure extension settings and verify installation.""",
                agent=self.agents[1]
            ),
            Task(
                description="""Install desktop application.
                Configure application settings and verify installation.""",
                agent=self.agents[2]
            ),
            Task(
                description="""Configure all components to work together.
                Verify connections and test functionality.""",
                agent=self.agents[3]
            )
        ]

    def check_system_requirements(self) -> Dict:
        """Check system requirements and compatibility."""
        system_info = {
            'os': platform.system(),
            'os_version': platform.version(),
            'python_version': sys.version,
            'browsers': self.detect_browsers(),
            'memory': self.get_system_memory(),
            'disk_space': self.get_disk_space()
        }
        return system_info

    def detect_browsers(self) -> List[str]:
        """Detect installed browsers."""
        browsers = []
        browser_paths = {
            'chrome': [
                '/Applications/Google Chrome.app',
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            ],
            'firefox': [
                '/Applications/Firefox.app',
                'C:\\Program Files\\Mozilla Firefox\\firefox.exe'
            ],
            'brave': [
                '/Applications/Brave Browser.app',
                'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
            ]
        }
        
        for browser, paths in browser_paths.items():
            for path in paths:
                if os.path.exists(path):
                    browsers.append(browser)
                    break
        return browsers

    def get_system_memory(self) -> Dict:
        """Get system memory information."""
        if platform.system() == 'Darwin':  # macOS
            try:
                output = subprocess.check_output(['vm_stat']).decode()
                return {'total': self.parse_vm_stat(output)}
            except:
                return {'total': 0}
        elif platform.system() == 'Windows':
            try:
                output = subprocess.check_output(['wmic', 'OS', 'get', 'TotalVisibleMemorySize']).decode()
                return {'total': int(output.split('\n')[1])}
            except:
                return {'total': 0}
        return {'total': 0}

    def get_disk_space(self) -> Dict:
        """Get available disk space."""
        try:
            if platform.system() == 'Darwin':
                output = subprocess.check_output(['df', '-h', '/']).decode()
                return {'free': output.split('\n')[1].split()[3]}
            elif platform.system() == 'Windows':
                output = subprocess.check_output(['wmic', 'logicaldisk', 'get', 'freespace,caption']).decode()
                return {'free': output.split('\n')[1].split()[0]}
            return {'free': '0'}
        except:
            return {'free': '0'}

    def install_browser_extension(self, browser: str) -> bool:
        """Install browser extension for specified browser."""
        try:
            if browser == 'chrome':
                self._install_chrome_extension()
            elif browser == 'firefox':
                self._install_firefox_extension()
            elif browser == 'brave':
                self._install_brave_extension()
            return True
        except Exception as e:
            logger.error(f"Failed to install extension for {browser}: {str(e)}")
            return False

    def install_desktop_app(self) -> bool:
        """Install desktop application."""
        try:
            # Download latest release
            self._download_desktop_app()
            # Install application
            self._install_desktop_app()
            # Configure application
            self._configure_desktop_app()
            return True
        except Exception as e:
            logger.error(f"Failed to install desktop app: {str(e)}")
            return False

    def configure_components(self) -> bool:
        """Configure all components to work together."""
        try:
            # Generate API key
            api_key = self._generate_api_key()
            # Configure desktop app
            self._configure_desktop_app_settings(api_key)
            # Configure browser extensions
            self._configure_browser_extensions(api_key)
            # Test connections
            self._test_connections()
            return True
        except Exception as e:
            logger.error(f"Failed to configure components: {str(e)}")
            return False

    def _install_chrome_extension(self):
        """Install Chrome extension."""
        # Implementation for Chrome extension installation
        pass

    def _install_firefox_extension(self):
        """Install Firefox extension."""
        # Implementation for Firefox extension installation
        pass

    def _install_brave_extension(self):
        """Install Brave extension."""
        # Implementation for Brave extension installation
        pass

    def _download_desktop_app(self):
        """Download latest desktop app release."""
        # Implementation for downloading desktop app
        pass

    def _install_desktop_app(self):
        """Install desktop application."""
        # Implementation for desktop app installation
        pass

    def _configure_desktop_app(self):
        """Configure desktop application."""
        # Implementation for desktop app configuration
        pass

    def _generate_api_key(self) -> str:
        """Generate API key for component communication."""
        # Implementation for API key generation
        return "generated_api_key"

    def _configure_desktop_app_settings(self, api_key: str):
        """Configure desktop app settings."""
        # Implementation for desktop app settings configuration
        pass

    def _configure_browser_extensions(self, api_key: str):
        """Configure browser extensions."""
        # Implementation for browser extension configuration
        pass

    def _test_connections(self):
        """Test connections between components."""
        # Implementation for connection testing
        pass

    def run(self):
        """Run the installation crew."""
        try:
            # Create agents
            self.agents = self.create_agents()
            
            # Create tasks
            tasks = self.create_tasks()
            
            # Create crew
            crew = Crew(
                agents=self.agents,
                tasks=tasks,
                process=Process.sequential,
                verbose=True
            )
            
            # Run the crew
            result = crew.kickoff()
            
            logger.info("Installation completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Installation failed: {str(e)}")
            raise

def main():
    try:
        # Create installation directory if it doesn't exist
        install_dir = Path.home() / '.solana_nft_manager'
        install_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize and run the installation crew
        crew = InstallationCrew()
        result = crew.run()
        
        print("\nInstallation completed successfully!")
        print("Please check the installation.log file for detailed information.")
        
    except Exception as e:
        print(f"\nInstallation failed: {str(e)}")
        print("Please check the installation.log file for error details.")
        sys.exit(1)

if __name__ == "__main__":
    main() 