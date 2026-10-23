<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Conversation, conversationMessages, type ConversationActivity } from '@victframework/ui-ai-svelte';
  import '@victframework/ui-ai-svelte/styles.css';
  import { Popover } from '@victframework/ui-svelte/primitives';
  import type { UiConversationMessage, UiDocument } from '@victframework/ui';
  import type { AgentCursor, AgentProposal, EditFailure, EditReceipt } from './agent-edits.js';
  interface Props {
    screenLabel:string;
    selectionLabel:string;
    getContext:()=>{document:UiDocument;cursor:AgentCursor;selection?:string}|undefined;
    applyProposal:(proposal:AgentProposal)=>EditReceipt;
    blocked:boolean;
  }
  let {screenLabel,selectionLabel,getContext,applyProposal,blocked}:Props=$props();
  let messages=$state<UiConversationMessage[]>([]);
  let progress=$state<string[]>([]);
  let activities=$state<Record<string, ConversationActivity[]>>({});
  const presentedMessages=$derived(conversationMessages(messages).map(message=>({...message,activity:activities[message.id]})));
  let status=$state('Checking agent configuration…');
  let model=$state('');let ready=$state(false);let busy=$state(false);let csrf='';
  interface LocalTurn {controller:AbortController;runId:string;applied:number;cancelled:boolean;refusal?:EditFailure;}
  let activeTurn:LocalTurn|undefined;
  let evidence=$state('');
  let disposed=false;
  let panel=$state<HTMLElement>();
  let detailsBoundary=$state<HTMLElement>();
  let detailsAnchor=$state<HTMLFormElement>();
  let failed=$state(false);
  function note(message:string){progress=[...progress.slice(-7),message];status=message;}
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
    if(!disposed){failed=false;note(`Stopped. ${appliedEffects(turn.applied)}`);}
  }
  onDestroy(()=>{disposed=true;void stop();});
  function failedStatus(code:string|undefined,applied:number){
    const effects=appliedEffects(applied);
    if(code==='STUDIO_AGENT_BUSY')return `Another agent turn is still running in this session. Wait for it to finish, or stop it in its Designer tab, then retry. ${effects}`;
    if(code==='STUDIO_AGENT_CAPACITY')return `The agent server is finishing other turns. Wait a moment and retry. ${effects}`;
    if(code==='STUDIO_AGENT_UNCONFIGURED')return `The agent needs a server-side provider configuration. Reconnect after configuring it. ${effects}`;
    if(code==='STUDIO_AGENT_OUTPUT_LIMIT')return `The agent's response was cut off. Retry with a smaller change. ${effects}`;
    if(code==='STUDIO_AGENT_INCOMPLETE_TOOL')return `The agent returned an invalid or incomplete edit. Retry the change. ${effects}`;
    if(code==='STUDIO_AGENT_TOOL_FAILED')return `The agent could not complete an edit. Check Chat details and retry. ${effects}`;
    if(code==='UI_DOC_STALE_REVISION')return `The screen changed during this turn. Send a new request. ${effects}`;
    if(code==='STUDIO_AGENT_DRAFT')return `Apply or cancel the current draft, then send a new request. ${effects}`;
    return `${code==='STUDIO_AGENT_PROVIDER_FAILED'?'The provider could not complete this turn. Check the connection and retry.':'The agent stopped before finishing. Check Chat details and retry.'} ${effects}`;
  }
  async function send(text:string){
    if(busy)return {ok:false,message:'Wait for this turn or stop it first.'};
    if(blocked)return {ok:false,message:'Apply or cancel your property, data, rename or source draft first.'};
    if(!ready){await configure();if(!ready)return {ok:false,message:'The agent needs a server-side provider configuration. Your request is still here.'};}
    const context=getContext();if(!context)return {ok:false,message:'Open a valid screen before sending.'};
    const history=messages.slice(-12).map(({participant,text})=>({participant:participant==='user'?'user':'assistant',text:text.slice(0,6000)}));
    messages=[...messages,{author:'You',participant:'user',text},{author:'Assistant',participant:'assistant',text:''}];
    const responseIndex=messages.length-1;
    const turn:LocalTurn={controller:new AbortController(),runId:'',applied:0,cancelled:false};activeTurn=turn;
    busy=true;failed=false;progress=[];evidence='';let done=false;let sent=false;let lastRefusal='';let separateReply=false;
    note('Connecting…');
    try{
      const response=await fetch('/api/designer-agent',{method:'POST',headers:headers(),signal:turn.controller.signal,body:JSON.stringify({...context,prompt:text,history})});
      if(!response.ok || !response.body)throw new Error('connection');
      const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';
      try{
        while(true){
          const chunk=await reader.read();
          if(turn.controller.signal.aborted)throw new Error('stopped');
          if(chunk.done)break;
          buffer+=decoder.decode(chunk.value,{stream:true});if(buffer.length>256_000)throw new Error('stream');
          let newline:number;
          while((newline=buffer.indexOf('\n'))>=0){
            if(turn.controller.signal.aborted)throw new Error('stopped');
            const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(!line.trim())continue;
            const event=JSON.parse(line);
            if(event.type==='started'){sent=true;turn.runId=event.runId;model=event.model;note('Reading screen…');}
            if(event.type==='progress'){note(event.message);separateReply=true;}
            if(event.type==='text'){
              messages=messages.map((message,index)=>index===responseIndex?{...message,text:(message.text+(separateReply&&message.text?'\n\n':'')+event.delta).slice(0,100_000)}:message);
              separateReply=false;
            }
            if(event.type==='proposal'){
              const receipt=applyProposal(event.proposal);
              const messageId=`message-${responseIndex}`;
              activities={...activities,[messageId]:[...(activities[messageId]??[]),{id:event.proposal.proposalId,title:event.proposal.edit.reason,state:receipt.ok?'completed':'failed',detail:receipt.ok?'Committed to the screen. Undo is available.':receipt.message}]};
              lastRefusal=receipt.ok?'':receipt.message;
              if(receipt.ok){turn.applied++;status='Applying edit…';}else {turn.refusal=receipt;failed=true;note(receipt.message);}
              separateReply=true;
              const ack=await fetch('/api/designer-agent/ack',{method:'POST',headers:headers(),signal:turn.controller.signal,body:JSON.stringify({runId:turn.runId,proposalId:event.proposal.proposalId,receipt})});
              // The host fences every browser refusal. Acknowledge it, then end
              // this turn so only a new user request can capture refreshed context.
              if(!receipt.ok){cancelTransport(turn);throw new Error('canvas-refused');}
              if(!ack.ok)throw new Error('ack');
            }
            if(event.type==='edit-result'){lastRefusal=event.result.ok?'':event.result.message;note(event.result.ok?`${event.reason} · applied`:event.result.message);separateReply=true;}
            if(event.type==='done'){
              done=true;turn.applied=Math.max(turn.applied,event.applied??0);
              const applied=turn.applied;
              failed=event.status==='failed'||Boolean(lastRefusal);
              status=event.status==='completed'?(lastRefusal?`${lastRefusal} ${applied?`${applied} earlier edits remain undoable.`:''}`:`${applied} edit${applied===1?'':'s'} applied`):event.status==='cancelled'?`Stopped · ${applied} applied edits remain undoable.`:failedStatus(event.code,applied);
              evidence=[event.turnId?`VICT turn ${event.turnId} · profile ${event.profileVersion}`:'',event.code??''].filter(Boolean).join(' · ');
              if(!messages[responseIndex]?.text)messages=messages.map((message,index)=>index===responseIndex?{...message,text:status}:message);
            }
          }
        }
      }finally{reader.releaseLock();}
      if(!done)throw new Error('incomplete');
      return sent?true:{ok:false,message:status};
    }catch{
      if(!disposed && activeTurn===turn){
        failed=!turn.cancelled;
        const refusal=turn.refusal;
        note(turn.cancelled?`Stopped. ${appliedEffects(turn.applied)}`:refusal?`${refusal.message}${refusal.message.includes('new request')?'':' Send a new request using the current screen.'}${turn.applied?` ${appliedEffects(turn.applied)}`:''}`:`Connection interrupted · ${turn.applied} edits applied locally. Inspect the canvas before retrying; Undo is available.`);
        if(!messages[responseIndex]?.text)messages=messages.map((message,index)=>index===responseIndex?{...message,text:status}:message);
      }
      return sent?true:{ok:false,message:turn.cancelled?'Stopped before the request was admitted. Your draft is still here.':'The request could not reach the agent. Your draft is still here.'};
    }finally{if(!done)cancelTransport(turn);if(activeTurn===turn){activeTurn=undefined;busy=false;}}
  }
