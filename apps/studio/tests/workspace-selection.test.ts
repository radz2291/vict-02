import {expect,it} from 'vitest';
import {occurrenceRange} from '@victframework/ui-editor';
import {bindingFixture,definitionsFixture,compileFixture} from './fixtures/structure-semantics.js';
import {projectStructure,structureId} from '../src/lib/designer/structure.js';
import {structureConnectionEdges} from '../src/lib/designer/structure-connections.js';
import {changeSelection,nodeItem,itemKey,pruneSelection,singleOccurrence,type WorkspaceSelection} from '../src/lib/designer/workspace-selection.js';
import {selectionHighlight,portConnections,connectionGroup,portKey} from '../src/lib/designer/structure-trace.js';
it('combines nodes and relationships and toggles a complete socket group without losing remaining members',()=>{
 const source=bindingFixture(),graph=projectStructure(source),field=nodeItem(source,`${source.id}|field`)!;
 const edges=structureConnectionEdges(graph),port=portConnections(edges,field.id,'in-value').map(edge=>({kind:'edge' as const,id:edge.id}));
 let state:WorkspaceSelection={documentId:source.id,items:[]};
 state=changeSelection(state,[field],'replace');expect(singleOccurrence(state)).toBe(`${source.id}|field`);
 state=changeSelection(state,port,'toggle');expect(state.items).toHaveLength(2);expect(singleOccurrence(state)).toBeUndefined();
 const selected=JSON.stringify(state);expect(selectionHighlight(edges,state.items)).toBeDefined();expect(JSON.stringify(state)).toBe(selected);
 state=changeSelection(state,port,'toggle');expect(state.items).toEqual([field]);
 state=changeSelection(state,[field],'toggle');expect(state.items).toEqual([]);
});
it('keeps occurrence identities distinct even when they resolve to the same source declaration',()=>{
 const seed=definitionsFixture();const source={...seed,nodes:{...seed.nodes,b:{...seed.nodes.a!,id:'b'}},componentDefinitions:{a:seed.componentDefinitions.a!}};expect(compileFixture(source).ok).toBe(true);
 const first=nodeItem(source,`${source.id}|ta|a@a`)!,second=nodeItem(source,`${source.id}|ta|b@a`)!;
 expect(first.id).toBe(second.id);expect(itemKey(first)).not.toBe(itemKey(second));
 const state=changeSelection({documentId:source.id,items:[first]},[second],'toggle');expect(state.items).toHaveLength(2);
 expect(pruneSelection(state,{...source,id:'different'},projectStructure(source)).items).toEqual([]);
 const nodes=Object.fromEntries(Object.entries(source.nodes).filter(([id])=>id!=='b'));expect(pruneSelection(state,{...source,nodes},projectStructure(source)).items).toEqual([first]);
});
it('prunes removed declarations while retaining valid selected items through source revisions',()=>{
 const source=bindingFixture(),field=nodeItem(source,`${source.id}|field`)!,mirror=nodeItem(source,`${source.id}|mirror`)!;
 const nodes={...source.nodes};delete nodes.mirror;const next={...source,nodes};
 const state=changeSelection({documentId:source.id,items:[]},[field,mirror],'replace');
 expect(pruneSelection(state,next,projectStructure(next)).items).toEqual([field]);
});
it('derives direct highlight unions without selecting endpoints or traversing the whole graph',()=>{
 const edges=[{id:'a',source:'one',target:'two',sourceHandle:'out-value',targetHandle:'in-value',label:'Value'},{id:'b',source:'two',target:'three',sourceHandle:'out-value',targetHandle:'in-value',label:'Value'}];
 const selection=[{kind:'node' as const,id:'one'}],highlight=selectionHighlight(edges,selection)!;
 expect([...highlight.edges]).toEqual(['a']);expect([...highlight.nodes]).toEqual(['one','two']);expect(highlight.ports.has(portKey('two','in-value'))).toBe(true);
 expect(selection).toEqual([{kind:'node',id:'one'}]);
 expect([...selectionHighlight(edges,selection,['b'])!.edges]).toEqual(['a','b']);expect(selectionHighlight(edges,[])).toBeUndefined();
});
it('uses only visible layer order and handles a filtered-out range anchor predictably',()=>{
 expect(occurrenceRange(['a','b','d'],'a','d')).toEqual(['a','b','d']);
 expect(occurrenceRange(['a','b','d'],'hidden','d')).toEqual(['d']);
 expect(occurrenceRange(['a','b','d'],'d','a')).toEqual(['a','b','d']);
});
it('retains every source path in a counted line and chooses the exact role socket',()=>{
 const source=bindingFixture(),graph=projectStructure(source),original=graph.edges[0]!;
 const edges=structureConnectionEdges({...graph,edges:[original,{...original,id:'other',data:{...original.data!,path:'/other'}}]});
 expect(connectionGroup(edges,original.id)).toHaveLength(2);expect(edges[1]?.focusable).toBe(false);
 expect(portConnections(edges,original.source,edges[0]!.sourceHandle!)).toHaveLength(2);
 expect(graph.edges.some(edge=>edge.target===structureId(source.id,'node','field'))).toBe(true);
});
