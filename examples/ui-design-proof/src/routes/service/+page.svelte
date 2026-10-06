<script lang="ts">
  /**
   * Finished service page — renders the SAME PERSISTED source the workbench
   * edits (loaded after mount; the seed renders for SSR and when nothing is
   * stored). The form's validation outcome is host-rendered REAL adapter
   * state (associated to the fields via aria-describedby).
   */
  import { browser } from '$app/environment';
  import { DocumentHost } from '@victframework/ui-svelte';
  import { compileUiDocument, type UiDocument } from '@victframework/ui';
  import {
    designCatalogs,
    readContactFields,
    validateContact,
    type ContactOutcome,
  } from '$lib/design/adapter';
  import {
    loadPresentable,
    openDesignStore,
  } from '$lib/design/persistence';
  import {
    serviceDocument,
    SERVICE_STORE_KEY,
  } from '$lib/design/service-document';

  let presentable = $state<{ document: UiDocument; banner: string | null }>({
    document: serviceDocument,
    banner: null,
  });

  $effect(() => {
    if (!browser) return;
    const opened = loadPresentable(openDesignStore(SERVICE_STORE_KEY), serviceDocument);
    presentable = { document: opened.document, banner: opened.banner };
  });

  const compiled = $derived.by(() =>
    compileUiDocument(
      presentable.document,
      designCatalogs.elements,
      [],
      {
        actionIds: designCatalogs.actionIds,
        routeIds: designCatalogs.routeIds,
        viewFields: designCatalogs.viewFields,
      },
    ),
  );

  let outcome: ContactOutcome | null = $state(null);
  let feedbackEl: HTMLDivElement | undefined = $state(undefined);

  function focusFeedback(): void {
    // Move focus to the feedback so keyboard users hear the outcome.
    requestAnimationFrame(() => feedbackEl?.focus());
  }

  async function dispatch(actionId: string): Promise<unknown> {
    if (actionId === 'design.submitContact') {
      const fields = readContactFields(document.body);
      const result = validateContact(fields);
      outcome = result;
      focusFeedback();
      return result;
    }
    return { status: 'denied', heading: `Unknown action ${actionId}`, issues: [] };
  }

  function navigate(): void {
    // No routes in the design proof.
  }
</script>

{#if presentable.banner !== null}
  <div class="design-form-feedback" role="alert" style="margin-top: 16px">
    ⚠ {presentable.banner}
  </div>
{/if}

{#if compiled.ok}
  <DocumentHost plan={compiled.plan} dispatch={dispatch} navigate={navigate} as="article" ariaLabel="Northwind Atelier home page" />
{:else}
  <div role="alert" style="max-width: 720px; margin: 40px auto; font-family: system-ui">
    The page document does not compile:
    <ul>
      {#each compiled.issues as issue}
        <li>{issue.code}: {issue.message}</li>
      {/each}
    </ul>
  </div>
{/if}

{#if outcome !== null}
  <div
    class="design-form-feedback"
    data-status={outcome.status}
    id="design-form-feedback"
    role="status"
    tabindex="-1"
    bind:this={feedbackEl}
  >
    <strong>{outcome.heading}</strong>
    {#if outcome.status === 'ok'}
      <p style="margin: 6px 0 0">{outcome.detail}</p>
    {:else}
      <ul>
        {#each outcome.issues as issue}
          <li>{issue.message}</li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}
