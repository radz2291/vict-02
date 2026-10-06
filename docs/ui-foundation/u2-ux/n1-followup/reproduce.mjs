import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e)));const wait=()=>new Promise(r=>setTimeout(r,200));
try {
await p.goto('http://127.0.0.1:5200/');await p.waitForSelector('.uv-inspector');
await p.evaluate(()=>window.__test.select('title'));await wait();await p.click('.uv-inspector .tabs button:nth-child(2)');await wait();
await p.evaluate(()=>document.querySelector('[aria-label="Text size value details"]').click());await wait();
const state=()=>p.evaluate(()=>({actual:[...document.querySelectorAll('[data-ui-occ]')].filter(e=>e.dataset.uiOcc==='review|title').map(e=>getComputedStyle(e).fontSize),annotation:document.querySelector('[aria-label="Text size"]').closest('.control').innerText,doc:window.__test.doc(),snapshot:window.__test.snapshot()}));
const before=await state();await p.evaluate(()=>{const e=document.querySelector('[aria-label="Text size"]');e.value='61';e.dispatchEvent(new Event('change',{bubbles:true}));});await wait();const after=await state();
fs.writeFileSync(new URL('./after-repair.json',import.meta.url),JSON.stringify({before,after,errors},null,2));console.log(JSON.stringify({before:before.actual,after:after.actual,annotation:after.annotation,errors}));
}finally{await browser.close();}

