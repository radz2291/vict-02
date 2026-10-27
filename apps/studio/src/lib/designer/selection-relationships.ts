import type {StructureGraph} from './structure.js';
import type {RelationRole} from './structure-semantics.js';
import {relationLabel} from './structure-connections.js';
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

/** [destination perspective, source perspective]; wording describes declarations, not execution. */
const relationshipPhrases:Record<RelationRole,readonly [string,string]>={
 contains:['Inside','Contains'], value:['Reads from','Read by'], updates:['Updated by','Updates'],
 payload:['Input from','Supplies input to'], fallback:['Fallback from','Fallback for'],
 items:['Items from','Supplies items to'], key:['Key from','Supplies key to'],
 condition:['Depends on','Controls'], branch:['Branch of','Has branch'],
 otherwise:['Fallback of','Has fallback'], template:['Template of','Uses template'],
 uses:['Used by','Uses'], defines:['Root of','Defines root'], slot:['Slot content of','Has slot content'],
 invokes:['Requested by','Requests'], navigates:['Linked from','Navigates to'], styles:['Styled by','Styles'],
 pending:['Pending from','Pending to'], error:['Error from','Error to'], result:['Result from','Result to'],
 success:['Success from','Success to'], overlay:['Targets','Overlay target for'], emits:['Output of','Declares output'],
};
export function relationshipPhrase(edge:Group['edge'],selectedId:string):string{
 return edge.data?.role?relationshipPhrases[edge.data.role][edge.source===selectedId?1:0]:relationLabel(edge);
}
/** Page underlying relationship groups, while preserving full per-object reference counts. */
export function relationshipStories(groups:readonly Group[],selectedId:string,limit=50){
 const stories=new Map<string,{targetId:string;relations:Group[];count:number;shown:number}>();
 groups.forEach((group,index)=>{
  const targetId=group.edge.source===selectedId?group.edge.target:group.edge.source;
  const story=stories.get(targetId)??{targetId,relations:[],count:0,shown:0};
  story.count+=group.paths.length;
  if(index<limit){story.relations.push(group);story.shown+=group.paths.length;}
  stories.set(targetId,story);
 });
 return [...stories.values()].filter(story=>story.relations.length);
}
