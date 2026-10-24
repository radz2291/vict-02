export interface ToolFailure { tool: string; code: string; phase?: string; reason?: string }
export interface TurnMetrics {
  partial?: true;
  elapsedMs: number;
  toolCalls: number;
  completedCalls: number;
  refusedCalls: number;
  recoveryAttempts: number;
  toolElapsedMs: number;
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
  const started=now();const calls=new Map<string,{started:number;settled:boolean}>();
  const failures=new Set<string>();
  const value={toolCalls:0,completedCalls:0,refusedCalls:0,recoveryAttempts:0,toolElapsedMs:0,providerRequests:0,visionRequests:0,acknowledgementMs:0} as Omit<TurnMetrics,'elapsedMs'|'modelSteps'|'cost'>;
  return {
    start(id:string,tool:string){if(calls.has(id)||calls.size>=128)return;calls.set(id,{started:now(),settled:false});value.toolCalls++;if(failures.has(tool))value.recoveryAttempts++;},
    finish(id:string|undefined,tool:string,ok:boolean){const call=id&&calls.get(id);if(!call||call.settled)return;call.settled=true;value.toolElapsedMs+=Math.max(0,now()-call.started);if(ok){value.completedCalls++;failures.delete(tool);}else{value.refusedCalls++;failures.add(tool);}},
    provider(vision=false){if(vision)value.visionRequests++;else value.providerRequests++;},
    edit(waitMs:number){value.firstEditMs??=Math.max(0,now()-started);value.acknowledgementMs+=Math.max(0,waitMs);},
    usage(usage:unknown){
      if(!usage||typeof usage!=='object')return;const u=usage as Record<string,unknown>;
      const count=(item:unknown)=>{const n=item&&typeof item==='object'?(item as {total?:unknown}).total:item;return typeof n==='number'&&Number.isSafeInteger(n)&&n>=0?n:undefined;};
      // The pinned SDK supports numeric counts and {total,...} counts. Do not
      // inherit the adapter's missing-as-zero normalization as real measurement.
      const input=count(u.inputTokens),output=count(u.outputTokens);if(input===undefined||output===undefined)return;
      const total=count(u.totalTokens)??input+output;const previous=value.usage;
      value.usage={inputTokens:(previous?.inputTokens??0)+input,outputTokens:(previous?.outputTokens??0)+output,totalTokens:(previous?.totalTokens??0)+total};
    },
    snapshot():TurnMetrics{return {...value,elapsedMs:Math.round(Math.max(0,now()-started)),toolElapsedMs:Math.round(value.toolElapsedMs),acknowledgementMs:Math.round(value.acknowledgementMs),modelSteps:null,cost:null};},
  };
}
export function phaseFailureStatus(failures: readonly ToolFailure[] = []) {
  const observation=failures.find(item=>item.tool==='studio_screen_observe');
  if(observation)return `Visual verification failed (${observation.code}${observation.phase?` · ${observation.phase}`:''}). Continue by observing the current preview; confirmed edits must not be repeated.`;
  if(failures.some(item=>item.tool==='studio_screen_read'))return 'Source inspection failed. Read the current source before continuing; confirmed edits must not be repeated.';
  return 'A tool could not finish. Inspect its details and continue from the current source.';
}
