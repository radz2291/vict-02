/** Independent read-only recomputation of the retained yklW2W public-consumer receipt. */
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const base=resolve('docs/studio/foundation-evidence/architecture-realignment-20261030');
const reportPath=join(base,'vict-realignment-consumer-yklW2W.json'),reportBytes=readFileSync(reportPath),receipt=JSON.parse(reportBytes);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(receipt.sourceCandidate,'ab3296e6503a63b2587ed36a1e1a121179082396');assert.ok(receipt.status.startsWith('PASS:'));
const comparisons=[];
const compare=(kind,path,expected)=>{const actual=hash(readFileSync(path));assert.equal(actual,expected,kind+': '+path);comparisons.push({kind,path,sha256:actual});};
for(const pack of receipt.packs){compare('packed-tar',pack.path,pack.sha256);const installed=realpathSync(join(receipt.consumer,'node_modules',pack.name));assert.ok(installed.startsWith(realpathSync(receipt.consumer)+'\\')||installed.startsWith(realpathSync(receipt.consumer)+'/'));for(const file of pack.files)if(file.path!=='package.json')compare('installed-artifact',join(installed,file.path),file.sha256);}
for(const file of receipt.fixtureFiles)compare('consumer-fixture',join(receipt.consumer,file.path),file.sha256);
for(const file of receipt.outputFiles)compare('production-output',join(receipt.consumer,'dist','assets',file.name),file.sha256);
compare('dom-log',receipt.domTest.log,receipt.domTest.sha256);
const flow=receipt.packs.find(pack=>pack.name==='@victframework/ui-flow-svelte');
const sourceChecks=[];
for(const file of ['src/composition/GraphWorkspace.svelte','src/editor/GraphSurface.svelte']){
  const tracked=execFileSync('git',['show',receipt.sourceCandidate+':packages/ui-flow-svelte/'+file]);
  const packed=execFileSync('tar',['-xOf',flow.path,'package/'+file]);
  const installed=readFileSync(join(receipt.consumer,'node_modules',flow.name,file));
  assert.deepStrictEqual(packed,tracked,'Packed Flow source must be exact repaired committed bytes');assert.deepStrictEqual(installed,tracked);
  assert.match(tracked.toString('utf8'),/emitted\s*=\s*'';/);
  sourceChecks.push({path:file,committedSource:receipt.sourceCandidate,sha256:hash(tracked),packedAndInstalledByteIdentical:true,containsEmittedMarkerReset:true});
}
const counts=Object.fromEntries(['packed-tar','installed-artifact','consumer-fixture','production-output','dom-log'].map(kind=>[kind,comparisons.filter(item=>item.kind===kind).length]));
assert.deepStrictEqual(counts,{'packed-tar':7,'installed-artifact':510,'consumer-fixture':8,'production-output':2,'dom-log':1});
const result={status:'PASS',scope:'Read-only independent receipt/hash/source-byte recomputation. No package build, DOM rerun, browser, provider or server activation.',receipt:{path:reportPath,sha256:hash(reportBytes),sourceCandidate:receipt.sourceCandidate},counts,sourceChecks,buildModes:receipt.packageBuilds.map(({name,mode,reason})=>({name,mode,...(reason?{reason}:{})})),comparisons};
const output=join(base,'history-redo-echo-yklW2W-independent-audit.json');writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,counts,sourceChecks,output}));
