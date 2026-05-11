"""
JARVIS Browser Automation — Playwright-based
Controls Chrome/Edge/Firefox to navigate, interact, and extract web content.
"""

import asyncio
from typing import Optional

from loguru import logger

from core.config import Config


class BrowserAutomation:
    """
    Playwright-based browser automation.
    Handles navigation, clicking, form filling, and content extraction.
    """

    def __init__(self, config: Config):
        self.config = config
        self._playwright = None
        self._browser = None
        self._page = None
        self._initialized = False

    async def ensure_initialized(self):
        """Lazily initialize Playwright browser on first use."""
        if not self._initialized:
            await self._initialize()

    async def _initialize(self):
        try:
            from playwright.async_api import async_playwright
            self._pw_ctx = async_playwright()
            self._playwright = await self._pw_ctx.__aenter__()

            # Try Chrome first, fall back to Chromium
            try:
                self._browser = await self._playwright.chromium.launch(
                    channel="chrome",
                    headless=False,  # Visible browser so user can see what's happening
                    args=["--start-maximized"],
                )
            except Exception:
                logger.warning("Chrome not found, using Chromium")
                self._browser = await self._playwright.chromium.launch(headless=False)

            context = await self._browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            )
            self._page = await context.new_page()
            self._initialized = True
            logger.info("Browser initialized (Playwright/Chrome)")

        except Exception as e:
            logger.error(f"Failed to initialize browser: {e}")
            raise

    async def navigate(self, url: str):
        """Navigate to a URL."""
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        logger.info(f"Browser navigating to: {url}")
        await self._page.goto(url, wait_until="domcontentloaded", timeout=30000)

    async def click_first_video(self):
        """Click the first video result on YouTube."""
        try:
            # YouTube video thumbnails
            selectors = [
                "ytd-video-renderer #thumbnail",
                "a#thumbnail",
                "[id='thumbnail']",
            ]
            for selector in selectors:
                try:
                    await self._page.click(selector, timeout=5000)
                    logger.info("Clicked first YouTube video")
                    return
                except Exception:
                    continue
        except Exception as e:
            logger.warning(f"Could not click video: {e}")

    async def search_and_click(self, selector: str):
        """Click an element by CSS selector."""
        await self._page.click(selector)

    async def fill_input(self, selector: str, text: str):
        """Fill an input field."""
        await self._page.fill(selector, text)

    async def extract_content(self, url: str, what_to_extract: str) -> str:
        """
        Navigate to URL and extract specific content using AI-guided extraction.
        """
        await self.navigate(url)
        await asyncio.sleep(2)  # Wait for dynamic content

        # Get page text content
        content = await self._page.evaluate("""
            () => {
                // Remove scripts, styles, nav, footer
                const remove = ['script', 'style', 'nav', 'footer', 'header', 
                               'aside', 'advertisement', '.ad', '.ads'];
                remove.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => el.remove());
                });
                
                // Get main content
                const main = document.querySelector('main') || 
                             document.querySelector('article') || 
                             document.querySelector('.content') ||
                             document.body;
                return main ? main.innerText : document.body.innerText;
            }
        """)

        # Truncate and clean
        content = " ".join(content.split())  # Normalize whitespace
        return content[:2000]  # Return first 2000 chars

    async def get_page_title(self) -> str:
        return await self._page.title()

    async def get_current_url(self) -> str:
        return self._page.url

    async def scroll_down(self, pixels: int = 500):
        await self._page.evaluate(f"window.scrollBy(0, {pixels})")

    async def close(self):
        """Close browser."""
        if self._browser:
            await self._browser.close()
            self._initialized = False
            logger.info("Browser closed")
