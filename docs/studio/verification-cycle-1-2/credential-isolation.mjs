// Read only the owner-authorized selected key; never print or copy its value.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url));const root=resolve(out,'../../..');
const key=JSON.parse(await readFile('C:/Users/RZ1/.pi/agent/auth.json','utf8')).zai?.key;
if(typeof key!=='string'||!key.trim())throw Error('Selected credential unavailable');
async function files(dir){const found=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,entry.name);if(entry.isDirectory())found.push(...await files(p));else if(/\.(js|map|html|css|json|log|md|ts|mjs)$/.test(entry.name))found.push(p)}return found}
const client=await files(resolve(root,'apps/studio/build/client')),evidence=await files(out);const hits=[];for(const file of [...client,...evidence])if((await readFile(file)).includes(Buffer.from(key)))hits.push(file.replace(root+'/',''));
const serverMarkers=['createDedicatedMastraStore','STUDIO_AGENT_AUTH_FILE','STUDIO_AGENT_MODELS_FILE','@mastra/libsql'];const markerHits=[];for(const file of client){const text=await readFile(file,'utf8');for(const marker of serverMarkers)if(text.includes(marker))markerHits.push({file:file.replace(root+'/',''),marker})}
const result={clientFiles:client.length,evidenceFiles:evidence.length,actualSelectedCredentialMatches:hits.length,serverOnlyMarkerMatches:markerHits,pass:hits.length===0&&markerHits.length===0};await writeFile(resolve(out,'credential-isolation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;

