"""
JARVIS STT + Wake Word
"""

import asyncio
import queue
import threading
import time
from typing import Optional

import numpy as np
from loguru import logger

from core.config import Config


# ---------------------------------------------------------------------------
# Wspolny strumien mikrofonu
# ---------------------------------------------------------------------------
class MicrophoneStream:
    SAMPLE_RATE = 16000
    CHUNK_SIZE  = 1280   # 80ms

    def __init__(self):
        self._subscribers: list = []
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def subscribe(self) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=400)
        with self._lock:
            self._subscribers.append(q)
        return q

    def unsubscribe(self, q: queue.Queue):
        with self._lock:
            if q in self._subscribers:
                self._subscribers.remove(q)

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False

    def _run(self):
        try:
            import sounddevice as sd

            def callback(indata, frames, time_info, status):
                chunk = indata[:, 0].astype(np.float32).copy()
                with self._lock:
                    for q in self._subscribers:
                        try:
                            q.put_nowait(chunk)
                        except queue.Full:
                            try:
                                q.get_nowait()
                                q.put_nowait(chunk)
                            except Exception:
                                pass

            with sd.InputStream(
                samplerate=self.SAMPLE_RATE,
                channels=1,
                dtype=np.float32,
                blocksize=self.CHUNK_SIZE,
                callback=callback,
            ):
                logger.info("Mikrofon uruchomiony")
                while self._running:
                    time.sleep(0.05)
        except Exception as e:
            logger.error(f"Blad mikrofonu: {e}")


_mic = MicrophoneStream()


# ---------------------------------------------------------------------------
# Wake Word Detector
# ---------------------------------------------------------------------------
class WakeWordDetector:
    MODEL_MAP = {
        "jarvis":      "hey_jarvis",
        "hey jarvis":  "hey_jarvis",
        "alexa":       "alexa",
        "computer":    "computer",
        "hey mycroft": "hey_mycroft",
        "mycroft":     "hey_mycroft",
    }

    def __init__(self, config: Config):
        self.config = config
        self._model = None
        self._enabled = False
        self._queue: Optional[queue.Queue] = None
        self._threshold = getattr(config, "wake_word_threshold", 0.5)
        self._detected = threading.Event()
        self._stop_event = threading.Event()
        self._worker: Optional[threading.Thread] = None

    async def initialize(self):
        try:
            import openwakeword
            from openwakeword.model import Model

            key = self.config.wake_word.lower().strip()
            model_name = self.MODEL_MAP.get(key, "hey_jarvis")
            logger.info(f"Ladowanie wake word: {model_name}")

            loop = asyncio.get_event_loop()
            def _load():
                openwakeword.utils.download_models()
                return Model(wakeword_models=[model_name], inference_framework="onnx")

            self._model = await loop.run_in_executor(None, _load)
            self._enabled = True
            logger.info(f"[OK] Wake word '{self.config.wake_word}' (prog: {self._threshold})")

        except ImportError:
            logger.warning("openwakeword nie zainstalowany - tryb always-on")
        except Exception as e:
            logger.warning(f"Wake word blad init: {str(e)[:80]} - tryb always-on")

    def start(self):
        if not self._enabled:
            return
        if self._worker and self._worker.is_alive():
            return
        self._queue = _mic.subscribe()
        self._stop_event.clear()
        self._detected.clear()
        self._worker = threading.Thread(target=self._loop, daemon=True)
        self._worker.start()
        logger.info("Wake word detector uruchomiony")

    def stop(self):
        self._stop_event.set()
        self._detected.set()  # odblokuj wait_for_activation jesli czeka
        if self._queue:
            _mic.unsubscribe(self._queue)
            self._queue = None

    def _loop(self):
        logger.info("Wake word listener aktywny - mow 'hey jarvis'")
        while not self._stop_event.is_set():
            if self._queue is None:
                time.sleep(0.05)
                continue
            try:
                chunk = self._queue.get(timeout=0.3)
                pcm = (chunk * 32767).astype(np.int16)
                prediction = self._model.predict(pcm)
                for score in prediction.values():
                    if score >= self._threshold:
                        logger.info(f"Wake word wykryty (score: {score:.3f})")
                        self._detected.set()
                        # Poczekaj az zostanie skonsumowany
                        time.sleep(1.5)
                        self._detected.clear()
                        break
            except queue.Empty:
                pass
            except Exception as e:
                logger.error(f"Wake word loop blad: {str(e)[:60]}")
                time.sleep(0.1)

    async def wait_for_activation(self) -> bool:
        """
        Czekaj na wake word. Sprawdza event co 50ms.
        Zwraca True=wykryto, False=zatrzymano.
        """
        if not self._enabled:
            return True  # always-on

        self._detected.clear()

        while not self._stop_event.is_set():
            if self._detected.is_set():
                return True
            await asyncio.sleep(0.05)

        return False  # zatrzymano

    @property
    def is_enabled(self) -> bool:
        return self._enabled


