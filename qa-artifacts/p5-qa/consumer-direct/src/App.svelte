<script>
  // Minimal real packed consumer of the P4 presentation: the generic VitApp
  // host + a compiled @2 plan exercising every P4 role + an in-memory
  // boundary. The custom island is CONSUMER-side code registered through the
  // component registry (registry authority stays out of ui-svelte).
  import { VitApp } from '@victframework/ui-svelte';
  import { createComponentRegistry } from '@victframework/application/renderer';
  import ConsumerIsland from './ConsumerIsland.svelte';
  import plan from './plan.json';

  // P5 QA identity probe: the direct implementation package is the single
  // renderer implementation (frozen identity, canonical factory).
  import * as directNS from '@victframework/ui-svelte';
  const directRenderer = directNS.createVictRenderer();
  window.__p5identity = {
    id: directRenderer.id,
    revision: directRenderer.revision,
    roles: [...directRenderer.supportedSurfaceRoles],
    idConst: directNS.RENDERER_ID,
    revConst: directNS.RENDERER_REVISION,
  };

  const registry = createComponentRegistry('registry.consumer.p5.direct', '1');
  registry.register({ componentId: 'cmp.health', revision: '1', implementation: ConsumerIsland });

  let messageSeq = 0;
  const nextId = () => `msg-${String(++messageSeq).padStart(3, '0')}`;
  const messages = $state([
    { id: nextId(), text: 'Seeded consumer message.', author: 'You', participant: 'user' },
  ]);
  let dataVersion = $state(0);

  const gridRows = [
    {
      id: 'AAAAAAAAAAAAAAAAAAAA-BBBBBBBBBBBBBBBBBBBB',
      name: 'Alpha widget with a rather long descriptive name',
      status: 'active', budget: 1250000, owner: 'QA',
      notes: 'Long note: padding text follows so the cell wraps over multiple lines inside its column, proving overflow-wrap behavior in read-only table cells.',
      code: 'X', updated: '2026-09-26',
    },
    { id: 'b', name: 'Beta', status: 'paused', budget: 0, owner: 'R2', notes: 'Short note.', code: 'UnbreakableCellTokenABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', updated: '2026-09-25' },
  ];
  const listPlain = [{ title: 'Plain item one' }, { title: 'Plain item two' }];
  const listSecondary = [
    { title: 'Item with secondary', secondary: 'the secondary value' },
    { title: 'Long title item that keeps going and going at phone widths', secondary: 'A long secondary value that also wraps at narrow widths.' },
  ];
  const inlineRecord = {
    id: 'AAAAAAAAAAAAAAAAAAAA-BBBBBBBBBBBBBBBBBBBB',
    name: 'Inline record with a rather long display name for wrap checks',
    status: 'active',
    config: '{"mode":"fast","retries":2,"nested":{"deep":[1,2,3]}}',
    budget: 1200.5, owner: 'QA',
    notes: 'Long inline notes value with padding so the dd wraps over several lines, including an unbroken token UnbreakableNotesTokenABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.',
    updated: '2026-09-26T05:45:00Z',
  };

  async function dispatch(actionId, input) {
    window.__dispatches = window.__dispatches ?? [];
    if (actionId === 'act.sendMessage') {
      const text = typeof input?.text === 'string' ? input.text : '';
      messages.push({ id: nextId(), text, author: 'You', participant: 'user' });
      dataVersion += 1;
      window.__dispatches.push({ actionId, input, outcome: 'OK' });
      return { ok: true, value: { stored: true } };
    }
    if (actionId === 'act.messageDenied') {
      window.__dispatches.push({ actionId, input, outcome: 'DENIED' });
      return { ok: false, code: 'DATA_UNAUTHORIZED', message: 'Denied by the authorization boundary.' };
    }
    if (actionId === 'act.messageThrows') {
      window.__dispatches.push({ actionId, input, outcome: 'THREW' });
      throw new Error('CONSUMER-CANARY raw failure');
    }
    window.__dispatches.push({ actionId, input, outcome: 'UNKNOWN' });
    return { ok: false, code: 'DATA_UNKNOWN_ACTION', message: 'unknown action ' + actionId };
  }

  let path = $state(window.location.hash.slice(1) || '/headings');
  $effect(() => { window.location.hash = path; });
  window.addEventListener('hashchange', () => {
    const next = window.location.hash.slice(1);
    if (next !== '') path = next;
  });

  const viewData = $derived.by(() => {
    void dataVersion; // refetch dependency
    return {
      'v.grid': { rows: gridRows },
      'v.gridEmpty': { rows: [] },
      'v.listPlain': { rows: listPlain },
      'v.listSecondary': { rows: listSecondary },
      'v.listUnbroken': { rows: [{ title: 'UnbreakableTitleTokenABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz', secondary: 'UnbreakableSecondaryTokenABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' }] },
      'v.listEmpty': { rows: [] },
      'v.detailRows': { rows: [inlineRecord], record: inlineRecord },
      'v.detailEmpty': { rows: [], record: null },
      'v.recDetail': { rows: [inlineRecord], record: inlineRecord },
      'v.related': { rows: [] },
      'v.messages': { rows: [...messages] },
      'v.messagesEmpty': { rows: [] },
      'v.chartBar': { rows: [
        { status: 'planning (long category label)', budget: 400 },
        { status: 'active', budget: 1250 },
        { status: 'paused', budget: 300 },
        { status: 'done', budget: 900 },
        { status: 'archived', budget: 150 },
      ] },
      'v.chartLine': { rows: [
        { month: 'Jan', value: 120 }, { month: 'Feb', value: 180 }, { month: 'Mar', value: 150 },
        { month: 'Apr', value: 260 }, { month: 'May', value: 210 }, { month: 'Jun', value: 320 },
      ] },
      'v.chartEmpty': { rows: [] },
      'v.chartOne': { rows: [{ month: 'Only', value: 5 }] },
      'v.chartEdge': { rows: [
        { label: 'large', value: 1250000 }, { label: 'zero', value: 0 },
        { label: 'negative', value: -400 }, { label: 'small', value: 12 },
      ] },
      'v.chartMany': { rows: Array.from({ length: 12 }, (_, i) => ({ label: `point-${i + 1}`, value: 20 + i * 15 })) },
    };
  });
</script>

<div class="qa-toolbar" data-testid="qa-toolbar">
  <strong>Consumer:</strong>
  {#each ['/headings', '/widgets', '/charts', '/conversation', '/slots'] as p (p)}
    <button type="button" data-testid={'qa-nav-' + p} onclick={() => (path = p)}>{p}</button>
  {/each}
</div>

<VitApp
  plan={plan}
  {registry}
  {dispatch}
  {path}
  viewData={viewData}
  record={null}
  onInvalidate={() => { dataVersion += 1; }}
/>

<pre class="qa-dispatch-log" data-testid="dispatch-log">{JSON.stringify(window.__dispatches ?? [], null, 1)}</pre>

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
    max-height: 160px;
    overflow: auto;
  }
</style>
