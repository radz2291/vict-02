import fs from 'node:fs';
const puppeteer=(await import('file:///C:/Users/RZ1/Desktop/RZ/vict-02-u2-inspector-ux/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).default;
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox']});
const page=await browser.newPage();await page.setViewport({width:1440,height:900});
const results=[];const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:5199/');
await page.waitForSelector('.uv-inspector');
async function click(text){await page.evaluate(text=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===text).click(),text);await new Promise(r=>setTimeout(r,100));}
async function choose(label,value){await page.evaluate((label,value)=>{const e=document.querySelector(`[aria-label="${label}"]`);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));},label,value);await new Promise(r=>setTimeout(r,100));}
await click('Behavior');await choose('Declared action','review.other');await click('Connect action');results.push({action:await page.evaluate(()=>({node:window.__review.getDocument().nodes.request,last:window.__last}))});
await page.evaluate(()=>window.__review.select('title'));await new Promise(r=>setTimeout(r,100));await choose('Route id','route.b');await click('Connect navigation');results.push({navigation:await page.evaluate(()=>({node:window.__review.getDocument().nodes.title,last:window.__last}))});
await page.screenshot({path:new URL('./behavior.png',import.meta.url).pathname.replace(/^\/C:/,'C:'),fullPage:true});
await page.setViewport({width:390,height:844});await click('Style');await page.screenshot({path:new URL('./long-label-inspector-390.png',import.meta.url).pathname.replace(/^\/C:/,'C:'),fullPage:true});
results.push({longLabel:await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.querySelector('.uv-inspector h2').textContent,clipped:[...document.querySelectorAll('input,select,button')].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().right>innerWidth).map(e=>e.getAttribute('aria-label'))}))});
fs.writeFileSync(new URL('./adversarial.json',import.meta.url),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));await browser.close();
