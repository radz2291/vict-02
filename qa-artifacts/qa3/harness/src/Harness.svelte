<script lang="ts">
  /**
   * QA P3 harness: mounts the GENERIC VitApp host against a real compiled
   * plan and an in-memory application boundary. Everything below VitApp
   * simulates exactly what a host supplies: resolved route data, a
   * dispatch function with structured results, invalidation, and a
   * trusted component registry. The dispatch log renders on-page (and
   * mirrors to window.__dispatchLog) so tests can prove which mutations
   * crossed the boundary — and which never did.
   */
  import { VitApp, type ActionResult } from '@victframework/renderer-svelte';
  import { createComponentRegistry } from '@victframework/application/renderer';
  import '@victframework/ui-svelte/styles.css';
  import plan from './plan.json';

  // ---- in-memory application data ---------------------------------------
  type Rec = Record<string, unknown>;
  const records = $state<Record<string, Rec>>({
    zero: {
      id: 'zero', name: 'Zero case', status: 'hold', starts: '2026-01-15',
      config: '{}', budget: 0, active: false,
    },
    one: {
      id: 'one', name: 'Full record', status: 'hot', starts: '2026-03-09',
      config: '{"mode":"fast","retries":2}', budget: 1200.5, discount: 25, active: true,
    },
  });
  let bumps = $state(0);
  let dataVersion = $state(0);
  let staleFlag = $state(false);
  let partialFlag = $state(false);

  const dispatchLog = $state<{ actionId: string; input: unknown; outcome: string }[]>([]);
  (window as unknown as { __dispatchLog: unknown[] }).__dispatchLog = dispatchLog;

  let path = $state(decodeURIComponent(window.location.hash.slice(1) || '/widgets'));
  $effect(() => {
    window.location.hash = path;
  });

  const recordId = $derived(path.startsWith('/rec/') ? decodeURIComponent(path.slice(5)) : undefined);
  const record = $derived((recordId !== undefined ? records[recordId] : undefined) ?? null);

  const registry = createComponentRegistry('registry.qa.p3', '1');

  // ---- the application boundary -----------------------------------------
  function reject(code: string, message: string): ActionResult {
    return { ok: false, code, message };
  }

  function validateWidgetInput(input: unknown): { ok: true; value: Rec } | { ok: false; result: ActionResult } {
    const candidate = input as Rec | null;
    if (candidate === null || typeof candidate !== 'object') {
      return { ok: false, result: reject('CONTRACT_REJECTED', 'a widget record is required') };
    }
    // Creates require name + budget; updates may adjust any subset (the
    // declared form carries only the fields it adjusts).
    if (
      candidate.__identity === undefined &&
      (typeof candidate.name !== 'string' || candidate.name.trim().length === 0)
    ) {
      return { ok: false, result: reject('CONTRACT_REJECTED', 'name is required') };
    }
    if (
      candidate.__identity === undefined &&
      (typeof candidate.budget !== 'number' || !Number.isFinite(candidate.budget))
    ) {
      return { ok: false, result: reject('CONTRACT_REJECTED', 'budget must be a finite NUMBER') };
    }
    if (
      candidate.budget !== undefined &&
      (typeof candidate.budget !== 'number' || !Number.isFinite(candidate.budget))
    ) {
      return {
        ok: false,
        result: reject('CONTRACT_REJECTED', 'budget must be a finite NUMBER when present'),
      };
    }
    if (candidate.discount !== undefined && (typeof candidate.discount !== 'number' || !Number.isFinite(candidate.discount))) {
      return { ok: false, result: reject('CONTRACT_REJECTED', 'discount must be a finite NUMBER when present') };
    }
    if (candidate.active !== undefined && typeof candidate.active !== 'boolean') {
      return { ok: false, result: reject('CONTRACT_REJECTED', 'active must be a boolean when present') };
    }
    if (candidate.id !== undefined && typeof candidate.id !== 'string') {
      return { ok: false, result: reject('CONTRACT_REJECTED', 'id must be a string when present') };
    }
    return { ok: true, value: { ...candidate } };
  }

  async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
    if (actionId === 'act.resetForm') {
      // Never happens here (VitApp handles local actions below the dispatcher).
    }
    if (actionId === 'act.delete-denied') {
      const result = reject('DATA_UNAUTHORIZED', 'Denied by the authorization boundary.');
      dispatchLog.push({ actionId, input, outcome: `REJECTED ${result.code}` });
      return result;
    }
    if (actionId === 'act.bump') {
      bumps += 1;
      dataVersion += 1;
      dispatchLog.push({ actionId, input, outcome: 'OK' });
      return { ok: true, value: { bumped: bumps } };
    }
    if (actionId === 'act.saveWidget') {
      const checked = validateWidgetInput(input);
      if (!checked.ok) {
        dispatchLog.push({ actionId, input, outcome: `REJECTED ${checked.result.code}` });
        return checked.result;
      }
      const value = checked.value;
      const identity = value.__identity;
      delete value.__identity;
      if (typeof identity === 'string') {
        records[identity] = { ...records[identity], ...value };
      } else {
        const id = String(value.id);
        if (records[id] !== undefined) {
          const result = reject('DATA_IDENTITY_CONFLICT', 'id already exists');
          dispatchLog.push({ actionId, input, outcome: `REJECTED ${result.code}` });
          return result;
        }
        records[id] = { status: 'warm', ...value };
      }
      dataVersion += 1;
      dispatchLog.push({ actionId, input, outcome: 'OK' });
      return { ok: true, value: { saved: true } };
    }
    dispatchLog.push({ actionId, input, outcome: 'REJECTED DATA_UNKNOWN_ACTION' });
    return reject('DATA_UNKNOWN_ACTION', `unknown action ${actionId}`);
  }

  // ---- resolved route data (what a real host would refetch) --------------
  const viewData = $derived(
    (() => {
      void dataVersion; // refetch dependency (invalidation loop)
      const detailRows = recordId !== undefined && records[recordId] !== undefined ? [records[recordId]] : [];
      return {
        'v.widgetDetail': {
          rows: detailRows,
          record,
          stale: staleFlag,
          partial: partialFlag,
        },
        'v.related': {
          rows:
            bumps === 0
              ? []
              : [{ id: `bump-${bumps}`, name: `revision bump ${bumps}`, status: 'warm' }],
        },
        'v.none': { rows: [] as Rec[] },
      };
    })(),
  );
