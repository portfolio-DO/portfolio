"""
JARVIS Steam Plugin - auto-wykrywanie Steam bez konfiguracji sciezki.
"""

import asyncio
import subprocess
from pathlib import Path
from typing import Optional

from loguru import logger

from core.config import Config
from plugins.plugin_base import PluginBase

STEAM_GAME_IDS = {
    "counter-strike 2": 730, "cs2": 730, "counter-strike": 730, "csgo": 730,
    "dota 2": 570, "dota": 570,
    "team fortress 2": 440, "tf2": 440,
    "left 4 dead 2": 550, "l4d2": 550,
    "portal 2": 620, "portal": 400,
    "half-life 2": 220, "half life 2": 220, "hl2": 220,
    "cyberpunk 2077": 1091500, "cyberpunk": 1091500,
    "elden ring": 1245620,
    "valheim": 892970,
    "rust": 252490,
    "ark": 346110,
    "gta 5": 271590, "gta v": 271590, "grand theft auto 5": 271590,
    "witcher 3": 292030, "the witcher 3": 292030,
    "baldurs gate 3": 1086940, "baldur's gate 3": 1086940, "bg3": 1086940,
    "stardew valley": 413150,
    "hollow knight": 367520,
    "terraria": 105600,
    "pubg": 578080,
    "apex legends": 1172470,
    "destiny 2": 1085660,
    "warframe": 230410,
    "path of exile": 238960,
    "divinity original sin 2": 435150,
    "monster hunter world": 582010,
    "dark souls 3": 374320,
    "sekiro": 814380,
    "rocket league": 252950,
    "among us": 945360,
    "satisfactory": 526870,
    "factorio": 427520,
    "rimworld": 294100,
}


class SteamPlugin(PluginBase):
    name = "steam"
    description = "Uruchamia gry na Steam"

    def __init__(self, config: Config):
        self.config = config
        self._steam_path: Optional[str] = None

    async def initialize(self):
        loop = asyncio.get_event_loop()
        self._steam_path = await loop.run_in_executor(None, self._find_steam)
        if self._steam_path:
            logger.info(f"Steam znaleziony: {self._steam_path}")
        else:
            logger.warning("Steam nie znaleziony - plugin Steam ograniczony")

    def _find_steam(self) -> Optional[str]:
        """Znajdz Steam automatycznie - rejestr, typowe lokalizacje."""
        import platform
        if platform.system() != "Windows":
            # macOS / Linux
            candidates = [
                Path.home() / ".steam/steam/ubuntu12_32/steam",
                Path("/usr/bin/steam"),
                Path.home() / "Library/Application Support/Steam/Steam.app/Contents/MacOS/Steam",
            ]
            for c in candidates:
                if c.exists():
                    return str(c)
            return None

        # Windows - sprawdz rejestr
        try:
            import winreg
            keys = [
                (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Valve\Steam"),
                (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam"),
                (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Valve\Steam"),
            ]
            for hive, key_path in keys:
                try:
                    with winreg.OpenKey(hive, key_path) as key:
                        install_path, _ = winreg.QueryValueEx(key, "InstallPath")
                        exe = Path(install_path) / "steam.exe"
                        if exe.exists():
                            return str(exe)
                except (FileNotFoundError, OSError):
                    continue
        except ImportError:
            pass

        # Typowe lokalizacje Windows
        candidates = [
            Path(r"C:\Program Files (x86)\Steam\steam.exe"),
            Path(r"C:\Program Files\Steam\steam.exe"),
            Path(r"D:\Steam\steam.exe"),
            Path(r"E:\Steam\steam.exe"),
        ]
        for c in candidates:
            if c.exists():
                return str(c)

        return None

    async def launch_game(self, game_name: str) -> str:
        name = game_name.lower().strip()

        # Znajdz app ID
        app_id = None
        matched = game_name
        for key, aid in STEAM_GAME_IDS.items():
            if key in name or name in key:
                app_id = aid
                matched = key.title()
                break

        if app_id is None:
            return f"Nie znam ID Steam dla '{game_name}'. Mowisz o grze na Steam?"

        if not self._steam_path:
            # Ostatnia proba znalezienia Steam
            loop = asyncio.get_event_loop()
            self._steam_path = await loop.run_in_executor(None, self._find_steam)

        if not self._steam_path:
            return "Nie moge znalezc Steam na tym komputerze."

        logger.info(f"Uruchamiam Steam: {matched} (ID: {app_id})")
        try:
            # Uruchom Steam jesli nie dziala
            subprocess.Popen([self._steam_path], shell=False)
            await asyncio.sleep(3)
            # Uruchom gre przez protokol steam://
            subprocess.Popen(f"start steam://rungameid/{app_id}", shell=True)
            return f"Uruchamiam {matched} przez Steam."
        except Exception as e:
            return f"Blad uruchamiania Steam: {e}"

    async def open_steam(self) -> str:
        if not self._steam_path:
            return "Nie znalazlem Steam na tym komputerze."
        subprocess.Popen([self._steam_path])
        return "Otwieram Steam."
