<script lang="ts">
  /** Queue — a NORMAL application route (product entry graph only). */
  import { grantsForRole } from '$lib/product/domain.js';

  let { data }: { data: { actorRole: string; rows: Record<string, unknown>[] } } = $props();
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
    {#each data.rows as row (String(row.id))}
      <li class="queue-row">
        <a class="queue-link" href={`/inspection/${String(row.id)}?as=${data.actorRole}`}>
          <span class="queue-title">{String(row.title)}</span>
          <span class="queue-status" data-status={String(row.status)}>{String(row.status)}</span>
        </a>
      </li>
    {/each}
  </ul>
  <p class="app-note">Grants for this role: {grantsForRole(data.actorRole).join(', ')}</p>
</main>

<style>
  .app-page {
    max-width: 880px;
    margin: 0 auto;
    padding: 24px;
    font-family: system-ui, sans-serif;
    color: #1c2430;
  }
  .app-header h1 {
    font-size: 1.4rem;
    margin: 0 0 4px;
  }
  .app-subtitle {
    color: #5b6572;
    margin: 0 0 20px;
    font-size: 0.9rem;
  }
  .queue {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .queue-row {
    border: 1px solid #d9dde3;
    border-radius: 8px;
  }
  .queue-link {
    display: flex;
    justify-content: space-between;
    padding: 12px 16px;
    color: inherit;
    text-decoration: none;
  }
  .queue-link:hover {
    background: #f2f5f9;
  }
  .queue-title {
    font-weight: 600;
  }
  .queue-status,
  .app-note {
    font-size: 0.85rem;
    color: #5b6572;
  }
</style>
