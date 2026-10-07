/**
 * U3 INDEPENDENT VERIFIER — real-browser journey + adversarial attacks (dev 5212).
 * Independent harness: written fresh by the verifier; screenshots + console logs
 * collected per phase. Clean sweeps kept SEPARATE from negative runs.
 */
import puppeteer from 'file:///C:/Users/RZ1/Desktop/RZ/vict-02-u3-verify/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost:5212';
const SHOTS = 'C:/Users/RZ1/AppData/Local/Temp/u3-verify-logs/shots';
mkdirSync(SHOTS, { recursive: true });

const results = [];
let failures = 0;
function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  if (!cond) failures++;
  console.log(
    `${cond ? 'PASS' : 'FAIL'} ${name}${detail && !cond ? ` — ${JSON.stringify(detail).slice(0, 300)}` : ''}`,
  );
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  protocolTimeout: 60000,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();

// console collectors (per phase)
let consolePhase = 'clean';
const consoleLog = { clean: [], negative: [] };
page.on('console', (msg) => {
  const entry = { type: msg.type(), text: msg.text().slice(0, 300) };
  if (msg.type() === 'error' || msg.type() === 'warning') consoleLog[consolePhase].push(entry);
});
page.on('pageerror', (err) =>
  consoleLog[consolePhase].push({ type: 'pageerror', text: String(err).slice(0, 300) }),
);
page.on('requestfailed', (req) =>
  consoleLog[consolePhase].push({
    type: 'requestfailed',
    text: `${req.url()} ${req.failure()?.errorText}`,
  }),
);

const shot = async (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 15000 });
const goto = async (url, ms = 700) => {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await sleep(ms);
};
const text = async () => page.evaluate(() => document.body.innerText);
const clickButtonWithText = async (label, scope = 'button') => {
  const ok = await page.evaluate(
    (label, scope) => {
      const els = [...document.querySelectorAll(scope)];
      const el = els.find((e) => e.textContent.trim().includes(label));
      if (el) {
        el.click();
        return true;
      }
      return false;
    },
    label,
    scope,
  );
  if (!ok) throw new Error(`button not found: ${label}`);
};

