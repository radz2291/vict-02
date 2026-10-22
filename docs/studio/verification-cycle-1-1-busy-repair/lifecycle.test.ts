import {it,expect} from '../../../apps/studio/node_modules/vitest/dist/index.js';
import {createDeterministicOfflineModel,OFFLINE_MODEL_IDENTITY} from '@victframework/mastra';
import {EditorBridge} from '@victframework/ui-editor';
import {newScreen,designerCatalogs} from '../../../apps/studio/src/lib/designer/application.js';
import {screenStore} from '../../../apps/studio/src/lib/designer/storage.js';
import {documentCursor,agentContext} from '../../../apps/studio/src/lib/designer/agent-edits.js';
import {openAgentRun,cancelAgentRun,acknowledgeAgentEdit,validateAgentStart,type StudioAgentEvent} from '../../../apps/studio/src/lib/server/designer-agent.js';
function fixture(){const doc=newScreen('Busy independent','busy-independent');const bridge=new EditorBridge({catalogs:designerCatalogs,store:screenStore({getItem:()=>null,setItem:()=>{}},doc.id),initial:{document:doc,storedRevision:'r1'}});const cursor=documentCursor(doc,bridge.getSnapshot().revision,crypto.randomUUID());const start=validateAgentStart({prompt:'Independent lifecycle',document:doc,cursor,history:[]});if(!start.ok)throw Error(start.code);const input=JSON.stringify({request:start.value.prompt,untrusted_history:[],untrusted_screen:agentContext(doc,cursor)});const textOptions={model:OFFLINE_MODEL_IDENTITY,modelFactory:()=>createDeterministicOfflineModel({script:{[input]:{kind:'text' as const,text:'Completed.'}}})};return{bridge,start:start.value,input,textOptions}}
it('independent: a terminal cleanup slot counts toward global capacity while session admission is released',async()=>{
 const {start,textOptions}=fixture();const pending:Extract<ReturnType<typeof openAgentRun>,{ok:true}>[]=[];let activeBusy:any,capacity:any,replacement:any;
 const first=openAgentRun('capacity-terminal',start,event=>{
  if(event.type!=='done')return;
  // These three calls synchronously enter their first await, keeping all four
  // records present while the terminal predecessor has not begun cleanup yet.
  for(const owner of ['capacity-active-1','capacity-active-2','capacity-active-3']){const opened=openAgentRun(owner,start,()=>{},textOptions);expect(opened.ok).toBe(true);if(opened.ok)pending.push(opened)}
  activeBusy=openAgentRun('capacity-active-1',start,()=>{},textOptions);
  capacity=openAgentRun('capacity-terminal',start,()=>{},textOptions);
  for(let n=0;n<pending.length;n++)expect(cancelAgentRun('capacity-active-'+(n+1),pending[n].runId)).toBe(true);
 },textOptions);
 expect(first.ok).toBe(true);if(!first.ok)return;await first.finished;await Promise.all(pending.map(run=>run.finished));
 expect(activeBusy).toMatchObject({ok:false,code:'STUDIO_AGENT_BUSY'});expect(capacity).toMatchObject({ok:false,code:'STUDIO_AGENT_CAPACITY'});
 replacement=openAgentRun('capacity-terminal',start,()=>{},textOptions);expect(replacement.ok).toBe(true);if(replacement.ok)await replacement.finished;
},120000);
it('independent: cancelled proposal cannot accept a late success acknowledgement while immediate replacement runs',async()=>{
 const {start,input,bridge,textOptions}=fixture();const events:StudioAgentEvent[]=[];let id='',replacement:ReturnType<typeof openAgentRun>|undefined,lateAck:any;
 const options={model:OFFLINE_MODEL_IDENTITY,modelFactory:()=>createDeterministicOfflineModel({script:{[input]:{kind:'tool-call' as const,toolName:'studio_screen_edit',args:{expectedRevision:start.cursor.revision,reason:'Old forbidden edit',operations:[{op:'add',recipe:'heading',nodeId:'late-heading',parentId:'screen'}]},thenText:'Old work'}}})};
 const run=openAgentRun('late-ack-owner',start,event=>{events.push(event);if(event.type==='started')id=event.runId;if(event.type==='proposal'){expect(cancelAgentRun('late-ack-owner',id)).toBe(true);replacement=openAgentRun('late-ack-owner',start,()=>{},textOptions);lateAck=acknowledgeAgentEdit('late-ack-owner',id,event.proposal.proposalId,{ok:true,revision:'r1#999',digest:event.proposal.resultDigest})}},options);
 expect(run.ok).toBe(true);if(!run.ok)return;await run.finished;if(replacement?.ok)await replacement.finished;expect(replacement?.ok).toBe(true);expect(lateAck).toBe(false);expect(bridge.document.nodes['late-heading']).toBeUndefined();expect(events.at(-1)).toMatchObject({type:'done',status:'cancelled',applied:0});expect(events.filter(event=>event.type==='done')).toHaveLength(1);
},120000);
