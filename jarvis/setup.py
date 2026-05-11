#!/usr/bin/env python3
"""
JARVIS One-Click Setup Script
"""

import os
import sys
import subprocess
import platform
from pathlib import Path

PLATFORM = platform.system()
ROOT = Path(__file__).parent


def run(cmd, cwd=None, check=True):
    print(f"  ▶ {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    result = subprocess.run(cmd, shell=isinstance(cmd, str), cwd=cwd or ROOT, check=check)
    return result


def header(text):
    print(f"\n{'='*55}")
    print(f"  {text}")
    print(f"{'='*55}")


def check_python():
    header("Sprawdzanie wersji Python")
    version = sys.version_info
    if version < (3, 10):
        print(f"❌ Wymagany Python 3.10+. Masz {version.major}.{version.minor}")
        sys.exit(1)
    print(f"✅ Python {version.major}.{version.minor}.{version.micro}")


def check_node():
    header("Sprawdzanie Node.js")
    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        print(f"✅ Node.js {result.stdout.strip()}")
    except FileNotFoundError:
        print("❌ Node.js nie znaleziony. Zainstaluj z https://nodejs.org")
        sys.exit(1)


def install_python_deps():
    header("Instalacja zależności Python")
    run([sys.executable, "-m", "pip", "install", "--upgrade", "pip"])

    # Instaluj pakiety pojedynczo żeby jeden błąd nie zatrzymał wszystkiego
    packages = [
        "websockets==12.0",
        "aiohttp==3.9.5",
        "aiofiles==23.2.1",
        "google-generativeai==0.7.2",
        "openwakeword==0.6.0",
        "faster-whisper==1.0.3",
        "sounddevice==0.4.7",
        "numpy==1.26.4",
        "pyttsx3==2.90",
        "pygame==2.5.2",
        "pyautogui==0.9.54",
        "pygetwindow==0.0.9",
        "pynput==1.7.7",
        "pillow==10.3.0",
        "playwright==1.44.0",
        "psutil==5.9.8",
        "pydantic==2.7.3",
        "python-dotenv==1.0.1",
        "loguru==0.7.2",
        "requests==2.32.3",
        "beautifulsoup4==4.12.3",
        "lxml==5.2.2",
        "pyyaml==6.0.1",
    ]

    # Windows-specific
    if PLATFORM == "Windows":
        packages += ["pywin32==306", "comtypes==1.4.4", "pycaw==20240210"]

    failed = []
    for pkg in packages:
        try:
            run([sys.executable, "-m", "pip", "install", pkg], check=True)
        except subprocess.CalledProcessError:
            print(f"  ⚠️  Nie udało się zainstalować {pkg} — kontynuuję...")
            failed.append(pkg)

    if failed:
        print(f"\n⚠️  Pominięte pakiety (zainstaluj ręcznie jeśli potrzebne):")
        for p in failed:
            print(f"   pip install {p}")
    else:
        print("✅ Wszystkie zależności Python zainstalowane")


def install_playwright():
    header("Instalacja przeglądarki Playwright (Chromium)")
    try:
        run([sys.executable, "-m", "playwright", "install", "chromium"])
        print("✅ Playwright Chromium zainstalowany")
    except Exception as e:
        print(f"⚠️  Playwright nie zainstalowany: {e}")
        print("   Uruchom ręcznie: python -m playwright install chromium")


def install_node_deps():
    header("Instalacja zależności Node.js")
    npm_cmd = "npm.cmd" if PLATFORM == "Windows" else "npm"
    try:
        run([npm_cmd, "install"], cwd=ROOT / "electron-app")
        print("✅ Zależności Node.js zainstalowane")
    except Exception as e:
        print(f"❌ Błąd npm install: {e}")


def create_env():
    header("Tworzenie pliku .env")
    env_example = ROOT / ".env.example"
    env_file = ROOT / ".env"

    if env_file.exists():
        print("⚠️  Plik .env już istnieje — pomijam")
        return

    import shutil
    shutil.copy(env_example, env_file)
    print("✅ Utworzono .env z szablonu")
    print("  ⚡ WAŻNE: Edytuj .env i dodaj swój klucz Google AI Studio (GOOGLE_API_KEY)!")
    print("  ⚡ Klucz pobierz za darmo na: https://aistudio.google.com/app/apikey")


def create_dirs():
    header("Tworzenie katalogów")
    for d in ["logs", "screenshots"]:
        (ROOT / d).mkdir(parents=True, exist_ok=True)
    print("✅ Katalogi utworzone")


def create_init_files():
    packages = [
        "python-backend/core",
        "python-backend/automation",
        "python-backend/ai",
        "python-backend/tts",
        "python-backend/stt",
        "python-backend/plugins",
        "python-backend/utils",
    ]
    for pkg in packages:
        init = ROOT / pkg / "__init__.py"
        init.parent.mkdir(parents=True, exist_ok=True)
        if not init.exists():
            init.write_text("")
    print("✅ Struktura pakietów Python gotowa")


def print_next_steps():
    header("🚀 Setup zakończony!")
    print("""
Następne kroki:
  1. Edytuj plik .env i wpisz swój klucz:
     GOOGLE_API_KEY=AIza-twoj-klucz

     Klucz pobierz za darmo (30 sekund):
     https://aistudio.google.com/app/apikey

  2. Uruchom JARVIS:
     cd electron-app
     npm start

  Dokumentacja: docs/INSTALL.md
  Przykładowe komendy: docs/COMMANDS.md
""")


if __name__ == "__main__":
    print("\n🤖 JARVIS Setup — AI Desktop Assistant\n")
    check_python()
    check_node()
    create_dirs()
    create_init_files()
    install_python_deps()
    install_playwright()
    install_node_deps()
    create_env()
    print_next_steps()
