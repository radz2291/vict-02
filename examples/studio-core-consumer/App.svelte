<script lang="ts">
  import { onMount } from 'svelte';
  import { compileUiDocument, canonicalUiDocument, type UiValue } from '@victframework/ui';
  import { DocumentHost } from '@victframework/ui-svelte';
  import { bridge, registry, implementations, elements, runSourceProof, insertButton } from './proof.js';
  import '@victframework/ui-svelte/styles.css';
  import '@victframework/ui-svelte/catalog.css';
  import '@victframework/ui-ai-svelte/styles.css';
  import '@victframework/ui-flow-svelte/styles.css';
  const proof = runSourceProof();
  let version = $state(0), selected = $state(''), notice = $state('Canonical source checks completed. Try the actual rendered controls below.');
  let runtime = $state<Record<string, UiValue>>({});
  let diagnostics = $state<unknown[]>([]);
  let reset = $state(Symbol('consumer'));
  const snapshot = $derived.by(() => { void version; return bridge.getSnapshot(); });
  const source = $derived.by(() => { void version; return bridge.document; });
  const compiled = $derived(compileUiDocument(source, elements, registry.descriptors));
  onMount(() => {
    (window as unknown as { consumerProof: unknown }).consumerProof = proof;
    return bridge.subscribe(() => { version++; });
  });
  function operation(label: string, callback: () => { ok: boolean }) { const result = callback(); notice = `${label}: ${result.ok ? 'accepted' : 'refused'}`; }
  function reopen() { operation('Reopen source', () => bridge.reopen()); runtime = {}; reset = Symbol('reopen'); }
</script>
<main>
  <header><p class="eyebrow">Installed tarballs / standalone public consumer</p><h1>Canonical chat and Flow, outside Studio</h1><p>Eight framework packages installed from npm-packed local artifacts. No source aliases or workspace links. Source candidate <code>{proof.sourceCandidate}</code>.</p></header>
  <section class="proof" aria-label="Installed package proof"><h2>Source helper checks</h2><p data-testid="source-proof-status">{proof.passed ? 'PASS' : 'FAIL'} · {proof.checks.filter(item => item.passed).length}/{proof.checks.length} local checks · {proof.registryContracts} strict pinned contracts</p><details><summary>Source check evidence and boundaries</summary><pre>{JSON.stringify(proof, null, 2)}</pre></details><p><a href="/installation.json">Installed package paths and artifact hashes</a> · <a href="/capture.html">Actual public capture fixture</a></p></section>
  <section aria-label="Canonical history and memory persistence"><h2>Authoring and history</h2><div class="actions"><button onclick={() => operation('Insert registered button', insertButton)} disabled={!!source.nodes['inserted-button']}>Insert button</button><button onclick={() => operation('Remove button', () => bridge.apply({ requestId: crypto.randomUUID(), commands: [{ op: 'remove', nodeId: 'inserted-button', detachFromParent: true }] }))} disabled={!source.nodes['inserted-button']}>Remove button</button><button onclick={() => operation('Undo', () => bridge.undo())} disabled={!snapshot.canUndo}>Undo</button><button onclick={() => operation('Redo', () => bridge.redo())} disabled={!snapshot.canRedo}>Redo</button><button onclick={() => operation('Save source', () => bridge.save())}>Save source</button><button onclick={reopen}>Reopen source</button></div><p role="status">{notice}</p><p class="muted">Revision {snapshot.revision} · {snapshot.dirty ? 'unsaved source' : 'saved source'} · selection: <code>{selected || 'none'}</code>. Runtime input values are ephemeral; Save stores canonical source and initials.</p></section>
  <section aria-label="Actual canonical document rendering"><h2>Actual DocumentHost rendering</h2><p>The native input, textarea and select start from canonical state. Edit each field and leave it to commit its change; the bound text and observed local state follow. Type a chat message and send: its typed output updates local state only. The Flow diagram supports pan, zoom and keyboard selection; its topology and positions remain authored source.</p>
    {#if compiled.ok}<div class="rendered"><DocumentHost plan={compiled.plan} extensionDescriptors={registry.descriptors} extensionImplementations={implementations} localState={source.localState} resetSignal={reset} dispatch={async () => { throw Error('No execution adapter is installed.'); }} navigate={() => {}} selectOccurrence={(occurrence) => { selected = occurrence; }} onStateChange={(key, value) => { runtime = { ...runtime, [key]: value }; }} onRenderDiagnostic={(issue) => { diagnostics = [...diagnostics.slice(-19), issue]; }} /></div>{:else}<pre>{JSON.stringify(compiled, null, 2)}</pre>{/if}
  </section>
  <section><h2>Observed local state</h2><pre data-testid="runtime-state">{JSON.stringify(runtime, null, 2)}</pre><details><summary>Canonical source and current renderer diagnostics</summary><pre>{JSON.stringify({ digest: canonicalUiDocument(source).contentDigest, diagnostics, source }, null, 2)}</pre></details></section>
</main>
<style>
  :global(body) { margin: 0; background: #f4f6fa; color: #172033; font: 15px/1.5 system-ui; } main { max-width: 1100px; margin: auto; padding: 28px; } h1 { font-size: 31px; letter-spacing: -.025em; } h2 { font-size: 20px; margin-top: 0; } section { margin-top: 22px; padding: 22px; background: white; border: 1px solid #d7dfe9; border-radius: 12px; } .eyebrow { text-transform: uppercase; letter-spacing: .1em; font-size: 11px; color: #526785; } .actions { display: flex; flex-wrap: wrap; gap: 8px; } button { padding: 8px 12px; border: 1px solid #bdc9dc; border-radius: 6px; background: #fff; color: #213d80; font: inherit; cursor: pointer; } button:disabled { opacity: .45; cursor: default; } pre { padding: 12px; background: #f4f7fb; font-size: 11px; max-height: 340px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; } code { font-size: 11px; overflow-wrap: anywhere; } .muted { color: #526785; font-size: 12px; } .rendered :global([data-ui-owner-root] > div) { display: grid; gap: 18px; } .rendered :global(input[type=text]) { max-width: 400px; padding: 9px; border: 1px solid #94a3b8; border-radius: 6px; font: inherit; } @media(max-width:700px) { main { padding: 14px; } section { padding: 14px; } h1 { font-size: 25px; } }
</style>
