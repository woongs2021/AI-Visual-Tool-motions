/* =========================================================================================================================
   02 Meeting Notes — detail screens of the clickable prototype (loaded after scripts/app.js, both deferred).

   Flow: home → recording (meeting-notes.html) → processing → notes → transcript
   Shared state (store 'meeting-notes'): { recorded: { duration } | null, done: { <meetingId>: [actionIds] } }
   Everything is demo data: no microphone, no audio, no AI call.
   ========================================================================================================================= */
(() => {
  'use strict';
  const KEY = 'meeting-notes';
  const DEFAULTS = { recorded: null, done: {} };
  const icon = (name, cls = '') => `<i class="au-icon au-icon--${name}${cls ? ` ${cls}` : ''}" aria-hidden="true"></i>`;
  const fmt = (s) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60; return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; };
  const clock = (s) => (s >= 3600 ? fmt(s) : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);   // m:ss in the transcript
  const shared = (store) => ({ get: () => store.get(KEY, DEFAULTS), set: (patch) => store.set(KEY, Object.assign(store.get(KEY, DEFAULTS), patch)) });

  /* ---- meetings (demo) --------------------------------------------------------------------------------------------- */
  const MEETINGS = {
    q4: {
      title: 'Q4 Product Sync', date: 'Today', duration: 156, people: ['Sarah', 'Daniel', 'Priya', 'Alex'],
      summary: 'The team set November 18 as the launch date. Design QA ends on Thursday, and the pricing page goes to legal by Monday.',
      points: () => AUKit.data.meeting.points,
      decisions: ['Launch on November 18', 'Pricing page needs legal sign-off first', 'No beta announcement this time'],
      actions: () => AUKit.data.meeting.actions,
      transcript: [
        [0, 'Sarah', 'Okay, let’s start with launch timing.'], [9, 'Daniel', 'Design QA wraps up by Thursday.'],
        [18, 'Sarah', 'Then let’s lock the launch for Nov 18.'], [27, 'Priya', 'Legal still has to review the pricing page.'],
        [38, 'Alex', 'How long does legal usually take?'], [45, 'Priya', 'About three working days.'],
        [54, 'Sarah', 'Then let’s send it over by Monday.'], [66, 'Daniel', 'The final build goes out tomorrow morning.'],
        [78, 'Alex', 'I’ll update the release notes tonight.'], [90, 'Sarah', 'Marketing needs the date confirmed this week.'],
        [101, 'Daniel', 'I can share the QA checklist in the channel.'], [115, 'Priya', 'I’ll flag anything legal changes on the page.'],
        [128, 'Alex', 'Do we need a beta announcement?'], [141, 'Sarah', 'Not this time. Thanks, everyone.'],
      ],
    },
    design: {
      title: 'Design Review', date: 'Nov 14', duration: 2530, people: ['Mina', 'Jae', 'Sora'],
      summary: 'The new onboarding flow is approved with two changes: a shorter sign-up form and a skip option on the tour. Icons move to the shared library this sprint.',
      points: () => ['Onboarding flow approved with changes', 'Sign-up form drops to three fields', 'Icon set moves to the shared library'],
      decisions: ['Ship onboarding v2 next sprint', 'Add “Skip tour” on every step'],
      actions: () => [{ id: 'd1', text: 'Update the sign-up form', who: 'Jae' }, { id: 'd2', text: 'Add skip to the product tour', who: 'Sora' }, { id: 'd3', text: 'Publish icons to the library', who: 'Mina' }],
      transcript: [[0, 'Mina', 'Let’s go through onboarding first.'], [320, 'Jae', 'The sign-up form still feels long.'], [610, 'Sora', 'We could cut it to three fields.'], [940, 'Mina', 'Agreed. What about the tour?'], [1280, 'Sora', 'People want to skip it.'], [1650, 'Jae', 'Then add skip on every step.'], [2010, 'Mina', 'Icons go to the library this sprint.'], [2400, 'Mina', 'Great, that’s everything.']],
    },
    oneonone: {
      title: 'Weekly 1:1 with Sarah', date: 'Nov 12', duration: 1685, people: ['Sarah', 'You'],
      summary: 'Talked through the Q4 roadmap and workload. Sarah will take over the analytics dashboard, and you will present at the all-hands on Friday.',
      points: () => ['Q4 roadmap is on track', 'Analytics dashboard moves to Sarah', 'All-hands demo on Friday'],
      decisions: ['Sarah owns the analytics dashboard'],
      actions: () => [{ id: 'o1', text: 'Prepare the all-hands demo', who: 'You' }, { id: 'o2', text: 'Hand over dashboard notes', who: 'You' }, { id: 'o3', text: 'Book a roadmap review', who: 'Sarah' }],
      transcript: [[0, 'Sarah', 'How is the week going?'], [280, 'You', 'Busy, mostly the dashboard.'], [610, 'Sarah', 'I can take the dashboard over.'], [960, 'You', 'That would help a lot.'], [1300, 'Sarah', 'Can you demo at the all-hands?'], [1600, 'You', 'Sure, on Friday.']],
    },
    acme: {
      title: 'Customer Call — Acme', date: 'Nov 10', duration: 3092, people: ['Daniel', 'Kim', 'Lee'],
      summary: 'Acme wants single sign-on before rolling out to 400 seats. They are happy with reporting but asked for CSV export of audit logs.',
      points: () => ['SSO is required for the 400-seat rollout', 'Reporting meets their needs', 'They asked for CSV audit-log export'],
      decisions: ['Pilot with 40 seats in December'],
      actions: () => [{ id: 'c1', text: 'Send the SSO setup guide', who: 'Daniel' }, { id: 'c2', text: 'Check the audit-log export date', who: 'Daniel' }, { id: 'c3', text: 'Share the pilot plan', who: 'Kim' }],
      transcript: [[0, 'Daniel', 'Thanks for joining, everyone.'], [540, 'Kim', 'SSO is a must for us.'], [1180, 'Daniel', 'We support SAML and OIDC.'], [1760, 'Lee', 'Can we export audit logs as CSV?'], [2350, 'Daniel', 'Let me check the timeline.'], [2900, 'Kim', 'Let’s start with a 40-seat pilot.']],
    },
  };
  const PAST = ['design', 'oneonone', 'acme'];
  const meetingOf = (id, st) => {
    const m = MEETINGS[id] || MEETINGS.q4;
    if (!(id === 'q4' && st && st.recorded)) return m;
    // a demo recording of any length: keep the script, spread its timestamps over the recorded duration
    const d = Math.max(1, st.recorded.duration); const k = d / m.duration;
    return { ...m, duration: d, transcript: m.transcript.map(([t, w, x]) => [Math.round(t * k), w, x]) };
  };
  const avatar = (name) => `<span class="au-avatar au-avatar--sm au-avatar--ring" data-name="${name}" aria-hidden="true">${name[0]}</span>`;

  /* ---- home: meetings list ----------------------------------------------------------------------------------------- */
  AUKit.defineScreen('meeting-notes-home', ({ store, $, esc }) => {
    const sh = shared(store);
    const render = () => {
      const st = sh.get(); const ids = (st.recorded ? ['q4'] : []).concat(PAST);
      $('#mn-h-count').textContent = `${ids.length} meetings`;
      $('#mn-h-list').innerHTML = ids.map((id) => {
        const m = meetingOf(id, st); const n = m.actions().length;
        return `<a class="fl-item" href="meeting-notes-notes.html?m=${id}" data-nav>
          <span class="au-icon-box" aria-hidden="true">${icon(id === 'q4' ? 'mic' : 'doc')}</span>
          <span class="fl-item__text"><span class="fl-item__title">${esc(m.title)}</span><span class="fl-item__meta">${esc(m.date)}, ${fmt(m.duration)}, ${n} action items</span></span>
          <span class="fl-item__end">${id === 'q4' ? '<span class="au-badge" data-tone="accent">New</span>' : ''}</span>
          ${icon('chevron-right', 'fl-item__chev')}</a>`;
      }).join('');
    };
    return { reset: render, apply: render };
  });

  /* ---- processing: transcribe → summarize → action items ------------------------------------------------------------ */
  AUKit.defineScreen('meeting-notes-processing', ({ store, nav, announce, capture, params, $ }) => {
    const sh = shared(store);
    const STEPS = [['Audio saved', 0], ['Transcribing 4 speakers', 5], ['Writing the summary', 45], ['Finding action items', 78]];
    const DURATION = 5000; let raf = 0;
    const duration = Number(params.get('d')) || 156;
    $('#mn-p-meta').textContent = `Q4 Product Sync, ${fmt(duration)}, 4 speakers`;
    const render = (p) => {
      const pct = Math.round(p);
      $('#mn-p-pct').textContent = `${pct}%`;
      $('#mn-p-bar').style.setProperty('--au-value', `${pct}%`);
      $('#mn-p-bar-wrap').setAttribute('aria-valuenow', pct);
      const active = STEPS.reduce((a, s, i) => (p >= s[1] ? i : a), 0);
      $('#mn-p-steps').innerHTML = STEPS.map(([name], i) => {
        const state = p >= 100 || i < active ? 'done' : i === active ? 'active' : 'waiting';
        const mark = state === 'done' ? icon('check-circle') : state === 'active' ? '<span class="fl-spin" aria-hidden="true"></span>' : icon('circle');
        return `<div class="fl-status__row" data-state="${state}">${mark}<span class="fl-status__name">${name}</span><span class="fl-status__state">${state === 'done' ? 'Done' : state === 'active' ? 'Working…' : 'Waiting'}</span></div>`;
      }).join('');
    };
    const run = (from) => {
      cancelAnimationFrame(raf);
      if (capture) { render(from); return; }
      const t0 = performance.now() - (from / 100) * DURATION;
      const step = (now) => {
        const p = Math.max(0, Math.min(100, ((now - t0) / DURATION) * 100)); render(p);
        if (p < 100) { raf = requestAnimationFrame(step); return; }
        sh.set({ recorded: { duration } });
        announce('Your notes are ready');
        setTimeout(() => nav('meeting-notes-notes.html?m=q4', { replace: true }), 400);
      };
      raf = requestAnimationFrame(step);
    };
    return {
      reset: () => run(capture ? 55 : 0),
      apply: (p) => run(p.has('p') ? Number(p.get('p')) : capture ? 55 : 0),
    };
  });

  /* ---- notes: summary, key points / decisions / actions ------------------------------------------------------------- */
  AUKit.defineScreen('meeting-notes-notes', ({ store, toast, sheets, $, $$, esc, params }) => {
    const sh = shared(store);
    const id = MEETINGS[params.get('m')] ? params.get('m') : 'q4';
    let tab = 'points';
    const tabs = $$('[role="tab"]');
    const render = () => {
      const st = sh.get(); const m = meetingOf(id, st);
      document.title = `${m.title} — Meeting Notes`;
      $('#mn-n-title').textContent = m.title;
      $('#mn-n-meta').textContent = `${m.date}, ${fmt(m.duration)}, ${m.people.length} speakers`;
      $('#mn-n-people').innerHTML = m.people.map(avatar).join('');
      $('#mn-n-people').setAttribute('aria-label', `Attendees: ${m.people.join(', ')}`);
      $('#mn-n-summary').textContent = m.summary;
      $('#mn-n-transcript').setAttribute('href', `meeting-notes-transcript.html?m=${id}`);
      $('#mn-n-tmeta').textContent = `${m.transcript.length} lines, ${m.people.length} speakers`;
      tabs.forEach((t) => { const on = t.dataset.tab === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
      const panel = $('#mn-n-panel'); panel.setAttribute('aria-labelledby', `mn-n-tab-${tab}`);
      const done = (st.done && st.done[id]) || [];
      if (tab === 'actions') {
        panel.innerHTML = `<div class="mn-actions" style="margin:0 -8px -8px">${m.actions().map((a) => `
          <button class="mn-action" type="button" role="checkbox" aria-checked="${done.includes(a.id)}" data-action="check" data-id="${a.id}">
            <span class="mn-action__box" aria-hidden="true">${icon('check')}</span><span class="mn-action__text">${esc(a.text)}</span><span class="mn-action__who">${esc(a.who)}</span></button>`).join('')}</div>`;
      } else {
        const list = tab === 'points' ? m.points() : m.decisions;
        panel.innerHTML = `<ul class="mn-points" style="margin-top:4px">${list.map((x) => `<li class="mn-point"><span class="mn-point__text">${esc(x)}</span></li>`).join('')}</ul>`;
      }
    };
    const setTab = (t, focus) => { tab = t; render(); if (focus) $(`[data-tab="${t}"]`).focus(); };
    tabs.forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
    $('[role="tablist"]').addEventListener('keydown', (e) => {
      const order = tabs.map((t) => t.dataset.tab); const i = order.indexOf(tab);
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: order.length - 1 }[e.key];
      if (to === undefined) return; e.preventDefault(); setTab(order[(to + order.length) % order.length], true);
    });
    return {
      actions: {
        check: (btn) => {
          const st = sh.get(); const done = new Set((st.done && st.done[id]) || []);
          if (done.has(btn.dataset.id)) done.delete(btn.dataset.id); else done.add(btn.dataset.id);
          sh.set({ done: { ...(st.done || {}), [id]: [...done] } });
          btn.setAttribute('aria-checked', done.has(btn.dataset.id));
        },
        demo: (btn) => { sheets.close(); toast(btn.dataset.msg); },
      },
      reset: () => { tab = 'points'; render(); },
      apply: (p) => { if (['points', 'decisions', 'actions'].includes(p.get('tab'))) tab = p.get('tab'); render(); if (p.get('sheet') === 'share') sheets.open('mn-n-share'); },
    };
  });

  /* ---- transcript: search, speaker filter, demo playback ------------------------------------------------------------ */
  AUKit.defineScreen('meeting-notes-transcript', ({ store, toast, capture, $, $$, esc, params, screen }) => {
    const sh = shared(store);
    const id = MEETINGS[params.get('m')] ? params.get('m') : 'q4';
    const m = meetingOf(id, sh.get());
    screen.dataset.auBack = `meeting-notes-notes.html?m=${id}`;   // back to this meeting's notes
    let who = 'All'; let query = ''; let cur = 48; let playing = 0; let told = false;
    const seek = $('#mn-t-seek'); const content = $('.au-content', screen);
    seek.max = m.duration; $('#mn-t-dur').textContent = fmt(m.duration);
    document.title = `Transcript — ${m.title}`;
    const speakers = ['All', ...new Set(m.transcript.map((l) => l[1]))];
    const currentIndex = () => m.transcript.reduce((a, l, i) => (l[0] <= cur ? i : a), 0);
    const tx = (x) => AUKit.i18n.t(x);   // lines are translated here, so search and highlight work on the shown language
    const mark = (text) => {
      const safe = esc(tx(text)); if (!query) return safe;
      const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return safe.replace(new RegExp(`(${esc(q)})`, 'gi'), '<mark>$1</mark>');
    };
    const renderChips = () => {
      $('#mn-t-chips').innerHTML = speakers.map((s) => `<button class="fl-chip" type="button" aria-pressed="${s === who}" data-action="who" data-who="${esc(s)}">${esc(s)}</button>`).join('');
    };
    const renderLines = (scroll) => {
      const ci = currentIndex();
      const rows = m.transcript.map((l, i) => ({ l, i })).filter(({ l }) => (who === 'All' || l[1] === who) && (!query || tx(l[2]).toLowerCase().includes(query.toLowerCase())));
      $('#mn-t-lines').innerHTML = rows.length ? rows.map(({ l, i }) => `
        <button class="fl-line${i === ci ? ' is-current' : ''}" type="button" data-action="jump" data-t="${l[0]}"${i === ci ? ' aria-current="true"' : ''}>
          <span class="fl-line__time">${clock(l[0])}</span>
          <span><span class="fl-line__who">${esc(l[1])}</span><span translate="no">${mark(l[2])}</span></span>
        </button>`).join('') : '<p class="fl-empty">No lines match.</p>';
      if (scroll) { const c = $('.fl-line.is-current'); if (c) { const cr = c.getBoundingClientRect(); const pr = content.getBoundingClientRect(); if (cr.top < pr.top || cr.bottom > pr.bottom) c.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
    };
    const renderTime = () => { seek.value = cur; $('#mn-t-cur').textContent = fmt(cur); seek.setAttribute('aria-valuetext', fmt(cur)); };
    const setPlaying = (on) => {
      clearInterval(playing); playing = 0;
      const b = $('#mn-t-play'); b.setAttribute('aria-label', on ? 'Pause' : 'Play'); b.innerHTML = `<i class="au-icon au-icon--${on ? 'pause' : 'play'}" aria-hidden="true"></i>`;
      if (!on) return;
      if (cur >= m.duration) { cur = 0; renderTime(); renderLines(true); }   // at the end: play from the start
      if (!told) { toast('Demo — no audio; the transcript follows along'); told = true; }
      const step = Math.max(1, Math.round(m.duration / 160));   // long meetings play faster in the demo
      playing = setInterval(() => { cur = Math.min(m.duration, cur + step); renderTime(); renderLines(true); if (cur >= m.duration) setPlaying(false); }, 250);
    };
    $('#mn-t-search').addEventListener('input', (e) => { query = e.target.value.trim(); renderLines(false); });
    document.addEventListener('au:lang', () => renderLines(false));
    seek.addEventListener('input', () => { cur = Number(seek.value); renderTime(); renderLines(true); });
    const defaultT = () => (id === 'q4' && !sh.get().recorded ? 48 : 0);   // the sample meeting opens mid-way; your recording at 0:00
    const start = (t) => { cur = Math.min(m.duration, t); who = 'All'; query = ''; $('#mn-t-search').value = ''; setPlaying(false); renderChips(); renderTime(); renderLines(false); };
    return {
      actions: {
        who: (b) => { who = b.dataset.who; renderChips(); renderLines(false); $(`[data-who="${who}"]`).focus(); },
        jump: (b) => { cur = Number(b.dataset.t); renderTime(); renderLines(false); },
        play: () => setPlaying(!playing),
      },
      reset: () => start(defaultT()),
      apply: (p) => {
        start(p.has('t') ? Number(p.get('t')) : defaultT());
        if (p.get('q')) { query = p.get('q'); $('#mn-t-search').value = query; renderLines(false); }
        if (p.get('who')) { who = p.get('who'); renderChips(); renderLines(false); }
      },
    };
  });
})();
