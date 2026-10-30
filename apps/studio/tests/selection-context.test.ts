import {expect,it} from 'vitest';
import {bindingFixture} from './fixtures/structure-semantics.js';
import {projectStructure,structureId} from '../src/lib/designer/structure.js';
import {selectionSet,selectionSetSchema,selectionContext,validSelectionSet} from '../src/lib/designer/selection-context.js';
import {nodeItem} from '../src/lib/designer/workspace-selection.js';
import {agentContext,documentCursor} from '../src/lib/designer/agent-edits.js';
import {validateAgentStart} from '../src/lib/server/designer-agent.js';
it('delivers nodes, state and edges as passive server-validated source context with legacy single selection intact',()=>{
 const source=bindingFixture(),graph=projectStructure(source),field=nodeItem(source,`${source.id}|field`)!;
 const set=selectionSet({documentId:source.id,items:[field,{kind:'node',id:structureId(source.id,'state','message')},{kind:'edge',id:graph.edges[0]!.id}]});
 const cursor=documentCursor(source,'r1',crypto.randomUUID());const request={document:source,cursor,prompt:'Review these',selectionSet:set};
 expect(validateAgentStart(request).ok).toBe(true);
 const result=agentContext(source,cursor,undefined,{},set);expect(result.selection).toBeNull();expect(result.selectionSet).toMatchObject({total:3,truncated:false,items:[{kind:'node'},{kind:'node',type:'State'},{kind:'edge',type:'Connection'}]});
 expect(agentContext(source,cursor,`${source.id}|field`).selection).toMatchObject({nodeId:'field'});
});
it('refuses foreign, removed, mismatched and oversized selection references without invoking a provider',()=>{
 const source=bindingFixture(),cursor=documentCursor(source,'r1',crypto.randomUUID()),field=nodeItem(source,`${source.id}|field`)!;
 const set=selectionSet({documentId:source.id,items:[field]});const request={document:source,cursor,prompt:'Inspect',selectionSet:set};
 expect(validateAgentStart({...request,selectionSet:{...set,documentId:'other'}}).ok).toBe(false);
 expect(validateAgentStart({...request,selectionSet:{...set,items:[{...field,id:structureId(source.id,'node','mirror')}]}}).ok).toBe(false);
 expect(validateAgentStart({...request,selectionSet:{...set,items:[{kind:'node',id:'missing'}]}}).ok).toBe(false);
 expect(selectionSetSchema.safeParse({...set,total:13,items:Array(13).fill(field)}).success).toBe(false);
 expect(selectionSetSchema.safeParse({...set,authority:'edit'}).success).toBe(false);
 expect(validSelectionSet(source,set,{})).toBe(true);
});
it('bounds large passive sets, retains an explicit total and regenerates names from source',()=>{
 const source=bindingFixture(),graph=projectStructure(source),field=nodeItem(source,`${source.id}|field`)!;
 const set=selectionSet({documentId:source.id,items:Array.from({length:100},(_,i)=>({...field,occurrence:`${source.id}|field|row-${i}`}))});
 expect(set.items).toHaveLength(12);expect(JSON.stringify(set).length).toBeLessThan(6500);
 const context=selectionContext(source,set,{});expect(context).toMatchObject({total:100,truncated:true});expect(context!.items.every(item=>item.type==='Input')).toBe(true);
 expect(graph.nodes.some(node=>node.id===field.id)).toBe(true);
});
