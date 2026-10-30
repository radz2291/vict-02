import {z} from 'zod';
import type {UiDocument} from '@victframework/ui';
import {projectStructure,type StructureContext} from './structure.js';
import {nodeItem,pruneSelection,type WorkspaceItem,type WorkspaceSelection} from './workspace-selection.js';
import {selectionIdentity} from './selection-presentation.js';
import {relationLabel} from './structure-connections.js';
const id=z.string().min(1).max(4096);
export const selectionSetSchema=z.object({documentId:z.string().min(1).max(160),total:z.number().int().min(0).max(20000),items:z.array(z.discriminatedUnion('kind',[z.object({kind:z.literal('node'),id,occurrence:z.string().min(1).max(1000).optional()}).strict(),z.object({kind:z.literal('edge'),id}).strict()])).max(12)}).strict().refine(value=>value.total>=value.items.length);
export type SelectionSet=z.infer<typeof selectionSetSchema>;
/** Passive references only; keep existing request/read budgets and edit authority. */
export function selectionSet(selection:WorkspaceSelection):SelectionSet{
 const items:WorkspaceItem[]=[];
 for(const item of selection.items.slice(-12)){if(item.id.length>4096||item.kind==='node'&&(item.occurrence?.length??0)>1000)continue;if(JSON.stringify([...items,item]).length>6000)break;items.push(item);}
 return {documentId:selection.documentId,total:selection.items.length,items};
}
export function validSelectionSet(document:UiDocument,set:SelectionSet,context:StructureContext){
 if(set.documentId!==document.id)return false;
 const retained=pruneSelection({documentId:set.documentId,items:set.items},document,projectStructure(document,context));
 return retained.items.length===set.items.length&&set.items.every(item=>item.kind!=='node'||!item.occurrence||nodeItem(document,item.occurrence)?.id===item.id);
}
export function selectionContext(document:UiDocument,set:SelectionSet|undefined,context:StructureContext){
 if(!set)return undefined;
 const graph=projectStructure(document,context),members:Record<string,unknown>[]=[];
 for(const item of set.items){const identity=selectionIdentity(document,graph,item);const edge=item.kind==='edge'?graph.edges.find(edge=>edge.id===item.id):undefined;const member={...item,type:identity.type,label:(edge?relationLabel(edge):identity.name).slice(0,160),...(identity.scope?{scope:identity.scope.slice(0,200)}:{}),...(edge?{from:edge.source,to:edge.target,origin:edge.data?.origin??'document'}:{})};if(new TextEncoder().encode(JSON.stringify([...members,member])).byteLength>5000)break;members.push(member);}
 return {documentId:document.id,total:set.total,items:members,truncated:members.length<set.total,meaning:'Passive source selection, not edit or execution authority. Runtime occurrence keys are references, not a claim that a row is currently rendered.'};
}
