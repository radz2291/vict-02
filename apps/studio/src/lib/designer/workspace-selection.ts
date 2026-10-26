import type {UiDocument} from '@victframework/ui';
import {resolveOccurrence,type SelectionOperation} from '@victframework/ui-editor';
import {structureId,type StructureGraph} from './structure.js';

export type WorkspaceItem = {kind:'node';id:string;occurrence?:string}|{kind:'edge';id:string};
export type WorkspaceSelection = {documentId:string;items:readonly WorkspaceItem[];primary?:string};
export const itemKey=(item:WorkspaceItem)=>JSON.stringify([item.kind,item.id,item.kind==='node'?item.occurrence??null:null]);
function validOccurrence(document:UiDocument,occurrence:string):boolean {
  const report=resolveOccurrence(occurrence,document);
  return !!report.node&&report.instancePath.every(step=>{const node=document.nodes[step.sourceNodeId];return node?.kind==='component'&&node.definitionId===step.definitionId;})&&report.portalPath.every(step=>{const node=document.nodes[step.sourceNodeId];return node?.kind==='portal'&&node.target.overlayId===step.overlayId;});
}
export function nodeItem(document:UiDocument,occurrence:string):WorkspaceItem|undefined {
  const report=resolveOccurrence(occurrence,document);
  return validOccurrence(document,occurrence)?{kind:'node',id:structureId(document.id,'node',report.sourceNodeId),occurrence}:undefined;
}
export function changeSelection(selection:WorkspaceSelection,targets:readonly WorkspaceItem[],operation:SelectionOperation,primary?:WorkspaceItem):WorkspaceSelection {
  const incoming=new Map(targets.map(item=>[itemKey(item),item]));
  const members=new Map((operation==='replace'?[]:selection.items).map(item=>[itemKey(item),item]));
  const remove=operation==='toggle' && incoming.size>0 && [...incoming.keys()].every(key=>members.has(key));
  for(const [key,item] of incoming){if(remove)members.delete(key);else members.set(key,item);}
  const preferred=primary?itemKey(primary):[...incoming.keys()].at(-1);
  return {...selection,items:[...members.values()],primary:preferred&&members.has(preferred)?preferred:selection.primary&&members.has(selection.primary)?selection.primary:[...members.keys()].at(-1)};
}
export function pruneSelection(selection:WorkspaceSelection,document:UiDocument,graph:StructureGraph):WorkspaceSelection {
  if(selection.documentId!==document.id)return {documentId:document.id,items:[]};
  const nodes=new Set(graph.nodes.map(node=>node.id)),edges=new Set(graph.edges.map(edge=>edge.id));
  const items=selection.items.filter(item=>item.kind==='edge'?edges.has(item.id):nodes.has(item.id)&&(!item.occurrence||validOccurrence(document,item.occurrence)));
  return {...selection,items,primary:items.some(item=>itemKey(item)===selection.primary)?selection.primary:items.at(-1)?itemKey(items.at(-1)!):undefined};
}
export function singleOccurrence(selection:WorkspaceSelection):string|undefined {
  const item=selection.items.length===1?selection.items[0]:undefined;
  return item?.kind==='node'?item.occurrence:undefined;
}
export function primaryItem(selection:WorkspaceSelection):WorkspaceItem|undefined {
  return selection.items.find(item=>itemKey(item)===selection.primary)??selection.items.at(-1);
}
