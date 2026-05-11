"""
JARVIS Automation Executor
Routes action plan steps to the appropriate automation handlers.
"""

import asyncio
from typing import Any, Optional

from loguru import logger

from core.config import Config


class AutomationExecutor:
    """
    Central dispatcher for all automation actions.
    Initializes and routes to specialized handlers.
    """

    def __init__(self, config: Config):
        self.config = config
        self._browser = None
        self._computer = None
        self._system = None
        self._apps = None
        self._plugins = {}

    async def initialize(self):
        """Initialize all automation subsystems."""
        from automation.computer import ComputerAutomation
        from automation.browser import BrowserAutomation
        from automation.system import SystemAutomation
        from automation.apps import AppLauncher

        self._computer = ComputerAutomation(self.config)
        self._browser = BrowserAutomation(self.config)
        self._system = SystemAutomation(self.config)
        self._apps = AppLauncher(self.config)

        # Initialize browser (lazy — only when first needed)
        await self._system.initialize()
        await self._apps.initialize()

        # Load plugins
        await self._load_plugins()
        logger.info("Automation executor ready")

    async def _load_plugins(self):
        """Load all enabled plugins."""
        try:
            from plugins.weather import WeatherPlugin
            from plugins.steam import SteamPlugin
            from plugins.music import MusicPlugin

            self._plugins["weather"] = WeatherPlugin(self.config)
            self._plugins["steam"] = SteamPlugin(self.config)
            self._plugins["music"] = MusicPlugin(self.config)

            for name, plugin in self._plugins.items():
                await plugin.initialize()
                logger.info(f"Loaded plugin: {name}")
        except Exception as e:
            logger.warning(f"Some plugins failed to load: {e}")

    async def execute_step(self, step: dict) -> dict:
        """Execute a single action step and return the result."""
        action = step.get("action", "")

        handlers = {
            "open_app": self._handle_open_app,
            "search_web": self._handle_search_web,
            "browser_navigate": self._handle_browser_navigate,
            "browser_extract": self._handle_browser_extract,
            "play_youtube": self._handle_play_youtube,
            "steam_launch": self._handle_steam_launch,
            "set_volume": self._handle_set_volume,
            "create_folder": self._handle_create_folder,
            "type_text": self._handle_type_text,
            "take_screenshot": self._handle_take_screenshot,
            "system_command": self._handle_system_command,
            "get_weather": self._handle_get_weather,
            "get_time": self._handle_get_time,
            "open_discord": self._handle_open_discord,
            "respond_only": self._handle_respond_only,
        }

        handler = handlers.get(action)
        if handler:
            return await handler(step)
        else:
            logger.warning(f"Unknown action: {action}")
            return {"text": f"I don't know how to perform: {action}"}

    # ---- Action Handlers ----

    async def _handle_open_app(self, step: dict) -> dict:
        app_name = step.get("app_name", "")
        await self._apps.launch(app_name)
        return {"text": f"Opening {app_name}."}

    async def _handle_search_web(self, step: dict) -> dict:
        query = step.get("query", "")
        engine = step.get("engine", "google")
        url = self._build_search_url(query, engine)
        await self._browser.ensure_initialized()
        await self._browser.navigate(url)
        return {"text": f"Searching {engine} for: {query}"}

    async def _handle_browser_navigate(self, step: dict) -> dict:
        url = step.get("url", "")
        await self._browser.ensure_initialized()
        await self._browser.navigate(url)
        return {"text": f"Navigated to {url}"}

    async def _handle_browser_extract(self, step: dict) -> dict:
        url = step.get("url", "")
        extract = step.get("extract", "main content")
        await self._browser.ensure_initialized()
        content = await self._browser.extract_content(url, extract)
        return {"text": content[:500] if content else "Could not extract content."}

    async def _handle_play_youtube(self, step: dict) -> dict:
        query = step.get("query", "")
        url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
        await self._browser.ensure_initialized()
        await self._browser.navigate(url)
        # Click first video result
        await asyncio.sleep(2)
        await self._browser.click_first_video()
        return {"text": f"Playing YouTube: {query}"}

    async def _handle_steam_launch(self, step: dict) -> dict:
        game = step.get("game", "")
        result = await self._plugins["steam"].launch_game(game)
        return {"text": result}

    async def _handle_set_volume(self, step: dict) -> dict:
        level = int(step.get("level", 50))
        await self._system.set_volume(level)
        return {"text": f"Volume set to {level} percent."}

    async def _handle_create_folder(self, step: dict) -> dict:
        path = step.get("path", "")
        result = await self._system.create_folder(path)
        return {"text": result}

    async def _handle_type_text(self, step: dict) -> dict:
        text = step.get("text", "")
        await self._computer.type_text(text)
        return {"text": f"Typed: {text}"}

    async def _handle_take_screenshot(self, step: dict) -> dict:
        path = await self._computer.take_screenshot()
        return {"text": f"Screenshot saved to {path}"}

    async def _handle_system_command(self, step: dict) -> dict:
        cmd = step.get("cmd", "")
        safe = step.get("safe", False)
        if not safe:
            return {"text": "Blocked unsafe system command."}
        result = await self._system.run_command(cmd)
        return {"text": result}

    async def _handle_get_weather(self, step: dict) -> dict:
        location = step.get("location", "")
        result = await self._plugins["weather"].get_weather(location)
        return {"text": result}

    async def _handle_get_time(self, step: dict) -> dict:
        timezone = step.get("timezone", "UTC")
        result = await self._system.get_time(timezone)
        return {"text": result}

    async def _handle_open_discord(self, step: dict) -> dict:
        await self._apps.launch("discord")
        return {"text": "Opening Discord."}

    async def _handle_respond_only(self, step: dict) -> dict:
        message = step.get("message", "")
        return {"text": message}

    def _build_search_url(self, query: str, engine: str) -> str:
        q = query.replace(" ", "+")
        engines = {
            "google": f"https://www.google.com/search?q={q}",
            "bing": f"https://www.bing.com/search?q={q}",
            "duckduckgo": f"https://duckduckgo.com/?q={q}",
        }
        return engines.get(engine, engines["google"])

    async def cancel(self):
        """Cancel any running browser operations."""
        if self._browser:
            await self._browser.close()
