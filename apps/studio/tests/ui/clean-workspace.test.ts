// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
vi.mock('$app/navigation',()=>({beforeNavigate:()=>{}}));
import Designer from '../../src/lib/designer/Designer.svelte';
import {newScreen} from '../../src/lib/designer/application.js';
import {screenStore} from '../../src/lib/designer/storage.js';
import {workspaceControl} from './studio-menu.js';
import {structureId} from '../../src/lib/designer/structure.js';
let editor:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(editor)await unmount(editor);editor=undefined;document.body.innerHTML='';localStorage.clear();});
async function settle(){flushSync();await tick();await tick();}
async function click(name:string){const control=workspaceControl(name);expect(control,name).toBeDefined();control!.click();await settle();}
async function start(){const seed=newScreen('Clean workspace','clean-workspace');const source={...seed,revision:'r1.r1',nodes:{screen:{id:'screen',kind:'element' as const,tag:'main',children:['heading','field']},heading:{id:'heading',kind:'element' as const,tag:'h1',children:['text']},text:{id:'text',kind:'text' as const,content:{type:'literal' as const,value:'Keep this heading'}},field:{id:'field',kind:'element' as const,tag:'input',children:[],attributes:{type:'text','aria-label':'Connected field',value:{type:'ref' as const,path:'state.message'}}}}};
 expect(screenStore(localStorage,source.id).save({document:source,expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);editor=mount(Designer,{target:document.body});await settle();return source;}
it('starts in Design with optional panels closed and Structure only in the workspace mode bar',async()=>{
 await start();for(const selector of ['.agent-panel','#document-drawer','.structure-workspace'])expect(document.querySelector<HTMLElement>(selector)!.hidden).toBe(true);
 expect(document.querySelector('.canvas-toolbar .panel-toggle')).toBeNull();expect(document.querySelector('[aria-label="Show chat"]')).toBeNull();expect(document.querySelector('.structure-toggle')).toBeNull();
 const canvas=document.querySelector('.design-frame'),chat=document.querySelector('.agent-chat'),graph=document.querySelector('.svelte-flow');
 await click('Chat');expect(document.querySelector<HTMLElement>('.agent-panel')!.hidden).toBe(false);
 const draft=document.querySelector<HTMLTextAreaElement>('[data-testid="conversation-input"]')!;draft.value='Keep my unsent request';draft.dispatchEvent(new Event('input',{bubbles:true}));await settle();
 await click('Chat');await click('Document');await click('Document');await click('Structure');await click('Design');await click('Chat');
 expect(draft.value).toBe('Keep my unsent request');expect(document.querySelector('.agent-chat')).toBe(chat);expect(document.querySelector('.design-frame')).toBe(canvas);expect(document.querySelector('.svelte-flow')).toBe(graph);
});
it('retains a hidden Source draft and protects selection, save and canonical source until discarded',async()=>{
 const source=await start();await click('Document');await click('Source');const field=document.querySelector<HTMLTextAreaElement>('#canonical-source')!;field.value+=' ';field.dispatchEvent(new Event('input',{bubbles:true}));await settle();const exact=field.value;
 await click('Close document');expect(document.querySelector<HTMLElement>('#document-drawer')!.hidden).toBe(true);
 document.querySelector('h1')!.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}));await settle();
 expect(document.querySelector('[aria-label="Floating selection tools"]')).toBeNull();expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:source});expect(field.value).toBe(exact);
 await click('Document');expect(field.value).toBe(exact);await click('Discard draft');await click('Close document');document.querySelector('h1')!.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));await settle();expect(document.querySelector('[aria-label="Floating selection tools"]')).not.toBeNull();
});
it('updates connections for external selection and relationship targets, including same-canonical reselect',async()=>{
 const source=await start(),canonical=document.querySelector<HTMLTextAreaElement>('#canonical-source')!.value;
 await click('Structure');
 const select=async(selector:string)=>{await click('Design');document.querySelector(selector)!.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));await settle();await click('Structure');};
 const ids=()=>[...document.querySelectorAll<HTMLElement>('.svelte-flow__node')].map(node=>node.dataset.id);
 await select('.design-frame h1');expect(ids()).toContain(structureId(source.id,'node','heading'));expect(ids()).not.toContain(structureId(source.id,'node','field'));
 await select('.design-frame input');expect(ids()).toContain(structureId(source.id,'state','message'));await click('Inspect structure');await click('Relationships');
 const relation=[...document.querySelectorAll<HTMLButtonElement>('.details-relationships button')].find(node=>node.textContent?.includes('Message'))!;expect(relation).toBeDefined();relation.click();await settle();
 expect(document.querySelector<HTMLElement>('.svelte-flow__node.selected')?.dataset.id).toBe(structureId(source.id,'state','message'));
 await select('.design-frame input');expect(document.querySelector<HTMLElement>('.svelte-flow__node.selected')?.dataset.id).toBe(structureId(source.id,'node','field'));
 expect(document.querySelector<HTMLTextAreaElement>('#canonical-source')!.value).toBe(canonical);
});
it('retains inspected data scope through a canonical Data edit with the same occurrence selected',async()=>{
 const source=await start();document.querySelector('.design-frame input')!.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));await settle();await click('Structure');await click('Inspect structure');await click('Relationships');
 const relation=[...document.querySelectorAll<HTMLButtonElement>('.details-relationships button')].find(node=>node.textContent?.includes('Message'))!;relation.click();await settle();await click('Details');await click('Edit in Data ↗');
 const field=document.querySelector<HTMLTextAreaElement>('[aria-label="Starting value"]')!;field.value='Edited through Data';field.dispatchEvent(new Event('input',{bubbles:true}));await settle();
 const apply=[...field.closest('fieldset')!.querySelectorAll<HTMLButtonElement>('button')].find(node=>node.textContent?.trim()==='Apply')!;expect(apply).toBeDefined();apply.click();await settle();
 expect(document.querySelector('.source-details header strong')?.textContent).toBe('Message');expect(document.querySelector<HTMLElement>('.svelte-flow__node.selected')?.dataset.id).toBe(structureId(source.id,'state','message'));
 expect(document.querySelector<HTMLTextAreaElement>('#canonical-source')!.value).toContain('Edited through Data');
});
it('preserves the browsed connection scope when leaving and returning to Structure',async()=>{
 const source=await start();await click('Document');await click('Source');
 const field=document.querySelector<HTMLTextAreaElement>('#canonical-source')!;
 const next=JSON.parse(field.value);next.nodes.screen.children.push('consumer');
 next.nodes.field.attributes.disabled={type:'ref',path:'state.accepted'};
 next.nodes.consumer={id:'consumer',kind:'element',tag:'input',children:[],attributes:{type:'checkbox','aria-label':'Shared consumer',checked:{type:'ref',path:'state.accepted'}}};
 field.value=JSON.stringify(next);field.dispatchEvent(new Event('input',{bubbles:true}));await settle();await click('Apply source');await click('Close document');
 document.querySelector('.design-frame input')!.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));await settle();await click('Structure');
 const ids=()=>[...document.querySelectorAll<HTMLElement>('.svelte-flow__node')].map(node=>node.dataset.id).sort();
 const before=ids();expect(before).toContain(structureId(source.id,'node','consumer'));
 const state=[...document.querySelectorAll<HTMLElement>('.svelte-flow__node')].find(node=>node.dataset.id===structureId(source.id,'state','message'))!;
 state.click();await settle();expect(ids()).toEqual(before);
 await click('Design');await click('Structure');expect(ids()).toEqual(before);
 expect(document.querySelector<HTMLElement>('.svelte-flow__node.selected')?.dataset.id).toBe(structureId(source.id,'state','message'));
});
