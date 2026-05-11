"""
CLI Entry Point
Run: python main.py --config config_example.json
  or: python main.py --help
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from config import DurationMode, EngineConfig, VideoStyle, VoiceProvider
from engine import VideoGenerationEngine

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="🎬 Modular AI Video Generation Engine",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    p.add_argument(
        "--config",
        type=str,
        help="Path to a JSON config file (see config_example.json).",
    )
    p.add_argument("--script", type=str, help="Script text (or path to .txt file).")
    p.add_argument(
        "--style",
        type=str,
        choices=[s.value for s in VideoStyle],
        default="documentary",
        help="Video style.",
    )
    p.add_argument(
        "--mode",
        type=str,
        choices=["short", "long"],
        default="short",
        help="Duration mode: short (~60s) or long (20+ min).",
    )
    p.add_argument(
        "--voice",
        type=str,
        choices=["elevenlabs", "edge_tts"],
        default="edge_tts",
        help="Voice provider.",
    )
    p.add_argument("--groq-key", type=str, help="Groq API key.")
    p.add_argument("--pexels-key", type=str, help="Pexels API key.")
    p.add_argument("--elevenlabs-key", type=str, help="ElevenLabs API key.")
    p.add_argument("--music", type=str, help="Path to background music .mp3.")
    p.add_argument("--output-dir", type=str, default="output", help="Output directory.")
    p.add_argument("--project-name", type=str, default="my_video", help="Project name.")
    return p


def load_config_from_json(path: str) -> EngineConfig:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Script can be inline or a file path
    script = data.get("script", "")
    if script.endswith(".txt") and Path(script).exists():
        script = Path(script).read_text(encoding="utf-8")

    return EngineConfig(
        script=script,
        style=VideoStyle(data.get("style", "documentary")),
        duration_mode=DurationMode(data.get("duration_mode", "short")),
        groq_api_key=data.get("groq_api_key") or os.environ.get("GROQ_API_KEY", ""),
        pexels_api_key=data.get("pexels_api_key") or os.environ.get("PEXELS_API_KEY", ""),
        voice_provider=VoiceProvider(data.get("voice_provider", "edge_tts")),
        elevenlabs_api_key=data.get("elevenlabs_api_key") or os.environ.get("ELEVENLABS_API_KEY"),
        output_dir=data.get("output_dir", "output"),
        project_name=data.get("project_name", "my_video"),
        background_music_path=data.get("background_music_path"),
    )


def load_config_from_args(args) -> EngineConfig:
    script = args.script or ""
    if script and Path(script).exists():
        script = Path(script).read_text(encoding="utf-8")

    return EngineConfig(
        script=script,
        style=VideoStyle(args.style),
        duration_mode=DurationMode(args.mode),
        groq_api_key=args.groq_key or os.environ.get("GROQ_API_KEY", ""),
        pexels_api_key=args.pexels_key or os.environ.get("PEXELS_API_KEY", ""),
        voice_provider=VoiceProvider(args.voice),
        elevenlabs_api_key=args.elevenlabs_key or os.environ.get("ELEVENLABS_API_KEY"),
        output_dir=args.output_dir,
        project_name=args.project_name,
        background_music_path=args.music,
    )


def validate_config(cfg: EngineConfig):
    errors = []
    if not cfg.script.strip():
        errors.append("Script is empty.")
    if not cfg.groq_api_key:
        errors.append("Groq API key is missing (--groq-key or GROQ_API_KEY env).")
    if not cfg.pexels_api_key:
        errors.append("Pexels API key is missing (--pexels-key or PEXELS_API_KEY env).")
    if cfg.voice_provider == VoiceProvider.ELEVENLABS and not cfg.elevenlabs_api_key:
        errors.append("ElevenLabs API key required when using ElevenLabs voice provider.")
    if errors:
        for e in errors:
            print(f"  ❌ {e}")
        sys.exit(1)


# ──────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────

def main():
    parser = build_parser()
    args = parser.parse_args()

    if args.config:
        cfg = load_config_from_json(args.config)
    elif args.script:
        cfg = load_config_from_args(args)
    else:
        parser.print_help()
        sys.exit(1)

    validate_config(cfg)

    engine = VideoGenerationEngine(cfg)
    output = engine.run()
    print(f"\n✅  Video ready: {output}")


if __name__ == "__main__":
    main()
