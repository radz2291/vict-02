// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import AgentChat from '../../src/lib/designer/AgentChat.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { documentCursor } from '../../src/lib/designer/agent-edits.js';
let instance:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(instance)await unmount(instance);instance=undefined;document.body.innerHTML='';vi.unstubAllGlobals();});
it('groups chronological lifecycle receipts by actual call, retains failed attempt, and names failed observation after confirmed progress (transport simulation)',async()=>{
 const events=[
  {type:'started',runId:'fixture',model:'zai/glm-5.3-flash'},
  {type:'text',delta:'I will inspect the current source.'},
  {type:'tool-event',id:'a1',tool:'studio_screen_read',callId:'read-1',kind:'tool-start',summary:'Tool started'},
  {type:'tool-event',id:'a2',tool:'studio_screen_read',callId:'read-1',kind:'validation-refused',summary:'Read query refused safely',details:'STUDIO_AGENT_COMPONENT_NOT_FOUND'},
  {type:'text',delta:'I will correct the lookup.'},
  {type:'tool-event',id:'b1',tool:'studio_screen_read',callId:'read-2',kind:'tool-start',summary:'Tool started'},
  {type:'tool-event',id:'b2',tool:'studio_screen_read',callId:'read-2',kind:'observation',summary:'Read current source facts',details:'Current source'},
  {type:'tool-event',id:'c1',tool:'studio_screen_observe',callId:'image-1',kind:'tool-start',summary:'Tool started'},
  {type:'tool-event',id:'c2',tool:'studio_screen_observe',callId:'image-1',kind:'validation-refused',summary:'Visual observation unavailable',details:'STUDIO_CAPTURE_NOT_VISIBLE'},
  {type:'done',status:'failed',code:'STUDIO_AGENT_TOOL_FAILED',applied:6,confirmedRevision:'r1#6',termination:{status:'completed'},unresolvedTools:['studio_screen_observe'],toolFailures:[{tool:'studio_screen_observe',code:'STUDIO_CAPTURE_NOT_VISIBLE',phase:'visibility'}],metrics:{toolCalls:3,refusedCalls:2,recoveryAttempts:1,elapsedMs:1200,providerRequests:2,visionRequests:0},sourceEvidence:{nodeCount:42,stateCount:12,appearanceObserved:false,interactionsVerified:false}},
 ];
 vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>init?.method==='POST'?new Response(events.map(event=>JSON.stringify(event)).join('\n')+'\n'):new Response(JSON.stringify({csrf:'nonce',ready:true,model:'zai/glm-5.3-flash'}))));
 const source=newScreen('Progress fixture','progress');
 instance=mount(AgentChat,{target:document.body,props:{screenLabel:'Progress fixture',selectionLabel:'Screen',blocked:false,getContext:()=>({document:source,cursor:documentCursor(source,'r1#6',crypto.randomUUID())}),applyProposal:()=>{throw Error('No edit proposal in this simulation');}}});
 await vi.waitFor(()=>expect(document.body.textContent).toContain('Ready'));
 const input=document.querySelector<HTMLTextAreaElement>('[data-testid="conversation-input"]')!;
 input.value='Review the current result';input.dispatchEvent(new Event('input',{bubbles:true}));flushSync();document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 await vi.waitFor(()=>expect(document.querySelector('.agent-status')?.textContent).toContain('Visual verification failed'));
 const status=document.querySelector('.agent-status')!.textContent!;
 expect(status).toContain('6 applied edits remain undoable');expect(status).not.toContain('complete an edit');
 const activities=[...document.querySelectorAll<HTMLElement>('[data-event-kind="activity"]')];
 expect(activities).toHaveLength(3);
 expect(activities[0]!.textContent).toContain('Read query refused safely');expect(activities[1]!.textContent).toContain('Read current source facts');
 activities[0]!.querySelector<HTMLButtonElement>('button')!.click();flushSync();
 await vi.waitFor(()=>expect(activities[0]!.textContent).toContain('STUDIO_AGENT_COMPONENT_NOT_FOUND'));
 expect(activities[0]!.querySelectorAll('ol[aria-label="Attempt receipts"] li')).toHaveLength(2);
 expect(document.body.textContent).toContain('current appearance unverified');expect(document.body.textContent).toContain('interactions unverified');
 document.querySelector<HTMLButtonElement>('[aria-label="Chat details"]')!.click();flushSync();
 await vi.waitFor(()=>expect(document.body.textContent).toContain('3 tool calls'));
 expect(document.body.textContent).toContain('Token usage unavailable');expect(document.body.textContent).toContain('Exact model steps and cost unavailable');
});
