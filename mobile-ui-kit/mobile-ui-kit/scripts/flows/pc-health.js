/* =========================================================================================================================
   01 PC Health — detail screens of the clickable prototype (loaded after scripts/app.js, both deferred).

   Flow: home → connect → scan → result (pc-health.html) → part detail · full report
   Shared state (store 'pc-health', also used by pc-health.html): { scenario, open, scannedAt, device }
   Demo data: AUKit.data.pcHealth (items, ok, scenarios) — defined in scripts/app.js
   ========================================================================================================================= */
(() => {
  'use strict';
  const KEY = 'pc-health';
  const DEFAULTS = { scenario: 0, open: null, scannedAt: null, device: 'ThinkPad X1 Carbon' };
  const HISTORY = [
    { device: 'ThinkPad X1 Carbon', scenario: 0, when: '2 min ago' },
    { device: 'MacBook Pro 14', scenario: 1, when: 'Yesterday' },
    { device: 'Gaming PC', scenario: 2, when: 'Oct 28' },
  ];
  const data = () => AUKit.data.pcHealth;
  const icon = (name, cls = '') => `<i class="au-icon au-icon--${name}${cls ? ` ${cls}` : ''}" aria-hidden="true"></i>`;
  const shared = (store) => ({
    get: () => store.get(KEY, DEFAULTS),
    set: (patch) => store.set(KEY, Object.assign(store.get(KEY, DEFAULTS), patch)),
  });
  const scenarioOf = (st) => data().scenarios[st.scenario] || data().scenarios[0];
  const itemOf = (scen, key) => scen.items[key] || data().ok[key];
  const scannedText = (st) => {
    if (!st.scannedAt) return '2 min ago';
    const min = Math.floor((Date.now() - st.scannedAt) / 60000);
    return min < 1 ? 'just now' : `${min} min ago`;
  };
  const copy = (text) => { try { navigator.clipboard.writeText(text).catch(() => {}); } catch { /* clipboard unavailable */ } };

  /* ---- home: recent checks ------------------------------------------------------------------------------------------- */
  AUKit.defineScreen('pc-health-home', ({ store, nav, $, esc }) => {
    const sh = shared(store);
    const rows = () => {
      const st = sh.get(); const list = HISTORY.map((h) => ({ ...h }));
      if (st.scannedAt) list[0] = { device: st.device, scenario: st.scenario, when: scannedText(st) };
      return list;
    };
    const render = () => {
      $('#ph-h-list').innerHTML = rows().map((r, i) => {
        const s = data().scenarios[r.scenario];
        return `<button class="fl-item" type="button" data-action="open" data-i="${i}" data-tone="${s.tone}">
          <span class="au-icon-box" aria-hidden="true">${icon('monitor')}</span>
          <span class="fl-item__text"><span class="fl-item__title">${esc(r.device)}</span><span class="fl-item__meta">Scanned ${esc(r.when)}</span></span>
          <span class="fl-item__end"><span class="fl-item__value">${s.score}%</span><span class="au-badge" data-tone="${s.tone}">${esc(s.state)}</span></span>
          ${icon('chevron-right', 'fl-item__chev')}</button>`;
      }).join('');
    };
    return {
      actions: {
        open: (btn) => {
          const r = rows()[Number(btn.dataset.i)]; const st = sh.get();
          sh.set({ scenario: r.scenario, device: r.device, open: null, scannedAt: Number(btn.dataset.i) === 0 ? st.scannedAt : null });
          nav('pc-health.html');
        },
      },
      reset: render,
      apply: render,
    };
  });

  /* ---- connect: find the PC, pairing code ---------------------------------------------------------------------------- */
  AUKit.defineScreen('pc-health-connect', ({ nav, toast, announce, capture, $, $$ }) => {
    let connected = false; let timer = 0; let tick = 0; let left = 292;
    const render = () => {
      const card = $('#ph-c-device'); card.dataset.state = connected ? 'connected' : 'waiting';
      $('#ph-c-name').textContent = connected ? 'ThinkPad X1 Carbon' : 'Looking for a PC…';
      $('#ph-c-meta').textContent = connected ? 'Windows 11 Pro over USB-C' : 'Connect with a USB-C cable';
      const badge = $('#ph-c-badge');
      badge.dataset.tone = connected ? 'positive' : '';
      if (!connected) delete badge.dataset.tone;
      badge.innerHTML = connected ? 'Connected' : '<span class="fl-spin" style="width:12px;height:12px;margin:0" aria-hidden="true"></span>Searching';
      $$('#ph-c-steps .fl-step').forEach((s) => s.classList.toggle('is-done', connected));
      $('#ph-c-start').disabled = !connected;
      $('#ph-c-expires').textContent = `Expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    };
    const start = (state) => {
      clearTimeout(timer); clearInterval(tick); left = 292;
      connected = state ? state === 'connected' : capture;
      render();
      if (capture) return;
      tick = setInterval(() => { left = Math.max(0, left - 1); $('#ph-c-expires').textContent = `Expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; }, 1000);
      if (!connected) timer = setTimeout(() => { connected = true; render(); toast('PC connected'); announce('ThinkPad X1 Carbon connected. You can start the scan.'); }, 1800);
    };
    return {
      actions: { start: () => nav('pc-health-scan.html') },
      reset: () => start(),
      apply: (p) => start(p.get('state')),
    };
  });

  /* ---- scan: progress ring and checks -------------------------------------------------------------------------------- */
  AUKit.defineScreen('pc-health-scan', ({ store, nav, announce, capture, $ }) => {
    const sh = shared(store);
    const STEPS = [['cpu', 'CPU'], ['gpu', 'GPU'], ['memory', 'Memory'], ['storage', 'Storage'], ['battery', 'Battery']];
    const C = 508.94; const DURATION = 7000;
    let raf = 0; let t0 = 0;
    const render = (p) => {
      const pct = Math.round(p);
      $('#ph-s-value').style.strokeDashoffset = (C * (1 - p / 100)).toFixed(1);
      $('#ph-s-pct').textContent = pct;
      $('#ph-s-ring').setAttribute('aria-valuenow', pct);
      const active = Math.min(STEPS.length - 1, Math.floor(p / (100 / STEPS.length)));
      $('#ph-s-state').textContent = p >= 100 ? 'Done' : `Checking ${STEPS[active][1]}`;
      $('#ph-s-meta').textContent = p >= 100 ? 'ThinkPad X1 Carbon, complete' : `ThinkPad X1 Carbon, about ${Math.max(1, Math.ceil((100 - p) / 100 * 120))} s left`   // a real scan takes ~2 min; the demo runs faster;
      $('#ph-s-steps').innerHTML = STEPS.map(([k, name], i) => {
        const state = p >= 100 || i < active ? 'done' : i === active ? 'active' : 'waiting';
        const mark = state === 'done' ? icon('check-circle') : state === 'active' ? '<span class="fl-spin" aria-hidden="true"></span>' : icon('circle');
        return `<div class="fl-status__row" data-state="${state}">${mark}<span class="fl-status__name">${name}</span><span class="fl-status__state">${state === 'done' ? 'Passed' : state === 'active' ? 'Checking…' : 'Waiting'}</span></div>`;
      }).join('');
    };
    const run = (from) => {
      cancelAnimationFrame(raf);
      if (capture) { render(from); return; }
      t0 = performance.now() - (from / 100) * DURATION;
      const step = (now) => {
        const p = Math.max(0, Math.min(100, ((now - t0) / DURATION) * 100)); render(p);
        if (p < 100) { raf = requestAnimationFrame(step); return; }
        sh.set({ scenario: 0, device: 'ThinkPad X1 Carbon', scannedAt: Date.now(), open: null });
        announce('Scan complete: 98%, Healthy');
        setTimeout(() => nav('pc-health.html', { replace: true }), 500);
      };
      raf = requestAnimationFrame(step);
    };
    return {
      actions: { cancel: () => { cancelAnimationFrame(raf); nav('pc-health-connect.html', { back: true }); } },
      reset: () => run(capture ? 64 : 0),
      apply: (p) => run(p.has('p') ? Number(p.get('p')) : capture ? 64 : 0),
    };
  });

  /* ---- part detail: temperature under load, measurements, ask the seller --------------------------------------------- */
  AUKit.defineScreen('pc-health-part', ({ store, toast, sheets, $, esc }) => {
    const sh = shared(store);
    let message = '';
    const VERDICT = {
      positive: (n) => `<strong>${n} looks healthy.</strong> It stayed stable under a full 5-minute load.`,
      warning: (n) => `<strong>${n} runs hot under load.</strong> Ask how the PC is cooled and when the fans were last cleaned.`,
      critical: (n) => `<strong>${n} has errors.</strong> Ask for a repair, or a lower price that covers one.`,
    };
    const ASK = {
      positive: (n, s) => `Hi! The PC Health check passed (${s}%) and the ${n} looks good. Does it come with the original charger and box?`,
      warning: (n) => `Hi! In the hardware check the ${n} reached 91°C under load. Has the cooling been serviced recently?`,
      critical: (n) => `Hi! The hardware check found errors in the ${n}. Would you repair it before the sale, or lower the price?`,
    };
    const chart = (peak, tone) => {
      // 30 samples over 5 minutes: warm-up to the peak, a small wobble (demo data)
      const idle = Math.min(42, peak - 6); const pts = Array.from({ length: 31 }, (_, i) => {
        const t = i / 30; const v = idle + (peak - idle) * (1 - Math.exp(-t * 5)) + Math.sin(i * 1.7) * 0.9;
        return [32 + t * 272, 112 - ((v - 30) / 70) * 104];
      });
      const y = (v) => (112 - ((v - 30) / 70) * 104).toFixed(1);
      const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
      return `
        ${[40, 70, 100].map((v) => `<line class="grid" x1="32" x2="304" y1="${y(v)}" y2="${y(v)}"/><text x="0" y="${(Number(y(v)) + 4).toFixed(1)}">${v}°</text>`).join('')}
        <line class="limit" x1="32" x2="304" y1="${y(85)}" y2="${y(85)}"/><text class="limit-label" x="304" y="${(Number(y(85)) - 5).toFixed(1)}" text-anchor="end">85° limit</text>
        <path class="area" d="${line} L304 112 L32 112 Z"/><path class="line" d="${line}"/>
        <text x="32" y="128">0</text><text x="304" y="128" text-anchor="end">5 min</text>`;
    };
    let override = {};                                    // ?scenario= in capture mode, where the store isn't written
    const render = (key) => {
      const st = Object.assign(sh.get(), override); const scen = scenarioOf(st);
      const meta = data().items.find((i) => i.key === key) || data().items[1];
      const d = itemOf(scen, meta.key);
      document.title = `${meta.name} — PC Health`;
      $('#app-title').textContent = meta.name;
      $('#ph-p-hero').dataset.tone = d.tone; $('#ph-p-chart-card').dataset.tone = d.tone; $('#ph-p-notice').dataset.tone = d.tone;
      $('#ph-p-icon').className = `au-icon au-icon--${meta.icon}`;
      $('#ph-p-name').textContent = meta.name; $('#ph-p-spec').textContent = meta.spec;
      $('#ph-p-pct').textContent = `${d.pct}%`;
      const badge = $('#ph-p-badge'); badge.dataset.tone = d.tone; badge.textContent = d.status;
      const tempRow = d.rows.find((r) => r[0] === 'Temperature');
      const peak = tempRow ? parseInt(tempRow[1], 10) : 46;
      $('#ph-p-chart').innerHTML = chart(peak, d.tone);
      $('#ph-p-chart').setAttribute('aria-label', `Temperature over a 5-minute stress test, peaking at ${peak}°C; the limit is 85°C`);
      $('#ph-p-chart-meta').textContent = `Peak ${peak}°C in a 5-minute stress test`;
      $('#ph-p-rows').innerHTML = d.rows.map(([l, v, tone]) => `<div class="au-row"><dt class="au-row__label">${esc(l)}</dt><dd class="au-row__value"${tone ? ` data-tone="${tone}"` : ''}>${esc(v)}</dd></div>`).join('');
      $('#ph-p-notice > .au-icon').className = `au-icon au-icon--${d.tone === 'positive' ? 'shield' : 'alert'}`;
      $('#ph-p-verdict').innerHTML = VERDICT[d.tone](meta.name);
      message = ASK[d.tone](meta.name, scen.score);
      $('#ph-p-msg').textContent = message;
    };
    let part = 'gpu';
    return {
      actions: { 'copy-msg': () => { copy(message); sheets.close(); toast('Message copied'); } },
      reset: () => render(part),
      apply: (p) => {
        part = p.get('part') || 'gpu';
        if (p.get('scenario')) { const i = data().scenarios.findIndex((s) => s.id === p.get('scenario')); if (i >= 0) { override = { scenario: i }; sh.set(override); } }
        render(part);
        if (p.get('sheet') === 'ask') sheets.open('ph-p-ask');
      },
    };
  });

  /* ---- full report: summary, components, share link ------------------------------------------------------------------ */
  AUKit.defineScreen('pc-health-report', ({ store, toast, sheets, $, esc }) => {
    const sh = shared(store);
    const C = 194.78;
    const render = () => {
      const st = sh.get(); const scen = scenarioOf(st); const id = `PH-2611-0${482 + st.scenario}`;
      ['#ph-r-sum', '#ph-r-ring'].forEach((s) => { $(s).dataset.tone = scen.tone; });
      $('#ph-r-value').style.strokeDashoffset = (C * (1 - scen.score / 100)).toFixed(1);
      $('#ph-r-score').textContent = scen.score;
      $('#ph-r-device').textContent = st.device === 'ThinkPad X1 Carbon' ? 'ThinkPad X1 Carbon Gen 9' : st.device;
      $('#ph-r-meta').textContent = `Scanned ${scannedText(st)}, report ${id}`;
      const badge = $('#ph-r-badge'); badge.dataset.tone = scen.tone; badge.textContent = scen.state;
      $('#ph-r-link').textContent = `pchealth.example/r/${id}`;
      $('#ph-r-list').innerHTML = data().items.map((it) => {
        const d = itemOf(scen, it.key);
        return `<a class="fl-item fl-item--compact" href="pc-health-part.html?part=${it.key}" data-nav data-tone="${d.tone}">
          <span class="au-icon-box" aria-hidden="true">${icon(it.icon)}</span>
          <span class="fl-item__text"><span class="fl-item__title">${it.name}</span><span class="fl-item__meta">${esc(it.spec)}</span></span>
          <span class="fl-item__end"><span class="fl-item__value">${d.pct}%</span><span class="au-badge" data-tone="${d.tone}">${esc(d.status)}</span></span>
          ${icon('chevron-right', 'fl-item__chev')}</a>`;
      }).join('');
    };
    return {
      actions: {
        'copy-link': () => { copy(`https://${$('#ph-r-link').textContent}`); sheets.close(); toast('Link copied (demo)'); },
        demo: (btn) => { sheets.close(); toast(btn.dataset.msg); },
      },
      reset: render,
      apply: (p) => { render(); if (p.get('sheet') === 'share') sheets.open('ph-r-sheet'); },
    };
  });
})();
