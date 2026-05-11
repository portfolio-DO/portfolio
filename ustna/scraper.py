"""
ustna.pl Scraper + Groq Deduplication
Pobiera pytania z ustna.pl (SPA — nawigacja przez klikanie przycisków dat)
i deduplikuje je przez Groq API.

Wymagania:
    pip install playwright python-dotenv requests
    playwright install chromium
"""

import asyncio
import json
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

import requests
from playwright.async_api import async_playwright

# ─── CONFIG ────────────────────────────────────────────────────────────────────
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL   = "llama-3.1-70b-versatile"
BASE_URL     = "https://ustna.pl"
OUTPUT_DIR   = Path(__file__).parent / "data"

# Polskie nazwy miesięcy widoczne w przyciskach dat na stronie
PL_MONTHS = {
    "sty": 1, "lut": 2, "mar": 3, "kwi": 4, "maj": 5, "cze": 6,
    "lip": 7, "sie": 8, "wrz": 9, "paz": 10, "lis": 11, "gru": 12,
}

GROQ_SYSTEM_PROMPT = """Jesteś ekspertem od analizy i grupowania pytań maturalnych z języka polskiego.

Otrzymasz listę pytań z matury ustnej w formacie JSON. Twoim zadaniem jest:

1. GRUPOWANIE: Pogrupuj pytania o tym samym lub bardzo podobnym znaczeniu.
2. KANONIZACJA: Dla każdej grupy wybierz jedno "kanoniczne" pytanie — najbardziej kompletne i poprawne.
3. ZWRÓĆ WYNIK jako JSON w dokładnie tym formacie (bez żadnego dodatkowego tekstu, tylko czysty JSON):
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

ZASADY GRUPOWANIA:
- To samo pytanie dotyczące tej samej lektury/motywu → jedna grupa
- Pytania o różnych lekturach lub różnych motywach → OSOBNE grupy
- Pytania z błędami literowymi ale tym samym znaczeniu → jedna grupa
- Zachowaj polskie znaki diakrytyczne w kanonicznym pytaniu

Odpowiedz WYŁĄCZNIE JSONem, bez markdown, bez wyjaśnień."""


# ─── HELPERS ───────────────────────────────────────────────────────────────────

def parse_button_date(btn_text: str, current_year: int) -> str | None:
    """
    Parsuje tekst przycisku daty np. 'pt 8 maj', 'sb 9 maj' → '2026-05-08'.
    """
    text = btn_text.strip().lower()
    # Usuń polskie skróty dni tygodnia
    text = re.sub(r'^(pn|wt|sr|sr\.|śr|śr\.|cz|pt|sb|nd|nie)\s*', '', text).strip()
    # Szukaj: cyfra + nazwa miesiąca
    m = re.match(r'(\d{1,2})\s+([a-zśćźżóąęłń]+)', text)
    if not m:
        return None
    day = int(m.group(1))
    month_str = m.group(2)[:3].replace('ź', 'z').replace('ą', 'a')
    # Normalizacja "paź" → "paz"
    month_str = month_str.replace('ź', 'z').replace('ą', 'a')
    month = PL_MONTHS.get(month_str)
    if not month:
        return None
    return f"{current_year}-{month:02d}-{day:02d}"


async def dismiss_overlays(page):
    for sel in [
        'button:has-text("Akceptuj")', 'button:has-text("Zgadzam się")',
        'button:has-text("OK")', 'button:has-text("Rozumiem")',
        '#accept-cookies', '.cookie-accept',
    ]:
        try:
            btn = await page.query_selector(sel)
            if btn and await btn.is_visible():
                await btn.click()
                await page.wait_for_timeout(600)
                break
        except Exception:
            pass


async def expand_all_see_more(page) -> int:
    total = 0
    for _ in range(20):
        btns = await page.query_selector_all(
            'button:has-text("Zobacz więcej"), button:has-text("Pokaż więcej"), '
            'button:has-text("Załaduj więcej"), a:has-text("Zobacz więcej")'
        )
        clicked = 0
        for btn in btns:
            try:
                if await btn.is_visible():
                    await btn.scroll_into_view_if_needed()
                    await btn.click()
                    await page.wait_for_timeout(800)
                    clicked += 1
                    total += 1
            except Exception:
                pass
        if clicked == 0:
            break
        await page.wait_for_timeout(500)
    return total


