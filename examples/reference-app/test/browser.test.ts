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
let dbPath: string;
let baseUrl: string;
const started: ChildProcess[] = [];

/** Start the built server over the shared SQLite database; resolve its URL. */
async function startServer(): Promise<string> {
  const child = spawn(process.execPath, ['build'], {
    cwd: APP_DIR,
    env: { ...process.env, VICT_APPDATA_PATH: dbPath },
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
  workDir = mkdtempSync(join(tmpdir(), 'vict-refapp-browser-'));
  dbPath = join(workDir, 'appdata.sqlite');
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
  baseUrl = await startServer();
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
/* ---------------------------------------------------------------------------
 * HIGH-05-A regression: the record EDIT form preserves typed values.
 *
 * Real user task: open an existing project, switch to the Edit tab, leave
 * the numeric field untouched, change only the Name field, submit. The
 * dispatched payload's TYPES are captured and asserted; the edit must be
 * visible, persisted as a number, and survive a REAL server restart over
 * the same SQLite database.
 * ------------------------------------------------------------------------- */
describe('record edit preserves typed values (HIGH-05-A regression)', () => {
  const PROJECT_ID = 'edit-e2e-1';
  const EDITED_NAME = 'Edit E2E (renamed)';

  async function readStoredProject(id: string): Promise<{ name: unknown; budget: unknown } | null> {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(dbPath);
    try {
      const row = db.prepare('SELECT data FROM appdata_projects WHERE identity = ?').get(id) as
        { data: string } | undefined;
      if (row === undefined) {
        return null;
      }
      const parsed = JSON.parse(row.data) as { name: unknown; budget: unknown };
      return { name: parsed.name, budget: parsed.budget };
    } finally {
      db.close();
    }
  }

  it('an untouched numeric prefill saves as a number and survives a real restart', async () => {
    const seeded = await fetch(`${baseUrl}/api/act`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        actionId: 'act.createProject',
        input: { id: PROJECT_ID, name: 'Edit E2E', status: 'active', budget: 42, owner: 'Ada' },
      }),
    });
    expect(((await seeded.json()) as { ok?: boolean }).ok).toBe(true);

    const page = await newPage(1280, 800);
    try {
      // 1-2. Open the existing record; switch to the Edit form.
      await page.goto(`${baseUrl}/projects/${PROJECT_ID}`, { waitUntil: 'networkidle0' });
      await page.click('[id="vict-tab-tb.detail-tabs-edit"]');
      await page.waitForSelector('[id="vict-field-f.project-edit-name"]');

      // Capture EVERY dispatched action payload (and its types) at the
      // real fetch boundary the renderer uses.
      await page.evaluate(() => {
        const original = window.fetch.bind(window);
        (window as unknown as { __capturedActions: unknown[] }).__capturedActions = [];
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
          const url =
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          if (
            url.includes('/api/act') &&
            init?.body !== undefined &&
            typeof init.body === 'string'
          ) {
            try {
              (window as unknown as { __capturedActions: unknown[] }).__capturedActions.push(
                JSON.parse(init.body) as unknown,
              );
            } catch {
              /* capture never breaks the app */
            }
          }
          return original(input, init);
        };
      });

      // 3-4. Leave the numeric field untouched; change only the text field.
      const budgetBefore = await page.$eval<HTMLInputElement>(
        '[id="vict-field-f.project-edit-budget"]',
        (input) => input.value,
      );
      expect(budgetBefore).toBe('42'); // untouched prefill display
      await page.$eval<HTMLInputElement>(
        '[id="vict-field-f.project-edit-name"]',
        (input, name) => {
          input.value = name as string;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        },
        EDITED_NAME,
      );

      // 5. Submit.
      await page.click('[data-testid="form-submit"]');

      // 6. Success is visible.
      await page.waitForSelector('[data-testid="result-state"]');

      // Capture check: the dispatched payload carried TYPED values.
      const captured = (await page.evaluate(
        () =>
          (
            window as unknown as {
              __capturedActions: { actionId: string; input: Record<string, unknown> }[];
            }
          ).__capturedActions,
      )) as { actionId: string; input: Record<string, unknown> }[];
      const update = captured.find((call) => call.actionId === 'act.updateProject');
      expect(update).toBeDefined();
      expect(typeof update!.input.budget).toBe('number'); // THE regression assertion
      expect(update!.input.budget).toBe(42);
      expect(update!.input.name).toBe(EDITED_NAME);
      expect(update!.input.status).toBe('active');
      expect(update!.input.__identity).toBe(PROJECT_ID);

      // 7. Reload the record and confirm the edit.
      await page.goto(`${baseUrl}/projects/${PROJECT_ID}`, { waitUntil: 'networkidle0' });
      const detailText = await page.evaluate(() => document.body.innerText);
      expect(detailText).toContain(EDITED_NAME);

      // 8. The stored numeric value remains a number (direct SQLite read).
      const stored = await readStoredProject(PROJECT_ID);
      expect(stored).not.toBeNull();
      expect(typeof stored!.budget).toBe('number');
      expect(stored!.budget).toBe(42);
      expect(stored!.name).toBe(EDITED_NAME);
    } finally {
      await page.close();
    }

    // 9. Restart the built server over the SAME SQLite database.
    const current = started[started.length - 1];
    current.kill('SIGKILL');
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    started.pop();
    baseUrl = await startServer();

    // 10. The edit and its numeric type survive the restart.
    const restarted = await fetch(`${baseUrl}/projects/${PROJECT_ID}`);
    expect(restarted.status).toBe(200);
    expect(await restarted.text()).toContain(EDITED_NAME);
    const storedAfterRestart = await readStoredProject(PROJECT_ID);
    expect(storedAfterRestart).not.toBeNull();
    expect(typeof storedAfterRestart!.budget).toBe('number');
    expect(storedAfterRestart!.budget).toBe(42);
    expect(storedAfterRestart!.name).toBe(EDITED_NAME);
  }, 180_000);
});

