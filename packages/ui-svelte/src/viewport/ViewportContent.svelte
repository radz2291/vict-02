<script lang="ts">
  import type {Snippet} from 'svelte';
  let {children,onReady}:{children:Snippet;onReady:(element:HTMLElement)=>void}=$props();
  let root:HTMLElement;
  $effect(()=>{if(root)onReady(root);});
</script>
<div class="vict-rhea" data-application-content data-ui-application-viewport bind:this={root}>{@render children()}</div>

<style>[data-application-content]{position:relative;isolation:isolate;height:100dvh;overflow:auto;}</style>
