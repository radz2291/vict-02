import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
const p = await browser.newPage();
const errors = [];
p.on('pageerror', (e) => {
  errors.push(e.message);
  console.log('PAGEERROR', e.message);
});
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://127.0.0.1:5197/editor-review', { waitUntil: 'networkidle0' });
await p.evaluate(() => localStorage.removeItem('vict.u2.inspector-ux.review'));
await p.reload({ waitUntil: 'networkidle0' });
async function button(text, area = '') {
  await p.evaluate(
    (text, area) => {
      const b = [...document.querySelectorAll(area + ' button,' + area + ' summary')].find(
        (b) => b.textContent.trim() === text,
      );
      if (!b) throw Error('button ' + text);
      b.click();
    },
    text,
    area,
  );
  await new Promise((r) => setTimeout(r, 100));
}
async function input(label, value) {
  await p.evaluate(
    (label, value) => {
      const el = document.querySelector('[aria-label="' + label + '"]');
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    label,
    value,
  );
  await new Promise((r) => setTimeout(r, 150));
}
await p.click('.canvas h1');
await p.click('[aria-label="Text content"]');
await p.keyboard.down('Control');
await p.keyboard.press('A');
await p.keyboard.up('Control');
await p.keyboard.type('Make space for your next idea.');
await p.click('.uv-inspector .primary');
await new Promise((r) => setTimeout(r, 300));
console.log('errors', errors);
console.log(await p.$eval('.uv-inspector', (e) => e.innerText));
console.log(await p.$eval('.status', (e) => e.innerText));
assert.equal(await p.$eval('.canvas h1', (e) => e.innerText), 'Make space for your next idea.');
await button('Style', '.tabs');
await input('Text size', '38');
assert.equal(await p.$eval('.canvas h1', (e) => getComputedStyle(e).fontSize), '38px');
await p.screenshot({ path: 'docs/ui-foundation/u2-ux/screenshots/heading-1440.png' });
await p.$eval('.canvas article', (e) => e.click());
await button('Style', '.tabs');
await input('Background picker', '#dde6ff');
assert.equal(
  await p.$$eval('.canvas article', (es) =>
    es.every((e) => getComputedStyle(e).backgroundColor === 'rgb(221, 230, 255)'),
  ),
  true,
);
await input('Edits apply to', 'instance');
await input('Background picker', '#ffe4cc');
const backgrounds = await p.$$eval('.canvas article', (es) =>
  es.map((e) => getComputedStyle(e).backgroundColor),
);
assert.deepEqual(backgrounds, ['rgb(255, 228, 204)', 'rgb(221, 230, 255)', 'rgb(221, 230, 255)']);
await p.screenshot({ path: 'docs/ui-foundation/u2-ux/screenshots/instance-1440.png' });
await button('Size & spacing', 'details');
await input('padding top', '30');
assert.equal(await p.$eval('.canvas article', (e) => getComputedStyle(e).paddingTop), '30px');
await button('Undo');
assert.equal(await p.$eval('.canvas article', (e) => getComputedStyle(e).paddingTop), '24px');
await button('Redo');
assert.equal(await p.$eval('.canvas article', (e) => getComputedStyle(e).paddingTop), '30px');
await button('Save');
await p.reload({ waitUntil: 'networkidle0' });
console.log('errors', errors);
console.log(await p.$eval('.uv-inspector', (e) => e.innerText));
console.log(await p.$eval('.status', (e) => e.innerText));
assert.equal(await p.$eval('.canvas h1', (e) => e.innerText), 'Make space for your next idea.');
await button('Reopen saved');
assert.equal(await p.$eval('.canvas article', (e) => getComputedStyle(e).paddingTop), '30px');
await p.click('.canvas article p');
await button('Style', '.tabs');
const inheritance = await p.$eval('.uv-inspector', (e) => e.innerText);
console.log('inheritance:', inheritance.includes('Inheritable property'));
await button('Override Text color', '.control');
await p.click('[aria-label="Reset Text color"]');
for (const [width, height] of [
  [1024, 768],
  [390, 844],
]) {
  await p.setViewport({ width, height });
  await p.screenshot({ path: `docs/ui-foundation/u2-ux/screenshots/selected-${width}.png` });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, `overflow ${width}`);
}
await p.setViewport({ width: 1440, height: 900 });
await input('Preview width', '480');
await p.screenshot({ path: 'docs/ui-foundation/u2-ux/screenshots/narrow-container.png' });
assert.deepEqual(errors, []);
console.log('BUILDER browser journeys PASS', backgrounds);
await browser.close();
