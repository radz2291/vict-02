<script module lang="ts">
  /** Studio stream bookkeeping, not prose classification or provider authority.
   * Receipt updates replace old activity in place, so array position alone
   * cannot establish whether text followed the last actual tool attempt. */
  export function createResponseBoundary() {
    let trailingTextIds: string[] = [];
    return {
      toolStarted() { trailingTextIds = []; },
      text(id: string) { if (!trailingTextIds.includes(id)) trailingTextIds.push(id); },
      finish(success: boolean) { return success ? [...trailingTextIds] : []; },
    };
  }
</script>

<script lang="ts">
  import type {SelectionSet} from './selection-context.js';
  import { agentOutcomeSummary, hasMatchingOutcomeCapture } from './agent-outcome.js';
  import type {AgentMediaInventory} from './media-assets.js';
  import { onDestroy, onMount } from 'svelte';
  import AgentTurnEvidence from './AgentTurnEvidence.svelte';
  import { Conversation, conversationMessages, appendConversationEvent, type ConversationMessage, type ConversationEvent, type ConversationActivity, type SendAccepted, type ConversationToolPayload } from '@victframework/ui-ai-svelte';
  import '@victframework/ui-ai-svelte/styles.css';
  import { Popover } from '@victframework/ui-svelte/primitives';
  import { Button } from '@victframework/ui-svelte/catalog/button';
  import type { UiConversationMessage, UiDocument } from '@victframework/ui';
  import type { AgentCursor, AgentProposal, EditFailure, EditReceipt } from './agent-edits.js';
  import { AGENT_REQUEST_BYTES, AGENT_STREAM_BYTES, AGENT_FRAME_CHARACTERS, boundedHistoryText, agentFailureMessage, withTurnAbort, type AgentWorkspaceFacts, type AgentCaptureTarget } from './agent-transport.js';
  import { uploadVisualCapture, type CaptureResult } from './visual-observation.js';
  import { createToolEvidenceConsumer, STUDIO_TOOL_EVIDENCE_SCHEMA, TOOL_ARCHIVE_SCHEMA, isToolArchiveReference, type ToolArchiveReference } from './tool-evidence.js';
  import { retainTurn, sameTurnSource, TURN_RECORD_TTL_MS, type RetainedTurn } from './turn-records.js';
  import { isProviderLimitEvidence,providerLimitMessage,type ProviderLimitEvidence } from './provider-limit.js';
  import { createTurnMetrics, phaseFailureStatus, type ToolFailure, type TurnMetrics, type ObservedRegion } from './agent-progress.js';
  interface Props {
    screenLabel:string;
    selectionLabel:string;
    getContext:()=>{document:UiDocument;cursor:AgentCursor;selection?:string;selectionSet?:SelectionSet;workspace?:AgentWorkspaceFacts;mediaInventory?:AgentMediaInventory}|undefined;
    applyProposal:(proposal:AgentProposal)=>EditReceipt;
    blocked:boolean;
    getCapture?:(cursor:AgentCursor,target?:AgentCaptureTarget)=>Promise<CaptureResult>;
  }
  let {screenLabel,selectionLabel,getContext,applyProposal,blocked,getCapture}:Props=$props();
  let messages=$state<UiConversationMessage[]>([]);
  let progress=$state<string[]>([]);
  let diagnostics=$state<Record<string,string>>({});
  let receipts=$state<Record<string,{title:string;stages:NonNullable<ConversationActivity['stages']>}>>({});
  let timelines=$state<Record<string, ConversationEvent[]>>({});
  let hostTurns=$state<Record<string,NonNullable<ConversationMessage['hostTurn']>>>({});
  const presentedMessages=$derived(conversationMessages(messages).map(message=>({...message,...(timelines[message.id] ? {events:timelines[message.id]} : {}),...(hostTurns[message.id]?{hostTurn:hostTurns[message.id]}:{})})));
  let status=$state('Checking agent configuration…');
  let model=$state('');let ready=$state(false);let busy=$state(false);let csrf='';
  interface LocalTurn {identity:string;source:AgentCursor;task:string;startedAt:number;engineTurnId?:string;confirmedRevision?:string;terminal?:RetainedTurn['status'];code?:string;controller:AbortController;runId:string;runIdentity:string;applied:number;cancelled:boolean;refusal?:EditFailure;toolEvidence?:ReturnType<typeof createToolEvidenceConsumer>;metrics:ReturnType<typeof createTurnMetrics>;}
  let activeTurn:LocalTurn|undefined;
  let evidence=$state('');
  let lastMetrics=$state<TurnMetrics>();
  let lastRegions=$state<(ObservedRegion & {currentSource:boolean})[]>([]);
  let lastProviderLimit=$state<ProviderLimitEvidence>();
  let retainedTurns=$state<RetainedTurn[]>([]);
  let selectedTurn=$state('latest');
  let archiveReferences=$state<ToolArchiveReference[]>([]);
  let archivePages=$state<Record<string,{text:string;nextOffset:number|null;offset:number;message?:string}>>({});
  let recovery=$state<{cursor:AgentCursor;task:string;reason:string;target?:AgentCaptureTarget}|undefined>();
  let recovering=$state(false);
  let recoveryImage=$state<string>();
  let recoveryNote=$state('');
  const selectedRecord=$derived(retainedTurns.find(item=>item.id===selectedTurn&&item.expiresAt>Date.now()));
  const detailMetrics=$derived(selectedRecord?.metrics??(selectedTurn==='latest'?lastMetrics:undefined));
  const detailRegions=$derived(selectedRecord?.regions??(selectedTurn==='latest'?lastRegions:[]));
  const detailProgress=$derived(selectedRecord?.progress??(selectedTurn==='latest'?progress:[]));
  const detailDiagnostics=$derived(selectedRecord?.diagnostics??(selectedTurn==='latest'?diagnostics:{}));
  const detailReceipts=$derived(selectedRecord?.receipts??(selectedTurn==='latest'?receipts:{}));
  const detailEvidence=$derived(selectedRecord?.evidence??(selectedTurn==='latest'?evidence:''));
  const detailArchives=$derived(selectedRecord?.archives??(selectedTurn==='latest'?archiveReferences:[]));
  const detailProviderLimit=$derived(selectedRecord?.providerLimit??(selectedTurn==='latest'?lastProviderLimit:undefined));
  let disposed=false;
  let panel=$state<HTMLElement>();
  let detailsBoundary=$state<HTMLElement>();
  let detailsAnchor=$state<HTMLFormElement>();
  let failed=$state(false);
  function note(message:string){progress=[...progress.slice(-99),message];status=message;}
  function confirmedTurnSource(turn:LocalTurn){const current=getContext()?.cursor;return current&&current.documentId===turn.source.documentId&&current.epoch===turn.source.epoch&&current.revision===turn.confirmedRevision?{...current}:undefined;}
  async function loadArchive(reference:ToolArchiveReference,offset=0){
    if(reference.expiresAt<=Date.now()){archivePages={...archivePages,[reference.id]:{text:'',offset:0,nextOffset:null,message:'Evidence expired. No tool was rerun.'}};return;}
    try{
      const response=await fetch(`/api/designer-agent/evidence?id=${encodeURIComponent(reference.id)}&offset=${offset}&limit=6000`,{cache:'no-store'});
      const page=await response.json();
      if(!response.ok||page.runId!==reference.runId||page.callId!==reference.callId||page.phase!==reference.phase||typeof page.text!=='string'||page.text.length>6000)throw new Error('Evidence is unavailable, expired or outside this session. No tool was rerun.');
      const retained=Object.entries(archivePages).slice(-63);
      archivePages={...Object.fromEntries(retained),[reference.id]:{text:page.text,offset:page.offset,nextOffset:page.nextOffset}};
    }catch{archivePages={...archivePages,[reference.id]:{text:'',offset:0,nextOffset:null,message:'Evidence is unavailable, expired or outside this session. No tool was rerun.'}};}
  }
  async function retryCapture(){
    if(!recovery||busy||recovering||blocked)return;
    if(recoveryImage){URL.revokeObjectURL(recoveryImage);recoveryImage=undefined;}
    const target=recovery,context=getContext();
    if(!context||!sameTurnSource(context.cursor,target.cursor)){recoveryNote='The source changed. Start from the current screen; earlier edits were not repeated.';return;}
    if(!getCapture){recoveryNote='Reveal the preview before retrying. No capture or edit was made.';return;}
    recovering=true;recoveryNote='Capturing the current preview without edits.';
    try{
      const result=await withTurnAbort(()=>getCapture!(target.cursor,target.target),new AbortController().signal);
      if(!sameTurnSource(getContext()?.cursor??context.cursor,target.cursor)){recoveryNote='The source changed during capture. No edit was made.';return;}
      if(!result.ok){recoveryNote=result.message;return;}
      if(recoveryImage)URL.revokeObjectURL(recoveryImage);
      recoveryImage=URL.createObjectURL(result.blob);
      recoveryNote=`Captured ${result.metadata.image.width}x${result.metadata.image.height} at ${result.metadata.capturedAt} for your inspection. No model observation or interaction test occurred; earlier edits were not repeated.`;
      failed=false;status='Preview captured for inspection.';
    }catch{recoveryNote='Capture could not finish. No edit was made.';}finally{recovering=false;}
  }
  async function retryObservation(){
    if(!recovery||busy||recovering||blocked)return;
    const target=recovery;
    const response=await send('Retry the visual observation for the retained task. Inspect current appearance and report limits without changing source.',undefined,{task:target.task,cursor:target.cursor,target:target.target});
    if(response&&typeof response==='object'&&!response.ok){recoveryNote=response.message??'Observation could not start.';failed=true;status=recoveryNote;}
  }
  async function configure(){
    try{const response=await fetch('/api/designer-agent',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error();csrf=data.csrf;model=data.model;ready=data.ready;failed=!ready;status=ready?'Ready':'Configure a server-side model and provider key to connect.';}
    catch{ready=false;failed=true;status='Agent connection unavailable. Sign in again or reconnect in Chat details.';}
  }
  onMount(()=>{
    // The docked narrow conversation may have only a few pixels above its
    // composer. Keep inline theme ancestry, but let the fixed Bits surface
    // use the enclosing Studio viewport rather than that clipped panel slice.
    detailsBoundary=panel?.closest<HTMLElement>('.studio-workspace') ?? panel;
    detailsAnchor=panel?.querySelector<HTMLFormElement>('.vict-conversation-input') ?? undefined;
    void configure();
    const expiry=setInterval(()=>{retainedTurns=retainedTurns.filter(item=>item.expiresAt>Date.now());if(selectedTurn!=='latest'&&!retainedTurns.some(item=>item.id===selectedTurn))selectedTurn='latest';if(!busy&&!retainedTurns.length){lastMetrics=undefined;lastRegions=[];lastProviderLimit=undefined;progress=[];diagnostics={};receipts={};evidence='';archiveReferences=[];archivePages={};}},30_000);
    return ()=>clearInterval(expiry);
  });
  function toolLabel(tool:string){return tool==='studio_screen_read'?'Read screen':tool==='studio_screen_edit'?'Edit screen':tool==='studio_screen_observe'?'Observe preview':tool;}
  const headers=()=>({'content-type':'application/json','x-vict-csrf':csrf});
  function appliedEffects(applied:number){return applied?`${applied} applied edit${applied===1?' remains':'s remain'} undoable.`:'No edits were applied.';}
  function cancelTransport(turn:LocalTurn){
    const id=turn.runId;turn.runId='';turn.toolEvidence?.close();turn.controller.abort();
    // Server cleanup has no authority to change feedback for a subsequent turn.
    if(id)void fetch('/api/designer-agent',{method:'DELETE',headers:headers(),body:JSON.stringify({runId:id})}).catch(()=>undefined);
  }
  function stop(){
    const turn=activeTurn;if(!turn || turn.cancelled)return;
    turn.cancelled=true;cancelTransport(turn);
    lastMetrics={...turn.metrics.snapshot(),partial:true};
    if(!disposed){failed=false;note(`Stopped. ${appliedEffects(turn.applied)}`);}
  }
  onDestroy(()=>{disposed=true;void stop();if(recoveryImage)URL.revokeObjectURL(recoveryImage);});
  function failedStatus(code:string|undefined,applied:number,failures:ToolFailure[]=[]){
    const effects=appliedEffects(applied);
    const boundedFailure=agentFailureMessage(code);if(boundedFailure)return `${boundedFailure} ${effects}`;
    if(code==='STUDIO_AGENT_BUSY')return `Another agent turn is still running in this session. Wait for it to finish, or stop it in its Designer tab, then retry. ${effects}`;
    if(code==='STUDIO_AGENT_CAPACITY')return `The agent server is finishing other turns. Wait a moment and retry. ${effects}`;
    if(code==='STUDIO_AGENT_UNCONFIGURED')return `The agent needs a server-side provider configuration. Reconnect after configuring it. ${effects}`;
    if(code==='STUDIO_AGENT_OUTPUT_LIMIT')return `The agent's response was cut off. Retry with a smaller change. ${effects}`;
    if(code==='STUDIO_AGENT_INCOMPLETE_TOOL')return `The agent returned an invalid or incomplete edit. Retry the change. ${effects}`;
    if(code==='STUDIO_AGENT_TOOL_FAILED'||code?.startsWith('STUDIO_CAPTURE_'))return `${phaseFailureStatus(failures)} ${effects}`;
    if(code==='UI_DOC_STALE_REVISION')return `The screen changed during this turn. Send a new request. ${effects}`;
    if(code==='STUDIO_AGENT_DRAFT')return `Apply or cancel the current draft, then send a new request. ${effects}`;
    return `${code==='STUDIO_AGENT_PROVIDER_FAILED'?'The provider could not complete this turn. Check the connection and retry.':'The agent stopped before finishing. Check Chat details and retry.'} ${effects}`;
  }
  async function send(text:string,accepted?:SendAccepted,continuation?:{task:string;cursor:AgentCursor;target?:AgentCaptureTarget}){
    if(busy)return {ok:false,message:'Wait for this turn or stop it first.'};
    if(text.length>6000)return {ok:false,message:'Keep requests within 6,000 characters. Your draft is still here.'};
    if(blocked)return {ok:false,message:'Apply or cancel your property, data, rename or source draft first.'};
    if(!ready){await configure();if(!ready)return {ok:false,message:'The agent needs a server-side provider configuration. Your request is still here.'};}
    const context=getContext();if(!context)return {ok:false,message:'Open a valid screen before sending.'};
    if(continuation&&!sameTurnSource(context.cursor,continuation.cursor))return {ok:false,message:'The source changed. Start from the current screen; earlier edits were not repeated.'};
    if(continuation&&context.workspace?.observable===false)return {ok:false,message:'Reveal the Design or Interact preview before retrying observation. No model request was made.'};
    const history=messages.slice(-12).map(({participant,text})=>({participant:participant==='user'?'user':'assistant',text:boundedHistoryText(text)}));
    const requestBody=JSON.stringify({...context,prompt:text,history,toolEvidenceSchema:STUDIO_TOOL_EVIDENCE_SCHEMA,toolEvidenceArchiveSchema:TOOL_ARCHIVE_SCHEMA,...(continuation?{mode:'observe-only',observationTask:continuation.task,observationTarget:continuation.target}:{})});
    if(new TextEncoder().encode(requestBody).byteLength>AGENT_REQUEST_BYTES)return {ok:false,message:agentFailureMessage('STUDIO_AGENT_REQUEST_LIMIT')};
    messages=[...messages,{author:'You',participant:'user',text},{author:'Assistant',participant:'assistant',text:''}];
    const responseIndex=messages.length-1;
    const messageId=`message-${responseIndex}`;let serial=0;
    const responseBoundary=createResponseBoundary();
    const presentTurn=(state:NonNullable<ConversationMessage['hostTurn']>['state'],statusText:string,finalTextEventIds:readonly string[]=[],evidenceSummary?:string)=>{hostTurns={...hostTurns,[messageId]:{state,statusText,finalTextEventIds,...(evidenceSummary?{evidenceSummary}:{})}};};
    presentTurn('running','Working. Public notes and tool receipts are available in details.');
    const append=(event:ConversationEvent)=>{timelines={...timelines,[messageId]:appendConversationEvent(timelines[messageId]??[],event,Number.POSITIVE_INFINITY)};};
    const payloads=new Map<string,Partial<Pick<ConversationActivity,'input'|'result'>>>();
    function stage(key:string,id:string,title:string,state:ConversationActivity['state'],detail?:string){
      const eventId=`attempt-${key}`;
      const previous=timelines[messageId]?.find(item=>item.id===eventId);
      const stages=[...(receipts[eventId]?.stages??[])];
      const index=stages.findIndex(item=>item.id===id);const receipt={id,title,state,...(detail?{detail}:{})};
      if(index>=0)stages[index]=receipt;else stages.push(receipt);
      receipts={...receipts,[eventId]:{title:toolLabel(key.split(':')[0]),stages}};
      const existing=previous?.kind==='activity'?previous.activity:undefined;
      append({id:eventId,kind:'activity',activity:{...existing,id:eventId,title:toolLabel(key.split(':')[0]),state,
        input:existing?.input??{unavailable:true,text:'Validated input unavailable for this call.'},
        ...(state==='completed'||state==='failed'?{result:existing?.result??{unavailable:true,text:`Full result unavailable. Recorded tool outcome: ${title}${detail?`\n${detail}`:''}`}}:{}),...payloads.get(key)}});
    }
    const attempts=new Map<string,string[]>();
    function settle(ids:readonly string[],state:'completed'|'failed'|'cancelled',detail?:string){
      const selected=new Set(ids);
      timelines={...timelines,[messageId]:(timelines[messageId]??[]).map(item=>selected.has(item.id)&&item.kind==='activity'?{...item,activity:{...item.activity,state,...(detail?{detail:`${item.activity.detail??''}\n${detail}`}:{})}}:item)};
    }
    function finishPending(detail:string,cancelled=false){settle((timelines[messageId]??[]).filter(item=>item.kind==='activity'&&(item.activity.state==='running'||item.activity.state==='pending')).map(item=>item.id),cancelled?'cancelled':'failed',detail);}
    timelines={...timelines,[messageId]:[]};
    const turn:LocalTurn={identity:crypto.randomUUID(),source:{...context.cursor},task:continuation?.task??text,startedAt:Date.now(),controller:new AbortController(),runId:'',runIdentity:'',applied:0,cancelled:false,metrics:createTurnMetrics()};activeTurn=turn;
    busy=true;failed=false;selectedTurn='latest';archiveReferences=[];progress=[];diagnostics={};receipts={};evidence='';lastMetrics=undefined;lastRegions=[];lastProviderLimit=undefined;let done=false;let sent=false;let lastRefusal='';let separateReply=false;
    note('Connecting…');
    try{
      const response=await fetch('/api/designer-agent',{method:'POST',headers:headers(),signal:turn.controller.signal,body:requestBody});
      if(!response.ok){const rejection=await response.json().catch(()=>({}));throw new Error(rejection.code??'connection');}
      if(!response.body)throw new Error('connection');
      const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';let receivedBytes=0;
      try{
        while(true){
          const chunk=await reader.read();
          if(turn.controller.signal.aborted)throw new Error('stopped');
          if(chunk.done)break;
          receivedBytes+=chunk.value.byteLength;if(receivedBytes>AGENT_STREAM_BYTES)throw new Error('STUDIO_AGENT_STREAM_LIMIT');
          buffer+=decoder.decode(chunk.value,{stream:true});if(buffer.length>AGENT_FRAME_CHARACTERS)throw new Error('STUDIO_AGENT_STREAM_LIMIT');
          let newline:number;
          while((newline=buffer.indexOf('\n'))>=0){
            if(turn.controller.signal.aborted)throw new Error('stopped');
            const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(!line.trim()||done)continue;
            const event=JSON.parse(line);
            if(event.type==='started'&&!sent){sent=true;turn.runId=event.runId;turn.runIdentity=event.runId;model=event.model;turn.toolEvidence=createToolEvidenceConsumer(event.runId);accepted?.();note('Reading screen…');}
            if(event.type==='tool-evidence-archive'&&isToolArchiveReference(event)&&event.runId===turn.runIdentity&&!archiveReferences.some(item=>item.id===event.id))archiveReferences=[...archiveReferences,event].slice(-256);
            if(event.type==='tool-evidence'){
              const frame=turn.toolEvidence?.accept(event);
              if(frame){
                const key=`${frame.tool}:${frame.callId}`;
                const payload:ConversationToolPayload=frame.availability==='available' && frame.payload?frame.payload:{unavailable:true,text:frame.unavailableReason==='before-invocation'?'Unavailable: the call failed before validated invocation.':frame.unavailableReason==='budget'?'Unavailable: the tool evidence budget was reached.':'Unavailable: no settled result was returned.'};
                const values={...payloads.get(key),[frame.phase]:payload};payloads.set(key,values);
                const previous=timelines[messageId]?.find(item=>item.id===`attempt-${key}`);
                if(previous?.kind==='activity')append({...previous,activity:{...previous.activity,...values,...(frame.phase==='result'?{state:frame.status==='completed'?'completed' as const:'failed' as const}:{})}});
              }
            }
            if(event.type==='progress')note(event.message);
            if(event.type==='schema-diagnostic'){
              responseBoundary.toolStarted();separateReply=true;
              diagnostics={...diagnostics,[event.id]:`${event.evaluations} parser evaluations; these are not tool calls. No call identity is inferred. First observed ${event.firstElapsedMs} ms; last observed ${event.lastElapsedMs} ms since turn start.
${event.details}`};
            }
            if(event.type==='tool-event'){
              if(event.kind==='tool-start'){responseBoundary.toolStarted();separateReply=true;}
              const attemptKey=`${event.tool}:${event.callId??event.id}`;
              const refused=event.kind==='validation-refused'||event.kind==='tool-failed';
              if(event.kind==='tool-start')turn.metrics.start(event.callId??event.id,event.tool);else if(event.callId&&(refused||event.kind==='observation'||event.kind==='committed'))turn.metrics.finish(event.callId,event.tool,!refused);
              if(event.callId&&event.kind!=='tool-start'&&event.kind!=='proposed'){
                settle(attempts.get(attemptKey)??[],refused?'failed':'completed');attempts.delete(attemptKey);
              }
              stage(attemptKey,event.id,event.kind==='tool-start'?`${toolLabel(event.tool)} started`:event.summary,event.kind==='tool-start'?'running':refused?'failed':event.kind==='proposed'?'pending':'completed',[event.kind,event.tool,event.elapsedMs===undefined?undefined:`${event.elapsedMs} ms since turn start`,event.details].filter(Boolean).join('\n'));separateReply=true;
              if(event.kind==='tool-start'||event.kind==='proposed')attempts.set(attemptKey,[`attempt-${attemptKey}`]);
            }
            if(event.type==='capture-request'){
              let captured:CaptureResult;
              try{captured=getCapture?await withTurnAbort(()=>getCapture!(event.cursor,event.target),turn.controller.signal):{ok:false,code:'STUDIO_CAPTURE_UNAVAILABLE',message:'The rendered preview is unavailable.'};}
              catch(error){if(turn.controller.signal.aborted)throw error;captured={ok:false,code:error instanceof Error&&error.message==='STUDIO_CAPTURE_TIMEOUT'?'STUDIO_CAPTURE_TIMEOUT':'STUDIO_CAPTURE_FAILED',message:'The browser could not complete capture. No visual observation was made.',diagnostics:{phase:'raster',reason:error instanceof Error&&error.message==='STUDIO_CAPTURE_TIMEOUT'?'capture-timeout':'capture-failed',expectedRevision:event.cursor.revision}};}
              if(turn.controller.signal.aborted)throw new Error('stopped');
              if(!captured.ok)recovery={cursor:{...event.cursor},task:turn.task,reason:captured.message,...(event.target?{target:event.target}:{})};else recovery=undefined;
              await uploadVisualCapture(event.captureId,csrf,captured,turn.controller.signal);separateReply=true;
            }
            if(event.type==='text'){
              const previous=timelines[messageId]?.at(-1);
              const textEvent=previous?.kind==='text'&&!separateReply?{...previous,text:previous.text+event.delta}:{id:`text-${++serial}`,kind:'text' as const,text:event.delta};
              append(textEvent);
              responseBoundary.text(textEvent.id);
              messages=messages.map((message,index)=>index===responseIndex?{...message,text:message.text+(separateReply&&message.text?'\n\n':'')+event.delta}:message);
              separateReply=false;
            }
            if(event.type==='proposal'){
              if(continuation){turn.code='STUDIO_AGENT_OBSERVATION_ONLY';turn.terminal='failed';cancelTransport(turn);throw new Error('STUDIO_AGENT_OBSERVATION_ONLY');}
              const receipt=applyProposal(event.proposal);
              const proposalAttempt=`studio_screen_edit:${event.callId??event.proposal.proposalId}`;
              stage(proposalAttempt,`browser-${event.proposal.proposalId}`,receipt.ok?'Browser committed edit':`Browser refused edit · ${receipt.code}`,receipt.ok?'pending':'failed',receipt.ok?`${event.proposal.edit.reason}\nCommitted to the screen. Undo is available.`:receipt.message);
              lastRefusal=receipt.ok?'':receipt.message;
              if(receipt.ok){turn.applied++;turn.metrics.edit(0,event.proposal.proposalId);status='Applying edit…';presentTurn('running',appliedEffects(turn.applied));}else {turn.refusal=receipt;failed=true;note(receipt.message);}
              separateReply=true;
              const ack=await fetch('/api/designer-agent/ack',{method:'POST',headers:headers(),signal:turn.controller.signal,body:JSON.stringify({runId:turn.runId,proposalId:event.proposal.proposalId,receipt})});
              // The host fences every browser refusal. Acknowledge it, then end
              // this turn so only a new user request can capture refreshed context.
              if(!receipt.ok){cancelTransport(turn);throw new Error('canvas-refused');}
              if(!ack.ok)throw new Error('ack');
              stage(proposalAttempt,`ack-${event.proposal.proposalId}`,'Commit receipt acknowledged','completed',event.proposal.edit.reason);
            }
            if(event.type==='edit-result'){lastRefusal=event.result.ok?'':event.result.message;note(event.result.ok?`${event.reason} · applied`:event.result.message);separateReply=true;}
            if(event.type==='done'){
              turn.terminal=event.status;turn.code=event.code;turn.engineTurnId=event.turnId;turn.confirmedRevision=event.confirmedRevision;
              finishPending('This turn ended without a result for this attempt. Only acknowledged receipts establish applied edits.',event.status==='cancelled');
              turn.toolEvidence?.close();done=true;turn.applied=Math.max(turn.applied,event.applied??0);
              const applied=turn.applied;
              failed=event.status==='failed'||Boolean(lastRefusal);
              status=event.status==='completed'?(lastRefusal?`${lastRefusal} ${applied?`${applied} earlier edits remain undoable.`:''}`:`${applied} edit${applied===1?'':'s'} applied`):event.status==='cancelled'?`Stopped · ${applied} applied edits remain undoable.`:failedStatus(event.code,applied,event.toolFailures??[]);
              lastMetrics=event.metrics;
              lastRegions=event.visualEvidence?.regions??[];
              lastProviderLimit=event.status!=='cancelled'&&event.code!=='STUDIO_AGENT_TIME_LIMIT'&&isProviderLimitEvidence(event.providerLimit)?event.providerLimit:undefined;
              if(event.status==='failed'&&lastProviderLimit)status=`${providerLimitMessage(lastProviderLimit)} ${appliedEffects(applied)}`;
              if(continuation&&event.status==='completed'&&!lastRefusal)status=event.sourceEvidence?.appearanceObserved?'Image assessment returned; claims unverified.':'Observation ended; appearance remains unverified.';
              const matchingCapture=hasMatchingOutcomeCapture(lastRegions,getContext()?.cursor);
              const outcome=agentOutcomeSummary({state:failed?'failed':event.status,applied,matchingCapture,observationFailed:Boolean(event.toolFailures?.some((item:ToolFailure)=>item.tool==='studio_screen_observe'))});
              presentTurn(failed?'failed':event.status,status,responseBoundary.finish(event.status==='completed'&&!failed),outcome);
              evidence=[event.turnId?`VICT turn ${event.turnId} · profile ${event.profileVersion}`:'',event.code??''].filter(Boolean).join(' · ');
              const boundary=`${appliedEffects(applied)}${event.confirmedRevision?` Confirmed revision ${event.confirmedRevision}.`:''}`;
              const terminal=event.termination?` Engine termination: ${event.termination.status}${event.termination.code?` (${event.termination.code})`:''}.`:'';
              const unresolved=event.unresolvedTools?.length?` Unresolved tools: ${event.unresolvedTools.join(', ')}.`:'';
              const registeredAuthored=event.coverage?.registeredAuthored??(event.coverage?.scope==='all-authorable-definitions'||event.coverage?.scope==='registered-component-inventory'?event.coverage.authored:undefined);
              const coverage=event.coverage?` Source coverage: ${registeredAuthored===undefined?'Registered-definition inventory count unavailable':`${registeredAuthored}/${event.coverage.available} registered definitions present`}. ${event.coverage.missingCount??event.coverage.missing.length} missing from the ${event.coverage.requested??event.coverage.available}-item ${event.coverage.scope==='agent-declared-manifest'?'agent-declared manifest':'coverage scope'}.${event.coverage.moreMissing?' Missing IDs are paged through coverage reads.':''} This inventory does not establish the full requested intent, interactions or visual completion.`:'';
              const region=lastRegions.filter(item=>item.currentSource).at(-1);
              const regionFacts=region?` Captured region: ${region.image.width}×${region.image.height} at (${region.image.offsetLeft}, ${region.image.offsetTop}) within ${region.image.sourceWidth}×${region.image.sourceHeight}; ${region.preview.mode} at ${region.capturedAt}. This does not verify offscreen content or current runtime state.`:'';
              const facts=event.sourceEvidence?` Source: ${event.sourceEvidence.nodeCount} nodes, ${event.sourceEvidence.stateCount} state declarations; ${event.sourceEvidence.appearanceObserved?'a bounded preview image was assessed by AI; semantic claims unverified':'current appearance unverified'}; interactions unverified by this agent.`:'';
              progress=[...progress,`${boundary}${terminal}${unresolved}${coverage}${facts}${regionFacts}`];

            }
          }
        }
      }finally{reader.releaseLock();}
      if(!done)throw new Error('incomplete');
      return sent?true:{ok:false,message:status};
    }catch(error){
      if(!disposed && activeTurn===turn){
        failed=!turn.cancelled;
        const refusal=turn.refusal;
        const code=error instanceof Error?error.message:undefined;
        const diagnosed=agentFailureMessage(code);
        note(turn.cancelled?`Stopped. ${appliedEffects(turn.applied)}`:refusal?`${refusal.message}${refusal.message.includes('new request')?'':' Send a new request using the current screen.'}${turn.applied?` ${appliedEffects(turn.applied)}`:''}`:diagnosed?`${diagnosed} ${appliedEffects(turn.applied)}`:`Connection interrupted · ${turn.applied} edits applied locally. Inspect the canvas before retrying; Undo is available.`);
        finishPending(turn.cancelled?'Stopped before this attempt was confirmed.':'The connection ended before this attempt was confirmed.',turn.cancelled);
        presentTurn(turn.cancelled?'cancelled':'interrupted',status);
      }
      return sent?true:{ok:false,message:turn.cancelled?'Stopped before the request was admitted. Your draft is still here.':agentFailureMessage(error instanceof Error?error.message:undefined)??status};
    }finally{if(!sent){messages=messages.slice(0,responseIndex-1);const retained={...timelines};delete retained[messageId];timelines=retained;}turn.toolEvidence?.close();if(!done){cancelTransport(turn);lastMetrics={...turn.metrics.snapshot(),partial:true};}if(sent){const endedAt=Date.now();retainedTurns=retainTurn(retainedTurns,{id:turn.identity,runId:turn.runIdentity,engineTurnId:turn.engineTurnId,task:turn.task,...(continuation?{mode:'observe-only' as const}:{}),startedAt:turn.startedAt,endedAt,expiresAt:endedAt+TURN_RECORD_TTL_MS,status:turn.cancelled?'cancelled':turn.terminal??'interrupted',code:turn.code,source:turn.source,confirmedRevision:turn.confirmedRevision,applied:turn.applied,metrics:lastMetrics,regions:lastRegions,progress,diagnostics,receipts,evidence,archives:archiveReferences,finalSource:confirmedTurnSource(turn),providerLimit:lastProviderLimit});}if(activeTurn===turn){activeTurn=undefined;busy=false;}}
  }
</script>

<aside data-studio-typography class="studio-type-scope agent-chat" aria-label="Chat" bind:this={panel}>
  <Conversation messages={presentedMessages} {busy}
    emptyMessage="Describe a screen, or select an element to edit it."
    inputLabel="Message" inputPlaceholder="Ask for a change…"
    onSend={send} onStop={busy ? ()=>void stop() : undefined}/>
  <div class="agent-footer">
    <div class="agent-status" class:agent-status--failed={failed} role="status" aria-live="polite" title={blocked?'Apply or cancel the current draft before asking the agent to edit.':status}>
      <span class="status-dot" class:status-dot--busy={busy} aria-hidden="true"></span>
      <span>{blocked?'Apply or cancel the current draft first.':busy&&!failed?'Working…':failed||!ready?status:status.startsWith('Stopped')?'Stopped':'Ready'}</span>
    </div>
      {#if recovery}<Button.Root type="button" class="vict-btn vict-btn--quiet capture-retry" disabled={busy||recovering||blocked} onclick={()=>void retryObservation()}>Retry observation</Button.Root>{/if}
      <Popover.Root>
        <Popover.Trigger class="vict-btn vict-btn--quiet studio-icon-control agent-details-trigger" aria-label="Chat details" title="Chat details">···</Popover.Trigger>
        <Popover.Content class="studio-chat-details" customAnchor={detailsAnchor ?? null} side="top" align="end" sideOffset={4} collisionPadding={8} collisionBoundary={detailsBoundary ?? panel ?? null} aria-label="Chat details">
          <div class="details-heading"><h3>Chat details</h3><Popover.Close class="vict-btn vict-btn--quiet studio-icon-control" aria-label="Close chat details">×</Popover.Close></div>
          <p class="details-model">{model || 'VICT / Mastra'}</p>
          <!-- Preserve exact history options: the standalone Select adds an empty choice.
               This native field uses its canonical VICT input/select presentation recipe. -->
          {#if retainedTurns.length}<label class="turn-history-label">Turn details <select class="vict-input vict-select" aria-label="Inspect turn" value={selectedTurn} onchange={(event)=>selectedTurn=event.currentTarget.value}><option value="latest">Latest activity</option>{#each retainedTurns as record}<option value={record.id}>{new Date(record.startedAt).toLocaleTimeString()} · {record.status} · {record.task.slice(0,60)}</option>{/each}</select></label><p>Up to 24 turns retained for 30 minutes in this tab. Reloading clears local history; server evidence also expires or disappears on restart/capacity eviction.</p>{/if}
          {#if selectedRecord}<h4>Recorded turn</h4><p>{selectedRecord.status} · {selectedRecord.applied} confirmed edits</p><p class="details-record">Run {selectedRecord.runId}{selectedRecord.engineTurnId?` · VICT turn ${selectedRecord.engineTurnId}`:''}<br />Source {selectedRecord.source.revision} → {selectedRecord.confirmedRevision??'terminal revision unavailable'}</p>{#if selectedRecord.expiresAt<=Date.now()}<p>Local record expired. Earlier transcript messages remain; this evidence is no longer available.</p>{/if}{/if}
          {#if selectedRecord}<details><summary>Source boundaries</summary><pre class="details-record">{JSON.stringify({start:selectedRecord.source,confirmedRevision:selectedRecord.confirmedRevision,final:selectedRecord.finalSource??'Exact terminal cursor unavailable'},null,2)}</pre></details>{/if}
          {#if selectionLabel && selectionLabel!=='None'}<p>Selected: {selectionLabel}</p>{/if}
          <p>{selectedRecord?`${selectedRecord.status}${selectedRecord.code?` · ${selectedRecord.code}`:''}`:status}</p>
          {#if !ready}<p>Set the server’s model and provider key, then restart Studio. Credentials stay on the server.</p>{/if}
          <Button.Root type="button" class="vict-btn vict-btn--secondary details-reconnect" disabled={busy} onclick={()=>void configure()}>Reconnect agent</Button.Root>
          <AgentTurnEvidence metrics={detailMetrics} regions={detailRegions} />
          {#if detailProviderLimit}<h4>Provider limit</h4><p>{providerLimitMessage(detailProviderLimit)}</p><pre class="details-record">{JSON.stringify(detailProviderLimit,null,2)}</pre><p>Only structured provider status and unambiguous timing are retained. No raw provider error, response body, headers or credentials are shown.</p>{/if}
          {#if detailProgress.length}<h4>Progress summaries</h4><p>Connection, validation and completion metadata. The conversation contains actual assistant messages and tool calls.</p><ol>{#each detailProgress as message}<li>{message}</li>{/each}</ol>{/if}
          {#if Object.keys(detailDiagnostics).length}<h4>Input schema diagnostics</h4>{#each Object.entries(detailDiagnostics) as [id,detail]}<pre class="details-record" data-diagnostic-id={id}>{detail}</pre>{/each}{/if}
          {#if Object.keys(detailReceipts).length}<h4>Tool receipts</h4>{#each Object.entries(detailReceipts) as [id,call]}<div data-tool-receipt={id}><p>{call.title}</p><ol>{#each call.stages as stage}<li>{stage.title} · {stage.state}{#if stage.detail}<pre class="details-record">{stage.detail}</pre>{/if}</li>{/each}</ol></div>{/each}{/if}
          {#if detailArchives.length}<h4>Sanitized exchanges</h4><p>Compact previews remain in the conversation. Open a retained original page here; this never invokes a tool again.</p>{#each detailArchives as reference}<div data-evidence-archive={reference.id}><p>{toolLabel(reference.tool)} · {reference.phase}{reference.redacted?' · redacted':''}{reference.truncated?' · bounded original is partial':''}</p><Button.Root type="button" class="vict-btn vict-btn--secondary details-reconnect" onclick={()=>void loadArchive(reference)}>Open first page</Button.Root>{#if archivePages[reference.id]}{@const page=archivePages[reference.id]!}{#if page.message}<p>{page.message}</p>{:else}<p>Characters {page.offset}–{page.offset+page.text.length} of {reference.totalCharacters}</p><pre class="details-record">{page.text}</pre>{#if page.nextOffset!==null}<Button.Root type="button" class="vict-btn vict-btn--secondary details-reconnect" onclick={()=>void loadArchive(reference,page.nextOffset!)}>Next page</Button.Root>{/if}{/if}{/if}</div>{/each}{/if}
          {#if detailEvidence}<h4>Connection record</h4><p class="details-record">{detailEvidence}</p>{/if}
          {#if recovery}<h4>Preview recovery</h4><p>Task: {recovery.task}</p><p>{recovery.reason}</p><Button.Root type="button" class="vict-btn vict-btn--secondary details-reconnect capture-only-retry" disabled={busy||recovering||blocked} onclick={()=>void retryCapture()}>Capture for my inspection</Button.Root><Button.Root type="button" class="vict-btn vict-btn--secondary details-reconnect agent-observation-retry" disabled={busy||recovering||blocked} onclick={()=>void retryObservation()}>Retry observation with agent</Button.Root>{#if recoveryNote}<p role="status">{recoveryNote}</p>{/if}{#if recoveryImage}<img class="recovery-preview" src={recoveryImage} alt="Recovered preview capture for owner inspection; no interaction verification" />{/if}{/if}
        </Popover.Content>
      </Popover.Root>
  </div>
</aside>

<style>
  .agent-chat{display:flex;flex-direction:column;min-height:0;min-width:0;width:320px;border-right:1px solid var(--vict-color-border);background:var(--vict-color-surface);color:var(--vict-color-text);overflow:hidden;font-size:12px}
  .agent-footer{display:flex;flex:none;align-items:center;justify-content:space-between;padding:3px 12px 6px;gap:8px}
  .agent-chat :global(.capture-retry){flex:none}
  .agent-chat :global(.recovery-preview){display:block;max-width:100%;height:auto}.agent-chat :global(.turn-history-label select){display:block;width:100%}
  .agent-chat :global(.agent-details-trigger){flex:none}
  .agent-chat :global(.vict-ai-conversation){flex:1;min-height:0;height:auto}
  .agent-status{flex:1;min-width:0;display:flex;align-items:flex-start;gap:6px;margin:0;color:var(--vict-color-textMuted);font-size:10px;line-height:1.5;min-height:15px;overflow-wrap:anywhere}
  .agent-status>span:last-child{display:-webkit-box;line-clamp:2;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .status-dot{flex:none;width:5px;height:5px;border-radius:50%;background:var(--vict-color-textMuted);margin-top:5px}.status-dot--busy{background:var(--vict-color-info)}.agent-status--failed{color:var(--vict-color-danger)}.agent-status--failed .status-dot{background:var(--vict-color-danger)}
  /* Own this surface over the catalog's generic ControlScope popover recipe. */
  .agent-chat :global(.studio-chat-details[data-popover-content]){display:block;gap:0;z-index:50;width:280px;min-width:0;max-width:min(280px,var(--bits-floating-available-width,calc(100vw - 32px)));max-height:min(320px,var(--bits-floating-available-height,320px));overflow:auto;overscroll-behavior:contain;box-sizing:border-box;border:1px solid var(--vict-color-border);border-radius:8px;background:var(--vict-color-surface);padding:12px;color:var(--vict-color-text);box-shadow:var(--vict-elevation-high,0 8px 24px #0002);font:11px/1.6 var(--vict-font-family,system-ui,sans-serif);overflow-wrap:anywhere}
  .agent-chat :global(.studio-chat-details h3){font-size:12px;margin:0;color:var(--vict-color-text)}
  .agent-chat :global(.studio-chat-details h4){font-size:10px;font-weight:600;margin:14px 0 5px;color:var(--vict-color-textMuted)}
  .agent-chat :global(.studio-chat-details p){margin:6px 0;color:inherit}
  .agent-chat :global(.studio-chat-details .details-model){font-size:10px;color:var(--vict-color-textMuted)}
  .agent-chat :global(.details-heading){display:flex;align-items:center;justify-content:space-between}
  .agent-chat :global(.details-reconnect){margin-top:var(--studio-space-1)}
  .agent-chat :global(.studio-chat-details ol){padding-left:17px;margin:0}.agent-chat :global(.studio-chat-details li){margin:5px 0}
  .agent-chat :global(.studio-chat-details .details-record){font:10px/1.6 ui-monospace,monospace;color:var(--vict-color-textMuted);white-space:pre-wrap;overflow-wrap:anywhere}
  @media(max-width:760px){.agent-chat{width:100%;height:320px;max-height:46vh;border-right:0;border-bottom:1px solid var(--vict-color-border);flex-shrink:0}.agent-chat :global(.vict-conversation-textarea){min-height:52px;max-height:76px}}
</style>
