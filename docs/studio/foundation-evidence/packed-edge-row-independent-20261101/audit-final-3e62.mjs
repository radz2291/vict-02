import assert from'node:assert/strict';
import{readFileSync,writeFileSync,realpathSync,lstatSync}from'node:fs';
import{join,resolve}from'node:path';
import{execFileSync}from'node:child_process';
import{createHash}from'node:crypto';
const here='docs/studio/foundation-evidence/packed-edge-row-independent-20261101',candidate='3e62f75d8337db767c8de6e7d214d520abcdce41';
const read=p=>JSON.parse(readFileSync(p)),hash=b=>createHash('sha256').update(b).digest('hex'),filehash=p=>hash(readFileSync(p));
const leafPath=process.argv[2],previewPath=process.argv[3];assert.ok(leafPath&&previewPath,'Pass independent installed leaf report and final r17 preview report');
const leaf=read(leafPath),producer=read(leaf.producer.copy),preview=read(previewPath);
for(const report of[leaf,producer,preview])assert.ok(report.status.startsWith('PASS:'));
assert.equal(leaf.productCandidate,candidate);assert.equal(producer.sourceCandidate,candidate);assert.equal(preview.artifactInventory.sourceCandidate,candidate);assert.equal(leaf.packs.length,7);
assert.equal(filehash(leaf.producer.copy),leaf.producer.sha256);assert.equal(filehash(preview.artifactInventory.path),leaf.producer.sha256);assert.equal(preview.artifactInventory.sha256,leaf.producer.sha256);
const packs=leaf.packs.map(pack=>{
 const name=pack.name.split('/')[1],tree=execFileSync('git',['rev-parse',candidate+':packages/'+name],{encoding:'utf8'}).trim();
 assert.equal(tree,pack.sourceTree);const build=producer.packageBuilds.find(b=>b.name===pack.name);assert.equal(tree,build.sourceTree);assert.equal(filehash(pack.path),pack.sha256);
 const installed=leaf.installed.find(i=>i.name===pack.name),root=realpathSync(installed.path);assert.equal(lstatSync(installed.path).isSymbolicLink(),false);assert.ok(root.startsWith(realpathSync(leaf.consumer)+'\\')||root.startsWith(realpathSync(leaf.consumer)+'/'));
 const previewInstalled=join(preview.destination,'node_modules',pack.name),previewRoot=realpathSync(previewInstalled);assert.equal(lstatSync(previewInstalled).isSymbolicLink(),false);assert.ok(previewRoot.startsWith(realpathSync(preview.destination)+'\\')||previewRoot.startsWith(realpathSync(preview.destination)+'/'));
 let sourceFiles=0,files=0;for(const file of pack.files){if(file.path==='package.json')continue;const actual=readFileSync(join(root,file.path));assert.equal(hash(actual),file.sha256);assert.equal(filehash(join(previewRoot,file.path)),file.sha256,'Final actual-export preview installed bytes drift');files++;if(file.path.startsWith('src/')){const expected=execFileSync('git',['show',candidate+':packages/'+name+'/'+file.path]);assert.equal(hash(actual),hash(expected));sourceFiles++;}}
 assert.equal(files,installed.filesMatched);const previewPack=preview.packs.find(p=>p.name===pack.name);assert.equal(filehash(previewPack.path),pack.sha256);
 return{name:pack.name,sourceTree:tree,tarSha256:pack.sha256,installedFiles:files,gitSourceFiles:sourceFiles,buildMode:build.mode};
});
assert.equal(filehash(leaf.dom.log),leaf.dom.sha256);assert.equal(leaf.dom.passed,true);assert.equal(leaf.production.passed,true);
for(const f of leaf.production.files)assert.equal(filehash(join(leaf.consumer,'dist/assets',f.name)),f.sha256);
for(const f of leaf.fixtureFiles){const old=execFileSync('git',['show','45f34e1e3dff821a8387cb8cb477a0f728fa00d5:'+here+'/fixtures/'+f.path.slice(4)]);assert.equal(hash(old),f.sha256,'Independent fixture changed');}
const finalSource='docs/studio/foundation-evidence/node-suite-stress-20261031/actual-app-independent/final-r17',exportPath=finalSource+'/supported-export.json',source=read(finalSource+'/saved-source.json');
assert.equal(preview.sourceExport.sha256,filehash(exportPath));assert.equal(filehash(preview.sourceExport.path),filehash(exportPath));assert.deepEqual(read(exportPath).uiDocuments[0].document,source);assert.equal(source.revision,'r1.r17');
for(const f of preview.outputFiles)assert.equal(filehash(join(preview.destination,'dist',f.path)),f.sha256);
assert.equal(preview.outputFiles.find(f=>f.path==='application.json').sha256,filehash(exportPath));assert.equal(JSON.parse(preview.validation).status,'PASS');
const previewInputs=['package.json','vite.config.mjs','src/main.ts','src/App.svelte','production-build.log','validation-build.log','validation.log'];
for(const p of['vite.config.mjs','src/main.ts','src/App.svelte'])assert.ok(!/resolve\.alias|apps\/studio|packages\//.test(readFileSync(join(preview.destination,p),'utf8')),'Preview source alias or workspace import');
const previewInputHashes=previewInputs.map(path=>({path,sha256:filehash(join(preview.destination,path))}));
for(const p of['production-build.log','validation-build.log','validation.log'])writeFileSync(here+'/final-3e62-preview-'+p,readFileSync(join(preview.destination,p)));
writeFileSync(here+'/final-3e62-preview-report.json',readFileSync(previewPath));
const result={status:'PASS',candidate,leafReport:leafPath,leafReportSha256:filehash(leafPath),producerReportSha256:leaf.producer.sha256,packs,installedFiles:packs.reduce((s,p)=>s+p.installedFiles,0),previewInstalledFiles:packs.reduce((s,p)=>s+p.installedFiles,0),gitSourceFiles:packs.reduce((s,p)=>s+p.gitSourceFiles,0),unchangedFixtureFiles:leaf.fixtureFiles.length,finalSavedSourceSha256:filehash(finalSource+'/saved-source.json'),finalExportSha256:filehash(exportPath),previewReportSha256:filehash(previewPath),previewInputHashes,previewOutputFiles:preview.outputFiles,scope:'Seven exact frozen package trees/tar/installed bytes, unchanged installed public-leaf tests/build, unchanged actual r17 export and final runtime static production preview; no native/browser/activation/whole verdict.'};
writeFileSync(here+'/final-3e62-association.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,packs:packs.length,installedFiles:result.installedFiles,gitSourceFiles:result.gitSourceFiles,unchangedFixtureFiles:result.unchangedFixtureFiles}));
