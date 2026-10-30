// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentChat from '../../src/lib/designer/AgentChat.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { documentCursor } from '../../src/lib/designer/agent-edits.js';
import { createTurnMetrics } from '../../src/lib/designer/agent-progress.js';
let instance:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(instance)await unmount(instance);instance=undefined;document.body.innerHTML='';vi.unstubAllGlobals();vi.restoreAllMocks();});
const submit=async(text:string)=>{const input=document.querySelector<HTMLTextAreaElement>('[data-testid="conversation-input"]')!;input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));flushSync();document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await vi.waitFor(()=>expect(input.value).toBe(''));};
const stream=(events:unknown[])=>new Response(events.map(event=>JSON.stringify(event)).join('\n')+'\n');
describe('turn-specific Chat evidence and safe continuation',()=>{
  it('retains a failed turn while showing a newer turn, without adding mechanical transcript messages',async()=>{
    let runs=0;const metrics=createTurnMetrics().snapshot();
    vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>init?.method==='POST'?stream([{type:'started',runId:`run-${++runs}`,model:'offline/test'},{type:'text',delta:runs===1?'Appearance remains unresolved.':'I read the corrected target.'},{type:'done',status:runs===1?'failed':'completed',code:runs===1?'STUDIO_CAPTURE_NOT_VISIBLE':undefined,applied:0,metrics,confirmedRevision:'r1#0',turnId:`turn-${runs}`} ]):new Response(JSON.stringify({csrf:'nonce',ready:true,model:'offline/test'}))));
    const source=newScreen('History','history');const cursor=documentCursor(source,'r1#0',crypto.randomUUID());
    const apply=vi.fn(()=>{throw Error('No edit authorized by fixture');});
    instance=mount(AgentChat,{target:document.body,props:{screenLabel:'History',selectionLabel:'Screen',blocked:false,getContext:()=>({document:source,cursor}),applyProposal:apply}});
    await vi.waitFor(()=>expect(document.body.textContent).toContain('Ready'));await submit('Fix footer gap');await vi.waitFor(()=>expect(document.querySelector('.agent-status--failed')).not.toBeNull());await submit('I mean header');
    await vi.waitFor(()=>expect(document.body.textContent).toContain('I read the corrected target.'));
    document.querySelector<HTMLButtonElement>('[aria-label="Chat details"]')!.click();await vi.waitFor(()=>expect(document.querySelector('select[aria-label="Inspect turn"]')).not.toBeNull());
    const select=document.querySelector<HTMLSelectElement>('select[aria-label="Inspect turn"]')!;expect(select.options).toHaveLength(3);select.selectedIndex=1;select.dispatchEvent(new Event('change',{bubbles:true}));flushSync();
    await vi.waitFor(()=>expect(document.querySelector('.studio-chat-details')?.textContent).toContain('STUDIO_CAPTURE_NOT_VISIBLE'));
    expect(document.querySelector('.studio-chat-details')?.textContent).toContain('run-1');expect(document.querySelector('.studio-chat-details')?.textContent).toContain('turn-1');expect(apply).not.toHaveBeenCalled();
    expect(document.querySelector('.vict-ai-conversation')?.textContent).not.toContain('Source boundaries');
  });
  it('retries capture without another model request or edit and fences a changed source',async()=>{
    const source=newScreen('Recovery','recovery');let cursor=documentCursor(source,'r1#0',crypto.randomUUID());let requests=0;
    const target={nodeId:'header',part:'surface'};
    const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{if(init?.method==='POST'){requests++;if(String(_url).includes('/capture/'))return new Response('{}');return stream([{type:'started',runId:'run-recovery',model:'offline/test'},{type:'capture-request',captureId:'capture-1',cursor,target},{type:'done',status:'failed',code:'STUDIO_CAPTURE_NOT_VISIBLE',applied:0}]);}return new Response(JSON.stringify({csrf:'nonce',ready:true,model:'offline/test'}));});
    vi.stubGlobal('fetch',fetcher);const capture=vi.fn(async()=>({ok:false as const,code:'STUDIO_CAPTURE_NOT_VISIBLE',message:'Reveal the Design preview.'}));const apply=vi.fn(()=>{throw Error('No edit');});
    instance=mount(AgentChat,{target:document.body,props:{screenLabel:'Recovery',selectionLabel:'Screen',blocked:false,getContext:()=>({document:source,cursor}),applyProposal:apply,getCapture:capture}});
    await vi.waitFor(()=>expect(document.body.textContent).toContain('Ready'));await submit('Inspect header');
    await vi.waitFor(()=>expect(document.querySelector<HTMLButtonElement>('.capture-retry')?.disabled).toBe(false));document.querySelector<HTMLButtonElement>('[aria-label="Chat details"]')!.click();await vi.waitFor(()=>expect(document.querySelector('.capture-only-retry')).not.toBeNull());
    document.querySelector<HTMLButtonElement>('.capture-only-retry')!.click();await vi.waitFor(()=>expect(capture).toHaveBeenCalledTimes(2));expect(capture).toHaveBeenLastCalledWith(cursor,target);expect(requests).toBe(2);expect(apply).not.toHaveBeenCalled();
    cursor={...cursor,revision:'r1#1'};document.querySelector<HTMLButtonElement>('.capture-only-retry')!.click();await new Promise(resolve=>setTimeout(resolve,20));expect(capture).toHaveBeenCalledTimes(2);expect(requests).toBe(2);expect(apply).not.toHaveBeenCalled();
  });
  it('offers an explicit observation-only agent continuation and rejects any unexpected proposal without applying it',async()=>{
    const source=newScreen('Agent recovery','agent-recovery');let cursor=documentCursor(source,'r1#0',crypto.randomUUID());let observable=true;let admitted=0;
    const target={nodeId:'screen',part:'root'};const bodies:Record<string,unknown>[]=[];
    vi.stubGlobal('fetch',vi.fn(async(url:unknown,init?:RequestInit)=>{
      if(init?.method==='POST'&&String(url).includes('/capture/'))return new Response('{}');
      if(init?.method==='POST'){const body=JSON.parse(String(init.body));bodies.push(body);admitted++;return admitted===1?stream([{type:'started',runId:'first-run',model:'offline/test'},{type:'capture-request',captureId:'capture-recovery',cursor,target},{type:'done',status:'failed',code:'STUDIO_CAPTURE_NOT_VISIBLE',applied:0}]):stream([{type:'started',runId:'observation-run',model:'offline/test'},{type:'proposal',proposal:{proposalId:'unexpected-proposal'}}]);}
      return new Response(JSON.stringify({csrf:'nonce',ready:true,model:'offline/test'}));
    }));
    const apply=vi.fn(()=>{throw Error('Unexpected edit');});const capture=vi.fn(async()=>({ok:false as const,code:'STUDIO_CAPTURE_NOT_VISIBLE',message:'Reveal the preview.'}));
    instance=mount(AgentChat,{target:document.body,props:{screenLabel:'Agent recovery',selectionLabel:'Screen',blocked:false,getContext:()=>({document:source,cursor,workspace:{workspaceView:observable?'design':'structure',mode:'design',observable,...(!observable?{reason:'preview-covered' as const}:{}),viewport:{model:'isolated-viewport',width:400,height:600,devicePixelRatio:1,scrollLeft:0,scrollTop:0}}}),applyProposal:apply,getCapture:capture}});
    await vi.waitFor(()=>expect(document.body.textContent).toContain('Ready'));await submit('Inspect header appearance');await vi.waitFor(()=>expect(document.querySelector<HTMLButtonElement>('.capture-retry')?.disabled).toBe(false));
    observable=false;document.querySelector<HTMLButtonElement>('.capture-retry')!.click();await new Promise(resolve=>setTimeout(resolve,20));expect(bodies).toHaveLength(1);
    observable=true;document.querySelector<HTMLButtonElement>('.capture-retry')!.click();await vi.waitFor(()=>expect(bodies).toHaveLength(2));expect(bodies[1]).toMatchObject({mode:'observe-only',observationTask:'Inspect header appearance',observationTarget:target,cursor});
    await vi.waitFor(()=>expect(document.querySelector('.agent-status')?.textContent).toContain('cannot apply edits'));expect(apply).not.toHaveBeenCalled();
    cursor={...cursor,revision:'r1#1'};document.querySelector<HTMLButtonElement>('.capture-retry')!.click();await new Promise(resolve=>setTimeout(resolve,20));expect(bodies).toHaveLength(2);expect(apply).not.toHaveBeenCalled();
  });
});