# ---------------------------------------------------------------------------
# STT Engine
# ---------------------------------------------------------------------------
class SpeechToTextEngine:
    SAMPLE_RATE    = 16000
    SILENCE_THRESH = 0.012
    MIN_SPEECH_SEC = 0.4
    MAX_SPEECH_SEC = 15.0
    SILENCE_SEC    = 1.2

    def __init__(self, config: Config):
        self.config = config
        self._model = None
        self._queue: Optional[queue.Queue] = None

    async def initialize(self):
        logger.info(f"Ladowanie Whisper: {self.config.stt_model}")
        loop = asyncio.get_event_loop()

        def _load():
            from faster_whisper import WhisperModel
            return WhisperModel(
                self.config.stt_model,
                device=self.config.stt_device,
                compute_type="int8",
            )

        self._model = await loop.run_in_executor(None, _load)
        logger.info("[OK] Whisper zaladowany")

    def start_capture(self):
        if self._queue is None:
            self._queue = _mic.subscribe()

    def stop_capture(self):
        if self._queue:
            _mic.unsubscribe(self._queue)
            self._queue = None

    async def record_and_transcribe(self) -> Optional[str]:
        if not self._model or not self._queue:
            return None

        # Wyczysc bufor ze starych danych
        drained = 0
        while not self._queue.empty() and drained < 50:
            try:
                self._queue.get_nowait()
                drained += 1
            except queue.Empty:
                break

        chunk_dur      = MicrophoneStream.CHUNK_SIZE / MicrophoneStream.SAMPLE_RATE
        silence_limit  = int(self.SILENCE_SEC    / chunk_dur)
        min_speech     = int(self.MIN_SPEECH_SEC / chunk_dur)
        max_chunks     = int(self.MAX_SPEECH_SEC / chunk_dur)

        audio_chunks = []
        silence_cnt  = 0
        speech_cnt   = 0
        loop         = asyncio.get_event_loop()

        logger.info("Nagrywanie komendy...")

        while len(audio_chunks) < max_chunks:
            try:
                chunk = await loop.run_in_executor(
                    None, lambda: self._queue.get(timeout=1.0)
                )
            except queue.Empty:
                if speech_cnt >= min_speech:
                    break
                continue

            audio_chunks.append(chunk)
            rms = float(np.sqrt(np.mean(chunk ** 2)))

            if rms > self.SILENCE_THRESH:
                speech_cnt += 1
                silence_cnt = 0
            elif speech_cnt > 0:
                silence_cnt += 1

            if speech_cnt >= min_speech and silence_cnt >= silence_limit:
                break

        if speech_cnt < min_speech:
            logger.info("Za malo mowy - pomijam")
            return None

        audio = np.concatenate(audio_chunks)
        dur = len(audio) / self.SAMPLE_RATE
        logger.info(f"Transkrypcja {dur:.1f}s audio...")

        def _transcribe():
            segs, _ = self._model.transcribe(
                audio,
                language=self.config.stt_language,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 300},
                beam_size=3,
            )
            return " ".join(s.text for s in segs).strip()

        text = await loop.run_in_executor(None, _transcribe)
        logger.info(f"Rozpoznano: '{text}'")
        return text if text else None

    async def shutdown(self):
        self.stop_capture()
