import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Brak GEMINI_API_KEY" }, { status: 500 });

  const results: Record<string, unknown> = {
    keyPrefix: apiKey.slice(0, 10) + "...",
    keyLength: apiKey.length,
  };

  // Lista modeli
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const d = await r.json();
    if (r.ok) {
      results.availableModels = (d.models || [])
        .filter((m: {supportedGenerationMethods?: string[]}) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: {name: string}) => m.name);
    } else {
      results.listError = d?.error?.message;
    }
  } catch (e) { results.listError = String(e); }

  // Test modeli
  const toTest = ["gemini-2.0-flash","gemini-2.0-flash-lite","gemini-1.5-flash","gemini-2.5-flash-preview-04-17","gemini-pro"];
  const tests = [];
  for (const model of toTest) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: "Say OK" }] }], generationConfig: { maxOutputTokens: 5 } }) }
      );
      const d = await r.json();
      tests.push({ model, ok: r.ok, error: r.ok ? null : d?.error?.message?.slice(0, 120) });
    } catch (e) { tests.push({ model, ok: false, error: String(e) }); }
  }
  results.tests = tests;

  return NextResponse.json(results);
}
