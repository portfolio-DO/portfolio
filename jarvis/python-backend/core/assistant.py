"""
JARVIS Assistant - Glowny Orkiestrator
"""

import asyncio
import uuid
from typing import Callable, Optional

from loguru import logger

from core.config import Config
from core.memory import ConversationMemory
from core.task_planner import TaskPlanner
from stt.stt_engine import SpeechToTextEngine, WakeWordDetector, _mic
from tts.tts_engine import TextToSpeechEngine
from utils.logger import CommandLogger
from utils.safety import SafetyChecker


class JarvisAssistant:
    def __init__(self, config: Config):
        self.config = config
        self.memory = ConversationMemory(max_history=20)
        self.safety = SafetyChecker(config)
        self.command_logger = CommandLogger(config.log_file, config.max_command_history)

        self.on_status_change: Optional[Callable] = None
        self.on_transcript: Optional[Callable] = None
        self.on_response: Optional[Callable] = None
        self.on_command_log: Optional[Callable] = None
        self.on_confirmation_request: Optional[Callable] = None
        self.on_show_window: Optional[Callable] = None

        self._listening = False
        self._executing = False
        self._pending_confirmations: dict = {}
        self._listen_task: Optional[asyncio.Task] = None

        self.stt: Optional[SpeechToTextEngine] = None
        self.wake_word: Optional[WakeWordDetector] = None
        self.tts: Optional[TextToSpeechEngine] = None
        self.task_planner: Optional[TaskPlanner] = None

    async def initialize(self):
        _mic.start()

        logger.info("Inicjalizacja Whisper STT...")
        self.stt = SpeechToTextEngine(self.config)
        await self.stt.initialize()

        logger.info("Inicjalizacja wake word...")
        self.wake_word = WakeWordDetector(self.config)
        await self.wake_word.initialize()

        logger.info("Inicjalizacja TTS...")
        self.tts = TextToSpeechEngine(self.config)
        await self.tts.initialize()

        logger.info("Inicjalizacja planera AI...")
        self.task_planner = TaskPlanner(self.config, self.memory)
        await self.task_planner.initialize()

        logger.info("[OK] JARVIS gotowy!")

    async def start_listening(self):
        if self._listening:
            return
        self._listening = True
        self.stt.start_capture()
        self.wake_word.start()
        self._listen_task = asyncio.create_task(self._listen_loop())
        logger.info("Nasluchiwanie uruchomione")

    async def stop_listening(self):
        self._listening = False
        self.wake_word.stop()
        self.stt.stop_capture()
        if self._listen_task:
            self._listen_task.cancel()
            try:
                await self._listen_task
            except asyncio.CancelledError:
                pass
            self._listen_task = None
        self._set_status("idle")
        logger.info("Nasluchiwanie zatrzymane")

    async def _listen_loop(self):
        try:
            while self._listening:

                # FAZA 1: czekaj na wake word (lub always-on)
                if self.wake_word.is_enabled:
                    self._set_status("idle")
                    detected = await self.wake_word.wait_for_activation()

                    if not self._listening:
                        break
                    if not detected:
                        continue

                    # Pokaz okno
                    if self.on_show_window:
                        self.on_show_window()
                    logger.info("Wake word! Nagrywam komende...")

                # FAZA 2: nagrywaj komende
                self._set_status("listening")

                # Krotki dzwiek potwierdzenia (bez blokowania)
                asyncio.create_task(self._safe_speak_short("Hmm?"))

                try:
                    text = await asyncio.wait_for(
                        self.stt.record_and_transcribe(),
                        timeout=16.0
                    )
                except asyncio.TimeoutError:
                    logger.info("Timeout nagrywania")
                    text = None

                if not self._listening:
                    break

                if not text:
                    # Brak komendy - wróc do czekania
                    if not self.wake_word.is_enabled:
                        await asyncio.sleep(0.2)
                    continue

                # Emituj transkrypt
                self._emit_transcript(text, True)

                # Usun wake word z poczatku
                clean = self._strip_wake_word(text)
                if not clean:
                    continue

                # FAZA 3: przetworz komende
                await self.process_command(clean)

                # Krotka przerwa po komendzie
                await asyncio.sleep(0.3)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            safe = str(e).replace("{","(").replace("}",")")
            logger.error(f"Blad petli: {safe[:150]}")
        finally:
            logger.info("Petla nasluchiwania zakonczona")

    async def _safe_speak_short(self, text: str):
        """Krotki dzwiek potwierdzenia - nie blokuje, ignoruje bledy."""
        try:
            await asyncio.wait_for(self.tts.speak(text), timeout=3.0)
        except Exception:
            pass

    def _strip_wake_word(self, text: str) -> str:
        wake = self.config.wake_word.lower()
        low = text.lower().strip()
        for variant in [f"hey {wake}", wake]:
            if low.startswith(variant):
                return text[len(variant):].strip(" ,.")
        return text.strip()

    async def process_command(self, text: str):
        if self._executing:
            await self.speak("Jeszcze pracuje, chwileczke.")
            return

        logger.info(f"Komenda: '{text}'")
        self._set_status("thinking")
        self._executing = True

        try:
            cmd_entry = self.command_logger.log_command(text)
            self._emit_command_log(cmd_entry)

            if self.config.sandbox_mode:
                await self.speak(f"Tryb sandbox: {text}")
                return

            plan = await self.task_planner.plan(text)

            if self.config.require_confirmation and plan.get("requires_confirmation"):
                approved = await self._request_confirmation(plan)
                if not approved:
                    await self.speak("Anulowano.")
                    return

            self._set_status("executing")
            result = await self.task_planner.execute(plan)

            await self.speak(result.get("response", "Gotowe."))

            self.command_logger.update_result(cmd_entry["id"], result)
            self._emit_command_log({**cmd_entry, "result": result, "status": "completed"})

        except Exception as e:
            safe = str(e).replace("{","(").replace("}",")")
            logger.error(f"Blad komendy: {safe[:150]}")
            try:
                await self.speak("Przepraszam, cos poszlo nie tak.")
            except Exception:
                pass
        finally:
            # ZAWSZE resetuj - bez tego kolejne komendy blokowane
            self._executing = False
            logger.info("Komenda zakonczona - gotowy na nastepna")

    async def speak(self, text: str):
        logger.info(f"[TTS] {text}")
        self._emit_response(text)
        try:
            await asyncio.wait_for(self.tts.speak(text), timeout=30.0)
        except asyncio.TimeoutError:
            logger.warning("TTS timeout")
        except Exception as e:
            logger.error(f"TTS blad: {str(e)[:60]}")

    async def _request_confirmation(self, plan: dict) -> bool:
        request_id = str(uuid.uuid4())
        description = plan.get("confirmation_prompt", "Wykonac ta akcje?")
        event = asyncio.Event()
        self._pending_confirmations[request_id] = event

        if self.on_confirmation_request:
            self.on_confirmation_request({
                "id": request_id,
                "description": description,
                "plan_summary": plan.get("summary", ""),
            })
        await self.speak(f"Potrzebuje potwierdzenia: {description}")

        try:
            await asyncio.wait_for(event.wait(), timeout=30.0)
            return self._pending_confirmations.pop(request_id + "_result", False)
        except asyncio.TimeoutError:
            return False
        finally:
            self._pending_confirmations.pop(request_id, None)

    async def handle_confirmation(self, request_id: str, approved: bool):
        if request_id in self._pending_confirmations:
            self._pending_confirmations[request_id + "_result"] = approved
            self._pending_confirmations[request_id].set()

    async def emergency_stop(self):
        logger.warning("[STOP] EMERGENCY STOP!")
        self._executing = False
        await self.task_planner.cancel_all()
        self._set_status("idle")
        try:
            await self.speak("Stop awaryjny.")
        except Exception:
            pass

    def get_command_history(self) -> list:
        return self.command_logger.get_history()

    async def shutdown(self):
        self._listening = False
        self.wake_word.stop()
        self.stt.stop_capture()
        if self._listen_task:
            self._listen_task.cancel()
        _mic.stop()
        if self.tts:
            await self.tts.shutdown()

    def _set_status(self, status: str):
        if self.on_status_change:
            self.on_status_change(status)

    def _emit_transcript(self, text: str, is_final: bool):
        if self.on_transcript:
            self.on_transcript(text, is_final)

    def _emit_response(self, text: str):
        if self.on_response:
            self.on_response(text)

    def _emit_command_log(self, entry: dict):
        if self.on_command_log:
            self.on_command_log(entry)
