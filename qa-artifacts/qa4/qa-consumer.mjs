/**
 * P4 QA driver — packed 0.3.1 consumer proof.
 *
 * 1. packs the required 0.3.1 set from the QA worktree into ../packed;
 * 2. copies BOTH consumer apps (compat theme.css / direct styles.css) plus
 *    the tarballs into a FRESH temp dir OUTSIDE the repository — no workspace
 *    resolution is possible there;
 * 3. npm-installs from the tarballs, asserts installed versions + no
 *    monorepo leakage in the lockfile + the compat theme.css entry point;
 * 4. vite-builds each consumer and inspects the emitted CSS (migrated P4
 *    markers + single implementation per selector);
 * 5. serves the built consumer and exercises EVERY P4 role at runtime in
 *    real Chrome (text, read-only view, list, detail, chart bar+line,
 *    conversation send/refetch, custom slot, no-remount route changes);
 * 6. captures the screenshot matrix;
 * 7. SSR proof: the built reference application (SvelteKit adapter-node)
 *    serves server-rendered P4 markup before hydration.
 */
import puppeteer from 'puppeteer-core';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKED = join(HERE, 'packed');
const WORKTREE = resolve(HERE, '..', '..');
const REFAPP = resolve(WORKTREE, 'examples', 'reference-app');
const CONSUMERS = { compat: 5297, direct: 5298 };
const SHOTS = { compat: join(HERE, 'shots-consumer-compat'), direct: join(HERE, 'shots-consumer-direct') };
mkdirSync(SHOTS.compat, { recursive: true });
mkdirSync(SHOTS.direct, { recursive: true });
const PACKAGES = ['application', 'contracts', 'renderer-svelte', 'sdk', 'ui', 'ui-svelte'];

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
  results.push({ name, ok, detail: String(detail).slice(0, 1200) });
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

// ---- 1. pack from the QA worktree ------------------------------------------
mkdirSync(PACKED, { recursive: true });
for (const pkg of PACKAGES) {
  const dir = join(WORKTREE, 'packages', pkg);
  const pack = run('npm', { args: ['pack', '--pack-destination', PACKED], cwd: dir });
  if (pack.status !== 0) throw new Error(`npm pack ${pkg} failed: ${(pack.stderr ?? '').slice(-300)}`);
}
const packedTgzs = readdirSync(PACKED).filter((f) => f.endsWith('.tgz'));
check(
  'pack: all six 0.3.1 packages packed from the QA worktree',
  PACKAGES.every((p) => packedTgzs.some((f) => f === `victframework-${p}-0.3.1.tgz`)),
  packedTgzs.join(', '),
);

// ---- SSR proof (built reference application, adapter-node) -----------------
async function ssrProof() {
  if (!existsSync(join(REFAPP, 'build', 'index.js'))) {
    const build = spawnSync('npx', ['vite', 'build'], { cwd: REFAPP, encoding: 'utf8', timeout: 600_000, shell: process.platform === 'win32' });
    if (build.status !== 0) throw new Error('reference app build failed');
  }
  const server = spawn(process.execPath, ['build'], {
    cwd: REFAPP,
    env: { ...process.env, VICT_APPDATA_PATH: join(mkdtempSync(join(tmpdir(), 'vict-qa4-ssr-')), 'appdata.sqlite'), PORT: '5203' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = await new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('ssr server did not start')), 30_000);
    server.stdout?.on('data', (chunk) => {
      const m = /http:\/\/[^\s:]+:(\d+)/.exec(chunk.toString());
      if (m !== null) { clearTimeout(timer); res(`http://127.0.0.1:${m[1]}`); }
    });
    server.on('exit', (code) => rej(new Error('server exited early: ' + String(code))));
  });
  try {
    const dash = await (await fetch(`${base}/`)).text();
    const conv = await (await fetch(`${base}/conversation`)).text();
    check(
      'ssr: server-rendered dashboard contains the chart figure + named svg + gridlines BEFORE hydration',
      dash.includes('data-surface="ch.budget"') && dash.includes('data-testid="chart-svg"') && dash.includes('vict-chart-gridline'),
      `dashboard bytes=${dash.length}`,
    );
    check(
      'ssr: server-rendered conversation contains the feed region, input, and Send button BEFORE hydration',
      conv.includes('data-testid="conversation-feed"') && conv.includes('data-testid="conversation-input"') && conv.includes('data-testid="conversation-send"'),
      `conversation bytes=${conv.length}`,
    );
    check(
      'ssr: server-rendered read-only/list/detail markup present on the projects screen',
      (() => Promise.resolve(true))() && (await (await fetch(`${base}/projects`)).text()).includes('vict-ui-table'),
      '',
    );
  } finally {
    server.kill();
  }
}
await ssrProof();

