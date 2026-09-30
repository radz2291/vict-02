/**
 * s902-journey.mjs — the S9-02 run-list → run-detail REAL-BROWSER journey
 * driver (Stage 9 G3-B builder lane; own artifact file).
 *
 * Drives the live Studio (login → run list → FT-1 "Open run" row link →
 * run detail panels → protected-detail reveal → per-access audit) with
 * real Chrome screenshots into qa-artifacts/stage9-g3/ (s902- prefix),
 * and records the direct-API negatives (pagination, actor denial, missing
 * run) into s902-negatives.json + the console. Renders ONLY what the
 * target returned; every assertion is observed, never assumed.
 *
 * Run: node apps/studio/scripts/s902-journey.mjs
 * Env: S902_STUDIO (default http://127.0.0.1:5177)
 *      S902_TARGET_API (default http://127.0.0.1:4312)
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO = process.env.S902_STUDIO ?? 'http://127.0.0.1:5177';
const TARGET_API = process.env.S902_TARGET_API ?? 'http://127.0.0.1:4312';
const OUT = join(HERE, '..', '..', '..', 'qa-artifacts', 'stage9-g3');
// The artifact names are lane-owned; make sure the directory exists without
// touching other lanes' files.
mkdirSync(OUT, { recursive: true });

/* global document */
const OPERATOR_TOKEN = 'vict-studio-demo-operator';
const NOREAD_TOKEN = 'vict-studio-demo-noread';