/* ---------------------------------------------------------------------------
 * MED-05-A regression: responsive navigation layout integrity.
 *
 * Real bounding-box evidence at every supported breakpoint: opening the
 * mobile menu must NEVER squeeze the main content into an implicit grid
 * column, must stay inside the shell/viewport, and must restore cleanly.
 * Navigation policy: the menu CLOSES after navigating to another screen.
 * ------------------------------------------------------------------------- */

interface LayoutMeasurement {
  viewport: { width: number; height: number };
  shell: { x: number; y: number; width: number; height: number };
  nav: { x: number; y: number; width: number; height: number; display: string } | null;
  main: { x: number; y: number; width: number; height: number };
  toggleDisplay: string;
  navExpanded: string | null;
  shellTracks: string;
  scrollWidth: number;
  clientWidth: number;
}

async function measureLayout(page: Page): Promise<LayoutMeasurement> {
  return page.evaluate(() => {
    const rect = (element: Element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    const shell = document.querySelector<HTMLElement>('.vict-shell');
    const nav = document.querySelector<HTMLElement>('#vict-nav');
    const main = document.querySelector<HTMLElement>('.vict-main');
    const toggle = document.querySelector<HTMLElement>('.vict-nav-toggle');
    if (shell === null || main === null) {
      throw new Error('shell or main not rendered');
    }
    const navStyle = nav === null ? null : window.getComputedStyle(nav);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      shell: rect(shell),
      nav: nav === null || navStyle === null ? null : { ...rect(nav), display: navStyle.display },
      main: rect(main),
      toggleDisplay: toggle === null ? 'absent' : window.getComputedStyle(toggle).display,
      navExpanded:
        document.querySelector<HTMLElement>('.vict-nav-toggle')?.getAttribute('aria-expanded') ??
        null,
      shellTracks: window.getComputedStyle(shell).gridTemplateColumns,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
}

function trackCount(shellTracks: string): number {
  return shellTracks.trim().length === 0 ? 0 : shellTracks.trim().split(/\s+/).length;
}

describe('responsive navigation layout integrity (MED-05-A regression)', () => {
  // Mobile widths: menu open/closed layout invariants.
  for (const [width, height] of [
    [320, 720],
    [390, 844],
  ] as const) {
    it(`mobile ${width}x${height}: open menu keeps the main content full-width, visible, and restorable`, async () => {
      const page = await newPage(width, height);
      try {
        // 1. Load with the menu closed.
        await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle0' });

        // 2. Measure the closed layout.
        const closed = await measureLayout(page);
        expect(closed.toggleDisplay, 'toggle visible when closed').not.toBe('none');
        expect(closed.nav === null || closed.nav.display === 'none').toBe(true);
        const minMobileMainWidth = width * 0.7;
        expect(closed.main.width).toBeGreaterThan(minMobileMainWidth);
        expect(closed.scrollWidth).toBeLessThanOrEqual(closed.clientWidth + 2);

        // 3. Open the menu.
        await page.click('.vict-nav-toggle');

        // 4. The navigation is visible and inside the shell/viewport.
        const open = await measureLayout(page);
        expect(open.nav).not.toBeNull();
        expect(open.nav!.display).not.toBe('none');
        expect(open.nav!.width).toBeGreaterThan(0);
        expect(open.navExpanded).toBe('true');
        expect(open.nav!.x).toBeGreaterThanOrEqual(closed.shell.x - 1);
        expect(open.nav!.x + open.nav!.width).toBeLessThanOrEqual(
          closed.shell.x + closed.shell.width + 1,
        );
        // The opened panel starts on screen (never unexpectedly below the fold).
        expect(open.nav!.y).toBeGreaterThanOrEqual(0);
        expect(open.nav!.y).toBeLessThan(open.viewport.height);

        // 5. NO implicit horizontal grid column reduces the main width.
        expect(trackCount(open.shellTracks)).toBe(1);
        expect(open.main.width).toBeGreaterThanOrEqual(closed.main.width - 2);
        expect(open.main.width).toBeGreaterThan(minMobileMainWidth);

        // 6-7. The main content stays usefully sized; no horizontal overflow.
        expect(open.scrollWidth).toBeLessThanOrEqual(open.clientWidth + 2);

        // 8. Navigate to another screen through the opened navigation.
        const homeLink = await page.$('a.vict-nav-link[href="/"]');
        expect(homeLink).not.toBeNull();
        await homeLink!.click();
        await page.waitForFunction(() => window.location.pathname === '/', { timeout: 10_000 });

        // 9. Policy: the menu CLOSES after navigating to another screen.
        const afterNavigation = await measureLayout(page);
        expect(afterNavigation.nav === null || afterNavigation.nav.display === 'none').toBe(true);
        expect(afterNavigation.main.width).toBeGreaterThan(width * 0.7);
        expect(trackCount(afterNavigation.shellTracks)).toBe(1);

        // 11. Keyboard: Tab reaches the menu control, Enter opens, Escape
        // closes and restores focus to the control.
        await page.reload({ waitUntil: 'networkidle0' });
        for (let tab = 0; tab < 8; tab += 1) {
          await page.keyboard.press('Tab');
          const focused = await page.evaluate(
            () => document.activeElement?.classList.contains('vict-nav-toggle') ?? false,
          );
          if (focused) {
            break;
          }
        }
        expect(
          await page.evaluate(
            () => document.activeElement?.classList.contains('vict-nav-toggle') ?? false,
          ),
        ).toBe(true);
        await page.keyboard.press('Enter');
        const keyboardOpen = await measureLayout(page);
        expect(keyboardOpen.navExpanded).toBe('true');
        expect(keyboardOpen.nav !== null && keyboardOpen.nav.display !== 'none').toBe(true);
        expect(keyboardOpen.main.width).toBeGreaterThan(width * 0.7);
        await page.keyboard.press('Escape');
        const keyboardClosed = await measureLayout(page);
        expect(keyboardClosed.navExpanded).toBe('false');
        expect(keyboardClosed.nav === null || keyboardClosed.nav.display === 'none').toBe(true);
        expect(
          await page.evaluate(
            () => document.activeElement?.classList.contains('vict-nav-toggle') ?? false,
          ),
        ).toBe(true);

        // 10. Closing restores the layout exactly.
        expect(keyboardClosed.main.width).toBeGreaterThanOrEqual(closed.main.width - 2);
        expect(trackCount(keyboardClosed.shellTracks)).toBe(1);
        expect(keyboardClosed.scrollWidth).toBeLessThanOrEqual(keyboardClosed.clientWidth + 2);
        expectNoPageErrors();
      } finally {
        await page.close();
      }
    }, 120_000);
  }

  // Tablet and desktop keep the desktop navigation layout intact.
  for (const [width, height] of [
    [820, 1180],
    [1280, 800],
  ] as const) {
    it(`tablet/desktop ${width}x${height}: sidebar navigation with an untouched main column`, async () => {
      const page = await newPage(width, height);
      try {
        await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle0' });
        const measured = await measureLayout(page);
        // The hamburger control is desktop-hidden; the nav is always visible.
        expect(measured.toggleDisplay === 'absent' || measured.toggleDisplay === 'none').toBe(true);
        expect(measured.nav).not.toBeNull();
        expect(measured.nav!.display).not.toBe('none');
        // Two explicit tracks (sidebar + content): no implicit columns.
        expect(trackCount(measured.shellTracks)).toBe(2);
        expect(measured.main.width).toBeGreaterThan(width * 0.5);
        // The nav occupies the left column, the main content sits beside it.
        expect(measured.nav!.width).toBeLessThan(measured.main.width);
        expect(measured.main.x).toBeGreaterThanOrEqual(measured.nav!.x + measured.nav!.width - 1);
        expect(measured.scrollWidth).toBeLessThanOrEqual(measured.clientWidth + 2);
        expectNoPageErrors();
      } finally {
        await page.close();
      }
    }, 120_000);
  }
});
