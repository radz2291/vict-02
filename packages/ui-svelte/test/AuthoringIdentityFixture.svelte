<script lang="ts">
  import type {UiRenderPlan,UiLocalStateDecl} from '@victframework/ui';
  import DocumentHost from '../src/document/DocumentHost.svelte';
  import {catalogDescriptors,catalogImplementations} from '../src/catalog/components/catalog.js';
  let {plan,localState,onDiagnostic}:{plan:UiRenderPlan;localState:Readonly<Record<string,UiLocalStateDecl>>;onDiagnostic:(value:unknown)=>void}=$props();
  let values=$state({first:'same',second:'same'});
  export function setSecond(value:string){values={...values,second:value};}
</script>
<DocumentHost {plan} {localState} stateValues={values} extensionDescriptors={catalogDescriptors} extensionImplementations={catalogImplementations} dispatch={async()=>undefined} navigate={()=>undefined} onRenderDiagnostic={onDiagnostic}/>
