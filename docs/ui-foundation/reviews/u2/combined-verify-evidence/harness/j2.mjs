// E2: Reset removes only the intended override, reveals the next applicable value; Undo restores in one step.
import { launch, freshPage, openWorkbench, shot, occStyle, layersSearch, layersClick, inspectorTab, setScope, setColor, valueDetails, resetControl, railButton, railState, activityLines, finish } from './helpers.mjs';

const CARD = {
  kitchens: 'doc.northwind|svc.card|svc.cardKitchens@def.serviceCard',
  bathrooms: 'doc.northwind|svc.card|svc.cardBathrooms@def.serviceCard',
  adaptations: 'doc.northwind|svc.card|svc.cardAdaptations@def.serviceCard',
};
const blue = 'rgb(29, 78, 216)';
const softGreen = 'rgb(231, 242, 236)';
const pink = 'rgb(255, 105, 180)';

const steps = {};
let exceptions = [];
const browser = await launch();
try {
  const { context, page } = await freshPage(browser);
  exceptions = page.__exceptions;
  await openWorkbench(page, { width: 1440, height: 900 });

  // Setup identical to E1: shared blue on Kitchens, instance pink on Adaptations.
  await layersSearch(page, 'Kitchens');
  await layersClick(page, CARD.kitchens);
  await inspectorTab(page, 'Style');
  await setColor(page, 'Background', '#1d4ed8');
  await layersSearch(page, 'Adaptations');
  await layersClick(page, CARD.adaptations);
  await setScope(page, 'instance');
  await setColor(page, 'Background', '#ff69b4');

  const before = {};
  for (const [n, occ] of Object.entries(CARD)) before[n] = await occStyle(page, occ, 'background-color');
  steps.beforeReset = before;
  steps.detailsBeforeReset = await valueDetails(page, 'Background');

  // Reset the pink instance background.
  await resetControl(page, 'Background');
  const afterReset = {};
  for (const [n, occ] of Object.entries(CARD)) afterReset[n] = await occStyle(page, occ, 'background-color');
  steps.afterReset = afterReset;
  steps.detailsAfterReset = await valueDetails(page, 'Background');
  steps.railAfterReset = await railState(page);
  await shot(page, 'j2-01-after-reset.png');

  // One Undo restores the pink.
  steps.undoClicked = await railButton(page, 'Undo');
  const afterUndo = {};
  for (const [n, occ] of Object.entries(CARD)) afterUndo[n] = await occStyle(page, occ, 'background-color');
  steps.afterOneUndo = afterUndo;
  steps.railAfterUndo = await railState(page);
  await shot(page, 'j2-02-after-undo.png');

  // Redo removes it again (transaction is redoable).
  steps.redoClicked = await railButton(page, 'Redo');
  const afterRedo = {};
  for (const [n, occ] of Object.entries(CARD)) afterRedo[n] = await occStyle(page, occ, 'background-color');
  steps.afterRedo = afterRedo;
  steps.activity = await activityLines(page);

  steps.assert = {
    setupPinkBefore: before.adaptations?.value === pink,
    setupBlueBefore: before.kitchens?.value === blue && before.bathrooms?.value === blue,
    resetRevealsAttachedSoftGreen: afterReset.adaptations?.value === softGreen,
    resetKeepsSharedBlueElsewhere: afterReset.kitchens?.value === blue && afterReset.bathrooms?.value === blue,
    oneUndoRestoresPink: afterUndo.adaptations?.value === pink,
    undoKeepsBlue: afterUndo.kitchens?.value === blue && afterUndo.bathrooms?.value === blue,
    redoRemovesPinkAgain: afterRedo.adaptations?.value === softGreen,
  };
  steps.verdict = Object.values(steps.assert).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  steps.error = String(e?.stack ?? e);
  steps.verdict = 'ERROR';
} finally {
  await browser.close();
}
finish('j2-reset-undo.json', { journey: 'E2 reset reveals next cascade value, one-step undo', steps, exceptions });
