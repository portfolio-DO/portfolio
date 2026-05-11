/**
 * types/index.ts
 * Globalne typy TypeScript dla MaturAI
 */

// ============================================================
// SUBSKRYPCJA
// ============================================================

export type SubscriptionPlan = "FREE" | "PREMIUM";

export interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  isActive: boolean;
  expiresAt?: Date | null;
}

// ============================================================
// STATYSTYKI
// ============================================================

export interface UserStats {
  totalEssays: number;
  totalMathTasks: number;
  totalSynthesis: number;
  currentStreak: number;
  longestStreak: number;
  avgEssayScore: number;
  avgMathScore: number;
  avgSynthScore: number;
  level: number;
  xp: number;
}

// ============================================================
// ROZPRAWKA
// ============================================================

export interface EssayCriterion {
  name: string;
  score: number;
  max: number;
  comment?: string;
}

export interface EssayFeedback {
  type: "good" | "warn" | "bad";
  text: string;
}

export interface EssayScore {
  totalScore: number;
  maxScore: number;
  criteria: EssayCriterion[];
  feedback: EssayFeedback[];
  summary: string;
  sentenceAnalysis?: SentenceAnalysis[];
  betterArguments?: string[];
}

export interface SentenceAnalysis {
  sentence: string;
  comment: string;
  type: "good" | "warn" | "bad";
}

export interface Essay {
  id: string;
  topic: string;
  content: string;
  wordCount: number;
  totalScore?: number;
  maxScore?: number;
  criteriaJson?: string;
  feedbackJson?: string;
  summary?: string;
  isPremiumAnalysis: boolean;
  createdAt: Date;
}

// ============================================================
// MATEMATYKA
// ============================================================

export type MathDifficulty = "easy" | "medium" | "hard";
export type MathTaskType = "closed" | "open";
export type MathLevel = "podstawowa" | "rozszerzona";

export interface MathTask {
  id: number;
  type: MathTaskType;
  difficulty: MathDifficulty;
  points: number;
  content: string;
  options?: string[];
  correctAnswer: string;
  solution: string;
  hints?: string[];
}

export interface MathAttemptResult {
  taskId: number;
  userAnswer: string;
  isCorrect: boolean;
  pointsEarned: number;
}

// ============================================================
// NOTATKA SYNTETYZUJĄCA
// ============================================================

export interface SourceText {
  num: number;
  type: string;
  title: string;
  author: string;
  text: string;
}

export interface SynthesisTask {
  topic: string;
  sources: SourceText[];
  instruction: string;
  maxPoints: number;
}

export interface SynthesisCriterion {
  name: string;
  score: number;
  max: number;
}

export interface SynthesisScore {
  score: number;
  maxScore: number;
  criteria: SynthesisCriterion[];
  summary: string;
}

// ============================================================
// API RESPONSES
// ============================================================

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ============================================================
// NAV
// ============================================================

export type NavPanel = "dashboard" | "essay" | "math" | "synthesis" | "stats";
