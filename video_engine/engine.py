"""
VideoGenerationEngine — Master Orchestrator
Ties together: Groq → Audio → Media → Editor → Logger
"""

import logging
import os
import sys
from pathlib import Path

from config import DurationMode, EngineConfig
from groq_pipeline import GroqPipeline
from audio_processor import AudioProcessor
from media_engine import MediaEngine
from video_editor import VideoEditor
from production_logger import ProductionLogger

# ──────────────────────────────────────────────────────────────────
# Logging setup
# ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


class VideoGenerationEngine:
    """
    End-to-end video generation pipeline.

    Usage:
        config = EngineConfig(
            script="...",
            style=VideoStyle.DOCUMENTARY,
            duration_mode=DurationMode.SHORT,
            groq_api_key="gsk_...",
            pexels_api_key="...",
            voice_provider=VoiceProvider.EDGE_TTS,
        )
        engine = VideoGenerationEngine(config)
        output_path = engine.run()
    """

    def __init__(self, config: EngineConfig):
        self.config = config
        self._setup_directories()

        self.groq = GroqPipeline(config)
        self.audio = AudioProcessor(config, self.dirs["audio"])
        self.media = MediaEngine(config, self.dirs["media"])
        self.editor = VideoEditor(config, self.dirs["working"])
        self.log = ProductionLogger(config, self.dirs["logs"])

    def _setup_directories(self):
        base = Path(self.config.output_dir) / self.config.project_name
        self.dirs = {
            "base": str(base),
            "audio": str(base / "audio"),
            "media": str(base / "media"),
            "working": str(base / "working"),
            "logs": str(base / "logs"),
            "final": str(base / "final"),
        }
        for d in self.dirs.values():
            Path(d).mkdir(parents=True, exist_ok=True)

    # ──────────────────────────────────────────────────────────────
    # Main Run
    # ──────────────────────────────────────────────────────────────

    def run(self) -> str:
        """
        Execute the full pipeline and return the path to the final .mp4.
        """
        logger.info("=" * 60)
        logger.info(f"  VIDEO ENGINE STARTING")
        logger.info(f"  Project : {self.config.project_name}")
        logger.info(f"  Style   : {self.config.style.value}")
        logger.info(f"  Mode    : {self.config.duration_mode.value}")
        logger.info("=" * 60)

        # ── Step 1: Groq Pipeline ─────────────────────────────────
        logger.info("\n[1/5] Running Groq script analysis...")
        chapters, scenes = self.groq.process_script()
        self.log.log_chapters(chapters)
        logger.info(
            f"  → {len(chapters)} chapter(s), {len(scenes)} scene(s) generated."
        )

        # ── Step 2: Audio Generation ──────────────────────────────
        logger.info("\n[2/5] Generating voiceovers...")
        audio_map = self.audio.generate_all(scenes)
        successful_audio = sum(1 for v in audio_map.values() if v)
        logger.info(
            f"  → {successful_audio}/{len(scenes)} audio clips generated."
        )

        # ── Step 3: Compute actual durations ─────────────────────
        logger.info("\n[3/5] Computing scene durations...")
        duration_map = self._compute_durations(scenes, audio_map)

        # ── Step 4: Media Fetching ────────────────────────────────
        logger.info("\n[4/5] Fetching visual media...")
        media_map = self.media.fetch_all_scenes(scenes, duration_map)

        # Log all scene data
        self.log.log_all_scenes(scenes, media_map, audio_map, duration_map)

        # ── Step 5: Video Assembly ────────────────────────────────
        output_path = self._get_output_path()
        logger.info(f"\n[5/5] Assembling video → {output_path}")

        final_path = self.editor.assemble(
            scenes=scenes,
            media_map=media_map,
            audio_map=audio_map,
            output_path=output_path,
        )

        # ── Finalize Log ──────────────────────────────────────────
        total_duration = sum(duration_map.values())
        self.log.finalize(final_path, total_duration)

        return final_path

    # ──────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────

    def _compute_durations(
        self, scenes, audio_map: dict
    ) -> dict[int, float]:
        """
        Calculate actual duration per scene based on audio length.
        Falls back to scene.duration_hint if no audio.
        """
        duration_map: dict[int, float] = {}
        for scene in scenes:
            path = audio_map.get(scene.index)
            if path and Path(path).exists():
                dur = AudioProcessor.get_audio_duration(path)
                # Add slight padding between scenes
                duration_map[scene.index] = dur + 0.4
            else:
                duration_map[scene.index] = scene.duration_hint
        return duration_map

    def _get_output_path(self) -> str:
        final_dir = Path(self.dirs["final"])
        filename = f"{self.config.project_name}_{self.config.duration_mode.value}.mp4"
        return str(final_dir / filename)
