"""
JARVIS Computer Automation — PyAutoGUI
Low-level mouse, keyboard, and screenshot control.
"""

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

from loguru import logger

from core.config import Config


class ComputerAutomation:
    """
    Low-level computer control: mouse, keyboard, screenshots.
    Uses PyAutoGUI as primary driver.
    """

    def __init__(self, config: Config):
        self.config = config
        self._screenshot_dir = Path("screenshots")
        self._screenshot_dir.mkdir(exist_ok=True)

    async def type_text(self, text: str, interval: float = 0.05):
        """Type text using keyboard simulation."""
        import pyautogui
        logger.info(f"Typing: {text[:50]}...")
        # Run in thread to avoid blocking
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: pyautogui.write(text, interval=interval)
        )

    async def press_key(self, key: str):
        """Press a single key."""
        import pyautogui
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: pyautogui.press(key)
        )

    async def hotkey(self, *keys: str):
        """Press a keyboard shortcut."""
        import pyautogui
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: pyautogui.hotkey(*keys)
        )

    async def click(self, x: int, y: int, button: str = "left"):
        """Click at screen coordinates."""
        import pyautogui
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: pyautogui.click(x, y, button=button)
        )

    async def move_to(self, x: int, y: int):
        """Move mouse to coordinates."""
        import pyautogui
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: pyautogui.moveTo(x, y, duration=0.3)
        )

    async def take_screenshot(self) -> str:
        """Take a screenshot and save to disk."""
        import pyautogui
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = self._screenshot_dir / f"screenshot_{timestamp}.png"

        screenshot = await asyncio.get_event_loop().run_in_executor(
            None, pyautogui.screenshot
        )
        screenshot.save(str(path))
        logger.info(f"Screenshot saved: {path}")
        return str(path)

    async def find_image_on_screen(self, image_path: str) -> Optional[Tuple[int, int]]:
        """Find an image on screen and return its center coordinates."""
        import pyautogui
        try:
            location = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: pyautogui.locateCenterOnScreen(image_path, confidence=0.8)
            )
            return (location.x, location.y) if location else None
        except Exception:
            return None

    async def scroll(self, clicks: int, x: Optional[int] = None, y: Optional[int] = None):
        """Scroll the mouse wheel."""
        import pyautogui
        await asyncio.get_event_loop().run_in_executor(
            None, lambda: pyautogui.scroll(clicks, x=x, y=y)
        )

    async def get_screen_size(self) -> Tuple[int, int]:
        """Get screen dimensions."""
        import pyautogui
        size = pyautogui.size()
        return (size.width, size.height)
