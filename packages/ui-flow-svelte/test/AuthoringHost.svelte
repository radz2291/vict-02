<script lang="ts">
  import { compileUiDocument, defaultSemanticElementCatalog, type UiDocument, type UiExtensionDescriptor } from '@victframework/ui';
  import type { UiSvelteComponentImplementation } from '@victframework/ui-svelte';
  import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
  let { initial, descriptors, implementations, view = {}, catalogs = {} }: { initial: UiDocument; descriptors: readonly UiExtensionDescriptor[]; implementations: readonly UiSvelteComponentImplementation[]; view?: Readonly<Record<string, unknown>>; catalogs?: Parameters<typeof compileUiDocument>[3] } = $props();
  let document = $state(initial);
  export function replaceDocument(next: UiDocument) { document = next; }
  const compiled = $derived(compileUiDocument(document, defaultSemanticElementCatalog(), descriptors, catalogs));
</script>
{#if compiled.ok}<DocumentHost plan={compiled.plan} extensionDescriptors={descriptors} extensionImplementations={implementations} localState={document.localState} {view} dispatch={async () => undefined} navigate={() => {}} />{/if}
