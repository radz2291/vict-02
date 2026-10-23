/**
 * Browser proof for the independently installed, packed public-package consumer.
 * Run only after its production preview is serving on the declared origin.
 * No owner browser/profile, Studio session, credential, or provider is used.
 * All chat/tool/gallery operations on this page are explicitly simulated.
 */
import puppeteer from 'puppeteer-core';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.VICT_PACKAGE_ORIGIN ?? 'http://127.0.0.1:5595';
const out = resolve(dirname(fileURLToPath(import.meta.url)), 'package-browser-final');
const profile = await mkdtemp(resolve(tmpdir(), 'vict-cycle13-package-browser-'));
await mkdir(out, { recursive: true });
const records = [], errors = [], failedRequests = [], requests = [];
const limitations = [
  'This is the packed consumer presentation fixture, not real-provider or canonical-edit evidence.',
  'Backend approvals, checkpoint restoration, attachments, model selection, terminal execution, subagents and test execution are not implemented by this fixture.',
  'Flow edges have presentation meaning only; this script does not prove application/workflow semantics.',
  'No production failure injector or refusal callback exists in this consumer; failure/refusal semantics require the separate Studio/package regression checks.',
  'Chromium keyboard/geometry checks do not substitute for screen-reader, cross-browser or human visual acceptance.',
  'Package installation integrity and absence of repository aliases are supplied by the separate pack/install evidence, not inferred from screenshots.',
];
let browser;
let page;
let completed = false;
const save = async () => writeFile(resolve(out, 'package-browser.json'), JSON.stringify({
  origin: base, isolatedProfile: profile, completed, records, errors, failedRequests,
  requests, limitations, createdAt: new Date().toISOString(),
}, null, 2));
async function record(name, data) {
  records.push({ name, at: new Date().toISOString(), ...data });
  await save();
  console.log(name, JSON.stringify(data).slice(0, 1400));
}
async function check(name, condition, evidence = {}) {
  await record(name, { status: condition ? 'PASS' : 'FAIL', evidence });
  if (!condition) throw new Error(name);
}
async function test(name, run) {
  try { await run(); }
  catch (error) {
    await record(`${name}: exception`, { status: 'FAIL', error: String(error) });
    try { await page.screenshot({ path: resolve(out, `${name.replace(/[^a-z0-9]+/gi, '-')}-failure.png`), fullPage: false }); } catch {}
  }
}
async function clickText(text, selector = 'button') {
  for (const element of await page.$$(selector)) {
    if ((await element.evaluate(e => e.textContent?.trim())) === text) {
      await element.click();
      return;
    }
  }
  throw new Error(`Missing button ${JSON.stringify(text)} in ${selector}`);
}
const chat = '[aria-label="Conversation showcase"]';
const input = `${chat} [data-testid="conversation-input"]`;
const feed = `${chat} [data-testid="conversation-feed"]`;
const send = `${chat} [data-testid="conversation-send"]`;
const stop = `${chat} [data-testid="conversation-stop"]`;
const userMessages = `${chat} [data-testid="conversation-message"][data-participant="user"]`;
const assistantMessages = `${chat} [data-testid="conversation-message"][data-participant="assistant"]`;
async function replaceInput(text) {
  await page.focus(input);
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
  // Insert text as one browser input operation. Per-character CDP roundtrips
  // can outlast this deliberately short fixture stream on a busy host.
  await page.keyboard.sendCharacter(text);
}
async function settled() {
  await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-busy') === 'false', { timeout: 15000 }, `${chat} form`);
}
async function lastAssistant() {
  return page.$$eval(assistantMessages, elements => elements.at(-1)?.querySelector('.vict-ai-markdown')?.textContent ?? '');
}
async function screenshot(name, fullPage = false) {
  await page.screenshot({ path: resolve(out, name + '.png'), fullPage });
}
const pause = ms => new Promise(done => setTimeout(done, ms));

