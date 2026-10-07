// E1: Shared blue preserves the individual pink/attached override; instance pink affects only that card.
import { launch, freshPage, openWorkbench, shot, occStyle, layersSearch, layersClick, inspectorTab, setScope, setColor, valueDetails, inspectorHeader, railState, finish } from './helpers.mjs';

const CARD = {
  kitchens: 'doc.northwind|svc.card|svc.cardKitchens@def.serviceCard',
  bathrooms: 'doc.northwind|svc.card|svc.cardBathrooms@def.serviceCard',
  adaptations: 'doc.northwind|svc.card|svc.cardAdaptations@def.serviceCard',
};

const log = [];
const steps = {};
let exceptions = [];
const browser = await launch();
try {
  const { context, page } = await freshPage(browser);
  exceptions = page.__exceptions;
  await openWorkbench(page, { width: 1440, height: 900 });
  steps.initial = await shot(page, 'j1-01-initial-1440.png');

  const baseline = {};
  for (const [name, occ] of Object.entries(CARD)) baseline[name] = await occStyle(page, occ, 'background-color');
  steps.baselineBackgrounds = baseline;
  log.push(`baseline: K=${baseline.kitchens?.value} B=${baseline.bathrooms?.value} A=${baseline.adaptations?.value}`);

  // Select the Kitchens card (Service card instance) via Layers search.
  steps.searchKitchens = await layersSearch(page, 'Kitchens');
  await layersClick(page, CARD.kitchens);
  steps.headerKitchens = await inspectorHeader(page);
  await inspectorTab(page, 'Style');
  steps.backgroundDetailsBefore = await valueDetails(page, 'Background');
  steps.scopeBefore = await page.evaluate(() => document.querySelector('select[aria-label="Edits apply to"]')?.value ?? null);
  await shot(page, 'j1-02-kitchens-selected.png');

  // Shared scope (default): set Background to blue #1d4ed8.
  await setColor(page, 'Background', '#1d4ed8');
  const afterBlue = {};
  for (const [name, occ] of Object.entries(CARD)) afterBlue[name] = await occStyle(page, occ, 'background-color');
  steps.afterSharedBlue = afterBlue;
  steps.backgroundDetailsAfterBlue = await valueDetails(page, 'Background');
  await shot(page, 'j1-03-shared-blue.png');
  log.push(`after blue: K=${afterBlue.kitchens?.value} B=${afterBlue.bathrooms?.value} A=${afterBlue.adaptations?.value}`);

  // Select the Adaptations card, instance scope, set pink #ff69b4.
  steps.searchAdaptations = await layersSearch(page, 'Adaptations');
  await layersClick(page, CARD.adaptations);
  steps.headerAdaptations = await inspectorHeader(page);
  await setScope(page, 'instance');
  steps.scopeAfter = await page.evaluate(() => document.querySelector('select[aria-label="Edits apply to"]')?.value ?? null);
  steps.backgroundDetailsAdaptationsBefore = await valueDetails(page, 'Background');
  await setColor(page, 'Background', '#ff69b4');
  const afterPink = {};
  for (const [name, occ] of Object.entries(CARD)) afterPink[name] = await occStyle(page, occ, 'background-color');
  steps.afterInstancePink = afterPink;
  steps.backgroundDetailsAdaptationsAfter = await valueDetails(page, 'Background');
  steps.rail = await railState(page);
  steps.activityTail = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.wb-activity-list li')).slice(0, 6).map((li) => `${li.dataset.kind}: ${li.textContent.trim()}`),
  );
  await shot(page, 'j1-04-instance-pink.png');

  const blue = 'rgb(29, 78, 216)';
  const softGreen = 'rgb(231, 242, 236)';
  const pink = 'rgb(255, 105, 180)';
  steps.assert = {
    baselineAdaptationsSoftGreen: baseline.adaptations?.value === softGreen,
    sharedBlueReachedKitchens: afterBlue.kitchens?.value === blue,
    sharedBlueReachedBathrooms: afterBlue.bathrooms?.value === blue,
    attachedSoftGreenSurvivedOnAdaptations: afterBlue.adaptations?.value === softGreen,
    instancePinkOnAdaptations: afterPink.adaptations?.value === pink,
    kitchensUnaffectedByPink: afterPink.kitchens?.value === blue,
    bathroomsUnaffectedByPink: afterPink.bathrooms?.value === blue,
  };
  steps.verdict = Object.values(steps.assert).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  steps.error = String(e?.stack ?? e);
  steps.verdict = 'ERROR';
} finally {
  await browser.close();
}
finish('j1-shared-override.json', { journey: 'E1 shared blue vs attached/instance override', steps, log, exceptions });
