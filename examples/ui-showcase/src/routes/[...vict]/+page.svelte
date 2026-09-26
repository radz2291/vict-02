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
    data: { actionEndpoint?: string; plan: Record<string, unknown>; viewData: Record<string, unknown>; record: Record<string, unknown> | null };
  } = $props();

  // The plan declares component identities; the trusted registry supplies
  // code. The registry is recreated ONLY when the declared component-id
  // set actually changes — never per data reload — so registered surfaces
  // keep their instances (and their state) across invalidations.
  const componentKey = $derived(
    ((data.plan.components ?? []) as { componentId: string }[])
      .map((entry) => entry.componentId)
      .sort()
      .join('|'),
  );
  const registry = $derived(
    createShowcaseRegistry(
      componentKey.includes('cmp.request-planner'),
      componentKey.includes('cmp.session-picker'),
    ),
  );

  // Reads (declared query actions, e.g. a product surface loading its own
  // list) never dirty the route; only mutations do. Without this boundary a
  // mount-time read would invalidate, remount the surface, and read again
  // forever.
  let lastActionKind = $state<string | undefined>(undefined);

  async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
    lastActionKind = (
      data.plan.actions as Record<string, { kind?: string } | undefined>
    )[actionId]?.kind;
    // `path` carries the route the action was issued from so the owning
    // application can resolve its own route parameters (the same record
    // identity a form receives). Applications that do not need it ignore it.
    const endpoint = data.actionEndpoint ?? '/api/act';
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await fetch(
      `${endpoint}${separator}path=${encodeURIComponent(page.url.pathname)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actionId, input }),
      },
    );
    return (await response.json()) as ActionResult;
  }

  function handleInvalidate(): void {
    if (lastActionKind === 'query') return;
    void invalidateAll();
  }
</script>

<svelte:head>
  <title>{(data.plan.manifest as { name?: string } | undefined)?.name ?? 'VICT UI Showcase'}</title>
</svelte:head>

<VitApp
  plan={data.plan as never}
  {registry}
  {dispatch}
  path={page.url.pathname}
  viewData={data.viewData as never}
  record={data.record}
  onInvalidate={handleInvalidate}
  navigate={(target) => void goto(target)}
/>