</script>

<div class="qa-toolbar" data-testid="qa-toolbar">
  <strong>QA nav:</strong>
  {#each ['/widgets', '/rec/zero', '/rec/one', '/tones', '/actions', '/longtabs'] as p (p)}
    <button type="button" data-testid={'qa-nav-' + p} onclick={() => (path = p)}>{p}</button>
  {/each}
  <label><input type="checkbox" bind:checked={staleFlag} data-testid="qa-stale" /> stale</label>
  <label><input type="checkbox" bind:checked={partialFlag} data-testid="qa-partial" /> partial</label>
</div>

<VitApp
  plan={plan as never}
  {registry}
  {dispatch}
  {path}
  viewData={viewData as never}
  {record}
  onInvalidate={() => {
    dataVersion += 1;
  }}
  navigate={(target) => {
    path = target;
  }}
/>

<pre class="qa-dispatch-log" data-testid="dispatch-log">{JSON.stringify(dispatchLog, null, 1)}</pre>

<style>
  .qa-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding: 8px 12px;
    background: #fffbe8;
    border-bottom: 2px solid #e0c96b;
    font: 14px system-ui;
  }
  .qa-toolbar button {
    font: inherit;
    padding: 4px 8px;
    cursor: pointer;
  }
  .qa-dispatch-log {
    margin: 0;
    padding: 10px 14px;
    background: #101418;
    color: #d6e2f0;
    font: 12px/1.5 ui-monospace, Consolas, monospace;
    max-height: 240px;
    overflow: auto;
  }
</style>
