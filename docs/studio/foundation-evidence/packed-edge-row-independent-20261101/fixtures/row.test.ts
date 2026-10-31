import { expect, it } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { DocumentHost } from '@victframework/ui-svelte';
import { rowSource, compile, descriptors, implementations, registry } from './row-fixture';
const settle=async()=>{flushSync();await new Promise(resolve=>setTimeout(resolve,50));flushSync();};
async function open(version:1|2|3=3,options:Parameters<typeof rowSource>[1]={}){
 const source=rowSource(version,options),before=JSON.stringify(source),target=document.createElement('div');document.body.append(target);
 const writes:unknown[]=[],diagnostics:unknown[]=[];
 const app=mount(DocumentHost,{target,props:{plan:compile(source),localState:source.localState,extensionDescriptors:descriptors,extensionImplementations:implementations,dispatch:async()=>undefined,navigate:()=>{},onStateChange:(...args:unknown[])=>writes.push(args),onRenderDiagnostic:issue=>diagnostics.push(issue)}});
 await settle();return {target,writes,diagnostics,async close(){expect(JSON.stringify(source)).toBe(before);await unmount(app);target.remove();}};
}
it('discovers the installed exact row registration/renderer and declared semantics through the normal registry',()=>{
 expect(registry.ok,JSON.stringify(registry)).toBe(true);
 const row=registry.contracts.find(item=>item.descriptor.id==='vict.flow.port-row'&&item.descriptor.revision==='1')!;
 expect(row).toBeTruthy();expect(row.descriptor.props?.map(item=>item.name)).toEqual(['id','color','showType']);
 expect(row.descriptor.styleTargets).toEqual(['root','handle','socket','label','type']);expect(row.descriptor.outputs).toEqual([]);
 expect(row.rules).toEqual([{kind:'ancestorSlot',placements:[1,2,3].map(revision=>({definitionId:'vict.flow.workspace',revision:String(revision),slotName:'body'}))}]);
 expect(implementations.some(item=>item.extensionId===row.descriptor.id&&item.revision==='1'&&item.rendererImplementationId===row.descriptor.rendererImplementationId)).toBe(true);
});
it.each([1,2,3] as const)('renders row1 in real registered graph%s bodies using each current node port, without source writes',async version=>{
 const v=await open(version);try{
  expect(v.target.querySelectorAll('.graph-port-row')).toHaveLength(4);
  const input=v.target.querySelector<HTMLElement>('[data-node-port="alpha/incoming"]')!,output=v.target.querySelector<HTMLElement>('[data-node-port="beta/outgoing"]')!;
  expect(input.querySelector('.port-row-label')?.textContent).toBe('Source material');expect(input.querySelector('.port-row-type')?.textContent).toBe('text');
  expect(input.querySelector('.svelte-flow__handle-left.target')).not.toBeNull();
  expect(input.querySelector('[aria-label="input Source material: text"]')).not.toBeNull();
  expect(output.querySelector('.port-row-label')?.textContent).toBe('Local produced bytes');expect(output.querySelector('.port-row-type')?.textContent).toBe('number');
  expect(output.querySelector('.svelte-flow__handle-right.source')).not.toBeNull();
  expect(input.textContent).toContain('Own ordinary annotation');expect(v.writes).toEqual([]);expect(v.diagnostics).toEqual([]);
 }finally{await v.close();}
});
it('duplicate bare+row anchors refuse only the duplicated semantic port without inventing connections',async()=>{
 const v=await open(3,{duplicate:true});try{expect(v.target.querySelectorAll('[data-node-port$="/incoming"] .svelte-flow__handle')).toHaveLength(0);expect(v.target.querySelectorAll('.graph-port-row')).toHaveLength(2);expect(v.target.querySelectorAll('[role=alert]').length).toBeGreaterThan(0);expect(v.writes).toEqual([]);}finally{await v.close();}
});
it('missing ports and unsafe presentation colors stay diagnostic and do not become markup or source',async()=>{
 const a=await open(3,{missing:true});try{expect(a.target.querySelectorAll('.graph-port-row')).toHaveLength(2);expect(a.target.textContent).toContain('not-declared');expect(a.writes).toEqual([]);}finally{await a.close();}
 const b=await open(3,{unsafe:true,hideType:true});try{const row=b.target.querySelector('[data-node-port="alpha/incoming"]')!;expect(row.querySelector('.port-row-label')?.textContent).toBe('Source material');expect(row.querySelector('.port-row-type')).toBeNull();expect(row.querySelector('[role=alert]')).not.toBeNull();expect(row.outerHTML).not.toContain('https://invalid.example');expect(b.writes).toEqual([]);}finally{await b.close();}
});
it('read-only rows retain names/types while refusing connectable handles',async()=>{
 const v=await open(3,{readOnly:true});try{expect(v.target.querySelectorAll('.graph-port-row')).toHaveLength(4);expect(v.target.querySelectorAll('.svelte-flow__handle.connectable')).toHaveLength(0);expect(v.target.textContent).toContain('Local produced bytes');expect(v.writes).toEqual([]);}finally{await v.close();}
});
