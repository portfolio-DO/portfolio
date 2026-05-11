/**
 * app/api/generate-math/route.ts
 * API Route: Generowanie zadań matematycznych przez AI
 */

import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import type { MathTasksResult } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { level = "podstawowa" } = await req.json();

    const isExtended = level === "rozszerzona";

    const prompt = `Jesteś twórcą zadań maturalnych z matematyki (poziom ${level}).
Wygeneruj 4 realistyczne zadania maturalne różnych typów.

${isExtended ? "Dla poziomu rozszerzonego: trygonometria, granice, pochodne, całki, kombinatoryka." : "Dla poziomu podstawowego: funkcje, równania, geometria, statystyka, procenty."}

Każde zadanie powinno mieć konkretne liczby i jednoznaczną odpowiedź.

JSON:
{
  "tasks": [
    {
      "id": 1,
      "type": "closed",
      "difficulty": "easy",
      "points": 1,
      "content": "<pełna treść zadania z konkretnymi liczbami>",
      "options": ["A. <opcja z liczbą>", "B. <opcja>", "C. <opcja>", "D. <opcja>"],
      "correctAnswer": "<litera A/B/C/D>",
      "solution": "<krótkie wyjaśnienie rozwiązania>",
      "hints": ["<wskazówka 1>"]
    },
    {
      "id": 2,
      "type": "open",
      "difficulty": "easy",
      "points": 2,
      "content": "<treść zadania otwartego>",
      "correctAnswer": "<dokładna odpowiedź liczbowa>",
      "solution": "<rozwiązanie krok po kroku>",
      "hints": ["<wskazówka>"]
    },
    {
      "id": 3,
      "type": "open",
      "difficulty": "medium",
      "points": 3,
      "content": "<treść zadania>",
      "correctAnswer": "<odpowiedź>",
      "solution": "<rozwiązanie krok po kroku>",
      "hints": ["<wskazówka 1>", "<wskazówka 2>"]
    },
    {
      "id": 4,
      "type": "open",
      "difficulty": "${isExtended ? "hard" : "medium"}",
      "points": ${isExtended ? 6 : 4},
      "content": "<trudniejsze zadanie${isExtended ? " — poziom rozszerzony" : ""}>",
      "correctAnswer": "<odpowiedź>",
      "solution": "<szczegółowe rozwiązanie krok po kroku>",
      "hints": ["<wskazówka 1>", "<wskazówka 2>", "<wskazówka 3>"]
    }
  ]
}`;

    const result = await generateJSON<MathTasksResult>(prompt);

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error("[generate-math]", error);
    const message = error instanceof Error ? error.message : "Błąd generowania";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
