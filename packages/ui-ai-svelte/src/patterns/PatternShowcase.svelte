<script lang="ts">
  import {aiElementPatterns, type Step} from './types.js';
  import Conversation from '../Conversation.svelte';
  import TraceSteps from './TraceSteps.svelte';
  import Checkpoint from './Checkpoint.svelte';
  import Confirmation from './Confirmation.svelte';
  import Context from './Context.svelte';
  import FileTree from './FileTree.svelte';
  import InlineCitation from './InlineCitation.svelte';
  import Message from './Message.svelte';
  import ModelSelector from './ModelSelector.svelte';
  import PromptInput from './PromptInput.svelte';
  import Queue from './Queue.svelte';
  import Reasoning from './Reasoning.svelte';
  import Sources from './Sources.svelte';
  import StackTrace from './StackTrace.svelte';
  import Subagent from './Subagent.svelte';
  import Suggestion from './Suggestion.svelte';
  import Terminal from './Terminal.svelte';
  import TestResults from './TestResults.svelte';
  import Tool from './Tool.svelte';
  const steps:Step[]=[{id:'read',title:'Inspect source',status:'done',detail:'Fixture only: stable screen identity found.'},{id:'validate',title:'Validate requested edit',status:'running'},{id:'commit',title:'Commit canonical command',status:'pending'}];
  const source={id:'docs',title:'VICT framework',url:'https://github.com/radz2291/vict-02',excerpt:'Host-supplied citation. This example does not fetch the source.'};
  let lastAction=$state('No simulated action yet.');
  let model=$state('example-model');
  let effort=$state('medium');
  let prompt=$state('');
</script>
<section class="vict-ai" aria-label="AI Elements complete pattern gallery">
  <h2>All 21 AI Elements patterns</h2>
  <p>Presentation fixtures only. Buttons below update this local example; they do not approve, execute, restore, upload, or select a provider.</p>
  <p role="status">{lastAction}</p>
  <div class="grid gap-4 md:grid-cols-2">
  {#each aiElementPatterns as pattern (pattern)}
    <article class="min-w-0 rounded-2xl border border-border bg-background p-4" data-ai-pattern={pattern}>
      <h3 class="mb-4 font-medium">{pattern}</h3>
      {#if pattern==='chat'}<div style="height:320px"><Conversation messages={[{id:'fixture-user',role:'user',text:'Describe the selected screen.'},{id:'fixture-assistant',role:'assistant',text:'This is a **presentation fixture** with a `screen-1` identity.'}]} onSend={async()=>{lastAction='Simulated chat submit; no provider contacted.';return true;}}/></div>
      {:else if pattern==='chain-of-thought'||pattern==='plan'||pattern==='task'}<TraceSteps title={pattern==='chain-of-thought'?'Public activity summary':pattern==='plan'?'Proposed steps':'Observed tasks'} {steps}/>
      {:else if pattern==='checkpoint'}<Checkpoint label="Before the layout change" onRestore={()=>lastAction='Simulated checkpoint request; no document restored.'}/>
      {:else if pattern==='confirmation'}<Confirmation title="Apply the prepared change?" description="Fixture request only; production requires a host-owned approval identity and authorization." onDecision={(approved)=>lastAction=`Simulated ${approved?'approval':'denial'}; no authority changed.`}/>
      {:else if pattern==='context'}<Context used={4200} limit={32000}/>
      {:else if pattern==='file-tree'}<FileTree nodes={[{path:'screens',name:'screens',children:[{path:'screens/home',name:'Home screen'},{path:'screens/settings',name:'Settings screen'}]}]} onSelect={(path)=>lastAction=`Simulated source selection: ${path}`}/>
      {:else if pattern==='inline-citation'}<p>This design uses a canonical source. <InlineCitation {source}/></p>
      {:else if pattern==='message'}<Message role="assistant" text={"Streamed **Markdown**, a list, and code:\n\n- Source identity\n- Validated commands\n\n```ts\nconst screen = 'screen-1';\n```"} onCopy={()=>lastAction='Simulated message action; fixture only.'}/>
      {:else if pattern==='model-selector'}<ModelSelector models={[{id:'example-model',label:'Example model'},{id:'other-example',label:'Other example'}]} {model} onModelChange={(value)=>{model=value;lastAction='Example model changed locally; server configuration unchanged.';}} efforts={[{id:'low',label:'Low'},{id:'medium',label:'Medium'}]} {effort} onEffortChange={(value)=>effort=value}/>
      {:else if pattern==='prompt-input'}<PromptInput bind:value={prompt} attachments={[{id:'fixture',name:'example.txt (fixture)'}]} onRemoveAttachment={()=>lastAction='Simulated attachment removal; no upload exists.'} onSend={(text)=>lastAction=`Simulated prompt: ${text}`}/>
      {:else if pattern==='queue'}<Queue {steps}/>
      {:else if pattern==='reasoning'}<Reasoning text="The host may expose a **safe summary** of observed activity. Private model reasoning is not required or inferred."/>
      {:else if pattern==='sources'}<Sources sources={[source]}/>
      {:else if pattern==='stack-trace'}<StackTrace frames={'ValidationError: fixture only\n  at validate (example.ts:12)\n  at apply (example.ts:24)'}/>
      {:else if pattern==='subagent'}<Subagent title="Layout reviewer (fixture)" {steps} result="Example finding: preserve stable source IDs."/>
      {:else if pattern==='suggestion'}<Suggestion text="Explain this screen" onSelect={(text)=>lastAction=`Simulated suggestion: ${text}`}/>
      {:else if pattern==='terminal'}<Terminal command="npm run check (fixture)" output="Fixture: type check completed. This command was not executed."/>
      {:else if pattern==='test-results'}<TestResults suites={[{id:'valid',title:'Accepted source',status:'done'},{id:'invalid',title:'Malformed source refused',status:'done'}]} output="2 simulated results; not verification evidence."/>
      {:else if pattern==='tool'}<Tool title="Apply source edit (fixture)" input={'{"screenId":"screen-1"}'} output="Fixture: committed revision 3" open/>{/if}
    </article>
  {/each}
  </div>
</section>
