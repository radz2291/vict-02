// @vitest-environment happy-dom
import {flushSync,mount,unmount} from 'svelte';
import {afterEach,expect,it,vi} from 'vitest';
import AgentChat from '../../src/lib/designer/AgentChat.svelte';
import {newScreen} from '../../src/lib/designer/application.js';
import {documentCursor} from '../../src/lib/designer/agent-edits.js';
import {STUDIO_TOOL_EVIDENCE_SCHEMA} from '../../src/lib/designer/tool-evidence.js';
let app:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(app)await unmount(app);app=undefined;document.body.innerHTML='';vi.unstubAllGlobals();});
async function setup(){
 let controller!:ReadableStreamDefaultController<Uint8Array>;
 const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>init?.method==='DELETE'?new Response('{}'):init?.method==='POST'?new Response(new ReadableStream<Uint8Array>({start(value){controller=value;init.signal?.addEventListener('abort',()=>value.error(new DOMException('Stopped','AbortError')),{once:true});}})):new Response(JSON.stringify({ready:true,csrf:'fixture',model:'fixture/model'})));
 vi.stubGlobal('fetch',fetcher);const source=newScreen('Quiet chat','quiet');
 app=mount(AgentChat,{target:document.body,props:{screenLabel:'Quiet chat',selectionLabel:'Screen',blocked:false,getContext:()=>({document:source,cursor:documentCursor(source,'r1#0',crypto.randomUUID())}),applyProposal:()=>{throw Error('No proposal');}}});
 await vi.waitFor(()=>expect(document.querySelector('.agent-status')?.textContent).toContain('Ready'));
 const input=document.querySelector<HTMLTextAreaElement>('textarea')!;
 const write=(text:string)=>{input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));flushSync();};
 write('Review my screen');document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 await vi.waitFor(()=>expect(controller).toBeDefined());
 return {input,write,fetcher,emit:(...events:unknown[])=>controller.enqueue(new TextEncoder().encode(events.map(e=>JSON.stringify(e)).join('\n')+'\n')),end:()=>controller.close()};
}
function evidence(sequence:number,callId:string,phase:'input'|'result',text:string,extra:Record<string,unknown>={}){return {type:'tool-evidence',schema:STUDIO_TOOL_EVIDENCE_SCHEMA,runId:'run',sequence,tool:'studio_screen_read',callId,phase,availability:'available',payload:{text,redacted:false,truncated:false},...(phase==='result'?{status:'completed'}:{}),...extra};}
const started={type:'started',runId:'run',model:'fixture/model'};
const call=(id:string,kind='tool-start')=>({type:'tool-event',id:`${id}-${kind}`,callId:id,tool:'studio_screen_read',kind,summary:kind==='tool-start'?'Tool started':'Read complete'});
it('keeps actual text and correlated tool exchanges in order, with mechanical metadata only in Chat details',async()=>{
 const {emit,end,fetcher}=await setup();
 emit(started,{type:'progress',message:'Connecting to the VICT / Mastra agent…'},{type:'text',delta:'I will review the layout.'},call('a'),evidence(1,'a','input','{"query":"source"}'),call('b'),evidence(2,'b','input','{"query":"components"}'),evidence(3,'b','result','{"ok":true,"items":2}'),call('b','observation'),{type:'text',delta:'The component lookup is ready.'},evidence(4,'a','result','{"ok":false,"code":"REFUSED"}',{status:'refused'}),call('a','validation-refused'),{type:'text',delta:'The source read was refused; your screen is unchanged.'},{type:'schema-diagnostic',id:'parse',evaluations:2,firstElapsedMs:2,lastElapsedMs:3,details:'Parser evidence'},{type:'done',status:'failed',applied:0,confirmedRevision:'r1#0',sourceEvidence:{nodeCount:1,stateCount:0,appearanceObserved:false}});end();
 await vi.waitFor(()=>expect(document.querySelector('[data-testid="conversation-stop"]')).toBeNull());
 const feed=document.querySelector('.vict-conversation')!;
 expect([...feed.querySelectorAll('[data-event-kind]')].map(n=>n.getAttribute('data-event-kind'))).toEqual(['text','activity','activity','text','text']);
 expect(feed.textContent).not.toMatch(/Progress summary|Confirmed progress|Connecting to|Confirmed revision|Parser evidence|Selected:/);
 const a=feed.querySelector<HTMLElement>('[data-event-id="attempt-studio_screen_read:a"]')!,b=feed.querySelector<HTMLElement>('[data-event-id="attempt-studio_screen_read:b"]')!;
 expect(a.textContent).toContain('failed');expect(b.textContent).toContain('completed');expect(a.querySelector('button')?.getAttribute('aria-expanded')).toBe('false');expect(b.querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
 a.querySelector<HTMLButtonElement>('button')!.click();b.querySelector<HTMLButtonElement>('button')!.click();flushSync();
 await vi.waitFor(()=>expect(a.querySelector('[aria-label="Tool result"]')?.textContent).toContain('REFUSED'));
 expect(a.querySelector('[aria-label="Tool input"]')?.textContent).toContain('"source"');expect(b.querySelector('[aria-label="Tool result"]')?.textContent).toContain('"items":2');
 const body=JSON.parse(fetcher.mock.calls.find(([,init])=>init?.method==='POST')![1]!.body as string);expect(body.toolEvidenceSchema).toBe(STUDIO_TOOL_EVIDENCE_SCHEMA);
 document.querySelector<HTMLButtonElement>('[aria-label="Chat details"]')!.click();flushSync();await vi.waitFor(()=>expect(document.body.textContent).toContain('Parser evidence'));
 expect(document.body.textContent).toContain('Confirmed revision r1#0');expect(document.body.textContent).toContain('Selected: Screen');
});
it('clears only the admitted request, preserves a new draft, and fences wrong-run, duplicate and post-completion results',async()=>{
 const {emit,end,input,write}=await setup();expect(input.value).toBe('Review my screen');emit(started,call('a'),evidence(1,'a','input','{"query":"source"}'));
 await vi.waitFor(()=>expect(input.value).toBe(''));write('My next request');
 emit(evidence(2,'a','result','WRONG RUN',{runId:'another-run'}),evidence(1,'a','result','DUPLICATE'),{type:'done',status:'completed',applied:0},evidence(3,'a','result','LATE RESULT'));end();
 await vi.waitFor(()=>expect(document.querySelector('[data-testid="conversation-stop"]')).toBeNull());expect(input.value).toBe('My next request');
 document.querySelector<HTMLButtonElement>('[data-event-kind="activity"] button')!.click();flushSync();
 await vi.waitFor(()=>expect(document.body.textContent).toContain('Result unavailable for this call.'));expect(document.body.textContent).not.toMatch(/WRONG RUN|DUPLICATE|LATE RESULT/);
});
it('retains all admitted text and calls beyond the old 240-entry display cap',async()=>{
 const {emit,end}=await setup();const events:unknown[]=[started];for(let i=0;i<125;i++)events.push({type:'text',delta:`Statement ${i}.`},call(`call-${i}`),call(`call-${i}`,'observation'));events.push({type:'text',delta:'All checks reported.'},{type:'done',status:'completed',applied:0});emit(...events);end();
 await vi.waitFor(()=>expect(document.querySelectorAll('[data-event-kind="activity"]')).toHaveLength(125),{timeout:15000});
 expect(document.querySelectorAll('[data-event-kind="text"]')).toHaveLength(126);expect(document.querySelector('[data-event-kind="compaction"]')).toBeNull();expect(document.querySelector('.vict-conversation')?.textContent).toContain('Statement 0.');expect(document.querySelector('.vict-conversation')?.textContent).toContain('All checks reported.');
},30000);
it('labels limited evidence honestly, escapes tool output, and retains the reader’s open choice as the result arrives',async()=>{
 const {emit,end}=await setup();emit(started,call('a'),evidence(1,'a','input','{"token":"[redacted]"}',{payload:{text:'{"token":"[redacted]"}',redacted:true,truncated:true}}));
 await vi.waitFor(()=>expect(document.querySelector('[data-event-kind="activity"] button')).not.toBeNull());
 const trigger=document.querySelector<HTMLButtonElement>('[data-event-kind="activity"] button')!;trigger.click();flushSync();await vi.waitFor(()=>expect(trigger.getAttribute('aria-expanded')).toBe('true'));
 emit(evidence(2,'a','result','<script>unsafe()</script>'),call('a','observation'),{type:'text',delta:'Review finished.'},{type:'done',status:'completed',applied:0});end();
 await vi.waitFor(()=>expect(document.querySelector('[data-testid="conversation-stop"]')).toBeNull());
 expect(trigger.getAttribute('aria-expanded')).toBe('true');expect(document.body.textContent).toContain('Sensitive values redacted');expect(document.body.textContent).toContain('Content truncated');expect(document.querySelector('[aria-label="Tool result"]')?.textContent).toContain('<script>unsafe()</script>');expect(document.querySelector('[aria-label="Tool result"] script')).toBeNull();
});
