# 🤖 JARVIS — AI Desktop Assistant

> Głosowo sterowany asystent AI dla Windows.  
> Mówisz → AI rozumie → komputer wykonuje → feedback głosowy i wizualny.

---

## ✨ Features

| Kategoria | Możliwości |
|---|---|
| 🎙️ Głos | Ciągłe nasłuchiwanie, wake word ("Hey Jarvis"), naturalny angielski, realistyczny TTS |
| 🖥️ Automatyzacja | Otwieranie aplikacji, sterowanie przeglądarką, pisanie, klikanie, komendy systemowe |
| 🌐 Przeglądarka | Chrome/Edge/Firefox przez Playwright, web scraping, ekstrakcja danych |
| 🧠 AI | **Google Gemini** (AI Studio) — parsowanie intencji, planowanie zadań, pamięć rozmowy |
| 🛡️ Bezpieczeństwo | Potwierdzenia przed ryzykownymi akcjami, tryb sandbox, logowanie, emergency stop |
| 🎨 UI | Electron + React, dark mode, live transkrypcja, historia komend |

---

## 📁 Struktura projektu

```
jarvis/
├── electron-app/              # Frontend: Electron + React
│   └── src/
│       ├── main/              # Electron main process
│       ├── renderer/          # React UI (komponenty, store, strony)
│       └── preload/
├── python-backend/            # Backend: Python
│   ├── main.py                # WebSocket server
│   ├── core/                  # Orchestrator, Gemini planner, pamięć, config
│   ├── automation/            # PyAutoGUI, Playwright, system, apps
│   ├── stt/                   # faster-whisper
│   ├── tts/                   # pyttsx3 / ElevenLabs
│   ├── plugins/               # Pogoda, Steam, muzyka
│   └── utils/                 # Logger, safety, permissions
├── docs/                      # Dokumentacja
├── requirements.txt
├── .env.example
└── setup.py                   # Automatyczna instalacja
```

---

## 🚀 Quick Start

```bash
git clone https://github.com/you/jarvis
cd jarvis
python setup.py

# Dodaj klucz Google AI Studio do .env:
GOOGLE_API_KEY=AIza-twoj-klucz

# Uruchom:
cd electron-app && npm start
```

Szczegółowa instrukcja: [docs/INSTALL.md](docs/INSTALL.md)

---

## 🗣️ Przykładowe komendy

```
"Hey Jarvis, sprawdź pogodę w Warszawie"
"Otwórz YouTube i puść lo-fi music"
"Uruchom Counter-Strike 2 na Steamie"
"Wyszukaj w Google najnowsze wiadomości o AI"
"Ustaw głośność na 20 procent"
"Utwórz folder na pulpicie o nazwie Projekty"
"Otwórz Discord"
"Zrób screenshot"
```

---

## 🔧 Tech Stack

| Warstwa | Technologia |
|---|---|
| Frontend | Electron 28 + React 18 + Vite + Zustand |
| Backend | Python 3.11 + asyncio + WebSockets |
| AI | **Google Gemini** (gemini-1.5-flash) via AI Studio |
| STT | faster-whisper (lokalnie, szybko) |
| TTS | pyttsx3 (offline) / ElevenLabs (premium) |
| Automatyzacja | PyAutoGUI + Playwright |
| Wake Word | openwakeword (100% darmowy, open source) |
