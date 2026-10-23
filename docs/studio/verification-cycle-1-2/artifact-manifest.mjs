import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url)),root=resolve(out,'../../..'),build=resolve(root,'apps/studio/build');
const producingCommit=process.argv[2];
if(!/^[a-f0-9]{40}$/.test(producingCommit??''))throw Error('Pass the full producing candidate SHA');
async function files(dir){const found=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,entry.name);if(entry.isDirectory())found.push(...await files(p));else found.push(p)}return found.sort()}
const hashes=[],runtimePathFindings=[];for(const path of await files(build)){const bytes=await readFile(path);hashes.push({path:relative(build,path).split(sep).join('/'),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
 if(!path.endsWith('.js'))continue;const text=bytes.toString('utf8');for(const match of text.matchAll(/\b(?:from\s*|import\s*\(\s*|require\s*\(\s*)(['"])([^'"]+)\1/g)){const specifier=match[2];if(/^(?:file:|[A-Za-z]:[\\/])/.test(specifier)||(specifier.startsWith('.')&&!resolve(dirname(path),specifier).startsWith(build+sep)))runtimePathFindings.push({path:relative(build,path),specifier});}
}
const manifest={producingCommit,buildDirectory:build,files:hashes,runtimePathFindings,relocatableRuntimeImports:runtimePathFindings.length===0};await writeFile(resolve(out,'artifact-manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({producingCommit,buildDirectory:build,files:hashes.length,relocatableRuntimeImports:manifest.relocatableRuntimeImports,runtimePathFindings}));if(runtimePathFindings.length)process.exitCode=1;

