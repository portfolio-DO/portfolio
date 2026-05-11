/**
 * app/api/generate-topic/route.ts
 * API Route: Generowanie tematu rozprawki przez AI
 */

import { NextResponse } from "next/server";
import { generateText } from "@/lib/gemini";

const TOPIC_PROMPT = `Wygeneruj 1 realistyczny temat do rozprawki maturalnej z języka polskiego.
Temat powinien:
- Być sformułowany jako pytanie lub polecenie
- Nawiązywać do lektur obowiązkowych lub wartości humanistycznych
- Być na poziomie matury CKE
- Znajdować się w cudzysłowie

Przykłady (NIE kopiuj, stwórz nowy):
„Czy samotność jest wartością, czy przekleństwem? Rozważ problem, odwołując się do wybranych tekstów literackich."
„Jak literatura ukazuje konflikty moralne człowieka? Omów zagadnienie na podstawie wybranych utworów."

Zwróć TYLKO sam temat w cudzysłowie, bez żadnego komentarza.`;

export async function GET() {
  try {
    const topic = await generateText(TOPIC_PROMPT, { temperature: 0.9, maxOutputTokens: 200 });
    return NextResponse.json({ success: true, data: { topic: topic.trim() } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Błąd generowania";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
