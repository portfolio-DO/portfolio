// popup.js — Review Responder Pro v3 — Complete rewrite
'use strict';

// ─── State ──────────────────────────────────────────────────────
let _settings      = {};
let _customTpls    = [];
let _usageState    = null;
let _reviews       = [];        // all reviews from current page
let _activeReview  = null;      // currently selected review
let _editorText    = '';
let _mode          = 'both';
let _aiCooldown    = 0;

const $ = id => document.getElementById(id);

// ─── Boot ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadCustomTpls();
  checkSupabaseConfig();
  setupAuthTabs();
  await tryRestoreSession();
});

// ─── Config warning ──────────────────────────────────────────────
function checkSupabaseConfig() {
  const el = $('supabase-note');
  if (!el) return;
  if (!Auth.isSupabaseConfigured()) {
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

// ─── Auth screen setup ───────────────────────────────────────────
function setupAuthTabs() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
      tab.classList.add('active');
      const form = $('auth-' + tab.dataset.auth);
      if (form) form.classList.remove('hidden');
    });
  });

  // Enter key triggers login/register
  [$('login-pass'), $('login-email')].forEach(el => {
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-login')?.click(); });
  });
  [$('reg-pass2'), $('reg-pass'), $('reg-email')].forEach(el => {
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-register')?.click(); });
  });

  const btnLogin = $('btn-login');
  if (btnLogin) btnLogin.addEventListener('click', async () => {
    const email = $('login-email').value.trim();
    const pass  = $('login-pass').value;
    $('login-error').textContent = '';
    if (!email || !pass) { $('login-error').textContent = 'Wypełnij e-mail i hasło.'; return; }
    setBtnLoading(btnLogin, 'Logowanie…');
    try {
      await Auth.signIn(email, pass);
      await enterApp();
    } catch (e) {
      $('login-error').textContent = e.message || 'Błąd logowania.';
    } finally {
      setBtnNormal(btnLogin, 'Zaloguj się');
    }
  });

  const btnReg = $('btn-register');
  if (btnReg) btnReg.addEventListener('click', async () => {
    const email = $('reg-email').value.trim();
    const pass  = $('reg-pass').value;
    const pass2 = $('reg-pass2')?.value;
    $('reg-error').textContent = '';
    if (!email)          { $('reg-error').textContent = 'Podaj adres e-mail.'; return; }
    if (pass.length < 8) { $('reg-error').textContent = 'Hasło musi mieć min. 8 znaków.'; return; }
    if (pass2 !== undefined && pass !== pass2) { $('reg-error').textContent = 'Hasła nie są identyczne.'; return; }
    setBtnLoading(btnReg, 'Tworzenie konta…');
    try {
      await Auth.signUp(email, pass);
      await enterApp();
    } catch (e) {
      $('reg-error').textContent = e.message || 'Błąd rejestracji.';
    } finally {
      setBtnNormal(btnReg, 'Utwórz konto za darmo');
    }
  });
}

async function tryRestoreSession() {
  try {
    const s = await Auth.getSession();
    if (s?.access_token) await enterApp();
  } catch (_) {}
}

// ─── Enter main app ──────────────────────────────────────────────
async function enterApp() {
  showScreen('main');
  await refreshUsage();
  populateSettingsUI();
  wireNavigation();
  wireRespondPanel();
  wireTemplatesPanel();
  wireActivityPanel();
  wireSettingsPanel();
  renderTemplateLibrary();
  await scanPageReviews();

  // Listen for premium activation from background service worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PREMIUM_ACTIVATED') {
      chrome.storage.local.remove('rrp_user_profile');
      refreshUsage().then(() => {
        stopPremiumPolling();
        showPremiumActivated();
      });
    }
  });

  // On every popup open, check if premium was activated while popup was closed
  const session = await Auth.getSession();
  if (session?.user?.id && Auth.isSupabaseConfigured()) {
    chrome.runtime.sendMessage({ type: 'CHECK_PREMIUM_NOW', userId: session.user.id },
      (resp) => {
        if (resp?.status?.isPremium && !_usageState?.isPremium) {
          chrome.storage.local.remove('rrp_user_profile');
          refreshUsage();
        }
      }
    );
  }
}

// ─── Screen switcher ─────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  const el = $('screen-' + name);
  if (el) { el.classList.remove('hidden'); el.classList.add('active'); }
}

// ─── Usage widget ────────────────────────────────────────────────
async function refreshUsage() {
  try {
    _usageState = await Auth.getUsageState();
  } catch (_) {
    _usageState = { plan:'free', isPremium:false, bonusUsed:0, bonusTotal:15, monthlyUsed:0, monthlyLimit:5, email:'' };
  }
  renderUsageWidget();
}

