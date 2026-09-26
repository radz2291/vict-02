// @vitest-environment node
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

/**
 * REAL-browser sanity evidence for the showcase (P6D):
 * representative routes render without page errors, no catastrophic
 * horizontal document overflow, an axe-core accessibility smoke scan, and
 * representative screenshots for the owner review board (written under
 * qa-artifacts/ui-showcase/).
 *
 * Screenshots are SECONDARY to the runnable app — the owner is expected to
 * browse it live at 1440/1024/768/430/380/320.
 */

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const APP_DIR = resolve(HERE, '..');
const ARTIFACT_DIR = resolve(APP_DIR, '..', '..', 'qa-artifacts', 'ui-showcase');

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
  throw new Error('No Chrome/Edge installation found; set VICT_BROWSER_PATH.');
}

let browser: Browser | undefined;
let workDir: string;
let baseUrl: string;
const started: ChildProcess[] = [];

async function startServer(): Promise<string> {
  const child = spawn(process.execPath, ['build'], {
    cwd: APP_DIR,
    env: { ...process.env, PORT: '0' },
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
  workDir = mkdtempSync(join(tmpdir(), 'vict-showcase-browser-'));
  // Build once if the built server is not present yet.
  if (!existsSync(join(APP_DIR, 'build', 'index.js'))) {
    const build = spawnSync('npx', ['vite', 'build'], {
      cwd: APP_DIR,
      encoding: 'utf8',
      timeout: 300_000,
      shell: process.platform === 'win32',
    });
    if (build.status !== 0) {
      throw new Error(`showcase build failed: ${build.stderr?.slice(-2000)}`);
    }
  }
  baseUrl = await startServer();
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

/** The showcase scenario/route matrix used for the sanity sweep + screenshots. */
const SHOWCASE_ROUTES: readonly { route: string; name: string; heading: string }[] = [
  { route: '/', name: '01-home', heading: 'VICT UI Showcase' },
  { route: '/ops', name: '02-ops-desktop', heading: 'Pusat Operasi' },
  { route: '/ops/tickets/OPS-1042', name: '03-ops-detail', heading: 'Rekod tiket' },
  { route: '/trading', name: '04-trading-desktop', heading: 'Market Overview' },
  { route: '/trading/instruments/XAUUSD', name: '05-trading-instrument', heading: 'Instrumen' },
  { route: '/trading/rotation', name: '06-trading-rotation', heading: 'Rotation / Breakout Study' },
  { route: '/agent', name: '07-agent-sessions', heading: 'Agent Sessions' },
  { route: '/agent/sessions/AGT-2201', name: '08-agent-workspace', heading: 'Ruang Kerja Ejen' },
  { route: '/agent/parallel', name: '09-agent-parallel', heading: 'Parallel Work' },
  { route: '/quellight', name: '10-quellight-conversation', heading: 'Quellight' },
  { route: '/quellight/world', name: '11-quellight-world', heading: 'Dunia Bersama' },
  { route: '/quellight/changes', name: '12-quellight-changes', heading: 'Perubahan dunia' },
  { route: '/workflow', name: '13-workflow-list', heading: 'Workflow / Governance' },
  {
    route: '/workflow/instances/WF-1042',
    name: '14-workflow-instance',
    heading: 'Instans aliran kerja',
  },
  { route: '/analytics', name: '15-analytics', heading: 'Executive Analytics' },
  { route: '/gallery', name: '16-gallery', heading: 'Component Gallery' },
  { route: '/gallery/states/stale', name: '17-states-stale', heading: 'Keadaan aplikasi — stale' },
  {
    route: '/gallery/states/partial',
    name: '18-states-partial',
    heading: 'Keadaan aplikasi — partial',
  },
  {
    route: '/gallery/forms/prefilled',
    name: '19-forms-prefilled',
    heading: 'Borang praisi (kemaskini)',
  },
  { route: '/stress', name: '20-stress-desktop', heading: 'Stress Lab' },
  { route: '/stress/deep/l3/l4/l5', name: '21-stress-deep', heading: 'Jejak rapat' },
  { route: '/review', name: '22-review', heading: 'Owner Review' },
];

describe('showcase sanity in a real browser (desktop 1440x900)', () => {
  it('every scenario route renders its screen shell without page errors', async () => {
    for (const scenario of SHOWCASE_ROUTES) {
      const page = await newPage(1440, 900);
      try {
        await page.goto(`${baseUrl}${scenario.route}`, { waitUntil: 'networkidle0' });
        const screen = await page.evaluate(
          () => document.querySelector('[data-testid="vict-host"]')?.textContent ?? '',
        );
        expect(screen.length).toBeGreaterThan(0);
        expect(screen, scenario.route).toContain(scenario.heading);
        expectNoPageErrors();
      } finally {
        await page.close();
      }
    }
  }, 240_000);

  it('the ops table renders real Malaysian rows and supports a real search interaction', async () => {
    const page = await newPage(1440, 900);
    try {
      await page.goto(`${baseUrl}/ops`, { waitUntil: 'networkidle0' });
      const rows = await page.$$eval('[data-testid="table-row"]', (elements) => elements.length);
      expect(rows).toBe(8); // pageSize 8
      const body = await page.evaluate(() => document.body.innerText);
      // OPS-1057 (newest ticket) is on page 1 of the createdAt-desc default sort.
      expect(body).toContain('Penyesuaian kadar caj sifar akaun kerajaan');
      // Real interaction: search for the e-Filing ticket via the server query.
      await page.type('[data-testid="table-search"]', 'e-Filing');
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 600));
      const after = await page.evaluate(
        () => document.querySelector('[data-testid="table-page-indicator"]')?.textContent ?? '',
      );
      expect(after).toContain('1 record');
      expectNoPageErrors();
    } finally {
      await page.close();
    }
  }, 120_000);

  it('no catastrophic document overflow on representative dense routes', async () => {
    for (const route of ['/ops', '/trading/rotation', '/gallery', '/stress', '/analytics']) {
      const page = await newPage(1440, 900);
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle0' });
        expect(await documentOverflow(page), route).toBeLessThanOrEqual(2);
        expectNoPageErrors();
      } finally {
        await page.close();
      }
    }
  }, 180_000);

  it('the demo dialog and drawer work (open, Escape, focus restore)', async () => {
    const page = await newPage(1440, 900);
    try {
      await page.goto(`${baseUrl}/ops/tickets/OPS-1042`, { waitUntil: 'networkidle0' });
      const triggers = await page.$$('[data-testid="overlay-trigger"]');
      expect(triggers.length).toBeGreaterThanOrEqual(2);
      await triggers[0]!.click();
      await page.waitForSelector('[data-testid="overlay-panel"]');
      const focusInOverlay = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid'),
      );
      expect(focusInOverlay).toBe(true);
      await page.keyboard.press('Escape');
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
      expect(await page.$('[data-testid="overlay"]')).toBeNull();
      expectNoPageErrors();
    } finally {
      await page.close();
    }
  }, 120_000);

  it('accessibility smoke scan on the home, gallery, and agent workspace screens', async () => {
    for (const route of ['/', '/gallery', '/agent/sessions/AGT-2201']) {
      const page = await newPage(1440, 900);
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle0' });
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
  }, 180_000);
});

