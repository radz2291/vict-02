/** Source discovery is not a rendered-occurrence or runtime-visibility claim. */
import type { UiDocument, UiNode } from '@victframework/ui';
import { compositionChildren } from '@victframework/ui-editor';
import { authoringContract } from './authoring.js';
import { designerCatalogs } from './application.js';

export function sourceChildren(node:UiNode):readonly string[] {
  if(node.kind==='repeat')return [node.templateRoot];
  if(node.kind==='conditional')return node.branches.flatMap(branch=>branch.children);
  if(node.kind==='slot')return node.fallback??[];
  return compositionChildren(node);
}

/** Deterministic pre-order, deduplicated and cycle-safe, without expanding shared definitions. */
export function scopedSourceNodes(document:UiDocument,nodeId:string|undefined,scope:'self'|'subtree'|'document'):UiNode[] {
  if(!nodeId||scope==='document')return Object.values(document.nodes);
  if(!Object.hasOwn(document.nodes,nodeId))return [];
  if(scope==='self')return [document.nodes[nodeId]!];
  const result:UiNode[]=[];const visited=new Set<string>();
  const visit=(id:string)=>{
    if(visited.has(id)||!Object.hasOwn(document.nodes,id))return;
    visited.add(id);const node=document.nodes[id]!;result.push(node);sourceChildren(node).forEach(visit);
  };
  visit(nodeId);return result;
}

/** Search identities, visible labels and semantic component roles, not only a truncated JSON preview. */
export function sourceNodeSearchText(node:UiNode):string {
  const parts:unknown[]=[node.id,node.kind];
  if(node.kind==='text'&&node.content.type==='literal')parts.push(node.content.value);
  if(node.kind==='element')parts.push(node.tag,({nav:'navigation',main:'page',section:'section',button:'button action',input:'input field',textarea:'multiline text field',a:'link navigation',form:'form',h1:'heading',h2:'heading',h3:'heading',img:'image media'} as Record<string,string>)[node.tag],...['aria-label','role','title','alt','placeholder','name'].map(key=>node.attributes?.[key]));
  if(node.kind==='component'){
    const contract=authoringContract(node.definitionId,node.revision);
    parts.push(node.definitionId,contract?.label,contract?.family,contract?.category,contract?.purpose,
      ...['label','title','alt','name','placeholder','description','value'].map(key=>{const prop=node.props?.[key];return prop?.type==='literal'?prop.value:undefined;}));
  }
  return parts.filter(value=>typeof value==='string').join(' ').toLowerCase();
}

/** Project installed descriptor identities and actual command restrictions together. */
export function effectiveNodeCapabilities(node:UiNode) {
  if(node.kind==='component'){
    const contract=authoringContract(node.definitionId,node.revision);
    if(!contract)return {kind:node.kind,available:false,definitionId:node.definitionId,reason:'No exact installed authoring contract. Local document definitions require their own source inspection.'};
    const descriptor=contract.descriptor;
    return {kind:node.kind,available:true,definitionId:descriptor.id,revision:descriptor.revision,contractDigest:contract.digest,
      eligibility:contract.eligibility,
      props:descriptor.props.map(prop=>({name:prop.name,type:prop.type})),
      outputs:(descriptor.outputs??[]).map(output=>({name:output.name,payload:output.payload})),
      slots:descriptor.slots??[],requiredSlots:contract.capabilities.required??[],
      presentation:{
        declaredParts:descriptor.styleTargets??[],
        classes:{supported:!!descriptor.styleTargets?.length,operation:'modify',field:'classes',value:node.classes??[],mode:'replace',emptyClears:true,guidance:'Use canonical classes array for authored DOM tokens on the primary owned presentation target. Generated ownership classes remain. attributes.class does not replace this field.'},
        partStyle:{supported:!!descriptor.styleTargets?.length,operation:'style',partField:'part',targets:descriptor.styleTargets??[],states:['base','hover','focus','active','disabled'],conditions:true,
          guidance:'Select an exact declared semantic part. Styling affects only that owned implementation surface; preflight checks this source and installed renderer contract.'},
        legacyStyle:{operation:'style',part:null,conditional:false,guidance:'Without part, base styling reaches the primary presentation target. Legacy conditional styling requires an element; use an explicit component part instead.'},
      },
      compositionRules:contract.rules??[],
      validation:'Use read preflight with the complete edit. Capability metadata does not prove observed appearance or exercised interaction.'};
  }
  if(node.kind==='element')return {kind:node.kind,available:true,tag:node.tag,
    presentation:{classes:{supported:true,operation:'modify',field:'classes',value:node.classes??[],mode:'replace',emptyClears:true,guidance:'Use canonical classes, not attributes.class. Arbitrary project DOM tokens are supported; generated ownership classes are preserved.'},style:{operation:'style',states:['base','hover','focus','active','disabled'],conditions:true,part:null}},
    attributes:{operation:'bindAttribute',guidance:'Read elements with this tag for registered attributes; use literal modify attributes or a typed binding.'},
    children:{supported:designerCatalogs.elements.elements.find(item=>item.tag===node.tag)?.leaf!==true,guidance:'Native leaf elements refuse children; discover elements with tag before insertion.'},
    validation:'Property values, references, types and interactions still require canonical preflight.'};
  return {kind:node.kind,available:true,presentation:{style:false,reason:'This source kind has no directly editable rendered box; style an owned element or component part.'},
    ...(node.kind==='text'?{text:{operation:'bindText',literalOperation:'modify'}}:{}),
    validation:'Inspect exact source before structural edits. Do not turn a containing element into the selected source identity.'};
}
