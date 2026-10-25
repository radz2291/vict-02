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
async function click(name:string){button(name).click();await settle();}
async function start(){
 const source:UiDocument={...newScreen('Panel placement','panel-placement'),revision:'r1.r1',nodes:{
  screen:{id:'screen',kind:'element',tag:'main',children:['heading','field']},
  heading:{id:'heading',kind:'element',tag:'h1',children:['text']},text:{id:'text',kind:'text',content:{type:'literal',value:'A useful heading'}},
  field:{id:'field',kind:'element',tag:'input',children:[],attributes:{type:'text','aria-label':'Live field',value:{type:'ref',path:'state.message'}},interactions:[{on:'change',action:'setState',key:'message',value:{type:'ref',path:'state.message'}}]},
 }};
 expect(screenStore(localStorage,source.id).save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);
 editor=mount(Designer,{target:document.body});await settle();return source;
}
it('keeps standalone Chat mounted and puts Layers first in the Document accordion',async()=>{
 const source=await start();const chat=document.querySelector('.agent-chat')!,canvas=document.querySelector('.design-frame')!;
 expect(document.querySelector('[role=tablist]')).toBeNull();
 const draft=document.querySelector<HTMLTextAreaElement>('[data-testid="conversation-input"]')!;draft.value='Keep my Chat draft';draft.dispatchEvent(new Event('input',{bubbles:true}));await settle();
 await click('Document');expect([...document.querySelectorAll('.document-section-header')].map(node=>node.textContent)).toEqual(['Layers','Data','Actions','Source']);
 expect(document.querySelector('.document-section-header[aria-expanded=true]')?.textContent).toBe('Layers');
 await click('Data');await click('Layers');expect(document.querySelector('.agent-chat')).toBe(chat);expect(draft.value).toBe('Keep my Chat draft');expect(document.querySelector('.design-frame')).toBe(canvas);
 expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});
});
it('inspects selected layers inside Structure and keeps the graph mounted through narrow inspection',async()=>{
 await start();await click('Document');
 [...document.querySelectorAll<HTMLElement>('.uv-layers [role=treeitem]')].find(node=>node.textContent?.includes('A useful heading'))!.click();await settle();
 expect(document.querySelector('[aria-label="Floating selection tools"]')).toBeNull();
 await click('Inspect source');expect(document.querySelector('.structure-dock .source-details header strong')?.textContent).toBe('A useful heading');
 expect(document.querySelector('.agent-panel .source-details')).toBeNull();expect(document.querySelector('#document-drawer .source-details')).toBeNull();
 const graph=document.querySelector('.svelte-flow')!;expect(graph).not.toBeNull();
 expect(document.querySelector<HTMLElement>('.structure-graph')!.hidden).toBe(true);
 await click('Close inspection details');expect(document.querySelector('.svelte-flow')).toBe(graph);expect(document.querySelector<HTMLElement>('.structure-graph')!.hidden).toBe(false);
 await click('Inspect source');await click('Edit properties ↗');expect(document.querySelector('[aria-label="Floating selection tools"]')).not.toBeNull();expect(document.querySelector('.source-details')).toBeNull();
});
it('preserves hidden source drafts and permits only one Document section expanded',async()=>{
 await start();await click('Document');const expanded=()=>[...document.querySelectorAll('.document-section-header[aria-expanded=true]')].map(node=>node.textContent);
 for(const name of ['Data','Actions','Source']){await click(name);expect(expanded()).toEqual([name]);}
 const field=document.querySelector<HTMLTextAreaElement>('#canonical-source')!;field.value+=' ';field.dispatchEvent(new Event('input',{bubbles:true}));await settle();const exact=field.value;
 await click('Layers');expect(expanded()).toEqual(['Layers']);await click('Data');expect(field.value).toBe(exact);expect(document.querySelector<HTMLButtonElement>('.data-row')!.disabled).toBe(true);
 await click('Close document');expect(document.querySelector<HTMLElement>('#document-drawer')!.hidden).toBe(false);
 await click('Source');expect(field.value).toBe(exact);await click('Source');expect(expanded()).toEqual([]);expect(document.querySelector('#canonical-source')).toBe(field);
});
it('protects Data drafts while switching accordion sections',async()=>{
 await start();await click('Document');await click('Data');[...document.querySelectorAll<HTMLButtonElement>('.data-row')].find(node=>node.textContent?.includes('Message'))!.click();await settle();
 const initial=document.querySelector<HTMLTextAreaElement>('[aria-label="Starting value"]')!;initial.value='Pending saved value';initial.dispatchEvent(new Event('input',{bubbles:true}));await settle();
 await click('Layers');await click('Source');expect(document.querySelector<HTMLTextAreaElement>('#canonical-source')!.disabled).toBe(true);
 await click('Data');expect(initial.value).toBe('Pending saved value');await click('Cancel');expect(initial.value).not.toBe('Pending saved value');
});
it('shows the actual accordion and Structure inspection in the disposable showcase',async()=>{
 editor=mount(WorkspacePanelsShowcase,{target:document.body});await settle();
 expect(document.querySelector('.document-section-header[aria-expanded=true]')?.textContent).toBe('Layers');
 await click('Inspect in Structure ↗');expect(document.querySelector('.structure-dock .source-details')).not.toBeNull();
 await click('Source');expect([...document.querySelectorAll('.document-section-header[aria-expanded=true]')].map(node=>node.textContent)).toEqual(['Source']);
 expect(document.body.textContent).toContain('no model request is sent');
});
