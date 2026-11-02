// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
vi.mock('$app/navigation',()=>({beforeNavigate:()=>{}}));
import Designer from '../../src/lib/designer/Designer.svelte';
import {newScreen} from '../../src/lib/designer/application.js';
import {screenStore} from '../../src/lib/designer/storage.js';
import {workspaceControl,openStudioMenu} from './studio-menu.js';
import type {UiDocument} from '@victframework/ui';
let editor:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(editor)await unmount(editor);editor=undefined;document.body.innerHTML='';localStorage.clear();});
async function settle(){flushSync();await tick();await tick();}
async function click(name:string){const control=workspaceControl(name);expect(control,name).toBeDefined();control!.click();await settle();}
async function preview(){
 const frame=document.querySelector<HTMLIFrameElement>('iframe[data-application-viewport="isolated"]')!;
 await vi.waitFor(()=>expect(frame.contentDocument?.querySelector('.uv-canvas')).not.toBeNull());
 return frame.contentDocument!;
}
async function canonical(){
 if(workspaceControl('Document')!.getAttribute('aria-expanded')!=='true')await click('Document');
 document.querySelector<HTMLButtonElement>('[data-context=document]')!.click();await settle();
 if(!document.querySelector('#canonical-source'))await click('Source');
 return document.querySelector<HTMLTextAreaElement>('#canonical-source')!.value;
}
async function start(){
 const seed=newScreen('View transitions','view-transitions');
 const source:UiDocument={...seed,localState:{...seed.localState,message:{key:'message',type:'string',initial:'Initial runtime value'}},revision:'r1.r1',nodes:{
  screen:{id:'screen',kind:'element',tag:'main',children:['heading','field','mirror']},
  heading:{id:'heading',kind:'element',tag:'h1',children:['text']},text:{id:'text',kind:'text',content:{type:'literal',value:'Keep this title'}},
  field:{id:'field',kind:'element',tag:'input',children:[],attributes:{type:'text','aria-label':'Live value',value:{type:'ref',path:'state.message'}},interactions:[{on:'change',action:'setState',key:'message',value:{type:'ref',path:'state.message'}}]},
  mirror:{id:'mirror',kind:'element',tag:'p',attributes:{'aria-label':'Runtime echo'},children:['message-value']},'message-value':{id:'message-value',kind:'text',content:{type:'expression',expression:{type:'ref',path:'state.message'}}},
 }};
 expect(screenStore(localStorage,source.id).save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);
 editor=mount(Designer,{target:document.body});await settle();return source;
}
it('makes Structure the third primary view, with one visible work surface and no View-menu or bottom-dock launcher',async()=>{
 const source=await start();const canvas=document.querySelector<HTMLElement>('.canvas-scroll')!,graph=document.querySelector('.svelte-flow');
 expect([...document.querySelectorAll('.canvas-modes button')].map(node=>node.textContent)).toEqual(['Design','Interact','Structure']);
 await openStudioMenu('View');expect(document.querySelectorAll('[role=menuitemcheckbox]')).toHaveLength(0);
 for(const name of ['Chat','Document'])expect(workspaceControl(name)).toBeDefined();
 expect([...document.querySelectorAll('[role=menuitemradio]')].map(node=>node.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Fit canvas'),expect.stringContaining('Tablet'),expect.stringContaining('Phone')]));
 document.querySelector('[role=menu]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();
 await click('Structure');expect(canvas.hidden).toBe(true);expect(canvas.inert).toBe(true);expect(document.querySelector<HTMLElement>('.structure-workspace')!.hidden).toBe(false);
 expect(document.querySelector('.structure-dock')).toBeNull();expect(document.querySelector('[aria-label="Structure panel height"]')).toBeNull();
 const search=document.querySelector<HTMLInputElement>('[aria-label="Search structure"]')!;search.value='screen';search.dispatchEvent(new Event('input',{bubbles:true}));await settle();canvas.scrollTop=81;
 await click('Design');expect(canvas.hidden).toBe(false);expect(canvas.inert).toBe(false);await click('Structure');expect(search.value).toBe('screen');expect(document.querySelector('.svelte-flow')).toBe(graph);expect(canvas.scrollTop).toBe(81);
 expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('does not restart Interact values or mutate saved source when visiting Structure',async()=>{
 const source=await start();await click('Interact');const app=await preview(),input=app.querySelector<HTMLInputElement>('input[aria-label="Live value"]')!;
 input.value='Temporary running value';input.dispatchEvent(new Event('change',{bubbles:true}));await settle();
 expect(app.querySelector('[aria-label="Runtime echo"]')!.textContent).toBe('Temporary running value');
 const before=await canonical();
 await click('Structure');await click('Interact');expect(app.querySelector('input[aria-label="Live value"]')).toBe(input);expect(input.value).toBe('Temporary running value');
 expect(app.querySelector('[aria-label="Runtime echo"]')!.textContent).toBe('Temporary running value');
 expect(await canonical()).toBe(before);expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('retains a pending floating text draft through Structure and restores the same editor on returning to Design',async()=>{
 const source=await start(),app=await preview();app.querySelector('h1')!.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));await settle();
 const draft=app.querySelector<HTMLTextAreaElement>('[aria-label="Text content"]')!;expect(draft).not.toBeNull();draft.value='Unapplied title';draft.dispatchEvent(new Event('input',{bubbles:true}));await settle();
 await click('Structure');expect(document.querySelector('.studio-designer')?.getAttribute('data-workspace-view')).toBe('structure');
 await click('Design');expect(app.querySelector('[aria-label="Text content"]')).toBe(draft);expect(draft.value).toBe('Unapplied title');expect(app.querySelector('h1')!.textContent).toBe('Keep this title');
 draft.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true}));await settle();expect(app.querySelector('h1')!.textContent).toBe('Unapplied title');
 expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('retains and protects a pending Source draft while visiting Structure and returning to its canvas mode',async()=>{
 await start();await click('Document');await click('Source');const draft=document.querySelector<HTMLTextAreaElement>('#canonical-source')!;draft.value+=' ';draft.dispatchEvent(new Event('input',{bubbles:true}));await settle();const exact=draft.value;
 await click('Document');await click('Structure');await click('Design');expect(draft.value).toBe(exact);
 await click('Interact');expect(workspaceControl('Design')?.getAttribute('aria-pressed')).toBe('true');
 await click('Document');expect(document.querySelector('#canonical-source')).toBe(draft);expect(draft.value).toBe(exact);await click('Discard draft');await click('Interact');expect(workspaceControl('Interact')?.getAttribute('aria-pressed')).toBe('true');
});
it('keeps retained floating-tool shortcuts from claiming Structure keyboard focus or Escape',async()=>{
 await start();const app=await preview();app.querySelector('h1')!.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));await settle();
 expect(app.querySelector('[aria-label="Floating selection tools"]')).not.toBeNull();await click('Structure');
 const search=document.querySelector<HTMLInputElement>('[aria-label="Search structure"]')!;search.focus();
 const f10=new KeyboardEvent('keydown',{key:'F10',bubbles:true,cancelable:true});search.dispatchEvent(f10);await settle();expect(f10.defaultPrevented).toBe(true);expect(document.activeElement).toBe(search);
 search.value='heading';search.dispatchEvent(new Event('input',{bubbles:true}));await settle();search.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();
 expect(search.value).toBe('');expect(workspaceControl('Structure')?.getAttribute('aria-pressed')).toBe('true');expect(document.activeElement).toBe(search);
 search.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();expect(workspaceControl('Design')?.getAttribute('aria-pressed')).toBe('true');expect(document.activeElement).toBe(workspaceControl('Design'));
});
