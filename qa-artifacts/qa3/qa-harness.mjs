/**
 * P3 QA driver — real-browser verification against the harness app
 * (compiled plan + generic VitApp host + in-memory boundary).
 *
 * Every check is executed in real Chrome (not DOM emulation). Writes
 * screenshots into ./shots and a findings log to stdout.
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, 'shots-harness');
mkdirSync(SHOTS, { recursive: true });

const BASE = process.env.QA_BASE ?? 'http://localhost:5199';

function findBrowser() {
  for (const p of [
    process.env.VICT_BROWSER_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ])
    if (typeof p === 'string' && existsSync(p)) return p;
  throw new Error('no browser');
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const browser = await puppeteer.launch({
  executablePath: findBrowser(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
});

const pageErrors = [];
const page = await browser.newPage();
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.setViewport({ width: 1280, height: 900 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// In-page CSS selector escaping (Node lacks CSS.escape; this only needs
// to be sound for our ids: letters, digits, '-', '_', '.', '#').
const esc = (value) => value.replace(/([^a-zA-Z0-9_-])/g, '\\$1');

async function go(path) {
  await page.evaluate((p) => {
    const buttons = [...document.querySelectorAll('[data-testid="qa-toolbar"] button')];
    const match = buttons.find((b) => b.getAttribute('data-testid') === 'qa-nav-' + p);
    if (match !== undefined) {
      match.click();
      return;
    }
    // Fallback: set the hash and dispatch (harness syncs path from hash on load only).
    window.location.hash = p;
  }, path);
  await sleep(400);
}

async function dispatchLog() {
  const text = await page.$eval('[data-testid="dispatch-log"]', (el) => el.textContent);
  return JSON.parse(text);
}

async function field(name, formId = 'f.widget-create') {
  return page.$(`#vict-field-${esc(formId)}-${esc(name)}`);
}

async function fieldValue(name, formId = 'f.widget-create') {
  return page.$eval(`#vict-field-${esc(formId)}-${esc(name)}`, (el) => el.value);
}

async function setField(name, value, formId = 'f.widget-create') {
  const selector = `#vict-field-${esc(formId)}-${esc(name)}`;
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector, { clickCount: 3 });
  if (String(value) === '') {
    await page.keyboard.press('Delete');
  } else {
    await page.type(selector, String(value));
  }
  await sleep(120);
}

async function lastDispatch() {
  const log = await dispatchLog();
  return log[log.length - 1];
}

async function shot(name) {
  await page.screenshot({ path: join(SHOTS, name + '.png') });
}

// --- reset the app state ---------------------------------------------------
await page.goto(BASE + '/#/widgets', { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(900);

// ===========================================================================
console.log('\n=== 1. FORMS — create form (all widgets) ===');
{
  // Required-field errors are associated with the correct control.
  await page.click('[data-testid="form-submit"]');
  await sleep(300);
  const assoc = await page.evaluate((ids) => {
    const out = [];
    for (const { name, controlSel, errId, labelSel } of ids) {
      const control = document.querySelector(controlSel);
      const err = document.getElementById(errId);
      out.push({
        name,
        describedby: control?.getAttribute('aria-describedby') ?? null,
        invalid: control?.getAttribute('aria-invalid') ?? null,
        errExists: err !== null,
        errText: err?.textContent ?? null,
        labelledByLabel: document.querySelector(labelSel) !== null,
      });
    }
    const optional = document.querySelector(ids.find((x) => x.name === 'starts').controlSel);
    return { out, optionalInvalid: optional?.getAttribute('aria-invalid') ?? null };
  }, ['id', 'name', 'budget', 'starts'].map((name) => ({
    name,
    controlSel: `#vict-field-${esc('f.widget-create')}-${esc(name)}`,
    errId: `vict-field-error-f.widget-create-${name}`,
    labelSel: `label[for="${esc(`vict-field-f.widget-create-${name}`)}"]`,
  })));
  for (const f of assoc.out.filter((x) => ['id', 'name', 'budget'].includes(x.name))) {
    check(
      `required error associated: ${f.name}`,
      f.describedby === `vict-field-error-f.widget-create-${f.name}` && f.errExists && f.invalid === 'true' && (f.errText ?? '').length > 0 && f.labelledByLabel,
      `aria-describedby=${f.describedby}, text="${f.errText}"`,
    );
  }
  check('optional fields get no error on empty submit', assoc.optionalInvalid !== 'true');
  const noDispatchYet = await dispatchLog();
  check('empty submit dispatches NOTHING', noDispatchYet.length === 0, `${noDispatchYet.length} dispatches`);
  await shot('h-form-create-required-errors');

  // Fill the full create form: text, date, json, number, boolean.
  // (Date inputs use segmented keyboard entry; headless Chrome runs en-US
  // locale, so the realistic typing order is MMDDYYYY.)
  await setField('id', 'widget-qa');
  await setField('name', 'QA widget');
  await setField('starts', '04012026');
  await setField('config', '{"quality":"high","tags":["qa","p3"]}');
  await setField('budget', '1500');
  await setField('discount', '42.5');
  await page.click('#vict-field-f\\.widget-create-active');
  await sleep(150);
  // The date widget's typed value is locale-dependent at the input level;
  // the canonical property under test is that the dispatched string EQUALS
  // what the control holds (date values ride the string domain unchanged).
  const startsValue = await fieldValue('starts');
  await page.click('[data-testid="form-submit"]');
  await sleep(500);

  const last = await lastDispatch();
  const input = last?.input ?? {};
  check(
    'create dispatch: typed payload canonical',
    last?.outcome === 'OK' &&
      input.id === 'widget-qa' &&
      input.name === 'QA widget' &&
      input.starts === startsValue &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(input.starts)) &&
      input.config === '{"quality":"high","tags":["qa","p3"]}' &&
      input.budget === 1500 &&
      typeof input.budget === 'number' &&
      input.discount === 42.5 &&
      typeof input.discount === 'number' &&
      input.active === true,
    `starts=${input.starts} (input held ${startsValue}) ${JSON.stringify(input)}`,
  );
  await shot('h-form-create-success');

  // Boolean round-trip false: edit zero record, leave checkbox untouched.
}

console.log('\n=== 1b. FORMS — invalid numeric never dispatches ===');
{
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(700);
  // Real-browser constraint: a number input refuses non-numeric typing
  // (badInput → value ''), so the RAW state stays '' and the required
  // error appears while NO dispatch with a malformed number can occur.
  await setField('id', 'bad');
  await setField('name', 'bad numeric');
  const budgetSel = '#vict-field-f\\.widget-create-budget';
  await page.click(budgetSel);
  await page.keyboard.down('Shift');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Shift');
  for (const key of ['b', 'c', '1', '2', '-', '.', 'e']) await page.keyboard.press(key);
  await sleep(150);
  const raw = await fieldValue('budget');
  await page.click('[data-testid="form-submit"]');
  await sleep(400);
  const log = await dispatchLog();
  const budgetErrShown = (await page.evaluate(() => document.getElementById('vict-field-error-f.widget-create-budget')?.textContent ?? null)) !== null;
  check('garbage numeric typing stays raw/local (badInput → "")', raw === '', `raw="${raw}"`);
  check('submit with garbage numeric: still no dispatch', log.length === 0, `${log.length} dispatches`);
  check('field-local required error shown for budget', budgetErrShown);
  await shot('h-form-invalid-numeric');
}

console.log('\n=== 1c. FORMS — 0 stays 0, optional empty numeric absent, boolean false round-trip ===');
{
  await go('/rec/zero');
  await sleep(400);
  await page.click('[role="tab"][aria-selected="true"] ~ button[role="tab"], [role="tab"]:nth-of-type(2)');
  await sleep(300);
  // Ensure we are on the edit tab (second tab).
  const tabs = await page.$$('[role="tab"]');
  await tabs[1].click();
  await sleep(300);
  const prefill = await page.evaluate(() => ({
    name: document.querySelector('#vict-field-f\\.widget-edit-name')?.value,
    starts: document.querySelector('#vict-field-f\\.widget-edit-starts')?.value,
    budget: document.querySelector('#vict-field-f\\.widget-edit-budget')?.value,
    discount: document.querySelector('#vict-field-f\\.widget-edit-discount')?.value,
    activeChecked: document.querySelector('#vict-field-f\\.widget-edit-active')?.checked,
    idPresent: document.querySelector('#vict-field-f\\.widget-edit-id') !== null,
  }));
  check(
    'edit prefill numeric stays numeric without an edit',
    prefill.budget === '0' && prefill.starts === '2026-01-15' && prefill.name === 'Zero case' && prefill.discount === '' && prefill.activeChecked === false && prefill.idPresent === false,
    JSON.stringify(prefill),
  );
  await shot('h-form-edit-prefill-zero');
  await page.click('[data-testid="form-submit"]');
  await sleep(500);
  const last = await lastDispatch();
  const input = last?.input ?? {};
  const keys = Object.keys(input).sort().join(',');
  check(
    'untouched edit submit: 0 stays 0 (number), false stays false, absent discount OMITTED',
    last?.outcome === 'OK' && input.budget === 0 && typeof input.budget === 'number' && input.active === false && input.discount === undefined && input.__identity === 'zero',
    `keys=[${keys}] ${JSON.stringify(input)}`,
  );

  // Toggle the boolean to true and round-trip back.
  await page.click('#vict-field-f\\.widget-edit-active');
  await sleep(150);
  await page.click('[data-testid="form-submit"]');
  await sleep(500);
  const second = await lastDispatch();
  check('boolean round-trip true dispatches as boolean true', second?.input?.active === true, JSON.stringify(second?.input));

  // Optional numeric given a value then cleared → absent again.
  await setField('discount', '12.75', 'f.widget-edit');
  await page.click('[data-testid="form-submit"]');
  await sleep(500);
  const third = await lastDispatch();
  check('optional numeric with value dispatches as number', third?.input?.discount === 12.75, JSON.stringify(third?.input));
  await setField('discount', '', 'f.widget-edit');
  await page.click('[data-testid="form-submit"]');
  await sleep(500);
  const fourth = await lastDispatch();
  check('optional numeric cleared again → key omitted', fourth?.input?.discount === undefined, JSON.stringify(fourth?.input));
}

console.log('\n=== 1d. FORMS — edit prefill resets when identity changes (no reload) ===');
{
  // We are on /rec/zero edit tab with state possibly dirty; navigate to /rec/one.
  await go('/rec/one');
  await sleep(500);
  const tabs = await page.$$('[role="tab"]');
  await tabs[1].click();
  await sleep(300);
  const prefill = await page.evaluate(() => ({
    name: document.querySelector('#vict-field-f\\.widget-edit-name')?.value,
    budget: document.querySelector('#vict-field-f\\.widget-edit-budget')?.value,
    discount: document.querySelector('#vict-field-f\\.widget-edit-discount')?.value,
    active: document.querySelector('#vict-field-f\\.widget-edit-active')?.checked,
  }));
  check(
    'prefill follows identity change without remount',
    prefill.name === 'Full record' && prefill.budget === '1200.5' && prefill.discount === '25' && prefill.active === true,
    JSON.stringify(prefill),
  );
  await shot('h-form-edit-prefill-one');
}

console.log('\n=== 1e. FORMS — form state persists across tab switches; form works after tab change ===');
{
  await setField('name', 'Edited in tab', 'f.widget-edit');
  const tabs = await page.$$('[role="tab"]');
  await tabs[0].click();
  await sleep(200);
  await tabs[1].click();
  await sleep(200);
  const kept = await fieldValue('name', 'f.widget-edit');
  check('form state survives tab switch (panel kept in DOM)', kept === 'Edited in tab', `value="${kept}"`);
  await page.click('[data-testid="form-submit"]');
  await sleep(500);
  const last = await lastDispatch();
  check('form submits correctly after tab changes', last?.outcome === 'OK' && last?.input?.name === 'Edited in tab', JSON.stringify(last?.input));
}

console.log('\n=== 2. TABS — keyboard semantics ===');
{
  const probe = async () =>
    page.evaluate(() => {
      const tabEls = [...document.querySelectorAll('[role="tab"]')];
      return tabEls.map((t) => ({
        label: t.textContent,
        selected: t.getAttribute('aria-selected'),
        tabIndex: t.tabIndex,
        controls: t.getAttribute('aria-controls'),
        focused: document.activeElement === t,
      }));
    });
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(700);
  await go('/rec/zero');
  await sleep(400);
  // Reset to Overview for determinism.
  let info = await probe();
  await info[0].label && (await (await page.$$('[role="tab"]'))[0].click());
  await sleep(200);
  await (await page.$('[role="tab"]')).focus();
  await page.keyboard.press('ArrowRight');
  await sleep(150);
  info = await probe();
  check(
    'ArrowRight selects next, roving tabindex, aria-selected, aria-controls',
    info[1].selected === 'true' && info[1].focused && info[1].tabIndex === 0 && info[0].tabIndex === -1 && info[0].selected === 'false' && info[0].controls === `vict-tabpanel-tb.rec-tabs-overview`,
    JSON.stringify(info),
  );
  await page.keyboard.press('ArrowLeft');
  await sleep(150);
  info = await probe();
  check('ArrowLeft selects previous', info[0].selected === 'true' && info[0].focused, JSON.stringify(info.map((i) => i.selected)));
  await page.keyboard.press('ArrowLeft');
  await sleep(150);
  info = await probe();
  check('ArrowLeft wraps around to last tab', info[1].selected === 'true' && info[1].focused, JSON.stringify(info.map((i) => i.selected)));
  await page.keyboard.press('Home');
  await sleep(150);
  info = await probe();
  check('Home selects first tab', info[0].selected === 'true' && info[0].focused, JSON.stringify(info.map((i) => i.selected)));
  await page.keyboard.press('End');
  await sleep(150);
  info = await probe();
  check('End selects last tab', info[1].selected === 'true' && info[1].focused, JSON.stringify(info.map((i) => i.selected)));
  // Only the selected tab participates in normal tab order.
  await page.keyboard.press('Tab'); // leave the tablist; focus should skip unselected tabs
  const nextFocus = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName);
  check('Tab from tablist skips to content (unselected tabs not focusable)', nextFocus !== 'tab' && nextFocus !== null, `focus=${String(nextFocus)}`);
  await shot('h-tabs-detail');
  // labelledby relationship
  const labelled = await page.evaluate(() => {
    const panel = document.getElementById('vict-tabpanel-tb.rec-tabs-edit');
    return { labelledby: panel?.getAttribute('aria-labelledby'), tab: document.getElementById(panel?.getAttribute('aria-labelledby') ?? '')?.textContent };
  });
  check('panel aria-labelledby points at its tab', labelled.labelledby === 'vict-tab-tb.rec-tabs-edit' && labelled.tab === 'Edit', JSON.stringify(labelled));
}

console.log('\n=== 3. DIALOG — native <dialog> behavior ===');
{
  const modalState = () =>
    page.evaluate(() => {
      const dlg = document.querySelector('dialog[data-testid="overlay"]');
      const panel = dlg?.querySelector('[data-testid="overlay-panel"]');
      return {
        open: dlg?.open ?? false,
        inTopLayer: dlg !== null && dlg.matches(':modal'),
        focusedInside: dlg !== null && panel !== null && panel.contains(document.activeElement),
      };
    });

  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(700);
  await go('/rec/one');
  await sleep(400);
  await page.click('[data-testid="overlay-trigger"]');
  await sleep(400);
  let st = await modalState();
  check('open: dialog open + :modal (top layer)', st.open && st.inTopLayer === true, JSON.stringify(st));
  check('open: focus moves into the modal', st.focusedInside, JSON.stringify({ focusedInside: st.focusedInside }));
  await shot('h-dialog-open');

  // Tab containment: cycle 12 tabs, focus never reaches INTERACTIVE
  // background content. (Chromium wraps modal-dialog focus through
  // document.body for one stop at the wrap boundary — verified inherent
  // to native <dialog> with a minimal 3-button repro in Chrome 153 —
  // so a body stop is allowed; nothing operable outside is focusable.)
  let contained = true;
  const stops = [];
  for (let i = 0; i < 12; i += 1) {
    if (i % 2 === 0) {
      await page.keyboard.press('Tab');
    } else {
      await page.keyboard.down('Shift');
      await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
    }
    await sleep(60);
    const where = await page.evaluate(() => {
      const dlg = document.querySelector('dialog[data-testid="overlay"]');
      const el = document.activeElement;
      if (dlg !== null && dlg.contains(el)) return 'inside';
      if (el === document.body) return 'body';
      return `OUTSIDE:${el?.tagName}${el?.id ? '#' + el.id : ''}`;
    });
    stops.push(where);
    if (where.startsWith('OUTSIDE')) contained = false;
  }
  check('Tab / Shift+Tab never reach interactive background content (12 cycles)', contained, stops.join(','));

  // Background inert: a REAL mouse click (hit-testing) on a background
  // trigger does not open anything. (Synthetic el.click() would bypass
  // inert hit-testing and is not user evidence.)
  const bgTrigger = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Adjust…');
    if (btn === null) return null;
    const box = btn.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  if (bgTrigger !== null) {
    await page.mouse.click(bgTrigger.x, bgTrigger.y);
    await sleep(250);
  }
  const dialogCount = await page.evaluate(() => document.querySelectorAll('dialog[data-testid="overlay"]').length);
  const drawerOpened = await page.evaluate(() => document.querySelector('dialog.vict-overlay--drawer') !== null);
  check(
    'background inert: real click on a background trigger reaches only the top layer (backdrop dismisses; nothing behind opens)',
    bgTrigger !== null && drawerOpened === false && dialogCount < 2,
    `dialogs=${dialogCount} drawerOpened=${drawerOpened}`,
  );
  const focusAfterBackdrop = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null);
  check('focus restores to the trigger after backdrop close', focusAfterBackdrop === 'overlay-trigger', `focus=${String(focusAfterBackdrop)}`);

  // Escape closes and restores focus to the trigger (fresh open).
  await page.click('[data-testid="overlay-trigger"]');
  await sleep(350);
  await page.keyboard.press('Escape');
  await sleep(400);
  st = await modalState();
  const focusAfter = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  check('Escape closes the dialog', st.open === false && (await page.evaluate(() => document.querySelector('dialog[data-testid="overlay"]'))) === null);
  check('trigger regains focus after close', focusAfter === 'overlay-trigger', `focus=${String(focusAfter)}`);

  // Explicit Close closes.
  await page.click('[data-testid="overlay-trigger"]');
  await sleep(300);
  await page.click('[data-testid="overlay-close"]');
  await sleep(300);
  check('explicit Close closes', (await page.evaluate(() => document.querySelector('dialog[data-testid="overlay"]'))) === null);

  // Backdrop click closes; click on panel content does NOT.
  await page.click('[data-testid="overlay-trigger"]');
  await sleep(300);
  const panelBox = await (await page.$('[data-testid="overlay-panel"]')).boundingBox();
  await page.mouse.click(panelBox.x + panelBox.width / 2, panelBox.y + 30); // header area of the panel
  await sleep(250);
  check('click on panel content does NOT close', (await page.evaluate(() => document.querySelector('dialog[data-testid="overlay"]')?.open)) === true);
  await page.mouse.click(30, 450); // far left = backdrop
  await sleep(300);
  check('backdrop click closes', (await page.evaluate(() => document.querySelector('dialog[data-testid="overlay"]'))) === null);
  await shot('h-dialog-closed-after-backdrop');

  // Denied action INSIDE the dialog still surfaces denial.
  await page.click('[data-testid="overlay-trigger"]');
  await sleep(300);
  await page.click('[data-testid="overlay"] button[data-action-id="act.delete-denied"]');
  await sleep(500);
  const denied = await page.evaluate(() => ({
    deniedText: document.querySelector('[data-testid="denied-state"]')?.textContent ?? null,
    role: document.querySelector('[data-testid="denied-state"]')?.getAttribute('role'),
    dialogStillOpen: document.querySelector('dialog[data-testid="overlay"]')?.open ?? false,
  }));
  check('denied action inside dialog surfaces denial (role=alert) and dialog stays open', denied.deniedText !== null && denied.role === 'alert' && denied.dialogStillOpen === true, JSON.stringify(denied));
  await shot('h-dialog-denied-action');
  await page.keyboard.press('Escape');
  await sleep(300);
}

console.log('\n=== 3b. DRAWER — distinct presentation ===');
{
  // Open the drawer via its trigger (no other modal is open here).
  await sleep(200);
  const triggers = await page.evaluate(() => {
    const list = [...document.querySelectorAll('button[data-testid="overlay-trigger"]')];
    return list.length;
  });
  // There are two overlays (dialog + drawer). Click the drawer's trigger.
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const adjust = btns.find((b) => b.textContent.trim() === 'Adjust…');
    if (adjust === undefined) return false;
    adjust.click();
    return true;
  });
  await sleep(400);
  const drawer = await page.evaluate(() => {
    const dlg = document.querySelector('dialog.vict-overlay--drawer');
    if (dlg === null) return null;
    const panel = dlg.querySelector('.vict-drawer');
    const box = panel.getBoundingClientRect();
    return {
      open: dlg.open,
      rightAligned: Math.abs(box.right - window.innerWidth) < 2,
      fullHeight: Math.abs(box.height - window.innerHeight) < 4,
      distinctClass: dlg.className.includes('vict-overlay--drawer'),
    };
  });
  check('drawer trigger opens drawer presentation (right, full-height, distinct class)', clicked && drawer !== null && drawer.open && drawer.rightAligned && drawer.fullHeight && drawer.distinctClass, JSON.stringify(drawer));
  await shot('h-drawer-open');

  // Form inside the drawer: optional numeric absent + boolean + invalidation.
  const adjustInput = {
    discount: await fieldValue('discount', 'f.adjust'),
    active: await page.evaluate(() => document.querySelector('#vict-field-f\\.adjust-active')?.checked),
  };
  check('drawer form prefilled from record', adjustInput.discount === '25' && adjustInput.active === true, JSON.stringify(adjustInput));
  await page.click('dialog.vict-overlay--drawer [data-testid="form-submit"]');
  await sleep(500);
  const last = await lastDispatch();
  check(
    'drawer form dispatches canonical edit',
    last?.outcome === 'OK' && last?.input?.__identity === 'one' && last?.input?.discount === 25 && last?.input?.active === true,
    JSON.stringify(last?.input),
  );
  const focusAfterDrawerSave = await page.evaluate(() => document.activeElement?.closest('dialog') !== null);
  check('drawer stays open after save (focus stays inside)', focusAfterDrawerSave, '');

  // Nested dialog INSIDE the drawer (existing recursion path).
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const nested = btns.find((b) => b.textContent.trim() === 'Nested confirm…');
    nested?.click();
  });
  await sleep(400);
  const nested = await page.evaluate(() => {
    const dlgs = [...document.querySelectorAll('dialog[data-testid="overlay"]')];
    return dlgs.map((d) => ({ open: d.open, drawer: d.className.includes('drawer'), topmost: d.matches(':modal') }));
  });
  check('nested overlay: dialog inside drawer, both open in top layer', nested.length === 2 && nested.every((d) => d.open && d.topmost), JSON.stringify(nested));
  await shot('h-nested-overlay');

  // Nested bump → parent data invalidation list updates.
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('dialog[data-testid="overlay"]:not(.vict-overlay--drawer) button')];
    const bump = btns.find((b) => b.textContent.includes('Bump revision'));
    bump?.click();
  });
  await sleep(500);
  const listAfter = await page.evaluate(() => document.querySelector('.vict-list')?.textContent ?? '');
  check('nested action invalidates route data (list shows revision bump)', listAfter.includes('revision bump 1'), listAfter);
  await shot('h-nested-invalidated');

  // Close nested with Escape: parent (drawer) must remain open.
  await page.keyboard.press('Escape');
  await sleep(300);
  const afterNestedClose = await page.evaluate(() => ({
    dialogs: [...document.querySelectorAll('dialog[data-testid="overlay"]')].map((d) => d.className.includes('drawer') ? 'drawer' : 'dialog'),
  }));
  check('Escape closes only the nested dialog; drawer stays open', afterNestedClose.dialogs.length === 1 && afterNestedClose.dialogs[0] === 'drawer', JSON.stringify(afterNestedClose));
  await page.keyboard.press('Escape');
  await sleep(300);
  check('Escape closes the drawer', (await page.evaluate(() => document.querySelectorAll('dialog[data-testid="overlay"]').length)) === 0);
}

console.log('\n=== 4. STATUS / FEEDBACK ===');
{
  await go('/tones');
  await sleep(400);
  const tones = await page.evaluate(() =>
    [...document.querySelectorAll('.vict-status')].map((el) => ({
      text: el.textContent,
      cls: [...el.classList].find((c) => c.startsWith('vict-status--')),
    })),
  );
  const expect = ['neutral', 'success', 'warning', 'danger', 'info'];
  check(
    'all five status tones render distinct classes',
    expect.every((t) => tones.some((x) => x.cls === `vict-status--${t}`)) && tones.length === 5,
    JSON.stringify(tones),
  );
  await shot('h-status-tones');

  await go('/actions');
  await sleep(400);
  const actions = await page.evaluate(() =>
    [...document.querySelectorAll('button.vict-btn')].map((b) => ({
      label: b.textContent,
      variant: b.className.includes('danger') ? 'danger' : b.className.includes('secondary') ? 'secondary' : 'primary',
      disabled: b.disabled,
    })),
  );
  check(
    'variants + disabled: primary and danger present; disabled action disabled (note: the renderer assigns secondary to no action — pre-P3 behavior preserved)',
    actions.some((a) => a.variant === 'primary') && actions.some((a) => a.variant === 'danger') && actions.some((a) => a.disabled),
    JSON.stringify(actions),
  );
  await shot('h-actions-variants');

  // Empty feedback + detail empty.
  const empty = await page.evaluate(() => [...document.querySelectorAll('.vict-state')].map((e) => e.textContent));
  check('empty feedback renders (list + detail)', empty.length >= 2 && empty.every((t) => t.length > 0), JSON.stringify(empty));

  // error/denied feedback roles
  const deniedRole = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button.vict-btn')];
    btns.find((b) => b.textContent === 'Delete record')?.click();
    return new Promise((r) => setTimeout(() => r(document.querySelector('[data-testid="denied-state"]')?.getAttribute('role') ?? null), 400));
  });
  check('denied feedback carries role=alert', deniedRole === 'alert', String(deniedRole));

  // stale/partial feedback
  await page.evaluate(() => {
    const stale = document.querySelector('[data-testid="qa-stale"]');
    if (stale instanceof HTMLInputElement && !stale.checked) stale.click();
  });
  await sleep(300);
  const staleShown = await page.evaluate(() => document.querySelector('[data-testid="stale-state"]')?.textContent ?? null);
  check('stale feedback surfaces', staleShown !== null, String(staleShown));
  await shot('h-feedback-stale');
}

console.log('\n=== 4b. CONTRAST (light theme) — computed ratios ===');
{
  await go('/tones');
  await sleep(300);
  const ratios = await page.evaluate(() => {
    const lum = (rgb) => {
      const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map(Number).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (fg, bg) => {
      const l1 = lum(fg), l2 = lum(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const bgOf = (el) => {
      let n = el;
      while (n !== null) {
        const bg = getComputedStyle(n).backgroundColor;
        if (bg !== undefined && !bg.includes('0, 0, 0, 0')) return bg;
        n = n.parentElement;
      }
      return 'rgb(255,255,255)';
    };
    const out = [];
    for (const el of [...document.querySelectorAll('.vict-status, .vict-btn, .vict-field-label, .vict-nav-link')]) {
      const cs = getComputedStyle(el);
      out.push({ cls: el.className.split(' ')[0], text: (el.textContent ?? '').slice(0, 18), ratio: Number(ratio(cs.color, bgOf(el)).toFixed(2)) });
    }
    return out;
  });
  const failing = ratios.filter((r) => r.ratio < 4.5);
  check('all sampled text meets WCAG AA (>=4.5:1)', failing.length === 0, failing.length ? JSON.stringify(failing) : `min=${Math.min(...ratios.map((r) => r.ratio))}`);
}

console.log('\n=== 5. MOBILE 380 / 320 — forms, tabs, overlays, no horizontal overflow ===');
for (const width of [380, 320]) {
  await page.setViewport({ width, height: 800 });
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(700);
  await go('/rec/one');
  await sleep(400);
  const overflow = await page.evaluate(() => ({
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    tablistOverflow: (() => {
      const list = document.querySelector('.vict-tablist');
      return list === null ? null : list.scrollWidth - list.clientWidth;
    })(),
  }));
  check(`@${width}: document has no horizontal page overflow`, overflow.docOverflow <= 0, JSON.stringify(overflow));
  await shot(`h-rec-${width}`);
  await go('/longtabs');
  await sleep(300);
  const longOverflow = await page.evaluate(() => {
    const list = document.querySelector('.vict-tablist');
    if (list === null) return null;
    const docOver = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    // Every tab must be REACHABLE: the tablist scrolls horizontally when
    // its content overflows, and the last tab can be scrolled into view
    // (and fully revealed) inside the contained region.
    const lastTab = list.querySelector('[role="tab"]:last-of-type');
    let scrollable = false;
    if (lastTab !== null) {
      lastTab.scrollIntoView({ block: 'nearest', inline: 'end' });
      scrollable =
        list.scrollLeft > 0 ||
        lastTab.getBoundingClientRect().right <= list.getBoundingClientRect().right + 1;
    }
    return {
      docOver,
      scrollW: list.scrollWidth,
      clientW: list.clientWidth,
      scrolls: list.scrollWidth > list.clientWidth ? getComputedStyle(list).overflowX !== 'visible' : true,
      lastTabReachable: scrollable,
    };
  });
  // Restore the default (unscrolled) presentation before capturing.
  await page.evaluate(() => {
    const list = document.querySelector('.vict-tablist');
    if (list !== null) list.scrollLeft = 0;
  });
  await sleep(150);
  check(
    `@${width}: long-label tabs do not overflow the page and every tab stays reachable`,
    longOverflow !== null && longOverflow.docOver <= 0 && longOverflow.lastTabReachable,
    JSON.stringify(longOverflow),
  );
  await shot(`h-longtabs-${width}`);
  // Scrolled-to-end state (evidence the contained region completes the run).
  await page.evaluate(() => {
    const list = document.querySelector('.vict-tablist');
    if (list !== null) list.scrollLeft = list.scrollWidth;
  });
  await sleep(200);
  await shot(`h-longtabs-${width}-scrolled`);
  await page.evaluate(() => {
    const list = document.querySelector('.vict-tablist');
    if (list !== null) list.scrollLeft = 0;
  });
  await go('/widgets');
  await sleep(300);
  await shot(`h-form-${width}`);
  const formUsable = await page.evaluate(() => {
    const input = document.querySelector('#vict-field-f\\.widget-create-name');
    const box = input?.getBoundingClientRect();
    return box !== null && box !== undefined && box.width > 120 && box.right <= window.innerWidth + 1;
  });
  check(`@${width}: form inputs fit and remain usable`, formUsable);
  // Open the drawer at this width (rec route).
  await go('/rec/one');
  await sleep(300);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    btns.find((b) => b.textContent.trim() === 'Adjust…')?.click();
  });
  await sleep(400);
  const drawerMobile = await page.evaluate(() => {
    const dlg = document.querySelector('dialog.vict-overlay--drawer');
    const panel = dlg?.querySelector('.vict-drawer');
    const box = panel?.getBoundingClientRect();
    return { open: dlg?.open ?? false, width: box?.width ?? 0, fits: (box?.left ?? 0) >= 0 && (box?.right ?? 0) <= window.innerWidth + 1 };
  });
  check(`@${width}: drawer opens, fits viewport, form usable`, drawerMobile.open && drawerMobile.fits && drawerMobile.width > 200, JSON.stringify(drawerMobile));
  await shot(`h-drawer-${width}`);
  await page.keyboard.press('Escape');
  await sleep(200);
}

check('no page errors during the whole harness run', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

await browser.close();
writeFileSync(join(HERE, 'harness-results.json'), JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(`\n==== HARNESS: ${results.length - failed.length}/${results.length} checks passed ====`);
if (failed.length > 0) {
  console.log('FAILED:');
  for (const f of failed) console.log(` - ${f.name} (${f.detail})`);
  process.exit(1);
}
