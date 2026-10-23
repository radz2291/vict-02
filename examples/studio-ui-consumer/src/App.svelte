<script lang="ts">
  import { Conversation, PatternShowcase, type ConversationMessage } from '@victframework/ui-ai-svelte';
  import { FlowCanvas, addEdge, type Node, type Edge, type Connection } from '@victframework/ui-flow-svelte';
  import '@victframework/ui-ai-svelte/styles.css';
  import '@victframework/ui-flow-svelte/styles.css';
  let messages=$state<ConversationMessage[]>([{id:'welcome',role:'assistant',text:'This is a **packed-package consumer**.\n\nSend a message to test streaming and Stop. This showcase uses a deterministic presentation fixture, with no provider or application effects.'}]);
  let busy=$state(false), generation=0;
  let nodes=$state<Node[]>([
    {id:'start',position:{x:30,y:70},data:{label:'Source'},type:'input'},
    {id:'view',position:{x:290,y:170},data:{label:'View'}},
    {id:'output',position:{x:550,y:70},data:{label:'Output'},type:'output'},
  ]);
  let edges=$state<Edge[]>([{id:'source-view',source:'start',target:'view'}]);
  let feedback=$state('Drag a handle to connect nodes. These edges have presentation meaning only.');
  function connect(connection:Connection){edges=addEdge(connection,edges);feedback=`Connected ${connection.source} to ${connection.target}.`;}
  function stop(){generation++;busy=false;}
  async function send(text:string){
    const run=++generation;busy=true;
    const id=crypto.randomUUID();messages=[...messages,{id:crypto.randomUUID(),role:'user',text},{id,role:'assistant',text:'',activity:[{id:'fixture',title:'Presentation fixture',state:'running'}]}];
    const reply='This reply streams from a local fixture. **No backend action was performed.**\n\n```ts\nimport { Conversation } from "@victframework/ui-ai-svelte";\n```\n\nYour host supplies messages, lifecycle state and callbacks.';
    for(const chunk of reply.match(/.{1,5}|\n/g)??[]){if(run!==generation)break;messages=messages.map(m=>m.id===id?{...m,text:m.text+chunk}:m);await new Promise(r=>setTimeout(r,20));}
    messages=messages.map(m=>m.id===id?{...m,activity:[{id:'fixture',title:run===generation?'Fixture finished':'Fixture stopped',state:run===generation?'completed':'failed'}]}:m);
    if(run===generation)busy=false;return true;
  }
</script>
<svelte:head><title>VICT reusable UI showcase</title></svelte:head>
<main>
  <header><p>VICT UI / Cycle 1.3</p><h1>Conversation and structure</h1><p>Public packages in a small standalone consumer. Demonstrations are simulated; they do not call an agent or execute workflows.</p></header>
  <div class="surfaces"><section aria-label="Conversation showcase" class="chat"><Conversation {messages} {busy} title="New Thread" description="Local streaming presentation fixture" onReset={()=>{generation++;busy=false;messages=[];}} onSend={send} onStop={busy?stop:undefined}/></section>
  <section aria-label="Node showcase"><h2>Node canvas</h2><p>{feedback}</p><div class="flow"><FlowCanvas bind:nodes bind:edges onconnect={connect} fitView aria-label="Reusable node canvas"/></div></section></div>
  <section class="patterns"><h2>All 21 AI Elements patterns</h2><PatternShowcase/></section>
  <section class="isolation"><h2>Unrelated host content</h2><button id="unrelated-button">Native host button</button><p>This area is outside the AI CSS scope.</p></section>
</main>
<style>
 :global(body){margin:0;font:15px/1.5 system-ui,sans-serif;background:#f4f6fa;color:#172033}
 main{max-width:1440px;margin:auto;padding:32px}header{max-width:780px}header>p:first-child{text-transform:uppercase;letter-spacing:.12em;font-size:12px;color:#566580}h1{font-size:36px;letter-spacing:-.04em;margin:8px 0}h2{font-size:18px}.surfaces{display:grid;grid-template-columns:minmax(280px,400px) minmax(0,1fr);gap:24px;margin-top:28px}.surfaces>section{background:white;border:1px solid #dce2ea;border-radius:16px;overflow:hidden}.surfaces>section:not(.chat){padding:20px}.chat{height:620px}.flow{height:480px;min-width:0}.isolation{margin-top:24px}@media(max-width:800px){main{padding:16px}.surfaces{grid-template-columns:1fr}.chat{height:520px}.flow{height:380px}}
</style>
