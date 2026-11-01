import {readFileSync,writeFileSync,readdirSync,statSync,mkdtempSync,mkdirSync,realpathSync,existsSync} from 'node:fs';
import {join,resolve,relative,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),evidence=join(root,'docs/studio/foundation-evidence/structure-shared-completion-20261101');
const source='3dfdde4ecb5567bc03130426482076d5344e3530',baseline='f483088f29785f973ffa1bb5131081c0936e1b47';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),fileHash=path=>hash(readFileSync(path));
const json=path=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const errors=[],notes=[],check=(condition,message)=>{if(!condition)errors.push(message);};
const within=(base,path)=>{const value=resolve(base,path);if(!value.toLowerCase().startsWith((resolve(base)+sep).toLowerCase()))throw Error(`Path escape: ${path}`);return value;};
const walk=base=>readdirSync(base,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(base,entry.name)).map(path=>join(entry.name,path)):[entry.name]);
const compareFiles=(base,entries,label)=>{for(const entry of entries){const path=within(base,entry.path);check(existsSync(path)&&fileHash(path)===entry.sha256,`${label}: ${entry.path}`);}};
const sealPath=join(evidence,'production-seal.json'),seal=json(sealPath),stage=seal.stageRoot;
check(git('rev-parse','HEAD')===source,'Unexpected HEAD');
const productPaths=['apps/studio/src','apps/studio/scripts','apps/studio/package.json','apps/studio/vite.config.ts','apps/studio/svelte.config.js','packages','package.json','package-lock.json','tsconfig.base.json'];
check(!git('diff','--name-only',source,'--',...productPaths),'Tracked product source drift');
check(!git('ls-files','--others','--exclude-standard','--',...productPaths),'Untracked product source drift');
check(seal.sourceCandidate===source&&seal.activationPerformed===false,'Wrong source or already activated seal');
check(stage==='C:\\Users\\RZ1\\AppData\\Local\\Temp\\vict-structure-shared-3dfdde4e-stage','Unexpected stage');
check(fileHash(join(stage,'studio-build-inputs.json'))===seal.sourceInputsSha256,'Input manifest identity mismatch');
check(fileHash(join(root,'package-lock.json'))===seal.packageLockSha256,'Dependency lock mismatch');
const inputs=json(join(stage,'studio-build-inputs.json'));
check(inputs.SourceCommit===source&&inputs.InputWorkingTreeClean&&inputs.WorkspaceWorkingTreeClean,'Unclean or wrong staged inputs');
for(const entry of inputs.Inputs){
 const path=within(stage,entry.Path);check(fileHash(path)===entry.SHA256,`Staged source byte mismatch: ${entry.Path}`);
 const blob=execFileSync('git',['show',`${source}:${entry.Path.replaceAll('\\','/')}`],{cwd:root,maxBuffer:16*1024*1024});
 check(blob.toString('utf8').replaceAll('\r\n','\n')===readFileSync(path,'utf8').replaceAll('\r\n','\n'),`Staged source differs from candidate (after line endings): ${entry.Path}`);
}
const newBuild=join(stage,'apps/studio/build');
check(walk(newBuild).length===seal.totalFiles&&seal.files.length===seal.totalFiles,'Staged output count mismatch');
compareFiles(newBuild,seal.files,'Staged output');
check(seal.coreFiles.length===305&&seal.historicalProofFiles.length===93&&seal.totalFiles===398,'Unexpected core/proof totals');
compareFiles(root,seal.compiledWorkspaceFiles,'Compiled workspace');
const prior=json(join(root,'docs/studio/foundation-evidence/node-suite-stress-20261031/nested-final-activation.json'));
const oldFiles=[...prior.coreFiles,...prior.historicalProofFiles,...prior.addedPublicProofFiles],oldBuild=join(root,'apps/studio/build');
check(prior.sourceCandidate==='3e62f75d8337db767c8de6e7d214d520abcdce41'&&oldFiles.length===398&&walk(oldBuild).length===398,'Previous output count/source mismatch');
compareFiles(oldBuild,oldFiles,'Previous output');
const oldProof=[...prior.historicalProofFiles,...prior.addedPublicProofFiles];
check(JSON.stringify(seal.historicalProofFiles)===JSON.stringify(oldProof),'Historical route inventory mismatch');
compareFiles(newBuild,oldProof,'Retained proof');
check(fileHash(seal.consumerReportPath)===seal.consumerReportSha256,'Consumer report identity mismatch');
const consumer=json(seal.consumerReportPath);
check(consumer.status==='PASS'&&consumer.sourceCandidate===source&&consumer.domTest.passed&&consumer.productionBuild.passed,'Consumer did not pass exact candidate');
check(consumer.packs.length===9,'Expected nine public package archives');
const unpackRoot=mkdtempSync(join(tmpdir(),'vict-structure-independent-unpack-'));
let installedNonmanifest=0,archiveNonmanifest=0,manifestSemantics=0;
const stable=value=>JSON.stringify(value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,JSON.parse(stable(value[key]))])):value);
for(const pack of consumer.packs){
 check(fileHash(pack.path)===pack.sha256,`Archive integrity mismatch: ${pack.name}`);
 const name=pack.name.replace('@victframework/',''),packageRoot=join(root,'packages',name),installedRoot=join(consumer.consumer,'node_modules',pack.name);
 check(realpathSync(installedRoot).toLowerCase().startsWith((resolve(consumer.consumer)+sep).toLowerCase()),`Installed package is not isolated: ${pack.name}`);
 const entries=execFileSync('tar',['-tf',pack.path],{encoding:'utf8'}).trim().split(/\r?\n/);
 check(entries.every(path=>path.startsWith('package/')&&!path.split('/').includes('..')&&!path.includes('\\')),`Unsafe tar path: ${pack.name}`);
 const listing=execFileSync('tar',['-tvf',pack.path],{encoding:'utf8'}).trim().split(/\r?\n/);
 check(listing.every(line=>line[0]==='-'||line[0]==='d'),`Non-regular archive entry: ${pack.name}`);
 const unpack=join(unpackRoot,name);mkdirSync(unpack);execFileSync('tar',['-xf',pack.path,'-C',unpack]);
 const unpacked=join(unpack,'package'),actualEntries=walk(unpacked).map(path=>path.replaceAll('\\','/')).sort();
 check(JSON.stringify(actualEntries)===JSON.stringify(pack.files.map(file=>file.path).sort()),`Archive member inventory mismatch: ${pack.name}`);
 for(const file of pack.files){
  check(fileHash(within(packageRoot,file.path))===file.sha256,`Packed workspace byte changed: ${pack.name}/${file.path}`);
  if(file.path==='package.json')continue;
  check(fileHash(within(installedRoot,file.path))===file.sha256,`Installed byte mismatch: ${pack.name}/${file.path}`);installedNonmanifest++;
  check(fileHash(within(unpacked,file.path))===file.sha256,`Actual archive member mismatch: ${pack.name}/${file.path}`);archiveNonmanifest++;
 }
 const original=json(join(packageRoot,'package.json')),installed=json(join(installedRoot,'package.json')),archived=json(join(unpacked,'package.json'));
 for(const key of ['name','version','type','exports','dependencies','peerDependencies','optionalDependencies']){
  check(stable(installed[key]??null)===stable(original[key]??null),`Installed manifest semantics differ: ${pack.name}/${key}`);
  check(stable(archived[key]??null)===stable(original[key]??null),`Archive manifest semantics differ: ${pack.name}/${key}`);
 }
 manifestSemantics++;
 const build=consumer.packageBuilds.find(build=>build.name===pack.name);
 check(build&&git('rev-parse',`${source}:packages/${name}`)===build.sourceTree,`Package source tree mismatch: ${pack.name}`);
 if(build?.mode==='reused-build')check(git('rev-parse',`${build.previousSource}:packages/${name}`)===build.sourceTree,`Reused source tree mismatch: ${pack.name}`);
}
const snapshotPath=join(evidence,'vict-structure-consumer-hXcQQT-build-reuse-snapshot.json');
check(fileHash(snapshotPath)===consumer.reusedArtifactEvidence.sha256,'Preserved reuse snapshot does not match recorded identity');
notes.push('The reuse report path later changed when its original run terminated. Its exact recorded digest survives in the explicitly preserved build-reuse snapshot; this review associates that snapshot independently. Eight unchanged package builds/artifacts were reused; Structure was freshly built/packed.');
compareFiles(consumer.consumer,consumer.fixtureFiles,'Consumer fixture');
compareFiles(join(consumer.consumer,'dist'),consumer.outputFiles,'Consumer output');
check(walk(join(consumer.consumer,'dist')).length===consumer.outputFiles.length,'Consumer output count mismatch');
for(const key of ['domTest','productionBuild'])check(fileHash(consumer[key].path)===consumer[key].sha256,`Consumer ${key} log mismatch`);
const fixtureText=consumer.fixtureFiles.filter(file=>/\.(?:ts|svelte|mjs)$/.test(file.path)).map(file=>readFileSync(join(consumer.consumer,file.path),'utf8')).join('\n');
check(!/from\s*['"][^'"]*apps\/studio|alias\s*:/.test(fixtureText),'Private Studio import or source alias in fixture');
const report={schema:'vict.structure-shared-independent-activation-review@1',status:errors.length?'FAIL':'PASS',sourceCandidate:source,baseline,sealSha256:fileHash(sealPath),consumerReportSha256:fileHash(seal.consumerReportPath),stageRoot:stage,stagedInputFiles:inputs.Inputs.length,newOutputFiles:seal.files.length,previousFiles:oldFiles.length,retainedProofFiles:oldProof.length,compiledWorkspaceFiles:seal.compiledWorkspaceFiles.length,publicArchives:consumer.packs.length,installedNonmanifestFilesMatched:installedNonmanifest,actualArchiveNonmanifestFilesMatched:archiveNonmanifest,manifestSemanticsCompared:manifestSemantics,consumerOutputFiles:consumer.outputFiles.length,consumerFixtureFiles:consumer.fixtureFiles.length,consumerDomCases:consumer.domTest.cases,unpackRoot,sourceDrift:false,technicalActivationSupported:errors.length===0,actualUiVerified:false,notes,errors,limits:['Technical source/artifact association only; no new native browser, actual-agent or physical-device verdict.','Test-only/harness-only working changes outside the runtime freeze do not change the staged candidate; their final committed identities belong to integrator delivery.','Existing build diagnostics and matched inherited test failures remain qualified by the source review.']};
writeFileSync(join(evidence,'independent-activation-review.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(errors.length)process.exitCode=1;
