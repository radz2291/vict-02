// @vitest-environment node
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

/**
 * REAL-browser evidence for the coding-agent product proof: the complete
 * interaction path (choose project/session, approve, advance, simulate a
 * failure, inspect the output log, retry, message with a retained draft,
 * reset via the demo dialog), keyboard/drawer behaviour, document
 * overflow at 1440/768/390/320, an axe-core smoke scan, and the owner
 * review screenshots (qa-artifacts/agent-workspace/).
 */

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const APP_DIR = resolve(HERE, '..');
const ARTIFACT_DIR = resolve(APP_DIR, '..', '..', 'qa-artifacts', 'agent-workspace');

function findBrowser(): string {
  const candidates = [
    process.env.VICT_BROWSER_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].filter((path): path is string => typeof path === 'string');
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error('No Chrome/Edge installation found; set VICT_BROWSER_PATH.');
}

let browser: Browser | undefined;
let workDir: string;
let baseUrl: string;
const started: ChildProcess[] = [];

async function startProductServer(): Promise<string> {
  const child = spawn(process.execPath, ['build'], {
    cwd: APP_DIR,
    env: { ...process.env, PORT: '0', VICT_PRODUCT: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  started.push(child);
  return new Promise<string>((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error('server did not start')), 30_000);
    child.stdout?.on('data', (chunk: Buffer) => {
      const match = /http:\/\/[^\s:]+:(\d+)/.exec(chunk.toString());
      if (match !== null) {
        clearTimeout(timer);
        resolvePromise(`http://127.0.0.1:${match[1]}`);
      }
    });
    child.on('exit', (code) => rejectPromise(new Error(`server exited early: ${String(code)}`)));
  });
}

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'vict-agent-browser-'));
  // Always rebuild: this suite must exercise the CURRENT product source.
  const build = spawnSync('npx', ['vite', 'build'], {
    cwd: APP_DIR,
    encoding: 'utf8',
    timeout: 420_000,
    shell: process.platform === 'win32',
  });
  if (build.status !== 0) {
    throw new Error(`showcase build failed: ${build.stderr?.slice(-2000)}`);
  }
  baseUrl = await startProductServer();
  browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
  } catch {
    /* already exists */
  }
}, 480_000);

afterAll(async () => {
  try {
    await browser?.close();
  } catch {
    /* already closed */
  }
  for (const process of started.splice(0)) {
    try {
      process.kill();
    } catch {
      /* already gone */
    }
  }
  if (workDir !== undefined) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        rmSync(workDir, { recursive: true, force: true });
        break;
      } catch {
        void 0;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
    }
  }
});

const pageErrors: string[] = [];

async function newPage(width: number, height: number): Promise<Page> {
  const page = await browser!.newPage();
  await page.setViewport({ width, height });
  pageErrors.splice(0);
  page.on('pageerror', (error) => {
    pageErrors.push(String(error));
  });
  return page;
}

function expectNoPageErrors(): void {
  expect(pageErrors).toEqual([]);
}

async function documentOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(ARTIFACT_DIR, `${name}.png`) });
}

/** The QA evidence record for this run (machine-readable companion). */
const evidence: { baseUrl: string; checks: { check: string; ok: boolean }[] } = {
  baseUrl: 'dynamic',
  checks: [],
};

async function open(page: Page, path: string): Promise<void> {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="vict-host"]');
}

async function waitForSelector(page: Page, selector: string, timeoutMs = 10_000): Promise<void> {
  await page.waitForSelector(selector, { timeout: timeoutMs });
}

/**
 * Clicks through Svelte re-render churn: waits for the element, then
 * retries the click if the node is replaced mid-click (an invalidation
 * remount can swap the control between query and click).
 */
async function clickWhenReady(page: Page, selector: string, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    (sel) => document.querySelector(sel) !== null,
    { timeout: timeoutMs },
    selector,
  );
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const handle = await page.$(selector);
    if (handle !== null) {
      try {
        await handle.click();
        return;
      } catch {
        /* detached between query and click; retry */
      }
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
  }
  throw new Error(`clickWhenReady failed: ${selector}`);
}

const AXE_PATH = resolve(APP_DIR, '..', '..', 'node_modules', 'axe-core', 'axe.min.js');

async function scanAccessibility(
  page: Page,
): Promise<{ violations: { id: string; impact: string | null }[] }> {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    const axeApi = (
      window as unknown as {
        axe: {
          run(document: Document): Promise<{ violations: { id: string; impact: string | null }[] }>;
        };
      }
    ).axe;
    return axeApi.run(document);
  });
}

