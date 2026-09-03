<script lang="ts">
  // The GENERIC application host page: the only page shell this application
  // will ever need. Everything visible is rendered from the neutral plan;
  // client-side navigation, route parameters, plan/data/registry updates,
  // and action invalidation flow through the renderer's reactive props.
  import { page } from '$app/state';
  import { goto, invalidateAll } from '$app/navigation';
  import { VitApp, type ActionResult } from '@vict/renderer-svelte';
  import '@vict/renderer-svelte/theme.css';
  import { createReferenceRegistry } from '$lib/components/registry';

  let {
    data,
  }: {
    data: { plan: Record<string, unknown>; viewData: Record<string, unknown>; record: Record<string, unknown> | null };
  } = $props();

  // The trusted local component registry lives OUTSIDE the manifest; the
  // plan carries only cmp.health@1.
  const registry = createReferenceRegistry();

  async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
    const response = await fetch('/api/act', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId, input }),
    });
    return (await response.json()) as ActionResult;
  }
</script>

<svelte:head><title>Vict Reference Application</title></svelte:head>

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
