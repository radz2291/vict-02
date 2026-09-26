/**
 * P3 QA driver — packed 0.3.1 consumer proof.
 *
 * 1. packs the required 0.3.1 set from the QA worktree (already in ../packed);
 * 2. copies BOTH consumer apps (compat theme.css / direct styles.css) plus the
 *    tarballs into a FRESH temp dir OUTSIDE the repository — no workspace
 *    resolution is possible there;
 * 3. npm-installs from the tarballs, asserts installed versions + no
 *    monorepo leakage in the lockfile;
 * 4. vite-builds each consumer and inspects the emitted CSS;
 * 5. serves the built consumer and verifies forms, tabs, dialogs/drawers,
 *    status, and mobile behavior in real Chrome (both variants);
 * 6. captures the screenshot matrix.
 */
import puppeteer from 'puppeteer-core';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKED = join(HERE, 'packed');
const CONSUMERS = { compat: 5297, direct: 5298 };
const SHOTS = { compat: join(HERE, 'shots-consumer-compat'), direct: join(HERE, 'shots-consumer-direct') };
mkdirSync(SHOTS.compat, { recursive: true });
mkdirSync(SHOTS.direct, { recursive: true });

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Invoke npm through its JS CLI entry: the npm.cmd batch wrapper fails with
// "stdout is not a tty" when spawned with redirected output on Windows.
const NPM_CLI = 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js';
const run = (cmd, opts) => {
  if (cmd === 'npm') {
    return spawnSync(process.execPath, [NPM_CLI, ...opts.args], { encoding: 'utf8', timeout: 600_000, ...opts });
  }
  return spawnSync(cmd, opts.args, { encoding: 'utf8', shell: process.platform === 'win32', timeout: 600_000, ...opts });
};

const workRoot = mkdtempSync(join(tmpdir(), 'vict-qa3-consumer-'));
console.log('consumer root:', workRoot);

