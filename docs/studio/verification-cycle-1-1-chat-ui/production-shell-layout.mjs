// Actual production Designer shell; recorded-provider response replay ONLY for
// repeatable populated layout inspection. This makes no additional live-agent claim.
import puppeteer from 'puppeteer-core';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url));
const record=JSON.parse(await readFile(resolve(out,'production-browser.json'),'utf8'));
const observed=record.records.find(r=>r.name==='real provider completed with visible canonical edit').data.turn.events;
const events=observed.filter(e=>!['proposal'].includes(e.type));
const done=events.pop();for(let i=0;i<8;i++)events.push({type:'progress',message:`Recorded layout activity ${i+1}: read and validate the screen safely.`});events.push(done);
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});const page=await browser.newPage(),results=[];
await page.setRequestInterception(true);page.on('request',r=>{if(r.url()==='http://127.0.0.1:5592/api/designer-agent'&&r.method()==='POST')return r.respond({status:200,contentType:'application/x-ndjson',body:events.map(e=>JSON.stringify(e)).join('\n')+'\n'});return r.continue()});
try{
await page.goto('http://127.0.0.1:5592/login');await page.evaluate(async()=>fetch('/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({label:'operator',secret:'studio-local-pass'}),redirect:'manual'}));await page.goto('http://127.0.0.1:5592/design');await page.waitForFunction(()=>document.querySelector('.agent-status')?.textContent.includes('Ready'));await page.type('textarea[name="message"]','Replay the already verified response for layout inspection only.');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.agent-status')?.textContent.includes('1 edit applied'));
for(const [width,height] of [[1280,500],[390,700]]){
await page.setViewport({width,height});await page.click('[aria-label="Chat details"]');await page.waitForSelector('.studio-chat-details');
const rects=await page.evaluate(()=>{const box=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r?{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};return {panel:box('.agent-chat'),details:box('.studio-chat-details'),composer:box('.vict-conversation-input'),input:box('textarea[name="message"]'),feed:box('.vict-conversation'),canvas:box('.canvas-stage'),status:box('.agent-status'),header:box('.workspace-header'),footer:box('.workspace-status'),activity:document.querySelectorAll('.studio-chat-details li').length}});
const pass=rects.details.x>=rects.panel.x-1&&rects.details.right<=rects.panel.right+1&&rects.details.bottom<=rects.composer.y+1&&rects.feed.bottom<=rects.composer.y+1&&rects.composer.bottom<=rects.status.y+1;
results.push({viewport:{width,height},pass,rects});await page.screenshot({path:resolve(out,`production-shell-replay-${width}x${height}.png`)});if(!pass)process.exitCode=1;await page.keyboard.press('Escape');await page.waitForSelector('.studio-chat-details',{hidden:true});
}
}catch(e){results.push({failure:String(e)});process.exitCode=1}finally{await writeFile(resolve(out,'production-shell-layout.json'),JSON.stringify({mode:'Actual production shell, recorded provider text plus labeled activity replay; no live provider request or new edit',results},null,2));console.log(JSON.stringify(results));await browser.close()}
