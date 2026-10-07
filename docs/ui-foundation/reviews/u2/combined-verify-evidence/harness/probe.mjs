import { launch, freshPage, openWorkbench } from './helpers.mjs';
const browser = await launch();
const { context, page } = await freshPage(browser);
try {
  await openWorkbench(page);
  const occs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-ui-occ]'))
      .filter((el) => el.dataset.uiOcc.includes('card') || el.dataset.uiOcc.includes('hero'))
      .map((el) => ({ occ: el.dataset.uiOcc, tag: el.tagName, cls: el.className.slice(0, 40), bg: getComputedStyle(el).backgroundColor }));
  });
  console.log(JSON.stringify(occs, null, 1));
} finally {
  await browser.close();
}
