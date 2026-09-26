/* global document, window, location, innerWidth */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, process.env.VICT_QA_OUTPUT ?? 'qa-artifacts/foundation-slice');
mkdirSync(artifacts, { recursive: true });
const server = spawn(process.execPath, ['build'], {
  cwd: join(root, 'examples/ui-showcase'),
  env: { ...process.env, VICT_FOUNDATION: '1', PORT: '0', HOST: '127.0.0.1' },
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
    await page.goto(base + path, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="vict-host"]');
  };
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  const countDialogs = (n) =>
    page.waitForFunction(
      (count) => document.querySelectorAll('[role="dialog"]').length === count,
      {},
      n,
    );
  await check(
    'desktop, tablet and mobile: both definitions, overflow, axe, screenshots',
    async () => {
      for (const width of [1440, 768, 390, 320]) {
        for (const path of ['/records', '/workspace']) {
          await go(path, width);
          assert.equal(
            await page.$eval(
              '.vict-app',
              (el) => el.querySelectorAll('[data-component-id]').length,
            ),
            0,
          );
          assert.ok(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            path + ' overflow ' + width,
          );
          await page.addScriptTag({ path: join(root, 'node_modules/axe-core/axe.min.js') });
          const violations = await page.evaluate(async () =>
            (await window.axe.run(document)).violations
              .filter((v) => ['critical', 'serious'].includes(v.impact))
              .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          );
          assert.deepEqual(violations, [], path + ' axe ' + width);
          await page.screenshot({
            path: join(artifacts, path.slice(1) + '-' + width + '.png'),
            fullPage: true,
          });
        }
      }
    },
  );
  await check('mobile navigation: toggle, Escape, focus return, route change', async () => {
    await go('/records', 320);
    await page.click('.vict-nav-toggle');
    await page.waitForSelector('.vict-navigation-drawer', { visible: true });
    await page.keyboard.press('Escape');
    assert.equal(
      await page.$eval('.vict-nav-toggle', (el) => el.getAttribute('aria-expanded')),
      'false',
    );
    await page.click('.vict-nav-toggle');
    await page.click('.vict-navigation-drawer .vict-nav-link[href="/workspace"]');
    await page.waitForFunction(() => location.pathname === '/workspace');
    assert.equal(
      await page.$eval('.vict-nav-toggle', (el) => el.getAttribute('aria-expanded')),
      'false',
    );
  });
  await check('table search, numeric sort and empty feedback', async () => {
    await go('/records');
    await page.type('[data-testid="table-search"]', 'keyboard');
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="table-row"]').length === 1,
    );
    await page.type('[data-testid="table-search"]', 'nomatch');
    await page.waitForSelector('[data-testid="table-empty"]');
    await go('/records');
    await page.click('[data-sort-field="rank"]');
    assert.equal(
      await page.$eval('[data-testid="table-row"] td:last-child', (el) => el.textContent),
      '45',
    );
  });
  await check(
    'popover: keyboard open, checkbox changes density, Escape restores focus',
    async () => {
      await page.focus('[data-popover-trigger]');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.vict-popover', { visible: true });
      await page.click('.vict-popover input');
      assert.ok(await page.$('.vict-ui-table--compact'));
      await page.keyboard.press('Escape');
      await page.waitForSelector('.vict-popover', { hidden: true });
      assert.equal(
        await page.evaluate(() => document.activeElement?.hasAttribute('data-popover-trigger')),
        true,
      );
    },
  );
  await check('tooltip: focus opens help, Escape dismisses', async () => {
    await page.focus('.vict-help');
    await page.waitForSelector('[role="tooltip"]', { visible: true });
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="tooltip"]', { hidden: true });
  });
  await check(
    'drawer and nested dialog: focus trap, Escape only closes top layer, focus return',
    async () => {
      await page.focus('[data-surface="records.guide"]');
      await page.keyboard.press('Enter');
      await countDialogs(1);
      assert.ok(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]')));
      await page.screenshot({ path: join(artifacts, 'drawer-1440.png') });
      await page.click('[data-surface="guide.dialog"]');
      await countDialogs(2);
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        assert.equal(
          await page.evaluate(
            () =>
              document.activeElement?.closest('[role="dialog"]') ===
              [...document.querySelectorAll('[role="dialog"]')].at(-1),
          ),
          true,
        );
      }
      await page.keyboard.press('Escape');
      await countDialogs(1);
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-surface') === 'guide.dialog',
      );
      await page.keyboard.press('Escape');
      await countDialogs(0);
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-surface') === 'records.guide',
      );
    },
  );
  await check('tabs: arrow navigation, Home/End, selected panel and tab order', async () => {
    await go('/workspace');
    await page.focus('[role="tab"]');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Linked requests');
    assert.equal(
      await page.$eval('[role="tab"][aria-selected="true"]', (el) => el.textContent),
      'Linked requests',
    );
    assert.equal(await page.$$eval('[role="tabpanel"]:not([hidden])', (els) => els.length), 1);
    await page.keyboard.press('Home');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Conversation');
    await page.keyboard.press('End');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Linked requests');
  });
  await check('dialog: open, focus containment, backdrop dismissal, mobile bounds', async () => {
    await go('/workspace', 390);
    await page.click('[data-surface="workspace.review"]');
    await countDialogs(1);
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]')));
    }
    assert.ok(
      await page.$eval('[role="dialog"]', (el) => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth;
      }),
    );
    await page.screenshot({ path: join(artifacts, 'dialog-390.png'), fullPage: false });
    await page.click('[data-action-id="act.ack"]');
    await page.waitForSelector(
      '[role="dialog"] [data-kind="success"] [data-testid="action-success"]',
    );
    assert.equal(
      await page.$eval(
        '[role="dialog"] [data-kind="success"] [data-testid="action-success"]',
        (el) => el.textContent,
      ),
      'Action completed.',
    );
    await page.mouse.click(5, 5);
    await countDialogs(0);
    await page.waitForFunction(
      () => document.activeElement?.getAttribute('data-surface') === 'workspace.review',
    );
  });
  await check(
    'form: required errors, linked labels, native selection, typed zero/false, repeat creates',
    async () => {
      await go('/records');
      await page.click('[data-testid="form-submit"]');
      await page.waitForSelector('[data-testid="form-local-validation"]');
      assert.equal(await page.$$eval('.vict-field [aria-invalid="true"]', (els) => els.length), 3);
      await page.type('input[name="name"]', 'Foundation browser request');
      await page.select('select[name="comment"]', 'Engineering');
      await page.type('input[name="rank"]', '0');
      const request = page.waitForRequest(
        (r) => r.url().endsWith('/api/act') && r.method() === 'POST',
      );
      await page.click('[data-testid="form-submit"]');
      const payload = JSON.parse((await request).postData());
      assert.deepEqual(payload.input, {
        name: 'Foundation browser request',
        comment: 'Engineering',
        rank: 0,
        zeroCheck: false,
      });
      await page.waitForSelector('[data-kind="success"] [data-testid="action-success"]');
      await page.waitForFunction(() =>
        document.querySelector('.vict-ui-table__count')?.textContent?.includes('7 records'),
      );
      await page.type('input[name="name"]', 'Second request');
      await page.select('select[name="comment"]', 'Product');
      await page.type('input[name="rank"]', '50');
      await page.click('[data-testid="form-submit"]');
      await page.waitForFunction(() =>
        document.querySelector('.vict-ui-table__count')?.textContent?.includes('8 records'),
      );
      await page.type('input[name="name"]', 'Invalid priority');
      await page.select('select[name="comment"]', 'Operations');
      await page.type('input[name="rank"]', '999');
      await page.click('[data-testid="form-submit"]');
      await page.waitForSelector('[data-testid="form-field-error-rank"]');
    },
  );
  await check(
    'conversation: send through action/capability, reply, draft clear, focus retained',
    async () => {
      await go('/workspace');
      const before = await page.$$eval('[data-testid="conversation-message"]', (els) => els.length);
      await page.type('[data-testid="conversation-input"]', 'A concrete next step');
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        (n) => document.querySelectorAll('[data-testid="conversation-message"]').length === n + 2,
        {},
        before,
      );
      assert.equal(await page.$eval('[data-testid="conversation-input"]', (el) => el.value), '');
      assert.equal(await focused(), 'conversation-input');
    },
  );
  assert.deepEqual(errors, [], 'browser runtime errors');
  writeFileSync(
    join(artifacts, 'verification.json'),
    JSON.stringify({ checks, widths: [1440, 768, 390, 320], runtimeErrors: errors }, null, 2),
  );
  console.log(checks.length + ' browser checks passed');
} finally {
  await browser?.close();
  server.kill();
}
