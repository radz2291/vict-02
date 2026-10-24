// @vitest-environment happy-dom
import { flushSync,mount,unmount } from 'svelte';
import { afterEach,expect,it,vi } from 'vitest';
import { createDeterministicOfflineModel,OFFLINE_MODEL_IDENTITY } from '@victframework/mastra';
import AgentChat from '../../src/lib/designer/AgentChat.svelte';
import CoreAuthoringShowcase from '../../src/lib/designer/CoreAuthoringShowcase.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { agentContext,documentCursor } from '../../src/lib/designer/agent-edits.js';
import { openAgentRun,validateAgentStart,type StudioAgentEvent } from '../../src/lib/server/designer-agent.js';

let mounted:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(mounted)await unmount(mounted);mounted=undefined;document.body.innerHTML='';vi.unstubAllGlobals();});

it('includes the separately labeled expandable diagnostic in the simulated public showcase',async()=>{
 mounted=mount(CoreAuthoringShowcase,{target:document.body});flushSync();
 const diagnostic=document.querySelector<HTMLElement>('[data-event-id="core-fixture-schema"]')!;
 expect(diagnostic.textContent).toContain('not a tool attempt');diagnostic.querySelector<HTMLButtonElement>('button')!.click();flushSync();
 await vi.waitFor(()=>expect(diagnostic.textContent).toContain('2 parser evaluations'));
 expect(diagnostic.textContent).toContain('Simulation');expect(diagnostic.querySelector('[aria-label="Attempt receipts"]')).toBeNull();
});

