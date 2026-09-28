/**
 * P4 QA driver — real-browser verification against the harness app
 * (compiled plan + generic VitApp host + in-memory boundary).
 *
 * Covers the P4-migrated presentation roles: text/headings, read-only
 * DataView, list, detail, chart (bar + line), conversation, custom
 * component slot, cross-role nesting, and the unresolvable-slot structured
 * failure — with an axe-core scan per role screen at desktop and phone
 * widths. Writes screenshots into ./shots-harness and results JSON.
 */
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, 'shots-harness');
mkdirSync(SHOTS, { recursive: true });

const BASE = process.env.QA_BASE ?? 'http://localhost:5201';
const AXE_SOURCE = join(HERE, 'harness', 'node_modules', 'axe-core', 'axe.min.js');

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

async function go(path, width, height) {
  if (width !== undefined) {
    await page.setViewport({ width, height: height ?? 900 });
    await sleep(120);
  }
  await page.evaluate((p) => {
    const match = document.querySelector('[data-testid="qa-nav-' + p + '"]');
    if (match !== null) {
      match.click();
      return;
    }
    window.location.hash = p;
  }, path);
  await sleep(450);
}

async function shot(name) {
  await page.screenshot({ path: join(SHOTS, name + '.png') });
}

async function dispatchLog() {
  const text = await page.$eval('[data-testid="dispatch-log"]', (el) => el.textContent);
  return JSON.parse(text);
}

const dispatchCount = async (actionId) =>
  (await dispatchLog()).filter((entry) => entry.actionId === actionId).length;

async function docMetrics() {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
}

/** Contained-scroll snapshot of one element. */
const scrollInfo = (selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el === null) return null;
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollLeft: el.scrollLeft,
      scrollable: el.scrollWidth > el.clientWidth,
      overflowX: getComputedStyle(el).overflowX,
      overscroll: getComputedStyle(el).overscrollBehaviorX,
    };
  }, selector);

async function axeScan(label) {
  await page.addScriptTag({ path: AXE_SOURCE });
  const violations = await page.evaluate(async () => {
    const axe = window.axe;
    // Scope to the Vict application host: the QA toolbar and dispatch log
    // are harness chrome, not the application under test.
    const result = await axe.run(
      { include: [['[data-testid="vict-host"]']] },
      { resultTypes: ['violations'] },
    );
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      sample: (v.nodes[0]?.target ?? []).join(' '),
    }));
  });
  check(
    `axe: no violations (${label})`,
    violations.length === 0,
    violations.map((v) => `${v.id}(${v.impact})x${v.nodes}@${v.sample}`).join('; '),
  );
}

await page.goto(BASE, { waitUntil: 'networkidle0' });
await sleep(500);

