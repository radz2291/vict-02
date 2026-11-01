// Integrator verification, not an independent review or a native-browser proof.
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),evidence=join(root,'docs/studio/foundation-evidence/structure-captions-20261101');
const source='2de11bc7719984f23341852b1cc8b9985ff81adf';
const json=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const errors=[],check=(ok,message)=>{if(!ok)errors.push(message);};
const within=(base,path)=>{const p=resolve(base,path);if(!p.toLowerCase().startsWith((resolve(base)+sep).toLowerCase()))throw Error('Path escape');return p;};
const walk=base=>readdirSync(base,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(base,e.name)).map(p=>join(e.name,p)):[e.name]);
const compare=(base,files)=>{check(walk(base).length===files.length,`Inventory count: ${base}`);for(const f of files){const p=within(base,f.path);check(existsSync(p)&&hash(p)===f.sha256,`Byte mismatch: ${p}`);}};
const sealPath=join(evidence,'production-seal.json'),seal=json(sealPath),prior=json(join(evidence,'production-seal-before-captions.json'));
const post=process.argv.includes('--post');
check(seal.sourceCandidate===source,'Wrong sealed source');
check(prior.sourceCandidate==='a629b40818ba367daf79850c80d9abb7fe02df1c','Wrong predecessor');
check(!git('diff','--name-only',source,'--','apps/studio','packages','package.json','package-lock.json','tsconfig.base.json'),'Source drift');
check(!git('ls-files','--others','--exclude-standard','--','apps/studio','packages'),'Untracked source');
check(hash(join(root,'package-lock.json'))===seal.packageLockSha256,'Lock drift');
check(hash(join(seal.stageRoot,'studio-build-inputs.json'))===seal.sourceInputsSha256,'Input manifest drift');
const inputs=json(join(seal.stageRoot,'studio-build-inputs.json'));
check(inputs.SourceCommit===source&&inputs.InputWorkingTreeClean&&inputs.WorkspaceWorkingTreeClean,'Unclean staged source');
for(const f of inputs.Inputs){const p=within(seal.stageRoot,f.Path);check(hash(p)===f.SHA256,'Staged byte drift');const blob=git('show',`${source}:${f.Path.replaceAll('\\','/')}`);check(blob.replaceAll('\r\n','\n')===readFileSync(p,'utf8').trim().replaceAll('\r\n','\n'),`Commit association: ${f.Path}`);}
compare(join(seal.stageRoot,'apps/studio/build'),seal.files);
for(const f of seal.compiledWorkspaceFiles)check(hash(within(root,f.path))===f.sha256,`Compiled dependency: ${f.path}`);
check(hash(seal.consumerReportPath)===seal.consumerReportSha256,'Consumer report drift');
const consumer=json(seal.consumerReportPath);check(consumer.sourceCandidate===source&&consumer.status==='PASS'&&consumer.domTest.passed&&consumer.productionBuild.passed,'Consumer failed');
check(hash(consumer.reusedArtifactEvidence.path)===consumer.reusedArtifactEvidence.sha256,'Reuse manifest drift');
for(const f of consumer.fixtureFiles)check(hash(within(consumer.consumer,f.path))===f.sha256,'Consumer fixture drift');
compare(join(consumer.consumer,'dist'),consumer.outputFiles);
for(const receipt of [consumer.domTest,consumer.productionBuild])check(hash(receipt.path)===receipt.sha256,'Consumer raw log drift');
let members=0;
for(const pack of consumer.packs){check(hash(pack.path)===pack.sha256,`Archive drift: ${pack.name}`);for(const f of pack.files){check(hash(within(join(root,'packages',pack.name.replace('@victframework/','')),f.path))===f.sha256,'Workspace package drift');if(f.path!=='package.json'){check(hash(within(join(consumer.consumer,'node_modules',pack.name),f.path))===f.sha256,'Installed package drift');members++;}}}
if(post){const activation=json(join(evidence,'activation.json'));check(activation.sourceCandidate===source&&activation.sealSha256===hash(sealPath),'Activation association');compare(join(root,'apps/studio/build'),seal.files);compare(activation.backup,prior.files);}else compare(join(root,'apps/studio/build'),prior.files);
const report={schema:'vict.structure-caption-technical-review@1',reviewedBy:'integrator',status:errors.length?'FAIL':'PASS',sourceCandidate:source,sealSha256:hash(sealPath),postActivation:post,sourceInputs:inputs.Inputs.length,installedFiles:seal.files.length,preservedProofFiles:seal.historicalProofFiles.length,consumerPackages:consumer.packs.length,installedNonmanifestMembers:members,errors};
writeFileSync(join(evidence,post?'post-activation-review.json':'technical-review.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(errors.length)process.exitCode=1;

