<script lang="ts">
  import type { Component } from 'svelte';
  let { kind, ...surfaceProps }: { kind: string } & Record<string, unknown> = $props();
  // The registered agent product surfaces load lazily so the shared
  // catch-all bundle of the other preview applications never carries them.
  // The dynamic-import PROMISES are created ONCE at module scope: a record
  // refresh re-runs the `load` derivation, and a freshly created promise
  // would restart the {#await} block and REMOUNT the island — wiping its
  // local state (action feedback, focus) every time the record changes.
  const LOADERS: Record<string, Promise<{ default: Component<Record<string, unknown>> }>> = {
    picker: import('./SessionPicker.svelte'),
    console: import('./SessionConsole.svelte'),
    log: import('./OutputLog.svelte'),
  };
  const load = $derived(LOADERS[kind]);
</script>

{#if load === undefined}
  <p role="alert">This workspace surface is not registered for this deployment.</p>
{:else}
  {#await load}
    <p role="status">Loading workspace…</p>
  {:then module}
    <module.default {...surfaceProps} />
  {:catch}
    <p role="alert">
      This workspace surface could not load. Refresh the page to try again.
    </p>
  {/await}
{/if}
