// @vitest-environment happy-dom
import {expect,it} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
import {StructureExplorer,structureId} from '@victframework/ui-structure-svelte';
import {bindingFixture} from '../../../../apps/studio/tests/fixtures/structure-semantics.js';

it('retains host presentation names in actual rendered conditional card summaries',async()=>{
 const base=bindingFixture(),source={...base,conditions:{consent:{id:'consent',kind:'localState' as const,when:{type:'ref' as const,path:'state.accepted'}}},nodes:{screen:{id:'screen',kind:'element' as const,tag:'main',children:['gate']},gate:{id:'gate',kind:'conditional' as const,branches:[{when:'consent',children:['leaf']}]},leaf:{id:'leaf',kind:'text' as const,content:{type:'literal' as const,value:'Conditional content'}}}};
 const before=JSON.stringify(source),target=document.createElement('div');document.body.append(target);
 const app=mount(StructureExplorer,{target,props:{document:source,revision:source.revision,context:{presentation:{displayName:(kind,id)=>kind==='state'&&id==='accepted'?'Friendly consent':id}},onSelect:()=>{},onMove:()=>false,onNotice:()=>{}}});
 try{
  flushSync();await tick();await tick();flushSync();
  const card=[...target.querySelectorAll<HTMLElement>('.svelte-flow__node')].find(node=>node.dataset.id===structureId(source.id,'node','gate'));
  expect(card,'conditional card is actually rendered').toBeDefined();
  expect(card!.querySelector('.vict-source-summary')?.textContent).toContain('Friendly consent');
  expect(JSON.stringify(source)).toBe(before);
 }finally{await unmount(app);target.remove();}
});
