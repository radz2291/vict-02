<script lang="ts">
  import { DocumentHost } from '@victframework/ui-svelte';
  import { inspectionPlan } from '$lib/product/compile.js';
  import { inspectionQueueDocument, productExtensions } from '$lib/product/documents.js';
  import { productImplementations } from '$lib/product/extensions.js';
  import DemoControls from '$lib/product/DemoControls.svelte';
  let { data }: { data: { actorRole: string; rows: Record<string, unknown>[]; scenario: string; mode: string; loadError?: boolean } } = $props();
  const { queuePlan } = inspectionPlan();
  const submitted = $derived(data.rows.filter(row => row.status === 'submitted').length);
  const stateValues = $derived({ actorRole: data.actorRole, hasRows: data.rows.length > 0, hasError: data.loadError === true, awaitingCount: submitted, inspectionCount: data.rows.length });
</script>
<DocumentHost plan={queuePlan} view={{ inspections: data.rows }} localState={inspectionQueueDocument.localState} {stateValues}
  extensionDescriptors={productExtensions} extensionImplementations={productImplementations}
  dispatch={async () => ({ ok: false })} navigate={() => undefined} ariaLabel="Inspection queue" />
<DemoControls actorRole={data.actorRole} scenario={data.scenario} mode={data.mode} />
