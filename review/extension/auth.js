// auth.js — Review Responder Pro v3
// Działa zarówno z Supabase (pełna wersja) jak i lokalnie (bez konfiguracji)

const Auth = (() => {
  'use strict';

  const cfg = typeof CONFIG !== 'undefined' ? CONFIG : {};
  const SUPABASE_URL  = (cfg.SUPABASE_URL  || '').replace(/\/$/, '');
  const SUPABASE_ANON = cfg.SUPABASE_ANON_KEY || '';
  const SUPABASE_OK   = !!SUPABASE_URL
    && !SUPABASE_URL.includes('YOUR_PROJECT_ID')
    && SUPABASE_URL.startsWith('https://')
    && !!SUPABASE_ANON;

  let _session      = null;
  let _refreshTimer = null;

  function isSupabaseConfigured() { return SUPABASE_OK; }

  // ── Tłumaczenie błędów ─────────────────────────────────────────
  function _translateError(raw, code) {
    const m = (raw || '').toLowerCase();
    if (code === 429 || m.includes('rate limit') || m.includes('too many'))
      return 'Zbyt wiele prób. Odczekaj 1-2 minuty i spróbuj ponownie.';
    if (m.includes('user already registered') || m.includes('already been registered'))
      return 'Ten e-mail jest już zarejestrowany — przejdź na zakładkę Logowanie.';
    if (m.includes('invalid login credentials') || m.includes('invalid email or password') || m.includes('invalid credentials'))
      return 'Nieprawidłowy e-mail lub hasło.';
    // FIX 1: Dodano obsługę błędu "invalid api key" — to błąd konfiguracji, nie złe hasło
    if (m.includes('invalid api key') || m.includes('apikey') || code === 401)
      return 'Błąd konfiguracji wtyczki (nieprawidłowy klucz API Supabase). Sprawdź SUPABASE_ANON_KEY w config.js.';
    if (m.includes('email not confirmed'))
      return 'Potwierdź adres e-mail — kliknij link w wiadomości od Supabase. Lub wyłącz "Confirm email" w Supabase → Authentication → Providers → Email.';
    if (m.includes('weak') && m.includes('password'))
      return 'Hasło jest za słabe — użyj min. 8 znaków z cyframi i literami.';
    if (code === 400) return 'Nieprawidłowe dane. Sprawdź e-mail i hasło.';
    if (code === 422) return 'Nieprawidłowy format e-maila.';
    if (m.includes('network') || m.includes('failed to fetch'))
      return 'Brak połączenia z serwerem — sprawdź internet.';
    return raw || `Błąd serwera (${code || '?'})`;
  }

  // ── REST helper (tylko gdy Supabase skonfigurowany) ────────────
  async function sbFetch(path, opts = {}) {
    // FIX 2: opts.headers nie może nadpisywać apikey i Authorization —
    // budujemy nagłówki w odpowiedniej kolejności: najpierw bazowe, potem opts,
    // ale apikey i Authorization zawsze wygrywają (są ustawiane na końcu)
    const { headers: extraHeaders, ...restOpts } = opts;
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders,           // opcjonalne nagłówki z wywołania
      'apikey': SUPABASE_ANON,  // apikey zawsze nadpisuje — nigdy nie może zostać zmieniony
    };
    // Authorization: Bearer ustawiamy z aktywnej sesji (jeśli istnieje)
    if (_session?.access_token) {
      headers['Authorization'] = 'Bearer ' + _session.access_token;
    }
    let res, data;
    try {
      res  = await fetch(SUPABASE_URL + path, { ...restOpts, headers });
      data = await res.json().catch(() => ({}));
    } catch (_) {
      throw new Error('Brak połączenia z serwerem — sprawdź internet.');
    }
    if (!res.ok) {
      throw new Error(_translateError(
        data.error_description || data.message || data.error || data.msg || '',
        res.status
      ));
    }
    return data;
  }

  // ── Lokalny hash hasła (dla trybu offline) ─────────────────────
  async function _hashPassword(password) {
    const buf = await crypto.subtle.digest('SHA-256',
      new TextEncoder().encode(password + 'rrp_salt_v3'));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  // ── LOGOWANIE LOKALNE (bez Supabase) ──────────────────────────
  async function _localSignIn(email, password) {
    const stored = await chrome.storage.local.get('rrp_local_accounts');
    const accounts = stored.rrp_local_accounts || {};
    const acc = accounts[email.toLowerCase()];
    if (!acc) throw new Error('Nie ma konta z tym adresem e-mail. Utwórz konto najpierw.');
    const hash = await _hashPassword(password);
    if (hash !== acc.passwordHash) throw new Error('Nieprawidłowy e-mail lub hasło.');
    const session = {
      access_token: 'local_' + Date.now(),
      refresh_token: 'local_refresh',
      expires_at: Math.floor(Date.now() / 1000) + 30 * 24 * 3600, // 30 dni lokalnie
      user: { id: acc.id, email: email.toLowerCase() },
      _isLocal: true,
    };
    _session = session;
    await chrome.storage.local.set({ rrp_session: session });
    return session;
  }

  // ── REJESTRACJA LOKALNA (bez Supabase) ─────────────────────────
  async function _localSignUp(email, password) {
    const stored = await chrome.storage.local.get('rrp_local_accounts');
    const accounts = stored.rrp_local_accounts || {};
    const key = email.toLowerCase();
    if (accounts[key]) {
      // Konto istnieje — spróbuj zalogować
      return await _localSignIn(email, password);
    }
    const id = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    accounts[key] = { id, email: key, passwordHash: await _hashPassword(password), createdAt: Date.now() };
    await chrome.storage.local.set({ rrp_local_accounts: accounts });
    return await _localSignIn(email, password);
  }

  // ── Zapis sesji + zaplanuj refresh ────────────────────────────
  async function _saveSession(data) {
    if (!data?.access_token) return;
    if (data.expires_in && !data.expires_at)
      data.expires_at = Math.floor(Date.now() / 1000) + data.expires_in;
    _session = data;
    await chrome.storage.local.set({ rrp_session: data });
    if (!data._isLocal) _scheduleRefresh(data);
  }

  function _scheduleRefresh(data) {
    if (_refreshTimer) clearTimeout(_refreshTimer);
    if (!data?.expires_at || !data?.refresh_token) return;
    const msLeft = (data.expires_at * 1000) - Date.now() - 5 * 60 * 1000;
    _refreshTimer = setTimeout(_doRefresh, Math.max(msLeft, 30000));
  }

  async function _doRefresh() {
    if (!SUPABASE_OK) return;
    const stored = await chrome.storage.local.get('rrp_session');
    const rt = stored.rrp_session?.refresh_token;
    if (!rt || rt.startsWith('local_')) return;
    try {
      const data = await sbFetch('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: JSON.stringify({ refresh_token: rt }),
      });
      await _saveSession(data);
    } catch (_) {
      _session = null;
      await chrome.storage.local.remove(['rrp_session', 'rrp_user_profile']);
    }
  }

  // ── getSession ─────────────────────────────────────────────────
  async function getSession() {
    if (_session?.access_token) {
      const remaining = (_session.expires_at || 0) * 1000 - Date.now();
      if (remaining > 60 * 1000) return _session;
    }
    const stored = await chrome.storage.local.get('rrp_session');
    const s = stored.rrp_session;
    if (!s?.access_token) return null;

    const remaining = (s.expires_at || 0) * 1000 - Date.now();

    // Local sessions last 30 days
    if (s._isLocal && remaining > 0) {
      _session = s;
      return _session;
    }

    if (!s._isLocal && remaining > 60 * 1000) {
      _session = s;
      _scheduleRefresh(s);
      return _session;
    }

    // Try refresh for Supabase sessions
    if (!s._isLocal && s.refresh_token && SUPABASE_OK) {
      try {
        const data = await sbFetch('/auth/v1/token?grant_type=refresh_token', {
          method: 'POST', body: JSON.stringify({ refresh_token: s.refresh_token }),
        });
        await _saveSession(data);
        return _session;
      } catch (_) {}
    }

    _session = null;
    await chrome.storage.local.remove(['rrp_session', 'rrp_user_profile']);
    return null;
  }

  // ── signUp ─────────────────────────────────────────────────────
  async function signUp(email, password) {
    if (!SUPABASE_OK) return await _localSignUp(email, password);
    let data;
    try {
      data = await sbFetch('/auth/v1/signup', {
        method: 'POST', body: JSON.stringify({ email, password }),
      });
    } catch (e) {
      if (e.message.includes('już zarejestrowany') || e.message.includes('already registered')) {
        return await signIn(email, password);
      }
      throw e;
    }
    if (!data.access_token) {
      try { return await signIn(email, password); }
      catch (_) {
        throw new Error('Konto założone! Sprawdź skrzynkę i kliknij link aktywacyjny, następnie zaloguj się. Lub wyłącz "Confirm email" w Supabase Dashboard.');
      }
    }
    await _saveSession(data);
    return data;
  }

  // ── signIn ─────────────────────────────────────────────────────
  async function signIn(email, password) {
    if (!SUPABASE_OK) return await _localSignIn(email, password);
    const data = await sbFetch('/auth/v1/token?grant_type=password', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    await _saveSession(data);
    return data;
  }

  // ── signOut ────────────────────────────────────────────────────
  async function signOut() {
    if (_refreshTimer) clearTimeout(_refreshTimer);
    if (!_session?._isLocal && _session?.access_token && SUPABASE_OK) {
      try { await sbFetch('/auth/v1/logout', { method: 'POST' }); } catch (_) {}
    }
    _session = null;
    await chrome.storage.local.remove(['rrp_session', 'rrp_user_profile']);
  }

  function getUser() { return _session?.user || null; }

  // ── Profil użytkownika ─────────────────────────────────────────
  async function getUserProfile() {
    const user = getUser();
    if (!user) return null;
    if (_session?._isLocal) return null; // local sessions have no DB profile

    const cache = await chrome.storage.local.get('rrp_user_profile');
    const p = cache.rrp_user_profile;
    if (p && (Date.now() - (p._cachedAt || 0)) < 300000) return p;
    try {
      const arr = await sbFetch(
        `/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=*&limit=1`,
        { headers: { 'Accept': 'application/json' } }
      );
      const row = Array.isArray(arr) ? arr[0] : arr;
      if (!row) return null;
      row._cachedAt = Date.now();
      await chrome.storage.local.set({ rrp_user_profile: row });
      return row;
    } catch (_) { return null; }
  }

  async function _invalidateProfileCache() {
    await chrome.storage.local.remove('rrp_user_profile');
  }

  // ── Stan użycia ────────────────────────────────────────────────
  async function getUsageState() {
    const session = await getSession();
    if (!session) return _getLocalUsage();

    // Local sessions: always use local usage tracking
    if (session._isLocal || !SUPABASE_OK) return _getLocalUsage();

    const profile = await getUserProfile();
    if (!profile) return _getLocalUsage();

    const isPremium = profile.plan === 'premium'
      && profile.premium_until
      && new Date(profile.premium_until) > new Date();

    return {
      plan: isPremium ? 'premium' : 'free', isPremium,
      bonusUsed:    profile.bonus_used        || 0,
      bonusTotal:   cfg.FREE_BONUS_GENERATIONS  || 15,
      monthlyUsed:  profile.monthly_ai_count   || 0,
      monthlyLimit: isPremium ? (cfg.PREMIUM_MONTHLY_GENERATIONS || 500) : (cfg.FREE_MONTHLY_GENERATIONS || 5),
      premiumUntil: profile.premium_until || null,
      email:        session.user?.email   || '',
    };
  }

  async function _getLocalUsage() {
    const stored   = await chrome.storage.local.get(['rrp_usage', 'rrp_usage_month']);
    const now      = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const usage    = stored.rrp_usage || { bonusUsed: 0 };
    const monthData = stored.rrp_usage_month?.key === monthKey
      ? stored.rrp_usage_month : { key: monthKey, count: 0 };
    const session = _session;
    return {
      plan: 'free', isPremium: false,
      bonusUsed:    usage.bonusUsed  || 0,
      bonusTotal:   cfg.FREE_BONUS_GENERATIONS  || 15,
      monthlyUsed:  monthData.count  || 0,
      monthlyLimit: cfg.FREE_MONTHLY_GENERATIONS || 5,
      email:        session?.user?.email || '',
    };
  }

  async function canGenerateAI() {
    const s = await getUsageState();
    if (s.isPremium)                    return { allowed: true,  reason: 'premium' };
    if (s.bonusUsed   < s.bonusTotal)   return { allowed: true,  reason: 'bonus' };
    if (s.monthlyUsed < s.monthlyLimit) return { allowed: true,  reason: 'monthly' };
    return { allowed: false, reason: 'limit_reached',
      message: 'Osiągnięto limit. Odblokuj 500 odpowiedzi miesięcznie w wersji Premium.' };
  }

  async function recordAIGeneration() {
    const session = await getSession();
    if (!session || session._isLocal || !SUPABASE_OK) return _recordLocal();
    await _invalidateProfileCache();
  }

  async function _recordLocal() {
    const stored   = await chrome.storage.local.get(['rrp_usage', 'rrp_usage_month']);
    const now      = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const usage    = stored.rrp_usage || { bonusUsed: 0 };
    let month      = stored.rrp_usage_month?.key === monthKey
      ? stored.rrp_usage_month : { key: monthKey, count: 0 };
    if ((usage.bonusUsed || 0) < (cfg.FREE_BONUS_GENERATIONS || 15)) {
      usage.bonusUsed = (usage.bonusUsed || 0) + 1;
    } else {
      month.count = (month.count || 0) + 1;
    }
    await chrome.storage.local.set({ rrp_usage: usage, rrp_usage_month: month });
  }

  // FIX 3: createCheckoutSession — usunięto duplikat Authorization z opts.headers,
  // bo sbFetch już sam go dodaje z _session.access_token
  async function createCheckoutSession() {
    if (!SUPABASE_OK) throw new Error('SUPABASE_NOT_CONFIGURED');

    const session = await getSession();
    if (!session?.access_token) {
      throw new Error('Brak sesji użytkownika - zaloguj się ponownie');
    }

    // Nie przekazujemy Authorization tutaj — sbFetch doda go automatycznie z _session
    const data = await sbFetch('/functions/v1/stripe-checkout', {
      method: 'POST',
      body: JSON.stringify({
        userId: session.user.id,
      }),
    });

    return data.url;
  }

  return {
    signUp, signIn, signOut,
    getSession, getUser, isSupabaseConfigured,
    getUserProfile, getUsageState,
    canGenerateAI, recordAIGeneration, createCheckoutSession,
  };
})();