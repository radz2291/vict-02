import { describe,it,expect } from 'vitest';
import { classifyProviderLimit } from '../src/lib/server/provider-limit.js';
import { boundedProviderModel } from '../src/lib/server/designer-model.js';
import { isProviderLimitEvidence,providerLimitMessage,ZAI_LIMIT_KINDS,type ProviderLimitEvidence } from '../src/lib/designer/provider-limit.js';
const now=Date.parse('2026-10-27T13:00:00.000Z');
const error=(code:string,message='RAW_SECRET_CANARY')=>({statusCode:429,responseBody:JSON.stringify({error:{code,message}}),url:'https://secret.invalid/KEY_CANARY',requestBodyValues:{password:'PASSWORD_CANARY'},responseHeaders:{authorization:'AUTH_CANARY','set-cookie':'COOKIE_CANARY'}});
describe('closed provider-limit evidence',()=>{
  it.each(Object.entries(ZAI_LIMIT_KINDS))('classifies Z.ai code %s as %s without retaining raw provider text',(code,kind)=>{
    const evidence=classifyProviderLimit(error(code),'zai',now)!;expect(evidence).toMatchObject({kind,providerCode:code,httpStatus:429,observedAt:new Date(now).toISOString()});expect(isProviderLimitEvidence(evidence)).toBe(true);expect(JSON.stringify(evidence)).not.toMatch(/CANARY|secret\.invalid|message|authorization|cookie/i);
  });
  it('does not infer quota from HTTP429 or another provider code and keeps unknown failures generic',()=>{
    expect(classifyProviderLimit(error('unknown'),'zai',now)).toMatchObject({kind:'unspecified-limit'});expect(classifyProviderLimit(error('1308'),undefined,now)).toMatchObject({kind:'unspecified-limit'});expect(classifyProviderLimit({statusCode:500,message:'quota exhausted'},'zai',now)).toBeUndefined();
  });
  it('retains explicit standard retry timing and timezone-qualified reset evidence only',()=>{
    const raw={...error('1308','Quota reached. Your limit will reset at 2026-10-28T00:00:00+08:00 SECRET_CANARY'),responseHeaders:{'ReTrY-AfTeR':'120',authorization:'PRIVATE'}};
    expect(classifyProviderLimit(raw,'zai',now)).toMatchObject({retryAfterSeconds:120,retryAt:'2026-10-27T13:02:00.000Z',retrySource:'retry-after-seconds',resetAt:'2026-10-27T16:00:00.000Z',resetSource:'zai-reset-message'});
    expect(providerLimitMessage(classifyProviderLimit(raw,'zai',now)!)).toContain('120 seconds (estimated');
    expect(classifyProviderLimit(error('1310','Resets at 2026-10-28t00:00:00z'),'zai',now)).toHaveProperty('resetAt','2026-10-28T00:00:00.000Z');
    const date=new Date(now+60_000).toUTCString();expect(classifyProviderLimit({...error('1302'),responseHeaders:{'Retry-After':date}},'zai',now)).toMatchObject({retryAfterSeconds:60,retryAt:new Date(now+60_000).toISOString(),retrySource:'retry-after-date'});
    for(const message of ['Resets at 2026-10-28 00:00:00','Resets at 2026-02-30T00:00:00Z','Resets at 2099-01-01T00:00:00Z'])expect(classifyProviderLimit({...error('1310',message),responseHeaders:{'retry-after':'SECRET_CANARY'}},'zai',now)).not.toHaveProperty('resetAt');
    const missing=classifyProviderLimit(error('1310'),'zai',now)!;expect(missing).not.toHaveProperty('retryAt');expect(providerLimitMessage(missing)).toContain('No unambiguous retry or reset time');expect(providerLimitMessage(missing)).not.toMatch(/5.hour|recharge|upgrade/i);
  });
  it('bounds malformed/oversized bodies and causal graphs without invoking getters',()=>{
    let getters=0;const raw={get statusCode(){getters++;return 429;},get data(){getters++;return {error:{code:'1310'}};},get cause(){getters++;return raw;}};expect(classifyProviderLimit(raw,'zai',now)).toBeUndefined();expect(getters).toBe(0);
    const loop:{cause?:unknown;lastError?:unknown}={};loop.cause=loop;loop.lastError=error('1305');expect(classifyProviderLimit(loop,'zai',now)).toMatchObject({kind:'overload'});
    expect(classifyProviderLimit({statusCode:429,responseBody:'x'.repeat(20_000),responseHeaders:{'retry-after':'99999999'}},'zai',now)).toMatchObject({kind:'unspecified-limit'});
    const evidence=classifyProviderLimit(error('1302'),'zai',now)!;expect(isProviderLimitEvidence({...evidence,message:'SECRET'})).toBe(false);expect(isProviderLimitEvidence({...evidence,kind:'quota'})).toBe(false);expect(isProviderLimitEvidence({get schema(){getters++;return evidence.schema;}})).toBe(false);expect(getters).toBe(0);
  });
});
async function drain(model:{doStream:(options?:unknown)=>Promise<{stream:ReadableStream<unknown>}>}){const reader=(await model.doStream({})).stream.getReader();const chunks:unknown[]=[];while(true){const item=await reader.read();if(item.done)break;chunks.push(item.value);}return chunks;}
describe('safe model failure callback propagation',()=>{
  it.each(['reject','stream-error','error-part','finish-error'] as const)('contains %s while passing only a stable code and closed evidence',async path=>{
    const raw=error('1310','Weekly usage limit. Resets at 2026-10-28T00:00:00Z RAW_SECRET_CANARY');let calls=0;
    const model={doStream:async()=>{calls++;if(path==='reject')throw raw;return {stream:new ReadableStream({start(controller){if(path==='stream-error')controller.error(raw);else{controller.enqueue(path==='error-part'?{type:'error',error:raw}:{type:'finish',finishReason:{unified:'error',raw:'RAW_SECRET_CANARY'},error:raw});controller.close();}}})};}};
    let received:ProviderLimitEvidence|undefined;let code='';boundedProviderModel(model,new AbortController().signal,Date.now()+5000,(next,evidence)=>{code=next;received=evidence;},undefined,{provider:'zai'});
    const chunks=await drain(model);expect(calls).toBe(1);expect(code).toBe('STUDIO_AGENT_PROVIDER_QUOTA');expect(received).toMatchObject({kind:'quota',providerCode:'1310'});expect(JSON.stringify(chunks)).not.toContain('CANARY');expect(chunks.at(-1)).toMatchObject({type:'error',error:expect.objectContaining({message:code})});
  });
  it('gives cancellation/deadline precedence and never attaches stale quota evidence',async()=>{
    for(const mode of ['cancel','deadline']){const controller=new AbortController();let code='';let evidence:ProviderLimitEvidence|undefined;
      const model={doStream:async()=>{throw error('1308');}};if(mode==='cancel')controller.abort();boundedProviderModel(model,controller.signal,mode==='deadline'?Date.now()-1:Date.now()+5000,(next,value)=>{code=next;evidence=value;},undefined,{provider:'zai'});await drain(model);expect(code).toBe(mode==='cancel'?'STUDIO_AGENT_CANCELLED':'STUDIO_AGENT_PROVIDER_FAILED');expect(evidence).toBeUndefined();}
  });
});