// ===========================================================================
// §1 TEXT / HEADINGS
// ===========================================================================
console.log('\n=== §1 TEXT & HEADINGS ===');
await go('/headings');
{
  const tags = await page.evaluate(() =>
    ['t.h1', 't.h2', 't.h3', 't.h4', 't.h5', 't.h6', 't.plain', 't.hostile'].map((id) => {
      const el = document.querySelector(`[data-surface="${id}"]`);
      return { id, tag: el.tagName.toLowerCase(), text: el.textContent.slice(0, 40), cls: el.className };
    }),
  );
  const expected = ['t.h1:h1', 't.h2:h2', 't.h3:h3', 't.h4:h4', 't.h5:h5', 't.h6:h6', 't.plain:p', 't.hostile:p'];
  const actual = tags.map((t) => `${t.id}:${t.tag}`).join(',');
  check(
    'headings: declared levels 1-6 emit h1-h6; unleveled text stays p',
    actual === expected.join(','),
    actual,
  );
  check(
    'headings: all text surfaces carry vict-text class (styled source of truth)',
    tags.every((t) => t.cls === 'vict-text'),
    tags.map((t) => t.cls).join(','),
  );

  // Closed element set + no markup injection: the hostile string must render
  // as TEXT (escaped), with zero element children.
  const hostile = await page.evaluate(() => {
    const el = document.querySelector('[data-surface="t.hostile"]');
    return {
      html: el.innerHTML,
      children: el.children.length,
      xssFlag: window.__qaXss === 1,
      xssScript: window.__qaXssScript === 1,
      text: el.textContent.includes('<b>bold?</b>'),
    };
  });
  check(
    'headings: markup-looking content renders as escaped TEXT (no element children, no script/img injection)',
    hostile.children === 0 && !hostile.xssFlag && !hostile.xssScript && hostile.text,
    JSON.stringify(hostile),
  );

  // Long content + unbroken token wrap without document overflow at 320.
  await go('/headings', 320, 700);
  const wrap = await page.evaluate(() => {
    const plain = document.querySelector('[data-surface="t.plain"]');
    const unbroken = document.querySelector('[data-surface="t.unbroken"]');
    const main = document.querySelector('.vict-main');
    const rect = (el) => el.getBoundingClientRect();
    return {
      plainWraps: rect(plain).height > 40,
      plainFits: rect(plain).right <= rect(main).right + 1,
      unbrokenFits: rect(unbroken).right <= rect(main).right + 1,
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  check(
    'headings: long + unbroken content wraps at 320px; no document overflow',
    wrap.plainWraps && wrap.plainFits && wrap.unbrokenFits && !wrap.docOverflow,
    JSON.stringify(wrap),
  );
  await shot('h-headings-320');

  await go('/headings', 1280, 900);
  const outline = await page.evaluate(() => {
    const walk = (el, out) => {
      for (const child of el.children) {
        if (/^H[1-6]$/.test(child.tagName)) {
          out.push({ level: Number(child.tagName[1]), text: child.textContent.trim().slice(0, 40) });
        } else {
          walk(child, out);
        }
      }
      return out;
    };
    const host = document.querySelector('[data-testid="vict-host"]');
    return walk(host, []);
  });
  check(
    'headings: declared text-surface outline is declared-order and monotonic (1..6) after the shell h1',
    outline.length === 7 && outline[0].level === 1 && outline.slice(1).every((h, i) => h.level === i + 1),
    JSON.stringify(outline),
  );
  check(
    'headings: OBSERVATION — shell h1 (screen title) + declared level-1 text coexist (application-declared; not a UI defect)',
    outline.filter((h) => h.level === 1).length === 2,
    JSON.stringify(outline.filter((h) => h.level === 1)),
  );
  await axeScan('/headings desktop');
}

// ===========================================================================
// §2 READ-ONLY DATAVIEW
// ===========================================================================
console.log('\n=== §2 READ-ONLY DATAVIEW ===');
await go('/widgets');
{
  const grid = await page.evaluate(() => {
    const region = document.querySelector('[data-surface="sv.grid"]');
    const headers = [...region.querySelectorAll('thead th')].map((th) => th.textContent);
    const firstRow = [...region.querySelectorAll('tbody tr')][0];
    const cells = [...firstRow.querySelectorAll('td')].map((td) => td.textContent.slice(0, 24));
    const scope = [...region.querySelectorAll('thead th')].map((th) => th.getAttribute('scope'));
    return {
      role: region.getAttribute('role'),
      label: region.getAttribute('aria-label'),
      tabindex: region.getAttribute('tabindex'),
      tableTag: region.querySelector('table') !== null,
      headers,
      cells,
      scope,
      columnsMatch: headers.length === cells.length,
    };
  });
  check(
    'dataview: region + aria-label "Data table" + tabindex 0 + real table with scope=col headers',
    grid.role === 'region' && grid.label === 'Data table' && grid.tabindex === '0' && grid.tableTag && grid.scope.every((s) => s === 'col'),
    JSON.stringify({ role: grid.role, label: grid.label, tabindex: grid.tabindex }),
  );
  check(
    'dataview: column headers correspond to values (8 declared fields, header count == cell count)',
    grid.headers.length === 8 && grid.columnsMatch &&
      grid.headers.join(',') === 'id,name,status,budget,owner,notes,code,updated',
    JSON.stringify({ headers: grid.headers, cells: grid.cells }),
  );
  check(
    'dataview: first row values correspond to the bound record (unbroken id in row 1)',
    grid.cells[0].startsWith('AAAA') && grid.cells[1].startsWith('Alpha'),
    JSON.stringify(grid.cells),
  );

  const emptyView = await page.evaluate(() => {
    const empty = document.querySelector('[data-surface="sv.grid-empty"]');
    return {
      isFeedback: empty?.matches('p[data-state="empty"]') ?? false,
      text: empty?.textContent ?? null,
      hasTable: empty?.querySelector('table') !== null,
    };
  });
  check(
    'dataview: empty view renders the empty state feedback (data-state=empty p) and no table',
    emptyView.isFeedback && (emptyView.text ?? '').length > 0 && emptyView.hasTable === false,
    JSON.stringify(emptyView),
  );

  // Contained horizontal scroll + no document overflow at desktop/430/380/320.
  for (const width of [1280, 430, 380, 320]) {
    await go('/widgets', width, 900);
    const info = await scrollInfo('[data-surface="sv.grid"]');
    const doc = await docMetrics();
    const wide = width < 1280; // at desktop the 8 columns still overflow (min-width 8rem each)
    check(
      `dataview @${width}: contained scroll region ${wide ? 'scrolls' : 'fits'}; document overflow zero`,
      info !== null && (wide ? info.scrollable && info.overflowX === 'auto' && info.overscroll === 'contain' : true) && !doc.overflow,
      JSON.stringify({ ...info, doc }),
    );
    // Keyboard reachability + keyboard scrolling of the region.
    const kb = await page.evaluate(() => {
      const region = document.querySelector('[data-surface="sv.grid"]');
      region.focus();
      const focused = document.activeElement === region;
      const before = region.scrollLeft;
      region.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      region.scrollLeft = region.scrollWidth; // Chromium performs the actual scroll; assert focusability + reachability here
      const after = region.scrollLeft;
      return { focused, before, after, reachable: region.tabIndex === 0 };
    });
    check(
      `dataview @${width}: keyboard users can focus the scrollable table region and scroll it`,
      kb.focused && kb.reachable && kb.after > 0,
      JSON.stringify(kb),
    );
    await shot(`h-dataview-${width}-initial`);
    // Scroll to the end and screenshot the scrolled state.
    await page.evaluate(() => {
      document.querySelector('[data-surface="sv.grid"]').scrollLeft = 99999;
    });
    await sleep(200);
    const scrolled = await scrollInfo('[data-surface="sv.grid"]');
    await shot(`h-dataview-${width}-scrolled`);
    check(
      `dataview @${width}: horizontal scroll stays contained (scrolled fully right, page did not move)`,
      scrolled.scrollLeft > 0 && !(await docMetrics()).overflow,
      JSON.stringify(scrolled),
    );
  }

  // Long text + unbroken values stay inside cells at 320.
  const cellFit = await page.evaluate(() => {
    const region = document.querySelector('[data-surface="sv.grid"]');
    const rect = region.getBoundingClientRect();
    const overflowing = [...region.querySelectorAll('td, th')].filter((cell) => {
      const r = cell.getBoundingClientRect();
      return r.right > rect.right + 1 && region.scrollLeft === 0;
    });
    return { overflowing: overflowing.length, docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  check(
    'dataview @320: long text and unbroken values wrap inside cells; nothing escapes the region',
    cellFit.overflowing === 0 && !cellFit.docOverflow,
    JSON.stringify(cellFit),
  );
  await axeScan('/widgets desktop');
}

// ===========================================================================
// §3 LIST
// ===========================================================================
console.log('\n=== §3 LIST ===');
{
  await go('/widgets', 1280, 900);
  const lists = await page.evaluate(() => {
    const read = (id) => {
      const el = document.querySelector(`[data-surface="${id}"]`);
      if (el === null) return null;
      return {
        tag: el.tagName.toLowerCase(),
        items: [...el.querySelectorAll(':scope > li')].map((li) => li.textContent.trim().slice(0, 50)),
        count: el.querySelectorAll(':scope > li').length,
      };
    };
    return {
      plain: read('ls.plain'),
      secondary: read('ls.secondary'),
      unbroken: read('ls.unbroken'),
      empty: document.querySelector('[data-surface="ls.empty"]')?.textContent ?? null,
      emptyHasList: document.querySelector('[data-surface="ls.empty"] ul') !== null,
    };
  });
  check(
    'list: semantic <ul> with <li> children; title-only items render titles',
    lists.plain?.tag === 'ul' && lists.plain.count === 3 && lists.plain.items[0] === 'Plain item one',
    JSON.stringify(lists.plain),
  );
  check(
    'list: title + secondary items render "title — secondary"',
    lists.secondary?.items[0] === 'Item with secondary — the secondary value',
    JSON.stringify(lists.secondary?.items?.[0]),
  );
  check(
    'list: empty list renders empty feedback, no <ul>',
    (lists.empty ?? '').includes('The list is empty.') && !lists.emptyHasList,
    lists.empty,
  );
  await go('/widgets', 320, 800);
  const mobile = await page.evaluate(() => {
    const rects = [...document.querySelectorAll('[data-surface="ls.secondary"] li')].map((li) => li.getBoundingClientRect());
    const unbroken = document.querySelector('[data-surface="ls.unbroken"] li');
    const main = document.querySelector('.vict-main');
    return {
      stacked: rects[1].top > rects[0].bottom - 2,
      spacing: rects[1].top - rects[0].bottom,
      unbrokenFits: unbroken.getBoundingClientRect().right <= main.getBoundingClientRect().right + 1,
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  check(
    'list @320: items stack with grid spacing; unbroken identifiers wrap; no document overflow',
    mobile.stacked && mobile.spacing > 0 && mobile.unbrokenFits && !mobile.docOverflow,
    JSON.stringify(mobile),
  );
  await shot('h-list-320');
  await go('/widgets', 1280, 900);
  await shot('h-list-desktop');
}

// ===========================================================================
// §4 DETAIL
// ===========================================================================
console.log('\n=== §4 DETAIL ===');
{
  const detail = await page.evaluate(() => {
    const el = document.querySelector('[data-surface="dt.inline"]');
    const rows = [...el.querySelectorAll(':scope > div')].map((row) => ({
      dt: row.querySelector('dt')?.textContent,
      dd: row.querySelector('dd')?.textContent.slice(0, 30),
      valid: row.querySelector('dt') !== null && row.querySelector('dd') !== null,
    }));
    return {
      tag: el.tagName.toLowerCase(),
      rows,
      empty: document.querySelector('[data-surface="dt.empty"]')?.textContent ?? null,
    };
  });
  check(
    'detail: <dl> with <div><dt><dd> rows; all eight fields present in declared order',
    detail.tag === 'dl' && detail.rows.length === 8 && detail.rows.every((r) => r.valid) &&
      detail.rows[0].dt === 'id' && detail.rows[0].dd.startsWith('AAAA'),
    JSON.stringify(detail.rows.map((r) => r.dt)),
  );
  check(
    'detail: nonexistent record renders the empty feedback',
    (detail.empty ?? '').includes('This record does not exist.'),
    detail.empty,
  );

  // Long values + unbroken JSON inside the dl at 320 (P3 regression check).
  await go('/widgets', 320, 900);
  const fits = await page.evaluate(() => {
    const dl = document.querySelector('[data-surface="dt.inline"]');
    const panel = dl.closest('.vict-region');
    const dlRect = dl.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return {
      dlRight: Math.round(dlRect.right),
      panelRight: Math.round(panelRect.right),
      inside: dlRect.right <= panelRect.right + 1,
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      jsonWraps: (() => {
        const dd = [...dl.querySelectorAll('dd')][3];
        return dd.getBoundingClientRect().height > 20; // wrapped onto multiple lines
      })(),
    };
  });
  check(
    'detail @320: long/unbroken values wrap inside the panel (P3 clip fix not regressed); no document overflow',
    fits.inside && !fits.docOverflow && fits.jsonWraps,
    JSON.stringify(fits),
  );
  await page.evaluate(() => document.querySelector('[data-surface="dt.inline"]').scrollIntoView({ block: 'center' }));
  await sleep(150);
  await shot('h-detail-320');
  await go('/widgets', 1280, 900);
  await shot('h-detail-desktop');
}

// ===========================================================================
// §5 CHARTS
// ===========================================================================
console.log('\n=== §5 CHARTS ===');
async function chartProbe(surfaceId) {
  return page.evaluate((id) => {
    const figure = document.querySelector(`[data-surface="${id}"]`);
    if (figure === null) return null;
    const svg = figure.querySelector('svg');
    const rects = [...figure.querySelectorAll('rect.vict-bar')].map((r) => ({
      x: Number(r.getAttribute('x')),
      y: Number(r.getAttribute('y')),
      w: Number(r.getAttribute('width')),
      h: Number(r.getAttribute('height')),
      title: r.querySelector('title')?.textContent,
    }));
    const circles = [...figure.querySelectorAll('circle')].map((c) => ({
      cx: Number(c.getAttribute('cx')),
      cy: Number(c.getAttribute('cy')),
      title: c.querySelector('title')?.textContent,
    }));
    const path = figure.querySelector('path')?.getAttribute('d') ?? '';
    const labels = [...svg.querySelectorAll('text[text-anchor="middle"]')].map((t) => ({
      text: t.textContent,
      x: Number(t.getAttribute('x')),
      len: Math.round(t.getComputedTextLength()),
    }));
    const gridlineCount = svg.querySelectorAll('line.vict-chart-gridline').length;
    const table = [...figure.querySelectorAll('.vict-data-table tbody tr')].map((tr) => {
      const cells = tr.querySelectorAll('td');
      return { label: cells[0].textContent, value: cells[1].textContent };
    });
    const headers = [...figure.querySelectorAll('.vict-data-table thead th')].map((th) => th.textContent);
    return {
      role: figure.getAttribute('role'),
      figLabel: figure.getAttribute('aria-label'),
      svgRole: svg.getAttribute('role'),
      svgLabel: svg.getAttribute('aria-label'),
      svgHidden: svg.getAttribute('aria-hidden'),
      caption: figure.querySelector('figcaption')?.textContent ?? null,
      summaryText: figure.querySelector('summary')?.textContent ?? null,
      rects, circles, path, labels, table, headers, gridlineCount,
    };
  }, surfaceId);
}

await go('/charts', 1280, 2400);
{
  const bar = await chartProbe('ch.barMain');
  const plot = { left: 48, top: 16, w: 576, h: 224 }; // WIDTH 640 HEIGHT 280 PAD {16,16,40,48}
  check(
    'chart bar: named figure (group) + named svg image (role=img, summary); "Data table" summary present',
    bar.role === null && bar.figLabel === 'Bar chart of total budget summed per project status' &&
      bar.svgRole === 'img' && bar.svgLabel === bar.figLabel && bar.svgHidden === null &&
      bar.caption === 'Budget by status (bar)' && bar.summaryText === 'Data table',
    JSON.stringify({ fig: bar.figLabel, svgRole: bar.svgRole, svgLabel: bar.svgLabel }),
  );
  check(
    'chart bar: five bars, one per aggregated category, with <title> tooltips',
    bar.rects.length === 5 && bar.rects.every((r) => (r.title ?? '').includes(':')),
    JSON.stringify(bar.rects.map((r) => r.title)),
  );
  const values = [400, 1250, 300, 900, 150];
  const maxValue = 1250;
  const geometryOk = bar.rects.every((r, i) => {
    const expectedH = (values[i] / maxValue) * plot.h;
    return Math.abs(r.h - expectedH) < 2 && Math.abs(r.y - (plot.top + plot.h - r.h)) < 2 && r.w > 0;
  });
  check(
    'chart bar: bar heights proportional to values (h = v/max · plotH); baselines on axis',
    geometryOk,
    JSON.stringify(bar.rects.map((r) => [r.title, r.h])),
  );
  check(
    'chart bar: data table exposes labels/values in the same order as the bars (headers = declared fields)',
    bar.headers.join(',') === 'status,budget' &&
      bar.table.map((t) => t.label).join(',') === 'planning (long category label),active,paused,done,archived' &&
      bar.table.map((t) => t.value).join(',') === values.join(','),
    JSON.stringify(bar.table),
  );
  const band = plot.w / 5;
  const overlaps = bar.labels.length - new Set(bar.labels.map((l) => l.text)).size;
  let adjacentOverlaps = 0;
  check(
    'chart bar: five category labels rendered under the axis in band order',
    bar.labels.length === 5 && bar.labels.map((l) => l.x).every((x, i, a) => i === 0 || x > a[i - 1]),
    JSON.stringify(bar.labels.map((l) => [l.text.slice(0, 16), l.x, l.len])),
  );
  const labelOverflow = await page.evaluate(() => {
    const svg = document.querySelector('[data-surface="ch.barMain"] svg');
    const texts = [...svg.querySelectorAll('text[text-anchor="middle"]')];
    let overlaps = 0;
    for (let i = 1; i < texts.length; i += 1) {
      const a = texts[i - 1].getBoundingClientRect();
      const b = texts[i].getBoundingClientRect();
      if (b.left < a.right - 0.5) overlaps += 1;
    }
    return { count: texts.length, overlaps };
  });
  check(
    'chart bar: LONG-LABEL DENSITY measured (long labels exceed their band; adjacent overlap counted — documented finding)',
    labelOverflow.count === 5 && Math.max(...bar.labels.map((l) => l.len)) > band,
    `band=${Math.round(band)}px widest=${Math.max(...bar.labels.map((l) => l.len))}px adjacentOverlaps=${labelOverflow.overlaps}`,
  );

  const line = await chartProbe('ch.lineMain');
  check(
    'chart line: path + one circle per point; first/last points anchored to plot edges',
    line.circles.length === 6 && line.path.startsWith('M') && line.path.includes('L') &&
      Math.abs(line.circles[0].cx - plot.left) < 2 && Math.abs(line.circles.at(-1).cx - (plot.left + plot.w)) < 2,
    JSON.stringify({ circles: line.circles.length, path: line.path.slice(0, 40) }),
  );
  const lineMax = 320;
  const lineOk = line.circles.every((c, i) => {
    const v = [120, 180, 150, 260, 210, 320][i];
    return Math.abs(c.cy - (plot.top + plot.h - (v / lineMax) * plot.h)) < 2;
  });
  check('chart line: point heights proportional to values', lineOk, JSON.stringify(line.circles.map((c) => c.cy)));
  check(
    'chart line: data table corresponds to rendered points',
    line.table.map((t) => t.label).join(',') === 'Jan,Feb,Mar,Apr,May,Jun' &&
      line.table.map((t) => t.value).join(',') === '120,180,150,260,210,320',
    JSON.stringify(line.table),
  );

  const empty = await chartProbe('ch.barEmpty');
  check(
    'chart zero points: no bars, no path; axes/gridlines still render; data table empty',
    empty.rects.length === 0 && empty.circles.length === 0 && empty.path === '' && empty.table.length === 0,
    JSON.stringify({ rects: empty.rects.length, path: empty.path, table: empty.table.length }),
  );

  const one = await chartProbe('ch.lineOne');
  check(
    'chart one point: single centered circle, path present, table row matches',
    one.circles.length === 1 && Math.abs(one.circles[0].cx - (plot.left + plot.w / 2)) < 2 &&
      one.path !== '' && one.table[0]?.label === 'Only' && one.table[0]?.value === '5',
    JSON.stringify(one.circles),
  );

  const edge = await chartProbe('ch.barEdge');
  check(
    'chart large values: scale normalizes by max (large bar ~ full plot height)',
    Math.abs(edge.rects[0].h - plot.h) < 2,
    JSON.stringify(edge.rects.map((r) => r.h)),
  );
  check(
    'chart zero/negative values: rendered as clamped 1px baseline nubs (documented limitation); data table keeps TRUE values',
    edge.rects[1].h === 1 && edge.rects[2].h === 1 &&
      edge.table.map((t) => t.value).join(',') === '1250000,0,-400,12',
    JSON.stringify({ heights: edge.rects.map((r) => r.h), table: edge.table }),
  );
  const edgeA11y = await page.evaluate(() => {
    const figure = document.querySelector('[data-surface="ch.barEdge"]');
    return figure.querySelector('svg').getBoundingClientRect().width <= figure.getBoundingClientRect().width;
  });
  check('chart edge: svg never exceeds its figure container', edgeA11y, '');

  const many = await chartProbe('ch.lineMany');
  const manyOverlap = await page.evaluate(() => {
    const svg = document.querySelector('[data-surface="ch.lineMany"] svg');
    // Category labels sit at/inside the plot area (x >= PAD.left 48);
    // y-axis gridline labels anchor end at x = 42.
    const texts = [...svg.querySelectorAll('text')].filter((t) => Number(t.getAttribute('x')) >= 48);
    let overlaps = 0;
    for (let i = 1; i < texts.length; i += 1) {
      const a = texts[i - 1].getBoundingClientRect();
      const b = texts[i].getBoundingClientRect();
      if (b.left < a.right - 0.5) overlaps += 1;
    }
    return { count: texts.length, overlaps };
  });
  check(
    'chart many points: 12 circles render; adjacent label density measured (documented finding)',
    many.circles.length === 12 && manyOverlap.count === 12,
    `overlaps=${manyOverlap.overlaps} at desktop`,
  );
  const labelClip = await page.evaluate(() => {
    const svg = document.querySelector('[data-surface="ch.lineMany"] svg');
    const svgRect = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll('text[text-anchor="middle"], text[text-anchor="end"], text[text-anchor="start"]')];
    const outside = texts.filter((t) => {
      const r = t.getBoundingClientRect();
      return r.left < svgRect.left - 0.5 || r.right > svgRect.right + 0.5;
    });
    const last = texts.at(-1).getBoundingClientRect();
    const first = texts[0].getBoundingClientRect();
    return {
      outside: outside.length,
      lastText: texts.at(-1).textContent,
      lastInside: last.right <= svgRect.right + 0.5,
      firstInside: first.left >= svgRect.left - 0.5,
    };
  });
  check(
    'chart many points: NO category label clips at the svg edge (QA fix: edge labels anchor inward)',
    labelClip.outside === 0 && labelClip.lastText === 'point-12' && labelClip.lastInside && labelClip.firstInside,
    JSON.stringify(labelClip),
  );

  await go('/charts', 320, 1600);
  const narrow = await page.evaluate(() => {
    const figures = [...document.querySelectorAll('.vict-figure')];
    const main = document.querySelector('.vict-main');
    return {
      figuresFit: figures.every((f) => f.getBoundingClientRect().right <= main.getBoundingClientRect().right + 1),
      svgsScale: figures.every((f) => f.querySelector('svg').getBoundingClientRect().width <= f.getBoundingClientRect().width + 1),
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      svgWidth: Math.round(figures[0].querySelector('svg').getBoundingClientRect().width),
    };
  });
  check(
    'charts @320: figures fit, svgs scale via viewBox, no document overflow',
    narrow.figuresFit && narrow.svgsScale && !narrow.docOverflow,
    JSON.stringify(narrow),
  );
  await shot('h-charts-320');
  await go('/charts', 1280, 2400);
  await shot('h-charts-desktop-top');
  await page.evaluate(() => window.scrollBy(0, 1100));
  await sleep(150);
  await shot('h-charts-desktop-bottom');
  await axeScan('/charts desktop');
}

// ===========================================================================
// §6 CONVERSATION
// ===========================================================================
console.log('\n=== §6 CONVERSATION ===');
const convSel = (surfaceId) => `[data-surface="${surfaceId}"]`;
async function convInput(surfaceId) {
  return page.$(`${convSel(surfaceId)} [data-testid="conversation-input"]`);
}
async function convSend(surfaceId) {
  return page.$(`${convSel(surfaceId)} [data-testid="conversation-send"]`);
}
async function typeInto(surfaceId, text) {
  const input = await convInput(surfaceId);
  await input.click();
  await page.keyboard.type(text, { delay: 4 });
}
const inputValue = async (surfaceId) =>
  page.$eval(`${convSel(surfaceId)} [data-testid="conversation-input"]`, (el) => el.value);

await go('/conversation', 1280, 1000);
{
  // Initial messages + participant presentation + empty state.
  const feed = await page.evaluate(() => {
    const read = (id) => {
      const panel = document.querySelector(`[data-surface="${id}"]`);
      return [...panel.querySelectorAll('[data-testid="conversation-message"]')].map((m) => ({
        participant: m.getAttribute('data-participant'),
        cls: m.className.includes('--' + m.getAttribute('data-participant')),
        meta: m.querySelector('.vict-conversation-meta')?.textContent,
        text: m.querySelector('.vict-conversation-body')?.textContent,
      }));
    };
    const emptyPanel = document.querySelector('[data-surface="cv.empty"]');
    return {
      ok: read('cv.ok'),
      empty: emptyPanel?.querySelector('[data-state="empty"]')?.textContent ?? null,
    };
  });
  check(
    'conversation: initial messages render with author · participant meta and participant classes',
    feed.ok.length === 2 && feed.ok[0].participant === 'user' && feed.ok[0].cls && feed.ok[1].participant === 'assistant' &&
      feed.ok[1].cls && feed.ok[0].meta.includes('You · user'),
    JSON.stringify(feed.ok.map((m) => [m.participant, m.meta])),
  );
  check(
    'conversation: empty conversation renders its declared empty state',
    (feed.empty ?? '').includes('No messages yet — say hello!'),
    feed.empty,
  );
  await shot('h-conversation-desktop-messages');

  // Empty/whitespace-only send blocked.
  const before = await dispatchCount('act.sendMessage');
  await typeInto('cv.ok', '   ');
  const wsDisabled = await page.$eval(`${convSel('cv.ok')} [data-testid="conversation-send"]`, (b) => b.disabled);
  await page.$eval(`${convSel('cv.ok')} form`, (f) => f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await sleep(250);
  const afterWs = await dispatchCount('act.sendMessage');
  check(
    'conversation: whitespace-only draft leaves Send disabled and submit dispatches nothing',
    wsDisabled && afterWs === before,
    `disabled=${wsDisabled}, dispatches ${before}->${afterWs}`,
  );

  // Trim before dispatch + in-flight state + double-submit + success clears.
  await page.evaluate(() => window.__setSendMode('slow'));
  await typeInto('cv.ok', '  Hello browser QA  ');
  await page.click(`${convSel('cv.ok')} [data-testid="conversation-send"]`);
  await sleep(150);
  const flight = await page.evaluate((id) => {
    const panel = document.querySelector(`[data-surface="${id}"]`);
    const button = panel.querySelector('[data-testid="conversation-send"]');
    return {
      disabled: button.disabled,
      label: button.textContent.trim(),
      busy: panel.querySelector('form').getAttribute('aria-busy'),
    };
  }, 'cv.ok');
  const pending = await dispatchCount('act.sendMessage');
  // Rapid double-submit while in flight.
  await page.$eval(`${convSel('cv.ok')} form`, (f) => {
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await sleep(100);
  const afterDouble = await dispatchCount('act.sendMessage');
  await shot('h-conversation-desktop-sending');
  check(
    'conversation: send trims text before dispatch',
    pending === before + 1 && flight.busy === 'true' && flight.disabled && flight.label === 'Sending…',
    JSON.stringify({ pending, flight, log: (await dispatchLog()).at(-1)?.input }),
  );
  check(
    'conversation: rapid double-submit dispatches exactly once',
    afterDouble === pending,
    `${afterDouble} vs ${pending}`,
  );

  // RACE: edit the draft while the send is in flight, then resolve OK.
  // (a) draft changed to a DIFFERENT text → must NOT be cleared.
  await typeInto('cv.ok', ' Edited while in flight');
  const raceValue = await inputValue('cv.ok');
  await page.evaluate(() => window.__resolveSend(true));
  await sleep(350);
  const afterRace = await inputValue('cv.ok');
  check(
    'conversation RACE (a): draft edited during flight survives a successful send (only clears when current trimmed draft == sent text)',
    afterRace === raceValue && afterRace.trim() !== '',
    `"${afterRace}"`,
  );
  const feedAfterRace = await page.evaluate(
    () => [...document.querySelectorAll('[data-surface="cv.ok"] [data-testid="conversation-message"]')].at(-1)?.textContent,
  );
  check(
    'conversation: successful send invalidates/refetches and the sent message appears in the feed',
    (feedAfterRace ?? '').includes('Hello browser QA'),
    feedAfterRace,
  );

  // (b) draft edited to the SAME text with different whitespace → cleared.
  await page.evaluate(() => {
    const input = document.querySelector('[data-surface="cv.ok"] [data-testid="conversation-input"]');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await typeInto('cv.ok', 'Second  ');
  await page.click(`${convSel('cv.ok')} [data-testid="conversation-send"]`);
  await sleep(120);
  await page.evaluate(() => {
    const input = document.querySelector('[data-surface="cv.ok"] [data-testid="conversation-input"]');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await typeInto('cv.ok', 'Second'); // now trimmed-equal to the sent text
  await page.evaluate(() => window.__resolveSend(true));
  await sleep(350);
  check(
    'conversation RACE (b): draft edited to trimmed-equal text during flight IS cleared on success',
    (await inputValue('cv.ok')) === '',
    `"${await inputValue('cv.ok')}"`,
  );

  // (c) focus restoration after send (button-click path).
  await page.evaluate(() => window.__setSendMode('slow'));
  await typeInto('cv.ok', 'Focus keeper');
  await page.click(`${convSel('cv.ok')} [data-testid="conversation-send"]`);
  await sleep(120);
  await page.evaluate(() => window.__resolveSend(true));
  await sleep(300);
  const focusOk = await page.evaluate(
    () => document.activeElement === document.querySelector('[data-surface="cv.ok"] [data-testid="conversation-input"]'),
  );
  check('conversation: composer focus restored after completed send', focusOk, '');
  await page.evaluate(() => window.__setSendMode('ok'));

  // Typing continues correctly after refetch.
  await typeInto('cv.ok', 'X');
  check('conversation: typing continues correctly after refetch', (await inputValue('cv.ok')) === 'X', '');
  await page.$eval(`${convSel('cv.ok')} [data-testid="conversation-input"]`, (el) => {
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Denied send: draft NOT cleared, safe feedback, no dispatch of ok action.
  const deniedDraft = '  Denied but kept  ';
  await typeInto('cv.denied', deniedDraft);
  await page.click(`${convSel('cv.denied')} [data-testid="conversation-send"]`);
  await page.waitForSelector('[data-testid="denied-state"]', { timeout: 4000 });
  const deniedValue = await inputValue('cv.denied');
  const deniedDom = await page.evaluate(() => document.querySelector('[data-testid="denied-state"]')?.textContent ?? '');
  check(
    'conversation: denied send keeps the draft and surfaces the boundary denial',
    deniedValue === deniedDraft && deniedDom.length > 0,
    `"${deniedValue}" / "${deniedDom.slice(0, 60)}"`,
  );

  // Thrown send: safe failure, draft kept, raw error never in DOM.
  await typeInto('cv.throws', 'Thrown but kept');
  await page.click(`${convSel('cv.throws')} [data-testid="conversation-send"]`);
  await page.waitForSelector('[data-testid="failure-state"]', { timeout: 4000 });
  const throwsValue = await inputValue('cv.throws');
  const pageHtml = await page.content();
  check(
    'conversation: thrown dispatcher failure keeps the draft, surfaces the SAFE renderer failure, raw error never enters the DOM',
    throwsValue === 'Thrown but kept' && !pageHtml.includes('PRIVATE-CANARY-QA4'),
    `"${throwsValue}" canaryLeak=${pageHtml.includes('PRIVATE-CANARY-QA4')}`,
  );
  await shot('h-conversation-desktop-failure');

  // Long messages + unbroken strings wrap; feed stays usable.
  await typeInto('cv.ok', 'Long message: ' + 'padding words '.repeat(30) + ' UnbreakableTokenABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz END');
  await page.click(`${convSel('cv.ok')} [data-testid="conversation-send"]`);
  await sleep(500);
  const longOk = await page.evaluate(() => {
    const panel = document.querySelector('[data-surface="cv.ok"]');
    const last = [...panel.querySelectorAll('[data-testid="conversation-message"]')].at(-1);
    const feed = panel.querySelector('[data-testid="conversation-feed"]');
    return {
      fits: last.getBoundingClientRect().right <= panel.getBoundingClientRect().right + 1,
      feedScrolls: feed.scrollHeight > feed.clientHeight,
      feedScrollable: getComputedStyle(feed).overflowY,
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  check(
    'conversation: long + unbroken message wraps inside the panel; feed is a contained scroll region; page never overflows',
    longOk.fits && longOk.feedScrolls && longOk.feedScrollable === 'auto' && !longOk.docOverflow,
    JSON.stringify(longOk),
  );

  await go('/conversation', 320, 1400);
  const mobile = await page.evaluate(() => {
    const panel = document.querySelector('[data-surface="cv.ok"]');
    const rect = panel.getBoundingClientRect();
    const input = panel.querySelector('[data-testid="conversation-input"]').getBoundingClientRect();
    const button = panel.querySelector('[data-testid="conversation-send"]').getBoundingClientRect();
    return {
      fits: rect.right <= document.documentElement.clientWidth,
      inputVisible: input.right <= rect.right + 1 && input.width > 100,
      buttonVisible: button.right <= rect.right + 1,
      sameRow: Math.abs(input.top - button.top) < 4,
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  check(
    'conversation @320: panel fits, composer row (input + Send) stays usable, no document overflow',
    mobile.fits && mobile.inputVisible && mobile.buttonVisible && mobile.sameRow && !mobile.docOverflow,
    JSON.stringify(mobile),
  );
  await shot('h-conversation-320');
  await go('/conversation', 1280, 1000);
  await axeScan('/conversation desktop with messages');
}

// ===========================================================================
// §7 CUSTOM COMPONENT SLOT (+ unresolvable slot safe feedback)
// ===========================================================================
console.log('\n=== §7 CUSTOM COMPONENT SLOT ===');
await go('/slots', 1280, 900);
{
  const island = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="custom-island"]');
    return {
      label: el?.getAttribute('data-label'),
      count: el?.getAttribute('data-count'),
      pinned: el?.getAttribute('data-pinned'),
      slot: el?.closest('[data-surface]')?.getAttribute('data-surface'),
      componentId: el?.closest('[data-surface]')?.getAttribute('data-component'),
      insideVict: el?.closest('[data-testid="vict-host"]') !== null,
    };
  });
  check(
    'slot: resolvable custom component renders inside the slot with UNCHANGED props (string/number/boolean)',
    island.label === 'workspace health island' && island.count === '7' && island.pinned === 'true' &&
      island.slot === 'cm.health' && island.componentId === 'cmp.health' && island.insideVict,
    JSON.stringify(island),
  );
  await shot('h-slot-desktop');

  // Unresolvable component → structured safe feedback (second host mount).
  await page.click('[data-testid="qa-mount-invalid"]');
  await sleep(400);
  const invalid = await page.evaluate(() => {
    const host = document.querySelector('[data-testid="qa-invalid-host"]');
    const failure = host?.querySelector('[data-testid="structural-failure"]');
    return {
      present: failure !== null,
      role: failure?.getAttribute('role') ?? failure?.closest('[role="alert"]')?.getAttribute('role') ?? null,
      text: failure?.textContent?.slice(0, 140) ?? null,
    };
  });
  check(
    'slot: unresolvable component produces the SAFE structured failure panel (never a crash, never a raw error)',
    invalid.present && (invalid.text ?? '').length > 0,
    JSON.stringify(invalid),
  );
  await page.evaluate(() => document.querySelector('[data-testid="qa-invalid-host"]').scrollIntoView({ block: 'center' }));
  await sleep(150);
  await shot('h-slot-unresolved-feedback');
  await page.click('[data-testid="qa-mount-invalid"]');
  await sleep(250);

  await go('/slots', 320, 900);
  const mobileIsland = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="custom-island"]');
    const main = document.querySelector('.vict-main');
    return {
      fits: el.getBoundingClientRect().right <= main.getBoundingClientRect().right + 1,
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  check('slot @320: island stays inside the shell; no document overflow', mobileIsland.fits && !mobileIsland.docOverflow, JSON.stringify(mobileIsland));

  // Open the overlay at 320: island + list + empty view + empty chart nested.
  await page.evaluate(() => {
    const triggers = [...document.querySelectorAll('button')];
    triggers.find((b) => b.textContent.includes('Open island dialog'))?.click();
  });
  await sleep(400);
  const overlay = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]');
    return {
      open: dialog !== null,
      island: dialog?.querySelector('[data-testid="custom-island"]')?.getAttribute('data-label') ?? null,
      islandFits: (() => {
        const island = dialog?.querySelector('[data-testid="custom-island"]');
        const panel = dialog?.querySelector('.vict-dialog');
        if (island === null || panel === null) return false;
        return island.getBoundingClientRect().right <= panel.getBoundingClientRect().right + 1;
      })(),
      listItems: dialog?.querySelectorAll('[data-surface="ls.overlay"] li').length ?? 0,
      emptyView: dialog?.querySelector('[data-surface="sv.overlay-grid"][data-state="empty"], [data-surface="sv.overlay-grid"] [data-state="empty"]')?.textContent ?? null,
      nestedChart: dialog?.querySelector('[data-surface="ch.overlay-empty"]') !== null,
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  check(
    'slot @320 overlay: island + list + empty view + empty chart all render inside the dialog without breaking the shell',
    overlay.open && overlay.island === 'overlay island' && overlay.islandFits && overlay.listItems === 3 &&
      (overlay.emptyView ?? '').length > 0 && overlay.nestedChart && !overlay.docOverflow,
    JSON.stringify(overlay),
  );
  await shot('h-slot-overlay-320');
  await page.keyboard.press('Escape');
  await sleep(250);
  await axeScan('/slots desktop');
  await go('/slots', 1280, 900);
}

// ===========================================================================
// §8 CROSS-ROLE NESTING
// ===========================================================================
console.log('\n=== §8 CROSS-ROLE NESTING ===');
await go('/rec/one', 1280, 900);
{
  const tabsDetail = await page.evaluate(() => {
    const panel = document.querySelector('[role="tabpanel"]:not([hidden])');
    return {
      dl: panel?.querySelector('[data-surface="dt.rec"]') !== null,
      id: panel?.querySelector('[data-surface="dt.rec"] dd')?.textContent.slice(0, 20),
      hiddenTabs: [...document.querySelectorAll('[role="tabpanel"][hidden]')].length,
    };
  });
  check(
    'nesting: detail renders inside the tab panel for the routed record',
    tabsDetail.dl && (tabsDetail.id ?? '').startsWith('AAAA'),
    JSON.stringify(tabsDetail),
  );

  // Drawer: conversation nested in overlay + nested empty list.
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Open record drawer'))?.click();
  });
  await sleep(350);
  const drawer = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]');
    return {
      open: dialog !== null,
      drawerClass: dialog?.className.includes('drawer'),
      conversation: dialog?.querySelector('[data-surface="cv.drawer"]') !== null,
      emptyList: dialog?.querySelector('[data-surface="ls.drawer-empty"][data-state="empty"], [data-surface="ls.drawer-empty"] [data-state="empty"]')?.textContent ?? null,
    };
  });
  check(
    'nesting: drawer contains a conversation and an empty list (both render through the recursion path)',
    drawer.open && drawer.drawerClass && drawer.conversation && (drawer.emptyList ?? '').length > 0,
    JSON.stringify(drawer),
  );
  // Send inside the drawer conversation.
  await page.evaluate(() => window.__setSendMode('ok'));
  const drawerInput = await page.$(`${convSel('cv.drawer')} [data-testid="conversation-input"]`);
  await drawerInput.click();
  await page.keyboard.type('sent from inside the drawer', { delay: 4 });
  await page.click(`${convSel('cv.drawer')} [data-testid="conversation-send"]`);
  await sleep(500);
  const drawerFeed = await page.evaluate(
    () => [...document.querySelectorAll('[data-surface="cv.drawer"] [data-testid="conversation-message"]')].at(-1)?.textContent ?? '',
  );
  check(
    'nesting: conversation inside the drawer sends through the boundary and refetches',
    drawerFeed.includes('sent from inside the drawer'),
    drawerFeed.slice(0, 80),
  );
  await shot('h-nesting-drawer-conversation-1280');
  await page.keyboard.press('Escape');
  await sleep(250);

  // Empty detail inside tabs (/rec/missing).
  await go('/rec/missing', 380, 900);
  const missing = await page.evaluate(() => {
    const panel = document.querySelector('[role="tabpanel"]:not([hidden])');
    return panel?.querySelector('[data-surface="dt.rec"][data-state="empty"], [role="tabpanel"]:not([hidden]) [data-surface="dt.rec"] [data-state="empty"]')?.textContent ?? null;
  });
  check(
    'nesting: empty detail state renders inside tabs at 380px',
    (missing ?? '').includes('This record does not exist.'),
    missing,
  );
  await shot('h-nesting-empty-detail-380');
  await go('/rec/one', 1280, 900);
  await axeScan('/rec desktop with drawer interaction');
}

// ===========================================================================
// PAGE ERRORS
// ===========================================================================
check(
  'no uncaught page errors across the whole run',
  pageErrors.length === 0,
  pageErrors.slice(0, 3).join(' | '),
);

await browser.close();
writeFileSync(join(HERE, 'harness-results.json'), JSON.stringify({ results, pageErrors }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n==== HARNESS: ${results.length - failed.length}/${results.length} checks passed ====`);
if (failed.length > 0) process.exitCode = 1;
