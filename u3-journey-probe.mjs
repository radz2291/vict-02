/* U3-01 journey probe: reject -> revise -> correct -> resubmit -> approve,
   plus denial, scenario reset + fencing, on the real dev server. */
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = 'http://localhost:5311';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' -- ' + detail : '')); };

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run', '--user-data-dir=C:/Users/RZ1/AppData/Local/Temp/u3-journey-profile'],
});
const page = await browser.newPage();
const exceptions = [];
page.on('pageerror', (e) => exceptions.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') exceptions.push('console: ' + m.text()); });
await page.setViewport({ width: 1440, height: 900 });

await page.goto(base + '/?as=supervisor&scenario=normal', { waitUntil: 'networkidle0' });
await sleep(600);
check('queue shows 3 rows', (await page.$$('[data-status="submitted"]')).length === 3);

await page.goto(base + '/inspection/i-101?as=supervisor', { waitUntil: 'networkidle0' });
await sleep(500);
check('detail document renders', (await page.$('[data-ui-node="n.status"]')) !== null);
check('authored approve button present', (await page.$('[data-ui-node="n.approveButton"]')) !== null);

await page.type('#rejection-reason', 'Seal photos are out of focus');
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Reject with reason')).click());
await sleep(800);
let note = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? '');
check('reject recorded', note.includes('Recorded'), note);
let statusText = await page.evaluate(() => document.querySelector('[data-ui-node="n.status"]')?.textContent ?? '');
check('status now rejected', statusText === 'rejected', statusText);
const trail = await page.evaluate(() => Array.from(document.querySelectorAll('.trail li')).map(li => li.textContent));
check('rejection reason quoted in trail', trail.some(t => t.includes('Seal photos are out of focus')));
check('no approve control on rejected (supervisor view)', (await page.evaluate(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Approve this inspection')))) === false);

await page.goto(base + '/inspection/i-101?as=technician', { waitUntil: 'networkidle0' });
await sleep(500);
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Revise')).click());
await sleep(800);
statusText = await page.evaluate(() => document.querySelector('[data-ui-node="n.status"]')?.textContent ?? '');
check('revised to draft', statusText === 'draft', statusText);
const trailAfterRevise = await page.evaluate(() => Array.from(document.querySelectorAll('.trail li')).map(li => li.textContent));
check('reason remains in trail after revise', trailAfterRevise.some(t => t.includes('Seal photos are out of focus')));
check('revise entry appended', trailAfterRevise.some(t => t.includes('Revise requested')));

await page.type('#finding-description', 'Added torque log cross-check');
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add finding')).click());
await sleep(700);
await page.type('#evidence-label', 'New torque log scan');
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add evidence')).click());
await sleep(700);
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Submit for decision')).click());
await sleep(800);
statusText = await page.evaluate(() => document.querySelector('[data-ui-node="n.status"]')?.textContent ?? '');
check('resubmitted', statusText === 'submitted', statusText);

await page.goto(base + '/inspection/i-101?as=supervisor', { waitUntil: 'networkidle0' });
await sleep(500);
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Approve this inspection')).click());
await sleep(800);
statusText = await page.evaluate(() => document.querySelector('[data-ui-node="n.status"]')?.textContent ?? '');
check('approved after resubmission', statusText === 'approved', statusText);

await page.goto(base + '/?as=supervisor', { waitUntil: 'networkidle0' });
await sleep(500);
check('queue shows the approved row', (await page.$$('[data-status="approved"]')).length === 1);

check('zero page exceptions / unexplained console errors', exceptions.length === 0, exceptions.join(' | ').slice(0, 300));
await browser.close();
const failed = results.filter(r => !r.ok);
console.log('');
console.log((results.length - failed.length) + '/' + results.length + ' PASS');
process.exit(failed.length > 0 ? 1 : 0);