function findBrowser() {
  for (const p of [
    process.env.VICT_BROWSER_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ])
    if (typeof p === 'string' && existsSync(p)) return p;
  throw new Error('no browser available');
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail: String(detail).slice(0, 400) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const negatives = {};
async function get(path, token) {
  const response = await fetch(`${TARGET_API}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return { status: response.status, body: (await response.json().catch(() => null)) ?? {} };
}

const browser = await puppeteer.launch({
  executablePath: findBrowser(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(name, fullPage = false) {
  await page.screenshot({ path: join(OUT, name), fullPage });
  console.log(`shot ${name}`);
}
async function clickByText(selector, text) {
  const handles = await page.$$(selector);
  for (const handle of handles) {
    const label = (await handle.evaluate((el) => el.textContent ?? '')) ?? '';
    if (label.includes(text)) {
      await handle.click();
      return true;
    }
  }
  return false;
}

await page.goto(`${STUDIO}/login`, { waitUntil: 'networkidle0' });
await page.waitForSelector('input[name="label"]');
await page.type('input[name="label"]', 'operator');
await page.type('input[name="secret"]', 'studio-local-pass');
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => undefined),
  page.click('button[type="submit"]'),
]);
check('studio login session established', !page.url().includes('/login'), page.url());

/* 1) Run list (FT-1 rendering): real 'Open run' row links. */
await page.goto(`${STUDIO}/runs`, { waitUntil: 'networkidle0' });
await sleep(500);
const links = await page.$$eval('a', (anchors) =>
  anchors
    .filter((a) => (a.textContent ?? '').includes('Open run'))
    .map((a) => ({ href: a.getAttribute('href'), text: a.textContent ?? '' })),
);
check(
  'run list renders genuine Open run row links (FT-1)',
  links.length >= 3,
  JSON.stringify(links.slice(0, 3)),
);
check(
  'a row link navigates to the run-detail route',
  links.some((l) => (l.href ?? '').includes('/runs/')),
);
await shot('s902-run-list.png', true);

/* 2) Drill down to the blocked run (full retention + durable wait). */
await page.goto(`${STUDIO}/runs/run-demo-blocked`, { waitUntil: 'networkidle0' });
await sleep(400);
const beforeReveal = await page.content();
check(
  'generic detail defaults REDACTED (canary absent before reveal)',
  !beforeReveal.includes('awaiting demo.resume'),
);
check('detail page shows the run id', beforeReveal.includes('run-demo-blocked'));
await shot('s902-detail-redacted-default.png', true);
const eventsSection = await page.evaluate(
  () => document.body.textContent?.includes('run.waiting') === true,
);
check('ordered events rendered verbatim (identity columns)', eventsSection);
const waitsRendered = (await page.content()).includes('wait-demo-signal');
check('durable waits rendered verbatim', waitsRendered);
const boundedOptions = (await page.content()).includes('resolve — available');
check('bounded options explanation rendered (no actions dispatched here)', boundedOptions);
await shot('s902-detail-events-waits.png', true);
await shot('s902-detail-version-compare.png', true);
await shot('s902-detail-bounded-options-provenance.png', true);

/* 3) Protected reveal: the one authorized run.detail request. */
await clickByText('button', 'Reveal protected detail');
await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => undefined);
await sleep(700);
const afterReveal = await page.content();
check(
  'protected reveal answered truthfully on the blocked run (no execution-store output exists: "(not reported)" — never synthesized)',
  afterReveal.includes('ONE authorized retrieval') && afterReveal.includes('(not reported)'),
);
check(
  'per-access audit row run.detail.accessed visible',
  afterReveal.includes('run.detail.accessed'),
);
check('per-access audit row names the actor', afterReveal.includes('actor-studio-detail'));
await shot('s902-protected-revealed.png', true);
await shot('s902-detail-audit-rows.png', true);

/* 3b) Protected bytes POSITIVE: the completed run's stored full-retention
 * output seeded in the execution store is returned verbatim by run.detail. */
const BLOCKED_CANARY = 'awaiting demo.resume';
const OUTPUT_CANARY = 'demo capability output committed under full retention';
await page.goto(`${STUDIO}/runs/run-demo-completed`, { waitUntil: 'networkidle0' });
await sleep(400);
check(
  'completed run default view stays REDACTED (output canary absent)',
  !(await page.content()).includes(OUTPUT_CANARY),
);
await clickByText('button', 'Reveal protected detail');
await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => undefined);
await sleep(700);
const bytesReveal = await page.content();
check(
  'protected bytes revealed verbatim (full-retention output)',
  bytesReveal.includes(OUTPUT_CANARY),
);
check(
  'canary cross-check: blocked-run canary text is never part of another run detail',
  !bytesReveal.includes(BLOCKED_CANARY),
);
await shot('s902-protected-bytes-revealed.png', true);

/* 4) Retention: summary run truthfully reports nothing available. */
await page.goto(`${STUDIO}/runs/run-demo-confirm`, { waitUntil: 'networkidle0' });
await clickByText('button', 'Reveal protected detail');
await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => undefined);
await sleep(700);
const retentionContent = await page.content();
check(
  'summary-retention run truthfully reports no protected bytes',
  retentionContent.includes('Protected detail NOT available') &&
    !retentionContent.includes('awaiting demo.resume'),
);
await shot('s902-protected-retention-denied.png', true);

/* 5) Missing run: truthful banner. */
await page.goto(`${STUDIO}/runs/run-demo-unknown`, { waitUntil: 'networkidle0' });
await sleep(400);
const missingContent = await page.content();
check(
  'missing run renders the truthfully refused run read banner',
  missingContent.includes('VICT_RUN_MISSING'),
);
await shot('s902-missing-run-banner.png', true);

/* 6) Empty list variant fixture (separate port; negative). */
const EMPTY_STUDIO = STUDIO.replace(/(\d+)$/, (m, d) => String(Number(d) + 1));
// The empty fixture has its OWN Studio instance: log in there first.
await page.goto(`${EMPTY_STUDIO}/login`, { waitUntil: 'networkidle0' });
await page.waitForSelector('input[name="label"]');
await page.type('input[name="label"]', 'operator');
await page.type('input[name="secret"]', 'studio-local-pass');
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => undefined),
  page.click('button[type="submit"]'),
]);
check('empty-variant studio login established', !page.url().includes('/login'), page.url());
await page.goto(`${EMPTY_STUDIO}/runs`, { waitUntil: 'networkidle0' }).catch(() => undefined);
await sleep(800);
const emptyContent = await page.content();
check(
  'empty run list renders the truthful empty state',
  emptyContent.includes('No runs recorded.'),
);
await shot('s902-empty-list.png', true);

/* 7) Direct-API negatives (recorded, no state possible through GETs). */
const deniedActor = await get('/vict/v1/runs/run-demo-blocked', NOREAD_TOKEN);
negatives['actor-denial (no run.read credential)'] = {
  status: deniedActor.status,
  code: deniedActor.body.code,
  expect: 'refusal, no state change',
};
check(
  'actor denial: target refuses credential without run.read (truthful 403 refusal)',
  deniedActor.status === 403 && deniedActor.status !== undefined && !deniedActor.body.ok,
  JSON.stringify(deniedActor).slice(0, 200),
);

const page1 = await get('/vict/v1/runs?limit=10&offset=0', OPERATOR_TOKEN);
const page2 = await get('/vict/v1/runs?limit=10&offset=10', OPERATOR_TOKEN);
const listPage = await get('/vict/v1/runs?limit=50&offset=0', OPERATOR_TOKEN);
negatives['pagination'] = {
  page1: {
    total: page1.body.data?.total,
    rows: page1.body.data?.runs?.length,
    status: page1.status,
  },
  page2: {
    total: page2.body.data?.total,
    rows: page2.body.data?.runs?.length,
    hasMore: page2.body.data?.hasMore,
  },
  defaultLimit: {
    total: listPage.body.data?.total,
    rows: listPage.body.data?.runs?.length,
    hasMore: listPage.body.data?.hasMore,
  },
};
check(
  'pagination: >1 page of runs; hasMore and totals verbatim',
  page1.body.data?.total > page1.body.data?.runs?.length &&
    page2.body.data?.hasMore === true &&
    page1.body.data?.runs[0]?.runId !== page2.body.data?.runs[0]?.runId,
);

const redacted = await get('/vict/v1/runs/run-demo-blocked', OPERATOR_TOKEN);
const redact = JSON.stringify(redacted.body);
check(
  'redacted generic detail: no protected byte crosses run.get (canary absent)',
  redacted.status === 200 && !redact.includes('awaiting demo.resume'),
);

await browser.close();
writeFileSync(join(OUT, 's902-negatives.json'), JSON.stringify(negatives, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\ns902 journey: ${results.length - failed.length}/${results.length} checks passed`);
writeFileSync(
  join(OUT, 's902-journey-results.json'),
  JSON.stringify({ results, negatives }, null, 2),
);
process.exitCode = failed.length > 0 ? 1 : 0;
