// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {flushSync,mount,tick,unmount} from 'svelte';
import StructureView from '../../src/lib/designer/StructureView.svelte';
import SourceDetails from '../../src/lib/designer/SourceDetails.svelte';
import {structureId} from '../../src/lib/designer/structure.js';
import {clarityFixture} from '../fixtures/structure-clarity.js';
let instance:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(instance)await unmount(instance);instance=undefined;document.body.innerHTML='';document.body.style.pointerEvents='';});
async function settle(){flushSync();await tick();await tick();}
function button(name:string){const found=[...document.querySelectorAll<HTMLElement>('button,[role^=menuitem]')].find(node=>node.getAttribute('aria-label')===name||node.textContent?.replace(/✓/g,'').trim()===name);expect(found,name).toBeDefined();return found!;}
async function viewItem(name:string){const trigger=[...document.querySelectorAll<HTMLElement>('.structure-tools [role=menubar] > button')].find(node=>node.textContent==='View')!;trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await settle();button(name).click();await settle();document.querySelector<HTMLElement>('[role^=menuitem]:focus')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();}
function ids(){return [...document.querySelectorAll<HTMLElement>('.svelte-flow__node')].map(node=>node.dataset.id).sort();}
async function start(count=2,focus?:string){const source=clarityFixture(count);instance=mount(StructureView,{target:document.body,props:{document:source,revision:'r1',focusSelection:focus?structureId(source.id,'state',focus):undefined,onSelect:vi.fn(),onMove:vi.fn(()=>false),onNotice:vi.fn()}});await settle();return source;}
it('separates inspect, explicit focus and camera-only framing',async()=>{
 const source=await start(),before=ids(),viewport=document.querySelector<HTMLElement>('.svelte-flow__viewport')!.style.transform;
 document.querySelector<HTMLElement>(`[data-id="${structureId(source.id,'node','field-0')}"]`)!.click();await settle();
 expect(ids()).toEqual(before);expect(document.querySelector('.svelte-flow__viewport')?.getAttribute('style')).toContain(viewport);expect(document.querySelector('.scope-label')?.textContent).toContain('Screen');
 button('Focus on selection').click();await settle();expect(document.querySelector('.scope-label')?.textContent).toContain('Field 0');expect(ids()).toContain(structureId(source.id,'state','message'));
 const focused=ids();await viewItem('Frame selection');expect(ids()).toEqual(focused);expect(document.querySelector('.scope-label')?.textContent).toContain('Field 0');
 await viewItem('State and actions');expect(ids()).not.toContain(structureId(source.id,'state','message'));await viewItem('State and actions');expect(ids()).toContain(structureId(source.id,'state','message'));
});
it('honours collapse in both views and text visibility in a focused heading',async()=>{
 const source=await start();button('Collapse Screen').click();await settle();expect(ids()).toHaveLength(1);
 button('Expand Screen').click();await settle();expect(ids().length).toBeGreaterThan(1);
 await viewItem('Whole hierarchy');button('Collapse Screen').click();await settle();expect(ids()).toHaveLength(1);button('Expand Screen').click();await settle();
 document.querySelector<HTMLElement>(`[data-id="${structureId(source.id,'node','title')}"]`)!.click();await settle();await viewItem('Focus on selection');
 expect(ids()).not.toContain(structureId(source.id,'node','title-text'));await viewItem('Show text nodes');expect(ids()).toContain(structureId(source.id,'node','title-text'));
});
it('pages large direct connections and resets the batch on explicit focus',async()=>{
 const source=await start(140,'message');expect(ids()).toHaveLength(25);expect(document.querySelector('.structure-count')?.textContent).toBe('25 of 141 items');
 button('Show 24 more').click();await settle();expect(ids()).toHaveLength(49);
 document.querySelector<HTMLElement>(`[data-id="${structureId(source.id,'node','field-0')}"]`)!.click();await settle();button('Focus on selection').click();await settle();expect(ids()).toHaveLength(3);
 button('Other users (139)').click();await settle();expect(ids()).toHaveLength(25);button('Hide other users').click();await settle();expect(ids()).toHaveLength(3);
});
it('explains declared conditional behaviour and exposes distinct branch meanings in Selection',async()=>{
 const source=clarityFixture();instance=mount(SourceDetails,{target:document.body,props:{document:source,selectedId:structureId(source.id,'node','conditional'),embedded:true,onClose:vi.fn(),onSelect:vi.fn(),onNavigate:vi.fn()}});await settle();
 expect(document.querySelector('.useful-facts')?.textContent).toContain('Shown when Agreement is on');expect(document.querySelector('.useful-facts')?.textContent).toContain('Fallback branch');
 button('Relationships').click();await settle();expect(document.querySelector('.details-relationships')?.textContent).toContain('Shown when Agreement is on');expect(document.querySelector('.details-relationships')?.textContent).toContain('Otherwise');expect(document.querySelector('.details-relationships button[title]')).not.toBeNull();
});
