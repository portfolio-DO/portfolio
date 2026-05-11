"""
JARVIS Logging - kompatybilny z Windows cp1250.
"""

import io
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path

from loguru import logger


def setup_logger(log_level: str, log_file: str):
    """Konfiguruj loguru - UTF-8 safe na Windows."""
    log_path = Path(log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    logger.remove()

    # Console - owijamy stdout w UTF-8 writer zeby uniknac cp1250
    utf8_stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

    logger.add(
        utf8_stderr,
        level=log_level,
        format="{time:HH:mm:ss} | {level: <8} | {message}",
        colorize=False,
    )

    # Plik - UTF-8
    logger.add(
        log_file,
        level=log_level,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{line} | {message}",
        rotation="10 MB",
        retention="30 days",
        compression="gz",
        encoding="utf-8",
    )


class CommandLogger:
    def __init__(self, log_file: str, max_history: int = 500):
        self.max_history = max_history
        self._history: list = []
        self._command_log_file = Path(log_file).parent / "commands.jsonl"
        self._command_log_file.parent.mkdir(parents=True, exist_ok=True)

    def log_command(self, text: str) -> dict:
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "command": text,
            "status": "executing",
            "result": None,
        }
        self._history.append(entry)
        if len(self._history) > self.max_history:
            self._history = self._history[-self.max_history:]
        with open(self._command_log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
        return entry

    def update_result(self, command_id: str, result: dict):
        for entry in self._history:
            if entry["id"] == command_id:
                entry["result"] = result
                entry["status"] = "completed" if result.get("success") else "failed"
                break

    def get_history(self) -> list:
        return list(reversed(self._history))
