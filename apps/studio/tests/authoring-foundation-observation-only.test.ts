import { describe, expect, it, vi } from 'vitest';
import { createDeterministicOfflineModel, OFFLINE_MODEL_IDENTITY } from '@victframework/mastra';
import { newScreen } from '../src/lib/designer/application.js';
import { agentContext, documentCursor } from '../src/lib/designer/agent-edits.js';
import { openAgentRun, validateAgentStart, cancelAgentRun, type StudioAgentEvent } from '../src/lib/server/designer-agent.js';
import { acceptVisualCapture, refuseVisualCapture } from '../src/lib/server/designer-visual.js';
const jpeg=new Uint8Array([0xff,0xd8,0xff,0xc0,0,11,8,0,1,0,1,1,1,0x11,0,0xff,0xd9]);
function setup(){
  const document=newScreen('Observation-only','observation-only');const cursor=documentCursor(document,'r1#3',crypto.randomUUID());
  const target={nodeId:'screen',part:'root'};
  const checked=validateAgentStart({document,cursor,prompt:'Retry observation only',history:[],mode:'observe-only',observationTask:'Inspect the header gap after the earlier applied edits',observationTarget:target});if(!checked.ok)throw Error(checked.message);
  const input=JSON.stringify({request:checked.value.prompt,untrusted_history:[],untrusted_screen:agentContext(document,cursor),untrusted_observation_continuation:{mode:'observe-only',task:checked.value.observationTask,target,source:cursor,editsReplayed:false}});
  return {document,cursor,target,start:checked.value,input};
}
describe('enforced observation-only continuation',()=>{
  it('exposes only read/observe and observes the retained target with fresh binary evidence, without edit authority',async()=>{
    const {start,input,cursor,target}=setup();const owner=`observe-${crypto.randomUUID()}`;const before=JSON.stringify(start.document);const events:StudioAgentEvent[]=[];const toolLists:string[][]=[];
    const model=createDeterministicOfflineModel({script:{[input]:{kind:'tool-chain',calls:[{toolName:'studio_screen_read',args:{section:'source',nodeId:'screen'}},{toolName:'studio_screen_observe',args:{focus:'Header gap',nodeId:'unrelated',part:'wrong'}}],thenText:'The captured header appearance was inspected; interactions remain unverified.'}}});
    const original=model.doStream.bind(model);model.doStream=async options=>{toolLists.push((options as {tools?:{name?:string}[]}).tools?.flatMap(tool=>tool.name?[tool.name]:[])??[]);return original(options);};
    const visual=vi.fn(async()=>({stream:new ReadableStream({start(controller){controller.enqueue({type:'text-delta',delta:JSON.stringify({visibleFindings:['Synthetic offline image assessment.'],uncertainty:[],notEstablished:['No interaction evidence.']})});controller.enqueue({type:'finish'});controller.close();}})}));
    const opened=openAgentRun(owner,start,event=>{events.push(event);if(event.type==='capture-request'){
      expect(event.target).toEqual(target);
      const metadata={cursor,capturedAt:new Date().toISOString(),viewport:{width:1,height:1,scrollLeft:0,scrollTop:0,devicePixelRatio:1},image:{width:1,height:1,sourceWidth:1,sourceHeight:1,offsetLeft:0,offsetTop:0,cropped:false},preview:{mode:'design',fingerprint:'a'.repeat(64)}};
      expect(acceptVisualCapture(owner,event.captureId,metadata,jpeg)).toMatchObject({ok:true});
    }},{model:OFFLINE_MODEL_IDENTITY,modelFactory:()=>model,visualModelFactory:()=>({doStream:visual})});if(!opened.ok)throw Error(opened.code);await opened.finished;
    expect(toolLists.length).toBeGreaterThan(0);for(const tools of toolLists){expect(tools).toContain('studio_screen_read');expect(tools).toContain('studio_screen_observe');expect(tools).not.toContain('studio_screen_edit');}
    expect(visual).toHaveBeenCalledTimes(1);expect(events.filter(event=>event.type==='capture-request')).toHaveLength(2);expect(events.some(event=>event.type==='proposal'||event.type==='edit-result')).toBe(false);
    expect(events.at(-1)).toMatchObject({type:'done',status:'completed',applied:0,sourceEvidence:{appearanceObserved:true,interactionsVerified:false}});expect(JSON.stringify(start.document)).toBe(before);
  },120_000);
  it('refuses an adversarial edit request from the offline model with no proposal or source change',async()=>{
    const {start,input}=setup();const before=JSON.stringify(start.document);const events:StudioAgentEvent[]=[];
    const model=createDeterministicOfflineModel({script:{[input]:{kind:'tool-chain',calls:[{toolName:'studio_screen_edit',args:{expectedRevision:start.cursor.revision,reason:'Should not be exposed',operations:[{op:'remove',nodeId:'screen'}]}}],thenText:'Cannot edit in this continuation.'}}});
    const opened=openAgentRun(`adversarial-${crypto.randomUUID()}`,start,event=>events.push(event),{model:OFFLINE_MODEL_IDENTITY,modelFactory:()=>model});if(!opened.ok)throw Error(opened.code);await opened.finished;
    expect(events.some(event=>event.type==='proposal'||event.type==='edit-result')).toBe(false);expect(events.at(-1)).toMatchObject({type:'done',applied:0});expect(JSON.stringify(start.document)).toBe(before);
  },120_000);
  it('does not mark an observation-only turn complete when the model supplies prose without image evidence',async()=>{
    const {start,input}=setup();const events:StudioAgentEvent[]=[];
    const model=createDeterministicOfflineModel({script:{[input]:{kind:'text',text:'The source has no margin; it must look fine.'}}});
    const opened=openAgentRun(`unobserved-${crypto.randomUUID()}`,start,event=>events.push(event),{model:OFFLINE_MODEL_IDENTITY,modelFactory:()=>model});if(!opened.ok)throw Error(opened.code);await opened.finished;
    expect(events.at(-1)).toMatchObject({type:'done',status:'failed',code:'STUDIO_CAPTURE_OBSERVATION_REQUIRED',applied:0,termination:{status:'completed'},sourceEvidence:{appearanceObserved:false}});
    expect(events.filter(event=>event.type==='text').map(event=>event.delta).join('')).toContain('The source has no margin');expect(events.some(event=>event.type==='proposal')).toBe(false);
  },120_000);
  it('keeps Stop and session-bound stale capture refusal effective',async()=>{
    const {start,input}=setup();const owner=`stopped-${crypto.randomUUID()}`;const events:StudioAgentEvent[]=[];let captureId='';
    const model=createDeterministicOfflineModel({script:{[input]:{kind:'tool-chain',calls:[{toolName:'studio_screen_observe',args:{focus:'Header'}}],thenText:'Do not reach after stop.'}}});
    const opened=openAgentRun(owner,start,event=>{events.push(event);if(event.type==='capture-request'){captureId=event.captureId;expect(refuseVisualCapture('another-session',captureId,'STUDIO_CAPTURE_STALE')).toBe(false);cancelAgentRun(owner,events.find(item=>item.type==='started')!.runId);}},{model:OFFLINE_MODEL_IDENTITY,modelFactory:()=>model,visualModelFactory:()=>({doStream:vi.fn()})});if(!opened.ok)throw Error(opened.code);await opened.finished;
    expect(captureId).not.toBe('');expect(events.at(-1)).toMatchObject({type:'done',status:'cancelled',applied:0});expect(refuseVisualCapture(owner,captureId,'STUDIO_CAPTURE_STALE')).toBe(false);expect(events.some(event=>event.type==='proposal')).toBe(false);
  },120_000);
  it('rejects stale source, hidden preview, missing target and observation fields outside their explicit mode',()=>{
    const {start}=setup();expect(validateAgentStart({...start,mode:undefined})).toMatchObject({ok:false,code:'STUDIO_AGENT_REQUEST'});
    expect(validateAgentStart({...start,cursor:{...start.cursor,digest:'stale'}})).toMatchObject({ok:false,code:'UI_DOC_STALE_REVISION'});
    expect(validateAgentStart({...start,observationTarget:{nodeId:'missing'}})).toMatchObject({ok:false,code:'STUDIO_AGENT_OBSERVATION_TARGET'});
    expect(validateAgentStart({...start,workspace:{workspaceView:'structure',mode:'design',observable:false,reason:'preview-covered',viewport:{model:'isolated-viewport',width:0,height:0,devicePixelRatio:1,scrollLeft:0,scrollTop:0}}})).toMatchObject({ok:false,code:'STUDIO_CAPTURE_NOT_VISIBLE'});
  });
  it('preflights unsupported configured image models before opening a run or making a provider request',()=>{
    const {start}=setup();const deliver=vi.fn();vi.stubEnv('STUDIO_AGENT_MODEL','unsupported-provider/test');
    try{expect(openAgentRun('unsupported-observation',start,deliver)).toMatchObject({ok:false,code:'STUDIO_CAPTURE_MODEL_UNSUPPORTED'});expect(deliver).not.toHaveBeenCalled();}finally{vi.unstubAllEnvs();}
  });
});
