#!/usr/bin/env node
// Tap through each scenario of the prototype like a person would, on a 390 × 844 touch screen, and check that every step
// lands where it should. Fails (exit 1) on the first broken step or any page error.
//
//   npm install && npx playwright install chromium     (once)
//   node scripts/walkthrough.mjs                        all scenarios
//   node scripts/walkthrough.mjs pc-health              one (pc-health | meeting-notes | our-discussion)
//   node scripts/walkthrough.mjs --headed               watch it run
//
// Add a scenario: copy one block in SCENARIOS. Steps are { do: async (page) => …, expect: 'file.html' | (page) => true }.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

// a tiny static server, so storage and navigation behave as on a real host
const server = http.createServer(async (req, res) => {
  try {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
    if (!file.startsWith(ROOT)) throw new Error('outside');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}/`;

const tap = (sel) => async (p) => p.locator(sel).first().tap();
const text = async (p, sel) => (await p.locator(sel).first().innerText()).trim();

const SCENARIOS = {
  'pc-health': [
    { name: 'Home', do: async (p) => p.goto(`${BASE}pc-health-home.html`), expect: 'pc-health-home.html' },
    { name: 'New Check', do: tap('.au-footer .au-button'), expect: 'pc-health-connect.html' },
    { name: 'PC connects, Start Scan turns on', do: async (p) => p.waitForFunction(() => !document.querySelector('#ph-c-start').disabled, null, { timeout: 5000 }), expect: (p) => true },
    { name: 'Start Scan', do: tap('#ph-c-start'), expect: 'pc-health-scan.html' },
    { name: 'Scan finishes → Result', do: async (p) => p.waitForURL(/pc-health\.html/, { timeout: 15000 }), expect: async (p) => (await text(p, '#ph-score')) === '98' },
    { name: 'Open the GPU card', do: tap('.ph-diag[data-key="gpu"] .ph-diag__head'), expect: async (p) => (await p.getAttribute('.ph-diag[data-key="gpu"] .ph-diag__head', 'aria-expanded')) === 'true' },
    { name: 'See GPU details', do: tap('.ph-diag[data-key="gpu"] .ph-diag__more'), expect: 'pc-health-part.html' },
    { name: 'Ask the Seller', do: tap('.au-footer .au-button'), expect: async (p) => p.isVisible('#ph-p-ask') },
    { name: 'Copy the message', do: tap('[data-action="copy-msg"]'), expect: async (p) => (await text(p, '#toast')) === 'Message copied' },
    { name: 'Back to Result', do: tap('[data-action="back"]'), expect: 'pc-health.html' },
    { name: 'View Full Report', do: tap('.au-footer .au-button'), expect: 'pc-health-report.html' },
    { name: 'Memory from the report', do: tap('a[href*="part=memory"]'), expect: async (p) => (await text(p, '#app-title')) === 'Memory' },
    { name: 'Back to the report', do: tap('[data-action="back"]'), expect: 'pc-health-report.html' },
    { name: 'Back to Result', do: tap('[data-action="back"]'), expect: 'pc-health.html' },
    { name: 'Back to Home (new check listed)', do: tap('[data-action="back"]'), expect: async (p) => /just now/.test(await text(p, '#ph-h-list .fl-item__meta')) },
  ],
  'meeting-notes': [
    { name: 'Home', do: async (p) => p.goto(`${BASE}meeting-notes-home.html`), expect: 'meeting-notes-home.html' },
    { name: 'New Recording (starts at 00:00)', do: tap('.au-footer .au-button'), expect: async (p) => (await text(p, '#mn-time')) === '00:00' },
    { name: 'Timer runs', do: async (p) => p.waitForTimeout(2200), expect: async (p) => (await text(p, '#mn-time')) !== '00:00' },
    { name: 'Pause', do: tap('[data-action="pause"]'), expect: async (p) => (await text(p, '#mn-status-text')) === 'Paused' },
    { name: 'Resume', do: tap('[data-action="resume"]'), expect: async (p) => (await text(p, '#mn-status-text')) === 'Recording' },
    { name: 'Stop → Processing', do: tap('[data-action="stop"]'), expect: async (p) => { await p.waitForURL(/processing/, { timeout: 5000 }); return true; } },
    { name: 'Processing → Notes', do: async (p) => p.waitForURL(/meeting-notes-notes/, { timeout: 10000 }), expect: async (p) => (await text(p, '#mn-n-title')) === 'Q4 Product Sync' },
    { name: 'Actions tab', do: tap('#mn-n-tab-actions'), expect: async (p) => (await p.locator('.mn-action').count()) === 3 },
    { name: 'Check an action', do: tap('.mn-action'), expect: async (p) => (await p.getAttribute('.mn-action', 'aria-checked')) === 'true' },
    { name: 'Full transcript', do: tap('#mn-n-transcript'), expect: 'meeting-notes-transcript.html' },
    { name: 'Search “legal”', do: async (p) => p.fill('#mn-t-search', 'legal'), expect: async (p) => (await p.locator('.fl-line mark').count()) > 0 },
    { name: 'Filter: Priya', do: async (p) => { await p.fill('#mn-t-search', ''); await p.locator('[data-who="Priya"]').tap(); }, expect: async (p) => (await p.locator('.fl-line').count()) > 0 },
    { name: 'Play', do: tap('#mn-t-play'), expect: async (p) => (await p.getAttribute('#mn-t-play', 'aria-label')) === 'Pause' },
    { name: 'Back to Notes', do: tap('[data-action="back"]'), expect: 'meeting-notes-notes.html' },
    { name: 'Back to Home (new meeting listed)', do: tap('[data-action="back"]'), expect: async (p) => (await text(p, '#mn-h-list .fl-item__title')) === 'Q4 Product Sync' },
  ],
  'our-discussion': [
    { name: 'Home', do: async (p) => p.goto(`${BASE}our-discussion-home.html`), expect: 'our-discussion-home.html' },
    { name: 'Travel Plans', do: tap('#od-h-list a'), expect: 'our-discussion.html' },
    { name: 'Compare', do: tap('[data-href="our-discussion-compare.html"]'), expect: 'our-discussion-compare.html' },
    { name: 'Pick Italy (same as Joon)', do: tap('[data-action="pick"][data-id="a"]'), expect: async (p) => /both picked/.test(await text(p, '#toast')) },
    { name: 'Back to the topic (80%)', do: tap('[data-action="back"]'), expect: async (p) => (await text(p, '#od-pct')) === '80%' },
    { name: 'Discuss', do: tap('.au-footer [data-action="discuss"]'), expect: 'our-discussion-thread.html' },
    { name: 'Quick reply, Joon answers', do: async (p) => { const n = await p.locator('.od-msg').count(); await p.locator('[data-action="quick"]').first().tap(); await p.waitForFunction((k) => document.querySelectorAll('.od-msg').length >= k + 2, n, { timeout: 5000 }); }, expect: (p) => true },
    { name: 'Agreement', do: tap('[aria-label="Agreement points"]'), expect: async (p) => p.locator('#od-a-done').isDisabled() },
    { name: 'Agree on Activities (5 of 5)', do: tap('[data-action="toggle"][data-id="activities"]'), expect: async (p) => !(await p.locator('#od-a-done').isDisabled()) },
    { name: 'Make It Official', do: tap('#od-a-done'), expect: async (p) => (await text(p, '#od-d-title')) === 'Italy' },
    { name: 'Back to the topic', do: tap('[data-action="back"]'), expect: 'our-discussion.html' },
    { name: 'Back to Home (decided)', do: tap('[data-action="back"]'), expect: async (p) => /Travel Plans/.test(await text(p, '#od-h-done-list')) },
  ],
};

const browser = await chromium.launch({ headless: !args.includes('--headed') });
let failed = 0;
for (const [name, steps] of Object.entries(SCENARIOS).filter(([n]) => !only.length || only.includes(n))) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}apps/registry.js`);                       // any same-origin page, to start with empty demo data
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  console.log(`\n${name}`);
  for (const [i, s] of steps.entries()) {
    try {
      await s.do(page); await page.waitForTimeout(350);
      const ok = typeof s.expect === 'string' ? page.url().split('?')[0].endsWith(s.expect) : await s.expect(page);
      if (!ok) throw new Error(`landed on ${page.url().replace(BASE, '')}`);
      if (errors.length) throw new Error(`page error: ${errors[0]}`);
      console.log(`  ✓ ${String(i + 1).padStart(2)} ${s.name}`);
    } catch (e) {
      console.log(`  ✕ ${String(i + 1).padStart(2)} ${s.name} — ${e.message.split('\n')[0]}`); failed++; break;
    }
  }
  await ctx.close();
}
await browser.close(); server.close();
console.log(failed ? `\n✕ ${failed} scenario(s) failed` : '\n✓ all scenarios passed');
process.exit(failed ? 1 : 0);
