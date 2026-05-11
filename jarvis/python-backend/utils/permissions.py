"""
JARVIS Permission System
Controls what actions are allowed based on user-configured permissions.
"""

from enum import Enum
from loguru import logger


class Permission(Enum):
    FILE_CREATE = "file_create"
    FILE_DELETE = "file_delete"
    BROWSER_CONTROL = "browser_control"
    APP_LAUNCH = "app_launch"
    SYSTEM_COMMAND = "system_command"
    NETWORK_ACCESS = "network_access"
    VOLUME_CONTROL = "volume_control"


# Default permission set — all enabled except destructive ops
DEFAULT_PERMISSIONS = {
    Permission.FILE_CREATE: True,
    Permission.FILE_DELETE: False,   # Disabled by default — requires explicit enable
    Permission.BROWSER_CONTROL: True,
    Permission.APP_LAUNCH: True,
    Permission.SYSTEM_COMMAND: False,  # Disabled — potentially dangerous
    Permission.NETWORK_ACCESS: True,
    Permission.VOLUME_CONTROL: True,
}


class PermissionManager:
    def __init__(self):
        self._permissions = dict(DEFAULT_PERMISSIONS)

    def is_allowed(self, permission: Permission) -> bool:
        return self._permissions.get(permission, False)

    def grant(self, permission: Permission):
        self._permissions[permission] = True
        logger.info(f"Permission granted: {permission.value}")

    def revoke(self, permission: Permission):
        self._permissions[permission] = False
        logger.info(f"Permission revoked: {permission.value}")

    def get_all(self) -> dict:
        return {p.value: v for p, v in self._permissions.items()}
