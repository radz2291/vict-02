<script lang="ts">
  // Finished entry has no ui-editor or ui-preview dependency. It only consumes stored canonical source.
  import { onMount } from 'svelte';
  import { ControlScope, DocumentHost } from '@victframework/ui-svelte';
  import type { UiDocument } from '@victframework/ui';
  import { compileScreen, screenName, screenActionState, catalogDescriptors, catalogImplementations } from '$lib/designer/application.js';
  import { screenStore } from '$lib/designer/storage.js';
  import { createScreenSimulation, screenDispatcher } from '$lib/designer/execution.js';
  import { Menubar } from '@victframework/ui-svelte/catalog/menubar';
  import WorkspaceMenu from '$lib/designer/WorkspaceMenu.svelte';
  import WorkspaceBrand from '$lib/designer/WorkspaceBrand.svelte';
  import AuthoringGuidance from '$lib/designer/AuthoringGuidance.svelte';
  import '@victframework/ui-svelte/styles.css';
  import '@victframework/ui-svelte/catalog.css';
  import '@victframework/ui-ai-svelte/styles.css';
  import '@victframework/ui-flow-svelte/styles.css';
  import '$lib/designer/workspace.css';
  import '@victframework/ui-svelte/rhea.css';
  import '$lib/designer/studio-theme.css';
  let activeMenu=$state('');
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
  function restart() { adapter.reset(); resetSignal = Symbol('reset'); activity = ''; }
  const sizes = $derived([...(matchedWidth ? [{value:'match', label:`Match designer · ${matchedWidth}px`}] : []), {value:'fluid',label:'Fit canvas'}, {value:'768',label:'Tablet · 768'}, {value:'390',label:'Phone · 390'}]);
  async function dispatch(actionId: string, input?: unknown) {
    if (!compiled?.ok) return { ok: false, code: 'APPLICATION_INVALID', message: 'Application compilation failed.' };
    const signal = resetSignal;
    const result = await screenDispatcher(compiled.plan, adapter).execute(actionId, input);
    if (signal === resetSignal) activity = result.message ?? (result.ok ? 'Succeeded' : result.code);
    return result;
  }
</script>
<svelte:head><title>{source ? screenName(source) : 'Saved screen'} — VICT</title></svelte:head>
<ControlScope class="vict-rhea"><div class="vict-app finished-screen studio-workspace">
  <header class="workspace-header">
    <WorkspaceBrand />
    <Menubar.Root bind:value={activeMenu} class="workspace-menus" aria-label="Run menus" loop>
      <WorkspaceMenu label="File" value="file" {activeMenu}>
          <Menubar.Item onSelect={() => { location.href='/design'; }}>Exit</Menubar.Item>
      </WorkspaceMenu>
      <WorkspaceMenu label="View" value="view" {activeMenu}>
          <Menubar.RadioGroup bind:value={width} aria-label="Canvas width">
            {#each sizes as size}<Menubar.RadioItem value={size.value} closeOnSelect>{size.label}<span aria-hidden="true">{width===size.value?'\u2713':''}</span></Menubar.RadioItem>{/each}
          </Menubar.RadioGroup>
      </WorkspaceMenu>
      <WorkspaceMenu label="Run" value="run" {activeMenu}>
          <Menubar.Item onSelect={restart}>Restart</Menubar.Item>
          <Menubar.Separator />
          <Menubar.Group><Menubar.GroupHeading class="menu-caption">Simulation</Menubar.GroupHeading>
            <Menubar.CheckboxItem bind:checked={simulation.denied} closeOnSelect={false}>Deny demo writes<span aria-hidden="true">{simulation.denied?'\u2713':''}</span></Menubar.CheckboxItem>
            <Menubar.CheckboxItem bind:checked={simulation.failNext} closeOnSelect={false}>Fail next action<span aria-hidden="true">{simulation.failNext?'\u2713':''}</span></Menubar.CheckboxItem>
          </Menubar.Group>
      </WorkspaceMenu>
    </Menubar.Root>
    <span class="run-screen-name">{source?screenName(source):'Saved screen'}</span>
  </header>
  <div class="workspace-scroll">
    {#if source}<AuthoringGuidance document={source} />{/if}
    {#if failure}<p class="failure" role="alert">{failure}</p>
    {:else if source && plan}<main class="finished-frame workspace-screen" style:max-width={width==='fluid'?'none':`${width==='match'?matchedWidth:width}px`}><DocumentHost {plan} extensionDescriptors={catalogDescriptors} extensionImplementations={catalogImplementations} localState={source.localState} actionState={screenActionState} {resetSignal} {dispatch} navigate={() => {}} ariaLabel={screenName(source)} /></main>
    {:else if compiled && !compiled.ok}<p class="failure" role="alert">Saved application compilation failed.</p>{/if}
  </div>
  <div class="workspace-simulation run-simulation">Simulated execution <span>Local preview · no live effects</span></div>
  <footer class="workspace-status"><span role="status">{activity || (source?`Saved application · ${source.revision}`:'Loading saved application…')}</span><span title={compiled?.ok?compiled.plan.applicationVersion:undefined}>{compiled?.ok?`@3 · ${compiled.plan.applicationVersion.slice(0,15)}…`:''}</span></footer>
</div></ControlScope>
<style>
  :global(body:has(.finished-screen)){margin:0;}
  .run-screen-name {margin-left:auto;font-size:12px;font-weight:550;max-width:45%;overflow:hidden;text-overflow:ellipsis;}
  .run-simulation {padding:7px 10px;color:#687994;font-size:10px;}
  .run-simulation span {float:right;color:#9ba6b8;}
  @media(max-width:760px) {.run-simulation span {display:none;}}
  .failure {margin:20px;padding:12px;border:1px solid #dce2eb;border-radius:6px;}
</style>
