"""
JARVIS System Automation
OS-level operations: volume control, folder creation, system info, commands.
Cross-platform: Windows, macOS, Linux.
"""

import asyncio
import os
import platform
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional
import zoneinfo

from loguru import logger

from core.config import Config

PLATFORM = platform.system()  # "Windows", "Darwin", "Linux"


class SystemAutomation:
    """Handles OS-level system operations."""

    def __init__(self, config: Config):
        self.config = config
        self._volume_controller = None

    async def initialize(self):
        """Initialize platform-specific volume control."""
        if PLATFORM == "Windows":
            await self._init_windows_audio()

    async def _init_windows_audio(self):
        try:
            from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
            from comtypes import CLSCTX_ALL
            import comtypes

            devices = AudioUtilities.GetSpeakers()
            interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
            self._volume_controller = comtypes.cast(interface, comtypes.POINTER(IAudioEndpointVolume))
            logger.info("Windows audio initialized (pycaw)")
        except Exception as e:
            logger.warning(f"pycaw not available, falling back to nircmd: {e}")

    async def set_volume(self, level: int):
        """Set system volume (0-100)."""
        level = max(0, min(100, level))
        logger.info(f"Setting volume to {level}%")

        if PLATFORM == "Windows":
            await self._set_volume_windows(level)
        elif PLATFORM == "Darwin":
            await self._run_async(["osascript", "-e", f"set volume output volume {level}"])
        else:
            await self._run_async(["amixer", "-D", "pulse", "sset", "Master", f"{level}%"])

    async def _set_volume_windows(self, level: int):
        if self._volume_controller:
            # pycaw: scalar 0.0 - 1.0
            scalar = level / 100.0
            self._volume_controller.SetMasterVolumeLevelScalar(scalar, None)
        else:
            # Fallback: nircmd
            nircmd = Path("C:/Windows/nircmd.exe")
            if nircmd.exists():
                await self._run_async([str(nircmd), "setsysvolume", str(int(level * 655.35))])
            else:
                # PowerShell fallback
                script = f"(New-Object -ComObject WScript.Shell).SendKeys([char]173)"
                logger.warning("Using PowerShell volume approximation")

    async def create_folder(self, path_str: str) -> str:
        """Create a folder. Supports shortcuts like 'Desktop/FolderName'."""
        # Resolve shortcuts
        if path_str.startswith("Desktop/") or path_str.startswith("Desktop\\"):
            folder_name = path_str.split("/")[-1].split("\\")[-1]
            desktop = Path.home() / "Desktop"
            target = desktop / folder_name
        elif path_str.startswith("Documents/"):
            folder_name = path_str.split("/")[-1]
            target = Path.home() / "Documents" / folder_name
        else:
            target = Path(path_str)

        target.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created folder: {target}")
        return f"Created folder '{target.name}' at {target.parent}"

    async def run_command(self, cmd: str) -> str:
        """Run a safe system command and return output."""
        logger.info(f"Running system command: {cmd}")
        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
            output = stdout.decode().strip() or stderr.decode().strip()
            return output[:500] if output else "Command completed."
        except asyncio.TimeoutError:
            return "Command timed out."
        except Exception as e:
            return f"Command failed: {e}"

    async def get_time(self, timezone: str = "UTC") -> str:
        """Get current time in a given timezone."""
        try:
            # Try to find matching timezone
            tz = self._resolve_timezone(timezone)
            now = datetime.now(tz)
            return f"The current time in {timezone} is {now.strftime('%I:%M %p, %A %B %d')}."
        except Exception as e:
            now = datetime.now()
            return f"The current local time is {now.strftime('%I:%M %p')}."

    def _resolve_timezone(self, name: str):
        """Try to resolve a human-readable timezone name."""
        # Common city → timezone mappings
        city_map = {
            "tokyo": "Asia/Tokyo",
            "london": "Europe/London",
            "paris": "Europe/Paris",
            "new york": "America/New_York",
            "los angeles": "America/Los_Angeles",
            "chicago": "America/Chicago",
            "sydney": "Australia/Sydney",
            "dubai": "Asia/Dubai",
            "moscow": "Europe/Moscow",
            "berlin": "Europe/Berlin",
            "warsaw": "Europe/Warsaw",
            "utc": "UTC",
        }
        key = name.lower()
        tz_name = city_map.get(key, name)
        return zoneinfo.ZoneInfo(tz_name)

    async def _run_async(self, args: list) -> str:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        return stdout.decode().strip()
