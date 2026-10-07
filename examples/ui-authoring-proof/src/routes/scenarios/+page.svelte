<script lang="ts">
  /**
   * Scenario console (U3-02/04/07): the frozen eight-scenario matrix run
   * through the EXISTING preview orchestration (PreviewSession) with data
   * operations dispatching through the conforming inspection adapter.
   * Implementation modes are declared per operation — the coverage matrix is
   * truthful by construction. Reset creates a NEW session identity and
   * deterministically rebuilds the seeded state; a reset during the latency
   * window fences the in-flight decision (SESSION_STALE).
   */
  import type { PreviewSession } from '@victframework/ui-preview';
  import {
    SCENARIO_IDS,
    SCENARIO_LABELS,
    createScenarioSession,
    decisionInput,
    type ScenarioId,
  } from '$lib/product/scenarios.js';

  let activeScenario: ScenarioId = $state('normal');
  let scenario = $state(createScenarioSession('normal'));
  const session: PreviewSession = $derived(scenario.session);
  let note: string = $state('Session ready.');
  let results: { readonly op: string; readonly code: string; readonly detail: string }[] = $state([]);
  let busy = $state(false);

  function reset(id: ScenarioId): void {
    scenario = createScenarioSession(id);
    results = [];
    note = `Reset to '${id}' — NEW session ${session.id}, same deterministic seed.`;
  }

  function switchScenario(id: ScenarioId): void {
    activeScenario = id;
    reset(id);
  }

  /** The first inspection row, read through the session's OWN adapter. */
  async function record(): Promise<Record<string, unknown>> {
    const result = await scenario.adapter.query(
      { op: 'list', resourceId: 'inspection' },
      { permissions: ['qlt.inspection.read'], effect: 'read', actor: 'console' },
    );
    if (!result.ok) throw new Error(result.message);
    return (result.rows ?? [])[0] as Record<string, unknown>;
  }

  async function run(op: string, input?: unknown): Promise<void> {
    if (busy) return;
    busy = true;
    note = `Running ${op}…`;
    const result = await session.run(op, input);
    results = [
      ...results,
      {
        op,
        code: result.ok ? 'OK' : result.code,
        detail: result.ok ? `settled in ${result.sessionId}` : result.message,
      },
    ];
    note = result.ok
      ? `${op} settled OK in ${result.sessionId}.`
      : `${result.code} — ${result.message}`;
    busy = false;
  }

  /** Scenario 4 fencing demo: reset during the 800 ms decision window. */
  let fencing = $state(false);
  async function fencingDemo(): Promise<void> {
    if (fencing || activeScenario !== 'latency') return;
    fencing = true;
    note = 'Approve in flight (800 ms)… resetting mid-flight.';
    const current = session;
    const inFlight = current.run('inspection:approve', decisionInput('latency', await record()));
    await new Promise((resolve) => setTimeout(resolve, 150));
    // THE RESET: the old session goes stale (its in-flight result will be
    // fenced); the console adopts a fresh session with a fresh adapter.
    current.reset();
    scenario = createScenarioSession('latency');
    const result = await inFlight;
    results = [
      ...results,
      {
        op: 'inspection:approve (reset mid-flight)',
        code: result.ok ? 'OK' : result.code,
        detail: result.ok ? 'settled' : result.message,
      },
    ];
    note = result.ok
      ? 'UNEXPECTED: the late result was applied — this would be a defect.'
      : `FENCED: ${result.code} — the late result was dropped; the new session is untouched.`;
    fencing = false;
  }

  const coverage = $derived(session.coverage);
  const approveCoverage = $derived(coverage.find((entry) => entry.op === 'inspection:approve'));
</script>

