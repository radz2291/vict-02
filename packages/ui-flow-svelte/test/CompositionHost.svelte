<script lang="ts">
  import { setContext, untrack } from 'svelte';
  import { compileUiDocument, defaultSemanticElementCatalog, type UiDocument, type UiValue } from '@victframework/ui';
  import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
  import { catalogDescriptors, catalogImplementations } from '../../ui-svelte/src/catalog/components/catalog.js';
  import { flowAuthoringDescriptors } from '../src/authoring/descriptors.js';
  import { flowAuthoringImplementations } from '../src/authoring/implementations.js';
  import { GRAPH_EDITOR_HOST, type GraphEditorHost } from '../src/editor/host.js';
  let { source, host, onWrite, onDiagnostic }: {
    source: UiDocument; host: GraphEditorHost;
    onWrite: (key: string, value: UiValue) => void;
    onDiagnostic: (issue: unknown) => void;
  } = $props();
  let supplied = $state<Record<string, UiValue>>({});
  const descriptors = [...catalogDescriptors, ...flowAuthoringDescriptors];
  const implementations = [...catalogImplementations, ...flowAuthoringImplementations];
  const compiled = $derived(compileUiDocument(source, defaultSemanticElementCatalog(), descriptors));
  setContext(GRAPH_EDITOR_HOST, untrack(() => host));
  export function supply(key: string, value: UiValue) { supplied = { ...supplied, [key]: value }; }
</script>
{#if compiled.ok}
  <DocumentHost plan={compiled.plan} localState={source.localState} stateValues={supplied}
    extensionDescriptors={descriptors} extensionImplementations={implementations}
    dispatch={async () => undefined} navigate={() => {}}
    onStateChange={onWrite} onRenderDiagnostic={onDiagnostic}/>
{:else}<p role="alert">{JSON.stringify(compiled.issues)}</p>{/if}
