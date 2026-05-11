"""
Groq Pipeline — The Brain
Handles: script → chapters → scenes with metadata
"""

import json
import logging
import re
from typing import Any

from groq import Groq

from config import (
    SCENE_DURATION_SECONDS,
    DurationMode,
    EngineConfig,
    VideoStyle,
)

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────────────────

class Scene:
    def __init__(self, data: dict):
        self.index: int = data.get("index", 0)
        self.chapter_index: int = data.get("chapter_index", 0)
        self.chapter_title: str = data.get("chapter_title", "")
        self.narration: str = data.get("narration", "")
        self.subtitle: str = data.get("subtitle", "")
        self.visual_keywords: list[str] = data.get("visual_keywords", [])
        self.on_screen_text: str = data.get("on_screen_text", "")
        self.duration_hint: float = data.get("duration_hint", SCENE_DURATION_SECONDS)
        self.mood: str = data.get("mood", "neutral")

    def __repr__(self):
        return (
            f"Scene(idx={self.index}, chapter='{self.chapter_title}', "
            f"keywords={self.visual_keywords})"
        )


class Chapter:
    def __init__(self, index: int, title: str, summary: str, scenes: list[Scene]):
        self.index = index
        self.title = title
        self.summary = summary
        self.scenes = scenes

    def __repr__(self):
        return f"Chapter({self.index}: '{self.title}', {len(self.scenes)} scenes)"


# ──────────────────────────────────────────────────────────────────
# Prompt Templates
# ──────────────────────────────────────────────────────────────────

SHORT_FORM_PROMPT = """You are a video script analyzer for {style} style videos.

Break this script into individual scenes of ~{scene_duration} seconds each.
The total video is ~60 seconds, so aim for 5-7 scenes.

For EACH scene, return a JSON object with:
{{
  "index": <int>,
  "chapter_index": 0,
  "chapter_title": "Main",
  "narration": "<exact narration text for this scene>",
  "subtitle": "<concise subtitle, max 10 words>",
  "visual_keywords": ["<keyword1>", "<keyword2>", "<keyword3>"],
  "on_screen_text": "<impactful text overlay, or empty string>",
  "duration_hint": <estimated seconds as float>,
  "mood": "<mood: energetic|calm|dramatic|inspirational|neutral>"
}}

Return a JSON array of scene objects.
Visual keywords should be specific and visual (e.g., "city skyline sunset", NOT "success").
Style context: {style_context}

SCRIPT:
{script}

Return ONLY valid JSON array. No markdown, no commentary."""


LONG_FORM_CHAPTER_PROMPT = """You are a video content architect for {style} style long-form videos.

Analyze this script and divide it into logical CHAPTERS.
Each chapter should cover one major topic/segment.
Aim for chapters that each have ~2-4 minutes of content.

Return a JSON array where each element is:
{{
  "index": <int>,
  "title": "<chapter title>",
  "summary": "<one sentence summary>",
  "script_excerpt": "<the portion of the script that belongs to this chapter>"
}}

Style: {style}
SCRIPT:
{script}

Return ONLY valid JSON array."""


LONG_FORM_SCENE_PROMPT = """You are a video scene director for {style} style content.

Break this CHAPTER script into ~{scene_duration}-second scenes.

Chapter: "{chapter_title}" (Chapter {chapter_index})

For EACH scene return:
{{
  "index": <int — global scene index starting at {global_scene_offset}>,
  "chapter_index": {chapter_index},
  "chapter_title": "{chapter_title}",
  "narration": "<exact narration text>",
  "subtitle": "<concise subtitle, max 10 words>",
  "visual_keywords": ["<keyword1>", "<keyword2>", "<keyword3>"],
  "on_screen_text": "<text overlay or empty string>",
  "duration_hint": <estimated seconds as float>,
  "mood": "<energetic|calm|dramatic|inspirational|neutral>"
}}

Style context: {style_context}
CHAPTER SCRIPT:
{chapter_script}

Return ONLY valid JSON array."""


# ──────────────────────────────────────────────────────────────────
# Helper: style context strings
# ──────────────────────────────────────────────────────────────────

