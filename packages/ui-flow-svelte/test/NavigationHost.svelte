<script lang="ts">
  import FlowNavigation from '../src/FlowNavigation.svelte';
  import {navigationSignals} from './NavigationSignals.svelte.js';
  let {onInitialFit}:{onInitialFit:()=>void}=$props();
</script>
<FlowNavigation initialFit={true} initialNodeIds={['input']} request={navigationSignals.request} {onInitialFit}/>
