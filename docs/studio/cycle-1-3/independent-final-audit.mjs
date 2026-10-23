import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const dir='docs/studio/cycle-1-3/', product='e6fa5f976b71150d8c334d4a2bd973fd4a653012';
const json=async path=>JSON.parse(await readFile(dir+path,'utf8'));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const manifest=await json('production-manifest.json'), mismatches=[];
for(const f of manifest.files){const actual=createHash('sha256').update(await readFile(f.path)).digest('hex');if(actual!==f.sha256)mismatches.push({path:f.path,expected:f.sha256,actual});}
const changedSinceProduct=git('diff','--name-only',product,'HEAD').split('\n').filter(Boolean);
const flow=await json('designer-browser-2026-10-23T09-01-10-091Z/results.json');
const packed=await json('package-browser-final/package-browser.json');
const composer=await json('production-composer-final/production-composer.json');
const real=await json('independent-real-provider.json'), transport=real.records.find(r=>r.name==='real provider transport and acknowledgements').data;
const events=transport.turns[0].events, proposals=events.filter(e=>e.type==='proposal').map(e=>e.proposal);
const provider={checkoutHead:real.candidate,mode:real.mode,started:events.find(e=>e.type==='started'),done:events.find(e=>e.type==='done'),retainedRefusals:events.filter(e=>e.type==='edit-result'&&!e.result.ok),receipts:transport.acks.map(a=>({proposalId:a.proposalId,ok:a.receipt.ok,digestMatches:proposals.find(p=>p.proposalId===a.proposalId)?.resultDigest===a.receipt.digest})),assertions:real.records.filter(r=>typeof r.data.pass==='boolean').map(r=>({name:r.name,pass:r.data.pass})),errors:real.errors};
const result={product,checkoutHead:git('rev-parse','HEAD'),at:new Date().toISOString(),manifest:{candidate:manifest.candidate,count:manifest.files.length,mismatches},changedSinceProduct,productUnchanged:changedSinceProduct.every(p=>p.startsWith('docs/')),flow:{candidate:flow.candidate,assertions:flow.records.filter(r=>typeof r.data?.ok==='boolean').map(r=>({name:r.name,pass:r.data.ok})),failures:flow.records.filter(r=>r.name.includes('FAILED')),completion:flow.records.find(r=>r.name==='Journey complete')},packed:{completed:packed.completed,assertions:packed.records.filter(r=>r.status==='PASS'||r.status==='FAIL').map(r=>({name:r.name,pass:r.status==='PASS'}))},composer:{mode:composer.mode,assertions:composer.results.map(r=>({name:r.name,pass:r.pass,failure:r.failure}))}};
result.provider=provider;
result.pass=manifest.candidate===product&&mismatches.length===0&&result.productUnchanged&&result.flow.failures.length===0&&!!result.flow.completion&&result.flow.assertions.every(r=>r.pass)&&packed.completed&&result.packed.assertions.every(r=>r.pass)&&result.composer.assertions.every(r=>r.pass)&&provider.done.status==='completed'&&provider.receipts.length===3&&provider.receipts.every(r=>r.ok&&r.digestMatches)&&provider.assertions.every(r=>r.pass)&&provider.errors.length===0;
await writeFile(dir+'independent-final-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;