function renderUsageWidget() {
  const u = _usageState;
  if (!u) return;

  // Plan badge (PREMIUM / DARMOWY)
  const badge = $('usage-plan-badge');
  if (badge) {
    badge.textContent = u.isPremium ? 'PREMIUM' : 'DARMOWY';
    badge.classList.toggle('premium', !!u.isPremium);
  }

  // Bonus usage
  const bonusLeft = Math.max(0, u.bonusTotal - u.bonusUsed);
  const bonusPct  = Math.min(100, (u.bonusUsed / (u.bonusTotal || 1)) * 100);
  const bonusCount = $('usage-bonus-count');
  const bonusFill  = $('usage-bonus-fill');

  if (bonusCount) bonusCount.textContent = `${bonusLeft} / ${u.bonusTotal}`;
  if (bonusFill) {
    bonusFill.style.width = bonusPct + '%';
    colorFill(bonusFill, u.bonusUsed, u.bonusTotal);
  }

  // Monthly usage
  const mthLeft = Math.max(0, u.monthlyLimit - u.monthlyUsed);
  const mthPct  = Math.min(100, (u.monthlyUsed / (u.monthlyLimit || 1)) * 100);
  const mthCount = $('usage-monthly-count');
  const mthFill  = $('usage-monthly-fill');

  if (mthCount) mthCount.textContent = `${mthLeft} / ${u.monthlyLimit}`;
  if (mthFill) {
    mthFill.style.width = mthPct + '%';
    colorFill(mthFill, u.monthlyUsed, u.monthlyLimit);
  }

  // Upgrade button in sidebar
  const upg = $('btn-upgrade-sidebar');
  if (upg) {
    upg.style.display = u.isPremium ? 'none' : '';
  }

  // Premium status text
  const ps = $('premium-status');
  if (ps) {
    if (u.isPremium && u.premiumUntil) {
      ps.innerHTML = `<span style="color:var(--success)">✓ Premium aktywne do ${fmtDate(u.premiumUntil)}</span>`;
    } else {
      ps.textContent = '';
    }
  }

  // Show logged-in email in sidebar
  const emailEl = $('sidebar-email');
  if (emailEl && u.email) {
    emailEl.textContent = u.email;
  }

  // Also update the premium card button in settings
  const settingsUpgBtn = $('btn-upgrade-settings');
  if (settingsUpgBtn) {
    settingsUpgBtn.style.display = u.isPremium ? 'none' : '';
  }
}


function colorFill(el, used, limit) {
  el.classList.remove('warning','danger');
  const pct = used / (limit || 1);
  if (pct >= 1) el.classList.add('danger');
  else if (pct >= 0.7) el.classList.add('warning');
}

// ─── Navigation ──────────────────────────────────────────────────
function switchPanel(name) {
  // Deactivate all nav items and panels
  document.querySelectorAll('.nav-item[data-panel]').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('panel-active'));
  // Activate selected
  const navItem = document.querySelector(`.nav-item[data-panel="${name}"]`);
  if (navItem) navItem.classList.add('active');
  const panel = $('panel-' + name);
  if (panel) panel.classList.add('panel-active');
  // Side effects
  if (name === 'activity') loadActivityData();
  if (name === 'templates') renderTemplateLibrary();
}

function wireNavigation() {
  document.querySelectorAll('.nav-item[data-panel]').forEach(item => {
    item.addEventListener('click', () => switchPanel(item.dataset.panel));
  });

  // Ensure respond panel is active on start
  switchPanel('respond');

  const btnSignout = $('btn-signout');
  if (btnSignout) btnSignout.addEventListener('click', async () => {
    await Auth.signOut();
    showScreen('auth');
  });

  // All upgrade buttons
  document.querySelectorAll('[id^="btn-upgrade"]').forEach(btn => {
    btn.addEventListener('click', handleUpgrade);
  });
}

async function handleUpgrade() {
  const cfg = typeof CONFIG !== 'undefined' ? CONFIG : {};

  if (!Auth.isSupabaseConfigured()) {
    const directLink = cfg.STRIPE_DIRECT_LINK;
    if (directLink && !directLink.includes('YOUR_') && directLink.startsWith('http')) {
      chrome.tabs.create({ url: directLink });
      startPremiumPolling(); // poll even with direct link
    } else {
      showUpgradeInfo();
    }
    return;
  }

  try {
    const url = await Auth.createCheckoutSession();
    if (url) {
      chrome.tabs.create({ url });
      // Tell background service worker to poll (survives popup being closed)
      const session = await Auth.getSession();
      if (session?.user?.id) {
        chrome.runtime.sendMessage({ type: 'START_PREMIUM_POLL', userId: session.user.id });
      }
      startPremiumPolling(); // Also poll in popup while it's open
    }
  } catch (e) {
    const directLink = cfg.STRIPE_DIRECT_LINK;
    if (directLink && directLink.startsWith('http')) {
      chrome.tabs.create({ url: directLink });
      startPremiumPolling();
    } else {
      toast('Błąd płatności: ' + e.message, 'error');
    }
  }
}

// Poll for premium activation after checkout (every 8s for 10 minutes)
let _premiumPollTimer = null;
let _premiumPollCount = 0;
const PREMIUM_POLL_INTERVAL = 8000;
const PREMIUM_POLL_MAX = 75; // 10 minutes

function startPremiumPolling() {
  if (_premiumPollTimer) return; // already polling
  _premiumPollCount = 0;
  _premiumPollTimer = setInterval(async () => {
    _premiumPollCount++;
    if (_premiumPollCount > PREMIUM_POLL_MAX) {
      stopPremiumPolling();
      return;
    }
    try {
      // Force refresh profile from server
      await chrome.storage.local.remove('rrp_user_profile');
      const prev = _usageState?.isPremium || false;
      await refreshUsage();
      if (_usageState?.isPremium && !prev) {
        stopPremiumPolling();
        showPremiumActivated();
      }
    } catch (_) {}
  }, PREMIUM_POLL_INTERVAL);
}

function stopPremiumPolling() {
  if (_premiumPollTimer) {
    clearInterval(_premiumPollTimer);
    _premiumPollTimer = null;
  }
}

