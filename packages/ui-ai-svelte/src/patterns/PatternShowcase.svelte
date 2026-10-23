<script lang="ts">
  import {onDestroy} from 'svelte';
  import {aiElementPatterns, type Step} from './types.js';
  import Conversation from '../Conversation.svelte';
  import ChainOfThought from './ChainOfThought.svelte';
  import Plan from './Plan.svelte';
  import Task from './Task.svelte';
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
  let modelPrompt=$state('');
  let checkpointRestored=$state(false);
  let selectedFile=$state('components/ui/button.tsx');
  let confirmationState=$state<'requested'|'running'|'denied'|'completed'>('requested');
  let feedback=$state<'like'|'dislike'|null>(null);
  let files=$state([{id:'fixture',name:'example.txt (fixture)'}]);
  let copiedDemo=$state<string|null>(null);
  let copiedTimer:ReturnType<typeof setTimeout>|undefined;
  let reasoningRunning=$state(false);
  let terminalRunning=$state(false);
  let testsRunning=$state(false);
  let toolState=$state<'running'|'completed'|'error'|'denied'|'pending'>('completed');
  let chatMessages=$state([{id:'fixture-user',role:'user' as const,text:'Describe the selected screen.'},{id:'fixture-assistant',role:'assistant' as const,text:'This is a **presentation fixture** with a `screen-1` identity.'}]);
  const reply='Install the dialog, then connect its trigger to the settings button.\n\n```ts\nconst screen = "settings";\n```\n\nThis is a **local presentation fixture**.';
  const tree=[{path:'components',name:'components',children:[{path:'components/ui',name:'ui',children:[{path:'components/ui/button.tsx',name:'button.tsx'},{path:'components/ui/dialog.tsx',name:'dialog.tsx'}]}]}];
  const models=[{id:'example-model',label:'Example model',group:'OpenAI'},{id:'other-example',label:'Other example',group:'Anthropic'}];
  const testSuites=[{id:'tests',name:'settings.test.ts',tests:[{id:'passes',name:'opens settings',status:'passed' as const},{id:'fails',name:'rejects invalid source',status:'failed' as const,error:'Fixture assertion: expected a validation message.'},{id:'skips',name:'provider integration',status:'skipped' as const}]}];
  const chainSteps=steps.map((step,index)=>({...step,...(index===0?{code:'const screen = "screen-1";',badges:['Source'],links:[{title:'VICT framework',url:source.url}]}:{})}));
  onDestroy(()=>clearTimeout(copiedTimer));
  async function copyDemo(text:string,id:string){
    copiedDemo=null;
    try{await navigator.clipboard.writeText(text);copiedDemo=id;lastAction='Message copied to the local clipboard.';clearTimeout(copiedTimer);copiedTimer=setTimeout(()=>copiedDemo=null,2000);}
    catch{lastAction='Copy unavailable. Select the text to copy it.';}
  }
  function resetChat(){chatMessages=[{id:'fixture-user',role:'user',text:'Describe the selected screen.'},{id:'fixture-assistant',role:'assistant',text:'This is a **presentation fixture** with a `screen-1` identity.'}];lastAction='Local chat fixture reset; no provider or Studio source changed.';}