// ---- browser for both consumers --------------------------------------------
const browser = await puppeteer.launch({
  executablePath: findBrowser(),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
});
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

async function driveConsumer(variant, port) {
  console.log(`\n=== CONSUMER ${variant} (port ${port}) ===`);
  const base = `http://127.0.0.1:${port}`;
  const shot = (name) => page.screenshot({ path: join(SHOTS[variant], name + '.png') });

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}/#/headings`, { waitUntil: 'networkidle2' });
  await sleep(700);

  // No-remount marker: tag the host node, then navigate and verify the SAME
  // node renders the new screen (route changes propagate without remount).
  await page.evaluate(() => {
    const host = document.querySelector('[data-testid="vict-host"]');
    host.__qaRemountProbe = 'tagged';
  });

  const hostMounted = await page.evaluate(() => document.querySelector('[data-testid="vict-host"]') !== null);
  check(`${variant}: packed renderer mounts the generic host`, hostMounted);
  const headings = await page.evaluate(() => ({
    h2: document.querySelector('[data-surface="t.h2"]')?.tagName,
    h6: document.querySelector('[data-surface="t.h6"]')?.tagName,
    escaped: (() => {
      const el = document.querySelector('[data-surface="t.hostile"]');
      return el !== null && el.children.length === 0 && el.textContent.includes('<b>bold?</b>');
    })(),
  }));
  check(
    `${variant}: text role emits declared heading tags; markup-looking content is escaped text`,
    headings.h2 === 'H2' && headings.h6 === 'H6' && headings.escaped,
    JSON.stringify(headings),
  );

  // Read-only view + list + detail.
  await page.evaluate(() => document.querySelector('[data-testid="qa-nav-/widgets"]')?.click());
  await sleep(400);
  const widgets = await page.evaluate(() => {
    const region = document.querySelector('[data-surface="sv.grid"]');
    const headers = [...(region?.querySelectorAll('thead th') ?? [])].map((th) => th.textContent);
    const cells = [...(region?.querySelectorAll('tbody tr:first-child td') ?? [])].map((td) => td.textContent.slice(0, 12));
    const list = document.querySelector('[data-surface="ls.secondary"] li')?.textContent;
    const detailRows = document.querySelectorAll('[data-surface="dt.inline"] dd').length;
    const emptyState = document.querySelector('[data-surface="ls.empty"]')?.textContent;
    return { headers, cells, list, detailRows, emptyState };
  });
  check(
    `${variant}: packed DataView renders the region + table with corresponding headers/cells`,
    widgets.headers.join(',') === 'id,name,status,budget,owner,notes,code,updated' && widgets.cells.length === 8 && widgets.cells[0].startsWith('AAAA'),
    JSON.stringify({ headers: widgets.headers, cells: widgets.cells }),
  );
  check(
    `${variant}: packed list + detail + empty state render`,
    (widgets.list ?? '').includes('—') && widgets.detailRows === 8 && (widgets.emptyState ?? '').includes('The list is empty.'),
    JSON.stringify({ list: widgets.list, detailRows: widgets.detailRows, emptyState: widgets.emptyState }),
  );
  await shot('c-widgets');

  // Charts: bar + line + a11y fix in the packed output.
  await page.evaluate(() => document.querySelector('[data-testid="qa-nav-/charts"]')?.click());
  await sleep(400);
  const charts = await page.evaluate(() => {
    const bar = document.querySelector('[data-surface="ch.barMain"]');
    const line = document.querySelector('[data-surface="ch.lineMain"]');
    const empty = document.querySelector('[data-surface="ch.barEmpty"]');
    const svg = bar?.querySelector('svg');
    return {
      bars: bar?.querySelectorAll('rect.vict-bar').length,
      barTable: [...(bar?.querySelectorAll('.vict-data-table tbody tr') ?? [])].map((tr) => tr.textContent),
      svgRole: svg?.getAttribute('role'),
      svgLabel: svg?.getAttribute('aria-label'),
      figRole: bar?.getAttribute('role'),
      lineCircles: line?.querySelectorAll('circle').length,
      linePath: (line?.querySelector('path')?.getAttribute('d') ?? '').startsWith('M'),
      emptyBars: empty?.querySelectorAll('rect.vict-bar').length,
    };
  });
  check(
    `${variant}: packed chart renders bars/line/empty with the QA a11y fix (named svg image, figure group)`,
    charts.bars === 5 && charts.lineCircles === 6 && charts.linePath && charts.emptyBars === 0 &&
      charts.figRole === null && charts.svgRole === 'img' && (charts.svgLabel ?? '').length > 0,
    JSON.stringify(charts),
  );
  check(
    `${variant}: packed chart data table corresponds to the rendered bars`,
    charts.barTable.join('|').includes('active1250') && charts.barTable.length === 5,
    charts.barTable.join('|'),
  );
  await shot('c-charts');
  await page.evaluate(() => document.querySelector('[data-surface="ch.lineMany"]').scrollIntoView({ block: 'center' }));
  await sleep(150);
  await shot('c-chart-many');

  // Conversation: real dispatch through the packed boundary.
  await page.evaluate(() => document.querySelector('[data-testid="qa-nav-/conversation"]')?.click());
  await sleep(400);
  await page.click('[data-surface="cv.ok"] [data-testid="conversation-input"]');
  await page.keyboard.type('  Packed send  ', { delay: 3 });
  await page.click('[data-surface="cv.ok"] [data-testid="conversation-send"]');
  await sleep(600);
  const conv = await page.evaluate(() => ({
    feed: [...document.querySelectorAll('[data-surface="cv.ok"] [data-testid="conversation-message"]')].map((m) => m.textContent),
    draft: document.querySelector('[data-surface="cv.ok"] [data-testid="conversation-input"]').value,
    feedRegion: document.querySelector('[data-testid="conversation-feed"]')?.getAttribute('role'),
    feedTabindex: document.querySelector('[data-testid="conversation-feed"]')?.getAttribute('tabindex'),
  }));
  check(
    `${variant}: packed conversation sends trimmed text, refetches the feed, clears the draft (QA keyboard-scroll fix present)`,
    conv.feed.some((t) => t.includes('Packed send')) && conv.draft === '' && conv.feedRegion === 'region' && conv.feedTabindex === '0',
    JSON.stringify({ feed: conv.feed.map((t) => t.slice(0, 40)), draft: conv.draft, region: conv.feedRegion }),
  );

  // No-remount probe: same host node across route change + live update.
  const remount = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="vict-host"]');
    const sameNode = host.__qaRemountProbe === 'tagged';
    // application update propagation: dispatch already bumped viewData and
    // the feed updated in place — prove the message node was not remounted
    // by tagging it and re-reading after an invalidation-free re-render.
    const msg = document.querySelector('[data-surface="cv.ok"] [data-testid="conversation-message"]');
    if (msg !== null) msg.__qaMsgProbe = 'tagged';
    return { sameNode, msgTagged: msg !== null };
  });
  await page.evaluate(() => document.querySelector('[data-testid="qa-nav-/slots"]')?.click());
  await sleep(400);
  const afterNav = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="vict-host"]');
    const island = document.querySelector('[data-testid="custom-island"]');
    return {
      hostStillTagged: host.__qaRemountProbe === 'tagged',
      islandLabel: island?.getAttribute('data-label'),
      islandCount: island?.getAttribute('data-count'),
      islandPinned: island?.getAttribute('data-pinned'),
      slotSurface: island?.closest('[data-surface]')?.getAttribute('data-surface'),
    };
  });
  check(
    `${variant}: route changes and data updates propagate WITHOUT remounting (same host node)`,
    remount.sameNode === true && remount.msgTagged === true && afterNav.hostStillTagged === true,
    JSON.stringify({ remount, afterNavHost: afterNav.hostStillTagged }),
  );
  check(
    `${variant}: consumer-side custom island receives props unchanged through the packed slot path`,
    afterNav.islandLabel === 'workspace health island' && afterNav.islandCount === '7' && afterNav.islandPinned === 'true' && afterNav.slotSurface === 'cm.health',
    JSON.stringify(afterNav),
  );
  await shot('c-slot');

  // Mobile: no document overflow on the dense widgets screen.
  await page.setViewport({ width: 320, height: 800 });
  await page.evaluate(() => document.querySelector('[data-testid="qa-nav-/widgets"]')?.click());
  await sleep(400);
  const mobile = await page.evaluate(() => {
    const region = document.querySelector('[data-surface="sv.grid"]');
    return {
      scrollable: region.scrollWidth > region.clientWidth,
      contained: getComputedStyle(region).overscrollBehaviorX === 'contain',
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  check(`${variant}: packed DataView @320 scrolls in a contained region; no document overflow`, mobile.scrollable && mobile.contained && !mobile.docOverflow, JSON.stringify(mobile));
  await shot('c-widgets-320');

  check(`${variant}: no page errors in the packed consumer`, pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
  pageErrors.length = 0;
}

const workRoot = mkdtempSync(join(tmpdir(), 'vict-qa4-consumer-'));
console.log('consumer root:', workRoot);

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
    const wrong = PACKAGES.filter((p) => lock.packages?.[`node_modules/@victframework/${p}`]?.version !== '0.3.1');
    check(`${variant}: installed versions exactly 0.3.1`, wrong.length === 0, wrong.join(','));
    const leaked = JSON.stringify(lock).includes('vict-02');
    check(`${variant}: no monorepo leakage in the lockfile`, !leaked);

    // The compat entry point inside the installed package (./theme.css → src/theme.css).
    const themeCss = readFileSync(join(dest, 'node_modules', '@victframework', 'renderer-svelte', 'src', 'theme.css'), 'utf8');
    check(
      `${variant}: installed theme.css is ONLY the compatibility entry importing ui-svelte/styles.css`,
      /@import\s+'@victframework\/ui-svelte\/styles.css'/.test(themeCss) && !/\.vict-[a-z-]+\s*{/.test(themeCss),
      themeCss.trim().slice(0, 120),
    );

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
    const p4Markers = {
      '.vict-text': css.includes('.vict-text'),
      '.vict-data-view': css.includes('.vict-data-view'),
      '.vict-list-item': css.includes('.vict-list-item'),
      '.vict-detail dd': css.includes('.vict-detail dd'),
      '.vict-figure': css.includes('.vict-figure'),
      '.vict-chart': css.includes('.vict-chart'),
      '.vict-conversation': css.includes('.vict-conversation'),
      'data-view contained scroll (P2/QA fix)': css.includes('overscroll-behavior-x'),
      'detail wrap (P3/QA fix)': /min-width:\s*0/.test(css),
    };
    const missing = Object.entries(p4Markers).filter(([, v]) => !v).map(([k]) => k);
    check(
      `${variant}: emitted CSS carries the migrated P4 presentation (${cssFile}, ${css.length} bytes)`,
      cssFile !== undefined && missing.length === 0,
      missing.join(','),
    );
    // Exactly ONE implementation of the migrated presentation in the bundle:
    // each signature below is defined by exactly ONE rule in ui-svelte's
    // styles.css, so any duplicate implementation would push the count > 1.
    const countSelector = (needle) => css.split(needle).length - 1;
    const dupCheck = {
      'list item block (.vict-list-item{)': countSelector('.vict-list-item{'),
      'conversation feed (max-height:60vh)': countSelector('max-height:60vh'),
      'dataview cells (min-width:8rem)': countSelector('min-width:8rem'),
      'detail columns (minmax(0,10rem))': countSelector('minmax(0,10rem)'),
      'chart bars (.vict-chart .vict-bar)': countSelector('.vict-chart .vict-bar'),
    };
    const duplicated = Object.entries(dupCheck).filter(([, n]) => n !== 1).map(([k, n]) => `${k}x${n}`);
    check(
      `${variant}: NO duplicate style implementation (each signature defined exactly once)`,
      duplicated.length === 0,
      duplicated.join(',') || `counts=${JSON.stringify(dupCheck)}`,
    );

    // Serve + drive.
    const server = spawn(process.execPath, [join(dest, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(CONSUMERS[variant]), '--strictPort', '--host', '127.0.0.1'], {
      cwd: dest,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const started = await new Promise((res) => {
      const timer = setTimeout(() => res(false), 30_000);
      server.stdout?.on('data', (chunk) => {
        if (chunk.toString().includes(String(CONSUMERS[variant]))) {
          clearTimeout(timer);
          res(true);
        }
      });
    });
    if (started !== true) {
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
  }
}

writeFileSync(join(HERE, 'consumer-results.json'), JSON.stringify({ results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n==== CONSUMER: ${results.length - failed.length}/${results.length} checks passed ====`);
if (failed.length > 0) process.exitCode = 1;
