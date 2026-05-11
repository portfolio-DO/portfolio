"""Plugin base class."""

from abc import ABC, abstractmethod


class PluginBase(ABC):
    name: str = ""
    description: str = ""

    @abstractmethod
    async def initialize(self):
        pass
