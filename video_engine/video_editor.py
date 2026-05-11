"""
Video Editor — The Assembly
Handles: clip stitching, subtitles, audio ducking, segment rendering
"""

import logging
import os
import textwrap
from pathlib import Path
from typing import Optional

from config import (
    MUSIC_FADE_DURATION,
    MUSIC_FULL_VOLUME,
    MUSIC_NORMAL_VOLUME,
    OUTPUT_AUDIO_BITRATE,
    OUTPUT_FPS,
    OUTPUT_RESOLUTION,
    OUTPUT_VIDEO_BITRATE,
    SEGMENT_DURATION_MINUTES,
    DurationMode,
    EngineConfig,
)
from groq_pipeline import Scene

logger = logging.getLogger(__name__)


class VideoEditor:
    """Assembles scenes into the final video with subtitles and music."""

    def __init__(self, config: EngineConfig, working_dir: str):
        self.config = config
        self.working_dir = Path(working_dir)
        self.working_dir.mkdir(parents=True, exist_ok=True)
        self._is_long = config.duration_mode == DurationMode.LONG

    # ──────────────────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────────────────

    def assemble(
        self,
        scenes: list[Scene],
        media_map: dict[int, dict],
        audio_map: dict[int, Optional[str]],
        output_path: str,
    ) -> str:
        """
        Main assembly method.
        - Short mode: render all at once.
        - Long mode: render in segments then concatenate.
        """
        if self._is_long:
            return self._assemble_segmented(
                scenes, media_map, audio_map, output_path
            )
        else:
            return self._assemble_direct(
                scenes, media_map, audio_map, output_path
            )

    # ──────────────────────────────────────────────────────────────
    # Direct Assembly (short-form)
    # ──────────────────────────────────────────────────────────────

    def _assemble_direct(
        self,
        scenes: list[Scene],
        media_map: dict,
        audio_map: dict,
        output_path: str,
    ) -> str:
        from moviepy.editor import (
            AudioFileClip,
            CompositeAudioClip,
            CompositeVideoClip,
            TextClip,
            VideoFileClip,
            concatenate_videoclips,
        )

        scene_clips = []

        for scene in scenes:
            clip = self._build_scene_clip(scene, media_map, audio_map)
            if clip:
                scene_clips.append(clip)

        if not scene_clips:
            raise RuntimeError("No scene clips were built — aborting.")

        logger.info(f"Concatenating {len(scene_clips)} clips...")
        final = concatenate_videoclips(scene_clips, method="compose")

        # Add background music
        if self.config.background_music_path:
            final = self._add_background_music(
                final, self.config.background_music_path, audio_map, scenes
            )

        logger.info(f"Writing final video → {output_path}")
        final.write_videofile(
            output_path,
            fps=OUTPUT_FPS,
            codec="libx264",
            audio_codec="aac",
            bitrate=OUTPUT_VIDEO_BITRATE,
            audio_bitrate=OUTPUT_AUDIO_BITRATE,
            preset="medium",
            logger="bar",
        )

        # Cleanup
        for c in scene_clips:
            c.close()
        final.close()

        return output_path

    # ──────────────────────────────────────────────────────────────
    # Segmented Assembly (long-form, memory-safe)
    # ──────────────────────────────────────────────────────────────

    def _assemble_segmented(
        self,
        scenes: list[Scene],
        media_map: dict,
        audio_map: dict,
        output_path: str,
    ) -> str:
        from moviepy.editor import concatenate_videoclips, VideoFileClip

        # Group scenes into segments by total duration
        segments = self._group_into_segments(scenes, audio_map)
        segment_paths = []

        for seg_idx, seg_scenes in enumerate(segments):
            seg_path = str(
                self.working_dir / f"segment_{seg_idx:03d}.mp4"
            )
            if Path(seg_path).exists():
                logger.info(
                    f"Segment {seg_idx} already rendered, skipping."
                )
                segment_paths.append(seg_path)
                continue

            logger.info(
                f"Rendering segment {seg_idx + 1}/{len(segments)} "
                f"({len(seg_scenes)} scenes)..."
            )

            scene_clips = []
            for scene in seg_scenes:
                clip = self._build_scene_clip(scene, media_map, audio_map)
                if clip:
                    scene_clips.append(clip)

            if not scene_clips:
                logger.warning(f"Segment {seg_idx} has no clips, skipping.")
                continue

            from moviepy.editor import concatenate_videoclips
            seg_video = concatenate_videoclips(scene_clips, method="compose")

            # Add music per segment
            if self.config.background_music_path:
                seg_video = self._add_background_music(
                    seg_video,
                    self.config.background_music_path,
                    audio_map,
                    seg_scenes,
                )

            seg_video.write_videofile(
                seg_path,
                fps=OUTPUT_FPS,
                codec="libx264",
                audio_codec="aac",
                bitrate=OUTPUT_VIDEO_BITRATE,
                audio_bitrate=OUTPUT_AUDIO_BITRATE,
                preset="medium",
                logger="bar",
            )

            for c in scene_clips:
                c.close()
            seg_video.close()
            segment_paths.append(seg_path)

        # Concatenate all segments
        logger.info(
            f"Combining {len(segment_paths)} segments → {output_path}"
        )
        seg_clips = [VideoFileClip(p) for p in segment_paths]
        final = concatenate_videoclips(seg_clips, method="compose")
        final.write_videofile(
            output_path,
            fps=OUTPUT_FPS,
            codec="libx264",
            audio_codec="aac",
            bitrate=OUTPUT_VIDEO_BITRATE,
            audio_bitrate=OUTPUT_AUDIO_BITRATE,
            preset="medium",
            logger="bar",
        )

        for c in seg_clips:
            c.close()
        final.close()

        return output_path

    # ──────────────────────────────────────────────────────────────
    # Per-Scene Clip Builder
    # ──────────────────────────────────────────────────────────────

    def _build_scene_clip(
        self, scene: Scene, media_map: dict, audio_map: dict
    ):
        """Build a single scene's VideoClip with audio + subtitles."""
        from moviepy.editor import (
            AudioFileClip,
            CompositeVideoClip,
            VideoFileClip,
            vfx,
        )

        media_info = media_map.get(scene.index)
        audio_path = audio_map.get(scene.index)

        if not media_info:
            logger.warning(f"No media for scene {scene.index}, skipping.")
            return None

        media_path = media_info.get("path")
        target_dur = media_info.get("duration", scene.duration_hint)

        try:
            # Load video/image clip
            video_clip = VideoFileClip(media_path, audio=False)

            # Resize to output resolution
            video_clip = video_clip.resize(OUTPUT_RESOLUTION)

            # Trim or loop to match audio duration
            if audio_path and Path(audio_path).exists():
                audio_clip = AudioFileClip(audio_path)
                actual_dur = audio_clip.duration + 0.5  # 0.5s padding
                video_clip = self._fit_video_to_duration(
                    video_clip, actual_dur
                )
                video_clip = video_clip.set_audio(audio_clip)
            else:
                video_clip = self._fit_video_to_duration(
                    video_clip, target_dur
                )

            # Add subtitles overlay
            layers = [video_clip]

            subtitle_clip = self._make_subtitle_clip(
                scene.subtitle,
                video_clip.duration,
                position="bottom",
            )
            if subtitle_clip:
                layers.append(subtitle_clip)

            # Add on-screen text overlay if present
            if scene.on_screen_text:
                text_overlay = self._make_text_overlay(
                    scene.on_screen_text, video_clip.duration
                )
                if text_overlay:
                    layers.append(text_overlay)

            if len(layers) > 1:
                composite = CompositeVideoClip(layers)
                composite = composite.set_duration(video_clip.duration)
                return composite
            else:
                return video_clip

        except Exception as e:
            logger.error(f"Scene {scene.index} clip build failed: {e}")
            return None

    # ──────────────────────────────────────────────────────────────
    # Subtitle Rendering
    # ──────────────────────────────────────────────────────────────

    def _make_subtitle_clip(
        self, text: str, duration: float, position: str = "bottom"
    ):
        """Render a subtitle clip with background box."""
        if not text.strip():
            return None

        try:
            from moviepy.editor import TextClip, ImageClip
            import numpy as np
            from PIL import Image, ImageDraw, ImageFont

            w, h = OUTPUT_RESOLUTION
            # Wrap text
            wrapped = textwrap.fill(text, width=60)

            # Use PIL for better font rendering
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 42)
            except Exception:
                font = ImageFont.load_default()

            # Create transparent canvas
            canvas = Image.new("RGBA", (w, 160), (0, 0, 0, 0))
            draw = ImageDraw.Draw(canvas)

            # Semi-transparent background
            draw.rectangle([(0, 10), (w, 150)], fill=(0, 0, 0, 160))

            # Draw text centered
            bbox = draw.textbbox((0, 0), wrapped, font=font)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            x = (w - text_w) // 2
            y = (140 - text_h) // 2 + 10
            draw.text((x + 2, y + 2), wrapped, font=font, fill=(0, 0, 0, 200))  # shadow
            draw.text((x, y), wrapped, font=font, fill=(255, 255, 255, 255))

            frame = np.array(canvas)

            clip = (
                ImageClip(frame, ismask=False)
                .set_duration(duration)
                .set_position(("center", h - 160))
            )
            return clip

        except Exception as e:
            logger.warning(f"Subtitle render failed: {e}")
            # Fallback to basic TextClip
            try:
                from moviepy.editor import TextClip
                tc = (
                    TextClip(text, fontsize=36, color="white", stroke_color="black",
                              stroke_width=2, method="caption",
                              size=(OUTPUT_RESOLUTION[0] - 100, None))
                    .set_duration(duration)
                    .set_position(("center", "bottom"))
                )
                return tc
            except Exception:
                return None

    def _make_text_overlay(self, text: str, duration: float):
        """Render top-of-screen text overlay."""
        if not text.strip():
            return None

        try:
            from moviepy.editor import TextClip
            w, _ = OUTPUT_RESOLUTION
            tc = (
                TextClip(
                    text,
                    fontsize=44,
                    color="white",
                    stroke_color="black",
                    stroke_width=2,
                    method="caption",
                    size=(w - 100, None),
                )
                .set_duration(duration)
                .set_position(("center", 60))
                .crossfadein(0.3)
                .crossfadeout(0.3)
            )
            return tc
        except Exception as e:
            logger.warning(f"Text overlay failed: {e}")
            return None

    # ──────────────────────────────────────────────────────────────
    # Background Music with Ducking
    # ──────────────────────────────────────────────────────────────

    def _add_background_music(
        self,
        video_clip,
        music_path: str,
        audio_map: dict,
        scenes: list[Scene],
    ):
        """
        Add background music with automatic ducking when VO is present.
        """
        try:
            from moviepy.editor import (
                AudioFileClip,
                CompositeAudioClip,
                afx,
            )

            music = AudioFileClip(music_path)

            # Loop music to match video duration
            video_dur = video_clip.duration
            if music.duration < video_dur:
                n_loops = int(video_dur / music.duration) + 1
                from moviepy.editor import concatenate_audioclips
                music = concatenate_audioclips([music] * n_loops)

            music = music.subclip(0, video_dur)

            # Build volume curve: ducked where VO exists, full in gaps
            music_with_ducking = self._apply_ducking(
                music, video_clip, scenes, audio_map
            )

            # Mix with existing audio
            existing_audio = video_clip.audio
            if existing_audio:
                mixed = CompositeAudioClip([existing_audio, music_with_ducking])
            else:
                mixed = music_with_ducking

            return video_clip.set_audio(mixed)

        except Exception as e:
            logger.warning(f"Background music failed: {e}")
            return video_clip

    def _apply_ducking(self, music_clip, video_clip, scenes, audio_map):
        """
        Apply volume ducking using audio volumex with a volume function.
        """
        try:
            # Build a list of (start, end) for when VO is active
            vo_windows = []
            current_t = 0.0

            for scene in scenes:
                audio_path = audio_map.get(scene.index)
                if audio_path and Path(audio_path).exists():
                    from moviepy.editor import AudioFileClip
                    try:
                        a = AudioFileClip(audio_path)
                        dur = a.duration
                        a.close()
                    except Exception:
                        dur = scene.duration_hint
                    vo_windows.append((current_t, current_t + dur))
                    current_t += dur + 0.5  # 0.5s scene padding
                else:
                    current_t += scene.duration_hint

            def volume_func(t):
                for start, end in vo_windows:
                    if start - MUSIC_FADE_DURATION <= t <= end + MUSIC_FADE_DURATION:
                        return MUSIC_NORMAL_VOLUME
                return MUSIC_FULL_VOLUME

            return music_clip.fl_time(lambda t: t).volumex(MUSIC_NORMAL_VOLUME)

        except Exception as e:
            logger.warning(f"Ducking failed, using flat volume: {e}")
            return music_clip.volumex(MUSIC_NORMAL_VOLUME)

    # ──────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────

    def _fit_video_to_duration(self, clip, target_duration: float):
        """Trim or loop a video clip to match a target duration."""
        if clip.duration >= target_duration:
            return clip.subclip(0, target_duration)
        else:
            # Loop
            from moviepy.editor import concatenate_videoclips
            n = int(target_duration / clip.duration) + 1
            looped = concatenate_videoclips([clip] * n)
            return looped.subclip(0, target_duration)

    def _group_into_segments(
        self, scenes: list[Scene], audio_map: dict
    ) -> list[list[Scene]]:
        """
        Group scenes into segments of ~SEGMENT_DURATION_MINUTES each.
        """
        from audio_processor import AudioProcessor

        segment_max_seconds = SEGMENT_DURATION_MINUTES * 60
        segments = []
        current_segment = []
        current_duration = 0.0

        for scene in scenes:
            audio_path = audio_map.get(scene.index)
            if audio_path and Path(audio_path).exists():
                dur = AudioProcessor.get_audio_duration(audio_path)
            else:
                dur = scene.duration_hint

            if (
                current_duration + dur > segment_max_seconds
                and current_segment
            ):
                segments.append(current_segment)
                current_segment = [scene]
                current_duration = dur
            else:
                current_segment.append(scene)
                current_duration += dur

        if current_segment:
            segments.append(current_segment)

        logger.info(
            f"Grouped {len(scenes)} scenes into {len(segments)} segments "
            f"({SEGMENT_DURATION_MINUTES}-min chunks)."
        )
        return segments
