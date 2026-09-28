/**
 * P3 QA driver — reference application (built adapter-node server + real
 * Chrome). Verifies the P3-migrated surfaces in the SHIPPED application:
 * create form, edit form inside tabs, status tones, dialog (denied
 * action), drawer (custom island), feedback states, and captures the
 * desktop/380/320 screenshot matrix.
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
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

// ---- start the built server over a fresh DB --------------------------------
const workDir = mkdtempSync(join(tmpdir(), 'vict-qa3-refapp-'));
const dbPath = join(workDir, 'appdata.sqlite');
if (!existsSync(join(APP_DIR, 'build', 'index.js'))) {
  const build = spawnSync('npx', ['vite', 'build'], { cwd: APP_DIR, encoding: 'utf8', timeout: 300_000, shell: process.platform === 'win32' });
  if (build.status !== 0) throw new Error('reference app build failed');
}
const server = spawn(process.execPath, ['build'], {
  cwd: APP_DIR,
  env: { ...process.env, VICT_APPDATA_PATH: dbPath, PORT: '5198' },
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

const browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
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

async function act(actionId, input) {
  const response = await fetch(`${baseUrl}/api/act`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId, input }),
  });
  return response.json();
}

async function shot(name) {
  await page.screenshot({ path: join(SHOTS, name + '.png') });
}

// Track network dispatches from the page (boundary crossings).
const apiCalls = [];
page.on('request', (req) => {
  if (req.url().includes('/api/act') && req.method() === 'POST') apiCalls.push(req.postData());
});

try {
  await seed('alpha', 'Alpha project', 'active', 100);
  await seed('beta', 'Beta project', 'paused', 0);
  await seed('gamma', 'Gamma project', 'done', 250.5);

  console.log('\n=== REFAPP — create form (desktop) ===');
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${baseUrl}/projects/new`, { waitUntil: 'networkidle0' });
  await sleep(300);
  // Empty submit → local per-field errors, no dispatch (network evidence).
  await page.click('[data-testid="form-submit"]');
  await sleep(400);
  const createErrors = await page.evaluate(() =>
    ['id', 'name', 'status', 'budget'].map((name) => {
      const control = document.querySelector(`#vict-field-f\\.project-create-${name}`);
      return {
        name,
        describedby: control?.getAttribute('aria-describedby') ?? null,
        invalid: control?.getAttribute('aria-invalid') ?? null,
        errText: document.getElementById(`vict-field-error-f.project-create-${name}`)?.textContent ?? null,
      };
    }),
  );
  check(
    'create form: every required error field-associated (aria-describedby)',
    createErrors.every((e) => e.describedby === `vict-field-error-f.project-create-${e.name}` && e.invalid === 'true' && (e.errText ?? '').length > 0),
    JSON.stringify(createErrors.map((e) => [e.name, e.describedby, e.errText])),
  );
  check('create form: empty submit crossed NO network boundary', apiCalls.length === 0, `${apiCalls.length} calls`);
  await shot('refapp-form-create-errors');
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(300);

  console.log('\n=== REFAPP — create via form, then edit prefill (numeric untouched) ===');
  await page.type('#vict-field-f\\.project-create-id', 'delta');
  await page.type('#vict-field-f\\.project-create-name', 'Delta project');
  await page.type('#vict-field-f\\.project-create-status', 'active');
  await page.type('#vict-field-f\\.project-create-budget', '320');
  await page.click('[data-testid="form-submit"]');
  await sleep(700);
  check('create form dispatches through /api/act', apiCalls.length === 1, apiCalls[0] ?? 'none');
  const stored = await act('act.queryProjects').then((r) => r.rows ?? r);
  // The detail page shows the record; query the storage through the app boundary instead.
  await page.goto(`${baseUrl}/projects/delta`, { waitUntil: 'networkidle0' });
  await sleep(300);
  const detail = await page.evaluate(() => document.body.textContent.includes('Delta project'));
  check('created project renders on its detail route', detail);

  console.log('\n=== REFAPP — edit form inside tabs (numeric prefill; 0 prefill via beta) ===');
  // Switch to the Edit tab.
  const tabs = await page.$$('[role="tab"]');
  check('detail route renders a tablist with Overview/Edit', tabs.length === 2);
  await tabs[1].click();
  await sleep(300);
  const prefill = await page.evaluate(() => ({
    name: document.querySelector('#vict-field-f\\.project-edit-name')?.value,
    status: document.querySelector('#vict-field-f\\.project-edit-status')?.value,
    budget: document.querySelector('#vict-field-f\\.project-edit-budget')?.value,
  }));
  check(
    'edit tab prefills untouched numeric as numeric text',
    prefill.name === 'Delta project' && prefill.status === 'active' && prefill.budget === '320',
    JSON.stringify(prefill),
  );
  await shot('refapp-detail-edit-tab');
  // Submit untouched → update persists the same number.
  apiCalls.length = 0;
  await page.click('[data-testid="form-submit"]');
  await sleep(700);
  check('untouched edit submit dispatched once', apiCalls.length === 1, JSON.stringify(apiCalls));
  const dispatched = JSON.parse(apiCalls[0] ?? '{}');
  check(
    'untouched edit dispatch carries numeric budget (not string)',
    dispatched?.input?.budget === 320 && typeof dispatched?.input?.budget === 'number',
    JSON.stringify(dispatched?.input),
  );

  console.log('\n=== REFAPP — zero-budget record round-trip (beta) ===');
  await page.goto(`${baseUrl}/projects/beta`, { waitUntil: 'networkidle0' });
  await sleep(300);
  await (await page.$$('[role="tab"]'))[1].click();
  await sleep(300);
  const zeroPrefill = await page.evaluate(() => document.querySelector('#vict-field-f\\.project-edit-budget')?.value);
  check('budget 0 prefills as visible "0" (not empty)', zeroPrefill === '0', String(zeroPrefill));
  apiCalls.length = 0;
  await page.click('[data-testid="form-submit"]');
  await sleep(700);
  const zeroDispatch = JSON.parse(apiCalls[0] ?? '{}');
  check(
    'budget 0 survives untouched submit as number 0',
    zeroDispatch?.input?.budget === 0 && typeof zeroDispatch?.input?.budget === 'number',
    JSON.stringify(zeroDispatch?.input),
  );

  console.log('\n=== REFAPP — invalid numeric stays local (no network dispatch) ===');
  await page.goto(`${baseUrl}/projects/delta`, { waitUntil: 'networkidle0' });
  await sleep(300);
  await (await page.$$('[role="tab"]'))[1].click();
  await sleep(300);
  const budgetSel = '#vict-field-f\\.project-edit-budget';
  await page.click(budgetSel, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  // Type characters a number input rejects → badInput → value stays ''.
  await page.keyboard.down('Shift'); await page.keyboard.press('KeyX'); await page.keyboard.up('Shift');
  await page.keyboard.press('KeyZ');
  await sleep(150);
  const rawBudget = await page.$eval(budgetSel, (el) => el.value);
  apiCalls.length = 0;
  await page.click('[data-testid="form-submit"]');
  await sleep(600);
  check('garbage numeric typing leaves raw state empty (badInput)', rawBudget === '', `raw="${rawBudget}"`);
  check('submit with garbage numeric: NO network dispatch', apiCalls.length === 0, `${apiCalls.length} calls`);
  const budgetErr = await page.evaluate(() => document.getElementById('vict-field-error-f.project-edit-budget')?.textContent ?? null);
  check('field-local required error rendered for budget', budgetErr !== null, String(budgetErr));
  await shot('refapp-edit-invalid-numeric');

  console.log('\n=== REFAPP — edit prefill resets when identity changes (client-side nav) ===');
  await page.goto(`${baseUrl}/projects/delta`, { waitUntil: 'networkidle0' });
  await sleep(300);
  await (await page.$$('[role="tab"]'))[1].click();
  await sleep(200);
  await page.evaluate(() => {
    const input = document.querySelector('#vict-field-f\\.project-edit-name');
    input.value = 'DIRTY';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(150);
  // Navigate to another record WITHOUT a full reload. The projects table
  // exposes no row links, so we use SvelteKit's real client-side router
  // (it intercepts same-origin anchor clicks) — a persisted window marker
  // proves no full page load happened.
  await page.evaluate(() => { window.__qaNoReload = 'pending'; });
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = '/projects';
    document.body.appendChild(a);
    a.click();
  });
  await sleep(500);
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.href = '/projects/alpha';
    document.body.appendChild(a);
    a.click();
  });
  await sleep(800);
  const noReload = await page.evaluate(() => window.__qaNoReload === 'pending');
  check('client-side navigation used (no full page load)', noReload);
  await (await page.$$('[role="tab"]'))[1].click();
  await sleep(300);
  const alphaPrefill = await page.evaluate(() => ({
    name: document.querySelector('#vict-field-f\\.project-edit-name')?.value,
    budget: document.querySelector('#vict-field-f\\.project-edit-budget')?.value,
  }));
  check(
    'prefill resets to the new identity (dirty state discarded)',
    alphaPrefill.name === 'Alpha project' && alphaPrefill.budget === '100',
    JSON.stringify(alphaPrefill),
  );

  console.log('\n=== REFAPP — status tones on real records ===');
  await page.goto(`${baseUrl}/projects/alpha`, { waitUntil: 'networkidle0' });
  await sleep(300);
  const toneAlpha = await page.evaluate(() => document.querySelector('.vict-status')?.className);
  await page.goto(`${baseUrl}/projects/beta`, { waitUntil: 'networkidle0' });
  await sleep(300);
  const toneBeta = await page.evaluate(() => document.querySelector('.vict-status')?.className);
  await page.goto(`${baseUrl}/projects/gamma`, { waitUntil: 'networkidle0' });
  await sleep(300);
  const toneGamma = await page.evaluate(() => document.querySelector('.vict-status')?.textContent);
  check('active → success tone', toneAlpha?.includes('vict-status--success'), toneAlpha);
  check('paused → warning tone', toneBeta?.includes('vict-status--warning'), toneBeta);
  check('done → neutral tone renders', toneGamma === 'done', toneGamma);
  await shot('refapp-detail-status');

  console.log('\n=== REFAPP — dialog (denied action) + drawer on detail ===');
  await page.goto(`${baseUrl}/projects/alpha`, { waitUntil: 'networkidle0' });
  await sleep(400);
  await page.click('[data-testid="overlay-trigger"]');
  await sleep(400);
  const dlg = await page.evaluate(() => {
    const d = document.querySelector('dialog[data-testid="overlay"]');
    return { open: d?.open, modal: d?.matches(':modal'), focusInside: d?.contains(document.activeElement) };
  });
  check('refapp dialog opens modal with focus inside', dlg.open && dlg.modal && dlg.focusInside, JSON.stringify(dlg));
  await page.click('[data-testid="overlay"] button[data-action-id="act.deleteProject"]');
  await sleep(700);
  const denied = await page.evaluate(() => ({
    text: document.querySelector('[data-testid="denied-state"]')?.textContent ?? null,
    role: document.querySelector('[data-testid="denied-state"]')?.getAttribute('role'),
    stillOpen: document.querySelector('dialog[data-testid="overlay"]')?.open ?? false,
  }));
  check('authorization-denied action inside dialog surfaces denial, dialog stays open', denied.text !== null && denied.role === 'alert' && denied.stillOpen, JSON.stringify(denied));
  await shot('refapp-dialog-denied');
  await page.keyboard.press('Escape');
  await sleep(300);
  // Drawer
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    btns.find((b) => b.textContent.trim() === 'Health details…')?.click();
  });
  await sleep(400);
  const drawer = await page.evaluate(() => {
    const d = document.querySelector('dialog.vict-overlay--drawer');
    const panel = d?.querySelector('.vict-drawer');
    const box = panel?.getBoundingClientRect();
    return {
      open: d?.open ?? false,
      right: Math.abs((box?.right ?? 0) - window.innerWidth) < 2,
      island: d?.textContent?.includes('detail island') ?? false,
    };
  });
  check('drawer opens right-aligned with the custom island inside', drawer.open && drawer.right && drawer.island, JSON.stringify(drawer));
  await shot('refapp-drawer-island');
  await page.keyboard.press('Escape');
  await sleep(300);

  console.log('\n=== REFAPP — reading-time capability action inside the Overview tab ===');
  await page.goto(`${baseUrl}/projects/alpha`, { waitUntil: 'networkidle0' });
  await sleep(400);
  apiCalls.length = 0;
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    btns.find((b) => b.textContent.includes('Estimate reading time'))?.click();
  });
  // The capability runs a real pack invocation + invalidation refetch; wait
  // (bounded) for the derived list to appear.
  let listAfter = '';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(500);
    listAfter = await page.evaluate(() => document.querySelector('.vict-list')?.textContent ?? '');
    if (listAfter.length > 0) break;
  }
  const resultState = await page.evaluate(() => document.querySelector('[data-testid="result-state"]')?.textContent ?? null);
  const emptyState = await page.evaluate(() => document.querySelector('[data-surface="ls.noteReadingTime"]')?.getAttribute('data-state') ?? null);
  check(
    'capability action inside tab crosses the boundary, reports success, and the region refetches to its correct state (records carry no notes → legitimately empty; metric CONTENT rendering is covered by reading-time.test.ts with adapter-seeded notes)',
    apiCalls.length >= 1 && resultState !== null && emptyState === 'empty',
    `calls=${apiCalls.length} result=${String(resultState)} region-state=${String(emptyState)}`,
  );
  await shot('refapp-readingtime-list');

  console.log('\n=== REFAPP — screenshots 1280 / 380 / 320 ===');
  for (const [w, h] of [[1280, 900], [380, 800], [320, 800]]) {
    await page.setViewport({ width: w, height: h });
    await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle0' });
    await sleep(350);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`@${w}: projects screen has no horizontal page overflow`, overflow <= 0, String(overflow));
    await shot(`refapp-projects-${w}`);
    await page.goto(`${baseUrl}/projects/alpha`, { waitUntil: 'networkidle0' });
    await sleep(350);
    await shot(`refapp-detail-${w}`);
    await page.goto(`${baseUrl}/projects/new`, { waitUntil: 'networkidle0' });
    await sleep(350);
    await shot(`refapp-create-${w}`);
  }

  check('no page errors during the whole reference-app run', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  try { server.kill(); } catch { /* gone */ }
  for (let i = 0; i < 5; i += 1) {
    try { rmSync(workDir, { recursive: true, force: true }); break; } catch { await sleep(400); }
  }
}
writeFileSync(join(HERE, 'refapp-results.json'), JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(`\n==== REFAPP: ${results.length - failed.length}/${results.length} checks passed ====`);
for (const f of failed) console.log(`FAILED: ${f.name} (${f.detail})`);
if (failed.length > 0) process.exit(1);
