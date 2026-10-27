// @vitest-environment happy-dom
import {workspaceControl,wholeHierarchy} from './studio-menu.js';
import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick, flushSync, createRawSnippet } from 'svelte';
vi.mock('$app/navigation', () => ({ beforeNavigate: () => {} }));
import Designer from '../../src/lib/designer/Designer.svelte';
import StructureDock from '../../src/lib/designer/StructureDock.svelte';
import SourceDetails from '../../src/lib/designer/SourceDetails.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { screenStore } from '../../src/lib/designer/storage.js';
import { structureId } from '../../src/lib/designer/structure.js';
import { sourceCapabilities } from '../../src/lib/designer/workspace-context.js';
import type { UiDocument } from '@victframework/ui';
let editor: ReturnType<typeof mount> | undefined;
afterEach(async()=>{if(editor)await unmount(editor);editor=undefined;document.body.innerHTML='';localStorage.clear();});
const button=(name:string)=>workspaceControl(name)!;
async function settle(){flushSync();await tick();await tick();}
async function objectItem(name:string){const trigger=[...document.querySelectorAll<HTMLElement>('.structure-tools [role=menubar]>button')].find(node=>node.textContent==='Object')!;trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await settle();[...document.querySelectorAll<HTMLElement>('[role=menu] [role=menuitem]')].find(node=>node.textContent?.trim()===name)!.click();await settle();}
async function start(){
  const seed=newScreen('Context details','context-details');
  const source:UiDocument={...seed,revision:'r1.r1',nodes:{
    screen:{id:'screen',kind:'element',tag:'main',children:['first','second','field']},
    first:{id:'first',kind:'element',tag:'h1',children:['firstText']},firstText:{id:'firstText',kind:'text',content:{type:'literal',value:'First heading'}},
    second:{id:'second',kind:'element',tag:'h2',children:['secondText']},secondText:{id:'secondText',kind:'text',content:{type:'literal',value:'Second heading'}},
    field:{id:'field',kind:'element',tag:'input',attributes:{type:'text','aria-label':'Native field',value:{type:'ref',path:'state.message'}},children:[],interactions:[{on:'change',action:'setState',key:'message',value:{type:'ref',path:'state.message'}}]},
  }};
  expect(screenStore(localStorage,source.id).save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);
  editor=mount(Designer,{target:document.body});await settle();return source;
}
async function secondary(target:Element){
  target.dispatchEvent(new PointerEvent('pointerdown',{button:2,buttons:2,bubbles:true,cancelable:true,pointerType:'mouse'}));
  target.dispatchEvent(new PointerEvent('pointerup',{button:2,buttons:0,bubbles:true,cancelable:true,pointerType:'mouse'}));
  const menu=new MouseEvent('contextmenu',{button:2,clientX:170,clientY:120,bubbles:true,cancelable:true});target.dispatchEvent(menu);await settle();return menu;
}
it('targets a different object on the first complete secondary pointer sequence without revealing tools; reuses canonical duplicate/undo',async()=>{
  const source=await start();
  const first=document.querySelector<HTMLElement>('.design-frame h1')!,second=document.querySelector<HTMLElement>('.design-frame h2')!;
  first.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));await settle();
  expect(document.querySelector('[aria-label="Floating selection tools"]')).not.toBeNull();
  const menu=await secondary(second);expect(menu.defaultPrevented).toBe(true);
  expect(document.querySelector('.workspace-context-anchor')?.getAttribute('tabindex')).toBe('-1');
  expect(document.querySelector('[role="menu"][aria-label="Object commands"]')).not.toBeNull();
  expect(second.hasAttribute('data-ui-selected')).toBe(true);
  expect(document.querySelector('[aria-label="Floating selection tools"]')).toBeNull();
  button('Duplicate').click();await settle();
  expect(document.querySelectorAll('.design-frame h2')).toHaveLength(2);
  document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));await settle();
  expect(document.querySelectorAll('.design-frame h2')).toHaveLength(1);
  expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('empty canvas clears an old object target, supports Shift+F10, and leaves native/Interact menus alone',async()=>{
  await start();const heading=document.querySelector<HTMLElement>('.design-frame h2')!;
  await secondary(heading);document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();
  const canvas=document.querySelector<HTMLElement>('.canvas-scroll')!;await secondary(canvas);
  expect(document.querySelector('[role="menu"][aria-label="Canvas commands"]')).not.toBeNull();
  expect(button('Duplicate')).toBeUndefined();expect(document.querySelector('[data-ui-selected]')).toBeNull();
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();
  heading.focus();heading.dispatchEvent(new KeyboardEvent('keydown',{key:'F10',shiftKey:true,bubbles:true,cancelable:true}));await settle();
  expect(document.querySelector('[role="menu"][aria-label="Object commands"]')).not.toBeNull();
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();
  expect((await secondary(document.querySelector('input[aria-label="Native field"]')!)).defaultPrevented).toBe(false);
  expect(document.querySelector('[role="menu"][data-state="open"]')).toBeNull();
  const nativeKey=new KeyboardEvent('keydown',{key:'F10',shiftKey:true,bubbles:true,cancelable:true});document.querySelector('input[aria-label="Native field"]')!.dispatchEvent(nativeKey);await settle();expect(nativeKey.defaultPrevented).toBe(false);
  button('Interact').click();await settle();expect((await secondary(heading)).defaultPrevented).toBe(false);expect(document.querySelector('[role="menu"][data-state="open"]')).toBeNull();
});
it('keeps shared inspection in right Selection across canvas and graph while preserving editing home',async()=>{
  const source=await start(),frame=document.querySelector('.design-frame')!,scroll=document.querySelector<HTMLElement>('.canvas-scroll')!;
  document.querySelector('.design-frame h2')!.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));await settle();
  button('Document').click();await settle();document.querySelector<HTMLButtonElement>('[data-context=selection]')!.click();await settle();
  expect(document.querySelector('#document-drawer .source-details header strong')?.textContent).toBe('Second heading');
  button('Structure').click();await settle();await wholeHierarchy();const graph=document.querySelector('.svelte-flow')!;
  expect(document.querySelector('.structure-workspace .source-details')).toBeNull();expect(document.querySelector('#document-drawer .source-details')).not.toBeNull();
  scroll.scrollTop=83;scroll.scrollLeft=14;
  const node=document.querySelector<HTMLElement>(`[data-id="${structureId(source.id,'node','second')}"]`)!;node.click();await settle();await objectItem('Inspect');
  expect(document.querySelector('.source-details header strong')?.textContent).toBe('Second heading');expect(scroll.scrollTop).toBe(83);expect(scroll.scrollLeft).toBe(14);expect(document.querySelector('.design-frame')).toBe(frame);
  button('Close panel').click();await settle();button('Design').click();await settle();button('Structure').click();await settle();expect(document.querySelector('.svelte-flow')).toBe(graph);
  button('Toggle Document and Selection drawer').click();await settle();button('Edit on canvas ↗').click();await settle();expect(document.querySelector('[aria-label="Floating selection tools"]')).not.toBeNull();expect(document.querySelector<HTMLElement>('.canvas-scroll')!.inert).toBe(false);
});
it('keeps ambiguous repeated/definition occurrences inspectable without granting source edits',()=>{
  const document=newScreen('Capabilities','capabilities');
  expect(sourceCapabilities(document,`${document.id}|screen|row-1`).direct).toBe(false);
  expect(sourceCapabilities(document,`${document.id}|screen`).removable).toBe(false);
  expect(sourceCapabilities(document,'other|screen').direct).toBe(false);
});
it('contains narrow showcase inspection focus and keeps Escape available',async()=>{
  const close=vi.fn();
  editor=mount(SourceDetails,{target:document.body,props:{document:newScreen('Inspection focus','focus'),selectedId:structureId('focus','node','screen'),containFocus:true,onClose:close,onSelect:vi.fn(),onNavigate:vi.fn()}});await settle();
  const first=button('Close inspection details'),last=button('Technical information');
  expect(document.activeElement).toBe(first);
  first.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));await settle();expect(document.activeElement).toBe(last);
  last.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));await settle();expect(document.activeElement).toBe(first);
  first.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();expect(close).toHaveBeenCalledTimes(1);
});
it('refuses contextual source commands during a JSON draft and does not intercept outside this workspace',async()=>{
  await start();button('Document').click();await settle();button('Source').click();await settle();
  const draft=document.querySelector<HTMLTextAreaElement>('#canonical-source')!;draft.value+=' ';draft.dispatchEvent(new Event('input',{bubbles:true}));await settle();
  const exactDraft=draft.value;
  button('Structure').click();await settle();button('Design').click();await settle();
  expect(document.querySelector('#canonical-source')).toBe(draft);expect(draft.value).toBe(exactDraft);
  await secondary(document.querySelector('.design-frame h2')!);
  const duplicate=[...document.querySelectorAll<HTMLElement>('[role="menu"][data-state="open"] [role="menuitem"]')].find(node=>node.textContent?.trim()==='Duplicate')!;
  expect(duplicate.getAttribute('aria-disabled')).toBe('true');duplicate.click();await settle();
  expect(document.querySelectorAll('.design-frame h2')).toHaveLength(1);expect(draft.value.endsWith(' ')).toBe(true);
  const outside=document.createElement('p');document.body.append(outside);expect((await secondary(outside)).defaultPrevented).toBe(false);
});
it('keeps short-window splitter values and keyboard resize within the same dynamic bounds',async()=>{
  editor=mount(StructureDock,{target:document.body,props:{open:true,availableHeight:240,children:createRawSnippet(()=>({render:()=>'<p>Graph content</p>'}))}});await settle();
  const splitter=document.querySelector<HTMLElement>('[aria-label="Structure panel height"]')!;
  expect(splitter.getAttribute('aria-valuemin')).toBe('96');expect(splitter.getAttribute('aria-valuemax')).toBe('96');expect(splitter.getAttribute('aria-valuenow')).toBe('96');
  for(const key of ['ArrowUp','ArrowDown','Home','End']){splitter.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));await settle();expect(splitter.getAttribute('aria-valuenow')).toBe('96');}
});
it('explicitly hands Structure editing from Interact to visible Design floating tools',async()=>{
  const source=await start();button('Interact').click();await settle();button('Document').click();await settle();button('Structure').click();await settle();
  await wholeHierarchy();
  const node=[...document.querySelectorAll<HTMLElement>('.svelte-flow__node')].find(node=>node.dataset.id===structureId(source.id,'node','second'))!;
  node.click();await settle();await objectItem('Edit on canvas');
  expect(button('Design').getAttribute('aria-pressed')).toBe('true');
  expect(document.querySelector('[aria-label="Floating selection tools"]')).not.toBeNull();
});
