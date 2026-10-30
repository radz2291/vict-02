import { describe,it,expect } from 'vitest';
import { EditorBridge } from '@victframework/ui-editor';
import { createDeterministicOfflineModel } from '@victframework/mastra';
import { newScreen,designerCatalogs } from '../src/lib/designer/application.js';
import { screenStore } from '../src/lib/designer/storage.js';
import { agentContext,applyAgentProposal,documentCursor } from '../src/lib/designer/agent-edits.js';
import { validateAgentStart,openAgentRun,acknowledgeAgentEdit,type StudioAgentEvent } from '../src/lib/server/designer-agent.js';
import { createVisualObserver,acceptVisualCapture } from '../src/lib/server/designer-visual.js';
const quota=()=>({statusCode:429,responseBody:JSON.stringify({error:{code:'1310',message:'Weekly usage limit. Resets at 2026-10-28T00:00:00Z RAW_SECRET_CANARY'}}),responseHeaders:{'retry-after':'60',authorization:'CREDENTIAL_CANARY'},requestBodyValues:{password:'CREDENTIAL_CANARY'}});
describe('provider limit facts across real offline boundaries',()=>{
  it('preserves an acknowledged canonical edit when the next model request hits quota',async()=>{
    const source=newScreen('Quota after edit','quota-after-edit');const values=new Map<string,string>();const epoch=crypto.randomUUID();
    const bridge=new EditorBridge({catalogs:designerCatalogs,store:screenStore({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},source.id),initial:{document:source,storedRevision:'r1'}});
    const cursor=documentCursor(bridge.document,bridge.getSnapshot().revision,epoch);const checked=validateAgentStart({document:bridge.document,cursor,prompt:'Add a heading',history:[]});if(!checked.ok)throw Error(checked.message);
    const input=JSON.stringify({request:checked.value.prompt,untrusted_history:[],untrusted_screen:agentContext(bridge.document,cursor)});
    const model=createDeterministicOfflineModel({script:{[input]:{kind:'tool-chain',calls:[{toolName:'studio_screen_edit',args:{expectedRevision:cursor.revision,reason:'Retained committed heading',operations:[{op:'add',recipe:'heading',nodeId:'kept-heading',parentId:'screen',text:'Keep this edit'}]}}],thenText:'Should not reach after quota.'}}});
    let calls=0;const original=model.doStream.bind(model);model.doStream=async options=>{if(++calls>1)throw quota();return original(options);};
    const owner=`quota-${crypto.randomUUID()}`;let runId='';const events:StudioAgentEvent[]=[];
    const opened=openAgentRun(owner,checked.value,event=>{events.push(event);if(event.type==='started')runId=event.runId;if(event.type==='proposal')expect(acknowledgeAgentEdit(owner,runId,event.proposal.proposalId,applyAgentProposal(bridge,event.proposal,epoch,false))).toBe(true);},{model:'zai/glm-5.3-flash',modelFactory:()=>model});if(!opened.ok)throw Error(opened.code);await opened.finished;
    expect(calls).toBe(2);expect(bridge.document.nodes['kept-heading']).toBeDefined();expect(events.at(-1)).toMatchObject({type:'done',status:'failed',code:'STUDIO_AGENT_PROVIDER_QUOTA',applied:1,providerLimit:{kind:'quota',providerCode:'1310',retryAfterSeconds:60}});expect(JSON.stringify(events)).not.toContain('CANARY');
  },120_000);
  it('preserves safe quota timing through the image observer instead of returning a generic model failure',async()=>{
    const owner='visual-limit-owner';const cursor={documentId:'visual',revision:'r1',digest:'digest',epoch:crypto.randomUUID()};let calls=0;
    const bytes=new Uint8Array([0xff,0xd8,0xff,0xc0,0,11,8,0,1,0,1,1,1,0x11,0,0xff,0xd9]);
    const observer=createVisualObserver({owner,runId:'visual-limit-run',model:'zai/glm-5.3-flash',getCursor:()=>cursor,signal:new AbortController().signal,modelFactory:()=>({doStream:async()=>{calls++;throw quota();}}),emit:event=>{expect(acceptVisualCapture(owner,event.captureId,{cursor,capturedAt:new Date().toISOString(),viewport:{width:1,height:1,scrollLeft:0,scrollTop:0,devicePixelRatio:1},image:{width:1,height:1,sourceWidth:1,sourceHeight:1,offsetLeft:0,offsetTop:0,cropped:false},preview:{mode:'design',fingerprint:'a'.repeat(64)}},bytes)).toMatchObject({ok:true});}});
    try{const result=await observer.capability.invoke({focus:'Inspect appearance'},{} as never);expect(calls).toBe(1);expect(result).toMatchObject({ok:false,code:'STUDIO_AGENT_PROVIDER_QUOTA',providerLimit:{kind:'quota',providerCode:'1310',retryAfterSeconds:60}});expect(JSON.stringify(result)).not.toContain('CANARY');}finally{observer.dispose();}
  });
});
