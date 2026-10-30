// @vitest-environment happy-dom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {flushSync,mount,tick,unmount} from 'svelte';
import AgentChat,* as agentChatModule from '../src/lib/designer/AgentChat.svelte';
import {newScreen} from '../src/lib/designer/application.js';
import {documentCursor} from '../src/lib/designer/agent-edits.js';
// Plain tsc sees Svelte's wildcard module declaration, which cannot expose
// module-script named exports. The mounted tests use the actual compiled module.
const {createResponseBoundary}=agentChatModule as typeof agentChatModule & {
 createResponseBoundary:()=>{toolStarted():void;text(id:string):void;finish(success:boolean):string[]};
};
let instance:ReturnType<typeof mount>|undefined;
const settle=async()=>{flushSync();await tick();await new Promise(resolve=>setTimeout(resolve,20));flushSync();};
afterEach(async()=>{if(instance)await unmount(instance);instance=undefined;vi.unstubAllGlobals();document.body.replaceChildren();});
describe('actual stream response boundaries',()=>{
  it('promotes only text after the most recent actual tool attempt, not an in-place receipt array position',()=>{
    const boundary=createResponseBoundary();boundary.text('opening');boundary.toolStarted();boundary.text('between-tools');
    // A new invocation can update the same visible activity ID in place.
    boundary.toolStarted();expect(boundary.finish(true)).toEqual([]);
    boundary.text('terminal-one');boundary.text('terminal-one');boundary.text('terminal-two');
    expect(boundary.finish(true)).toEqual(['terminal-one','terminal-two']);
    // Late receipt updates do not announce another tool-start and do not clear this boundary.
    expect(boundary.finish(true)).toEqual(['terminal-one','terminal-two']);
  });
  it('never promotes text on failure/cancel/interruption and isolates each historical turn',()=>{
    const first=createResponseBoundary(),second=createResponseBoundary();first.text('first');second.text('second');
    expect(first.finish(false)).toEqual([]);expect(second.finish(true)).toEqual(['second']);expect(first.finish(true)).toEqual(['first']);
    first.toolStarted();expect(first.finish(true)).toEqual([]);
  });
  it('preserves distinct progress and terminal originals behind the honest host summary despite in-place receipt updates',async()=>{
    const documentSource=newScreen('Boundary fixture','response-boundary');
    const cursor=documentCursor(documentSource,'r1',crypto.randomUUID());
    const frames=[
      {type:'started',runId:crypto.randomUUID(),model:'offline-test'},
      {type:'text',delta:'Public note before invocation.'},
      {type:'tool-event',kind:'tool-start',tool:'studio_screen_read',callId:'same-call',id:'start',summary:'Reading source'},
      {type:'text',delta:'Actual terminal response; interactions unverified.'},
      // Receipt updates change the existing tool item, not the actual text chronology.
      {type:'tool-event',kind:'observation',tool:'studio_screen_read',callId:'same-call',id:'receipt',summary:'Read completed'},
      {type:'done',status:'completed',applied:0,confirmedRevision:cursor.revision},
    ];
    const fetchMock=vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>init?.method==='POST'
      ?new Response(frames.map(frame=>JSON.stringify(frame)).join('\n')+'\n',{headers:{'content-type':'application/x-ndjson'}})
      :Response.json({csrf:'offline-csrf',model:'offline-test',ready:true}));
    vi.stubGlobal('fetch',fetchMock);
    const host=document.createElement('div');document.body.append(host);
    instance=mount(AgentChat,{target:host,props:{screenLabel:'Boundary fixture',selectionLabel:'None',blocked:false,getContext:()=>({document:documentSource,cursor}),applyProposal:()=>({ok:false,code:'UNEXPECTED',message:'No edits expected'})}});
    await settle();const input=host.querySelector('textarea')!;input.value='Inspect without claiming interaction tests';input.dispatchEvent(new Event('input',{bubbles:true}));await settle();
    host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle();await settle();
    expect(Array.from(host.querySelectorAll('[data-event-kind="text"]'),node=>node.textContent)).toEqual(['Public note before invocation.','Actual terminal response; interactions unverified.']);
    expect(host.querySelector('[aria-label="Host evidence summary"] [role="status"]')?.textContent).toBe('No source changes were applied. No image assessment matches the final source. Behavior was not tested by this agent.');
    // Originals stay inspectable; the host never promotes model claims into its summary.
    expect(host.querySelector('[aria-label="Terminal response"]')).toBeNull();
    expect(host.textContent).not.toContain('No terminal AI response received.');
    expect(host.querySelector('[data-slot="trace-collapsible-content"]')?.hasAttribute('hidden')).toBe(true);
    expect(fetchMock.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
  });
});
