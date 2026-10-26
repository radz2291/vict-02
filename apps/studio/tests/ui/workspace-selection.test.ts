// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {flushSync,mount,tick,unmount} from 'svelte';
vi.mock('$app/navigation',()=>({beforeNavigate:()=>{}}));
import Designer from '../../src/lib/designer/Designer.svelte';
import {newScreen} from '../../src/lib/designer/application.js';
import {screenStore} from '../../src/lib/designer/storage.js';
import {structureId} from '../../src/lib/designer/structure.js';
import {workspaceControl} from './studio-menu.js';
import type {UiDocument} from '@victframework/ui';
let instance:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(instance)await unmount(instance);instance=undefined;document.body.innerHTML='';localStorage.clear();});
async function settle(){flushSync();await tick();await tick();}
async function start(nested=false){const seed=newScreen('Shared selection','shared-selection');let source:UiDocument={...seed,revision:'r1.r1',nodes:{
 screen:{id:'screen',kind:'element' as const,tag:'main',children:['first','second','field']},
 first:{id:'first',kind:'element' as const,tag:'h1',children:['firstText']},firstText:{id:'firstText',kind:'text' as const,content:{type:'literal' as const,value:'First'}},
 second:{id:'second',kind:'element' as const,tag:'h2',children:['secondText']},secondText:{id:'secondText',kind:'text' as const,content:{type:'literal' as const,value:'Second'}},
 field:{id:'field',kind:'element' as const,tag:'input',attributes:{'aria-label':'Name',value:{type:'ref' as const,path:'state.message'}},children:[],interactions:[{on:'change' as const,action:'setState' as const,key:'message',value:{type:'ref' as const,path:'state.message'}}]},
 }};if(nested)source={...source,nodes:{...source.nodes,screen:{id:'screen',kind:'element',tag:'main',children:['section']},section:{id:'section',kind:'element',tag:'section',children:['first','second','nameLabel','field']},nameLabel:{id:'nameLabel',kind:'element',tag:'label',attributes:{for:'field'},children:['labelText']},labelText:{id:'labelText',kind:'text',content:{type:'literal',value:'Name'}}}};
 expect(screenStore(localStorage,source.id).save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);instance=mount(Designer,{target:document.body});await settle();return source;}
function button(name:string){const found=workspaceControl(name)??[...document.querySelectorAll<HTMLButtonElement>('button')].find(e=>e.getAttribute('aria-label')===name||e.textContent?.trim()===name);expect(found,name).toBeDefined();return found!;}
async function pointer(element:Element,ctrl=false){element.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,ctrlKey:ctrl,button:0}));await settle();}
async function layers(){button('Document').click();await settle();document.querySelector<HTMLButtonElement>('[data-context=document]')?.click();await settle();}
it('shares Ctrl canvas selection with Layers, compares it in Selection and leaves source untouched',async()=>{
 const source=await start();await pointer(document.querySelector('.design-frame h1')!);await pointer(document.querySelector('.design-frame h2')!,true);
 expect(document.querySelectorAll('.design-frame [data-ui-selected]')).toHaveLength(2);expect(document.querySelector('[aria-label="Floating selection tools"]')).toBeNull();
 await layers();expect(document.querySelectorAll('[role=treeitem][aria-selected=true]')).toHaveLength(2);
 document.querySelector<HTMLButtonElement>('[data-context=selection]')!.click();await settle();expect(document.querySelector('.workspace-selection-details header')?.textContent).toBe('2 nodes');expect(document.querySelector('[aria-label="Shared properties"]')?.textContent).toContain('Mixed');
 expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('selects a visible layer range and toggles only the requested member',async()=>{
 const source=await start();await layers();const row=(id:string)=>[...document.querySelectorAll<HTMLButtonElement>('[role=treeitem]')].find(e=>e.dataset.key===`${source.id}|${id}`)!;
 row('first').click();await settle();row('field').dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true}));await settle();
 expect(document.querySelectorAll('[role=treeitem][aria-selected=true]')).toHaveLength(3);expect(document.querySelectorAll('.design-frame [data-ui-selected]')).toHaveLength(3);
 row('second').dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));await settle();expect(document.querySelectorAll('[role=treeitem][aria-selected=true]')).toHaveLength(2);
 expect(row('screen').getAttribute('aria-selected')).toBe('false');
});
it('inspects socket-selected connections and a mixed Ctrl-node set without captions or source edits',async()=>{
 const source=await start();await pointer(document.querySelector('.design-frame input')!);button('Structure').click();await settle();
 button('Select incoming Value connections for Name').click();await settle();button('Selection panel').click();await settle();
 expect(document.querySelector('.workspace-selection-details header')?.textContent).toBe('Connection');expect(document.querySelector('.workspace-selection-details dl')?.textContent).toContain('Value');expect(document.querySelectorAll('.studio-edge-caption')).toHaveLength(0);
 button('Select outgoing Updates connections for Name').dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));await settle();
 const field=document.querySelector<HTMLElement>(`.structure-workspace [data-id="${structureId(source.id,'node','field')}"]`)!;
 field.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));await settle();expect(document.querySelector('.workspace-selection-details header')?.textContent).toContain('1 node · 2 connections');
 expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('blocks a socket or Ctrl-node selection change while a source draft is pending',async()=>{
 const source=await start();await pointer(document.querySelector('.design-frame input')!);button('Structure').click();await settle();button('Document').click();await settle();button('Source').click();await settle();
 const text=document.querySelector<HTMLTextAreaElement>('#canonical-source')!;text.value+=' ';text.dispatchEvent(new Event('input',{bubbles:true}));await settle();
 button('Select incoming Value connections for Name').click();await settle();
 expect(document.querySelector('.structure-tools')?.textContent).toContain('1 selected');expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('reveals a nested focus and its connections when its parent was initially collapsed',async()=>{
 const source=await start(true);await pointer(document.querySelector('.design-frame input')!);button('Structure').click();await settle();
 expect(button('Select incoming Value connections for Name')).toBeDefined();expect(button('Select outgoing Updates connections for Name')).toBeDefined();
 expect(document.querySelectorAll('.structure-workspace .svelte-flow__node').length).toBeGreaterThan(1);
 button('Select incoming Value connections for Name').click();await settle();
 expect(document.querySelector('.structure-tools')?.textContent).toContain('1 selected');
 expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('distinguishes equally named label and input members with quiet types',async()=>{
 const source=await start(true);await pointer(document.querySelector('.design-frame label')!);await pointer(document.querySelector('.design-frame input')!,true);
 await layers();document.querySelector<HTMLButtonElement>('[data-context=selection]')!.click();await settle();
 const members=[...document.querySelectorAll('.selection-items .inspect-item')];expect(members).toHaveLength(2);
 expect(members.map(item=>item.querySelector('.item-type')?.textContent)).toEqual(['Label','Input']);expect(members.every(item=>item.textContent?.includes('Name'))).toBe(true);
 expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
