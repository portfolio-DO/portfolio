"""
JARVIS App Launcher - auto-wykrywanie aplikacji bez podawania sciezki.
"""

import asyncio
import os
import platform
import subprocess
import winreg
from pathlib import Path
from typing import Optional

from loguru import logger

from core.config import Config

PLATFORM = platform.system()

# Nazwy procesow / komend systemowych (dzialaja bez pelnej sciezki)
SYSTEM_COMMANDS = {
    "notepad": "notepad.exe",
    "notatnik": "notepad.exe",
    "calculator": "calc.exe",
    "kalkulator": "calc.exe",
    "paint": "mspaint.exe",
    "explorer": "explorer.exe",
    "menedzer plikow": "explorer.exe",
    "file explorer": "explorer.exe",
    "task manager": "taskmgr.exe",
    "menedzer zadan": "taskmgr.exe",
    "cmd": "cmd.exe",
    "command prompt": "cmd.exe",
    "wiersz polecen": "cmd.exe",
    "powershell": "powershell.exe",
    "control panel": "control.exe",
    "panel sterowania": "control.exe",
    "settings": "ms-settings:",
    "ustawienia": "ms-settings:",
    "wordpad": "wordpad.exe",
}

# Nazwy aplikacji do wyszukania w rejestrze/typowych lokalizacjach
APP_SEARCH_NAMES = {
    # Przegladarki
    "chrome": ["chrome.exe", "Google Chrome"],
    "google chrome": ["chrome.exe", "Google Chrome"],
    "firefox": ["firefox.exe", "Mozilla Firefox"],
    "edge": ["msedge.exe", "Microsoft Edge"],

    # Komunikatory
    "discord": ["Discord.exe", "discord.exe"],
    "teams": ["Teams.exe"],
    "slack": ["slack.exe"],
    "zoom": ["Zoom.exe"],
    "skype": ["Skype.exe"],
    "telegram": ["Telegram.exe"],
    "whatsapp": ["WhatsApp.exe"],

    # Media
    "spotify": ["Spotify.exe"],
    "vlc": ["vlc.exe"],
    "media player": ["wmplayer.exe"],

    # Gry/Gaming
    "steam": ["steam.exe"],
    "epic": ["EpicGamesLauncher.exe"],
    "epic games": ["EpicGamesLauncher.exe"],
    "gog": ["GalaxyClient.exe"],
    "battle.net": ["Battle.net.exe"],
    "battlenet": ["Battle.net.exe"],
    "origin": ["Origin.exe"],
    "ea app": ["EADesktop.exe"],
    "ubisoft connect": ["UbisoftConnect.exe"],
    "uplay": ["UbisoftConnect.exe"],

    # Narzedzia dev
    "vscode": ["Code.exe"],
    "visual studio code": ["Code.exe"],
    "visual studio": ["devenv.exe"],
    "notepad++": ["notepad++.exe"],
    "git bash": ["git-bash.exe"],
    "cursor": ["Cursor.exe"],

    # Biuro
    "word": ["WINWORD.EXE"],
    "excel": ["EXCEL.EXE"],
    "powerpoint": ["POWERPNT.EXE"],
    "outlook": ["OUTLOOK.EXE"],
    "onenote": ["ONENOTE.EXE"],

    # Inne
    "obs": ["obs64.exe", "obs.exe"],
    "obs studio": ["obs64.exe", "obs.exe"],
    "7zip": ["7zFM.exe"],
    "winrar": ["WinRAR.exe"],
    "photoshop": ["Photoshop.exe"],
    "premiere": ["Adobe Premiere Pro.exe"],
}

# Typowe katalogi instalacji na Windows
SEARCH_DIRS = [
    r"C:\Program Files",
    r"C:\Program Files (x86)",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs"),
    os.path.expandvars(r"%APPDATA%"),
    os.path.expandvars(r"%LOCALAPPDATA%"),
    r"C:\Users\Public\Desktop",
]