const browser = await puppeteer.launch({
  executablePath: findBrowser(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

// Reuse one page across both consumers.
async function driveConsumer(variant, port) {
  console.log(`\n=== CONSUMER ${variant} (port ${port}) ===`);
  const base = `http://127.0.0.1:${port}`;
  const shot = (name) => page.screenshot({ path: join(SHOTS[variant], name + '.png') });

  // Desktop: form + required errors + dispatch semantics.
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}/#/widgets`, { waitUntil: 'networkidle2' });
  await sleep(600);
  const host = await page.evaluate(() => document.querySelector('[data-testid="vict-host"]') !== null);
  check(`${variant}: packed renderer mounts the generic host`, host);
  const fields = await page.evaluate(() =>
    [...document.querySelectorAll('.vict-field')].map((f) => f.getAttribute('data-field')),
  );
  check(
    `${variant}: all widget controls render (text/date/json/number/boolean)`,
    ['id', 'name', 'starts', 'config', 'budget', 'discount', 'active'].every((f) => fields.includes(f)),
    fields.join(','),
  );
  await page.click('[data-testid="form-submit"]');
  await sleep(300);
  const errAssoc = await page.evaluate(() => {
    const control = document.querySelector('#vict-field-f\\.widget-create-name');
    return {
      describedby: control?.getAttribute('aria-describedby') ?? null,
      text: document.getElementById('vict-field-error-f.widget-create-name')?.textContent ?? null,
    };
  });
  check(
    `${variant}: required errors field-associated (novalidate fix present in packed CSS/JS)`,
    errAssoc.describedby === 'vict-field-error-f.widget-create-name' && (errAssoc.text ?? '').length > 0,
    JSON.stringify(errAssoc),
  );
  await shot('c-form-errors');

  // Fill + submit → dispatch recorded by the consumer boundary.
  for (const [sel, value] of [
    ['#vict-field-f\\.widget-create-id', 'c-1'],
    ['#vict-field-f\\.widget-create-name', 'Consumer widget'],
    ['#vict-field-f\\.widget-create-budget', '88'],
  ]) {
    await page.click(sel, { clickCount: 3 });
    await page.type(sel, value);
  }
  await page.click('[data-testid="form-submit"]');
  await sleep(400);
  const dispatches = await page.evaluate(() => window.__dispatches ?? []);
  check(
    `${variant}: form dispatch reaches the consumer boundary with canonical payload`,
    dispatches.length === 1 && dispatches[0].input?.budget === 88 && typeof dispatches[0].input?.budget === 'number',
    JSON.stringify(dispatches),
  );

  // Tabs + keyboard.
  await page.evaluate(() => document.querySelector('[data-testid="qa-nav-/rec/one"]')?.click());
  await sleep(400);
  const tabProbe = async () =>
    page.evaluate(() => {
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      return { count: tabs.length, selected: tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true') };
    });
  let info = await tabProbe();
  check(`${variant}: tabs render on the record route`, info.count === 2 && info.selected === 0, JSON.stringify(info));
  await page.evaluate(() => document.querySelector('[role="tab"]')?.focus());
  await page.keyboard.press('ArrowRight');
  await sleep(150);
  info = await tabProbe();
  check(`${variant}: ArrowRight moves tab selection`, info.selected === 1, JSON.stringify(info));
  await shot('c-tabs');

  // Dialog: open, escape, focus restore.
  await page.evaluate(() => document.querySelector('[data-testid="overlay-trigger"]')?.click());
  await sleep(350);
  let dlg = await page.evaluate(() => {
    const d = document.querySelector('dialog[data-testid="overlay"]');
    return { open: d?.open ?? false, modal: d?.matches(':modal') ?? false, inside: d?.contains(document.activeElement) ?? false };
  });
  check(`${variant}: packed dialog opens modal with focus inside`, dlg.open && dlg.modal && dlg.inside, JSON.stringify(dlg));
  await page.keyboard.press('Escape');
  await sleep(300);
  const focusAfter = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  check(`${variant}: Escape closes; trigger regains focus`, focusAfter === 'overlay-trigger', String(focusAfter));

  // Drawer.
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    btns.find((b) => b.textContent.trim() === 'Adjust…')?.click();
  });
  await sleep(350);
  const drawer = await page.evaluate(() => {
    const d = document.querySelector('dialog.vict-overlay--drawer');
    const box = d?.querySelector('.vict-drawer')?.getBoundingClientRect();
    return { open: d?.open ?? false, right: Math.abs((box?.right ?? 0) - window.innerWidth) < 2 };
  });
  check(`${variant}: drawer opens right-aligned`, drawer.open && drawer.right, JSON.stringify(drawer));
  await shot('c-drawer');
  await page.keyboard.press('Escape');
  await sleep(250);

  // Status tones + denied feedback.
  await page.evaluate(() => document.querySelector('[data-testid="qa-nav-/tones"]')?.click());
  await sleep(300);
  const tones = await page.evaluate(() => [...document.querySelectorAll('.vict-status')].length);
  check(`${variant}: five status tone badges render`, tones === 5, String(tones));
  await shot('c-tones');
  await page.evaluate(() => document.querySelector('[data-testid="qa-nav-/actions"]')?.click());
  await sleep(300);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button.vict-btn')];
    btns.find((b) => b.textContent === 'Delete record')?.click();
  });
  await sleep(400);
  const deniedRole = await page.evaluate(() => document.querySelector('[data-testid="denied-state"]')?.getAttribute('role') ?? null);
  check(`${variant}: denied feedback renders role=alert`, deniedRole === 'alert', String(deniedRole));
  await shot('c-denied');

  // Mobile 380 + 320.
  for (const width of [380, 320]) {
    await page.setViewport({ width, height: 800 });
    await page.goto(`${base}/#/rec/one`, { waitUntil: 'networkidle2' });
    await sleep(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${variant}@${width}: no horizontal page overflow`, overflow <= 0, String(overflow));
    await page.goto(`${base}/#/longtabs`, { waitUntil: 'networkidle2' });
    await sleep(400);
    const tabsOk = await page.evaluate(() => {
      const list = document.querySelector('.vict-tablist');
      if (list === null) return false;
      const lastTab = list.querySelector('[role="tab"]:last-of-type');
      if (lastTab === null) return false;
      lastTab.scrollIntoView({ block: 'nearest', inline: 'end' });
      const reachable =
        list.scrollLeft > 0 || lastTab.getBoundingClientRect().right <= list.getBoundingClientRect().right + 1;
      list.scrollLeft = 0;
      return reachable;
    });
    check(`${variant}@${width}: long tabs reachable via contained scroll (fix present)`, tabsOk);
    await page.goto(`${base}/#/widgets`, { waitUntil: 'networkidle2' });
    await sleep(400);
    await shot(`c-widgets-${width}`);
  }
  check(`${variant}: no page errors in the packed consumer`, pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
  pageErrors.length = 0;
}

try {
  for (const variant of Object.keys(CONSUMERS)) {
    const dest = join(workRoot, `consumer-${variant}`);
    cpSync(join(HERE, `consumer-${variant}`), dest, { recursive: true });
    cpSync(PACKED, join(workRoot, 'packed'), { recursive: true });

    // npm install from the packed tarballs (outside the repository).
    const install = run('npm', { args: ['install', '--no-audit', '--no-fund'], cwd: dest });
    if (install.status !== 0) {
      check(`${variant}: npm install from packed tarballs`, false, (install.stderr ?? '').slice(-400));
      continue;
    }
    check(`${variant}: npm install from packed tarballs (clean temp dir)`, true, dest);

    // Version + leakage assertions on the lockfile.
    const lock = JSON.parse(readFileSync(join(dest, 'package-lock.json'), 'utf8'));
    const expected = ['application', 'contracts', 'renderer-svelte', 'sdk', 'ui', 'ui-svelte'];
    const wrong = expected.filter((p) => lock.packages?.[`node_modules/@victframework/${p}`]?.version !== '0.3.1');
    check(`${variant}: installed versions exactly 0.3.1`, wrong.length === 0, wrong.join(','));
    const leaked = JSON.stringify(lock).includes('vict-02');
    check(`${variant}: no monorepo leakage in the lockfile`, !leaked);

    // Build + emitted CSS inspection.
    const build = run('npm', { args: ['run', 'build'], cwd: dest });
    if (build.status !== 0) {
      check(`${variant}: vite build`, false, (build.stderr ?? build.stdout ?? '').slice(-500));
      continue;
    }
    check(`${variant}: vite build succeeds`, true);
    const assets = readdirSync(join(dest, 'dist', 'assets'));
    const cssFile = assets.find((a) => a.endsWith('.css'));
    const css = cssFile !== undefined ? readFileSync(join(dest, 'dist', 'assets', cssFile), 'utf8') : '';
    const markers = {
      '.vict-btn': css.includes('.vict-btn'),
      '.vict-tablist': css.includes('.vict-tablist'),
      '.vict-overlay--drawer': css.includes('.vict-overlay--drawer'),
      '.vict-status--success': css.includes('.vict-status--success'),
      '.vict-form': css.includes('.vict-form'),
      'tablist contained scroll (QA fix)': css.includes('overscroll-behavior-x'),
    };
    const missing = Object.entries(markers).filter(([, v]) => !v).map(([k]) => k);
    check(
      `${variant}: emitted CSS carries the migrated P3 presentation (${cssFile}, ${css.length} bytes)`,
      cssFile !== undefined && missing.length === 0,
      missing.join(','),
    );

    // Serve + drive.
    const server = spawn(process.execPath, [join(dest, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(CONSUMERS[variant]), '--strictPort', '--host', '127.0.0.1'], {
      cwd: dest,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const base = await new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error('preview did not start')), 30_000);
      server.stdout?.on('data', (chunk) => {
        if (chunk.toString().includes(String(CONSUMERS[variant]))) {
          clearTimeout(timer);
          res(true);
        }
      });
    }).catch(() => false);
    if (base !== true) {
      check(`${variant}: preview server starts`, false);
      server.kill();
      continue;
    }
    try {
      await driveConsumer(variant, CONSUMERS[variant]);
    } finally {
      server.kill();
    }
  }
} finally {
  await browser.close();
  try {
    rmSync(workRoot, { recursive: true, force: true });
  } catch {
    /* Windows file lock; temp dir cleanup is best-effort */
    console.log('note: temp consumer dir kept at', workRoot);
  }
}

writeFileSync(join(HERE, 'consumer-results.json'), JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(`\n==== CONSUMER: ${results.length - failed.length}/${results.length} checks passed ====`);
for (const f of failed) console.log(`FAILED: ${f.name} (${f.detail})`);
if (failed.length > 0) process.exit(1);
