import { launch, freshPage, openWorkbench, layersSearch, sleep } from './helpers.mjs';
const browser = await launch();
const { context, page } = await freshPage(browser);
try {
  await openWorkbench(page);
  await layersSearch(page, 'Kitchens');
  // 1) DOM click via JS
  await page.evaluate(() => document.querySelector('nav[aria-label="Layers"] [data-key="doc.northwind|svc.cardKitchens"]').click());
  await sleep(600);
  const a = await page.evaluate(() => ({
    activity: Array.from(document.querySelectorAll('.wb-activity-list li')).slice(0, 3).map((li) => li.textContent.trim()),
    h2: document.querySelector('aside[aria-label="Inspector"] h2')?.textContent.trim(),
  }));
  console.log('after JS click:', JSON.stringify(a));
  // 2) elementFromPoint at row center
  const cover = await page.evaluate(() => {
    const row = document.querySelector('nav[aria-label="Layers"] [data-key="doc.northwind|svc.cardKitchens"]');
    row.scrollIntoView({ block: 'center' });
    const r = row.getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, atPoint: el ? { tag: el.tagName, cls: el.className?.toString().slice(0, 60), txt: (el.textContent ?? '').slice(0, 30), isRow: el === row || row.contains(el) } : null };
  });
  console.log('cover:', JSON.stringify(cover));
} catch (e) {
  console.log('ERR', String(e));
} finally {
  await browser.close();
}
