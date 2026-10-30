// @vitest-environment happy-dom
import {expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
import {writable,fromStore} from 'svelte/store';
import type {UiDocument} from '@victframework/ui';
import EditorCanvas from '../src/EditorCanvas.svelte';
import {canvasSelectionTarget} from '../src/canvas-selection-target.js';
const fixture=():UiDocument=>({schema:'vict.ui-document@1',id:'text-location',revision:'r1',root:'root',nodes:{root:{id:'root',kind:'element',tag:'main',children:['label']},label:{id:'label',kind:'element',tag:'label',children:['text']},text:{id:'text',kind:'text',content:{type:'literal',value:'Work email'}}},componentDefinitions:{},localState:{},styleSources:{},tokens:{},conditions:{},assets:{}});
async function settle(){flushSync();await tick();await tick();}
const visible=(element:HTMLElement)=>Object.defineProperty(element,'getClientRects',{configurable:true,value:()=>[{width:120,height:20}]});
it('opts into a label marker while retaining the exact text occurrence, then clears it without source edits',async()=>{
 const source=fixture(),before=JSON.stringify(source),target=document.createElement('div');document.body.append(target);const selected=writable(['text-location|text']),values=fromStore(selected),signal=writable(0),refresh=fromStore(signal),onSelect=vi.fn();
 const app=mount(EditorCanvas,{target,props:{document:source,interactionMode:'design',textSelectionContainerHighlight:true,get selectedOccurrences(){return values.current;},get selectionHighlightSignal(){return refresh.current;},onSelect,dispatch:vi.fn(async()=>undefined),navigate:vi.fn()}});
 try{await settle();const label=target.querySelector<HTMLElement>('label')!,text=target.querySelector<HTMLElement>('[data-ui-node=text]')!;expect(label,target.innerHTML).not.toBeNull();visible(label);signal.set(1);await settle();await settle();
 expect(label.hasAttribute('data-ui-selected')).toBe(true);expect(label.getAttribute('data-ui-selection-proxy-for')).toBe('["text-location|text"]');expect(text.hasAttribute('data-ui-selected')).toBe(false);expect(text.dataset.uiOcc).toBe('text-location|text');expect(onSelect).not.toHaveBeenCalled();expect(values.current).toEqual(['text-location|text']);expect(JSON.stringify(source)).toBe(before);
 selected.set([]);await settle();expect(label.hasAttribute('data-ui-selected')).toBe(false);expect(label.hasAttribute('data-ui-selection-proxy-for')).toBe(false);
 }finally{await unmount(app);target.remove();}
});
it('keeps default exact targets, exact repeated keys, primary precedence and owner/hidden boundaries',()=>{
 const source=fixture(),root=document.createElement('div');root.innerHTML='<label data-ui-owner="a" data-ui-occ="text-location|label|row-a"><span data-ui-owner="a" data-ui-occ="text-location|text|row-a" style="display:contents">A</span></label><label data-ui-owner="a" data-ui-occ="text-location|label|row-b"><span data-ui-owner="a" data-ui-occ="text-location|text|row-b" style="display:contents">B</span></label>';document.body.append(root);
 try{const labels=[...root.querySelectorAll<HTMLElement>('label')],texts=[...root.querySelectorAll<HTMLElement>('span')],elements=[...root.querySelectorAll<HTMLElement>('[data-ui-occ]')];labels.forEach(visible);const occurrence='text-location|text|row-b';
 expect(canvasSelectionTarget(source,occurrence,elements)).toBe(texts[1]);expect(canvasSelectionTarget(source,occurrence,elements,true)).toBe(labels[1]);expect(canvasSelectionTarget(source,'text-location|text|removed',elements,true)).toBeUndefined();
 labels[1]!.style.display='none';expect(canvasSelectionTarget(source,occurrence,elements,true)).toBe(texts[1]);labels[1]!.style.display='';labels[1]!.dataset.uiOwner='foreign';expect(canvasSelectionTarget(source,occurrence,elements,true)).toBe(texts[1]);labels[1]!.dataset.uiOwner='a';
 texts[1]!.setAttribute('data-ui-primary','');visible(texts[1]!);expect(canvasSelectionTarget(source,occurrence,elements,true)).toBe(texts[1]);
 }finally{root.remove();}
});
