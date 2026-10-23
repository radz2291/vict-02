import puppeteer from 'puppeteer-core';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
const out='docs/studio/cycle-1-3/independent-context-repair.json';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,userDataDir:await mkdtemp(join(tmpdir(),'vict-independent-'))});
const page=await browser.newPage();await page.setViewport({width:1440,height:1000});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const click=async text=>{for(const e of await page.$$('button'))if(await e.evaluate((e,t)=>e.textContent?.trim()===t||e.getAttribute('aria-label')===t,text)){await e.click();return;}throw Error('missing '+text)};
try{await page.goto('http://127.0.0.2:5594/login');await page.evaluate(async()=>fetch('/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({label:'operator',secret:'studio-local-pass'})}));await page.goto('http://127.0.0.2:5594/design');await new Promise(r=>setTimeout(r,800));
await click('Document');await click('Source');
const original=await page.$eval('#canonical-source',e=>JSON.parse(e.value));
const valid={...original,nodes:{screen:{...original.nodes.screen,children:['select']},select:{id:'select',kind:'component',definitionId:'vict.catalog.select-multiple',props:{label:{type:'literal',value:'Options'}},slots:{items:{name:'items',children:['item','other']}}},item:{id:'item',kind:'component',definitionId:'vict.catalog.select-item',props:{value:{type:'literal',value:'one'},label:{type:'literal',value:'One'}}},other:{id:'other',kind:'component',definitionId:'vict.catalog.select-item',props:{value:{type:'literal',value:'two'},label:{type:'literal',value:'Two'}}}}};
await page.$eval('#canonical-source',(e,d)=>{e.value=JSON.stringify(d);e.dispatchEvent(new Event('input',{bubbles:true}))},valid);await click('Apply source');await new Promise(r=>setTimeout(r,400));
const before={errors:[...errors],text:await page.evaluate(()=>document.body.innerText)};
const invalid={...valid,nodes:{...valid.nodes,screen:{...valid.nodes.screen,children:['select','item']},select:{...valid.nodes.select,slots:{items:{name:'items',children:['other']}}}}};
await page.$eval('#canonical-source',(e,d)=>{e.value=JSON.stringify(d);e.dispatchEvent(new Event('input',{bubbles:true}))},invalid);await click('Apply source');await new Promise(r=>setTimeout(r,700));
const after={errors:[...errors],text:await page.evaluate(()=>document.body.innerText)};await click('Discard draft');const canonical=await page.$eval('#canonical-source',e=>JSON.parse(e.value));const passed=errors.length===0&&after.text.includes('requires its declared component context')&&JSON.stringify(canonical)===JSON.stringify(valid);if(!passed)process.exitCode=1;const result={passed,canonicalPreserved:JSON.stringify(canonical)===JSON.stringify(valid),...{candidate:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),mode:'Canonical-source injection of exact accepted move result; not UI drag reproduction',before,after}};await writeFile(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await page.screenshot({path:'docs/studio/cycle-1-3/independent-context-repair.png'});
}finally{await browser.close()}


