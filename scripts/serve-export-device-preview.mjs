/** Serve only a hash-verified preparation inventory. No Studio/proxy/backend routes. */
import {readFileSync,realpathSync,statSync} from 'node:fs';
import {resolve,join,relative,isAbsolute,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {isIPv4} from 'node:net';
import {networkInterfaces} from 'node:os';

const [rootArg,reportArg,reportHash,host,portArg,...extra]=process.argv.slice(2);
if(!rootArg||!reportArg||!reportHash||!host||!portArg||extra.length)throw Error('Usage: node scripts/serve-export-device-preview.mjs <dist-root> <preparation-report.json> <report-sha256> <exact-private-or-loopback-ipv4> <dedicated-port>');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(!/^[a-f0-9]{64}$/.test(reportHash))throw Error('An exact SHA-256 preparation report identity is required.');
if(!isIPv4(host))throw Error('Bind an explicit private or loopback IPv4 address, never a wildcard or hostname.');
const octets=host.split('.').map(Number),loopback=octets[0]===127;
const privateAddress=octets[0]===10||(octets[0]===172&&octets[1]>=16&&octets[1]<=31)||(octets[0]===192&&octets[1]===168);
if(!loopback&&!privateAddress)throw Error('Only private LAN or loopback bindings are supported.');
if(!loopback&&!Object.values(networkInterfaces()).flat().some(entry=>entry?.family==='IPv4'&&entry.address===host&&!entry.internal))throw Error('The requested private address is not assigned to this computer.');
if(!/^\d{4,5}$/.test(portArg))throw Error('Use an explicit dedicated nonprivileged port.');
const port=Number(portArg);
if(port<1024||port>65535||port===5626)throw Error('Invalid dedicated port; the Studio port is forbidden.');
const reportBytes=readFileSync(resolve(reportArg));
if(hash(reportBytes)!==reportHash)throw Error('Preparation report SHA-256 mismatch.');
const report=JSON.parse(reportBytes.toString('utf8'));
if(report.schema!=='vict.export-device-preview@1'||report.status!=='PASS: unchanged actual export, public-artifact identity, compilation/renderer validation and static production build')throw Error('A successful export preparation report is required.');
if(resolve(rootArg)!==resolve(report.destination,'dist'))throw Error('Static root must exactly match the successful preparation destination/dist.');
const root=realpathSync(resolve(rootArg));
if(!statSync(root).isDirectory())throw Error('Static root is not a directory.');
const withinRoot=path=>{const rel=relative(root,path);return rel!==''&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..\\')&&!rel.startsWith('../');};
if(!Array.isArray(report.outputFiles)||!report.outputFiles.length||report.outputFiles.length>256)throw Error('Invalid sealed output inventory.');
const files=new Map();let totalBytes=0;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
for(const entry of report.outputFiles){
  if(!entry||typeof entry.path!=='string'||!entry.path||entry.path.length>512||entry.path.split('/').some(part=>!part||part==='.'||part==='..'||part.startsWith('.'))||/[\\:%?#\x00-\x1f\x7f]/.test(entry.path)||!Object.hasOwn(types,extname(entry.path))||!/^[a-f0-9]{64}$/.test(entry.sha256)||files.has('/'+entry.path))throw Error('Unsafe or duplicate sealed output inventory entry.');
  const path=realpathSync(join(root,entry.path));
  if(!withinRoot(path))throw Error('Sealed output escapes the static root.');
  const stat=statSync(path);
  if(!stat.isFile()||stat.size>64*1024*1024)throw Error('Invalid or oversized output file.');
  totalBytes+=stat.size;if(totalBytes>128*1024*1024)throw Error('Static output exceeds preview memory budget.');
  const bytes=readFileSync(path);
  if(hash(bytes)!==entry.sha256)throw Error('Sealed output SHA-256 mismatch.');
  files.set('/'+entry.path,{bytes,type:types[extname(entry.path)],sha256:entry.sha256});
}
if(!files.has('/index.html')||files.get('/application.json')?.sha256!==report.sourceExport?.sha256)throw Error('Missing index or unchanged exported application.');
// Immutable bytes are retained after verification: later disk changes are never served.
const server=createServer((request,response)=>{
  response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Cache-Control','no-store');
  const deny=(status,message)=>{response.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});response.end(request.method==='HEAD'?undefined:message);};
  if(request.method!=='GET'&&request.method!=='HEAD'){response.setHeader('Allow','GET, HEAD');return deny(405,'Method not allowed.');}
  if(request.headers.host!==`${host}:${port}`)return deny(400,'Invalid preview host.');
  const raw=request.url??'';
  if(!raw.startsWith('/')||raw.startsWith('//')||raw.length>2048||/[?#\\\x00-\x1f\x7f]/.test(raw)||/%(?:2f|5c)/i.test(raw))return deny(400,'Invalid preview path.');
  let path;try{path=decodeURIComponent(raw);}catch{return deny(400,'Invalid preview path.');}
  if(/[\\:%\x00-\x1f\x7f]/.test(path)||path.split('/').slice(1).some(part=>part==='.'||part==='..'||part.startsWith('.'))||path.includes('//'))return deny(400,'Invalid preview path.');
  const file=files.get(path==='/'?'/index.html':path);
  if(!file)return deny(404,'Preview file not found.');
  response.writeHead(200,{'Content-Type':file.type,'Content-Length':file.bytes.length});response.end(request.method==='HEAD'?undefined:file.bytes);
});
server.maxHeadersCount=32;server.headersTimeout=10000;server.requestTimeout=15000;server.keepAliveTimeout=2000;
server.on('clientError',(_error,socket)=>socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
server.on('error',error=>{console.error(`Static preview could not listen: ${error.code??'UNKNOWN'}`);process.exitCode=1;});
server.listen(port,host,()=>console.log(JSON.stringify({url:`http://${host}:${port}/`,reportSha256:reportHash,sealedFiles:files.size,scope:'Static actual-export preview only; no Studio or execution backend.'})));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close();server.closeAllConnections();});
