<script lang="ts">
  import { createLocalStorageDocumentStore, type UiDocument } from '@victframework/ui';
  import { ControlScope, DocumentHost } from '@victframework/ui-svelte';
  import { b1CatalogDescriptors, b1CatalogImplementations, compileConsumerDocuments, documentIssues } from '../product/registrations.js';
  import { consumerActionState, consumerViewFor } from '../product/definition.js';
  import { consumerDocuments } from '../product/documents.js';
  import { createConsumerAdapter, createConsumerDispatcher } from '../product/execution.js';
  type DocId = 'controls' | 'shell';
  const id: DocId = typeof location !== 'undefined' && new URLSearchParams(location.search).get('doc') === 'shell' ? 'shell' : 'controls';
  let notices: string[] = [];
  const documents: UiDocument[] = consumerDocuments.map((seed, index) => {
    if (typeof localStorage === 'undefined') return seed;
    const key = index === 0 ? 'controls' : 'shell';
    const store = createLocalStorageDocumentStore(localStorage, { key: `u4-consumer.${key}`, format: 'vict.u4-consumer-store@1', seedStoredRevision: 'r1', validateDocument: documentIssues });
    const stored = store.rawLoad();
    if (stored.status === 'loaded') return stored.document;
    if (stored.status === 'invalid') notices.push(`${stored.message}. Using the seed; saved bytes are preserved.`);
    return seed;
  });
  const compilation = compileConsumerDocuments(documents);
  const activeDocument = documents.find(document => document.id === (id === 'shell' ? 'consumer.taskShell' : 'consumer.taskControls'));
  const activePlan = compilation.ok && activeDocument ? compilation.plan.documentPlans?.[`${activeDocument.id}@${activeDocument.revision}`] : undefined;
  const view = consumerViewFor(documents, id);
  let simulation = $state({ denied: false, failNext: false });
  const adapter = createConsumerAdapter(simulation);
  const dispatcher = compilation.ok ? createConsumerDispatcher(compilation.plan, adapter) : undefined;
  async function dispatch(actionId: string, input?: unknown) {
    return dispatcher ? dispatcher.execute(actionId, input) : { ok: false, code: 'APPLICATION_INVALID', message: 'Application compilation failed.' };
  }
  function navigate(routeId: string): void { location.href = routeId === 'shell' ? '/app.html?doc=shell' : '/app.html'; }
</script>

<ControlScope>
  <div class="vict-app">
    {#each notices as notice}<p role="alert">{notice}</p>{/each}
    <fieldset><legend>Simulated execution</legend>
      <label><input type="checkbox" bind:checked={simulation.denied} /> Deny write permission</label>
      <label><input type="checkbox" bind:checked={simulation.failNext} /> Fail the next operation</label>
    </fieldset>
    {#if id === 'controls'}<a href="/app.html?doc=shell">Open authored shell and dialog</a>{/if}
    {#if activePlan && activeDocument}
      <DocumentHost plan={activePlan} extensionDescriptors={b1CatalogDescriptors} extensionImplementations={b1CatalogImplementations}
        localState={activeDocument.localState} {view} {dispatch} {navigate} actionState={consumerActionState} />
    {:else}<p role="alert">The saved application failed to compile. Open the authoring workbench.</p>{/if}
  </div>
</ControlScope>
