<script lang="ts">
  let { label, kind, value = '', authored = false, origin = '', effective = '', options = [], disabled = false, onChange, onReset }: {
    label: string; kind: string; value?: string; authored?: boolean; origin?: string; effective?: string; options?: readonly string[]; disabled?: boolean;
    onChange: (value: string) => void; onReset: () => void;
  } = $props();
  let draft = $state('');
  $effect(() => { draft = value; });
  const numeric = $derived(/^(-?\d*\.?\d+)(px|rem|em|%|vh|vw)?$/.exec(draft));
  function swatch(raw: string): string {
    if (/^#[\da-f]{6}$/i.test(raw)) return raw;
    if (/^#[\da-f]{3}$/i.test(raw)) return '#' + [...raw.slice(1)].map(c => c + c).join('');
    const rgb = /^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/.exec(raw) ?? /^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/.exec(effective);
    return rgb ? '#' + rgb.slice(1).map(c => Number(c).toString(16).padStart(2, '0')).join('') : '#000000';
  }
  function commit(value: string) { if (value.trim()) onChange(value.trim()); }
</script>

<div class="control">
  <div class="caption"><span>{label}</span><span class:local={authored}>{authored ? 'Override' : 'From source / preview'}</span></div>
  <div class="inputs">
    {#if kind === 'color'}
      <input type="color" aria-label={`${label} picker`} title="Choose a new solid color; text field retains non-solid or token values" value={swatch(draft)} {disabled} onchange={e => commit(e.currentTarget.value)} />
    {/if}
    {#if kind === 'choice'}
      <select aria-label={label} value={draft} {disabled} onchange={e => commit(e.currentTarget.value)}>
        <option value="">Choose…</option>
        {#if draft && !options.includes(draft)}<option value={draft}>{draft}</option>{/if}
        {#each options as option}<option value={option}>{option}</option>{/each}
      </select>
    {:else if kind === 'number' && (!draft || numeric)}
      <input type="number" step="any" aria-label={label} value={numeric?.[1] ?? ''} {disabled} placeholder="Auto" onchange={e => { if (e.currentTarget.value !== '') commit(`${e.currentTarget.value}${numeric ? numeric[2] ?? '' : 'px'}`); }} />
      <select aria-label={`${label} unit`} value={numeric ? numeric[2] ?? '' : 'px'} {disabled} onchange={e => { if (numeric) commit(`${numeric[1]}${e.currentTarget.value}`); }}>
        {#each ['px', 'rem', 'em', '%', 'vh', 'vw', ''] as unit}<option value={unit}>{unit || '—'}</option>{/each}
      </select>
    {:else}
      <input type="text" aria-label={label} bind:value={draft} {disabled} placeholder="Not set" onchange={() => commit(draft)} />
    {/if}
    <button type="button" class="reset" aria-label={`Reset ${label}`} title="Remove this override; retain shared sources" disabled={disabled || !authored} onclick={onReset}>↺</button>
  </div>
  {#if !authored && value}<button type="button" class="override" disabled={disabled} onclick={() => commit(value)}>Override {label}</button>{/if}
  {#if effective}<p>Browser now: {effective}</p>{/if}
  {#if origin}<details><summary>Value origin</summary><p>{origin}</p></details>{/if}
</div>

<style>
  .control { min-width: 0; padding: 7px 0; }
  .caption { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; margin-bottom: 5px; text-transform: capitalize; }
  .caption span:last-child { font-size: 10px; color: var(--ui-editor-muted, #667085); text-transform: none; }
  .caption .local { color: var(--ui-editor-accent, #355cc9); }
  .inputs { display: flex; gap: 4px; min-width: 0; }
  input, select, button { font: inherit; font-size: 12px; border: 1px solid var(--ui-editor-line, #d7dce5); border-radius: 5px; background: var(--ui-editor-input, #fff); color: inherit; min-height: 30px; min-width: 0; box-sizing: border-box; }
  input, select { padding: 4px 7px; flex: 1; width: 100%; }
  input[type=color] { flex: 0 0 32px; padding: 2px; }
  input[type=number] + select { flex: 0 0 58px; }
  button { flex: 0 0 29px; cursor: pointer; }
  .override { min-height: 22px; padding: 2px 6px; margin-top: 4px; font-size: 10px; color: var(--ui-editor-accent, #355cc9); }
  :disabled { opacity: .45; cursor: default; }
  :focus-visible { outline: 2px solid var(--ui-editor-accent, #355cc9); outline-offset: 2px; }
  p { font-size: 10px; line-height: 1.4; color: var(--ui-editor-muted, #667085); overflow-wrap: anywhere; margin: 3px 0 0; }
  summary { font-size: 10px; color: var(--ui-editor-muted, #667085); cursor: pointer; }
</style>
