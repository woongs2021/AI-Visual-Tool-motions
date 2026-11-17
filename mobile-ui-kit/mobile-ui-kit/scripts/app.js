/* =========================================================================================================================
   Mobile UI kit — app.js (vanilla, no dependencies)

   One script for every page:
     · the screen shell   modes (UI-only, capture, system bars), sheets, toast, scroll fog, the preview bridge, 390 × 844 check
     · 01 PC Health       score ring, rescan scenarios, expandable diagnostics, full report
     · 02 Meeting Notes   demo recorder: timer, waveform, transcript script, summary tabs, pause / stop / new
     · 03 Our Discussion  options, opinion change, agreement steps, discussion panel
     · index.html         screen switcher, display switches, capture guide, demo reset, the 390 × 844 check

   URL parameters (screens):  theme=light|dark|system  ui=1  capture=1  statusbar=1  embed=1  validate=1  + per-screen states
   Public API (any page):     window.AUKit.theme.get() / .set('light'|'dark'|'system') / .resolved() / .cycle()
                              document event 'au:theme' (detail: { theme, resolved })
   Everything shown is demo data; nothing records audio or reads hardware.
   ========================================================================================================================= */
(() => {
  'use strict';

  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const isCapture = () => root.classList.contains('is-capture');
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const still = () => isCapture() || reduceMotion();
  const isTyping = (t) => t && (t.closest('input, textarea, select, [contenteditable="true"]'));
  const inFrame = window.parent !== window;

  /* ---------------------------------------------------------------------------------------------------------------------
     Screen catalogue — from apps/registry.js (window.AU_APPS), used by the preview: list, states, capture notes, check
     --------------------------------------------------------------------------------------------------------------------- */
  const SCREENS = Object.fromEntries((window.AU_APPS || []).map((a) => [a.id, Object.assign({ states: [{ label: 'Default', q: '' }], notes: [] }, a)]));

  /* ---------------------------------------------------------------------------------------------------------------------
     Demo storage — per screen, ignored in capture mode so captures always show the defaults
     --------------------------------------------------------------------------------------------------------------------- */
  const store = {
    key: (id) => `au-demo:${id}`,
    get(id, defaults) {
      const base = clone(defaults);
      if (isCapture()) return base;
      try { const raw = localStorage.getItem(this.key(id)); return raw ? Object.assign(base, JSON.parse(raw)) : base; } catch { return base; }
    },
    set(id, value) { if (isCapture()) return; try { localStorage.setItem(this.key(id), JSON.stringify(value)); } catch { /* storage unavailable */ } },
    clear(id) { try { localStorage.removeItem(this.key(id)); } catch { /* storage unavailable */ } },
  };

  /* seeded random numbers (mulberry32) — the same waveform every time */
  const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /* ---------------------------------------------------------------------------------------------------------------------
     Theme — 'system' follows the OS (CSS media query); 'light' / 'dark' set html[data-au-theme]. The choice is saved, except
     inside the preview or a capture, where the URL decides.
     --------------------------------------------------------------------------------------------------------------------- */
  const THEMES = ['system', 'light', 'dark'];
  const THEME_KEY = 'au-theme';
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const theme = {
    get: () => root.getAttribute('data-au-theme') || 'system',
    resolved() { const t = this.get(); return t === 'system' ? (darkQuery.matches ? 'dark' : 'light') : t; },
    set(t, { persist = !inFrame && !isCapture() } = {}) {
      if (!THEMES.includes(t)) t = 'system';
      if (t === 'system') root.removeAttribute('data-au-theme'); else root.setAttribute('data-au-theme', t);
      if (persist) { try { localStorage.setItem(THEME_KEY, t); } catch { /* storage unavailable */ } }
      document.dispatchEvent(new CustomEvent('au:theme', { detail: { theme: t, resolved: this.resolved() } }));
      return t;
    },
    cycle() { return this.set(THEMES[(THEMES.indexOf(this.get()) + 1) % THEMES.length]); },
  };
  darkQuery.addEventListener('change', () => { if (theme.get() === 'system') document.dispatchEvent(new CustomEvent('au:theme', { detail: { theme: 'system', resolved: theme.resolved() } })); });
  const customScreens = {};
  /* AUKit.defineScreen(id, factory): the logic of a screen of your own (html: <div class="au-screen" data-au-screen="id">).
     Call it from a script loaded after app.js with `defer`. factory(ctx) gets { screen, id, toast, sheets, announce, fog, store,
     $, $$, esc } and returns { actions: { name(button, event) {} }, reset() {}, apply(urlParams) {} } — buttons with
     data-action="name" call the action. */
  const defineScreen = (id, factory) => { customScreens[id] = factory; };
  window.AUKit = Object.assign(window.AUKit || {}, { theme, screens: SCREENS, defineScreen });
  const themeLabel = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  /* ---------------------------------------------------------------------------------------------------------------------
     Language — English is the source; other languages come from a dictionary (scripts/i18n/<lang>.js → window.AU_I18N).
     Every text node and label (aria-label, placeholder, title, aria-valuetext) under <body> is translated, including text
     the screens render later (a MutationObserver), so screen code stays in English. The English original is kept, so the
     language can switch back and forth live.
       dictionary: { strings: { 'English': '번역' }, patterns: [[/^(\d+) of (\d+) points agreed$/, (m, t) => …]],
                     keep: ['ThinkPad X1 Carbon', …] }   — keep: English that stays as is (names, products)
     Avatars: <span class="au-avatar" data-name="Mina">M</span> shows the first letter of the translated name.
     Opt out: translate="no" on an element.  Missing strings: AUKit.i18n.missing() (and scripts/i18n-check.mjs).
     --------------------------------------------------------------------------------------------------------------------- */
  const LANGS = ['en', 'ko'];
  const LANG_KEY = 'au-lang';
  const i18n = (() => {
    let lang = LANGS.includes(root.getAttribute('data-au-lang')) ? root.getAttribute('data-au-lang') : 'en';
    const ATTRS = ['aria-label', 'placeholder', 'title', 'aria-valuetext'];
    const textOrig = new WeakMap(); const textSet = new WeakMap();      // node → English · node → what we wrote
    const attrOrig = new WeakMap();                                     // element → { attr: [English, written] }
    const missing = new Set(); let observer = null; let compiled = null; let compiledFor = null;
    const dict = () => {
      if (compiledFor === lang) return compiled;
      const d = (window.AU_I18N || {})[lang]; compiledFor = lang;
      compiled = d ? { strings: d.strings || {}, patterns: d.patterns || [], keep: new Set(d.keep || []) } : null;
      return compiled;
    };
    // translate one string (exact, then patterns); patterns get t() to translate their captured parts
    const t = (s) => {
      if (lang === 'en' || s == null) return s;
      const core = String(s).trim(); if (!core || !/[A-Za-z]/.test(core)) return s;
      const d = dict(); if (!d) return s;
      let out = Object.prototype.hasOwnProperty.call(d.strings, core) ? d.strings[core] : undefined;
      if (out === undefined) for (const [re, rep] of d.patterns) { const m = core.match(re); if (m) { out = typeof rep === 'function' ? rep(m, t) : core.replace(re, rep); break; } }
      if (out === undefined) { if (!d.keep.has(core)) missing.add(core); return s; }
      return String(s).replace(core, out);
    };
    const skip = (el) => !el || el.closest('[translate="no"], script, style, noscript, textarea, code, .ix-code');
    const doText = (n) => {
      const el = n.parentElement; if (skip(el)) return;
      if (el.classList.contains('au-avatar') && el.dataset.name) return;
      const cur = n.nodeValue;
      if (!textOrig.has(n) || cur !== textSet.get(n)) textOrig.set(n, cur);     // new, or changed by the screen
      const out = t(textOrig.get(n));
      textSet.set(n, out); if (out !== cur) n.nodeValue = out;
    };
    const doAttrs = (el) => {
      if (el.classList && el.classList.contains('au-avatar') && el.dataset.name) {
        const name = t(el.dataset.name); const letter = Array.from(String(name).trim())[0] || '';
        if (el.textContent !== letter) el.textContent = letter;
      }
      if (skip(el)) return;
      let rec = attrOrig.get(el);
      ATTRS.forEach((a) => {
        if (!el.hasAttribute(a)) return;
        const cur = el.getAttribute(a); rec = rec || {};
        if (!rec[a] || cur !== rec[a][1]) rec[a] = [cur, cur];
        const out = t(rec[a][0]); rec[a][1] = out; if (out !== cur) el.setAttribute(a, out);
      });
      if (rec) attrOrig.set(el, rec);
    };
    const walk = (node) => {
      if (node.nodeType === 3) { doText(node); return; }
      if (node.nodeType !== 1) return;
      doAttrs(node);
      node.querySelectorAll('*').forEach(doAttrs);
      const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) doText(n);
    };
    let titleOrig = null; let titleSet = null;
    const doTitle = () => { if (titleOrig === null || document.title !== titleSet) titleOrig = document.title; titleSet = t(titleOrig); if (document.title !== titleSet) document.title = titleSet; };
    const apply = () => {
      root.lang = lang; root.setAttribute('data-au-lang', lang);
      if (document.body) walk(document.body);
      doTitle();
      root.classList.remove('au-i18n-pending');
    };
    const start = () => {
      apply();
      if (observer || !window.MutationObserver) return;
      observer = new MutationObserver((records) => {
        records.forEach((r) => {
          if (r.type === 'characterData') doText(r.target);
          else if (r.type === 'attributes') doAttrs(r.target);
          else r.addedNodes.forEach(walk);
        });
        doTitle();
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS, 'data-name'] });
    };
    return {
      t, start, missing: () => [...missing].sort(),
      get: () => lang,
      set(l, { persist = !inFrame && !isCapture() } = {}) {
        if (!LANGS.includes(l)) l = 'en';
        lang = l; missing.clear();
        if (persist) { try { localStorage.setItem(LANG_KEY, l); } catch { /* storage unavailable */ } }
        apply();
        document.dispatchEvent(new CustomEvent('au:lang', { detail: { lang: l } }));
        return l;
      },
      toggle() { return this.set(lang === 'en' ? 'ko' : 'en'); },
    };
  })();
  window.AUKit.i18n = i18n;
  const langLabel = (l) => ({ en: 'EN', ko: '한국어' }[l] || l);

  /* =====================================================================================================================
     THE SCREEN SHELL
     ===================================================================================================================== */
  function initScreen(screen) {
    const id = screen.dataset.auScreen;
    const content = $('.au-content', screen);
    const post = (msg) => { if (inFrame) window.parent.postMessage(Object.assign({ screen: id }, msg), '*'); };

    /* toast ------------------------------------------------------------------------------------------------------------ */
    let toastTimer = 0;
    const toast = (msg) => {
      const inner = $('#toast', screen); if (!inner) return;
      inner.textContent = msg;
      inner.parentElement.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => inner.parentElement.classList.remove('is-visible'), 2400);
    };

    /* sheets: scrim, inert background, focus in and back out, Esc ----------------------------------------------------- */
    const sheets = (() => {
      let current = null; let opener = null; let hideTimer = 0;
      const scrim = $('.au-scrim', screen);
      const background = () => $$(':scope > .au-app-bar, :scope > .au-content, :scope > .au-footer', screen);
      function open(sheetId, from) {
        const sheet = document.getElementById(sheetId); if (!sheet) return;
        if (current === sheet) return;
        if (current) close(false);
        clearTimeout(hideTimer);
        opener = from || document.activeElement;
        current = sheet;
        scrim.hidden = false; sheet.hidden = false;
        void sheet.offsetHeight;                                   // start the transition from the closed position
        scrim.classList.add('is-open'); sheet.classList.add('is-open');
        background().forEach((el) => { el.inert = true; });
        sheet.dispatchEvent(new CustomEvent('au:sheet-open'));
        if (!isCapture()) setTimeout(() => sheet.focus({ preventScroll: true }), 40);
      }
      function close(restore = true) {
        if (!current) return;
        const sheet = current; current = null;
        sheet.classList.remove('is-open'); scrim.classList.remove('is-open');
        background().forEach((el) => { el.inert = false; });
        const hide = () => { sheet.hidden = true; if (!current) scrim.hidden = true; };
        if (still()) hide(); else hideTimer = setTimeout(hide, 320);
        if (restore && opener && document.contains(opener) && opener.focus) opener.focus({ preventScroll: true });
      }
      const closeAll = () => { $$('.au-sheet', screen).forEach((s) => { s.classList.remove('is-open'); s.hidden = true; }); scrim.classList.remove('is-open'); scrim.hidden = true; current = null; background().forEach((el) => { el.inert = false; }); };
      return { open, close, closeAll, get current() { return current; } };
    })();

    /* scroll fog — only while the content area actually scrolls -------------------------------------------------------- */
    const fog = () => {
      if (!content) return;
      const scrollable = content.scrollHeight > content.clientHeight + 1;
      content.classList.toggle('is-scrollable', scrollable);
      content.classList.toggle('is-at-end', content.scrollTop + content.clientHeight >= content.scrollHeight - 2);
    };
    if (content) {
      content.addEventListener('scroll', fog, { passive: true });
      const ro = new ResizeObserver(fog);
      ro.observe(content); Array.from(content.children).forEach((c) => ro.observe(c));
    }

    /* modes: system bars, UI-only (kept in the URL for standalone pages) ---------------------------------------------- */
    const devbar = $('.au-devbar');
    const syncDevbar = () => {
      if (!devbar) return;
      $('[data-dev="system-bars"]', devbar).setAttribute('aria-pressed', root.classList.contains('has-system-bars'));
      $('[data-dev="ui-only"]', devbar).setAttribute('aria-pressed', root.classList.contains('is-ui-only'));
      const tb = $('[data-dev="theme"]', devbar);
      if (tb) { tb.textContent = `Theme: ${themeLabel(theme.get())}`; tb.setAttribute('aria-label', `Theme: ${themeLabel(theme.get())}. Change theme`); }
      const lb = $('[data-dev="lang"]', devbar);
      if (lb) { lb.textContent = langLabel(i18n.get() === 'en' ? 'ko' : 'en'); lb.setAttribute('aria-label', i18n.get() === 'en' ? 'Switch to Korean' : 'Switch to English'); }
    };
    document.addEventListener('au:theme', syncDevbar);
    document.addEventListener('au:lang', syncDevbar);
    const setMode = (cls, on) => {
      root.classList.toggle(cls, on);
      syncDevbar();
      if (!inFrame) {
        const u = new URL(location.href);
        const key = cls === 'is-ui-only' ? 'ui' : 'statusbar';
        if (on) u.searchParams.set(key, '1'); else u.searchParams.delete(key);
        history.replaceState(null, '', u);
      }
      requestAnimationFrame(fog);
    };
    syncDevbar();

    /* navigation between screens (the clickable prototype) ----------------------------------------------------------------
       nav(href, { back, replace }) keeps the preview's modes (embed, ui, status bar, theme) and plays a short slide on the
       next page. Buttons: data-action="nav" data-href="x.html" [data-dir="back"]; links: <a href="x.html" data-nav>. */
    const NAV_KEY = 'au-nav-dir';
    const withModes = (href) => {
      const u = new URL(href, location.href);
      ['embed', 'ui'].forEach((k) => { if (params.get(k) === '1') u.searchParams.set(k, '1'); });
      if (root.classList.contains('has-system-bars')) u.searchParams.set('statusbar', '1');
      if (inFrame || params.has('theme')) u.searchParams.set('theme', theme.get());
      if (inFrame || params.has('lang') || i18n.get() !== 'en') u.searchParams.set('lang', i18n.get());
      return u.href;
    };
    const nav = (href, { back = false, replace = false } = {}) => {
      try { sessionStorage.setItem(NAV_KEY, back ? 'back' : 'forward'); } catch { /* storage unavailable */ }
      const to = withModes(href);
      if (replace) location.replace(to); else location.href = to;
    };
    try {
      const dir = sessionStorage.getItem(NAV_KEY); sessionStorage.removeItem(NAV_KEY);
      if (dir && !isCapture()) { screen.classList.add(`is-entering-${dir}`); setTimeout(() => screen.classList.remove(`is-entering-${dir}`), 400); }
    } catch { /* storage unavailable */ }
    screen.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-nav]'); if (!a || !screen.contains(a)) return;
      e.preventDefault(); nav(a.getAttribute('href'), { back: a.dataset.dir === 'back' });
    });

    /* the screen's own logic ------------------------------------------------------------------------------------------- */
    const ctx = { screen, id, toast, sheets, fog, post, store, $, $$, esc, nav, capture: isCapture(), params, announce: (msg) => { const a = $('[aria-live="polite"].au-visually-hidden', screen); if (a) { a.textContent = ''; setTimeout(() => { a.textContent = msg; }, 30); } } };
    const factory = customScreens[id] || { 'pc-health': pcHealth, 'meeting-notes': meetingNotes, 'our-discussion': ourDiscussion }[id];
    const app = Object.assign({ actions: {}, reset() {}, apply() {} }, factory ? factory(ctx) : {});

    const reset = (silent) => {
      store.clear(id);
      if (screen.dataset.auStore) store.clear(screen.dataset.auStore);    // state shared by a scenario's screens
      sheets.closeAll();
      app.reset();
      requestAnimationFrame(fog);
      if (!silent) toast('Demo data reset');
    };

    /* actions (event delegation) -------------------------------------------------------------------------------------- */
    const common = {
      back: () => {
        // data-au-back lists the screens this one can be opened from (first = default). Back returns to the one you came
        // from (history.back keeps the history clean and the query, e.g. ?m=); otherwise it goes to the default.
        const parents = (screen.dataset.auBack || '').split(/\s+/).filter(Boolean);
        let from = null; try { const r = new URL(document.referrer); if (r.origin === location.origin) from = r.pathname.split('/').pop(); } catch { /* no referrer */ }
        if (from && history.length > 1 && parents.some((x) => x.split('?')[0] === from)) {
          try { sessionStorage.setItem(NAV_KEY, 'back'); } catch { /* storage unavailable */ }
          history.back();
        } else if (parents[0]) nav(parents[0], { back: true });
        else if (inFrame) toast('This is the first screen');
        else location.href = 'index.html';
      },
      nav: (btn) => nav(btn.dataset.href, { back: btn.dataset.dir === 'back' }),
      sheet: (btn) => sheets.open(btn.dataset.sheet || btn.getAttribute('aria-controls'), btn),   // data-action="sheet" aria-controls="<sheet id>"
      'close-sheet': () => sheets.close(),
      reset: () => reset(false),
      share: () => toast('Link copied (demo)'),
    };
    screen.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]'); if (!btn || !screen.contains(btn)) return;
      const name = btn.dataset.action;
      const fn = app.actions[name] || common[name];
      if (fn) { e.preventDefault(); fn(btn, e); }
    });
    if (devbar) devbar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-dev]'); if (!b) return;
      if (b.dataset.dev === 'system-bars') setMode('has-system-bars', !root.classList.contains('has-system-bars'));
      if (b.dataset.dev === 'ui-only') setMode('is-ui-only', true);
      if (b.dataset.dev === 'reset') reset(false);
      if (b.dataset.dev === 'theme') { theme.cycle(); toast(`Theme: ${themeLabel(theme.get())}`); }
      if (b.dataset.dev === 'lang') i18n.toggle();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (sheets.current) { e.preventDefault(); sheets.close(); return; }
      if (inFrame) { post({ type: 'au:escape' }); return; }
      if (root.classList.contains('is-ui-only')) setMode('is-ui-only', false);
    });

    /* the preview bridge ------------------------------------------------------------------------------------------------ */
    window.addEventListener('message', (e) => {
      const d = e.data; if (!d || typeof d !== 'object' || typeof d.type !== 'string' || !d.type.startsWith('au:')) return;
      if (d.type === 'au:system-bars') { root.classList.toggle('has-system-bars', !!d.on); requestAnimationFrame(fog); }
      if (d.type === 'au:theme') theme.set(d.theme, { persist: false });
      if (d.type === 'au:lang') i18n.set(d.lang, { persist: false });
      if (d.type === 'au:reset') reset(!!d.silent);
      if (d.type === 'au:state') { reset(true); app.apply(new URLSearchParams(d.query || '')); requestAnimationFrame(fog); }
      if (d.type === 'au:validate') post({ type: 'au:report', report: validate(screen, id) });
    });

    /* start ------------------------------------------------------------------------------------------------------------- */
    app.apply(params);
    i18n.start();
    requestAnimationFrame(fog);
    root.classList.add('au-ready');
    post({ type: 'au:ready' });
    window.addEventListener('pageshow', (e) => { if (e.persisted) post({ type: 'au:ready' }); });   // restored by Back

    if (params.get('validate') === '1') {
      const run = () => requestAnimationFrame(() => requestAnimationFrame(() => {
        const report = validate(screen, id);
        post({ type: 'au:report', report });
        console.table(report.checks.map((c) => ({ check: c.name, pass: c.pass, detail: c.detail })));
      }));
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(run);
    }
  }

  /* ---------------------------------------------------------------------------------------------------------------------
     The 390 × 844 check
     --------------------------------------------------------------------------------------------------------------------- */
  function validate(screen, id) {
    const checks = [];
    const add = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail });
    const r = screen.getBoundingClientRect();
    const cs = getComputedStyle(root);
    const safeTop = parseFloat(cs.getPropertyValue('--au-safe-top')) || 47;
    const safeBottom = parseFloat(cs.getPropertyValue('--au-safe-bottom')) || 34;
    const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.className || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 32);
    const visible = (el) => {
      if (el.closest('[hidden], [inert], .au-status-bar, .au-home-indicator')) return false;
      const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0;
    };

    add('Viewport is 390 × 844', window.innerWidth === 390 && window.innerHeight === 844, `${window.innerWidth} × ${window.innerHeight}`);
    add('Screen is 390 × 844', Math.round(r.width) === 390 && Math.round(r.height) === 844, `${Math.round(r.width)} × ${Math.round(r.height)}`);
    const de = document.documentElement;
    add('No page scroll', de.scrollHeight <= window.innerHeight + 1 && de.scrollWidth <= window.innerWidth + 1, `${de.scrollWidth} × ${de.scrollHeight}`);

    const content = $('.au-content', screen);
    if (content) {
      if (screen.dataset.auScroll === 'true') add('Content fits without scrolling', true, `scrolling list — allowed (${content.scrollHeight} / ${content.clientHeight} px)`);
      else add('Content fits without scrolling', content.scrollHeight <= content.clientHeight + 1, `${content.scrollHeight} / ${content.clientHeight} px`);
    }

    const outside = $$('*', screen).filter((el) => visible(el) && !el.closest('.au-sheet, .au-scrim, .au-toast, .au-visually-hidden')).filter((el) => {
      const b = el.getBoundingClientRect(); return b.left < r.left - 0.5 || b.right > r.right + 0.5;
    });
    add('Nothing outside the screen edges', outside.length === 0, outside.slice(0, 4).map(name).join(', ') || 'none');

    const regions = $$(':scope > .au-app-bar, :scope > .au-content, :scope > .au-footer', screen);
    const unsafe = regions.filter((el) => { const b = el.getBoundingClientRect(); return b.top < r.top + safeTop - 0.5 || b.bottom > r.bottom - safeBottom + 0.5; });
    add(`Inside the safe area (${safeTop} / ${safeBottom})`, unsafe.length === 0, unsafe.map((el) => el.className.split(' ')[0]).join(', ') || 'header, content, footer');

    const gutter = parseFloat(cs.getPropertyValue('--au-gutter')) || 24;
    const tight = $$('.au-content > *, .au-footer > *', screen).filter(visible).filter((el) => {
      const b = el.getBoundingClientRect(); return b.left < r.left + gutter - 0.5 || b.right > r.right - gutter + 0.5;
    });
    add(`${gutter} px side padding`, tight.length === 0, tight.slice(0, 4).map(name).join(', ') || 'all blocks');

    const targets = $$('button, a[href], input, textarea, select, [role="tab"], [role="radio"], [role="switch"], [role="checkbox"], [tabindex]:not([tabindex="-1"])', screen)
      .filter((el) => el.tabIndex !== -1 || el.matches('[role="tab"], [role="radio"]')).filter(visible).filter((el) => !el.matches('.au-sheet'));
    const small = targets.filter((el) => { const b = el.getBoundingClientRect(); return b.width < 43.5 || b.height < 43.5; });
    add('Touch targets ≥ 44 × 44', small.length === 0, small.length ? small.slice(0, 4).map((el) => `${name(el)} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`).join(', ') : `${targets.length} checked`);

    const unnamed = targets.filter((el) => {
      const label = el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent) || el.textContent || (el.id && $(`label[for="${el.id}"]`)?.textContent) || el.getAttribute('placeholder');
      return !label || !label.trim();
    });
    add('Every control has a name', unnamed.length === 0, unnamed.slice(0, 4).map((el) => el.outerHTML.slice(0, 40)).join(', ') || `${targets.length} named`);

    if (id === 'meeting-notes' || id === 'our-discussion') {
      const tag = $$('.au-demo-tag', screen).filter(visible);
      add('Demo data is labelled on screen', tag.length > 0, `${tag.length} DEMO tag(s)`);
    }
    return { screen: id, pass: checks.every((c) => c.pass), checks, at: new Date().toISOString() };
  }

  /* =====================================================================================================================
     DEMO DATA — shared by each scenario's main screen and its detail screens (window.AUKit.data)
     ===================================================================================================================== */
  const PH_ITEMS = [
    { key: 'cpu', name: 'CPU', icon: 'cpu', spec: 'Intel Core i7-1165G7' },
    { key: 'gpu', name: 'GPU', icon: 'gpu', spec: 'Intel Iris Xe Graphics' },
    { key: 'memory', name: 'Memory', icon: 'memory', spec: '16 GB LPDDR4x' },
  ];
  const PH_OK = {
    cpu: { pct: 97, status: 'Normal', tone: 'positive', rows: [['Temperature', '52°C'], ['Stress test', 'Passed'], ['Throttling', 'None']] },
    gpu: { pct: 99, status: 'Normal', tone: 'positive', rows: [['Temperature', '48°C'], ['Render test', 'Passed'], ['Artifacts', 'None found']] },
    memory: { pct: 98, status: 'Normal', tone: 'positive', rows: [['Speed', '4266 MT/s'], ['Error test', '0 errors in 4 passes'], ['Usable', '15.7 GB']] },
  };
  const PH_HOT_GPU = { pct: 72, status: 'Check', tone: 'warning', rows: [['Temperature', '91°C', 'warning'], ['Render test', 'Passed'], ['Artifacts', 'None found']] };
  const PH_SCENARIOS = [
    { id: 'healthy', score: 98, state: 'Healthy', tone: 'positive', icon: 'shield', notice: '<strong>All components passed.</strong> This PC is in great shape for a trade.', items: {} },
    { id: 'fair', score: 84, state: 'Fair', tone: 'warning', icon: 'alert', notice: '<strong>The GPU runs hot under load.</strong> Ask the seller about cooling before you buy.', items: { gpu: PH_HOT_GPU } },
    { id: 'attention', score: 61, state: 'Needs attention', tone: 'critical', icon: 'alert', notice: '<strong>Memory errors found.</strong> Ask for a repair or a lower price.', items: { gpu: PH_HOT_GPU, memory: { pct: 41, status: 'Issue', tone: 'critical', rows: [['Speed', '4266 MT/s'], ['Error test', '12 errors in pass 2', 'critical'], ['Usable', '15.7 GB']] } } },
  ];

  const MN_SCRIPT = [
    { who: 'Sarah', text: 'Let’s lock the launch for Nov 18.' },
    { who: 'Daniel', text: 'Design QA wraps up by Thursday.' },
    { who: 'Priya', text: 'Legal still has to review the pricing page.' },
    { who: 'Sarah', text: 'Then let’s send it over by Monday.' },
    { who: 'Alex', text: 'I’ll update the release notes tonight.' },
    { who: 'Daniel', text: 'The final build goes out tomorrow morning.' },
  ];
  const MN_POINTS = ['Launch date set for November 18', 'Design QA wraps up by Thursday', 'Pricing page needs legal review before launch'];
  const MN_ACTIONS = [
    { id: 'a1', text: 'Confirm the launch date with marketing', who: 'Sarah' },
    { id: 'a2', text: 'Send the pricing page to legal', who: 'Priya' },
    { id: 'a3', text: 'Share the final build for QA', who: 'Daniel' },
  ];

  const OD_PEOPLE = { you: { name: 'Mina', initial: 'M' }, partner: { name: 'Joon', initial: 'J' } };
  const OD_OPTIONS = [
    { id: 'a', label: 'OPTION A', title: 'Italy', reason: 'Food, art and the Amalfi coast' },
    { id: 'b', label: 'OPTION B', title: 'Japan', reason: 'Easy trains, onsen towns and great food' },
  ];
  const OD_POINTS = [
    { id: 'budget', name: 'Budget', note: 'Up to ₩6,000,000' },
    { id: 'dates', name: 'Dates', note: 'Jul 12 – 19' },
    { id: 'length', name: 'Trip length', note: '7 nights' },
    { id: 'destination', name: 'Destination', auto: true },
    { id: 'activities', name: 'Activities', note: 'Not settled yet' },
  ];
  const OD_DEFAULTS = {
    you: 'b', partner: 'a', agreed: ['budget', 'dates', 'length'],
    messages: [
      { from: 'partner', text: 'Amalfi in July would be perfect.' },
      { from: 'you', text: 'Japan is easier to get around with a rail pass.' },
      { from: 'partner', text: 'Let’s agree on activities first?' },
    ],
  };
  window.AUKit.data = {
    pcHealth: { items: PH_ITEMS, ok: PH_OK, scenarios: PH_SCENARIOS },
    meeting: { script: MN_SCRIPT, points: MN_POINTS, actions: MN_ACTIONS },
    discussion: { people: OD_PEOPLE, options: OD_OPTIONS, points: OD_POINTS, defaults: OD_DEFAULTS },
  };

  /* =====================================================================================================================
     01 PC HEALTH
     ===================================================================================================================== */
  function pcHealth({ screen, toast, sheets, announce, nav }) {
    const C = 2 * Math.PI * Number($('#ph-ring-value').getAttribute('r'));   // ring circumference
    const ITEMS = PH_ITEMS; const OK = PH_OK; const SCENARIOS = PH_SCENARIOS;   // data: top of the file (shared with the detail screens)
    const DEFAULTS = { scenario: 0, open: null, scannedAt: null };
    let state = store.get('pc-health', DEFAULTS);
    let shown = null; let scanTimer = 0;
    const el = {
      ring: $('#ph-ring'), value: $('#ph-ring-value'), score: $('#ph-score'), state: $('#ph-state'), time: $('#ph-time'),
      diags: $('#ph-diags'), notice: $('#ph-notice'), noticeIcon: $('#ph-notice-icon'), noticeText: $('#ph-notice-text'),
      rescan: $('#ph-rescan'), report: $('#ph-report-body'),
    };
    const scenario = () => SCENARIOS[state.scenario] || SCENARIOS[0];
    const item = (key) => scenario().items[key] || OK[key];
    const save = () => store.set('pc-health', state);

    /* cards: built once, then updated in place so bars and status animate */
    el.diags.innerHTML = ITEMS.map((it) => `
      <article class="ph-diag" data-key="${it.key}">
        <button class="ph-diag__head" type="button" aria-expanded="false" aria-controls="ph-${it.key}-detail" data-action="toggle" data-key="${it.key}">
          <span class="au-icon-box" aria-hidden="true"><i class="au-icon au-icon--${it.icon}"></i></span>
          <span class="ph-diag__text"><span class="ph-diag__name">${it.name}</span><span class="ph-diag__spec">${esc(it.spec)}</span></span>
          <span class="ph-diag__meta"><span class="ph-diag__status" data-f="status"></span><span class="ph-diag__pct" data-f="pct"></span></span>
          <i class="au-icon au-icon--chevron-down ph-diag__chev" aria-hidden="true"></i>
        </button>
        <div class="ph-diag__bar">
          <div class="au-progress" role="progressbar" aria-label="${it.name} health" aria-valuemin="0" aria-valuemax="100"><span class="au-progress__value"></span></div>
        </div>
        <div class="ph-diag__detail" id="ph-${it.key}-detail" role="region" aria-label="${it.name} details">
          <div><dl class="au-rows">${[0, 1, 2].map(() => '<div class="au-row"><dt class="au-row__label"></dt><dd class="au-row__value"></dd></div>').join('')}</dl>
            <button class="au-button au-button--text ph-diag__more" type="button" data-action="nav" data-href="pc-health-part.html?part=${it.key}">See ${it.name} details<i class="au-icon au-icon--chevron-right" aria-hidden="true"></i></button></div>
        </div>
      </article>`).join('');

    function renderDiags() {
      ITEMS.forEach((it) => {
        const d = item(it.key); const card = $(`.ph-diag[data-key="${it.key}"]`, el.diags);
        card.dataset.tone = d.tone;
        $('[data-f="status"]', card).textContent = d.status;
        $('[data-f="pct"]', card).textContent = `${d.pct}%`;
        const bar = $('.au-progress', card); bar.setAttribute('aria-valuenow', d.pct); bar.setAttribute('aria-valuetext', `${d.pct}%, ${d.status}`);
        $('.au-progress__value', card).style.setProperty('--au-value', `${d.pct}%`);
        $$('.au-row', card).forEach((row, i) => {
          const [label, value, tone] = d.rows[i];
          row.firstElementChild.textContent = label; row.lastElementChild.textContent = value;
          if (tone) row.lastElementChild.dataset.tone = tone; else delete row.lastElementChild.dataset.tone;
        });
      });
      renderOpen();
    }
    function renderOpen() {
      ITEMS.forEach((it) => {
        const card = $(`.ph-diag[data-key="${it.key}"]`, el.diags); const open = state.open === it.key;
        card.classList.toggle('is-open', open);
        $('.ph-diag__head', card).setAttribute('aria-expanded', open);
        const detail = $('.ph-diag__detail', card); detail.inert = !open; detail.setAttribute('aria-hidden', !open);
      });
    }
    function countTo(target, animate) {
      if (!animate || still() || shown === null) { el.score.textContent = target; shown = target; return; }
      const from = shown; const t0 = performance.now(); const dur = 900;
      const step = (t) => { const k = Math.min(1, (t - t0) / dur); el.score.textContent = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); else shown = target; };
      requestAnimationFrame(step);
    }
    function renderScore(animate) {
      const s = scenario();
      el.ring.dataset.tone = s.tone;
      el.ring.classList.remove('is-scanning');
      el.value.setAttribute('stroke-dasharray', C.toFixed(2));
      el.value.style.strokeDashoffset = (C * (1 - s.score / 100)).toFixed(2);
      el.state.textContent = s.state;
      el.ring.setAttribute('aria-valuenow', s.score);
      el.ring.setAttribute('aria-valuetext', `${s.score}%, ${s.state}`);
      countTo(s.score, animate);
      el.notice.dataset.tone = s.tone;
      el.noticeIcon.className = `au-icon au-icon--${s.icon}`;
      el.noticeText.innerHTML = s.notice;
    }
    function renderTime() {
      const dev = $('#ph-device-name'); if (dev) dev.textContent = state.device || 'ThinkPad X1 Carbon';
      if (!state.scannedAt) { el.time.textContent = 'Scanned 2 min ago'; return; }
      const min = Math.floor((Date.now() - state.scannedAt) / 60000);
      el.time.textContent = min < 1 ? 'Scanned just now' : `Scanned ${min} min ago`;
    }
    function renderReport() {
      const s = scenario();
      const row = (l, v, tone) => `<div class="au-row"><dt class="au-row__label">${esc(l)}</dt><dd class="au-row__value"${tone ? ` data-tone="${tone}"` : ''}>${esc(v)}</dd></div>`;
      el.report.innerHTML = `
        <div class="au-sheet__section">
          <div class="ph-report-sum" data-tone="${s.tone}">
            <span class="ph-report-sum__num">${s.score}<small>%</small></span>
            <span class="au-badge" data-tone="${s.tone}">${esc(s.state)}</span>
            <span class="au-demo-tag" style="margin-left:auto">Demo</span>
          </div>
          <dl class="au-rows">${row('Device', 'ThinkPad X1 Carbon Gen 9')}${row('Serial', 'PF-3K2D9')}${row('Scanned', state.scannedAt ? (Math.floor((Date.now() - state.scannedAt) / 60000) < 1 ? 'just now' : `${Math.floor((Date.now() - state.scannedAt) / 60000)} min ago`) : '2 min ago')}${row('Report ID', `PH-2611-0${482 + state.scenario}`)}</dl>
        </div>
        ${ITEMS.map((it) => { const d = item(it.key); return `
        <div class="au-sheet__section">
          <p class="au-sheet__label">${esc(it.spec)} (${it.name})</p>
          <dl class="au-rows">${row('Health', `${d.pct}%`)}${row('Status', d.status, d.tone)}${d.rows.map((r) => row(r[0], r[1], r[2])).join('')}</dl>
        </div>`; }).join('')}
        <p class="au-text-meta" style="margin-top:16px">Sample values for the preview — no hardware was read.</p>`;
    }
    function rescan() {
      if (scanTimer) return;
      sheets.close(false);
      el.rescan.setAttribute('aria-busy', 'true'); el.rescan.disabled = true;
      el.ring.classList.add('is-scanning');
      el.value.style.strokeDashoffset = (C * 0.72).toFixed(2);
      el.state.textContent = 'Scanning…';
      el.time.textContent = 'Checking CPU, GPU and memory';
      announce('Scanning');
      scanTimer = setTimeout(() => {
        scanTimer = 0;
        state.scenario = (state.scenario + 1) % SCENARIOS.length; state.scannedAt = Date.now(); save();
        el.rescan.removeAttribute('aria-busy'); el.rescan.disabled = false;
        renderScore(true); renderDiags(); renderTime();
        announce(`Scan complete: ${scenario().score}%, ${scenario().state}`);
        el.rescan.focus({ preventScroll: true });
      }, still() ? 0 : 1800);
    }
    function render(animate) { renderScore(animate); renderDiags(); renderTime(); }

    if (!isCapture()) setInterval(() => { if (!scanTimer) renderTime(); }, 30000);

    return {
      actions: {
        toggle: (btn) => {
          const key = btn.dataset.key; state.open = state.open === key ? null : key; save(); renderOpen();
          if (state.open) setTimeout(() => btn.closest('.ph-diag').scrollIntoView({ block: 'nearest', behavior: still() ? 'auto' : 'smooth' }), still() ? 0 : 320);
        },
        rescan,
        report: () => nav('pc-health-report.html'),        // the full report screen (the sheet stays for ?sheet=report)
        menu: (btn) => sheets.open('ph-menu', btn),
        share: () => { sheets.close(); toast('Report link copied (demo)'); },
      },
      reset() { clearTimeout(scanTimer); scanTimer = 0; el.rescan.disabled = false; el.rescan.removeAttribute('aria-busy'); state = clone(DEFAULTS); shown = null; render(false); },
      apply(p) {
        const sc = SCENARIOS.findIndex((s) => s.id === p.get('scenario')); if (sc >= 0) state.scenario = sc;
        if (ITEMS.some((i) => i.key === p.get('open'))) state.open = p.get('open');
        render(false);
        if (p.get('sheet') === 'report') { renderReport(); sheets.open('ph-report'); }
        if (p.get('sheet') === 'menu') sheets.open('ph-menu');
      },
    };
  }

  /* =====================================================================================================================
     02 MEETING NOTES — a demo recorder (no microphone)
     ===================================================================================================================== */
  function meetingNotes({ screen, toast, sheets, announce, nav }) {
    const SCRIPT = MN_SCRIPT; const POINTS = MN_POINTS; const ACTIONS = MN_ACTIONS;
    const DEFAULTS = { rec: 'recording', elapsed: 156, heard: 2, tab: 'points', done: [] };
    const LINE_EVERY = 6;                                           // seconds of recording per new transcript line
    let state = clone(DEFAULTS);                                    // a live recording is not restored from storage
    let startAt = 0; let running = false; let nextLineAt = 0; let tickTimer = 0; let raf = 0;
    const el = {
      time: $('#mn-time'), statusText: $('#mn-status-text'), live: $('#mn-live'), meta: $('#mn-summary-meta'), lines: $('#mn-lines'),
      points: $('#mn-points'), actions: $('#mn-actions'), controls: $('#mn-controls'), wave: $('#mn-wave'),
      tabs: $$('[role="tab"]', screen),
    };

    /* waveform: N + 1 bars that scroll left; amplitudes from a seeded, speech-like generator */
    const N = 46; const W = 342; const H = 72; const BW = 4; const STEP = (W - BW) / (N - 1); const INTERVAL = 120;
    let rand = seeded(20261115); let t = 0;
    const nextAmp = () => {
      t += 1;
      const syllable = Math.abs(Math.sin(t * 0.62 + Math.sin(t * 0.19) * 1.6));
      const phrase = 0.5 + 0.38 * Math.sin(t * 0.13 + 0.6) + 0.12 * Math.sin(t * 0.41);
      const gap = Math.sin(t * 0.05 + 2.2) > 0.94 ? 0.15 : 1;
      return clamp(0.08 + (syllable * 0.6 + rand() * 0.4) * phrase * gap, 0.06, 1);
    };
    let samples = [];
    const seedWave = () => { rand = seeded(20261115); t = 0; samples = Array.from({ length: N + 1 }, nextAmp); };
    const SVGNS = 'http://www.w3.org/2000/svg';
    el.wave.innerHTML = '';
    const bars = Array.from({ length: N + 1 }, () => { const r = document.createElementNS(SVGNS, 'rect'); r.setAttribute('width', BW); r.setAttribute('rx', BW / 2); el.wave.appendChild(r); return r; });
    function drawWave(p = 0, flat = false) {
      bars.forEach((r, i) => {
        const a = flat ? 0.04 : samples[i];
        const h = Math.max(BW, 4 + a * (H - 8));
        r.setAttribute('x', (i * STEP - p * STEP).toFixed(2));
        r.setAttribute('y', ((H - h) / 2).toFixed(2));
        r.setAttribute('height', h.toFixed(2));
        r.setAttribute('opacity', clamp(0.28 + 0.72 * ((i - p) / (N - 1)), 0, 1).toFixed(3));
      });
    }
    let lastShift = 0;
    function loop(now) {
      if (now - lastShift >= INTERVAL) { const steps = Math.min(4, Math.floor((now - lastShift) / INTERVAL)); for (let k = 0; k < steps; k++) { samples.shift(); samples.push(nextAmp()); } lastShift = now; }
      drawWave((now - lastShift) / INTERVAL);
      raf = requestAnimationFrame(loop);
    }

    /* timer and transcript */
    const elapsed = () => (running ? (performance.now() - startAt) / 1000 : state.elapsed);
    const fmt = (s) => { s = Math.floor(s); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60; return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; };
    function renderTime() {
      const s = elapsed();
      el.time.textContent = fmt(s);
      el.time.setAttribute('aria-label', `Elapsed time ${fmt(s)}`);
      if (state.rec === 'recording' && s >= nextLineAt) { state.heard += 1; nextLineAt += LINE_EVERY; renderLines(true); }
    }
    function renderLines(fresh) {
      if (state.heard === 0) { el.lines.innerHTML = `<p class="au-text-meta">${state.rec === 'recording' ? 'Listening…' : 'Nothing transcribed yet'}</p>`; return; }
      const from = Math.max(0, state.heard - 2);
      el.lines.innerHTML = Array.from({ length: state.heard - from }, (_, k) => {
        const n = from + k; const line = SCRIPT[n % SCRIPT.length];
        return `<p class="mn-line${fresh && n === state.heard - 1 ? ' is-new' : ''}"><span class="mn-line__who">${esc(line.who)}</span><span class="mn-line__text">${esc(line.text)}</span></p>`;
      }).join('');
    }
    function renderSummary() {
      el.points.innerHTML = POINTS.map((p) => `<li class="mn-point"><span class="mn-point__text">${esc(p)}</span></li>`).join('');
      el.actions.innerHTML = ACTIONS.map((a) => {
        const done = state.done.includes(a.id);
        return `<button class="mn-action" type="button" role="checkbox" aria-checked="${done}" data-action="check" data-id="${a.id}">
          <span class="mn-action__box" aria-hidden="true"><i class="au-icon au-icon--check"></i></span>
          <span class="mn-action__text">${esc(a.text)}</span><span class="mn-action__who">${esc(a.who)}</span></button>`;
      }).join('');
      el.tabs.forEach((tab) => {
        const on = tab.dataset.tab === state.tab;
        tab.setAttribute('aria-selected', on); tab.tabIndex = on ? 0 : -1;
        document.getElementById(tab.getAttribute('aria-controls')).hidden = !on;
      });
    }
    const button = (action, cls, icon, label) => `<button class="au-button ${cls}" type="button" data-action="${action}"><i class="au-icon au-icon--${icon}" aria-hidden="true"></i><span>${label}</span></button>`;
    function renderControls() {
      const focused = $$('button', el.controls).indexOf(document.activeElement);
      el.controls.innerHTML = {
        recording: button('pause', 'au-button--secondary', 'pause', 'Pause') + button('stop', 'au-button--danger', 'stop', 'Stop'),
        paused: button('resume', 'au-button--secondary', 'play', 'Resume') + button('stop', 'au-button--danger', 'stop', 'Stop'),
        stopped: button('share', 'au-button--secondary au-button--hug', 'share', 'Share') + button('new', '', 'mic', 'New recording'),
      }[state.rec];
      if (focused >= 0) $$('button', el.controls)[Math.min(focused, 1)].focus({ preventScroll: true });
    }
    function renderState() {
      screen.dataset.rec = state.rec;
      el.statusText.textContent = { recording: 'Recording', paused: 'Paused', stopped: 'Saved' }[state.rec];
      el.live.textContent = { recording: 'Live', paused: 'Paused', stopped: 'Ended' }[state.rec];
      el.meta.textContent = { recording: 'Updated live', paused: 'Paused', stopped: 'Final' }[state.rec];
      renderControls();
      cancelAnimationFrame(raf); clearInterval(tickTimer); running = false;
      if (state.rec === 'recording' && !isCapture()) {
        startAt = performance.now() - state.elapsed * 1000; running = true;
        tickTimer = setInterval(renderTime, 200);
        if (!reduceMotion()) { lastShift = performance.now(); raf = requestAnimationFrame(loop); } else drawWave(0);
      } else {
        drawWave(0, state.rec === 'stopped' && state.heard === 0);
      }
      renderTime();
    }
    function setRec(next) {
      state.elapsed = elapsed();
      state.rec = next;
      renderState();
    }

    const tabTo = (name, focus) => { state.tab = name; renderSummary(); if (focus) $(`[data-tab="${name}"]`, screen).focus(); };
    $('[role="tablist"]', screen).addEventListener('keydown', (e) => {
      const i = el.tabs.findIndex((x) => x.dataset.tab === state.tab);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: el.tabs.length - 1 }[e.key];
      if (to === undefined) return; e.preventDefault();
      tabTo(el.tabs[(to + el.tabs.length) % el.tabs.length].dataset.tab, true);
    });

    function start(p = new URLSearchParams()) {
      state = clone(DEFAULTS);
      const rec = p.get('rec'); if (['recording', 'paused', 'stopped'].includes(rec)) state.rec = rec;
      const tParam = Number(p.get('t')); if (Number.isFinite(tParam) && p.has('t')) { state.elapsed = clamp(tParam, 0, 35999); state.heard = Math.min(SCRIPT.length, 2 + Math.floor(Math.max(0, state.elapsed - 156) / LINE_EVERY)); }
      if (['points', 'actions'].includes(p.get('tab'))) state.tab = p.get('tab');
      if (p.get('fresh') === '1') { state.elapsed = 0; state.heard = 0; }          // a new recording from the meetings list
      nextLineAt = state.heard === 0 ? 4 : state.elapsed + LINE_EVERY;
      seedWave();
      renderLines(false); renderSummary(); renderState();
      if (p.get('sheet') === 'menu') sheets.open('mn-menu');
    }

    $$('[data-tab]', screen).forEach((b) => b.addEventListener('click', () => tabTo(b.dataset.tab)));

    return {
      actions: {
        pause: () => { setRec('paused'); announce('Recording paused'); },
        resume: () => { setRec('recording'); announce('Recording resumed'); },
        stop: () => {
          setRec('stopped'); toast('Saved, now creating notes'); announce(`Recording saved, ${fmt(state.elapsed)}`);
          setTimeout(() => nav(`meeting-notes-processing.html?d=${Math.floor(state.elapsed)}`, { replace: true }), still() ? 0 : 700);
        },
        new: () => { running = false; state.elapsed = 0; state.heard = 0; nextLineAt = 4; state.rec = 'recording'; seedWave(); renderLines(false); renderState(); announce('New recording started'); },
        check: (btn) => { const id = btn.dataset.id; state.done = state.done.includes(id) ? state.done.filter((x) => x !== id) : state.done.concat(id); btn.setAttribute('aria-checked', state.done.includes(id)); },
        menu: (btn) => sheets.open('mn-menu', btn),
        share: () => { sheets.close(); toast('Notes link copied (demo)'); },
      },
      reset() { start(); },
      apply(p) { start(p); },
    };
  }

  /* =====================================================================================================================
     03 OUR DISCUSSION
     ===================================================================================================================== */
  function ourDiscussion({ screen, toast, sheets, announce, nav }) {
    const PEOPLE = OD_PEOPLE; const OPTIONS = OD_OPTIONS; const POINTS = OD_POINTS; const DEFAULTS = OD_DEFAULTS;
    let state = store.get('our-discussion', DEFAULTS);
    let shownPct = null;
    const el = { options: $('#od-options'), pct: $('#od-pct'), steps: $('#od-steps'), caption: $('#od-caption'),
      points: $('#od-points'), thread: $('#od-thread'), body: $('#od-sheet-body'), form: $('#od-compose'), input: $('#od-input'), send: $('#od-send') };
    const save = () => store.set('our-discussion', state);
    const option = (id) => OPTIONS.find((o) => o.id === id);
    const agreedSet = () => { const s = new Set(state.agreed); if (state.you === state.partner) s.add('destination'); else s.delete('destination'); return s; };
    const avatar = (who, size = 'sm') => `<span class="au-avatar au-avatar--${size} au-avatar--ring" data-person="${who}" data-name="${PEOPLE[who].name}" aria-hidden="true">${PEOPLE[who].initial}</span>`;

    el.steps.style.setProperty('--od-steps', POINTS.length);
    el.steps.innerHTML = POINTS.map(() => '<span class="od-step"></span>').join('');

    function renderOptions() {
      const focusedId = document.activeElement && document.activeElement.closest('.od-option')?.dataset.id;
      el.options.innerHTML = OPTIONS.map((o) => {
        const you = state.you === o.id; const partner = state.partner === o.id;
        const who = you && partner ? 'Both' : you ? 'You' : partner ? PEOPLE.partner.name : '';
        return `<button class="od-option" type="button" role="radio" aria-checked="${you}" tabindex="${you ? 0 : -1}" data-action="choose" data-id="${o.id}">
          <span class="od-radio" aria-hidden="true"><i class="au-icon au-icon--check"></i></span>
          <span class="od-option__text">
            <span class="od-option__label">${o.label}</span>
            <span class="od-option__title au-truncate">${esc(o.title)}</span>
            <span class="od-option__reason au-clamp-2">${esc(o.reason)}</span>
          </span>
          <span class="od-option__voters">
            <span class="au-avatars au-avatars--sm">${partner ? avatar('partner') : ''}${you ? avatar('you') : ''}</span>
            <span class="od-option__count">${who ? `<span class="au-visually-hidden">Picked by </span>${who}` : ''}</span>
          </span>
        </button>`;
      }).join('');
      if (focusedId) $(`.od-option[data-id="${focusedId}"]`, el.options)?.focus({ preventScroll: true });
    }
    function renderAgreement(animate) {
      const set = agreedSet(); const n = set.size; const pct = Math.round((n / POINTS.length) * 100);
      $$('.od-step', el.steps).forEach((s, i) => s.classList.toggle('is-on', i < n));
      el.steps.setAttribute('aria-valuenow', pct);
      el.steps.setAttribute('aria-valuetext', `${pct}%, ${n} of ${POINTS.length} points agreed (demo data)`);
      el.caption.textContent = `${n} of ${POINTS.length} points agreed`;
      if (!animate || still() || shownPct === null) { el.pct.textContent = `${pct}%`; shownPct = pct; return; }
      const from = shownPct; const t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 500); el.pct.textContent = `${Math.round(from + (pct - from) * (1 - Math.pow(1 - k, 3)))}%`; if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step); shownPct = pct;
    }
    function renderPanel() {
      const set = agreedSet();
      el.points.innerHTML = POINTS.map((p) => {
        const on = set.has(p.id);
        const icon = `<i class="au-icon au-icon--${on ? 'check-circle' : 'circle'}" aria-hidden="true"></i>`;
        if (p.auto) {
          const note = state.you === state.partner ? `Both picked ${option(state.you).title}` : `You: ${option(state.you).title}, Joon: ${option(state.partner).title}`;
          return `<div role="listitem" class="od-point${on ? ' is-agreed' : ''}">${icon}<span class="au-truncate"><span class="od-point__name">${p.name}</span><br><span class="au-text-meta">${esc(note)}</span></span><span class="od-point__state">${on ? 'Agreed' : 'Pick the same option'}</span></div>`;
        }
        return `<div role="listitem"><button type="button" class="od-point${on ? ' is-agreed' : ''}" aria-pressed="${on}" data-action="point" data-id="${p.id}">${icon}<span class="au-truncate"><span class="od-point__name">${p.name}</span><br><span class="au-text-meta">${esc(p.note)}</span></span><span class="od-point__state">${on ? 'Agreed' : 'Mark agreed'}</span></button></div>`;
      }).join('');
      el.thread.innerHTML = state.messages.map((m) => `
        <div class="od-msg" data-from="${m.from}">${avatar(m.from)}<p class="od-msg__bubble"><span class="au-visually-hidden">${PEOPLE[m.from].name}: </span>${esc(m.text)}</p></div>`).join('');
    }
    function render(animate) { renderOptions(); renderAgreement(animate); renderPanel(); }

    function choose(id, focus) {
      if (!option(id) || state.you === id) return;
      state.you = id; save(); render(true);
      if (focus) $(`.od-option[data-id="${id}"]`, el.options).focus();
      const msg = state.you === state.partner ? `You both picked ${option(id).title}` : `Your pick changed to ${option(id).title}`;
      toast(msg); announce(`${msg}. Agreement ${Math.round((agreedSet().size / POINTS.length) * 100)}%`);
    }
    el.options.addEventListener('keydown', (e) => {
      const i = OPTIONS.findIndex((o) => o.id === state.you);
      const to = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: OPTIONS.length - 1 }[e.key];
      if (to === undefined) return; e.preventDefault();
      choose(OPTIONS[(to + OPTIONS.length) % OPTIONS.length].id, true);
    });
    el.input.addEventListener('input', () => { el.send.disabled = !el.input.value.trim(); });
    el.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = el.input.value.trim(); if (!text) return;
      state.messages.push({ from: 'you', text: text.slice(0, 200) }); save();
      el.input.value = ''; el.send.disabled = true; renderPanel();
      el.body.scrollTo({ top: el.body.scrollHeight, behavior: still() ? 'auto' : 'smooth' });
      el.input.focus();
    });

    return {
      actions: {
        choose: (btn) => choose(btn.dataset.id),
        point: (btn) => {
          const id = btn.dataset.id; const on = state.agreed.includes(id);
          state.agreed = on ? state.agreed.filter((x) => x !== id) : state.agreed.concat(id); save();
          renderAgreement(true); renderPanel(); $(`[data-action="point"][data-id="${id}"]`, el.points)?.focus();
          const n = agreedSet().size; if (n === POINTS.length) toast('You agree on every point');
        },
        'agree-info': (btn) => sheets.open('od-info', btn),
        discuss: () => nav('our-discussion-thread.html'),  // the discussion screen (the panel sheet stays for ?sheet=discuss)
        menu: (btn) => sheets.open('od-menu', btn),
      },
      reset() { state = clone(DEFAULTS); shownPct = null; el.input.value = ''; el.send.disabled = true; render(false); },
      apply(p) {
        if (option(p.get('choice'))) state.you = p.get('choice');
        if (p.get('agreed')) state.agreed = Array.from(new Set(state.agreed.concat(p.get('agreed').split(',').filter((x) => POINTS.some((pt) => pt.id === x && !pt.auto)))));
        render(false);
        if (p.get('info') === '1') sheets.open('od-info');
        if (p.get('sheet') === 'discuss') sheets.open('od-sheet');
        if (p.get('sheet') === 'menu') sheets.open('od-menu');
      },
    };
  }

  /* =====================================================================================================================
     INDEX — preview, switches, capture guide, reset, check
     ===================================================================================================================== */
  function initIndex() {
    const ids = Object.keys(SCREENS);
    const frame = $('#ix-frame'); const wrap = $('#ix-frame-wrap'); const stage = $('#ix-stage');
    const guide = $('#ix-guide'); const reportBox = $('#ix-report'); const size = $('#ix-size');
    /* the screen list and each app's stylesheet (for its colour chip), from the registry */
    ids.forEach((id) => {
      const css = SCREENS[id].css; if (!css || document.querySelector(`link[href="${css}"]`)) return;
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = css; document.head.appendChild(link);
    });
    // grouped by scenario (registry "group"); each group gets a Play button that opens its first screen ("start")
    let lastGroup = null;
    $('.ix-screens').innerHTML = ids.map((id, i) => {
      const a = SCREENS[id]; let head = '';
      if (a.group && a.group !== lastGroup) {
        lastGroup = a.group;
        const start = ids.find((x) => SCREENS[x].group === a.group && SCREENS[x].start) || id;
        head = `<p class="ix-group" role="presentation"><span>${esc(a.group)}</span><button type="button" class="ix-play" data-play="${esc(start)}" aria-label="Play the ${esc(a.group)} prototype">▶ Play</button></p>`;
      }
      const appKey = a.app || id;
      return `${head}
      <button class="ix-screen-tab" type="button" role="tab" data-au-app="${esc(appKey)}" data-screen="${esc(id)}" aria-selected="false" aria-controls="ix-stage" tabindex="-1">
        <span class="ix-screen-tab__num" aria-hidden="true">${esc(a.num || String(i + 1).padStart(2, '0'))}</span>
        <span><span class="ix-screen-tab__name">${esc(a.name)}</span><span class="ix-screen-tab__desc">${esc(a.desc || '')}</span></span>
      </button>`;
    }).join('');
    $('#ix-count').textContent = `${ids.length} screens`;
    $('#ix-check-label').textContent = `Run check on all ${ids.length} screens`;
    const tabs = $$('.ix-screen-tab');
    const ui = {
      screen: ids.includes(params.get('screen')) ? params.get('screen') : ids[0],
      bars: root.classList.contains('has-system-bars'),
      fit: true,
      states: Object.fromEntries(ids.map((id) => [id, ''])),
    };
    const themeQ = () => `&theme=${theme.get()}&lang=${i18n.get()}`;
    const send = (msg) => frame.contentWindow && frame.contentWindow.postMessage(msg, '*');
    const frameSrc = () => `${SCREENS[ui.screen].file}?embed=1&ui=1${themeQ()}${ui.bars ? '&statusbar=1' : ''}${ui.states[ui.screen] ? `&${ui.states[ui.screen]}` : ''}`;
    const captureUrl = (id) => new URL(`${SCREENS[id].file}?ui=1&capture=1&theme=${theme.resolved()}${i18n.get() !== 'en' ? `&lang=${i18n.get()}` : ''}${ui.bars ? '&statusbar=1' : ''}${ui.states[id] ? `&${ui.states[id]}` : ''}`, location.href).href;

    function layout() {
      const uiOnly = root.classList.contains('is-ui-only');
      let s = 1;
      if (!uiOnly && ui.fit) {
        const availH = window.innerHeight - 48 - 48;               // stage padding + the size line
        const availW = stage.clientWidth - 48;
        s = clamp(Math.min(availH / 844, availW / 390), 0.3, 1);
      }
      frame.style.transform = s === 1 ? 'none' : `scale(${s})`;
      wrap.style.width = `${390 * s}px`; wrap.style.height = `${844 * s}px`;
      size.textContent = `390 × 844 · ${Math.round(s * 100)}%`;
    }
    function setSwitch(name, on) { const b = $(`[data-switch="${name}"]`); if (b) b.setAttribute('aria-checked', on); }
    function setUiOnly(on) {
      root.classList.toggle('is-ui-only', on); setSwitch('ui-only', on); layout();
      const u = new URL(location.href); if (on) u.searchParams.set('ui', '1'); else u.searchParams.delete('ui'); history.replaceState(null, '', u);
      if (on) frame.focus();
    }
    function setBars(on) {
      ui.bars = on; root.classList.toggle('has-system-bars', on); setSwitch('system-bars', on);
      send({ type: 'au:system-bars', on }); renderGuide();
    }
    function select(id, focus) {
      if (!SCREENS[id]) return;
      ui.screen = id;
      tabs.forEach((t) => { const on = t.dataset.screen === id; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
      frame.src = frameSrc();
      frame.title = `${SCREENS[id].name} preview`;
      const u = new URL(location.href); u.searchParams.set('screen', id); history.replaceState(null, '', u);
      renderGuide();
    }
    function renderGuide() {
      const s = SCREENS[ui.screen]; const url = captureUrl(ui.screen);
      const file = `${ui.screen}${ui.states[ui.screen] ? `--${ui.states[ui.screen].replace(/[=&]/g, '-')}` : ''}--${theme.resolved()}${i18n.get() !== 'en' ? `--${i18n.get()}` : ''}@3x.png`;
      guide.innerHTML = `
        <h2>Capture guide · ${esc(s.name)}</h2>
        <dl class="ix-spec">
          <dt>Viewport</dt><dd>390 × 844 pt</dd>
          <dt>Export</dt><dd>@3x → 1170 × 2532 px PNG</dd>
          <dt>Safe area</dt><dd>top 47 · bottom 34 (kept clear)</dd>
          <dt>Theme</dt><dd>${themeLabel(theme.resolved())}${theme.get() === 'system' ? ' (from the OS)' : ''}</dd>
          <dt>Language</dt><dd>${i18n.get() === 'ko' ? 'Korean' : 'English'}</dd>
          <dt>Status bar</dt><dd>${ui.bars ? 'shown (9:41)' : 'hidden — the photo’s own shows through'}</dd>
          <dt>Corners</dt><dd>square — mask them in compositing</dd>
          <dt>Accent</dt><dd>${s.accent || (SCREENS[s.app] || {}).accent || '—'}</dd>
        </dl>
        <div>
          <p class="ix-label">State to capture</p>
          <div class="ix-states">${s.states.map((st) => `<button type="button" data-state="${esc(st.q)}" aria-pressed="${st.q === ui.states[ui.screen]}">${esc(st.label)}</button>`).join('')}</div>
        </div>
        <div>
          <p class="ix-label">Capture URL</p>
          <div class="ix-code">${esc(url)}</div>
        </div>
        <div>
          <h3>Chrome</h3>
          <ol>
            <li>Open the capture URL above (<strong>ui=1</strong> screen only, <strong>capture=1</strong> frozen demo state).</li>
            <li>DevTools → Toggle device toolbar → Dimensions <strong>390 × 844</strong>, DPR <strong>3</strong>.</li>
            <li>⋮ menu of the toolbar → <strong>Capture screenshot</strong> → ${esc(file)}</li>
          </ol>
        </div>
        <div>
          <h3>Playwright (every state at once)</h3>
          <div class="ix-code">npm install &amp;&amp; npx playwright install chromium
node scripts/capture.mjs --theme=${theme.resolved()}${i18n.get() !== 'en' ? ` --lang=${i18n.get()}` : ''}${ui.bars ? ' --status-bar' : ''}</div>
        </div>
        <div>
          <h3>Notes</h3>
          <ol>${s.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ol>
        </div>`;
    }
    function renderReport(reports) {
      reportBox.innerHTML = reports.map((r) => `
        <div class="ix-report__screen">
          <p class="ix-report__name"><span>${esc(SCREENS[r.screen]?.name || r.screen)} · ${themeLabel(theme.resolved())} · ${i18n.get().toUpperCase()}</span><span class="au-badge" data-tone="${r.pass ? 'positive' : 'critical'}">${r.pass ? 'Pass' : 'Fail'}</span></p>
          <ul>${r.checks.map((c) => `<li class="${c.pass ? '' : 'is-fail'}"><span>${esc(c.name)}${c.detail ? ` — ${esc(c.detail)}` : ''}</span></li>`).join('')}</ul>
        </div>`).join('');
    }
    function runCheck(btn) {
      btn.disabled = true; reportBox.innerHTML = `<p class="ix-hint">Checking ${ids.length} screens…</p>`;
      Promise.all(ids.map((id) => new Promise((resolve) => {
        const f = document.createElement('iframe');
        f.style.cssText = 'position:fixed;left:-10000px;top:0;width:390px;height:844px;border:0;visibility:hidden';
        f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; f.title = `${id} check`;
        const done = (r) => { clearTimeout(timer); window.removeEventListener('message', onMsg); f.remove(); resolve(r); };
        const onMsg = (e) => { if (e.source === f.contentWindow && e.data && e.data.type === 'au:report') done(e.data.report); };
        const timer = setTimeout(() => done({ screen: id, pass: false, checks: [{ name: 'Screen answered', pass: false, detail: 'no report within 8 s' }] }), 8000);
        window.addEventListener('message', onMsg);
        f.src = `${SCREENS[id].file}?embed=1&ui=1&capture=1&validate=1&theme=${theme.resolved()}&lang=${i18n.get()}`;
        document.body.appendChild(f);
      }))).then((reports) => { renderReport(reports); btn.disabled = false; });
    }

    /* events */
    $('.ix-screens').addEventListener('click', (e) => {
      const play = e.target.closest('[data-play]');
      if (play) {   // start the scenario fresh: its demo data and chosen states are cleared
        const id = play.dataset.play;
        ids.filter((x) => SCREENS[x].group === SCREENS[id].group).forEach((x) => { ui.states[x] = ''; store.clear(x); if (SCREENS[x].store) store.clear(SCREENS[x].store); });
        select(id); return;
      }
      const t = e.target.closest('.ix-screen-tab'); if (t) select(t.dataset.screen);
    });
    $('.ix-screens').addEventListener('keydown', (e) => {
      const i = ids.indexOf(ui.screen);
      const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: ids.length - 1 }[e.key];
      if (to === undefined) return; e.preventDefault(); select(ids[(to + ids.length) % ids.length], true);
    });
    $$('[data-switch]').forEach((b) => b.addEventListener('click', () => {
      const on = b.getAttribute('aria-checked') !== 'true';
      if (b.dataset.switch === 'system-bars') setBars(on);
      if (b.dataset.switch === 'ui-only') setUiOnly(on);
      if (b.dataset.switch === 'fit') { ui.fit = on; setSwitch('fit', on); layout(); }
    }));
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ix], [data-state]'); if (!b) return;
      if (b.dataset.state !== undefined) { ui.states[ui.screen] = b.dataset.state; send({ type: 'au:state', query: b.dataset.state }); renderGuide(); return; }
      if (b.dataset.ix === 'reset') { ui.states[ui.screen] = ''; send({ type: 'au:reset' }); renderGuide(); }
      if (b.dataset.ix === 'reset-all') {
        ids.forEach((id) => store.clear(id)); ids.forEach((id) => { ui.states[id] = ''; });
        send({ type: 'au:reset' }); renderGuide();
      }
      if (b.dataset.ix === 'open') window.open(new URL(`${SCREENS[ui.screen].file}${ui.states[ui.screen] ? `?${ui.states[ui.screen]}` : ''}`, location.href).href, '_blank', 'noopener');
      if (b.dataset.ix === 'validate') runCheck(b);
    });
    document.addEventListener('keydown', (e) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape' && root.classList.contains('is-ui-only')) { setUiOnly(false); return; }
      if (/^[1-9]$/.test(e.key) && ids[Number(e.key) - 1]) select(ids[Number(e.key) - 1]);
      if (e.key === 's' || e.key === 'S') setBars(!ui.bars);
      if (e.key === 't' || e.key === 'T') theme.cycle();
      if (e.key === 'l' || e.key === 'L') i18n.toggle();
      if (e.key === 'u' || e.key === 'U') setUiOnly(!root.classList.contains('is-ui-only'));
    });
    window.addEventListener('message', (e) => {
      if (e.source !== frame.contentWindow || !e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'au:escape' && root.classList.contains('is-ui-only')) setUiOnly(false);
      // every screen that loads in the frame (also after Back) gets the preview's current theme and status bar
      if (e.data.type === 'au:ready') { send({ type: 'au:theme', theme: theme.get() }); send({ type: 'au:lang', lang: i18n.get() }); send({ type: 'au:system-bars', on: ui.bars }); }
      // the prototype navigated inside the frame: follow it in the list and the guide without reloading the frame
      if (e.data.type === 'au:ready' && SCREENS[e.data.screen] && e.data.screen !== ui.screen) {
        ui.screen = e.data.screen;
        tabs.forEach((t) => { const on = t.dataset.screen === ui.screen; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; if (on) t.scrollIntoView({ block: 'nearest' }); });
        const u = new URL(location.href); u.searchParams.set('screen', ui.screen); history.replaceState(null, '', u);
        renderGuide();
      }
    });
    window.addEventListener('resize', layout);

    /* theme picker (radio group) — the preview page and the screen in it follow it */
    const themeBtns = $$('[data-theme]');
    const syncTheme = () => {
      const t = theme.get();
      themeBtns.forEach((b) => { const on = b.dataset.theme === t; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; });
      send({ type: 'au:theme', theme: t });
      renderGuide();
    };
    document.addEventListener('au:theme', syncTheme);
    themeBtns.forEach((b) => b.addEventListener('click', () => theme.set(b.dataset.theme)));
    $('.ix-theme').addEventListener('keydown', (e) => {
      const i = THEMES.indexOf(theme.get());
      const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 }[e.key];
      if (to === undefined) return; e.preventDefault();
      theme.set(THEMES[(to + THEMES.length) % THEMES.length]); $(`[data-theme="${theme.get()}"]`).focus();
    });

    setSwitch('system-bars', ui.bars); setSwitch('ui-only', root.classList.contains('is-ui-only')); setSwitch('fit', ui.fit);
    // language picker — the preview's own labels and the screen in it follow it
    const langBtns = $$('[data-lang]');
    const syncLang = () => { langBtns.forEach((b) => { const on = b.dataset.lang === i18n.get(); b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; }); send({ type: 'au:lang', lang: i18n.get() }); renderGuide(); };
    langBtns.forEach((b) => b.addEventListener('click', () => i18n.set(b.dataset.lang)));
    document.addEventListener('au:lang', syncLang);
    select(ui.screen); layout(); syncTheme(); syncLang(); i18n.start();
  }

  /* =====================================================================================================================
     FLOWS — every screen laid out by scenario (flows.html)
     ===================================================================================================================== */
  function initFlows() {
    const ids = Object.keys(SCREENS);
    const groups = [...new Set(ids.map((id) => SCREENS[id].group || 'Other'))];
    const board = $('#fb-board');
    const SCALE = 0.42;
    const src = (a) => `${a.file}?embed=1&ui=1&capture=1&theme=${theme.resolved()}&lang=${i18n.get()}`;
    board.innerHTML = groups.map((g, gi) => {
      const list = ids.filter((id) => (SCREENS[id].group || 'Other') === g);
      const start = list.find((id) => SCREENS[id].start) || list[0];
      return `<section class="fb-flow" aria-labelledby="fb-g${gi}">
        <div class="fb-flow__head">
          <h2 id="fb-g${gi}">${esc(g)}</h2><span class="fb-flow__count">${list.length} screens</span>
          <a class="fb-btn fb-btn--solid" href="index.html?screen=${esc(start)}">▶ Play prototype</a>
          <a class="fb-btn" href="${esc(SCREENS[start].file)}" target="_blank" rel="noopener">Open on this device ↗</a>
        </div>
        <ol class="fb-row">${list.map((id, i) => { const a = SCREENS[id]; return `
          <li class="fb-card" data-au-app="${esc(a.app || id)}">
            <a href="index.html?screen=${esc(id)}" class="fb-card__link" aria-label="${esc(g)} — ${esc(a.name)}: open in the preview">
              <span class="fb-thumb" style="width:${390 * SCALE}px;height:${844 * SCALE}px"><iframe loading="lazy" tabindex="-1" aria-hidden="true" title="${esc(a.name)}" data-src="${esc(id)}" src="${esc(src(a))}" style="transform:scale(${SCALE})"></iframe></span>
              <span class="fb-card__num">${esc(a.num || String(i + 1))}</span>
              <span class="fb-card__name">${esc(a.name)}</span>
              <span class="fb-card__desc">${esc(a.desc || '')}</span>
            </a>
          </li>`; }).join('<li class="fb-arrow" aria-hidden="true">→</li>')}</ol>
      </section>`;
    }).join('');
    const themeBtns = $$('[data-theme]');
    const sync = () => {
      themeBtns.forEach((b) => { const on = b.dataset.theme === theme.get(); b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; });
      $$('.fb-thumb iframe').forEach((f) => f.contentWindow && f.contentWindow.postMessage({ type: 'au:theme', theme: theme.resolved() }, '*'));
    };
    themeBtns.forEach((b) => b.addEventListener('click', () => theme.set(b.dataset.theme)));
    document.addEventListener('au:theme', sync);
    const langBtns = $$('[data-lang]');
    const syncLang = () => {
      langBtns.forEach((b) => { const on = b.dataset.lang === i18n.get(); b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; });
      $$('.fb-thumb iframe').forEach((f) => f.contentWindow && f.contentWindow.postMessage({ type: 'au:lang', lang: i18n.get() }, '*'));
    };
    langBtns.forEach((b) => b.addEventListener('click', () => i18n.set(b.dataset.lang)));
    document.addEventListener('au:lang', syncLang);
    sync(); syncLang(); i18n.start();
  }

  /* ---------------------------------------------------------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------------------------------------------------------- */
  const boot = () => {
    const screen = $('.au-screen[data-au-screen]');
    if (screen) initScreen(screen);
    else if (document.body.dataset.auPage === 'index') initIndex();
    else if (document.body.dataset.auPage === 'flows') initFlows();
  };
  // after DOMContentLoaded, so deferred scripts loaded after this one can call AUKit.defineScreen first
  if (document.readyState === 'complete') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
