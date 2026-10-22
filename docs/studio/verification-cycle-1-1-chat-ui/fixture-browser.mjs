import puppeteer from 'puppeteer-core';
import {writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url));
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const page=await browser.newPage(),records=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
async function geometry(){return page.evaluate(()=>{const box=s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};const feed=document.querySelector('.vict-conversation');return {panel:box('.agent-chat'),feed:box('.vict-conversation'),composer:box('.vict-conversation-input'),input:box('textarea'),status:box('.agent-status'),details:box('.studio-chat-details'),canvas:box('.fixture-canvas'),scroll:{top:feed.scrollTop,height:feed.scrollHeight,client:feed.clientHeight},activity:document.querySelectorAll('.studio-chat-details li').length}})}
function require(ok,name){if(!ok)throw Error(name)}
try{
for(const [width,height] of [[1280,720],[1280,500],[390,700]]){
 await page.setViewport({width,height});await page.goto('http://127.0.0.1:5594/');await page.waitForSelector('textarea',{timeout:30000});
 await page.type('textarea','Create a registration screen.');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.agent-status')?.textContent.includes('3 edits applied'));
 let g=await geometry();require(g.feed.bottom<=g.composer.y+1&&g.composer.bottom<=g.status.y+1,'feed composer status overlap');require(g.feed.height>40,'transcript too small');require(Math.abs(g.scroll.height-g.scroll.client-g.scroll.top)<3,'stream does not follow');
 require(await page.$$eval('.chat-markdown strong',els=>els.length)>0,'missing formatted text');
 await page.screenshot({path:resolve(out,`fixture-${width}x${height}.png`)});
 await page.click('[aria-label="Chat details"]');await page.waitForSelector('.studio-chat-details');g=await geometry();require(g.activity===8,'activity bound');require(g.details.x>=g.panel.x-1&&g.details.right<=g.panel.right+1&&g.details.bottom<=g.composer.y+1,'details containment');records.push({viewport:{width,height},geometry:g});
 await page.screenshot({path:resolve(out,`fixture-${width}x${height}-details.png`)});await page.keyboard.press('Escape');require(await page.$('.studio-chat-details')===null,'Escape dismissal');
 await page.click('[aria-label="Chat details"]');await page.click('.fixture-canvas');await page.waitForSelector('.studio-chat-details',{hidden:true});require(await page.$('.studio-chat-details')===null,'outside dismissal');
 // Reader scroll is preserved during a subsequent fixture stream.
 await page.$eval('.vict-conversation',e=>{e.scrollTop=0;e.dispatchEvent(new Event('scroll'))});
 await page.type('textarea','First');await page.keyboard.down('Shift');await page.keyboard.press('Enter');await page.keyboard.up('Shift');await page.type('textarea','Second');require(await page.$eval('textarea',e=>e.value)==='First\nSecond','ShiftEnter newline');
 await page.$eval('textarea',e=>e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true})));require(await page.$eval('textarea',e=>e.value)==='First\nSecond','IME submitted');
}
await page.goto('http://127.0.0.1:5594/?scenario=failure');await page.waitForSelector('textarea');await page.type('textarea','Show failure');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.agent-status')?.textContent.includes('provider could not'));records.push({scenario:'failure',geometry:await geometry(),status:await page.$eval('.agent-status',e=>e.textContent)});await page.screenshot({path:resolve(out,'fixture-narrow-failure.png')});
await page.goto('http://127.0.0.1:5594/?scenario=offline');await page.waitForSelector('textarea');await page.type('textarea','Keep this unsent request');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.vict-send-error')?.textContent.includes('request is still here'));require(await page.$eval('textarea',e=>e.value)==='Keep this unsent request','refusal lost draft');records.push({scenario:'offline',geometry:await geometry(),draftRetained:true});
}catch(e){records.push({failure:String(e),body:await page.$eval('body',e=>e.innerText)});await page.screenshot({path:resolve(out,'fixture-failure.png')});process.exitCode=1}finally{await writeFile(resolve(out,'fixture-browser.json'),JSON.stringify({records,errors},null,2));console.log(JSON.stringify({records,errors}));await browser.close()}
