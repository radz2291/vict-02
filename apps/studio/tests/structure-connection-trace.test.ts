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

it('routes a backward connection outside tall endpoint cards and nearby blockers',async()=>{
 const {feedbackPath}=await import('../src/lib/designer/structure-edge-geometry.js');
 const source={x:340,y:60,width:224,height:180},target={x:20,y:100,width:224,height:120};
 const blocker={x:250,y:0,width:60,height:80},cards=[source,target,blocker];
 const path=feedbackPath({x:564,y:130},{x:20,y:150},source,target,cards);
 const points=[...path.matchAll(/[ML] (-?[\d.]+),(-?[\d.]+)/g)].map(match=>({x:Number(match[1]),y:Number(match[2])}));
 expect(points).toHaveLength(6);
 for(let index=1;index<points.length;index++){
  const a=points[index-1]!,b=points[index]!;
  for(const card of cards){
   const hits=Math.min(a.x,b.x)<card.x+card.width-3&&Math.max(a.x,b.x)>card.x+3&&Math.min(a.y,b.y)<card.y+card.height-3&&Math.max(a.y,b.y)>card.y+3;
   expect(hits).toBe(false);
  }
 }
 expect(feedbackPath({x:564,y:130},{x:20,y:150},source,target,cards)).toBe(path);
});
