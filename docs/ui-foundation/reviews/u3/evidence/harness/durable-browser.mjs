/* U3-05 browser-level durable journey: switch to durable-local in the UI,
   approve, (restart driven externally), reopen, decision visible. */
import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = 'http://127.0.0.1:5314';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run', '--user-data-dir=C:/Users/RZ1/AppData/Local/Temp/u3-durable-profile'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

// 1. Queue: switch the decision implementation to durable-local (UI control).
await page.goto(base + '/?as=supervisor', { waitUntil: 'networkidle0' });
await sleep(600);
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('durable-local (SQLite file)')).click());
await sleep(800);
const modeShown = await page.evaluate(() => document.querySelector('.mode-strip strong')?.textContent ?? '');
console.log('mode shown in UI:', modeShown);

// 2. Approve i-102 through the UI.
await page.goto(base + '/inspection/i-102?as=supervisor', { waitUntil: 'networkidle0' });
await sleep(600);
await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Approve this inspection')).click());
await sleep(800);
const status = await page.evaluate(() => document.querySelector('[data-ui-node="n.status"]')?.textContent ?? '');
console.log('i-102 status after UI approve:', status);
await page.screenshot({ path: 'C:/Users/RZ1/AppData/Local/Temp/u3-durable-approved.png' });

// 3. Queue shows approved.
await page.goto(base + '/?as=supervisor', { waitUntil: 'networkidle0' });
await sleep(600);
console.log('queue approved rows:', (await page.$$('[data-status="approved"]')).length);
await browser.close();
