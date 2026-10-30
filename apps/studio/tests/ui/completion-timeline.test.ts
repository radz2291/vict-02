// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import { Conversation, appendConversationEvent, type ConversationEvent } from '@victframework/ui-ai-svelte';
import AgentChat from '../../src/lib/designer/AgentChat.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { documentCursor, prepareAgentEdit } from '../../src/lib/designer/agent-edits.js';
import { agentCoverage } from '../../src/lib/designer/agent-reads.js';
import { boundedHistoryText, AGENT_REQUEST_BYTES } from '../../src/lib/designer/agent-transport.js';
let mounted: ReturnType<typeof mount> | undefined;
afterEach(async()=>{if(mounted)await unmount(mounted); mounted=undefined;document.body.innerHTML='';vi.unstubAllGlobals();});

it('renders ordered text, refused attempt, corrected observation and acknowledged boundary through public presentation',async()=>{
  const events: ConversationEvent[] = [
    {id:'a',kind:'text',text:'Inspect the current source.'},
    {id:'b',kind:'activity',activity:{id:'b',title:'Read refused',state:'failed',detail:'Read limit. Request nodes page 0.'}},
    {id:'c',kind:'text',text:'Request a smaller page.'},
    {id:'d',kind:'activity',activity:{id:'d',title:'Observed 12 source nodes',state:'completed',detail:'Source observation only.'}},
    {id:'e',kind:'summary',text:'One committed receipt; visual completion unverified.'},
  ];
  mounted=mount(Conversation,{target:document.body,props:{messages:[{id:'turn',role:'assistant',text:'copy text',events}],onSend:async()=>true}});
  flushSync();
  expect([...document.querySelectorAll('[data-event-id]')].map(node=>node.getAttribute('data-event-id'))).toEqual(['a','b','c','d','e']);
  expect(document.querySelector('[data-event-id=b]')?.textContent).toContain('failed');
  document.querySelector<HTMLButtonElement>('[data-event-id=b] button')?.click();
  await vi.waitFor(()=>expect(document.body.textContent).toContain('Read limit. Request nodes page 0.'));
});

it('visibly compacts old entries and updates stable identities without duplicating them',()=>{
  let events:ConversationEvent[]=[];
  for(let i=0;i<300;i++)events=appendConversationEvent(events,{id:`event-${i}`,kind:'summary',text:`Step ${i}`});
  expect(events).toHaveLength(240);
  expect(events[0]).toMatchObject({kind:'compaction',omitted:61});
  events=appendConversationEvent(events,{id:'event-299',kind:'summary',text:'Confirmed current boundary'});
  expect(events).toHaveLength(240);
  expect(events.at(-1)).toMatchObject({text:'Confirmed current boundary'});
  const history=boundedHistoryText('start'.repeat(2000)+'LATEST CONFIRMED BOUNDARY');
  expect(history.length).toBeLessThanOrEqual(6000);
  expect(history).toContain('compacted');expect(history).toContain('LATEST CONFIRMED BOUNDARY');
});

it('shows aggregate UTF-8 admission failure with the unsent draft retained',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(_url,init?:RequestInit)=>init?.method==='POST'?new Response(JSON.stringify({code:'STUDIO_AGENT_REQUEST_LIMIT'}),{status:413}):new Response(JSON.stringify({ready:true,csrf:'n',model:'fixture/model'}))));
  const source=newScreen('Admission','admission');
  mounted=mount(AgentChat,{target:document.body,props:{screenLabel:'Admission',selectionLabel:'Screen',blocked:false,getContext:()=>({document:source,cursor:documentCursor(source,'r1#0',crypto.randomUUID())}),applyProposal:()=>{throw Error('No proposal');}}});
  await vi.waitFor(()=>expect(document.body.textContent).toContain('Ready'));
  const input=document.querySelector<HTMLTextAreaElement>('textarea')!;
  input.value='Keep this draft';input.dispatchEvent(new Event('input',{bubbles:true}));flushSync();
  document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await vi.waitFor(()=>expect(document.body.textContent).toContain('UTF-8 size limit'));
  expect(input.value).toBe('Keep this draft');
  expect(document.body.textContent).not.toContain('Connection interrupted');
  expect(new TextEncoder().encode('界'.repeat(200_000)).byteLength).toBeLessThan(AGENT_REQUEST_BYTES);
});

