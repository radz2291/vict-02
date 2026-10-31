import {readFileSync,readdirSync,realpathSync,writeFileSync,existsSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const review=process.cwd(),root='C:/Users/RZ1/.codex/worktrees/vict-architecture-realignment-20261030';
const evidence='docs/studio/foundation-evidence/node-suite-stress-20261031';
const sealPath=join(root,evidence,'limits-production-seal.json');
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const json=path=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const seal=json(sealPath),stage=seal.stageRoot,inputsPath=join(stage,'studio-build-inputs.json'),inputs=json(inputsPath);
const errors=[];
const check=(condition,label)=>{if(!condition)errors.push(label);};
const inventory=directory=>{const found=[];const walk=path=>{for(const item of readdirSync(path,{withFileTypes:true})){const file=join(path,item.name);if(item.isDirectory())walk(file);else found.push(relative(directory,file).replaceAll('\\','/'));}};walk(directory);return found.sort();};
check(seal.sourceCandidate==='4fcaadcd91434448e12f2e8294da70f74103bb07','Unexpected source');
check(hash(inputsPath)===seal.sourceInputsSha256,'Input manifest hash');
check(hash(join(root,'package-lock.json'))===seal.packageLockSha256,'Lock hash');
check(hash(join(review,'package-lock.json'))===seal.packageLockSha256,'Independent lock mismatch');
check(inputs.SourceCommit===seal.sourceCandidate&&inputs.InputWorkingTreeClean&&inputs.WorkspaceWorkingTreeClean,'Input source/clean snapshot');
const currentInputMismatches=[],checkoutLineEndingOnly=[];
for(const item of inputs.Inputs){
  check(hash(join(stage,item.Path))===item.SHA256,'Staged input '+item.Path);
  if(hash(join(review,item.Path))!==item.SHA256){
    const normalize=bytes=>bytes.toString('utf8').replaceAll('\r\n','\n');
    const staged=normalize(readFileSync(join(stage,item.Path))),own=normalize(readFileSync(join(review,item.Path)));
    const canonical=normalize(execFileSync('git',['show',seal.sourceCandidate+':'+item.Path],{cwd:review,maxBuffer:32*1024*1024}));
    check(staged===own&&staged===canonical,'Independent exact-source input '+item.Path);
    if(staged===own&&staged===canonical)checkoutLineEndingOnly.push(item.Path);
  }
  if(hash(join(root,item.Path))!==item.SHA256)currentInputMismatches.push(item.Path);
}
check(currentInputMismatches.every(path=>path==='apps/studio/tests/ui/core-schema-diagnostics.test.ts'),'Unexpected current input drift');
const productionDrift=execFileSync('git',['diff',seal.sourceCandidate,'--name-only','--','apps/studio/src','apps/studio/package.json','apps/studio/svelte.config.js','apps/studio/vite.config.ts','packages','package-lock.json'],{cwd:root,encoding:'utf8'}).trim();
check(!productionDrift,'Current production source drift '+productionDrift);
const links=inputs.DependencyLinks.map(item=>({path:item.Path,target:realpathSync(join(stage,item.Path)),expected:realpathSync(join(root,item.Path))}));
for(const link of links)check(link.target.toLowerCase()===link.expected.toLowerCase(),'Dependency link '+link.path);
const stageExpected=[...seal.coreFiles,...seal.historicalProofFiles,...seal.addedPublicProofFiles];
const stageActual=inventory(seal.buildRoot);
check(stageActual.length===392&&stageExpected.length===392,'Stage inventory count');
check(new Set(stageExpected.map(item=>item.path)).size===392,'Duplicate sealed path');
for(const item of stageExpected)check(hash(join(seal.buildRoot,item.path))===item.sha256,'Stage artifact '+item.path);
check(JSON.stringify(stageActual)===JSON.stringify(stageExpected.map(item=>item.path).sort()),'Stage inventory membership');
const oldRoot=join(root,'apps/studio/build'),oldExpected=[...seal.previousCoreFiles,...seal.historicalProofFiles],oldActual=inventory(oldRoot);
check(oldActual.length===389&&oldExpected.length===389,'Old artifact count');
check(JSON.stringify(oldActual)===JSON.stringify(oldExpected.map(item=>item.path).sort()),'Old artifact membership');
for(const item of oldExpected)check(hash(join(oldRoot,item.path))===item.sha256,'Old artifact '+item.path);
const distChecks=[];
for(const name of ['contracts','ui','sdk','kernel','runtime','mastra','application']){
  const own=join(review,'packages',name,'dist'),other=join(root,'packages',name,'dist');
  const files=inventory(own).filter(path=>/\.(?:js|mjs|css|map|d\.ts)$/.test(path));
  for(const file of files)check(existsSync(join(other,file))&&hash(join(own,file))===hash(join(other,file)),'Compiled dependency '+name+'/'+file);
  distChecks.push({name,filesMatched:files.length,files:files.map(file=>({path:'packages/'+name+'/dist/'+file,sha256:hash(join(other,file))}))});
}
const consumerPath=join(root,'docs/studio/foundation-evidence/architecture-realignment-20261030/vict-realignment-consumer-5ogkHM.json');
check(hash(consumerPath)===seal.consumerReportSha256,'Consumer report hash');
const consumer=json(consumerPath);check(consumer.sourceCandidate===seal.sourceCandidate&&consumer.domTest.passed,'Consumer source/result');
let installedFiles=0;
for(const pack of consumer.packs){
  check(hash(pack.path)===pack.sha256,'Consumer tarball '+pack.name);
  const installed=consumer.installedByteComparison.find(item=>item.name===pack.name).installed;
  for(const file of pack.files){if(file.path==='package.json')continue;check(hash(join(installed,file.path))===file.sha256,'Installed consumer '+pack.name+'/'+file.path);installedFiles++;}
}
const output=join(consumer.consumer,'dist');
for(const file of seal.addedPublicProofFiles){const tail=file.path.replace('client/foundation-limits-5ogkHM/','');check(hash(join(output,tail))===file.sha256,'New consumer proof '+tail);}
check(hash(consumer.domTest.log)===consumer.domTest.sha256,'Consumer DOM log');
check(seal.activationPerformed===false&&seal.actualUiVerification==='pending','Activation/UI seal state');
const externalVictImports=[];
for(const path of inventory(join(seal.buildRoot,'server')).filter(path=>path.endsWith('.js'))){
  const text=readFileSync(join(seal.buildRoot,'server',path),'utf8');
  for(const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"](@victframework\/[^'"]+)/g))externalVictImports.push({path,module:match[1]});
}
check(externalVictImports.length===0,'External VICT server imports');
const report={schema:'vict.node-suite-independent-artifact-review@1',technicalActivationSupported:errors.length===0,actualUiVerified:false,sourceCandidate:seal.sourceCandidate,sealSha256:hash(sealPath),sourceInputsSha256:hash(inputsPath),packageLockSha256:hash(join(root,'package-lock.json')),inputsVerified:inputs.Inputs.length,currentInputMismatches,checkoutLineEndingOnly,productionSourceDrift:productionDrift,dependencyLinks:links,compiledWorkspaceFiles:distChecks.flatMap(item=>item.files),compiledDependencyComparison:distChecks.map(({files,...summary})=>summary),externalVictImports,stagedFilesVerified:stageActual.length,oldFilesVerified:oldActual.length,historicalProofFilesVerified:seal.historicalProofFiles.length,newConsumerProofFilesVerified:seal.addedPublicProofFiles.length,installedPublicFilesVerified:installedFiles,consumerReportSha256:hash(consumerPath),activationPerformed:false,actualUiVerification:'pending',errors,status:errors.length?'FAIL':'PASS'};
writeFileSync(join(review,evidence,'independent-artifact-association.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,sourceCandidate:report.sourceCandidate,sealSha256:report.sealSha256,inputsVerified:report.inputsVerified,stagedFilesVerified:report.stagedFilesVerified,oldFilesVerified:report.oldFilesVerified,compiledWorkspaceFiles:report.compiledWorkspaceFiles.length,installedPublicFilesVerified:report.installedPublicFilesVerified,errors},null,2));if(errors.length)process.exitCode=1;
