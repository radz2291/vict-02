import puppeteer from 'puppeteer-core';
import {writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url)),base='http://127.0.0.1:5592';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const page=await browser.newPage(),records=[],errors=[];
await page.setViewport({width:1280,height:720});page.on('pageerror',e=>errors.push(String(e)));
async function record(name,data){records.push({at:new Date().toISOString(),name,data});await writeFile(resolve(out,'production-browser.json'),JSON.stringify({records,errors},null,2));console.log(name,JSON.stringify(data).slice(0,1000))}
async function check(name,ok,data={}){await record(name,{ok,...data});if(!ok)throw Error(name)}
async function clickText(text,selector='button,[role="menuitem"]'){for(const e of await page.$$(selector))if((await e.evaluate(e=>e.textContent?.trim()))===text){await e.click();return}throw Error('Missing '+text)}
async function source(){if(!await page.$('#canonical-source')){if(!await page.$('#document-drawer'))await clickText('Document');await clickText('Source')}return page.$eval('#canonical-source',e=>JSON.parse(e.value))}
async function closeDocument(){if(await page.$('#document-drawer'))await clickText('Document')}
await page.evaluateOnNewDocument(()=>{window.__auditTurns=[];const original=window.fetch;window.fetch=async function(...args){const response=await original.apply(this,args);if(args[0]==='/api/designer-agent'&&args[1]?.method==='POST'){const turn={events:[],complete:false,startedAt:Date.now()};window.__auditTurns.push(turn);void(async()=>{const reader=response.clone().body.getReader(),decoder=new TextDecoder();let buffer='';try{for(;;){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);if(line.trim())turn.events.push({...JSON.parse(line),observedAt:Date.now()})}}}catch(e){turn.error=String(e)}finally{turn.complete=true;turn.endedAt=Date.now();reader.releaseLock()}})()}return response}});
try{
await page.goto(base+'/login');await page.evaluate(async()=>fetch('/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({label:'operator',secret:'studio-local-pass'}),redirect:'manual'}));await page.goto(base+'/design');await page.waitForFunction(()=>document.querySelector('.agent-status')?.textContent.includes('Ready'),{timeout:20000});
await check('empty selection omitted',await page.$('.agent-selection')===null,{context:await page.$eval('.agent-context',e=>e.textContent)});
const before=await source();await closeDocument();
const prompt='Use the palette to add exactly one heading reading "Chat layout independently verified" to this empty screen. Apply it through the screen edit tool. Then reply with a Markdown heading, a short two-item bullet list and one bold phrase explaining the result.';
await page.type('textarea[name="message"]',prompt);await page.keyboard.press('Enter');
await page.waitForFunction(()=>window.__auditTurns.at(-1)?.events.some(e=>e.type==='text'),{polling:100,timeout:240000});await record('observed real provider text during stream',{busy:await page.$eval('.vict-conversation-input',e=>e.getAttribute('aria-busy')),turn:await page.evaluate(()=>window.__auditTurns.at(-1))});await page.screenshot({path:resolve(out,'production-streaming.png')});
await page.waitForFunction(()=>document.querySelector('.vict-conversation-input')?.getAttribute('aria-busy')==='false'&&window.__auditTurns.at(-1)?.complete,{polling:100,timeout:240000});
const turn=await page.evaluate(()=>window.__auditTurns.at(-1)),after=await source();await closeDocument();
await check('real provider completed with visible canonical edit',turn.events.some(e=>e.type==='started'&&e.model==='zai/glm-5.3-flash')&&turn.events.some(e=>e.type==='done'&&e.status==='completed'&&e.applied>=1)&&JSON.stringify(after).includes('Chat layout independently verified'),{turn,document:after,status:await page.$eval('.agent-status',e=>e.textContent)});
await check('terminal clears composer and permits next send',await page.$eval('textarea',e=>e.value)===''&&await page.$('button.agent-stop')===null);
await page.type('textarea[name="message"]','Next request remains editable');await check('terminal send enabled',await page.$eval('[data-testid="conversation-send"]',e=>!e.disabled));await page.$eval('textarea[name="message"]',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}))});
await page.screenshot({path:resolve(out,'production-populated.png')});
await page.click('.canvas-toolbar');await page.keyboard.down('Control');await page.keyboard.press('z');await page.keyboard.up('Control');await check('Undo removes canonical heading',JSON.stringify(await source())===JSON.stringify(before));await closeDocument();
await page.click('.canvas-toolbar');await page.keyboard.down('Control');await page.keyboard.down('Shift');await page.keyboard.press('z');await page.keyboard.up('Shift');await page.keyboard.up('Control');await check('Redo restores canonical source',JSON.stringify(await source())===JSON.stringify(after));await closeDocument();
await page.click('.canvas-toolbar');await page.keyboard.down('Control');await page.keyboard.press('s');await page.keyboard.up('Control');await page.waitForFunction(()=>document.querySelector('.save-state')?.textContent.includes('Saved'));await record('saved',{status:await page.$eval('.save-state',e=>e.textContent)});
const saved=await source();await closeDocument();await record('saved canonical document',{document:saved});
await clickText('File');await clickText('Reload saved version');await check('reload saved version preserves canonical saved edit',JSON.stringify(await source())===JSON.stringify(saved));await closeDocument();await page.screenshot({path:resolve(out,'production-saved-reopened.png')});
await check('production browser no page errors',errors.length===0,{errors});
}catch(e){await record('failure',{error:String(e),body:await page.$eval('body',e=>e.innerText),turns:await page.evaluate(()=>window.__auditTurns)});await page.screenshot({path:resolve(out,'production-failure.png')});process.exitCode=1}finally{await browser.close()}
