"""
JARVIS Music Plugin
Control Spotify and system media playback.
"""

import asyncio
import subprocess
from loguru import logger
from core.config import Config
from plugins.plugin_base import PluginBase


class MusicPlugin(PluginBase):
    name = "music"
    description = "Control music playback"

    def __init__(self, config: Config):
        self.config = config

    async def initialize(self):
        logger.info("Music plugin ready")

    async def play_spotify(self, query: str) -> str:
        """Open Spotify and search for a track/artist."""
        import subprocess
        # Use Spotify URI protocol
        search_uri = f"spotify:search:{query.replace(' ', '%20')}"
        subprocess.Popen(f'start {search_uri}', shell=True)
        return f"Opening Spotify and searching for: {query}"

    async def media_control(self, action: str) -> str:
        """Control media playback: play, pause, next, previous."""
        import pyautogui
        key_map = {
            "play": "playpause",
            "pause": "playpause",
            "next": "nexttrack",
            "previous": "prevtrack",
            "stop": "stop",
        }
        key = key_map.get(action.lower())
        if key:
            pyautogui.press(key)
            return f"Media: {action}"
        return f"Unknown media action: {action}"
