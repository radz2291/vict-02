import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
const review=process.cwd(),root='C:/Users/RZ1/.codex/worktrees/vict-architecture-realignment-20261030',evidence='docs/studio/foundation-evidence/node-suite-stress-20261031';
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const json=file=>JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const sealPath=join(root,evidence,'limits-production-seal.json'),seal=json(sealPath),activationPath=join(root,evidence,'limits-activation.json'),activation=json(activationPath);
const attestation=JSON.parse(execFileSync('git',['show','c09a495a905f16ec48f31bca89e314ee112ff25d:'+evidence+'/independent-artifact-association.json'],{cwd:review,encoding:'utf8',maxBuffer:4*1024*1024}));
const errors=[];const check=(pass,label)=>{if(!pass)errors.push(label);};
const inventory=directory=>{const files=[];const walk=folder=>{for(const item of readdirSync(folder,{withFileTypes:true})){const file=join(folder,item.name);if(item.isDirectory())walk(file);else files.push(relative(directory,file).replaceAll('\\','/'));}};walk(directory);return files.sort();};
check(activation.sourceCandidate===attestation.sourceCandidate&&activation.independentArtifactReview==='c09a495a905f16ec48f31bca89e314ee112ff25d','Activation source/review');
check(hash(sealPath)===activation.sealSha256&&activation.sealSha256===attestation.sealSha256,'Activation seal');
const live=join(root,'apps/studio/build'),liveEntries=[...seal.coreFiles,...seal.historicalProofFiles,...seal.addedPublicProofFiles],backupEntries=[...seal.previousCoreFiles,...seal.historicalProofFiles];
for(const [directory,entries,label] of [[live,liveEntries,'live'],[activation.backup,backupEntries,'backup']]){
  check(JSON.stringify(inventory(directory))===JSON.stringify(entries.map(item=>item.path).sort()),label+' inventory');
  for(const item of entries)check(hash(join(directory,item.path))===item.sha256,label+' '+item.path);
}
for(const item of attestation.compiledWorkspaceFiles)check(hash(join(root,item.path))===item.sha256,'Compiled dependency '+item.path);
check(hash(join(root,'package-lock.json'))===attestation.packageLockSha256,'Lock changed');
const changed=execFileSync('git',['diff',activation.sourceCandidate,'--name-only','--','apps/studio/src','apps/studio/scripts','apps/studio/package.json','apps/studio/svelte.config.js','apps/studio/vite.config.ts','packages','package.json','package-lock.json','tsconfig.base.json'],{cwd:root,encoding:'utf8'}).trim();check(!changed,'Production source drift');
const savedPath=join(root,evidence,'10-recovered-saved-source.json'),loadedPath=join(root,evidence,'12-activated-reloaded-source.json'),exportPath=join(root,evidence,'10-recovered-supported-export.json');
const saved=json(savedPath),loaded=json(loadedPath),exported=json(exportPath),exportedDocument=exported.uiDocuments.find(item=>item.document?.id===loaded.id)?.document;
check(hash(savedPath)===hash(loadedPath),'Recovered saved/reloaded bytes');check(isDeepStrictEqual(saved,loaded),'Recovered saved/reloaded source');check(isDeepStrictEqual(exportedDocument,loaded),'Supported export/reloaded source');
const helperPath=join(root,evidence,'limits-activation-helper.ps1');
check(hash(helperPath)===hash('C:/Users/RZ1/AppData/Local/Temp/activate-vict-limits-4fca-20261031.ps1'),'Retained/executed helper copy');
const report={schema:'vict.node-suite-independent-postactivation@1',observedUtc:new Date().toISOString(),sourceCandidate:activation.sourceCandidate,independentArtifactReview:activation.independentArtifactReview,sealSha256:hash(sealPath),activationRecordSha256:hash(activationPath),liveFilesVerified:liveEntries.length,backupFilesVerified:backupEntries.length,historicalProofFilesPreserved:seal.historicalProofFiles.length,compiledWorkspaceFilesVerified:attestation.compiledWorkspaceFiles.length,productionSourceDrift:changed,helperSha256:hash(helperPath),savedSourceSha256:hash(savedPath),reloadedSourceSha256:hash(loadedPath),sourceTextCharacters:readFileSync(loadedPath,'utf8').length,documentId:loaded.id,savedRevision:loaded.revision,supportedExportMatches:true,actualUiVerified:false,actualAgentSuiteVerified:false,errors,status:errors.length?'FAIL':'PASS'};
writeFileSync(join(review,evidence,'independent-postactivation-association.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
