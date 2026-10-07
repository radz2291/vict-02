/* U3-05 restart leg: fresh process + fresh browser; the UI must show BOTH
   durable decisions (i-101 from the API proof, i-102 from the UI proof). */
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = 'http://127.0.0.1:5315';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run', '--user-data-dir=C:/Users/RZ1/AppData/Local/Temp/u3-durable-profile2'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

await page.goto(base + '/?as=supervisor&mode=durable-local', { waitUntil: 'networkidle0' });
await sleep(800);
const approvedRows = (await page.$$('[data-status="approved"]')).length;
console.log('approved rows after restart:', approvedRows);
const modeShown = await page.evaluate(() => document.querySelector('.mode-strip strong')?.textContent ?? '');
console.log('mode shown:', modeShown);
await page.screenshot({ path: 'C:/Users/RZ1/Desktop/RZ/vict-02-u3/docs/ui-foundation/reviews/u3/durable/restart-queue-1440.png' });

// Detail: i-101 decision fields + trail survived.
await page.goto(base + '/inspection/i-101?as=supervisor', { waitUntil: 'networkidle0' });
await sleep(600);
const status = await page.evaluate(() => document.querySelector('[data-ui-node="n.status"]')?.textContent ?? '');
const trail = await page.evaluate(() => Array.from(document.querySelectorAll('.trail li')).map(li => li.textContent));
console.log('i-101 after restart:', status, '| trail rows:', trail.length);
await page.screenshot({ path: 'C:/Users/RZ1/Desktop/RZ/vict-02-u3/docs/ui-foundation/reviews/u3/durable/restart-detail-1440.png' });

// Detail: i-102 (the UI-approved one).
await page.goto(base + '/inspection/i-102?as=supervisor', { waitUntil: 'networkidle0' });
await sleep(600);
const status2 = await page.evaluate(() => document.querySelector('[data-ui-node="n.status"]')?.textContent ?? '');
console.log('i-102 after restart:', status2);
await browser.close();
