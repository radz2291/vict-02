<script lang="ts">
  import {untrack} from 'svelte';
  import type {UiSvelteComponentProps} from '../src/document/extensions.js';
  import {continuityEmissions} from './continuity-probe-emissions.js';
  let {io}:UiSvelteComponentProps=$props();
  $effect(()=>{const emit=io?.emit;if(emit)untrack(()=>continuityEmissions.push(emit));});
</script>
<button onclick={()=>io?.emit('change','current')}>Current output</button>
