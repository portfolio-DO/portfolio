"""
JARVIS Configuration
"""

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from loguru import logger
from pydantic import BaseModel, Field


class Config(BaseModel):
    # --- Ollama (lokalny LLM, zero limitow) ---
    ollama_host: str = Field(default="http://localhost:11434")
    ollama_model: str = Field(default="llama3.2")

    # --- Groq (szybki, darmowy tier) ---
    groq_api_key: str = Field(default="")
    groq_model: str = Field(default="llama-3.1-8b-instant")

    # --- Google Gemini (ograniczony darmowy) ---
    google_api_key: str = Field(default="")
    gemini_model: str = Field(default="gemini-1.5-flash")

    # --- Wake word ---
    wake_word: str = Field(default="jarvis")
    wake_word_threshold: float = Field(default=0.5)

    # --- STT ---
    stt_model: str = Field(default="base.en")
    stt_device: str = Field(default="cpu")
    stt_language: str = Field(default="en")

    # --- TTS ---
    tts_engine: str = Field(default="pyttsx3")
    elevenlabs_api_key: Optional[str] = Field(default=None)
    elevenlabs_voice_id: str = Field(default="21m00Tcm4TlvDq8ikWAM")

    # --- Safety ---
    require_confirmation: bool = Field(default=True)
    sandbox_mode: bool = Field(default=False)
    max_command_history: int = Field(default=500)

    # --- Network ---
    websocket_port: int = Field(default=8765)
    backend_host: str = Field(default="localhost")

    # --- Plugins ---
    weather_api_key: str = Field(default="")

    # --- Logging ---
    log_level: str = Field(default="INFO")
    log_file: str = Field(default="logs/jarvis.log")

    model_config = {"arbitrary_types_allowed": True}

    def __init__(self, **kwargs):
        env_path = Path(__file__).parent.parent.parent / ".env"
        load_dotenv(env_path)

        env_values = {
            "ollama_host":  os.getenv("OLLAMA_HOST", "http://localhost:11434"),
            "ollama_model": os.getenv("OLLAMA_MODEL", "llama3.2"),
            "groq_api_key": os.getenv("GROQ_API_KEY", ""),
            "groq_model":   os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            "google_api_key": os.getenv("GOOGLE_API_KEY", ""),
            "gemini_model": os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
            "wake_word":    os.getenv("WAKE_WORD", "jarvis"),
            "wake_word_threshold": float(os.getenv("WAKE_WORD_THRESHOLD", "0.5")),
            "stt_model":    os.getenv("STT_MODEL", "base.en"),
            "stt_device":   os.getenv("STT_DEVICE", "cpu"),
            "stt_language": os.getenv("STT_LANGUAGE", "en"),
            "tts_engine":   os.getenv("TTS_ENGINE", "pyttsx3"),
            "elevenlabs_api_key": os.getenv("ELEVENLABS_API_KEY"),
            "elevenlabs_voice_id": os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),
            "require_confirmation": os.getenv("REQUIRE_CONFIRMATION", "true").lower() == "true",
            "sandbox_mode": os.getenv("SANDBOX_MODE", "false").lower() == "true",
            "max_command_history": int(os.getenv("MAX_COMMAND_HISTORY", "500")),
            "websocket_port": int(os.getenv("WEBSOCKET_PORT", "8765")),
            "backend_host": os.getenv("BACKEND_HOST", "localhost"),
            "weather_api_key": os.getenv("WEATHER_API_KEY", ""),
            "log_level":    os.getenv("LOG_LEVEL", "INFO"),
            "log_file":     os.getenv("LOG_FILE", "logs/jarvis.log"),
        }
        env_values.update(kwargs)
        super().__init__(**env_values)

    def update(self, settings: dict):
        for key, value in settings.items():
            if hasattr(self, key):
                object.__setattr__(self, key, value)

    def to_dict(self) -> dict:
        data = self.model_dump()
        for sensitive in ["google_api_key", "groq_api_key", "elevenlabs_api_key", "weather_api_key"]:
            if data.get(sensitive):
                data[sensitive] = "***" + str(data[sensitive])[-4:]
        return data
