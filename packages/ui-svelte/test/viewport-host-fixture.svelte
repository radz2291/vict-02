<script lang="ts">
  import ApplicationViewport from '../src/viewport/ApplicationViewport.svelte';
  let name = $state<string | undefined>(undefined);
</script>
<button onclick={() => name = 'studio-screen'}>Establish query host</button>
<button onclick={() => name = 'alternate-screen'}>Rename query host</button>
<button onclick={() => name = undefined}>Clear query host</button>
<ApplicationViewport containerName={name}>
  <main aria-label="Authored child">Retained authored content</main>
</ApplicationViewport>
