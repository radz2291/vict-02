<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import AgentTurnEvidence from './AgentTurnEvidence.svelte';
  import { Conversation, conversationMessages, appendConversationEvent, type ConversationEvent, type ConversationActivity } from '@victframework/ui-ai-svelte';
  import '@victframework/ui-ai-svelte/styles.css';
  import { Popover } from '@victframework/ui-svelte/primitives';
  import type { UiConversationMessage, UiDocument } from '@victframework/ui';
  import type { AgentCursor, AgentProposal, EditFailure, EditReceipt } from './agent-edits.js';
  import { AGENT_REQUEST_BYTES, AGENT_STREAM_BYTES, AGENT_FRAME_CHARACTERS, boundedHistoryText, agentFailureMessage, withTurnAbort } from './agent-transport.js';
  import { uploadVisualCapture, type CaptureResult } from './visual-observation.js';
  import { createTurnMetrics, phaseFailureStatus, type ToolFailure, type TurnMetrics, type ObservedRegion } from './agent-progress.js';
  interface Props {
    screenLabel:string;
    selectionLabel:string;
    getContext:()=>{document:UiDocument;cursor:AgentCursor;selection?:string}|undefined;
    applyProposal:(proposal:AgentProposal)=>EditReceipt;
    blocked:boolean;
    getCapture?:(cursor:AgentCursor)=>Promise<CaptureResult>;
  }
  let {screenLabel,selectionLabel,getContext,applyProposal,blocked,getCapture}:Props=$props();
  let messages=$state<UiConversationMessage[]>([]);
  let progress=$state<string[]>([]);
  let timelines=$state<Record<string, ConversationEvent[]>>({});
  const presentedMessages=$derived(conversationMessages(messages).map(message=>({...message,...(timelines[message.id] ? {events:timelines[message.id]} : {})})));
  let status=$state('Checking agent configuration…');
  let model=$state('');let ready=$state(false);let busy=$state(false);let csrf='';
  interface LocalTurn {controller:AbortController;runId:string;applied:number;cancelled:boolean;refusal?:EditFailure;metrics:ReturnType<typeof createTurnMetrics>;}
  let activeTurn:LocalTurn|undefined;
  let evidence=$state('');
  let lastMetrics=$state<TurnMetrics>();
  let lastRegions=$state<(ObservedRegion & {currentSource:boolean})[]>([]);
  let disposed=false;
  let panel=$state<HTMLElement>();
  let detailsBoundary=$state<HTMLElement>();
  let detailsAnchor=$state<HTMLFormElement>();
  let failed=$state(false);
  function note(message:string){progress=[...progress.slice(-99),message];status=message;}
  async function configure(){
    try{const response=await fetch('/api/designer-agent',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error();csrf=data.csrf;model=data.model;ready=data.ready;failed=!ready;status=ready?'Ready':'Configure a server-side model and provider key to connect.';}
    catch{ready=false;failed=true;status='Agent connection unavailable. Sign in again or reconnect in Chat details.';}
  }
  onMount(()=>{
    detailsBoundary=panel?.querySelector<HTMLElement>('.vict-conversation') ?? undefined;
    detailsAnchor=panel?.querySelector<HTMLFormElement>('.vict-conversation-input') ?? undefined;
    void configure();
  });
  const headers=()=>({'content-type':'application/json','x-vict-csrf':csrf});
  function appliedEffects(applied:number){return applied?`${applied} applied edit${applied===1?' remains':'s remain'} undoable.`:'No edits were applied.';}
  function cancelTransport(turn:LocalTurn){
    const id=turn.runId;turn.runId='';turn.controller.abort();
    // Server cleanup has no authority to change feedback for a subsequent turn.
    if(id)void fetch('/api/designer-agent',{method:'DELETE',headers:headers(),body:JSON.stringify({runId:id})}).catch(()=>undefined);
  }
  function stop(){
    const turn=activeTurn;if(!turn || turn.cancelled)return;
    turn.cancelled=true;cancelTransport(turn);
    lastMetrics={...turn.metrics.snapshot(),partial:true};
    if(!disposed){failed=false;note(`Stopped. ${appliedEffects(turn.applied)}`);}
  }
  onDestroy(()=>{disposed=true;void stop();});
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
  async function send(text:string){
    if(busy)return {ok:false,message:'Wait for this turn or stop it first.'};
    if(text.length>6000)return {ok:false,message:'Keep requests within 6,000 characters. Your draft is still here.'};
    if(blocked)return {ok:false,message:'Apply or cancel your property, data, rename or source draft first.'};
    if(!ready){await configure();if(!ready)return {ok:false,message:'The agent needs a server-side provider configuration. Your request is still here.'};}
    const context=getContext();if(!context)return {ok:false,message:'Open a valid screen before sending.'};
    const history=messages.slice(-12).map(({participant,text})=>({participant:participant==='user'?'user':'assistant',text:boundedHistoryText(text)}));
    const requestBody=JSON.stringify({...context,prompt:text,history});
    if(new TextEncoder().encode(requestBody).byteLength>AGENT_REQUEST_BYTES)return {ok:false,message:agentFailureMessage('STUDIO_AGENT_REQUEST_LIMIT')};
    messages=[...messages,{author:'You',participant:'user',text},{author:'Assistant',participant:'assistant',text:''}];
    const responseIndex=messages.length-1;
    const messageId=`message-${responseIndex}`;let serial=0;
    const append=(event:ConversationEvent)=>{timelines={...timelines,[messageId]:appendConversationEvent(timelines[messageId]??[],event)};};
    const summary=(message:string)=>append({id:`local-${++serial}`,kind:'summary',text:message});
    function stage(key:string,id:string,title:string,state:ConversationActivity['state'],detail?:string){
      const eventId=`attempt-${key}`;
      const previous=timelines[messageId]?.find(item=>item.id===eventId);
      const stages=previous?.kind==='activity'?[...(previous.activity.stages??[])]:[];
      const index=stages.findIndex(item=>item.id===id);const receipt={id,title,state,...(detail?{detail}:{})};
      if(index>=0)stages[index]=receipt;else stages.push(receipt);
      append({id:eventId,kind:'activity',activity:{id:eventId,title,state,stages:stages.slice(-12)}});
    }
    const attempts=new Map<string,string[]>();
    function settle(ids:readonly string[],state:'completed'|'failed'|'cancelled',detail?:string){
      const selected=new Set(ids);
      timelines={...timelines,[messageId]:(timelines[messageId]??[]).map(item=>selected.has(item.id)&&item.kind==='activity'?{...item,activity:{...item.activity,state,...(detail?{detail:`${item.activity.detail??''}\n${detail}`}:{})}}:item)};
    }
    function finishPending(detail:string,cancelled=false){settle((timelines[messageId]??[]).filter(item=>item.kind==='activity'&&(item.activity.state==='running'||item.activity.state==='pending')).map(item=>item.id),cancelled?'cancelled':'failed',detail);}
    timelines={...timelines,[messageId]:[]};
    const turn:LocalTurn={controller:new AbortController(),runId:'',applied:0,cancelled:false,metrics:createTurnMetrics()};activeTurn=turn;
    busy=true;failed=false;progress=[];evidence='';lastMetrics=undefined;lastRegions=[];let done=false;let sent=false;let lastRefusal='';let separateReply=false;
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
            const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(!line.trim())continue;
            const event=JSON.parse(line);
            if(event.type==='started'){sent=true;turn.runId=event.runId;model=event.model;note('Reading screen…');}
            if(event.type==='progress'){note(event.message);if(!/^(Reading current source|Preparing and validating|Capturing and observing|Tool refused)/.test(event.message))summary(`Progress summary · ${event.message}`);separateReply=true;}
            if(event.type==='schema-diagnostic'){
              const id=`schema-diagnostic-${event.id}`;
              const toolLabel=event.tool==='studio_screen_read'?'Read source':event.tool==='studio_screen_edit'?'Edit screen':event.tool;
              // Generic expandable diagnostic activity, deliberately without
              // attempt stages, call correlation or metric settlement.
              append({id,kind:'activity',activity:{id,title:`Input schema diagnostics · ${toolLabel} (not a tool attempt)`,state:'failed',detail:`${event.evaluations} parser evaluations; these are not tool calls. Identical diagnostic payloads are combined; actual failed attempts remain separate. No call identity is inferred.\nFirst observed ${event.firstElapsedMs} ms; last observed ${event.lastElapsedMs} ms since turn start.\n${event.details}`}});
              separateReply=true;
            }
            if(event.type==='tool-event'){
              const attemptKey=`${event.tool}:${event.callId??event.id}`;
              const refused=event.kind==='validation-refused'||event.kind==='tool-failed';
              if(event.kind==='tool-start')turn.metrics.start(event.callId??event.id,event.tool);else if(event.callId&&(refused||event.kind==='observation'||event.kind==='committed'))turn.metrics.finish(event.callId,event.tool,!refused);
              if(event.callId&&event.kind!=='tool-start'&&event.kind!=='proposed'){
                settle(attempts.get(attemptKey)??[],refused?'failed':'completed');attempts.delete(attemptKey);
              }
              const toolLabel=event.tool==='studio_screen_read'?'Read source':event.tool==='studio_screen_edit'?'Edit screen':event.tool==='studio_screen_observe'?'Observe preview':event.tool;
              stage(attemptKey,event.id,event.kind==='tool-start'?`${toolLabel} started`:event.summary,event.kind==='tool-start'?'running':refused?'failed':event.kind==='proposed'?'pending':'completed',[event.kind,event.tool,event.elapsedMs===undefined?undefined:`${event.elapsedMs} ms since turn start`,event.details].filter(Boolean).join('\n'));separateReply=true;
              if(event.kind==='tool-start'||event.kind==='proposed')attempts.set(attemptKey,[`attempt-${attemptKey}`]);
            }
            if(event.type==='capture-request'){
              let captured:CaptureResult;
              try{captured=getCapture?await withTurnAbort(()=>getCapture!(event.cursor),turn.controller.signal):{ok:false,code:'STUDIO_CAPTURE_UNAVAILABLE',message:'The rendered preview is unavailable.'};}
              catch(error){if(turn.controller.signal.aborted)throw error;captured={ok:false,code:error instanceof Error&&error.message==='STUDIO_CAPTURE_TIMEOUT'?'STUDIO_CAPTURE_TIMEOUT':'STUDIO_CAPTURE_FAILED',message:'The browser could not complete capture. No visual observation was made.',diagnostics:{phase:'raster',reason:error instanceof Error&&error.message==='STUDIO_CAPTURE_TIMEOUT'?'capture-timeout':'capture-failed',expectedRevision:event.cursor.revision}};}
              if(turn.controller.signal.aborted)throw new Error('stopped');
              await uploadVisualCapture(event.captureId,csrf,captured,turn.controller.signal);separateReply=true;
            }
            if(event.type==='text'){
              const previous=timelines[messageId]?.at(-1);
              const textEvent=previous?.kind==='text'&&!separateReply?{...previous,text:previous.text+event.delta}:{id:`text-${++serial}`,kind:'text' as const,text:event.delta};
              append(textEvent);
              messages=messages.map((message,index)=>index===responseIndex?{...message,text:message.text+(separateReply&&message.text?'\n\n':'')+event.delta}:message);
              separateReply=false;
            }
            if(event.type==='proposal'){
              const receipt=applyProposal(event.proposal);
              const proposalAttempt=`studio_screen_edit:${event.callId??event.proposal.proposalId}`;
              stage(proposalAttempt,`browser-${event.proposal.proposalId}`,receipt.ok?'Browser committed edit':`Browser refused edit · ${receipt.code}`,receipt.ok?'pending':'failed',receipt.ok?`${event.proposal.edit.reason}\nCommitted to the screen. Undo is available.`:receipt.message);
              lastRefusal=receipt.ok?'':receipt.message;
              if(receipt.ok){turn.applied++;turn.metrics.edit(0,event.proposal.proposalId);status='Applying edit…';}else {turn.refusal=receipt;failed=true;note(receipt.message);}
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
              finishPending('This turn ended without a result for this attempt. Only acknowledged receipts establish applied edits.',event.status==='cancelled');
              done=true;turn.applied=Math.max(turn.applied,event.applied??0);
              const applied=turn.applied;
              failed=event.status==='failed'||Boolean(lastRefusal);
              status=event.status==='completed'?(lastRefusal?`${lastRefusal} ${applied?`${applied} earlier edits remain undoable.`:''}`:`${applied} edit${applied===1?'':'s'} applied`):event.status==='cancelled'?`Stopped · ${applied} applied edits remain undoable.`:failedStatus(event.code,applied,event.toolFailures??[]);
              lastMetrics=event.metrics;
              lastRegions=event.visualEvidence?.regions??[];
              evidence=[event.turnId?`VICT turn ${event.turnId} · profile ${event.profileVersion}`:'',event.code??''].filter(Boolean).join(' · ');
              const boundary=`${appliedEffects(applied)}${event.confirmedRevision?` Confirmed revision ${event.confirmedRevision}.`:''}`;
              const terminal=event.termination?` Engine termination: ${event.termination.status}${event.termination.code?` (${event.termination.code})`:''}.`:'';
              const unresolved=event.unresolvedTools?.length?` Unresolved tools: ${event.unresolvedTools.join(', ')}.`:'';
              const registeredAuthored=event.coverage?.registeredAuthored??(event.coverage?.scope==='all-authorable-definitions'||event.coverage?.scope==='registered-component-inventory'?event.coverage.authored:undefined);
              const coverage=event.coverage?` Source coverage: ${registeredAuthored===undefined?'Registered-definition inventory count unavailable':`${registeredAuthored}/${event.coverage.available} registered definitions present`}. ${event.coverage.missingCount??event.coverage.missing.length} missing from the ${event.coverage.requested??event.coverage.available}-item ${event.coverage.scope==='agent-declared-manifest'?'agent-declared manifest':'coverage scope'}.${event.coverage.moreMissing?' Missing IDs are paged through coverage reads.':''} This inventory does not establish the full requested intent, interactions or visual completion.`:'';
              const region=lastRegions.filter(item=>item.currentSource).at(-1);
              const regionFacts=region?` Captured region: ${region.image.width}×${region.image.height} at (${region.image.offsetLeft}, ${region.image.offsetTop}) within ${region.image.sourceWidth}×${region.image.sourceHeight}; ${region.preview.mode} at ${region.capturedAt}. This does not verify offscreen content or current runtime state.`:'';
              const facts=event.sourceEvidence?` Source: ${event.sourceEvidence.nodeCount} nodes, ${event.sourceEvidence.stateCount} state declarations; ${event.sourceEvidence.appearanceObserved?'a bounded preview image was observed':'current appearance unverified'}; interactions unverified by this agent.`:'';
              summary(`${boundary}${terminal}${unresolved}${coverage}${facts}${regionFacts}`);
              messages=messages.map((message,index)=>index===responseIndex?{...message,text:message.text+`\n\nConfirmed progress: ${boundary}${terminal}${unresolved}${coverage}${facts}${regionFacts}`} :message);
              if(!messages[responseIndex]?.text)messages=messages.map((message,index)=>index===responseIndex?{...message,text:status}:message);
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
        summary(status);
        finishPending(turn.cancelled?'Stopped before this attempt was confirmed.':'The connection ended before this attempt was confirmed.',turn.cancelled);
        if(!messages[responseIndex]?.text)messages=messages.map((message,index)=>index===responseIndex?{...message,text:status}:message);
      }
      return sent?true:{ok:false,message:turn.cancelled?'Stopped before the request was admitted. Your draft is still here.':agentFailureMessage(error instanceof Error?error.message:undefined)??status};
    }finally{if(!done){cancelTransport(turn);lastMetrics={...turn.metrics.snapshot(),partial:true};}if(activeTurn===turn){activeTurn=undefined;busy=false;}}
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
      <span>{blocked?'Apply or cancel the current draft first.':busy&&!failed?'Working…':status}</span>
    </div>
      <Popover.Root>
        <Popover.Trigger class="agent-details-trigger" aria-label="Chat details" title="Chat details">···</Popover.Trigger>
        <Popover.Content class="studio-chat-details" customAnchor={detailsAnchor ?? null} side="top" align="end" sideOffset={4} collisionPadding={8} collisionBoundary={detailsBoundary ?? panel ?? null} aria-label="Chat details">
          <div class="details-heading"><h3>Chat details</h3><Popover.Close aria-label="Close chat details">×</Popover.Close></div>
          <p class="details-model">{model || 'VICT / Mastra'}</p>
          {#if selectionLabel && selectionLabel!=='None' && selectionLabel!=='Screen' && selectionLabel!==screenLabel}<p>Selected: {selectionLabel}</p>{/if}
          <p>{status}</p>
          {#if !ready}<p>Set the server’s model and provider key, then restart Studio. Credentials stay on the server.</p>{/if}
          <button type="button" class="details-reconnect" disabled={busy} onclick={()=>void configure()}>Reconnect agent</button>
          <AgentTurnEvidence metrics={lastMetrics} regions={lastRegions} />
          {#if progress.length}<h4>Progress summaries</h4><p>The chronological transcript includes tool attempts and receipts. Summaries are user-facing progress, not private reasoning.</p><ol>{#each progress as message}<li>{message}</li>{/each}</ol>{/if}
          {#if evidence}<h4>Connection record</h4><p class="details-record">{evidence}</p>{/if}
        </Popover.Content>
      </Popover.Root>
  </div>
</aside>

<style>
  .agent-chat{display:flex;flex-direction:column;min-height:0;min-width:0;width:320px;border-right:1px solid var(--vict-color-border);background:var(--vict-color-surface);color:var(--vict-color-text);overflow:hidden;font-size:12px}
  .agent-footer{display:flex;flex:none;align-items:center;justify-content:space-between;padding:3px 12px 6px;gap:8px}
  :global(.agent-details-trigger){flex:none;height:28px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--vict-color-textMuted);cursor:pointer;padding:3px 8px;width:28px;font-size:20px;line-height:1}
  :global(.agent-details-trigger:hover),:global(.agent-details-trigger[data-state="open"]){background:var(--vict-rhea-muted)}
  :global(.agent-details-trigger:focus-visible),.agent-chat :global(.details-reconnect:focus-visible),.agent-chat :global(.details-heading button:focus-visible){outline:2px solid var(--vict-color-focusRing);outline-offset:2px}
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
  .agent-chat :global(.details-heading button){border:0;background:transparent;color:var(--vict-color-textMuted);font-size:18px;cursor:pointer;line-height:1;padding:2px 4px}
  .agent-chat :global(.details-reconnect){border:1px solid var(--vict-color-border);border-radius:5px;background:var(--vict-color-surface);color:var(--vict-color-accent);padding:5px 8px;font:inherit;cursor:pointer;margin-top:5px}
  .agent-chat :global(.details-reconnect:disabled){opacity:.5;cursor:default}
  .agent-chat :global(.studio-chat-details ol){padding-left:17px;margin:0}.agent-chat :global(.studio-chat-details li){margin:5px 0}
  .agent-chat :global(.studio-chat-details .details-record){font:10px/1.6 ui-monospace,monospace;color:var(--vict-color-textMuted)}
  @media(max-width:760px){.agent-chat{width:100%;height:320px;max-height:46vh;border-right:0;border-bottom:1px solid var(--vict-color-border);flex-shrink:0}.agent-chat :global(.vict-conversation-textarea){min-height:52px;max-height:76px}}
</style>
