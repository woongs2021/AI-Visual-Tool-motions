#!/usr/bin/env node
// Add a detail screen to an existing app / scenario — same accent, shared demo data, linked into the prototype.
//
//   node scripts/new-screen.mjs <app-id> <screen-id> "<Title>" --back="<parent.html> [<other-parent.html>]" [--num=1.7] [--scroll] [--desc="…"]
//   node scripts/new-screen.mjs pc-health pc-health-history "History" --back="pc-health-home.html" --desc="All past checks"
//
// Creates
//   <screen-id>.html             app bar (Back to the parents) · content · footer · menu sheet · toast — fill in the content
//   scripts/flows/<app-id>.js    appends AUKit.defineScreen('<screen-id>', …) (creates the file if needed)
// and adds the screen to apps/registry.js right after the other screens of its scenario (group).
// Link to it from another screen with  data-action="nav" data-href="<screen-id>.html"  or  <a href="…" data-nav>.
import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]; }));
const [app, id, title] = args.filter((a) => !a.startsWith('--'));
const fail = (m) => { console.error(`✕ ${m}\n  usage: node scripts/new-screen.mjs <app-id> <screen-id> "<Title>" --back="<parent.html>" [--num=1.7] [--scroll] [--desc="…"]`); process.exit(1); };
if (!app || !id || !title) fail('app id, screen id and title are required');
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id)) fail(`screen id "${id}" must be kebab-case`);
const exists = async (p) => { try { await access(path.join(ROOT, p)); return true; } catch { return false; } };
if (await exists(`${id}.html`) && !flags.force) fail(`${id}.html exists (use --force)`);

