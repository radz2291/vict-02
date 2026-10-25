import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./core/browser/',import.meta.url));
const read=name=>JSON.parse(readFileSync(root+name,'utf8'));
const initial={candidate:read('provider-form-candidate-initial-source.json'),baseline:read('provider-form-baseline-initial-source.json')};
const initialIds={candidate:initial.candidate.id,baseline:initial.baseline.id};
delete initial.candidate.id;delete initial.baseline.id;assert.deepEqual(initial.candidate,initial.baseline);
const arms={};
for(const arm of ['candidate','baseline']){
 const details=readFileSync(root+`provider-form-${arm}-details-01.dom.txt`,'utf8');
 const trace=readFileSync(root+`provider-form-${arm}-expanded-trace.dom.txt`,'utf8');
 const records=trace.split('\n').filter(line=>/^\s*- generic: /.test(line)).map(line=>line.replace(/^\s*- generic: /,'')).map(value=>{try{return JSON.parse(value)}catch{return value}}).filter(value=>typeof value==='string');
 const starts=records.filter(value=>value.startsWith('tool-start '));
 const commits=records.filter(value=>value.startsWith('committed studio_screen_edit ')).map(value=>({elapsedMs:Number(value.split(' ')[2]),...JSON.parse(value.slice(value.indexOf('{')))}));
 const observations=records.filter(value=>value.startsWith('observation studio_screen_observe ')).map(value=>{const result=JSON.parse(value.slice(value.indexOf('{')));return {receiptMs:Number(value.split(' ')[2]),revision:result.metadata.cursor.revision,image:result.metadata.image,viewport:result.metadata.viewport,capturedAt:result.metadata.capturedAt,model:result.model,interactionVerified:result.interactionVerified,ok:result.ok};});
 const measurement=details.match(/paragraph: (\d+) tool calls · (\d+) refused · (\d+) calls after refusal · ([\d.]+) s elapsed/);
 const requests=details.match(/paragraph: (\d+) authoring model requests · (\d+) image requests\. First confirmed edit ([\d.]+) s/);
 const usage=details.match(/Reported authoring usage: (\d+) input \/ (\d+) output tokens/);
 assert(measurement&&requests&&usage);assert.equal(starts.length,Number(measurement[1]));assert.equal(new Set(commits.map(value=>value.proposalId)).size,commits.length);
 assert.deepEqual(commits.map(value=>value.applied),Array.from({length:commits.length},(_,index)=>index+1));
 assert(Math.abs(Number(requests[3])*1000-commits[0].elapsedMs)<100);
 const calls={};for(const start of starts){const name=start.split(' ')[1];calls[name]=(calls[name]??0)+1;}
 const sections=records.filter(value=>value.startsWith('observation studio_screen_read ')).map(value=>value.match(/"section":"([^"]+)"/)?.[1]);assert.equal(sections.length,calls.studio_screen_read);assert(sections.every(Boolean));
 const knowledgeSections=new Set(['families','catalog','contracts','elements','palette','component']);
 const inferredReadCategories={knowledge:sections.filter(section=>knowledgeSections.has(section)).length,source:sections.filter(section=>!knowledgeSections.has(section)).length,method:'Independent classification of visible response sections using9fbreadCategory rule; baseline has no native category telemetry.'};
 assert.equal(calls.studio_screen_edit-commits.length,Number(measurement[2]));
 assert.equal(observations.length,3);for(const observation of observations){assert.equal(observation.ok,true);assert.equal(observation.model,'zai/glm-5.3-flash');assert.equal(observation.interactionVerified,false);}
 const settled=readFileSync(root+`provider-form-${arm}-exercised-02-settled.dom.txt`,'utf8');assert(settled.includes('Simulated submission:'));assert(settled.includes('Morgan Vale'));assert(settled.includes('textbox "Work email"'));
 arms[arm]={toolCalls:Number(measurement[1]),refused:Number(measurement[2]),elapsedSeconds:Number(measurement[4]),authoringRequests:Number(requests[1]),imageRequests:Number(requests[2]),firstEditSeconds:Number(requests[3]),usage:{input:Number(usage[1]),output:Number(usage[2])},calls,inferredReadCategories,uniqueProposalCount:commits.length,committedRevisions:commits.map(value=>value.revision),observations,localRuntimeExercisedSeparately:true};
}
assert.equal(arms.candidate.uniqueProposalCount,9);assert.equal(arms.baseline.uniqueProposalCount,7);
assert.equal(arms.candidate.inferredReadCategories.knowledge,6);assert.equal(arms.baseline.inferredReadCategories.knowledge,8);
assert.equal(arms.candidate.observations[0].revision,'r1#1');assert.equal(arms.baseline.observations[0].revision,'r1#5');
const names=readdirSync(root).filter(name=>name.startsWith('provider-form-')).sort();
const output={product:'4c76fb6da023c925825e511bfa7c9985aa662b5e',baselineProduct:'57308f6ffcd5c85415b38d9d68a6f696199ebfa7',method:'Root actual CUA provider execution and runtime exercise; independent complete starting-source equality, unique committed receipts, actual tool-start/measurements/region reconciliation and settled screenshot review.',initialIds,startingSourceEqualExceptDocumentId:true,arms,assessment:'Candidate used fewer tool/read calls and reviewed the first source section earlier in this one paired case, but took longer, reached its first edit later, incurred more refusals and reported higher token usage. No latency/token speedup claim.',limits:['One case per arm with provider/model/load/order/source-identity confounders, not a statistical improvement.','Form captured DPR differs baseline1.25versus candidate approximately1.0; same frame dimensions do not erase this confounder.','Final candidate observation is cropped909x569within909x612; no offscreen or current-runtime proof from that image.','Baseline final role is a free-text field; candidate uses native select. Output semantics/quality are not identical.','Large knowledge-read receipt bodies are deliberately truncated by bounded UI trace; failed full-JSON exploration retained as extraction limitation, not a complete-body/cache proof.','Email input values are omitted from accessibility DOM; actual settled screenshots separately show typed email, correcting the initial helper DOM-value assertion.','Provider image receipts explicitly state interactionVerified=false; actual CUA settled exercise is separate.','Dashboard/editor/recovery legs and new9fbshared renderer actual recheck remain pending.'],artifacts:names.map(name=>({name,sha256:createHash('sha256').update(readFileSync(root+name)).digest('hex')}))};
writeFileSync('docs/studio/cycle-1-4/independent-provider-form-review.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({pass:true,startingSourceEqualExceptId:true,candidateUniqueTransactions:9,baselineUniqueTransactions:7,artifacts:names.length}));
