import type {Edge} from '@victframework/ui-flow-svelte';
import type {WorkspaceItem} from './workspace-selection.js';
export const structureTraceContext=Symbol('Studio Structure relationship highlights');
export const portKey=(node:string,port:string)=>JSON.stringify([node,port]);
export type StructureHighlight={nodes:ReadonlySet<string>;edges:ReadonlySet<string>;ports:ReadonlySet<string>};
export type StructureTraceContext={
 current:()=>StructureHighlight|undefined;
 blocked?:()=>boolean;
 isPortSelected?:(node:string,port:string)=>boolean;
 hoverPort?:(node:string,port:string|undefined)=>void;
 selectPort?:(node:string,port:string,event:MouseEvent)=>void;
};
export function connectionGroup(edges:readonly Edge[],id:string):Edge[]{
 const selected=edges.find(edge=>edge.id===id);if(!selected)return [];
 const fields=(edge:Edge)=>JSON.stringify([edge.source,edge.target,edge.data?.role,edge.data?.description,edge.data?.owner,edge.data?.origin]);
 const key=fields(selected);return edges.filter(edge=>fields(edge)===key);
}
export function portConnections(edges:readonly Edge[],node:string,port:string):Edge[]{
 return edges.filter(edge=>edge.source===node&&edge.sourceHandle===port||edge.target===node&&edge.targetHandle===port);
}
/** Union of direct relationships only: related endpoints are never added to selection. */
export function selectionHighlight(edges:readonly Edge[],items:readonly WorkspaceItem[],preview:readonly string[]=[]):StructureHighlight|undefined {
 const explicitNodes=new Set(items.filter(item=>item.kind==='node').map(item=>item.id));
 const explicitEdges=new Set([...items.filter(item=>item.kind==='edge').map(item=>item.id),...preview]);
 const nodes=new Set(explicitNodes),lines=new Set<string>(),ports=new Set<string>();
 for(const edge of edges){
  if(!explicitEdges.has(edge.id)&&!explicitNodes.has(edge.source)&&!explicitNodes.has(edge.target))continue;
  lines.add(edge.id);nodes.add(edge.source);nodes.add(edge.target);
  if(edge.sourceHandle)ports.add(portKey(edge.source,edge.sourceHandle));
  if(edge.targetHandle)ports.add(portKey(edge.target,edge.targetHandle));
 }
 return nodes.size||lines.size?{nodes,edges:lines,ports}:undefined;
}
