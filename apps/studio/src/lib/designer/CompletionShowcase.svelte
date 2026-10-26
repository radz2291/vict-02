<script lang="ts">
  import './disclosures.css';
  import { onDestroy } from 'svelte';
  import { Conversation, type ConversationMessage } from '@victframework/ui-ai-svelte';
  import { captureDesignerPreview, type CaptureMetadata } from './visual-observation.js';
  const cursor = { documentId: 'completion-capture-demo', revision: 'r1', digest: 'showcase-only', epoch: crypto.randomUUID() };
  const messages: ConversationMessage[] = [
    { id: 'fixture-user', role: 'user', text: 'Create two independent contact fields and inspect the visible result.' },
    { id: 'fixture-agent', role: 'assistant', text: 'Simulated recovery example. One confirmed edit remains applied; behavioral and visual verification are still pending.', events: [
      { id: 'fixture-intent', kind: 'summary', text: 'Progress summary · I will inspect the current source before editing.' },
      { id: 'fixture-read', kind: 'activity', activity: { id: 'fixture-read', title: 'Read current source', state: 'completed', detail: 'Simulated source observation: revision r1, two fields requested; no fields authored yet.' } },
      { id: 'fixture-text', kind: 'text', text: 'Each field needs its own state reference and matching change output.' },
      { id: 'fixture-refused', kind: 'activity', activity: { id: 'fixture-refused', title: 'Edit validation refused', state: 'failed', detail: 'Simulated operation 0 · operations.0.value · expected a typed expression, received a bare boolean. Nothing applied.' } },
      { id: 'fixture-retry', kind: 'text', text: 'The input shape was invalid. I will correct it and keep canonical typing.' },
      { id: 'fixture-ack', kind: 'activity', activity: { id: 'fixture-ack', title: 'Corrected edit acknowledged', state: 'completed', detail: 'Simulated receipt: revision r2, one undoable transaction. Both independent fields authored; interaction outcomes have not been exercised.' } },
      { id: 'fixture-observe', kind: 'activity', activity: { id: 'fixture-observe', title: 'Rendered observation still pending', state: 'pending', detail: 'This timeline is a fixture. The real local capture demo beside it produces actual pixels, without calling a model.' } },
      { id: 'fixture-cancelled', kind: 'activity', activity: { id: 'fixture-cancelled', title: 'Earlier observation stopped', state: 'cancelled', detail: 'Simulated Stop: the attempt ended without an observation. Late results cannot establish a current visual finding.' } },
      { id: 'fixture-partial', kind: 'summary', text: 'Partial completion · one simulated edit confirmed. Remaining work: exercise both fields and inspect a current rendered image. Compilation and acknowledgement do not establish those results.' },
    ] },
  ];
  let preview = $state<HTMLDivElement>();
  let first = $state('Avery'); let second = $state('Morgan');
  let notice = $state('Capture this actual rendered fixture. No model or server request is made.');
  let imageUrl = $state(''); let metadata = $state<CaptureMetadata>(); let busy = $state(false);
  onDestroy(() => { if (imageUrl) URL.revokeObjectURL(imageUrl); });
  async function capture() {
    if (busy) return;
    busy = true;
    const result = await captureDesignerPreview(preview, cursor, () => ({ cursor, mode: 'interact', state: { first, second } }));
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = ''; metadata = undefined;
    if (result.ok) { imageUrl = URL.createObjectURL(result.blob); metadata = result.metadata; notice = `Captured actual fixture pixels · ${result.blob.size.toLocaleString()} bytes. Appearance has not been inspected by a model.`; }
    else notice = `${result.code} · ${result.message}`;
    busy = false;
  }
</script>

<div class="completion-showcase">
  <h2>Completion round: ordered progress and actual rendered capture</h2>
  <p>The conversation uses the actual public Conversation component with an explicitly simulated event fixture. The image demo captures its existing rendered DOM locally. Neither example calls a provider, edits saved screens, or proves canonical authoring.</p>
  <div class="completion-grid">
    <section class="timeline-demo" aria-label="Simulated chronological conversation">
      <h3>Chronological recovery fixture</h3>
      <div class="conversation-frame"><Conversation {messages} onSend={async()=>({ok:false,message:'This fixed timeline is a simulated presentation fixture. Open Designer Chat for real agent execution.'})} inputPlaceholder="Presentation fixture only" /></div>
    </section>
    <section class="capture-demo" aria-label="Actual rendered capture demo">
      <h3>Actual capture, local preview</h3>
      <div class="capture-target" bind:this={preview}>
        <p class="demo-tag">Local browser fixture · current state</p>
        <h4>People joining your workspace</h4>
        <label>First person <input bind:value={first} /></label>
        <label>Second person <input bind:value={second} /></label>
        <p data-testid="independent-field-values">Visible result: <strong>{first || 'Empty'}</strong> and <strong>{second || 'Empty'}</strong></p>
      </div>
      <button type="button" onclick={capture} disabled={busy}>{busy?'Capturing…':'Capture rendered fixture'}</button>
      <p class="capture-notice" role="status">{notice}</p>
      {#if imageUrl}<img class="captured-image" src={imageUrl} alt="Actual raster capture of the rendered local two-person fixture" />{/if}
      {#if metadata}<details class="studio-disclosure"><summary>Image provenance</summary><pre>{JSON.stringify(metadata,null,2)}</pre></details>{/if}
      <p class="demo-limit">These two fields use ordinary local Svelte state solely to make capture changes visible. Canonical native input wiring, independent state, shared manual/agent transactions and declared relationship diagnosis are available in the real Designer examples below. A screenshot cannot verify bindings or actions.</p>
    </section>
  </div>
  <p><a href="#designer">Try native Input, Checkbox, Select and other recipes</a>, then switch the disposable example to Structure for search, focus, collapse, relationship layers, measured layout and source facts. The full <a href="/design">Designer</a> adds real provider execution and source-aware capture.</p>
</div>

<style>
  .completion-showcase{border:1px solid #d7dfe9;background:#fff;border-radius:12px;padding:24px;overflow:hidden}.completion-showcase h2{margin-top:0}.completion-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}.completion-grid section{min-width:0}.conversation-frame{height:660px;overflow:hidden;border:1px solid #d7dfe9;border-radius:10px}.conversation-frame :global(.vict-ai-conversation){height:100%}.capture-target{padding:22px;border:1px solid #d8e1ec;border-radius:12px;background:#f4f7fb;color:#172033;font:15px/1.5 system-ui,sans-serif}.demo-tag{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#526785}.capture-target h4{font-size:22px;line-height:1.2;margin:12px 0 22px}.capture-target label{display:grid;gap:6px;margin-bottom:16px}.capture-target input{width:100%;box-sizing:border-box;background:#fff;border:1px solid #aebed3;border-radius:6px;padding:10px;color:#172033;font:inherit}.capture-demo>button{margin-top:16px;background:#274cc5;border:0;border-radius:7px;color:#fff;padding:10px 16px;font:inherit;cursor:pointer}.capture-demo>button:disabled{opacity:.6}.captured-image{max-width:100%;border:1px solid #c5d3e6;border-radius:8px}.capture-notice,.demo-limit{font-size:13px;color:#526785}pre{max-height:280px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:11px}a{color:#355cc9}@media(max-width:900px){.completion-grid{grid-template-columns:1fr}.completion-showcase{padding:16px}.conversation-frame{height:580px}}
</style>
