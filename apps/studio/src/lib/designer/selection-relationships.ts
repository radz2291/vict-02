import type {StructureGraph} from './structure.js';
import type {RelationRole} from './structure-semantics.js';
import {relationLabel} from './structure-connections.js';
import type {WorkspaceItem} from './workspace-selection.js';

export type RelationshipGroup = {edge:StructureGraph['edges'][number];paths:string[];selected:boolean};
type Group = RelationshipGroup;
/** Keep distinct owner/origin relationships and every exact declaration path. */
export function relationshipGroups(graph:StructureGraph,items:readonly WorkspaceItem[]):Group[]{
 const groups=new Map<string,Group>();
 const selectedEdges=new Set(items.filter(item=>item.kind==='edge').map(item=>item.id));
 for(const edge of graph.edges){
  if(!items.some(item=>item.kind==='edge'?item.id===edge.id:item.id===edge.source||item.id===edge.target))continue;
  const key=JSON.stringify([edge.source,edge.target,edge.data?.role,edge.data?.description,edge.data?.origin,edge.data?.owner,selectedEdges.has(edge.id)]);
  const existing=groups.get(key);
  if(existing)existing.paths.push(edge.data?.path??'');
  else groups.set(key,{edge,paths:[edge.data?.path??''],selected:selectedEdges.has(edge.id)});
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
const readingRoles:ReadonlySet<RelationRole>=new Set(['value','payload','fallback','items','key','condition','styles']);
/** Prefer the object doing the reading; other roles describe the declared source. */
export function relationshipSubject(edge:Group['edge'],selectedNodes:ReadonlySet<string>=new Set()):string {
 const from=selectedNodes.has(edge.source),to=selectedNodes.has(edge.target);
 if(from!==to)return from?edge.source:edge.target;
 return edge.data?.role&&readingRoles.has(edge.data.role)?edge.target:edge.source;
}
export type RelationshipStory={subjectId:string;targetId:string;selected:boolean;relations:Group[];count:number;shown:number};
/** One paging/grouping policy for every selection shape; each declaration occurs once. */
function groupStories(groups:readonly Group[],subject:(edge:Group['edge'])=>string,limit:number):RelationshipStory[]{
 const stories=new Map<string,RelationshipStory>();
 groups.forEach((group,index)=>{
  const subjectId=subject(group.edge),targetId=group.edge.source===subjectId?group.edge.target:group.edge.source;
  const key=JSON.stringify([subjectId,targetId,group.selected]);
  const story=stories.get(key)??{subjectId,targetId,selected:group.selected,relations:[],count:0,shown:0};
  story.count+=group.paths.length;
  if(index<limit){story.relations.push(group);story.shown+=group.paths.length;}
  stories.set(key,story);
 });
 return [...stories.values()].filter(story=>story.relations.length);
}
/** Single-object adapter retains the established compact story treatment. */
export function relationshipStories(groups:readonly Group[],selectedId:string,limit=50){
 return groupStories(groups,()=>selectedId,limit);
}
export function selectionRelationshipStories(graph:StructureGraph,items:readonly WorkspaceItem[],limit=50){
 const selectedNodes=new Set(items.filter(item=>item.kind==='node').map(item=>item.id));
 const groups=relationshipGroups(graph,items).sort((a,b)=>Number(b.selected)-Number(a.selected));
 return groupStories(groups,edge=>relationshipSubject(edge,selectedNodes),limit);
}
