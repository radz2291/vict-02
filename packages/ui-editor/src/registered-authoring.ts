/** Reusable command construction; final atomic semantic admission belongs to the bridge/host. */
import { effectiveUiDescriptor, materializeAuthoringFragment, type UiAuthoringRegistration, type UiAuthoringRegistry, type UiNode, type UiExpression, type SemanticElementCatalog } from '@victframework/ui';
import { insertSubtree, type InsertRecipe, type CompositionTarget } from './composition.js';
import type { TransactionDraft } from './commands.js';

export function authoringRecipe(registration:UiAuthoringRegistration):InsertRecipe|undefined {
  if(!registration.seed || !['standalone','part'].includes(registration.eligibility.kind))return undefined;
  const fragment=registration.seed;
  const placements=registration.rules?.flatMap(rule=>rule.kind==='ancestorSlot'?rule.placements.map(({definitionId,slotName})=>({definitionId,slotName})):[]);
  return {id:registration.descriptor.id.replace(/^vict\.catalog\./,''),label:registration.label,description:registration.purpose,
    ...(placements?.length?{placements}:{}),create:id=>materializeAuthoringFragment(fragment,id).nodes,
    initialState:id=>materializeAuthoringFragment(fragment,id).localState??{}};
}
export function insertRegisteredComponent(input:{requestId:string;registry:UiAuthoringRegistry;nodeId:string;definitionId:string;revision?:string;props?:Readonly<Record<string,UiExpression>>;target:CompositionTarget;hostCapabilities?:readonly string[]}):TransactionDraft {
  if(!input.registry.ok)throw Error('The installed authoring registry is invalid.');
  const descriptor=effectiveUiDescriptor({definitionId:input.definitionId,...(input.revision?{revision:input.revision}:{})},input.registry.descriptors);
  const registration=descriptor&&input.registry.contracts.find(item=>item.descriptor.id===descriptor.id&&item.descriptor.revision===descriptor.revision);
  if(!registration || registration.eligibility.kind==='excluded')throw Error('This exact component is not eligible for authoring.');
  for(const rule of registration.rules??[])if(rule.kind==='hostRequirement'&&!input.hostCapabilities?.includes(rule.capability))throw Error(rule.reason);
  const node:UiNode={kind:'component',id:input.nodeId,definitionId:descriptor!.id,revision:descriptor!.revision,...(input.props?{props:input.props}:{})};
  // Parts deliberately use the same node/slot commands. Complete transactions must
  // pass authoringSemanticIssues; no separate recipe-only placement policy applies.
  return insertSubtree(input.requestId,[node],input.target);
}
export function insertRegisteredElement(input:{requestId:string;catalog:SemanticElementCatalog;nodeId:string;tag:string;target:CompositionTarget;attributes?:Extract<UiNode,{kind:'element'}>['attributes'];text?:string}):TransactionDraft {
  const definition=input.catalog.elements.find(item=>item.tag===input.tag);
  if(!definition)throw Error(`Element '${input.tag}' is not in the active semantic catalog.`);
  if(definition.leaf&&input.text!==undefined)throw Error(`Element '${input.tag}' cannot own text children.`);
  const childId=`${input.nodeId}-text`;
  return insertSubtree(input.requestId,[{kind:'element',id:input.nodeId,tag:input.tag,...(input.attributes?{attributes:input.attributes}:{}),children:input.text===undefined?[]:[childId]},...(input.text===undefined?[]:[{kind:'text' as const,id:childId,content:{type:'literal' as const,value:input.text}}])],input.target);
}