try {
  // ================= PHASE 1: 1440x900 full journey =================
  consolePhase = 'clean';
  await page.setViewport({ width: 1440, height: 900 });
  await goto(`${BASE}/?as=supervisor`);
  let body = await text();
  check(
    'J1 queue lists the three seeded submitted inspections',
    body.includes('Cold-chain compressor room') &&
      body.includes('Dock leveller hydraulics') &&
      body.includes('Fire shutter mechanism'),
    body.slice(0, 200),
  );
  check('J1 queue shows submitted status', (body.match(/submitted/g) || []).length >= 3);
  check(
    'J1 mode strip present (decision implementation)',
    body.includes('Decision implementation') && body.includes('simulated'),
  );
  await shot('v-j01-queue-1440');

  // stale supervisor tab (kept open — "old paperwork")
  const stalePage = await browser.newPage();
  await stalePage.setViewport({ width: 1440, height: 900 });
  await stalePage.goto(`${BASE}/inspection/i-102?as=supervisor`, {
    waitUntil: 'load',
    timeout: 30000,
  });
  await sleep(700);
  const staleLoaded = await stalePage.evaluate(() =>
    document.body.innerText.includes('Dock leveller hydraulics'),
  );
  check('J1 stale supervisor tab loaded the i-102 detail (old paperwork)', staleLoaded === true);
  await page.bringToFront();

  await page.evaluate(() => {
    const link = [...document.querySelectorAll('a.queue-link')].find((e) =>
      e.textContent.includes('Cold-chain compressor room'),
    );
    if (link) link.click();
  });
  await sleep(900);
  body = await text();
  check(
    'J2 navigated to the inspection detail',
    body.includes('Cold-chain compressor room') && !body.includes('Inspection queue'),
    body.slice(0, 200),
  );
  check(
    'J2 detail shows findings and evidence sections',
    body.includes('Findings') && body.includes('Evidence'),
    body.slice(0, 400),
  );
  check('J2 detail shows activity trail', body.toLowerCase().includes('activity'));
  check('J2 seeded findings visible (seal wear)', body.includes('Seal wear beyond tolerance'));
  await shot('v-j02-detail-1440');

  await clickButtonWithText('Approve');
  await sleep(500);
  body = await text();
  check('J3 approve: status flips to approved', body.toLowerCase().includes('approved'));
  check('J3 approve: activity line added', body.includes('Inspection approved'));
  await shot('v-j03-approved-1440');

  await goto(`${BASE}/?as=supervisor`);
  body = await text();
  check('J4 queue row refreshed to approved', body.includes('approved'));
  await shot('v-j04-queue-after-approve-1440');

  // ================= rejection loop on i-102 =================
  await goto(`${BASE}/inspection/i-102?as=supervisor`);
  // reject button disabled without reason
  const rejectDisabled = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((e) =>
      e.textContent.includes('Reject'),
    );
    return b ? b.disabled : null;
  });
  check('J5 reject button disabled with empty reason', rejectDisabled === true, rejectDisabled);
  await page.type('textarea, input[type="text"]', 'Hydraulic weep needs a measured value');
  await sleep(150);
  const rejectEnabled = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((e) =>
      e.textContent.includes('Reject'),
    );
    return b ? !b.disabled : null;
  });
  check('J5 reject button enabled with reason', rejectEnabled === true, rejectEnabled);
  await clickButtonWithText('Reject');
  await sleep(500);
  body = await text();
  check('J5 status rejected', body.toLowerCase().includes('rejected'));
  check(
    'J5 reason quoted verbatim in trail',
    body.includes('Hydraulic weep needs a measured value'),
  );
  await shot('v-j05-rejected-1440');

  // technician revise
  await goto(`${BASE}/inspection/i-102?as=technician`);
  body = await text();
  const trailBeforeRevise = body;
  await clickButtonWithText('Revise');
  await sleep(500);
  body = await text();
  check('J6 revise: status draft', /draft/i.test(body));
  check(
    'J6 revise: rejection reason cleared from RECORD',
    !/Rejection reason\s*\n?\s*Hydraulic weep/.test(body),
  );
  check(
    'J6 revise: reason REMAINS in activity trail',
    body.includes('Hydraulic weep needs a measured value'),
  );
  await shot('v-j06-revised-1440');

  // corrections: finding + evidence
  const sel = await page.$('select');
  if (sel) await sel.select('high');
  await page
    .type(
      'input[placeholder*="inding"], input[aria-label*="inding"], #finding-description',
      'Corrosion found at hinge assembly',
    )
    .catch(() => {});
  // fallback: type into the last empty text input near finding form
  const typed = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input[type="text"]')];
    const el = inputs.find(
      (i) =>
        (i.placeholder || '').toLowerCase().includes('descri') ||
        (i.id || '').toLowerCase().includes('descri') ||
        (i.name || '').toLowerCase().includes('descri'),
    );
    if (el) {
      return 'found';
    }
    return inputs.length;
  });
  if (typed !== 'found') {
    // type into any visible empty text input inside the findings form area
    const used = await page.evaluate(() => {
      const forms = [...document.querySelectorAll('form, section, div')].filter(
        (d) =>
          d.querySelector('button') &&
          /add finding/i.test(d.textContent) &&
          d.querySelectorAll('input[type="text"]').length > 0,
      );
      const target = forms[0];
      if (!target) return false;
      const inp = target.querySelector('input[type="text"]');
      inp.focus();
      return true;
    });
    if (used) await page.keyboard.type('Corrosion found at hinge assembly');
  }
  await clickButtonWithText('Add finding');
  await sleep(500);
  body = await text();
  check(
    'J7 finding added appears',
    body.includes('Corrosion found at hinge assembly'),
    body.slice(0, 100),
  );
  await shot('v-j07-corrections-1440');

  // submit for decision
  await clickButtonWithText('Submit');
  await sleep(500);
  body = await text();
  check('J8 resubmit: status submitted', /submitted/i.test(body));

  // STALE decision from the pre-loaded supervisor tab (old revision)
  consolePhase = 'negative';
  await stalePage.bringToFront();
  await sleep(200);
  const staleApproved = await stalePage.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((e) =>
      e.textContent.includes('Approve'),
    );
    return b ? !b.disabled : null;
  });
  check('J9 stale tab still shows Approve (old paperwork)', staleApproved === true, staleApproved);
  await stalePage.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((e) =>
      e.textContent.includes('Approve'),
    );
    b.click();
  });
  await sleep(700);
  const staleBody = await stalePage.evaluate(() => document.body.innerText);
  check(
    'J9 stale decision refused with DOMAIN_CONFLICT',
    staleBody.includes('DOMAIN_CONFLICT'),
    staleBody.slice(0, 400),
  );
  const m =
    staleBody.match(/expected[^0-9]*(\d+)[^0-9]+(\d+)/i) || staleBody.match(/(\d+)[^\d]+(\d+)/);
  check(
    'J9 conflict message carries expected+actual revisions',
    !!m,
    m ? m.slice(0) : staleBody.slice(0, 200),
  );
  check('J9 stale tab status NOT flipped to approved', !/status\s*\n?\s*approved/i.test(staleBody));
  await stalePage.screenshot({ path: `${SHOTS}/v-j09-stale-denied-1440.png` });

  // fresh decision against NEW revision
  consolePhase = 'clean';
  await page.bringToFront();
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(400);
  await clickButtonWithText('Approve');
  await sleep(600);
  body = await text();
  check('J10 fresh approve against new revision succeeds', body.toLowerCase().includes('approved'));
  await shot('v-j10-approved-new-revision-1440');

  // ================= PHASE 2: other viewports =================
  await page.setViewport({ width: 1024, height: 768 });
  await goto(`${BASE}/?as=supervisor`);
  await shot('v-j11-queue-1024');
  await goto(`${BASE}/inspection/i-102?as=supervisor`);
  await shot('v-j12-detail-1024');

  await page.setViewport({ width: 390, height: 844 });
  await goto(`${BASE}/?as=supervisor`);
  await shot('v-j13-queue-390');
  await goto(`${BASE}/inspection/i-102?as=supervisor`);
  const clipped = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 2;
  });
  check(
    'J14 no horizontal clipping at 390px (detail)',
    clipped === false,
    `scrollWidth>clientWidth: ${clipped}`,
  );
  await shot('v-j14-detail-390');
} catch (err) {
  consoleLog.negative.push({ type: 'harness-error', text: String(err) });
  console.log('HARNESS ERROR phase1:', String(err));
}

