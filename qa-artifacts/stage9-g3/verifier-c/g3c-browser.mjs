// G3-C verifier browser journey (my own script; puppeteer-core over CDP :9222).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const ART = 'C:/Users/RZ1/Desktop/RZ/g3c-c-verify-artifacts';
const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: { width: 1280, height: 900 } });
const page = await browser.newPage();
const notes = [];
const responses = [];
page.on('response', async (r) => {
  const req = r.request();
  if (r.url().includes('/product') || r.url().includes('/vict/') || r.url().includes('/api/')) {
    let body = null;
    try { body = (await r.text()).slice(0, 300); } catch {}
    responses.push({ url: r.url(), status: r.status(), body });
  }
});

// Login
await page.goto('http://127.0.0.1:5199/login', { waitUntil: 'networkidle2' });
await page.waitForSelector('input[name="label"], input#label, form input', { timeout: 20000 });
const inputs = await page.$$('input');
await inputs[0].type('verifier');
await inputs[inputs.length - 1].type('g3c-verifier-secret');
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}), page.keyboard.press('Enter')]);
notes.push('after login url: ' + page.url());

// Product page
await page.goto('http://127.0.0.1:5199/product', { waitUntil: 'networkidle2' });
await page.waitForSelector('[data-testid="same-turn-panel"], [data-testid="pin-failure-banner"], [data-testid="capability-banner"]', { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: `${ART}/shot-product-full.png`, fullPage: true });
notes.push('product page rendered');

const banner = await page.$eval('[data-testid="same-turn-banner"]', (e) => e.textContent).catch(() => null);
const singleActor = await page.$eval('[data-testid="single-actor-banner"]', (e) => e.textContent).catch(() => null);
const whoamiDiff = await page.$eval('[data-testid="whoami-diff"]', (e) => e.textContent).catch(() => null);
const refusal = await page.$eval('[data-testid="refusal-outcome"]', (e) => e.textContent).catch(() => null);
const probe = await page.$eval('[data-testid="probe-outcome"]', (e) => e.textContent).catch(() => null);
const capability = await page.$eval('[data-testid="capability-banner"]', (e) => e.textContent).catch(() => null);
const turnIds = await page.$$eval('[data-testid="turn-record"] li, [data-testid="inspection-record"] li', (els) => els.map((e) => e.textContent));
notes.push(JSON.stringify({ banner, singleActor: singleActor?.slice(0, 60), whoamiDiff, refusal, probe, capability }, null, 1));

// Client-visible secrets check: the served hydration payload must hold no token.
const html = await page.content();
const secretLeak = html.includes('ql-g3c-live-op-token');
notes.push('browser page contains credential token value: ' + secretLeak);
fs.writeFileSync(`${ART}/g3c-browser-evidence.json`, JSON.stringify({ notes, responses, turnIds, secretLeak }, null, 2));

// Fetch-spy: from the page, confirm the client cannot see any capability to mutate
// and the banner is honest relative to a NEWER-schemad answer (spy comparison done at unit level).
console.log(notes.join('\n'));
browser.disconnect();