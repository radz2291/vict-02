import puppeteer from 'puppeteer-core';
import {writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url));
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,protocolTimeout:1900000,args:['--no-sandbox']});
const page=await browser.newPage(),records=[],errors=[];await page.setViewport({width:1280,height:720});page.on('pageerror',e=>errors.push(String(e)));
async function record(name,data){records.push({at:new Date().toISOString(),name,data});await writeFile(resolve(out,'browser-fences.json'),JSON.stringify({records,errors},null,2));console.log(name,JSON.stringify(data).slice(0,800))}
async function check(name,ok,data={}){await record(name,{ok,...data});if(!ok)throw Error(name)}
async function clickText(text){for(const e of await page.$$('button,[role="menuitem"]'))if((await e.evaluate(e=>e.textContent?.trim()))===text){await e.click();return}throw Error('Missing '+text)}
async function source(){if(!await page.$('#canonical-source')){if(!await page.$('#document-drawer'))await clickText('Document');await clickText('Source')}return page.$eval('#canonical-source',e=>JSON.parse(e.value))}
async function draft(value){await source();await page.$eval('#canonical-source',(e,value)=>{e.value=JSON.stringify(value,null,2);e.dispatchEvent(new Event('input',{bubbles:true}))},value)}
async function closeDocument(){if(await page.$('#document-drawer'))await clickText('Document')}
async function send(text){await page.evaluate(()=>{window.__holdProposal=true;window.__pendingProposal=null});await page.type('textarea[name="message"]',text);await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__pendingProposal,{polling:100,timeout:1200000})}
async function done(){await page.waitForFunction(()=>document.querySelector('.vict-conversation-input')?.getAttribute('aria-busy')==='false'&&window.__auditTurns.at(-1)?.complete,{polling:100,timeout:1200000});return page.evaluate(()=>window.__auditTurns.at(-1))}
// Test-only transport delay gates the real provider's first proposal before the
// actual Designer consumes it. Proposal bytes, validation and acknowledgements
// are unchanged. This makes human-intervention races reproducible.
await page.evaluateOnNewDocument(()=>{window.__auditTurns=[];window.__holdProposal=false;const original=window.fetch;window.fetch=async function(...args){const response=await original.apply(this,args);if(args[0]==='/api/designer-agent/ack'&&args[1]?.body)window.__auditTurns.at(-1)?.acks.push(JSON.parse(args[1].body));if(args[0]!=='/api/designer-agent'||args[1]?.method!=='POST'||!response.ok)return response;const turn={request:JSON.parse(args[1].body),events:[],acks:[],complete:false,startedAt:Date.now()};window.__auditTurns.push(turn);const reader=response.body.getReader(),decoder=new TextDecoder(),encoder=new TextEncoder();let buffer='';const stream=new ReadableStream({async start(controller){try{for(;;){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);if(line.trim()){const event=JSON.parse(line);turn.events.push({...event,observedAt:Date.now()});if(event.type==='proposal'&&window.__holdProposal){window.__pendingProposal=event.proposal;while(window.__holdProposal)await new Promise(resolve=>setTimeout(resolve,20))}controller.enqueue(encoder.encode(line+'\n'))}}}controller.close()}catch(e){turn.error=String(e);controller.error(e)}finally{turn.complete=true;turn.endedAt=Date.now();reader.releaseLock()}}});return new Response(stream,{status:response.status,headers:response.headers})}});
try{
await page.goto('http://127.0.0.1:5592/login');await page.evaluate(async()=>fetch('/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({label:'operator',secret:'studio-local-pass'}),redirect:'manual'}));await page.goto('http://127.0.0.1:5592/design');await page.waitForFunction(()=>document.querySelector('.agent-status')?.textContent.includes('Ready'),{timeout:20000});
const initial=await source();await closeDocument();
await send('Add exactly one heading reading "Stale proposal must stay absent" to this open screen using the edit tool.');
const manual=structuredClone(initial);manual.nodes.screen.attributes['aria-label']='Independent manual intervention';await draft(manual);await clickText('Apply source');await closeDocument();await page.evaluate(()=>window.__holdProposal=false);
const stale=await done(),afterStale=await source();await closeDocument();
await check('genuine manual edit refuses real proposal with zero agent effects',stale.acks.length>=1&&stale.acks.every(a=>!a.receipt.ok&&a.receipt.code==='UI_DOC_STALE_REVISION')&&stale.events.some(e=>e.type==='done'&&e.applied===0)&&JSON.stringify(afterStale)===JSON.stringify(manual),{turn:stale,document:afterStale,status:await page.$eval('.agent-status',e=>e.textContent)});await page.screenshot({path:resolve(out,'browser-real-stale-refusal.png')});
await send('Fresh request: add exactly one heading reading "Draft proposal must stay absent" to this open screen using the edit tool.');
const pending=structuredClone(afterStale);pending.nodes.screen.attributes['aria-label']='Unapplied source draft retained';await draft(pending);await page.evaluate(()=>window.__holdProposal=false);
const refusedDraft=await done();
await check('unapplied source draft refuses real proposal and remains intact',refusedDraft.acks.length>=1&&refusedDraft.acks.every(a=>!a.receipt.ok&&a.receipt.code==='STUDIO_AGENT_DRAFT')&&refusedDraft.events.some(e=>e.type==='done'&&e.applied===0)&&JSON.stringify(await source())===JSON.stringify(pending),{turn:refusedDraft,draft:await source(),saveState:await page.$eval('.save-state',e=>e.textContent)});await page.screenshot({path:resolve(out,'browser-real-draft-refusal.png')});
await clickText('Discard draft');await check('discarding draft reveals unchanged canonical document',JSON.stringify(await source())===JSON.stringify(afterStale));await check('no browser errors',errors.length===0,{errors});
}catch(e){await page.evaluate(()=>window.__holdProposal=false);await record('failure',{error:String(e),body:await page.$eval('body',e=>e.innerText),turns:await page.evaluate(()=>window.__auditTurns)});await page.screenshot({path:resolve(out,'browser-fences-failure.png')});process.exitCode=1}finally{await browser.close()}


