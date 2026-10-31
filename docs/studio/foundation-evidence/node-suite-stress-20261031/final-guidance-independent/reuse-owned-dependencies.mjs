import {readdirSync,readFileSync,existsSync,cpSync,writeFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),original='C:/Users/RZ1/.codex/worktrees/vict-architecture-realignment-20261030';
if(resolve(root).toLowerCase()===resolve(original).toLowerCase())throw Error('Review setup must not run in the integrator checkout.');
const walk=path=>!existsSync(path)?[]:readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(path,entry.name)):entry.isFile()?[join(path,entry.name)]:[]);
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const receipt=[];
for(const name of readdirSync(join(root,'packages'))){
 const here=join(root,'packages',name),there=join(original,'packages',name);
 if(!existsSync(join(there,'dist')))continue;
 const manifest=JSON.parse(readFileSync(join(here,'package.json'),'utf8'));
 // Source-exported Svelte packages do not consume their historical dist folder.
 if(!JSON.stringify(manifest.exports?.['.']??manifest.main??'').includes('dist/'))continue;
 const source=base=>[...walk(join(base,'src')),join(base,'package.json')].map(path=>({path:relative(base,path).replaceAll('\\','/'),sha256:hash(path)})).sort((a,b)=>a.path.localeCompare(b.path));
 if(JSON.stringify(source(here))!==JSON.stringify(source(there)))throw Error('Source/manifest differ: '+name);
 cpSync(join(there,'dist'),join(here,'dist'),{recursive:true});
 const entries=walk(join(there,'dist')).map(path=>({path:relative(there,path).replaceAll('\\','/'),sha256:hash(path)}));
 for(const entry of entries)if(hash(join(here,entry.path))!==entry.sha256||hash(join(there,entry.path))!==entry.sha256)throw Error('Unstable/copied artifact mismatch: '+name+'/'+entry.path);
 receipt.push({package:name,sourceManifestEquality:true,dist:entries});
}
const output={sourceCandidate:'fae2e9e053fe34d3c7d4bf618488538e800318ac',original,scope:'Owned local dependency dist reused only after complete source-tree/manifest equality and post-copy byte verification; no root writes or fresh packed-artifact claim.',packages:receipt};
writeFileSync('docs/studio/foundation-evidence/node-suite-stress-20261031/final-guidance-independent/dependency-reuse.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({packages:receipt.length,files:receipt.reduce((n,p)=>n+p.dist.length,0)}));
