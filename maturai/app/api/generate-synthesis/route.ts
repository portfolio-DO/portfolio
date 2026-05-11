/**
 * app/api/generate-synthesis/route.ts
 * API Route: Generowanie zadania notatki syntetyzującej
 */

import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import type { SynthesisResult } from "@/lib/gemini";

const TOPICS = [
  "rola technologii w życiu współczesnego człowieka",
  "znaczenie pamięci zbiorowej dla tożsamości narodu",
  "człowiek wobec natury — konflikt czy harmonia",
  "wpływ mediów społecznościowych na relacje międzyludzkie",
  "wartość tradycji w zglobalizowanym świecie",
  "granice wolności jednostki w społeczeństwie",
  "znaczenie czytania książek w cyfrowym świecie",
];

export async function GET() {
  try {
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];

    const prompt = `Jesteś twórcą zadań maturalnych z języka polskiego.
Stwórz realistyczne zadanie do notatki syntetyzującej na temat: "${topic}".

Teksty muszą być autentycznie brzmiące, różnorodne gatunkowo i wzajemnie uzupełniające się.
Każdy tekst powinien mieć ok. 120-180 słów.

JSON:
{
  "topic": "${topic}",
  "sources": [
    {
      "num": 1,
      "type": "fragment eseju",
      "title": "<tytuł eseju>",
      "author": "<imię i nazwisko autora>",
      "text": "<ok. 150 słów — fragment eseju na zadany temat, napisany stylem humanistycznym>"
    },
    {
      "num": 2,
      "type": "artykuł publicystyczny",
      "title": "<tytuł artykułu>",
      "author": "<autor>",
      "text": "<ok. 150 słów — artykuł o nieco innym ujęciu tematu>"
    },
    {
      "num": 3,
      "type": "wywiad",
      "title": "<tytuł wywiadu>",
      "author": "<autor>",
      "text": "<ok. 120 słów — fragment wywiadu z ekspertem lub badaczem>"
    }
  ],
  "instruction": "Na podstawie podanych tekstów napisz notatkę syntetyzującą na temat: ${topic}. W notatce uwzględnij informacje ze wszystkich trzech tekstów. Twoja wypowiedź powinna być syntezą, a nie streszczeniem.",
  "maxPoints": 15
}`;

    const result = await generateJSON<SynthesisResult>(prompt);
    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error("[generate-synthesis]", error);
    const message = error instanceof Error ? error.message : "Błąd generowania";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