<main class="app-page">
  <header class="app-header">
    <h1>Scenario console</h1>
    <p class="app-subtitle">
      The frozen eight-scenario matrix through the existing preview orchestration. Coverage is
      DECLARED per operation; resets create a new session identity and deterministically rebuild
      the same seeded state.
    </p>
  </header>

  <nav class="scenario-tabs" aria-label="Scenarios">
    {#each SCENARIO_IDS as id (id)}
      <button
        type="button"
        class="tab"
        class:active={id === activeScenario}
        onclick={() => switchScenario(id)}
      >
        {id}
      </button>
    {/each}
  </nav>

  <p class="label-line"><strong>{SCENARIO_LABELS[activeScenario]}</strong> — session <code>{session.id}</code></p>

  <section aria-label="Declared coverage" class="coverage">
    <h2>Declared coverage (implementation mode per operation)</h2>
    <table>
      <thead>
        <tr><th>Operation</th><th>Implementation</th><th>Available</th><th>Reason</th></tr>
      </thead>
      <tbody>
        {#each coverage as entry (entry.op)}
          <tr data-available={String(entry.available)}>
            <td><code>{entry.op}</code></td>
            <td>{entry.implementation}</td>
            <td>{entry.available ? 'yes' : 'no'}</td>
            <td>{entry.reason}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="app-note">
      'simulated' means the in-memory domain adapter — real rules, no persistence. 'unavailable'
      denies with SCENARIO_COVERAGE_MISSING before anything runs. This application is a proof; no
      operation here is production-ready.
    </p>
  </section>

  <section aria-label="Run" class="run-strip">
    <button
      type="button"
      class="decision-button"
      onclick={async () => {
        await run('inspection:approve', decisionInput(activeScenario, await record()));
      }}
      disabled={busy || fencing || approveCoverage?.available === false}
    >
      Run approve{activeScenario === 'conflict' ? ' (stale revision)' : ''}
    </button>
    <button type="button" class="decision-button neutral" onclick={() => run('inspection:list')} disabled={busy || fencing}>
      Run list
    </button>
    {#if activeScenario === 'latency'}
      <button type="button" class="decision-button warn" onclick={fencingDemo} disabled={busy || fencing}>
        Fencing demo: reset mid-flight
      </button>
    {/if}
    <button type="button" class="decision-button neutral" onclick={() => reset(activeScenario)} disabled={fencing}>
      Reset scenario
    </button>
    <span class="app-note" role="status">{note}</span>
  </section>

  {#if results.length > 0}
    <section aria-label="Run results">
      <h2>Results</h2>
      <ul class="results">
        {#each results as entry, index (String(index) + entry.op)}
          <li data-ok={String(entry.code === 'OK')}>
            <code>{entry.op}</code> → <strong>{entry.code}</strong>
            <span class="app-note">{entry.detail}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</main>

<style>
  .app-page {
    max-width: 960px;
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
    margin: 0 0 16px;
    font-size: 0.9rem;
  }
  .scenario-tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .tab {
    font: inherit;
    font-size: 0.85rem;
    padding: 5px 12px;
    border-radius: 999px;
    border: 1px solid #b8c2cf;
    background: #f2f5f9;
    cursor: pointer;
  }
  .tab.active {
    background: #0a6c96;
    border-color: #0a6c96;
    color: white;
  }
  .label-line {
    font-size: 0.9rem;
    margin: 0 0 14px;
  }
  .coverage table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  .coverage th,
  .coverage td {
    text-align: left;
    padding: 6px 10px;
    border-bottom: 1px solid #e3e7ee;
  }
  .coverage tr[data-available='false'] td {
    color: #8f1f1f;
  }
  .run-strip {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
    margin: 16px 0;
  }
  .decision-button {
    font: inherit;
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid #0a6c96;
    background: #0a6c96;
    color: white;
    cursor: pointer;
  }
  .decision-button.warn {
    border-color: #8f1f1f;
    background: #8f1f1f;
  }
  .decision-button.neutral {
    border-color: #45566d;
    background: #45566d;
  }
  .decision-button:disabled {
    opacity: 0.6;
    cursor: progress;
  }
  .results {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.85rem;
  }
  .results li {
    padding: 8px 10px;
    border: 1px solid #e3e7ee;
    border-radius: 8px;
  }
  .results li[data-ok='false'] {
    border-color: #f0c4c4;
    background: #fdf5f5;
  }
  .app-note {
    font-size: 0.8rem;
    color: #5b6572;
  }
  code {
    font-size: 0.85em;
  }
</style>
