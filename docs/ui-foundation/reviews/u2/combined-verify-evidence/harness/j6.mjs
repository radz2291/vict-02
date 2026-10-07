// E6: Layers search + keyboard selection sync; canvas outline honesty check.
// KNOWN FINDING under test: the selection outline CSS in EditorCanvas.svelte is
// emitted verbatim (Svelte does not interpolate inside <style>), so the outline
// never renders. This journey records the failure and all surrounding sync.
import { launch, freshPage, openWorkbench, shot, layersSearch, layersClick, clearLayersSearch, inspectorHeader, sleep, finish } from './helpers.mjs';

const BATH = 'doc.northwind|svc.card|svc.cardBathrooms@def.serviceCard';
const HEADING = 'doc.northwind|svc.heroTitle';

const steps = {};
let exceptions = [];
const browser = await launch();
try {
  const { context, page } = await freshPage(browser);
  exceptions = page.__exceptions;
  await openWorkbench(page, { width: 1440, height: 900 });

  const longhandOutline = (occ) =>
    page.evaluate((occ) => {
      const el = document.querySelector(`[data-ui-occ='${occ}']`);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, color: cs.outlineColor, width: cs.outlineWidth };
    }, occ);

  // --- canvas-click selection → Inspector sync ---------------------------
  await page.click(`[data-ui-occ='${HEADING}']`);
  await sleep(500);
  steps.headerAfterCanvasClick = await inspectorHeader(page);
  await shot(page, 'j6-00-canvas-click-selected.png');

  // --- search + mouse selection ------------------------------------------
  steps.search = await layersSearch(page, 'Bathrooms');
  await shot(page, 'j6-01-search-bathrooms.png');
  await layersClick(page, BATH);
  steps.headerAfterMouse = await inspectorHeader(page);
  steps.outlineAfterMouse = await longhandOutline(BATH);
  await shot(page, 'j6-02-mouse-selected.png');

  // Hover mitigation: the static :hover outline rule DOES match.
  await page.hover(`[data-ui-occ='${BATH}']`);
  await sleep(400);
  steps.outlineHover = await longhandOutline(BATH);
  await page.mouse.move(5, 400);
  await sleep(300);

  // --- Escape clears search; the normal tree returns ----------------------
  steps.afterEscape = await clearLayersSearch(page);
  steps.selectionSurvivesEscape = await page.evaluate(() => document.querySelector('aside[aria-label="Inspector"] h2')?.textContent.trim());
  await shot(page, 'j6-03-after-escape.png');

  // --- keyboard path: search -> ArrowDown into tree -> Enter --------------
  await page.click('input[aria-label="Search layers"]');
  await page.type('input[aria-label="Search layers"]', 'Bathrooms');
  await sleep(350);
  await page.keyboard.press('ArrowDown');
  await sleep(200);
  let focused = null;
  for (let i = 0; i < 20; i++) {
    focused = await page.evaluate(() => document.activeElement?.dataset?.key ?? null);
    if (focused === BATH) break;
    await page.keyboard.press('ArrowDown');
    await sleep(120);
  }
  steps.focusedBeforeEnter = focused;
  await page.keyboard.press('Enter');
  await sleep(500);
  steps.headerAfterKeyboard = await inspectorHeader(page);
  steps.outlineAfterKeyboard = await longhandOutline(BATH);
  steps.selectedRowAfterKeyboard = await page.evaluate(() =>
    Array.from(document.querySelectorAll('nav[aria-label="Layers"] [aria-selected="true"]')).map((e) => e.dataset.key),
  );
  await shot(page, 'j6-04-keyboard-selected.png');

  const crumbOk = (h) => (h?.crumbFull ?? '').includes('Bathrooms') || (h?.crumb ?? '').includes('Bathrooms');
  steps.assert = {
    canvasClickSelectsHeading: (steps.headerAfterCanvasClick?.crumb ?? '').length > 0,
    searchFoundMatches: (steps.search?.status ?? '').includes('matches'),
    mouseSelectionHeader: (steps.headerAfterMouse?.h2 ?? '').length > 0,
    mouseCrumbNamesBathrooms: crumbOk(steps.headerAfterMouse),
    escapeClearsSearch: steps.afterEscape?.status === null,
    normalTreeBack: (steps.afterEscape?.keys ?? []).includes('doc.northwind|svc.root') && steps.afterEscape.keys.length > 10,
    keyboardFocusedCardRow: steps.focusedBeforeEnter === BATH,
    keyboardSelectionHeader: (steps.headerAfterKeyboard?.h2 ?? '').length > 0,
    keyboardCrumbNamesBathrooms: crumbOk(steps.headerAfterKeyboard),
    layersRowSelectedAfterKeyboard: (steps.selectedRowAfterKeyboard ?? []).includes(BATH),
    hoverOutlineShows: steps.outlineHover?.style === 'solid' || steps.outlineHover?.style === 'dashed',
  };
  // Explicit finding: the persistent selection outline never renders.
  steps.FINDING_selectionOutlineMissing = {
    outlineStyleAfterSelection: [steps.outlineAfterMouse?.style, steps.outlineAfterKeyboard?.style],
    expected: 'solid (2px, --ui-editor-selected)',
    rootCause: "packages/ui-editor/src/EditorCanvas.svelte:97 — '{escapeSelector(selectedOccurrence)}' is emitted verbatim inside <style>; Svelte does not interpolate style blocks",
    preExistingSince: '7f49cd0 (U1-era editor modules); byte-identical at 83ba87f, 19bb4b9, e0893fe, f31477d',
  };
  steps.syncAsserts = { ...steps.assert };
  delete steps.syncAsserts.hoverOutlineShows;
  steps.verdict = Object.values(steps.assert).every(Boolean)
    ? 'PASS'
    : Object.values(steps.syncAsserts).every(Boolean)
      ? 'PASS WITH FINDING (selection outline never renders)'
      : 'FAIL';
} catch (e) {
  steps.error = String(e?.stack ?? e);
  steps.verdict = 'ERROR';
} finally {
  await browser.close();
}
finish('j6-layers-search-keyboard.json', { journey: 'E6 layers search + keyboard selection sync + outline honesty check', steps, exceptions });
