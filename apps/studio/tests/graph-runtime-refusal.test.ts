// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {flushSync,mount,unmount} from 'svelte';
import type {UiDocument,UiValue} from '@victframework/ui';
import {graphFoundationExample} from '../src/lib/designer/foundation-examples.js';
import {graphRuntimeChanged} from '../src/lib/designer/graph-runtime.js';
import FoundationConsumer from './fixtures/FoundationConsumer.svelte';

let consumer:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(consumer)await unmount(consumer);consumer=undefined;document.body.replaceChildren();});
const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,25));flushSync();};

it('rolls back the renderer state after a valid graph edit is refused, even when canonical state was already supplied',async()=>{
  const original=graphFoundationExample();
  const source:UiDocument={...original,localState:{...original.localState,query:{key:'query',type:'string',initial:''}}};
  const canonical=source.localState.graph!.initial;
  let values:Record<string,UiValue>={graph:canonical,query:'retain unrelated draft'},signal=0;
  // Studio apply refuses while either a source or property draft is dirty.
  const applyGraph=vi.fn((_next:UiDocument)=>false),invalid=vi.fn();
  const callback=vi.fn((key:string,value:UiValue)=>graphRuntimeChanged(source,key,value,{
    values,applyGraph,invalid,
    reset:()=>{signal++;},
    supply:next=>{values=next;consumer?.updateRuntime(values,signal);},
  }));
  consumer=mount(FoundationConsumer,{target:document.body,props:{source,stateValues:values,resetSignal:signal,onStateChange:callback}});
  await settle();
  const selector='[data-graph-node="observe"] [data-field="notes"] textarea';
  const textarea=document.querySelector<HTMLTextAreaElement>(selector)!;
  expect(textarea).toBeTruthy();const before=textarea.value;
  textarea.value='Refused edit must disappear';textarea.dispatchEvent(new Event('change',{bubbles:true}));
  await settle();
  expect(callback).toHaveBeenCalledOnce();expect(applyGraph).toHaveBeenCalledOnce();expect(invalid).not.toHaveBeenCalled();
  const proposed=JSON.parse(String(applyGraph.mock.calls[0]![0].localState.graph!.initial));
  expect(proposed.nodes.find((node:{id:string})=>node.id==='observe').values.notes).toBe('Refused edit must disappear');
  expect(document.querySelector<HTMLTextAreaElement>(selector)!.value).toBe(before);
  expect(source.localState.graph!.initial).toBe(canonical);expect(values.graph).toBe(canonical);
  expect(values.query).toBe('retain unrelated draft');expect(signal).toBe(1);
});
