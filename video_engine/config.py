"""
Video Generation Engine - Configuration & Constants
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class DurationMode(str, Enum):
    SHORT = "short"   # ~60 seconds
    LONG = "long"     # 20+ minutes


class VideoStyle(str, Enum):
    PROFESSIONAL = "professional"
    DOCUMENTARY = "documentary"
    FAST_PACED = "fast_paced"
    STORYTELLING = "storytelling"


class VoiceProvider(str, Enum):
    ELEVENLABS = "elevenlabs"
    EDGE_TTS = "edge_tts"


# Style → Voice personality mapping
STYLE_VOICE_MAP = {
    VideoStyle.PROFESSIONAL: {
        "elevenlabs_voice": "Adam",          # calm, authoritative
        "edge_tts_voice": "en-US-GuyNeural",
        "personality": "professional and clear",
        "speed": 1.0,
    },
    VideoStyle.DOCUMENTARY: {
        "elevenlabs_voice": "Arnold",         # deep narrator
        "edge_tts_voice": "en-US-ChristopherNeural",
        "personality": "deep, contemplative narrator",
        "speed": 0.95,
    },
    VideoStyle.FAST_PACED: {
        "elevenlabs_voice": "Rachel",         # energetic
        "edge_tts_voice": "en-US-JennyNeural",
        "personality": "enthusiastic and energetic",
        "speed": 1.1,
    },
    VideoStyle.STORYTELLING: {
        "elevenlabs_voice": "Bella",          # warm storyteller
        "edge_tts_voice": "en-US-AriaNeural",
        "personality": "warm, engaging storyteller",
        "speed": 1.0,
    },
}

# Segment chunking for memory management (minutes)
SEGMENT_DURATION_MINUTES = 5

# Scene target duration (seconds)
SCENE_DURATION_SECONDS = 10

# Pexels rate-limit delay for long videos (seconds)
PEXELS_RATE_LIMIT_DELAY = 1.0

# Audio ducking settings
MUSIC_NORMAL_VOLUME = 0.15      # 15% when VO is speaking
MUSIC_FULL_VOLUME = 0.35        # 35% in gaps
MUSIC_FADE_DURATION = 0.5       # seconds for fade transition

# Ken Burns zoom intensity
KEN_BURNS_ZOOM_RANGE = (1.0, 1.08)

# Output settings
OUTPUT_FPS = 24
OUTPUT_RESOLUTION = (1920, 1080)
OUTPUT_VIDEO_BITRATE = "4000k"
OUTPUT_AUDIO_BITRATE = "192k"


@dataclass
class EngineConfig:
    script: str
    style: VideoStyle
    duration_mode: DurationMode
    groq_api_key: str
    pexels_api_key: str
    voice_provider: VoiceProvider
    elevenlabs_api_key: Optional[str] = None
    output_dir: str = "output"
    project_name: str = "video_project"
    background_music_path: Optional[str] = None   # optional custom music
    extra_keywords: list = field(default_factory=list)
