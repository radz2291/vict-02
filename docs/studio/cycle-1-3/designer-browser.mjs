// Production UI journey. No network interception, source injection, or model mocks.
// Run from this checkout: node docs/studio/cycle-1-3/designer-browser.mjs
// Each run keeps its own evidence directory and uses a fresh, disposable Chrome profile.
import puppeteer from 'puppeteer-core';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const base = 'http://127.0.0.2:5594';
const candidate = 'e6fa5f976b71150d8c334d4a2bd973fd4a653012';
const run = new Date().toISOString().replace(/[:.]/g, '-');
const out = resolve(dirname(fileURLToPath(import.meta.url)), `designer-browser-${run}`);
await mkdir(out, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'vict-cycle13-designer-'));
const records = [], errors = [], responses = [];
let browser, page;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function record(name, data) {
  records.push({ at: new Date().toISOString(), name, data });
  await writeFile(join(out, 'results.json'), JSON.stringify({ base, candidate, run, records, errors, responses }, null, 2));
  console.log(name, JSON.stringify(data).slice(0, 650));
}
async function check(name, ok, data = {}) {
  await record(name, { ok, ...data });
  if (!ok) throw new Error(name);
}
async function clickText(text, scope = 'body') {
  for (const element of await page.$$(`${scope} button,${scope} [role="menuitem"]`)) {
    const matches = await element.evaluate((e, text) => e.getClientRects().length > 0 &&
      (e.textContent?.trim() === text || e.getAttribute('aria-label') === text), text);
    if (matches) { await element.click(); return; }
  }
  throw new Error(`Visible control missing: ${text} in ${scope}`);
}
async function menu(name, item) {
  await page.keyboard.press('Escape');
  const found = await page.evaluate(name => {
    const button = [...document.querySelectorAll('.studio-menus button')].find(e => e.textContent.trim() === name);
    if (!button) return false;
    button.focus(); return true;
  }, name);
  if (!found) throw new Error(`Missing workspace menu: ${name}`);
  await page.keyboard.press('ArrowDown');
  // Workspace menus expose real Bits menu items; wait rather than assuming animation timing.
  await page.waitForSelector('[role="menuitem"]', { visible: true });
  await clickText(item);
}
async function tab(label, name) {
  const selector = `[role="tablist"][aria-label="${label}"] [role="tab"]`;
  for (const element of await page.$$(selector)) {
    if (await element.evaluate((e, name) => e.textContent?.trim() === name || e.getAttribute('aria-label') === name, name)) {
      // Clicking an already expanded tool page collapses it.
      if (await element.evaluate(e => e.getAttribute('aria-selected') !== 'true')) await element.click();
      return;
    }
  }
  throw new Error(`Missing ${label} tab ${name}`);
}
async function fill(selector, value) {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector);
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
  await page.keyboard.type(value);
}
async function source() {
  if (!await page.$('#document-drawer')) await clickText('Document');
  await clickText('Source', '#document-drawer');
  await page.waitForSelector('#canonical-source');
  const document = await page.$eval('#canonical-source', e => JSON.parse(e.value));
  await clickText('Close document');
  return document;
}
async function selectNode(document, id) {
  await clickText('Design', '.canvas-modes');
  if (!await page.$('#document-drawer')) await clickText('Document');
  await clickText('Layers', '#document-drawer');
  const key = `${document.id}|${id}`;
  const found = await page.evaluate(key => {
    const item = [...document.querySelectorAll('[role="treeitem"][data-key]')].find(e => e.getAttribute('data-key') === key);
    if (!item) return false;
    item.click(); return true;
  }, key);
  if (!found) throw new Error(`Source node missing from Layers: ${id}`);
  await clickText('Close document');
  // Layers changes shared selection without opening floating tools. Click the
  // actual visible canvas source to request the palette, just as a user does.
  const rendered = await page.$$('.design-frame [data-ui-occ]');
  let canvasTarget;
  for (const element of rendered) {
    if (await element.evaluate((e, id) => e.getAttribute('data-ui-node') === id && e.getBoundingClientRect().width > 0, id)) { canvasTarget = element; break; }
  }
  if (!canvasTarget) throw new Error(`No rendered canvas selection for ${id}`);
  await canvasTarget.evaluate(e => e.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await canvasTarget.click({ offset: { x: 4, y: 4 } });
  await page.waitForSelector('.palette', { visible: true });
}
const history = [];
async function mutation(name, predicate, data = {}) {
  const document = await source();
  await check(name, predicate(document), { ...data, document });
  history.push(document);
  return document;
}
async function insert(label, target, definitionId) {
  const before = await source();
  await selectNode(before, target.nodeId);
  await tab('Tool pages', 'Insert tools');
  await page.select('select[aria-label="Insertion destination"]', JSON.stringify([target.nodeId, target.slotName ?? '']));
  await fill('input[aria-label="Search elements"]', label);
  let clicked = false;
  for (const button of await page.$$('.recipes button.recipe')) {
    if (await button.$eval('strong', (e, name) => e.textContent === name, label)) {
      await button.click(); clicked = true; break;
    }
  }
  if (!clicked) throw new Error(`Recipe unavailable in requested destination: ${label}`);
  let inserted;
  const after = await mutation(`Palette inserts ${label}`, document => {
    const ids = definitionId ? Object.values(document.nodes).filter(n => !before.nodes[n.id] && n.definitionId === definitionId).map(n => n.id)
      : Object.keys(document.nodes).filter(id => !before.nodes[id] && document.nodes[id].kind === 'element');
    inserted = ids[0];
    const parent = document.nodes[target.nodeId];
    return !!inserted && (target.slotName ? parent.slots?.[target.slotName]?.children : parent.children)?.includes(inserted);
  }, { target, definitionId });
  return { document: after, id: inserted };
}
async function property(document, id, name) {
  await selectNode(document, id);
  await tab('Tool pages', 'Format tools');
  await tab('Format categories', 'Properties');
  await tab('Component property pages', name[0].toUpperCase() + name.slice(1));
}
async function editList(document, id, name, values) {
  await property(document, id, name);
  const modes = await page.$eval(`select[aria-label="${name} source"]`, e => [...e.options].map(o => o.value));
  await check(`${name} list inspector does not offer scalar literal mode`, !modes.includes('literal'), { modes });
  await fill('textarea[aria-label="Starting value"]', values.join('\n'));
  await clickText('Apply', '.starting-value');
  return mutation(`Inspector edits ${name} list through its canonical state declaration`, next => {
    const expression = next.nodes[id].props[name];
    return expression.type === 'ref' && same(next.localState[expression.path.slice(6)]?.initial, values);
  });
}
async function connectHandles(document, sourceId, targetId) {
  const point = async (id, type) => page.evaluate(({ id, type }) => {
    const node = [...window.document.querySelectorAll('.svelte-flow__node')].find(e => e.getAttribute('data-id') === id);
    const handle = node?.querySelector(`.svelte-flow__handle.${type}`);
    if (!handle) throw new Error(`Missing real ${type} handle for ${id}`);
    const r = handle.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, width: r.width, height: r.height };
  }, { id: encodeURIComponent(JSON.stringify([document.id, 'node', id])), type });
  // Allow Flow's resize/fit effect to finish after the opt-in hint changes height.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const from = await point(sourceId, 'source'), to = await point(targetId, 'target');
  await record('Structure handle hit test', await page.evaluate(({ from, to }) => [from, to].map(p => { const e = window.document.elementFromPoint(p.x, p.y); return { tag: e?.tagName, class: e?.getAttribute('class'), html: e?.outerHTML.slice(0, 800) }; }), { from, to }));
  await record('Real Structure connection gesture', { sourceId, targetId, from, to });
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 24 });
  await record('Structure drag in progress', await page.evaluate(() => ({ connections: window.document.querySelectorAll('.svelte-flow__connection').length, classes: [...window.document.querySelectorAll('.svelte-flow__handle.connecting')].map(e => e.className), notice: window.document.querySelector('.design-status')?.textContent })));
  await page.mouse.up();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await record('Structure drag complete', { notice: await page.$eval('.design-status', e => e.textContent) });
}
async function screenshot(name) { await page.screenshot({ path: join(out, `${name}.png`), fullPage: true }); }

