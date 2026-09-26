/* global document, window, location, innerWidth, getComputedStyle, scrollY, Event */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'qa-artifacts/composition-slice-1');
mkdirSync(artifacts, { recursive: true });
const server = spawn(process.execPath, ['build'], {
  cwd: join(root, 'examples/ui-showcase'),
  env: { ...process.env, VICT_COMPOSITION: '1', PORT: '0', HOST: '127.0.0.1' },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stderr.on('data', (chunk) => {
  output += chunk;
});
const executablePath = [
  process.env.VICT_BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find((path) => path && existsSync(path));
let browser;
const checks = [];
const errors = [];
async function check(name, run) {
  await run();
  checks.push(name);
  console.log('PASS ' + name);
}
try {
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Server timeout: ' + output)), 30000);
    server.once('exit', (code) => {
      clearTimeout(timer);
      reject(Error('Server exited ' + code + ': ' + output));
    });
    server.stdout.on('data', (chunk) => {
      const match = /http:\/\/[^\s:]+:(\d+)/.exec(chunk.toString());
      if (match) {
        clearTimeout(timer);
        resolve('http://127.0.0.1:' + match[1]);
      }
    });
  });
  assert.ok(executablePath, 'Set VICT_BROWSER_PATH to a Chromium executable.');
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const go = async (path, width = 1440) => {
    await page.setViewport({ width, height: width >= 1000 ? 1000 : 844 });
    const response = await page.goto(base + path, { waitUntil: 'networkidle0' });
    assert.ok(
      response.status() === 200 || response.status() === 304,
      'unexpected route status ' + response.status() + ': ' + output,
    );
    await page.waitForSelector('[data-testid="vict-host"]');
  };
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  const countDialogs = (n) =>
    page.waitForFunction(
      (count) => document.querySelectorAll('[role="dialog"]').length === count,
      {},
      n,
    );

  const shot = (name) => page.screenshot({ path: join(artifacts, name + '.png'), fullPage: false });
  const noOverflow = async () =>
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'document overflow',
    );
  const axe = async () => {
    if (!(await page.evaluate(() => !!window.axe)))
      await page.addScriptTag({ path: join(root, 'node_modules/axe-core/axe.min.js') });
    const violations = await page.evaluate(async () =>
      (await window.axe.run(document)).violations
        .filter((v) => ['critical', 'serious'].includes(v.impact))
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    );
    assert.deepEqual(violations, []);
  };
  const open = async () => {
    await page.click('.vict-nav-toggle');
    await page.waitForSelector('.vict-navigation-drawer', { visible: true });
    await page.waitForFunction(() =>
      document.querySelector('.vict-navigation-drawer')?.contains(document.activeElement),
    );
    assert.equal(
      await page.$eval('.vict-nav-toggle', (el) => el.getAttribute('aria-expanded')),
      'true',
    );
  };
  const closed = async (restore = true) => {
    await countDialogs(0);
    assert.equal(
      await page.$eval('.vict-nav-toggle', (el) => el.getAttribute('aria-expanded')),
      'false',
    );
    if (restore)
      await page.waitForFunction(() =>
        document.activeElement?.classList.contains('vict-nav-toggle'),
      );
    // Bits UI defers final body-style restoration to cover same-tick nested dialogs.
    await page.waitForFunction(() => getComputedStyle(document.body).overflow !== 'hidden');
  };
  for (const app of ['requests', 'workspace']) {
    await check(app + ': separate definition and desktop shell', async () => {
      await go('/' + app);
      assert.equal(
        await page.$eval('.vict-shell', (el) => el.dataset.navigation),
        app === 'requests' ? 'sidebar' : 'top',
      );
      assert.equal(
        await page.$eval('.vict-nav-toggle', (el) => getComputedStyle(el).display),
        'none',
      );
      assert.notEqual(
        await page.$eval('[data-desktop-navigation]', (el) => getComputedStyle(el).display),
        'none',
      );
      await noOverflow();
      await axe();
      await shot(app + '-1440');
    });
    for (const width of [430, 390, 320]) {
      await check(
        app + ': drawer keyboard, backdrop, scroll, focus and overflow at ' + width,
        async () => {
          await go('/' + app, width);
          assert.equal(await page.$('.vict-navigation-drawer'), null);
          assert.equal(
            await page.$eval('.vict-nav-toggle', (el) => el.getAttribute('aria-label')),
            'Open navigation menu',
          );
          assert.equal(
            await page.$eval('.vict-nav-toggle', (el) => el.getAttribute('aria-expanded')),
            'false',
          );
          await noOverflow();
          if (width === 390) await shot(app + '-390-closed');
          const mainY = await page.$eval('main', (el) => el.getBoundingClientRect().top);
          await open();
          assert.equal(
            await page.$eval('main', (el) => el.getBoundingClientRect().top),
            mainY,
            'drawer pushed content',
          );
          assert.equal(
            await page.$eval('.vict-navigation-drawer [aria-current="page"]', (el) =>
              el.getAttribute('href'),
            ),
            '/' + app,
          );
          assert.ok(
            await page.$eval(
              '.vict-navigation-drawer',
              (el) => el.getBoundingClientRect().right <= innerWidth,
            ),
            'drawer width',
          );
          for (let i = 0; i < 8; i++) {
            await page.keyboard.press('Tab');
            assert.ok(
              await page.$eval('.vict-navigation-drawer', (el) =>
                el.contains(document.activeElement),
              ),
              'focus escaped',
            );
          }
          await page.keyboard.down('Shift');
          await page.keyboard.press('Tab');
          await page.keyboard.up('Shift');
          assert.ok(
            await page.$eval('.vict-navigation-drawer', (el) =>
              el.contains(document.activeElement),
            ),
          );
          await page.evaluate(() =>
            document.querySelector('main input, main button, main a')?.focus(),
          );
          await page.waitForFunction(() =>
            document.querySelector('.vict-navigation-drawer')?.contains(document.activeElement),
          );
          const beforeScroll = await page.evaluate(() => scrollY);
          await page.mouse.move(width - 4, 720);
          await page.mouse.wheel({ deltaY: 600 });
          await new Promise((resolve) => setTimeout(resolve, 150));
          assert.equal(await page.evaluate(() => scrollY), beforeScroll, 'background scrolled');
          await noOverflow();
          await axe();
          if (width === 390 || (width === 320 && app === 'requests'))
            await shot(app + '-' + width + '-open');
          await page.keyboard.press('Escape');
          await closed();
          await open();
          await page.click('.vict-navigation-close');
          await closed();
          await open();
          await page.mouse.click(width - 6, 450);
          await closed();
        },
      );
    }
    await check(app + ': selection closes and desktop resize releases modal', async () => {
      await go('/' + app, 390);
      await open();
      const target = app === 'requests' ? '/requests/feedback' : '/workspace/notes';
      await page.click('.vict-navigation-drawer a[href="' + target + '"]');
      await page.waitForFunction((path) => location.pathname === path, {}, target);
      await closed(false);
      await open();
      await page.setViewport({ width: 1440, height: 1000 });
      await closed(false);
      assert.notEqual(
        await page.$eval('[data-desktop-navigation]', (el) => getComputedStyle(el).display),
        'none',
      );
      assert.notEqual(
        await page.evaluate(() => getComputedStyle(document.body).overflow),
        'hidden',
      );
      await page.click('[data-desktop-navigation] a[href="/' + app + '"]');
      await page.waitForFunction((path) => location.pathname === path, {}, '/' + app);
      assert.equal(await page.$('[role="dialog"]'), null);
    });
  }
  await check('application-defined navigation thresholds differ at 800px', async () => {
    await go('/requests', 800);
    assert.equal(
      await page.$eval('.vict-nav-toggle', (el) => getComputedStyle(el).display),
      'none',
    );
    await go('/workspace', 800);
    assert.notEqual(
      await page.$eval('.vict-nav-toggle', (el) => getComputedStyle(el).display),
      'none',
    );
  });
  for (const width of [1440, 390]) {
    await check('form feedback lifecycle and accessibility at ' + width, async () => {
      await go('/requests', width);
      const form = '[data-surface="records.form"]';
      await page.click(form + ' [type="submit"]');
      await page.waitForSelector(form + ' [aria-invalid="true"]');
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'name');
      assert.ok(
        await page.$eval(
          form + ' [aria-invalid="true"]',
          (el) => !!document.getElementById(el.getAttribute('aria-describedby'))?.textContent,
        ),
      );
      assert.equal(
        await page.$eval(form + ' [data-testid="action-success"]', (el) => el.textContent),
        '',
      );
      await page.$eval(form, (el) => el.scrollIntoView({ block: 'center' }));
      await axe();
      await shot('feedback-invalid-' + width);
      await page.type(form + ' [name="name"]', 'Composition review ' + width);
      await page.select(form + ' select[name="comment"]', 'Product');
      await page.type(form + ' [name="rank"]', '55');
      await page.click(form + ' [type="submit"]');
      await page.waitForFunction(
        (selector) => document.querySelector(selector)?.textContent.includes('Request saved.'),
        {},
        form + ' [data-testid="action-success"]',
      );
      await page.waitForNetworkIdle();
      assert.ok(
        await page.$eval(form + ' [data-testid="action-success"]', (el) =>
          el.textContent.includes('Request saved.'),
        ),
        'confirmation survived data refresh',
      );
      assert.equal(await page.$('[data-testid="result-state"]'), null);
      assert.equal(await page.$(form + ' [aria-invalid="true"]'), null);
      await page.$eval(form, (el) => el.scrollIntoView({ block: 'center' }));
      await axe();
      await shot('feedback-saved-' + width);
      // A new invalid submission replaces the previous success locally.
      await page.$eval(form + ' [name="name"]', (el) => {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.click(form + ' [type="submit"]');
      await page.waitForSelector(form + ' [aria-invalid="true"]');
      assert.equal(
        await page.$eval(form + ' [data-testid="action-success"]', (el) => el.textContent),
        '',
      );
      await noOverflow();
      await page.type(form + ' [name="name"]', 'Check the score');
      await page.select(form + ' select[name="comment"]', 'Product');
      await page.$eval(form + ' [name="rank"]', (el) => {
        el.value = '999';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.click(form + ' [type="submit"]');
      await page.waitForFunction(
        (selector) => document.querySelector(selector)?.textContent.includes('between 0 and 100'),
        {},
        form + ' [data-testid="form-field-error-rank"]',
      );
      await page.waitForFunction(() => document.activeElement?.getAttribute('name') === 'rank');
      assert.equal(
        await page.$eval(form + ' [data-testid="action-success"]', (el) => el.textContent),
        '',
      );
      assert.equal(await page.$(form + ' .vict-form-summary'), null);
      await page.$eval(form, (el) => el.scrollIntoView({ block: 'center' }));
      await axe();
      await shot('feedback-server-validation-' + width);
    });
    for (const outcome of ['failure', 'denial']) {
      await check(outcome + ': persistent server outcome beside Save at ' + width, async () => {
        await go('/requests/feedback', width);
        if (outcome === 'denial') {
          const tabs = await page.$$('[role="tab"]');
          for (const tab of tabs)
            if ((await tab.evaluate((el) => el.textContent)).includes('Access denied'))
              await tab.click();
        }
        const form = '[data-surface="review.' + outcome + '"]';
        await page.type(form + ' input', 'Preserve this draft');
        await page.click(form + ' [type="submit"]');
        await page.waitForFunction(
          (selector) => !!document.querySelector(selector)?.textContent.trim(),
          {},
          form + ' [role="alert"]',
        );
        assert.equal(await page.$eval(form + ' input', (el) => el.value), 'Preserve this draft');
        assert.equal(
          await page.$eval(
            form + ' [role="alert"]',
            (el) => el.closest('.vict-form-actions') !== null,
          ),
          true,
        );
        await page.waitForFunction(
          (selector) =>
            document.activeElement ===
            document.querySelector(selector + ' [data-testid="form-submit"]'),
          {},
          form,
        );
        await new Promise((resolve) => setTimeout(resolve, 250));
        assert.ok(
          await page.$eval(
            form + ' [role="alert"]',
            (el, state) =>
              el.textContent.includes(state === 'failure' ? 'Try Save again' : 'workspace owner'),
            outcome,
          ),
        );
        await axe();
        await noOverflow();
        await shot('feedback-' + outcome + '-' + width);
      });
    }
  }
  await check('action endpoint keeps applications scoped', async () => {
    const response = await fetch(base + '/api/act?application=app.workspace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId: 'act.create', input: {} }),
    });
    assert.equal((await response.json()).code, 'UNKNOWN_ACTION');
  });
  assert.deepEqual(errors, []);
  writeFileSync(
    join(artifacts, 'checks.json'),
    JSON.stringify({ checks, browserErrors: errors, passed: true }, null, 2) + '\n',
  );
  console.log('PASS ' + checks.length + ' browser groups');
} finally {
  await browser?.close();
  server.kill();
}
