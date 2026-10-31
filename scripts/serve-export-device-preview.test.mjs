import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {createServer, request} from 'node:http';

const helper=resolve(process.env.PREVIEW_HELPER_SOURCE??'scripts/serve-export-device-preview.mjs');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t,entries=[]){
  const base=await mkdtemp(join(tmpdir(),'vict-preview-policy-'));
  t.after(()=>{assert.ok(resolve(base).startsWith(resolve(tmpdir())+'\\vict-preview-policy-')||resolve(base).startsWith(resolve(tmpdir())+'/vict-preview-policy-'));return rm(base,{recursive:true,force:true});});
  const root=join(base,'dist');await mkdir(root);
  const inventory=[];
  for(const [path,bytes] of [['index.html',Buffer.from('<p>sealed</p>')],['application.json',Buffer.from('{"fixture":"synthetic"}')],...entries]){
    await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),bytes);
    inventory.push({path,sha256:hash(bytes)});
  }
  const report={schema:'vict.export-device-preview@1',status:'PASS: unchanged actual export, public-artifact identity, compilation/renderer validation and static production build',destination:base,outputFiles:inventory,sourceExport:{sha256:inventory[1].sha256}};
  return {base,root,report};
}
async function availablePort(){const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port===5626?availablePort():port;}
async function launch(t,f,mutate=()=>{},expectedError){
  mutate(f.report);const bytes=Buffer.from(JSON.stringify(f.report));const reportPath=join(f.base,'report.json');await writeFile(reportPath,bytes);
  const port=await availablePort();const child=spawn(process.execPath,[helper,f.root,reportPath,hash(bytes),'127.0.0.1',String(port)],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}});
  let stderr='';child.stderr.on('data',x=>stderr+=x);
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>expectedError?resolve():reject(Error(`helper exit ${code}: ${stderr}`)));});
  if(expectedError){assert.match(stderr,expectedError);return;}
  return {port};
}
async function get(server,path='/',options={}){
  return new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port:server.port,path,method:options.method??'GET',headers:{host:`127.0.0.1:${server.port}`,...options.headers}},res=>{let size=0;const digest=createHash('sha256');res.on('data',x=>{size+=x.length;digest.update(x);});res.on('end',()=>resolve({status:res.statusCode,size,hash:digest.digest('hex'),headers:res.headers}));});req.once('error',reject);req.end();});
}

test('more than 256 sealed files are all reachable',async t=>{
  const f=await fixture(t,Array.from({length:260},(_,i)=>[`file-${i}.json`,Buffer.from(String(i))]));const server=await launch(t,f);
  for(const entry of f.report.outputFiles){const result=await get(server,'/'+entry.path);assert.equal(result.status,200);assert.equal(result.hash,entry.sha256);}
});
test('single file above 64 MiB and total above 128 MiB retain exact bytes',async t=>{
  const bytes=Buffer.alloc(65*1024*1024,0x61);const f=await fixture(t,[['large-a.js',bytes],['large-b.js',bytes]]);const server=await launch(t,f);
  for(const path of ['/large-a.js','/large-b.js']){const result=await get(server,path);assert.equal(result.status,200);assert.equal(result.size,bytes.length);assert.equal(result.hash,hash(bytes));}
});
test('aggregate above 128 MiB with every individual file below 64 MiB',async t=>{
  const bytes=Buffer.alloc(45*1024*1024,0x62);const f=await fixture(t,[['part-a.js',bytes],['part-b.js',bytes],['part-c.js',bytes]]);const server=await launch(t,f);
  for(const path of ['/part-a.js','/part-b.js','/part-c.js']){const result=await get(server,path);assert.equal(result.status,200);assert.equal(result.hash,hash(bytes));}
});
test('sealed and request paths beyond prior ceilings use unchanged path grammar',async t=>{
  const path=Array.from({length:12},(_,i)=>`${i}-`+'a'.repeat(180)).join('/')+'/asset.json';assert.ok(path.length>2048);
  const f=await fixture(t,[[path,Buffer.from('long-path')]]);const server=await launch(t,f);const result=await get(server,'/'+path);assert.equal(result.status,200);assert.equal(result.hash,hash('long-path'));
});
test('Node default header handling replaces custom 32 header count',async t=>{
  const f=await fixture(t);const server=await launch(t,f);const headers=Object.fromEntries(Array.from({length:40},(_,i)=>[`x-test-${i}`,'value']));headers.host='wrong.example';assert.equal((await get(server,'/',{headers})).status,400);
  assert.equal((await get(server,'/',{headers:{...headers,host:`127.0.0.1:${server.port}`}})).status,200);
});
test('host, method, encoded traversal and unknown files remain refused; HEAD remains exact',async t=>{
  const f=await fixture(t);const server=await launch(t,f);
  assert.equal((await get(server,'/',{headers:{host:'localhost'}})).status,400);assert.equal((await get(server,'/',{method:'POST'})).status,405);
  for(const path of ['/../index.html','/%2e%2e/index.html','/a%2fb','//index.html','/index.html?x=1','/%zz'])assert.equal((await get(server,path)).status,400,path);
  assert.equal((await get(server,'/unknown.json')).status,404);const head=await get(server,'/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.size,0);assert.equal(Number(head.headers['content-length']),Buffer.byteLength('<p>sealed</p>'));
});
test('post-verification disk mutation is never served',async t=>{
  const f=await fixture(t);const server=await launch(t,f);await writeFile(join(f.root,'index.html'),'changed');assert.equal((await get(server)).hash,f.report.outputFiles[0].sha256);
});
test('hash, duplicate, unsafe paths and source-export identity remain admission failures',async t=>{
  for(const [mutate,error] of [[r=>r.outputFiles[0].sha256='0'.repeat(64),/SHA-256 mismatch/],[r=>r.outputFiles.push(r.outputFiles[0]),/Unsafe or duplicate/],[r=>r.outputFiles[0].path='../index.html',/Unsafe or duplicate/],[r=>r.outputFiles[0].path='index.exe',/Unsafe or duplicate/],[r=>r.outputFiles[0].path='absent.html',/ENOENT/],[r=>r.sourceExport.sha256='0'.repeat(64),/Missing index or unchanged/]]){const f=await fixture(t);await launch(t,f,mutate,error);}
});
test('realpath escape remains refused',async t=>{
  const f=await fixture(t);await writeFile(join(f.base,'outside.json'),'outside');await symlink(f.base,join(f.root,'escape'),'junction');f.report.outputFiles.push({path:'escape/outside.json',sha256:hash('outside')});await launch(t,f,()=>{},/escapes the static root/);
});
test('report identity, private IPv4 binding and dedicated non-Studio port remain required',async t=>{
  const f=await fixture(t);const bytes=Buffer.from(JSON.stringify(f.report));const path=join(f.base,'report.json');await writeFile(path,bytes);
  for(const [digest,host,port,error] of [[hash(bytes),'0.0.0.0','5632',/Only private LAN/],[hash(bytes),'8.8.8.8','5632',/Only private LAN/],[hash(bytes),'localhost','5632',/explicit private or loopback IPv4/],[hash(bytes),'127.0.0.1','5626',/Studio port is forbidden/],[hash(bytes),'127.0.0.1','80',/dedicated nonprivileged port/],['0'.repeat(64),'127.0.0.1','5632',/report SHA-256 mismatch/]]){
    const result=spawnSync(process.execPath,[helper,f.root,path,digest,host,port],{encoding:'utf8',windowsHide:true});assert.notEqual(result.status,0);assert.match(result.stderr,error);
  }
});
