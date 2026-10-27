// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {mount,unmount,flushSync,tick} from 'svelte';
import {canonicalUiDocument} from '@victframework/ui';
import Details from '../../src/lib/designer/WorkspaceSelectionDetails.svelte';
import Relationships from '../../src/lib/designer/SelectionRelationships.svelte';
import {projectStructure,structureId} from '../../src/lib/designer/structure.js';
import {relationshipCount,relationshipGroups,selectionRelationshipStories,relationshipPhrase} from '../../src/lib/designer/selection-relationships.js';
import type {WorkspaceItem} from '../../src/lib/designer/workspace-selection.js';
import {bindingFixture,repeatFixture} from '../fixtures/structure-semantics.js';
let app:ReturnType<typeof mount>|undefined;
afterEach(async()=>{if(app)await unmount(app);app=undefined;document.body.innerHTML='';});
async function settle(){flushSync();await tick();await tick();}
function seed(){const source=bindingFixture(),graph=projectStructure(source),field=structureId(source.id,'node','field'),mirror=structureId(source.id,'node','mirror'),state=structureId(source.id,'state','message');return {source,graph,field,mirror,state,read:graph.edges.find(e=>e.target===field&&e.data?.role==='value')!,write:graph.edges.find(e=>e.source===field&&e.data?.role==='updates')!};}
it('gives multiple nodes separate object stories and represents shared selected-node connections once',()=>{
 const {source,graph,field,mirror,state}=seed(),digest=canonicalUiDocument(source).contentDigest;
 for(const ids of [[field,mirror],[field,state]]){
  const items=ids.map(id=>({kind:'node' as const,id})),stories=selectionRelationshipStories(graph,items);
  const paths=stories.flatMap(s=>s.relations.flatMap(r=>r.paths));
  expect(paths.sort()).toEqual(graph.edges.filter(e=>ids.includes(e.source)||ids.includes(e.target)).map(e=>e.data!.path).sort());
  expect(paths.length).toBe(relationshipCount(graph,items));
  expect(stories.filter(s=>s.targetId===state&&s.relations.some(r=>r.edge.data?.role==='value')).every(s=>s.subjectId===field||s.subjectId===mirror)).toBe(true);
 }
 expect(canonicalUiDocument(source).contentDigest).toBe(digest);
});
it('tells the read and update story from the input perspective for selected edges without adding other declarations',async()=>{
 const {source,graph,field,state,read,write}=seed(),items:WorkspaceItem[]=[{kind:'edge',id:read.id},{kind:'edge',id:write.id}],stories=selectionRelationshipStories(graph,items);
 expect(stories).toHaveLength(1);expect(stories[0]).toMatchObject({subjectId:field,targetId:state,count:2,selected:true});
 expect(stories[0]!.relations.map(r=>relationshipPhrase(r.edge,field))).toEqual(['Reads from','Updates']);
 const intent=vi.fn();app=mount(Relationships,{target:document.body,props:{document:source,graph,items,onIntent:intent}});await settle();
 expect(document.querySelectorAll('.relationship-story')).toHaveLength(1);expect(document.querySelectorAll('.endpoint')).toHaveLength(2);
 const roles=[...document.querySelectorAll<HTMLButtonElement>('.connection-role')];expect(roles.map(r=>r.textContent?.trim())).toEqual(['Reads from','Updates']);
 roles[1]!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true}));await settle();expect(intent).toHaveBeenLastCalledWith({kind:'edge',id:write.id},'toggle');
 expect(document.querySelector('.details-relationships')?.textContent).not.toContain('Fallback');
});
it('distinguishes selected connections from node context without duplicating a declaration in a mixed selection',async()=>{
 const {source,graph,field,read}=seed(),items:WorkspaceItem[]=[{kind:'node',id:field},{kind:'edge',id:read.id}],stories=selectionRelationshipStories(graph,items);
 expect(stories.filter(s=>s.selected).flatMap(s=>s.relations.map(r=>r.edge.id))).toEqual([read.id]);
 expect(stories.flatMap(s=>s.relations.map(r=>r.edge.id)).filter(id=>id===read.id)).toHaveLength(1);
 app=mount(Relationships,{target:document.body,props:{document:source,graph,items,onIntent:vi.fn()}});await settle();
 expect(document.querySelector('[aria-label="Selected connections"]')?.textContent).toContain('Reads from');
 expect(document.querySelector('[aria-label="Related connections"]')?.textContent).toContain('Updates');
});
it('keeps owner/origin/reference distinctions and honest totals when paging a large multi-node selection',()=>{
 const {graph,field,mirror,read}=seed(),items:WorkspaceItem[]=[{kind:'node',id:field},{kind:'node',id:mirror}];
 const many={...graph,edges:Array.from({length:51},(_,i)=>({...read,id:`e${i}`,data:{...read.data!,owner:`owner${i}`,origin:i%2?'host' as const:'document' as const,path:`/ref/${i}`}}))};
 const stories=selectionRelationshipStories(many,items,50);expect(stories).toHaveLength(1);expect(stories[0]).toMatchObject({count:51,shown:50});expect(stories[0]!.relations).toHaveLength(50);expect(relationshipGroups(many,items)).toHaveLength(51);
 expect(selectionRelationshipStories(many,items,100)[0]!.relations.flatMap(r=>r.paths)).toHaveLength(51);
});
it('keeps connection identity above distinct Overview and Relationships with exact technical provenance',async()=>{
 const {source,read}=seed(),intent=vi.fn();app=mount(Details,{target:document.body,props:{document:source,selection:{documentId:source.id,items:[{kind:'edge',id:read.id}]},onClose:vi.fn(),onSelect:vi.fn(),onNavigate:vi.fn(),onInspect:vi.fn(),onRemove:vi.fn(),onSelectionIntent:intent}});await settle();
 const overview=document.querySelector('[aria-label="Selection overview"]')!;expect(overview.textContent).toContain('Defined in');expect(overview.querySelector('.relationship-story')).toBeNull();expect(document.querySelector('.selection-heading')?.textContent).toContain('Reads from');
 expect(document.querySelector('[aria-label="Selection technical information"]')?.textContent).toContain(read.data!.path);
 expect(document.querySelector('[aria-label="Selection technical information"]')?.textContent).toContain('Document declaration');
});
it('explains source-shared repeat relationships and respects blocked relationship controls',async()=>{
 const source=repeatFixture(),graph=projectStructure(source),id=structureId(source.id,'node','ta');
 app=mount(Relationships,{target:document.body,props:{document:source,graph,items:[{kind:'node',id,occurrence:`${source.id}|ta|row-a`},{kind:'node',id,occurrence:`${source.id}|ta|row-b`}],blocked:true,onIntent:vi.fn()}});await settle();
 expect(document.querySelector('.details-relationships')?.textContent).toContain('shared by the selected occurrences');expect([...document.querySelectorAll<HTMLButtonElement>('.endpoint,.connection-role')].every(b=>b.disabled)).toBe(true);
});
