import type {UiDocument,UiNode,UiValue} from '@victframework/ui';
import {parseGraph,applyGraphPatch,parseGraphV2,applyGraphPatchV2} from '@victframework/ui-flow-svelte';

/** Exact component version selects grammar; graph contents never select a migration. */
export function authoredGraphVersion(node:UiNode|undefined):1|2|undefined {
  if(node?.kind!=='component')return;
  if(node.definitionId==='vict.flow.workspace')return node.revision===undefined||node.revision==='1'?1:node.revision==='2'?2:undefined;
  if(node.definitionId==='vict.flow.editor'&&(node.revision===undefined||['1','2'].includes(node.revision)))return 1;
}

/** Only an explicitly bidirectional graph binding grants authoring persistence.
 * Other runtime state (search, chat drafts, simulated data) remains ephemeral. */
export function authoredGraphBinding(node:UiNode|undefined):string|undefined {
  if(node?.kind!=='component'||!authoredGraphVersion(node))return;
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
  if(!graphStateKeys(document).includes(key)||document.localState[key]?.type!=='string'||typeof value!=='string'||value.length>180000)return;
  const consumers=Object.values(document.nodes).filter(node=>node.kind==='component'&&authoredGraphVersion(node)&&node.props?.graph?.type==='ref'&&node.props.graph.path===`state.${key}`);
  if(consumers.some(node=>!(authoredGraphVersion(node)===2?parseGraphV2(value):parseGraph(value)).ok))return;
  if(document.localState[key]?.initial===value)return document;
  return {...document,localState:{...document.localState,[key]:{...document.localState[key]!,initial:value}}};
}
export function patchAuthoredGraph(document:UiDocument,nodeId:string,operations:unknown,revision:number):{ok:true;document:UiDocument}|{ok:false;message:string} {
  const node=document.nodes[nodeId],version=authoredGraphVersion(node);if(node?.kind!=='component'||!version)return {ok:false,message:'editGraph requires an exact authored graph workspace or retained graph component.'};
  const key=authoredGraphBinding(node);
  const prop=node.props?.graph;
  const source=key?document.localState[key]?.initial:prop?.type==='literal'?prop.value:undefined;
  if(typeof source!=='string')return {ok:false,message:'Bind graph and graphChange to the same string state, or supply a valid literal graph.'};
  const result=version===2?applyGraphPatchV2(source,operations,revision):applyGraphPatch(source,operations,revision);
  if(!result.ok||!result.source)return {ok:false,message:!result.ok?result.issues.map(issue=>`${issue.path}: ${issue.message}`).join('; ').slice(0,1200):'Graph patch produced no source.'};
  const next=key?graphStateDocument(document,key,result.source):{...document,nodes:{...document.nodes,[nodeId]:{...node,props:{...node.props,graph:{type:'literal' as const,value:result.source}}}}};
  return next?{ok:true,document:next}:{ok:false,message:'The graph update exceeds the authoring boundary.'};
}
