/** Disposable responsive iframe harness; does not proxy requests or read cookies. */
import { createServer } from 'node:http';
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VICT responsive review harness</title>
<style>body{font:14px system-ui;margin:16px;background:#e8edf5;color:#172033}nav{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}button{font:inherit;padding:8px}iframe{display:block;width:390px;height:900px;border:2px solid #566580;background:white;max-width:none}p{max-width:1000px}</style>
<h1>Actual iframe viewport review</h1><p>This is a disposable local verification harness. The embedded application runs normally at the selected CSS viewport width. This tests responsive rendering; it does not emulate a mobile device or native browser chrome. Authentication stays with the original Studio origin.</p>
<nav aria-label="Frame width"><button onclick="resize(390)">390 CSS px</button><button onclick="resize(768)">768 CSS px</button><button onclick="resize(1200)">1200 CSS px</button></nav>
<nav aria-label="Review page"><button onclick="page('http://127.0.0.3:5596/design')">Studio Designer</button><button onclick="page('http://127.0.0.3:5596/showcase#completion')">Studio Showcase</button><button onclick="page('http://127.0.0.4:5597/')">Installed consumer</button></nav>
<p id="status" role="status">390 CSS px · Studio Designer</p><iframe id="review" title="Application at selected CSS viewport" width="390" height="900" src="http://127.0.0.3:5596/design"></iframe>
<script>const frame=document.getElementById('review');function resize(width){frame.style.width=width+'px';frame.width=width;report()}function page(url){frame.src=url;report()}function report(){document.getElementById('status').textContent=frame.width+' CSS px · '+frame.src}</script></html>`;
const server=createServer((_request,response)=>{response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});response.end(html);});
server.listen(5598,'127.0.0.3',()=>console.log('Responsive iframe review: http://127.0.0.3:5598/'));
