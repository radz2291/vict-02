<script lang="ts">
  import type {Snippet} from 'svelte';
  let {children,onReady,containerName}:{children:Snippet;onReady:(element:HTMLElement)=>void;containerName?:string}=$props();
  let root:HTMLElement;
  $effect(()=>{if(root)onReady(root);});
</script>
<!-- Stylesheets cross the iframe boundary; the outer ControlScope's DOM
     ancestry does not. Keep catalog paint and owned overlays in this scope. -->
<!-- A host can establish its query container inside the actual iframe.
     Container ancestry cannot cross the outer document boundary. -->
<div class="vict-rhea vict-controls" data-application-content data-ui-application-viewport
  style:container-name={containerName || undefined} style:container-type={containerName ? 'inline-size' : undefined}
  bind:this={root}>{@render children()}</div>

<style>[data-application-content]{position:relative;isolation:isolate;height:100dvh;overflow:auto;}</style>
