// E7: Corrupt store behind the app's back -> PRESERVED banner, bytes unchanged,
// Save refused (UI_STORE_CORRUPT in the activity log), banner stays visible.
import { launch, freshPage, openWorkbench, shot, layersSearch, layersClick, inspectorTab, commitInput, railButton, railState, activityLines, finish } from './helpers.mjs';

const HEADING = 'doc.northwind|svc.heroTitle';
const KEY = 'vict.u2.service.doc';

const steps = {};
let exceptions = [];
const browser = await launch();
try {
  const { context, page } = await freshPage(browser);
  exceptions = page.__exceptions;
  await openWorkbench(page, { width: 1440, height: 900 });

  // Establish a saved store: edit heading to 61px, save.
  await layersSearch(page, 'Page heading');
  await layersClick(page, HEADING);
  await inspectorTab(page, 'Style');
  await commitInput(page, 'Text size', '61');
  steps.saveClicked = await railButton(page, 'Save');
  steps.railAfterSave = await railState(page);
  steps.storedBefore = await page.evaluate((k) => window.localStorage.getItem(k), KEY);
  steps.storedBeforeLen = (steps.storedBefore ?? '').length;

  // Corrupt the stored bytes behind the app's back.
  const corrupt = '{"format":"vict.design-store@1","revision":"2","document":';
  await page.evaluate(({ k, v }) => window.localStorage.setItem(k, v), { k: KEY, v: corrupt });
  steps.corruptBytesWritten = corrupt;

  // Reload — the app must PRESERVE the bytes and show the warning banner.
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-ui-occ]', { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900));
  steps.bannerAfterReload = await page.evaluate(() => document.querySelector('.wb-toolbar span[role="alert"]')?.textContent.trim() ?? null);
  steps.storedAfterReload = await page.evaluate((k) => window.localStorage.getItem(k), KEY);
  steps.railAfterReload = await railState(page);
  steps.headingAfterReload = await page.evaluate((h) => {
    const el = document.querySelector(`[data-ui-occ='${h}']`);
    return el ? getComputedStyle(el).fontSize : null;
  }, HEADING);
  await shot(page, 'j7-01-preserved-banner.png');

  // Attempt Save — must be refused without touching the bytes.
  steps.saveAttempted = await railButton(page, 'Save');
  await new Promise((r) => setTimeout(r, 700));
  steps.activityAfterSave = await activityLines(page);
  steps.storedAfterSaveAttempt = await page.evaluate((k) => window.localStorage.getItem(k), KEY);
  steps.bannerAfterSaveAttempt = await page.evaluate(() => document.querySelector('.wb-toolbar span[role="alert"]')?.textContent.trim() ?? null);
  await shot(page, 'j7-02-save-refused.png');

  const bytesIdenticalAfterReload = steps.storedAfterReload === corrupt;
  const bytesIdenticalAfterSave = steps.storedAfterSaveAttempt === corrupt;
  const refusedLogged = (steps.activityAfterSave ?? []).some((l) => l.startsWith('error:') && l.includes('Save FAILED') && l.includes('UI_STORE_CORRUPT'));
  steps.assert = {
    saveSucceededFirst: steps.saveClicked === 'clicked' && (steps.railAfterSave?.spans ?? []).some((s) => s.startsWith('Saved')),
    bannerShowsPreserved: (steps.bannerAfterReload ?? '').includes('PRESERVED'),
    bytesUnchangedAfterReload: bytesIdenticalAfterReload,
    bytesUnchangedAfterSaveAttempt: bytesIdenticalAfterSave,
    saveRefusedAndLogged: steps.saveAttempted === 'clicked' && refusedLogged,
    bannerStillVisibleAfterRefusedSave: (steps.bannerAfterSaveAttempt ?? '').includes('PRESERVED'),
    editorFellBackToSeedContent: steps.headingAfterReload === '56px',
  };
  steps.verdict = Object.values(steps.assert).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  steps.error = String(e?.stack ?? e);
  steps.verdict = 'ERROR';
} finally {
  await browser.close();
}
finish('j7-storage-refusal.json', { journey: 'E7 corrupt store PRESERVED + refused save', steps, exceptions });
