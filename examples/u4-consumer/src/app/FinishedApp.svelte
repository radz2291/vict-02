<script lang="ts">
  import { createLocalStorageDocumentStore, type UiDocument } from '@victframework/ui';
  import { ControlScope, DocumentHost } from '@victframework/ui-svelte';
  import { catalogDescriptors, catalogImplementations, compileConsumerDocuments, documentIssues } from '../product/registrations.js';
  import { consumerActionState, consumerViewFor } from '../product/definition.js';
  import { inspectionDocuments, inspectionRoutes, type ConsumerRouteId } from '../product/operations.js';
  import { createConsumerAdapter, createConsumerDispatcher } from '../product/execution.js';
  type DocId = ConsumerRouteId;
  const requested = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('doc') : null;
  const id: DocId = inspectionRoutes.find(route => route.id === requested)?.id ?? 'queue';
  let notices: string[] = [];
  const documents: UiDocument[] = inspectionDocuments.map((seed) => {
    if (typeof localStorage === 'undefined') return seed;
    const key = inspectionRoutes.find(route => route.documentId === seed.id)?.id ?? seed.id;
    const store = createLocalStorageDocumentStore(localStorage, { key: `u4-consumer.${key}`, format: 'vict.u4-consumer-store@1', seedStoredRevision: 'r1', validateDocument: documentIssues });
    const stored = store.rawLoad();
    if (stored.status === 'loaded') return stored.document;
    if (stored.status === 'invalid') notices.push(`${stored.message}. Using the seed; saved bytes are preserved.`);
    return seed;
  });
  const compilation = compileConsumerDocuments(documents);
  const activeDocument = documents.find(document => document.id === inspectionRoutes.find(route => route.id === id)?.documentId);
  const activePlan = compilation.ok && activeDocument ? compilation.plan.documentPlans?.[`${activeDocument.id}@${activeDocument.revision}`] : undefined;
  const view = consumerViewFor(documents, id);
  let simulation = $state({ denied: false, failNext: false });
  const adapter = createConsumerAdapter(simulation);
  const dispatcher = compilation.ok ? createConsumerDispatcher(compilation.plan, adapter) : undefined;
  async function dispatch(actionId: string, input?: unknown) {
    return dispatcher ? dispatcher.execute(actionId, input) : { ok: false, code: 'APPLICATION_INVALID', message: 'Application compilation failed.' };
  }
  function navigate(routeId: string): void { if (inspectionRoutes.some(route => route.id === routeId)) location.href = `/app.html?doc=${routeId}`; }
</script>

<ControlScope>
  <div class="vict-app">
    {#each notices as notice}<p role="alert">{notice}</p>{/each}
    <fieldset><legend>Simulated execution</legend>
      <label><input type="checkbox" bind:checked={simulation.denied} /> Deny write permission</label>
      <label><input type="checkbox" bind:checked={simulation.failNext} /> Fail the next operation</label>
    </fieldset>
    {#if activePlan && activeDocument}
      <DocumentHost plan={activePlan} extensionDescriptors={catalogDescriptors} extensionImplementations={catalogImplementations}
        localState={activeDocument.localState} {view} {dispatch} {navigate} actionState={consumerActionState} />
    {:else}<p role="alert">The saved application failed to compile. Open the authoring workbench.</p>{/if}
  </div>
</ControlScope>
