"""
JARVIS Conversation Memory
Maintains rolling context window for multi-turn conversations.
"""

from collections import deque
from typing import Optional


class ConversationMemory:
    """Maintains a rolling conversation history for context-aware AI responses."""

    def __init__(self, max_history: int = 20):
        self.max_history = max_history
        self._messages: deque = deque(maxlen=max_history * 2)  # user + assistant pairs

    def add_user(self, text: str):
        self._messages.append({"role": "user", "content": text})

    def add_assistant(self, text: str):
        self._messages.append({"role": "assistant", "content": text})

    def get_messages(self) -> list:
        return list(self._messages)

    def clear(self):
        self._messages.clear()

    def __len__(self):
        return len(self._messages)
