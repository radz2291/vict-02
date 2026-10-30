<script lang="ts">
  import { Conversation, type ConversationMessage } from '@victframework/ui-ai-svelte';
  const messages:ConversationMessage[]=[
    {id:'example-user',role:'user',text:'Review the layout without changing it.'},
    {id:'example-assistant',role:'assistant',text:'I’ll check the current layout.\n\nThe page has a heading and an email field. No changes were made.',events:[
      {id:'example-intro',kind:'text',text:'I’ll check the current layout.'},
      {id:'example-call',kind:'activity',activity:{id:'example-call',title:'Read screen',state:'completed',input:{text:'{\n  "query": "nodes",\n  "offset": 0\n}'},result:{text:'{\n  "ok": true,\n  "nodes": ["Heading", "Email input"]\n}'}}},
      {id:'example-answer',kind:'text',text:'The page has a heading and an email field. No changes were made.'},
    ]},
  ];
</script>
<section id="quiet-chat" aria-label="Quiet Chat presentation example">
  <h3>Quiet Chat · SIMULATED</h3>
  <p>This is a presentation example, not a real agent turn. Open Read screen to see the example Input and Result. Actual mechanical measurements remain in Studio’s Chat details.</p>
  <div class="chat-example"><Conversation {messages} onSend={async()=>({ok:false,message:'This example does not send requests. Try Chat in Studio.'})}/></div>
</section>
<style>
  section{margin:24px 0}h3{font-size:14px;font-weight:500}p{font-size:12px;color:var(--vict-color-textMuted);max-width:70ch;line-height:1.6}
  .chat-example{max-width:440px;height:500px;border:1px solid var(--vict-color-border);border-radius:8px;overflow:hidden;background:var(--vict-color-surface)}
</style>
