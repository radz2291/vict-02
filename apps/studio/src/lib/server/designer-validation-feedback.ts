import {formatInputValidationFeedback} from '@victframework/mastra';
import type {InputValidationFeedbackPolicy,InputValidationFeedbackResolver,InputValidationRule,SafeInputValidationIssue} from '@victframework/mastra';
import {agentReadPresentation} from '../designer/agent-reads.js';
const fields='section nodeId nodeIds edit expectedBodyIdentities knownBodyIdentities offset limit family category query recipe components id revision knownDigests includeExamples registry key stateKey requested focus part expectedRevision reason operations op parentId slotName slot index kind tag componentId text expression attributes props styles classes name property value type initial schema outputs scope conditions state controlled children conditionId wrapperId sourceId declarations newParentId headingLevel output binding setState invokeAction actionId input emit payload description fields changes expectedGraphRevision graphRevision source target sourcePort targetPort nodeType definition position x y allowCycles connections selection'.split(' ');
const READ='section: overview|nodes|source|sources|capabilities|preflight|icons|media|palette|component|state|registry|actions|coverage|families|catalog|contracts|elements.';
const READ_FIELDS='Use only fields declared for the chosen section; omit ignored fields. Read the current tool input schema.';
const EDIT='Provide expectedRevision, reason and operations; use exact op names and the fields declared for that op.';
const OBSERVE='Provide focus; part requires nodeId. Observation checks visible appearance, not interactions.';
const TYPE='Use the field type declared in this tool input schema.';
const OP='Choose an exact op from the edit contract; each operation has a closed field set.';
const SCOPE='Use scope schema vict.ui-slot-scope@1 and declared props, state, conditions and outputs.';
const INITIAL='initial must match its declared state type.';
const JSON_TYPES={array:'Use a JSON array, not quoted JSON text; omit optional fields rather than sending null.',object:'Use a JSON object, not quoted JSON text; omit optional fields rather than sending null.',boolean:'Use a JSON boolean true or false, without quotes; omit optional fields rather than sending null.',integer:'Use a JSON integer number, without quotes; omit optional fields rather than sending null.',number:'Use a JSON number, without quotes; omit optional fields rather than sending null.',string:'Use a JSON string; omit optional fields rather than sending null.'} as const;
const HINTS=[READ,READ_FIELDS,EDIT,OBSERVE,TYPE,OP,SCOPE,INITIAL,...Object.values(JSON_TYPES)];
/** Only trusted host presentation is inspected. Parser values/messages/expected types
 * never supply these hints. Resolve local references with a bounded traversal. */
function readTypeHint(path:readonly (string|number)[]):string|undefined{
 const root=agentReadPresentation as unknown as Record<string,unknown>;
 const object=(value:unknown):Record<string,unknown>|undefined=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
 const resolve=(value:unknown)=>{let current=object(value);for(let depth=0;current&&typeof current.$ref==='string'&&depth<16;depth++){
  if(!current.$ref.startsWith('#/'))return;let target:unknown=root;
  for(const part of current.$ref.slice(2).split('/')){const record=object(target),key=part.replace(/~1/g,'/').replace(/~0/g,'~');if(!record||!Object.hasOwn(record,key))return;target=record[key];}
  current=object(target);
 }return current&&typeof current.$ref!=='string'?current:undefined;};
 let current:Record<string,unknown>|undefined=root;
 for(const part of path){current=resolve(current);if(!current)return;
  if(typeof part==='number')current=resolve(current.items);
  else {const properties=object(current.properties);current=properties&&Object.hasOwn(properties,part)?resolve(properties[part]):undefined;}
 }
 current=resolve(current);const type=current?.type;
 return typeof type==='string'&&Object.hasOwn(JSON_TYPES,type)?JSON_TYPES[type as keyof typeof JSON_TYPES]:undefined;
}
const allowedRules=new Set(['invalid','invalid_type','missing_field','unknown_field','invalid_enum','invalid_union','too_small','too_big','invalid_format','invalid_value']);
/** Neutral parse diagnostics contain no received values or schema-author messages. */
export function studioContractValidationIssues(issues:readonly {readonly code:string;readonly path:readonly PropertyKey[]}[]){
 return issues.slice(0,5).map(issue=>({code:issue.code==='unrecognized_keys'?'unknown_field':allowedRules.has(issue.code)?issue.code:'invalid',path:issue.path.filter((part):part is string|number=>typeof part==='string'||typeof part==='number').join('.'),message:'Input does not match its declared contract.'}));
}
function policy(kind:'read'|'edit'|'observe'):InputValidationFeedbackPolicy{
 const fallback=kind==='read'?{path:['section'],rule:'invalid_union' as InputValidationRule,expected:READ}:kind==='edit'?{path:['operations'],rule:'invalid_union' as InputValidationRule,expected:EDIT}:{path:['focus'],rule:'invalid_type' as InputValidationRule,expected:OBSERVE};
 return {fields,expectedHints:HINTS,format:(issues:readonly SafeInputValidationIssue[])=>({code:'VICT_TOOL_INPUT_INVALID',issues:issues.length?issues.map(issue=>{
  if(!issue.path.length)return fallback;
  const last=issue.path.at(-1),expected=kind==='read'&&(last==='section'||issue.rule==='invalid_union')?READ:kind==='read'&&issue.rule==='invalid'?READ_FIELDS:last==='scope'?SCOPE:last==='initial'?INITIAL:issue.rule==='invalid_union'?(kind==='read'?READ:OP):TYPE;
  return {...issue,expected:kind==='read'&&issue.rule==='invalid_type'?readTypeHint(issue.path)??expected:expected};
 }):[fallback]})};
}
const policies={'studio.screen.read':policy('read'),'studio.screen.edit':policy('edit'),'studio.screen.observe':policy('observe')} as const;
/** Static host opt-in; resolver never receives arguments, parser messages or values. */
export function createStudioInputValidationFeedback(capabilities:readonly {readonly id:string;readonly revision:string}[]):InputValidationFeedbackResolver{
 const pins=new Map(capabilities.map(capability=>[capability.id,capability.revision]));
 return (id,revision)=>pins.get(id)===revision?policies[id as keyof typeof policies]:undefined;
}

/** Public parser-evaluation receipt uses the same non-echoing closed details. */
export function studioValidationRejection(id:string,issues:Parameters<typeof studioContractValidationIssues>[0]){
 const value=formatInputValidationFeedback(studioContractValidationIssues(issues),policies[id as keyof typeof policies]);
 return value?JSON.parse(value) as {code:'VICT_TOOL_INPUT_INVALID';issues:readonly {path:readonly(string|number)[];rule:InputValidationRule;expected?:string}[]}:{code:'VICT_TOOL_INPUT_INVALID' as const,issues:[]};
}
