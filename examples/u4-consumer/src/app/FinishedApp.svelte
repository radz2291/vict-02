<script lang="ts">
  /**
   * The FINISHED application: replays the SAVED documents through the same
   * DocumentHost the editor canvas uses (preview/production parity). This
   * entry imports NO authoring machinery — the bundle-separation check
   * proves it (the app bundle contains no editor modules).
   */
  import type { UiRenderPlan } from '@victframework/ui';
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
  let feedback = $state<string[]>([]);

  function currentDocId(): DocId {
    return new URLSearchParams(location.search).get('doc') === 'shell' ? 'shell' : 'controls';
  }

  function savedOrSeed(id: DocId): typeof taskControlsDocument {
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

  function planFor(id: DocId): UiRenderPlan | undefined {
    const result = compileConsumerDocuments([savedOrSeed('controls'), savedOrSeed('shell')]);
    if (result.issues.some((issue) => issue.severity === 'error')) return undefined;
    const key = id === 'controls' ? 'consumer.taskControls' : 'consumer.taskShell';
    for (const [planKey, plan] of Object.entries(result.documentPlans)) {
      if ((planKey.split('@')[0] as string) === key) return plan;
    }
    return undefined;
  }

  const docId = $derived(currentDocId());
  const activePlan = $derived(planFor(currentDocId()));
  const activeDocument = $derived(savedOrSeed(currentDocId()));

  async function dispatch(actionId: string, input?: unknown): Promise<unknown> {
    feedback = [...feedback.slice(-4), `${actionId}${input ? ` ${JSON.stringify(input)}` : ''}`];
    return { ok: true };
  }
  function navigate(): void {}
</script>

{#snippet nav()}
  <a href="/app.html" aria-current={docId === 'controls' ? 'page' : undefined}>Controls</a>
  <a href="/app.html?doc=shell" aria-current={docId === 'shell' ? 'page' : undefined}>Shell + dialog</a>
{/snippet}

<ControlScope>
  <FinishedShell {nav} {feedback}>
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
