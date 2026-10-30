<script lang="ts">
  import type { UiSvelteComponentProps } from '@victframework/ui-svelte';
  import Checkpoint from '../patterns/Checkpoint.svelte';
  import Confirmation from '../patterns/Confirmation.svelte';
  import Suggestion from '../patterns/Suggestion.svelte';
  import ModelSelector from '../patterns/ModelSelector.svelte';
  import { actionText, parseModelSelectorData } from './action-data.js';
  let {kind,props,io,presentation}:UiSvelteComponentProps & {kind:'checkpoint'|'confirmation'|'suggestion'|'model-selector'}=$props();
  const root=$derived(presentation?.target('root'));
  const surface=$derived(presentation?.target('surface'));
  const options=$derived(parseModelSelectorData(props.data));
  const state=$derived(props.state==='running'||props.state==='denied'||props.state==='completed'?props.state:'requested');
</script>
<div {...root} class={`${root?.class??''} vict-ai`}>
  <div {...surface}>
    {#if kind==='checkpoint'}
      <Checkpoint {presentation} label={actionText(props.label,'Checkpoint')} canRestore={props.canRestore===true} onRestore={props.canRestore===true?()=>io?.emit('restore'):undefined}/>
    {:else if kind==='confirmation'}
      <Confirmation {presentation} title={actionText(props.title,'Confirm operation')} description={actionText(props.description)} {state} pending={props.pending===true} resultText={props.resultText===undefined?undefined:actionText(props.resultText)} onDecision={props.canDecide===true?(approved)=>io?.emit('decision',approved):undefined}/>
    {:else if kind==='suggestion'}
      <Suggestion {presentation} text={actionText(props.text,'Suggested prompt')} onSelect={props.allowActions===true?(text)=>io?.emit('select',text):undefined}/>
    {:else if options.ok}
      <ModelSelector models={options.data.models} efforts={options.data.efforts??[]} model={actionText(props.model)} effort={actionText(props.effort)} inline={props.inline===true} {presentation} onModelChange={props.allowActions===true?(id)=>io?.emit('modelChange',id):undefined} onEffortChange={props.allowActions===true?(id)=>io?.emit('effortChange',id):undefined}/>
    {:else}
      <p role="alert">{options.error}</p>
    {/if}
  </div>
</div>
