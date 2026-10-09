<script lang="ts">
  /** Round-3 generic catalog probe fixture: renders a compiled plan with
   * reactive external state values (the preview-panel supply channel). */
  import type { UiLocalStateDecl, UiValue } from '@victframework/ui';
  import DocumentHost from '../src/document/DocumentHost.svelte';
  import { catalogDescriptors, catalogImplementations } from '../src/catalog/components/catalog.js';
  import type { UiSvelteComponentImplementation } from '../src/document/extensions.js';

  interface Props {
    plan: never; // compiled UiPlan (opaque here)
    localState?: Readonly<Record<string, UiLocalStateDecl>>;
    stateValues?: Readonly<Record<string, UiValue>>;
  }
  let { plan, localState = {}, stateValues = {} }: Props = $props();
</script>

<DocumentHost
  {plan}
  extensionDescriptors={catalogDescriptors}
  extensionImplementations={catalogImplementations as readonly UiSvelteComponentImplementation[]}
  {localState}
  {stateValues}
  view={{}}
  dispatch={async () => ({ ok: true })}
  navigate={() => {}}
/>
