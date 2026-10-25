// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {mount,unmount,tick,flushSync} from 'svelte';
vi.mock('$app/navigation',()=>({beforeNavigate:()=>{}}));
import Designer from '../../src/lib/designer/Designer.svelte';
import WorkspacePanelsShowcase from '../../src/lib/designer/WorkspacePanelsShowcase.svelte';
import {newScreen} from '../../src/lib/designer/application.js';
import {screenStore} from '../../src/lib/designer/storage.js';
import type {UiDocument} from '@victframework/ui';
let editor:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(editor)await unmount(editor);editor=undefined;document.body.innerHTML='';localStorage.clear();});
async function settle(){flushSync();await tick();await tick();}
const button=(name:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(node=>node.getAttribute('aria-label')===name||node.textContent?.trim()===name)!;
async function click(selector:string){document.querySelector<HTMLButtonElement>(selector)!.click();await settle();}
async function start(){
 const source:UiDocument={...newScreen('Stacked workspace','stacked-workspace'),revision:'r1.r1',nodes:{
  screen:{id:'screen',kind:'element',tag:'main',children:['heading','field']},
  heading:{id:'heading',kind:'element',tag:'h1',children:['text']},text:{id:'text',kind:'text',content:{type:'literal',value:'A useful heading'}},
  field:{id:'field',kind:'element',tag:'input',children:[],attributes:{type:'text','aria-label':'Live field',value:{type:'ref',path:'state.message'}},interactions:[{on:'change',action:'setState',key:'message',value:{type:'ref',path:'state.message'}}]},
 }};
 expect(screenStore(localStorage,source.id).save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);
 editor=mount(Designer,{target:document.body});await settle();return source;
}
it('keeps Chat, Layers, Inspect and canvas mounted through independent header collapse and tab switches',async()=>{
 const source=await start();const chat=document.querySelector('.agent-chat')!,canvas=document.querySelector('.design-frame')!;
 const draft=document.querySelector<HTMLTextAreaElement>('[data-testid="conversation-input"]')!;draft.value='Keep my conversation draft';draft.dispatchEvent(new Event('input',{bubbles:true}));await settle();
 await click('#sidebar-layers-tab');
 const layers=document.querySelector('.uv-layers')!,inspect=document.querySelector('.source-details')!;
 const heading=[...document.querySelectorAll<HTMLElement>('.uv-layers [role=treeitem]')].find(node=>node.textContent?.includes('A useful heading'))!;heading.click();await settle();
 expect(inspect.querySelector('.embedded-title')?.textContent).toBe('A useful heading');
 expect(document.querySelector('[aria-label="Floating selection tools"]')).toBeNull();
 await click('#layers-panel-header');expect(document.querySelector('#layers-panel-header')!.getAttribute('aria-expanded')).toBe('false');expect(document.querySelector('#inspect-panel-header')!.getAttribute('aria-expanded')).toBe('true');
 expect((layers.closest('.stack-content') as HTMLElement).hidden).toBe(true);
 await click('#inspect-panel-header');await click('#layers-panel-header');
 expect(document.querySelector('#layers-panel-header')!.getAttribute('aria-expanded')).toBe('true');expect((inspect.closest('.stack-content') as HTMLElement).hidden).toBe(true);
 await click('#inspect-panel-header');await click('#sidebar-chat-tab');
 expect(document.querySelector('.agent-chat')).toBe(chat);expect(draft.value).toBe('Keep my conversation draft');
 await click('#sidebar-layers-tab');expect(document.querySelector('.uv-layers')).toBe(layers);expect(document.querySelector('.source-details')).toBe(inspect);expect(document.querySelector('.design-frame')).toBe(canvas);
 expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('supports keyboard tabs and a bounded remembered Layers / Inspect divider without canvas shortcuts',async()=>{
 await start();const tab=document.querySelector<HTMLElement>('#sidebar-chat-tab')!;
 tab.focus();tab.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));await settle();expect(document.activeElement?.id).toBe('sidebar-layers-tab');
 const split=document.querySelector<HTMLElement>('[aria-label="Layers and Inspect split"]')!;
 for(const key of ['Home','End']){split.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));await settle();const value=Number(split.getAttribute('aria-valuenow'));expect(value).toBeGreaterThanOrEqual(Number(split.getAttribute('aria-valuemin')));expect(value).toBeLessThanOrEqual(Number(split.getAttribute('aria-valuemax')));}
 expect(JSON.parse(localStorage.getItem('vict.studio.workspace-sizes')!).layerSplit).toBe(Number(split.getAttribute('aria-valuenow')));
 split.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true}));await settle();expect(document.querySelector('.design-frame h1')).not.toBeNull();
});
it('protects simultaneous Data / Source surfaces and retains a collapsed source draft',async()=>{
 const source=await start();button('Document').click();await settle();
 expect([...document.querySelectorAll('.document-section-header')].map(node=>node.textContent)).toEqual(['Data','Actions','Source']);
 [...document.querySelectorAll<HTMLButtonElement>('.data-row')].find(node=>node.textContent?.includes('Message'))!.click();await settle();
 const initial=document.querySelector<HTMLTextAreaElement>('[aria-label="Starting value"]')!;
 initial.value='A new saved starting value';initial.dispatchEvent(new Event('input',{bubbles:true}));await settle();
 await click('[data-document-section=source]');const sourceField=document.querySelector<HTMLTextAreaElement>('#canonical-source')!;expect(sourceField.disabled).toBe(true);
 await click('[data-document-section=data]');button('Cancel').click();await settle();await click('[data-document-section=source]');sourceField.value+=' ';sourceField.dispatchEvent(new Event('input',{bubbles:true}));await settle();
 expect(initial.closest('fieldset')!.disabled).toBe(true);button('Close document').click();await settle();expect(document.querySelector<HTMLElement>('#document-drawer')!.hidden).toBe(false);
 const exact=sourceField.value;await click('[data-document-section=source]');await click('[data-document-section=source]');expect(sourceField.value).toBe(exact);
 await click('#sidebar-layers-tab');await click('#inspect-panel-header');expect(sourceField.value).toBe(exact);
 button('Discard draft').click();await settle();expect(initial.closest('fieldset')!.disabled).toBe(false);expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('opens only one Document section, preserves hidden drafts and permits collapsing all sections',async()=>{
 await start();button('Document').click();await settle();
 const expanded=()=>[...document.querySelectorAll('.document-section-header[aria-expanded=true]')].map(node=>node.textContent);
 expect(expanded()).toEqual(['Data']);
 await click('[data-document-section=actions]');expect(expanded()).toEqual(['Actions']);
 await click('[data-document-section=source]');expect(expanded()).toEqual(['Source']);
 const field=document.querySelector<HTMLTextAreaElement>('#canonical-source')!;field.value+=' ';field.dispatchEvent(new Event('input',{bubbles:true}));await settle();const exact=field.value;
 await click('[data-document-section=data]');expect(expanded()).toEqual(['Data']);expect(field.value).toBe(exact);
 expect(document.querySelector<HTMLButtonElement>('.data-row')!.disabled).toBe(true);
 await click('[data-document-section=source]');expect(expanded()).toEqual(['Source']);expect(field.value).toBe(exact);
 await click('[data-document-section=source]');expect(expanded()).toEqual([]);expect(document.querySelector('#canonical-source')).toBe(field);
});
it('shows the actual reusable stacks in the disposable showcase',async()=>{
 editor=mount(WorkspacePanelsShowcase,{target:document.body});await settle();
 expect(document.querySelector('.layers-inspect-panels')).not.toBeNull();expect(document.querySelector('.document-sections')).not.toBeNull();
 await click('#layers-panel-header');expect(document.querySelector('#layers-panel-header')!.getAttribute('aria-expanded')).toBe('false');expect(document.querySelector('#inspect-panel-header')!.getAttribute('aria-expanded')).toBe('true');
 expect(document.body.textContent).toContain('no model request is sent');
});
