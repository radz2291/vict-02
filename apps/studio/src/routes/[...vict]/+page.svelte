<script lang="ts">
  // The GENERIC application host page: everything visible is rendered from
  // the neutral plan through @victframework/ui-svelte. Custom operator
  // components arrive through the trusted local registry (code islands
  // live OUTSIDE the serializable manifest). G1 is read-only: dispatch
  // fails closed for any action the read-only definition does not declare.
  import { page } from '$app/state';
  import { goto, invalidateAll } from '$app/navigation';
  import { VitApp, type ActionResult } from '@victframework/ui-svelte';
  import '@victframework/ui-svelte/styles.css';
  import { createStudioRegistry } from '$lib/components/registry.js';

  let {
    data,
  }: {
    data: {
      plan: Record<string, unknown>;
      viewData: Record<string, unknown>;
      record: Record<string, unknown> | null;
    };
  } = $props();

  const registry = createStudioRegistry();

  async function dispatch(actionId: string, _input?: unknown): Promise<ActionResult> {
    // G1 read-only boundary: no mutation surface exists. Any action that is
    // not declared by the (read-only) definition fails closed here.
    return {
      ok: false,
      code: 'UNSUPPORTED_ACTION',
      message: `Action '${actionId}' is not available in this Studio build.`,
    };
  }
</script>

<svelte:head><title>VICT Studio</title></svelte:head>

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
