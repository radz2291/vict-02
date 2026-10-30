<script lang="ts">
  import { Conversation, PatternShowcase, PrimitiveShowcase, type ConversationMessage } from '@victframework/ui-ai-svelte';
  import catalog from './cycle13-catalog.json';
  import { FlowCanvas, layoutGraph, addEdge, type Node, type Edge, type Connection } from '@victframework/ui-flow-svelte';
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
  let recipeSearch=$state('');
  const filteredRecipes=$derived(catalog.filter(recipe=>`${recipe.label} ${recipe.description} ${recipe.category}`.toLowerCase().includes(recipeSearch.toLowerCase())));
  function connect(connection:Connection){edges=addEdge(connection,edges);feedback=`Connected ${connection.source} to ${connection.target}.`;}
  async function arrange(){const result=await layoutGraph(nodes,edges,{engine:'elk',direction:'RIGHT'});nodes=result.nodes;edges=result.edges;feedback='Measured layout from the installed public package. Presentation only.';}
  const orderedFixture:ConversationMessage[]=[{id:'ordered-fixture',role:'assistant',text:'Simulated ordered attempt fixture.',events:[
    {id:'before',kind:'text',text:'Simulated attempt: inspect the source.'},
    {id:'refused',kind:'activity',activity:{id:'refused',title:'Validation refused',state:'failed',detail:'Fixture only: operations.0.prop needs a declared property.'}},
    {id:'correction',kind:'text',text:'Simulated correction follows the refusal.'},
    {id:'receipt',kind:'activity',activity:{id:'receipt',title:'Simulated receipt acknowledged',state:'completed',detail:'No real source was edited by this package example.'}},
    {id:'cancelled',kind:'activity',activity:{id:'cancelled',title:'Simulated observation stopped',state:'cancelled',detail:'A stopped attempt has no confirmed observation. This is a presentation fixture.'}},
  ]}];
  function stop(){generation++;busy=false;}
  async function send(text:string){
    const run=++generation;busy=true;
    const id=crypto.randomUUID();messages=[...messages,{id:crypto.randomUUID(),role:'user',text},{id,role:'assistant',text:'',activity:[{id:'fixture',title:'Presentation fixture',state:'running'}]}];
    const reply='This reply streams from a local fixture. **No backend action was performed.**\n\n```ts\nimport { Conversation } from "@victframework/ui-ai-svelte";\n```\n\nYour host supplies messages, lifecycle state and callbacks.';
    for(const chunk of reply.match(/.{1,5}|\n/g)??[]){if(run!==generation)break;messages=messages.map(m=>m.id===id?{...m,text:m.text+chunk}:m);await new Promise(r=>setTimeout(r,20));}
    messages=messages.map(m=>m.id===id?{...m,activity:[{id:'fixture',title:run===generation?'Fixture finished':'Fixture stopped',state:run===generation?'completed':'cancelled'}]}:m);
    if(run===generation)busy=false;return true;
  }
</script>
<svelte:head><title>VICT reusable UI showcase</title></svelte:head>
<main>
  <header><p>VICT UI / Cycle 1.3</p><h1>Conversation and structure</h1><p>Public packages in a small standalone consumer. Demonstrations are simulated; they do not call an agent or execute workflows.</p></header>
  <nav class="showcase-nav" aria-label="Cycle 1.3 showcase sections"><a href="#ai-patterns">21 AI patterns</a><a href="#building-blocks">UI building blocks</a><a href="#flow">Node canvas</a><a href="#studio-recipes">83 Studio recipes</a><a href="http://127.0.0.3:5596/showcase" target="_blank" rel="noopener noreferrer">Complete Studio UI showcase ↗</a></nav>
  <div class="surfaces"><section aria-label="Conversation showcase" class="chat"><Conversation {messages} {busy} title="New Thread" description="Local streaming presentation fixture" onReset={()=>{generation++;busy=false;messages=[];}} onSend={send} onStop={busy?stop:undefined}/></section>
  <section id="flow" aria-label="Node showcase"><h2>Node canvas</h2><p>{feedback}</p><button onclick={arrange}>Arrange with public layout</button><div class="flow"><FlowCanvas bind:nodes bind:edges onconnect={connect} fitView aria-label="Reusable node canvas"/></div></section></div>
  <section class="chat" style="height:500px;margin-top:24px" aria-label="Ordered timeline fixture"><Conversation messages={orderedFixture} onSend={async()=>({ok:false,message:'Simulated presentation fixture only.'})}/></section>
  <section id="ai-patterns" class="patterns"><h2>All 21 AI Elements patterns</h2><PatternShowcase/></section>
  <section id="building-blocks" class="patterns"><h2>Shared UI building blocks</h2><PrimitiveShowcase/></section>
  <section id="studio-recipes" class="recipe-index" aria-label="All Cycle 1.3 Studio recipes">
    <h2>All 83 Studio recipes and editing controls</h2>
    <p>Open any recipe in the isolated Studio showcase to try its actual preview, properties, connections, source structure and history. Studio examples require your Studio login and use separate in-memory demo documents.</p>
    <p><a href="http://127.0.0.3:5596/showcase#designer" target="_blank" rel="noopener noreferrer">Open the complete Studio editing showcase ↗</a></p>
    <label>Find a component <input type="search" bind:value={recipeSearch} placeholder="Slider, Tabs, Select…"/></label>
    <p>{filteredRecipes.length} of {catalog.length} recipes</p>
    <ul>{#each filteredRecipes as recipe (recipe.id)}<li data-showcase-recipe={recipe.id}><a href={`http://127.0.0.3:5596/showcase?recipe=${encodeURIComponent(recipe.id)}#designer`} target="_blank" rel="noopener noreferrer"><strong>{recipe.label}</strong><span>{recipe.description}</span><small>{recipe.category}</small></a></li>{/each}</ul>
  </section>
  <section class="isolation"><h2>Unrelated host content</h2><button id="unrelated-button">Native host button</button><p>This area is outside the AI CSS scope.</p></section>
</main>
<style>
 :global(body){margin:0;font:15px/1.5 system-ui,sans-serif;background:#f4f6fa;color:#172033}
 main{max-width:1440px;margin:auto;padding:32px}header{max-width:780px}header>p:first-child{text-transform:uppercase;letter-spacing:.12em;font-size:12px;color:#566580}h1{font-size:36px;letter-spacing:-.04em;margin:8px 0}h2{font-size:18px}.surfaces{display:grid;grid-template-columns:minmax(280px,400px) minmax(0,1fr);gap:24px;margin-top:28px}.surfaces>section{background:white;border:1px solid #dce2ea;border-radius:16px;overflow:hidden}.surfaces>section:not(.chat){padding:20px}.chat{height:620px}.flow{height:480px;min-width:0}.isolation{margin-top:24px}@media(max-width:800px){main{padding:16px}.surfaces{grid-template-columns:1fr}.chat{height:520px}.flow{height:380px}}
 .showcase-nav{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px}.showcase-nav a{color:#3046a5}.recipe-index{margin-top:32px;background:white;border:1px solid #dce2ea;border-radius:16px;padding:20px}.recipe-index ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:10px}.recipe-index li a{display:flex;flex-direction:column;gap:6px;padding:12px;border:1px solid #dce2ea;border-radius:10px;color:inherit;text-decoration:none}.recipe-index li a:hover{background:#f4f6fa}.recipe-index small{color:#566580}.recipe-index input{font:inherit;padding:8px;border:1px solid #dce2ea;border-radius:8px;max-width:100%;box-sizing:border-box}
</style>
