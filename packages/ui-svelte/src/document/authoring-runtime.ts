/** Evaluated identity checks are presentation admission, never a second authoring model. */
import type {UiAuthoringRegistration,UiAuthoringRule,UiRenderInstruction,UiRenderPlan} from '@victframework/ui';
import type {UiSvelteComponentImplementation,UiSvelteExtensionImplementation,UiExtensionRenderDiagnostic} from './extensions.js';
import {asRecord,conditionsOf,evaluateComponentPropValues,evaluateCondition,resolveValue,type DocumentScope,type DocumentSlotFrame} from './logic.js';

export function withAuthoringRules<T extends UiSvelteComponentImplementation|UiSvelteExtensionImplementation>(implementations:readonly T[],registrations:readonly UiAuthoringRegistration[]):readonly (T&{readonly authoringRules:readonly UiAuthoringRule[];readonly authoringDependencies:readonly {readonly id:string;readonly revision:string}[]})[]{
  return implementations.map(implementation=>{const registration=registrations.find(item=>item.descriptor.id===implementation.extensionId&&item.descriptor.revision===implementation.revision);return {...implementation,authoringRules:registration?.rules??[],authoringDependencies:registration?.dependencies??[]};});
}
type Entry={instruction:Extract<UiRenderInstruction,{kind:'extension'}>;values:Readonly<Record<string,unknown>>;slot:string;path:string;providers:readonly string[]};
type Fills=Readonly<Record<string,{children:readonly UiRenderInstruction[];scope:DocumentScope;fills:Fills}>>;
/** Refuse ambiguous evaluated provider composition. The renderer evaluates the same existing finite expressions/scopes. */
export function runtimeAuthoringIssues(owner:Extract<UiRenderInstruction,{kind:'extension'}>,scope:DocumentScope,plan:UiRenderPlan,implementations:readonly (UiSvelteComponentImplementation|UiSvelteExtensionImplementation)[],slotFrame?:DocumentSlotFrame):readonly UiExtensionRenderDiagnostic[]{
  const rulesFor=(id:string,revision:string)=>implementations.find(item=>item.extensionId===id&&item.revision===revision)?.authoringRules??[];
  const ownerRules=rulesFor(owner.extensionId,owner.revision);
  const ownerDependencies=implementations.find(item=>item.extensionId===owner.extensionId&&item.revision===owner.revision)?.authoringDependencies??[];
  const childMatches=(entry:Entry,ids:readonly string[])=>ids.includes(entry.instruction.extensionId)&&entry.instruction.revision===(entry.instruction.extensionId===owner.extensionId?owner.revision:ownerDependencies.find(dependency=>dependency.id===entry.instruction.extensionId)?.revision);
  const relevant=implementations.some(item=>item.authoringRules?.some(rule=>rule.kind==='uniqueValue'&&rule.providerIds.includes(owner.extensionId)))||ownerRules.some(rule=>rule.kind==='pairedValues'||rule.kind==='requiredParts');
  if(!relevant)return [];
  const entries:Entry[]=[],problems:UiExtensionRenderDiagnostic[]=[],conditions=conditionsOf(plan);
  const fail=(message:string,detail:Record<string,unknown>)=>problems.push({code:'UI_AUTHORING_RUNTIME_IDENTITY',message,detail:{nodeId:owner.nodeId,occurrenceKey:owner.occurrenceKey,...detail}});
  type Work={instruction:UiRenderInstruction;values:DocumentScope;slot:string;path:string;providers:readonly string[];fills:Fills;exit?:boolean};
  const active=new Set<UiRenderInstruction>(),stack:Work[]=[];
  const frames:DocumentSlotFrame[]=[];const frameSeen=new Set<DocumentSlotFrame>();
  for(let frame=slotFrame;frame;frame=frame.parent){
    if(frameSeen.has(frame)){fail('Scoped slot frame cycle prevents complete identity validation.',{reason:'cycle'});return problems;}
    frameSeen.add(frame);frames.push(frame);
  }
  let initialFills:Fills={};
  for(const frame of frames.reverse()){
    const parent=initialFills;
    initialFills=Object.fromEntries(Object.entries(frame.fills).map(([name,children])=>[name,{children,scope:frame.scope,fills:parent}]));
  }
  for(const [slot,items]of Object.entries(owner.slots??{}))items.forEach((instruction,index)=>stack.push({instruction,values:scope,slot,path:`${slot}/${index}:${instruction.nodeId}`,providers:[owner.extensionId],fills:initialFills}));
  while(stack.length){
    const work=stack.pop()!,{instruction,values,slot,path,providers,fills}=work;
    if(work.exit){active.delete(instruction);continue;}
    if(active.has(instruction)){fail('A render instruction cycle prevents complete identity validation.',{reason:'cycle',childNodeId:instruction.nodeId});continue;}
    active.add(instruction);stack.push({...work,exit:true});
    const children=(items:readonly UiRenderInstruction[],nextValues=values,nextProviders=providers,nextFills=fills)=>items.forEach((item,index)=>stack.push({instruction:item,values:nextValues,slot,path:`${path}/${index}:${item.nodeId}`,providers:nextProviders,fills:nextFills}));
    if(instruction.kind==='extension'){
      entries.push({instruction,values:evaluateComponentPropValues(instruction,values).values,slot,path,providers});
      for(const [childSlot,items]of Object.entries(instruction.slots??{}))items.forEach((item,index)=>stack.push({instruction:item,values,slot,path:`${path}/${childSlot}/${index}:${item.nodeId}`,providers:[...providers,instruction.extensionId],fills}));
    }else if(instruction.kind==='element'||instruction.kind==='unsupported')children(instruction.children);
    else if(instruction.kind==='component'){
      const localFills=Object.fromEntries(Object.entries(instruction.slots).map(([name,items])=>[name,{children:items,scope:values,fills}]));
      stack.push({instruction:instruction.body,values:{...values,props:evaluateComponentPropValues(instruction,values).values},slot,path:`${path}/definition:${instruction.definitionId}`,providers,fills:localFills});
    }else if(instruction.kind==='slot'){
      const fill=fills[instruction.name];if(fill?.children.length)children(fill.children,fill.scope,providers,fill.fills);else children(instruction.fallback);
    }else if(instruction.kind==='repeat'){
      const rows=resolveValue({type:'expression',expression:instruction.collection},values);
      if(!Array.isArray(rows)){fail('Identity-sensitive repeat data is unavailable.',{childNodeId:instruction.nodeId});continue;}
      rows.forEach((row,index)=>{const record=asRecord(row);stack.push({instruction:instruction.template,values:{...values,repeatItem:{name:instruction.itemName,value:record},repeatItems:{...values.repeatItems,[instruction.itemName]:record}},slot,path:`${path}/record:${index}`,providers,fills});});
    }else if(instruction.kind==='conditional'){
      const branch=instruction.branches.find(branch=>branch.when===undefined||evaluateCondition(branch.when,conditions,values));if(branch)children(branch.children);
    }
  }
  const groups=new Map<string,{value:unknown;entry:Entry}[]>();
  for(const entry of entries)for(const rule of rulesFor(entry.instruction.extensionId,entry.instruction.revision))if(rule.kind==='uniqueValue'){
    const nearest=[...entry.providers].reverse().find(id=>rule.providerIds.includes(id));
    // Each nested provider validates its own occurrence separately.
    if(nearest!==owner.extensionId || entry.providers.filter(id=>id===owner.extensionId).length!==1 || (rule.slots&&!rule.slots.includes(entry.slot)))continue;
    const value=entry.values[rule.property];
    if(!['string','number','boolean'].includes(typeof value)||(rule.nonempty&&value==='')){fail(`A rendered '${rule.property}' identity is unavailable or empty.`,{childNodeId:entry.instruction.nodeId,path:entry.path,property:rule.property});continue;}
    const key=JSON.stringify([rule.namespace??entry.instruction.extensionId,rule.property]);const group=groups.get(key)??[];group.push({value,entry});groups.set(key,group);
  }
  for(const group of groups.values())for(const item of group)if(group.filter(other=>other.value===item.value).length>1){fail('Rendered sibling component identities are ambiguous.',{childNodeId:item.entry.instruction.nodeId,path:item.entry.path});break;}
  for(const rule of ownerRules)if(rule.kind==='pairedValues'){
    const collect=(side:typeof rule.left)=>entries.filter(entry=>childMatches(entry,side.definitionIds)&&entry.slot===side.slot&&entry.providers.filter(id=>id===owner.extensionId).length===1).map(entry=>entry.values[side.property]);
    const left=collect(rule.left),right=collect(rule.right);
    if([...left,...right].some(value=>value===undefined)||left.some(value=>!right.includes(value))||right.some(value=>!left.includes(value)))fail('Rendered paired part identities do not match.',{leftSlot:rule.left.slot,rightSlot:rule.right.slot});
  }else if(rule.kind==='requiredParts'){
    const count=entries.filter(entry=>entry.slot===rule.slot&&childMatches(entry,rule.definitionIds)&&entry.providers.filter(id=>id===owner.extensionId).length===1).length;
    if(count<(rule.minimum??1))fail('A required rendered composition part is missing.',{slot:rule.slot,expected:rule.definitionIds,actual:count});
  }
  return problems.slice(0,8);
}
