/* =========================================================================================================================
   03 Our Discussion — detail screens of the clickable prototype (loaded after scripts/app.js, both deferred).

   Flow: home → topic (our-discussion.html) → compare · discussion · agreement → decision
   Shared state (store 'our-discussion', also used by our-discussion.html):
     { you, partner, agreed: [pointIds], messages: [{ from, text }], topics: [titles], decided }
   Joon's side is simulated: he picked Option A, agrees to every point but the destination until the picks match,
   and his chat replies are canned (labelled on screen).
   ========================================================================================================================= */
(() => {
  'use strict';
  const KEY = 'our-discussion';
  const D = () => AUKit.data.discussion;
  const defaults = () => Object.assign(JSON.parse(JSON.stringify(D().defaults)), { topics: [], decided: false });
  const shared = (store) => ({ get: () => store.get(KEY, defaults()), set: (patch) => store.set(KEY, Object.assign(store.get(KEY, defaults()), patch)) });
  const icon = (name, cls = '', size) => `<i class="au-icon au-icon--${name}${cls ? ` ${cls}` : ''}" aria-hidden="true"${size ? ` style="width:${size}px;height:${size}px"` : ''}></i>`;
  const option = (id) => D().options.find((o) => o.id === id);
  const agreedSet = (st) => { const s = new Set(st.agreed); if (st.you === st.partner) s.add('destination'); else s.delete('destination'); return s; };
  const total = () => D().points.length;
  const avatar = (who, extra = '') => `<span class="au-avatar au-avatar--sm au-avatar--ring${extra}" data-person="${who}" data-name="${D().people[who].name}" aria-hidden="true">${D().people[who].initial}</span>`;
  const DETAILS = {
    a: { budget: '₩5.8M', flight: '12h 30m', weather: 'Hot, dry', highlights: 'Amalfi, Rome', activities: 'Cooking class, boat day' },
    b: { budget: '₩4.9M', flight: '2h 30m', weather: 'Hot, humid', highlights: 'Kyoto, onsen', activities: 'Onsen stay, food tour' },
  };
  const footer = (screen) => screen.querySelector(':scope > .au-footer');

  /* ---- home: topics ------------------------------------------------------------------------------------------------ */
  AUKit.defineScreen('our-discussion-home', ({ store, toast, sheets, $, esc }) => {
    const sh = shared(store);
    const steps = (n, of) => `<span class="fl-mini-steps" style="--n:${of}" aria-hidden="true">${Array.from({ length: of }, (_, i) => `<span${i < n ? ' class="is-on"' : ''}></span>`).join('')}</span>`;
    const row = ({ href, action, ic, title, meta, end, data = '' }) => `<${href ? `a href="${href}" data-nav` : `button type="button" data-action="${action}"${data}`} class="fl-item">
      <span class="au-icon-box" aria-hidden="true">${icon(ic)}</span>
      <span class="fl-item__text"><span class="fl-item__title">${esc(title)}</span><span class="fl-item__meta">${esc(meta)}</span></span>
      <span class="fl-item__end">${end}</span>${icon('chevron-right', 'fl-item__chev')}</${href ? 'a' : 'button'}>`;
    const render = () => {
      const st = sh.get(); const n = agreedSet(st).size; const pct = Math.round((n / total()) * 100);
      const travelDone = st.decided && n === total();
      const travel = travelDone
        ? row({ href: 'our-discussion-decision.html', ic: 'plane', title: 'Travel Plans', meta: `${option(st.you).title}, Jul 12 – 19`, end: '<span class="au-badge" data-tone="positive">Decided</span>' })
        : row({ href: 'our-discussion.html', ic: 'plane', title: 'Travel Plans', meta: `${n} of ${total()} points agreed`, end: `<span class="fl-item__value">${pct}%</span>${steps(n, total())}` });
      const open = [travelDone ? '' : travel,
        row({ action: 'demo-topic', ic: 'sofa', title: 'New Sofa', meta: '2 of 4 points agreed', end: `<span class="fl-item__value">50%</span>${steps(2, 4)}` }),
        ...st.topics.map((t) => row({ action: 'demo-topic', ic: 'chat', title: t, meta: 'Just started', end: '<span class="au-badge" data-tone="accent">New</span>' }))].filter(Boolean);
      const done = [travelDone ? travel : '', row({ action: 'demo-topic', ic: 'calendar', title: 'Weekend in Busan', meta: 'Decided Oct 30', end: '<span class="au-badge" data-tone="positive">Decided</span>' })].filter(Boolean);
      $('#od-h-list').innerHTML = open.join('');
      $('#od-h-done-list').innerHTML = done.join('');
      $('#od-h-open-count').textContent = open.length;
      $('#od-h-meta').textContent = `${open.length + done.length} topics, ${done.length} decided`;
    };
    const input = $('#od-h-input'); const create = $('#od-h-create');
    input.addEventListener('input', () => { create.disabled = !input.value.trim(); });
    const add = () => {
      const t = input.value.trim(); if (!t) return;
      const st = sh.get(); sh.set({ topics: st.topics.concat(t).slice(-3) });
      input.value = ''; create.disabled = true; sheets.close(); render(); toast('Topic created');
    };
    $('#od-h-form').addEventListener('submit', (e) => { e.preventDefault(); add(); });
    return {
      actions: { create: add, 'demo-topic': () => toast('Demo — open Travel Plans to try the flow') },
      reset: render,
      apply: (p) => { render(); if (p.get('sheet') === 'new') sheets.open('od-h-new'); },
    };
  });

  /* ---- compare: Option A vs Option B ------------------------------------------------------------------------------ */
  AUKit.defineScreen('our-discussion-compare', ({ store, toast, announce, screen, $, $$, esc }) => {
    const sh = shared(store);
    const ROWS = [['Budget', 'budget'], ['Flight', 'flight'], ['Weather', 'weather'], ['Highlights', 'highlights']];
    const render = (focusId) => {
      const st = sh.get();
      const head = (o) => {
        const who = [st.partner === o.id ? avatar('partner') : '', st.you === o.id ? avatar('you') : ''].join('');
        return `<div class="fl-compare__head"><span class="od-option__label${st.you === o.id ? ' is-mine' : ''}">${o.label}</span><strong>${esc(o.title)}</strong><span class="au-avatars au-avatars--sm" style="min-height:24px">${who}</span></div>`;
      };
      $('#od-c-table').innerHTML = `<div class="fl-compare__label" aria-hidden="true"></div>${D().options.map(head).join('')}
        ${ROWS.map(([label, k]) => `<div class="fl-compare__label">${label}</div>${D().options.map((o) => `<div${st.you === o.id ? ' class="is-mine"' : ''}>${esc(DETAILS[o.id][k])}</div>`).join('')}`).join('')}`;
      $('#od-c-quotes').innerHTML = [['partner', 'Amalfi in July would be perfect.', 'a'], ['you', 'Japan is easier to get around with a rail pass.', 'b']]
        .map(([who, text, o]) => `<div class="au-card fl-quote">${avatar(who)}<div><p>“${esc(text)}”</p><span>${D().people[who].name}, ${option(o).label.replace('OPTION', 'Option')}</span></div></div>`).join('');
      footer(screen).innerHTML = D().options.map((o) => st.you === o.id
        ? `<button class="au-button" type="button" aria-pressed="true" data-action="pick" data-id="${o.id}">${icon('check', '', 20)}<span>${esc(o.title)}</span></button>`
        : `<button class="au-button au-button--secondary" type="button" aria-pressed="false" data-action="pick" data-id="${o.id}"><span>Pick ${esc(o.title)}</span></button>`).join('');
      if (focusId) $(`[data-action="pick"][data-id="${focusId}"]`, screen).focus();
    };
    return {
      actions: {
        pick: (b) => {
          const st = sh.get(); if (st.you === b.dataset.id) return;
          sh.set({ you: b.dataset.id }); render(b.dataset.id);
          const s = sh.get(); const msg = s.you === s.partner ? `You both picked ${option(s.you).title}` : `Your pick: ${option(s.you).title}`;
          toast(msg); announce(msg);
        },
      },
      reset: () => render(),
      apply: (p) => { if (option(p.get('choice'))) sh.set({ you: p.get('choice') }); render(); },
    };
  });

  /* ---- discussion: chat with quick replies and simulated answers --------------------------------------------------- */
  AUKit.defineScreen('our-discussion-thread', ({ store, capture, screen, $, esc }) => {
    const sh = shared(store);
    const QUICK = ['Sounds good!', 'Talk tonight?', 'Costs?'];
    const REPLIES = ['Fair point — Italy costs a bit more, though.', 'Okay, tonight after dinner?', 'Let me check flights and get back to you.', 'Love that. Let’s mark it agreed.'];
    const content = $('.au-content', screen); const input = $('#od-t-input'); const send = $('#od-t-send');
    let typing = false; let timer = 0;
    const scrollEnd = () => requestAnimationFrame(() => { content.scrollTop = content.scrollHeight; });
    const render = () => {
      const st = sh.get();
      $('#od-t-thread').innerHTML = `<p class="fl-day">Today</p>${st.messages.map((m) => `
        <div class="od-msg" data-from="${m.from}">${avatar(m.from)}<p class="od-msg__bubble"><span class="au-visually-hidden">${D().people[m.from].name}: </span>${esc(m.text)}</p></div>`).join('')}
        ${typing ? `<div class="od-msg" data-from="partner">${avatar('partner')}<span class="fl-typing" role="status" aria-label="Joon is typing"><span></span><span></span><span></span></span></div>` : ''}`;
      $('#od-t-quick').innerHTML = QUICK.map((q) => `<button class="fl-chip" type="button" data-action="quick" data-text="${esc(q)}">${esc(q)}</button>`).join('');
      scrollEnd();
    };
    const post = (text) => {
      text = text.trim().slice(0, 200); if (!text) return;
      const st = sh.get(); sh.set({ messages: st.messages.concat({ from: 'you', text }) });
      input.value = ''; send.disabled = true; render();
      if (capture) return;
      clearTimeout(timer);
      timer = setTimeout(() => { typing = true; render(); timer = setTimeout(() => {
        typing = false; const s = sh.get(); const n = s.messages.filter((m) => m.from === 'you').length;
        sh.set({ messages: s.messages.concat({ from: 'partner', text: REPLIES[(n - 2 + REPLIES.length) % REPLIES.length] }) }); render();
      }, 1300); }, 500);
    };
    input.addEventListener('input', () => { send.disabled = !input.value.trim(); });
    $('#od-t-form').addEventListener('submit', (e) => { e.preventDefault(); post(input.value); input.focus(); });
    return {
      actions: { quick: (b) => post(b.dataset.text) },
      reset: () => { clearTimeout(timer); typing = false; render(); },
      apply: render,
    };
  });

  /* ---- agreement: every point, both sides ------------------------------------------------------------------------- */
  AUKit.defineScreen('our-discussion-agreement', ({ store, toast, announce, $, $$, esc }) => {
    const sh = shared(store);
    $('#od-a-steps').style.setProperty('--od-steps', total());
    $('#od-a-steps').innerHTML = D().points.map(() => '<span class="od-step"></span>').join('');
    const render = (focusId) => {
      const st = sh.get(); const set = agreedSet(st); const n = set.size; const pct = Math.round((n / total()) * 100);
      $('#od-a-pct').textContent = `${pct}%`;
      $$('.od-step', $('#od-a-steps')).forEach((s, i) => s.classList.toggle('is-on', i < n));
      $('#od-a-steps').setAttribute('aria-valuenow', pct);
      $('#od-a-steps').setAttribute('aria-valuetext', `${pct}%, ${n} of ${total()} points agreed (demo data)`);
      $('#od-a-caption').textContent = `${n} of ${total()} points agreed`;
      $('#od-a-points').innerHTML = D().points.map((p) => {
        const you = set.has(p.id); const partner = p.id === 'destination' ? true : true;
        const note = p.auto ? (st.you === st.partner ? `Both picked ${option(st.you).title}` : `You: ${option(st.you).title}, Joon: ${option(st.partner).title}`) : p.note;
        const ctl = p.auto
          ? `<button class="au-button au-button--secondary au-button--md" type="button" data-action="nav" data-href="our-discussion-compare.html">Compare</button>`
          : `<button class="au-button au-button--secondary au-button--md" type="button" aria-pressed="${you}" data-action="toggle" data-id="${p.id}" aria-label="${esc(p.name)}: ${you ? 'agreed, tap to undo' : 'agree'}">${you ? 'Agreed' : 'Agree'}</button>`;
        return `<div class="fl-agree" role="listitem">
          <div class="fl-agree__text"><span class="fl-agree__name">${esc(p.name)}</span><span class="au-text-meta au-truncate">${esc(note)}</span></div>
          <span class="fl-who" role="img" aria-label="Mina ${you ? 'agrees' : 'hasn’t agreed'}, Joon ${partner ? 'agrees' : 'hasn’t agreed'}">${avatar('you', you ? ' is-yes' : '')}${avatar('partner', partner ? ' is-yes' : '')}</span>
          ${ctl}</div>`;
      }).join('');
      $('#od-a-done').disabled = n < total();
      if (focusId) $(`[data-action="toggle"][data-id="${focusId}"]`)?.focus();
      return n;
    };
    return {
      actions: {
        toggle: (b) => {
          const st = sh.get(); const id = b.dataset.id;
          sh.set({ agreed: st.agreed.includes(id) ? st.agreed.filter((x) => x !== id) : st.agreed.concat(id) });
          const n = render(id);
          if (n === total()) { toast('You agree on every point'); announce('All points agreed. You can make it official.'); }
        },
      },
      reset: () => render(),
      apply: (p) => {
        if (p.get('agreed')) sh.set({ agreed: Array.from(new Set(sh.get().agreed.concat(p.get('agreed').split(',')))) });
        render();
      },
    };
  });

  /* ---- decision: the outcome and next steps ----------------------------------------------------------------------- */
  AUKit.defineScreen('our-discussion-decision', ({ store, toast, capture, screen, $, esc }) => {
    const sh = shared(store);
    const NEXT = [['n1', 'Book the flights', 'Joon'], ['n2', 'Reserve the hotel', 'Mina'], ['n3', 'Plan the activities', 'Both']];
    let done = [];
    const render = (pending) => {
      const st = sh.get(); const n = agreedSet(st).size;
      const decided = capture ? !pending : n === total();
      const pick = option(capture && decided ? st.partner : st.you);
      if (decided && !capture && !st.decided) sh.set({ decided: true });
      const box = $('#od-d-icon'); box.dataset.tone = decided ? '' : 'warning'; if (decided) delete box.dataset.tone;
      box.innerHTML = icon(decided ? 'check' : 'alert');
      $('#od-d-over').textContent = decided ? 'It’s decided' : 'Not decided yet';
      $('#od-d-title').textContent = decided ? pick.title : `${n} of ${total()} points`;
      $('#od-d-meta').textContent = decided ? `Mina & Joon agreed on ${total()} of ${total()} points` : 'Agree on every point to make it official';
      const d = DETAILS[pick.id];
      $('#od-d-rows').innerHTML = [['Destination', decided ? `${pick.title} (${d.highlights})` : '—'], ['Dates', 'Jul 12 – 19, 7 nights'], ['Budget', 'Up to ₩6,000,000'], ['Activities', decided ? d.activities : 'Not settled yet']]
        .map(([l, v]) => `<div class="au-row"><dt class="au-row__label">${l}</dt><dd class="au-row__value">${esc(v)}</dd></div>`).join('');
      $('#od-d-steps').innerHTML = NEXT.map(([id, text, who]) => `
        <button class="mn-action" type="button" role="checkbox" aria-checked="${done.includes(id)}" data-action="step" data-id="${id}"${decided ? '' : ' disabled'}>
          <span class="mn-action__box" aria-hidden="true">${icon('check')}</span><span class="mn-action__text">${text}</span><span class="mn-action__who">${who}</span></button>`).join('');
      footer(screen).innerHTML = decided
        ? `<button class="au-button au-button--secondary au-button--hug" type="button" data-action="demo" data-msg="Shared with Joon (demo)">${icon('share', '', 20)}<span>Share</span></button>
           <button class="au-button" type="button" data-action="demo" data-msg="Added to your calendar (demo)">${icon('calendar', '', 20)}<span>Add to Calendar</span></button>`
        : `<button class="au-button" type="button" data-action="nav" data-href="our-discussion-agreement.html">${icon('list', '', 20)}<span>Review Points</span></button>`;
    };
    let pending = false;
    return {
      actions: {
        step: (b) => { const id = b.dataset.id; done = done.includes(id) ? done.filter((x) => x !== id) : done.concat(id); b.setAttribute('aria-checked', done.includes(id)); },
        demo: (b) => toast(b.dataset.msg),
      },
      reset: () => { done = []; render(pending); },
      apply: (p) => { pending = p.get('pending') === '1'; render(pending); },
    };
  });
})();