it('keeps real same-pass malformed calls distinct while combining repeated parser diagnostics outside attempts (pinned offline executor through actual chat)',async()=>{
 const source=newScreen('Schema projection','schema-projection');const before=JSON.stringify(source);
 const cursor=documentCursor(source,'r1#0',crypto.randomUUID());const prompt='Check invalid fields without changing source';
 const validated=validateAgentStart({document:source,cursor,prompt,history:[]});if(!validated.ok)throw Error(validated.message);
 const input=JSON.stringify({request:prompt,untrusted_history:[],untrusted_screen:agentContext(source,cursor)});
 const bad={expectedRevision:cursor.revision,reason:'Malformed expression probe',operations:[{op:'bind',nodeId:'screen',prop:'checked',expression:true}]};
 const modelResults:unknown[]=[];
 const offline=createDeterministicOfflineModel({script:{[input]:{kind:'tool-chain',calls:[
  {toolName:'studio_screen_edit',args:bad},{toolName:'studio_screen_edit',args:bad},{toolName:'studio_screen_read',args:{}},
 ],thenText:'Both malformed calls refused; source is unchanged.'}},onToolResult:event=>modelResults.push(event)});
 let first=true;
 const model={...offline,doStream:async(options:Parameters<typeof offline.doStream>[0])=>{
  const result=await offline.doStream(options);if(!first)return result;first=false;
  // Two explicit model-supplied identities in one provider pass. Studio never
  // derives this identity or correlates a parser evaluation to either call.
  const reader=result.stream.getReader();
  return {...result,stream:new ReadableStream({async start(controller){try{
   while(true){const {done,value}=await reader.read();if(done)break;controller.enqueue(value);
    if(value.type==='tool-call')controller.enqueue({...value,toolCallId:value.toolCallId+'-parallel'});
    else if(value.type==='tool-input-start'||value.type==='tool-input-delta'||value.type==='tool-input-end')controller.enqueue({...value,id:value.id+'-parallel'});
   }controller.close();
  }catch(error){controller.error(error);}finally{reader.releaseLock();}}})};
 }};
 const events:StudioAgentEvent[]=[];let finished:Promise<void>|undefined;
 vi.stubGlobal('fetch',vi.fn(async(_url,init?:RequestInit)=>{
  if(init?.method!=='POST')return new Response(JSON.stringify({ready:true,csrf:'n',model:OFFLINE_MODEL_IDENTITY}));
  return new Response(new ReadableStream<Uint8Array>({start(controller){
   const opened=openAgentRun('schema-projection-ui',validated.value,event=>{events.push(event);controller.enqueue(new TextEncoder().encode(JSON.stringify(event)+'\n'));},{model:OFFLINE_MODEL_IDENTITY,modelFactory:()=>model});
   if(!opened.ok)throw Error(opened.code);finished=opened.finished.then(()=>controller.close(),error=>controller.error(error));
  }}));
 }));
 mounted=mount(AgentChat,{target:document.body,props:{screenLabel:'Schema projection',selectionLabel:'Screen',blocked:false,getContext:()=>({document:source,cursor}),applyProposal:()=>{throw Error('Malformed input must never propose');}}});
 await vi.waitFor(()=>expect(document.body.textContent).toContain('Ready'));
 const textarea=document.querySelector<HTMLTextAreaElement>('textarea')!;textarea.value=prompt;textarea.dispatchEvent(new Event('input',{bubbles:true}));flushSync();document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 await vi.waitFor(()=>expect(events.at(-1)?.type).toBe('done'),{timeout:15000});await finished;
 const calls=events.filter((event):event is Extract<StudioAgentEvent,{type:'tool-event'}>=>event.type==='tool-event');
 const failed=calls.filter(event=>event.kind==='tool-failed');expect(failed).toHaveLength(2);expect(new Set(failed.map(event=>event.callId)).size).toBe(2);expect(failed.every(event=>!!event.callId)).toBe(true);
 expect(calls.filter(event=>event.kind==='tool-start')).toHaveLength(3);
 expect(calls.some(event=>event.kind==='validation-refused'&&!event.callId)).toBe(false);
 const diagnostics=events.filter((event):event is Extract<StudioAgentEvent,{type:'schema-diagnostic'}>=>event.type==='schema-diagnostic');
 expect(diagnostics.length).toBeGreaterThan(2);expect(new Set(diagnostics.map(event=>event.id)).size).toBe(1);
 expect(diagnostics.at(-1)?.evaluations).toBe(diagnostics.length);
 expect(diagnostics.at(-1)!.lastElapsedMs).toBeGreaterThanOrEqual(diagnostics[0]!.firstElapsedMs);
 expect(JSON.stringify(modelResults)).toContain('lastValidation');expect(JSON.stringify(modelResults)).toContain('operations.0.expression');
 expect(events.some(event=>event.type==='proposal')).toBe(false);expect(JSON.stringify(source)).toBe(before);
 expect(events.at(-1)).toMatchObject({type:'done',status:'failed',applied:0,metrics:{toolCalls:3,refusedCalls:2,completedCalls:1}});
 await vi.waitFor(()=>expect(document.querySelectorAll('[data-event-id^="attempt-"]')).toHaveLength(3));
 const diagnostic=document.querySelector<HTMLElement>('[data-event-id^="schema-diagnostic-"]')!;
 expect(document.querySelectorAll('[data-event-id^="schema-diagnostic-"]')).toHaveLength(1);expect(diagnostic.textContent).toContain('not a tool attempt');
 diagnostic.querySelector<HTMLButtonElement>('button')!.click();flushSync();
 await vi.waitFor(()=>expect(diagnostic.textContent).toContain(`${diagnostics.length} parser evaluations`));
 expect(diagnostic.textContent).toContain('operations.0.expression');expect(diagnostic.textContent).toContain('Expected exactly');
 expect(diagnostic.querySelector('[aria-label="Attempt receipts"]')).toBeNull();
 document.querySelector<HTMLButtonElement>('[aria-label="Chat details"]')!.click();flushSync();
 await vi.waitFor(()=>expect(document.body.textContent).toContain('3 tool calls'));expect(document.body.textContent).toContain('2 refused');
},120000);
