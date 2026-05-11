"""
JARVIS Safety Checker
Validates commands before execution and flags dangerous operations.
"""

import re
from loguru import logger
from core.config import Config


# Patterns that always require confirmation
DANGEROUS_PATTERNS = [
    r"delete|remove|rm\s+-rf|rmdir",
    r"format\s+(c:|d:|/dev/)",
    r"shutdown|reboot|restart",
    r"registry|regedit",
    r"install\s+\w+",
    r"uninstall",
    r"password|credential",
    r"sudo|admin",
    r"drop\s+table|truncate",
]

# Patterns that are always blocked
BLOCKED_PATTERNS = [
    r"fork\s+bomb|\$\(\s*:\s*\)",
    r"rm\s+-rf\s+/",
    r"del\s+/[sf]\s+c:\\",
    r"format\s+c:",
]


class SafetyChecker:
    """Validates and classifies the safety of planned actions."""

    def __init__(self, config: Config):
        self.config = config

    def check_command(self, text: str) -> dict:
        """
        Analyze a command text for safety.
        Returns: {"safe": bool, "requires_confirmation": bool, "reason": str}
        """
        text_lower = text.lower()

        # Check blocked patterns
        for pattern in BLOCKED_PATTERNS:
            if re.search(pattern, text_lower):
                logger.warning(f"BLOCKED command pattern: {pattern}")
                return {
                    "safe": False,
                    "requires_confirmation": False,
                    "reason": f"This command is blocked for safety reasons.",
                }

        # Check dangerous patterns
        for pattern in DANGEROUS_PATTERNS:
            if re.search(pattern, text_lower):
                logger.warning(f"Dangerous pattern detected: {pattern}")
                return {
                    "safe": True,
                    "requires_confirmation": True,
                    "reason": f"This action requires your confirmation.",
                }

        return {
            "safe": True,
            "requires_confirmation": False,
            "reason": "",
        }

    def is_system_command_safe(self, cmd: str) -> bool:
        """Check if a system command is safe to run without confirmation."""
        safe_commands = [
            "echo", "date", "time", "dir", "ls", "pwd", "whoami",
            "ipconfig", "ifconfig", "ping", "tracert", "netstat",
            "systeminfo", "tasklist", "ps", "df", "free",
        ]
        cmd_lower = cmd.lower().strip()
        return any(cmd_lower.startswith(safe) for safe in safe_commands)
