import type {UiDocument,UiNode,UiValue} from '@victframework/ui';
import {parseGraph,applyGraphPatch} from '@victframework/ui-flow-svelte';

/** Only an explicitly bidirectional graph binding grants authoring persistence.
 * Other runtime state (search, chat drafts, simulated data) remains ephemeral. */
export function authoredGraphBinding(node:UiNode|undefined):string|undefined {
  if(node?.kind!=='component'||!['vict.flow.editor','vict.flow.workspace'].includes(node.definitionId))return;
  const read=node.props?.graph,write=node.outputs?.graphChange;
  if(read?.type!=='ref'||!read.path.startsWith('state.')||!write||!('setState' in write)||write.setState.value)return;
  const key=read.path.slice(6);
  return write.setState.key===key?key:undefined;
}
export function graphStateKeys(document:UiDocument):string[] {
  return [...new Set(Object.values(document.nodes).flatMap(node=>{const key=authoredGraphBinding(node);return key?[key]:[];}))];
}
/** A canonical source change owns graph values. Preserve other simulation state,
 * but never let a prior runtime mirror hide a later manual or agent graph edit. */
export function rebaseGraphRuntime(document:UiDocument,values:Readonly<Record<string,UiValue>>):Record<string,UiValue> {
  const next={...values};
  for(const key of graphStateKeys(document)){
    const declaration=document.localState[key];
    if(declaration?.type==='string')next[key]=declaration.initial;
    else delete next[key];
  }
  return next;
}
export function graphStateDocument(document:UiDocument,key:string,value:unknown):UiDocument|undefined {
  if(!graphStateKeys(document).includes(key)||document.localState[key]?.type!=='string'||typeof value!=='string'||value.length>180000||!parseGraph(value).ok)return;
  if(document.localState[key]?.initial===value)return document;
  return {...document,localState:{...document.localState,[key]:{...document.localState[key]!,initial:value}}};
}
export function patchAuthoredGraph(document:UiDocument,nodeId:string,operations:unknown,revision:number):{ok:true;document:UiDocument}|{ok:false;message:string} {
  const node=document.nodes[nodeId];if(node?.kind!=='component'||!['vict.flow.editor','vict.flow.workspace'].includes(node.definitionId))return {ok:false,message:'editGraph requires an authored graph workspace or retained graph component.'};
  const key=authoredGraphBinding(node);
  const prop=node.props?.graph;
  const source=key?document.localState[key]?.initial:prop?.type==='literal'?prop.value:undefined;
  if(typeof source!=='string')return {ok:false,message:'Bind graph and graphChange to the same string state, or supply a valid literal graph.'};
  const result=applyGraphPatch(source,operations,revision);
  if(!result.ok||!result.source)return {ok:false,message:!result.ok?result.issues.map(issue=>`${issue.path}: ${issue.message}`).join('; ').slice(0,1200):'Graph patch produced no source.'};
  const next=key?graphStateDocument(document,key,result.source):{...document,nodes:{...document.nodes,[nodeId]:{...node,props:{...node.props,graph:{type:'literal' as const,value:result.source}}}}};
  return next?{ok:true,document:next}:{ok:false,message:'The graph update exceeds the authoring boundary.'};
}