it('releases Stop while capture is pending and fences its late result from upload',async()=>{
  const source=newScreen('Capture Stop','capture-stop');const cursor=documentCursor(source,'r1#0',crypto.randomUUID());
  let release!:(result:{ok:false;code:string;message:string})=>void;
  const capture=vi.fn(()=>new Promise<{ok:false;code:string;message:string}>(resolve=>{release=resolve;}));
  const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{
    if(init?.method==='DELETE')return new Response('{}');
    if(init?.method==='POST')return new Response(new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new TextEncoder().encode([
      {type:'started',runId:crypto.randomUUID(),model:'fixture/model'},
      {type:'tool-event',id:'observe-start',sequence:1,kind:'tool-start',tool:'studio_screen_observe',summary:'Tool started'},
      {type:'capture-request',captureId:crypto.randomUUID(),cursor},
    ].map(event=>JSON.stringify(event)).join('\n')+'\n'));}}));
    return new Response(JSON.stringify({ready:true,csrf:'n',model:'fixture/model'}));
  });vi.stubGlobal('fetch',fetcher);
  mounted=mount(AgentChat,{target:document.body,props:{screenLabel:'Capture Stop',selectionLabel:'Screen',blocked:false,getContext:()=>({document:source,cursor}),getCapture:capture,applyProposal:()=>{throw Error('No proposal');}}});
  await vi.waitFor(()=>expect(document.body.textContent).toContain('Ready'));
  const input=document.querySelector<HTMLTextAreaElement>('textarea')!;input.value='Inspect the preview';input.dispatchEvent(new Event('input',{bubbles:true}));flushSync();document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await vi.waitFor(()=>expect(capture).toHaveBeenCalledOnce());
  document.querySelector<HTMLButtonElement>('[data-testid="conversation-stop"]')!.click();
  await vi.waitFor(()=>expect(document.querySelector('[data-testid="conversation-stop"]')).toBeNull());
  input.value='Continue from the current source';input.dispatchEvent(new Event('input',{bubbles:true}));flushSync();
  expect(document.querySelector<HTMLButtonElement>('[data-testid="conversation-send"]')?.disabled).toBe(false);
  expect(document.body.textContent).toContain('cancelled');
  release({ok:false,code:'STUDIO_CAPTURE_FAILED',message:'Late capture result'});await new Promise(resolve=>setTimeout(resolve,0));
  expect(fetcher.mock.calls.some(([url])=>String(url).includes('/capture/'))).toBe(false);
});

it('labels subset coverage as an agent-declared manifest rather than global completeness',async()=>{
  const source=newScreen('Coverage','coverage');const cursor=documentCursor(source,'r1#0',crypto.randomUUID());
  vi.stubGlobal('fetch',vi.fn(async(_url,init?:RequestInit)=>init?.method==='POST'?new Response([
    {type:'started',runId:crypto.randomUUID(),model:'fixture/model'},
    {type:'done',status:'completed',applied:0,coverage:{available:78,authored:1,catalogAuthored:2,registeredAuthored:3,requested:1,scope:'agent-declared-manifest',missing:[]},confirmedRevision:cursor.revision},
  ].map(event=>JSON.stringify(event)).join('\n')+'\n'):new Response(JSON.stringify({ready:true,csrf:'n',model:'fixture/model'}))));
  mounted=mount(AgentChat,{target:document.body,props:{screenLabel:'Coverage',selectionLabel:'Screen',blocked:false,getContext:()=>({document:source,cursor}),applyProposal:()=>{throw Error('No proposal');}}});
  await vi.waitFor(()=>expect(document.body.textContent).toContain('Ready'));
  const input=document.querySelector<HTMLTextAreaElement>('textarea')!;input.value='Inventory requested controls';input.dispatchEvent(new Event('input',{bubbles:true}));flushSync();document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  document.querySelector<HTMLButtonElement>('[aria-label="Chat details"]')!.click();flushSync();
  await vi.waitFor(()=>expect(document.body.textContent).toContain('1-item agent-declared manifest'));
  expect(document.body.textContent).toContain('3/78 registered definitions present');
  expect(document.body.textContent).not.toContain('2/78 registered definitions present');
  expect(document.body.textContent).toContain('does not establish the full requested intent');
});

