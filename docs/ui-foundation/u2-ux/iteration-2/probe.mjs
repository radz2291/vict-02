import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir = new URL('./', import.meta.url);
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
const p = await browser.newPage();
const errors = [];
const observations = [];
p.on('pageerror', (e) => errors.push(String(e)));
const pause = () => new Promise((r) => setTimeout(r, 160));
async function click(label, area = '') {
  const handle = await p.evaluateHandle(
    (label, area) =>
      [...(area ? document.querySelector(area) : document).querySelectorAll('button,summary')].find(
        (b) =>
          b.textContent.trim() === label ||
          b.getAttribute('aria-label') === label ||
          b.querySelector('.name')?.textContent === label,
      ),
    label,
    area,
  );
  const el = handle.asElement();
  assert(el, `Missing ${label}`);
  await el.click();
  await handle.dispose();
  await pause();
}
async function input(label, value) {
  const selector = `[aria-label="${label}"]`;
  await p.click(selector, { clickCount: 3 });
  assert(
    await p.$eval(selector, (n) => document.activeElement === n),
    `${label} must receive focus without sticky-header obstruction`,
  );
  await p.keyboard.down('Control');
  await p.keyboard.press('a');
  await p.keyboard.up('Control');
  await p.keyboard.type(value);
  await p.keyboard.press('Tab');
  await pause();
}
async function screenshot(name) {
  await p.screenshot({
    path: new URL(name + '.png', dir).pathname.replace(/^\/C:/, 'C:'),
    fullPage: true,
  });
}
async function cardPadding() {
  return p.$$eval('.canvas article', (nodes) =>
    nodes.map((n) =>
      ['top', 'right', 'bottom', 'left'].map((s) =>
        getComputedStyle(n).getPropertyValue('padding-' + s),
      ),
    ),
  );
}
try {
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('http://127.0.0.1:5197/editor-review', { waitUntil: 'networkidle0' });
  await p.click('.canvas h1');
  await click('Style', '.inspector');
  await input('Text size', '56');
  assert.equal(await p.$eval('.canvas h1', (n) => getComputedStyle(n).fontSize), '56px');
  await screenshot('heading-1440');
  await p.setViewport({ width: 390, height: 844 });
  await pause();
  const fold = await p.$eval('[aria-label="Text size"]', (n) => ({
    top: n.getBoundingClientRect().top,
    bottom: n.getBoundingClientRect().bottom,
  }));
  assert(fold.top > 0 && fold.bottom <= 844);
  observations.push({ firstScreenTextSize: fold });
  await screenshot('heading-390');
  const sticky = await p.$eval('.uv-inspector', (n) => {
    n.scrollTop = 400;
    const a = n.getBoundingClientRect();
    const b = n.querySelector('.selection-bar').getBoundingClientRect();
    return { panelTop: a.top, headerTop: b.top };
  });
  assert(Math.abs(sticky.panelTop - sticky.headerTop) < 3);
  observations.push({ sticky });
  await p.setViewport({ width: 1440, height: 900 });
  await pause();
  await click('Research service', '.layers');
  await click('Service card', '.layers');
  await click('Style', '.inspector');
  await click('Size & spacing', '.inspector');
  await click('Link padding sides');
  await input('padding top', '29');
  assert.deepEqual(await cardPadding(), Array(3).fill(Array(4).fill('29px')));
  await click('Undo');
  assert.notEqual((await cardPadding())[0][0], '29px');
  await click('Redo');
  assert.deepEqual(await cardPadding(), Array(3).fill(Array(4).fill('29px')));
  await screenshot('spacing-1440');
  await p.$eval('[aria-label="Background picker"]', (n) => {
    n.value = '#336699';
    n.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await pause();
  await input('Background opacity', '50');
  const colors = await p.$$eval('.canvas article', (ns) =>
    ns.map((n) => getComputedStyle(n).backgroundColor),
  );
  observations.push({
    colors,
    opacity: await p.$eval('[aria-label="Background opacity"]', (n) => n.value),
    status: await p.$eval('.status', (n) => n.innerText),
  });
  await screenshot('alpha-control-1440');
  assert(colors.every((c) => c === 'rgba(51, 102, 153, 0.5)'));
  observations.push({ colors });
  await click('Save');
  await p.reload({ waitUntil: 'networkidle0' });
  await click('Reopen saved');
  assert.deepEqual(
    await p.$$eval('.canvas article', (ns) => ns.map((n) => getComputedStyle(n).backgroundColor)),
    colors,
  );
  await input('Search layers', 'Card description');
  const match = await p.$('[data-key="review|cardCopy|cardA@service"]');
  assert(match);
  await match.click();
  await pause();
  assert.equal(
    await p.$eval('[data-key="review|cardCopy|cardA@service"]', (n) =>
      n.getAttribute('aria-selected'),
    ),
    'true',
  );
  await click('Clear layers search');
  await screenshot('search-selection-1440');
  await p.setViewport({ width: 1024, height: 768 });
  await pause();
  await screenshot('selected-1024');
  await p.select('[aria-label="Preview width"]', '480');
  await pause();
  await screenshot('container-480');
  await p.setViewport({ width: 390, height: 844 });
  await pause();
  await screenshot('selected-390');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.deepEqual(errors, []);
  observations.push({ pageErrors: errors });
  fs.writeFileSync(
    new URL('builder-journeys.json', dir),
    JSON.stringify({ verdict: 'PASS', observations }, null, 2),
  );
  console.log(JSON.stringify({ verdict: 'PASS', observations }));
} catch (e) {
  fs.writeFileSync(
    new URL('builder-failed-' + Date.now() + '.json', dir),
    JSON.stringify({ error: String(e), errors, observations }, null, 2),
  );
  throw e;
} finally {
  await browser.close();
}