function showPremiumActivated() {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:99999;
    display:flex;align-items:center;justify-content:center;
  `;
  modal.innerHTML = `
    <div style="background:#1e2235;border:1px solid #f59e0b;border-radius:14px;padding:28px 24px;max-width:300px;width:90%;text-align:center;">
      <div style="font-size:40px;margin-bottom:12px;">⚡</div>
      <div style="font-size:17px;font-weight:700;color:#f59e0b;margin-bottom:8px;">Premium aktywne!</div>
      <div style="font-size:13px;color:#8b95b8;margin-bottom:20px;line-height:1.6;">
        Twoje konto zostało zaktualizowane do planu Premium.<br>
        Masz teraz 500 generacji AI miesięcznie.
      </div>
      <button class='modal-close-btn' style="
        width:100%;padding:10px;background:#f59e0b;color:#000;border:none;
        border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;font-family:inherit;
      ">Super, dziękuję!</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.modal-close-btn')?.addEventListener('click', () => modal.remove());
}

function showUpgradeInfo() {
  // Show a proper modal instead of a broken redirect
  const existing = document.getElementById('upgrade-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'upgrade-modal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:99998;
    display:flex;align-items:center;justify-content:center;
  `;
  modal.innerHTML = `
    <div style="background:#1e2235;border:1px solid #2a304a;border-radius:12px;padding:24px;max-width:320px;width:90%;">
      <div style="font-size:18px;font-weight:700;color:#e8eaf0;margin-bottom:8px;">⚡ Plan Premium</div>
      <div style="font-size:13px;color:#8b95b8;margin-bottom:16px;line-height:1.6;">
        Aby kupić Premium, musisz najpierw skonfigurować Supabase i Stripe.
        Szczegółowe instrukcje znajdziesz w pliku <strong style="color:#e8eaf0;">stripe_setup.txt</strong> dołączonym do rozszerzenia.
      </div>
      <div style="font-size:12px;color:#555f7a;margin-bottom:16px;padding:10px;background:#0f1117;border-radius:8px;">
        Skróty konfiguracji:<br>
        1. Utwórz konto Supabase (darmowe)<br>
        2. Uzupełnij SUPABASE_URL i SUPABASE_ANON_KEY w config.js<br>
        3. Utwórz konto Stripe i produkt $9/mies.<br>
        4. Uzupełnij STRIPE_PUBLISHABLE_KEY lub STRIPE_DIRECT_LINK
      </div>
      <button class='modal-close-btn' style="
        width:100%;padding:9px;background:#4f7cff;color:#fff;border:none;
        border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;
      ">Rozumiem</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ─── RESPOND PANEL ───────────────────────────────────────────────
function wireRespondPanel() {
  const btnDetect = $('btn-detect-page');
  if (btnDetect) btnDetect.addEventListener('click', scanPageReviews);

  const btnRescan = $('btn-rescan-page');
  if (btnRescan) btnRescan.addEventListener('click', scanPageReviews);

  // Mode pills
  document.querySelectorAll('.mode-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      _mode = pill.dataset.mode;
      updateModeVisibility();
    });
  });

  const btnAI = $('btn-ai-generate');
  if (btnAI) btnAI.addEventListener('click', generateAI);

  const btnFindTpls = $('btn-find-templates');
  if (btnFindTpls) btnFindTpls.addEventListener('click', findAndShowTemplates);

  const btnClose = $('btn-close-editor');
  if (btnClose) btnClose.addEventListener('click', () => $('editor-card').classList.add('hidden'));

  const btnReset = $('btn-reset-editor');
  if (btnReset) btnReset.addEventListener('click', () => {
    $('response-editor').value = _editorText;
    checkPlaceholders(_editorText);
  });

  const editor = $('response-editor');
  if (editor) editor.addEventListener('input', () => checkPlaceholders(editor.value));

  const btnCopy = $('btn-copy-response');
  if (btnCopy) btnCopy.addEventListener('click', copyResponse);

  const btnInsert = $('btn-insert-response');
  if (btnInsert) btnInsert.addEventListener('click', insertOnPage);
}

function updateModeVisibility() {
  const aiSec  = $('ai-section');
  const tplSec = $('template-section');
  if (!aiSec || !tplSec) return;
  if (_mode === 'ai')       { aiSec.style.display = ''; tplSec.style.display = 'none'; }
  else if (_mode === 'template') { aiSec.style.display = 'none'; tplSec.style.display = ''; }
  else                      { aiSec.style.display = ''; tplSec.style.display = ''; }
}

// ─── Page scan → review list ─────────────────────────────────────
async function scanPageReviews() {
  const btn = $('btn-detect-page') || $('btn-rescan-page');
  if (btn) { btn.disabled = true; btn.textContent = 'Skanowanie…'; }

  const listEl = $('review-list');
  if (listEl) listEl.innerHTML = '<div class="review-list-loading"><span class="spinner spinner-dark"></span> Wyszukuję recenzje…</div>';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Brak aktywnej karty');

    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_REVIEWS' }).catch(() => null);
    _reviews = resp?.reviews || [];

    renderReviewList();

    if (_reviews.length > 0) {
      selectReview(_reviews[0]);
    } else {
      if (listEl) listEl.innerHTML = '<div class="empty-state">Nie wykryto recenzji na tej stronie.<br>Upewnij się, że jesteś na stronie firmy Google Maps z widocznymi recenzjami.</div>';
    }
  } catch (e) {
    if (listEl) listEl.innerHTML = '<div class="empty-state">Nie można przeskanować strony. Odśwież kartę z Google Maps i spróbuj ponownie.</div>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btn.id === 'btn-detect-page' ? '↻ Wykryj ze strony' : '↻ Odśwież'; }
  }
}

