<script lang="ts">
  import { Conversation, type ConversationMessage } from '@victframework/ui-ai-svelte';
  import { newScreen } from './application.js';
  import { documentCursor } from './agent-edits.js';
  import { agentContext, type AgentReadResult } from './agent-reads.js';
  import { createTurnMetrics, phaseFailureStatus } from './agent-progress.js';
  import { createShowcaseFixture } from './showcase.js';
  import AuthoringGuidance from './AuthoringGuidance.svelte';

  const guidanceFixture=createShowcaseFixture('vict.ai.prompt-input');
  const guidanceNode=guidanceFixture.document.nodes[guidanceFixture.targetNodeId];
  // A deliberately read-only controlled value is valid source with non-blocking guidance.
  const guidanceSource=$derived.by(()=>{
    if(guidanceNode.kind!=='component')return guidanceFixture.document;
    const {outputs,...readOnlyNode}=guidanceNode;
    return {...guidanceFixture.document,nodes:{...guidanceFixture.document.nodes,[guidanceNode.id]:readOnlyNode}};
  });

  // Read-only, disposable source. This component never opens saved screens.
  const fixture = newScreen('Component knowledge preview', 'core-authoring-knowledge-fixture');
  const cursor = documentCursor(fixture, 'showcase:r1', 'core-authoring-showcase');
  interface Family { family: string; count: number; authorable: number; categories: string[] }
  interface CatalogItem { id: string; revision: string; label: string; family: string; category: string; digest: string; eligibility: { kind: string } }
  interface ContractItem { id: string; revision: string; digest: string; unchanged?: boolean; contractJson?: string; totalCharacters?: number; nextOffset?: number | null; bodyComplete?: boolean }
  const items = <T,>(read: AgentReadResult): T[] => Array.isArray(read.items) ? read.items as T[] : [];
  const families = items<Family>(agentContext(fixture, cursor, undefined, { section: 'families', limit: 20 }));
  let family = $state('ai');
  let category = $state('');
  const categories = $derived(families.find(item => item.family === family)?.categories ?? []);
  const catalog = $derived(agentContext(fixture, cursor, undefined, { section: 'catalog', family, ...(category ? { category } : {}), limit: 6 }));
  const catalogItems = $derived(items<CatalogItem>(catalog));
  const initialSelection = { id: 'vict.ai.prompt-input', revision: '1' };
  let selected = $state(initialSelection);
  let contractRead = $state(agentContext(fixture, cursor, undefined, { section: 'contracts', components: [initialSelection], limit: 20 }));
  let reuse = $state(false);
  const contracts = $derived(items<ContractItem>(contractRead));
  const bodySize = $derived(contracts.reduce((total, item) => total + (item.contractJson?.length ?? 0), 0));
  function readContract(item: Pick<CatalogItem, 'id' | 'revision'>) {
    selected = { id: item.id, revision: item.revision };
    reuse = false;
    contractRead = agentContext(fixture, cursor, undefined, { section: 'contracts', components: [selected], limit: 20 });
  }
  function reuseKnowledge() {
    if (contractRead.complete !== true) return;
    const knownDigests = Object.fromEntries(contracts.map(item => [`${item.id}@${item.revision}`, item.digest]));
    contractRead = agentContext(fixture, cursor, undefined, { section: 'contracts', components: [selected], knownDigests, limit: 20 });
    reuse = true;
  }
  function nextPage(item: ContractItem) {
    if (typeof item.nextOffset !== 'number') return;
    contractRead = agentContext(fixture, cursor, undefined, { section: 'contracts', components: [{ id: item.id, revision: item.revision }], offset: item.nextOffset, limit: 20 });
    reuse = false;
  }

  const messages: ConversationMessage[] = [
    { id: 'core-fixture-user', role: 'user', text: 'Add a controlled chat composer, then inspect the current screen.' },
    { id: 'core-fixture-assistant', role: 'assistant', text: 'Simulated recovery timeline. The edit receipt and the observation attempts remain separate.', events: [
      { id: 'core-fixture-plan', kind: 'summary', text: 'Presentation fixture · inspect the source, make one edit, then observe without replaying it.' },
      { id: 'core-fixture-edit', kind: 'activity', activity: { id: 'core-fixture-edit', title: 'studio_screen_edit · attempt 1', state: 'completed', detail: 'Simulated receipt: one acknowledged transaction at r2.', stages: [
        { id: 'core-fixture-edit-validate', title: 'Validate canonical transaction', state: 'completed', detail: 'Typed string state and valueChange binding accepted in this scripted example.' },
        { id: 'core-fixture-edit-apply', title: 'Apply edit', state: 'completed', detail: 'One simulated transaction. No second edit is needed to retry observation.' },
        { id: 'core-fixture-edit-ack', title: 'Browser acknowledgement', state: 'completed', detail: 'Fixture receipt r2; this is not a live browser acknowledgement.' },
      ] } },
      { id: 'core-fixture-observe-failed', kind: 'activity', activity: { id: 'core-fixture-observe-failed', title: 'studio_screen_observe · attempt 1', state: 'failed', detail: 'Simulated failure retained in chronological order.', stages: [
        { id: 'core-fixture-visibility', title: 'Capture visibility', state: 'failed', detail: 'Fixture phase: visibility. The preview was outside the viewport; no visual finding is established.' },
      ] } },
      { id: 'core-fixture-recovery', kind: 'text', text: 'The edit is already confirmed in this fixture. Restore preview visibility and retry only the observation.' },
      { id: 'core-fixture-observe-retry', kind: 'activity', activity: { id: 'core-fixture-observe-retry', title: 'studio_screen_observe · attempt 2', state: 'completed', detail: 'Scripted recovery example, not a provider response.', stages: [
        { id: 'core-fixture-retry-visibility', title: 'Recheck current preview', state: 'completed', detail: 'Fixture revision remains r2; no edit replay.' },
        { id: 'core-fixture-retry-observe', title: 'Observation receipt', state: 'completed', detail: 'Synthetic receipt only. Real visual and interaction verification belong in the Designer.' },
      ] } },
      { id: 'core-fixture-finish', kind: 'summary', text: 'Fixture summary · one edit, two observation attempts, failed evidence retained. This gallery makes no live completion claim.' },
    ] },
  ];
  const failureStatus = phaseFailureStatus([{ tool: 'studio_screen_observe', code: 'STUDIO_CAPTURE_NOT_VISIBLE', phase: 'visibility', reason: 'preview-covered' }]);
  let simulatedTime = 0;
  const metricFixture = createTurnMetrics(() => simulatedTime);
  metricFixture.start('edit-1', 'studio_screen_edit');
  simulatedTime = 120; metricFixture.edit(20); metricFixture.finish('edit-1', 'studio_screen_edit', true);
  metricFixture.start('observe-1', 'studio_screen_observe');
  simulatedTime = 160; metricFixture.finish('observe-1', 'studio_screen_observe', false);
  metricFixture.start('observe-2', 'studio_screen_observe');
  simulatedTime = 240; metricFixture.finish('observe-2', 'studio_screen_observe', true);
  const metrics = metricFixture.snapshot();
