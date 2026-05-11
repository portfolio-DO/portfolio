"""
Logger — Structured production log
Tracks keywords, media sources, audio paths, and segment metadata
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from config import EngineConfig
from groq_pipeline import Chapter, Scene

logger = logging.getLogger(__name__)


class ProductionLogger:
    """
    Writes a structured JSON log file documenting:
    - Project metadata
    - Per-chapter breakdown
    - Per-scene: keywords used, media type/path, audio path, duration
    - Segment groupings
    - Any fallback events (Ken Burns, placeholders)
    """

    def __init__(self, config: EngineConfig, log_dir: str):
        self.config = config
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_path = self.log_dir / f"{config.project_name}_production.log.json"

        self._data: dict = {
            "project": {
                "name": config.project_name,
                "style": config.style.value,
                "duration_mode": config.duration_mode.value,
                "voice_provider": config.voice_provider.value,
                "started_at": datetime.utcnow().isoformat() + "Z",
                "completed_at": None,
            },
            "chapters": [],
            "scenes": [],
            "segments": [],
            "fallback_events": [],
            "warnings": [],
        }

    # ──────────────────────────────────────────────────────────────
    # Logging Methods
    # ──────────────────────────────────────────────────────────────

    def log_chapters(self, chapters: list[Chapter]):
        for ch in chapters:
            self._data["chapters"].append({
                "index": ch.index,
                "title": ch.title,
                "summary": ch.summary,
                "scene_count": len(ch.scenes),
            })
        self._flush()

    def log_scene(
        self,
        scene: Scene,
        media_info: Optional[dict],
        audio_path: Optional[str],
        actual_duration: float,
    ):
        media_type = media_info.get("type", "none") if media_info else "none"
        media_path = media_info.get("path", "") if media_info else ""
        keyword_used = media_info.get("keyword", "") if media_info else ""

        is_fallback = media_type in ("ken_burns", "placeholder")
        if is_fallback:
            self._data["fallback_events"].append({
                "scene_index": scene.index,
                "type": media_type,
                "reason": "No matching Pexels video found",
                "keyword_attempted": scene.visual_keywords,
            })

        self._data["scenes"].append({
            "index": scene.index,
            "chapter_index": scene.chapter_index,
            "chapter_title": scene.chapter_title,
            "narration_preview": scene.narration[:80] + ("..." if len(scene.narration) > 80 else ""),
            "subtitle": scene.subtitle,
            "visual_keywords": scene.visual_keywords,
            "keyword_used": keyword_used,
            "on_screen_text": scene.on_screen_text,
            "mood": scene.mood,
            "media_type": media_type,
            "media_path": media_path,
            "audio_path": audio_path or "",
            "actual_duration_seconds": round(actual_duration, 2),
            "is_fallback": is_fallback,
        })
        self._flush()

    def log_all_scenes(
        self,
        scenes: list[Scene],
        media_map: dict,
        audio_map: dict,
        duration_map: dict,
    ):
        for scene in scenes:
            self.log_scene(
                scene=scene,
                media_info=media_map.get(scene.index),
                audio_path=audio_map.get(scene.index),
                actual_duration=duration_map.get(scene.index, scene.duration_hint),
            )

    def log_segments(self, segment_groups: list[list[Scene]]):
        for i, seg in enumerate(segment_groups):
            self._data["segments"].append({
                "segment_index": i,
                "scene_indices": [s.index for s in seg],
                "scene_count": len(seg),
            })
        self._flush()

    def log_warning(self, message: str):
        self._data["warnings"].append({
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "message": message,
        })
        self._flush()

    def finalize(self, output_video_path: str, total_duration_seconds: float):
        self._data["project"]["completed_at"] = datetime.utcnow().isoformat() + "Z"
        self._data["project"]["output_video"] = output_video_path
        self._data["project"]["total_duration_seconds"] = round(total_duration_seconds, 2)
        self._data["project"]["total_duration_human"] = self._format_duration(total_duration_seconds)
        self._data["summary"] = {
            "total_scenes": len(self._data["scenes"]),
            "total_chapters": len(self._data["chapters"]),
            "total_segments": len(self._data["segments"]),
            "fallback_count": len(self._data["fallback_events"]),
            "warning_count": len(self._data["warnings"]),
            "media_breakdown": self._count_media_types(),
        }
        self._flush()
        logger.info(f"Production log saved → {self.log_path}")
        self._print_summary()

    # ──────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────

    def _flush(self):
        try:
            with open(self.log_path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Log flush failed: {e}")

    def _count_media_types(self) -> dict:
        counts = {"video": 0, "ken_burns": 0, "placeholder": 0, "none": 0}
        for scene in self._data["scenes"]:
            t = scene.get("media_type", "none")
            counts[t] = counts.get(t, 0) + 1
        return counts

    @staticmethod
    def _format_duration(seconds: float) -> str:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        if h > 0:
            return f"{h}h {m}m {s}s"
        elif m > 0:
            return f"{m}m {s}s"
        return f"{s}s"

    def _print_summary(self):
        s = self._data.get("summary", {})
        dur = self._data["project"].get("total_duration_human", "?")
        print("\n" + "═" * 60)
        print("  ✅  PRODUCTION COMPLETE")
        print("═" * 60)
        print(f"  Project   : {self.config.project_name}")
        print(f"  Output    : {self._data['project'].get('output_video', '?')}")
        print(f"  Duration  : {dur}")
        print(f"  Scenes    : {s.get('total_scenes', 0)}")
        print(f"  Chapters  : {s.get('total_chapters', 0)}")
        print(f"  Log file  : {self.log_path}")
        media = s.get("media_breakdown", {})
        print(f"  Media     : {media.get('video',0)} videos | "
              f"{media.get('ken_burns',0)} Ken Burns | "
              f"{media.get('placeholder',0)} placeholders")
        if s.get("fallback_count", 0):
            print(f"  ⚠  Fallbacks: {s['fallback_count']}")
        print("═" * 60 + "\n")
