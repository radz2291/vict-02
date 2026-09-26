<script lang="ts">
  // The GENERIC application host page: the only page shell this showcase
  // needs. Everything visible is rendered from the neutral plan by the
  // permanent @victframework/ui-svelte renderer; client-side navigation,
  // route parameters, plan/data/registry updates, and action invalidation
  // flow through the renderer's reactive props. The host page adds NO
  // styling of its own (theme.css is the VICT product stylesheet).
  import { page } from '$app/state';
  import { goto, invalidateAll } from '$app/navigation';
  import { VitApp } from '@victframework/ui-svelte';
  import type { ActionResult } from '@victframework/ui-svelte';
  // The VICT product stylesheet (the only stylesheet the showcase loads).
  import '@victframework/ui-svelte/styles.css';
  import { createShowcaseRegistry } from '$lib/components/registry';

  let {
    data,
  }: {
    data: { plan: Record<string, unknown>; viewData: Record<string, unknown>; record: Record<string, unknown> | null };
  } = $props();

  // The trusted local component registry lives OUTSIDE the manifest; the
  // plan carries only cmp.island@1.
  const registry = createShowcaseRegistry();

  async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
    const response = await fetch('/api/act', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId, input }),
    });
    return (await response.json()) as ActionResult;
  }
</script>

<svelte:head>
  <title>{data.plan.applicationId === 'app.foundation' ? 'VICT Workspace' : 'VICT UI Showcase'}</title>
</svelte:head>

<VitApp
  plan={data.plan as never}
  {registry}
  {dispatch}
  path={page.url.pathname}
  viewData={data.viewData as never}
  record={data.record}
  onInvalidate={() => void invalidateAll()}
  navigate={(target) => void goto(target)}
/>