describe('coding-agent workspace in a real browser (product proof)', () => {
  it('the sessions chooser lists every state and the project filter narrows it', async () => {
    const page = await newPage(1440, 900);
    try {
      await open(page, '/agent');
      await waitForSelector(page, '[data-testid="session-card"]');
      const cards = await page.$$eval('[data-testid="session-card"]', (els) =>
        els.map((el) => (el as HTMLElement).dataset.status),
      );
      expect(cards).toEqual(['awaiting_approval', 'running', 'running', 'failed', 'completed']);
      // Project filter (catalog Select), driven by KEYBOARD: open, typeahead
      // to the project, commit — then exactly one session remains.
      await page.focus('.picker-select');
      await page.keyboard.press('Enter');
      await page.waitForSelector('[role="listbox"] [role="option"]');
      await page.keyboard.type('ops-console');
      await page.keyboard.press('Enter');
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
      const narrowed = await page.$$eval('[data-testid="session-card"]', (els) =>
        els.map((el) => el.textContent?.includes('AGW-104')),
      );
      expect(narrowed).toHaveLength(1);
      expect(await documentOverflow(page)).toBeLessThanOrEqual(2);
      expectNoPageErrors();
      await shoot(page, '01-sessions-1440');
      evidence.checks.push({ check: 'sessions-chooser', ok: true });
    } finally {
      await page.close();
    }
  }, 180_000);

  it('approval: a waiting session presents approve/decline and approve resumes it', async () => {
    const page = await newPage(1440, 900);
    try {
      await open(page, '/agent/sessions/AGW-101');
      await waitForSelector(page, '[data-testid="approval-panel"]');
      expect(await page.$('[data-testid="decline-btn"]')).not.toBeNull();
      expect(await documentOverflow(page)).toBeLessThanOrEqual(2);
      await shoot(page, '02-approval-waiting-1440');
      await clickWhenReady(page, '[data-testid="approve-btn"]');
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="session-status"]')
            ?.textContent?.includes('Running'),
        { timeout: 15_000 },
      );
      const progress = await page.$eval('[data-testid="session-progress"]', (el) =>
        el.getAttribute('aria-valuenow'),
      );
      expect(progress).toBe('45');
      await page.waitForFunction(() =>
        document.body.textContent?.includes('Approved — Victor resumed the session.'),
      );
      await shoot(page, '03-running-after-approval-1440');
      // Advance one deterministic step.
      await clickWhenReady(page, '[data-testid="advance-btn"]');
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="session-progress"]')
            ?.getAttribute('aria-valuenow') === '70',
        { timeout: 15_000 },
      );
      expectNoPageErrors();
      evidence.checks.push({ check: 'approval-flow', ok: true });
    } finally {
      await page.close();
    }
  }, 180_000);

  it('failure and recovery: simulate failure, read the output log, retry, and message the session', async () => {
    const page = await newPage(1440, 900);
    try {
      await open(page, '/agent/sessions/AGW-102');
      await waitForSelector(page, '[data-testid="advance-btn"]');
      await clickWhenReady(page, '[data-testid="fail-btn"]');
      await page.waitForFunction(
        () =>
          document.querySelector('[data-testid="session-status"]')?.textContent?.includes('Failed'),
        { timeout: 15_000 },
      );
      await shoot(page, '04-failure-1440');
      // The output log carries the failure lines.
      await page.click('.vict-tablist [role="tab"]:nth-of-type(3)');
      await waitForSelector(page, '[data-testid="log-viewport"]');
      const logLines = await page.$$eval('[data-testid="log-line"]', (els) =>
        els.map((el) => (el as HTMLElement).dataset.level),
      );
      expect(logLines).toContain('error');
      await shoot(page, '05-output-log-1440');
      // Recovery: retry from checkpoint, then converse.
      await clickWhenReady(page, '[data-testid="retry-btn"]');
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-testid="session-status"]')
            ?.textContent?.includes('Running'),
        { timeout: 15_000 },
      );
      const before = await page.$$eval('[data-testid="conversation-message"]', (els) => els.length);
      await page.type('[data-testid="conversation-input"]', 'Thanks — how did the retry go?');
      await clickWhenReady(page, '[data-testid="conversation-send"]');
      await page.waitForFunction(
        (expected) =>
          document.querySelectorAll('[data-testid="conversation-message"]').length === expected,
        { timeout: 15_000 },
        before + 2,
      );
      expectNoPageErrors();
      evidence.checks.push({ check: 'failure-recovery-message', ok: true });
      await shoot(page, '06-recovered-conversation-1440');
    } finally {
      await page.close();
    }
  }, 240_000);

  it('a stopped session keeps the draft and shows the safe failure text', async () => {
    const page = await newPage(1440, 900);
    try {
      await open(page, '/agent/sessions/AGW-105');
      await waitForSelector(page, '[data-testid="retry-btn"]');
      await page.type(
        '[data-testid="conversation-input"]',
        'Draft that must survive a failed send',
      );
      await clickWhenReady(page, '[data-testid="conversation-send"]');
      await page.waitForFunction(() =>
        document.querySelector('.vict-send-error')?.textContent?.includes('Victor can’t take new'),
      );
      const draft = await page.$eval(
        '[data-testid="conversation-input"]',
        (el) => (el as HTMLInputElement).value,
      );
      expect(draft).toBe('Draft that must survive a failed send');
      await shoot(page, '07-draft-retained-on-failure-1440');
      expectNoPageErrors();
      evidence.checks.push({ check: 'draft-retention', ok: true });
    } finally {
      await page.close();
    }
  }, 180_000);

  it('the reset dialog restores the whole demo deterministically', async () => {
    const page = await newPage(1440, 900);
    try {
      await open(page, '/agent');
      await waitForSelector(page, '[data-testid="reset-open"]');
      await clickWhenReady(page, '[data-testid="reset-open"]');
      await waitForSelector(page, '[data-testid="reset-confirm"]');
      await clickWhenReady(page, '[data-testid="reset-confirm"]');
      await page.waitForFunction(() => document.body.textContent?.includes('Demo data restored.'));
      // AGW-101 is waiting again.
      await page.waitForFunction(
        () => {
          const card = [...document.querySelectorAll('[data-testid="session-card"]')].find((el) =>
            el.textContent?.includes('AGW-101'),
          );
          return card !== undefined && (card as HTMLElement).dataset.status === 'awaiting_approval';
        },
        { timeout: 15_000 },
      );
      const dialogGone = await page.$('[role="alertdialog"]');
      expect(dialogGone).toBeNull();
      expectNoPageErrors();
      evidence.checks.push({ check: 'reset-dialog', ok: true });
    } finally {
      await page.close();
    }
  }, 180_000);

  it('keyboard: the mobile drawer opens from the keyboard, closes with Escape, and restores focus', async () => {
    const page = await newPage(390, 800);
    try {
      await open(page, '/agent');
      await waitForSelector(page, '.vict-nav-toggle');
      await page.focus('.vict-nav-toggle');
      await page.keyboard.press('Enter');
      await page.waitForSelector('[data-testid="vict-host"] [aria-label="Application mobile"] a');
      await shoot(page, '08-mobile-drawer-390');
      await page.keyboard.press('Escape');
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
      const restored = await page.evaluate(() => ({
        tag: document.activeElement?.className ?? '',
        drawerOpen: document.querySelector('.vict-navigation-drawer') !== null,
      }));
      expect(restored.drawerOpen).toBe(false);
      expect(restored.tag).toContain('vict-nav-toggle');
      expect(await documentOverflow(page)).toBeLessThanOrEqual(2);
      expectNoPageErrors();
      evidence.checks.push({ check: 'drawer-keyboard', ok: true });
    } finally {
      await page.close();
    }
  }, 180_000);

  it('mobile workspace: the current task leads, secondary panels follow deliberately', async () => {
    for (const [width, name] of [
      [768, '09-workspace-768'],
      [390, '10-workspace-390'],
      [320, '11-sessions-320'],
    ] as const) {
      const page = await newPage(width, 900);
      try {
        await open(page, '/agent/sessions/AGW-101');
        await waitForSelector(page, '[data-testid="session-console"]');
        const positions = await page.evaluate(() => {
          const rect = (selector: string) =>
            document.querySelector(selector)?.getBoundingClientRect().top ?? -1;
          return {
            task: rect('[data-testid="session-console"]'),
            conversation: rect('[data-testid="conversation-feed"]'),
            inspector: rect('[data-testid="vict-host"] .vict-tabs'),
          };
        });
        expect(positions.task).toBeGreaterThanOrEqual(0);
        expect(positions.task).toBeLessThan(positions.inspector);
        expect(await documentOverflow(page)).toBeLessThanOrEqual(2);
        expectNoPageErrors();
        await shoot(page, name);
      } finally {
        await page.close();
      }
    }
    evidence.checks.push({ check: 'responsive-stack', ok: true });
  }, 240_000);

  it('accessibility smoke scan on the chooser and a waiting workspace', async () => {
    for (const route of ['/agent', '/agent/sessions/AGW-101']) {
      const page = await newPage(1440, 900);
      try {
        await open(page, route);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 600));
        const results = await scanAccessibility(page);
        const blocking = results.violations.filter(
          (violation) => violation.impact === 'critical' || violation.impact === 'serious',
        );
        expect(
          blocking.map((violation) => `${violation.id}: ${violation.impact}`),
          route,
        ).toEqual([]);
        expectNoPageErrors();
      } finally {
        await page.close();
      }
    }
    evidence.checks.push({ check: 'axe-smoke', ok: true });
  }, 240_000);

  afterAll(() => {
    try {
      writeFileSync(join(ARTIFACT_DIR, 'browser-evidence.json'), JSON.stringify(evidence, null, 2));
    } catch {
      /* evidence file is best-effort */
    }
  });
});
