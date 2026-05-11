"""
JARVIS TTS - pyttsx3 (offline) lub ElevenLabs (premium)
"""

import asyncio
import os
import tempfile
from typing import Optional

from loguru import logger

from core.config import Config


class TextToSpeechEngine:
    def __init__(self, config: Config):
        self.config = config
        self._engine = None
        self._backend = config.tts_engine
        self._pygame_initialized = False
        self._tts_lock = asyncio.Lock()

    async def initialize(self):
        if self._backend == "elevenlabs" and self.config.elevenlabs_api_key:
            try:
                await self._init_elevenlabs()
                logger.info("TTS: ElevenLabs")
                return
            except Exception as e:
                logger.warning(f"ElevenLabs blad: {e}, fallback pyttsx3")

        await self._init_pyttsx3()
        logger.info("TTS: pyttsx3 (offline)")

    async def _init_pyttsx3(self):
        import pyttsx3
        loop = asyncio.get_event_loop()

        def _setup():
            eng = pyttsx3.init()
            eng.setProperty("rate", 175)
            eng.setProperty("volume", 0.9)
            voices = eng.getProperty("voices")
            for v in voices:
                name = v.name.lower()
                if any(x in name for x in ["david", "zira", "mark", "hazel"]):
                    eng.setProperty("voice", v.id)
                    break
            return eng

        self._engine = await loop.run_in_executor(None, _setup)
        self._backend = "pyttsx3"

    async def _init_elevenlabs(self):
        from elevenlabs.client import ElevenLabs
        self._el_client = ElevenLabs(api_key=self.config.elevenlabs_api_key)
        self._backend = "elevenlabs"

    async def speak(self, text: str):
        """Mow i czekaj az skonczy."""
        if not text or not text.strip():
            return
        async with self._tts_lock:
            await self._do_speak(text)

    async def speak_nonblocking(self, text: str):
        """Mow bez czekania (krotkie dzwieki potwierdzenia)."""
        if not text or not text.strip():
            return
        asyncio.create_task(self._do_speak(text))

    async def _do_speak(self, text: str):
        if self._backend == "elevenlabs":
            await self._speak_elevenlabs(text)
        elif self._backend == "pyttsx3":
            await self._speak_pyttsx3(text)
        else:
            await self._speak_system(text)

    async def _speak_pyttsx3(self, text: str):
        loop = asyncio.get_event_loop()
        def _run():
            self._engine.say(text)
            self._engine.runAndWait()
        await loop.run_in_executor(None, _run)

    async def _speak_elevenlabs(self, text: str):
        try:
            loop = asyncio.get_event_loop()
            audio_stream = await loop.run_in_executor(
                None,
                lambda: self._el_client.generate(
                    text=text,
                    voice=self.config.elevenlabs_voice_id,
                    model="eleven_turbo_v2",
                )
            )
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                for chunk in audio_stream:
                    if chunk:
                        f.write(chunk)
                tmp = f.name
            await self._play_pygame(tmp)
            os.unlink(tmp)
        except Exception as e:
            logger.error(f"ElevenLabs blad: {e}")
            await self._speak_pyttsx3(text)

    async def _speak_system(self, text: str):
        import platform
        if platform.system() == "Windows":
            script = f'Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak("{text}")'
            proc = await asyncio.create_subprocess_exec(
                "powershell", "-Command", script,
                stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
            )
            await proc.wait()
        elif platform.system() == "Darwin":
            proc = await asyncio.create_subprocess_exec("say", text)
            await proc.wait()

    async def _play_pygame(self, path: str):
        loop = asyncio.get_event_loop()
        def _play():
            import pygame
            if not self._pygame_initialized:
                pygame.mixer.init()
                self._pygame_initialized = True
            pygame.mixer.music.load(path)
            pygame.mixer.music.play()
            import time
            while pygame.mixer.music.get_busy():
                time.sleep(0.05)
        await loop.run_in_executor(None, _play)

    async def shutdown(self):
        if self._backend == "pyttsx3" and self._engine:
            try:
                self._engine.stop()
            except Exception:
                pass
