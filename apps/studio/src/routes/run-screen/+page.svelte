<script lang="ts">
  // Finished entry has no ui-editor or ui-preview dependency. It only consumes stored canonical source.
  import { onMount } from 'svelte';
  import { ControlScope, DocumentHost } from '@victframework/ui-svelte';
  import type { UiDocument } from '@victframework/ui';
  import { compileScreen, screenName, screenActionState, catalogDescriptors, catalogImplementations } from '$lib/designer/application.js';
  import { screenStore } from '$lib/designer/storage.js';
  import { createScreenSimulation, screenDispatcher } from '$lib/designer/execution.js';
  import '@victframework/ui-svelte/styles.css';
  import '@victframework/ui-svelte/catalog.css';
  let source = $state<UiDocument>();
  let failure = $state('');
  let activity = $state('');
  let simulation = $state({ denied: false, failNext: false });
  let resetSignal = $state(Symbol('finished-run'));
  const adapter = createScreenSimulation(simulation);
  const compiled = $derived(source ? compileScreen(source) : undefined);
  const plan = $derived(compiled?.ok && source ? compiled.plan.documentPlans?.[`${source.id}@${source.revision}`] : undefined);
  onMount(() => {
    try {
      const id = new URLSearchParams(location.search).get('screen');
      if (!id) { failure = 'Choose a saved screen in the designer.'; return; }
      const result = screenStore(localStorage, id).rawLoad();
      if (result.status !== 'loaded') { failure = result.status === 'invalid' ? result.message : 'No saved source exists for this screen.'; return; }
      source = result.document;
    } catch { failure = 'Browser storage is unavailable. The saved source could not be read.'; }
  });
  async function dispatch(actionId: string, input?: unknown) {
    if (!compiled?.ok) return { ok: false, code: 'APPLICATION_INVALID', message: 'Application compilation failed.' };
    const signal = resetSignal;
    const result = await screenDispatcher(compiled.plan, adapter).execute(actionId, input);
    if (signal === resetSignal) activity = result.message ?? (result.ok ? 'Succeeded' : result.code);
    return result;
  }
</script>
<svelte:head><title>{source ? screenName(source) : 'Saved screen'} — VICT</title></svelte:head>
<ControlScope><div class="vict-app finished-screen">
  <header><a href="/design">← Designer</a><span>Saved application · {source?.revision ?? 'loading'}</span><button type="button" onclick={() => { adapter.reset(); resetSignal = Symbol('reset'); activity = ''; }}>Restart run</button></header>
  <div class="simulation-notice">Simulated execution · local demo adapter · no live effects <details><summary>Simulation controls</summary><label><input type="checkbox" bind:checked={simulation.denied} /> Deny demo writes</label><label><input type="checkbox" bind:checked={simulation.failNext} /> Fail next action</label></details></div>
  {#if failure}<p class="failure" role="alert">{failure}</p>
  {:else if source && plan}<main class="finished-frame"><DocumentHost {plan} extensionDescriptors={catalogDescriptors} extensionImplementations={catalogImplementations} localState={source.localState} actionState={screenActionState} {resetSignal} {dispatch} navigate={() => {}} ariaLabel={screenName(source)} /></main>
  {:else if compiled && !compiled.ok}<p class="failure" role="alert">Saved application compilation failed.</p>{/if}
  {#if activity}<p class="action-result" role="status">{activity}</p>{/if}
  {#if compiled?.ok}<footer title={compiled.plan.applicationVersion}>vict.application@3 · {compiled.plan.applicationVersion}</footer>{/if}
</div></ControlScope>
<style>
  :global(body:has(.finished-screen)){margin:0;}
  .finished-screen {min-height:100dvh;background:#fff;color:#263246;font:12px/1.5 system-ui,sans-serif;}
  header {display:flex;align-items:center;gap:20px;border-bottom:1px solid #e1e6ee;padding:12px 20px;background:#f9fafc;flex-wrap:wrap;}
  header a {color:#5269bd;text-decoration:none;} header span {color:#8190a5;margin-right:auto;}
  button {font:inherit;border:1px solid #dce2eb;background:white;color:#65748d;border-radius:5px;padding:5px 10px;cursor:pointer;}
  .simulation-notice {padding:9px 20px;background:#f4f0df;color:#817247;font-size:11px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;}
  summary {cursor:pointer;} details label {display:block;margin:8px;}
  .finished-frame {container:studio-screen / inline-size;}
  .failure,.action-result {margin:20px;padding:12px;border:1px solid #dce2eb;border-radius:6px;}
  footer {padding:12px 20px;font:10px/1.6 ui-monospace,monospace;color:#9aa5b6;overflow-wrap:anywhere;border-top:1px solid #e1e6ee;}
  :focus-visible {outline:2px solid #5269bd;outline-offset:3px;}
</style>
