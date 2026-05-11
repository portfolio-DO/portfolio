# JARVIS — Instrukcja instalacji

## Wymagania

| Narzędzie | Wersja | Pobierz |
|---|---|---|
| Python | 3.10+ | https://python.org |
| Node.js | 18+ | https://nodejs.org |
| Mikrofon | Dowolny | wbudowany lub USB |

### Windows — dodatkowo zainstaluj
- [Microsoft Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — wymagane dla PyAudio

---

## 1. Klucz API — Google AI Studio (WYMAGANY)

1. Wejdź na **https://aistudio.google.com/app/apikey**
2. Kliknij **"Create API key"**
3. Skopiuj klucz (zaczyna się od `AIza...`)
4. Wklej do pliku `.env`:
   ```env
   GOOGLE_API_KEY=AIza-twoj-klucz-tutaj
   ```

Klucz jest **darmowy** — Google AI Studio ma darmowy tier wystarczający do codziennego użytku.

---

## 2. Szybka instalacja

```bash
git clone https://github.com/you/jarvis
cd jarvis
python setup.py
```

Skrypt automatycznie:
- zainstaluje wszystkie zależności Python
- zainstaluje Playwright (Chromium)
- zainstaluje zależności Node.js
- utworzy plik `.env` z szablonu

Następnie edytuj `.env` i dodaj swój klucz Google.

---

## 3. Ręczna instalacja (opcjonalnie)

```bash
# Python dependencies
pip install -r requirements.txt
python -m playwright install chromium

# Node dependencies
cd electron-app
npm install
```

---

## 4. Uruchomienie

```bash
cd electron-app
npm start
# Python backend startuje automatycznie
```

Lub oddzielnie:
```bash
# Terminal 1:
cd python-backend && python main.py

# Terminal 2:
cd electron-app && npm run vite
# Terminal 3:
cd electron-app && npx electron .
```

---

## Opcjonalne klucze API

### OpenWeatherMap (pogoda, bezpłatny)
1. https://openweathermap.org/api → zarejestruj się
2. `WEATHER_API_KEY=twoj-klucz`

### Wake Word — openwakeword (wbudowany, zero kluczy)
Wake word działa od razu po instalacji — używa `openwakeword`, który jest 100% open source.
Nie potrzeba żadnego konta ani klucza API.

Dostępne wake word (ustaw `WAKE_WORD` w `.env`):
- `jarvis` → "Hey Jarvis" *(domyślny)*
- `alexa` → "Alexa"
- `computer` → "Computer" *(jak w Star Trek)*
- `hey mycroft` → "Hey Mycroft"

Modele (~5MB) pobierane automatycznie przy pierwszym uruchomieniu.

### ElevenLabs (realistyczny głos, opcjonalny)
1. https://elevenlabs.io → darmowe konto
2. `ELEVENLABS_API_KEY=twoj-klucz`
3. `TTS_ENGINE=elevenlabs`

---

## Modele Gemini — co wybrać?

| Model | Szybkość | Jakość | Koszt |
|---|---|---|---|
| `gemini-1.5-flash` | ⚡ Bardzo szybki | ✅ Dobra | Darmowy tier |
| `gemini-1.5-pro` | 🐢 Wolniejszy | ⭐ Lepsza | Darmowy tier |
| `gemini-2.0-flash` | ⚡ Szybki | ⭐ Najlepsza | Darmowy tier |

**Zalecany**: `gemini-1.5-flash` — dobry balans szybkości i jakości.

---

## Rozwiązywanie problemów

### "PyAudio install failed" (Windows)
```bash
pip install pipwin
pipwin install pyaudio
```

### "google.generativeai not found"
```bash
pip install google-generativeai
```

### Backend nie łączy się
- Sprawdź czy Python jest w PATH: `python --version`
- Sprawdź logi: `logs/jarvis.log`
- Port 8765 wolny: `netstat -an | findstr 8765`

### Mikrofon nie działa
- Windows: Ustawienia → Prywatność → Mikrofon → zezwól aplikacjom
- Spróbuj mniejszego modelu STT: `tiny.en`