function renderReviewList() {
  const el = $('review-list');
  if (!el) return;

  if (!_reviews.length) {
    el.innerHTML = '<div class="empty-state">Brak recenzji.</div>';
    return;
  }

  el.innerHTML = _reviews.map((r, i) => {
    const stars = r.rating ? '⭐'.repeat(r.rating) : '';
    const excerpt = (r.text || '').slice(0, 80) + ((r.text || '').length > 80 ? '…' : '');
    const replied = r.hasReply;
    return `
      <div class="review-item ${replied ? 'review-replied' : ''}" data-idx="${i}">
        <div class="review-item-top">
          <span class="review-item-name">${esc(r.reviewer || 'Klient')}</span>
          <span class="review-item-stars">${stars}</span>
          ${replied ? '<span class="reply-badge">✓ odpowiedziano</span>' : ''}
        </div>
        <div class="review-item-text">${esc(excerpt)}</div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.review-item').forEach(item => {
    item.addEventListener('click', () => {
      el.querySelectorAll('.review-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      selectReview(_reviews[parseInt(item.dataset.idx)]);
    });
  });
}

function selectReview(review) {
  _activeReview = review;

  // === POPRAWIONA CZĘŚĆ – treść recenzji tylko do odczytu ===
  const reviewTextEl = $('review-input');           // zakładam, że to jest ID pola z treścią
  if (reviewTextEl) {
    reviewTextEl.value = review.text || '';
    
    // Blokujemy edycję
    reviewTextEl.readOnly = true;                    // najważniejsze dla <textarea> i <input>
    reviewTextEl.contentEditable = "false";          // na wszelki wypadek
    reviewTextEl.spellcheck = false;
    
    // Opcjonalnie: dodajemy klasę CSS dla lepszego wyglądu
    reviewTextEl.classList.add('review-text-readonly');
  }

  const ratingSelect = $('rating-select');
  if (ratingSelect) ratingSelect.value = review.rating ? String(review.rating) : '';

  const nameInput = $('reviewer-name');
  if (nameInput) nameInput.value = review.reviewer || '';

  // Update selected highlight in list
  const listEl = $('review-list');
  if (listEl) {
    listEl.querySelectorAll('.review-item').forEach((item, i) => {
      item.classList.toggle('selected', _reviews[i] === review);
    });
  }

  // Show already-replied warning
  const alreadyWarn = $('already-replied-warning');
  if (alreadyWarn) alreadyWarn.classList.toggle('hidden', !review.hasReply);

  // Hide editor and clear old template results
  const editorCard = $('editor-card');
  if (editorCard) editorCard.classList.add('hidden');
  const tplMatches = $('template-matches');
  if (tplMatches) tplMatches.innerHTML = '';

  // Scroll to that review card on the page
  if (review.id) {
    chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'SCROLL_TO_REVIEW',
          reviewId: review.id,
        }).catch(() => {});
      }
    });
  }
}

// ─── AI Generation ────────────────────────────────────────────────
async function generateAI() {
  if (Date.now() - _aiCooldown < 3000) { toast('Poczekaj chwilę przed kolejną generacją.', 'warn'); return; }

  await refreshUsage();
  const check = await Auth.canGenerateAI();
  if (!check.allowed) {
    const warn = $('ai-limit-warning');
    const txt  = $('ai-limit-text');
    if (warn) warn.classList.remove('hidden');
    if (txt)  txt.textContent = check.message;
    return;
  }

  const reviewText = ($('review-input')?.value || '').trim();
  if (!reviewText) { toast('Najpierw wybierz lub wklej treść recenzji.', 'warn'); return; }

  _aiCooldown = Date.now();
  const limitWarn = $('ai-limit-warning');
  if (limitWarn) limitWarn.classList.add('hidden');

  const btn = $('btn-ai-generate');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generuję…'; }

  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'BUILD_AI_PROMPT',
      reviewText,
      reviewer: $('reviewer-name')?.value || 'Klient',
      rating: parseInt($('rating-select')?.value) || null,
      settings: _settings,
    });

    let reply = '';
    const cfg = typeof CONFIG !== 'undefined' ? CONFIG : {};
    const session = await Auth.getSession();

    if (session?.access_token && cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR_')) {
      reply = await callViaProxy(resp.system, resp.userMsg, session.access_token, cfg.SUPABASE_URL);
    } else {
      // No proxy configured — AI not available without Supabase setup
      // (Own API key option removed for security)
      throw new Error('Brak klucza API. Dodaj klucz w Ustawieniach lub zaloguj się.');
    }

    await Auth.recordAIGeneration();
    await refreshUsage();
    openEditor(reply);
    logEvent({ action: 'ai_generate', reviewer: _activeReview?.reviewer || 'manual' });

  } catch (e) {
    toast('Błąd AI: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Wygeneruj odpowiedź AI`;
    }
  }
}

async function callViaProxy(system, userMsg, token, supabaseUrl) {
  const res = await fetch(supabaseUrl + '/functions/v1/claude-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ system, userMsg })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 429) throw new Error('Limit AI osiągnięty. Przejdź na Premium.');
    throw new Error(err.error || 'Błąd proxy');
  }
  const data = await res.json();
  return data.reply || '';
}