const regPath = path.join(ROOT, 'apps/registry.js');
let reg = await readFile(regPath, 'utf8');
if (reg.includes(`id: '${id}'`)) fail(`"${id}" is already in apps/registry.js`);
// the scenario: entries whose app (or id) is <app>
const entries = [...reg.matchAll(/\n  \{\n    id: '([^']+)'([^\n]*)\n[\s\S]*?\n  \},/g)].map((m) => ({ id: m[1], head: m[2], text: m[0], end: m.index + m[0].length }));
const mine = entries.filter((e) => e.id === app || new RegExp(`app: '${app}'`).test(e.head));
if (!mine.length) fail(`no screens of "${app}" in apps/registry.js`);
const group = (mine[0].head.match(/group: '([^']+)'/) || [])[1] || mine[0].text.match(/name: '([^']+)'/)[1];
const nums = mine.map((e) => (e.head.match(/num: '([^']+)'/) || [])[1]).filter(Boolean);
const major = (nums[0] || '1').split('.')[0];
const minor = Math.max(0, ...nums.map((n) => Number(n.split('.')[1] || 0)));
const num = flags.num || `${major}.${minor + 1}`;
const back = typeof flags.back === 'string' ? flags.back.trim() : `${app}.html`;
const desc = typeof flags.desc === 'string' ? flags.desc : '';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const q = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const appCss = (await exists(`styles/apps/${app}.css`)) ? `\n  <link rel="stylesheet" href="styles/apps/${app}.css">` : '';
const pre = id.split('-').map((w) => w[0]).join('').slice(0, 4);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0F1013" media="(prefers-color-scheme: dark)">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="styles/tokens.css">
  <link rel="stylesheet" href="styles/components.css">
  <link rel="stylesheet" href="styles/screens.css">
  <link rel="stylesheet" href="styles/flows.css">${appCss}
  <script>/* before first paint: theme (?theme= → saved choice → OS) and modes (?ui=1 ?capture=1 ?statusbar=1 ?embed=1) */
  (function(){var p=new URLSearchParams(location.search),r=document.documentElement,c=r.classList,t=p.get('theme');
  if(!t&&p.get('capture')!=='1'&&p.get('embed')!=='1'){try{t=localStorage.getItem('au-theme')}catch(e){}}
  if(t==='light'||t==='dark')r.setAttribute('data-au-theme',t);
  var l=p.get('lang');if(!l&&p.get('capture')!=='1'&&p.get('embed')!=='1'){try{l=localStorage.getItem('au-lang')}catch(e){}}if(l==='ko'){r.setAttribute('data-au-lang','ko');r.lang='ko';r.classList.add('au-i18n-pending');setTimeout(function(){r.classList.remove('au-i18n-pending')},1500);}
  if(p.get('ui')==='1')c.add('is-ui-only');if(p.get('capture')==='1')c.add('is-capture');if(p.get('statusbar')==='1')c.add('has-system-bars');if(p.get('embed')==='1')c.add('is-embed');})();</script>
  <script src="scripts/i18n/ko.js" defer></script>
  <script src="scripts/app.js" defer></script>
  <script src="scripts/flows/${app}.js" defer></script>
</head>
<body>
<div class="au-stage">
  <!-- data-au-back: the screens this one opens from (first = default Back) · data-au-store: the scenario's shared demo data -->
  <div class="au-screen" id="screen" data-au-app="${app}" data-au-screen="${id}" data-au-back="${esc(back)}" data-au-store="${app}"${flags.scroll ? ' data-au-scroll="true"' : ''}>
    <div class="au-status-bar" aria-hidden="true"><span class="au-num">9:41</span></div>

    <header class="au-app-bar">
      <button class="au-icon-button" type="button" aria-label="Back" data-action="back"><i class="au-icon au-icon--back" aria-hidden="true"></i></button>
      <h1 class="au-app-bar__title" id="app-title">${esc(title)}</h1>
      <button class="au-icon-button" type="button" aria-label="More options" aria-haspopup="dialog" aria-controls="${id}-menu" data-action="sheet"><i class="au-icon au-icon--more" aria-hidden="true"></i></button>
    </header>

    <main class="au-content" id="content">
      <!-- TODO: this screen's sections, top to bottom (key functions only). Keep it inside 390 × 844 unless it is a list (--scroll). -->
      <section class="au-card fl-hero" aria-labelledby="${pre}-title">
        <span class="au-icon-box au-icon-box--lg" aria-hidden="true"><i class="au-icon au-icon--sparkle"></i></span>
        <div><h2 class="fl-hero__title" id="${pre}-title">${esc(title)}</h2><p class="fl-hero__text">${esc(desc || 'What this screen is for.')}</p></div>
      </section>
      <section class="au-section fl-gap" aria-labelledby="${pre}-list">
        <div class="au-section-head"><h2 class="au-section-head__title" id="${pre}-list">Items</h2></div>
        <div class="fl-list" id="${pre}-items"></div>
      </section>
    </main>

    <footer class="au-footer">
      <button class="au-button" type="button" data-action="primary"><span>Primary Action</span></button>
    </footer>

    <div class="au-home-indicator" aria-hidden="true"></div>

    <div class="au-scrim" data-action="close-sheet" hidden></div>
    <section class="au-sheet" id="${id}-menu" role="dialog" aria-modal="true" aria-labelledby="${id}-menu-title" tabindex="-1" hidden>
      <div class="au-sheet__grabber" aria-hidden="true"></div>
      <div class="au-sheet__head">
        <h2 class="au-sheet__title" id="${id}-menu-title">Options</h2>
        <button class="au-icon-button" type="button" aria-label="Close" data-action="close-sheet"><i class="au-icon au-icon--close" aria-hidden="true"></i></button>
      </div>
      <div class="au-sheet__body">
        <div class="au-menu">
          <a class="au-menu__item" href="flows.html"><i class="au-icon au-icon--list" aria-hidden="true"></i>All screens</a>
          <button class="au-menu__item" type="button" data-action="reset" data-tone="critical"><i class="au-icon au-icon--reset" aria-hidden="true"></i>Reset demo data</button>
        </div>
      </div>
    </section>

    <div class="au-toast" role="status" aria-live="polite"><div class="au-toast__inner" id="toast"></div></div>
    <p class="au-visually-hidden" aria-live="polite"></p>
  </div>

  <nav class="au-devbar" aria-label="Preview controls">
    <a href="flows.html"><i class="au-icon au-icon--list" aria-hidden="true"></i>All screens</a>
    <button type="button" data-dev="theme">Theme: System</button>
    <button type="button" data-dev="lang" translate="no">한국어</button>
    <button type="button" data-dev="system-bars" aria-pressed="false">Status bar</button>
    <button type="button" data-dev="ui-only" aria-pressed="false">UI-only</button>
    <button type="button" data-dev="reset"><i class="au-icon au-icon--reset" aria-hidden="true"></i>Reset</button>
  </nav>
</div>
</body>
</html>
`;

const js = `
/* ---- ${title} (${id}) — added by scripts/new-screen.mjs ----------------------------------------------------------------
   ctx: { screen, toast, sheets, announce, store, nav, capture, params, $, $$, esc }
   Shared demo data for the scenario: store.get('${app}', DEFAULTS) / store.set('${app}', state) (ignored with ?capture=1).
   Navigate: nav('other.html') · nav('x.html', { back: true }) · nav('x.html', { replace: true }) for automatic steps. */
AUKit.defineScreen('${id}', ({ toast, nav, $, esc }) => {
  const ITEMS = [{ title: 'First item', meta: 'Detail' }, { title: 'Second item', meta: 'Detail' }];
  const render = () => {
    $('#${pre}-items').innerHTML = ITEMS.map((it) => \`<button class="fl-item" type="button" data-action="open">
      <span class="au-icon-box" aria-hidden="true"><i class="au-icon au-icon--doc"></i></span>
      <span class="fl-item__text"><span class="fl-item__title">\${esc(it.title)}</span><span class="fl-item__meta">\${esc(it.meta)}</span></span>
      <span></span><i class="au-icon au-icon--chevron-right fl-item__chev" aria-hidden="true"></i></button>\`).join('');
  };
  return {
    actions: {
      open: () => toast('TODO: open the detail'),
      primary: () => toast('TODO: the main action'),
    },
    reset: render,
    apply: (params) => render(),
  };
});
`;

await writeFile(path.join(ROOT, `${id}.html`), html);
await mkdir(path.join(ROOT, 'scripts/flows'), { recursive: true });
const jsPath = path.join(ROOT, `scripts/flows/${app}.js`);
const before = (await exists(`scripts/flows/${app}.js`)) ? await readFile(jsPath, 'utf8') : `/* ${group} — detail screens of the clickable prototype (loaded after scripts/app.js, both deferred). */\n`;
await writeFile(jsPath, before.trimEnd() + '\n' + js);

const entry = `
  {
    id: '${id}', num: '${num}', group: '${q(group)}', app: '${app}', store: '${app}',
    name: '${q(title)}', desc: '${q(desc)}', file: '${id}.html',
    states: [
      { label: 'Default', q: '' },
    ],
    notes: [
      'TODO: what this screen shows and how you get here.',
    ],
  },`;
const last = mine[mine.length - 1];
reg = reg.slice(0, last.end) + entry + reg.slice(last.end);
await writeFile(regPath, reg);

console.log(`✓ ${num} ${title} (${id}) in ${group}
  ${id}.html · scripts/flows/${app}.js (appended) · apps/registry.js
  Back goes to: ${back}
  next: link to it (data-action="nav" data-href="${id}.html"), fill in the content and actions, add its states to the
        registry, then run the check (index.html, Light + Dark) and the walk-through (node scripts/walkthrough.mjs).`);
