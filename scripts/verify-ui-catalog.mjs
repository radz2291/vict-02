/* global document, window, innerWidth, getComputedStyle, requestAnimationFrame */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchPreview, root } from './lib/ui-browser.mjs';

const app = await launchPreview();
const dir = join(root, 'qa-artifacts/foundation-catalog');
mkdirSync(dir, { recursive: true });
const checks = [],
  errors = [];
const page = await app.browser.newPage();
page.on('pageerror', (error) => errors.push(error.message));
page.setDefaultTimeout(10000);
page.setDefaultNavigationTimeout(45000);
const family = (name) => `[data-family="${name}"]`;
const within = (name, selector) => `${family(name)} ${selector}`;
const visible = (selector) => page.waitForSelector(selector, { visible: true });
const gone = async (selector) => {
  await page.waitForSelector(selector, { hidden: true });
  // Let the primitive finish focus restoration and release its pointer layer.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
};
const text = (selector) => page.$eval(selector, (el) => el.textContent);
const attr = (selector, name) => page.$eval(selector, (el, key) => el.getAttribute(key), name);
const shot = (name) => page.screenshot({ path: join(dir, name + '.png') });
const check = async (name, run) => {
  await run();
  checks.push(name);
  console.log('PASS ' + name);
};
async function go(route, width = 1440) {
  await page.setViewport({ width, height: width < 600 ? 844 : 1000 });
  const response = await page.goto(app.base + route, { waitUntil: 'networkidle0' });
  assert.ok([200, 304].includes(response.status()));
}
async function axe() {
  if (!(await page.evaluate(() => !!window.axe)))
    await page.addScriptTag({ path: join(root, 'node_modules/axe-core/axe.min.js') });
  const issues = await page.evaluate(async () =>
    (await window.axe.run(document)).violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  );
  assert.deepEqual(issues, []);
}
async function noOverflow() {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'document overflow',
  );
}
async function clearType(selector, value) {
  await page.focus(selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.type(value);
}
async function focused(selector) {
  assert.ok(await page.$eval(selector, (el) => el === document.activeElement));
}
async function clickText(selector, label) {
  const handles = await page.$$(selector);
  for (const handle of handles)
    if ((await handle.evaluate((el) => el.textContent.trim())) === label) {
      await handle.click();
      return;
    }
  throw Error('Missing ' + selector + ': ' + label);
}
async function trap(selector) {
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    assert.ok(await page.$eval(selector, (el) => el.contains(document.activeElement)));
  }
}
try {
  await go('/catalog');
  await check(
    'coverage: all 38 implemented families render with no runtime or axe errors',
    async () => {
      assert.equal((await page.$$('[data-family]')).length, 38);
      await axe();
      await noOverflow();
    },
  );
  await check('button: action, disabled and pending', async () => {
    await page.click(within('button', '.vict-btn'));
    assert.match(await text('[data-testid="catalog-action-result"]'), /Draft saved/);
    assert.equal(await attr(within('button', '[aria-busy]'), 'disabled'), '');
  });
  await check('accordion: disclosure, keyboard navigation and disabled item', async () => {
    const triggers = await page.$$(within('accordion', '[data-accordion-trigger]'));
    await triggers[1].focus();
    await page.keyboard.press('Enter');
    assert.equal(await triggers[1].evaluate((el) => el.getAttribute('aria-expanded')), 'true');
    await page.keyboard.press('ArrowUp');
    await focused(within('accordion', '[data-accordion-trigger]'));
    assert.equal(await triggers[2].evaluate((el) => el.disabled), true);
  });
  await check(
    'alert-dialog: trap, outside prevention, cancel focus return and confirmation',
    async () => {
      const trigger = within('alert-dialog', 'button');
      await page.click(trigger);
      await visible('[role="alertdialog"]');
      await trap('[role="alertdialog"]');
      await page.mouse.click(5, 5);
      await visible('[role="alertdialog"]');
      await page.click('[data-alert-dialog-cancel]');
      await gone('[role="alertdialog"]');
      await focused(trigger);
      await page.click(trigger);
      await page.click('[data-alert-dialog-action]');
      await gone('[role="alertdialog"]');
      assert.match(await text(family('alert-dialog')), /Project archived/);
    },
  );
  await check('command: filtering, empty state and keyboard dispatch', async () => {
    const input = within('command', 'input');
    await clearType(input, 'zzzzzz');
    await visible('[data-command-empty]');
    await clearType(input, 'request');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.match(await text('[data-testid="catalog-action-result"]'), /Create request selected/);
  });
  await check('command palette: dialog composition, search dispatch and focus return', async () => {
    const trigger = within('command', '[data-dialog-trigger]');
    await page.click(trigger);
    await visible('[data-dialog-content]');
    await clearType('[data-dialog-content] [data-command-input]', 'review');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await gone('[data-dialog-content]');
    await focused(trigger);
    assert.match(await text('[data-testid="catalog-action-result"]'), /Review scheduling selected/);
  });
  await check('context-menu: Shift+F10, disabled items and Escape', async () => {
    const trigger = within('context-menu', '[data-context-menu-trigger]');
    await page.focus(trigger);
    await page.keyboard.down('Shift');
    await page.keyboard.press('F10');
    await page.keyboard.up('Shift');
    await visible('[data-context-menu-content]');
    await axe();
    await page.keyboard.press('Escape');
    await gone('[data-context-menu-content]');
  });
  await check('dialog: focus trap, Escape and focus return', async () => {
    const trigger = within('dialog', '[data-dialog-trigger]');
    await page.click(trigger);
    await visible('[data-dialog-content]');
    await trap('[data-dialog-content]');
    await page.keyboard.press('Escape');
    await gone('[data-dialog-content]');
    await focused(trigger);
  });
  await check('dropdown-menu: keyboard, checkbox, radio submenu and shared styling', async () => {
    const trigger = within('dropdown-menu', '[data-dropdown-menu-trigger]');
    await page.focus(trigger);
    await page.keyboard.press('ArrowDown');
    await visible('[data-dropdown-menu-content]');
    assert.equal(
      await page.$eval('[data-dropdown-menu-content]', (el) => getComputedStyle(el).borderRadius),
      '10px',
    );
    await page.click('[data-dropdown-menu-checkbox-item]');
    await page.keyboard.press('Escape');
    await gone('[data-dropdown-menu-content]');
    assert.match(await text(family('dropdown-menu')), /Watching: no/);
    await page.click(trigger);
    await visible('[data-dropdown-menu-content]');
    await page.focus('[data-dropdown-menu-sub-trigger]');
    await page.keyboard.press('ArrowRight');
    await visible('[data-dropdown-menu-sub-content]');
    await clickText('[data-dropdown-menu-radio-item]', 'Highest priority');
    await page.keyboard.press('Escape');
    await gone('[data-dropdown-menu-content]');
    assert.match(await text(family('dropdown-menu')), /Sort: priority/);
  });
  await check('popover: interactive content, Escape and return', async () => {
    const trigger = within('popover', '[data-popover-trigger]');
    await page.click(trigger);
    await visible('[data-popover-content]');
    await page.keyboard.press('Escape');
    await gone('[data-popover-content]');
    await focused(trigger);
  });
  await check('tooltip: focus explanation and Escape', async () => {
    await page.$eval(within('tooltip', 'button'), (el) => el.scrollIntoView({ block: 'center' }));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await page.focus(within('popover', 'button'));
    await page.keyboard.press('Tab');
    await visible('[data-tooltip-content]');
    assert.match(await text('[data-tooltip-content]'), /two working days/);
    await page.keyboard.press('Escape');
    await gone('[data-tooltip-content]');
  });
  await check('checkbox: mixed state and keyboard change', async () => {
    const mixed = within('checkbox', '[aria-checked="mixed"]');
    await page.focus(mixed);
    await page.keyboard.press('Space');
    assert.equal((await page.$$(within('checkbox', '[aria-checked="mixed"]'))).length, 0);
    assert.equal((await page.$$(within('checkbox', '[disabled]'))).length, 1);
  });
  await check('combobox: single/multiple search, empty state and keyboard selection', async () => {
    await clearType('#team-search', 'Engineering');
    await visible('[data-combobox-content]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.$eval('#team-search', (el) => el.value), 'Engineering');
    await clearType('#people-search', 'Arun');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    assert.match(await text(family('combobox')), /Maya Chen, Arun Patel/);
    await clearType('#team-search', 'zzzzzz');
    await visible('[data-combobox-content]');
    assert.match(await text('[data-combobox-content]'), /No matching teams/);
    await page.keyboard.press('Escape');
  });
  await check('select: multiple values, disabled choice and single keyboard choice', async () => {
    const triggers = await page.$$(within('select', '[data-select-trigger]'));
    await triggers[0].click();
    await clickText('[data-select-item]', 'Customer support');
    await page.keyboard.press('Escape');
    assert.match(await triggers[0].evaluate((el) => el.textContent), /2\s+teams/);
    await triggers[1].focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    assert.match(await triggers[1].evaluate((el) => el.textContent), /Urgent/);
  });
  await check('radio-group: arrow selection and disabled skip', async () => {
    const items = await page.$$(within('radio-group', '[role="radio"]'));
    await items[0].focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await items[1].evaluate((el) => el.getAttribute('aria-checked')), 'true');
    await page.keyboard.press('ArrowDown');
    await focused(within('radio-group', '[role="radio"]'));
  });
  await check('slider: two numeric thumbs, keyboard bounds and step', async () => {
    const thumbs = await page.$$(within('slider', '[role="slider"]'));
    await thumbs[0].focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    assert.equal(await thumbs[0].evaluate((el) => el.getAttribute('aria-valuenow')), '5');
    await thumbs[1].focus();
    await page.keyboard.press('End');
    assert.equal(await thumbs[1].evaluate((el) => el.getAttribute('aria-valuenow')), '100');
  });
  await check('switch: checked value and disabled setting', async () => {
    await page.click(within('switch', '[role="switch"]'));
    assert.equal(await attr(within('switch', '[role="switch"]'), 'aria-checked'), 'false');
  });
  await check('toggle: pressed action', async () => {
    await page.click(within('toggle', 'button'));
    assert.equal(await attr(within('toggle', 'button'), 'aria-pressed'), 'true');
  });
  await check('toggle-group: single and multiple selection', async () => {
    await clickText(within('toggle-group', 'button'), 'Centre');
    await clickText(within('toggle-group', 'button'), 'Inbox');
    assert.equal((await page.$$(within('toggle-group', '[data-state="on"]'))).length, 3);
  });
  await check('calendar: selected/disabled dates and keyboard date change', async () => {
    const day = within('calendar', '[data-calendar-day][data-value="2026-10-08"]');
    await page.focus(day);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    assert.ok(
      await page.$(
        within('calendar', '[data-calendar-day][data-selected][data-value="2026-10-09"]'),
      ),
    );
    assert.equal(
      await attr(
        within('calendar', '[data-calendar-day][data-value="2026-10-15"]'),
        'aria-disabled',
      ),
      'true',
    );
  });
  await check('date-field: segmented editing, invalid description and disabled state', async () => {
    const input = within('date-field', '[role="spinbutton"]');
    const before = await attr(input, 'aria-valuenow');
    await page.focus(input);
    await page.keyboard.press('ArrowUp');
    assert.notEqual(await attr(input, 'aria-valuenow'), before);
    assert.ok(await page.$(within('date-field', '[data-invalid]')));
    assert.ok(await page.$(within('date-field', '[aria-describedby*="catalog-date-error"]')));
    await page.focus(within('date-field', '[role="spinbutton"][data-invalid]'));
    await page.keyboard.press('ArrowUp');
    await gone('#catalog-date-error');
  });
  await check('date-picker: calendar selection and Escape return', async () => {
    const trigger = within('date-picker', '[data-popover-trigger]');
    await page.click(trigger);
    await visible('[data-popover-content]');
    await page.click('[data-popover-content] [data-calendar-day][data-value="2026-10-20"]');
    await page.keyboard.press('Escape');
    await gone('[data-popover-content]');
    await focused(trigger);
  });
  await check('date-range-field: independently labelled start/end segments', async () => {
    const inputs = await page.$$(within('date-range-field', '[data-date-field-input]'));
    assert.equal(inputs.length, 2);
    const spin = await inputs[0].$('[role="spinbutton"]');
    await spin.focus();
    const before = await spin.evaluate((el) => el.getAttribute('aria-valuenow'));
    await page.keyboard.press('ArrowUp');
    assert.notEqual(await spin.evaluate((el) => el.getAttribute('aria-valuenow')), before);
  });
  await check('date-range-picker: two date selection', async () => {
    await page.click(within('date-range-picker', '[data-popover-trigger]'));
    await visible('[data-popover-content]');
    await page.click('[data-popover-content] [data-range-calendar-day][data-value="2026-10-18"]');
    await page.click('[data-popover-content] [data-range-calendar-day][data-value="2026-10-22"]');
    await page.keyboard.press('Escape');
    await gone('[data-popover-content]');
    assert.match(await text(family('range-calendar')), /2026-10-18 → 2026-10-22/);
  });
  await check('range-calendar: range boundaries and shared calendar styling', async () => {
    await page.click(
      within('range-calendar', '[data-range-calendar-day][data-value="2026-10-23"]'),
    );
    await page.click(
      within('range-calendar', '[data-range-calendar-day][data-value="2026-10-26"]'),
    );
    assert.match(await text(family('range-calendar')), /2026-10-23 → 2026-10-26/);
    assert.equal(
      await page.$eval(
        within('range-calendar', '[data-range-calendar-header]'),
        (el) => getComputedStyle(el).display,
      ),
      'flex',
    );
  });
  await check('time-field: keyboard segments and explicit local-time label', async () => {
    const field = within('time-field', '[role="spinbutton"]');
    const before = await attr(field, 'aria-valuenow');
    await page.focus(field);
    await page.keyboard.press('ArrowUp');
    assert.notEqual(await attr(field, 'aria-valuenow'), before);
  });
  await check('avatar: loaded image and failed-image fallback', async () => {
    assert.ok(
      await page.$eval(within('avatar', 'img'), (el) => el.complete && el.naturalWidth > 0),
    );
    const fallbacks = await page.$$eval(within('avatar', '[data-avatar-fallback]'), (els) =>
      els.map((el) => el.textContent),
    );
    assert.ok(fallbacks.includes('AP'));
  });
  await check('meter: bounded scalar semantics', async () => {
    assert.equal(await attr(within('meter', '[role="meter"]'), 'aria-valuenow'), '65');
  });
  await check('navigation-menu: keyboard opening, links and Escape', async () => {
    const trigger = within('navigation-menu', '[data-navigation-menu-trigger]');
    await page.focus(trigger);
    await page.keyboard.press('Enter');
    await visible('[data-navigation-menu-content]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await gone('[data-navigation-menu-content]');
  });
  await check('pagination: page change and current-page semantics', async () => {
    await page.click(within('pagination', '[data-pagination-next]'));
    assert.match(await text(family('pagination')), /Page 2 of 11/);
    assert.equal(await text(within('pagination', '[aria-current="page"]')), '2');
  });
  await check('progress: determinate updates and indeterminate semantics', async () => {
    await page.click(within('progress', 'button'));
    assert.equal(await attr(within('progress', '[role="progressbar"]'), 'aria-valuenow'), '75');
    assert.equal(await attr(within('progress', '[data-indeterminate]'), 'aria-valuenow'), null);
  });
  await check('tabs: arrow selection and disabled tab', async () => {
    await page.focus(within('tabs', '[role="tab"]'));
    await page.keyboard.press('ArrowRight');
    await visible(within('tabs', '[role="tabpanel"]:not([hidden])'));
    assert.match(await text(within('tabs', '[role="tabpanel"]:not([hidden])')), /Maya updated/);
  });
  await check('aspect-ratio: responsive 16:9 content', async () => {
    const ratio = await page.$eval(
      within('aspect-ratio', '[data-aspect-ratio-root]'),
      (el) => el.getBoundingClientRect().width / el.getBoundingClientRect().height,
    );
    assert.ok(Math.abs(ratio - 16 / 9) < 0.02);
  });
  await check('collapsible: keyboard disclosure', async () => {
    await page.focus(within('collapsible', 'button'));
    await page.keyboard.press('Space');
    await visible('[data-collapsible-content]');
  });
  await check('label: associated input focus', async () => {
    await page.click(within('label', 'label'));
    await focused('#project-code');
  });
  await check('link-preview: focus preview and Escape', async () => {
    await page.focus('#project-code');
    await page.keyboard.press('Tab');
    await visible('[data-link-preview-content]');
    await page.keyboard.press('Escape');
    await gone('[data-link-preview-content]');
  });
  await check('menubar: keyboard switching and checkable item', async () => {
    await page.focus(within('menubar', '[data-menubar-trigger]'));
    await page.keyboard.press('Enter');
    await visible('[data-menubar-content]');
    await page.keyboard.press('ArrowRight');
    await visible('[data-menubar-checkbox-item]');
    await page.keyboard.press('Escape');
    await gone('[data-menubar-content]');
  });
  await check('scroll-area: native keyboard scroll and styled scrollbar', async () => {
    const viewport = within('scroll-area', '[data-scroll-area-viewport]');
    await page.focus(viewport);
    await page.keyboard.press('End');
    await page.waitForFunction((s) => document.querySelector(s).scrollTop > 0, {}, viewport);
  });
  await check('separator: horizontal and vertical semantics', async () => {
    assert.equal((await page.$$(within('separator', '[role="separator"]'))).length, 2);
    assert.equal(
      await attr(within('separator', '[data-orientation="vertical"]'), 'aria-orientation'),
      'vertical',
    );
  });
  await check('toolbar: roving focus, pressed tools and disabled skip', async () => {
    const first = within('toolbar', '[data-toolbar-button]');
    await page.focus(first);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    assert.equal(
      await page.evaluate(() => document.activeElement.getAttribute('aria-pressed')),
      'true',
    );
  });
  for (const width of [1440, 390, 320]) {
    await check(`gallery: ${width}px layout, all-family accessibility and captures`, async () => {
      await go('/catalog', width);
      await noOverflow();
      await axe();
      await shot('catalog-' + width);
      if (width === 1440)
        for (const group of ['actions', 'selection', 'dates', 'display', 'direct'])
          await (await page.$('#' + group)).screenshot({ path: join(dir, group + '-1440.png') });
      if (width === 390)
        await (await page.$('#selection')).screenshot({ path: join(dir, 'selection-390.png') });
      const trigger = within(
        width === 320 ? 'date-range-picker' : 'date-picker',
        '[data-popover-trigger]',
      );
      await page.click(trigger);
      await visible('[data-popover-content]');
      await noOverflow();
      await axe();
      await shot('calendar-open-' + width);
      await page.keyboard.press('Escape');
    });
    await check(
      `application flow: ${width}px real registered action, validation and success`,
      async () => {
        await go('/requests/schedule', width);
        await visible('[data-testid="request-planner"]');
        await noOverflow();
        await axe();
        await shot('request-flow-' + width);
        await page.click('[data-testid="request-planner"] button[type="submit"]');
        await focused('#planner-name');
        assert.equal(await attr('#planner-name', 'aria-invalid'), 'true');
        await shot('request-invalid-' + width);
        await page.click('[data-dropdown-menu-trigger]');
        await visible('[data-dropdown-menu-content]');
        await axe();
        await shot('menu-open-' + width);
        await clickText('[data-dropdown-menu-item]', 'Onboarding launch');
        await gone('[data-dropdown-menu-content]');
        await page.click('[data-select-trigger]');
        await visible('[data-select-content]');
        await clickText('[data-select-item]', 'Engineering');
        await gone('[data-select-content]');
        await page.click('[data-popover-trigger]');
        await visible('[data-popover-content]');
        await page.click('[data-calendar-day][data-value="2026-10-21"]');
        await page.keyboard.press('Escape');
        await gone('[data-popover-content]');
        await page.click('[data-accordion-trigger]');
        await page.type(
          '#planner-note',
          'Please review the onboarding brief before the team handoff.',
        );
        const response = page.waitForResponse(
          (r) => r.url().includes('/api/act') && r.request().method() === 'POST',
        );
        await page.click('[data-testid="request-planner"] button[type="submit"]');
        const result = await response;
        const payload = JSON.parse(result.request().postData());
        assert.equal(payload.actionId, 'act.create');
        assert.equal(payload.input.startDate, '2026-10-21');
        assert.equal(payload.input.payload, 'Engineering');
        assert.equal((await result.json()).ok, true);
        await page.waitForFunction(() =>
          document
            .querySelector('[data-testid="action-success"]')
            ?.textContent.includes('Request scheduled'),
        );
        await axe();
        await noOverflow();
        if (width < 600) {
          await page.$eval('[data-testid="action-success"]', (el) =>
            el.scrollIntoView({ block: 'center' }),
          );
        }
        await shot('request-saved-' + width);
        await page.type('#planner-name', ' updated');
        assert.equal(await text('[data-testid="action-success"]'), '');
      },
    );
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    join(dir, 'checks.json'),
    JSON.stringify(
      { passed: true, checks, browserErrors: errors, families: 38, widths: [1440, 390, 320] },
      null,
      2,
    ) + '\n',
  );
  console.log(`${checks.length} catalog browser checks passed`);
} catch (error) {
  await shot('failure');
  writeFileSync(
    join(dir, 'checks.json'),
    JSON.stringify(
      { passed: false, checks, browserErrors: errors, error: String(error) },
      null,
      2,
    ) + '\n',
  );
  throw error;
} finally {
  await app.close();
}
