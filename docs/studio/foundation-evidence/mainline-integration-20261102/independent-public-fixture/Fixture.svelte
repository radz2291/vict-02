<script lang="ts">
  import {compileUiDocument,defaultSemanticElementCatalog,type UiDocument,type UiValue} from '@victframework/ui';
  import {DocumentHost,catalogDescriptors,catalogImplementations} from '@victframework/ui-svelte';
  import {ApplicationViewport} from '@victframework/ui-svelte/viewport';
  let {source,onStateChange}:{source:UiDocument;onStateChange?:(key:string,value:UiValue)=>void}=$props();
  const compiled=compileUiDocument(source,defaultSemanticElementCatalog(),catalogDescriptors);
  if(!compiled.ok)throw Error(JSON.stringify(compiled));
  let clicks=$state(0);
</script>
<button data-parent-control onclick={()=>clicks++}>Parent action {clicks}</button>
<section data-frame-host>
  <ApplicationViewport title="Audited application">
    <DocumentHost plan={compiled.plan} localState={source.localState} extensionDescriptors={catalogDescriptors} extensionImplementations={catalogImplementations} dispatch={async()=>{throw Error('No application effects authorized');}} navigate={()=>{throw Error('No navigation authorized');}} {onStateChange}/>
  </ApplicationViewport>
</section>
<ApplicationViewport title="Sibling application"><input aria-label="Sibling value" value="untouched"/></ApplicationViewport>
