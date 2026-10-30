// @vitest-environment happy-dom
import { flushSync,mount,unmount } from 'svelte';
import { afterEach,describe,it,expect,vi } from 'vitest';
import AgentChat from '../../src/lib/designer/AgentChat.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { documentCursor } from '../../src/lib/designer/agent-edits.js';
import { PROVIDER_LIMIT_SCHEMA } from '../../src/lib/designer/provider-limit.js';
import { agentFailureMessage } from '../../src/lib/designer/agent-transport.js';
let instance:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(instance)await unmount(instance);instance=undefined;document.body.innerHTML='';vi.unstubAllGlobals();});
describe('truthful bounded provider status',()=>{
  it.each([['STUDIO_AGENT_PROVIDER_RATE_LIMIT','request rate'],['STUDIO_AGENT_PROVIDER_QUOTA','usage quota'],['STUDIO_AGENT_PROVIDER_SUBSCRIPTION','subscription'],['STUDIO_AGENT_PROVIDER_OVERLOAD','overload'],['STUDIO_AGENT_PROVIDER_LIMIT','unspecified']])('distinguishes %s without calling it a connection failure',(code,word)=>{expect(agentFailureMessage(code)).toContain(word);expect(agentFailureMessage(code)).not.toMatch(/connection|5.hour|recharge|upgrade/i);});
  it.each([false,true])('retains edit counts and shows only validated limit facts; injectRaw=%s',async injectRaw=>{
    const evidence={schema:PROVIDER_LIMIT_SCHEMA,kind:'quota',providerCode:'1310',httpStatus:429,observedAt:'2026-10-27T13:00:00.000Z',resetAt:'2026-10-28T00:00:00.000Z',resetSource:'zai-reset-message',...(injectRaw?{rawResponse:'RAW_SECRET_CANARY'}:{})};
    vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>init?.method==='POST'?new Response([{type:'started',runId:'limited-run',model:'simulated/zai'},{type:'done',status:'failed',code:'STUDIO_AGENT_PROVIDER_QUOTA',applied:2,providerLimit:evidence}].map(event=>JSON.stringify(event)).join('\n')+'\n'):new Response(JSON.stringify({csrf:'nonce',ready:true,model:'simulated/zai'}))));
    const source=newScreen('Provider facts','provider-facts');const cursor=documentCursor(source,'r1#0',crypto.randomUUID());instance=mount(AgentChat,{target:document.body,props:{screenLabel:'Provider facts',selectionLabel:'Screen',blocked:false,getContext:()=>({document:source,cursor}),applyProposal:()=>{throw Error('No proposal expected');}}});
    await vi.waitFor(()=>expect(document.body.textContent).toContain('Ready'));const input=document.querySelector<HTMLTextAreaElement>('[data-testid="conversation-input"]')!;input.value='Inspect source';input.dispatchEvent(new Event('input',{bubbles:true}));flushSync();document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await vi.waitFor(()=>expect(document.querySelector('.agent-status')?.textContent).toContain('usage quota'));expect(document.querySelector('.agent-status')?.textContent).toContain('2 applied edits remain undoable');expect(document.body.textContent).not.toContain('CANARY');
    document.querySelector<HTMLButtonElement>('[aria-label="Chat details"]')!.click();await vi.waitFor(()=>expect(document.querySelector('.studio-chat-details')).not.toBeNull());
    if(injectRaw)expect(document.querySelector('.studio-chat-details')?.textContent).not.toContain('Provider reported reset:');else expect(document.querySelector('.studio-chat-details')?.textContent).toContain('2026-10-28T00:00:00.000Z');expect(document.body.textContent).not.toContain('CANARY');
  });
});
