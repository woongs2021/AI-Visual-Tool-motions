// Capture screen states at 390 × 844 (@3x by default) into ./captures — the UI alone, no device frame.
//
//   npm install && npx playwright install chromium     (once)
//   node scripts/capture.mjs                            every state, light theme
//   node scripts/capture.mjs --theme=dark               … dark theme            (--dark works too)
//   node scripts/capture.mjs --theme=both --main        the three main screens in light and dark
//   node scripts/capture.mjs --lang=ko                  Korean (--lang=both: English and Korean)
//   node scripts/capture.mjs --status-bar               with the 9:41 status bar and home indicator
//   node scripts/capture.mjs --app=pc-health,habit     only these apps (ids from apps/registry.js)
//   SCALE=2 node scripts/capture.mjs                    @2x
//
// Files: captures/<screen>[--<state>][--dark][--ko][--statusbar]@<scale>x.png
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'captures');
const SCALE = Number(process.env.SCALE || 3);
const args = process.argv.slice(2);
const BARS = args.includes('--status-bar');
const ONLY_MAIN = args.includes('--main');
const themeArg = (args.find((a) => a.startsWith('--theme=')) || '').split('=')[1] || (args.includes('--dark') ? 'dark' : 'light');
const THEMES = themeArg === 'both' ? ['light', 'dark'] : [themeArg];
const langArg = (args.find((a) => a.startsWith('--lang=')) || '').split('=')[1] || 'en';
const LANGS = langArg === 'both' ? ['en', 'ko'] : [langArg];

// every app in apps/registry.js with its states; --app=<id>[,<id>] limits the run
const sandbox = { window: {} };
vm.runInNewContext(await readFile(path.join(ROOT, 'apps/registry.js'), 'utf8'), sandbox);
const only = ((args.find((a) => a.startsWith('--app=')) || '').split('=')[1] || '').split(',').filter(Boolean);
const SHOTS = sandbox.window.AU_APPS
  .filter((a) => !only.length || only.includes(a.id))
  .flatMap((a) => (a.states && a.states.length ? a.states : [{ q: '' }]).map((st) => [a.id, st.q, a.file]))
  .filter(([, state]) => !ONLY_MAIN || !state);

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
for (const lang of LANGS) for (const theme of THEMES) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SCALE, colorScheme: theme });
  for (const [screen, state, file] of SHOTS) {
    const page = await context.newPage();
    const query = `ui=1&capture=1&theme=${theme}&lang=${lang}${BARS ? '&statusbar=1' : ''}${state ? `&${state}` : ''}`;
    await page.goto(`${pathToFileURL(path.join(ROOT, file || `${screen}.html`)).href}?${query}`);
    await page.waitForSelector('html.au-ready');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => !document.documentElement.classList.contains('au-i18n-pending'));
    await page.waitForTimeout(150);
    const name = `${screen}${state ? `--${state.replace(/[=&]/g, '-')}` : ''}${theme === 'dark' ? '--dark' : ''}${lang !== 'en' ? `--${lang}` : ''}${BARS ? '--statusbar' : ''}@${SCALE}x.png`;
    await page.screenshot({ path: path.join(OUT, name), clip: { x: 0, y: 0, width: 390, height: 844 } });
    console.log('✓', name);
    await page.close();
  }
  await context.close();
}
await browser.close();
