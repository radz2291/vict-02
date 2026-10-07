// E3: Hero heading Text size 61px — undo shows previous value, redo restores; save/reload/reopen preserve.
import { launch, freshPage, openWorkbench, shot, occStyle, layersSearch, layersClick, inspectorTab, valueDetails, controlInput, commitInput, railButton, railState, activityLines, finish } from './helpers.mjs';

const HEADING = 'doc.northwind|svc.heroTitle';

const steps = {};
let exceptions = [];
const browser = await launch();
try {
  const { context, page } = await freshPage(browser);
  exceptions = page.__exceptions;
  await openWorkbench(page, { width: 1440, height: 900 });

  // Select the hero heading via Layers.
  steps.search = await layersSearch(page, 'Page heading');
  await layersClick(page, HEADING);
  await inspectorTab(page, 'Style');
  steps.controlBefore = await controlInput(page, 'Text size');
  steps.detailsBefore = await valueDetails(page, 'Text size');
  steps.computedBefore = await occStyle(page, HEADING, 'font-size');
  await shot(page, 'j3-01-heading-selected.png');

  // Edit Text size to 61 (textual path commits unitless numbers with px).
  steps.editorUsed = await commitInput(page, 'Text size', '61');
  steps.controlAfterEdit = await controlInput(page, 'Text size');
  steps.detailsAfterEdit = await valueDetails(page, 'Text size');
  steps.computedAfterEdit = await occStyle(page, HEADING, 'font-size');
  await shot(page, 'j3-02-edited-61.png');

  // Undo shows the previous value; Redo restores 61.
  steps.undoClicked = await railButton(page, 'Undo');
  steps.detailsAfterUndo = await valueDetails(page, 'Text size');
  steps.controlAfterUndo = await controlInput(page, 'Text size');
  steps.computedAfterUndo = await occStyle(page, HEADING, 'font-size');
  await shot(page, 'j3-03-after-undo.png');
  steps.redoClicked = await railButton(page, 'Redo');
  steps.computedAfterRedo = await occStyle(page, HEADING, 'font-size');
  steps.detailsAfterRedo = await valueDetails(page, 'Text size');

  // Save, full reload, then Reload stored.
  steps.saveClicked = await railButton(page, 'Save');
  steps.railAfterSave = await railState(page);
  steps.activityAfterSave = await activityLines(page);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-ui-occ]', { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));
  steps.computedAfterReload = await occStyle(page, HEADING, 'font-size');
  await layersSearch(page, 'Page heading');
  await layersClick(page, HEADING);
  await inspectorTab(page, 'Style');
  steps.controlAfterReload = await controlInput(page, 'Text size');
  steps.detailsAfterReload = await valueDetails(page, 'Text size');

  steps.reloadStoredClicked = await railButton(page, 'Reload stored');
  await new Promise((r) => setTimeout(r, 600));
  steps.computedAfterReopen = await occStyle(page, HEADING, 'font-size');
  // Reload stored clears the selection by design; re-select and read the annotation.
  await layersSearch(page, 'Page heading');
  await layersClick(page, HEADING);
  await inspectorTab(page, 'Style');
  steps.detailsAfterReopen = await valueDetails(page, 'Text size');
  steps.controlAfterReopen = await controlInput(page, 'Text size');
  steps.railAfterReopen = await railState(page);
  await shot(page, 'j3-04-after-reload-reopen.png');

  steps.assert = {
    baselineComputedIs56: steps.computedBefore?.value === '56px',
    baselineAnnotation56: (steps.detailsBefore ?? []).some((t) => t.startsWith('Browser now: 56px')),
    editorWasTextual: steps.controlBefore?.kind === 'text',
    editComputed61: steps.computedAfterEdit?.value === '61px',
    editAnnotation61: (steps.detailsAfterEdit ?? []).some((t) => t.startsWith('Browser now: 61px')),
    undoComputedBack: steps.computedAfterUndo?.value === '56px',
    undoAnnotationBack: (steps.detailsAfterUndo ?? []).some((t) => t.startsWith('Browser now: 56px')),
    redoComputed61: steps.computedAfterRedo?.value === '61px',
    savedStateClean: (steps.railAfterSave?.spans ?? []).some((s) => s.startsWith('Saved')),
    reloadPreserves61: steps.computedAfterReload?.value === '61px',
    reopenPreserves61: steps.computedAfterReopen?.value === '61px',
    reopenAnnotation61: (steps.detailsAfterReopen ?? []).some((t) => t.startsWith('Browser now: 61px')),
  };
  steps.verdict = Object.values(steps.assert).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  steps.error = String(e?.stack ?? e);
  steps.verdict = 'ERROR';
} finally {
  await browser.close();
}
finish('j3-undo-redo-persist.json', { journey: 'E3 heading 61px undo/redo/save/reload/reopen', steps, exceptions });
