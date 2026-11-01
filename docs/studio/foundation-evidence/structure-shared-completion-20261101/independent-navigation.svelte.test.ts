// @vitest-environment happy-dom
import {expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
import {StructureExplorer,structureId} from '@victframework/ui-structure-svelte';
import {bindingFixture} from '../../../../apps/studio/tests/fixtures/structure-semantics.js';

async function settle(){flushSync();await tick();await tick();flushSync();}
async function objectMenu(onNavigate?: (...args:unknown[])=>void){
 const source=bindingFixture(),target=document.createElement('div');document.body.append(target);
 const app=mount(StructureExplorer,{target,props:{document:source,revision:source.revision,onSelect:()=>{},onMove:()=>false,onNotice:()=>{},onNavigate}});
 await settle();
 const card=[...target.querySelectorAll<HTMLElement>('.svelte-flow__node')].find(node=>node.dataset.id===structureId(source.id,'node','field'));
 expect(card).toBeDefined();card!.click();await settle();
 const object=[...target.querySelectorAll<HTMLElement>('.structure-tools [role=menubar]>button')].find(node=>node.textContent==='Object');
 expect(object).toBeDefined();object!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await settle();
 return {source,target,app,items:[...document.querySelectorAll<HTMLElement>('[role=menu] [role^=menuitem]')],async close(){await unmount(app);target.remove();}};
}
it('does not advertise host destinations when the standalone caller supplies no navigation callback',async()=>{
 const view=await objectMenu();try{
  const names=view.items.map(item=>item.textContent?.trim());expect(names).toContain('Inspect');expect(names).toContain('Move inside…');
  for(const name of ['Reveal in Layers','Show in Design','Edit on canvas','Edit in Data','Open Actions'])expect(names).not.toContain(name);
 }finally{await view.close();}
});
it('retains source-aware host navigation when its callback is supplied',async()=>{
 const navigate=vi.fn(),view=await objectMenu(navigate);try{
  const reveal=view.items.find(item=>item.textContent?.trim()==='Reveal in Layers');expect(reveal).toBeDefined();
  reveal!.click();await settle();expect(navigate).toHaveBeenCalledWith(expect.objectContaining({destination:'layers',sourceId:'field'}));
 }finally{await view.close();}
});
