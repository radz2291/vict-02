<script lang="ts">
  import {DocumentHost} from '@victframework/ui-svelte';
  import {rowSource,compile,descriptors,implementations} from './row-fixture';
  import Harness from './fixtures/IndependentEdgeHarness.svelte';
  import '@victframework/ui-svelte/styles.css';
  import '@victframework/ui-svelte/catalog.css';
  import '@victframework/ui-flow-svelte/styles.css';
  const source=rowSource(3),plan=compile(source);
</script>
<main><h1>Installed public graph3 and semantic port-row fixture</h1>
  <DocumentHost {plan} localState={source.localState} extensionDescriptors={descriptors} extensionImplementations={implementations} dispatch={async()=>undefined} navigate={()=>{}}/>
  <Harness initial={String(source.localState.graph.initial)} emit={()=>{}} expose={()=>{}} frame={()=>{}}/>
</main>