</script>

<div class="core-authoring-showcase">
  <header>
    <p class="eyebrow">Cycle 1.3 / core authoring</p>
    <h2>Discover components. Keep the evidence.</h2>
    <p>Explore the installed package knowledge through the actual bounded agent read path. The recovery timeline beside it uses the public Conversation component with clearly simulated receipts.</p>
  </header>
  <div class="core-grid">
    <section class="knowledge" aria-label="Live package knowledge discovery">
      <h3>Installed component knowledge</h3>
      <p class="muted">Actual local reads · disposable source · no provider requests</p>
      <div class="filters">
        <label>Family <select bind:value={family} onchange={() => { category = ''; }}>
          {#each families as item}<option value={item.family}>{item.family} · {item.count} contracts</option>{/each}
        </select></label>
        <label>Category <select bind:value={category}><option value="">All categories</option>{#each categories as value}<option {value}>{value}</option>{/each}</select></label>
      </div>
      <ul class="contract-list">
        {#each catalogItems as item}
          <li><button type="button" aria-pressed={selected.id === item.id && selected.revision === item.revision} onclick={() => readContract(item)}><span>{item.label}</span><small>{item.id}@{item.revision} · {item.eligibility.kind}</small></button></li>
        {/each}
      </ul>
      <p class="muted">Showing {catalogItems.length} of {String(catalog.total ?? 0)} matching contracts; this read is capped at 6 items.</p>
      <div class="selected-contract" aria-live="polite">
        <strong>{selected.id}@{selected.revision}</strong>
        <p>{contracts.length} contract entries · {bodySize.toLocaleString()} body characters returned · {contractRead.complete === true ? 'complete response' : 'more pages or dependencies required'}</p>
        <button type="button" class="reuse" onclick={reuseKnowledge} disabled={contractRead.complete !== true || reuse}>Re-read with these digests</button>
        {#if reuse}<p class="cache-result">{contracts.filter(item => item.unchanged).length} unchanged entries; contract bodies omitted. Source freshness still uses its own cursor.</p>{/if}
      </div>
      <details><summary>Selected contract response</summary><pre>{JSON.stringify(contractRead, null, 2)}</pre>
        {#each contracts.filter(item => typeof item.nextOffset === 'number') as item}<button type="button" onclick={() => nextPage(item)}>Next body page: {item.id}</button>{/each}
      </details>
      <details><summary>Source cursor and discovery response</summary><pre>{JSON.stringify({ cursor, catalog }, null, 2)}</pre></details>
      <p class="muted">Knowledge digests describe component contracts. They do not cache source facts or authorize product actions.</p>
    </section>
    <section class="recovery" aria-label="Simulated grouped tool attempts">
      <h3>One tool attempt, expandable stages</h3>
      <p class="simulation-label">Simulation · scripted receipts and timings · no provider execution</p>
      <div class="conversation-frame"><Conversation {messages} inputPlaceholder="Fixed presentation fixture" onSend={async () => ({ ok: false, message: 'This is a simulated presentation fixture. Use Designer Chat for a real agent turn.' })} /></div>
      <details><summary>Failure status and bounded metrics fixture</summary>
        <p>{failureStatus}</p>
        <dl><div><dt>Tool attempts</dt><dd>{metrics.toolCalls}</dd></div><div><dt>Recovery attempts</dt><dd>{metrics.recoveryAttempts}</dd></div><div><dt>Provider requests</dt><dd>{metrics.providerRequests}</dd></div><div><dt>Scripted elapsed time</dt><dd>{metrics.elapsedMs} ms</dd></div></dl>
        <p class="muted">These helper outputs use a deterministic fixture clock. Token usage, model steps and cost are unavailable.</p>
        <pre>{JSON.stringify(metrics, null, 2)}</pre>
      </details>
    </section>
  </div>
  <section aria-label="Non-blocking source guidance example"><h3>Source guidance</h3><p class="muted">Actual guidance for a disposable read-only composer. The same collapsed details appear in Document → Source and saved Run when notes exist.</p><AuthoringGuidance document={guidanceSource} /></section>
  <footer><strong>Try the actual authored compositions</strong><p><a href="/showcase?recipe=vict.ai.conversation#designer">Conversation</a><a href="/showcase?recipe=vict.ai.message#designer">Message</a><a href="/showcase?recipe=vict.ai.prompt-input#designer">Prompt input</a><a href="/showcase?recipe=vict.flow.canvas#designer">Read-only Flow canvas</a></p><span class="muted">Open the disposable Designer example to configure source, interact and review history. Chat presentation does not attach a provider; Flow presentation does not execute a workflow.</span></footer>
</div>

<style>
  .core-authoring-showcase { border: 1px solid #d7dfe9; border-radius: 12px; padding: 24px; background: #fff; overflow: hidden; }
  header { max-width: 900px; } h2 { margin: 4px 0 10px; font-size: 26px; letter-spacing: -.025em; } h3 { margin: 0 0 6px; font-size: 17px; }
  .eyebrow { margin: 0; color: #617088; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
  .core-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px; margin-top: 24px; } .core-grid section { min-width: 0; }
  .muted, .simulation-label { color: #526785; font-size: 12px; line-height: 1.5; } .simulation-label { color: #80591b; }
  .filters { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0 12px; } label { display: grid; gap: 4px; color: #526785; font-size: 12px; flex: 1; min-width: 140px; }
  select { max-width: 100%; padding: 8px; background: #fff; color: #172033; border: 1px solid #c5d0e0; border-radius: 6px; font: inherit; }
  button { cursor: pointer; font: inherit; } button:focus-visible, select:focus-visible, a:focus-visible, summary:focus-visible { outline: 2px solid #355cc9; outline-offset: 3px; }
  .contract-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; } .contract-list button { width: 100%; display: grid; gap: 3px; padding: 9px 11px; text-align: left; border: 1px solid #d7dfe9; border-radius: 7px; color: #172033; background: #fff; } .contract-list button:hover { background: #f5f7fc; } .contract-list button[aria-pressed=true] { border-color: #355cc9; background: #f0f4ff; } small { color: #617088; font-size: 11px; overflow-wrap: anywhere; }
  .selected-contract { margin-top: 16px; padding: 13px; background: #f4f7fb; border-radius: 8px; font-size: 12px; overflow-wrap: anywhere; } .selected-contract p { margin: 7px 0; } .reuse { padding: 7px 10px; color: #fff; background: #3046a5; border: 0; border-radius: 6px; font-size: 12px; } .reuse:disabled { opacity: .55; cursor: default; } .cache-result { color: #146a53; }
  details { margin-top: 12px; font-size: 12px; } summary { cursor: pointer; color: #355cc9; } pre { max-height: 260px; padding: 12px; background: #f4f7fb; border-radius: 6px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11px; }
  .conversation-frame { height: 460px; border: 1px solid #d7dfe9; border-radius: 9px; overflow: hidden; } .conversation-frame :global(.vict-ai-conversation) { height: 100%; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } dl div { background: #f4f7fb; border-radius: 6px; padding: 8px; } dt { color: #617088; } dd { margin: 2px 0 0; font-weight: 600; }
  footer { margin-top: 24px; padding-top: 18px; border-top: 1px solid #e5eaf2; font-size: 13px; } footer p { display: flex; gap: 10px 20px; flex-wrap: wrap; margin: 8px 0; } a { color: #355cc9; }
  @media (max-width: 900px) { .core-grid { grid-template-columns: 1fr; } .core-authoring-showcase { padding: 16px; } .conversation-frame { height: 430px; } }
</style>
