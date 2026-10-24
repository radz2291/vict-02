import {readFileSync,writeFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=process.cwd(),candidate='b10c37a538a16f52e6430dfb9fc1eb317fc03745';
const installation=JSON.parse(readFileSync(resolve(root,'docs/studio/cycle-1-3/core/consumer-a9b9fab/installation.json'),'utf8'));
const previous=JSON.parse(readFileSync(resolve(root,'docs/studio/cycle-1-3/core/consumer-a9b9fab/installed-byte-comparison.json'),'utf8'));
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const packages=previous.packages.map(pkg=>{
 const record=installation.packages.find(item=>item.name===pkg.name),name=pkg.name.split('/')[1];
 const files=pkg.files.map(file=>({path:file.path,equal:hash(resolve(record.installedPath,file.path))===hash(resolve(root,'packages',name,file.path))}));
 return {name:pkg.name,installedPath:record.installedPath,isLink:lstatSync(record.installedPath).isSymbolicLink(),tarballHashMatches:hash(record.tarball)===record.sha256,filesCompared:files.length,allEqual:files.every(file=>file.equal),mismatches:files.filter(file=>!file.equal)};
});
const fixtures=['App.svelte','proof.ts','main.ts','vite.config.ts','index.html'].map(path=>({path,equal:hash(resolve(installation.directory,path))===hash(resolve(root,'examples/studio-core-consumer',path))}));
const manifest=JSON.parse(readFileSync(resolve(installation.directory,'package.json'),'utf8'));
const tarballDependencies=Object.entries(manifest.dependencies).every(([name,value])=>!name.startsWith('@victframework/')||value.startsWith('file:artifacts/')&&value.endsWith('.tgz'));
const report={checkedAt:new Date().toISOString(),candidate,installationCandidate:installation.sourceCandidate,packages,filesCompared:packages.reduce((n,p)=>n+p.filesCompared,0),fixtures,tarballDependencies,passed:tarballDependencies&&packages.every(p=>!p.isLink&&p.tarballHashMatches&&p.allEqual)&&fixtures.every(f=>f.equal),boundary:'Read-only independent hash/link/fixture verification of existing separately installed tarballs; no install/build or Studio alias was used.'};
writeFileSync(resolve(root,'docs/studio/cycle-1-3/core/independent/consumer-provenance-b10c37a.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,packages:packages.length,files:report.filesCompared,fixtures:fixtures.length}));
if(!report.passed)process.exitCode=1;