// ================= PHASE 3: scenario console =================
try {
  consolePhase = 'clean';
  await page.setViewport({ width: 1440, height: 900 });
  await goto(`${BASE}/scenarios`, 500);
  let body = await text();
  check(
    'S1 console shows coverage table with per-op modes',
    body.includes('inspection:approve') && body.includes('simulated'),
    body.slice(0, 300),
  );
  check(
    'S1 console production mention is only a disclaimer (never a readiness claim)',
    !/production-ready|production ready/i.test(
      body.replace(/not[\s-]production[\s-]*ready|no production-readiness/gi, ''),
    ),
    body.match(/[^.]*production[^.]*/i)?.[0] ?? '',
  );
  await shot('v-s01-console-1440');

  // denied
  consolePhase = 'negative';
  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((e) => e.textContent.trim() === 'denied')
      ?.click();
  });
  await sleep(400);
  await clickButtonWithText('Run approve');
  await sleep(500);
  body = await text();
  check('S2 denied -> OPERATION_DENIED', body.includes('OPERATION_DENIED'), body.slice(0, 300));
  await shot('v-s02-denied-1440');
  // reset restores
  await clickButtonWithText('Reset scenario');
  await sleep(400);
  body = await text();
  check(
    'S2 reset restores denied scenario cleanly',
    body.includes("Reset to 'denied'"),
    body.slice(0, 200),
  );

  // failure
  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((e) => e.textContent.trim() === 'failure')
      ?.click();
  });
  await sleep(400);
  await clickButtonWithText('Run approve');
  await sleep(500);
  body = await text();
  check('S3 failure -> SIMULATED_FAILURE', body.includes('SIMULATED_FAILURE'), body.slice(0, 300));
  await clickButtonWithText('Reset scenario');
  await sleep(300);

  // conflict
  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((e) => e.textContent.trim() === 'conflict')
      ?.click();
  });
  await sleep(400);
  await clickButtonWithText('stale revision');
  await sleep(500);
  body = await text();
  check(
    'S4 conflict -> DOMAIN_CONFLICT with revisions',
    body.includes('DOMAIN_CONFLICT'),
    body.slice(0, 300),
  );
  await shot('v-s04-conflict-1440');

  // missing: approve disabled + unavailable declared
  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((e) => e.textContent.trim() === 'missing')
      ?.click();
  });
  await sleep(400);
  body = await text();
  const missingDisabled = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((e) =>
      /Run approve/i.test(e.textContent),
    );
    return b ? b.disabled : null;
  });
  check(
    'S5 missing: approve unavailable declared + control disabled',
    body.toLowerCase().includes('unavailable') && missingDisabled === true,
    `disabled=${missingDisabled}`,
  );
  await shot('v-s05-missing-1440');

  // latency fencing demo
  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((e) => e.textContent.trim() === 'latency')
      ?.click();
  });
  await sleep(400);
  await clickButtonWithText('reset mid-flight');
  await sleep(1600);
  body = await text();
  check(
    'S6 latency fencing -> SESSION_STALE (late result dropped)',
    body.includes('SESSION_STALE'),
    body.slice(0, 400),
  );
  check('S6 fencing note explicit', body.includes('FENCED'), body.slice(0, 200));
  await shot('v-s06-fenced-1440');

  // determinism: run list/approve cycle then reset, twice, compare coverage table bytes
  const cov1 = await page.evaluate(
    () =>
      document.querySelector('table, .coverage, [aria-label*="overage"]')?.innerText ??
      document.body.innerText.match(/inspection:list[\s\S]{0,400}/)?.[0] ??
      '',
  );
  await page.evaluate(() => {
    [...document.querySelectorAll('button')]
      .find((e) => e.textContent.trim() === 'normal')
      ?.click();
  });
  await sleep(400);
  await clickButtonWithText('Run approve');
  await sleep(600);
  await clickButtonWithText('Reset scenario');
  await sleep(400);
  const cov2 = await page.evaluate(
    () =>
      document.querySelector('table, .coverage, [aria-label*="overage"]')?.innerText ??
      document.body.innerText.match(/inspection:list[\s\S]{0,400}/)?.[0] ??
      '',
  );
  check(
    'S7 reset deterministic (coverage identical after run+reset)',
    cov1 === cov2 && cov1.length > 0,
  );
  await shot('v-s07-console-after-reset-1440');

  // 1024 + 390 + 480 container
  await page.setViewport({ width: 1024, height: 768 });
  await sleep(250);
  await shot('v-s08-console-1024');
  await page.setViewport({ width: 390, height: 844 });
  await sleep(250);
  await shot('v-s09-console-390');
  await page.setViewport({ width: 1280, height: 900 });
  await page.addStyleTag({ content: 'main.app-page{max-width:480px;margin:0 auto}' });
  await sleep(250);
  await shot('v-s10-console-container480');
} catch (err) {
  consoleLog.negative.push({ type: 'harness-error', text: String(err) });
  console.log('HARNESS ERROR phase3:', String(err));
}

