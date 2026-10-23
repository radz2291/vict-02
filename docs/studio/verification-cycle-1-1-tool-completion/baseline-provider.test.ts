import { it, expect } from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {EditorBridge} from '@victframework/ui-editor';
import {newScreen,designerCatalogs} from '../../../apps/studio/src/lib/designer/application.js';
import {screenStore} from '../../../apps/studio/src/lib/designer/storage.js';
import {documentCursor,applyAgentProposal} from '../../../apps/studio/src/lib/designer/agent-edits.js';
import {openAgentRun,acknowledgeAgentEdit,validateAgentStart} from '../../../apps/studio/src/lib/server/designer-agent.js';
import {studioProviderModel} from '../../../apps/studio/src/lib/server/designer-model.js';
const out=resolve('../../docs/studio/verification-cycle-1-1-tool-completion');
it('independent uncoached exact owner plain prompt against baseline real provider',async()=>{
 const auth=JSON.parse(readFileSync(process.env.STUDIO_AGENT_AUTH_FILE!,'utf8'));
 const models=JSON.parse(readFileSync(process.env.STUDIO_AGENT_MODELS_FILE!,'utf8'));
 process.env.ZAI_API_KEY=auth.zai.key;
 process.env.STUDIO_AGENT_MODEL='zai/glm-5.3-flash';
 const baseUrl=models.providers['zai-key1'].baseUrl;
 const values=new Map<string,string>();
 const document=newScreen('Quellight','independent-plain-quellight');
 const bridge=new EditorBridge({catalogs:designerCatalogs,store:screenStore({getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v)}},document.id),initial:{document,storedRevision:'r1'}});
 const epoch=crypto.randomUUID();const cursor=documentCursor(document,bridge.getSnapshot().revision,epoch);
 const prompt='Pls create a landing page for an Ai platform like chatgpt, called Quellight.';
 const start=validateAgentStart({document,cursor,prompt,history:[]});if(!start.ok)throw Error(start.message);
 const trace:any={candidate:'9f834ccfa0f0b7b744c22c895cc995d64a3b2bac',product:'4700689bf985c83cd3f944ad4cd324f2bfe8d724',prompt,startedAt:new Date().toISOString(),calls:[],events:[]};
 let runId='';const persist=()=>writeFileSync(resolve(out,'baseline-provider-trace.json'),JSON.stringify(trace,null,2));
 const opened=openAgentRun('independent-tool-completion-baseline',start.value,e=>{trace.events.push(e);if(e.type==='started')runId=e.runId;if(e.type==='proposal')acknowledgeAgentEdit('independent-tool-completion-baseline',runId,e.proposal.proposalId,applyAgentProposal(bridge,e.proposal,epoch,false));persist()}, {model:'zai/glm-5.3-flash',modelFactory:()=>{
  const model:any=studioProviderModel('zai/glm-5.3-flash',baseUrl);const original=model.doStream.bind(model);
  Object.defineProperty(model,'doStream',{configurable:true,writable:true,value:async(options:any)=>{
   const call:any={at:new Date().toISOString(),maxOutputTokens:options.maxOutputTokens,parts:[],reasoningCharacters:0,textCharacters:0,toolInputs:{}};trace.calls.push(call);persist();
   const result=await original(options);
   return {...result,stream:result.stream.pipeThrough(new TransformStream({transform(part:any,controller){
    const item:any={type:part.type};
    if(part.type==='finish'){item.finishReason=part.finishReason;item.usage=part.usage;}
    if(part.type.startsWith('tool')){item.toolCallId=part.toolCallId??part.id;item.toolName=part.toolName;if(typeof part.input==='string'){item.inputLength=part.input.length;try{JSON.parse(part.input);item.validJSON=true}catch{item.validJSON=false}call.toolInputs[item.toolCallId??'unknown']={length:part.input.length,validJSON:item.validJSON};}if(typeof part.delta==='string'){item.deltaLength=part.delta.length;} }
    if(part.type.startsWith('reasoning')&&typeof part.delta==='string')call.reasoningCharacters+=part.delta.length;
    if(part.type==='text-delta'&&typeof part.delta==='string')call.textCharacters+=part.delta.length;
    call.parts.push(item);persist();controller.enqueue(part);
   } }))};
  }});return model;
 }});
 if(!opened.ok)throw Error(opened.code);await opened.finished;
 trace.finishedAt=new Date().toISOString();trace.document=bridge.document;trace.final=trace.events.at(-1);persist();
 console.log(JSON.stringify({final:trace.final,calls:trace.calls.map((c:any)=>({maxOutputTokens:c.maxOutputTokens,reasoningCharacters:c.reasoningCharacters,textCharacters:c.textCharacters,toolInputs:c.toolInputs,finish:c.parts.filter((p:any)=>p.type==='finish')})),nodes:Object.keys(bridge.document.nodes).length}));
 expect(trace.final.type).toBe('done');
},240000);
