<script lang="ts">
  /**
   * QA P4 harness: mounts the GENERIC VitApp host against a real compiled
   * plan and an in-memory application boundary. Everything below VitApp
   * simulates exactly what a host supplies: resolved route data, a dispatch
   * function with structured results, invalidation, and a trusted component
   * registry. The dispatch log renders on-page (and mirrors to
   * window.__dispatchLog) so the driver can prove which mutations crossed
   * the boundary — and which never did.
   *
   * Conversation send timing is driver-controllable for the in-flight race
   * checks: window.__setSendMode('slow') holds each act.sendMessage dispatch
   * open until window.__resolveSend(ok) is called.
   */
  import { VitApp, type ActionResult } from '@victframework/ui-svelte';
  import { createComponentRegistry } from '@victframework/application/renderer';
  import '@victframework/ui-svelte/styles.css';
  import plan from './plan.json';
  import planInvalid from './plan-invalid.json';
  import HealthIsland from './HealthIsland.svelte';

  type Rec = Record<string, unknown>;
  type Message = { id: string; text: string; author: string; participant: string };

  const registry = createComponentRegistry('registry.qa.p5', '1');
  registry.register({ componentId: 'cmp.health', revision: '1', implementation: HealthIsland });
  // The invalid host gets a registry WITHOUT the declared component so the
  // renderer's structural validation produces the structured failure panel.
  const emptyRegistry = createComponentRegistry('registry.qa.p5.empty', '1');

  let showInvalid = $state(false);

  // ---- in-memory application data ---------------------------------------
  let messageSeq = 0;
  const nextId = (prefix: string) => `${prefix}-${String(++messageSeq).padStart(3, '0')}`;
  const messages = $state<Message[]>([
    { id: nextId('seed'), text: 'First seeded message from the workspace owner.', author: 'You', participant: 'user' },
    { id: nextId('seed'), text: 'Seeded assistant reply — processed by a real boundary.', author: 'Assistant', participant: 'assistant' },
  ]);
  let dataVersion = $state(0);
  let bumps = $state(0);

  const dispatchLog = $state<{ actionId: string; input: unknown; outcome: string }[]>([]);
  (window as unknown as { __dispatchLog: unknown[] }).__dispatchLog = dispatchLog;

  // Driver-controlled send behavior: 'ok' resolves immediately, 'slow'
  // holds until __resolveSend, 'throw' throws a canary error.
  let sendMode: 'ok' | 'slow' | 'throw' = 'ok';
  let heldResolver: ((result: ActionResult) => void) | null = null;
  (window as unknown as Record<string, unknown>).__setSendMode = (mode: 'ok' | 'slow' | 'throw') => {
    sendMode = mode;
  };
  (window as unknown as Record<string, unknown>).__resolveSend = (ok = true) => {
    const resolve = heldResolver;
    heldResolver = null;
    resolve?.({ ok, value: ok ? { stored: true } : null });
  };

  let path = $state(decodeURIComponent(window.location.hash.slice(1) || '/headings'));
  $effect(() => {
    window.location.hash = path;
  });
  const recordId = $derived(path.startsWith('/rec/') ? decodeURIComponent(path.slice(5)) : undefined);
  const record = $derived.by<Rec | null>(() => {
    if (recordId === undefined) return null;
    if (recordId === 'one') {
      return {
        id: 'AAAAAAAAAAAAAAAAAAAA-BBBBBBBBBBBBBBBBBBBB-CCCCCCCCCCCCCCCCCCCC',
        name: 'Full record with an intentionally long display name for wrap checks',
        status: 'active',
        config: '{"mode":"fast","retries":2,"nested":{"deep":[1,2,3],"labels":["alpha","beta","gamma"]}}',
        budget: 1200.5,
        owner: 'QA',
        notes:
          'A very long notes value that must wrap: padding words follow so the value spans several lines inside its column, including a long unbroken token UnbreakableNotesTokenABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz that must not force the page wider.',
        updated: '2026-09-26T05:45:00Z',
        tags: 'alpha, beta, gamma',
        flags: '["pinned","reviewed","escalated"]',
      };
    }
    return null;
  });

  function appendMessage(text: string, author: string, participant: string): void {
    messages.push({ id: nextId('msg'), text, author, participant });
    dataVersion += 1;
  }

  async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
    if (actionId === 'act.sendMessage') {
      const payload = (input ?? {}) as Rec;
      const text = typeof payload.text === 'string' ? payload.text : '';
      if (sendMode === 'slow') {
        // ONE log entry per dispatch attempt; its outcome mutates on
        // resolution so the driver counts real boundary crossings only.
        const entry = { actionId, input, outcome: 'PENDING' };
        dispatchLog.push(entry);
        return new Promise<ActionResult>((resolve) => {
          heldResolver = resolve;
        }).then((result) => {
          entry.outcome = result.ok ? 'OK' : `REJECTED ${result.code}`;
          if (result.ok) appendMessage(text, 'You', 'user');
          return result;
        });
      }
      if (sendMode === 'throw') {
        dispatchLog.push({ actionId, input, outcome: 'THREW' });
        throw new Error('PRIVATE-CANARY-QA4 raw dispatcher failure');
      }
      appendMessage(text, 'You', 'user');
      dispatchLog.push({ actionId, input, outcome: 'OK' });
      return { ok: true, value: { stored: true } };
    }
    if (actionId === 'act.messageDenied') {
      const result: ActionResult = { ok: false, code: 'DATA_UNAUTHORIZED', message: 'Denied by the authorization boundary.' };
      dispatchLog.push({ actionId, input, outcome: `REJECTED ${result.code}` });
      return result;
    }
    if (actionId === 'act.messageThrows') {
      dispatchLog.push({ actionId, input, outcome: 'THREW' });
      throw new Error('PRIVATE-CANARY-QA4 raw dispatcher failure');
    }
    if (actionId === 'act.bump') {
      bumps += 1;
      dataVersion += 1;
      dispatchLog.push({ actionId, input, outcome: 'OK' });
      return { ok: true, value: { bumped: bumps } };
    }
    dispatchLog.push({ actionId, input, outcome: 'REJECTED DATA_UNKNOWN_ACTION' });
    return { ok: false, code: 'DATA_UNKNOWN_ACTION', message: `unknown action ${actionId}` };
  }

  // ---- resolved route data (what a real host would refetch) --------------
  const gridRows: readonly Rec[] = [
    {
      id: 'AAAAAAAAAAAAAAAAAAAA-BBBBBBBBBBBBBBBBBBBB',
      name: 'Alpha widget with a rather long descriptive name',
      status: 'active',
      budget: 1250000,
      owner: 'QA',
      notes: 'Long note: padding text follows so the cell wraps over multiple lines inside its column at every width, proving overflow-wrap behavior in read-only table cells.',
      code: 'X',
      updated: '2026-09-26',
    },
    {
      id: 'b',
      name: 'Beta',
      status: 'paused',
      budget: 0,
      owner: 'R2',
      notes: 'Short note.',
      code: 'UnbreakableCellTokenABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      updated: '2026-09-25',
    },
    {
      id: 'c',
      name: 'Gamma',
      status: 'done',
      budget: 42.5,
      owner: 'R3',
      notes: 'Third row keeps the grid tall enough to scroll vertically at phone sizes.',
      code: 'OK',
      updated: '2026-09-24',
    },
  ];
  const listPlain: readonly Rec[] = [
    { title: 'Plain item one' },
    { title: 'Plain item two' },
    { title: 'Plain item three with a considerably longer title to exercise wrap behavior at narrow widths' },
  ];
  const listSecondary: readonly Rec[] = [
    { title: 'Item with secondary', secondary: 'the secondary value' },
    { title: 'Another item', secondary: '42.5' },
    {
      title: 'Long title item that keeps going and going at phone widths',
      secondary: 'A long secondary value that also wraps — padding words follow to fill the line and force a wrap at 320px widths.',
    },
  ];
  const listUnbroken: readonly Rec[] = [
    {
      title: 'UnbreakableTitleTokenABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz',
      secondary: 'UnbreakableSecondaryTokenABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz',
    },
  ];

  const viewData = $derived(
    (() => {
      void dataVersion; // refetch dependency (invalidation loop)
      const detailRows = record !== null ? [record] : [];
      // The standalone detail probe on /widgets always has a full record,
      // independent of the routed detail record.
      const inlineRecord: Rec = {
        id: 'AAAAAAAAAAAAAAAAAAAA-BBBBBBBBBBBBBBBBBBBB-CCCCCCCCCCCCCCCCCCCC',
        name: 'Inline record with a rather long display name for wrap checks',
        status: 'active',
        config: '{"mode":"fast","retries":2,"nested":{"deep":[1,2,3],"labels":["alpha","beta","gamma"]}}',
        budget: 1200.5,
        owner: 'QA',
        notes: 'Long inline notes value with padding so the dd wraps over several lines, including an unbroken token UnbreakableNotesTokenABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz.',
        updated: '2026-09-26T05:45:00Z',
      };
      return {
        'v.grid': { rows: gridRows },
        'v.gridEmpty': { rows: [] as Rec[] },
        'v.listPlain': { rows: listPlain },
        'v.listSecondary': { rows: listSecondary },
        'v.listUnbroken': { rows: listUnbroken },
        'v.listEmpty': { rows: [] as Rec[] },
        'v.detailRows': { rows: [inlineRecord], record: inlineRecord },
        'v.detailEmpty': { rows: [], record: null },
        'v.recDetail': { rows: detailRows, record },
        'v.related': {
          rows:
            bumps === 0
              ? []
              : [{ title: `revision bump ${bumps}`, secondary: 'derived' }],
        },
        'v.messages': { rows: [...messages] },
        'v.messagesEmpty': { rows: [] as Rec[] },
        'v.chartBar': {
          rows: [
            { status: 'planning (long category label)', budget: 400 },
            { status: 'active', budget: 1250 },
            { status: 'paused', budget: 300 },
            { status: 'done', budget: 900 },
            { status: 'archived', budget: 150 },
          ],
        },
        'v.chartLine': {
          rows: [
            { month: 'Jan', value: 120 },
            { month: 'Feb', value: 180 },
            { month: 'Mar', value: 150 },
            { month: 'Apr', value: 260 },
            { month: 'May', value: 210 },
            { month: 'Jun', value: 320 },
          ],
        },
        'v.chartEmpty': { rows: [] as Rec[] },
        'v.chartOne': { rows: [{ month: 'Only', value: 5 }] },
        'v.chartEdge': {
          rows: [
            { label: 'large', value: 1250000 },
            { label: 'zero', value: 0 },
            { label: 'negative', value: -400 },
            { label: 'small', value: 12 },
          ],
        },
        'v.chartMany': {
          rows: Array.from({ length: 12 }, (_, index) => ({
            label: `point-${index + 1}`,
            value: 20 + index * 15,
          })),
        },
      };
    })(),
  );
</script>

<div class="qa-toolbar" data-testid="qa-toolbar">
  <strong>QA nav:</strong>
  {#each ['/headings', '/widgets', '/charts', '/conversation', '/slots', '/rec/one', '/rec/missing'] as p (p)}
    <button type="button" data-testid={'qa-nav-' + p} onclick={() => (path = p)}>{p}</button>
  {/each}
  <button type="button" data-testid="qa-mount-invalid" onclick={() => (showInvalid = !showInvalid)}>
    Mount unresolvable-slot host
  </button>
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

{#if showInvalid}
  <div class="qa-invalid" data-testid="qa-invalid-host">
    <VitApp plan={planInvalid as never} registry={emptyRegistry} {dispatch} path="/" viewData={{}} />
  </div>
{/if}

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
  .qa-invalid {
    border: 2px dashed #b02a37;
    margin: 12px;
    padding: 4px;
    font: 13px system-ui;
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
