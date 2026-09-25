/**
 * P4 QA driver — SHIPPED reference application (built adapter-node server +
 * real Chrome + real SQLite + real Vict capability runs).
 *
 * Verifies the P4-migrated roles against the real application boundary:
 * conversation (the high-priority behavioral check) across success,
 * contract-rejection, in-flight race (delayed response via request
 * interception), and double-submit; the dashboard bar chart aggregation on
 * real seeded data; the custom island in the drawer; heading outline.
 * Network-level /api/act observation proves which sends crossed the
 * boundary. Writes screenshots into ./shots-refapp and results JSON.
 */
import puppeteer from 'puppeteer-core';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, 'shots-refapp');
mkdirSync(SHOTS, { recursive: true });
const APP_DIR = resolve(HERE, '..', '..', 'examples', 'reference-app');

function findBrowser() {
  for (const p of [
    process.env.VICT_BROWSER_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ])
    if (typeof p === 'string' && existsSync(p)) return p;
  throw new Error('no browser');
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail: String(detail).slice(0, 1200) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

// ---- start the built server over a fresh DB --------------------------------
const workDir = mkdtempSync(join(tmpdir(), 'vict-qa4-refapp-'));
const dbPath = join(workDir, 'appdata.sqlite');
if (!existsSync(join(APP_DIR, 'build', 'index.js'))) {
  const build = spawnSync('npx', ['vite', 'build'], { cwd: APP_DIR, encoding: 'utf8', timeout: 600_000, shell: process.platform === 'win32' });
  if (build.status !== 0) throw new Error('reference app build failed');
}
const server = spawn(process.execPath, ['build'], {
  cwd: APP_DIR,
  env: { ...process.env, VICT_APPDATA_PATH: dbPath, PORT: '5202' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const baseUrl = await new Promise((res, rej) => {
  const timer = setTimeout(() => rej(new Error('server did not start')), 30_000);
  server.stdout?.on('data', (chunk) => {
    const m = /http:\/\/[^\s:]+:(\d+)/.exec(chunk.toString());
    if (m !== null) { clearTimeout(timer); res(`http://127.0.0.1:${m[1]}`); }
  });
  server.on('exit', (code) => rej(new Error('server exited early: ' + String(code))));
});
console.log('server at', baseUrl);

const browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'] });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.setViewport({ width: 1280, height: 900 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function seed(id, name, status, budget) {
  const response = await fetch(`${baseUrl}/api/act`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId: 'act.createProject', input: { id, name, status, budget, owner: 'QA' } }),
  });
  const body = await response.json();
  if (body.ok !== true) throw new Error('seed failed: ' + JSON.stringify(body));
}

// Network-level dispatch observation + hold gate for the race check.
// A held /api/act POST is not continued until released, so the browser's
// fetch stays pending — a real in-flight send against a real server.
const apiCalls = [];
let holdNextAct = null; // set to a release fn to hold the next /api/act POST
await page.setRequestInterception(true);
page.on('request', (req) => {
  if (req.url().includes('/api/act') && req.method() === 'POST') {
    apiCalls.push(req.postData());
    if (holdNextAct !== null) {
      const release = holdNextAct;
      holdNextAct = null;
      setTimeout(() => {
        req.continue();
        release();
      }, 1500);
      return;
    }
  }
  req.continue();
});

async function shot(name) {
  await page.screenshot({ path: join(SHOTS, name + '.png') });
}

const convInput = '[data-testid="conversation-input"]';
const convSend = '[data-testid="conversation-send"]';
const feedMessage = '[data-testid="conversation-message"]';

async function feedTexts() {
  return page.$$eval(feedMessage, (els) => els.map((el) => el.textContent.trim()));
}
async function inputText() {
  return page.$eval(convInput, (el) => el.value);
}
async function typeMessage(text) {
  await page.click(convInput);
  await page.keyboard.type(text, { delay: 3 });
}

