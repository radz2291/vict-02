// Independent verifier harness for candidate 2a1ab4c0 — combined U2 verification.
// Uses puppeteer-core + real Chrome. Read-only w.r.t. tracked files; writes only
// evidence JSON/screenshots under combined-verify-evidence/.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

export const EV = 'C:/Users/RZ1/Desktop/RZ/vict-02-u2-combined-verify/combined-verify-evidence';
export const SHOTS = path.join(EV, 'shots');
export const JOURNEYS = path.join(EV, 'journeys');
export const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const BASE = 'http://127.0.0.1:5210';
export const PROFILE = 'C:/Users/RZ1/Desktop/RZ/vict-verify-chrome-profile';

fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(JOURNEYS, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    userDataDir: PROFILE,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--window-size=1560,1020',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
}

export async function freshPage(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.__exceptions = [];
  page.on('pageerror', (e) => page.__exceptions.push(`pageerror: ${e?.message ?? e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') page.__exceptions.push(`console.error: ${m.text()}`);
  });
  return { context, page };
}

export async function openWorkbench(page, { width = 1440, height = 900 } = {}) {
  await page.setViewport({ width, height });
  await page.goto(`${BASE}/workbench`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForSelector('[data-ui-occ]', { timeout: 30000 });
  await sleep(600);
}

export async function openEditorReview(page, { width = 1440, height = 900 } = {}) {
  await page.setViewport({ width, height });
  await page.goto(`${BASE}/editor-review`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForSelector('[data-ui-occ]', { timeout: 30000 });
  await sleep(600);
}

export async function shot(page, name) {
  const p = path.join(SHOTS, name);
  await page.screenshot({ path: p });
  return p;
}

export async function occStyle(page, occ, prop) {
  return page.evaluate(
    (occ, prop) => {
      const el = document.querySelector(`[data-ui-occ='${occ}']`);
      if (!el) return { found: false };
      return { found: true, tag: el.tagName, value: getComputedStyle(el).getPropertyValue(prop), outline: getComputedStyle(el).outline };
    },
    occ,
    prop,
  );
}

export async function layersSearch(page, text) {
  const input = await page.$('input[aria-label="Search layers"]');
  await input.click({ clickCount: 3 });
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await input.type(text);
  await sleep(350);
  return page.evaluate(() => {
    const status = document.querySelector('nav[aria-label="Layers"] p[role="status"]');
    const keys = Array.from(document.querySelectorAll('nav[aria-label="Layers"] [role=treeitem]')).map((e) => e.dataset.key);
    return { status: status ? status.textContent.trim() : null, keys };
  });
}

export async function layersClick(page, key) {
  await page.click(`nav[aria-label="Layers"] [data-key="${key}"]`);
  await sleep(400);
}

export async function clearLayersSearch(page) {
  await page.focus('input[aria-label="Search layers"]');
  await page.keyboard.press('Escape');
  await sleep(300);
  return page.evaluate(() => ({
    status: document.querySelector('nav[aria-label="Layers"] p[role="status"]')?.textContent.trim() ?? null,
    keys: Array.from(document.querySelectorAll('nav[aria-label="Layers"] [role=treeitem]')).map((e) => e.dataset.key),
  }));
}

export async function inspectorHeader(page) {
  return page.evaluate(() => {
    const h = document.querySelector('aside[aria-label="Inspector"] h2');
    const crumb = document.querySelector('aside[aria-label="Inspector"] details.breadcrumb summary');
    const crumbFull = document.querySelector('aside[aria-label="Inspector"] details.breadcrumb p');
    return {
      h2: h ? h.textContent.trim() : null,
      crumb: crumb ? crumb.textContent.trim() : null,
      crumbFull: crumbFull ? crumbFull.textContent.trim() : null,
    };
  });
}

export async function inspectorTab(page, name) {
  await page.evaluate((name) => {
    const tabs = Array.from(document.querySelectorAll('nav[aria-label="Inspector sections"] button'));
    const t = tabs.find((b) => b.textContent.trim() === name);
    if (t) t.click();
  }, name);
  await sleep(300);
}

export async function setScope(page, value) {
  await page.select('aside[aria-label="Inspector"] select[aria-label="Edits apply to"]', value);
  await sleep(300);
}

export async function openGroup(page, title) {
  return page.evaluate((title) => {
    const inspector = document.querySelector('aside[aria-label="Inspector"]');
    const summaries = Array.from(inspector.querySelectorAll('details > summary'));
    const s = summaries.find((el) => el.textContent.trim() === title);
    if (!s) return 'missing';
    if (!s.parentElement.open) {
      s.click();
      return 'opened';
    }
    return 'already-open';
  }, title);
}

// Reads (and opens if needed) the control's value-details explanation, which
// contains the "Browser now: …" annotation and the origin line.
export async function valueDetails(page, label) {
  return page.evaluate((label) => {
    const inspector = document.querySelector('aside[aria-label="Inspector"]');
    const summary = inspector.querySelector(`details.origin > summary[aria-label="${label} value details"]`);
    if (!summary) return null;
    const details = summary.parentElement;
    if (!details.open) summary.click();
    return Array.from(details.querySelectorAll('.explanation p')).map((p) => p.textContent.trim());
  }, label);
}

export async function closeValueDetails(page, label) {
  await page.evaluate((label) => {
    const inspector = document.querySelector('aside[aria-label="Inspector"]');
    const summary = inspector.querySelector(`details.origin > summary[aria-label="${label} value details"]`);
    if (summary && summary.parentElement.open) summary.click();
  }, label);
}

export async function setColor(page, label, hex) {
  await page.evaluate(
    (label, hex) => {
      const inspector = document.querySelector('aside[aria-label="Inspector"]');
      const input = inspector.querySelector(`input[type=color][aria-label="${label} picker"]`);
      if (!input) throw new Error(`no color picker for ${label}`);
      input.value = hex;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    label,
    hex,
  );
  await sleep(450);
}

// Returns which editor path exists for the control and its current value.
export async function controlInput(page, label) {
  return page.evaluate((label) => {
    const inspector = document.querySelector('aside[aria-label="Inspector"]');
    const num = inspector.querySelector(`input[type=number][aria-label="${label}"]`);
    if (num) return { kind: 'number', value: num.value };
    const text = inspector.querySelector(`input[type=text][aria-label="${label}"]`);
    if (text) return { kind: 'text', value: text.value };
    return { kind: 'none' };
  }, label);
}

// Types into an input (click, select-all, type), then Tab-blurs to fire change.
export async function commitInput(page, label, text) {
  const info = await controlInput(page, label);
  if (info.kind === 'none') throw new Error(`no editor input for ${label}`);
  const sel = `aside[aria-label="Inspector"] input[type=${info.kind}][aria-label="${label}"]`;
  await page.click(sel, { clickCount: 3 });
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await page.keyboard.type(text);
  await page.keyboard.press('Tab');
  await sleep(450);
  return info;
}

export async function resetControl(page, label) {
  await page.evaluate((label) => {
    const inspector = document.querySelector('aside[aria-label="Inspector"]');
    const btn = inspector.querySelector(`button[aria-label="Reset ${label}"]`);
    if (!btn) throw new Error(`no Reset button for ${label}`);
    btn.click();
  }, label);
  await sleep(450);
}

export async function railButton(page, name) {
  return page.evaluate((name) => {
    const btns = Array.from(document.querySelectorAll('.wb-rail button'));
    const b = btns.find((el) => el.textContent.trim() === name);
    if (!b) return 'missing';
    if (b.disabled) return 'disabled';
    b.click();
    return 'clicked';
  }, name);
}

export async function railState(page) {
  return page.evaluate(() => {
    const rail = document.querySelector('.wb-rail');
    const spans = Array.from(rail.querySelectorAll('span')).map((s) => s.textContent.replace(/\s+/g, ' ').trim());
    const buttons = Object.fromEntries(
      Array.from(rail.querySelectorAll('button')).map((b) => [b.textContent.trim(), b.disabled]),
    );
    return { spans, buttons };
  });
}

export async function activityLines(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.wb-activity-list li')).map((li) => `${li.dataset.kind}: ${li.textContent.trim()}`),
  );
}

export async function spacingInputs(page, type) {
  return page.evaluate((type) => {
    const out = {};
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const input = document.querySelector(`aside[aria-label="Inspector"] input[aria-label="${type} ${side}"]`);
      out[side] = input ? input.value : null;
    }
    const link = document.querySelector(`aside[aria-label="Inspector"] button[aria-label="Link ${type} sides"]`);
    out.linked = link ? link.getAttribute('aria-pressed') : null;
    return out;
  }, type);
}

export async function linkSides(page, type) {
  await page.evaluate((type) => {
    document.querySelector(`aside[aria-label="Inspector"] button[aria-label="Link ${type} sides"]`).click();
  }, type);
  await sleep(300);
}

export function saveJourney(name, data) {
  const p = path.join(JOURNEYS, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  return p;
}

export function finish(name, data) {
  const p = saveJourney(name, data);
  const bad = (data.exceptions ?? []).filter((e) => e.startsWith('pageerror'));
  console.log(`${data.verdict ?? 'DONE'} ${name} -> ${p}`);
  if (bad.length) console.log(`PAGE EXCEPTIONS (${bad.length}):`, bad);
  else console.log('page exceptions: 0');
}
