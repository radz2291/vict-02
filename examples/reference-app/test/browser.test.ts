// @vitest-environment node
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

/**
 * REAL-browser evidence for the reference application (Stage 05):
 * keyboard navigation and focus behavior, accessible dialog semantics,
 * responsive navigation at mobile and desktop viewport sizes, and
 * automated accessibility scans (axe-core). This is not DOM emulation —
 * a real Chromium browser drives the built application.
 *
 * The browser executable is discovered from VICT_BROWSER_PATH or the
 * standard Chrome/Edge install paths (no download, no telemetry).
 */

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const APP_DIR = resolve(HERE, '..');

function findBrowser(): string {
  const candidates = [
    process.env.VICT_BROWSER_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].filter((path): path is string => typeof path === 'string');
  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }
  throw new Error(
    'No Chrome/Edge installation found for the browser scenario; set VICT_BROWSER_PATH.',
  );
}

let browser: Browser | undefined;
let workDir: string;
let baseUrl: string;
const started: ChildProcess[] = [];

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'vict-refapp-browser-'));
  // Build once if the built server is not present yet.
  if (!existsSync(join(APP_DIR, 'build', 'index.js'))) {
    const build = spawnSync('npx', ['vite', 'build'], {
      cwd: APP_DIR,
      encoding: 'utf8',
      timeout: 300_000,
      shell: process.platform === 'win32',
    });
    if (build.status !== 0) {
      throw new Error(`reference app build failed: ${build.stderr?.slice(-2000)}`);
    }
  }
  const child = spawn(process.execPath, ['build'], {
    cwd: APP_DIR,
    env: { ...process.env, VICT_APPDATA_PATH: join(workDir, 'appdata.sqlite') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  started.push(child);
  baseUrl = await new Promise<string>((resolvePromise, rejectPromise) => {
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
  const browserPath = findBrowser();
  browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
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
  // Retry cleanup briefly (Windows may hold the SQLite file briefly).
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

async function newPage(width: number, height: number): Promise<Page> {
  const page = await browser!.newPage();
  await page.setViewport({ width, height });
  pageErrors.splice(0);
  page.on('pageerror', (error) => {
    pageErrors.push(String(error));
  });
  return page;
}

const pageErrors: string[] = [];
function expectNoPageErrors(): void {
  expect(pageErrors).toEqual([]);
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

async function seedProject(_page: Page, id: string, name: string): Promise<void> {
  // Seeding crosses the same /api/act boundary from the test process (Node
  // fetch), so the browser only ever sees real application state.
  void _page;
  const response = await fetch(`${baseUrl}/api/act`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      actionId: 'act.createProject',
      input: { id, name, status: 'active', budget: 100, owner: 'Ada' },
    }),
  });
  const body = (await response.json()) as { ok?: boolean };
  expect(body.ok).toBe(true);
}

describe('reference application in a real browser (desktop 1280x800)', () => {
  it('renders the projects table; keyboard navigation reaches and focuses the search control', async () => {
    const page = await newPage(1280, 800);
    try {
      await seedProject(page, 'alpha-1', 'Alpha');
      await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle0' });
      // Keyboard: Tab moves focus through the document; the search input is
      // reachable and shows a visible focus indication.
      for (let tab = 0; tab < 12; tab += 1) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
          const element = document.activeElement;
          if (element === null || !(element instanceof HTMLElement)) {
            return null;
          }
          const style = window.getComputedStyle(element);
          return {
            tag: element.tagName,
            testid: element.getAttribute('data-testid'),
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
          };
        });
        if (focused?.testid === 'table-search') {
          expect(focused.outlineStyle).not.toBe('none');
          break;
        }
      }
      const focusedNow = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid'),
      );
      expect(focusedNow).toBe('table-search');
      // Sort: click the Name header, aria-sort updates.
      await page.click('[data-sort-field="name"]');
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
      const sort = await page.evaluate(() =>
        document.querySelector('th[aria-sort]')?.getAttribute('aria-sort'),
      );
      expect(['ascending', 'descending']).toContain(sort);
    } finally {
      await page.close();
    }
  });

  it('dialog interaction: focus moves into the panel, Escape closes, focus restores', async () => {
    const page = await newPage(1280, 800);
    try {
      await page.goto(`${baseUrl}/projects/alpha-1`, { waitUntil: 'networkidle0' });
      const triggers = await page.$$('[data-testid="overlay-trigger"]');
      await triggers[0]?.click();
      await page.waitForSelector('[data-testid="overlay-panel"]');
      const focusedInDialog = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid'),
      );
      expect(focusedInDialog).toBe('overlay-panel');
      await page.keyboard.press('Escape');
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
      const overlayGone = await page.$('[data-testid="overlay"]');
      expect(overlayGone).toBeNull();
      const focusRestored = await page.evaluate(() =>
        document.activeElement?.hasAttribute('data-testid'),
      );
      expect(focusRestored).toBe(true);
    } finally {
      await page.close();
    }
  });

  it('theme customization applies the declared tokens', async () => {
    const page = await newPage(1280, 800);
    try {
      await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });
      const accent = await page.evaluate(() =>
        getComputedStyle(document.querySelector('[data-testid="vict-host"]') as HTMLElement)
          .getPropertyValue('--vict-color-accent')
          .trim(),
      );
      expect(accent).toBe('#0f766e'); // the reference definition's token override
    } finally {
      await page.close();
    }
  });

  it('passes the accessibility scan on the projects screen', async () => {
    const page = await newPage(1280, 800);
    try {
      await seedProject(page, 'alpha-1', 'Alpha');
      await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle0' });
      const results = await scanAccessibility(page);
      const blocking = results.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious',
      );
      expect(blocking.map((violation) => `${violation.id}: ${violation.impact}`)).toEqual([]);
      expectNoPageErrors();
    } finally {
      await page.close();
    }
  });

  it('passes the accessibility scan on the record detail (tabs + dialog + drawer)', async () => {
    const page = await newPage(1280, 800);
    try {
      await seedProject(page, 'alpha-1', 'Alpha');
      await page.goto(`${baseUrl}/projects/alpha-1`, { waitUntil: 'networkidle0' });
      const results = await scanAccessibility(page);
      const blocking = results.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious',
      );
      expect(blocking.map((violation) => `${violation.id}: ${violation.impact}`)).toEqual([]);
    } finally {
      await page.close();
    }
  });
});

