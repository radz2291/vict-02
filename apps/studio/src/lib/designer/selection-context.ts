import {z} from 'zod';
import type {UiDocument} from '@victframework/ui';
import {projectStructure,type StructureContext} from './structure.js';
import {nodeItem,pruneSelection,type WorkspaceItem,type WorkspaceSelection} from './workspace-selection.js';
import {selectionIdentity} from './selection-presentation.js';
import {relationLabel} from './structure-connections.js';
const id=z.string().min(1);
export const selectionSetSchema=z.object({documentId:z.string().min(1),total:z.number().int().min(0),items:z.array(z.discriminatedUnion('kind',[z.object({kind:z.literal('node'),id,occurrence:z.string().min(1).optional()}).strict(),z.object({kind:z.literal('edge'),id}).strict()]))}).strict().refine(value=>value.total>=value.items.length);
export type SelectionSet=z.infer<typeof selectionSetSchema>;
/** Passive references only; retain all supplied selections without granting edit authority. */
export function selectionSet(selection:WorkspaceSelection):SelectionSet{
 const items:WorkspaceItem[]=selection.items.map(item=>({...item}));
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
 for(const item of set.items){const identity=selectionIdentity(document,graph,item);const edge=item.kind==='edge'?graph.edges.find(edge=>edge.id===item.id):undefined;const member={...item,type:identity.type,label:(edge?relationLabel(edge):identity.name),...(identity.scope?{scope:identity.scope}:{}),...(edge?{from:edge.source,to:edge.target,origin:edge.data?.origin??'document'}:{})};members.push(member);}
 return {documentId:document.id,total:set.total,items:members,truncated:members.length<set.total,meaning:'Passive source selection, not edit or execution authority. Runtime occurrence keys are references, not a claim that a row is currently rendered.'};
}