// ─── Template matching ────────────────────────────────────────────
async function findAndShowTemplates() {
  const text = ($('review-input')?.value || '').trim();
  if (!text) { toast('Wybierz lub wklej treść recenzji.', 'warn'); return; }

  const btn = $('btn-find-templates');
  if (btn) { btn.disabled = true; btn.textContent = 'Szukam…'; }

  // Pobierz aktualną ocenę gwiazdkową
  const ratingVal = $('rating-select')?.value;
  const rating = ratingVal ? parseInt(ratingVal) : (_activeReview?.rating ?? null);

  const resp = await chrome.runtime.sendMessage({
    type: 'MATCH_TEMPLATES',
    reviewText: text,
    rating: rating,                          // <— gwiazdki przekazywane do matchera
    isPremium: _usageState?.isPremium || false,
    shortOnly: _settings.shortOnly || false,
  });
  const matches = resp?.templates || [];

  if (btn) { btn.disabled = false; btn.textContent = 'Znajdź pasujące szablony'; }

  const box = $('template-matches');
  if (!box) return;

  if (!matches.length) {
    box.innerHTML = '<div class="empty-state">Brak pasujących szablonów. Dodaj własne lub przejdź na Premium.</div>';
    return;
  }

  // Zapisz matches globalnie, wyrenderuj karty
  window._lastMatches = matches;

  const maxScore = Math.max(...matches.map(m => m.score), 1);
  box.innerHTML = matches.map((m, i) => {
    const t = m.template;
    const pct = m.score > 0 ? Math.round((m.score / maxScore) * 100) : 30;
    const preview = t.body.slice(0, 130).replace(/\n/g, ' ') + '…';
    return `
      <div class="tpl-card" data-match-idx="${i}">
        <div class="tpl-card-header">
          <div>
            <div class="tpl-card-title">${esc(t.title)}</div>
            <div class="tpl-badges">
              <span class="badge badge-cat">${catLabel(t.category)}</span>
              <span class="badge badge-tone">${toneLabel(t.tone)}</span>
              <span class="badge ${t.premium ? 'badge-premium' : 'badge-free'}">${t.premium ? 'Premium' : 'Darmowy'}</span>
            </div>
          </div>
          <div class="conf-bar">
            <span class="conf-pct">${pct}%</span>
            <div class="conf-track"><div class="conf-fill" style="width:${pct}%"></div></div>
          </div>
        </div>
        <div class="tpl-preview">${esc(preview)}</div>
        <div class="tpl-actions">
          <button class="btn-primary btn-sm tpl-use-btn" data-idx="${i}">Użyj tego →</button>
        </div>
      </div>
    `;
  }).join('');

  // "Użyj tego" — wstawia odpowiedź bezpośrednio na stronę (i otwiera edytor jako podgląd)
  box.querySelectorAll('.tpl-use-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx);
      const m = (window._lastMatches || [])[idx];
      if (!m) return;
      const filled = fillPlaceholders(m.template.body);
      logEvent({ action: 'template_use', category: m.template.category });
      // Always open editor so user sees the text
      openEditor(filled);
      // Also try to insert directly on the page
      await insertTextOnPage(filled);
    });
  });
}

function fillPlaceholders(body) {
  const s = _settings;
  const r = _activeReview;
  body = body.replaceAll('[NAZWA FIRMY]', s.businessName || '[NAZWA FIRMY]');
  body = body.replaceAll('[WŁAŚCICIEL]',  s.ownerName    || '[WŁAŚCICIEL]');
  body = body.replaceAll('[EMAIL]',       s.email        || '[EMAIL]');
  body = body.replaceAll('[TELEFON]',     s.phone        || '[TELEFON]');
  body = body.replaceAll('[EMAIL/TELEFON]', (s.email || s.phone)
    ? [s.email, s.phone].filter(Boolean).join(' / ')
    : '[EMAIL/TELEFON]');
  if (r?.reviewer && r.reviewer !== 'Klient') {
    body = body.replaceAll('[IMIĘ KLIENTA]', r.reviewer);
  }
  return body;
}

// ─── Editor ──────────────────────────────────────────────────────
function openEditor(text) {
  _editorText = text;
  const ed = $('response-editor');
  if (ed) ed.value = text;
  const card = $('editor-card');
  if (card) {
    card.classList.remove('hidden');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  checkPlaceholders(text);
}

function checkPlaceholders(text) {
  const found = [...new Set([...text.matchAll(/\[([A-ZŁÓĄŚŹŻĆĘŃ\/ ]+)\]/g)].map(m => m[0]))];
  const el = $('placeholder-warnings');
  if (el) el.innerHTML = found.map(ph => `<span class="ph-badge">⚠ ${esc(ph)}</span>`).join('');
}

async function copyResponse() {
  const text = $('response-editor')?.value;
  if (!text) return;
  try { await navigator.clipboard.writeText(text); }
  catch (_) { fallbackCopy(text); }
  flashEl($('copy-toast'), '✓ Skopiowano!');
  logEvent({ action: 'copy' });
}

// Shared helper: insert text into page reply box for given review
async function insertTextOnPage(text, reviewId) {
  if (!text) return false;
  const id = reviewId || _activeReview?.id;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return false;

    if (id) {
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: 'REPLY_TO_REVIEW',
        reviewId: id,
        replyText: text,
      }).catch(() => null);
      if (result?.ok) {
        flashEl($('copy-toast'), '✓ Wstawiono na stronie!');
        logEvent({ action: 'insert', reviewer: _activeReview?.reviewer });
        return true;
      }
    }

    // Generic inject into any focused/visible reply box
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (t) => {
        const sels = [
          'textarea[aria-label*="Odpowiedz" i]',
          'textarea[aria-label*="odpowiedz" i]',
          'textarea[aria-label*="reply" i]',
          'div[contenteditable="true"][aria-label*="Odpowiedz" i]',
          '.reply-textarea',
          'textarea:focus',
        ];
        for (const s of sels) {
          const el = document.querySelector(s);
          if (!el) continue;
          el.focus();
          if (el.tagName === 'TEXTAREA') {
            const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
            if (setter) setter.call(el, t); else el.value = t;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, t);
          }
          return true;
        }
        return false;
      },
      args: [text],
    }).catch(() => null);

    if (result?.[0]?.result) {
      flashEl($('copy-toast'), '✓ Wstawiono na stronie!');
      return true;
    }
    return false;
  } catch (_) { return false; }
}