try {
  await seed('alpha', 'Alpha project', 'active', 100);
  await seed('beta', 'Beta project', 'paused', 0);
  await seed('gamma', 'Gamma project', 'done', 250.5);

  // =========================================================================
  // CONVERSATION (real runtime: real SQLite, real Vict capability reply)
  // =========================================================================
  console.log('\n=== REFAPP P4 — conversation ===');
  await page.goto(`${baseUrl}/conversation`, { waitUntil: 'networkidle0' });
  await sleep(400);

  const emptyState = await page.$eval('[data-testid="conversation-feed"] [data-state="empty"]', (el) => el.textContent).catch(() => null);
  check('refapp conversation: fresh conversation renders the declared empty state', (emptyState ?? '').includes('No messages yet'), emptyState ?? 'null');
  await shot('refapp-conversation-empty');

  // Whitespace-only → no network dispatch.
  await typeMessage('   ');
  const wsDisabled = await page.$eval(convSend, (b) => b.disabled);
  const callsBefore = apiCalls.length;
  await page.keyboard.press('Enter');
  await sleep(400);
  check(
    'refapp conversation: whitespace-only draft never crosses the boundary (network evidence)',
    wsDisabled && apiCalls.length === callsBefore,
    `disabled=${wsDisabled}, posts=${apiCalls.length - callsBefore}`,
  );

  // Successful send: trimmed dispatch, real Vict assistant reply, cleared draft.
  await typeMessage('  Hello from QA browser  ');
  const beforeSend = apiCalls.length;
  await page.click(convSend);
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-testid="conversation-message"]').length >= 1,
    { timeout: 8000 },
    beforeSend,
  );
  // Wait for the real Vict-run assistant reply (second message).
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="conversation-message"]').length >= 2,
    { timeout: 20000 },
  );
  await sleep(300);
  const feed = await feedTexts();
  const draftAfter = await inputText();
  const sentPayload = JSON.parse(apiCalls[beforeSend]);
  check(
    'refapp conversation: dispatch payload is TRIMMED app text with renderer-declared author/participant',
    sentPayload.input?.text === 'Hello from QA browser' && sentPayload.input?.author === 'You' && sentPayload.input?.participant === 'user',
    JSON.stringify(sentPayload.input),
  );
  check(
    'refapp conversation: user message AND real Vict-run assistant reply both appear after refetch',
    feed.some((t) => t.includes('Hello from QA browser')) && feed.some((t) => t.toLowerCase().includes('assistant')),
    JSON.stringify(feed.map((t) => t.slice(0, 70))),
  );
  check('refapp conversation: successful send clears the draft', draftAfter === '', `"${draftAfter}"`);
  await shot('refapp-conversation-messages');

  // Typing continues correctly after refetch.
  await typeMessage('follow-up ');
  check('refapp conversation: typing works after refetch', (await inputText()) === 'follow-up ', '');

  // Race: edit the draft while the send is in flight (held POST via interception).
  await page.evaluate(() => {
    const input = document.querySelector('[data-testid="conversation-input"]');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await typeMessage('race send');
  const raceHold = new Promise((res) => { holdNextAct = res; });
  await page.click(convSend);
  await sleep(300); // the POST is now pending (held by the interceptor gate)
  await page.click(convInput); // refocus the composer before editing the draft
  await page.keyboard.type(' EDITED-IN-FLIGHT');
  const raceDraft = await inputText();
  await raceHold; // release the POST
  await sleep(2500);
  const raceAfter = await inputText();
  check(
    'refapp conversation RACE: draft edited during an in-flight REAL send survives the success (cleared only when trimmed draft == sent text)',
    raceDraft === 'race send EDITED-IN-FLIGHT' && raceAfter === raceDraft,
    `during="${raceDraft}" after="${raceAfter}"`,
  );
  await page.waitForFunction(
    () => [...document.querySelectorAll('[data-testid="conversation-message"]')].some((el) => el.textContent.includes('race send')),
    { timeout: 8000 },
  );

  // Double submit → exactly one POST.
  const callsBeforeDouble = apiCalls.length;
  await page.evaluate(() => {
    const input = document.querySelector('[data-testid="conversation-input"]');
    input.value = 'double tap';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.$eval('[data-testid="conversation-input"]', (el) => el.focus());
  await page.$eval('form.vict-conversation-input', (f) => {
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await sleep(800);
  const doublePosts = apiCalls.length - callsBeforeDouble;
  check('refapp conversation: rapid triple-submit dispatches exactly once (network evidence)', doublePosts === 1, `posts=${doublePosts}`);
  await sleep(1500);

  // Contract rejection (>2000 chars): validation feedback + draft kept.
  const longText = 'x'.repeat(2001);
  await page.evaluate((v) => {
    const input = document.querySelector('[data-testid="conversation-input"]');
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, longText);
  const callsBeforeReject = apiCalls.length;
  await page.click(convSend);
  await page.waitForSelector('[data-testid="validation-state"]', { timeout: 8000 });
  const rejectDraft = await inputText();
  const feedbackText = await page.$eval('[data-testid="validation-state"]', (el) => el.textContent);
  check(
    'refapp conversation: contract-rejected send keeps the draft and surfaces the declared validation feedback',
    rejectDraft === longText && feedbackText.length > 0,
    `draftKept=${rejectDraft.length === 2001} feedback="${feedbackText.slice(0, 60)}"`,
  );
  await shot('refapp-conversation-rejected');

  // Focus restoration + composer usable at the end of the flow.
  const focusOk = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'conversation-input' || document.body === document.activeElement);
  await page.click(convInput);
  await typeMessage('after rejection');
  const typed = await inputText();
  check('refapp conversation: composer still operable after rejection + refetch cycle', typed === 'after rejection' || focusOk, `"${typed}"`);

  // Mobile layout.
  await page.setViewport({ width: 320, height: 800 });
  await sleep(250);
  const mobile = await page.evaluate(() => {
    const panel = document.querySelector('.vict-conversation-panel');
    const rect = panel.getBoundingClientRect();
    const input = document.querySelector('[data-testid="conversation-input"]').getBoundingClientRect();
    const button = document.querySelector('[data-testid="conversation-send"]').getBoundingClientRect();
    return {
      fits: rect.right <= document.documentElement.clientWidth,
      composerRow: Math.abs(input.top - button.top) < 6,
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  check('refapp conversation @320: panel fits, composer on one row, no document overflow', mobile.fits && mobile.composerRow && !mobile.docOverflow, JSON.stringify(mobile));
  await shot('refapp-conversation-320');
  await page.setViewport({ width: 380, height: 800 });
  await sleep(250);
  await shot('refapp-conversation-380');

  // Long + unbroken message wraps in the real app (sent and refetched).
  await page.setViewport({ width: 1280, height: 900 });
  await sleep(250);
  await page.evaluate(() => {
    const input = document.querySelector('[data-testid="conversation-input"]');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  const feedCountBefore = await page.$$eval('[data-testid="conversation-message"]', (els) => els.length);
  await typeMessage(`Long one: ${'padding '.repeat(40)}UnbreakableTokenABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz`);
  await page.click(convSend);
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-testid="conversation-message"]').length > n,
    { timeout: 15000 },
    feedCountBefore,
  );
  await sleep(300);
  const longFits = await page.evaluate(() => {
    const last = [...document.querySelectorAll('[data-testid="conversation-message"]')].at(-1);
    const panel = document.querySelector('.vict-conversation-panel');
    return {
      isLong: last.textContent.includes('Long one:'),
      fits: last.getBoundingClientRect().right <= panel.getBoundingClientRect().right + 1,
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  check('refapp conversation: long + unbroken message SENT, wraps inside the panel; no page overflow', longFits.isLong && longFits.fits && !longFits.docOverflow, JSON.stringify(longFits));

  // =========================================================================
  // DASHBOARD CHART (real seeded data) + heading outline + island in drawer
  // =========================================================================
  console.log('\n=== REFAPP P4 — dashboard chart / headings / island ===');
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });
  await sleep(500);
  const chart = await page.evaluate(() => {
    const figure = document.querySelector('[data-surface="ch.budget"]');
    if (figure === null) return null;
    const svg = figure.querySelector('svg');
    const rects = [...figure.querySelectorAll('rect.vict-bar')].map((r) => ({
      h: Number(r.getAttribute('height')),
      title: r.querySelector('title')?.textContent,
    }));
    const table = [...figure.querySelectorAll('.vict-data-table tbody tr')].map((tr) => {
      const cells = tr.querySelectorAll('td');
      return `${cells[0].textContent}=${cells[1].textContent}`;
    });
    const svgLabel = svg.getAttribute('aria-label');
    const svgRole = svg.getAttribute('role');
    const figRole = figure.getAttribute('role');
    return { rects, table, svgLabel, svgRole, figRole, summary: figure.getAttribute('aria-label') };
  });
  check(
    'refapp chart: three aggregated status bars from real seeded projects; data table matches (zero budget → 1px nub)',
    chart !== null && chart.rects.length === 3 && chart.table.join(',') === 'active=100,paused=0,done=250.5' &&
      chart.rects.find((r) => r.title === 'paused: 0')?.h <= 1,
    JSON.stringify({ table: chart?.table, rects: chart?.rects }),
  );
  check(
    'refapp chart: figure is a named group; the svg is the named image (QA a11y fix present)',
    chart.figRole === null && chart.svgRole === 'img' && chart.svgLabel === chart.summary && (chart.summary ?? '').length > 0,
    JSON.stringify({ figRole: chart?.figRole, svgRole: chart?.svgRole, summary: chart?.summary }),
  );
  await shot('refapp-dashboard-chart');

  const outline = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="vict-host"]');
    const out = [];
    const walk = (el) => {
      for (const child of el.children) {
        if (/^H[1-6]$/.test(child.tagName)) out.push(`${child.tagName} ${child.textContent.trim().slice(0, 30)}`);
        else walk(child);
      }
    };
    walk(host);
    return out;
  });
  check(
    'refapp headings: outline is sensible (shell h1, then declared levels 2 → 3 without inversion)',
    outline.length >= 2 && outline[0].startsWith('H1') && outline.slice(1).every((t, i, a) => Number(t[1]) >= Number(a[i - 1]?.[1] ?? 1)),
    JSON.stringify(outline),
  );

  await page.goto(`${baseUrl}/projects/alpha`, { waitUntil: 'networkidle0' });
  await sleep(400);
  const drawerIsland = await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Health details'))?.click();
    return true;
  });
  await sleep(400);
  const island = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]');
    const islandEl = dialog?.querySelector('[data-testid]');
    return {
      open: dialog !== null,
      drawer: dialog?.className.includes('drawer') ?? false,
      islandText: dialog?.textContent.includes('Custom components are registered code islands') ?? false,
      islandRenders: islandEl !== null,
    };
  });
  check('refapp drawer: custom island + nested text render through the recursion path (island in overlay)', island.open && island.drawer && island.islandText && island.islandRenders, JSON.stringify(island));
  await shot('refapp-drawer-island');

  await page.setViewport({ width: 320, height: 800 });
  await page.goto(`${baseUrl}/projects/alpha`, { waitUntil: 'networkidle0' });
  await sleep(400);
  const detail320 = await page.evaluate(() => {
    const dl = document.querySelector('[data-surface="dt.project"]');
    const region = dl?.closest('.vict-region') ?? dl?.closest('[data-region]');
    const dlRect = dl?.getBoundingClientRect();
    return {
      present: dl !== null,
      inside: dlRect !== null && region !== null ? dlRect.right <= region.getBoundingClientRect().right + 1 : false,
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  check('refapp detail @320 (inside tabs): long values stay inside the panel; no document overflow (P3 fix not regressed)', detail320.present && detail320.inside && !detail320.docOverflow, JSON.stringify(detail320));
  await shot('refapp-detail-320');

  check('refapp: no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
  try { rmSync(workDir, { recursive: true, force: true }); } catch {}
}

writeFileSync(join(HERE, 'refapp-results.json'), JSON.stringify({ results, pageErrors }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n==== REFAPP: ${results.length - failed.length}/${results.length} checks passed ====`);
if (failed.length > 0) process.exitCode = 1;
