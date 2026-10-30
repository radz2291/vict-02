import {captureControlRecord,type CapturedControlRecord} from './control-envelope.js';
/** Closed, non-authoritative repair vocabulary. No received values/messages cross it. */
export const INPUT_VALIDATION_RULES=['invalid','invalid_type','missing_field','unknown_field','invalid_enum','invalid_union','too_small','too_big','invalid_format','invalid_value'] as const;
export type InputValidationRule=typeof INPUT_VALIDATION_RULES[number];
export interface SafeInputValidationIssue {readonly path:readonly (string|number)[];readonly rule:InputValidationRule;}
export interface InputValidationFeedbackPolicy {
  readonly fields:readonly string[];
  readonly expectedHints:readonly string[];
  /** Receives only closed sanitized issue projections, never input or parser objects. */
  readonly format:(issues:readonly SafeInputValidationIssue[])=>unknown;
}
export type InputValidationFeedbackResolver=(capabilityId:string,revision:string)=>InputValidationFeedbackPolicy|undefined;
type RecordCapture=Extract<CapturedControlRecord,{kind:'captured'}>;
function data(record:RecordCapture,key:string):unknown{const field=record.fields.get(key);return field?.kind==='data'&&field.enumerable?field.value:undefined;}
function closed(value:unknown,keys:readonly string[]):RecordCapture|undefined{
 const record=captureControlRecord(value);if(record.kind!=='captured'||record.prototype==='exotic'||record.hasSymbolKeys||[...record.fields].some(([key,field])=>!keys.includes(key)||field.kind!=='data'||!field.enumerable))return;return record;
}
function array(value:unknown,maximum:number):unknown[]|undefined{
 try{if(!Array.isArray(value))return;const length=Object.getOwnPropertyDescriptor(value,'length');if(!length||!('value'in length)||!Number.isInteger(length.value)||length.value<0||length.value>maximum)return;const result:unknown[]=[];for(let i=0;i<length.value;i++){const field=Object.getOwnPropertyDescriptor(value,String(i));if(!field||!('value'in field))return;result.push(field.value);}return result;}catch{return;}
}
function path(value:unknown,fields:ReadonlySet<string>):readonly(string|number)[]|undefined{
 const pieces=typeof value==='string'?(value==='(root)'?[]:value.replace(/\[(\d+)\]/g,'.$1').split('.')):array(value,8);
 if(!pieces||pieces.length>8)return;const result:(string|number)[]=[];
 for(const item of pieces){if(typeof item==='number'&&Number.isInteger(item)&&item>=0&&item<=100000)result.push(item);else if(typeof item==='string'&&/^\d+$/.test(item)&&Number(item)<=100000)result.push(Number(item));else if(typeof item==='string'&&fields.has(item))result.push(item);else return;}return result;
}
/** Capture once during tool construction. Omitted policy preserves legacy rejection. */
export function captureInputValidationFeedbackPolicy(value:unknown):InputValidationFeedbackPolicy|undefined{
 const record=closed(value,['fields','expectedHints','format']);if(!record)return;
 const fields=array(data(record,'fields'),200),hints=array(data(record,'expectedHints'),50),format=data(record,'format');
 if(!fields||!hints||typeof format!=='function'||fields.some(name=>typeof name!=='string'||!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(name)||name.length>64)||hints.some(hint=>typeof hint!=='string'||!hint||hint.length>180))return;
 return Object.freeze({fields:Object.freeze(fields as string[]),expectedHints:Object.freeze(hints as string[]),format:format as InputValidationFeedbackPolicy['format']});
}
/** Never reads accessors, raw messages, expected/received descriptions or arguments. */
export function inputValidationFeedback(issues:unknown,policy:InputValidationFeedbackPolicy|undefined):string|undefined{
 if(!policy)return;
 try{
  const fields=new Set(policy.fields),safe:SafeInputValidationIssue[]=[];
  // Excessive parser arrays fail closed; only the first five can be presented.
  const source=array(issues,100);if(!source)return;
  for(const raw of source.slice(0,5)){
   const record=captureControlRecord(raw);if(record.kind!=='captured'||record.prototype==='exotic'||record.hasSymbolKeys)continue;
   const issuePath=path(data(record,'path'),fields),code=data(record,'code');if(!issuePath)continue;
   const rule=INPUT_VALIDATION_RULES.includes(code as InputValidationRule)?code as InputValidationRule:'invalid';
   safe.push(Object.freeze({path:Object.freeze([...issuePath]),rule}));
  }
  const formatted=closed(policy.format(Object.freeze(safe)),['code','issues']);if(!formatted||data(formatted,'code')!=='VICT_TOOL_INPUT_INVALID')return;
  const output=array(data(formatted,'issues'),5);if(!output||!output.length)return;
  const final=[];
  for(const raw of output){const record=closed(raw,['path','rule','expected']);if(!record)return;const issuePath=path(data(record,'path'),fields),rule=data(record,'rule'),expected=data(record,'expected');if(!issuePath||!INPUT_VALIDATION_RULES.includes(rule as InputValidationRule)||(expected!==undefined&&!policy.expectedHints.includes(expected as string)))return;final.push({path:issuePath,rule,...(expected===undefined?{}:{expected})});}
  return JSON.stringify({code:'VICT_TOOL_INPUT_INVALID',issues:final});
 }catch{return;}
}