class AppLauncher:
    def __init__(self, config: Config):
        self.config = config
        self._cache: dict[str, str] = {}  # name -> path cache
        self._custom: dict[str, str] = {}

    async def initialize(self):
        logger.info("App launcher gotowy (auto-wykrywanie)")

    async def launch(self, app_name: str):
        name = app_name.lower().strip()
        logger.info(f"Uruchamiam: '{name}'")

        # 1. Cache
        if name in self._cache:
            return await self._start(self._cache[name])

        # 2. Custom apps
        if name in self._custom:
            return await self._start(self._custom[name])

        # 3. Komendy systemowe (dzialaja bez sciezki)
        if name in SYSTEM_COMMANDS:
            cmd = SYSTEM_COMMANDS[name]
            self._cache[name] = cmd
            return await self._start(cmd)

        # 4. Szukaj w typowych lokalizacjach
        if PLATFORM == "Windows":
            path = await asyncio.get_event_loop().run_in_executor(
                None, lambda: self._find_windows(name)
            )
            if path:
                self._cache[name] = path
                return await self._start(path)

        # 5. Sprobuj uruchomic bezposrednio (moze byc w PATH)
        logger.warning(f"Nie znaleziono '{name}', probuje uruchomic bezposrednio")
        await self._start(app_name)

    def _find_windows(self, name: str) -> Optional[str]:
        """Szukaj aplikacji na Windows - rejestr + filesystem."""

        # a) Sprawdz rejestr (App Paths)
        path = self._search_registry(name)
        if path:
            return path

        # b) Szukaj po nazwach exe w typowych katalogach
        exe_names = APP_SEARCH_NAMES.get(name, [])

        # Dodaj ogolne warianty
        if not exe_names:
            # Sprobuj zbudowac nazwe exe z nazwy aplikacji
            exe_guess = name.replace(" ", "") + ".exe"
            exe_names = [exe_guess, name.capitalize() + ".exe"]

        for search_dir in SEARCH_DIRS:
            search_path = Path(search_dir)
            if not search_path.exists():
                continue
            for exe in exe_names:
                # Szukaj rekurencyjnie (max 3 poziomy)
                for found in search_path.rglob(exe):
                    if found.is_file():
                        logger.info(f"Znaleziono: {found}")
                        return str(found)

        # c) Szukaj skrotow na pulpicie i w menu Start
        shortcut_dirs = [
            Path(os.path.expandvars(r"%PUBLIC%\Desktop")),
            Path(os.path.expandvars(r"%USERPROFILE%\Desktop")),
            Path(os.path.expandvars(r"%APPDATA%\Microsoft\Windows\Start Menu\Programs")),
            Path(r"C:\ProgramData\Microsoft\Windows\Start Menu\Programs"),
        ]
        for d in shortcut_dirs:
            if not d.exists():
                continue
            for lnk in d.rglob("*.lnk"):
                if name.lower() in lnk.stem.lower():
                    return str(lnk)

        return None

    def _search_registry(self, name: str) -> Optional[str]:
        """Szukaj w rejestrze Windows App Paths."""
        # Pobierz nazwy exe do sprawdzenia
        exe_names = APP_SEARCH_NAMES.get(name, [])
        if not exe_names:
            exe_names = [name.replace(" ", "") + ".exe"]

        keys_to_check = [
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths"),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths"),
        ]

        for exe in exe_names:
            for hive, base_key in keys_to_check:
                try:
                    key_path = f"{base_key}\\{exe}"
                    with winreg.OpenKey(hive, key_path) as key:
                        path, _ = winreg.QueryValueEx(key, "")
                        if path and Path(path).exists():
                            logger.info(f"Rejestr: {exe} -> {path}")
                            return path
                except (FileNotFoundError, OSError):
                    continue

        # Szukaj tez po nazwie w Uninstall
        uninstall_paths = [
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
            r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        ]
        for reg_path in uninstall_paths:
            try:
                with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, reg_path) as key:
                    for i in range(winreg.QueryInfoKey(key)[0]):
                        try:
                            subkey_name = winreg.EnumKey(key, i)
                            with winreg.OpenKey(key, subkey_name) as subkey:
                                try:
                                    display_name, _ = winreg.QueryValueEx(subkey, "DisplayName")
                                    if name.lower() in str(display_name).lower():
                                        try:
                                            install_loc, _ = winreg.QueryValueEx(subkey, "InstallLocation")
                                            if install_loc:
                                                # Szukaj exe w katalogu instalacji
                                                for exe in exe_names:
                                                    candidate = Path(install_loc) / exe
                                                    if candidate.exists():
                                                        return str(candidate)
                                        except (FileNotFoundError, OSError):
                                            pass
                                except (FileNotFoundError, OSError):
                                    pass
                        except OSError:
                            continue
            except OSError:
                continue

        return None

    async def _start(self, path_or_cmd: str):
        """Uruchom aplikacje."""
        logger.info(f"Start: {path_or_cmd}")
        if PLATFORM == "Windows":
            if path_or_cmd.startswith("ms-"):
                os.startfile(path_or_cmd)
            elif path_or_cmd.endswith(".lnk"):
                os.startfile(path_or_cmd)
            else:
                subprocess.Popen(
                    path_or_cmd,
                    shell=True,
                    creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
                )
        elif PLATFORM == "Darwin":
            subprocess.Popen(["open", path_or_cmd])
        else:
            subprocess.Popen([path_or_cmd])

    def add_custom(self, name: str, path: str):
        self._custom[name.lower()] = path
