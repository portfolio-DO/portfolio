# 🧠 ustna.pl — Przeglądarka Pytań Egzaminacyjnych

Narzędzie do scrapowania, deduplikacji i przeglądania pytań z ustna.pl.

---

## 📁 Struktura projektu

```
ustna-scraper/
├── scraper.py          # Scraper Playwright + deduplikacja Groq
├── index.html          # Frontend (Tailwind + JS, bez backendu)
├── data/               # Wygenerowane pliki JSON (auto-tworzone)
│   ├── questions.json       # Główny plik dla frontendu
│   ├── questions_raw.json   # Surowe pytania
│   └── questions_dedup.json # Wynik deduplikacji Groq
└── README.md
```

---

## 🚀 Szybki start

### 1. Zainstaluj zależności Python

```bash
pip install playwright python-dotenv requests
playwright install chromium
```

### 2. Pobierz klucz Groq API (bezpłatny)

1. Wejdź na https://console.groq.com
2. Zarejestruj się / zaloguj
3. Przejdź do **API Keys** → **Create API Key**
4. Skopiuj klucz (zaczyna się od `gsk_`)

### 3. Uruchom scraper

```bash
# Ostatnie 7 dni (domyślnie)
GROQ_API_KEY="" python scraper.py

# Ostatnie N dni
GROQ_API_KEY="" python scraper.py 3

# Bez deduplikacji Groq (tylko scraping)
python scraper.py
```

### 4. Otwórz frontend

```bash
# Otwórz index.html w przeglądarce
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

Kliknij **📂 Otwórz plik** i wskaż `data/questions.json`.

---

## ⚙️ Konfiguracja

### Zmienne środowiskowe

| Zmienna | Opis | Domyślnie |
|---------|------|-----------|
| `GROQ_API_KEY` | Klucz API do Groq | — (wymagany do deduplikacji) |

### Edycja w scraper.py

```python
GROQ_MODEL   = "llama-3.1-70b-versatile"  # Model Groq
BASE_URL     = "https://ustna.pl"           # URL strony
BATCH_SIZE   = 80                           # Pytań na jedno zapytanie Groq
```

---

## 🤖 Prompt systemowy Groq (deduplikacja)

```
Jesteś ekspertem od analizy i grupowania pytań egzaminacyjnych z polskich studiów medycznych.

Otrzymasz listę pytań egzaminacyjnych w formacie JSON. Twoim zadaniem jest:
1. GRUPOWANIE: Pogrupuj pytania o tym samym lub bardzo podobnym znaczeniu
2. KANONIZACJA: Dla każdej grupy wybierz jedno "kanoniczne" pytanie

ZWRÓĆ wynik jako JSON:
{
  "groups": [
    {
      "canonical": "Pełne, kanoniczne pytanie",
      "count": 3,
      "ids": [0, 5, 12],
      "variants": ["wariant 1", "wariant 2", "wariant 3"]
    }
  ]
}
```

---

## 🔧 Rozwiązywanie problemów

### Scraper nie znajduje pytań

Strona ustna.pl może wymagać logowania lub zmieniła strukturę HTML.
Sprawdź ręcznie strukturę DOM w DevTools i dostosuj selektory w funkcji `scrape_date()`.

### Błąd Groq 401

Sprawdź klucz API — powinien zaczynać się od `gsk_`.

### Błąd Groq 429 (rate limit)

Zmniejsz `BATCH_SIZE` do 40 lub poczekaj chwilę i uruchom ponownie.

### Playwright nie startuje

```bash
playwright install chromium
# lub
python -m playwright install
```

---

## 📊 Format danych (questions.json)

```json
{
  "scraped_at": "2024-01-15T10:30:00",
  "total_raw": 150,
  "total_groups": 45,
  "questions": [
    {
      "text": "Podaj objawy ostrego zawału mięśnia sercowego",
      "date": "2024-01-15",
      "time": "08:15",
      "author": null,
      "scraped_at": "2024-01-15T10:30:00"
    }
  ],
  "deduplication": {
    "groups": [
      {
        "canonical": "Jakie są objawy ostrego zawału mięśnia sercowego (STEMI)?",
        "count": 3,
        "ids": [0, 5, 12],
        "variants": ["wariant 1", "wariant 2", "wariant 3"]
      }
    ]
  }
}
```

---

## 💡 Użycie frontendu bez scrapera

Możesz też używać frontendu **bez scrapera** — bezpośrednio w przeglądarce:

1. Otwórz `index.html`
2. W sekcji **"Przetwarzaj przez Groq AI teraz"**:
   - Wklej swój Groq API Key
   - Wklej pytania (jedno na linię)
   - Kliknij **Grupuj przez Groq**
3. Gotowe — Groq pogrupuje pytania bez potrzeby uruchamiania Pythona!

---

## 📝 Licencja

Do użytku prywatnego / edukacyjnego. Używaj zgodnie z regulaminem ustna.pl.