async function submitReplyOnPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return false;

    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {

        const clickBtn = (keywords) => {
          const buttons = Array.from(document.querySelectorAll('button'));

          for (const btn of buttons) {
            const txt = (btn.innerText || btn.textContent || '').toLowerCase();
            if (!txt) continue;

            if (keywords.some(k => txt.includes(k))) {
              if (!btn.disabled) {
                btn.click();
                return true;
              }
            }
          }
          return false;
        };

        // 🔥 STEP 1: jeśli nie ma pola odpowiedzi → klik "Odpowiedz"
        const textarea = document.querySelector('textarea, div[contenteditable="true"]');

        if (!textarea || !textarea.offsetParent) {
          clickBtn(['odpowiedz', 'reply']);
          return 'opened';
        }

        // 🔥 STEP 2: klik "Opublikuj odpowiedź"
        const sent = clickBtn([
          'opublikuj odpowiedź',
          'opublikuj',
          'wyślij',
          'send',
          'post'
        ]);

        return sent ? 'sent' : false;
      }
    });

    return result?.[0]?.result || false;
  } catch (e) {
    return false;
  }
}

async function insertOnPage() {
  const text = $('response-editor')?.value;
  if (!text) return;

  
  const inserted = await insertTextOnPage(text);

if (!inserted) {
  await copyResponse();
  return;
}

// 🚀 NOWOŚĆ: auto-wysłanie na Google Maps
setTimeout(async () => {
  const sent = await submitReplyOnPage();

  if (sent) {
    flashEl($('copy-toast'), '🚀 Odpowiedź wysłana!');
    logEvent({ action: 'auto_submit', reviewer: _activeReview?.reviewer });
  } else {
    toast('Wstawiono, ale nie znaleziono przycisku "Wyślij".', 'warn');
  }
}, 800);

  // Fallback: copy
  if (_activeReview?.id) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: 'REPLY_TO_REVIEW',
          reviewId: _activeReview.id,
          replyText: text,
        }).catch(() => null);

        if (result?.ok) {
          flashEl($('copy-toast'), '✓ Wstawiono na stronie!');
          logEvent({ action: 'insert', reviewer: _activeReview.reviewer });
          return;
        }
      }
    } catch (_) {}
  }

  // Fallback: generic inject
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { await copyResponse(); return; }
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (t) => {
        const sels = [
          'textarea[aria-label*="Odpowiedz" i]',
          'textarea[aria-label*="reply" i]',
          'div[contenteditable="true"][aria-label*="Odpowiedz" i]',
          'div[contenteditable="true"][aria-label*="reply" i]',
          'textarea:focus',
          'div[contenteditable]:focus',
        ];
        for (const s of sels) {
          const el = document.querySelector(s);
          if (!el) continue;
          el.focus();
          if (el.tagName === 'TEXTAREA') {
            const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
            if (setter) setter.call(el, t);
            else el.value = t;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, t);
          }
          return true;
        }
        return false;
      },
      args: [text],
    });
    if (result?.[0]?.result) {
      flashEl($('copy-toast'), '✓ Wstawiono na stronie!');
    } else {
      await copyResponse();
      toast('Pole odpowiedzi nie znalezione — tekst skopiowany. Wklej ręcznie.', 'warn');
    }
  } catch (e) { await copyResponse(); }
}

// ─── Templates Panel ─────────────────────────────────────────────
function wireTemplatesPanel() {
  const btnShow = $('btn-show-add-template');
  const form    = $('add-template-form');
  const btnCancel = $('btn-cancel-template');
  const btnSave   = $('btn-save-template');

  if (btnShow) btnShow.addEventListener('click', () => form?.classList.toggle('hidden'));
  if (btnCancel) btnCancel.addEventListener('click', () => form?.classList.add('hidden'));
  if (btnSave) btnSave.addEventListener('click', saveCustomTpl);

  [$('template-search'), $('template-filter-cat'), $('template-filter-access')].forEach(el => {
    if (el) el.addEventListener('input', renderTemplateLibrary);
    if (el) el.addEventListener('change', renderTemplateLibrary);
  });
}

