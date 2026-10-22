<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Conversation } from '@victframework/ui-svelte';
  import type { UiConversationMessage, UiDocument } from '@victframework/ui';
  import type { AgentCursor, AgentProposal, EditReceipt } from './agent-edits.js';
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
  let status=$state('Checking agent configuration…');
  let model=$state('');let ready=$state(false);let busy=$state(false);let csrf='';let runId='';
  let controller:AbortController|undefined;
  let evidence=$state('');
  let disposed=false;
  function note(message:string){progress=[...progress.slice(-7),message];status=message;}
  async function configure(){
    try{const response=await fetch('/api/designer-agent',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error();csrf=data.csrf;model=data.model;ready=data.ready;status=ready?'Ready to build with you.':'Configure a server-side model and provider key to connect.';}
    catch{ready=false;status='Agent connection unavailable. Sign in again or retry the connection.';}
  }
  onMount(()=>{void configure();});
  const headers=()=>({'content-type':'application/json','x-vict-csrf':csrf});
  async function stop(){
    const id=runId;runId='';controller?.abort();
    if(id)await fetch('/api/designer-agent',{method:'DELETE',headers:headers(),body:JSON.stringify({runId:id})}).catch(()=>undefined);
    if(!disposed)note('Stopped. Applied edits remain on the canvas and in Undo.');
  }
  onDestroy(()=>{disposed=true;void stop();});
  function failedStatus(code:string|undefined,applied:number){
    const effects=applied?`${applied} applied edits remain undoable.`:'No edits were applied.';
    if(code==='STUDIO_AGENT_BUSY')return `Another agent turn is still running in this session. Wait for it to finish, or stop it in its Designer tab, then retry. ${effects}`;
    if(code==='STUDIO_AGENT_CAPACITY')return `The agent server is finishing other turns. Wait a moment and retry. ${effects}`;
    if(code==='STUDIO_AGENT_UNCONFIGURED')return `The agent needs a server-side provider configuration. Reconnect after configuring it. ${effects}`;
    return `${code==='STUDIO_AGENT_PROVIDER_FAILED'?'The provider could not complete this turn. Check the connection and retry.':'The agent stopped before finishing. Check Activity and retry.'} ${effects}`;
  }
  async function send(text:string){
    if(busy)return {ok:false,message:'Wait for this turn or stop it first.'};
    if(blocked)return {ok:false,message:'Apply or cancel your property, data, rename or source draft first.'};
    if(!ready){await configure();if(!ready)return {ok:false,message:'The agent needs a server-side provider configuration. Your request is still here.'};}
    const context=getContext();if(!context)return {ok:false,message:'Open a valid screen before sending.'};
    const history=messages.slice(-12).map(({participant,text})=>({participant:participant==='user'?'user':'assistant',text:text.slice(0,6000)}));
    messages=[...messages,{author:'You',participant:'user',text},{author:'Studio agent',participant:'assistant',text:''}];
    const responseIndex=messages.length-1;
    busy=true;progress=[];evidence='';runId='';controller=new AbortController();let done=false;let sent=false;let applied=0;let lastRefusal='';
    note('Connecting…');
    try{
      const response=await fetch('/api/designer-agent',{method:'POST',headers:headers(),signal:controller.signal,body:JSON.stringify({...context,prompt:text,history})});
      if(!response.ok || !response.body)throw new Error('connection');
      const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';
      try{
        while(true){
          const chunk=await reader.read();if(chunk.done)break;
          buffer+=decoder.decode(chunk.value,{stream:true});if(buffer.length>256_000)throw new Error('stream');
          let newline:number;
          while((newline=buffer.indexOf('\n'))>=0){
            const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(!line.trim())continue;
            const event=JSON.parse(line);
            if(event.type==='started'){sent=true;runId=event.runId;model=event.model;note(`Connected · ${event.engine}`);}
            if(event.type==='progress')note(event.message);
            if(event.type==='text')messages=messages.map((message,index)=>index===responseIndex?{...message,text:(message.text+event.delta).slice(0,100_000)}:message);
            if(event.type==='proposal'){
              const receipt=controller.signal.aborted?{ok:false as const,code:'STUDIO_AGENT_CANCELLED',message:'The agent was stopped.'}:applyProposal(event.proposal);
              lastRefusal=receipt.ok?'':receipt.message;
              if(receipt.ok){applied++;note('Validated edit applied · available in Undo');}else note(receipt.message);
              const ack=await fetch('/api/designer-agent/ack',{method:'POST',headers:headers(),signal:controller.signal,body:JSON.stringify({runId,proposalId:event.proposal.proposalId,receipt})});
              if(!ack.ok)throw new Error('ack');
            }
            if(event.type==='edit-result'){lastRefusal=event.result.ok?'':event.result.message;note(event.result.ok?`${event.reason} · applied`:event.result.message);}
            if(event.type==='done'){
              done=true;applied=Math.max(applied,event.applied??0);
              status=event.status==='completed'?(lastRefusal?`${lastRefusal} ${applied?`${applied} earlier edits remain undoable.`:''}`:`Finished · ${applied} edit${applied===1?'':'s'} applied · save when ready.`):event.status==='cancelled'?`Stopped · ${applied} applied edits remain undoable.`:failedStatus(event.code,applied);
              evidence=[event.turnId?`VICT turn ${event.turnId} · profile ${event.profileVersion}`:'',event.code??''].filter(Boolean).join(' · ');
              if(!messages[responseIndex]?.text)messages=messages.map((message,index)=>index===responseIndex?{...message,text:status}:message);
            }
          }
        }
      }finally{reader.releaseLock();}
      if(!done)throw new Error('incomplete');
      return sent?true:{ok:false,message:status};
    }catch{
      if(!disposed){note(controller.signal.aborted?`Stopped · ${applied} applied edits remain undoable.`:`Connection interrupted · ${applied} edits applied locally. Inspect the canvas before retrying; Undo is available.`);if(!messages[responseIndex]?.text)messages=messages.map((message,index)=>index===responseIndex?{...message,text:status}:message);}
      return sent?true:{ok:false,message:'The request could not reach the agent. Your draft is still here.'};
    }finally{const unfinished=runId;runId='';busy=false;if(unfinished&&!done)void fetch('/api/designer-agent',{method:'DELETE',headers:headers(),body:JSON.stringify({runId:unfinished})}).catch(()=>undefined);}
  }
</script>

<aside class="agent-chat" aria-label="Studio agent">
  <header><div><h2>Studio agent</h2><p>{model || 'VICT / Mastra'}</p></div>{#if busy}<button type="button" onclick={()=>void stop()}>Stop</button>{:else}<button type="button" onclick={()=>void configure()} aria-label="Reconnect agent">↻</button>{/if}</header>
  <div class="agent-context"><span title={screenLabel}>{screenLabel}</span><strong title={selectionLabel}>Selected: {selectionLabel}</strong></div>
  <Conversation surfaceId="studio-agent" {messages} emptyMessage="Describe the screen you want to make. Try “Create a registration form with name, email and password.” Select an element to ask for a focused change." inputLabel="Message Studio agent" inputPlaceholder="Build a screen or edit the selection…" onSend={send}/>
  <div class="agent-status" role="status" aria-live="polite">{status}</div>
  {#if blocked}<p class="agent-draft-note">Apply or cancel the current draft before asking the agent to edit.</p>{/if}
  {#if !ready}<p class="agent-setup">On the Studio server, set <code>STUDIO_AGENT_MODEL</code> and the matching provider key (OpenAI, Anthropic, OpenRouter, Ollama Cloud or z.ai), then restart. Keys stay on the server.</p>{/if}
  {#if progress.length}<details class="agent-progress"><summary>Activity ({progress.length})</summary><ol>{#each progress as message}<li>{message}</li>{/each}</ol></details>{/if}
  {#if evidence}<details class="agent-progress"><summary>Connection record</summary><p>{evidence}</p></details>{/if}
  <p class="agent-footnote">Edits share your history. Save explicitly. Form actions remain local preview. Chat clears when you leave Designer.</p>
</aside>

<style>
  .agent-chat{display:flex;flex-direction:column;min-height:0;min-width:0;width:320px;border-right:1px solid #e0e5ee;background:#fff;color:#263246;overflow:auto;font-size:12px}
  header{display:flex;align-items:center;justify-content:space-between;padding:15px 14px 10px;gap:8px}h2{font-size:13px;margin:0}header p{font-size:10px;color:#78869c;margin:4px 0 0;overflow-wrap:anywhere}button{border:1px solid #dce2eb;border-radius:5px;padding:4px 8px;background:#fff;color:#5269bd}
  .agent-context{display:flex;flex-direction:column;gap:4px;background:#f5f7fb;padding:9px 14px;font-size:11px}.agent-context span,.agent-context strong{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.agent-context strong{font-weight:500;color:#67758b}
  .agent-chat :global(.vict-conversation-panel){flex:1;display:flex;flex-direction:column;min-height:200px;padding:12px 14px 4px;gap:12px}.agent-chat :global(.vict-conversation){flex:1;max-height:none;min-height:100px;padding:0}.agent-chat :global(.vict-conversation-message){padding:9px;margin-bottom:8px;overflow-wrap:anywhere}.agent-chat :global(.vict-conversation-body){white-space:pre-wrap;font-size:12px}.agent-chat :global(.vict-conversation-meta){font-size:10px}.agent-chat :global(.vict-conversation-input-row){display:flex;gap:6px}.agent-chat :global(.vict-input){min-width:0;width:100%;font-size:12px}.agent-chat :global(.vict-btn){font-size:11px;padding:6px 9px}.agent-chat :global(.vict-field-label){font-size:11px}.agent-chat :global(.vict-state){font-size:12px;line-height:1.7;background:transparent;padding:5px 0}.agent-chat :global(.vict-send-error:empty){display:none}
  .agent-status{margin:4px 14px 7px;font-size:11px;line-height:1.5;color:#5269bd;overflow-wrap:anywhere}.agent-setup,.agent-draft-note{margin:4px 14px 8px;font-size:11px;line-height:1.6;color:#6a7690}.agent-setup code{font-size:10px;overflow-wrap:anywhere}.agent-progress{margin:3px 14px 7px;font-size:11px;color:#6a7690}.agent-progress p,.agent-progress li{overflow-wrap:anywhere;line-height:1.5}.agent-progress ol{padding-left:17px}.agent-footnote{margin:8px 14px 12px;font-size:10px;line-height:1.5;color:#8a94a6}
  @media(max-width:760px){.agent-chat{width:100%;height:320px;max-height:45vh;border-right:0;border-bottom:1px solid #e0e5ee;flex-shrink:0}.agent-chat :global(.vict-conversation-panel){min-height:110px}.agent-context,.agent-footnote{display:none}header{padding:8px 14px}.agent-progress{display:none}}
</style>
