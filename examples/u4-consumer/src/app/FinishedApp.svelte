<script lang="ts">
  /**
   * The FINISHED application: replays the SAVED documents through the same
   * DocumentHost the editor canvas uses (preview/production parity). This
   * entry imports NO authoring machinery — the bundle-separation check
   * proves it (the app bundle contains no editor modules).
   */
  import { ControlScope, DocumentHost } from '@victframework/ui-svelte';
  import {
    b1CatalogDescriptors,
    b1CatalogImplementations,
    compileConsumerDocuments,
  } from '../product/registrations.js';
  import { consumerViewData } from '../product/definition.js';
  import { taskControlsDocument, taskShellDocument } from '../product/documents.js';
  import FinishedShell from './FinishedShell.svelte';

  type DocId = 'controls' | 'shell';
  let docId = $state<DocId>('controls');
  let feedback = $state<string[]>([]);

  // Compile the SAVED documents when present (the founder's edits replay);
  // otherwise the committed seeds. Same compile path in both entries.
  function savedOrSeed(id: 'controls' | 'shell'): typeof taskControlsDocument {
    try {
      const raw = localStorage.getItem(`u4-consumer.${id}`);
      if (raw !== null) {
        const envelope = JSON.parse(raw) as { document?: unknown };
        if (
          envelope.document !== undefined &&
          (envelope.document as { schema?: string }).schema === 'vict.ui-document@1'
        ) {
          return envelope.document as typeof taskControlsDocument;
        }
      }
    } catch {
      // fall through to the seed
    }
    return id === 'controls' ? taskControlsDocument : taskShellDocument;
  }
  const activeDocument = $derived(savedOrSeed(docId));
  const compiled = $derived.by(() => {
    return compileConsumerDocuments();
  });
  void compiled;
  const activePlan = $derived.by(() => {
    const result = compileConsumerDocuments();
    if (!result.ok) return undefined;
    const key = docId === 'controls' ? 'consumer.taskControls' : 'consumer.taskShell';
    for (const [planKey, plan] of Object.entries(result.documentPlans)) {
      if ((planKey.split('@')[0] as string) === key) return plan;
    }
    return undefined;
  });

  // Local declared-action authority (the consumer's own product surface —
  // unchanged by the component ABI; outputs land here via dispatch).
  async function dispatch(actionId: string, input?: unknown): Promise<unknown> {
    feedback = [...feedback.slice(-4), `${actionId}${input ? ` ${JSON.stringify(input)}` : ''}`];
    return { ok: true };
  }
  function navigate(): void {}
</script>

<ControlScope>
<FinishedShell {docId} {feedback} onPick={(next) => (docId = next)}>
  {#if activePlan !== undefined}
    <DocumentHost
      plan={activePlan}
      extensionDescriptors={b1CatalogDescriptors}
      extensionImplementations={b1CatalogImplementations}
      localState={activeDocument.localState}
      view={consumerViewData}
      {dispatch}
      {navigate}
    />
  {:else}
    <p role="alert">The saved documents failed to compile — open the authoring workbench.</p>
  {/if}
</FinishedShell>
</ControlScope>
