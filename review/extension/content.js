// content.js — Review Responder Pro v3.3
// Poprawione: komunikacja z bazy Supabase (dodano apikey do headers)

(function () {
  'use strict';

  if (window.__rrpLoaded) return;
  window.__rrpLoaded = true;

  // ─── State ────────────────────────────────────────────────────
  let settings = {};
  let repliedReviews = {};
  let processedNodes = new WeakSet();
  let observer = null;
  let scanDebounce = null;

  // ─── Selectors ────────────────────────────────────────────────
  const CONTAINER_SELECTORS = [
    '[data-review-id]',
    '.jftiEf',
    '.gws-localreviews__google-review',
  ];

  const TEXT_SELECTORS = [
    '.MyEned span[jsname]',
    '.wiI7pd',
    'span[jsname="bN97Pc"]',
    'span[jsname="fbQN7e"]',
    '.MyEned',
    '[class*="review-full-text"]',
  ];

  const NAME_SELECTORS = [
    '.d4r55',
    '.TSUbDb',
    'button[data-href*="contrib"] span',
    '.X43Kjb',
    '[class*="reviewer-name"]',
  ];

  const RATING_SELECTORS = [
    '.kvMYJc',
    '[aria-label*="star" i]',
    '[aria-label*="gwiazdek" i]',
    '[aria-label*="gwiazdki" i]',
    'span[role="img"][aria-label]',
  ];

  const OWNER_REPLY_INDICATORS = [
    '[class*="ODSEW"]',
    '.u6XPfc',
    '[jsname="MZnRab"]',
    '.CDe7pd',
    '[aria-label*="owner" i]',
    '[aria-label*="właściciel" i]',
    '[aria-label*="wlasciciel" i]',
  ];

  const OWNER_REPLY_TEXT_SIGNALS = [
    'odpowiedź od właściciela',
    'odpowiedz od wlasciciela',
    'owner\'s reply',
    'response from the owner',
    'twoja odpowiedź',
    'twoja odpowiedz',
    'your reply',
  ];

  const REPLY_BUTTON_SELECTORS = [
    'button[aria-label*="Odpowiedz" i]',
    'button[aria-label*="Reply" i]',
    'button[jsaction*="reply" i]',
    'button[data-reply-button]',
    'button.GCyNb',
  ];

  const REPLY_BOX_SELECTORS = [
    'textarea[aria-label*="Odpowiedz" i]',
    'textarea[aria-label*="reply" i]',
    'div[contenteditable="true"][aria-label*="Odpowiedz" i]',
    'div[contenteditable="true"][aria-label*="reply" i]',
    'textarea.dUMFVb',
    '[jscontroller*="reply"] textarea',
  ];

  // ─── Load & Save ──────────────────────────────────────────────
  function loadState() {
    chrome.storage.local.get(['rrp_settings', 'rrp_replied_reviews'], (data) => {
      settings = data.rrp_settings || {};
      repliedReviews = data.rrp_replied_reviews || {};
      scan();
    });
  }

  function saveReplied(reviewId, info) {
    repliedReviews[reviewId] = info;
    chrome.storage.local.set({ rrp_replied_reviews: repliedReviews });
  }

  // ─── ID & Data Extraction ─────────────────────────────────────
  function getReviewId(container) {
    const native = container.getAttribute('data-review-id') ||
                   container.getAttribute('data-local-review-id');
    if (native) return 'gm_' + native;

    const text = getReviewText(container);
    if (text) return 'h_' + simpleHash(text);
    return null;
  }

  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < Math.min(str.length, 200); i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
  }

  function getReviewText(container) {
    for (const sel of TEXT_SELECTORS) {
      try {
        const el = container.querySelector(sel);
        if (el) {
          const t = (el.innerText || el.textContent || '').trim();
          if (t.length > 15) return t;
        }
      } catch (_) {}
    }
    return null;
  }

  function getReviewerName(container) {
    for (const sel of NAME_SELECTORS) {
      try {
        const el = container.querySelector(sel);
        if (el) {
          const t = (el.innerText || el.textContent || '').trim();
          if (t.length > 0 && t.length < 80) return t;
        }
      } catch (_) {}
    }
    return 'Klient';
  }

  function getStarRating(container) {
    for (const sel of RATING_SELECTORS) {
      try {
        const el = container.querySelector(sel);
        if (el) {
          const label = el.getAttribute('aria-label') || '';
          const match = label.match(/(\d)/);
          if (match) return parseInt(match[1]);
        }
      } catch (_) {}
    }
    return null;
  }

  function hasOwnerReply(container) {
    for (const sel of OWNER_REPLY_INDICATORS) {
      try {
        if (container.querySelector(sel)) return true;
      } catch (_) {}
    }

    const containerText = (container.innerText || '').toLowerCase();
    for (const signal of OWNER_REPLY_TEXT_SIGNALS) {
      if (containerText.includes(signal)) return true;
    }
    return false;
  }

  // ─── Find containers with deduplication ───────────────────────
  function findReviewContainers() {
    const found = new Map();

    for (const sel of CONTAINER_SELECTORS) {
      try {
        document.querySelectorAll(sel).forEach(el => {
          const reviewId = getReviewId(el);
          if (!reviewId) return;

          const text = getReviewText(el);
          if (!text) return;

          if (!found.has(reviewId)) {
            found.set(reviewId, el);
          }
        });
      } catch (_) {}
    }

    return Array.from(found.values());
  }

  // ─── Helpers ──────────────────────────────────────────────────
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function waitForReplyBox(container, maxAttempts = 15) {
    for (let i = 0; i < maxAttempts; i++) {
      for (const sel of REPLY_BOX_SELECTORS) {
        const box = container.querySelector(sel) || document.querySelector(sel);
        if (box) return box;
      }
      await sleep(300);
    }
    return null;
  }

  function formatAgo(ts) {
    if (!ts) return '';
    const d = Date.now() - ts;
    if (d < 60000) return 'przed chwilą';
    if (d < 3600000) return Math.floor(d / 60000) + 'm temu';
    if (d < 86400000) return Math.floor(d / 3600000) + 'h temu';
    return Math.floor(d / 86400000) + 'd temu';
  }

  function showToast(msg, type = '') {
    const existing = document.querySelector('.rrp-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = `rrp-toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  function fallbackCopy(text) {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    el.remove();
  }

  // ─── Improved Insertion Point ─────────────────────────────────
  function findInsertionPoint(container) {
    const fullTextSelectors = [
      'span[jsname="bN97Pc"]',
      'span[jsname="fbQN7e"]',
      '.wiI7pd',
      '.MyEned span[jsname]',
      '.MyEned',
      '[class*="review-full-text"]',
    ];

    for (const sel of fullTextSelectors) {
      try {
        const el = container.querySelector(sel);
        if (el && (el.innerText || el.textContent || '').trim().length > 20) {
          return el;
        }
      } catch (_) {}
    }

    for (const sel of TEXT_SELECTORS) {
      try {
        const el = container.querySelector(sel);
        if (el && (el.innerText || el.textContent || '').trim().length > 10) {
          return el;
        }
      } catch (_) {}
    }
    return null;
  }

  // ─── Improved Toolbar Injection ───────────────────────────────
  function injectToolbar(container, reviewId, reviewData) {
    container.querySelectorAll('.rrp-toolbar').forEach(el => el.remove());

    const alreadyRepliedStored = !!repliedReviews[reviewId];
    const alreadyRepliedOnPage = hasOwnerReply(container);
    const alreadyReplied = alreadyRepliedStored || alreadyRepliedOnPage;

    const toolbar = document.createElement('div');
    toolbar.className = `rrp-toolbar${alreadyReplied ? ' rrp-replied' : ''}`;
    toolbar.dataset.rrpId = reviewId;

    if (alreadyReplied) {
      const info = repliedReviews[reviewId];
      const replySource = alreadyRepliedOnPage && !alreadyRepliedStored
        ? 'wykryto odpowiedź na stronie'
        : `odpowiedziano ${formatAgo(info?.repliedAt)} (${info?.method || '?'})`;

      toolbar.innerHTML = `
        <span class="rrp-status-dot"></span>
        <span class="rrp-label rrp-replied-label">✓ ${replySource}</span>
        <button class="rrp-btn rrp-btn-edit" data-action="re-reply">↩ Odpowiedz ponownie</button>
      `;
    } else {
      toolbar.innerHTML = `
        <span class="rrp-label">Review Responder Pro:</span>
        <button class="rrp-btn rrp-btn-ai" data-action="ai-reply">✦ Odpowiedź AI</button>
        <button class="rrp-btn rrp-btn-template" data-action="template-reply">Szablon</button>
        <div class="rrp-reply-preview" data-preview></div>
        <div class="rrp-preview-actions" data-preview-actions style="display:none">
          <button class="rrp-btn rrp-btn-insert" data-action="insert">✓ Wstaw odpowiedź</button>
          <button class="rrp-btn rrp-btn-copy" data-action="copy">Kopiuj</button>
          <button class="rrp-btn rrp-btn-discard" data-action="discard">✕</button>
        </div>
      `;
    }

    const insertAfter = findInsertionPoint(container);
    if (insertAfter?.parentNode) {
      insertAfter.parentNode.insertBefore(toolbar, insertAfter.nextSibling);
    } else {
      container.appendChild(toolbar);
    }

    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      handleAction(btn.dataset.action, toolbar, container, reviewId, reviewData);
    });
  }

  // ─── Action Handler ───────────────────────────────────────────
  async function handleAction(action, toolbar, container, reviewId, reviewData) {
  const preview = toolbar.querySelector('[data-preview]');
  const previewActions = toolbar.querySelector('[data-preview-actions]');

  switch (action) {
    case 'template-reply': {
      const tplBtn = toolbar.querySelector('[data-action="template-reply"]');
      if (tplBtn) {
        tplBtn.disabled = true;
        tplBtn.textContent = 'Wstawiam…';
      }

      chrome.runtime.sendMessage({
        type: 'MATCH_TEMPLATES',
        reviewText: reviewData.text,
        rating: reviewData.rating,
        isPremium: false,
        shortOnly: settings.shortOnly || false,
      }, async (response) => {
        if (tplBtn) {
          tplBtn.disabled = false;
          tplBtn.textContent = 'Szablon';
        }

        const templates = response?.templates || [];
        if (!templates.length) {
          showToast('Brak pasującego szablonu.', 'error');
          return;
        }

        const best = templates[0].template;
        let finalText = best.body;
        finalText = fillPlaceholders(finalText, reviewData);
        await insertReply(container, finalText, reviewId, reviewData, toolbar);
        showToast('✓ Szablon wstawiony!', 'success');
      });
      break;
    }

    case 'ai-reply': {
      const aiBtn = toolbar.querySelector('[data-action="ai-reply"]');
      const origHTML = aiBtn ? aiBtn.innerHTML : '';

      if (aiBtn) {
        aiBtn.disabled = true;
        aiBtn.innerHTML = '<span class="rrp-spinner"></span> Generuję…';
        toolbar.querySelectorAll('.rrp-btn').forEach(b => b.disabled = true);
      }

      try {
        const reply = await generateAIReply(reviewData);
        showPreview(preview, previewActions, reply);
      } catch (e) {
        showToast('Błąd AI: ' + (e.message || e), 'error');
      } finally {
        if (aiBtn) {
          aiBtn.innerHTML = origHTML;
          toolbar.querySelectorAll('.rrp-btn').forEach(b => b.disabled = false);
        }
      }
      break;
    }

    case 'insert':
      if (preview && preview.textContent) {
        await insertReply(container, preview.textContent, reviewId, reviewData, toolbar);
      }
      break;

    case 'copy':
      const copyText = preview ? preview.textContent : '';
      if (copyText) {
        navigator.clipboard.writeText(copyText).catch(() => fallbackCopy(copyText));
        showToast('Skopiowano!', 'success');
        saveReplied(reviewId, { repliedAt: Date.now(), method: 'skopiowano', reviewer: reviewData.reviewer });
        markReplied(toolbar, reviewId, 'skopiowano');
      }
      break;

    case 'discard':
      if (preview) {
        preview.textContent = '';
        preview.classList.remove('visible');
      }
      if (previewActions) previewActions.style.display = 'none';
      toolbar.querySelectorAll('.rrp-btn').forEach(b => b.disabled = false);
      break;

    case 're-reply':
      toolbar.classList.remove('rrp-replied');
      toolbar.innerHTML = `
        <span class="rrp-label">Review Responder Pro:</span>
        <button class="rrp-btn rrp-btn-ai" data-action="ai-reply">✦ Odpowiedź AI</button>
        <button class="rrp-btn rrp-btn-template" data-action="template-reply">Szablon</button>
        <div class="rrp-reply-preview" data-preview></div>
        <div class="rrp-preview-actions" data-preview-actions style="display:none">
          <button class="rrp-btn rrp-btn-insert" data-action="insert">✓ Wstaw odpowiedź</button>
          <button class="rrp-btn rrp-btn-copy" data-action="copy">Kopiuj</button>
          <button class="rrp-btn rrp-btn-discard" data-action="discard">✕</button>
        </div>
      `;
      break;
  }
}

  // ─── AI Generation ─────────────────────
  async function generateAIReply(reviewData) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'BUILD_AI_PROMPT',
        reviewText: reviewData.text,
        reviewer: reviewData.reviewer,
        rating: reviewData.rating,
        settings,
      }, async (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Brak komunikacji z rozszerzeniem'));
          return;
        }
        try {
          const reply = await callAI(resp.system, resp.userMsg);
          resolve(reply);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  // ─── KLUCZOWA POPRAWKA LOGOWANIA / BAZY ─────────────────────
  async function callAI(system, userMsg) {
    const cfg = settings;
    const supabaseUrl = cfg.supabaseUrl || '';
    
    const sessionData = await new Promise(r => chrome.storage.local.get(['rrp_session', 'rrp_supabase_anon_key'], r));
    const token = sessionData?.rrp_session?.access_token;
    // Poniższy klucz anonimowy musi być w storage, żeby baza w ogóle wpuściła zapytanie logowania
    const anonKey = sessionData?.rrp_supabase_anon_key || '';

    if (token && supabaseUrl) {
      const res = await fetch(supabaseUrl + '/functions/v1/claude-proxy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': 'Bearer ' + token,
          'apikey': anonKey // DODANE: Bez tego Supabase wywala "Invalid API Key"
        },
        body: JSON.stringify({ system, userMsg })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 429) throw new Error('Limit AI przekroczony.');
        throw new Error(err.error || 'Błąd połączenia z bazą.');
      }
      const data = await res.json();
      return data.reply || '';
    } 
    else if (cfg.apiKey) {
      // Fallback do Anthropic
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 300,
          system,
          messages: [{ role: 'user', content: userMsg }]
        })
      });
      if (!res.ok) throw new Error('Błąd API Anthropic.');
      const data = await res.json();
      return data.content?.[0]?.text?.trim() || '';
    } 
    else {
      throw new Error('Brak sesji lub klucza. Zaloguj się ponownie.');
    }
  }

  // ─── Insert Reply ─────────────────────────────────────────────
  async function insertReply(container, replyText, reviewId, reviewData, toolbar) {
    if (!replyText?.trim()) return;

    let replyBtn = null;
    for (const sel of REPLY_BUTTON_SELECTORS) {
      replyBtn = container.querySelector(sel);
      if (replyBtn) break;
    }
    if (replyBtn) {
      replyBtn.click();
      await sleep(700);
    }

    const replyBox = await waitForReplyBox(container);
    if (!replyBox) {
      fallbackCopy(replyText);
      showToast('Tekst skopiowany do schowka.', 'success');
      saveReplied(reviewId, { repliedAt: Date.now(), method: 'schowek', reviewer: reviewData.reviewer });
      markReplied(toolbar, reviewId, 'schowek');
      return;
    }

    replyBox.focus();
    if (replyBox.tagName === 'TEXTAREA' || replyBox.tagName === 'INPUT') {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (nativeSetter) nativeSetter.call(replyBox, replyText);
      else replyBox.value = replyText;
      replyBox.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, replyText);
    }
    showToast('✓ Wstawiono!', 'success');
  }

  function showPreview(preview, previewActions, text) {
    if (!preview) return;
    preview.textContent = text;
    preview.classList.add('visible');
    if (previewActions) previewActions.style.display = 'flex';
  }

  function markReplied(toolbar, reviewId, method) {
    toolbar.classList.add('rrp-replied');
    toolbar.innerHTML = `
      <span class="rrp-status-dot"></span>
      <span class="rrp-label rrp-replied-label">✓ ${method}</span>
      <button class="rrp-btn rrp-btn-edit" data-action="re-reply">↩ Ponownie</button>
    `;
  }

  function fillPlaceholders(body, reviewData) {
    const s = settings;
    body = body.replaceAll('[NAZWA FIRMY]', s.businessName || '[NAZWA FIRMY]');
    body = body.replaceAll('[WŁAŚCICIEL]',  s.ownerName    || '[WŁAŚCICIEL]');
    body = body.replaceAll('[EMAIL]',       s.email        || '[EMAIL]');
    body = body.replaceAll('[TELEFON]',     s.phone        || '[TELEFON]');
    if (reviewData?.reviewer && reviewData.reviewer !== 'Klient') {
      body = body.replaceAll('[IMIĘ KLIENTA]', reviewData.reviewer);
    }
    return body;
  }

  // ─── Scan ─────────────────────────────────────────────────────
  function scan() {
    const containers = findReviewContainers();
    containers.forEach(container => {
      const reviewId = getReviewId(container);
      if (!reviewId) return;
      const text = getReviewText(container);
      if (!text) return;
      injectToolbar(container, reviewId, {
        id: reviewId,
        text,
        reviewer: getReviewerName(container),
        rating: getStarRating(container)
      });
    });
  }

  // ─── Observer ─────────────────────────────────────────────────
  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      clearTimeout(scanDebounce);
      scanDebounce = setTimeout(scan, 450);
    });
    observer.observe(document.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'jsname']
    });
  }

  // ─── Message Listener ─────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_REVIEWS') {
      const containers = findReviewContainers();
      const reviews = containers.map(c => {
        const id = getReviewId(c);
        return {
          id,
          text: getReviewText(c),
          reviewer: getReviewerName(c),
          rating: getStarRating(c),
          hasReply: hasOwnerReply(c) || !!repliedReviews[id],
        };
      }).filter(r => r.text && r.id);
      sendResponse({ reviews, url: window.location.href });
      return true;
    }

    if (msg.type === 'REFRESH_SETTINGS' || msg.type === 'RESCAN') {
      settings = msg.settings || settings;
      document.querySelectorAll('.rrp-toolbar').forEach(t => t.remove());
      scan();
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'SCROLL_TO_REVIEW') {
      scrollToReview(msg.reviewId).then(success => sendResponse({ success }));
      return true;
    }
  });

  async function scrollToReview(reviewId) {
    for (let i = 0; i < 12; i++) {
      const containers = findReviewContainers();
      const target = containers.find(c => getReviewId(c) === reviewId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
      const scrollable = document.querySelector('[role="main"]') || document.querySelector('.m6QErb[tabindex]') || document.body;
      scrollable.scrollBy(0, 800);
      await new Promise(r => setTimeout(r, 500));
    }
    return false;
  }

  // ─── Boot ─────────────────────────────────────────────────────
  setTimeout(loadState, 1500);
  startObserver();
})();