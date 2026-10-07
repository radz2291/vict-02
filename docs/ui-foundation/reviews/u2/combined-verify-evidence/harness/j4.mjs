// E4: Inspector 'Browser now' matches actual getComputedStyle at 1440 window, 1024x800 window,
// 390 preview (container), and through a native hover live state; measuring must not dirty source/history.
import { launch, freshPage, openWorkbench, shot, occStyle, layersSearch, layersClick, inspectorTab, valueDetails, railButton, railState, activityLines, finish } from './helpers.mjs';

const HEADING = 'doc.northwind|svc.heroTitle';
const KITCHENS = 'doc.northwind|svc.card|svc.cardKitchens@def.serviceCard';

const steps = {};
let exceptions = [];
const browser = await launch();
try {
  const { context, page } = await freshPage(browser);
  exceptions = page.__exceptions;
  await openWorkbench(page, { width: 1440, height: 900 });
  steps.railBefore = await railState(page);
  steps.activityBefore = await activityLines(page);

  // --- heading samples ---------------------------------------------------
  await layersSearch(page, 'Page heading');
  await layersClick(page, HEADING);
  await inspectorTab(page, 'Style');
  steps.detailsA1440 = await valueDetails(page, 'Text size');
  steps.computedA1440 = await occStyle(page, HEADING, 'font-size');
  await shot(page, 'j4-01-1440.png');

  await page.setViewport({ width: 1024, height: 800 });
  await new Promise((r) => setTimeout(r, 900));
  steps.detailsB1024 = await valueDetails(page, 'Text size');
  steps.computedB1024 = await occStyle(page, HEADING, 'font-size');
  await shot(page, 'j4-02-1024x800.png');

  await page.select('.wb-toolbar select', '390');
  await new Promise((r) => setTimeout(r, 1000));
  steps.detailsC390container = await valueDetails(page, 'Text size');
  steps.computedC390container = await occStyle(page, HEADING, 'font-size');
  steps.frameWidth390 = await page.evaluate(() => document.querySelector('.wb-canvas-frame')?.getBoundingClientRect().width);
  await shot(page, 'j4-03-preview390.png');

  // Back to full width before the hover sample.
  await page.select('.wb-toolbar select', 'full');
  await new Promise((r) => setTimeout(r, 900));

  // Media-driven freshness probe: at window width <= 700px the cond.narrow
  // rule (src.hero-title-narrow, 30px) must take over — annotation must follow.
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 1000));
  steps.detailsD390window = await valueDetails(page, 'Text size');
  steps.computedD390window = await occStyle(page, HEADING, 'font-size');
  await shot(page, 'j4-05-window390.png');
  await page.setViewport({ width: 1024, height: 800 });
  await new Promise((r) => setTimeout(r, 900));

  // --- native hover live state on the Kitchens card ----------------------
  await layersSearch(page, 'Kitchens');
  await layersClick(page, KITCHENS);
  await inspectorTab(page, 'Style');
  steps.borderDetailsNormal = await valueDetails(page, 'Border color');
  steps.borderComputedNormal = await occStyle(page, KITCHENS, 'border-color');

  await page.hover(`[data-ui-occ='${KITCHENS}']`);
  await new Promise((r) => setTimeout(r, 900));
  steps.borderDetailsHover = await valueDetails(page, 'Border color');
  steps.borderComputedHover = await occStyle(page, KITCHENS, 'border-color');
  await shot(page, 'j4-04-card-hover.png');

  await page.mouse.move(5, 400);
  await new Promise((r) => setTimeout(r, 900));
  steps.borderDetailsLeave = await valueDetails(page, 'Border color');
  steps.borderComputedLeave = await occStyle(page, KITCHENS, 'border-color');

  // --- measuring must not dirty source/history ----------------------------
  steps.railAfter = await railState(page);
  steps.activityAfter = await activityLines(page);

  const annotationOf = (details) => (details ?? []).find((t) => t.startsWith('Browser now:')) ?? null;
  const val = (s) => (s ? s.replace('Browser now: ', '').trim() : null);
  steps.samples = [
    { state: 'window 1440x900', annotation: val(annotationOf(steps.detailsA1440)), actual: steps.computedA1440?.value },
    { state: 'window 1024x800', annotation: val(annotationOf(steps.detailsB1024)), actual: steps.computedB1024?.value },
    { state: 'preview 390 (container)', annotation: val(annotationOf(steps.detailsC390container)), actual: steps.computedC390container?.value },
    { state: 'window 390x844 (media narrow)', annotation: val(annotationOf(steps.detailsD390window)), actual: steps.computedD390window?.value },
    { state: 'card normal', annotation: val(annotationOf(steps.borderDetailsNormal)), actual: steps.borderComputedNormal?.value },
    { state: 'card hover', annotation: val(annotationOf(steps.borderDetailsHover)), actual: steps.borderComputedHover?.value },
    { state: 'card leave', annotation: val(annotationOf(steps.borderDetailsLeave)), actual: steps.borderComputedLeave?.value },
  ];
  for (const s of steps.samples) s.agree = s.annotation !== null && s.annotation === s.actual;

  const applied = (lines) => lines.filter((l) => l.startsWith('info: ') && l.includes('Applied')).length;
  steps.assert = {
    allSamplesAgree: steps.samples.every((s) => s.agree),
    railUnchangedByMeasuring: JSON.stringify(steps.railBefore) === JSON.stringify(steps.railAfter),
    noAppliedCommands: applied(steps.activityAfter) - applied(steps.activityBefore) === 0,
  };
  steps.verdict = Object.values(steps.assert).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  steps.error = String(e?.stack ?? e);
  steps.verdict = 'ERROR';
} finally {
  await browser.close();
}
finish('j4-browser-values.json', { journey: 'E4 browser-now vs actual across states', steps, exceptions });
