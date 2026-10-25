import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const pair=process.argv[2];assert(['dashboard','editor'].includes(pair));
const root=fileURLToPath(new URL('./core/browser/',import.meta.url));
const prefix=`provider-${pair}-`,read=name=>JSON.parse(readFileSync(root+prefix+name,'utf8'));
const start=read('run-start.json'),initial={candidate:read('candidate-initial-source.json'),baseline:read('baseline-initial-source.json')};
const initialIds={candidate:initial.candidate.id,baseline:initial.baseline.id};delete initial.candidate.id;delete initial.baseline.id;assert.deepEqual(initial.candidate,initial.baseline);
assert.deepEqual(start.candidateDisplay,start.baselineDisplay);
const arms={};
for(const arm of ['candidate','baseline']){
 const complete=`${arm}-expanded-trace-complete.dom.txt`,ordinary=`${arm}-expanded-trace.dom.txt`;
 const traceName=existsSync(root+prefix+complete)?complete:ordinary;
 const trace=readFileSync(root+prefix+traceName,'utf8'),details=readFileSync(root+prefix+`${arm}-details-01.dom.txt`,'utf8');
 const records=trace.split('\n').filter(line=>/^\s*- generic: /.test(line)).map(line=>line.replace(/^\s*- generic: /,'')).map(value=>{try{return JSON.parse(value)}catch{return value}}).filter(value=>typeof value==='string');
 const starts=records.filter(value=>value.startsWith('tool-start '));
 const commits=records.filter(value=>value.startsWith('committed studio_screen_edit ')).map(value=>({elapsedMs:Number(value.split(' ')[2]),...JSON.parse(value.slice(value.indexOf('{')))}));
 const observations=records.filter(value=>value.startsWith('observation studio_screen_observe ')).map(value=>{const result=JSON.parse(value.slice(value.indexOf('{')));return {receiptMs:Number(value.split(' ')[2]),revision:result.metadata.cursor.revision,image:result.metadata.image,viewport:result.metadata.viewport,capturedAt:result.metadata.capturedAt,model:result.model,interactionVerified:result.interactionVerified,ok:result.ok};});
 const m=details.match(/paragraph: (\d+) tool calls · (\d+) refused · (\d+) calls after refusal · ([\d.]+) s elapsed/);
 const q=details.match(/paragraph: (\d+) authoring model requests · (\d+) image requests\. First confirmed edit ([\d.]+) s/);
 const u=details.match(/Reported authoring usage: (\d+) input \/ (\d+) output tokens/);assert(m&&q&&u);
 assert.equal(starts.length,Number(m[1]));assert.equal(new Set(commits.map(value=>value.proposalId)).size,commits.length);
 assert.deepEqual(commits.map(value=>value.applied),Array.from({length:commits.length},(_,index)=>index+1));
 assert(Math.abs(Number(q[3])*1000-commits[0].elapsedMs)<100);
 const calls={};for(const value of starts){const name=value.split(' ')[1];calls[name]=(calls[name]??0)+1;}
 const readReceipts=records.filter(value=>/^(observation|validation-refused|tool-failed) studio_screen_read /.test(value));
 const sections=readReceipts.map(value=>value.match(/"section":"([^"]+)"/)?.[1]);assert.equal(sections.length,calls.studio_screen_read);assert(sections.every(Boolean));
 const knowledge=new Set(['families','catalog','contracts','elements','palette','component']);
 const categories={knowledge:sections.filter(section=>knowledge.has(section)).length,source:sections.filter(section=>!knowledge.has(section)).length,edit:calls.studio_screen_edit,observe:calls.studio_screen_observe};
 for(const observation of observations){assert.equal(observation.ok,true);assert.equal(observation.model,start.model);assert.equal(observation.interactionVerified,false);assert(Math.abs(observation.viewport.devicePixelRatio-start.candidateDisplay.dpr)<0.000001);}
 if(arm==='candidate'){
  const receipt=details.match(/paragraph: (\d+) receipt-derived edits including cleanup/);assert(receipt);assert.equal(Number(receipt[1]),commits.length);
  const displayed=details.match(/paragraph: (\d+) knowledge reads · (\d+) source reads · (\d+) edit calls · (\d+) observation calls/);assert(displayed);assert.deepEqual(displayed.slice(1).map(Number),Object.values(categories));
 }
 arms[arm]={traceArtifact:prefix+traceName,toolCalls:Number(m[1]),refused:Number(m[2]),elapsedSeconds:Number(m[4]),authoringRequests:Number(q[1]),imageRequests:Number(q[2]),firstEditSeconds:Number(q[3]),usage:{input:Number(u[1]),output:Number(u[2])},calls,independentlyInferredCategories:categories,refusedReadCalls:readReceipts.filter(value=>!value.startsWith('observation ')).length,categoryLimit:'Categories include refused reads with visible section identity. Baseline categories are inferred from actual response sections with current rule; they are not native baseline telemetry.',uniqueProposalCount:commits.length,committedRevisions:commits.map(value=>value.revision),observations,finalSourceNodes:Object.keys(read(`${arm}-final-source.json`).nodes).length};
}
if(pair==='dashboard'){assert.equal(arms.candidate.uniqueProposalCount,11);assert.equal(arms.baseline.uniqueProposalCount,11);assert.equal(arms.candidate.observations[0].revision,'r1#2');assert.equal(arms.baseline.observations[0].revision,'r1#3');}
const names=readdirSync(root).filter(name=>name.startsWith(prefix)).sort();
const output={pair,product:start.candidateProduct,baselineProduct:start.baselineProduct,model:start.model,method:'Root actual CUA natural-provider execution; independent initial-source equality, matching captured display, unique proposal/actual tool-start/category/measurement/region reconciliation. Independent screenshots reviewed separately.',initialIds,initialSourceEqualExceptDocumentId:true,matchedDisplay:start.candidateDisplay,arms,limits:['One run per arm with overlapping provider load/model/source-identity confounders; no statistical speedup/cost claim.','Failed observe attempts are real calls; only successful bounded image receipts establish stated regions.','Provider image interactionVerified=false; actual separate local interactions are recorded with their binding/effect limits.','Source/region/actual runtime evidence remain distinct.','Editor/recovery legs are not inferred from dashboard completion.'],artifacts:names.map(name=>({name,sha256:createHash('sha256').update(readFileSync(root+name)).digest('hex')}))};
writeFileSync(`docs/studio/cycle-1-4/independent-provider-${pair}-review.json`,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({pass:true,pair,matchedDisplay:true,candidateTransactions:arms.candidate.uniqueProposalCount,baselineTransactions:arms.baseline.uniqueProposalCount,artifacts:names.length}));
