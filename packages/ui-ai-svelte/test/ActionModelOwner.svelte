<script lang="ts">
  import {setContext} from 'svelte';
  import {UI_PORTAL_TARGET,type UiComponentPresentation} from '@victframework/ui-svelte';
  import ModelSelector from '../src/patterns/ModelSelector.svelte';
  let {owner}:{owner:string}=$props();
  let outlet=$state<HTMLDivElement>();
  setContext(UI_PORTAL_TARGET,()=>outlet);
  const presentation:UiComponentPresentation={scopeClass:'owner-theme',target:(part)=>({'data-ui-owner':owner,'data-ui-occ':`model-${owner}`,'data-ui-part':part})};
  let model=$state('one');
</script>
<div data-ui-owner-root={owner} data-ui-application-viewport>
  <ModelSelector models={[{id:'one',label:'One'},{id:'two',label:'Two'}]} {model} onModelChange={value=>model=value} {presentation}/>
  <button data-outside-model>Other control</button>
  <div bind:this={outlet} data-owner-outlet={owner}></div>
  <output>{model}</output>
</div>
