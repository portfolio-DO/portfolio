"""
JARVIS Task Planner
Backendy AI:
  1. Ollama  - lokalny, offline, zero limitow
  2. Groq    - szybki, darmowy cloud (przez oficjalna biblioteke groq)
  3. Gemini  - Google, ograniczony darmowy tier
"""

import asyncio
import json
import urllib.request
import urllib.error
from typing import Optional

from loguru import logger

from core.config import Config
from core.memory import ConversationMemory


SYSTEM_PROMPT = """You are JARVIS, an AI desktop assistant controlling a Windows PC.
Respond ONLY with valid JSON - no markdown, no backticks, no explanation.

AVAILABLE ACTIONS:
- open_app: {"action": "open_app", "app_name": "discord|chrome|steam|spotify|notepad|vlc|..."}
- search_web: {"action": "search_web", "query": "...", "engine": "google"}
- browser_navigate: {"action": "browser_navigate", "url": "https://..."}
- play_youtube: {"action": "play_youtube", "query": "..."}
- steam_launch: {"action": "steam_launch", "game": "game name"}
- set_volume: {"action": "set_volume", "level": 0-100}
- create_folder: {"action": "create_folder", "path": "Desktop/folder_name"}
- take_screenshot: {"action": "take_screenshot"}
- get_weather: {"action": "get_weather", "location": "city"}
- get_time: {"action": "get_time", "timezone": "City"}
- respond_only: {"action": "respond_only", "message": "reply text"}

RESPONSE FORMAT - valid JSON only, nothing else:
{
  "intent": "what user wants",
  "steps": [{"action": "...", "key": "value"}],
  "requires_confirmation": false,
  "confirmation_prompt": "",
  "summary": "what will happen",
  "response_template": "what to say when done"
}"""


def _error_plan(msg: str) -> dict:
    return {
        "intent": "error",
        "steps": [{"action": "respond_only", "message": msg}],
        "requires_confirmation": False,
        "response_template": msg,
    }