it.each([false,true])('projects actual mixed general, AI and Flow coverage with separate requested scope (subset=%s)',async(subset)=>{
  const initial=newScreen('Mixed coverage','mixed-coverage');const initialCursor=documentCursor(initial,'r1#0',crypto.randomUUID());
  const prepared=prepareAgentEdit(initial,initialCursor,{expectedRevision:initialCursor.revision,reason:'Mixed registered coverage fixture',operations:[
    {op:'insert',kind:'component',componentId:'vict.catalog.button',revision:'1',nodeId:'general',parentId:'screen'},
    {op:'insert',kind:'component',componentId:'vict.ai.message',revision:'1',nodeId:'message',parentId:'screen'},
    {op:'insert',kind:'component',componentId:'vict.flow.canvas',revision:'1',nodeId:'flow',parentId:'screen'},
  ]},'mixed-coverage');
  expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error('Mixed source refused');
  const source=prepared.document;const cursor=documentCursor(source,'r1#1',initialCursor.epoch);
  const facts=agentCoverage(source,subset?['vict.ai.message','vict.catalog.input']:undefined);
  expect(facts).toMatchObject({registeredAuthored:3,catalogAuthored:1,authored:subset?1:3});
  expect(facts.missing.length).toBe(subset?1:facts.available-3);
  // An explicitly requested bundled starter retains its recipe requirements;
  // an empty registered canvas is globally present but is not that full recipe.
  expect(agentCoverage(source,['vict.flow.canvas'])).toMatchObject({authored:0,registeredAuthored:3,requested:1,missing:['vict.flow.canvas']});
  const coverage={...facts,scope:subset?'agent-declared-manifest':'all-authorable-definitions',missing:facts.missing.slice(0,20),missingCount:facts.missing.length,moreMissing:facts.missing.length>20};
  vi.stubGlobal('fetch',vi.fn(async(_url,init?:RequestInit)=>init?.method==='POST'?new Response([
    {type:'started',runId:crypto.randomUUID(),model:'fixture/model'},
    {type:'done',status:'completed',applied:0,coverage,confirmedRevision:cursor.revision},
  ].map(event=>JSON.stringify(event)).join('\n')+'\n'):new Response(JSON.stringify({ready:true,csrf:'n',model:'fixture/model'}))));
  mounted=mount(AgentChat,{target:document.body,props:{screenLabel:'Mixed coverage',selectionLabel:'Screen',blocked:false,getContext:()=>({document:source,cursor}),applyProposal:()=>{throw Error('No proposal');}}});
  await vi.waitFor(()=>expect(document.body.textContent).toContain('Ready'));
  const input=document.querySelector<HTMLTextAreaElement>('textarea')!;input.value='Review source coverage';input.dispatchEvent(new Event('input',{bubbles:true}));flushSync();document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  document.querySelector<HTMLButtonElement>('[aria-label="Chat details"]')!.click();flushSync();
  await vi.waitFor(()=>expect(document.body.textContent).toContain(`3/${facts.available} registered definitions present`));
  expect(document.body.textContent).toContain(`${facts.missing.length} missing from the ${facts.requested}-item ${subset?'agent-declared manifest':'coverage scope'}`);
  expect(document.body.textContent).not.toContain(`1/${facts.available} registered definitions present`);
  expect(document.body.textContent).toContain('does not establish the full requested intent');
});