function renderTemplateLibrary() {
  const search    = ($('template-search')?.value || '').toLowerCase();
  const filterCat = $('template-filter-cat')?.value || '';
  const filterAcc = $('template-filter-access')?.value || '';
  const isPremium = _usageState?.isPremium || false;

  const all = [
    ..._customTpls.map(t => ({ ...t, isCustom: true })),
    ...POLISH_TEMPLATES
  ];

  const filtered = all.filter(t => {
    if (search && !t.title.toLowerCase().includes(search) && !t.body.toLowerCase().includes(search)) return false;
    if (filterCat && t.category !== filterCat) return false;
    if (filterAcc === 'free' && t.premium) return false;
    if (filterAcc === 'premium' && !t.premium) return false;
    return true;
  });

  const grid = $('template-grid');
  if (!grid) return;

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state">Brak szablonów spełniających kryteria.</div>';
    return;
  }

  grid.innerHTML = filtered.map(t => {
    const locked  = t.premium && !isPremium && !t.isCustom;
    const preview = t.body.slice(0, 100).replace(/\n/g, ' ') + '…';
    return `
      <div class="tpl-lib-card ${locked ? 'locked' : ''}">
        <div class="tpl-lib-header">
          <div class="tpl-lib-meta">
            <div class="tpl-lib-title">${esc(t.title)}</div>
            <div class="tpl-lib-badges">
              <span class="badge badge-cat">${catLabel(t.category)}</span>
              <span class="badge badge-tone">${toneLabel(t.tone)}</span>
              <span class="badge ${t.premium ? 'badge-premium':'badge-free'}">${t.premium?'Premium':'Darmowy'}</span>
              ${t.isCustom ? '<span class="badge badge-custom">Własny</span>' : ''}
            </div>
          </div>
          ${locked ? '<span class="lock-badge">🔒 Premium</span>' : ''}
        </div>
        <div class="tpl-lib-preview">${esc(preview)}</div>
        <div class="tpl-lib-actions">
          ${t.isCustom ? `<button class="btn-ghost btn-xs" data-tpl-action="delete" data-tpl-id="${t.id}">Usuń</button>` : ''}
          ${locked
            ? `<button class="btn-upgrade-inline btn-xs" data-tpl-action="upgrade">Odblokuj</button>`
            : `<button class="btn-secondary btn-sm" data-tpl-action="use" data-tpl-id="${t.id}">Użyj</button>`}
        </div>
      </div>
    `;
  }).join('');
  
  wireLibraryButtons();
}

window.useTplFromLib = function(id) {
  const t = [..._customTpls, ...POLISH_TEMPLATES].find(t => t.id === id);
  if (!t) return;
  switchPanel('respond');
  openEditor(fillPlaceholders(t.body));
};

window.deleteTpl = async function(id) {
  if (!confirm('Usunąć ten szablon?')) return;
  _customTpls = _customTpls.filter(t => t.id !== id);
  await saveCustomTpls();
  renderTemplateLibrary();
};

// Wire library template buttons after render (CSP-safe)
function wireLibraryButtons() {
  const grid = $('template-grid');
  if (!grid) return;
  grid.querySelectorAll('[data-tpl-action="use"]').forEach(btn => {
    btn.addEventListener('click', () => window.useTplFromLib(btn.dataset.tplId));
  });
  grid.querySelectorAll('[data-tpl-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => window.deleteTpl(btn.dataset.tplId));
  });
  grid.querySelectorAll('[data-tpl-action="upgrade"]').forEach(btn => {
    btn.addEventListener('click', handleUpgrade);
  });
}

async function saveCustomTpl() {
  const title = $('new-tpl-title')?.value.trim();
  const cat   = $('new-tpl-cat')?.value;
  const tone  = $('new-tpl-tone')?.value;
  const body  = $('new-tpl-body')?.value.trim();
  if (!title || !body) { toast('Tytuł i treść są wymagane.', 'warn'); return; }

  const isPremium = _usageState?.isPremium || false;
  if (!isPremium && _customTpls.length >= 3) {
    toast('Plan darmowy: max 3 własne szablony. Przejdź na Premium.', 'warn');
    return;
  }

  _customTpls.unshift({
    id: 'custom_' + Date.now(), category: cat, tone, length: body.length < 200 ? 'short' : 'long',
    premium: false, isCustom: true, title, body,
  });
  await saveCustomTpls();
  if ($('new-tpl-title')) $('new-tpl-title').value = '';
  if ($('new-tpl-body'))  $('new-tpl-body').value  = '';
  $('add-template-form')?.classList.add('hidden');
  flashEl($('template-save-toast'), '✓ Szablon zapisany!');
  renderTemplateLibrary();
}

// ─── Activity Panel ───────────────────────────────────────────────
function wireActivityPanel() {
  const btn = $('btn-clear-log');
  if (btn) btn.addEventListener('click', async () => {
    if (!confirm('Wyczyścić całą historię?')) return;
    await chrome.runtime.sendMessage({ type: 'CLEAR_ANALYTICS' });
    await chrome.storage.local.remove('rrp_replied_reviews');
    loadActivityData();
  });
}

