// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
vi.mock('$app/navigation',()=>({beforeNavigate:()=>{}}));
import StructureView from '../../src/lib/designer/StructureView.svelte';
import Designer from '../../src/lib/designer/Designer.svelte';
import {clarityFixture} from '../fixtures/structure-clarity.js';
import {structureId,projectStructure,structureMatches} from '../../src/lib/designer/structure.js';
import {screenStore} from '../../src/lib/designer/storage.js';
let app:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(app)await unmount(app);app=undefined;document.body.innerHTML='';document.body.style.pointerEvents='';localStorage.clear();});
async function settle(){flushSync();await tick();await tick();}
function control(name:string){const found=[...document.querySelectorAll<HTMLElement>('button,[role^=menuitem]')].find(node=>node.getAttribute('aria-label')===name||node.textContent?.replace(/[✓›]/g,'').trim()===name);expect(found,name).toBeDefined();return found!;}
async function menu(name='View'){const trigger=[...document.querySelectorAll<HTMLElement>('.structure-tools [role=menubar]>button')].find(node=>node.textContent===name)!;expect(trigger,name).toBeDefined();trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await settle();}
async function submenu(name:string){control(name).focus();control(name).dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));await settle();}
async function item(name:string){control(name).click();await settle();}
async function closeMenu(){document.querySelector<HTMLElement>('[role=menu]')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();}
function nodes(){return [...document.querySelectorAll<HTMLElement>('.svelte-flow__node')].map(node=>node.dataset.id);}
async function start(extra:Record<string,unknown>={}){const source=clarityFixture();app=mount(StructureView,{target:document.body,props:{document:source,revision:'r1',onSelect:vi.fn(),onMove:vi.fn(()=>false),onNotice:vi.fn(),...extra}});await settle();return source;}
it('keeps Object mounted but disabled until nodes or connections are selected',async()=>{
 const source=await start(),object=control('Object') as HTMLButtonElement;
 expect(object.disabled).toBe(true);object.click();await menu('Object');expect(document.querySelector('[role=menu]')).toBeNull();
 document.querySelector<HTMLElement>(`[data-id="${structureId(source.id,'node','field-0')}"]`)!.click();await settle();
 expect(control('Object')).toBe(object);expect(object.disabled).toBe(false);await menu('Object');expect(control('Inspect')).toBeDefined();await closeMenu();
 document.querySelector<HTMLElement>('.svelte-flow__pane')!.click();await settle();expect(control('Object')).toBe(object);expect(object.disabled).toBe(true);
 control('Select outgoing Contains connections for Screen').click();await settle();expect(control('Object')).toBe(object);expect(object.disabled).toBe(false);
 await menu('Object');expect(control('Relationships')).toBeDefined();await closeMenu();
 document.querySelector<HTMLElement>('.svelte-flow__pane')!.click();await settle();expect(control('Object')).toBe(object);expect(object.disabled).toBe(true);
});
it('keeps quick camera actions independent from scope and selection, with one fit-all home',async()=>{
 const source=await start(),before=nodes();expect(control('Fit selection').hasAttribute('disabled')).toBe(true);
 document.querySelector<HTMLElement>(`[data-id="${structureId(source.id,'node','field-0')}"]`)!.click();await settle();
 expect(nodes()).toEqual(before);expect(control('Fit selection').hasAttribute('disabled')).toBe(false);
 await item('Fit selection');await item('Fit all');expect(nodes()).toEqual(before);
 expect(document.querySelectorAll('.svelte-flow__node.selected')).toHaveLength(1);
 expect(document.querySelector('.structure-tools .inspection-toggle')).toBeNull();expect(document.querySelector('.svelte-flow__controls-fitview')).toBeNull();
 await menu();await item('Explore selection');expect(document.querySelector('.structure-count')!.textContent).toContain('Field 0');expect(nodes()).toContain(structureId(source.id,'state','message'));
});
it('counts exact search matches separately from supporting context and returns to the prior scope on Escape',async()=>{
 const source=await start(),before=nodes(),input=document.querySelector<HTMLInputElement>('[aria-label="Search structure"]')!;
 input.value='Field 0';input.dispatchEvent(new Event('input',{bubbles:true}));await settle();
 const count=projectStructure(source).nodes.filter(node=>structureMatches(node,input.value)).length;
 expect(document.querySelector('.structure-count')!.textContent).toContain(`Search · ${count} ${count===1?'match':'matches'}`);
 await menu();expect(document.querySelector('[role=menuitemradio][aria-checked=true]')).toBeNull();await closeMenu();
 input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();expect(input.value).toBe('');expect(nodes()).toEqual(before);
 expect(document.querySelector('.structure-count')!.textContent).toContain('Screen');
});
it('keeps inventory in hierarchy without changing modes, and checks the active layout direction',async()=>{
 await start();await menu();await submenu('Show');expect(control('Include unused items').getAttribute('aria-disabled')).toBe('true');await closeMenu();await closeMenu();
 await menu();await item('Whole hierarchy');await menu();await submenu('Show');await item('Include unused items');expect(control('Include unused items').getAttribute('aria-checked')).toBe('true');await closeMenu();await closeMenu();
 expect(document.querySelector('.structure-count')!.textContent).toContain('Hierarchy');
 await menu();expect([...document.querySelectorAll('[role=menuitem]')].some(node=>node.textContent==='Show whole screen')).toBe(false);
 await submenu('Layout');expect(control('Left to right').textContent).toContain('✓');await item('Top to bottom');await menu();await submenu('Layout');expect(control('Top to bottom').getAttribute('aria-checked')).toBe('true');expect(control('Top to bottom').textContent).toContain('✓');
});
it('finds exact hidden source items through the shared Selection handoff without opening a second inspector',async()=>{
 const inspect=vi.fn(),source=await start({onInspect:inspect});await menu();await item('Find source item');
 const select=document.querySelector<HTMLSelectElement>('[aria-label="Structure source selection"]')!;expect(select.closest('dialog')?.open).toBe(true);
 const exact=structureId(source.id,'node','title-text');select.value=exact;select.dispatchEvent(new Event('change',{bubbles:true}));await settle();await settle();
 expect(inspect).toHaveBeenCalledWith(exact,'properties');expect(document.querySelector('.structure-details')).toBeNull();expect(document.querySelector('dialog')?.open).toBe(false);expect(nodes()).toContain(exact);
});
it('preserves draft refusal when finding an item',async()=>{
 const inspect=vi.fn();await start({onInspect:inspect,blocked:true});await menu();await item('Find source item');expect(document.querySelector<HTMLSelectElement>('[aria-label="Structure source selection"]')!.disabled).toBe(true);await item('Close source tool');expect(inspect).not.toHaveBeenCalled();
});
it('uses stable mode-bar drawer controls across modes and remembers the right drawer tab and drafts',async()=>{
 const source=clarityFixture();expect(screenStore(localStorage,source.id).save({document:{...source,revision:'r1.r1'},expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);
 app=mount(Designer,{target:document.body});await settle();const left=control('Toggle Chat drawer'),right=control('Toggle Document and Selection drawer');
 right.click();await settle();document.querySelector<HTMLButtonElement>('[data-context=selection]')!.click();await settle();right.click();await settle();expect(right.getAttribute('aria-expanded')).toBe('false');right.click();await settle();expect(document.querySelector('[data-context=selection]')!.getAttribute('aria-selected')).toBe('true');
 left.click();await settle();const draft=document.querySelector<HTMLTextAreaElement>('.agent-panel textarea')!;draft.value='Keep my draft';draft.dispatchEvent(new Event('input',{bubbles:true}));await settle();
 for(const mode of ['Structure','Interact','Design']){await item(mode);expect(control('Toggle Chat drawer')).toBe(left);expect(control('Toggle Document and Selection drawer')).toBe(right);}
 left.click();await settle();left.click();await settle();expect(draft.value).toBe('Keep my draft');expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:{...source,revision:'r1.r1'}});
});
it('keeps status inside the flow canvas and leaves native context menus and multi-selection alone',async()=>{
 const source=await start();expect(document.querySelector('.structure-tools .structure-count')).toBeNull();expect(document.querySelector('.structure-canvas > .structure-count')).not.toBeNull();
 const first=document.querySelector<HTMLElement>(`[data-id="${structureId(source.id,'node','field-0')}"]`)!,second=document.querySelector<HTMLElement>(`[data-id="${structureId(source.id,'node','field-1')}"]`)!;
 first.click();second.dispatchEvent(new MouseEvent('click',{ctrlKey:true,bubbles:true}));await settle();expect(document.querySelectorAll('.svelte-flow__node.selected')).toHaveLength(2);
 const nativeMenu=(target:Element)=>{target.dispatchEvent(new PointerEvent('pointerdown',{button:2,bubbles:true}));const event=new MouseEvent('contextmenu',{button:2,bubbles:true,cancelable:true});target.dispatchEvent(event);return event;};
 expect(nativeMenu(first).defaultPrevented).toBe(false);await settle();expect(document.querySelectorAll('.svelte-flow__node.selected')).toHaveLength(2);expect(document.querySelector('[role=menu]')).toBeNull();
 const point=control('Select outgoing Contains connections for Screen');point.click();await settle();const selected=document.querySelectorAll('.port-control[aria-pressed=true]').length;expect(selected).toBeGreaterThan(0);expect(nativeMenu(point).defaultPrevented).toBe(false);await settle();expect(document.querySelectorAll('.port-control[aria-pressed=true]')).toHaveLength(selected);expect(document.querySelectorAll('.svelte-flow__node.selected')).toHaveLength(0);
});
it('offers aggregate inspection without source-edit commands for multiple objects and connection selections',async()=>{
 const inspect=vi.fn(),source=await start({onInspect:inspect});
 document.querySelector<HTMLElement>(`[data-id="${structureId(source.id,'node','field-0')}"]`)!.click();document.querySelector<HTMLElement>(`[data-id="${structureId(source.id,'node','field-1')}"]`)!.dispatchEvent(new MouseEvent('click',{ctrlKey:true,bubbles:true}));await settle();
 await menu('Object');expect([...document.querySelectorAll('[role=menu] [role^=menuitem]')].map(node=>node.textContent)).toEqual(['Inspect','Relationships']);await item('Relationships');expect(inspect).toHaveBeenLastCalledWith(undefined,'relationships');expect(document.querySelectorAll('.svelte-flow__node.selected')).toHaveLength(2);
 control('Select outgoing Contains connections for Screen').click();await settle();await menu('Object');expect([...document.querySelectorAll('[role=menu] [role^=menuitem]')].map(node=>node.textContent)).toEqual(['Inspect','Relationships']);await item('Inspect');expect(inspect).toHaveBeenLastCalledWith(undefined,'properties');expect(document.querySelectorAll('.port-control[aria-pressed=true]').length).toBeGreaterThan(0);
});
it('preserves Duplicate and Undo through the existing source command in Object without saving the screen',async()=>{
 const source=clarityFixture();expect(screenStore(localStorage,source.id).save({document:{...source,revision:'r1.r1'},expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);app=mount(Designer,{target:document.body});await settle();await item('Structure');
 document.querySelector<HTMLElement>(`[data-id="${structureId(source.id,'node','field-0')}"]`)!.click();await settle();await menu('Object');
 for(const label of ['Duplicate','Delete','Move earlier','Move later','Arrange on canvas…','Reveal in Layers','Move inside…'])expect(control(label)).toBeDefined();
 await item('Duplicate');expect(document.querySelectorAll('.design-frame input[aria-label="Field 0"]')).toHaveLength(2);document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));await settle();expect(document.querySelectorAll('.design-frame input[aria-label="Field 0"]')).toHaveLength(1);expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:{...source,revision:'r1.r1'}});
});
it('keeps migrated source commands disabled during an unapplied source draft',async()=>{
 const source=clarityFixture();expect(screenStore(localStorage,source.id).save({document:{...source,revision:'r1.r1'},expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);app=mount(Designer,{target:document.body});await settle();await item('Structure');document.querySelector<HTMLElement>(`[data-id="${structureId(source.id,'node','field-0')}"]`)!.click();await settle();await item('Toggle Document and Selection drawer');document.querySelector<HTMLButtonElement>('[data-context=document]')!.click();await settle();await item('Source');const draft=document.querySelector<HTMLTextAreaElement>('#canonical-source')!;draft.value+=' ';draft.dispatchEvent(new Event('input',{bubbles:true}));await settle();
 await menu('Object');for(const name of ['Duplicate','Delete','Move earlier','Move later','Arrange on canvas…','Move inside…'])expect(control(name).getAttribute('aria-disabled')).toBe('true');await item('Duplicate');expect(document.querySelectorAll('.design-frame input[aria-label="Field 0"]')).toHaveLength(1);expect(draft.value.endsWith(' ')).toBe(true);
});
it('duplicates the exact selected text source rather than its containing heading',async()=>{
 const source=clarityFixture();expect(screenStore(localStorage,source.id).save({document:{...source,revision:'r1.r1'},expectedStoredRevision:'r1',newStoredRevision:'r1.r1'}).ok).toBe(true);app=mount(Designer,{target:document.body});await settle();await item('Structure');await menu();await item('Find source item');const finder=document.querySelector<HTMLSelectElement>('[aria-label="Structure source selection"]')!;finder.value=structureId(source.id,'node','title-text');finder.dispatchEvent(new Event('change',{bubbles:true}));await settle();await settle();await menu('Object');await item('Duplicate');
 const text='An intentionally long heading whose complete content must remain available in accessible labels and tooltips';expect(document.querySelectorAll('.design-frame h1')).toHaveLength(1);expect(document.querySelector('.design-frame h1')!.textContent).toBe(text+text);
 document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));await settle();expect(document.querySelector('.design-frame h1')!.textContent).toBe(text);expect(screenStore(localStorage,source.id).rawLoad()).toMatchObject({document:{...source,revision:'r1.r1'}});
});