</script>
<section class="vict-ai" aria-label="AI Elements complete pattern gallery">
  <h2>All 21 AI Elements patterns</h2>
  <p>Presentation fixtures only. Actions update local examples; they do not approve, execute, restore, upload, or select a provider. Copy writes to your local clipboard.</p>
  <p role="status">{lastAction}</p>
  <div class="grid gap-4 md:grid-cols-2">
  {#each aiElementPatterns as pattern (pattern)}
    <article class="min-w-0 rounded-2xl border border-border bg-background p-4" data-ai-pattern={pattern}>
      <h3 class="mb-4 font-medium">{pattern}</h3>
      <a class="mb-4 inline-flex text-xs text-muted-foreground underline" href={`https://www.shadcn-svelte.com/docs/ai-elements/${pattern}`} target="_blank" rel="noopener noreferrer">Official example<span class="sr-only"> (opens in a new tab)</span></a>
      <div class={`pattern-preview mx-auto w-full ${pattern==='prompt-input'||pattern==='model-selector'?'max-w-lg':'max-w-sm'}`} data-pattern-preview={pattern} data-example-width={pattern==='prompt-input'||pattern==='model-selector'?512:384}>
      {#if pattern==='chat'}<div style="height:440px"><Conversation messages={chatMessages} title="New Thread" description="Local presentation fixture" onReset={resetChat} onSend={async(text)=>{chatMessages=[...chatMessages,{id:crypto.randomUUID(),role:'user',text},{id:crypto.randomUUID(),role:'assistant',text:'Local fixture reply; no provider or source edit.'}];lastAction='Simulated chat submit; no provider contacted.';return true;}}/></div>
      {:else if pattern==='chain-of-thought'}<ChainOfThought title="Public activity summary" steps={chainSteps} description="Observed public activity only; no private model reasoning."/>
      {:else if pattern==='plan'}<Plan title="Update the settings screen" {steps} description="A proposed plan; these fixture steps do not execute."/>
      {:else if pattern==='task'}<Task title="Updating settings" {steps}/>
      {:else if pattern==='checkpoint'}
        <div class="flex min-h-72 flex-col gap-4 py-6 text-sm">
          <Message role="user" text="Rename the button component to action."/>
          <Message role="assistant" text="Example: renamed Button to Action."/>
          <Checkpoint label="Button renamed" canRestore={!checkpointRestored} onRestore={()=>{checkpointRestored=true;lastAction='Simulated checkpoint restored in this local transcript only; no Studio document changed.';}}/>
          {#if !checkpointRestored}<Message role="user" text="Update the docs to match."/><Message role="assistant" text="Example: updated the Button page to say Action."/>{/if}
        </div>
      {:else if pattern==='confirmation'}<Confirmation state={confirmationState} title="Apply the prepared change?" description="Fixture request only; production requires a host-owned approval identity and authorization." onDecision={(approved)=>{confirmationState=approved?'running':'denied';lastAction=`Simulated ${approved?'approval':'denial'}; no authority changed.`;}}/>
      {:else if pattern==='context'}<Context used={10660} limit={128000} breakdown={[{label:'Input',value:8420},{label:'Output',value:1260},{label:'Reasoning',value:980}]}/>
      {:else if pattern==='file-tree'}<FileTree nodes={tree} selected={selectedFile} onSelect={(path)=>{selectedFile=path;lastAction=`Simulated source selection: ${path}`;}}/>
      {:else if pattern==='inline-citation'}<p>This design uses a canonical source <InlineCitation {source}/> and upstream presentation <InlineCitation source={{id:'shadcn',title:'shadcn-svelte AI Elements',url:'https://www.shadcn-svelte.com/docs/ai-elements/message',excerpt:'Official Message composition reference; no preview fetched.'}}/>.</p>
      {:else if pattern==='message'}
        <div class="flex flex-col gap-8 py-6 text-sm">
          <Message role="user" text="How do I add a settings dialog? It should open from the gear icon in the header." copied={copiedDemo==='user'} onCopy={()=>void copyDemo('How do I add a settings dialog? It should open from the gear icon in the header.','user')} onEdit={()=>{prompt='How do I add a settings dialog?';lastAction='Simulated edit: text copied into the Prompt Input example.';}}/>
          <Message role="assistant" text={reply} copied={copiedDemo==='reply'} onCopy={()=>void copyDemo(reply,'reply')} {feedback} onFeedback={(value)=>{feedback=value;lastAction='Simulated feedback stored locally only.';}} onRetry={()=>lastAction='Simulated retry request; no provider contacted.'}/>
        </div>
      {:else if pattern==='model-selector'}<PromptInput bind:value={modelPrompt} label="Model selection prompt" onSend={(text)=>{lastAction=`Simulated model prompt: ${text}`;modelPrompt='';}}>
        {#snippet footer()}<ModelSelector inline {models} {model} onModelChange={(value)=>{model=value;lastAction='Example model changed locally; server configuration unchanged.';}} efforts={[{id:'low',label:'Low'},{id:'medium',label:'Medium'},{id:'high',label:'High'}]} {effort} onEffortChange={(value)=>effort=value}/>{/snippet}
      </PromptInput>
      {:else if pattern==='prompt-input'}<PromptInput bind:value={prompt} attachments={files} onAttach={()=>{files=[...files,{id:crypto.randomUUID(),name:'attached-example.txt (fixture)'}];lastAction='Simulated attachment added locally; no file uploaded.';}} onRemoveAttachment={(id)=>{files=files.filter(file=>file.id!==id);lastAction='Simulated attachment removed locally; no upload exists.';}} onSend={(text)=>{lastAction=`Simulated prompt: ${text}`;prompt='';}}>
        {#snippet footer()}<ModelSelector inline {models} {model} onModelChange={(value)=>model=value} efforts={[{id:'low',label:'Low'},{id:'medium',label:'Medium'},{id:'high',label:'High'}]} {effort} onEffortChange={(value)=>effort=value}/>{/snippet}
      </PromptInput>
      {:else if pattern==='queue'}<Queue {steps}/>
      {:else if pattern==='reasoning'}<Reasoning running={reasoningRunning} duration={4} text="The host may expose a safe summary of observed activity. Private model reasoning is not required or inferred."/>
      {:else if pattern==='sources'}<Sources sources={[source,{id:'shadcn',title:'shadcn-svelte',url:'https://www.shadcn-svelte.com/docs/ai-elements'},{id:'flow',title:'Svelte Flow',url:'https://svelteflow.dev/'},source]}/>
      {:else if pattern==='stack-trace'}<StackTrace frames={'ValidationError: fixture only\n  at validate (src/validate.ts:12:4)\n  at apply (src/app.ts:24:8)\n  at render (node_modules/svelte/internal.js:42:3)'}/>
      {:else if pattern==='subagent'}<Subagent title="Layout reviewer (fixture)" steps={steps.map(step=>({...step,status:'done' as const}))} model="Example model" duration={8} tools={['Read source','Validate']} description="Review layout without changing source." result="Example finding: preserve stable source IDs."/>
      {:else if pattern==='suggestion'}
        <div class="flex flex-col gap-4">
          <div class="flex max-w-full scroll-fade-x scrollbar-none gap-2 overflow-x-auto overscroll-x-contain pb-1">
            {#each ['Explain this screen','Add a settings dialog','Check accessibility'] as suggestion}<Suggestion text={suggestion} onSelect={(text)=>{prompt=text;lastAction=`Simulated suggestion: ${text}`;}}/>{/each}
          </div>
          <PromptInput bind:value={prompt} onSend={(text)=>{lastAction=`Simulated suggestion prompt: ${text}`;prompt='';}}/>
        </div>
      {:else if pattern==='terminal'}<Terminal command="npm run check" status={terminalRunning?'running':undefined} exitCode={1} output="Fixture: type check failed at src/settings.ts:12. This command was not executed."/>
      {:else if pattern==='test-results'}<TestResults testSuites={testSuites} suites={[]} running={testsRunning} output="3 simulated results; not verification evidence."/>
      {:else if pattern==='tool'}<Tool title="Apply source edit (fixture)" state={toolState} input={'{"screenId":"screen-1"}'} output="Fixture: committed revision 3" error="Fixture validation failed; no edit applied." open/>{/if}
      </div>
      {#if pattern==='checkpoint'}<button class="mt-4" type="button" onclick={()=>checkpointRestored=false}>Reset checkpoint fixture</button>{/if}
      {#if pattern==='confirmation'}<div class="mt-4 flex gap-2"><button type="button" onclick={()=>confirmationState='requested'}>Reset decision fixture</button><button type="button" onclick={()=>confirmationState='completed'}>Show completed fixture</button></div>{/if}
      {#if pattern==='reasoning'}<label class="mt-4 flex gap-2"><input type="checkbox" bind:checked={reasoningRunning}/>Simulate running summary</label>{/if}
      {#if pattern==='terminal'}<label class="mt-4 flex gap-2"><input type="checkbox" bind:checked={terminalRunning}/>Simulate running terminal</label>{/if}
      {#if pattern==='test-results'}<label class="mt-4 flex gap-2"><input type="checkbox" bind:checked={testsRunning}/>Simulate running tests</label>{/if}
      {#if pattern==='tool'}<label class="mt-4 flex gap-2">Fixture state<select bind:value={toolState}><option value="running">Running</option><option value="completed">Completed</option><option value="error">Error</option><option value="denied">Denied</option><option value="pending">Pending</option></select></label>{/if}
    </article>
  {/each}
  </div>
</section>
