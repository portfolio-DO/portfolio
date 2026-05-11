# 🎬 AI Video Generation Engine

A modular, production-grade Python engine that transforms any script into a
fully-edited `.mp4` video — supporting both **60-second short-form** and
**20+ minute long-form** output from a single command.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     VideoGenerationEngine                       │
│                        (engine.py)                              │
└───────────┬──────────────────────────────────────────┬──────────┘
            │                                          │
     ┌──────▼──────┐                           ┌──────▼──────┐
     │   Groq      │                           │  Production │
     │  Pipeline   │                           │   Logger    │
     │ (The Brain) │                           │ (.log.json) │
     └──────┬──────┘                           └─────────────┘
            │ Chapters + Scenes
     ┌──────▼────────────────────────────────────────────────┐
     │                    Scene Objects                       │
     │  {narration, subtitle, visual_keywords, on_screen_text}│
     └──────┬──────────────────────┬───────────────────────┬─┘
            │                      │                       │
     ┌──────▼──────┐        ┌──────▼──────┐        ┌──────▼──────┐
     │    Audio    │        │    Media    │        │    Video    │
     │  Processor  │        │   Engine   │        │   Editor   │
     │ (The Voice) │        │(The Source)│        │(The Assembly│
     └──────┬──────┘        └──────┬──────┘        └──────┬──────┘
            │                      │                       │
       Per-scene              Pexels videos          Stitch clips
       ElevenLabs             + Ken Burns            + Subtitles
       or Edge-TTS            fallback               + Music duck
            │                      │                       │
            └──────────────────────▼───────────────────────┘
                              Final .mp4
```

---

## ⚙️ Module Breakdown

| File | Role | Key Responsibility |
|------|------|--------------------|
| `config.py` | Configuration | `EngineConfig` dataclass, style→voice maps, constants |
| `groq_pipeline.py` | The Brain | Script → Chapters → Scenes with metadata via Groq LLM |
| `audio_processor.py` | The Voice | Per-scene TTS via ElevenLabs or Edge-TTS (free) |
| `media_engine.py` | The Sourcing | Pexels video/image fetch, rate-limit protection, Ken Burns |
| `video_editor.py` | The Assembly | MoviePy stitching, subtitles, music ducking, segment rendering |
| `production_logger.py` | The Log | JSON log: keywords, media types, fallbacks, durations |
| `engine.py` | Orchestrator | Ties all modules together in sequence |
| `main.py` | CLI | `argparse` entry point; JSON config or inline args |

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
# System: FFmpeg (required)
sudo apt install ffmpeg            # Ubuntu/Debian
brew install ffmpeg                # macOS

# Python packages
pip install -r requirements.txt
```

### 2. Set API keys

```bash
export GROQ_API_KEY="gsk_..."
export PEXELS_API_KEY="..."
# Optional (premium voices):
export ELEVENLABS_API_KEY="..."
```

### 3a. Run via JSON config

```bash
# Edit config_example.json with your keys + script, then:
python main.py --config config_example.json
```

### 3b. Run via CLI flags

```bash
# Short-form (~60s), Documentary style, free Edge-TTS voice
python main.py \
  --script my_script.txt \
  --style documentary \
  --mode short \
  --voice edge_tts \
  --groq-key gsk_... \
  --pexels-key ... \
  --project-name my_video

# Long-form (20+ min), Professional style, ElevenLabs voice
python main.py \
  --script long_script.txt \
  --style professional \
  --mode long \
  --voice elevenlabs \
  --elevenlabs-key sk_... \
  --groq-key gsk_... \
  --pexels-key ... \
  --music background_music.mp3 \
  --project-name documentary_series
```

---

## 🔑 API Keys Required

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| [Groq](https://console.groq.com) | Script analysis, scene generation | ✅ Yes |
| [Pexels](https://www.pexels.com/api/) | Stock video + image sourcing | ✅ Yes |
| [ElevenLabs](https://elevenlabs.io) | Premium AI voiceover | ✅ Limited |
| Edge-TTS | Free Microsoft TTS | ✅ Always free |

---

## 🎨 Video Styles

| Style | Voice Character | Visual Direction |
|-------|----------------|------------------|
| `documentary` | Deep narrator, 0.95x speed | Cinematic, wide landscapes, dramatic lighting |
| `professional` | Calm, authoritative, 1.0x | Modern offices, data, technology |
| `fast_paced` | Enthusiastic, 1.1x speed | Action, urban energy, colorful |
| `storytelling` | Warm, engaging, 1.0x | People, emotions, everyday life |

---

## 📁 Output Structure

```
output/
└── my_video/
    ├── audio/
    │   ├── scene_0000.mp3
    │   ├── scene_0001.mp3
    │   └── ...
    ├── media/
    │   ├── video_0_city_skyline_sunset.mp4
    │   ├── kenburns_0001.mp4          ← fallback
    │   └── ...
    ├── working/
    │   ├── segment_000.mp4            ← long-form chunks
    │   └── segment_001.mp4
    ├── logs/
    │   └── my_video_production.log.json
    └── final/
        └── my_video_short.mp4         ← ✅ Final output
```

---

## 📋 Production Log Format

The engine writes a structured JSON log at `logs/<project>_production.log.json`:

```json
{
  "project": {
    "name": "ai_revolution",
    "style": "documentary",
    "duration_mode": "short",
    "total_duration_human": "1m 3s"
  },
  "scenes": [
    {
      "index": 0,
      "chapter_title": "Main",
      "subtitle": "AI is reshaping our world",
      "visual_keywords": ["city skyline sunset", "technology data"],
      "keyword_used": "city skyline sunset",
      "media_type": "video",
      "actual_duration_seconds": 10.4,
      "is_fallback": false
    }
  ],
  "fallback_events": [],
  "summary": {
    "total_scenes": 6,
    "media_breakdown": {"video": 5, "ken_burns": 1, "placeholder": 0}
  }
}
```

---

## 🧠 How the Groq Pipeline Works

### Short-form (60s)
```
Script → Single Groq call → 5-7 Scenes
Each scene: narration | subtitle | keywords | on-screen text | mood
```

### Long-form (20+ min)
```
Script → Chapter split (Groq) → Per-chapter scene generation (Groq)
         ↓
Chapter 1 → 8-12 scenes
Chapter 2 → 8-12 scenes
...
Chapter N → 8-12 scenes
```

---

## 🛡 Resilience Features

| Feature | Implementation |
|---------|---------------|
| **Pexels rate-limit** | 1-second delay between calls in long mode |
| **Video → Image fallback** | Auto Ken Burns on still images |
| **Image → Placeholder fallback** | Solid color clip if all else fails |
| **TTS retry** | 3 attempts with exponential backoff |
| **Memory management** | 5-minute segment rendering for long videos |
| **Asset caching** | Downloaded media reused on re-runs |
| **Groq retry** | 3 attempts per API call |

---

## 🔧 Customization

### Change segment size (RAM tuning)
```python
# config.py
SEGMENT_DURATION_MINUTES = 3   # more segments, less RAM per segment
```

### Add Pixabay as secondary video source
Extend `media_engine.py`'s `fetch_scene_media()` to try Pixabay after
Pexels with the same interface.

### Custom background music
Pass any `.mp3` path via `--music` or `background_music_path` in config.
The engine auto-loops and applies ducking (volume lowers during voiceover).

---

## 📦 Programmatic Usage

```python
from config import EngineConfig, VideoStyle, DurationMode, VoiceProvider
from engine import VideoGenerationEngine

config = EngineConfig(
    script=open("my_script.txt").read(),
    style=VideoStyle.STORYTELLING,
    duration_mode=DurationMode.SHORT,
    groq_api_key="gsk_...",
    pexels_api_key="...",
    voice_provider=VoiceProvider.EDGE_TTS,
    project_name="brand_story",
)

engine = VideoGenerationEngine(config)
output_path = engine.run()
print(f"Video ready: {output_path}")
```

---

## 🚨 Common Issues

**`ImageMagick not found`** (MoviePy TextClip)
```bash
sudo apt install imagemagick
# Then in /etc/ImageMagick-6/policy.xml, change PDF policy to read|write
```

**`No module named 'moviepy'`**
```bash
pip install moviepy==1.0.3
```

**Pexels returns no results**
- Try more generic keywords in your script
- Check your API key has not exceeded the free tier (200 req/hr)

**Edge-TTS `RuntimeError: Event loop is closed`**
```bash
pip install --upgrade edge-tts
```
