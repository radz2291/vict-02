<script lang="ts">
  /** Queue — a NORMAL application route (product entry graph only). */
  import { invalidateAll } from '$app/navigation';
  import { grantsForRole } from '$lib/product/domain.js';
  import type { ScenarioId } from '$lib/server/inspection.js';

  let { data }: { data: { actorRole: string; rows: Record<string, unknown>[]; scenario: string } } =
    $props();

  let resetting = $state(false);
  let resetNote = $state('');

  /** Scenario reset (U3-02): deterministic reseed through the server process. */
  async function resetScenario(scenario: ScenarioId): Promise<void> {
    resetting = true;
    resetNote = 'Resetting…';
    const response = await fetch(`/api/inspection/reset?as=${data.actorRole}&scenario=${scenario}`, {
      method: 'PUT',
    });
    const result = (await response.json()) as { ok: boolean; code?: string; message?: string };
    if (result.ok) {
      resetNote = `Reset to '${scenario}' — fresh seeded session.`;
      await invalidateAll();
    } else {
      resetNote = `${result.code}: ${result.message}`;
    }
    resetting = false;
  }

  const scenarios: readonly ScenarioId[] = [
    'normal',
    'empty',
    'long',
    'latency',
    'failure',
    'missing',
    'denied',
    'conflict',
  ];
</script>

<main class="app-page">
  <header class="app-header">
    <h1>Inspection queue</h1>
    <p class="app-subtitle">
      Viewing as <strong>{data.actorRole}</strong> · decisions require the supervisor role (enforced at the
      adapter boundary, not by button visibility)
    </p>
  </header>

  <section class="scenario-strip" aria-label="Scenario reset">
    <span class="strip-label">Scenario:</span>
    <strong>{data.scenario}</strong>
    {#each scenarios as scenario (scenario)}
      <button
        type="button"
        class="strip-button"
        onclick={() => resetScenario(scenario)}
        disabled={resetting}
      >
        {scenario}
      </button>
    {/each}
    <span class="strip-note" role="status">{resetNote}</span>
  </section>

  {#if data.rows.length === 0}
    <p class="queue-empty" role="status">The queue is empty — no inspections are awaiting a decision.</p>
  {:else}
    <ul class="queue" aria-label="Inspections">
      {#each data.rows as row (String(row.id))}
        <li class="queue-row">
          <a class="queue-link" href={`/inspection/${String(row.id)}?as=${data.actorRole}`}>
            <span class="queue-title">{String(row.title)}</span>
            <span class="queue-status" data-status={String(row.status)}>{String(row.status)}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
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
  .scenario-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: 0.85rem;
    padding: 10px 12px;
    border: 1px solid #d9dde3;
    border-radius: 8px;
    margin-bottom: 16px;
  }
  .strip-label {
    color: #5b6572;
  }
  .strip-button {
    font: inherit;
    font-size: 0.8rem;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid #b8c2cf;
    background: #f2f5f9;
    cursor: pointer;
  }
  .strip-button:hover {
    background: #e6ecf3;
  }
  .strip-note {
    color: #5b6572;
  }
  .queue-empty {
    padding: 20px;
    border: 1px dashed #b8c2cf;
    border-radius: 8px;
    color: #5b6572;
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
