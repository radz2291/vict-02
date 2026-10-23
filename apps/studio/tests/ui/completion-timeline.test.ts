// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import { Conversation, appendConversationEvent, type ConversationEvent } from '@victframework/ui-ai-svelte';
import AgentChat from '../../src/lib/designer/AgentChat.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { documentCursor } from '../../src/lib/designer/agent-edits.js';
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