async def extract_questions_from_page(page, date_str: str) -> list[dict]:
    """Wyciąga pytania z aktualnie wyświetlonej zawartości SPA — wersja pod ustna.pl"""
    try:
        # Czekamy na pojawienie się kontenerów pytań
        await page.wait_for_selector('.rounded-\\[20px\\].border-2', timeout=8000)
    except Exception:
        print("    ⚠️  Nie znaleziono kontenerów pytań w oczekiwanym czasie")

    await page.wait_for_timeout(1200)
    expanded = await expand_all_see_more(page)
    if expanded:
        print(f"    🔽 Rozwinięto {expanded}× 'Zobacz więcej'")

    questions = await page.evaluate("""() => {
        const results = [];
        const seen = new Set();
        const timeRe = /\\b(\\d{1,2}:\\d{2})\\b/;

        // === GŁÓWNA STRATEGIA — według Twoich selektorów ===
        const questionContainers = document.querySelectorAll(
            '[class*="rounded-"][class*="20px"][class*="border-2"][class*="p-4"]'
        );

        questionContainers.forEach(container => {
            // Szukamy treści pytania — text-base font-medium leading-snug w <p>
            const textElements = container.querySelectorAll('p.text-base.font-medium.leading-snug, p[class*="text-base"][class*="font-medium"]');

            let qText = '';
            for (const el of textElements) {
                const txt = el.textContent.trim();
                if (txt.length > 15) {
                    qText = txt;
                    break;
                }
            }

            // Fallback — cały tekst kontenera (bez godziny na początku)
            if (!qText) {
                qText = container.textContent.replace(/\\s+/g, ' ').trim();
            }

            // Czyszczenie
            qText = qText
                .replace(/\\s+/g, ' ')
                .replace(/^\\d{1,2}:\\d{2}\\s*/, '')   // usuń godzinę na początku
                .replace(/\\s*\\d{1,2}:\\d{2}\\s*$/, '') // usuń godzinę na końcu
                .trim();

            if (qText.length < 20) return;

            const key = qText.slice(0, 150).toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);

            const timeMatch = container.textContent.match(timeRe);
            const time = timeMatch ? timeMatch[1] : null;

            // Autor (opcjonalnie)
            const authorEl = container.querySelector(
                '[class*="autor"], [class*="author"], [class*="user"], [class*="nick"], [class*="name"], .text-sm, .text-xs'
            );

            results.push({
                text: qText,
                time: time,
                author: authorEl ? authorEl.textContent.trim() : null,
            });
        });

        // Fallback — stara strategia (gdyby selektory się zmieniły)
        if (results.length === 0) {
            console.log("Fallback strategy used");
            const fallbackSelectors = ['li', 'article', '[class*="question"]', '[class*="card"]'];
            for (const sel of fallbackSelectors) {
                const items = document.querySelectorAll(sel);
                items.forEach(item => {
                    const raw = item.textContent.replace(/\\s+/g, ' ').trim();
                    if (raw.length < 30 || raw.length > 4000) return;

                    const timeMatch = raw.match(timeRe);
                    let qText = raw.replace(/^\\d{1,2}:\\d{2}\\s*/, '').trim();

                    const key = qText.slice(0, 120).toLowerCase();
                    if (seen.has(key)) return;
                    seen.add(key);

                    results.push({
                        text: qText,
                        time: timeMatch ? timeMatch[1] : null,
                        author: null,
                    });
                });
            }
        }

        return results;
    }""")

    for q in questions:
        q["date"] = date_str
        q["scraped_at"] = datetime.now().isoformat()

    print(f"    📦 Znaleziono {len(questions)} pytań")
    return questions


# ─── GŁÓWNA PĘTLA ──────────────────────────────────────────────────────────────

