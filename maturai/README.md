# ✦ MaturAI — Platforma Maturalna Premium

> Przygotuj się do matury z AI. Ocenianie rozprawek jak egzaminator CKE, zadania matematyczne i notatki syntetyzujące.

---

## 🚀 Szybki start (5 minut)

### 1. Pobierz zależności

```bash
npm install
```

### 2. Skonfiguruj zmienne środowiskowe

```bash
cp .env.example .env.local
```

Otwórz `.env.local` i uzupełnij:

```env
GEMINI_API_KEY=twój_klucz_gemini_tutaj
DATABASE_URL=postgresql://user:password@localhost:5432/maturai
NEXTAUTH_SECRET=wygeneruj_losowy_string
NEXTAUTH_URL=http://localhost:3000
```

### 3. Pobierz klucz Gemini API (bezpłatny)

1. Przejdź na → [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Zaloguj się kontem Google
3. Kliknij **"Create API key"**
4. Skopiuj klucz i wklej do `.env.local`

### 4. Skonfiguruj bazę danych

```bash
# Wygeneruj klienta Prisma
npx prisma generate

# Utwórz tabele w bazie
npx prisma db push
```

### 5. Uruchom aplikację

```bash
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000) 🎉

---

## 🔑 Konfiguracja API bez bazy danych

Aplikacja działa **bez bazy danych** w trybie standalone!

Po uruchomieniu kliknij przycisk **"Brak klucza API"** w prawym górnym rogu i wklej klucz Gemini bezpośrednio w UI. Klucz zapisywany jest w `sessionStorage`.

---

## ✨ Funkcjonalności

### Rozprawka (język polski)
- ✅ Generowanie tematów przez AI
- ✅ Edytor z licznikiem słów + autosave
- ✅ Ocena jak egzaminator CKE (7 kryteriów, 0-35 pkt)
- ✅ Szczegółowy feedback
- 🔒 Premium: analiza zdanie po zdaniu

### Matematyka
- ✅ Generowanie zadań maturalnych (podstawowa / rozszerzona)
- ✅ Zadania zamknięte i otwarte
- ✅ Sprawdzanie odpowiedzi z AI
- 🔒 Premium: pełne rozwiązania krok po kroku + hinty

### Notatka syntetyzująca
- ✅ Generowanie realistycznych tekstów źródłowych
- ✅ Ocena notatki jak egzaminator CKE (0-15 pkt)
- ✅ Analiza jakości syntezy

### Dashboard
- ✅ Statystyki postępów
- ✅ Streak nauki 🔥
- ✅ Historia aktywności
- ✅ Wykresy tygodniowe

### System Premium
- ✅ Toggle w sidebar (tryb testowy)
- ✅ Zablokowane funkcje z blur + lock
- ✅ Badge Premium w topbarze

---

## 🏗️ Struktura projektu

```
maturai/
├── app/
│   ├── page.tsx              # Główna aplikacja (standalone)
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Design system + CSS vars
│   └── api/
│       ├── analyze-essay/    # Ocenianie rozprawki
│       ├── generate-topic/   # Generowanie tematów
│       ├── generate-math/    # Zadania matematyczne
│       ├── generate-synthesis/ # Zadania syntezy
│       ├── analyze-synthesis/ # Ocenianie notatki
│       └── auth/             # NextAuth
├── lib/
│   ├── gemini.ts             # Klient Gemini API
│   ├── db.ts                 # Prisma singleton
│   └── auth.ts               # NextAuth config
├── config/
│   └── env.ts                # Zmienne środowiskowe
├── types/
│   └── index.ts              # Typy TypeScript
├── prisma/
│   └── schema.prisma         # Schema bazy danych
├── .env.example              # Przykład zmiennych
├── tailwind.config.ts        # Konfiguracja Tailwind
└── package.json
```

---

## 🎨 Design System

- **Dark-first UI** — ciemny motyw jako domyślny
- **Gradienty** — niebieski (#3b82f6) → fioletowy (#8b5cf6)
- **Glassmorphism** — blur, półprzezroczyste karty
- **Typografia** — Syne (nagłówki) + DM Sans (treść)
- **Animacje** — fade-in, slide-up, skeleton shimmer

---

## 🗄️ Baza danych (PostgreSQL)

Modele:
- `User` — użytkownicy
- `Essay` — zapisane rozprawki z ocenami
- `MathAttempt` — próby matematyczne
- `SynthesisAttempt` — notatki syntetyzujące
- `Subscription` — FREE / PREMIUM
- `UserStats` — statystyki, streak, XP
- `ErrorAnalysis` — analiza błędów

---

## 🔧 Skrypty

```bash
npm run dev          # Tryb deweloperski
npm run build        # Build produkcyjny
npm run start        # Start produkcyjny
npm run db:push      # Synchronizuj schemat z bazą
npm run db:generate  # Generuj klienta Prisma
npm run db:studio    # Otwórz Prisma Studio (GUI bazy)
```

---

## 🌐 Deployment

### Vercel (zalecane)

```bash
# Zainstaluj Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Ustaw zmienne środowiskowe w panelu Vercel.

### Baza danych w chmurze

Zalecane: [Supabase](https://supabase.com) (PostgreSQL, bezpłatny tier)

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
```

---

## 📝 Licencja

MIT — do celów edukacyjnych.

---

*Zbudowane z ❤️ dla polskich maturzystów*