describe('reference application in a real browser (mobile 390x844)', () => {
  it('navigation collapses responsively; the menu toggle expands it; no unusable overflow', async () => {
    const page = await newPage(390, 844);
    try {
      await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle0' });
      // The nav is collapsed behind the hamburger toggle.
      const toggleVisible = await page.evaluate(() => {
        const toggle = document.querySelector<HTMLElement>('.vict-nav-toggle');
        if (toggle === null) return false;
        const style = window.getComputedStyle(toggle);
        return style.display !== 'none' && toggle.offsetWidth > 0;
      });
      expect(toggleVisible).toBe(true);
      const navHidden = await page.evaluate(() => {
        const nav = document.querySelector<HTMLElement>('#vict-nav');
        return nav === null || window.getComputedStyle(nav).display === 'none';
      });
      expect(navHidden).toBe(true);
      // Expanding the menu reveals navigation links.
      await page.click('.vict-nav-toggle');
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
      const navVisible = await page.evaluate(() => {
        const nav = document.querySelector<HTMLElement>('#vict-nav');
        return nav !== null && window.getComputedStyle(nav).display !== 'none';
      });
      expect(navVisible).toBe(true);
      // Responsive behavior without unusable overflow.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(2);
    } finally {
      await page.close();
    }
  });

  it('passes the accessibility scan at mobile size', async () => {
    const page = await newPage(390, 844);
    try {
      await seedProject(page, 'alpha-1', 'Alpha');
      await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle0' });
      const results = await scanAccessibility(page);
      const blocking = results.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious',
      );
      expect(blocking.map((violation) => `${violation.id}: ${violation.impact}`)).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('table, search, and pagination remain usable at mobile size', async () => {
    const page = await newPage(390, 844);
    try {
      await seedProject(page, 'alpha-1', 'Alpha');
      await seedProject(page, 'beta-2', 'Beta');
      await seedProject(page, 'gamma-3', 'Gamma');
      await seedProject(page, 'delta-4', 'Delta');
      await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle0' });
      const usable = await page.evaluate(() => {
        const search = document.querySelector<HTMLInputElement>('[data-testid="table-search"]');
        const prev = document.querySelector<HTMLButtonElement>('[data-testid="table-prev"]');
        const next = document.querySelector<HTMLButtonElement>('[data-testid="table-next"]');
        return (
          search !== null &&
          search.offsetWidth > 0 &&
          prev !== null &&
          prev.offsetWidth > 0 &&
          next !== null &&
          next.offsetWidth > 0
        );
      });
      expect(usable).toBe(true);
      // Pagination works by real clicks on mobile.
      await page.click('[data-testid="table-next"]');
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
      const indicator = await page.evaluate(
        () => document.querySelector('[data-testid="table-page-indicator"]')?.textContent ?? '',
      );
      expect(indicator).toContain('Page 2');
      expectNoPageErrors();
    } finally {
      await page.close();
    }
  });
});