async def scrape_all_dates(days: int = 7) -> list[dict]:
    """
    Otwiera stronę RAZ, wykrywa przyciski dat, klika każdy i zbiera pytania.
    NIE otwiera nowych URL – strona to SPA.
    """
    all_questions: list[dict] = []
    current_year = datetime.now().year
    today = datetime.now().date()
    target_dates = {(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
            locale="pl-PL",
        )
        page = await ctx.new_page()

        # ── Załaduj stronę ────────────────────────────────────────────────
        print(f"🌐 Łączę z {BASE_URL} …")
        try:
            await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        except Exception as e:
            print(f"❌ Błąd ładowania: {e}")
            await browser.close()
            return []

        await page.wait_for_timeout(2500)
        await dismiss_overlays(page)

        # Kliknij ewentualne CTA na landing page
        for cta in ['button:has-text("Zobacz listę pytań")', 'a:has-text("Zobacz listę")',
                    'button:has-text("Pytania")', 'a[href*="pytania"]']:
            try:
                el = await page.query_selector(cta)
                if el and await el.is_visible():
                    await el.click()
                    await page.wait_for_timeout(2000)
                    print("  ✅ Kliknięto CTA landing page")
                    break
            except Exception:
                pass

        # ── Wykryj przyciski dat ──────────────────────────────────────────
        print("📅 Szukam przycisków dat …")
        try:
            await page.wait_for_selector('button', timeout=8000)
        except Exception:
            pass

        raw_buttons = await page.evaluate("""() => {
            const plMonthNames = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','paz','lis','gru'];
            const all = [
                ...document.querySelectorAll('button'),
                ...document.querySelectorAll('[role="tab"]'),
                ...document.querySelectorAll('a[role="button"]'),
                ...document.querySelectorAll('[data-date]'),
            ];
            return all
                .map(el => ({
                    text: el.textContent.replace(/\\s+/g,' ').trim(),
                    dataDate: el.getAttribute('data-date') || el.getAttribute('data-value') || '',
                    visible: el.offsetParent !== null,
                }))
                .filter(b => {
                    if (!b.visible || b.text.length > 35 || b.text.length < 3) return false;
                    const t = b.text.toLowerCase();
                    return plMonthNames.some(m => t.includes(m)) && /\\d/.test(t);
                });
        }""")

        print(f"  Znalezione przyciski: {[b['text'] for b in raw_buttons]}")

        # Dopasuj do zakresu dat
        buttons_to_click = []
        for b in raw_buttons:
            if b['dataDate'] and re.match(r'\d{4}-\d{2}-\d{2}', b['dataDate']):
                date_str = b['dataDate'][:10]
            else:
                date_str = parse_button_date(b['text'], current_year)
            if date_str and date_str in target_dates:
                buttons_to_click.append({"text": b['text'], "date_str": date_str})

        # Jeśli żaden nie pasuje – weź wszystkie dostępne
        if not buttons_to_click and raw_buttons:
            print("  ℹ️  Brak przycisków w podanym zakresie – biorę wszystkie dostępne")
            for b in raw_buttons[:days]:
                if b['dataDate'] and re.match(r'\d{4}-\d{2}-\d{2}', b['dataDate']):
                    date_str = b['dataDate'][:10]
                else:
                    date_str = parse_button_date(b['text'], current_year) or today.strftime("%Y-%m-%d")
                buttons_to_click.append({"text": b['text'], "date_str": date_str})

        if not buttons_to_click:
            print("  ⚠️  Nie wykryto przycisków dat — scrapuję bieżącą zawartość")
            questions = await extract_questions_from_page(page, today.strftime("%Y-%m-%d"))
            await browser.close()
            return questions

        print(f"\n🖱️  Klikam {len(buttons_to_click)} przycisków dat")

        seen_globally: set[str] = set()

        for btn_info in buttons_to_click:
            date_str = btn_info["date_str"]
            btn_text = btn_info["text"]
            print(f"\n  📅 '{btn_text}'  →  {date_str}")

            # Kliknij przycisk
            clicked = False
            for sel in [
                f'button:has-text("{btn_text}")',
                f'[role="tab"]:has-text("{btn_text}")',
                f'a:has-text("{btn_text}")',
            ]:
                try:
                    el = await page.query_selector(sel)
                    if el and await el.is_visible():
                        await el.scroll_into_view_if_needed()
                        await el.click()
                        clicked = True
                        break
                except Exception:
                    pass

            if not clicked:
                # Fallback: szukaj po samej liczbie i miesiącu (bez dnia tygodnia)
                short = re.sub(r'^(pn|wt|sr|śr|cz|pt|sb|nd)\s*', '', btn_text, flags=re.I).strip()
                try:
                    el = await page.query_selector(f'button:has-text("{short}")')
                    if el and await el.is_visible():
                        await el.scroll_into_view_if_needed()
                        await el.click()
                        clicked = True
                except Exception:
                    pass

            if not clicked:
                print(f"    ⚠️  Nie udało się kliknąć '{btn_text}'")
                continue

            # Poczekaj na załadowanie treści SPA
            await page.wait_for_timeout(2200)
            try:
                await page.wait_for_load_state("networkidle", timeout=6000)
            except Exception:
                pass

            questions = await extract_questions_from_page(page, date_str)

            # Globalna deduplikacja między dniami
            unique = []
            for q in questions:
                key = q["text"][:100].lower()
                if key not in seen_globally:
                    seen_globally.add(key)
                    unique.append(q)

            dupes = len(questions) - len(unique)
            print(f"    ✅ {len(unique)} nowych pytań  ({dupes} duplikatów odfiltrowanych)")
            all_questions.extend(unique)

            await asyncio.sleep(1.5)

        await browser.close()

    print(f"\n📊 Łącznie: {len(all_questions)} unikalnych pytań z {len(buttons_to_click)} dni")
    return all_questions


# ─── GROQ DEDUPLICATION ────────────────────────────────────────────────────────

def groq_deduplicate(questions: list[dict]) -> dict:
    if not GROQ_API_KEY:
        print("⚠️  Brak GROQ_API_KEY — pomijam deduplikację AI")
        return {"groups": []}

    print(f"\n🤖 Wysyłam {len(questions)} pytań do Groq ({GROQ_MODEL}) …")
    BATCH_SIZE = 80
    all_groups: list[dict] = []

    for batch_start in range(0, len(questions), BATCH_SIZE):
        batch = questions[batch_start: batch_start + BATCH_SIZE]
        print(f"  📦 Batch {batch_start // BATCH_SIZE + 1}: {batch_start}–{batch_start + len(batch) - 1}")

        input_data = [
            {"id": batch_start + i, "text": q["text"],
             "date": q.get("date", ""), "time": q.get("time", "")}
            for i, q in enumerate(batch)
        ]
        user_msg = (
            f"Pogrupuj {len(input_data)} pytań maturalnych:\n\n"
            f"{json.dumps(input_data, ensure_ascii=False, indent=2)}\n\n"
            "Odpowiedz WYŁĄCZNIE czystym JSONem."
        )

        try:
            r = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={"model": GROQ_MODEL, "temperature": 0.1, "max_tokens": 8000,
                      "messages": [{"role": "system", "content": GROQ_SYSTEM_PROMPT},
                                   {"role": "user", "content": user_msg}]},
                timeout=90,
            )
            r.raise_for_status()
            raw = r.json()["choices"][0]["message"]["content"].strip()
            raw = re.sub(r"^```json\s*", "", raw)
            raw = re.sub(r"```\s*$", "", raw).strip()
            parsed = json.loads(raw)
            batch_groups = parsed.get("groups", [])
            for g in batch_groups:
                g["ids"] = [batch_start + lid for lid in g.get("ids", [])]
            all_groups.extend(batch_groups)
            print(f"  ✅ {len(batch_groups)} grup")
        except requests.HTTPError as e:
            print(f"  ❌ HTTP {e.response.status_code}: {e.response.text[:200]}")
        except json.JSONDecodeError as e:
            print(f"  ❌ JSON decode: {e}")
        except Exception as e:
            print(f"  ❌ {e}")

    all_groups.sort(key=lambda g: g.get("count", 1), reverse=True)
    return {"groups": all_groups}