STYLE_CONTEXT = {
    VideoStyle.PROFESSIONAL: (
        "Use clean, corporate visuals. Keywords should suggest modern offices, "
        "data, technology, handshakes, charts."
    ),
    VideoStyle.DOCUMENTARY: (
        "Use cinematic, wide-angle visuals. Keywords should suggest landscapes, "
        "people in natural settings, historical imagery, dramatic lighting."
    ),
    VideoStyle.FAST_PACED: (
        "Use dynamic, high-energy visuals. Keywords should suggest action, "
        "sports, urban energy, colorful abstract, quick cuts."
    ),
    VideoStyle.STORYTELLING: (
        "Use warm, human visuals. Keywords should suggest people, emotions, "
        "everyday life, nature, close-up faces, community."
    ),
}


# ──────────────────────────────────────────────────────────────────
# Core Groq Client
# ──────────────────────────────────────────────────────────────────

class GroqPipeline:
    """Handles all LLM interactions via Groq."""

    def __init__(self, config: EngineConfig):
        self.client = Groq(api_key=config.groq_api_key)
        self.config = config
        self.model = "llama3-70b-8192"   # best available on Groq

    def _call(self, prompt: str, max_tokens: int = 4096) -> str:
        """Raw Groq completion call with retry logic."""
        for attempt in range(3):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=max_tokens,
                    temperature=0.4,
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                logger.warning(f"Groq attempt {attempt + 1} failed: {e}")
                if attempt == 2:
                    raise
        return ""

    def _parse_json(self, raw: str) -> Any:
        """Robustly parse JSON from LLM output."""
        # Strip markdown fences if present
        raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # Try to find first [ ... ] block
            match = re.search(r"\[.*\]", raw, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            raise ValueError(f"Cannot parse JSON from Groq response:\n{raw[:500]}")

    # ── Public Methods ──────────────────────────────────────────

    def process_script(self) -> tuple[list[Chapter], list[Scene]]:
        """
        Main entry: processes config.script into chapters + scenes.
        Returns (chapters, all_scenes).
        """
        cfg = self.config

        if cfg.duration_mode == DurationMode.SHORT:
            logger.info("Short-form mode: generating scenes directly.")
            scenes = self._generate_short_scenes()
            chapter = Chapter(0, "Main", "Full video", scenes)
            return [chapter], scenes

        else:
            logger.info("Long-form mode: generating chapters first.")
            chapters = self._generate_chapters()
            all_scenes: list[Scene] = []
            scene_offset = 0

            for ch in chapters:
                logger.info(f"  Processing {ch}...")
                scenes = self._generate_chapter_scenes(ch, scene_offset)
                ch.scenes = scenes
                all_scenes.extend(scenes)
                scene_offset += len(scenes)

            return chapters, all_scenes

    def _generate_short_scenes(self) -> list[Scene]:
        style_ctx = STYLE_CONTEXT.get(self.config.style, "")
        prompt = SHORT_FORM_PROMPT.format(
            style=self.config.style.value,
            scene_duration=SCENE_DURATION_SECONDS,
            style_context=style_ctx,
            script=self.config.script,
        )
        raw = self._call(prompt, max_tokens=3000)
        data = self._parse_json(raw)
        scenes = [Scene(item) for item in data]
        logger.info(f"Generated {len(scenes)} short-form scenes.")
        return scenes

    def _generate_chapters(self) -> list[Chapter]:
        prompt = LONG_FORM_CHAPTER_PROMPT.format(
            style=self.config.style.value,
            script=self.config.script,
        )
        raw = self._call(prompt, max_tokens=4096)
        data = self._parse_json(raw)
        chapters = [
            Chapter(
                index=item["index"],
                title=item["title"],
                summary=item["summary"],
                scenes=[],  # filled later
            )
            for item in data
        ]
        # Attach script excerpts
        for i, item in enumerate(data):
            chapters[i]._script_excerpt = item.get("script_excerpt", "")

        logger.info(f"Generated {len(chapters)} chapters.")
        return chapters

    def _generate_chapter_scenes(
        self, chapter: Chapter, global_scene_offset: int
    ) -> list[Scene]:
        style_ctx = STYLE_CONTEXT.get(self.config.style, "")
        script_text = getattr(chapter, "_script_excerpt", self.config.script)

        prompt = LONG_FORM_SCENE_PROMPT.format(
            style=self.config.style.value,
            scene_duration=SCENE_DURATION_SECONDS,
            chapter_title=chapter.title,
            chapter_index=chapter.index,
            global_scene_offset=global_scene_offset,
            style_context=style_ctx,
            chapter_script=script_text,
        )
        raw = self._call(prompt, max_tokens=4096)
        data = self._parse_json(raw)
        scenes = [Scene(item) for item in data]
        logger.info(
            f"  Chapter '{chapter.title}': {len(scenes)} scenes generated."
        )
        return scenes
