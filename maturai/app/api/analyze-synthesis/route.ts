/**
 * app/api/analyze-synthesis/route.ts
 * API Route: Ocenianie notatki syntetyzującej
 */

import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import type { SynthesisAnalysisResult } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { topic, sources, content, isPremium } = await req.json();

    if (!content || content.trim().length < 80) {
      return NextResponse.json({ success: false, error: "Notatka jest za krótka" }, { status: 400 });
    }

    const sourceTitles = sources?.map((s: { num: number; title: string }) => `Tekst ${s.num}: "${s.title}"`).join(", ") || "";

    const prompt = `Jesteś egzaminatorem CKE oceniającym notatkę syntetyzującą z języka polskiego.

TEMAT: ${topic}
TEKSTY ŹRÓDŁOWE: ${sourceTitles}

NOTATKA UCZNIA:
${content}

Oceń notatkę rzetelnie. Kluczowe: czy uczeń SYNTETYZUJE (łączy myśli, szuka związków), a nie jedynie STRESZCZA każdy tekst osobno.

JSON:
{
  "score": <suma (0-15)>,
  "maxScore": 15,
  "criteria": [
    {"name": "Uwzględnienie wszystkich tekstów", "score": <0-5>, "max": 5},
    {"name": "Synteza zamiast streszczenia", "score": <0-4>, "max": 4},
    {"name": "Spójność i logika wypowiedzi", "score": <0-3>, "max": 3},
    {"name": "Poprawność językowa", "score": <0-3>, "max": 3}
  ],
  "summary": "<2 konkretne zdania: co było mocne i co wymaga poprawy>"
  ${isPremium ? ', "detailedFeedback": "<szczegółowa analiza premium — co zmienić zdanie po zdaniu>"' : ""}
}`;

    const result = await generateJSON<SynthesisAnalysisResult>(prompt);

    const sum = result.criteria.reduce((acc, c) => acc + c.score, 0);
    if (result.score !== sum) result.score = sum;

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error("[analyze-synthesis]", error);
    const message = error instanceof Error ? error.message : "Błąd analizy";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
