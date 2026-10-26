<script lang="ts">
  import './disclosures.css';
  import { onMount } from 'svelte';
  import { StateValuesPanel } from '@victframework/ui-editor';
  import type { UiDocument, UiValue } from '@victframework/ui';
  import { testScenarios, type TestScenario } from './test-scenarios.js';
  let { document, active, values, activity = [], blocked = false, onChoose, onReset, onTry, onClose, onChange }: {
    document: UiDocument; active?: string; values: Readonly<Record<string, UiValue>>; activity?: readonly string[]; blocked?: boolean;
    onChoose: (scenario: TestScenario) => void; onReset: () => void; onTry: () => void; onClose: () => void;
    onChange: (key: string, value: UiValue | undefined) => void;
  } = $props();
  const choices = $derived(testScenarios(document));
  let root: HTMLElement;
  onMount(() => root.querySelector<HTMLButtonElement>('[aria-label="Close testing"]')?.focus({preventScroll:true}));
  function keys(event: KeyboardEvent) {
    if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const closed = [...root.querySelectorAll('details:not([open])')];
    const controls = [...root.querySelectorAll<HTMLElement>('button:not(:disabled),summary,input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')].filter(element => !closed.some(details => details.contains(element) && details.querySelector(':scope > summary') !== element));
    const index = controls.indexOf(globalThis.document.activeElement as HTMLElement);
    if (controls.length && ((event.shiftKey && index <= 0) || (!event.shiftKey && index === controls.length - 1))) { event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0]?.focus(); }
  }
</script>
<!-- Keyboard handling belongs to this labelled testing surface. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="try-scenarios" aria-label="Try scenarios" bind:this={root} onkeydown={keys}>
  <header class="panel-header"><strong>Try scenarios</strong><button type="button" aria-label="Close testing" title="Close testing (Escape)" onclick={onClose}>×</button></header>
  <div class="testing-body">
    <p class="testing-intro">Each scenario starts a fresh test. Your saved design stays unchanged and nothing is sent.</p>
    <div class="scenario-list">{#each choices as choice (choice.id)}<button type="button" class="scenario-choice" aria-pressed={active === choice.id} disabled={blocked} onclick={() => onChoose(choice)}><strong>{choice.label}</strong><span>{choice.description}</span></button>{:else}<p>No ready-made scenarios for this screen yet. Choose Interact to try it directly.</p>{/each}</div>
    <div class="test-actions"><button type="button" disabled={blocked} onclick={onTry}>Try on canvas</button><button type="button" disabled={blocked} onclick={onReset}>Reset test</button></div>
    <p class="reset-hint">Reset returns temporary values to the screen’s starting values and clears simulated failures.</p>
    {#if activity.length}<details class="studio-disclosure"><summary>Recent activity ({activity.length})</summary>{#each activity as entry}<p>{entry}</p>{/each}</details>{/if}
    <details class="studio-disclosure"><summary>Advanced</summary><details class="studio-disclosure state-values"><summary>State values</summary><fieldset disabled={blocked}><StateValuesPanel localState={document.localState} stateValues={values} {onChange} /></fieldset></details></details>
  </div>
</section>
<style>
  .try-scenarios{display:flex;flex-direction:column;min-height:0;height:100%;font:12px/1.5 var(--vict-font-family,system-ui,sans-serif);color:var(--vict-color-text);background:var(--vict-color-surface,#fff)}
  .panel-header{display:flex;align-items:center;justify-content:space-between;height:38px;box-sizing:border-box;padding:5px 8px;border-bottom:1px solid var(--vict-color-border);flex:none}
  button{font:inherit;color:inherit;background:var(--vict-color-surface,#fff);border:1px solid var(--vict-color-border);border-radius:5px;padding:6px 9px;cursor:pointer}header button{width:28px;height:28px;border:0;padding:0;font-size:18px}
  .testing-body{padding:12px;overflow:auto;min-height:0}.testing-intro{margin:0 0 14px;color:var(--vict-color-textMuted)}.scenario-list{display:grid;gap:8px}.scenario-choice{text-align:left;display:grid;gap:4px;padding:10px}.scenario-choice span{font-size:11px;color:var(--vict-color-textMuted)}.scenario-choice[aria-pressed=true]{border-color:var(--vict-color-accent);background:var(--vict-control-selected)}
  .test-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.reset-hint{color:var(--vict-color-textMuted);font-size:11px;margin:8px 0 16px}details{padding:0}summary{cursor:pointer}.state-values{margin-top:8px}:focus-visible{outline:2px solid var(--vict-color-focusRing);outline-offset:-2px}:disabled{opacity:.5;cursor:default}
  fieldset{border:0;padding:0;margin:8px 0 0;min-width:0}
</style>
