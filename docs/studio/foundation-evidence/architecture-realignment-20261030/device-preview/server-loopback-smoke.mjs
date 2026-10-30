/** Security smoke against our own temporary loopback child only. No LAN listener. */
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {request} from 'node:http';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,cpSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const root=process.cwd(),helper=resolve('scripts/serve-export-device-preview.mjs');
const reportPath=resolve(process.argv[2]??'C:/Users/RZ1/AppData/Local/Temp/vict-export-device-preview-stage1-final-20261030/preview-report.json');
const bytes=readFileSync(reportPath),report=JSON.parse(bytes),dist=join(report.destination,'dist');
const hash=value=>createHash('sha256').update(value).digest('hex');
const port=await new Promise((done,reject)=>{const probe=createServer();probe.on('error',reject);probe.listen(0,'127.0.0.1',()=>{const number=probe.address().port;probe.close(()=>done(number));});});
const checks=[],children=[];
function child(args){const process=spawn(globalThis.process.execPath,[helper,...args],{cwd:root,stdio:['ignore','pipe','pipe']});children.push(process);let output='';process.stdout.on('data',chunk=>output+=chunk);process.stderr.on('data',chunk=>output+=chunk);const exit=new Promise(done=>process.once('exit',code=>done({code,output})));return {process,exit,get output(){return output;}};}
async function refused(args,label){const instance=child(args);const outcome=await Promise.race([instance.exit,new Promise((_,reject)=>setTimeout(()=>reject(Error('Refusal timeout: '+label)),10000).unref())]);assert.notEqual(outcome.code,0,label);checks.push(label);}
const args=[dist,reportPath,hash(bytes),'127.0.0.1',String(port)];
const active=child(args);
try{
  await new Promise((done,reject)=>{const timeout=setTimeout(()=>reject(Error('Loopback startup timed out: '+active.output)),10000);active.process.stdout.once('data',()=>{clearTimeout(timeout);done();});active.process.once('exit',()=>{clearTimeout(timeout);reject(Error(active.output));});});
  const get=(path,method='GET',host=`127.0.0.1:${port}`)=>new Promise((done,reject)=>{const call=request({hostname:'127.0.0.1',port,path,method,headers:{Host:host}},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>done({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks)}));});call.on('error',reject);call.end();});
  const home=await get('/');assert.equal(home.status,200);assert.equal(hash(home.body),report.outputFiles.find(file=>file.path==='index.html').sha256);assert.match(home.headers['content-type'],/^text\/html/);assert.equal(home.headers['x-content-type-options'],'nosniff');assert.equal(home.headers['cache-control'],'no-store');checks.push('Actual prepared index bytes and response headers');
  const application=await get('/application.json');assert.equal(application.status,200);assert.equal(hash(application.body),report.sourceExport.sha256);assert.match(application.headers['content-type'],/^application\/json/);checks.push('Actual unchanged application export bytes');
  for(const file of report.outputFiles.filter(file=>file.path.startsWith('assets/'))){const asset=await get('/'+file.path);assert.equal(asset.status,200);assert.equal(hash(asset.body),file.sha256);assert.match(asset.headers['content-type'],file.path.endsWith('.js')?/^text\/javascript/:/^text\/css/);}checks.push('Actual sealed JavaScript and CSS bytes/content types');
  const head=await get('/application.json','HEAD');assert.equal(head.status,200);assert.equal(head.body.length,0);assert.equal(Number(head.headers['content-length']),application.body.length);checks.push('HEAD returns correct length and no body');
  for(const method of ['POST','PUT','DELETE','OPTIONS'])assert.equal((await get('/',method)).status,405);checks.push('Write and unsupported methods refused');
  for(const path of ['/assets/','/preview-report.json','/src/main.ts','/api/agent','/not-listed.txt'])assert.equal((await get(path)).status,404);checks.push('No directory listing, report/source, admin/backend or unlisted file serving');
  for(const path of ['/../preview-report.json','/%2e%2e/preview-report.json','/%252e%252e/preview-report.json','/%2fetc','/%5csecret','/%00','/%GG','//other-host/','/application.json?query=1','/'+('x'.repeat(2050))])assert.equal((await get(path)).status,400,path);checks.push('Raw/encoded traversal, separators, malformed decoding, NUL, query and oversized paths refused');
  assert.equal((await get('/','GET','other-host.invalid')).status,400);checks.push('Unexpected Host refused');
}finally{active.process.kill('SIGTERM');await active.exit;}
await refused([dist,reportPath,'0'.repeat(64),'127.0.0.1',String(port)],'Wrong preparation-report hash refused before bind');
await refused([dist,reportPath,hash(bytes),'0.0.0.0',String(port)],'Wildcard binding refused before bind');
await refused([dist,reportPath,hash(bytes),'8.8.8.8',String(port)],'Public address binding refused before bind');
await refused([dist,reportPath,hash(bytes),'127.0.0.1','5626'],'Studio port refused before bind');
const fixture=mkdtempSync(join(tmpdir(),'vict-preview-server-smoke-'));cpSync(dist,join(fixture,'dist'),{recursive:true});
const altered={...report,destination:fixture};const alteredReport=join(fixture,'preview-report.json');writeFileSync(alteredReport,JSON.stringify(altered));
writeFileSync(join(fixture,'dist','application.json'),'tampered');
await refused([join(fixture,'dist'),alteredReport,hash(readFileSync(alteredReport)),'127.0.0.1',String(port)],'Changed output bytes refused before bind');
cpSync(join(dist,'application.json'),join(fixture,'dist','application.json'));
mkdirSync(join(fixture,'outside'));writeFileSync(join(fixture,'outside','escape.json'),'outside');symlinkSync(join(fixture,'outside'),join(fixture,'dist','escape-link'),'junction');
altered.outputFiles=[...report.outputFiles,{path:'escape-link/escape.json',sha256:hash('outside')}];writeFileSync(alteredReport,JSON.stringify(altered));
await refused([join(fixture,'dist'),alteredReport,hash(readFileSync(alteredReport)),'127.0.0.1',String(port)],'Junction/symlink escape refused before bind');
assert.equal(hash(readFileSync(join(dist,'application.json'))),report.sourceExport.sha256);checks.push('Actual prepared output unchanged after smoke');
const result={status:'PASS',scope:'Only this test child listened temporarily on loopback. No LAN, Studio, firewall, browser or provider changes.',reportPath,preparationReportSha256:hash(bytes),checks,retainedFixture:fixture};
writeFileSync(resolve('docs/studio/foundation-evidence/architecture-realignment-20261030/device-preview/server-loopback-smoke.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
