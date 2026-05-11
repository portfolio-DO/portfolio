// background.js — Review Responder Pro v3 Service Worker

importScripts('config.js');
importScripts('templates_pl.js');

// ── Template Matching — naprawiony algorytm ────────────────────
function matchTemplates(reviewText, rating, isPremium, shortOnly) {
  const lc = reviewText.toLowerCase();

  // Dostępne szablony (darmowe lub premium)
  const available = isPremium
    ? POLISH_TEMPLATES
    : POLISH_TEMPLATES.filter(t => !t.premium);

  // Ustal kategorię recenzji na podstawie gwiazdek
  const isNegative = rating !== null && rating !== undefined && rating <= 2;
  const isPositive = rating !== null && rating !== undefined && rating >= 4;
  const isNeutral  = rating === 3;

  // Rozszerzony zestaw słów kluczowych dla negatywnych recenzji
  const negativeSignals = [
    'rozczarowany','rozczarowana','słaba','słaby','kiepski','okropny',
    'straszny','fatalne','skandal','niedopuszczalne','do niczego',
    'nie polecam','żenada','zawód','zła','zły','złe','fatalny',
    'beznadziejny','tragiczny','okropna','koszmarny','niezadowolony',
    'niezadowolona','wstyd','hańba','katastrofa','nieakceptowalne',
    'nieprofesjonalny','nieprofesjonalna','nieuprzejmy','chamski',
    'arogancki','zignorowano','zignorował','ignorował','zimna',
    'zimne','zimny','nieświeże','zepsute','brudny','brudna','brudne',
    'za drogo','przepłaciłem','przepłaciłam','czekałem','czekałam',
    'długo czekać','nie wrócimy','więcej nie','ostatni raz',
    'nigdy więcej','omijajcie','omijać','unikajcie','nie warto',
  ];

  const positiveSignals = [
    'świetnie','super','polecam','rewelacja','doskonale','perfekcyjnie',
    'wspaniale','brawo','pięknie','cudownie','fajnie','bardzo dobrze',
    'zadowolony','zadowolona','pyszne','smaczne','miła obsługa',
    'przyjemna','przyjemny','polecam','wrócimy','na pewno wrócimy',
    'zdecydowanie polecam','gorąco polecam','5 gwiazdek','pięć gwiazdek',
    'najlepszy','najlepsza','niesamowity','niesamowita','super miejsce',
    'wspaniała','cudowna','doskonała','idealne',
  ];

  const scored = available.map(t => {
    const keywords = PL_CATEGORY_KEYWORDS[t.category] || [];
    let score = 0;

    // 1. Dopasowanie słów kluczowych z recenzji
    keywords.forEach(kw => {
      if (lc.includes(kw.toLowerCase())) score += 2;
    });

    // 2. Sygnały pozytywne/negatywne z tekstu
    const hasNegText = negativeSignals.some(w => lc.includes(w));
    const hasPosText = positiveSignals.some(w => lc.includes(w));

    // 3. Boosty na podstawie GWIAZDEK (to jest kluczowe!)
    if (isNegative) {
      if (['negative','apologies_service','contact_request','speed','cleanliness'].includes(t.category)) {
        score += 6; // mocny boost dla negatywnych kategorii
      }
      if (['positive','enthusiastic'].includes(t.category)) {
        score -= 10; // kara za pokazywanie pozytywnych szablonów
      }
    }

    if (isPositive) {
      if (['positive','enthusiastic','followup'].includes(t.category)) {
        score += 6;
      }
      if (['negative','apologies_service'].includes(t.category)) {
        score -= 10;
      }
    }

    if (isNeutral) {
      if (['neutral','contact_request'].includes(t.category)) score += 4;
      if (['negative','positive'].includes(t.category)) score -= 3;
    }

    // 4. Boosty na podstawie TEKSTU recenzji
    if (hasNegText) {
      if (['negative','apologies_service','contact_request'].includes(t.category)) score += 4;
      if (['positive','enthusiastic'].includes(t.category)) score -= 8;
    }

    if (hasPosText) {
      if (['positive','enthusiastic','followup'].includes(t.category)) score += 4;
      if (['negative','apologies_service'].includes(t.category)) score -= 8;
    }

    // 5. Preferuj krótkie jeśli ustawione
    if (shortOnly && t.length !== 'short') score -= 4;

    return { template: t, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Top 3 z pozytywnym wynikiem
  let top = scored.filter(s => s.score > 0).slice(0, 3);

  // Fallback: jeśli brak wyników, użyj ogólnych negatywnych lub pozytywnych
  if (!top.length) {
    const fallbackCat = isNegative ? 'negative' : isPositive ? 'positive' : 'negative';
    const fallbacks = available
      .filter(t => t.category === fallbackCat || t.category === 'apologies_service')
      .slice(0, 3);
    top = fallbacks.map(t => ({ template: t, score: 1 }));
  }

  return top;
}

// ── AI Prompt ──────────────────────────────────────────────────
function buildAIPrompt(reviewText, reviewer, rating, settings) {
  const businessName = settings?.businessName || 'nasza firma';
  const ownerName    = settings?.ownerName    || 'Zespół';
  const tone         = settings?.replyTone    || 'profesjonalny i ciepły';
  const length       = settings?.replyLength  || 'medium';

  const lengthHint = {
    short:  'Napisz KRÓTKĄ odpowiedź (maksymalnie 2 zdania).',
    medium: 'Napisz odpowiedź (2-4 zdania).',
    long:   'Napisz rozbudowaną, profesjonalną odpowiedź (4-6 zdań).',
  }[length] || 'Napisz odpowiedź (2-4 zdania).';

  const styles = [
    'Zacznij od spersonalizowanego zwrotu.',
    'Bądź konkretny — odnieś się do treści recenzji.',
    'Zakończ zaproszeniem lub propozycją rozwiązania.',
    'Użyj naturalnego, ludzkiego języka — nie korporacyjnego.',
  ];
  const styleHint = styles[Math.floor(Math.random() * styles.length)];

  const system = `Jesteś właścicielem firmy "${businessName}" i odpowiadasz na recenzję klienta w Google Maps.
Ton: ${tone}. Podpisz się jako: ${ownerName}, ${businessName}.
ZASADY: pisz po polsku | ${lengthHint} | ${styleHint}
Nie używaj: "Dziękujemy za cenny komentarz", "feedback", "Twoja opinia jest dla nas ważna"
Nie ujawniaj oceny gwiazdkowej wprost. Nie używaj nawiasów kwadratowych [].`;

  const isPositive = rating && rating >= 4;
  const isNegative = rating && rating <= 2;
  const stars = rating ? `${rating}/5` : 'nieznana';

  const context = isPositive
    ? 'To POZYTYWNA recenzja — podziękuj ciepło, osobiście, konkretnie.'
    : isNegative
    ? 'To NEGATYWNA recenzja — przeproś szczerze, zaproponuj konkretne rozwiązanie i kontakt.'
    : 'To NEUTRALNA recenzja — odpowiedz wyważenie, zaproś ponownie.';

  const userMsg = `Ocena: ${stars} gwiazdek. Autor: ${reviewer || 'Klient'}.
Treść: "${reviewText}"

${context}`;

  return { system, userMsg };
}

// ── Analytics ──────────────────────────────────────────────────
async function appendAnalytics(entry) {
  const data = await chrome.storage.local.get('rrp_analytics');
  const log = data.rrp_analytics || [];
  log.unshift({ ...entry, ts: Date.now() });
  if (log.length > 200) log.splice(200);
  await chrome.storage.local.set({ rrp_analytics: log });
}


// ── Premium status check ──────────────────────────────────────────
// Calls verify-premium Edge Function which checks Stripe directly
// This is more reliable than webhook (no 404 issues)
async function checkPremiumStatus(userId) {
  const cfg = typeof CONFIG !== 'undefined' ? CONFIG : {};
  const supabaseUrl  = (cfg.SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseAnon = cfg.SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || supabaseUrl.includes('YOUR_PROJECT_ID')) return null;

  const stored = await chrome.storage.local.get('rrp_session');
  const token  = stored.rrp_session?.access_token;
  if (!token || token.startsWith('local_')) return null;

  try {
    // STRATEGY 1: Call verify-premium Edge Function (checks Stripe directly)
    const res = await fetch(`${supabaseUrl}/functions/v1/verify-premium`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'apikey': supabaseAnon,
      },
      body: JSON.stringify({ userId }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.isPremium) {
        // Invalidate local cache
        await chrome.storage.local.remove('rrp_user_profile');
        return { isPremium: true, plan: 'premium', premiumUntil: data.premiumUntil };
      }
      return { isPremium: false, plan: 'free' };
    }

    // STRATEGY 2: Fallback — read from Supabase REST (cache may be stale)
    const res2 = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=plan,premium_until&limit=1`,
      { headers: { 'apikey': supabaseAnon, 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' } }
    );
    if (!res2.ok) return null;
    const arr = await res2.json();
    const row = Array.isArray(arr) ? arr[0] : arr;
    if (!row) return null;
    const isPremium = row.plan === 'premium' && row.premium_until && new Date(row.premium_until) > new Date();
    return { isPremium, plan: row.plan, premiumUntil: row.premium_until };

  } catch (_) { return null; }
}

// Polling state (lives in service worker — survives popup close)
let _pollInterval = null;
let _pollCount    = 0;
const POLL_MAX    = 75; // ~10 minutes at 8s interval

function startPremiumPoll(userId) {
  if (_pollInterval) return; // already running
  _pollCount = 0;
  _pollInterval = setInterval(async () => {
    _pollCount++;
    if (_pollCount > POLL_MAX) {
      clearInterval(_pollInterval); _pollInterval = null; return;
    }
    const status = await checkPremiumStatus(userId);
    if (status?.isPremium) {
      clearInterval(_pollInterval); _pollInterval = null;
      // Invalidate profile cache so popup gets fresh data
      await chrome.storage.local.remove('rrp_user_profile');
      // Notify popup if it's open
      chrome.runtime.sendMessage({ type: 'PREMIUM_ACTIVATED', status }).catch(() => {});
    }
  }, 8000);
}

// ── Message Router ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'MATCH_TEMPLATES') {
    const results = matchTemplates(
      msg.reviewText || '',
      msg.rating ?? null,       // <— gwiazdki teraz przekazywane
      msg.isPremium || false,
      msg.shortOnly || false
    );
    sendResponse({ templates: results });
    return true;
  }

  if (msg.type === 'BUILD_AI_PROMPT') {
    const { system, userMsg } = buildAIPrompt(
      msg.reviewText, msg.reviewer, msg.rating, msg.settings
    );
    sendResponse({ system, userMsg });
    return true;
  }

  if (msg.type === 'LOG_ANALYTICS') {
    appendAnalytics(msg.entry).catch(console.error);
    return false;
  }

  if (msg.type === 'GET_ANALYTICS') {
    chrome.storage.local.get('rrp_analytics')
      .then(d => sendResponse({ log: d.rrp_analytics || [] }));
    return true;
  }

  if (msg.type === 'CLEAR_ANALYTICS') {
    chrome.storage.local.set({ rrp_analytics: [] })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'REVIEW_COUNT') {
    const count = msg.count || 0;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
    return false;
  }

  if (msg.type === 'START_PREMIUM_POLL') {
    startPremiumPoll(msg.userId);
    return false;
  }

  if (msg.type === 'CHECK_PREMIUM_NOW') {
    checkPremiumStatus(msg.userId)
      .then(status => sendResponse({ status }));
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Review Responder Pro v3 installed');
});
