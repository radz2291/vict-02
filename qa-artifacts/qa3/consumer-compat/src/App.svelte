<script>
  // Minimal real consumer: the generic VitApp host + an in-memory boundary.
  import { VitApp } from '@victframework/renderer-svelte';
  import { createComponentRegistry } from '@victframework/application/renderer';
  import plan from './plan.json';

  const records = {
    zero: {
      id: 'zero', name: 'Zero case', status: 'hold', starts: '2026-01-15',
      config: '{}', budget: 0, active: false,
    },
    one: {
      id: 'one', name: 'Full record', status: 'hot', starts: '2026-03-09',
      config: '{"mode":"fast"}', budget: 1200.5, discount: 25, active: true,
    },
  };

  let path = $state(window.location.hash.slice(1) || '/widgets');
  $effect(() => { window.location.hash = path; });
  window.addEventListener('hashchange', () => {
    const next = window.location.hash.slice(1);
    if (next !== '') path = next;
  });

  const registry = createComponentRegistry('registry.consumer', '1');

  function reject(code, message) {
    return { ok: false, code, message };
  }

  function validate(input) {
    const c = input;
    if (c === null || typeof c !== 'object') return reject('CONTRACT_REJECTED', 'a record is required');
    if (c.__identity === undefined && (typeof c.name !== 'string' || c.name.trim() === '')) return reject('CONTRACT_REJECTED', 'name is required');
    if (c.__identity === undefined && (typeof c.budget !== 'number' || !Number.isFinite(c.budget))) return reject('CONTRACT_REJECTED', 'budget must be a number');
    if (c.budget !== undefined && (typeof c.budget !== 'number' || !Number.isFinite(c.budget))) return reject('CONTRACT_REJECTED', 'budget must be a number when present');
    if (c.active !== undefined && typeof c.active !== 'boolean') return reject('CONTRACT_REJECTED', 'active must be a boolean');
    return null;
  }

  async function dispatch(actionId, input) {
    window.__dispatches = window.__dispatches ?? [];
    window.__dispatches.push({ actionId, input });
    if (actionId === 'act.delete-denied') return reject('DATA_UNAUTHORIZED', 'Denied by the authorization boundary.');
    if (actionId === 'act.saveWidget') {
      const failed = validate(input);
      if (failed !== null) return failed;
      const value = { ...input };
      const identity = value.__identity;
      delete value.__identity;
      if (typeof identity === 'string') records[identity] = { ...records[identity], ...value };
      else records[String(value.id)] = { status: 'warm', ...value };
      return { ok: true, value: { saved: true } };
    }
    return reject('DATA_UNKNOWN_ACTION', 'unknown action ' + actionId);
  }

  const recordId = $derived(path.startsWith('/rec/') ? decodeURIComponent(path.slice(5)) : undefined);
  const record = $derived((recordId !== undefined && records[recordId] !== undefined) ? records[recordId] : null);
  const viewData = $derived({
    'v.widgetDetail': { rows: record !== null ? [record] : [], record },
    'v.related': { rows: [] },
    'v.none': { rows: [] },
  });
</script>

<div class="qa-toolbar">
  {#each ['/widgets', '/rec/zero', '/rec/one', '/tones', '/actions', '/longtabs'] as p (p)}
    <button type="button" data-testid={'qa-nav-' + p} onclick={() => (path = p)}>{p}</button>
  {/each}
</div>

<VitApp
  plan={plan}
  {registry}
  {dispatch}
  {path}
  {viewData}
  {record}
  navigate={(target) => { path = target; }}
/>
