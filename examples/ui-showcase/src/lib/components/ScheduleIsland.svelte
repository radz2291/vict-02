<script lang="ts">
  let { submitActionId }: { submitActionId: string } = $props();
  // The registered product surface is split away from ordinary Requests/Workspace.
  const component = import('./RequestPlanner.svelte');
</script>

{#await component}<p role="status">Loading request planner…</p>
{:then module}<module.default {submitActionId} />
{:catch}<p role="alert">
    The request planner could not load. Refresh this page to try again.
  </p>{/await}