it('settles parallel reads only by their matching call identity',async()=>{
  const source=newScreen('Parallel reads','parallel-reads');const cursor=documentCursor(source,'r1#0',crypto.randomUUID());
  let controller!:ReadableStreamDefaultController<Uint8Array>;
  const emit=(events:unknown[])=>controller.enqueue(new TextEncoder().encode(events.map(event=>JSON.stringify(event)).join('\n')+'\n'));
  vi.stubGlobal('fetch',vi.fn(async(_url,init?:RequestInit)=>init?.method==='POST'?new Response(new ReadableStream<Uint8Array>({start(value){controller=value;emit([
    {type:'started',runId:crypto.randomUUID(),model:'fixture/model'},
    {type:'tool-event',id:'read-a',kind:'tool-start',tool:'studio_screen_read',callId:'a',summary:'Read A'},
    {type:'tool-event',id:'read-b',kind:'tool-start',tool:'studio_screen_read',callId:'b',summary:'Read B'},
    {type:'tool-event',id:'unassociated',kind:'validation-refused',tool:'studio_screen_read',summary:'Schema refused before invocation'},
    {type:'schema-diagnostic',id:'parse-note',scope:'contract-validation',tool:'studio_screen_read',evaluations:1,firstElapsedMs:10,lastElapsedMs:10,details:'{"path":"offset","message":"Expected a nonnegative number"}'},
    {type:'schema-diagnostic',id:'parse-note',scope:'contract-validation',tool:'studio_screen_read',evaluations:2,firstElapsedMs:10,lastElapsedMs:11,details:'{"path":"offset","message":"Expected a nonnegative number"}'},
  ]);}})):new Response(JSON.stringify({ready:true,csrf:'n',model:'fixture/model'}))));
  mounted=mount(AgentChat,{target:document.body,props:{screenLabel:'Parallel reads',selectionLabel:'Screen',blocked:false,getContext:()=>({document:source,cursor}),applyProposal:()=>{throw Error('No proposal');}}});
  await vi.waitFor(()=>expect(document.body.textContent).toContain('Ready'));
  const input=document.querySelector<HTMLTextAreaElement>('textarea')!;input.value='Inspect two pages';input.dispatchEvent(new Event('input',{bubbles:true}));flushSync();document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await vi.waitFor(()=>expect(document.querySelector('[data-event-id="attempt-studio_screen_read:unassociated"]')).not.toBeNull());
  expect(document.querySelector('[data-event-id="attempt-studio_screen_read:a"]')?.textContent).toContain('running');
  expect(document.querySelector('[data-event-id="attempt-studio_screen_read:b"]')?.textContent).toContain('running');
  expect(document.querySelectorAll('[data-event-id^="schema-diagnostic-"]')).toHaveLength(0);
  document.querySelector<HTMLButtonElement>('[aria-label="Chat details"]')!.click();flushSync();
  await vi.waitFor(()=>expect(document.querySelector('[data-diagnostic-id="parse-note"]')).not.toBeNull());
  const diagnostic=document.querySelector('[data-diagnostic-id="parse-note"]')!;
  await vi.waitFor(()=>expect(diagnostic.textContent).toContain('2 parser evaluations'));
  expect(diagnostic.textContent).toContain('not tool calls');expect(diagnostic.querySelector('[aria-label="Attempt receipts"]')).toBeNull();
  expect(document.querySelector('[data-event-id="attempt-studio_screen_read:a"]')?.textContent).toContain('running');
  expect(document.querySelector('[data-event-id="attempt-studio_screen_read:b"]')?.textContent).toContain('running');
  emit([{type:'tool-event',id:'failed-a',kind:'tool-failed',tool:'studio_screen_read',callId:'a',summary:'Read A failed'}]);
  await vi.waitFor(()=>expect(document.querySelector('[data-event-id="attempt-studio_screen_read:a"]')?.textContent).toContain('failed'));
  expect(document.querySelector('[data-event-id="attempt-studio_screen_read:b"]')?.textContent).toContain('running');
  emit([{type:'tool-event',id:'observed-b',kind:'observation',tool:'studio_screen_read',callId:'b',summary:'Read B observed'},{type:'done',status:'failed',code:'READ_REFUSED',applied:0}]);controller.close();
  await vi.waitFor(()=>expect(document.querySelector('[data-event-id="attempt-studio_screen_read:b"]')?.textContent).toContain('completed'));
  expect(document.querySelector('[data-event-id="attempt-studio_screen_read:a"]')?.textContent).toContain('failed');
});
