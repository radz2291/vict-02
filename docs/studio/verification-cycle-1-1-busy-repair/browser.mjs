// Two real Designer tabs sharing one authenticated session on a verifier-only origin.
import puppeteer from 'puppeteer-core';
import {writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url)),base='http://127.0.0.1:5592';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const records=[],errors=[];
async function record(name,data){records.push({at:new Date().toISOString(),name,data});await writeFile(resolve(out,'browser.json'),JSON.stringify({records,errors},null,2));console.log(name,JSON.stringify(data).slice(0,1600));}
async function check(name,ok,data={}){await record(name,{ok,...data});if(!ok)throw Error(name);}
async function prepare(){const page=await browser.newPage();await page.setViewport({width:1440,height:950});page.on('pageerror',error=>errors.push(String(error)));await page.evaluateOnNewDocument(()=>{
 window.__auditTurns=[];const original=window.fetch;
 window.fetch=async function(...args){const response=await original.apply(this,args);if(args[0]==='/api/designer-agent'&&args[1]?.method==='POST'){
  const turn={events:[],complete:false};window.__auditTurns.push(turn);
  void(async()=>{const reader=response.clone().body.getReader(),decoder=new TextDecoder();let buffer='';try{for(;;){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);if(line.trim())turn.events.push(JSON.parse(line));}}}catch(error){turn.error=String(error)}finally{turn.complete=true;reader.releaseLock()}})();
 }return response;};
});return page;}
async function clickText(page,text,selector='button,[role="menuitem"]'){await page.bringToFront();for(const el of await page.$$(selector))if((await el.evaluate(e=>e.textContent?.trim()))===text){await el.click();return}throw Error('Missing '+text);}
async function source(page){if(!await page.$('#canonical-source')){if(!await page.$('#document-drawer'))await clickText(page,'Document');await clickText(page,'Source')}return page.$eval('#canonical-source',e=>JSON.parse(e.value));}
async function closeDocument(page){if(await page.$('#document-drawer'))await clickText(page,'Document');}
async function submit(page,text){await page.bringToFront();if(text!==undefined)await page.$eval('[data-testid="conversation-input"]',(e,t)=>{e.value=t;e.dispatchEvent(new Event('input',{bubbles:true}))},text);await page.click('[data-testid="conversation-send"]');}
async function idle(page){await page.waitForFunction(()=>document.querySelector('.vict-conversation-input')?.getAttribute('aria-busy')==='false'&&window.__auditTurns.at(-1)?.complete,{polling:100,timeout:240000});}
const primary=await prepare(),secondary=await prepare();
try{
 await primary.goto(base+'/login');const login=await primary.evaluate(async()=>{const response=await fetch('/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({label:'operator',secret:'studio-local-pass'}),redirect:'manual'});return{status:response.status,type:response.type}});await record('same-origin login action',login);await primary.goto(base+'/design');await secondary.goto(base+'/design');
 for(const page of [primary,secondary]){await page.bringToFront();await page.waitForFunction(()=>document.querySelector('.agent-status')?.textContent.includes('Ready'),{polling:100,timeout:15000})}
 const before=await source(secondary);await closeDocument(secondary);
 await submit(primary,'Read the current empty screen. Add a text note "Primary admission probe", then read the result and briefly explain the local preview.');await primary.waitForFunction(()=>window.__auditTurns.at(-1)?.events.some(e=>e.type==='started'),{polling:100,timeout:15000});
 const prompt='Add one heading "Busy repair verified" to this empty screen using the palette.';
 await submit(secondary,prompt);await idle(secondary);const refused=await secondary.evaluate(()=>window.__auditTurns.at(-1));const status=await secondary.$eval('.agent-status',e=>e.textContent);
 await check('real active same-session turn refuses with BUSY and accurate feedback',refused.events.some(e=>e.type==='done'&&e.code==='STUDIO_AGENT_BUSY')&&!refused.events.some(e=>e.type==='started')&&status.includes('Another agent turn is still running')&&!status.includes('provider'),{status,events:refused.events});
 await check('busy refusal retains draft and has zero document effects',await secondary.$eval('[data-testid="conversation-input"]',e=>e.value)===prompt&&JSON.stringify(await source(secondary))===JSON.stringify(before));await closeDocument(secondary);await secondary.screenshot({path:resolve(out,'busy-draft-retained.png'),fullPage:true});
 const deletion=primary.waitForResponse(r=>r.url()===base+'/api/designer-agent'&&r.request().method()==='DELETE',{timeout:15000});await clickText(primary,'Stop','.agent-chat header button');const stopped=await deletion;await check('primary Stop accepted or already ended',stopped.status()===200||stopped.status()===404,{httpStatus:stopped.status()});
 const retryAt=Date.now();await submit(secondary);await secondary.waitForFunction(()=>window.__auditTurns.length===2&&window.__auditTurns.at(-1).events.some(e=>e.type==='started'),{polling:100,timeout:15000});await record('retry admitted after Stop',{elapsedMs:Date.now()-retryAt});await idle(secondary);const accepted=await secondary.evaluate(()=>window.__auditTurns.at(-1));const after=await source(secondary);
 await check('retained request retries through real z.ai and visibly commits',accepted.events.some(e=>e.type==='started'&&e.model==='zai/glm-5.3-flash')&&accepted.events.some(e=>e.type==='done'&&e.status==='completed'&&e.applied>=1)&&JSON.stringify(after).includes('Busy repair verified'),{events:accepted.events,document:after,status:await secondary.$eval('.agent-status',e=>e.textContent)});
 await check('accepted request clears composer after actual start',await secondary.$eval('[data-testid="conversation-input"]',e=>e.value)==='');await closeDocument(secondary);await secondary.screenshot({path:resolve(out,'live-retry-success.png'),fullPage:true});await record('primary end',{turns:await primary.evaluate(()=>window.__auditTurns),status:await primary.$eval('.agent-status',e=>e.textContent)});await check('production browser has no page errors',errors.length===0,{errors});
}catch(error){await record('driver failure',{error:String(error),primary:await primary.evaluate(()=>document.body.innerText),secondary:await secondary.evaluate(()=>document.body.innerText),turns:await secondary.evaluate(()=>window.__auditTurns)});await secondary.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1}finally{await browser.close()}
