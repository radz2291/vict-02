import {it,expect} from 'vitest';import {mount,unmount,flushSync} from 'svelte';import {DocumentHost} from '@victframework/ui-svelte';import {parseGraphV2} from '@victframework/ui-flow-svelte';import {createSource,compile,descriptors,implementations,contract} from './fixture';
const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,60));flushSync();};
it('uses the installed public host contract and a different ordinary registered control for isolated node parameter writes and portable reopen',async()=>{
expect(contract()).toMatchObject({schema:'vict.flow-authoring@1',modelVersion:2,persistence:'explicit-bidirectional-state',body:{slot:'body',controlledState:'node-parameters'}});
const source=createSource(),writes:[string,unknown][]=[],diagnostics:unknown[]=[];
const target=document.createElement('div');document.body.append(target);
let app=mount(DocumentHost,{target,props:{plan:compile(source),localState:source.localState,extensionDescriptors:descriptors,extensionImplementations:implementations,dispatch:async()=>undefined,navigate:()=>{},onStateChange:(key,value)=>writes.push([key,value]),onRenderDiagnostic:issue=>diagnostics.push(issue)}});
try{await settle();expect(target.querySelectorAll('[data-consumer-control="decision"]')).toHaveLength(2);
const first=target.querySelector<HTMLSelectElement>('[data-graph-node="first"] select')!,second=target.querySelector<HTMLSelectElement>('[data-graph-node="second"] select')!;
expect(first.value).toBe('pending');expect(second.value).toBe('revise');expect(first.closest('[data-ui-owner]')).not.toBeNull();
first.value='approved';first.dispatchEvent(new Event('change',{bubbles:true}));await settle();
expect(writes.filter(([key])=>key==='reviewGraph')).toHaveLength(1);const saved=String(writes.at(-1)![1]);const parsed=parseGraphV2(saved);expect(parsed.ok).toBe(true);if(!parsed.ok)throw Error(JSON.stringify(parsed));
expect(parsed.graph.nodes.find(node=>node.id==='first')!.values.decision).toBe('approved');expect(parsed.graph.nodes.find(node=>node.id==='second')!.values.decision).toBe('revise');expect(second.value).toBe('revise');expect(diagnostics).toEqual([]);
await unmount(app);target.replaceChildren();const reopened=JSON.parse(JSON.stringify({...source,localState:{reviewGraph:{...source.localState.reviewGraph,initial:saved}}}));
app=mount(DocumentHost,{target,props:{plan:compile(reopened),localState:reopened.localState,extensionDescriptors:descriptors,extensionImplementations:implementations,dispatch:async()=>undefined,navigate:()=>{},onRenderDiagnostic:issue=>diagnostics.push(issue)}});await settle();expect(target.querySelector<HTMLSelectElement>('[data-graph-node="first"] select')!.value).toBe('approved');expect(target.querySelector<HTMLSelectElement>('[data-graph-node="second"] select')!.value).toBe('revise');expect(diagnostics).toEqual([]);
}finally{await unmount(app);target.remove();}
});