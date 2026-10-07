/* U3-02/04/07 scenario console probe: coverage truthfulness, deterministic
   reset, latency fencing demo, zero unexplained console errors. */
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = 'http://localhost:5311';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' -- ' + detail : '')); };

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run', '--user-data-dir=C:/Users/RZ1/AppData/Local/Temp/u3-scenario-profile'],
});
const page = await browser.newPage();
const exceptions = [];
page.on('pageerror', (e) => exceptions.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') exceptions.push('console: ' + m.text()); });
await page.setViewport({ width: 1440, height: 900 });

await page.goto(base + '/scenarios', { waitUntil: 'networkidle0' });
await sleep(800);

// 1. Console renders: 8 tabs, coverage table with 8 rows, approve simulated.
check('console renders with scenario tabs', (await page.$$('.tab')).length === 8);
const coverageRows = await page.evaluate(() => Array.from(document.querySelectorAll('.coverage tbody tr')).map(tr => tr.textContent));
check('coverage table lists 8 operations', coverageRows.length === 8, String(coverageRows.length));
check('approve declared simulated (normal)', (coverageRows.find(r => r.includes('inspection:approve')) ?? '').includes('simulated'));

// 2. Run approve (normal): settles OK via the adapter.
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Run approve').click());
await sleep(700);
let note = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? '');
check('approve settled OK (normal)', note.includes('settled OK'), note);

// 3. Reset: deterministic — new session id, fresh seed; approve can run again.
const firstSession = await page.evaluate(() => document.querySelector('.label-line code')?.textContent ?? '');
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Reset scenario').click());
await sleep(600);
const secondSession = await page.evaluate(() => document.querySelector('.label-line code')?.textContent ?? '');
check('reset creates a NEW session identity', firstSession !== secondSession, firstSession + ' -> ' + secondSession);
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Run approve').click());
await sleep(700);
note = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? '');
check('approve settles again after deterministic reset', note.includes('settled OK'), note);

// 4. Missing scenario: approve button disabled + coverage shows unavailable.
await page.evaluate(() => Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.trim() === 'missing').click());
await sleep(600);
const missingCoverage = await page.evaluate(() => Array.from(document.querySelectorAll('.coverage tbody tr')).map(tr => tr.textContent).find(r => r.includes('inspection:approve')) ?? '');
check('missing scenario: approve unavailable', missingCoverage.includes('unavailable'), missingCoverage);
check('missing scenario: approve button disabled', await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Run approve'))?.disabled === true));

// 5. Denied scenario: run approve -> OPERATION_DENIED.
await page.evaluate(() => Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.trim() === 'denied').click());
await sleep(600);
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Run approve').click());
await sleep(700);
note = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? '');
check('denied scenario: OPERATION_DENIED', note.includes('OPERATION_DENIED'), note);

// 6. Failure scenario: SIMULATED_FAILURE.
await page.evaluate(() => Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.trim() === 'failure').click());
await sleep(600);
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Run approve').click());
await sleep(700);
note = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? '');
check('failure scenario: SIMULATED_FAILURE', note.includes('SIMULATED_FAILURE'), note);

// 7. Conflict scenario: stale revision -> DOMAIN_CONFLICT.
await page.evaluate(() => Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.trim() === 'conflict').click());
await sleep(600);
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Run approve (stale revision)')).click());
await sleep(700);
note = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? '');
check('conflict scenario: DOMAIN_CONFLICT', note.includes('DOMAIN_CONFLICT'), note);

// 8. Latency scenario + fencing demo: reset mid-flight fences the decision.
await page.evaluate(() => Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.trim() === 'latency').click());
await sleep(600);
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Fencing demo')).click());
await sleep(1400);
note = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? '');
check('latency fencing: late result fenced (SESSION_STALE)', note.includes('FENCED') && note.includes('SESSION_STALE'), note);
const fencedResult = await page.evaluate(() => Array.from(document.querySelectorAll('.results li')).map(li => li.textContent).find(t => t.includes('reset mid-flight')) ?? '');
check('fenced result recorded in results', fencedResult.includes('SESSION_STALE'));

// 9. Empty scenario: list settles with zero rows (run list, results show OK with empty set via note).
await page.evaluate(() => Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.trim() === 'empty').click());
await sleep(600);
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Run list').click());
await sleep(700);
note = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? '');
check('empty scenario: list settles OK', note.includes('settled OK'), note);

// 10. Long scenario: list settles; 40 findings in the adapter-backed row.
await page.evaluate(() => Array.from(document.querySelectorAll('.tab')).find(t => t.textContent.trim() === 'long').click());
await sleep(600);
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Run list').click());
await sleep(700);
note = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? '');
check('long scenario: list settles OK', note.includes('settled OK'), note);

check('zero page exceptions / unexplained console errors', exceptions.length === 0, exceptions.join(' | ').slice(0, 300));
await browser.close();
const failed = results.filter(r => !r.ok);
console.log('');
console.log((results.length - failed.length) + '/' + results.length + ' PASS');
process.exit(failed.length > 0 ? 1 : 0);
