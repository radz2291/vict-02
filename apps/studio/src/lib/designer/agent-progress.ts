export interface ToolFailure { tool: string; code: string; phase?: string; reason?: string }
export interface TurnMetrics {
  partial?: true;
  elapsedMs: number;
  toolCalls: number;
  completedCalls: number;
  refusedCalls: number;
  recoveryAttempts: number;
  toolElapsedMs: number;
  toolActiveMs?: number;
  outsideToolMs?: number;
  categories?: Record<'knowledge'|'source'|'edit'|'observe'|'other',number>;
  confirmedEdits?: number;
  providerRequests: number;
  visionRequests: number;
  firstEditMs?: number;
  acknowledgementMs: number;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  modelSteps: null;
  cost: null;
}
/** Host measurements survive transcript compaction; bounded by the governed call limit. */
export function createTurnMetrics(now: () => number = () => performance.now()) {
  const started=now();const calls=new Map<string,{started:number;ended?:number;settled:boolean;category:ToolCategory}>();
  const classifications=new Map<string,ToolCategory>();
  const editReceipts=new Set<string>();
  const failures=new Set<string>();
  const value={toolCalls:0,completedCalls:0,refusedCalls:0,recoveryAttempts:0,toolElapsedMs:0,providerRequests:0,visionRequests:0,acknowledgementMs:0,confirmedEdits:0} as Omit<TurnMetrics,'elapsedMs'|'modelSteps'|'cost'>;
  return {
    start(id:string,tool:string){if(calls.has(id)||calls.size>=128)return;calls.set(id,{started:now(),settled:false,category:classifications.get(id)??toolCategory(tool)});value.toolCalls++;if(failures.has(tool))value.recoveryAttempts++;},
    classify(id:string|undefined,category:ToolCategory){if(!id)return;const call=calls.get(id);if(call)call.category=category;else if(classifications.size<128)classifications.set(id,category);},
    finish(id:string|undefined,tool:string,ok:boolean){const call=id&&calls.get(id);if(!call||call.settled)return;call.settled=true;call.ended=now();value.toolElapsedMs+=Math.max(0,call.ended-call.started);if(ok){value.completedCalls++;failures.delete(tool);}else{value.refusedCalls++;failures.add(tool);}},
    provider(vision=false){if(vision)value.visionRequests++;else value.providerRequests++;},
    edit(waitMs:number,receiptId?:string){if(receiptId&&editReceipts.has(receiptId))return;if(receiptId)editReceipts.add(receiptId);value.confirmedEdits=(value.confirmedEdits??0)+1;value.firstEditMs??=Math.max(0,now()-started);value.acknowledgementMs+=Math.max(0,waitMs);},
    usage(usage:unknown){
      if(!usage||typeof usage!=='object')return;const u=usage as Record<string,unknown>;
      const count=(item:unknown)=>{const n=item&&typeof item==='object'?(item as {total?:unknown}).total:item;return typeof n==='number'&&Number.isSafeInteger(n)&&n>=0?n:undefined;};
      // The pinned SDK supports numeric counts and {total,...} counts. Do not
      // inherit the adapter's missing-as-zero normalization as real measurement.
      const input=count(u.inputTokens),output=count(u.outputTokens);if(input===undefined||output===undefined)return;
      const total=count(u.totalTokens)??input+output;const previous=value.usage;
      value.usage={inputTokens:(previous?.inputTokens??0)+input,outputTokens:(previous?.outputTokens??0)+output,totalTokens:(previous?.totalTokens??0)+total};
    },
    snapshot():TurnMetrics{
      const at=now(),elapsed=Math.max(0,at-started),categories={knowledge:0,source:0,edit:0,observe:0,other:0};
      const intervals=[...calls.values()].map(call=>{categories[call.category]++;return [call.started,call.ended??at] as const;}).sort((a,b)=>a[0]-b[0]);
      let active=0,end=started;
      for(const [from,to] of intervals){active+=Math.max(0,to-Math.max(from,end));end=Math.max(end,to);}
      return {...value,categories,elapsedMs:Math.round(elapsed),toolElapsedMs:Math.round(value.toolElapsedMs),toolActiveMs:Math.round(active),outsideToolMs:Math.round(Math.max(0,elapsed-active)),acknowledgementMs:Math.round(value.acknowledgementMs),modelSteps:null,cost:null};
    },
  };
}
export type ToolCategory='knowledge'|'source'|'edit'|'observe'|'other';
export const readCategory=(section:string):ToolCategory=>['families','catalog','contracts','elements','palette','component'].includes(section)?'knowledge':'source';
const toolCategory=(tool:string):ToolCategory=>tool==='studio_screen_read'?'source':tool==='studio_screen_edit'?'edit':tool==='studio_screen_observe'?'observe':'other';

