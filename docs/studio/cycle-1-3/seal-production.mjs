import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root=process.cwd();
const candidate=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const changes=execFileSync('git',['diff','--name-only','HEAD','--','apps/studio','packages','package.json','package-lock.json'],{encoding:'utf8'}).trim();
if(changes)throw Error('Product source changed after candidate: '+changes);
const files=[];
function walk(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){const path=resolve(directory,entry.name);if(entry.isDirectory())walk(path);else if(entry.isFile())files.push({path:relative(root,path).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});}}
walk(resolve(root,'apps/studio/build'));
files.sort((a,b)=>a.path.localeCompare(b.path));
writeFileSync(resolve(root,'docs/studio/cycle-1-3/production-manifest.json'),JSON.stringify({candidate,createdAt:new Date().toISOString(),productTrackedChanges:changes,files},null,2));
console.log(JSON.stringify({candidate,files:files.length}));
