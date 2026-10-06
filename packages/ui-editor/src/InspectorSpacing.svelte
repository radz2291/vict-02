<script lang="ts">
  let { type, value, effective, origin, authored, locked, disabled = false, onChange, onReset }: {
    type: 'padding' | 'margin'; value: (property: string) => string; effective: (property: string) => string; origin: (property: string) => string;
    authored: (property: string) => boolean; locked: (property: string) => boolean; disabled?: boolean;
    onChange: (values: readonly { property: string; value: string }[]) => void; onReset: (properties: readonly string[]) => void;
  } = $props();
  let linked = $state(false);
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  const blocked = $derived(disabled || sides.some(side => locked(`${type}-${side}`)));
  const owned = $derived(sides.filter(side => authored(`${type}-${side}`) && !locked(`${type}-${side}`)).map(side => `${type}-${side}`));
  function change(side: string, raw: string) {
    const trimmed = raw.trim(); if (!trimmed) return;
    const next = /^-?\d*\.?\d+$/.test(trimmed) ? `${trimmed}px` : trimmed;
    onChange((linked ? sides : [side]).map(s => ({ property: `${type}-${s}`, value: next })));
  }
</script>
<div class="spacing">
  <div class="heading"><strong>{type === 'padding' ? 'Padding · inside' : 'Margin · outside'}</strong><button type="button" aria-label={`Link ${type} sides`} aria-pressed={linked} disabled={blocked} title="Linked sides change together in one undo step" onclick={() => linked = !linked}>{linked ? 'Linked' : 'Link sides'}</button><button type="button" aria-label={`Reset ${type}`} disabled={disabled || !owned.length} title="Remove owned side overrides; retain shared values" onclick={() => onReset(owned)}>↺</button></div>
  <div class="box" class:margin={type === 'margin'}>
    {#each sides as side}<label class={side}><span>{side}</span><input type="text" inputmode="decimal" aria-label={`${type} ${side}`} value={value(`${type}-${side}`)} placeholder="Auto" disabled={disabled || locked(`${type}-${side}`) || (linked && blocked)} onchange={e => change(side, e.currentTarget.value)} />{#if effective(`${type}-${side}`) && value(`${type}-${side}`) !== effective(`${type}-${side}`)}<small title="Browser now">Now {effective(`${type}-${side}`)}</small>{/if}</label>{/each}
    <span class="center" aria-hidden="true">{type === 'padding' ? 'Content' : 'Element'}</span>
  </div>
  <details><summary>{owned.length ? `${owned.length} side overrides` : 'Source / preview'} · value details</summary>{#each sides as side}<p><strong>{side}</strong>: {value(`${type}-${side}`) || 'Not set'} · {origin(`${type}-${side}`)}</p>{/each}<p>{linked ? 'Editing one side replaces all four sides; Undo restores them together.' : 'Sides edit independently. Numbers without units use px.'}</p></details>
</div>
<style>
  .spacing { margin: 8px 0 12px; min-width: 0; } .heading { display: flex; align-items: center; gap: 4px; font-size: 11px; margin-bottom: 5px; } strong { flex: 1; font-weight: 600; }
  button, input { font: inherit; font-size: 11px; border: 1px solid var(--ui-editor-line, #d7dce5); background: var(--ui-editor-input, #fff); color: inherit; border-radius: 4px; min-width: 0; } button { cursor: pointer; min-height: 28px; padding: 3px 6px; } [aria-pressed=true] { color: var(--ui-editor-accent, #355cc9); background: var(--ui-editor-selection, #edf1ff); }
  .box { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: auto auto auto; gap: 4px; padding: 6px; background: var(--ui-editor-selection, #edf1ff); border: 1px solid var(--ui-editor-line, #d7dce5); border-radius: 5px; } .box.margin { background: var(--ui-editor-panel, #f8f9fb); border-style: dashed; }
  label { min-width: 0; text-align: center; } label span { display: block; font-size: 10px; text-transform: capitalize; color: var(--ui-editor-muted, #667085); } input { width: 100%; box-sizing: border-box; text-align: center; padding: 4px 2px; height: 28px; } .top { grid-area: 1 / 2; } .left { grid-area: 2 / 1; } .right { grid-area: 2 / 3; } .bottom { grid-area: 3 / 2; } .center { grid-area: 2 / 2; display: grid; place-items: center; font-size: 10px; border: 1px solid var(--ui-editor-line, #d7dce5); background: var(--ui-editor-input, #fff); border-radius: 3px; }
  details { font-size: 11px; margin-top: 4px; color: var(--ui-editor-muted, #667085); } summary { cursor: pointer; } p { overflow-wrap: anywhere; margin: 4px 0; } :disabled { opacity: .45; } :focus-visible { outline: 2px solid var(--ui-editor-accent, #355cc9); outline-offset: 1px; }
</style>
