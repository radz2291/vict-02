import { launch, freshPage, openWorkbench, layersSearch, layersClick, sleep } from './helpers.mjs';
const BATH = 'doc.northwind|svc.card|svc.cardBathrooms@def.serviceCard';
const browser = await launch();
const { context, page } = await freshPage(browser);
try {
  await openWorkbench(page);
  await layersSearch(page, 'Bathrooms');
  await layersClick(page, BATH);
  await sleep(500);
  const info = await page.evaluate((BATH) => {
    const canvas = document.querySelector('.uv-canvas');
    const styles = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).filter((t) => t && t.includes('data-ui-occ'));
    const el = document.querySelector(`[data-ui-occ='${BATH}']`);
    const cs = el ? getComputedStyle(el) : null;
    return {
      canvasClass: canvas?.className,
      styleSnippets: styles.map((t) => t.slice(0, 400)),
      longhand: cs ? { style: cs.outlineStyle, color: cs.outlineColor, width: cs.outlineWidth, offset: cs.outlineOffset } : null,
      elFound: !!el,
    };
  }, BATH);
  console.log(JSON.stringify(info, null, 1));
} catch (e) {
  console.log('ERR', String(e));
} finally {
  await browser.close();
}
