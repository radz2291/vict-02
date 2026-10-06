import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire('C:/Users/RZ1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/x.js');
const puppeteer=(await import('file:///C:/Users/RZ1/Desktop/RZ/vict-02-u2-inspector-ux/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).default;
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
await page.setViewport({width:1440,height:900});
const out=new URL('./',import.meta.url).pathname.replace(/^\/C:/,'C:')+'round2/';
const log=[];const errors=[];
process.on('uncaughtException',e=>{fs.writeFileSync(out+'failed-journeys.json',JSON.stringify({log,errors,error:String(e)},null,2));console.error(e);browser.close().finally(()=>process.exit(1));});
page.on('pageerror',e=>errors.push(String(e)));
const pause=()=>new Promise(r=>setTimeout(r,250));
async function button(text,scope=''){const found=await page.evaluate((text,scope)=>{const root=scope?document.querySelector(scope):document;const el=[...root.querySelectorAll('button,summary')].find(x=>x.textContent.trim()===text);if(!el) return false;el.click();return true;},text,scope);if(!found)throw Error('Missing '+text);await pause();}
async function input(label,value){await page.evaluate((label,value)=>{const e=document.querySelector(`[aria-label="${label}"]`);if(!e)throw Error('Missing '+label);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));},label,value);await pause();}
async function snap(name){await page.screenshot({path:out+name+'.png',fullPage:true});}
async function state(){return page.evaluate(()=>({heading:document.querySelector('.canvas h1')?.textContent,size:getComputedStyle(document.querySelector('.canvas h1')).fontSize,selection:document.querySelector('.uv-inspector h2')?.textContent,selected:[...document.querySelectorAll('[role=treeitem][aria-selected=true]')].map(e=>({name:e.textContent,key:e.dataset.key})),articles:[...document.querySelectorAll('.canvas article')].map(e=>({bg:getComputedStyle(e).backgroundColor,padding:getComputedStyle(e).padding,paddingTop:getComputedStyle(e).paddingTop})),scroll:document.documentElement.scrollWidth,viewport:innerWidth}));}
await page.goto('http://127.0.0.1:5198/editor-review');await page.waitForSelector('.canvas h1');
await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForSelector('.canvas h1');
await page.click('.canvas h1');await pause();
log.push({initial:await state()});await snap('selected-heading-1440');
await input('Text content','Independent founder heading');await button('Apply text');
await button('Style','.uv-inspector');await input('Text size','52');
log.push({headingEdited:await state()});
await page.evaluate(()=>{const control=document.querySelector('[aria-label="Text color"]')?.closest('.control');control.querySelector('summary').click();});
log.push({headingColorOrigin:await page.$eval('[aria-label="Text color"]',e=>e.closest('.control').innerText)});
await button('Override Text color');await input('Text color','#112233');
log.push({overrideColor:await page.$eval('.canvas h1',e=>getComputedStyle(e).color)});
await page.click('[aria-label="Reset Text color"]');await pause();
log.push({resetColor:await page.$eval('.canvas h1',e=>getComputedStyle(e).color)});
await page.evaluate(()=>{const e=[...document.querySelectorAll('[role=treeitem]')].find(e=>e.textContent.includes('Research service'));e.click();});await pause();
await page.evaluate(()=>[...document.querySelectorAll('[role=treeitem]')].find(e=>e.textContent.includes('Service card')&&!e.textContent.includes('Component')).click());await pause();
log.push({cardSelected:await state()});
await input('Background picker','#ccddee');log.push({sharedBackground:await state()});
await input('Edits apply to','instance');await input('Background picker','#aa8833');log.push({instanceBackground:await state()});await snap('instance-selected-1440');
await input('Edits apply to','shared');await button('Size & spacing');await input('padding top','37');log.push({spacing:await state()});
await button('Undo');log.push({undo:await state()});await button('Redo');log.push({redo:await state()});
await button('Save');log.push({saved:await page.$eval('[role=status]',e=>e.innerText)});
await page.reload();await page.waitForSelector('.canvas h1');log.push({reload:await state()});await button('Reopen saved');log.push({reopen:await state()});
// Keyboard exact selection and collapsing a selected ancestor.
await page.evaluate(()=>document.querySelector('[role=treeitem]').focus());await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await pause();log.push({keyboard:await state(),focused:await page.evaluate(()=>document.activeElement?.textContent)});
await page.click('[aria-label="Collapse Introduction"]');await pause();log.push({collapsedTreeTabStops:await page.$$eval('[role=treeitem]',es=>es.filter(e=>e.tabIndex===0).map(e=>e.textContent))});await snap('collapsed-tree');
await page.evaluate(()=>document.querySelector('[aria-label="Editing history"] button:not(:disabled)').focus());
for(let n=0;n<10;n++){await page.keyboard.press('Tab');if(await page.evaluate(()=>document.activeElement?.getAttribute('role')==='treeitem'))break;}
log.push({tabReentry:await page.evaluate(()=>({role:document.activeElement?.getAttribute('role'),name:document.activeElement?.textContent,key:document.activeElement?.dataset.key}))});
await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await pause();log.push({afterCollapseKeyboard:await state(),focus:await page.evaluate(()=>document.activeElement?.textContent)});
// Responsive selected element states.
for(const [width,height] of [[1024,768],[390,844]]){await page.setViewport({width,height});await page.evaluate(()=>{document.querySelector('.canvas h1').click();});await pause();await button('Style','.uv-inspector');await snap('selected-'+width);log.push({responsive:{width,height,state:await state(),controls:await page.$$eval('.uv-inspector input,.uv-inspector select',es=>es.map(e=>({label:e.getAttribute('aria-label'),width:e.getBoundingClientRect().width,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})))}});}
await page.setViewport({width:1440,height:900});await pause();log.push({resize1440Actual:await state(),display:await page.$eval('[aria-label="Text size"]',e=>e.closest('.control').innerText)});await input('Preview width','480');await snap('container-480');log.push({container480:await state(),display:await page.$eval('[aria-label="Text size"]',e=>e.closest('.control').innerText),dirty:await page.$eval('[role=status]',e=>e.innerText)});
await page.evaluate(()=>[...document.querySelectorAll('[role=treeitem]')].find(e=>e.textContent.includes('Research service')).click());await pause();await page.evaluate(()=>[...document.querySelectorAll('[role=treeitem]')].find(e=>e.textContent.includes('Service card')&&!e.textContent.includes('Component')).click());await pause();await button('Size & spacing');
for(const width of ['480','Full','390','Full']){await input('Preview width',width);await pause();log.push({containerMeasurement:{width,actual:await page.$eval('.canvas article',e=>getComputedStyle(e).paddingTop),display:await page.$eval('[aria-label="padding top"]',e=>e.closest('.control').innerText),dirty:await page.$eval('[role=status]',e=>e.innerText)}});}
await page.evaluate(()=>document.querySelector('.canvas h1').click());await pause();await input('Style target','narrow');log.push({narrowTarget:await page.$eval('[aria-label="Text size"]',e=>({value:e.value,type:e.type,origin:e.closest('.control').innerText}))});await input('Text size','35');log.push({conditionEdited:await state()});await page.click('[aria-label="Reset Text size"]');await pause();log.push({conditionReset:await state()});
fs.writeFileSync(out+'journeys.json',JSON.stringify({candidate:'d0ba90cfcd5efead2b7c7c82d37a2ed29483d715',log,errors},null,2));
console.log(JSON.stringify({log,errors},null,2));await browser.close();



