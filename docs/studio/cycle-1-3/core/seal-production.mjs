import { readdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve,relative,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const manifestPath=resolve(root,'docs/studio/cycle-1-3/core/production-seal.json');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const digest=path=>createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex');
const product=['apps/studio','packages','package.json','package-lock.json'];
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
  const inputs=git('ls-files','--',...product).split('\n').filter(Boolean).filter(path=>!path.includes('/test/')&&!path.includes('/tests/')).map(path=>({path,sha256:digest(path)}));
  const outputs=[];
  function walk(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){const path=resolve(directory,entry.name);if(entry.isDirectory())walk(path);else if(entry.isFile()){const name=relative(root,path).replaceAll('\\','/');outputs.push({path:name,sha256:digest(name)});}}}
  walk(resolve(root,'apps/studio/build'));
  for(const name of ['contracts','sdk','application','ui','ui-editor','ui-svelte','ui-ai-svelte','ui-flow-svelte'])walk(resolve(root,`packages/${name}/dist`));
  outputs.sort((a,b)=>a.path.localeCompare(b.path));
  writeFileSync(manifestPath,JSON.stringify({candidate,createdAt:new Date().toISOString(),node:process.version,inputs,outputs},null,2)+'\n');
  console.log(JSON.stringify({candidate,inputs:inputs.length,outputs:outputs.length}));
}
