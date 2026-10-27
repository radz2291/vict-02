import { PROVIDER_LIMIT_SCHEMA,ZAI_LIMIT_CODES,ZAI_LIMIT_KINDS,type ProviderLimitEvidence } from '$lib/designer/provider-limit.js';
const MAX_WINDOW=7_776_000_000;
/** Own data properties only: do not run an error object's getters or methods. */
function own(value:unknown,key:string):unknown{if(!value||typeof value!=='object')return;try{const d=Object.getOwnPropertyDescriptor(value,key);return d&&'value'in d?d.value:undefined;}catch{return;}}
const text=(value:unknown,max:number)=>typeof value==='string'&&value.length<=max?value:undefined;
function business(value:unknown){const raw=own(value,'code');const code=typeof raw==='number'&&Number.isSafeInteger(raw)?String(raw):text(raw,4);return ZAI_LIMIT_CODES.includes(code as typeof ZAI_LIMIT_CODES[number])?code as typeof ZAI_LIMIT_CODES[number]:undefined;}
function header(value:unknown,name:string){if(!value||typeof value!=='object')return;try{for(const key of Object.getOwnPropertyNames(value).slice(0,64))if(key.toLowerCase()===name)return text(own(value,key),80);}catch{return;}}
function timing(headers:unknown,now:number):Pick<ProviderLimitEvidence,'retryAt'|'retryAfterSeconds'|'retrySource'>{
  const raw=header(headers,'retry-after')?.trim();if(!raw)return {};
  if(/^\d{1,8}$/.test(raw)){const seconds=Number(raw);if(seconds<=MAX_WINDOW/1000)return {retryAfterSeconds:seconds,retryAt:new Date(now+seconds*1000).toISOString(),retrySource:'retry-after-seconds'};return {};}
  if(!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(raw))return {};
  const at=Date.parse(raw);if(!Number.isFinite(at)||new Date(at).toUTCString()!==raw||at<now-86_400_000||at>now+MAX_WINDOW)return {};
  return {retryAt:new Date(at).toISOString(),retryAfterSeconds:Math.max(0,Math.ceil((at-now)/1000)),retrySource:'retry-after-date'};
}
function reset(message:unknown,now:number):string|undefined{
  const bounded=text(message,2048);if(!bounded)return;
  const match=/(?:will reset|resets?)\s+at\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))/i.exec(bounded);if(!match)return;
  const iso=match[1]!;const parts=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/i.exec(iso);if(!parts)return;
  const year=Number(parts[1]),month=Number(parts[2]),day=Number(parts[3]);if(month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||Number(parts[4])>23||Number(parts[5])>59||Number(parts[6])>59)return;
  const zone=/[+-](\d{2}):(\d{2})$/.exec(iso);if(zone&&(Number(zone[1])>14||Number(zone[2])>59||Number(zone[1])===14&&Number(zone[2])!==0))return;
  const at=Date.parse(iso);return Number.isFinite(at)&&at>=now-86_400_000&&at<=now+MAX_WINDOW?new Date(at).toISOString():undefined;
}
/** Only closed limit facts escape; raw error/body/message values never leave this function. */
export function classifyProviderLimit(error:unknown,provider:'zai'|undefined,now=Date.now()):ProviderLimitEvidence|undefined{
  const queue:unknown[]=[error];const seen=new Set<object>();let fallback:ProviderLimitEvidence|undefined;
  for(let visited=0;queue.length&&visited<8;visited++){
    const current=queue.shift();if(!current||typeof current!=='object'||seen.has(current))continue;seen.add(current);
    const status=own(current,'statusCode');const httpStatus=typeof status==='number'&&Number.isSafeInteger(status)&&status>=100&&status<=599?status:undefined;
    let detail=own(own(current,'data'),'error')??own(current,'data');
    const body=text(own(current,'responseBody'),16_384);if(body){try{const parsed:unknown=JSON.parse(body);detail=own(parsed,'error')??detail;}catch{/* Unknown body stays private. */}}
    const code=provider==='zai'&&(httpStatus===429||httpStatus===undefined)?business(detail)??business(current):undefined;
    if(code||httpStatus===429){const kind=code?ZAI_LIMIT_KINDS[code]:'unspecified-limit';const resetAt=provider==='zai'&&kind==='quota'?reset(own(detail,'message')??own(current,'message'),now):undefined;
      const evidence:ProviderLimitEvidence={schema:PROVIDER_LIMIT_SCHEMA,kind,observedAt:new Date(now).toISOString(),...(httpStatus===undefined?{}:{httpStatus}),...(code?{providerCode:code}:{}),...timing(own(current,'responseHeaders'),now),...(resetAt?{resetAt,resetSource:'zai-reset-message'}:{})};
      if(code)return evidence;fallback??=evidence;
    }
    for(const key of ['cause','lastError']){const nested=own(current,key);if(nested&&typeof nested==='object')queue.push(nested);}
    const errors=own(current,'errors'),length=own(errors,'length');if(Array.isArray(errors)&&typeof length==='number')for(let index=0;index<Math.min(3,length);index++){const entry=own(errors,String(index));if(entry&&typeof entry==='object')queue.push(entry);}
  }
  return fallback;
}
