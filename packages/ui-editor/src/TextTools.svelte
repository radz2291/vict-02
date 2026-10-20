<script lang="ts">
  import type { Snippet } from 'svelte';
  import InspectorControl from './InspectorControl.svelte';
  import { resolvePanelColor } from './color-ux.js';
  let { text = $bindable(''), value, origin, authored, locked, disabled = false, onText, onChange, onReset, more }: {
    text?: string; value: (property: string) => string; origin: (property: string) => string;
    authored: (property: string) => boolean; locked: (property: string) => boolean; disabled?: boolean;
    onText: (value: string) => void; onChange: (property: string, value: string) => void;
    onReset: (property: string) => void; more: Snippet;
  } = $props();
  let panel = $state('');
  let sourceProperty = $state('font-size');
  const color = $derived(resolvePanelColor(value('color')));
  const bold = $derived(['bold', 'bolder'].includes(value('font-weight')) || Number(value('font-weight')) >= 600);
  const alignment = $derived(({start:'left',end:'right'} as Record<string,string>)[value('text-align')] ?? value('text-align'));
</script>
<div class="text-tools">
  <div class="strip" aria-label="Text essentials">
    <button type="button" aria-expanded={panel === 'text'} onclick={() => panel = panel === 'text' ? '' : 'text'} {disabled}>Edit text</button>
    <label>Size<input aria-label="Text size" value={value('font-size')} disabled={disabled || locked('font-size')} onchange={event => {const raw = event.currentTarget.value.trim(); if(raw) onChange('font-size', /^-?\d*\.?\d+$/.test(raw) ? `${raw}px` : raw);}} /></label>
    <button type="button" class="bold" aria-label="Bold" aria-pressed={bold} disabled={disabled || locked('font-weight')} onclick={() => onChange('font-weight', bold ? '400' : '700')}>B</button>
    <select aria-label="Text alignment" value={alignment || 'left'} disabled={disabled || locked('text-align')} onchange={event => onChange('text-align', event.currentTarget.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option>{#if alignment && !['left','center','right','justify'].includes(alignment)}<option value={alignment}>{alignment}</option>{/if}</select>
    <button type="button" class="color" aria-label="Text color settings" aria-expanded={panel === 'color'} title="Text color" onclick={() => panel = panel === 'color' ? '' : 'color'}><span style:background={color?.css ?? 'repeating-conic-gradient(#ddd 0% 25%,white 0% 50%)'}></span></button>
  </div>
  {#if panel === 'text'}<div class="expanded"><label>Text content<textarea aria-label="Text content" bind:value={text} rows="3" {disabled}></textarea></label><button type="button" {disabled} onclick={() => onText(text)}>Apply text</button></div>{/if}
  {#if panel === 'color'}<div class="expanded"><InspectorControl label="Text color" kind="color" value={value('color')} authored={authored('color')} origin={origin('color')} disabled={disabled || locked('color')} onChange={value => onChange('color', value)} onReset={() => onReset('color')} /></div>{/if}
  <details class="more"><summary>More text settings…</summary><div class="expanded">{@render more()}<details class="source"><summary>Reset &amp; value source</summary><label>Setting<select aria-label="Text setting details" bind:value={sourceProperty}><option value="font-size">Size</option><option value="font-weight">Weight</option><option value="text-align">Alignment</option></select></label><p>{origin(sourceProperty)}</p><button type="button" disabled={disabled || locked(sourceProperty) || !authored(sourceProperty)} onclick={() => onReset(sourceProperty)}>Reset selected setting</button></details></div></details>
</div>
<style>
  .text-tools {font:11px/1.4 'Segoe UI',system-ui,sans-serif;color:#536176;}
  .strip {display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:4px 0;}
  button,input,select,textarea {font:inherit;color:#34425a;border:1px solid #dce2eb;border-radius:4px;background:white;box-sizing:border-box;min-width:0;}
  button,select,input {height:27px;padding:3px 6px;} button,summary {cursor:pointer;}
  label {display:flex;align-items:center;gap:4px;} input {width:54px;}
  .bold {font-weight:700;width:27px;} button[aria-pressed=true],button[aria-expanded=true] {background:#edf1ff;color:#405abd;}
  .color {width:27px;padding:4px;}.color span {display:block;width:100%;height:100%;border-radius:2px;border:1px solid #dce2eb;}
  .expanded {padding:7px 0;}.expanded>label {display:grid;gap:4px;} textarea {width:100%;padding:6px;resize:vertical;margin-bottom:5px;}
  summary {padding:5px 0;color:#78869c;font-size:10px;} p {font-size:11px;overflow-wrap:anywhere;}
  .source {margin-top:6px;border-top:1px solid #e4e8f0;}.source select {width:100%;}
  :disabled {opacity:.4;cursor:default;}:focus-visible {outline:2px solid #5269bd;outline-offset:1px;}
</style>
