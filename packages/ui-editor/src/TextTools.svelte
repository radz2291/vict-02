<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import { resolvePanelColor, colorWithAlpha } from './color-ux.js';
  let { value, origin, authored, locked, disabled = false, onEdit, onChange, onReset, rules, contextLabel }: {
    value: (property: string) => string; origin: (property: string) => string;
    authored: (property: string) => boolean; locked: (property: string) => boolean; disabled?: boolean;
    onEdit?: () => void; onChange: (property: string, value: string) => void;
    onReset: (property: string) => void; rules: Snippet; contextLabel: string;
  } = $props();
  const pages = ['Content', 'Font', 'Paragraph', 'Rules', 'Reset'] as const;
  let page = $state<typeof pages[number]>('Font');
  const uid = $props.id();
  let sourceProperty = $state('font-size');
  const color = $derived(resolvePanelColor(value('color')));
  const properties = [['font-family','Font family'],['font-size','Text size'],['font-weight','Weight'],['color','Text color'],['text-align','Alignment'],['line-height','Line height'],['letter-spacing','Letter spacing']];
  const weights = ['100','200','300','400','500','600','700','800','900','normal','bold','bolder','lighter'];
  const blocked = (property: string) => disabled || locked(property);
  function commit(property: string, raw: string, pixels = false) {const text = raw.trim();if(text) onChange(property, pixels && /^-?\d*\.?\d+$/.test(text) ? `${text}px` : text);}
  function navigate(event: KeyboardEvent) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();event.stopPropagation();
    const index = pages.indexOf(page);
    page = pages[event.key === 'Home' ? 0 : event.key === 'End' ? pages.length-1 : (index + (event.key === 'ArrowRight' ? 1 : pages.length-1)) % pages.length]!;
    void tick().then(()=>document.getElementById(`${uid}-${page}`)?.focus());
  }
</script>
<div class="text-tools">
  <div class="pages" role="tablist" aria-label="Text pages">{#each pages as item}<button type="button" role="tab" id={`${uid}-${item}`} aria-controls={`${uid}-panel`} aria-selected={page===item} tabindex={page===item ? 0 : -1} onclick={()=>page=item} onkeydown={navigate}>{item}</button>{/each}</div>
  <div class="page" role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${page}`}>
    {#if page === 'Content'}
      <div class="content"><button type="button" disabled={disabled || !onEdit} onclick={onEdit}>Edit on canvas</button><p>{onEdit ? 'Edit the selected text directly. Apply to keep it; Escape cancels.' : 'This host has not connected a canvas text editor.'}</p></div>
    {:else if page === 'Font'}
      <div class="fields">
        <label class="row">Font<input aria-label="Font family" value={value('font-family')} disabled={blocked('font-family')} onchange={e=>commit('font-family',e.currentTarget.value)} /></label>
        <div class="row"><label>Size<input class="short" aria-label="Text size" value={value('font-size')} disabled={blocked('font-size')} onchange={e=>commit('font-size',e.currentTarget.value,true)} /></label><label>Weight<select aria-label="Weight" value={value('font-weight') || '400'} disabled={blocked('font-weight')} onchange={e=>commit('font-weight',e.currentTarget.value)}>{#if value('font-weight') && !weights.includes(value('font-weight'))}<option value={value('font-weight')}>{value('font-weight')}</option>{/if}{#each weights as weight}<option value={weight}>{weight}</option>{/each}</select></label></div>
        <div class="row color-row"><label class="color-value">Color<input class="swatch" type="color" aria-label="Text color picker" value={color?.hex ?? '#000000'} disabled={blocked('color')} onchange={e=>onChange('color',color && color.alpha<1 ? colorWithAlpha(e.currentTarget.value,color.alpha) : e.currentTarget.value)} /><input aria-label="Text color" value={value('color')} disabled={blocked('color')} onchange={e=>commit('color',e.currentTarget.value)} /></label><label>Opacity<input class="opacity" type="number" aria-label="Text color opacity" min="0" max="100" value={color ? Number((color.alpha*100).toFixed(2)) : ''} disabled={blocked('color') || !color} onchange={e=>{const v=Number(e.currentTarget.value);if(color && e.currentTarget.value!=='' && Number.isFinite(v))onChange('color',colorWithAlpha(color.hex,Math.max(0,Math.min(100,v))/100));}} />%</label></div>
      </div>
    {:else if page === 'Paragraph'}
      <div class="fields"><label class="row">Alignment<select aria-label="Text alignment" value={value('text-align') || 'start'} disabled={blocked('text-align')} onchange={e=>commit('text-align',e.currentTarget.value)}>{#each ['start','left','center','right','end','justify'] as alignment}<option value={alignment}>{alignment}</option>{/each}{#if value('text-align') && !['start','left','center','right','end','justify'].includes(value('text-align'))}<option value={value('text-align')}>{value('text-align')}</option>{/if}</select></label><div class="row"><label>Line height<input class="short" aria-label="Line height" value={value('line-height')} disabled={blocked('line-height')} onchange={e=>commit('line-height',e.currentTarget.value)} /></label><label>Letter spacing<input class="short" aria-label="Letter spacing" value={value('letter-spacing')} disabled={blocked('letter-spacing')} onchange={e=>commit('letter-spacing',e.currentTarget.value,true)} /></label></div></div>
    {:else if page === 'Rules'}{@render rules()}
    {:else}
      <label class="row">Setting<select aria-label="Text setting details" bind:value={sourceProperty}>{#each properties as [property,label]}<option value={property}>{label}</option>{/each}</select></label><p class="source-value">{value(sourceProperty) || 'Not set'} · {origin(sourceProperty)}</p><button type="button" disabled={blocked(sourceProperty) || !authored(sourceProperty)} onclick={()=>onReset(sourceProperty)}>Reset selected setting</button>
    {/if}
  </div>
  <div class="context-label">{contextLabel}</div>
</div>
<style>
  .text-tools {height:168px;display:flex;flex-direction:column;font:11px/1.4 'Segoe UI',system-ui,sans-serif;color:#536176;}
  .pages {display:flex;gap:2px;flex-shrink:0;overflow-x:auto;border-bottom:1px solid #e4e8f0;padding-bottom:4px;scrollbar-width:thin;}
  button,input,select {font:inherit;color:#34425a;border:1px solid #dce2eb;border-radius:4px;background:white;box-sizing:border-box;min-width:0;height:27px;padding:3px 6px;}button {cursor:pointer;}
  .pages button {border:0;color:#78869c;background:transparent;white-space:nowrap;flex-shrink:0;}.pages button[aria-selected=true] {background:#f0f3fa;color:#405abd;font-weight:600;}
  .page {flex:1;min-height:0;overflow:auto;padding:8px 0;overscroll-behavior:contain;}
  .fields {display:grid;gap:6px;}.row,label {display:flex;align-items:center;gap:6px;min-width:0;}.row>input,.row>select {flex:1;}.row {flex-wrap:nowrap;}
  input {min-width:0;width:100%;}.short {width:65px;}.opacity {width:50px;padding:3px;}.color-value {flex:1;}.color-value input:not(.swatch) {flex:1;width:65px;}.swatch {width:27px;flex:0 0 27px;padding:2px;}
  .context-label {font-size:10px;color:#8a96a8;flex-shrink:0;border-top:1px solid #eef0f5;padding-top:4px;}
  p {font-size:11px;color:#78869c;margin:7px 0;overflow-wrap:anywhere;}.source-value {max-height:45px;overflow:auto;}
  :disabled {opacity:.4;cursor:default;}:focus-visible {outline:2px solid #5269bd;outline-offset:-1px;}
</style>
