<script lang="ts">
  /** Queue — a NORMAL application route (product entry graph only). */
  import { seedDomain, InspectionDataAdapter, createInspectionServer, grantsForRole } from '$lib/product/domain.js';

  let { data }: { data: { actorRole: string } } = $props();

  const server = createInspectionServer(new InspectionDataAdapter(seedDomain()));
  const rows = $state(await (async () => {
    const result = await server.dispatch('inspection.list', {}, { role: 'supervisor', actorId: 'server' });
    if (!result.ok) return [];
    return (result.value as { rows: Record<string, unknown>[] }).rows;
  })());
</script>

<main class="app-page">
  <header class="app-header">
    <h1>Inspection queue</h1>
    <p class="app-subtitle">
      Viewing as <strong>{data.actorRole}</strong> · decisions require the supervisor role (enforced at the
      adapter boundary, not by button visibility)
    </p>
  </header>
  <ul class="queue" aria-label="Submitted inspections">
    {#each rows as row (row.id as string)}
      <li class="queue-row">
        <a class="queue-link" href={`/inspection/${row.id}`}>
          <span class="queue-title">{row.title}</span>
          <span class="queue-status" data-status={row.status}>{row.status}</span>
        </a>
      </li>
    {/each}
  </ul>
  <p class="app-note">
    Grants for this role: {grantsForRole(data.actorRole).join(', ')}
  </p>
</main>
