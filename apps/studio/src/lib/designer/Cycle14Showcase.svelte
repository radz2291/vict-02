<script lang="ts">
  import { ControlScope, DocumentHost } from '@victframework/ui-svelte';
  import { rheaNativePatterns } from '@victframework/ui-svelte/rhea';
  import migration from '../../../../../docs/studio/CYCLE-1-4-CATALOG-MIGRATION.json';
  import { catalogDescriptors, catalogImplementations, compileScreen } from './application.js';
  import { createShowcaseFixture } from './showcase.js';
  let pattern = $state('alert');
  let query = $state('');
  const fixture = $derived(createShowcaseFixture(`rhea-${pattern}`));
  const compiled = $derived(compileScreen(fixture.document));
  const plan = $derived(compiled.ok ? compiled.plan.documentPlans?.[`${fixture.document.id}@${fixture.document.revision}`] : undefined);
  const selected = $derived(rheaNativePatterns.find(item => item.id === pattern)!);
  const families = $derived(migration.families.filter(item => `${item.family} ${item.disposition}`.toLowerCase().includes(query.toLowerCase())));
</script>

<ControlScope class="vict-rhea">
  <section class="cycle14-showcase" aria-label="Cycle 1.4 additions">
    <header><p class="eyebrow">Cycle 1.4</p><h2>One visual language. The same source.</h2><p>Try the new reusable native patterns, then use the Designer example below for context menus and inspection details. All examples are disposable; no model requests are sent.</p></header>
    <div class="pattern-grid">
      <div>
        <label for="rhea-pattern">Native pattern</label>
        <select id="rhea-pattern" bind:value={pattern}>{#each rheaNativePatterns as item}<option value={item.id}>{item.label}</option>{/each}</select>
        <p>{selected.description}</p>
        <p class="muted">These are editable native compositions, alongside the registered component catalog.</p>
        <a href={`/showcase?recipe=rhea-${pattern}#designer`}>Open in the disposable Designer</a>
        <details><summary>Host requirements and source</summary><p>Rendering hosts import the public Rhea stylesheet.</p>{#each selected.hostRequirements as requirement}<p>{requirement}</p>{/each}<pre>{JSON.stringify(fixture.document, null, 2)}</pre></details>
      </div>
      <div class="pattern-preview" aria-label="Actual native pattern preview">
        {#key pattern}{#if plan}<DocumentHost {plan} localState={fixture.document.localState} extensionDescriptors={catalogDescriptors} extensionImplementations={catalogImplementations} dispatch={async () => ({ok:false,code:'SHOWCASE_NO_HOST_ACTION'})} navigate={() => {}} ariaLabel={`${selected.label} native pattern`} />{:else}<p role="alert">The source could not compile.</p>{/if}{/key}
      </div>
    </div>
    <details class="family-matrix"><summary>All {migration.totals.pinnedUiFamilies} pinned UI families and support limits</summary>
      <p>30 general counterparts, 13 native source patterns, 10 specialist presentations and 10 explicit host or adapter exceptions. This is a complete disposition inventory, not a claim that every upstream wrapper is authorable.</p>
      <label for="family-search">Find a family</label><input id="family-search" type="search" bind:value={query} placeholder="Family or disposition" />
      <div class="matrix-scroll"><table><thead><tr><th>Family</th><th>Support</th><th>Limits</th></tr></thead><tbody>{#each families as item}<tr><th scope="row">{item.family}</th><td>{item.disposition.replaceAll('-', ' ')}</td><td>{item.omittedFunctionality}</td></tr>{/each}</tbody></table></div>
    </details>
    <div class="interaction-guide"><h3>Try the workspace changes</h3><ol><li>In Design, right-click an object or the empty canvas. Try Shift+F10 on a focused target.</li><li>Open Document → Layers or Structure, select a source, and deliberately open Inspect.</li><li>Resize or expand the details, then close them. The canvas and its floating editing tools retain their places.</li></ol><p class="muted">The examples below share the actual workspace components. Interact preserves native application menus. Chat measurements and bounded visual regions come from real receipts; simulated timelines remain labelled.</p></div>
  </section>
</ControlScope>

<style>
  .cycle14-showcase { padding:24px; border:1px solid var(--vict-color-border); border-radius:24px; background:var(--vict-color-surface); min-width:0; }
  header {max-width:900px} h2 {margin:6px 0 10px;font-size:28px;letter-spacing:-.035em} h3{font-size:16px} p{line-height:1.6} .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--vict-color-textMuted)}
  .pattern-grid{display:grid;grid-template-columns:minmax(220px,1fr) minmax(260px,1.4fr);gap:28px;margin-top:24px;align-items:start}.pattern-preview{min-width:0;padding:24px;background:var(--vict-color-bg);border:1px solid var(--vict-color-border);border-radius:16px;min-height:160px;overflow:auto}
  label{display:block;font-size:12px;font-weight:600;margin:10px 0 6px} select,input{max-width:100%;width:100%;padding:8px 12px;border:1px solid var(--vict-color-border);border-radius:16px;background:var(--vict-color-surface);color:var(--vict-color-text);font:inherit}
  .muted{color:var(--vict-color-textMuted);font-size:12px} a,summary{color:var(--vict-color-accent)} summary{cursor:pointer;font-weight:500} details{margin-top:20px} pre{max-height:240px;overflow:auto;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--vict-color-bg);padding:12px;border-radius:12px}
  .family-matrix,.interaction-guide{border-top:1px solid var(--vict-color-border);padding-top:20px;margin-top:24px}.matrix-scroll{max-height:420px;overflow:auto;margin-top:12px}table{width:100%;border-collapse:collapse;font-size:12px;text-align:left}th,td{padding:10px;border-bottom:1px solid var(--vict-color-border);vertical-align:top}thead th{position:sticky;top:0;background:var(--vict-color-surface)}td:last-child{min-width:220px}ol{padding-left:20px;font-size:13px}li{margin:8px 0}
  @media(max-width:800px){.pattern-grid{grid-template-columns:minmax(0,1fr)}.cycle14-showcase{padding:16px}.pattern-preview{padding:16px}}
</style>
