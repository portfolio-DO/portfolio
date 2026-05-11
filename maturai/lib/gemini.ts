/**
 * lib/gemini.ts
 * Klient Google Gemini AI
 * Klucz API: ustaw GEMINI_API_KEY w .env.local
 */

import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from "@google/generative-ai";

// ============================================================
// INICJALIZACJA
// ============================================================

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Brak klucza GEMINI_API_KEY. Dodaj go do pliku .env.local.\n" +
      "Utwórz klucz na: https://aistudio.google.com/app/apikey"
    );
  }

  return new GoogleGenerativeAI(apiKey);
}

// ============================================================
// DOMYŚLNA KONFIGURACJA GENEROWANIA
// ============================================================

const DEFAULT_CONFIG: GenerationConfig = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 4096,
};

const JSON_CONFIG: GenerationConfig = {
  temperature: 0.3,   // Niższa temperatura dla bardziej przewidywalnego JSON
  topP: 0.9,
  topK: 20,
  maxOutputTokens: 2048,
};

// ============================================================
// GŁÓWNA FUNKCJA: generateText
// ============================================================

export async function generateText(
  prompt: string,
  config: Partial<GenerationConfig> = {}
): Promise<string> {
  const client = getGeminiClient();
  const model: GenerativeModel = client.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { ...DEFAULT_CONFIG, ...config },
  });

  const result = await model.generateContent(prompt);
  const response = result.response;

  if (!response.text()) {
    throw new Error("Gemini zwróciło pustą odpowiedź.");
  }

  return response.text();
}

// ============================================================
// FUNKCJA: generateJSON — parsuje JSON z odpowiedzi modelu
// ============================================================

export async function generateJSON<T>(
  prompt: string,
  config: Partial<GenerationConfig> = {}
): Promise<T> {
  const client = getGeminiClient();
  const model: GenerativeModel = client.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { ...JSON_CONFIG, ...config },
  });

  const fullPrompt = `${prompt}\n\nODPOWIEDZ TYLKO CZYSTYM JSON BEZ ŻADNYCH INNYCH ZNAKÓW, BEZ MARKDOWN, BEZ BACKTICKS.`;
  const result = await model.generateContent(fullPrompt);
  const text = result.response.text();

  // Oczyść odpowiedź z ewentualnych bloków kodu
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Nie udało się sparsować odpowiedzi JSON: ${cleaned.slice(0, 200)}`);
  }
}

// ============================================================
// FUNKCJA: sprawdź dostępność API
// ============================================================

export async function checkGeminiConnection(): Promise<boolean> {
  try {
    await generateText("Odpowiedz jednym słowem: OK", { maxOutputTokens: 10 });
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// TYPY ODPOWIEDZI AI
// ============================================================

export interface EssayAnalysisResult {
  totalScore: number;
  maxScore: number;
  criteria: Array<{
    name: string;
    score: number;
    max: number;
    comment?: string;
  }>;
  feedback: Array<{
    type: "good" | "warn" | "bad";
    text: string;
  }>;
  summary: string;
  // Premium
  sentenceAnalysis?: Array<{
    sentence: string;
    comment: string;
    type: "good" | "warn" | "bad";
  }>;
  betterArguments?: string[];
}

export interface MathTasksResult {
  tasks: Array<{
    id: number;
    type: "closed" | "open";
    difficulty: "easy" | "medium" | "hard";
    points: number;
    content: string;
    options?: string[];
    correctAnswer: string;
    solution: string;
    hints?: string[];
  }>;
}

export interface SynthesisResult {
  topic: string;
  sources: Array<{
    num: number;
    type: string;
    title: string;
    author: string;
    text: string;
  }>;
  instruction: string;
  maxPoints: number;
}

export interface SynthesisAnalysisResult {
  score: number;
  maxScore: number;
  criteria: Array<{
    name: string;
    score: number;
    max: number;
  }>;
  summary: string;
}
