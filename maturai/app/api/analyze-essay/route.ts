/**
 * app/api/analyze-essay/route.ts
 * API Route: Ocenianie rozprawki przez Gemini AI
 */

import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import type { EssayAnalysisResult } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { topic, content, isPremium } = await req.json();

    if (!topic || !content) {
      return NextResponse.json({ success: false, error: "Brak tematu lub treści" }, { status: 400 });
    }

    const wordCount = content.trim().split(/\s+/).filter((w: string) => w.length > 0).length;

    if (wordCount < 50) {
      return NextResponse.json({ success: false, error: "Rozprawka jest za krótka (minimum 50 słów)" }, { status: 400 });
    }

    const premiumExtra = isPremium
      ? `\n\nDodaj również pola:\n"sentenceAnalysis": [{"sentence": "<zdanie>", "comment": "<komentarz>", "type": "good|warn|bad"}] (top 5 zdań),\n"betterArguments": ["<propozycja 1>", "<propozycja 2>", "<propozycja 3>"]`
      : "";

    const prompt = `Jesteś doświadczonym egzaminatorem maturalnym CKE z języka polskiego. Oceń poniższą rozprawkę profesjonalnie i rzetelnie.

TEMAT: ${topic}

TREŚĆ ROZPRAWKI:
${content}

LICZBA SŁÓW: ${wordCount}

Oceń według oficjalnych kryteriów CKE i zwróć odpowiedź w formacie JSON:
{
  "totalScore": <suma punktów (0-35)>,
  "maxScore": 35,
  "criteria": [
    {"name": "Realizacja tematu wypowiedzi", "score": <0-9>, "max": 9, "comment": "<uzasadnienie>"},
    {"name": "Kompetencje literackie i kulturowe", "score": <0-8>, "max": 8, "comment": "<uzasadnienie>"},
    {"name": "Kompozycja tekstu", "score": <0-6>, "max": 6, "comment": "<uzasadnienie>"},
    {"name": "Styl i język", "score": <0-6>, "max": 6, "comment": "<uzasadnienie>"},
    {"name": "Poprawność ortograficzna", "score": <0-3>, "max": 3, "comment": "<uzasadnienie>"},
    {"name": "Poprawność interpunkcyjna", "score": <0-3>, "max": 3, "comment": "<uzasadnienie>"}
  ],
  "feedback": [
    {"type": "good", "text": "<co uczeń zrobił dobrze — konkretnie>"},
    {"type": "good", "text": "<kolejna mocna strona>"},
    {"type": "warn", "text": "<co wymaga poprawy>"},
    {"type": "bad", "text": "<poważny błąd lub brak>"}
  ],
  "summary": "<2 zdania profesjonalnego podsumowania oceny>"
}${premiumExtra}`;

    const result = await generateJSON<EssayAnalysisResult>(prompt);

    // Walidacja sumy punktów
    const criteriaSum = result.criteria.reduce((sum, c) => sum + c.score, 0);
    if (result.totalScore !== criteriaSum) {
      result.totalScore = criteriaSum;
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error("[analyze-essay]", error);
    const message = error instanceof Error ? error.message : "Błąd analizy";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
