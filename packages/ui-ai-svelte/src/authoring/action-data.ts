/** Supplied option metadata only. Selecting it never configures a provider. */
import type { ModelOption } from '../patterns/types.js';
export type ModelSelectorData = {version:1;models:ModelOption[];efforts?:ModelOption[]};
function record(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
function options(value:unknown,max:number):value is ModelOption[]{
  if(!Array.isArray(value)||value.length>max)return false;
  const ids=new Set<string>();
  for(const item of value){
    if(!record(item)||Object.keys(item).some(key=>!['id','label','group'].includes(key)))return false;
    if(typeof item.id!=='string'||!item.id.length||item.id.length>200||ids.has(item.id))return false;
    if(typeof item.label!=='string'||!item.label.length||item.label.length>300)return false;
    if(item.group!==undefined&&(typeof item.group!=='string'||item.group.length>200))return false;
    ids.add(item.id);
  }
  return true;
}
export const modelSelectorExample = JSON.stringify({ version: 1, models: [{ id:'supplied-model', label:'Supplied model' }], efforts: [] });
export function parseModelSelectorData(value: unknown): {ok:true;data:ModelSelectorData}|{ok:false;error:string} {
  if (typeof value !== 'string' || value.length > 65536) return {ok:false,error:'Model options must be a JSON string of at most 65,536 characters.'};
  let raw:unknown;
  try {raw=JSON.parse(value);} catch {return {ok:false,error:'Model options contain invalid JSON.'};}
  return record(raw)&&Object.keys(raw).every(key=>['version','models','efforts'].includes(key))&&raw.version===1&&options(raw.models,100)&&(raw.efforts===undefined||options(raw.efforts,30))
    ? {ok:true,data:raw as ModelSelectorData}
    : {ok:false,error:'Model options require version 1, bounded models/efforts with unique id and label; unknown fields are rejected.'};
}
export function actionText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, 16000) : fallback;
}
