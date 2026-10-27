// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick, flushSync } from 'svelte';
vi.mock('$app/navigation',()=>({beforeNavigate:()=>{}}));
import Designer from '../../src/lib/designer/Designer.svelte';
import { newScreen } from '../../src/lib/designer/application.js';
import { screenStore } from '../../src/lib/designer/storage.js';
import type { UiDocument } from '@victframework/ui';
import { openStudioMenu,workspaceControl } from './studio-menu.js';
let editor:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(editor)await unmount(editor);editor=undefined;document.body.innerHTML='';localStorage.clear();});
const button=(name:string)=>workspaceControl(name)!;
async function settle(){flushSync();await tick();await tick();}
async function start(){
 const seed=newScreen('Test workspace','test-workspace');
 const source:UiDocument={...seed,revision:'r1.r1',nodes:{
 screen:{id:'screen',kind:'element',tag:'main',children:['heading','field','submit','error']},
 heading:{id:'heading',kind:'element',tag:'h1',children:['title']},title:{id:'title',kind:'text',content:{type:'literal',value:'Test screen'}},
 field:{id:'field',kind:'element',tag:'input',children:[],attributes:{type:'text','aria-label':'Example field',value:{type:'ref',path:'state.message'}}},
 submit:{id:'submit',kind:'element',tag:'button',children:['submitText'],attributes:{disabled:{type:'ref',path:'state.busy'}},interactions:[{on:'click',action:'invokeAction',actionId:'demo.submit',input:{message:{type:'ref',path:'state.message'},accepted:{type:'literal',value:true}}}]},
 submitText:{id:'submitText',kind:'text',content:{type:'literal',value:'Submit example'}},
 error:{id:'error',kind:'text',content:{type:'expression',expression:{type:'ref',path:'state.actionError'}}},
 }};
 expect(screenStore(localStorage,source.id).save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);
 editor=mount(Designer,{target:document.body});await settle();return source;
}
async function testing(){await openStudioMenu('Preview');button('Try scenarios…').click();await settle();}
function choose(name:string){[...document.querySelectorAll<HTMLButtonElement>('.scenario-choice')].find(choice=>choice.querySelector('strong')?.textContent===name)!.click();}
it('offers plain scenarios outside Document, resets each test, preserves source and restores Document context on close',async()=>{
 const source=await start();button('Document').click();await settle();
 expect([...document.querySelectorAll('.document-section-header')].map(button=>button.textContent)).toEqual(['Layers','Data','Actions','Source']);
 expect(document.querySelector('[role=tablist][aria-label="Panel context"]')).not.toBeNull();
 await testing();expect(document.querySelector('.testing-drawer')).not.toBeNull();choose('Loading');await settle();
 expect(button('Submit example').hasAttribute('disabled')).toBe(true);
 choose('Long content');await settle();expect(button('Submit example').hasAttribute('disabled')).toBe(false);
 expect((document.querySelector('[aria-label="Example field"]') as HTMLInputElement).value.length).toBeGreaterThan(100);
 expect(button('Testing: Long content')).toBeDefined();
 button('Close testing').click();await settle();expect(document.querySelector<HTMLElement>('#document-drawer')!.hidden).toBe(false);
 expect(document.activeElement?.textContent).toBe('View');
 expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('invalidates an in-flight failed action before another scenario can be overwritten',async()=>{
 await start();await testing();choose('Something went wrong');await settle();button('Try on canvas').click();await settle();
 button('Submit example').click();await settle();expect(button('Submit example').hasAttribute('disabled')).toBe(true);
 await testing();choose('Long content');await settle();
 await new Promise(resolve=>setTimeout(resolve,550));await settle();
 expect(document.querySelector('.testing-body')!.textContent).not.toContain('Simulated service failure');
 expect(button('Submit example').hasAttribute('disabled')).toBe(false);
 expect((document.querySelector('[aria-label="Example field"]') as HTMLInputElement).value.length).toBeGreaterThan(100);
});
it('lets the new Loading seed win over cleanup from a pending action',async()=>{
 await start();await testing();choose('Something went wrong');await settle();button('Try on canvas').click();await settle();
 button('Submit example').click();await settle();
 await testing();choose('Loading');await settle();
 expect(button('Submit example').hasAttribute('disabled')).toBe(true);
 await new Promise(resolve=>setTimeout(resolve,550));await settle();
 expect(button('Submit example').hasAttribute('disabled')).toBe(true);
 expect(button('Testing: Loading')).toBeDefined();
});
it('does not apply canvas delete/duplicate shortcuts from side-panel controls and keeps resizing preferences',async()=>{
 await start();const heading=document.querySelector<HTMLElement>('.design-frame h1')!;heading.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true}));await settle();
 button('Document').click();await settle();
 const close=button('Close panel');close.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true}));await settle();expect(document.querySelector('.design-frame h1')).not.toBeNull();
 const chatSize=document.querySelector<HTMLElement>('[aria-label="Chat width"]')!;chatSize.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));await settle();expect(JSON.parse(localStorage.getItem('vict.studio.workspace-sizes')!).chat).toBe(240);
});
