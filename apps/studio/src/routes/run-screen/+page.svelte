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
  import '$lib/designer/workspace.css';
  let source = $state<UiDocument>();
  let failure = $state('');
  let matchedWidth=$state<number>();
  let width=$state('fluid');
  let activity = $state('');
  let simulation = $state({ denied: false, failNext: false });
  let resetSignal = $state(Symbol('finished-run'));
  const adapter = createScreenSimulation(simulation);
  const compiled = $derived(source ? compileScreen(source) : undefined);
  const plan = $derived(compiled?.ok && source ? compiled.plan.documentPlans?.[`${source.id}@${source.revision}`] : undefined);
  onMount(() => {
    try {
      const params = new URLSearchParams(location.search);
      const id = params.get('screen');
      const requestedWidth=Number(params.get('width'));
      if(Number.isInteger(requestedWidth) && requestedWidth>=160 && requestedWidth<=8192){matchedWidth=requestedWidth;width='match';}
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
<ControlScope><div class="vict-app finished-screen studio-workspace">
  <header class="workspace-header">
    <a class="workspace-mark" href="/design" aria-label="VICT Studio" title="VICT Studio">V</a>
    <span class="run-screen-name">{source?screenName(source):'Saved screen'}</span>
  </header>
  <div class="workspace-tools">
    <label class="run-view-size"><span class="sr-only">Canvas width</span><select aria-label="Canvas width" bind:value={width}>
      {#if matchedWidth}<option value="match">Match designer · {matchedWidth}px</option>{/if}
      <option value="fluid">Fit canvas</option><option value="768">Tablet · 768</option><option value="390">Phone · 390</option>
    </select></label>
    <div class="run-actions"><button type="button" onclick={() => { adapter.reset(); resetSignal = Symbol('reset'); activity = ''; }}>Restart</button><a class="run-exit" href="/design">Exit</a></div>
  </div>
  <div class="workspace-scroll">
    {#if failure}<p class="failure" role="alert">{failure}</p>
    {:else if source && plan}<main class="finished-frame workspace-screen" style:max-width={width==='fluid'?'none':`${width==='match'?matchedWidth:width}px`}><DocumentHost {plan} extensionDescriptors={catalogDescriptors} extensionImplementations={catalogImplementations} localState={source.localState} actionState={screenActionState} {resetSignal} {dispatch} navigate={() => {}} ariaLabel={screenName(source)} /></main>
    {:else if compiled && !compiled.ok}<p class="failure" role="alert">Saved application compilation failed.</p>{/if}
  </div>
  <details class="workspace-simulation"><summary>Simulated execution <span>Local preview · no live effects</span></summary><div class="simulation-controls"><label><input type="checkbox" bind:checked={simulation.denied} /> Deny demo writes</label><label><input type="checkbox" bind:checked={simulation.failNext} /> Fail next action</label></div></details>
  <footer class="workspace-status"><span role="status">{activity || (source?`Saved application · ${source.revision}`:'Loading saved application…')}</span><span title={compiled?.ok?compiled.plan.applicationVersion:undefined}>{compiled?.ok?`@3 · ${compiled.plan.applicationVersion.slice(0,15)}…`:''}</span></footer>
</div></ControlScope>
<style>
  :global(body:has(.finished-screen)){margin:0;}
  .run-screen-name {margin-left:auto;font-size:12px;font-weight:550;max-width:45%;overflow:hidden;text-overflow:ellipsis;}
  button,select,.run-exit {font:inherit;border:1px solid #dce2eb;background:white;color:#65748d;border-radius:4px;padding:4px 7px;cursor:pointer;font-size:11px;}
  .run-actions {display:flex;align-items:center;gap:6px;}
  .run-exit {text-decoration:none;}
  .run-view-size select {border-color:transparent;background:transparent;max-width:230px;}
  .simulation-controls {padding:0 14px 14px;display:flex;gap:14px;flex-wrap:wrap;}
  .simulation-controls label {display:inline-flex;align-items:center;gap:6px;}
  .failure {margin:20px;padding:12px;border:1px solid #dce2eb;border-radius:6px;}
  .sr-only {position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;}
</style>