def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    for fence in ["```json", "```"]:
        if raw.startswith(fence):
            raw = raw[len(fence):]
    raw = raw.rstrip("`").strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start:end+1]
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Ollama (lokalny)
# ---------------------------------------------------------------------------
class OllamaBackend:
    def __init__(self, host: str, model: str):
        self.host = host
        self.model = model
        self.name = f"Ollama ({model})"

    def check(self) -> bool:
        try:
            req = urllib.request.Request(f"{self.host}/api/tags")
            with urllib.request.urlopen(req, timeout=3) as r:
                data = json.loads(r.read())
            models = [m["name"].split(":")[0] for m in data.get("models", [])]
            if not models:
                logger.warning("Ollama: brak modeli. Uruchom: ollama pull llama3.2")
                return False
            preferred = self.model.split(":")[0]
            if preferred not in models:
                self.model = models[0]
                self.name = f"Ollama ({self.model})"
            return True
        except Exception:
            return False

    def call(self, prompt: str, history: list) -> str:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for m in history:
            messages.append({"role": m["role"], "content": m["content"]})
        messages.append({"role": "user", "content": prompt})

        payload = json.dumps({
            "model": self.model,
            "messages": messages,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.1, "num_predict": 800},
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{self.host}/api/chat", data=payload,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read())
        return data["message"]["content"]


# ---------------------------------------------------------------------------
# Groq (przez httpx - omija problemy z wersjami biblioteki groq)
# ---------------------------------------------------------------------------
class GroqBackend:
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self.name = f"Groq ({model})"

    def check(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 10)

    def call(self, prompt: str, history: list) -> str:
        import httpx

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for m in history:
            messages.append({"role": m["role"], "content": m["content"]})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.1,
            "max_tokens": 800,
            "response_format": {"type": "json_object"},
        }

        with httpx.Client(timeout=30) as client:
            resp = client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
            )

        if resp.status_code != 200:
            raise Exception(f"Groq HTTP {resp.status_code}: {resp.text[:150]}")

        data = resp.json()
        return data["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# Gemini (REST API)
# ---------------------------------------------------------------------------
class GeminiBackend:
    MODELS = [
        "gemini-2.0-flash-lite", "gemini-2.0-flash",
        "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro",
    ]

    def __init__(self, api_key: str, preferred_model: str):
        self.api_key = api_key
        self.preferred = preferred_model
        self.model: Optional[str] = None
        self.name = "Gemini"

    def check(self) -> bool:
        return bool(
            self.api_key
            and len(self.api_key) > 10
            and not self.api_key.startswith("AIza-twoj")
        )

    def find_model(self) -> bool:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={self.api_key}&pageSize=50"
            with urllib.request.urlopen(url, timeout=10) as r:
                data = json.loads(r.read())
            available = [
                m["name"].replace("models/", "")
                for m in data.get("models", [])
                if "gemini" in m.get("name", "")
                and "generateContent" in m.get("supportedGenerationMethods", [])
            ]
            for pref in [self.preferred] + self.MODELS:
                for a in available:
                    if pref in a:
                        self.model = a
                        self.name = f"Gemini ({a})"
                        return True
        except Exception as e:
            logger.warning(f"Gemini list models: {str(e)[:60]}")
        return False

    def call(self, prompt: str, history: list) -> str:
        contents = []
        for m in history:
            role = "model" if m["role"] == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": m["content"]}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        payload = json.dumps({
            "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": contents,
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 800,
                "responseMimeType": "application/json",
            },
        }).encode("utf-8")

        url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
               f"{self.model}:generateContent?key={self.api_key}")
        req = urllib.request.Request(
            url, data=payload,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.loads(r.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            raise Exception(f"HTTP {e.code}: {body[:200]}")

        return data["candidates"][0]["content"]["parts"][0]["text"]


# ---------------------------------------------------------------------------
# TaskPlanner
# ---------------------------------------------------------------------------
class TaskPlanner:
    def __init__(self, config: Config, memory: ConversationMemory):
        self.config = config
        self.memory = memory
        self._backend = None
        self._automation = None

    async def initialize(self):
        loop = asyncio.get_event_loop()

        # 1. Ollama
        ollama = OllamaBackend(self.config.ollama_host, self.config.ollama_model)
        if await loop.run_in_executor(None, ollama.check):
            self._backend = ollama
            logger.info(f"[OK] Backend AI: {ollama.name} (lokalny)")

        # 2. Groq
        if not self._backend:
            groq = GroqBackend(self.config.groq_api_key, self.config.groq_model)
            if await loop.run_in_executor(None, groq.check):
                # Test rzeczywistego wywolania
                try:
                    await loop.run_in_executor(None, lambda: groq.call("say hi in one word", []))
                    self._backend = groq
                    logger.info(f"[OK] Backend AI: {groq.name}")
                except Exception as e:
                    safe = str(e).replace("{","(").replace("}",")")[:120]
                    logger.warning(f"Groq blad testu: {safe}")

        # 3. Gemini
        if not self._backend:
            gemini = GeminiBackend(self.config.google_api_key, self.config.gemini_model)
            if gemini.check():
                found = await loop.run_in_executor(None, gemini.find_model)
                if found:
                    self._backend = gemini
                    logger.info(f"[OK] Backend AI: {gemini.name}")

        if not self._backend:
            raise RuntimeError(
                "Brak backendu AI!\n\n"
                "OPCJA 1 - Ollama (offline, zero limitow):\n"
                "  https://ollama.com/download\n"
                "  ollama pull llama3.2\n\n"
                "OPCJA 2 - Groq (darmowy cloud):\n"
                "  pip install groq\n"
                "  https://console.groq.com -> wygeneruj klucz\n"
                "  Dodaj do .env: GROQ_API_KEY=gsk_...\n\n"
                "OPCJA 3 - Gemini:\n"
                "  https://aistudio.google.com/app/apikey\n"
                "  Dodaj do .env: GOOGLE_API_KEY=AIza..."
            )

        # Inicjalizuj automatyzacje
        from automation.executor import AutomationExecutor
        self._automation = AutomationExecutor(self.config)
        await self._automation.initialize()
        logger.info("Automatyzacja gotowa")

    async def plan(self, text: str) -> dict:
        if not self._backend:
            return _error_plan("Backend AI nie jest zainicjalizowany.")

        history = self._build_history()
        loop = asyncio.get_event_loop()

        for attempt in range(3):
            try:
                raw = await loop.run_in_executor(
                    None, lambda: self._backend.call(text, history)
                )
                break
            except Exception as e:
                err = str(e)
                is_rate = any(x in err for x in ["429", "quota", "rate_limit", "RESOURCE_EXHAUSTED", "Too Many"])
                if is_rate and attempt < 2:
                    wait = 15 * (attempt + 1)
                    logger.warning(f"Rate limit, czekam {wait}s...")
                    await asyncio.sleep(wait)
                else:
                    safe = err.replace("{","(").replace("}",")")[:120]
                    logger.error(f"Blad AI ({attempt+1}/3): {safe}")
                    if attempt == 2:
                        return _error_plan("Blad komunikacji z AI.")
        else:
            return _error_plan("Nie udalo sie polaczyc z AI.")

        try:
            plan = _parse_json(raw)
        except Exception:
            logger.warning(f"Niepoprawny JSON od AI: {raw[:80]}")
            plan = {
                "intent": text,
                "steps": [{"action": "respond_only", "message": raw[:200]}],
                "requires_confirmation": False,
                "response_template": raw[:200],
            }

        self.memory.add_user(text)
        self.memory.add_assistant(json.dumps(plan, ensure_ascii=False)[:400])
        return plan

    def _build_history(self) -> list:
        return [
            {"role": "assistant" if m["role"] == "assistant" else "user",
             "content": m["content"]}
            for m in self.memory.get_messages()
        ]

    async def execute(self, plan: dict) -> dict:
        if not self._automation:
            return {"response": "Automatyzacja nie jest gotowa.", "steps": [], "success": False}

        steps = plan.get("steps", [])
        parts = []
        results = []

        for i, step in enumerate(steps):
            action = step.get("action", "?")
            logger.info(f"Krok {i+1}/{len(steps)}: {action}")
            try:
                result = await self._automation.execute_step(step)
                results.append({"step": action, "success": True})
                if result.get("text"):
                    parts.append(result["text"])
                if i < len(steps) - 1:
                    await asyncio.sleep(0.3)
            except Exception as e:
                safe = str(e).replace("{","(").replace("}",")")[:80]
                logger.error(f"Krok '{action}' blad: {safe}")
                results.append({"step": action, "success": False})
                parts.append(f"Nie udalo sie: {action}")
                break

        return {
            "response": " ".join(parts) or plan.get("response_template", "Gotowe."),
            "steps": results,
            "success": all(r["success"] for r in results),
        }

    async def cancel_all(self):
        if self._automation:
            await self._automation.cancel()
