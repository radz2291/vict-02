import type { UiDocument, UiExpression, UiNode, UiLocalStateDecl } from './document.js';
import type { UiDiagnostic } from './diagnostics.js';
import { authoringDigest, effectiveUiDescriptor, type UiAuthoringFragment, type UiAuthoringRegistry, type UiAuthoringRule } from './authoring.js';

/** Remap only structural identities and state references, never arbitrary displayed copy. */
export function materializeAuthoringFragment(fragment: UiAuthoringFragment, rootId: string): UiAuthoringFragment {
  const ids=new Map(fragment.nodes.map(node=>[node.id,node.id===fragment.root?rootId:node.id.startsWith(`${fragment.root}-`)?`${rootId}${node.id.slice(fragment.root.length)}`:`${rootId}-${node.id}`]));
  const states=new Map(Object.keys(fragment.localState??{}).map(key=>[key,`catalog_${rootId.replace(/[^a-zA-Z0-9_-]/g,'_')}_${key}`]));
  const remap=(value:unknown):unknown=>{
    if(Array.isArray(value))return value.map(remap);
    if(!value || typeof value!=='object')return value;
    const record=value as Record<string,unknown>,out:Record<string,unknown>={};
    for(const [key,child]of Object.entries(record)){
      if(key==='path' && record.type==='ref' && typeof child==='string' && child.startsWith('state.'))out[key]=`state.${states.get(child.slice(6))??child.slice(6)}`;
      else if(key==='key' && typeof child==='string' && states.has(child))out[key]=states.get(child);
      else out[key]=remap(child);
    }
    return out;
  };
  const nodes=fragment.nodes.map(source=>{
    const node=remap(source) as UiNode;
    const id=ids.get(node.id)!;
    if(node.kind==='element'||node.kind==='portal')return {...node,id,children:node.children.map(child=>ids.get(child)??child)};
    if(node.kind==='component')return {...node,id,props:{...node.props,...Object.fromEntries((fragment.identities??[]).filter(link=>link.nodeId===source.id&&link.property).map(link=>[link.property!,{type:'literal' as const,value:ids.get(link.sourceNodeId)??link.sourceNodeId}]))},...(node.slots?{slots:Object.fromEntries(Object.entries(node.slots).map(([name,fill])=>[name,{...fill,children:fill.children.map(child=>ids.get(child)??child)}]))}:{})};
    if(node.kind==='repeat')return {...node,id,templateRoot:ids.get(node.templateRoot)??node.templateRoot};
    if(node.kind==='slot')return {...node,id,...(node.fallback?{fallback:node.fallback.map(child=>ids.get(child)??child)}:{})};
    if(node.kind==='conditional')return {...node,id,branches:node.branches.map(branch=>({...branch,children:branch.children.map(child=>ids.get(child)??child)}))};
    return {...node,id};
  });
  const localState=Object.fromEntries(Object.entries(fragment.localState??{}).map(([key,value])=>{const link=fragment.identities?.find(link=>link.stateKey===key);return [states.get(key)!,{...value,key:states.get(key)!,initial:link?ids.get(link.sourceNodeId)??link.sourceNodeId:Array.isArray(value.initial)?value.initial.slice():value.initial}];}));
  return {root:rootId,nodes,localState};
}

type Component=Extract<UiNode,{kind:'component'}>;
type Context={node:Component;slot:string;path:string};
type Env=Readonly<Record<string,UiExpression>>;
type Fill={children:readonly string[];fills:Fills;env:Env};
type Fills=Readonly<Record<string,Fill>>;
type Occurrence={node:Component;path:string;contexts:readonly Context[];env:Env;uncertain:boolean};

