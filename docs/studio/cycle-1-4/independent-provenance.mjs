import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const load=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
const matrix=load('docs/studio/CYCLE-1-4-CATALOG-MIGRATION.json');
const manifest=load('packages/ui-svelte/rhea-upstream-manifest.json');
const base=`https://raw.githubusercontent.com/huntabyte/shadcn-svelte/${matrix.upstreamCommit}/docs/static/registry/styles/rhea/`;
const response=await fetch(base+'index.json');if(!response.ok)throw Error('Index HTTP '+response.status);
const index=await response.json(),ui=index.filter(x=>x.type==='registry:ui');
const actualNames=ui.map(x=>x.name).sort(),matrixNames=matrix.families.map(x=>x.family).sort();
if(JSON.stringify(actualNames)!==JSON.stringify(matrixNames))throw Error('Family set mismatch');
const results=[];
// Four bounded read workers; no local build, install or mutation outside evidence.
let cursor=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<ui.length){const entry=ui[cursor++];const res=await fetch(base+entry.relativeUrl);if(!res.ok)throw Error(entry.name+' HTTP '+res.status);const text=await res.text(),body=JSON.parse(text),pin=manifest.entries.find(x=>x.name===entry.name),row=matrix.families.find(x=>x.family===entry.name);const digest=hash(text);if(digest!==pin.sha256||digest!==row.upstreamSha256)throw Error(entry.name+' registry digest mismatch');for(const file of pin.files){const actual=body.files.find(x=>x.target===file.target||x.path===file.target);if(!actual)throw Error(entry.name+' missing file '+file.target);if(hash(actual.content)!==file.sha256)throw Error(entry.name+' source payload mismatch '+file.target);}results.push({family:entry.name,registrySha256:digest,sourcePayloads:pin.files.length,disposition:row.disposition});}}));
results.sort((a,b)=>a.family.localeCompare(b.family));
const output={candidate:'e45e4eff037c6860c435ad0c3b2b1678df01c94a',checkedAt:new Date().toISOString(),upstreamCommit:matrix.upstreamCommit,indexEntries:index.length,uiFamilies:ui.length,sourcePayloads:results.reduce((n,x)=>n+x.sourcePayloads,0),results};
writeFileSync('docs/studio/cycle-1-4/independent-provenance.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({pass:true,indexEntries:output.indexEntries,uiFamilies:output.uiFamilies,sourcePayloads:output.sourcePayloads}));
