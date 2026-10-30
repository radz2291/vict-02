/** Fresh packed consumer: no workspace links, aliases or Studio source imports. */
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root=process.cwd(), destination=mkdtempSync(join(tmpdir(),'vict-cycle13-consumer-'));
const npm=process.platform==='win32'?'npm.cmd':'npm';
function run(args,cwd){return execFileSync(npm,args,{cwd,encoding:'utf8',shell:process.platform==='win32',maxBuffer:8*1024*1024});}
const artifacts=join(destination,'artifacts');mkdirSync(artifacts);
const packs=[];
// Flow imports managed media at runtime; vendor that candidate dependency too.
for(const name of ['ui-media-svelte','ui-ai-svelte','ui-flow-svelte']){
  const result=JSON.parse(run(['pack','--json','--pack-destination',artifacts],join(root,'packages',name)))[0];
  const path=join(artifacts,result.filename);packs.push({name:`@victframework/${name}`,path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
}
const consumer=join(destination,'consumer');cpSync(join(root,'examples/studio-ui-consumer'),consumer,{recursive:true,filter:source=>!source.includes('node_modules')&&!source.includes('dist')});
const manifest=JSON.parse(readFileSync(join(consumer,'package.json'),'utf8'));
for(const pack of packs)manifest.dependencies[pack.name]=`file:${pack.path.replaceAll('\\','/')}`;
writeFileSync(join(consumer,'package.json'),JSON.stringify(manifest,null,2));
const install=run(['install','--no-audit','--no-fund'],consumer);writeFileSync(join(destination,'install.log'),install);
const build=run(['run','build'],consumer);writeFileSync(join(destination,'build.log'),build);
const resolved=packs.map(pack=>({name:pack.name,path:realpathSync(join(consumer,'node_modules',pack.name))}));
if(resolved.some(entry=>!entry.path.startsWith(consumer)))throw Error('Consumer escaped isolated install');
const report={mode:'fresh packed consumer; production build',destination,consumer,packs,resolved,dependencies:JSON.parse(run(['ls','bits-ui','svelte','@xyflow/svelte','--json'],consumer))};
writeFileSync(resolve(root,'docs/studio/cycle-1-3/consumer.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