# ─── ZAPIS ─────────────────────────────────────────────────────────────────────

def save_output(questions: list[dict], dedup: dict) -> Path:
    OUTPUT_DIR.mkdir(exist_ok=True)
    (OUTPUT_DIR / "questions_raw.json").write_text(
        json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUTPUT_DIR / "questions_dedup.json").write_text(
        json.dumps(dedup, ensure_ascii=False, indent=2), encoding="utf-8")
    combined = {
        "scraped_at": datetime.now().isoformat(),
        "total_raw": len(questions),
        "total_groups": len(dedup.get("groups", [])),
        "questions": questions,
        "deduplication": dedup,
    }
    p = OUTPUT_DIR / "questions.json"
    p.write_text(json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n💾 questions.json → {p.resolve()}")
    return p


# ─── MAIN ──────────────────────────────────────────────────────────────────────

async def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    print(f"🚀 ustna.pl Scraper — ostatnie {days} dni\n{'=' * 55}")
    questions = await scrape_all_dates(days)
    if not questions:
        print("\n❌ Brak pytań. Wskazówki:")
        print("   • Zmień headless=True → headless=False żeby zobaczyć przeglądarkę")
        print("   • Sprawdź czy strona nie wymaga logowania")
        sys.exit(1)
    dedup = groq_deduplicate(questions)
    output_path = save_output(questions, dedup)
    print(f"\n✨ Pytań: {len(questions)}  |  Grup: {len(dedup.get('groups', []))}")
    print(f"👉 Załaduj w index.html: {output_path.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())
