/** Independent new-leaf fixture using only installed, hashed public tarballs. */
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,readdirSync,copyFileSync,realpathSync,lstatSync} from 'node:fs';
import {join,resolve,dirname,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=process.cwd(),input=resolve(process.argv[2]??'');
if(!process.argv[2])throw Error('Usage: node scripts/verify-packed-edge-row-independent.mjs <PASS public-consumer-report.json>');
const producerBytes=readFileSync(input),producer=JSON.parse(producerBytes);
assert.ok(producer.status?.startsWith('PASS:')&&producer.domTest?.passed,'Producer must complete before independent installed checks');
assert.equal(producer.packs.length,7);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const destination=mkdtempSync(join(tmpdir(),'vict-independent-edge-row-')),consumer=join(destination,'consumer'),artifacts=join(destination,'artifacts');
mkdirSync(consumer);mkdirSync(artifacts);mkdirSync(join(consumer,'src'));
const evidence=join(root,'docs/studio/foundation-evidence/packed-edge-row-independent-20261101');mkdirSync(evidence,{recursive:true});
const reportPath=join(evidence,`${destination.split(/[/\\]/).at(-1)}.json`);
const report={schema:'vict.independent-packed-edge-row@1',status:'started',productCandidate:producer.sourceCandidate,verifierCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),producer:{path:input,sha256:hash(producerBytes)},destination,consumer,packs:[],scope:'Installed public-artifact coding fixtures; no actual-agent, native browser/device, constructor/coordinate-frame, activation or overall runtime verdict.'};
const save=()=>writeFileSync(reportPath,JSON.stringify(report,null,2));save();
const npm=process.platform==='win32'?'npm.cmd':'npm';
function run(args,log){try{const output=execFileSync(npm,args,{cwd:consumer,encoding:'utf8',shell:process.platform==='win32',maxBuffer:32*1024*1024});writeFileSync(join(destination,log),output);return output;}catch(error){writeFileSync(join(destination,log),String(error.stdout??'')+String(error.stderr??''));throw error;}}
function put(path,value){const target=join(consumer,path);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,value);}
try{
 const dependencies={};
 for(const pack of producer.packs){
  const bytes=readFileSync(pack.path);assert.equal(hash(bytes),pack.sha256,'Producer tarball drift');
  const path=join(artifacts,pack.path.split(/[/\\]/).at(-1));copyFileSync(pack.path,path);
  dependencies[pack.name]=`file:${path.replaceAll('\\','/')}`;
  report.packs.push({...pack,path,sourceTree:producer.packageBuilds.find(build=>build.name===pack.name)?.sourceTree});
 }
 const seed=JSON.parse(readFileSync(join(producer.consumer,'package.json'),'utf8'));
 dependencies.svelte=seed.dependencies.svelte;
 put('package.json',JSON.stringify({name:'vict-independent-packed-edge-row',private:true,type:'module',scripts:{test:'vitest run',build:'vite build'},dependencies,devDependencies:seed.devDependencies},null,2));
 put('vite.config.mjs',"import{defineConfig}from'vitest/config';import{svelte}from'@sveltejs/vite-plugin-svelte';export default defineConfig({base:'./',plugins:[svelte()],resolve:{conditions:['browser']},test:{environment:'happy-dom',include:['src/**/*.test.ts']}});");
 put('index.html','<!doctype html><html><head><meta charset="utf-8"><title>Independent packed graph leaves</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>');
 put('src/main.ts',"import{mount}from'svelte';import App from'./App.svelte';mount(App,{target:document.querySelector('#app')!});");
 const fixtures=join(evidence,'fixtures'),fixtureFiles=[];
 function copy(directory){for(const item of readdirSync(directory,{withFileTypes:true})){const path=join(directory,item.name);if(item.isDirectory())copy(path);else{const text=readFileSync(path,'utf8');assert.ok(!text.includes('apps/studio')&&!text.includes('packages/')&&!text.includes('resolve.alias'),'Fixture must use only public installed APIs');const target='src/'+relative(fixtures,path).replaceAll('\\','/');put(target,text);fixtureFiles.push({path:target,sha256:hash(text)});}}}
 copy(fixtures);report.fixtureFiles=fixtureFiles;
 writeFileSync(join(evidence,'producer-qSyhak-or-successor.json'),producerBytes);
 run(['install','--ignore-scripts','--no-audit','--no-fund','--prefer-offline'],'install.log');
 const require=createRequire(join(consumer,'package.json'));
 report.installed=report.packs.map(pack=>{
  const path=realpathSync(join(consumer,'node_modules',pack.name));assert.ok(path.startsWith(consumer+'\\')||path.startsWith(consumer+'/'));assert.equal(lstatSync(path).isSymbolicLink(),false);
  for(const file of pack.files)if(file.path!=='package.json')assert.equal(hash(readFileSync(join(path,file.path))),file.sha256,`Installed bytes drift ${pack.name}/${file.path}`);
  const installed=JSON.parse(readFileSync(join(path,'package.json'),'utf8'));
  const packed=JSON.parse(execFileSync('tar',['-xOf',pack.path,'package/package.json'],{encoding:'utf8'}));
  for(const field of ['name','version','type','exports'])assert.deepEqual(installed[field],packed[field],`Manifest ${field}`);
  const entry=realpathSync(require.resolve(pack.name));assert.ok(entry.startsWith(path+'\\')||entry.startsWith(path+'/'));
  return {name:pack.name,path,entry,entrySha256:hash(readFileSync(entry)),filesMatched:pack.files.filter(file=>file.path!=='package.json').length,manifest:'npm-normalized package.json bytes excluded; name/version/type/exports equal packed manifest'};
 });save();
 run(['test'],'dom-tests.log');report.dom={passed:true,log:join(destination,'dom-tests.log'),sha256:hash(readFileSync(join(destination,'dom-tests.log')))};save();
 run(['run','build'],'production-build.log');report.production={passed:true,log:join(destination,'production-build.log'),files:readdirSync(join(consumer,'dist/assets')).map(name=>({name,sha256:hash(readFileSync(join(consumer,'dist/assets',name)))}))};
 report.status='PASS: independent installed graph3/settings/row discovery and semantics; production fixture build';
}catch(error){report.status='FAIL';report.failure=String(error.stack??error);writeFileSync(join(destination,'failure.log'),report.failure);throw error;}
finally{save();for(const file of ['install.log','dom-tests.log','production-build.log','failure.log'])try{copyFileSync(join(destination,file),join(evidence,`${destination.split(/[/\\]/).at(-1)}-${file}`));}catch(error){if(error.code!=='ENOENT')throw error;}console.log(JSON.stringify({status:report.status,reportPath,destination}));}
