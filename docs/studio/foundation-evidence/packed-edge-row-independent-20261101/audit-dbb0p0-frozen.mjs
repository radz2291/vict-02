import assert from 'node:assert/strict';
import{readFileSync,writeFileSync}from'node:fs';
import{join}from'node:path';
import{execFileSync}from'node:child_process';
import{createHash}from'node:crypto';
const base='docs/studio/foundation-evidence/packed-edge-row-independent-20261101',report=JSON.parse(readFileSync(base+'/vict-independent-edge-row-dbb0p0.json'));
assert.equal(report.productCandidate,'afa8dd9d9f550392811ce286ecc025b9933d99a7');assert.ok(report.status.startsWith('PASS:'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const packs=report.packs.map(pack=>{const tree=execFileSync('git',['rev-parse',report.productCandidate+':packages/'+pack.name.split('/')[1]],{encoding:'utf8'}).trim();assert.equal(tree,pack.sourceTree);assert.equal(hash(readFileSync(pack.path)),pack.sha256);return{name:pack.name,sourceTree:tree,tarSha256:pack.sha256,installedFiles:report.installed.find(item=>item.name===pack.name).filesMatched};});
const pack=report.packs.find(item=>item.name==='@victframework/ui-flow-svelte'),installed=report.installed.find(item=>item.name===pack.name).path;
const flowSource=pack.files.filter(file=>file.path.startsWith('src/')).map(file=>{const blob=execFileSync('git',['show',report.productCandidate+':packages/ui-flow-svelte/'+file.path]),actual=readFileSync(join(installed,file.path));assert.equal(hash(blob),hash(actual),'Frozen Flow source mismatch: '+file.path);return{path:file.path,sha256:hash(actual)};});
assert.ok(flowSource.some(file=>file.path==='src/handle-projection.ts'),'New private projection source absent');
for(const file of report.fixtureFiles){const blob=execFileSync('git',['show',report.productCandidate+':'+base+'/fixtures/'+file.path.slice(4)]);assert.equal(hash(blob),file.sha256,'Independent fixture was modified');}
const result={status:'PASS',candidate:report.productCandidate,installedReportSha256:hash(readFileSync(base+'/vict-independent-edge-row-dbb0p0.json')),packs,installedFiles:packs.reduce((sum,pack)=>sum+pack.installedFiles,0),flowSourceFiles:flowSource.length,flowSource,unchangedFixtureFiles:report.fixtureFiles.length,scope:'Frozen Git package trees, exact tar hashes, all installed Flow source bytes and unchanged diagnostic fixture hashes; no native endpoint/halo verdict.'};
writeFileSync(base+'/vict-independent-edge-row-dbb0p0-frozen-association.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,packs:packs.length,installedFiles:result.installedFiles,flowSourceFiles:flowSource.length,unchangedFixtures:report.fixtureFiles.length}));
