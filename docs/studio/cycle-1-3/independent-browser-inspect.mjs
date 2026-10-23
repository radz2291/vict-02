import puppeteer from 'puppeteer-core';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,userDataDir:await mkdtemp(join(tmpdir(),'vict-independent-')),args:['--no-first-run']});
const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
await page.goto('http://127.0.0.1:5594/login');
await page.evaluate(async()=>{await fetch('/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({label:'operator',secret:'studio-local-pass'})})});
await page.goto('http://127.0.0.1:5594/design');await new Promise(r=>setTimeout(r,1200));
console.log(await page.evaluate(()=>({text:document.body.innerText,inputs:[...document.querySelectorAll('input,select,textarea,button')].map(e=>({tag:e.tagName,label:e.getAttribute('aria-label'),text:e.textContent?.slice(0,90),title:e.getAttribute('title')}))})));
await browser.close();

