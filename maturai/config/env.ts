/**
 * config/env.ts
 * Walidacja zmiennych środowiskowych przy starcie aplikacji
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Brakuje zmiennej środowiskowej: ${key}\n` +
      `Skopiuj .env.example do .env.local i uzupełnij wartości.`
    );
  }
  return value;
}

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const env = {
  // Gemini API — wymagany do funkcji AI
  GEMINI_API_KEY: optionalEnv("GEMINI_API_KEY"),

  // Baza danych
  DATABASE_URL: optionalEnv("DATABASE_URL"),

  // NextAuth
  NEXTAUTH_SECRET: optionalEnv("NEXTAUTH_SECRET", "dev-secret-change-in-production"),
  NEXTAUTH_URL: optionalEnv("NEXTAUTH_URL", "http://localhost:3000"),

  // Google OAuth (opcjonalne)
  GOOGLE_CLIENT_ID: optionalEnv("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: optionalEnv("GOOGLE_CLIENT_SECRET"),

  // Środowisko
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  IS_PRODUCTION: process.env.NODE_ENV === "production",

  // Flagi
  get hasGeminiKey(): boolean {
    return Boolean(this.GEMINI_API_KEY);
  },
  get hasDatabase(): boolean {
    return Boolean(this.DATABASE_URL);
  },
} as const;
