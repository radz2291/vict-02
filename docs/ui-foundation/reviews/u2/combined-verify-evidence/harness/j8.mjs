// E8: Usable editing at 1440x900 / 1024x768 / 390x844 / 480-container; /editor-review route still works.
import { launch, freshPage, openWorkbench, openEditorReview, shot, occStyle, layersSearch, layersClick, inspectorTab, valueDetails, controlInput, commitInput, railButton, finish } from './helpers.mjs';

const HEADING = 'doc.northwind|svc.heroTitle';
const FX_HEADING = 'doc.fixture|title';

const steps = {};
let exceptions = [];
const browser = await launch();
try {
  const { context, page } = await freshPage(browser);
  exceptions = page.__exceptions;

  const selectHeading = async () => {
    await layersSearch(page, 'Page heading');
    await layersClick(page, HEADING);
    await inspectorTab(page, 'Style');
  };
  const overflow = () =>
    page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      railVisible: !!document.querySelector('.wb-rail button[type="button"]'),
      inspectorVisible: !!document.querySelector('aside[aria-label="Inspector"]'),
    }));
  const textSizeRect = () =>
    page.evaluate(() => {
      const el = document.querySelector('aside[aria-label="Inspector"] input[aria-label="Text size"]');
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, inViewport: r.x >= 0 && r.y >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight };
    });

  // --- 1440x900 -----------------------------------------------------------
  await openWorkbench(page, { width: 1440, height: 900 });
  await selectHeading();
  steps.rect1440 = await textSizeRect();
  steps.ov1440 = await overflow();
  steps.edit1440 = await commitInput(page, 'Text size', '62');
  steps.computed1440 = await occStyle(page, HEADING, 'font-size');
  steps.details1440 = await valueDetails(page, 'Text size');
  await shot(page, 'j8-01-1440x900.png');
  await railButton(page, 'Undo');

  // --- 1024x768 -----------------------------------------------------------
  await page.setViewport({ width: 1024, height: 768 });
  await new Promise((r) => setTimeout(r, 800));
  steps.rect1024 = await textSizeRect();
  steps.ov1024 = await overflow();
  steps.edit1024 = await commitInput(page, 'Text size', '63');
  steps.computed1024 = await occStyle(page, HEADING, 'font-size');
  steps.details1024 = await valueDetails(page, 'Text size');
  await shot(page, 'j8-02-1024x768.png');
  await railButton(page, 'Undo');

  // --- 390x844 ------------------------------------------------------------
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 300));
  steps.ov390 = await overflow();
  steps.rect390BeforeScroll = await page.evaluate(() => {
    const el = document.querySelector('aside[aria-label="Inspector"] input[aria-label="Text size"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, inViewport: r.x >= 0 && r.y >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight };
  });
  steps.rect390 = await textSizeRect();
  await shot(page, 'j8-03-390x844-first-screen.png');
  steps.edit390 = await commitInput(page, 'Text size', '64');
  steps.controlAfterEdit390 = await controlInput(page, 'Text size');
  steps.computed390 = await occStyle(page, HEADING, 'font-size');
  steps.details390 = await valueDetails(page, 'Text size');
  await shot(page, 'j8-04-390-edited.png');
  await railButton(page, 'Undo');

  // --- 480 container preview (window back to 1440x900) ---------------------
  await page.setViewport({ width: 1440, height: 900 });
  await new Promise((r) => setTimeout(r, 700));
  await page.select('.wb-toolbar select', '480');
  await new Promise((r) => setTimeout(r, 1000));
  steps.frame480Width = await page.evaluate(() => document.querySelector('.wb-canvas-frame')?.getBoundingClientRect().width);
  steps.ov480 = await overflow();
  steps.rect480 = await textSizeRect();
  steps.details480 = await valueDetails(page, 'Text size');
  steps.computed480 = await occStyle(page, HEADING, 'font-size');
  steps.edit480 = await commitInput(page, 'Text size', '65');
  steps.computed480After = await occStyle(page, HEADING, 'font-size');
  steps.details480After = await valueDetails(page, 'Text size');
  await shot(page, 'j8-05-container480.png');
  await railButton(page, 'Undo');

  // --- /editor-review supporting route -------------------------------------
  const review = await freshPage(browser);
  exceptions.push(...review.page.__exceptions);
  await openEditorReview(review.page, { width: 1440, height: 900 });
  await review.page.click('.uv-canvas h1');
  await new Promise((r) => setTimeout(r, 500));
  await review.page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('nav[aria-label="Inspector sections"] button'));
    const t = tabs.find((b) => b.textContent.trim() === 'Style');
    if (t) t.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  steps.reviewHeader = await review.page.evaluate(() => ({
    h2: document.querySelector('aside[aria-label="Inspector"] h2')?.textContent.trim(),
    crumb: document.querySelector('aside[aria-label="Inspector"] details.breadcrumb summary')?.textContent.trim(),
    textSizeInput: !!document.querySelector('aside[aria-label="Inspector"] input[aria-label="Text size"]'),
    layersPresent: !!document.querySelector('nav[aria-label="Layers"]'),
  }));
  await review.page.screenshot({ path: 'C:/Users/RZ1/Desktop/RZ/vict-02-u2-combined-verify/combined-verify-evidence/shots/j8-06-editor-review.png' });
  await review.context.close();

  const ann = (d) => (d ?? []).find((t) => t.startsWith('Browser now:'))?.replace('Browser now: ', '').trim() ?? null;
  steps.assert = {
    edit1440Works: steps.computed1440?.value === '62px' && ann(steps.details1440) === '62px',
    edit1024Works: steps.computed1024?.value === '63px' && ann(steps.details1024) === '63px',
    // At 390 the cond.narrow rule (30px) wins over the committed local override —
    // usable editing means: the edit commits locally AND annotation == actual.
    edit390Commits: steps.controlAfterEdit390?.value === '64',
    edit390AnnotationMatchesActual: ann(steps.details390) === steps.computed390?.value && steps.computed390?.value === '30px',
    edit480ContainerWorks: steps.computed480After?.value === '65px' && ann(steps.details480After) === '65px',
    noHorizontalOverflow390: steps.ov390?.scrollWidth <= steps.ov390?.innerWidth,
    noHorizontalOverflow1440: steps.ov1440?.scrollWidth <= steps.ov1440?.innerWidth,
    textSizeVisibleFirstScreen390: steps.rect390BeforeScroll?.inViewport === true,
    panelsReachableAllSizes: [steps.ov1440, steps.ov1024, steps.ov390, steps.ov480].every((o) => o?.railVisible && o?.inspectorVisible),
    editorReviewLoads: !!steps.reviewHeader?.h2 && steps.reviewHeader?.textSizeInput && steps.reviewHeader?.layersPresent,
  };
  steps.verdict = Object.values(steps.assert).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  steps.error = String(e?.stack ?? e);
  steps.verdict = 'ERROR';
} finally {
  await browser.close();
}
finish('j8-responsive-editor-review.json', { journey: 'E8 responsive editing + editor-review route', steps, exceptions });
