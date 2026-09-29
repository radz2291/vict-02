<script lang="ts">
  /**
   * NAMED CUSTOM OPERATOR COMPONENT `cmp.target-connection-status@1`
   * (code island, trusted local registry).
   *
   * JUSTIFICATION (recorded per G1 deliverable): target connection
   * semantics do not fit any shipped ui-svelte surface role. One target
   * row must render ONE of FOUR DISTINCT TRUTHFUL states
   * (connected | rejected | unreachable | absent) with per-state tone,
   * actor/scopes/selected-version disclosure for the connected case,
   * and screen-reader live semantics. `list`/`view`/`status`/`detail`
   * roles cannot express per-row conditional disclosure with
   * state-specific truthfulness, so a named island is warranted.
   *
   * The component receives ONLY its declared props (rows from the
   * declared view, optional label) — never the runtime, the adapter,
   * the registry, or any credential. `credentialRef`/tokens never reach
   * the browser, so nothing token-like can be rendered here.
   */
  import type { TargetStatusRow, TargetConnectionState } from '$lib/shared/contract.js';

  interface Props {
    rows?: readonly TargetStatusRow[];
    label?: string;
  }
  let { rows = [], label = 'Target connection' }: Props = $props();

  /** The only four truthful states; everything else is rendered as absent. */
  const TRUTHFUL_STATE_LABELS: Readonly<Record<TargetConnectionState, string>> = {
    connected: 'Connected',
    rejected:
      'Target rejected the Studio credential (401/403) — check the deployment provisioning.',
    unreachable: 'unreachable',
    absent: 'No provisioned target with this id.',
  };

  function stateLabel(row: TargetStatusRow): string {
    if (row.state === 'unreachable') return `Target unreachable at ${row.endpoint}.`;
    return TRUTHFUL_STATE_LABELS[row.state] ?? TRUTHFUL_STATE_LABELS.absent;
  }

  function toneClass(row: TargetStatusRow): string {
    switch (row.state) {
      case 'connected':
        return 'tone-success';
      case 'rejected':
        return 'tone-danger';
      case 'unreachable':
        return 'tone-warning';
      default:
        return 'tone-neutral';
    }
  }

  function scopeList(row: TargetStatusRow): string {
    return row.scopes.join(', ');
  }

  function selectedList(row: TargetStatusRow): string {
    return Object.entries(row.selected ?? {})
      .map(([graphId, version]) => `${graphId}: ${version}`)
      .join('; ');
  }
</script>

<section class="target-status" role="status" aria-live="polite">
  <h3 class="target-status-label">{label}</h3>
  <ul class="target-list">
    {#each rows as row (row.id)}
      <li class="target-item {toneClass(row)}">
        <details>
          <summary>
            <span class="target-name">{row.label} ({row.id})</span>
            <span class="target-state">{stateLabel(row)}</span>
          </summary>
          <dl class="target-detail">
            <dt>Endpoint</dt>
            <dd>{row.endpoint}</dd>
            {#if row.state === 'connected'}
              <dt>Actor</dt>
              <dd>{row.actorId}</dd>
              <dt>Scopes</dt>
              <dd>{scopeList(row)}</dd>
              {#if row.selected !== null && Object.keys(row.selected ?? {}).length > 0}
                <dt>Selected versions</dt>
                <dd>{selectedList(row)}</dd>
              {/if}
            {/if}
            {#if row.detail}
              <dt>Detail</dt>
              <dd>{row.detail}</dd>
            {/if}
          </dl>
        </details>
      </li>
    {/each}
  </ul>
</section>

<style>
  .target-status {
    display: block;
  }

  .target-status-label {
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0 0 0.5rem;
  }

  .target-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .target-item {
    border: 1px solid var(--vict-color-border, #d4d4d8);
    border-radius: var(--vict-radius-base, 10px);
    padding: 0.5rem 0.75rem;
  }

  .target-item details summary {
    cursor: pointer;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
    padding: 0.25rem;
    border-radius: 6px;
  }

  .target-item details summary:focus-visible {
    outline: 2px solid var(--vict-color-focus-ring, #0f766e);
    outline-offset: 2px;
  }

  .target-name {
    font-weight: 600;
  }

  /* Distinct tone per truthful state (ui-svelte styles.css tokens). */
  .tone-success {
    border-color: var(--vict-color-success, #1e7145);
  }

  .tone-success .target-state {
    color: var(--vict-color-success, #1e7145);
    font-weight: 600;
  }

  .tone-warning {
    border-color: var(--vict-color-warning, #b45309);
  }

  .tone-warning .target-state {
    color: var(--vict-color-warning, #b45309);
    font-weight: 600;
  }

  .tone-danger {
    border-color: var(--vict-color-danger, #b91c1c);
  }

  .tone-danger .target-state {
    color: var(--vict-color-danger, #b91c1c);
    font-weight: 600;
  }

  .tone-neutral .target-state {
    color: var(--vict-color-neutral, #52525b);
  }

  .target-detail {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 1rem;
    margin: 0.5rem 0 0.25rem;
    font-size: 0.875rem;
  }

  .target-detail dt {
    font-weight: 600;
  }

  .target-detail dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  /* Responsive: everything stacks under 640px. */
  @media (max-width: 640px) {
    .target-status,
    .target-list,
    .target-item {
      display: block;
      width: 100%;
    }

    .target-detail {
      grid-template-columns: 1fr;
    }

    .target-detail dt {
      margin-top: 0.25rem;
    }
  }
</style>
