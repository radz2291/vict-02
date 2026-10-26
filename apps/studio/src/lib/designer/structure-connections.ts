import type { Edge } from '@victframework/ui-flow-svelte';
import type { StructureEdgeData, StructureGraph } from './structure.js';

export type ConnectionKind = 'hierarchy' | 'read' | 'write' | 'action' | 'definition' | 'navigation' | 'reference';
export const connectionKinds: Record<ConnectionKind, { out: string; incoming: string; color: string; dash?: string }> = {
  hierarchy: { out:'Children', incoming:'Parent', color:'#7b879a' },
  read: { out:'Reads', incoming:'Read by', color:'#0f766e' },
  write: { out:'Updates', incoming:'Updated by', color:'#a16207', dash:'5 3' },
  action: { out:'Invokes', incoming:'Invoked by', color:'#7c3aed' },
  definition: { out:'Definition', incoming:'Definition links', color:'#3566a4', dash:'2 3' },
  navigation: { out:'Navigates to', incoming:'Navigation from', color:'#0369a1', dash:'8 3' },
  reference: { out:'References', incoming:'Referenced by', color:'#64748b', dash:'3 3' },
};
export function connectionKind(edge: Edge<StructureEdgeData>): ConnectionKind {
  if(edge.data?.kind==='containment')return 'hierarchy';
  if(edge.data?.kind==='definition')return 'definition';
  const label=String(edge.label ?? '');
  if(label.startsWith('reads:'))return 'read';
  if(label==='writes state')return 'write';
  if(label==='invokes action')return 'action';
  if(label==='navigates')return 'navigation';
  return 'reference';
}
export type StructurePort = { id:string; kind:ConnectionKind; side:'in'|'out'; label:string; count:number; color:string };
/** Ports describe visible declared edges, never new effect or connection authority. */
export function structurePorts(graph:StructureGraph,nodeId:string):StructurePort[] {
  const ports=new Map<string,StructurePort>();
  for(const edge of graph.edges){
    const kind=connectionKind(edge),meta=connectionKinds[kind];
    for(const side of ['in','out'] as const){
      if((side==='out'?edge.source:edge.target)!==nodeId)continue;
      const id=`${side}-${kind}`,port=ports.get(id);
      if(port)port.count++;
      else ports.set(id,{id,kind,side,label:side==='out'?meta.out:meta.incoming,count:1,color:meta.color});
    }
  }
  return [...ports.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
export function structureConnectionEdges(graph:StructureGraph):StructureGraph['edges'] {
  return graph.edges.map(edge=>{
    const kind=connectionKind(edge),meta=connectionKinds[kind];
    return {...edge,sourceHandle:`out-${kind}`,targetHandle:`in-${kind}`,
      style:`stroke: ${meta.color}; stroke-width: 1.5${meta.dash?`; stroke-dasharray: ${meta.dash}`:''}`};
  });
}
export type RelationshipGroup={targetId:string; count:number; relations:{kind:ConnectionKind;label:string;count:number;paths:string[]}[]};
/** One target card retains each distinct relation and all declared source paths. */
export function groupStructureRelationships(graph:StructureGraph,selectedId?:string):RelationshipGroup[] {
  const groups=new Map<string,RelationshipGroup>();
  for(const edge of graph.edges){
    if(edge.source!==selectedId && edge.target!==selectedId)continue;
    const outgoing=edge.source===selectedId,targetId=outgoing?edge.target:edge.source;
    const kind=connectionKind(edge),meta=connectionKinds[kind];
    const label=kind==='hierarchy'?(outgoing?'Contains':'Inside'):kind==='definition'
      ? String(edge.label).startsWith('definition')?(outgoing?'Defines':'Defined by'):(outgoing?'Uses definition':'Used by')
      :outgoing?meta.out:meta.incoming;
    const group=groups.get(targetId)??{targetId,count:0,relations:[]};
    const relation=group.relations.find(entry=>entry.kind===kind && entry.label===label);
    if(relation){relation.count++;relation.paths.push(edge.data?.path ?? '');}
    else group.relations.push({kind,label,count:1,paths:[edge.data?.path ?? '']});
    group.count++;groups.set(targetId,group);
  }
  return [...groups.values()];
}
