"""
Audio Processing — The Voice
Handles: per-scene TTS generation, voice style matching, audio normalization
"""

import asyncio
import logging
import os
import time
from pathlib import Path
from typing import Optional

from config import (
    STYLE_VOICE_MAP,
    EngineConfig,
    VoiceProvider,
    VideoStyle,
)
from groq_pipeline import Scene

logger = logging.getLogger(__name__)


class AudioProcessor:
    """Generates per-scene voiceovers using ElevenLabs or Edge-TTS."""

    def __init__(self, config: EngineConfig, audio_dir: str):
        self.config = config
        self.audio_dir = Path(audio_dir)
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        self._voice_settings = STYLE_VOICE_MAP[config.style]

    # ──────────────────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────────────────

    def generate_scene_audio(self, scene: Scene) -> Optional[str]:
        """
        Generate voiceover for a single scene.
        Returns path to the audio file, or None on failure.
        """
        out_path = self.audio_dir / f"scene_{scene.index:04d}.mp3"

        if out_path.exists():
            logger.debug(f"Scene {scene.index} audio cached: {out_path}")
            return str(out_path)

        text = scene.narration.strip()
        if not text:
            logger.warning(f"Scene {scene.index} has no narration — skipping audio.")
            return None

        if self.config.voice_provider == VoiceProvider.ELEVENLABS:
            return self._generate_elevenlabs(text, str(out_path), scene.index)
        else:
            return self._generate_edge_tts(text, str(out_path), scene.index)

    def generate_all(self, scenes: list[Scene]) -> dict[int, Optional[str]]:
        """
        Generate audio for all scenes. Returns {scene_index: audio_path}.
        """
        results: dict[int, Optional[str]] = {}
        total = len(scenes)
        for i, scene in enumerate(scenes):
            logger.info(f"[Audio] Scene {scene.index} ({i+1}/{total})...")
            path = self.generate_scene_audio(scene)
            results[scene.index] = path
            # Small delay to avoid TTS rate limits
            if i < total - 1:
                time.sleep(0.3)
        return results

    # ──────────────────────────────────────────────────────────────
    # ElevenLabs Implementation
    # ──────────────────────────────────────────────────────────────

    def _generate_elevenlabs(
        self, text: str, out_path: str, scene_idx: int
    ) -> Optional[str]:
        try:
            from elevenlabs import ElevenLabs, VoiceSettings
        except ImportError:
            logger.error("elevenlabs package not installed. Run: pip install elevenlabs")
            return self._generate_edge_tts(text, out_path, scene_idx)

        if not self.config.elevenlabs_api_key:
            logger.error("ElevenLabs API key not provided.")
            return None

        voice_name = self._voice_settings["elevenlabs_voice"]
        speed = self._voice_settings["speed"]

        for attempt in range(3):
            try:
                client = ElevenLabs(api_key=self.config.elevenlabs_api_key)

                # ElevenLabs v3 client API
                audio_bytes = client.text_to_speech.convert(
                    voice_id=self._get_elevenlabs_voice_id(client, voice_name),
                    text=text,
                    model_id="eleven_multilingual_v2",
                    voice_settings=VoiceSettings(
                        stability=0.6,
                        similarity_boost=0.8,
                        style=self._style_to_elevenlabs_style(),
                        use_speaker_boost=True,
                    ),
                )

                with open(out_path, "wb") as f:
                    for chunk in audio_bytes:
                        f.write(chunk)

                logger.debug(
                    f"ElevenLabs: scene {scene_idx} → {out_path}"
                )
                return out_path

            except Exception as e:
                logger.warning(
                    f"ElevenLabs attempt {attempt + 1} failed for scene {scene_idx}: {e}"
                )
                time.sleep(2 ** attempt)

        logger.error(
            f"ElevenLabs failed for scene {scene_idx}, falling back to Edge-TTS"
        )
        return self._generate_edge_tts(text, out_path, scene_idx)

    def _get_elevenlabs_voice_id(self, client, voice_name: str) -> str:
        """Resolve voice name to ElevenLabs voice ID."""
        # Hardcoded well-known voice IDs as fallback
        known_voices = {
            "Adam": "pNInz6obpgDQGcFmaJgB",
            "Arnold": "VR6AewLTigWG4xSOukaG",
            "Rachel": "21m00Tcm4TlvDq8ikWAM",
            "Bella": "EXAVITQu4vr4xnSDxMaL",
        }
        if voice_name in known_voices:
            return known_voices[voice_name]

        try:
            voices = client.voices.get_all()
            for v in voices.voices:
                if v.name.lower() == voice_name.lower():
                    return v.voice_id
        except Exception:
            pass

        return known_voices.get(voice_name, "pNInz6obpgDQGcFmaJgB")  # default Adam

    def _style_to_elevenlabs_style(self) -> float:
        style_map = {
            VideoStyle.PROFESSIONAL: 0.1,
            VideoStyle.DOCUMENTARY: 0.3,
            VideoStyle.FAST_PACED: 0.7,
            VideoStyle.STORYTELLING: 0.5,
        }
        return style_map.get(self.config.style, 0.3)

    # ──────────────────────────────────────────────────────────────
    # Edge-TTS Implementation (free fallback)
    # ──────────────────────────────────────────────────────────────

    def _generate_edge_tts(
        self, text: str, out_path: str, scene_idx: int
    ) -> Optional[str]:
        try:
            import edge_tts
        except ImportError:
            logger.error("edge-tts not installed. Run: pip install edge-tts")
            return None

        voice = self._voice_settings["edge_tts_voice"]
        speed = self._voice_settings["speed"]

        # Edge-TTS uses rate string like "+10%" or "-5%"
        rate_pct = int((speed - 1.0) * 100)
        rate_str = f"+{rate_pct}%" if rate_pct >= 0 else f"{rate_pct}%"

        # Edge-TTS is async — run in event loop
        for attempt in range(3):
            try:
                asyncio.run(
                    self._edge_tts_async(text, out_path, voice, rate_str)
                )
                logger.debug(f"Edge-TTS: scene {scene_idx} → {out_path}")
                return out_path
            except Exception as e:
                logger.warning(
                    f"Edge-TTS attempt {attempt + 1} failed for scene {scene_idx}: {e}"
                )
                time.sleep(1)

        logger.error(f"Edge-TTS failed for scene {scene_idx}")
        return None

    async def _edge_tts_async(
        self, text: str, out_path: str, voice: str, rate: str
    ) -> None:
        import edge_tts

        communicate = edge_tts.Communicate(text, voice, rate=rate)
        await communicate.save(out_path)

    # ──────────────────────────────────────────────────────────────
    # Audio duration helper
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    def get_audio_duration(path: str) -> float:
        """Return duration in seconds using mutagen (fast, no FFmpeg needed)."""
        try:
            from mutagen.mp3 import MP3
            audio = MP3(path)
            return audio.info.length
        except Exception:
            try:
                # Fallback: use moviepy
                from moviepy.editor import AudioFileClip
                clip = AudioFileClip(path)
                dur = clip.duration
                clip.close()
                return dur
            except Exception as e:
                logger.warning(f"Cannot get duration of {path}: {e}")
                return 10.0  # default assumption
