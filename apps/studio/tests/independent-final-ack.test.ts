import {expect,it} from 'vitest';
import {createDeterministicOfflineModel,OFFLINE_MODEL_IDENTITY} from '@victframework/mastra';
import {EditorBridge} from '@victframework/ui-editor';
import {canonicalUiDocument} from '@victframework/ui';
import {newScreen,designerCatalogs} from '../src/lib/designer/application.js';
import {screenStore} from '../src/lib/designer/storage.js';
import {agentContext,documentCursor,applyAgentProposal} from '../src/lib/designer/agent-edits.js';
import {openAgentRun,validateAgentStart,type StudioAgentEvent} from '../src/lib/server/designer-agent.js';
import {POST} from '../src/routes/api/designer-agent/ack/+server.js';

it('independent: genuine browser canonical refusal reaches real owner/pending ACK without any source promotion',async()=>{
  const document=newScreen('Independent real ACK','independent-real-ack'),epoch=crypto.randomUUID(),values=new Map<string,string>();
  const bridge=new EditorBridge({catalogs:designerCatalogs,store:screenStore({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);}},document.id),initial:{document,storedRevision:'r1'}});
  const cursor=documentCursor(document,bridge.getSnapshot().revision,epoch),before=canonicalUiDocument(document).contentDigest;
  const parsed=validateAgentStart({document,cursor,prompt:'Independent ACK check',history:[]});
  if(!parsed.ok)throw Error(parsed.message);
  const input=JSON.stringify({request:parsed.value.prompt,untrusted_history:[],untrusted_screen:agentContext(document,cursor)});
  const model=createDeterministicOfflineModel({script:{[input]:{kind:'tool-chain',calls:[
    {toolName:'studio_screen_read',args:{}},
    {toolName:'studio_screen_edit',args:{expectedRevision:cursor.revision,reason:'Valid proposal for browser challenge',operations:[{op:'add',recipe:'heading',nodeId:'heading',parentId:'screen',text:'Valid heading'}]}},
  ],thenText:'No source success claim.'}}});
  const events:StudioAgentEvent[]=[];let runId='',checked=false;
  const opened=openAgentRun('independent-owner',parsed.value,async event=>{
    events.push(event);if(event.type==='started')runId=event.runId;
    if(event.type!=='proposal')return;
    // Adversarial browser-side transport alteration: the real public compiler
    // must refuse the unsupported attribute before any prepared source commit.
    const receipt=applyAgentProposal(bridge,{...event.proposal,edit:{...event.proposal.edit,operations:[{op:'insert',kind:'element',nodeId:'invalid',tag:'div',parentId:'screen',attributes:{class:'unsupported'}}]}},epoch,false);
    expect(receipt).toMatchObject({ok:false,code:'STUDIO_AGENT_VALIDATION',diagnostics:expect.arrayContaining([expect.objectContaining({code:'UI_DOC_UNKNOWN_ATTRIBUTE'})])});
    const ack=async(owner:string,value:unknown)=>POST({request:new Request('http://localhost/api/designer-agent/ack',{method:'POST',headers:{'content-type':'application/json','x-vict-csrf':'nonce'},body:JSON.stringify({runId,proposalId:event.proposal.proposalId,receipt:value})}),locals:{session:{sessionId:owner,csrfToken:'nonce',actorLabel:'Owner'}}} as never);
    expect((await ack('foreign-owner',receipt)).status).toBe(409);
    expect((await ack('independent-owner',{...receipt,privateReasoning:'must refuse'})).status).toBe(400);
    expect((await ack('independent-owner',receipt)).status).toBe(200);
    expect((await ack('independent-owner',receipt)).status).toBe(409);
    checked=true;
  },{modelFactory:()=>model,model:OFFLINE_MODEL_IDENTITY});
  if(!opened.ok)throw Error(opened.code);
  await opened.finished;
  expect(checked).toBe(true);expect(events.at(-1)).toMatchObject({type:'done',applied:0});
  expect(canonicalUiDocument(bridge.document).contentDigest).toBe(before);
  expect(bridge.document.nodes.heading).toBeUndefined();expect(bridge.document.nodes.invalid).toBeUndefined();
},120000);