import type { AgentCursor } from './agent-edits.js';
import type { CaptureMetadata } from './visual-observation.js';
export interface ObservedRegion {cursor:AgentCursor;capturedAt:string;imageDigest:string;image:CaptureMetadata['image'];viewport:CaptureMetadata['viewport'];preview:CaptureMetadata['preview']}
const equalSource=(left:AgentCursor,right:AgentCursor)=>left.documentId===right.documentId&&left.revision===right.revision&&left.digest===right.digest&&left.epoch===right.epoch;
/** No area percentage: crops may overlap and unrelated revisions cannot be combined into page coverage. */
export function createObservationLedger(){
  const regions:ObservedRegion[]=[];
  return {
    record(region:ObservedRegion){regions.push(region);if(regions.length>12)regions.shift();},
    snapshot(cursor:AgentCursor){const current=regions.filter(region=>equalSource(region.cursor,cursor));return {regions:regions.map(region=>({...region,currentSource:equalSource(region.cursor,cursor)})),currentSourceObservations:current.length,scope:'Captured regions only; source freshness does not establish current runtime/viewport freshness or offscreen/interaction coverage.',interactionsVerified:false as const};},
  };
}
/** Tracks assembled body ranges, not catalog digests or source reads; per-turn only. */
export function createContractKnowledge(){
  const bodies=new Map<string,{identity:string;digest:string;length:number;ranges:[number,number][]}>();
  const complete=(body:{length:number;ranges:[number,number][]})=>{let end=0;for(const [from,to] of [...body.ranges].sort((a,b)=>a[0]-b[0])){if(from>end)return false;end=Math.max(end,to);}return end>=body.length;};
  return {
    retain(result:{ok?:unknown;items?:unknown}){if(result.ok===false||!Array.isArray(result.items))return;for(const raw of result.items){const item=raw as {id:string;revision:string;digest:string;bodyIdentity:string;contractJson?:string;offset?:number;totalCharacters?:number};if(typeof item.contractJson!=='string'||typeof item.offset!=='number'||typeof item.totalCharacters!=='number')continue;const key=`${item.id}@${item.revision}`;let body=bodies.get(key);if(!body||body.identity!==item.bodyIdentity){body={identity:item.bodyIdentity,digest:item.digest,length:item.totalCharacters,ranges:[]};bodies.set(key,body);}body.ranges.push([item.offset,item.offset+item.contractJson.length]);}},
    reusable(digests:Record<string,string>={},identities?:Record<string,string>){return Object.fromEntries(Object.entries(digests).filter(([key,digest])=>{const body=bodies.get(key);return body&&body.digest===digest&&complete(body)&&(!identities?.[key]||identities[key]===body.identity);}));},
    snapshot(){return {scope:'Complete contract bodies delivered in this turn only; reuse still requires their content to remain available in model context. Source facts are never cached knowledge.',complete:[...bodies].filter(([,body])=>complete(body)).slice(0,30).map(([key,body])=>({key,digest:body.digest,bodyIdentity:body.identity})),partialCount:[...bodies.values()].filter(body=>!complete(body)).length};},
  };
}
export function phaseFailureStatus(failures: readonly ToolFailure[] = []) {
  const observation=failures.find(item=>item.tool==='studio_screen_observe');
  if(observation)return `Visual verification failed (${observation.code}${observation.phase?` · ${observation.phase}`:''}). Continue by observing the current preview; confirmed edits must not be repeated.`;
  if(failures.some(item=>item.tool==='studio_screen_read'))return 'Source inspection failed. Read the current source before continuing; confirmed edits must not be repeated.';
  return 'A tool could not finish. Inspect its details and continue from the current source.';
}
