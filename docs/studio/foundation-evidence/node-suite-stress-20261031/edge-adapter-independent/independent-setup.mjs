import {readdirSync,readFileSync,cpSync,existsSync,writeFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const dependencyRoot='C:/Users/RZ1/.codex/worktrees/vict-studio-edge-v3-20261101',root=process.cwd();
const hash=b=>createHash('sha256').update(b).digest('hex');
const walk=(p)=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(p,e.name)):e.isFile()?[join(p,e.name)]:[]);
const evidence=[];
for(const name of readdirSync(join(root,'packages'))){const here=join(root,'packages',name),there=join(dependencyRoot,'packages',name);if(!existsSync(join(there,'dist')))continue;
 for(const file of [...(existsSync(join(here,'src'))?walk(join(here,'src')):[]),join(here,'package.json')]){const original=join(there,relative(here,file));if(hash(readFileSync(file))!==hash(readFileSync(original)))throw Error('Dependency source mismatch: '+file);}
 cpSync(join(there,'dist'),join(here,'dist'),{recursive:true});for(const file of walk(join(here,'dist')))evidence.push({path:relative(root,file),sha256:hash(readFileSync(file))});
}
for(const file of walk(join(root,'packages/ui-flow-svelte/src'))){if(hash(readFileSync(file))!==hash(readFileSync(join(dependencyRoot,relative(root,file)))))throw Error('Public Flow source mismatch: '+file);}
writeFileSync('independent-dependency-reuse.json',JSON.stringify({dependencyRoot,publicFlow:'source exports matched exact bytes',dist:evidence},null,2));
