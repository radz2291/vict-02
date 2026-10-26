import {expect,it} from 'vitest';
import {projectStructure} from '../src/lib/designer/structure.js';
import {structureConnectionEdges,structurePorts} from '../src/lib/designer/structure-connections.js';
import {structureTrace} from '../src/lib/designer/structure-trace.js';
import {bindingFixture} from './fixtures/structure-semantics.js';
it('traces the exact declared relation and both matching ports without modifying the graph',()=>{
 const graph=projectStructure(bindingFixture()),edges=structureConnectionEdges(graph),before=JSON.stringify(edges);
 for(const edge of edges.filter(edge=>edge.label)){
  const trace=structureTrace(edges,edge.id)!;
  expect(trace.id).toBe(edge.id);
  expect(structurePorts(graph,trace.source).some(port=>port.id===trace.sourceHandle&&port.side==='out')).toBe(true);
  expect(structurePorts(graph,trace.target).some(port=>port.id===trace.targetHandle&&port.side==='in')).toBe(true);
 }
 expect(structureTrace(edges,'removed')).toBeUndefined();expect(structureTrace(edges)).toBeUndefined();
 expect(JSON.stringify(edges)).toBe(before);
});
it('retains coincident declaration records but only exposes their counted line to focus/selection',()=>{
 const graph=projectStructure(bindingFixture()),original=graph.edges[0]!;
 const copy={...original,id:original.id+'-second-location',data:{...original.data!,path:'/second/location'}};
 const projected=structureConnectionEdges({...graph,edges:[original,copy]});
 expect(projected).toHaveLength(2);expect(projected[0]?.label).toContain('· 2');
 expect(projected[0]?.focusable).toBe(true);expect(projected[1]?.focusable).toBe(false);
 expect(projected[1]?.selectable).toBe(false);expect(structureTrace(projected,copy.id)).toBeUndefined();
 expect(projected.map(edge=>edge.data?.path)).toEqual([original.data?.path,'/second/location']);
});
