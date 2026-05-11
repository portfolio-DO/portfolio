// config.js — Review Responder Pro v3
// FRONTEND CONFIG (UI ONLY)

const CONFIG = {

  // ── SUPABASE (PUBLIC) ────────────────────────────────────────
  SUPABASE_URL: '',

  SUPABASE_ANON_KEY:
    '',

  // ── STRIPE (PUBLIC) ─────────────────────────────────────────
  STRIPE_PUBLISHABLE_KEY:
    '',

  // ⚠️ fallback only (NIE używaj do głównego flow)
  STRIPE_DIRECT_LINK:
    '',

  // ── UI / DISPLAY LIMITS (NOT ENFORCEMENT) ───────────────────
  LIMITS: {
    FREE_BONUS_GENERATIONS: 15,
    FREE_MONTHLY_GENERATIONS: 5,
    PREMIUM_MONTHLY_GENERATIONS: 500,
  },

  // ── APP INFO ────────────────────────────────────────────────
  APP_VERSION: '3.0.0',
}

if (typeof module !== 'undefined') module.exports = CONFIG;