try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, userDataDir: profile,
    args: ['--disable-background-networking', '--disable-default-apps'],
  });
  page = await browser.newPage();
  page.setDefaultTimeout(12000);
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on('request', request => requests.push({ url: request.url(), method: request.method(), type: request.resourceType() }));
  try {
    await browser.defaultBrowserContext().overridePermissions(base, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
    await record('clipboard permissions', { status: 'INFO', granted: true });
  } catch (error) {
    await record('clipboard permissions', { status: 'INFO', granted: false, error: String(error) });
  }
  await page.goto(base, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector(input);
  await screenshot('consumer-initial');

  await test('initial-public-surfaces', async () => {
    const state = await page.evaluate(() => ({
      title: document.title,
      fixtureNotice: document.body.innerText.includes('Demonstrations are simulated'),
      conversations: document.querySelectorAll('[aria-label="Conversation"]').length,
      nodes: document.querySelectorAll('.svelte-flow__node').length,
      edges: document.querySelectorAll('.svelte-flow__edge').length,
      inputLabels: [...document.querySelectorAll('textarea')].map(e => e.getAttribute('aria-label')),
    }));
    await check('initial public package conversation and Flow present', state.fixtureNotice && state.nodes === 3 && state.edges === 1 && state.inputLabels.every(Boolean), state);
  });

  await test('keyboard-stream-stop-draft', async () => {
    const before = await page.$$eval(userMessages, nodes => nodes.length);
    await replaceInput('Keyboard first line');
    await page.keyboard.down('Shift'); await page.keyboard.press('Enter'); await page.keyboard.up('Shift');
    await page.keyboard.type('Second line');
    const multiline = await page.$eval(input, e => e.value);
    await check('Shift Enter inserts newline without sending', multiline === 'Keyboard first line\nSecond line' && await page.$$eval(userMessages, nodes => nodes.length) === before, { multiline, before });
    await page.keyboard.press('Enter');
    await page.waitForSelector(stop);
    await page.waitForFunction(selector => (document.querySelectorAll(selector).length > 0) && (document.querySelectorAll(selector)[document.querySelectorAll(selector).length - 1].querySelector('.vict-ai-markdown')?.textContent?.length ?? 0) > 5, {}, assistantMessages);
    const first = await lastAssistant();
    await pause(180);
    const second = await lastAssistant();
    await check('streaming grows before completion', second.length > first.length && await page.$eval(`${chat} form`, e => e.getAttribute('aria-busy')) === 'true', { first, second });
    // Screenshot I/O can exceed the remaining fixture duration. Prove the
    // growing stream above, then activate Stop before capturing its result.
    await replaceInput('Next draft survives Stop');
    await page.focus(stop);
    await page.keyboard.press('Enter');
    await settled();
    const stopped = await lastAssistant();
    await pause(250);
    const afterDelay = await lastAssistant();
    const draft = await page.$eval(input, e => e.value);
    await check('Stop fences delayed fixture chunks and keeps next draft', stopped === afterDelay && draft === 'Next draft survives Stop', { stopped, afterDelay, draft });
    await check('terminal Send is available', await page.$eval(send, e => !e.disabled));
    await screenshot('consumer-stopped-draft');
  });

  await test('complete-markdown-and-copy', async () => {
    await settled();
    await replaceInput('Complete this fixture reply');
    await page.click(send);
    await settled();
    const state = await page.$$eval(assistantMessages, elements => {
      const last = elements.at(-1);
      return { text: last?.textContent, bold: last?.querySelector('strong')?.textContent, code: last?.querySelector('pre code')?.textContent, copies: last?.querySelectorAll('[aria-label="Copy message"]').length };
    });
    await check('completed streamed Markdown uses code block and actions', Boolean(state.bold?.includes('No backend action')) && Boolean(state.code?.includes('@victframework/ui-ai-svelte')) && state.copies === 1, state);
    const copies = await page.$$(`${chat} [aria-label="Copy message"]`);
    await copies.at(-1).click();
    await page.waitForFunction(selector => document.querySelector(selector)?.textContent?.includes('Message copied.'), {}, `${chat} .vict-ai-sr`);
    let clipboard;
    try { clipboard = await page.evaluate(() => navigator.clipboard.readText()); }
    catch (error) { clipboard = { unavailable: String(error) }; }
    await check('message copy acknowledges successful write', await page.$eval(`${chat} .vict-ai-sr`, e => e.textContent === 'Message copied.'), { clipboard });
    if (typeof clipboard === 'string') await check('clipboard contains full Markdown reply', clipboard.includes('**No backend action was performed.**') && clipboard.includes('```ts'), { clipboard });
    const codeCopies = await page.$$(`${chat} [data-slot="code-block-copy-button"]`);
    await codeCopies.at(-1).click();
    await page.waitForFunction(selector => [...document.querySelectorAll(selector)].some(e => e.getAttribute('data-copied') === 'true'), {}, `${chat} [data-slot="code-block-copy-button"]`);
    await check('upstream code copy reports copied state', true);
    await screenshot('consumer-completed-markdown');
  });

  await test('long-content-and-scrolling', async () => {
    await replaceInput('Long content fixture: ' + 'unbroken-source-identity-'.repeat(170));
    await page.keyboard.press('Enter');
    await page.waitForSelector(stop);
    await page.click(stop);
    await settled();
    const dimensions = await page.$eval(feed, e => ({ clientHeight: e.clientHeight, scrollHeight: e.scrollHeight, clientWidth: e.clientWidth, scrollWidth: e.scrollWidth }));
    await check('long transcript has a bounded scroll region', dimensions.scrollHeight > dimensions.clientHeight && dimensions.clientHeight > 100, dimensions);
    await page.$eval(feed, e => { e.scrollTop = 0; e.dispatchEvent(new Event('scroll', { bubbles: true })); });
    await pause(250);
    const button = `${chat} [aria-label="Scroll to latest message"]`;
    await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('data-active') === 'true', {}, button);
    await page.click(button);
    await page.waitForFunction(selector => { const e = document.querySelector(selector); return e && e.scrollTop > 0; }, {}, feed);
    const after = await page.$eval(feed, e => ({ top: e.scrollTop, height: e.clientHeight, scrollHeight: e.scrollHeight }));
    await check('upstream scroll-to-latest navigates transcript', after.top > 0, after);
  });

  await test('complete-family-inventory', async () => {
    const expected = ['chain-of-thought','chat','checkpoint','confirmation','context','file-tree','inline-citation','message','model-selector','plan','prompt-input','queue','reasoning','sources','stack-trace','subagent','suggestion','task','terminal','test-results','tool'];
    const actual = await page.$$eval('[data-ai-pattern]', elements => elements.map(e => ({ id: e.getAttribute('data-ai-pattern'), width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height, text: e.textContent?.trim() })));
    await check('all 21 distinct patterns render with content', actual.length === 21 && expected.every(id => actual.filter(item => item.id === id && item.width > 100 && item.height > 30 && item.text.length > id.length).length === 1), { expected, actual });
    await page.$eval('[aria-label="AI Elements complete pattern gallery"]', e => e.scrollIntoView({ block: 'start' }));
    await screenshot('consumer-gallery', true);
  });

  await test('gallery-host-contracts', async () => {
    await clickText('Approve', '[data-ai-pattern="confirmation"] button');
    await page.waitForFunction(() => document.querySelector('[aria-label="AI Elements complete pattern gallery"] [role="status"]')?.textContent?.includes('Simulated approval'));
    await clickText('Deny', '[data-ai-pattern="confirmation"] button');
    await page.waitForFunction(() => document.querySelector('[aria-label="AI Elements complete pattern gallery"] [role="status"]')?.textContent?.includes('Simulated denial'));
    await clickText('Restore checkpoint', '[data-ai-pattern="checkpoint"] button');
    await page.waitForFunction(() => document.querySelector('[aria-label="AI Elements complete pattern gallery"] [role="status"]')?.textContent?.includes('no document restored'));
    await clickText('Home screen', '[data-ai-pattern="file-tree"] button');
    await page.waitForFunction(() => document.querySelector('[aria-label="AI Elements complete pattern gallery"] [role="status"]')?.textContent?.includes('screens/home'));
    await clickText('Explain this screen', '[data-ai-pattern="suggestion"] button');
    await check('optional actions disclose simulation and route to host callbacks', await page.$eval('[aria-label="AI Elements complete pattern gallery"] [role="status"]', e => e.textContent.includes('Simulated suggestion')));
    const modelButtons = await page.$$('[data-ai-pattern="model-selector"] button');
    await modelButtons[0].focus(); await page.keyboard.press('Enter'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-ai-pattern="model-selector"]')?.textContent?.includes('Other example'));
    await check('model selector keyboard navigation changes fixture only', await page.$eval('[aria-label="AI Elements complete pattern gallery"] [role="status"]', e => e.textContent.includes('server configuration unchanged')));
    await page.hover('[data-ai-pattern="context"] button');
    await page.waitForSelector('[data-slot="hover-card-content"]', { visible: true });
    const portal = await page.$eval('[data-slot="hover-card-content"]', e => ({ insideScope: Boolean(e.closest('.vict-ai')), background: getComputedStyle(e).backgroundColor, text: e.textContent }));
    await check('portaled context uses isolated upstream styling', portal.insideScope && portal.background !== 'rgba(0, 0, 0, 0)' && portal.text.includes('4200'), portal);
    await page.mouse.move(0, 0); await page.keyboard.press('Escape');
    await clickText('1 sources', '[data-ai-pattern="sources"] button');
    const links = await page.$$eval('[data-ai-pattern="sources"] a', elements => elements.map(e => ({ href: e.getAttribute('href'), rel: e.getAttribute('rel'), target: e.getAttribute('target') })));
    await check('source links have explicit safe external navigation', links.length === 1 && links.every(e => /^https?:\/\//.test(e.href) && e.rel.includes('noopener') && e.rel.includes('noreferrer') && e.target === '_blank'), { links });
  });

  await test('native-host-css-isolation', async () => {
    const result = await page.evaluate(async () => {
      const properties = ['fontFamily','fontSize','fontWeight','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderTopStyle','borderRadius','backgroundColor','color','boxShadow'];
      const pick = element => Object.fromEntries(properties.map(key => [key, getComputedStyle(element)[key]]));
      const host = pick(document.getElementById('unrelated-button'));
      const iframe = document.createElement('iframe');
      iframe.title = 'Temporary isolated native-button comparison';
      iframe.style.cssText = 'position:fixed;left:-10000px;width:400px;height:100px';
      document.body.append(iframe);
      iframe.contentDocument.open();
      iframe.contentDocument.write('<!doctype html><style>body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#f4f6fa;color:#172033}</style><button>Native host button</button>');
      iframe.contentDocument.close();
      const element = iframe.contentDocument.querySelector('button');
      const native = Object.fromEntries(properties.map(key => [key, iframe.contentWindow.getComputedStyle(element)[key]]));
      iframe.remove();
      return { host, native, differences: properties.filter(key => host[key] !== native[key]) };
    });
    await check('unrelated host button retains native styles outside AI scope', result.differences.length === 0, result);
  });

  await test('flow-selection-connection-controls', async () => {
    await page.setViewport({ width: 1440, height: 1000 });
    await page.$eval('[aria-label="Node showcase"]', e => e.scrollIntoView({ block: 'center' }));
    await page.click('.svelte-flow__controls-fitview');
    await pause(350);
    const node = '.svelte-flow__node[data-id="view"]';
    await page.focus(node); await page.keyboard.press('Enter');
    await page.waitForFunction(selector => document.querySelector(selector)?.classList.contains('selected'), {}, node);
    const beforeMove = await page.$eval(node, e => e.style.transform);
    await page.keyboard.press('ArrowRight');
    const afterMove = await page.$eval(node, e => e.style.transform);
    await check('Flow node keyboard selection and navigation', beforeMove !== afterMove, { beforeMove, afterMove });
    const source = await page.$('.svelte-flow__node[data-id="view"] .svelte-flow__handle.source');
    const target = await page.$('.svelte-flow__node[data-id="output"] .svelte-flow__handle.target');
    if (!source || !target) throw new Error('Expected source/target handles missing');
    const sourceBox = await source.boundingBox(), targetBox = await target.boundingBox();
    const edgeCount = await page.$$eval('.svelte-flow__edge', nodes => nodes.length);
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 20 });
    await page.mouse.up();
    await page.waitForFunction(before => document.querySelectorAll('.svelte-flow__edge').length === before + 1, {}, edgeCount);
    const feedback = await page.$eval('[aria-label="Node showcase"]', e => e.textContent);
    await check('public addEdge callback connects view to output', feedback.includes('Connected view to output.'), { edgeCountBefore: edgeCount, feedback });
    const beforeZoom = await page.$eval('.svelte-flow__viewport', e => e.style.transform);
    await page.click('.svelte-flow__controls-zoomin'); await pause(350);
    const afterZoom = await page.$eval('.svelte-flow__viewport', e => e.style.transform);
    await page.click('.svelte-flow__controls-zoomout'); await page.click('.svelte-flow__controls-fitview');
    await check('Flow controls alter viewport and minimap renders', beforeZoom !== afterZoom && await page.$('.svelte-flow__minimap') !== null, { beforeZoom, afterZoom, minimapNodes: await page.$$eval('.svelte-flow__minimap-node', nodes => nodes.length) });
    await screenshot('consumer-flow-connected');
  });

  await test('responsive-geometry', async () => {
    for (const [width, height] of [[1440,1000],[820,800],[390,844]]) {
      await page.setViewport({ width, height });
      await page.$eval(chat, e => e.scrollIntoView({ block: 'start' }));
      await pause(150);
      const geometry = await page.evaluate(({ chat, input, feed }) => {
        const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom }; };
        return { viewport:innerWidth, document:document.documentElement.scrollWidth, panel:box(chat), input:box(input), feed:box(feed), form:box(chat+' form') };
      }, { chat, input, feed });
      await check(`responsive containment ${width}x${height}`, geometry.document <= width + 2 && geometry.input.right <= geometry.panel.right + 2 && geometry.input.x >= geometry.panel.x - 2 && geometry.form.bottom <= geometry.panel.bottom + 2 && geometry.feed.bottom <= geometry.form.y + 2 && geometry.feed.height > 100, geometry);
      await screenshot(`consumer-responsive-${width}x${height}`);
    }
  });

  await test('no-runtime-or-backend-errors', async () => {
    const apiCalls = requests.filter(request => { try { return new URL(request.url).pathname.startsWith('/api/'); } catch { return false; } });
    await check('presentation fixture makes no backend API calls', apiCalls.length === 0, { apiCalls });
    await check('no uncaught browser errors', errors.length === 0, { errors, failedRequests });
  });
  completed = true;
} catch (error) {
  await record('harness setup or page failure', { status: 'FAIL', error: String(error) });
  if (page) { try { await screenshot('consumer-fatal'); } catch {} }
} finally {
  await save();
  if (browser) await browser.close();
  if (!completed || records.some(record => record.status === 'FAIL')) process.exitCode = 1;
  console.log(`Evidence: ${out}`);
}
