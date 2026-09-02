<script lang="ts">
  // Generic catch-all rendering boundary: EVERY application route renders
  // through this one file. There is deliberately no manual page shell for
  // the declared screen — the compiled plan (built server-side from the
  // neutral definition) drives the host, and every action crosses the
  // /api/act server boundary where authorization and effect policy live.
  import { createProofComponentRegistry } from '$lib/host/proof-renderer.js';
  import ApplicationHost from '$lib/host/ApplicationHost.svelte';

  let { data }: { data: { plan: Record<string, unknown>; rows: Record<string, unknown>[] } } = $props();

  // The trusted local component registry lives OUTSIDE the serializable
  // definition; the plan carries only cmp.badge@1. The registry factory is
  // shared with the server-side release compilation so the deployed
  // component identity always comes from the SAME actual registry.
  const registry = createProofComponentRegistry();

  const dispatch = async (
    actionId: string,
    input?: unknown,
  ): Promise<{ ok: boolean; value?: unknown; code?: string; message?: string }> => {
    const response = await fetch('/api/act', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId, input }),
    });
    return (await response.json()) as { ok: boolean; value?: unknown; code?: string; message?: string };
  };
</script>

<svelte:head><title>Vict Stage 04 Proof</title></svelte:head>

<ApplicationHost
  plan={data.plan as never}
  {registry}
  {dispatch}
  rows={data.rows}
/>
