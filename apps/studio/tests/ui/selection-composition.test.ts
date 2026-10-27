// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
import Details from '../../src/lib/designer/WorkspaceSelectionDetails.svelte';
import {projectStructure,structureId} from '../../src/lib/designer/structure.js';
import {selectionOverview,selectionComparison} from '../../src/lib/designer/selection-presentation.js';
import {bindingFixture} from '../fixtures/structure-semantics.js';
import type {WorkspaceItem} from '../../src/lib/designer/workspace-selection.js';
import type {UiDocument} from '@victframework/ui';
let app:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(app)await unmount(app);app=undefined;document.body.innerHTML='';});
async function settle(){flushSync();await tick();await tick();}
async function start(source:UiDocument,items:WorkspaceItem[],blocked=false){const inspect=vi.fn(),remove=vi.fn(),intent=vi.fn();app=mount(Details,{target:document.body,props:{document:source,selection:{documentId:source.id,items},blocked,onInspect:inspect,onRemove:remove,onSelectionIntent:intent,onClose:vi.fn(),onSelect:vi.fn(),onNavigate:vi.fn()}});await settle();return {inspect,remove,intent};}
const node=(source:UiDocument,key:string):WorkspaceItem=>({kind:'node',id:structureId(source.id,'node',key),occurrence:`${source.id}|${key}`});
function section(name:string){const button=[...document.querySelectorAll<HTMLButtonElement>('.studio-section-header')].find(e=>e.getAttribute('aria-label')===name);expect(button).toBeDefined();return button!;}
it('keeps a single object identity above every accordion and removes redundant type, empty children and event prose from Overview',async()=>{
 const seed=bindingFixture(),source={...seed,nodes:{...seed.nodes}};source.nodes.field={...source.nodes.field!,localStyle:[{property:'width',value:{type:'text',value:'120px'}}]};await start(source,[node(source,'field')]);
 const heading=document.querySelector('.selection-heading')!,sections=document.querySelector('.selection-sections')!;expect(heading.compareDocumentPosition(sections)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 const overview=document.querySelector('[aria-label="Selection overview"]')!;expect(overview.textContent).toContain('120px');expect(overview.textContent).not.toContain('When changed');expect([...overview.querySelectorAll('dt')].map(e=>e.textContent)).not.toContain('Type');expect(overview.textContent).not.toContain('Children');
 section('Relationships').click();await settle();expect(heading.isConnected).toBe(true);expect(document.querySelector('.details-relationships')?.textContent).toContain('Updates');expect(document.querySelector('[aria-label^="Inspect Updates"]')?.getAttribute('title')).toContain('When changed:');expect(document.querySelector('[aria-label="Selection technical information"]')?.textContent).toContain('interactions');
});
it('keeps heterogeneous members above the accordions, with Inspect/Remove, and omits an unhelpful Overview',async()=>{
 const source=bindingFixture(),items=[node(source,'field'),{kind:'node' as const,id:structureId(source.id,'state','message')}],before=JSON.stringify(source);const {inspect,remove}=await start(source,items);
 expect(document.querySelectorAll('.selection-heading .inspect-item')).toHaveLength(2);expect([...document.querySelectorAll('.studio-section-header')].some(e=>e.getAttribute('aria-label')==='Overview')).toBe(false);expect(section('Relationships').getAttribute('aria-expanded')).toBe('true');
 document.querySelector<HTMLButtonElement>('.inspect-item')!.click();document.querySelector<HTMLButtonElement>('.remove-item')!.click();expect(inspect).toHaveBeenCalledWith(items[0]);expect(remove).toHaveBeenCalledWith(items[0]);expect(document.querySelector('[aria-label="Property comparison"]')?.textContent).toContain('Mixed');expect(JSON.stringify(source)).toBe(before);
});
it('shows a single connection only through Relationships and Technical information',async()=>{
 const source=bindingFixture(),graph=projectStructure(source),edge=graph.edges.find(e=>e.data?.role==='value')!;const {intent}=await start(source,[{kind:'edge',id:edge.id}]);
 expect(document.querySelector('.selection-heading')).toBeNull();expect(document.querySelector('[aria-label="Selection overview"]')).toBeNull();expect(document.querySelectorAll('.relationship-story')).toHaveLength(1);expect(document.querySelectorAll('.relationship-story [data-source-icon]')).toHaveLength(1);expect(intent).not.toHaveBeenCalled();expect(document.querySelector('[aria-label="Selection technical information"]')?.textContent).toContain(edge.data!.path);
});
it('keeps mixed objects and connections in the header without promoting endpoints to selection',async()=>{
 const source=bindingFixture(),graph=projectStructure(source),edge=graph.edges.find(e=>e.data?.role==='value')!,items=[node(source,'field'),{kind:'edge' as const,id:edge.id}],before=JSON.stringify(items);const {intent}=await start(source,items);
 expect(document.querySelector('.selection-heading')?.textContent).toContain('1 node · 1 connection');expect(document.querySelectorAll('.selection-heading .selection-items li')).toHaveLength(1);expect(document.querySelector('.selection-heading .connection-identity')).toBeNull();expect(document.querySelector('[aria-label="Selected connections"]')).not.toBeNull();expect(document.querySelector('[aria-label="Related connections"]')).not.toBeNull();expect(JSON.stringify(items)).toBe(before);expect(intent).not.toHaveBeenCalled();
});
it('bounds large membership to three cards initially and retains every exact member on demand',async()=>{
 const source=bindingFixture(),graph=projectStructure(source),items=graph.nodes.map(n=>({kind:'node' as const,id:n.id}));expect(items.length).toBeGreaterThan(3);await start(source,items);
 expect(document.querySelectorAll('.selection-items li')).toHaveLength(3);const more=document.querySelector<HTMLButtonElement>('.more-members')!;expect(more.textContent).toBe(`Show all ${items.length}`);more.click();await settle();expect(document.querySelectorAll('.selection-items li')).toHaveLength(items.length);expect(more.getAttribute('aria-expanded')).toBe('true');more.click();await settle();expect(document.querySelectorAll('.selection-items li')).toHaveLength(3);
});
it('keeps meaningful common properties and the full mixed comparison separately',()=>{
 const seed=bindingFixture(),source={...seed,nodes:{...seed.nodes}};source.nodes.field={...source.nodes.field!,localStyle:[{property:'width',value:{type:'text',value:'120px'}}]};const mirror=source.nodes.mirror!;if(mirror.kind!=='element')throw Error('fixture');source.nodes.mirror={...mirror,localStyle:[{property:'width',value:{type:'text',value:'120px'}}],attributes:{placeholder:'Different'}};const graph=projectStructure(source),items=[node(source,'field'),node(source,'mirror')];
 expect(selectionOverview(source,graph,items)).toEqual([{name:'Width',value:'120px'}]);expect(selectionComparison(source,graph,items).find(r=>r.name==='placeholder')?.value).toBe('Mixed');
});
it('blocks member and relationship commands during an editing draft',async()=>{
 const source=bindingFixture(),items=[node(source,'field'),node(source,'mirror')];const {inspect,remove,intent}=await start(source,items,true);expect([...document.querySelectorAll<HTMLButtonElement>('.inspect-item,.remove-item,.endpoint,.connection-role')].every(e=>e.disabled)).toBe(true);expect(inspect).not.toHaveBeenCalled();expect(remove).not.toHaveBeenCalled();expect(intent).not.toHaveBeenCalled();
});

it('hides all connection chrome for several edges while retaining exact member Inspect and Remove in Technical information',async()=>{
 const source=bindingFixture(),graph=projectStructure(source),edges=graph.edges.filter(e=>['value','updates'].includes(e.data?.role??'')).slice(0,2),items=edges.map(edge=>({kind:'edge' as const,id:edge.id})),before=JSON.stringify(source);const {inspect,remove,intent}=await start(source,items);
 expect(document.querySelector('.selection-heading')).toBeNull();expect(document.querySelector('[aria-label="Selection overview"]')).toBeNull();expect([...document.querySelectorAll('.studio-section-header')].map(e=>e.getAttribute('aria-label'))).toEqual(['Relationships','Technical information']);expect(section('Relationships').getAttribute('aria-expanded')).toBe('true');
 section('Technical information').click();await settle();const groups=[...document.querySelectorAll('.technical-member-actions')];expect(groups).toHaveLength(2);groups[0]!.querySelector<HTMLButtonElement>('button')!.click();groups[1]!.querySelectorAll<HTMLButtonElement>('button')[1]!.click();expect(inspect).toHaveBeenCalledWith(items[0]);expect(remove).toHaveBeenCalledWith(items[1]);expect(intent).not.toHaveBeenCalled();expect(JSON.stringify(source)).toBe(before);
});
it('keeps connection member controls guarded during drafts without rendering identity or Overview',async()=>{
 const source=bindingFixture(),graph=projectStructure(source),items=graph.edges.slice(0,2).map(edge=>({kind:'edge' as const,id:edge.id}));const {inspect,remove}=await start(source,items,true);section('Technical information').click();await settle();expect(document.querySelector('.selection-heading')).toBeNull();expect([...document.querySelectorAll<HTMLButtonElement>('.technical-member-actions button')].every(e=>e.disabled)).toBe(true);expect(document.querySelectorAll('.technical-member-actions button')).toHaveLength(4);expect(inspect).not.toHaveBeenCalled();expect(remove).not.toHaveBeenCalled();
});
