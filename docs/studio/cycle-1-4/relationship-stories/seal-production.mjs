import { readdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve,relative,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const manifestPath=resolve(root,'docs/studio/cycle-1-4/relationship-stories/production-seal.json');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const digest=path=>createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex');
const product=['apps/studio','packages','package.json','package-lock.json','docs/studio/CYCLE-1-4-CATALOG-MIGRATION.json'];
function assertCommittedInputBytes(candidate, paths) {
  // Read all blobs in one Git process. Worktree line-ending filters must not
  // make a seal that fails in a normal exact-candidate checkout.
  const payload=execFileSync('git',['cat-file','--batch'],{cwd:root,input:paths.map(path=>`${candidate}:${path}\n`).join(''),maxBuffer:128*1024*1024});
  let offset=0;
  for(const path of paths){
    const newline=payload.indexOf(10,offset),header=payload.subarray(offset,newline).toString('utf8').split(' '),size=Number(header[2]);
    if(header[1]!=='blob'||!Number.isSafeInteger(size))throw Error('Missing committed input: '+path);
    const committed=payload.subarray(newline+1,newline+1+size);
    if(!committed.equals(readFileSync(resolve(root,path))))throw Error('Build input differs from exact committed bytes (including line endings): '+path);
    offset=newline+1+size+1;
  }
}
function assertSource(candidate){
  const changes=git('diff','--name-only',candidate,'--',...product);
  const untracked=git('ls-files','--others','--exclude-standard','--',...product);
  if(changes||untracked)throw Error('Product source differs from sealed candidate: '+[changes,untracked].filter(Boolean).join('\n'));
}
if(process.argv.includes('--verify')){
  const seal=JSON.parse(readFileSync(manifestPath,'utf8'));
  assertSource(seal.candidate);
  for(const file of [...seal.inputs,...seal.outputs])if(digest(file.path)!==file.sha256)throw Error('Sealed bytes changed: '+file.path);
  console.log(JSON.stringify({verified:true,candidate:seal.candidate,inputs:seal.inputs.length,outputs:seal.outputs.length}));
}else{
  const candidate=git('rev-parse','HEAD');assertSource(candidate);
  const paths=git('ls-files','--',...product).split('\n').filter(Boolean).filter(path=>!path.includes('/test/')&&!path.includes('/tests/'));
  assertCommittedInputBytes(candidate,paths);
  const inputs=paths.map(path=>({path,sha256:digest(path)}));
  const outputs=[];
  function walk(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){const path=resolve(directory,entry.name);if(entry.isDirectory())walk(path);else if(entry.isFile()){const name=relative(root,path).replaceAll('\\','/');outputs.push({path:name,sha256:digest(name)});}}}
  walk(resolve(root,'apps/studio/build'));
  const sourceExportPackages=[];
  for(const name of ['contracts','sdk','application','ui','ui-editor','ui-svelte','ui-ai-svelte','ui-flow-svelte']){
    const pkg=JSON.parse(readFileSync(resolve(root,`packages/${name}/package.json`),'utf8'));
    if(JSON.stringify({exports:pkg.exports,main:pkg.main,types:pkg.types}).includes('./dist/'))walk(resolve(root,`packages/${name}/dist`));
    else sourceExportPackages.push(name); // Source-exported packages are already covered by tracked input hashes.
  }
  outputs.sort((a,b)=>a.path.localeCompare(b.path));
  writeFileSync(manifestPath,JSON.stringify({candidate,createdAt:new Date().toISOString(),node:process.version,sourceExportPackages,inputs,outputs},null,2)+'\n');
  console.log(JSON.stringify({candidate,inputs:inputs.length,outputs:outputs.length}));
}