</script>

<aside class="agent-chat" aria-label="Chat" bind:this={panel}>
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
          {#if progress.length}<h4>Recent activity</h4><ol>{#each progress as message}<li>{message}</li>{/each}</ol>{/if}
          {#if evidence}<h4>Connection record</h4><p class="details-record">{evidence}</p>{/if}
        </Popover.Content>
      </Popover.Root>
  </div>
</aside>

<style>
  .agent-chat{display:flex;flex-direction:column;min-height:0;min-width:0;width:320px;border-right:1px solid #e0e5ee;background:#fff;color:#263246;overflow:hidden;font-size:12px}
  .agent-footer{display:flex;flex:none;align-items:center;justify-content:space-between;padding:3px 12px 6px;gap:8px}
  :global(.agent-details-trigger){flex:none;height:28px;border:1px solid transparent;border-radius:5px;background:transparent;color:#63718a;cursor:pointer;padding:3px 8px;width:28px;font-size:20px;line-height:1}
  :global(.agent-details-trigger:hover),:global(.agent-details-trigger[data-state="open"]){background:#f0f3f8}
  .agent-chat :global(.vict-ai-conversation){flex:1;min-height:0;height:auto}
  .agent-status{flex:1;min-width:0;display:flex;align-items:flex-start;gap:6px;margin:0;color:#748098;font-size:10px;line-height:1.5;min-height:15px;overflow-wrap:anywhere}
  .agent-status>span:last-child{display:-webkit-box;line-clamp:2;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .status-dot{flex:none;width:5px;height:5px;border-radius:50%;background:#a2b0c0;margin-top:5px}.status-dot--busy{background:#5874bb}.agent-status--failed{color:#9a5547}.agent-status--failed .status-dot{background:#b87865}
  /* Own this surface over the catalog's generic ControlScope popover recipe. */
  .agent-chat :global(.studio-chat-details[data-popover-content]){display:block;gap:0;z-index:50;width:280px;min-width:0;max-width:min(280px,var(--bits-floating-available-width,calc(100vw - 32px)));max-height:min(320px,var(--bits-floating-available-height,320px));overflow:auto;overscroll-behavior:contain;box-sizing:border-box;border:1px solid #dce2eb;border-radius:8px;background:#fff;padding:12px;color:#526078;box-shadow:0 8px 24px #24334c1c;font:11px/1.6 'Segoe UI',system-ui,sans-serif;overflow-wrap:anywhere}
  .agent-chat :global(.studio-chat-details h3){font-size:12px;margin:0;color:#263246}
  .agent-chat :global(.studio-chat-details h4){font-size:10px;font-weight:600;margin:14px 0 5px;color:#7a8598}
  .agent-chat :global(.studio-chat-details p){margin:6px 0;color:inherit}
  .agent-chat :global(.studio-chat-details .details-model){font-size:10px;color:#7a8598}
  .agent-chat :global(.details-heading){display:flex;align-items:center;justify-content:space-between}
  .agent-chat :global(.details-heading button){border:0;background:transparent;color:#718098;font-size:18px;cursor:pointer;line-height:1;padding:2px 4px}
  .agent-chat :global(.details-reconnect){border:1px solid #dce2eb;border-radius:5px;background:#fff;color:#5269a2;padding:5px 8px;font:inherit;cursor:pointer;margin-top:5px}
  .agent-chat :global(.details-reconnect:disabled){opacity:.5;cursor:default}
  .agent-chat :global(.studio-chat-details ol){padding-left:17px;margin:0}.agent-chat :global(.studio-chat-details li){margin:5px 0}
  .agent-chat :global(.studio-chat-details .details-record){font:10px/1.6 ui-monospace,monospace;color:#788398}
  @media(max-width:760px){.agent-chat{width:100%;height:320px;max-height:46vh;border-right:0;border-bottom:1px solid #e0e5ee;flex-shrink:0}.agent-chat :global(.vict-conversation-textarea){min-height:52px;max-height:76px}}
</style>
