// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
import Relationships from '../../src/lib/designer/SelectionRelationships.svelte';
import Details from '../../src/lib/designer/WorkspaceSelectionDetails.svelte';
import {projectStructure,structureId} from '../../src/lib/designer/structure.js';
import {relationshipCount,relationshipGroups,relationshipStories,relationshipPhrase} from '../../src/lib/designer/selection-relationships.js';
import {relationLabels,type RelationRole} from '../../src/lib/designer/structure-semantics.js';
import {bindingFixture,definitionsFixture} from '../fixtures/structure-semantics.js';
let app:ReturnType<typeof mount>|undefined;
async function settle(){flushSync();await tick();await tick();}
afterEach(async()=>{if(app)await unmount(app);app=undefined;document.body.innerHTML='';});
it('groups relationship stories by connected object, retaining direction, paths and the total',async()=>{
 const source=bindingFixture(),graph=projectStructure(source),id=structureId(source.id,'node','field');
 app=mount(Details,{target:document.body,props:{document:source,selection:{documentId:source.id,items:[{kind:'node',id}]},page:'relationships',onClose:vi.fn(),onSelect:vi.fn(),onNavigate:vi.fn(),onInspect:vi.fn(),onRemove:vi.fn(),onSelectionIntent:vi.fn()}});await settle();
 expect(document.querySelector('.details-relationships')?.textContent).toContain('Inside');expect(document.querySelector('.details-relationships')?.textContent).toContain('Reads from');expect(document.querySelector('.details-relationships')?.textContent).toContain('Updates');
 expect(document.querySelector('.connection-card')).toBeNull();expect(document.querySelector('.details-relationships')?.textContent).not.toContain('related items are not automatically selected');
 const anchor=graph.nodes.find(node=>node.id===id)!;expect(document.querySelectorAll('.endpoint')).toHaveLength(new Set(graph.edges.filter(e=>e.source===id||e.target===id).map(e=>e.source===id?e.target:e.source)).size);
 expect([...document.querySelectorAll('.endpoint')].every(e=>!e.getAttribute('title')?.includes(anchor.data.label))).toBe(true);
 expect(document.querySelector('[aria-label="Relationships"]')?.getAttribute('title')).toBe(`${relationshipCount(graph,[{kind:'node',id}])} declared relationships`);
 for(const role of document.querySelectorAll('.connection-role'))expect(role.getAttribute('title')).toContain('/');
});
it('retains both scoped endpoints for edge/mixed inspection and modifier-aware keyboard navigation',async()=>{
 const source=definitionsFixture(),base=projectStructure(source),props=base.nodes.filter(node=>node.data.kind==='prop');expect(props.length).toBeGreaterThan(1);
 const seed=projectStructure(bindingFixture()).edges[0]!;
 const graph={...base,edges:[{...seed,id:'scoped-edge',source:props[0]!.id,target:props[1]!.id}]};const intent=vi.fn();
 app=mount(Relationships,{target:document.body,props:{document:source,graph,items:[{kind:'edge',id:'scoped-edge'}],onIntent:intent}});await settle();
 const endpoints=[...document.querySelectorAll<HTMLButtonElement>('.endpoint')];expect(endpoints).toHaveLength(2);expect(endpoints[0]!.textContent).toContain('Definition a');expect(endpoints[1]!.textContent).toContain('Definition b');
 endpoints[0]!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true}));await settle();expect(intent.mock.calls.at(-1)).toMatchObject([{kind:'node',id:props[0]!.id},'toggle']);
 document.querySelector<HTMLButtonElement>('.connection-role')!.dispatchEvent(new MouseEvent('click',{ctrlKey:true,bubbles:true}));await settle();expect(intent.mock.calls.at(-1)).toEqual([{kind:'edge',id:'scoped-edge'},'toggle']);
});
it('keeps counts, paths and host distinctions without repeated provenance, with draft guards intact',async()=>{
 const source=bindingFixture(),base=projectStructure(source),edge=base.edges[0]!;
 const graph={...base,edges:[{...edge,id:'a',data:{...edge.data!,path:'/a'}},{...edge,id:'b',data:{...edge.data!,path:'/b'}},{...edge,id:'c',data:{...edge.data!,path:'/c',origin:'host' as const}}]};
 const items=[{kind:'node' as const,id:edge.target}];expect(relationshipCount(graph,items)).toBe(3);
 app=mount(Relationships,{target:document.body,props:{document:source,graph,items,onIntent:vi.fn(),blocked:true}});await settle();
 expect(document.querySelectorAll('.relationship-story')).toHaveLength(1);expect(document.querySelectorAll('.connection-role')).toHaveLength(2);expect(document.querySelector('.connection-role small')?.textContent).toBe('(2)');
 expect(document.querySelector('.connection-role')?.getAttribute('title')).toContain('/a\n/b');expect(document.querySelector('.details-relationships')?.textContent).not.toContain('Document declaration');expect(document.querySelectorAll('.origin')).toHaveLength(0);expect([...document.querySelectorAll('.connection-role')].some(e=>e.getAttribute('title')?.includes('Host connection'))).toBe(true);
 expect([...document.querySelectorAll('button')].every(e=>e.disabled)).toBe(true);
});

it('covers every canonical role in both source and destination perspective without losing read distinctions',()=>{
 const graph=projectStructure(bindingFixture()),edge=graph.edges[0]!;
 for(const role of Object.keys(relationLabels) as RelationRole[]){const relation={...edge,data:{...edge.data!,role}};expect(relationshipPhrase(relation,edge.source)).toBeTruthy();expect(relationshipPhrase(relation,edge.target)).toBeTruthy();expect(relationshipPhrase(relation,edge.source)).not.toBe(relationshipPhrase(relation,edge.target));}
 const label=(role:RelationRole,incoming=true)=>relationshipPhrase({...edge,data:{...edge.data!,role}},incoming?edge.target:edge.source);
 expect(label('value')).toBe('Reads from');expect(label('updates',false)).toBe('Updates');expect(label('updates')).toBe('Updated by');expect(label('fallback')).toBe('Fallback from');expect(label('invokes')).toBe('Requested by');expect(label('pending',false)).toBe('Pending to');expect(label('template')).toBe('Template of');expect(label('overlay')).toBe('Targets');
});
it('pages underlying groups within object cards and distinguishes shown references from the full count',()=>{
 const source=bindingFixture(),base=projectStructure(source),edge=base.edges[0]!;
 const graph={...base,edges:Array.from({length:51},(_,i)=>({...edge,id:`edge-${i}`,data:{...edge.data!,owner:`owner-${i}`,path:`/path/${i}`}}))};
 const groups=relationshipGroups(graph,[{kind:'node',id:edge.target}]);const partial=relationshipStories(groups,edge.target,50);expect(partial).toHaveLength(1);expect(partial[0]).toMatchObject({targetId:edge.source,count:51,shown:50});expect(partial[0]!.relations).toHaveLength(50);expect(relationshipStories(groups,edge.target,100)[0]).toMatchObject({count:51,shown:51});
});
