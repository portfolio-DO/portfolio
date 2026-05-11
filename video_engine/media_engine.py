"""
Media Engine — The Sourcing
Handles: Pexels video/image fetch, rate-limit protection, Ken Burns effect
"""

import logging
import os
import time
import urllib.request
from pathlib import Path
from typing import Optional

import requests

from config import (
    KEN_BURNS_ZOOM_RANGE,
    OUTPUT_FPS,
    OUTPUT_RESOLUTION,
    PEXELS_RATE_LIMIT_DELAY,
    DurationMode,
    EngineConfig,
)
from groq_pipeline import Scene

logger = logging.getLogger(__name__)

PEXELS_VIDEO_URL = "https://api.pexels.com/videos/search"
PEXELS_IMAGE_URL = "https://api.pexels.com/v1/search"


class MediaEngine:
    """Fetches and prepares visual assets for each scene."""

    def __init__(self, config: EngineConfig, media_dir: str):
        self.config = config
        self.media_dir = Path(media_dir)
        self.media_dir.mkdir(parents=True, exist_ok=True)
        self._headers = {"Authorization": config.pexels_api_key}
        self._is_long = config.duration_mode == DurationMode.LONG
        self._call_count = 0

    # ──────────────────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────────────────

    def fetch_scene_media(
        self, scene: Scene, target_duration: float
    ) -> dict:
        """
        Fetch best visual asset for a scene.
        Returns {type: 'video'|'image', path: str, duration: float}
        """
        logger.info(
            f"[Media] Scene {scene.index} — keywords: {scene.visual_keywords}"
        )

        for keyword in scene.visual_keywords:
            # Try video first
            video_path = self._fetch_pexels_video(keyword, scene.index)
            if video_path:
                return {
                    "type": "video",
                    "path": video_path,
                    "duration": target_duration,
                    "keyword": keyword,
                }
            self._rate_limit_wait()

        # Video fallback: try image + Ken Burns
        for keyword in scene.visual_keywords:
            image_path = self._fetch_pexels_image(keyword, scene.index)
            if image_path:
                kb_path = self._apply_ken_burns(
                    image_path, target_duration, scene.index
                )
                return {
                    "type": "ken_burns",
                    "path": kb_path,
                    "duration": target_duration,
                    "keyword": keyword,
                }
            self._rate_limit_wait()

        # Last resort: solid color placeholder
        logger.warning(
            f"Scene {scene.index}: No media found. Using placeholder."
        )
        placeholder = self._create_placeholder(target_duration, scene.index)
        return {
            "type": "placeholder",
            "path": placeholder,
            "duration": target_duration,
            "keyword": "none",
        }

    def fetch_all_scenes(
        self, scenes: list[Scene], durations: dict[int, float]
    ) -> dict[int, dict]:
        """
        Fetch media for all scenes.
        Returns {scene_index: media_info}
        """
        results = {}
        total = len(scenes)
        for i, scene in enumerate(scenes):
            logger.info(f"[Media] Fetching {i+1}/{total}...")
            dur = durations.get(scene.index, scene.duration_hint)
            results[scene.index] = self.fetch_scene_media(scene, dur)
        return results

    # ──────────────────────────────────────────────────────────────
    # Pexels Video
    # ──────────────────────────────────────────────────────────────

    def _fetch_pexels_video(
        self, keyword: str, scene_idx: int, results_count: int = 3
    ) -> Optional[str]:
        cache_key = f"video_{scene_idx}_{keyword.replace(' ', '_')}"
        cache_path = self.media_dir / f"{cache_key}.mp4"
        if cache_path.exists():
            return str(cache_path)

        try:
            self._rate_limit_wait()
            resp = requests.get(
                PEXELS_VIDEO_URL,
                headers=self._headers,
                params={
                    "query": keyword,
                    "per_page": results_count,
                    "orientation": "landscape",
                    "size": "large",
                },
                timeout=15,
            )
            resp.raise_for_status()
            videos = resp.json().get("videos", [])

            if not videos:
                return None

            # Pick the video with HD resolution closest to 1920x1080
            best = self._pick_best_video(videos)
            if not best:
                return None

            logger.debug(f"  Downloading video: {best}")
            self._download_file(best, str(cache_path))
            return str(cache_path)

        except requests.HTTPError as e:
            if e.response.status_code == 429:
                logger.warning("Pexels rate limit hit. Waiting 10s...")
                time.sleep(10)
            else:
                logger.warning(f"Pexels video error for '{keyword}': {e}")
            return None
        except Exception as e:
            logger.warning(f"Pexels video fetch failed for '{keyword}': {e}")
            return None

    def _pick_best_video(self, videos: list) -> Optional[str]:
        """Pick the best quality video file URL from results."""
        target_w, target_h = OUTPUT_RESOLUTION
        best_url = None
        best_score = -1

        for video in videos:
            for vf in video.get("video_files", []):
                w = vf.get("width", 0)
                h = vf.get("height", 0)
                link = vf.get("link", "")
                if not link:
                    continue
                # Score: prefer HD, landscape
                score = (
                    min(w / target_w, 1.5) * 50
                    + min(h / target_h, 1.5) * 50
                    - abs(w / h - target_w / target_h) * 10
                )
                if score > best_score:
                    best_score = score
                    best_url = link

        return best_url

    # ──────────────────────────────────────────────────────────────
    # Pexels Image
    # ──────────────────────────────────────────────────────────────

    def _fetch_pexels_image(
        self, keyword: str, scene_idx: int
    ) -> Optional[str]:
        cache_key = f"image_{scene_idx}_{keyword.replace(' ', '_')}"
        cache_path = self.media_dir / f"{cache_key}.jpg"
        if cache_path.exists():
            return str(cache_path)

        try:
            self._rate_limit_wait()
            resp = requests.get(
                PEXELS_IMAGE_URL,
                headers=self._headers,
                params={
                    "query": keyword,
                    "per_page": 3,
                    "orientation": "landscape",
                    "size": "large",
                },
                timeout=15,
            )
            resp.raise_for_status()
            photos = resp.json().get("photos", [])
            if not photos:
                return None

            photo = photos[0]
            url = photo["src"].get("large2x") or photo["src"].get("large")
            if not url:
                return None

            self._download_file(url, str(cache_path))
            return str(cache_path)

        except Exception as e:
            logger.warning(f"Pexels image fetch failed for '{keyword}': {e}")
            return None

    # ──────────────────────────────────────────────────────────────
    # Ken Burns Effect
    # ──────────────────────────────────────────────────────────────

    def _apply_ken_burns(
        self, image_path: str, duration: float, scene_idx: int
    ) -> str:
        """Apply Ken Burns (slow zoom-pan) effect to a still image."""
        out_path = self.media_dir / f"kenburns_{scene_idx:04d}.mp4"
        if out_path.exists():
            return str(out_path)

        try:
            import numpy as np
            from moviepy.editor import ImageClip
            from PIL import Image

            img = Image.open(image_path).convert("RGB")
            # Resize to slightly larger than output for zoom room
            pad_w = int(OUTPUT_RESOLUTION[0] * KEN_BURNS_ZOOM_RANGE[1] * 1.05)
            pad_h = int(OUTPUT_RESOLUTION[1] * KEN_BURNS_ZOOM_RANGE[1] * 1.05)
            img = img.resize((pad_w, pad_h), Image.LANCZOS)
            img_array = np.array(img)

            w, h = OUTPUT_RESOLUTION
            zoom_start = KEN_BURNS_ZOOM_RANGE[0]
            zoom_end = KEN_BURNS_ZOOM_RANGE[1]

            def make_frame(t: float):
                progress = t / duration if duration > 0 else 0
                zoom = zoom_start + (zoom_end - zoom_start) * progress

                # Current crop size
                crop_w = int(w / zoom)
                crop_h = int(h / zoom)

                # Pan from top-left to bottom-right
                x_start = int((img_array.shape[1] - crop_w) * progress * 0.5)
                y_start = int((img_array.shape[0] - crop_h) * progress * 0.3)

                x_start = max(0, min(x_start, img_array.shape[1] - crop_w))
                y_start = max(0, min(y_start, img_array.shape[0] - crop_h))

                cropped = img_array[
                    y_start : y_start + crop_h,
                    x_start : x_start + crop_w,
                ]
                # Resize back to output resolution
                from PIL import Image as PILImage
                frame = PILImage.fromarray(cropped).resize(
                    OUTPUT_RESOLUTION, PILImage.LANCZOS
                )
                return np.array(frame)

            clip = ImageClip(img_array, duration=duration)
            clip = clip.fl(lambda gf, t: make_frame(t))
            clip = clip.set_fps(OUTPUT_FPS)
            clip.write_videofile(
                str(out_path),
                fps=OUTPUT_FPS,
                codec="libx264",
                preset="fast",
                logger=None,
            )
            clip.close()
            return str(out_path)

        except Exception as e:
            logger.error(f"Ken Burns failed for scene {scene_idx}: {e}")
            return self._create_placeholder(duration, scene_idx)

    # ──────────────────────────────────────────────────────────────
    # Placeholder (last resort)
    # ──────────────────────────────────────────────────────────────

    def _create_placeholder(self, duration: float, scene_idx: int) -> str:
        """Create a solid dark gradient video clip as placeholder."""
        out_path = self.media_dir / f"placeholder_{scene_idx:04d}.mp4"
        if out_path.exists():
            return str(out_path)

        try:
            import numpy as np
            from moviepy.editor import ColorClip

            w, h = OUTPUT_RESOLUTION
            color_clip = ColorClip(
                size=(w, h), color=(20, 20, 40), duration=duration
            )
            color_clip = color_clip.set_fps(OUTPUT_FPS)
            color_clip.write_videofile(
                str(out_path),
                fps=OUTPUT_FPS,
                codec="libx264",
                preset="fast",
                logger=None,
            )
            color_clip.close()
        except Exception as e:
            logger.error(f"Placeholder creation failed: {e}")

        return str(out_path)

    # ──────────────────────────────────────────────────────────────
    # Utilities
    # ──────────────────────────────────────────────────────────────

    def _rate_limit_wait(self):
        """Apply rate-limit delay for long-form videos."""
        self._call_count += 1
        if self._is_long and self._call_count > 1:
            time.sleep(PEXELS_RATE_LIMIT_DELAY)

    def _download_file(self, url: str, dest_path: str, max_retries: int = 3):
        """Download file with retry logic."""
        for attempt in range(max_retries):
            try:
                req = urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": (
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                            "AppleWebKit/537.36"
                        )
                    },
                )
                with urllib.request.urlopen(req, timeout=30) as r, \
                     open(dest_path, "wb") as f:
                    f.write(r.read())
                return
            except Exception as e:
                logger.warning(f"Download attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    raise
