import {mount,unmount,flushSync,tick} from 'svelte';
import {expect,it,vi} from 'vitest';
import EditorCanvas from '../src/EditorCanvas.svelte';
import Layers from '../src/Layers.svelte';
import {compileUiDocument,defaultSemanticElementCatalog,type UiDocument} from '@victframework/ui';
function fixture():UiDocument{return {schema:'vict.ui-document@1',id:'multi',revision:'1',root:'root',nodes:{root:{id:'root',kind:'element',tag:'main',children:['a','b','c']},a:{id:'a',kind:'element',tag:'input',attributes:{'aria-label':'A'},children:[]},b:{id:'b',kind:'element',tag:'input',attributes:{'aria-label':'B'},children:[]},c:{id:'c',kind:'element',tag:'input',attributes:{'aria-label':'C'},children:[]}},componentDefinitions:{},localState:{},styleSources:{},tokens:{},conditions:{},assets:{}};}
async function settle(){flushSync();await tick();await tick();}
it('emits a single Ctrl intent for the full pointer gesture and marks exact occurrences for this canvas only',async()=>{
 const source=fixture(),target=document.createElement('div');document.body.append(target);const intent=vi.fn(),legacy=vi.fn(),dispatch=vi.fn(async()=>undefined);
 const app=mount(EditorCanvas,{target,props:{document:source,interactionMode:'design',selectedOccurrences:['multi|a','multi|b'],onSelectionIntent:intent,onSelect:legacy,dispatch,navigate:vi.fn()}});
 try{await settle();expect(target.querySelectorAll('[data-ui-selected]')).toHaveLength(2);const input=target.querySelector('input')!;
 input.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,ctrlKey:true}));input.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true,detail:1}));
 expect(intent).toHaveBeenCalledExactlyOnceWith({occurrences:['multi|a'],primary:'multi|a',operation:'toggle'});expect(legacy).not.toHaveBeenCalled();expect(dispatch).not.toHaveBeenCalled();
 }finally{await unmount(app);target.remove();}
});
it('emits ranges in visible order and uses additive range semantics with Ctrl+Shift',async()=>{
 const source=fixture(),compiled=compileUiDocument(source,defaultSemanticElementCatalog());expect(compiled.ok).toBe(true);if(!compiled.ok)return;
 const target=document.createElement('div');document.body.append(target);const intent=vi.fn();const app=mount(Layers,{target,props:{document:source,plan:compiled.plan,selectedOccurrences:['multi|a','multi|b'],onSelectionIntent:intent}});
 try{await settle();const row=(key:string)=>target.querySelector<HTMLButtonElement>(`[data-key="multi|${key}"]`)!;row('a').click();row('c').dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true,ctrlKey:true}));
 expect(intent.mock.calls.at(-1)?.[0]).toEqual({occurrences:['multi|a','multi|b','multi|c'],primary:'multi|c',operation:'add'});expect(row('root').getAttribute('aria-selected')).toBe('false');expect(target.querySelector('[role=tree]')?.getAttribute('aria-multiselectable')).toBe('true');
 }finally{await unmount(app);target.remove();}
});
