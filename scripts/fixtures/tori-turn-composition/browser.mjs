import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';

const { chromium } = createRequire(import.meta.url)(process.env.TORI_PLAYWRIGHT_MODULE ?? 'playwright');
const port = process.env.VICT_TURN_PROOF_PORT ?? '48962';
const url = 'http://127.0.0.1:' + port;
const installed = await readFile('./node_modules/@victframework/ui-ai-svelte/package.json', 'utf8');
const manifest = JSON.parse(installed);
assert.equal(manifest.version, '0.4.0-rc.1');
assert.deepEqual(Object.keys(manifest.exports), ['.', './styles.css', './capture', './authoring', './patterns', './components/*', './markdown']);
const host = spawn(process.execPath, ['./node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port, '--strictPort'], {windowsHide:true});
let hostLog = '';
for (const stream of [host.stdout, host.stderr]) stream.on('data', bytes => { hostLog = (hostLog + bytes).slice(-9000); });
let browser;
try {
  for (let i=0;i<100;i++) {
    if (await fetch(url).then(r=>r.ok).catch(()=>false)) break;
    if (host.exitCode!==null || i===99) throw Error('Consumer host did not start.');
    await delay(150);
  }
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror',e=>{ errors.push(e.message); console.error(e.message); });
  page.on('console', e => { if (e.type()==='error') console.error(e.text()); });
  await page.goto(url);
  const row = page.locator('[data-activity-id="research-invocation"]');
  const trigger = row.getByRole('button', {name:/Running Research/});
  await trigger.waitFor();
  assert.equal(await row.getAttribute('data-activity-state'),'running');
  await trigger.focus();
  await page.keyboard.press('Enter');
  for (const text of ['Approved topic only','Waiting for result.','Dispatch receipt']) await row.getByText(text,{exact:false}).waitFor();
  const action = row.getByRole('button',{name:'Open Research Run'});
  await page.keyboard.press('Tab');
  assert.equal(await action.evaluate(node=>node===document.activeElement), true);
  await row.evaluate(el => el.dataset.proofIdentity = 'original');
  await page.evaluate(() => window.dispatchEvent(new Event('proof-settle-tool')));
  await row.getByText('Permitted result',{exact:true}).waitFor({timeout:15000});
  assert.equal(await row.getAttribute('data-proof-identity'), 'original');
  assert.equal(await action.evaluate(node=>node===document.activeElement), true);
  for (const name of ['Memory card','Float card'])
    assert.equal(await page.getByRole('region',{name}).count(), 1);
  await page.keyboard.press('Enter');
  await page.getByRole('status').filter({hasText:'Research Run'}).waitFor();
  await page.getByRole('button',{name:'Review standing directive'}).click();
  await page.getByRole('status').filter({hasText:'Float opened'}).waitFor();
  await page.getByRole('button',{name:'Summary',exact:true}).click();
  await row.getByText('Authorized specialist request.').waitFor();
  assert.equal(await row.getByText('Permitted result').count(), 0);
  assert.equal(await row.getByText('Dispatch receipt').count(), 0);
  await page.getByText('Existing Conversation text').waitFor();
  await page.getByRole('button',{name:/Legacy tool/}).click();
  await page.getByText('Legacy retained input').waitFor();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({verdict:'PASS',node:process.version,browser:browser.version(),checks:['packed exports','per-turn Memory and Float','payloads, ordered attempts and Run action in one disclosure','keyboard open/Tab/activation','same focused row through settlement','Summary hides raw evidence','legacy Conversation']}));
} catch (error) {
  console.error(hostLog);
  throw error;
} finally {
  await browser?.close();
  host.kill();
}
