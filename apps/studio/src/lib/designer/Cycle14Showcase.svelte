<script lang="ts">
  import './disclosures.css';
  import WorkspacePanelsShowcase from "./WorkspacePanelsShowcase.svelte";
  import { ControlScope, DocumentHost } from '@victframework/ui-svelte';
  import { Popover } from '@victframework/ui-svelte/primitives';
  import { rheaNativePatterns } from '@victframework/ui-svelte/rhea';
  import migration from '../../../../../docs/studio/CYCLE-1-4-CATALOG-MIGRATION.json';
  import { catalogDescriptors, catalogImplementations, compileScreen } from './application.js';
  import { createShowcaseFixture } from './showcase.js';
  import AgentTurnEvidence from './AgentTurnEvidence.svelte';
  import type { TurnMetrics, ObservedRegion } from './agent-progress.js';
  let evidenceState = $state<'complete' | 'partial' | 'unavailable'>('complete');
  const simulatedMetrics: TurnMetrics = {elapsedMs:48000,toolCalls:12,completedCalls:11,refusedCalls:1,recoveryAttempts:1,toolElapsedMs:15000,toolActiveMs:12000,outsideToolMs:36000,providerRequests:8,visionRequests:2,firstEditMs:12500,acknowledgementMs:800,confirmedEdits:6,categories:{knowledge:2,source:2,edit:6,observe:2,other:0},usage:{inputTokens:1800,outputTokens:900,totalTokens:2700},modelSteps:null,cost:null};
  const simulatedPartialMetrics: TurnMetrics = {...simulatedMetrics,partial:true,elapsedMs:24000,toolCalls:6,completedCalls:5,refusedCalls:1,recoveryAttempts:0,toolElapsedMs:7000,toolActiveMs:6000,outsideToolMs:18000,providerRequests:0,visionRequests:0,confirmedEdits:2,categories:{knowledge:2,source:1,edit:2,observe:1,other:0},usage:undefined};
  const simulatedUnavailableMetrics: TurnMetrics = {...simulatedMetrics,elapsedMs:9000,toolCalls:3,completedCalls:3,refusedCalls:0,recoveryAttempts:0,toolElapsedMs:500,toolActiveMs:450,outsideToolMs:8550,providerRequests:2,visionRequests:0,firstEditMs:undefined,acknowledgementMs:0,confirmedEdits:0,categories:{knowledge:2,source:1,edit:0,observe:0,other:0},usage:undefined};
  const evidenceMetrics = $derived(evidenceState==='complete'?simulatedMetrics:evidenceState==='partial'?simulatedPartialMetrics:simulatedUnavailableMetrics);
  const simulatedRegions: readonly (ObservedRegion & {currentSource:boolean})[] = [false,true].map((currentSource,index)=>({cursor:{documentId:'simulated-showcase',revision:`r1#${currentSource?6:2}`,digest:`simulated-source-${index}`,epoch:'00000000-0000-4000-8000-000000000001'},capturedAt:`2026-10-25T00:00:${index?'48':'20'}.000Z`,imageDigest:(index?'b':'a').repeat(64),image:{width:560,height:320,sourceWidth:560,sourceHeight:1400,offsetLeft:0,offsetTop:index?640:0,cropped:true},viewport:{width:640,height:480,scrollLeft:0,scrollTop:index?640:0,devicePixelRatio:1},preview:{mode:'design',fingerprint:(index?'d':'c').repeat(64)},currentSource}));
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
        <details class="studio-disclosure"><summary>Host requirements and source</summary><p>Rendering hosts import the public Rhea stylesheet.</p>{#each selected.hostRequirements as requirement}<p>{requirement}</p>{/each}<pre>{JSON.stringify(fixture.document, null, 2)}</pre></details>
      </div>
      <div class="pattern-preview" aria-label="Actual native pattern preview">
        {#key pattern}{#if plan}<DocumentHost {plan} localState={fixture.document.localState} extensionDescriptors={catalogDescriptors} extensionImplementations={catalogImplementations} dispatch={async () => ({ok:false,code:'SHOWCASE_NO_HOST_ACTION'})} navigate={() => {}} ariaLabel={`${selected.label} native pattern`} />{:else}<p role="alert">The source could not compile.</p>{/if}{/key}
      </div>
    </div>
    <details class="studio-disclosure family-matrix"><summary>All {migration.totals.pinnedUiFamilies} pinned UI families and support limits</summary>
      <p>30 general counterparts, 13 native source patterns, 10 specialist presentations and 10 explicit host or adapter exceptions. This is a complete disposition inventory, not a claim that every upstream wrapper is authorable.</p>
      <label for="family-search">Find a family</label><input id="family-search" type="search" bind:value={query} placeholder="Family or disposition" />
      <div class="matrix-scroll"><table><thead><tr><th>Family</th><th>Support</th><th>Limits</th></tr></thead><tbody>{#each families as item}<tr><th scope="row">{item.family}</th><td>{item.disposition.replaceAll('-', ' ')}</td><td>{item.omittedFunctionality}</td></tr>{/each}</tbody></table></div>
    </details>
    <section class="evidence-guide" aria-label="Simulated agent evidence showcase">
      <h3>Agent measurements and observed regions · SIMULATED</h3>
      <p>The same evidence component appears in actual Chat details. These representative values and regions are simulated UI examples, not a real run or captured image. No model request is sent.</p>
      <label for="agent-evidence-state">Evidence state</label>
      <select id="agent-evidence-state" value={evidenceState} onchange={event=>evidenceState=event.currentTarget.value==='partial'?'partial':event.currentTarget.value==='unavailable'?'unavailable':'complete'}><option value="complete">Complete server receipt</option><option value="partial">Partial browser measurements</option><option value="unavailable">Complete receipt · usage unavailable / no edit</option></select>
      <Popover.Root>
        <Popover.Trigger class="evidence-demo-trigger">Open simulated Chat evidence</Popover.Trigger>
        <Popover.Content class="evidence-demo-popover" side="bottom" align="start" sideOffset={6} collisionPadding={12} aria-label="Simulated Chat evidence">
          <div class="evidence-demo-heading"><strong>SIMULATED evidence</strong><Popover.Close aria-label="Close simulated evidence">×</Popover.Close></div>
          <AgentTurnEvidence metrics={evidenceMetrics} regions={evidenceState==='complete'?simulatedRegions:[]} />
        </Popover.Content>
      </Popover.Root>
    </section>
    <WorkspacePanelsShowcase />
    <div class="interaction-guide"><h3>Try the workspace changes</h3><ol><li>In Design, right-click an object or the empty canvas. Try Shift+F10 on a focused target.</li><li>Use View to open Chat or Document. Both panels start closed. Choose Design, Interact or Structure in the workspace mode bar. Document on the right contains Layers, Data, Actions and Source, with only one section expanded. Structure opens on selected connections; Whole hierarchy is optional. The right panel switches between Document and Selection. Selection contains read-only Details, Relationships and Edit on canvas. Compact windows show one auxiliary panel at a time.</li><li>Switch between Design, Interact and Structure. Structure uses the main work area, using the same Document / Selection panel on the right. Canvas, graph context, drafts and Interact values are retained when visiting Structure.</li></ol><p class="muted">The examples below share the actual workspace components, including readable inspection and optional Try scenarios with Advanced state values. Standalone Chat hide/show and resizing are available in the Studio designer. The workspace panel fixture above uses the same Document accordion and Structure inspection components; the recipe gallery below retains its own disposable editor controls. Interact preserves native application menus. Actual Chat measurements and bounded visual regions come from real receipts; the evidence example above and simulated timelines remain labelled.</p></div>
  </section>
</ControlScope>

<style>
  .cycle14-showcase { padding:24px; border:1px solid var(--vict-color-border); border-radius:24px; background:var(--vict-color-surface); min-width:0; }
  header {max-width:900px} h2 {margin:6px 0 10px;font-size:28px;letter-spacing:-.035em} h3{font-size:16px} p{line-height:1.6} .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--vict-color-textMuted)}
  .pattern-grid{display:grid;grid-template-columns:minmax(220px,1fr) minmax(260px,1.4fr);gap:28px;margin-top:24px;align-items:start}.pattern-preview{min-width:0;padding:24px;background:var(--vict-color-bg);border:1px solid var(--vict-color-border);border-radius:16px;min-height:160px;overflow:auto}
  label{display:block;font-size:12px;font-weight:600;margin:10px 0 6px} select,input{max-width:100%;width:100%;padding:8px 12px;border:1px solid var(--vict-color-border);border-radius:16px;background:var(--vict-color-surface);color:var(--vict-color-text);font:inherit}
  .muted{color:var(--vict-color-textMuted);font-size:12px} a,summary{color:var(--vict-color-accent)} summary{cursor:pointer;font-weight:500} details{margin-top:20px} pre{max-height:240px;overflow:auto;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--vict-color-bg);padding:12px;border-radius:12px}
  .family-matrix,.interaction-guide{border-top:1px solid var(--vict-color-border);padding-top:20px;margin-top:24px}.matrix-scroll{max-height:420px;overflow:auto;margin-top:12px}table{width:100%;border-collapse:collapse;font-size:12px;text-align:left}th,td{padding:10px;border-bottom:1px solid var(--vict-color-border);vertical-align:top}thead th{position:sticky;top:0;background:var(--vict-color-surface)}td:last-child{min-width:220px}ol{padding-left:20px;font-size:13px}li{margin:8px 0}
  .evidence-guide{border-top:1px solid var(--vict-color-border);padding-top:20px;margin-top:24px}.evidence-guide select{max-width:300px;display:block;margin-bottom:12px}
  :global(.evidence-demo-popover[data-popover-content]){display:block;gap:0;width:280px;min-width:0;max-width:min(280px,var(--bits-floating-available-width,calc(100vw - 24px)));max-height:min(320px,var(--bits-floating-available-height,320px));overflow:auto;overscroll-behavior:contain;box-sizing:border-box;padding:12px;border:1px solid var(--vict-color-border);border-radius:8px;background:var(--vict-color-surface);color:var(--vict-color-text);box-shadow:var(--vict-elevation-high);font:11px/1.6 var(--vict-font-family,system-ui,sans-serif);overflow-wrap:anywhere}
  :global(.evidence-demo-popover h4){font-size:10px;font-weight:600;margin:14px 0 5px;color:var(--vict-color-textMuted)}:global(.evidence-demo-popover p){margin:6px 0;color:inherit}:global(.evidence-demo-heading){display:flex;align-items:center;justify-content:space-between;gap:12px}:global(.evidence-demo-heading button){font:inherit;font-size:18px;line-height:1;border:0;background:transparent;color:var(--vict-color-textMuted);padding:2px 4px;cursor:pointer}
  @media(max-width:800px){.pattern-grid{grid-template-columns:minmax(0,1fr)}.cycle14-showcase{padding:16px}.pattern-preview{padding:16px}}
</style>
