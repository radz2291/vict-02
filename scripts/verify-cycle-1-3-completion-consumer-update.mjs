/** Upgrade the independently installed consumer to sealed completion packages; retain original install evidence. */
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root=process.cwd();
const initial=JSON.parse(readFileSync(join(root,'docs/studio/cycle-1-3/completion-consumer.json'),'utf8'));
const consumer=realpathSync(initial.consumer);
const npm=process.platform==='win32'?'npm.cmd':'npm';
const run=(args,cwd)=>execFileSync(npm,args,{cwd,encoding:'utf8',shell:process.platform==='win32',maxBuffer:8*1024*1024});
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const artifacts=join(initial.destination,`completion-${sha.slice(0,12)}`);mkdirSync(artifacts,{recursive:true});
const manifest=JSON.parse(readFileSync(join(consumer,'package.json'),'utf8'));
const packs=[];
// Flow imports managed media at runtime; vendor that candidate dependency too.
for(const name of ['ui-media-svelte','ui-ai-svelte','ui-flow-svelte']){
  const packed=JSON.parse(run(['pack','--json','--pack-destination',artifacts],join(root,'packages',name)))[0];
  const path=join(artifacts,packed.filename);manifest.dependencies[`@victframework/${name}`]=`file:${path.replaceAll('\\','/')}`;
  packs.push({name,path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
}
writeFileSync(join(consumer,'package.json'),JSON.stringify(manifest,null,2));
cpSync(join(root,'examples/studio-ui-consumer/src'),join(consumer,'src'),{recursive:true});
writeFileSync(join(artifacts,'install.log'),run(['install','--ignore-scripts','--no-audit','--no-fund'],consumer));
writeFileSync(join(artifacts,'build.log'),run(['run','build'],consumer));
const files=[];
function walk(path){return readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(path,entry.name)):[join(path,entry.name)]);}
for(const pack of packs){
  const source=join(root,'packages',pack.name),installed=realpathSync(join(consumer,'node_modules/@victframework',pack.name));
  if(!installed.startsWith(consumer))throw Error('Installed package escaped the independent consumer');
  for(const path of walk(join(source,'src'))){const name=relative(source,path);const a=createHash('sha256').update(readFileSync(path)).digest('hex');const b=createHash('sha256').update(readFileSync(join(installed,name))).digest('hex');files.push({package:pack.name,path:name.replaceAll('\\','/'),sha256:a,match:a===b});}
}
if(files.some(file=>!file.match))throw Error('Installed source differs from candidate');
const report={mode:'Incremental final package upgrade in the retained fresh independent install; no workspace links or aliases',sha,consumer,artifacts,packs,files};
writeFileSync(join(root,'docs/studio/cycle-1-3/completion-consumer-final.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({mode:report.mode,sha,consumer,files:files.length,packs},null,2));