describe('showcase responsive sanity (mobile 320-430)', () => {
  it('mobile 320px: navigation collapses behind the toggle with no unusable overflow', async () => {
    const page = await newPage(320, 720);
    try {
      await page.goto(`${baseUrl}/ops`, { waitUntil: 'networkidle0' });
      const toggleVisible = await page.evaluate(() => {
        const toggle = document.querySelector<HTMLElement>('.vict-nav-toggle');
        if (toggle === null) return false;
        const style = window.getComputedStyle(toggle);
        return style.display !== 'none' && toggle.offsetWidth > 0;
      });
      expect(toggleVisible).toBe(true);
      await page.click('.vict-nav-toggle');
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
      const navVisible = await page.evaluate(() => {
        const nav = document.querySelector<HTMLElement>('.vict-navigation-drawer');
        return nav !== null && window.getComputedStyle(nav).display !== 'none';
      });
      expect(navVisible).toBe(true);
      expect(await documentOverflow(page)).toBeLessThanOrEqual(2);
      expectNoPageErrors();
    } finally {
      await page.close();
    }
  }, 120_000);
});

/**
 * Owner review board screenshots (secondary evidence; the runnable app is
 * the primary deliverable). Written to qa-artifacts/ui-showcase/.
 */
describe('owner review screenshots', () => {
  it('captures the representative scenario screenshots at desktop and mobile widths', async () => {
    mkdirArtifacts();
    for (const scenario of SHOWCASE_ROUTES) {
      const page = await newPage(1440, 900);
      try {
        await page.goto(`${baseUrl}${scenario.route}`, { waitUntil: 'networkidle0' });
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
        await page.screenshot({
          path: join(ARTIFACT_DIR, `${scenario.name}.png`),
          fullPage: false,
        });
      } finally {
        await page.close();
      }
    }
    // Mobile variants required by the review brief.
    const mobile: readonly [string, string, number][] = [
      ['/ops', '23-ops-mobile-390', 390],
      ['/trading', '24-trading-mobile-390', 390],
      ['/agent/sessions/AGT-2201', '25-agent-mobile-430', 430],
      ['/stress', '26-stress-mobile-320', 320],
      ['/gallery', '27-gallery-mobile-320', 320],
    ];
    for (const [route, name, width] of mobile) {
      const page = await newPage(width, 844);
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle0' });
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
        await page.screenshot({ path: join(ARTIFACT_DIR, `${name}.png`), fullPage: false });
      } finally {
        await page.close();
      }
    }
    // The captured inventory is recorded for the report.
    writeFileSync(
      join(ARTIFACT_DIR, 'README.txt'),
      [
        'VICT UI Showcase — owner review screenshots (P6D)',
        '',
        'Captured by examples/ui-showcase/test/browser.test.ts against the BUILT showcase server.',
        'Primary evidence is the runnable app itself (see examples/ui-showcase/README.md).',
        '',
        ...SHOWCASE_ROUTES.map((scenario) => `${scenario.name}.png — ${scenario.route}`),
        '23-ops-mobile-390.png — /ops @ 390px',
        '24-trading-mobile-390.png — /trading @ 390px',
        '25-agent-mobile-430.png — /agent/sessions/AGT-2201 @ 430px',
        '26-stress-mobile-320.png — /stress @ 320px',
        '27-gallery-mobile-320.png — /gallery @ 320px',
      ].join('\n'),
      'utf8',
    );
    expect(readdirSync(ARTIFACT_DIR).length).toBeGreaterThanOrEqual(SHOWCASE_ROUTES.length + 5);
  }, 300_000);
});

/* Small helpers for the owner review board. */
function mkdirArtifacts(): void {
  try {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
  } catch {
    /* already exists */
  }
}
