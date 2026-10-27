import type {StructureGraph} from './structure.js';
import type {WorkspaceItem} from './workspace-selection.js';

type Group = {edge:StructureGraph['edges'][number];paths:string[]};
/** Keep distinct owner/origin relationships and every exact declaration path. */
export function relationshipGroups(graph:StructureGraph,items:readonly WorkspaceItem[]):Group[]{
 const groups=new Map<string,Group>();
 for(const edge of graph.edges){
  if(!items.some(item=>item.kind==='edge'?item.id===edge.id:item.id===edge.source||item.id===edge.target))continue;
  const key=JSON.stringify([edge.source,edge.target,edge.data?.role,edge.data?.description,edge.data?.origin,edge.data?.owner]);
  const existing=groups.get(key);
  if(existing)existing.paths.push(edge.data?.path??'');
  else groups.set(key,{edge,paths:[edge.data?.path??'']});
 }
 return [...groups.values()];
}
export function relationshipCount(graph:StructureGraph,items:readonly WorkspaceItem[]):number{
 return relationshipGroups(graph,items).reduce((total,group)=>total+group.paths.length,0);
}
