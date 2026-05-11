"""
JARVIS Backend - WebSocket server
"""

import asyncio
import json
import signal
import sys
from pathlib import Path

import websockets
from loguru import logger

sys.path.insert(0, str(Path(__file__).parent))

from core.assistant import JarvisAssistant
from core.config import Config
from utils.logger import setup_logger

config = Config()
assistant = JarvisAssistant(config)
connected_clients: set = set()


async def broadcast(message: dict):
    if not connected_clients:
        return
    data = json.dumps(message)
    dead = set()
    for client in connected_clients:
        try:
            await client.send(data)
        except Exception:
            dead.add(client)
    connected_clients.difference_update(dead)


def make_broadcaster(msg_factory):
    """Tworzy callback ktory broadcastuje wiadomosc."""
    def cb(*args):
        msg = msg_factory(*args)
        asyncio.create_task(broadcast(msg))
    return cb


async def handle_client(websocket):
    connected_clients.add(websocket)
    logger.info(f"Electron polaczony ({len(connected_clients)} klientow)")

    # Podepnij eventy tylko raz (przy pierwszym kliencie)
    if len(connected_clients) == 1:
        assistant.on_status_change     = make_broadcaster(lambda s: {"type": "status", "value": s})
        assistant.on_transcript        = make_broadcaster(lambda t, f: {"type": "transcript", "text": t, "final": f})
        assistant.on_response          = make_broadcaster(lambda r: {"type": "response", "text": r})
        assistant.on_command_log       = make_broadcaster(lambda c: {"type": "command_log", "command": c})
        assistant.on_confirmation_request = make_broadcaster(lambda r: {"type": "confirmation_request", "request": r})
        assistant.on_show_window       = make_broadcaster(lambda: {"type": "show_window"})

    # Wyslij aktualny status od razu
    await broadcast({"type": "status", "value": "idle"})

    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
                await handle_message(msg)
            except json.JSONDecodeError:
                pass
            except Exception as e:
                safe = str(e).replace("{","(").replace("}",")")
                logger.error(f"Blad obslugi wiadomosci: {safe[:100]}")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        logger.info(f"Electron rozlaczony ({len(connected_clients)} klientow)")


async def handle_message(message: dict):
    t = message.get("type")

    if t == "start_listening":
        await assistant.start_listening()

    elif t == "stop_listening":
        await assistant.stop_listening()

    elif t == "text_command":
        text = message.get("text", "").strip()
        if text:
            # Emituj transkrypt natychmiast
            await broadcast({"type": "transcript", "text": text, "final": True})
            # Uruchom komende jako task (nie blokuj WebSocket handlera)
            asyncio.create_task(assistant.process_command(text))

    elif t == "confirmation_response":
        await assistant.handle_confirmation(
            message.get("request_id"), message.get("approved", False)
        )

    elif t == "emergency_stop":
        asyncio.create_task(assistant.emergency_stop())

    elif t == "update_settings":
        config.update(message.get("settings", {}))
        await broadcast({"type": "settings_updated", "settings": config.to_dict()})

    elif t == "get_settings":
        await broadcast({"type": "settings", "settings": config.to_dict()})

    elif t == "get_history":
        await broadcast({"type": "history", "history": assistant.get_command_history()})


async def main():
    setup_logger(config.log_level, config.log_file)
    logger.info("JARVIS Backend startuje...")

    try:
        await assistant.initialize()
    except RuntimeError as e:
        logger.error(f"Blad inicjalizacji: {e}")
        # Nie wychodzi - startuje WebSocket zeby UI sie podlaczyl i pokazal blad
    else:
        # Auto-start nasluchiwania
        await assistant.start_listening()
        logger.info("[OK] Nasluchiwanie aktywne")

    stop_event = asyncio.Event()

    def shutdown(*args):
        logger.info("Zamykanie...")
        stop_event.set()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    logger.info(f"WebSocket na ws://{config.backend_host}:{config.websocket_port}")

    async with websockets.serve(
        handle_client,
        config.backend_host,
        config.websocket_port,
        ping_interval=20,
        ping_timeout=10,
    ):
        await stop_event.wait()

    logger.info("Zamykanie asystenta...")
    await assistant.shutdown()
    logger.info("Do widzenia.")


if __name__ == "__main__":
    asyncio.run(main())
