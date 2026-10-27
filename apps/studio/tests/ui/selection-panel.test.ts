// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
vi.mock('$app/navigation',()=>({beforeNavigate:()=>{}}));
import Designer from '../../src/lib/designer/Designer.svelte';
import {newScreen} from '../../src/lib/designer/application.js';
import {screenStore} from '../../src/lib/designer/storage.js';
import {workspaceControl} from './studio-menu.js';
let editor:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(editor)await unmount(editor);editor=undefined;document.body.innerHTML='';localStorage.clear();});
async function settle(){flushSync();await tick();await tick();}
async function click(name:string){const control=workspaceControl(name);expect(control,name).toBeDefined();control!.click();await settle();}
async function start(){const seed=newScreen('Panel review','panel-review');const source={...seed,revision:'r1.r1',nodes:{...seed.nodes,screen:{id:'screen',kind:'element' as const,tag:'main',children:['title','field']},title:{id:'title',kind:'element' as const,tag:'h1',children:['text']},text:{id:'text',kind:'text' as const,content:{type:'literal' as const,value:'A title'}},field:{id:'field',kind:'element' as const,tag:'input',children:[],attributes:{'aria-label':'Review field',value:{type:'ref' as const,path:'state.message'}}}}};expect(screenStore(localStorage,source.id).save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);editor=mount(Designer,{target:document.body});await settle();}
async function select(selector:string){document.querySelector(selector)!.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));await settle();}
async function context(name:'document'|'selection'){document.querySelector<HTMLButtonElement>(`#document-drawer [data-context=${name}]`)!.click();await settle();}
it('shares one right Selection across canvas and graph, without relocating floating Format or forcing Structure',async()=>{
 await start();await select('.design-frame input');const floating=document.querySelector('.floating-selection');await click('Document');await context('selection');
 expect(document.querySelector('#document-drawer .source-details header strong')?.textContent).toBe('Review field');expect(workspaceControl('Design')?.getAttribute('aria-pressed')).toBe('true');expect(document.querySelector('#document-drawer .floating-selection')).toBeNull();expect(document.querySelector('.floating-selection')).toBe(floating);
 await select('.design-frame h1');expect(document.querySelector('#document-drawer .source-details header strong')?.textContent).toBe('A title');
 await click('Structure');expect(document.querySelector('.structure-workspace .source-details')).toBeNull();expect(document.querySelector('#document-drawer .source-details')).not.toBeNull();expect(document.querySelector('[aria-label="Structure inspection width"]')).toBeNull();
 await click('Close panel');await click('Selection panel');expect(document.querySelector<HTMLElement>('#document-drawer')?.hidden).toBe(false);expect(document.querySelector('[data-context=selection]')?.getAttribute('aria-selected')).toBe('true');
});
it('keeps Document selected while selection changes and preserves a hidden Source draft across contexts',async()=>{
 await start();await click('Document');await select('.design-frame input');expect(document.querySelector('[data-context=document]')?.getAttribute('aria-selected')).toBe('true');await click('Source');const draft=document.querySelector<HTMLTextAreaElement>('#canonical-source')!;draft.value+=' ';draft.dispatchEvent(new Event('input',{bubbles:true}));await settle();const exact=draft.value;
 await context('selection');expect(document.querySelector('[data-context=selection]')?.getAttribute('aria-selected')).toBe('true');await context('document');expect(document.querySelector('#canonical-source')).toBe(draft);expect(draft.value).toBe(exact);expect(document.querySelector('[data-document-section=source]')?.getAttribute('aria-expanded')).toBe('true');await click('Discard draft');
});
it('offers an honest empty selection and arrow-key navigation between the two panel contexts',async()=>{
 await start();await click('Structure');document.querySelector<HTMLElement>('.svelte-flow__pane')!.click();await settle();await click('Document');const tab=document.querySelector<HTMLButtonElement>('[data-context=document]')!;tab.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));await settle();expect(document.querySelector('[data-context=selection]')?.getAttribute('aria-selected')).toBe('true');expect(document.querySelector('.workspace-selection-details')?.textContent).toContain('Select nodes, layers or connections');expect(document.activeElement).toBe(document.querySelector('[data-context=selection]'));
});