/** Source-only semantic admission. Dynamic values are explicitly unresolved; renderer owners validate evaluated identities. */
export function authoringSemanticIssues(document:UiDocument,registry:UiAuthoringRegistry,input:{previous?:UiDocument;hostCapabilities?:readonly string[];legacy?:boolean}={}):readonly UiDiagnostic[]{
  const occurrences:Occurrence[]=[],issues:UiDiagnostic[]=[];
  const emit=(hostCode:string,message:string,occurrence:Occurrence,detail:Record<string,unknown>={},severity:UiDiagnostic['severity']='error')=>{
    const descriptor=effectiveUiDescriptor(occurrence.node,registry.descriptors);
    const legacyEligible=registry.contracts.some(contract=>contract.descriptor.id===descriptor?.id&&contract.descriptor.revision===descriptor?.revision&&contract.legacyCompatibility);
    const fingerprint=authoringDigest({hostCode,nodeId:occurrence.node.id,path:occurrence.path,...detail});
    issues.push({code:'UI_COMPONENT_BINDING_INCOMPATIBLE',hostCode,message,severity,documentId:document.id,nodeId:occurrence.node.id,path:occurrence.path,semanticFingerprint:fingerprint,legacyEligible,...detail});
  };
  function visit(id:string,contexts:readonly Context[],fills:Fills,env:Env,path:string,ancestors:ReadonlySet<string>,uncertain:boolean){
    if(ancestors.has(id))return;const node=document.nodes[id];if(!node)return;
    const next=new Set([...ancestors,id]);
    const children=(ids:readonly string[],nextContexts=contexts,nextFills=fills,nextEnv=env,nextUncertain=uncertain)=>ids.forEach(child=>visit(child,nextContexts,nextFills,nextEnv,`${path}/${child}`,next,nextUncertain));
    if(node.kind==='component'){
      occurrences.push({node,path,contexts,env,uncertain});
      const definition=document.componentDefinitions[node.definitionId];
      if(definition){
        const localFills=Object.fromEntries(Object.entries(node.slots??{}).map(([name,fill])=>[name,{children:fill.children,fills,env}]));
        const props:Record<string,UiExpression>=Object.fromEntries(definition.props.map(prop=>[prop.name,node.props?.[prop.name]??{type:'literal' as const,value:typeof prop.default==='string'||typeof prop.default==='number'||typeof prop.default==='boolean'?prop.default:null}]));
        // Resolve outer prop references at the substitution boundary.
        const resolved=Object.fromEntries(Object.entries(props).map(([name,value])=>[name,value.type==='ref'&&value.path.startsWith('prop.')?env[value.path.slice(5)]??value:value]));
        children([definition.root],contexts,localFills,resolved as Env);
      }else for(const [slot,fill]of Object.entries(node.slots??{}))children(fill.children,[...contexts,{node,slot,path}]);
    }else if(node.kind==='element'||node.kind==='portal')children(node.children);
    else if(node.kind==='slot'){const fill=fills[node.name];if(fill?.children.length)children(fill.children,contexts,fill.fills,fill.env);else children(node.fallback??[]);}
    else if(node.kind==='repeat')children([node.templateRoot],contexts,fills,env,true);
    else if(node.kind==='conditional')node.branches.forEach(branch=>children(branch.children,contexts,fills,env,true));
  }
  visit(document.root,[],{},{},document.root,new Set(),false);
  const value=(occurrence:Occurrence,property:string):string|number|boolean|undefined=>{
    const descriptor=effectiveUiDescriptor(occurrence.node,registry.descriptors);
    const initial=occurrence.node.props?.[property];
    if(!initial){const fallback=descriptor?.props.find(prop=>prop.name===property)?.default;return typeof fallback==='string'||typeof fallback==='number'||typeof fallback==='boolean'?fallback:undefined;}
    let expression:UiExpression=initial;
    const seen=new Set<string>();
    while(expression.type==='ref'&&expression.path.startsWith('prop.')&&!seen.has(expression.path)){seen.add(expression.path);const resolved:UiExpression|undefined=occurrence.env[expression.path.slice(5)];if(!resolved)return undefined;expression=resolved;}
    return expression.type==='literal'&&expression.value!==null?expression.value:undefined;
  };
  const unique=new Map<string,{occurrence:Occurrence;value:unknown}[]>();
  for(const occurrence of occurrences){
    const descriptor=effectiveUiDescriptor(occurrence.node,registry.descriptors);
    const contract=descriptor&&registry.contracts.find(item=>item.descriptor.id===descriptor.id&&item.descriptor.revision===descriptor.revision);
    if(!contract)continue;
    for(const slot of contract.capabilities.required??[])if(!(occurrence.node.slots?.[slot]?.children.length))emit('UI_AUTHORING_REQUIRED_SLOT',`Required slot '${slot}' is empty.`,occurrence,{slot});
    for(const rule of contract.rules??[]){
      if(rule.kind==='ancestorSlot'){
        const provider=[...occurrence.contexts].reverse().find(context=>rule.placements.some(placement=>placement.definitionId===context.node.definitionId));
        if(!provider||!rule.placements.some(placement=>placement.definitionId===provider.node.definitionId&&placement.slotName===provider.slot&&(!placement.revision||effectiveUiDescriptor(provider.node,registry.descriptors)?.revision===placement.revision)))
          emit('UI_AUTHORING_ANCESTOR_SLOT',`${contract.label} requires a compatible provider and slot.`,occurrence,{placements:rule.placements,context:occurrence.contexts.map(context=>[context.node.id,context.node.definitionId,context.slot])});
      }else if(rule.kind==='hostRequirement'){
        if(!input.hostCapabilities?.includes(rule.capability))emit('UI_AUTHORING_HOST_REQUIRED',rule.reason,occurrence,{capability:rule.capability});
      }else if(rule.kind==='uniqueValue'){
        const provider=[...occurrence.contexts].reverse().find(context=>rule.providerIds.includes(context.node.definitionId)&&(!rule.slots||rule.slots.includes(context.slot)));
        const actual=value(occurrence,rule.property);
        if(!provider)continue;
        if(actual===undefined||occurrence.uncertain){emit('UI_AUTHORING_UNRESOLVED',`Cannot statically prove '${rule.property}' uniqueness in a dynamic/repeated composition.`,occurrence,{property:rule.property,provider:provider.path},'warning');continue;}
        if(rule.nonempty&&actual==='')emit('UI_AUTHORING_IDENTITY_EMPTY',`'${rule.property}' needs a nonempty identity.`,occurrence,{property:rule.property,actual});
        const key=JSON.stringify([provider.path,rule.namespace??contract.descriptor.id,rule.property]);
        const values=unique.get(key)??[];values.push({occurrence,value:actual});unique.set(key,values);
      }else if(rule.kind==='requiredParts'){
        const parts=occurrences.filter(child=>child.contexts.some(context=>context.path===occurrence.path&&context.slot===rule.slot)&&rule.definitionIds.includes(child.node.definitionId));
        if(parts.length<(rule.minimum??1))emit('UI_AUTHORING_REQUIRED_PART',`Slot '${rule.slot}' needs a supported part.`,occurrence,{slot:rule.slot,expected:rule.definitionIds,minimum:rule.minimum??1,actual:parts.length});
        else if(parts.some(part=>part.uncertain))emit('UI_AUTHORING_UNRESOLVED',`Required parts in '${rule.slot}' are conditional or repeated.`,occurrence,{slot:rule.slot},'warning');
      }else if(rule.kind==='pairedValues'){
        const collect=(side:typeof rule.left)=>occurrences.filter(child=>side.definitionIds.includes(child.node.definitionId)&&child.contexts.some(context=>context.path===occurrence.path&&context.slot===side.slot)).map(child=>({child,value:value(child,side.property)}));
        const left=collect(rule.left),right=collect(rule.right);
        if([...left,...right].some(part=>part.value===undefined||part.child.uncertain))emit('UI_AUTHORING_UNRESOLVED','Paired identities contain dynamic/repeated values.',occurrence,{left:rule.left,right:rule.right},'warning');
        else{const l=left.map(item=>item.value),r=right.map(item=>item.value);if(l.some(item=>!r.includes(item))||r.some(item=>!l.includes(item)))emit('UI_AUTHORING_PAIRED_VALUES','Paired part identities must match.',occurrence,{leftValues:l,rightValues:r,left:rule.left,right:rule.right});}
      }else if(rule.kind==='controlledPair'){
        const prop=occurrence.node.props?.[rule.prop],binding=occurrence.node.outputs?.[rule.output];
        if(prop?.type==='ref'&&prop.path.startsWith('state.')&&binding&&'setState'in binding&&binding.setState.key!==prop.path.slice(6))emit('UI_AUTHORING_CONTROLLED_PAIR',`'${rule.prop}' and '${rule.output}' address different state keys.`,occurrence,{prop:rule.prop,output:rule.output,expected:prop.path.slice(6),actual:binding.setState.key});
        else if(!binding)emit('UI_AUTHORING_CONTROLLED_UNBOUND',`'${rule.prop}' is not paired with '${rule.output}'; this may intentionally be read-only.`,occurrence,{prop:rule.prop,output:rule.output},rule.required?'error':'warning');
      }else if(rule.kind==='labelOwnership'){
        if(rule.mode==='component' && value(occurrence,rule.property)==='')emit('UI_AUTHORING_LABEL','Supply the component-owned accessible label rather than a duplicate external label.',occurrence,{property:rule.property},'warning');
      }
    }
  }
  for(const values of unique.values())for(const item of values)if(values.filter(peer=>peer.value===item.value).length>1)
    emit('UI_AUTHORING_DUPLICATE_VALUE','Sibling component identities must be unique in their provider scope.',item.occurrence,{actual:item.value,peers:values.filter(peer=>peer.value===item.value).map(peer=>peer.occurrence.path).sort()});
  const previous=input.previous?new Set(authoringSemanticIssues(input.previous,registry,{hostCapabilities:input.hostCapabilities}).filter(item=>item.severity==='error').map(item=>item.semanticFingerprint)):undefined;
  const grandfatherable=new Set(['UI_AUTHORING_DUPLICATE_VALUE','UI_AUTHORING_IDENTITY_EMPTY','UI_AUTHORING_PAIRED_VALUES','UI_AUTHORING_CONTROLLED_PAIR','UI_AUTHORING_REQUIRED_PART']);
  return issues.map(item=>item.severity==='error'&&item.legacyEligible===true&&grandfatherable.has(String(item.hostCode))&&(input.legacy||previous?.has(item.semanticFingerprint))?{...item,severity:'warning',legacyCompatibility:true,message:`Retained legacy source: ${item.message}`} as UiDiagnostic:item);
}