async function loadActivityData() {
  const logResp = await chrome.runtime.sendMessage({ type: 'GET_ANALYTICS' });
  const log = logResp?.log || [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const aiCount  = log.filter(e => e.action === 'ai_generate').length;
  const tplCount = log.filter(e => e.action === 'template_use').length;
  const thisMonth = log.filter(e => e.ts >= monthStart).length;

  if ($('stat-total')) $('stat-total').textContent = log.length;
  if ($('stat-ai'))    $('stat-ai').textContent    = aiCount;
  if ($('stat-tpl'))   $('stat-tpl').textContent   = tplCount;
  if ($('stat-month')) $('stat-month').textContent  = thisMonth;

  const list = $('activity-list');
  if (!list) return;
  if (!log.length) { list.innerHTML = '<div class="empty-state">Brak historii odpowiedzi.</div>'; return; }

  list.innerHTML = log.slice(0, 60).map(e => {
    const method = e.action === 'ai_generate' ? 'AI' : e.action === 'template_use' ? 'Szablon' : 'Kopiuj';
    const dotCls = e.action === 'ai_generate' ? 'ai' : 'template';
    const badgeCls = e.action === 'ai_generate' ? 'm-ai' : e.action === 'copy' ? 'm-copy' : 'm-template';
    return `
      <div class="activity-item">
        <div class="a-dot ${dotCls}"></div>
        <div class="a-content">
          <div class="a-reviewer">${esc(e.reviewer || 'Recenzja')}</div>
          <div class="a-meta">${fmtAgo(e.ts)}</div>
        </div>
        <span class="a-method ${badgeCls}">${method}</span>
      </div>
    `;
  }).join('');
}

// ─── Settings Panel ───────────────────────────────────────────────
function wireSettingsPanel() {
  const btn = $('btn-save-settings');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    _settings.businessName = $('s-business')?.value.trim() || '';
    _settings.ownerName    = $('s-owner')?.value.trim()    || '';
    _settings.email        = $('s-email')?.value.trim()    || '';
    _settings.phone        = $('s-phone')?.value.trim()    || '';
    _settings.replyTone    = $('s-tone')?.value            || 'profesjonalny i ciepły';
    _settings.replyLength  = $('s-length')?.value          || 'medium';
    _settings.shortOnly    = $('s-short-only')?.checked    || false;
    await saveSettings();
    flashEl($('settings-save-toast'), '✓ Ustawienia zapisane!');
    pushSettingsToContentScript();
  });
}

function populateSettingsUI() {
  if ($('s-business')) $('s-business').value = _settings.businessName || '';
  if ($('s-owner'))    $('s-owner').value    = _settings.ownerName    || '';
  if ($('s-email'))    $('s-email').value    = _settings.email        || '';
  if ($('s-phone'))    $('s-phone').value    = _settings.phone        || '';

  if ($('s-tone'))     $('s-tone').value     = _settings.replyTone    || 'profesjonalny i ciepły';
  if ($('s-length'))   $('s-length').value   = _settings.replyLength  || 'medium';
  if ($('s-short-only')) $('s-short-only').checked = !!_settings.shortOnly;
}

async function pushSettingsToContentScript() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'REFRESH_SETTINGS', settings: _settings }).catch(() => {});
  } catch (_) {}
}

// ─── Storage ──────────────────────────────────────────────────────
async function loadSettings()   { const d = await chrome.storage.local.get('rrp_settings');        _settings   = d.rrp_settings || {}; }
async function saveSettings()   { await chrome.storage.local.set({ rrp_settings: _settings }); }
async function loadCustomTpls() { const d = await chrome.storage.local.get('rrp_custom_templates'); _customTpls = d.rrp_custom_templates || []; }
async function saveCustomTpls() { await chrome.storage.local.set({ rrp_custom_templates: _customTpls }); }

// ─── Analytics ────────────────────────────────────────────────────
function logEvent(entry) {
  chrome.runtime.sendMessage({ type: 'LOG_ANALYTICS', entry: { ...entry, ts: Date.now() } }).catch(() => {});
}

// ─── Utilities ────────────────────────────────────────────────────
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, type = '') {
  const existing = document.querySelector('.app-toast');
  if (existing) existing.remove();
  const colors = { success: '#15803d', error: '#dc2626', warn: '#92400e' };
  const t = document.createElement('div');
  t.className = 'app-toast';
  Object.assign(t.style, {
    position:'fixed', bottom:'16px', right:'16px', padding:'10px 16px',
    borderRadius:'8px', fontSize:'12.5px', fontFamily:'inherit', zIndex:'99999',
    maxWidth:'280px', background: colors[type] || '#1e293b', color:'#fff',
    boxShadow:'0 4px 16px rgba(0,0,0,.4)',
  });
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function flashEl(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2500);
}

function setBtnLoading(btn, text) { btn.disabled = true; btn.innerHTML = `<span class="spinner spinner-dark"></span> ${text}`; }
function setBtnNormal(btn, text)  { btn.disabled = false; btn.textContent = text; }
function fallbackCopy(text) {
  const el = Object.assign(document.createElement('textarea'), { value: text, style: 'position:fixed;opacity:0' });
  document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove();
}

function fmtAgo(ts) {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 60000) return 'przed chwilą';
  if (d < 3600000) return Math.floor(d/60000) + ' min temu';
  if (d < 86400000) return Math.floor(d/3600000) + ' godz. temu';
  return Math.floor(d/86400000) + ' dni temu';
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('pl-PL'); } catch (_) { return s; }
}

function catLabel(c) {
  const m = { positive:'Pozytywna', enthusiastic:'Entuzjastyczna', neutral:'Neutralna',
    negative:'Negatywna', apologies_service:'Przeprosiny', contact_request:'Kontakt',
    one_liner:'Jedno zdanie', long_professional:'Długa/Profesjonalna', ecommerce:'E-commerce',
    restaurant_service:'Restauracja', followup:'Follow-up', fake_review:'Fałszywa',
    product_quality:'Jakość produktu', price_value:'Cena', cleanliness:'Czystość',
    speed:'Szybkość', delivery:'Dostawa', packaging:'Opakowanie' };
  return m[c] || c;
}

function toneLabel(t) {
  const m = { warm:'Ciepły', professional:'Profesjonalny', casual:'Nieformalny',
    apologetic:'Przepraszający', firm_polite:'Stanowczy', friendly:'Przyjazny' };
  return m[t] || t;
}
