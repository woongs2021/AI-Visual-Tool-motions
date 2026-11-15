/* =========================================================================================================================
   Progressive blur — the writing of AI-Visual-Tool-motions, for other projects. No dependencies.

   1. writeText(el)                 the Adaptive Screen's sentence at the top: written letter by letter, in reading order. Each letter
                                    comes out of a blur, rising into place; it is inked fast and sharpens slowly, so a soft blurred tail
                                    trails the writing point.
   2. writeContent({ text, rows })  전체 비교's content: what the agent says, written the same way, then its list, row by row, each row
                                    written as one more letter of the same writing. With rows only (the agent's card), the rows start at once.

   The values are the tool's (index.html: ASL_WRITE, SAY_IN), in ms and CSS px (1 px = 1 dp): its seconds × the Adaptive Screen's
   slow-down (1.5), its 3× stage's px ÷ 3.

   Use:  <script src="progressive-blur.js"></script>   →   ProgressiveBlur.writeText('#headline')
         (with a bundler: import './progressive-blur.js' and use window.ProgressiveBlur; in CommonJS: require('./progressive-blur.js'))
   ========================================================================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ProgressiveBlur = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- values ---------- */
  // how a letter is written (ASL_WRITE)
  const WRITE = Object.freeze({
    delay: 630,      // ms before the first letter starts (textIn 0.42 s × 1.5)
    stagger: 16.5,   // ms between one letter and the next; a space counts as one letter (charStagger 0.011 s × 1.5)
    duration: 1725,  // ms from fully blurred to sharp, for each letter (charDur 1.15 s × 1.5)
    ink: 0.3,        // its opacity reaches 1 within this part of its duration (charInk)
    blur: 6,         // px of blur it starts from (charBlur 18 ÷ 3)
    rise: 10 / 3,    // px it rises into place (charRise 10 ÷ 3)
  });
  // where 전체 비교's rows fall in the same writing (SAY_IN)
  const CONTENT = Object.freeze({
    gap: 8,          // the first row: this many letters' time after the sentence
    step: 12,        // each next row: this many letters' time after the one before
  });

  /* ---------- the writing: one letter (or row) ---------- */
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeSine = t => -(Math.cos(Math.PI * t) - 1) / 2;   // sine in-out
  const easeOut3 = t => 1 - Math.pow(1 - t, 3);             // cubic out
  // the letter at writing step k, t ms into the writing: its opacity, blur (px) and lift (px)
  function letterAt(k, t, o) {
    const p = clamp01((t - o.delay - k * o.stagger) / o.duration), b = easeOut3(p);
    return { p, opacity: easeSine(clamp01(p / o.ink)), blur: (1 - b) * o.blur, y: (1 - b) * o.rise };
  }

  /* ---------- text → letters ---------- */
  const source = new WeakMap();   // each element's own markup, so that it can be written again
  const SR_ONLY = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0';
  // Splits el's text into letters, keeping its markup (<strong>, <b>, <br>, …). Each word is one unbreakable box, so lines break only
  // between words; every letter, and every space or line break between letters, is one step of the writing (as in the tool).
  function splitLetters(el) {
    if (source.has(el)) el.innerHTML = source.get(el); else source.set(el, el.innerHTML);
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    const letters = []; let k = 0, gap = false;
    const walk = node => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const tok of child.nodeValue.split(/([ \t\n\r\f]+)/)) {   // (a no-break space stays inside its word)
            if (!tok) continue;
            if (/^[ \t\n\r\f]+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); gap = letters.length > 0; continue; }
            const word = document.createElement('span');
            word.setAttribute('aria-hidden', 'true');
            word.style.cssText = 'display:inline-block;white-space:nowrap';
            for (const ch of tok) {
              if (gap) { k++; gap = false; }
              const c = document.createElement('span');
              c.textContent = ch; c.style.display = 'inline-block';
              word.appendChild(c); letters.push({ el: c, k: k++ });
            }
            frag.appendChild(word);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          if (child.tagName === 'BR') { gap = letters.length > 0; continue; }
          walk(child);
        }
      }
    };
    walk(el);
    const sr = document.createElement('span');   // (read as one sentence by screen readers)
    sr.style.cssText = SR_ONLY; sr.textContent = label; el.appendChild(sr);
    return { letters, steps: k };
  }

  /* ---------- playing ---------- */
  function paint(item, s) {
    const st = item.el.style;
    if (s.p >= 1) {   // sharp: hand the element back to its own styles
      if (item.state !== 'done') { st.opacity = ''; st.filter = ''; st.translate = ''; item.state = 'done'; }
      return;
    }
    if (s.p <= 0 && item.state === 'waiting') return;
    item.state = s.p <= 0 ? 'waiting' : 'writing';
    st.opacity = s.opacity.toFixed(3);
    st.filter = s.blur > 0.01 ? `blur(${s.blur.toFixed(2)}px)` : '';
    st.translate = `0 ${s.y.toFixed(2)}px`;
  }
  function timeline(items, o) {
    const total = items.length ? o.delay + Math.max(...items.map(i => i.k)) * o.stagger + o.duration : 0;
    let raf = 0, now = 0, done;
    const finished = new Promise(r => { done = r; });
    const render = t => { now = t; for (const it of items) paint(it, letterAt(it.k, t, o)); if (t >= total) done(ctl); };
    const ctl = {
      duration: total,   // ms until the last letter (or row) is sharp
      finished,          // resolves when it is
      play() {
        cancelAnimationFrame(raf);
        const start = performance.now() - now;
        const tick = () => { render(Math.min(total, performance.now() - start)); if (now < total) raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
        return ctl;
      },
      pause() { cancelAnimationFrame(raf); return ctl; },
      seek(ms) { cancelAnimationFrame(raf); render(Math.max(0, Math.min(total, ms))); return ctl; },   // (paused there)
      finish() { return ctl.seek(total); },
      restart() { return ctl.seek(0).play(); },
    };
    render(0);   // (hidden until it starts)
    const reduce = o.respectReducedMotion && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) ctl.finish(); else if (o.autoplay) ctl.play();
    return ctl;
  }

  /* ---------- the two effects ---------- */
  const one = x => (typeof x === 'string' ? document.querySelector(x) : x);
  const all = x => (!x ? [] : typeof x === 'string' ? Array.from(document.querySelectorAll(x)) : x.nodeType === 1 ? [x] : Array.from(x));
  const OPTIONS = { autoplay: true, respectReducedMotion: true };

  // 1. The Adaptive Screen's sentence: el (an element or a selector) written letter by letter
  function writeText(el, options) {
    el = one(el); if (!el) throw new Error('ProgressiveBlur.writeText: no element');
    const o = Object.assign({}, WRITE, OPTIONS, options);
    return timeline(splitLetters(el).letters, o);
  }

  // 2. 전체 비교's content: { text, rows } — text: what the agent says (an element or a selector; optional), rows: its list (elements,
  // a NodeList or a selector), written in that order. With text, the writing starts after `delay`, as the Adaptive Screen's; with rows
  // only (the agent's card), at once (delay 0).
  function writeContent(parts, options) {
    parts = parts || {};
    const text = parts.text ? one(parts.text) : null, rows = all(parts.rows);
    const o = Object.assign({}, WRITE, CONTENT, OPTIONS, { delay: text ? WRITE.delay : 0 }, options);
    const items = []; let first = 0;
    if (text) { const s = splitLetters(text); items.push(...s.letters); first = s.steps + o.gap; }
    rows.forEach((el, i) => items.push({ el, k: first + i * o.step }));
    return timeline(items, o);
  }

  return { writeText, writeContent, letterAt: (k, t, options) => letterAt(k, t, Object.assign({}, WRITE, options)), WRITE, CONTENT };
});
