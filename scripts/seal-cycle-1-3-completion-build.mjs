/** Tie a local review build to committed inputs, without exposing provider configuration. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
const root=process.cwd(), mode=process.argv[2];
if(!['prepare','seal'].includes(mode))throw Error('Use prepare immediately before the Studio build, then seal after it succeeds.');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const sha=git(['rev-parse','HEAD']);
const paths=['apps/studio/src','apps/studio/scripts','apps/studio/package.json','packages','examples/studio-ui-consumer/src','package.json','package-lock.json'];
if(git(['diff','HEAD','--name-only','--',...paths])||git(['ls-files','--others','--exclude-standard','--',...paths]))throw Error('Commit production inputs before sealing.');
const hash=path=>createHash('sha256').update(readFileSync(join(root,path))).digest('hex');
const sources=git(['ls-files','--',...paths]).split('\n').filter(Boolean).map(path=>({path,sha256:hash(path)}));
const output='docs/studio/cycle-1-3/completion-build-seal.json';
if(mode==='prepare'){
 writeFileSync(output,JSON.stringify({productSha:sha,preparedAt:new Date().toISOString(),node:process.version,sources},null,2));
 console.log(`Prepared ${sources.length} committed input hashes at ${sha}.`);
}else{
 const before=JSON.parse(readFileSync(output,'utf8'));
 git(['merge-base','--is-ancestor',before.productSha,sha]);
 if(JSON.stringify(before.sources)!==JSON.stringify(sources))throw Error('Build inputs changed; rebuild before sealing.');
 const walk=path=>readdirSync(join(root,path),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(path,entry.name)):[join(path,entry.name)]);
 const outputs=walk('apps/studio/build').map(path=>({path:relative('.',path).replaceAll('\\','/'),sha256:hash(path)}));
 writeFileSync(output,JSON.stringify({...before,evidenceHead:sha,sealedAt:new Date().toISOString(),outputs},null,2));
 console.log(`Sealed ${outputs.length} local build files at product ${before.productSha} (current evidence HEAD ${sha}). This records a local build, not a deployment.`);
}
