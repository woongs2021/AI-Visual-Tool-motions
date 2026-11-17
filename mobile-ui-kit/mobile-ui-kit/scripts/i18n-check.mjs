#!/usr/bin/env node
// Find English text that has no translation yet: opens every screen in every capture state (apps/registry.js), plus a
// live run of each screen (timers and steps play out), the preview and the flow board — in the given language — and
// prints what is still untranslated. Exit 1 if anything is missing.
//
//   npm install && npx playwright install chromium     (once)
//   node scripts/i18n-check.mjs                         Korean (default)
//   node scripts/i18n-check.mjs --lang=ko --app=pc-health-part,pc-health-report
//   node scripts/i18n-check.mjs --json > missing.json   machine-readable list
//
// Add the strings to scripts/i18n/<lang>.js: exact text in `strings`, text with numbers or names in `patterns`,
// and English that should stay English (product names, people) in `keep`.
import { chromium } from 'playwright';
import http from 'node:http';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => ((args.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d);
const LANG = opt('lang', 'ko');
const only = opt('app', '').split(',').filter(Boolean);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try { const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html'); res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'text/plain' }); res.end(await readFile(f)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}/`;

const box = { window: {} }; vm.runInNewContext(await readFile(path.join(ROOT, 'apps/registry.js'), 'utf8'), box);
const apps = box.window.AU_APPS.filter((a) => !only.length || only.includes(a.id));
const pages = [];
for (const a of apps) {
  for (const st of (a.states && a.states.length ? a.states : [{ q: '' }])) pages.push({ where: `${a.id}${st.q ? ` ?${st.q}` : ''}`, url: `${a.file}?ui=1&capture=1&lang=${LANG}${st.q ? `&${st.q}` : ''}`, wait: 300 });
  pages.push({ where: `${a.id} (live)`, url: `${a.file}?lang=${LANG}`, wait: 4500 });
}
if (!only.length) pages.push({ where: 'index.html', url: `index.html?lang=${LANG}`, wait: 1200 }, { where: 'flows.html', url: `flows.html?lang=${LANG}`, wait: 800 });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const found = new Map();   // text → [where]
const errors = [];
await Promise.all(Array.from({ length: 4 }, async () => {
  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message));
  while (pages.length) {
    const p = pages.shift();
    await page.goto(BASE + p.url, { waitUntil: 'load' });
    await page.waitForTimeout(p.wait);
    if (p.where === 'index.html') await page.evaluate(() => Object.values(AUKit.screens).forEach((a) => [a.name, a.desc, a.group, ...a.states.map((x) => x.label), ...a.notes].forEach((x) => x && AUKit.i18n.t(x))));
    const miss = await page.evaluate(() => (window.AUKit && AUKit.i18n ? AUKit.i18n.missing() : []));
    miss.forEach((m) => found.set(m, (found.get(m) || []).concat(p.where)));
  }
}));
await browser.close(); server.close();

const list = [...found.entries()].sort((a, b) => a[0].localeCompare(b[0]));
if (args.includes('--json')) console.log(JSON.stringify(Object.fromEntries(list.map(([k, v]) => [k, v])), null, 2));
else {
  list.forEach(([text, where]) => console.log(`${JSON.stringify(text)}   ← ${[...new Set(where)].slice(0, 3).join(', ')}`));
  console.log(list.length ? `\n✕ ${list.length} untranslated string(s) in ${LANG}` : `✓ everything is translated (${LANG})`);
}
if (errors.length) console.log('page errors:', [...new Set(errors)]);
process.exit(list.length || errors.length ? 1 : 0);
