// Independent host-seam probes; credentials and external configuration are not read.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {boundedProviderModel} from '../../../apps/studio/src/lib/server/designer-model.js';
const results:unknown[]=[];
async function collect(model:any,controller=new AbortController(),deadline=Date.now()+500){let failures=0;const wrapped=boundedProviderModel(model,controller.signal,deadline,()=>failures++);const {stream}=await wrapped.doStream({});const chunks:any[]=[];const reader=stream.getReader();for(;;){const next=await reader.read();if(next.done)break;chunks.push(next.value)}return{chunks,failures}}
for(const kind of ['throw','error-chunk','stream-reject','hung-promise','hung-stream','pre-aborted']){
 const controller=new AbortController();if(kind==='pre-aborted')controller.abort();let signal:AbortSignal|undefined;const start=Date.now();
 const model={doStream:async(options:any)=>{
  signal=options.abortSignal;
  if(kind==='throw')throw Error('SECRET_FAILURE_CANARY');
  if(kind==='hung-promise')return new Promise(()=>{});
  return {stream:new ReadableStream({start(c){
   if(kind==='stream-reject')c.error(Error('SECRET_FAILURE_CANARY'));
   else if(kind==='error-chunk'){
    c.enqueue({type:'stream-start',warnings:[]});
    c.enqueue({type:'error',error:Error('SECRET_FAILURE_CANARY')});
   }
  }})};
 }};
 const got=await collect(model,controller,Date.now()+80);assert.equal(got.failures,1);assert.equal(got.chunks[0].type,'stream-start');assert.equal(got.chunks.at(-1).type,'error');assert.ok(!JSON.stringify(got.chunks).includes('SECRET_FAILURE_CANARY'));assert.ok(Date.now()-start<2000);if(signal)assert.ok(signal.aborted);results.push({kind,pass:true,elapsedMs:Date.now()-start,types:got.chunks.map(c=>c.type),safeCode:got.chunks.at(-1).error.message});
}
const valid=[{type:'stream-start',warnings:[]},{type:'text-start',id:'a'},{type:'text-delta',id:'a',delta:'safe visible response'},{type:'text-end',id:'a'},{type:'finish',finishReason:'stop',usage:{inputTokens:1,outputTokens:1}}];
const forwarded=await collect({doStream:async()=>({stream:new ReadableStream({start(c){valid.forEach(v=>c.enqueue(v));c.close()}})})});assert.deepEqual(forwarded.chunks,valid);assert.equal(forwarded.failures,0);results.push({kind:'valid-chunks-preserved',pass:true});
let cancelled=false;const controller=new AbortController();const model=boundedProviderModel({doStream:async(options:any)=>{options.abortSignal.addEventListener('abort',()=>cancelled=true);return{stream:new ReadableStream({start(c){c.enqueue({type:'stream-start',warnings:[]})}})}}},controller.signal,Date.now()+500);const {stream}=await model.doStream({});const reader=stream.getReader();await reader.read();await reader.cancel();assert.ok(cancelled);results.push({kind:'consumer-cancel-aborts-provider',pass:true});
writeFileSync(new URL('./model-probes.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
