/** Closed display vocabulary. No upstream error text, headers, URL or body belongs here. */
export const PROVIDER_LIMIT_SCHEMA='vict.studio-provider-limit@1' as const;
export const ZAI_LIMIT_CODES=['1113','1302','1305','1308','1309','1310','1311','1313','1314','1315','1316','1317','1318','1319','1320','1321'] as const;
export type ProviderLimitKind='rate-limit'|'quota'|'subscription'|'overload'|'unspecified-limit';
export const ZAI_LIMIT_KINDS:Readonly<Record<typeof ZAI_LIMIT_CODES[number],ProviderLimitKind>>={1113:'subscription',1302:'rate-limit',1305:'overload',1308:'quota',1309:'subscription',1310:'quota',1311:'subscription',1313:'subscription',1314:'subscription',1315:'subscription',1316:'quota',1317:'quota',1318:'quota',1319:'quota',1320:'quota',1321:'quota'};
export interface ProviderLimitEvidence {
  schema:typeof PROVIDER_LIMIT_SCHEMA;kind:ProviderLimitKind;observedAt:string;httpStatus?:number;providerCode?:typeof ZAI_LIMIT_CODES[number];
  retryAfterSeconds?:number;retryAt?:string;retrySource?:'retry-after-seconds'|'retry-after-date';resetAt?:string;resetSource?:'zai-reset-message';
}
const fields=new Set(['schema','kind','observedAt','httpStatus','providerCode','retryAfterSeconds','retryAt','retrySource','resetAt','resetSource']);
const iso=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value));
export function isProviderLimitEvidence(value:unknown):value is ProviderLimitEvidence {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  let descriptors:PropertyDescriptorMap;try{descriptors=Object.getOwnPropertyDescriptors(value);}catch{return false;}
  if(Object.entries(descriptors).some(([key,descriptor])=>!fields.has(key)||!('value'in descriptor)))return false;
  const v=Object.fromEntries(Object.entries(descriptors).map(([key,descriptor])=>[key,descriptor.value])) as unknown as ProviderLimitEvidence;
  return v.schema===PROVIDER_LIMIT_SCHEMA&&['rate-limit','quota','subscription','overload','unspecified-limit'].includes(v.kind)&&iso(v.observedAt)&&
    (v.httpStatus===undefined||Number.isSafeInteger(v.httpStatus)&&v.httpStatus>=100&&v.httpStatus<=599)&&
    (v.providerCode===undefined||ZAI_LIMIT_CODES.includes(v.providerCode)&&ZAI_LIMIT_KINDS[v.providerCode]===v.kind)&&
    (v.retryAfterSeconds===undefined||Number.isSafeInteger(v.retryAfterSeconds)&&v.retryAfterSeconds>=0&&v.retryAfterSeconds<=7_776_000)&&
    (v.retryAt===undefined||iso(v.retryAt))&&(v.resetAt===undefined||iso(v.resetAt))&&
    (v.retrySource===undefined||['retry-after-seconds','retry-after-date'].includes(v.retrySource))&&(v.resetSource===undefined||v.resetSource==='zai-reset-message')&&
    (v.retrySource===undefined?v.retryAt===undefined&&v.retryAfterSeconds===undefined:v.retryAt!==undefined&&v.retryAfterSeconds!==undefined)&&
    (v.resetSource===undefined?v.resetAt===undefined:v.resetAt!==undefined);
}
export const providerLimitCode=(kind:ProviderLimitKind)=>({ 'rate-limit':'STUDIO_AGENT_PROVIDER_RATE_LIMIT',quota:'STUDIO_AGENT_PROVIDER_QUOTA',subscription:'STUDIO_AGENT_PROVIDER_SUBSCRIPTION',overload:'STUDIO_AGENT_PROVIDER_OVERLOAD','unspecified-limit':'STUDIO_AGENT_PROVIDER_LIMIT' })[kind];
export function providerLimitMessage(value:ProviderLimitEvidence):string {
  const summary={ 'rate-limit':'The provider reported a request rate limit.',quota:'The provider reported a usage quota limit.',subscription:'The provider reported a subscription or resource access limit.',overload:'The provider reported temporary overload.','unspecified-limit':'The provider reported a limit; its type is unspecified.' }[value.kind];
  const retry=value.retryAt?(value.retrySource==='retry-after-seconds'?` Provider supplied Retry-After: ${value.retryAfterSeconds} seconds (estimated ${value.retryAt} from receipt).`:` Provider reported retry time: ${value.retryAt}.`):'';
  return `${summary}${retry}${value.resetAt?` Provider reported reset: ${value.resetAt}.`:''}${!value.retryAt&&!value.resetAt?' No unambiguous retry or reset time was supplied.':''} No automatic retry or provider switch was made.`;
}