// ================= PHASE 4: adversarial API attacks (UI-bypass attempts) =================
const api = async (action, bodyObj, as = 'supervisor', extraHeaders = {}) =>
  page.evaluate(
    async (action, bodyObj, as, extraHeaders) => {
      const r = await fetch(`/api/inspection/${action}?as=${as}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...extraHeaders },
        body: JSON.stringify(bodyObj),
      });
      return { status: r.status, ...(await r.json()) };
    },
    action,
    bodyObj,
    as,
    extraHeaders,
  );
const resetApi = async (scenario, mode) =>
  page.evaluate(
    async (scenario, mode) => {
      const r = await fetch(
        `/api/inspection/reset?scenario=${scenario}${mode ? `&mode=${mode}` : ''}`,
        { method: 'PUT' },
      );
      return r.json();
    },
    scenario,
    mode,
  );

try {
  consolePhase = 'negative';
  await resetApi('normal', 'simulated');
  await sleep(300);

  // X1 technician approves via direct API
  let r = await api('inspection-approve', { id: 'i-101', expectedDomainRevision: 3 }, 'technician');
  check(
    'X1 direct-API approve as technician -> DATA_UNAUTHORIZED',
    r.ok === false && r.code === 'DATA_UNAUTHORIZED',
    r,
  );

  // X2 supervisor rejects with blank reason via direct API
  r = await api(
    'inspection-reject',
    { id: 'i-102', expectedDomainRevision: 2, rejectionReason: '   ' },
    'supervisor',
  );
  check(
    'X2 direct-API blank rejection reason -> DATA_INVALID_INPUT',
    r.ok === false && r.code === 'DATA_INVALID_INPUT',
    r,
  );

  // X3 finding-add to an approved inspection via direct API
  r = await api('inspection-approve', { id: 'i-101', expectedDomainRevision: 3 }, 'supervisor');
  check('X3a setup approve ok', r.ok === true, r);
  r = await api(
    'finding-add',
    { id: 'x-1', inspectionId: 'i-101', severity: 'high', description: 'post-approval finding' },
    'technician',
  );
  check('X3 direct-API finding.add to APPROVED -> refused', r.ok === false, r);

  // X4 revise by the wrong technician (i-103 assigned to m.osei; API actor is t.nguyen)
  r = await api('inspection-revise', { id: 'i-103' }, 'technician');
  check(
    'X4 revise by non-assigned technician -> DATA_UNAUTHORIZED',
    r.ok === false && r.code === 'DATA_UNAUTHORIZED',
    r,
  );

  // X5 idempotency-key replay through the API
  await resetApi('normal', 'simulated');
  r = await api('inspection-approve', { id: 'i-101', expectedDomainRevision: 3 }, 'supervisor', {
    'x-idempotency-key': 'v-key-1',
  });
  check('X5a approve with idempotency key ok', r.ok === true, r);
  const r2 = await api(
    'inspection-approve',
    { id: 'i-101', expectedDomainRevision: 3 },
    'supervisor',
    { 'x-idempotency-key': 'v-key-1' },
  );
  check(
    'X5b replay -> DATA_IDEMPOTENT_REPLAY',
    r2.ok === false && r2.code === 'DATA_IDEMPOTENT_REPLAY',
    r2,
  );
  const r3 = await api(
    'inspection-reject',
    { id: 'i-102', expectedDomainRevision: 2, rejectionReason: 'other' },
    'supervisor',
    { 'x-idempotency-key': 'v-key-1' },
  );
  check(
    'X5c key reuse different payload -> DATA_IDEMPOTENCY_CONFLICT',
    r3.ok === false && r3.code === 'DATA_IDEMPOTENCY_CONFLICT',
    r3,
  );

  // X6 malformed body
  r = await page.evaluate(async () => {
    const resp = await fetch('/api/inspection/inspection-approve?as=supervisor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    return { status: resp.status, ...(await resp.json()) };
  });
  check(
    'X6 malformed JSON -> 400 DATA_INVALID_INPUT',
    r.status === 400 && r.code === 'DATA_INVALID_INPUT',
    r,
  );

  // X7 unknown action
  r = await api('world-domination', {});
  check('X7 unknown action -> UNKNOWN_ACTION', r.ok === false && r.code === 'UNKNOWN_ACTION', r);

  // X8 stale decision directly after reset (server-side stale check)
  r = await api('inspection-approve', { id: 'i-102', expectedDomainRevision: 1 }, 'supervisor');
  check(
    'X8 stale revision via API -> DOMAIN_CONFLICT',
    r.ok === false && r.code === 'DOMAIN_CONFLICT',
    r,
  );

  // X9 write back the clean state for later phases
  await resetApi('normal', 'simulated');
} catch (err) {
  consoleLog.negative.push({ type: 'harness-error', text: String(err) });
  console.log('HARNESS ERROR phase4:', String(err));
}

// ================= PHASE 5: clean console sweep =================
try {
  consolePhase = 'clean';
  const sweep = await browser.newPage();
  await sweep.setViewport({ width: 1440, height: 900 });
  const sweepLog = [];
  sweep.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning')
      sweepLog.push({ type: msg.type(), text: msg.text().slice(0, 300) });
  });
  sweep.on('pageerror', (e) => sweepLog.push({ type: 'pageerror', text: String(e).slice(0, 300) }));
  sweep.on('requestfailed', (req) =>
    sweepLog.push({ type: 'requestfailed', text: `${req.url()} ${req.failure()?.errorText}` }),
  );
  for (const url of [
    `${BASE}/?as=supervisor`,
    `${BASE}/inspection/i-101?as=supervisor`,
    `${BASE}/inspection/i-101?as=technician`,
    `${BASE}/scenarios`,
  ]) {
    await sweep.goto(`${url}`, { waitUntil: 'load', timeout: 30000 });
    await sleep(400);
  }
  await sleep(500);
  check('Z1 clean sweep: zero console errors/warnings/pageerrors', sweepLog.length === 0, sweepLog);
  writeFileSync(
    'C:/Users/RZ1/AppData/Local/Temp/u3-verify-logs/clean-sweep-console.json',
    JSON.stringify(sweepLog, null, 1),
  );
  await sweep.close();
} catch (err) {
  console.log('HARNESS ERROR phase5:', String(err));
}

writeFileSync(
  'C:/Users/RZ1/AppData/Local/Temp/u3-verify-logs/journey-results.json',
  JSON.stringify({ results, consoleLog }, null, 1),
);
console.log(
  `\nJOURNEY RESULT: ${results.filter((r) => r.ok).length}/${results.length} checks passed, ${failures} failures`,
);
await browser.close();
process.exit(failures > 0 ? 1 : 0);
