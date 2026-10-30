<script lang="ts">
  import {onMount,untrack} from 'svelte';
  import type {UiSvelteComponentProps} from '../src/document/extensions.js';
  import {scopedProbeCallbacks} from './scoped-slot-probes.js';
  let {props,io}:UiSvelteComponentProps=$props();
  onMount(()=>untrack(()=>{const emit=io?.emit;scopedProbeCallbacks.set(String(props.label),()=>emit?.('press'));}));
</script>
<button onclick={()=>io?.emit('press')}>{String(props.label)}</button>
