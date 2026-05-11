import { NextRequest, NextResponse } from "next/server";

// Modele potwierdzone jako dostepne na kluczu uzytkownika (maj 2025)
const CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
];

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Brak GEMINI_API_KEY w .env.local", hint: "Dodaj GEMINI_API_KEY=AIzaSy... do .env.local i zrestartuj serwer" },
      { status: 500 }
    );
  }

  const { prompt, maxTokens = 3000, temperature = 0.7 } = await req.json();
  if (!prompt) return NextResponse.json({ error: "Brak prompt" }, { status: 400 });

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens, topP: 0.95 },
  };

  const errors: string[] = [];

  for (const model of CANDIDATES) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log(`[gemini] Probuje: ${model}`);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        errors.push(`${model}: ${msg.slice(0, 100)}`);
        console.warn(`[gemini] ${model} fail: ${msg.slice(0, 80)}`);

        // Zly klucz API — nie probuj dalej
        if (res.status === 400 && (msg.includes("API_KEY") || msg.includes("API key"))) {
          return NextResponse.json({ error: "Nieprawidlowy klucz API Gemini" }, { status: 400 });
        }
        if (res.status === 403) {
          return NextResponse.json({ error: "Brak uprawnien. Sprawdz klucz na aistudio.google.com" }, { status: 403 });
        }

        // Przekroczony limit — sprobuj nastepny model
        continue;
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) { errors.push(`${model}: pusta odpowiedz`); continue; }

      console.log(`[gemini] OK: ${model}`);
      return NextResponse.json({ text, model });

    } catch (e) {
      errors.push(`${model}: ${(e as Error).message}`);
    }
  }

  console.error("[gemini] Wszystkie modele zawiodly:", errors);
  return NextResponse.json(
    {
      error: "Przekroczono limit zapytan Gemini API (quota exceeded). Odczekaj chwile i sprobuj ponownie, lub sprawdz limity na aistudio.google.com",
      details: errors,
    },
    { status: 429 }
  );
}