try {
  browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    userDataDir: profile, headless: true, args: ['--no-sandbox'], protocolTimeout: 60000 });
  page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1100 });
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(String(error)));
  page.on('response', response => { if (response.status() >= 400) responses.push({ url: response.url(), status: response.status() }); });
  await page.goto(`${base}/login`);
  const login = await page.evaluate(async () => {
    const response = await fetch('/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ label: 'operator', secret: 'studio-local-pass' }), redirect: 'manual' });
    return { status: response.status, type: response.type };
  });
  await record('Local test login response', login);
  await page.goto(`${base}/design`);
  await page.waitForSelector('.studio-designer');
  await menu('File', 'New screen');
  await fill('dialog.create-screen-dialog input', `Cycle 1.3 Designer QA ${run}`);
  await clickText('Create screen', 'dialog.create-screen-dialog');
  let document = await source(); history.push(document);
  await check('Fresh isolated screen with existing boolean declaration', Object.keys(document.nodes).length === 1 && document.localState.accepted?.type === 'boolean', { document });
  await menu('View', 'Hide chat');
  const section = await insert('Section', { nodeId: document.root });
  const heading = await insert('Heading', { nodeId: document.root });
  document = heading.document;

  await clickText('Structure', '.canvas-modes');
  await page.waitForSelector('.svelte-flow__node');
  await page.select('select[aria-label="Structure source selection"]', encodeURIComponent(JSON.stringify([document.id, 'node', heading.id])));
  await check('Structure source selection identifies authored content', await page.$eval('.structure-details', e => e.textContent.includes('authored selection')));
  await clickText('Design', '.canvas-modes');
  await page.waitForFunction(key => [...window.document.querySelectorAll('[data-ui-selected]')].some(e => e.getAttribute('data-ui-occ') === key), {}, `${document.id}|${heading.id}`);
  await check('Structure selection is shared with the Design canvas', true, { occurrence: `${document.id}|${heading.id}` });
  await clickText('Structure', '.canvas-modes');
  await page.click('.structure-help input[type="checkbox"]');
  await connectHandles(document, heading.id, section.id);
  document = await mutation('Structure supported move writes canonical containment', next => next.nodes[section.id].children.includes(heading.id) && !next.nodes[next.root].children.includes(heading.id));
  await screenshot('01-structure-moved');
  await connectHandles(document, document.root, heading.id);
  await page.waitForFunction(() => window.document.querySelector('.design-status')?.textContent.includes('Move refused'));
  const refused = await source();
  await check('Structure refuses root/cycle move without canonical change', same(refused, document), { notice: await page.$eval('.design-status', e => e.textContent) });
  await page.select('select[aria-label="Structure source selection"]', encodeURIComponent(JSON.stringify([document.id, 'state', 'accepted'])));
  await check('Declared state remains an inspect-only reference', await page.$eval('.structure-details', e => e.textContent.includes('inspect only')) && same(await source(), document));
  await clickText('Design', '.canvas-modes');

  const tabs = await insert('Tabs', { nodeId: document.root }, 'vict.catalog.tabs');
  await check('Tabs recipe contains actual trigger and panel composition', Object.keys(tabs.document.nodes[tabs.id].slots ?? {}).includes('tabs') && Object.keys(tabs.document.nodes[tabs.id].slots ?? {}).includes('panels'));
  const accordion = await insert('Accordion Multiple', { nodeId: document.root }, 'vict.catalog.accordion-multiple');
  await check('Accordion recipe seeds context-owned item', accordion.document.nodes[accordion.document.nodes[accordion.id].slots.items.children[0]].definitionId === 'vict.catalog.accordion-item');
  await insert('Dropdown Menu', { nodeId: document.root }, 'vict.catalog.dropdown-menu');
  const select = await insert('Select Multiple', { nodeId: document.root }, 'vict.catalog.select-multiple');
  await selectNode(select.document, document.root); await tab('Tool pages', 'Insert tools');
  await page.select('select[aria-label="Insertion destination"]', JSON.stringify([document.root, '']));
  await fill('input[aria-label="Search elements"]', 'Select Item');
  await check('Context-owned Select Item is absent at screen root', await page.$$eval('.recipes button strong', elements => elements.every(e => e.textContent !== 'Select Item')));
  await insert('Select Item', { nodeId: select.id, slotName: 'items' }, 'vict.catalog.select-item');
  document = await editList(await source(), select.id, 'values', ['first', 'second']);
  const slider = await insert('Slider', { nodeId: document.root }, 'vict.catalog.slider');
  document = await editList(slider.document, slider.id, 'value', [20, 70]);
  await screenshot('02-number-list-inspector');
  const toggle = await insert('Toggle', { nodeId: document.root }, 'vict.catalog.toggle');
  await property(toggle.document, toggle.id, 'pressed');
  await page.select('select[aria-label="pressed source"]', 'binding');
  await page.select('select[aria-label="pressed reference"]', 'state.accepted');
  document = await mutation('Manual property binds an existing compatible declaration', next => same(next.nodes[toggle.id].props.pressed, { type: 'ref', path: 'state.accepted' }));
  await selectNode(document, toggle.id); await tab('Tool pages', 'Connect tools');
  await page.waitForSelector('select[aria-label="pressedChange state target"]');
  await page.select('select[aria-label="pressedChange state target"]', 'accepted');
  document = await mutation('Manual output connects existing boolean state', next => next.nodes[toggle.id].outputs?.pressedChange?.setState?.key === 'accepted');
  await screenshot('03-output-binding');

  // One canonical history spans actual Flow, palette, Inspector and connection edits.
  for (let i = history.length - 2; i >= 0; i--) {
    await menu('Edit', 'Undo');
    await check(`Shared Undo restores mutation ${i}`, same(await source(), history[i]));
  }
  for (let i = 1; i < history.length; i++) {
    await menu('Edit', 'Redo');
    await check(`Shared Redo restores mutation ${i}`, same(await source(), history[i]));
  }
  await menu('File', 'Save');
  await page.waitForFunction(() => window.document.querySelector('.save-state')?.textContent.includes('Saved'));
  const saved = await source();
  await menu('File', 'Reload saved version');
  await check('Save and reopen preserve exact canonical document', same(await source(), saved), { saved });
  await selectNode(saved, slider.id); await property(saved, slider.id, 'value');
  await check('Saved number list reopens in Inspector', await page.$eval('textarea[aria-label="Starting value"]', e => e.value === '20\n70'));
  await screenshot('04-saved-reopened');
  await check('No browser exceptions', errors.length === 0, { errors });
  await record('Journey complete', { mutationCount: history.length - 1, savedScreen: saved.id, evidence: out });
} catch (error) {
  await record('FAILED OBSERVATION', { error: String(error), stack: error.stack,
    body: page ? await page.$eval('body', e => e.innerText).catch(() => '') : '' });
  if (page) await screenshot('failure').catch(() => {});
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  // profile is the exact directory returned by mkdtemp above; no owner profile is accessed.
  await rm(profile, { recursive: true, force: true });
}
