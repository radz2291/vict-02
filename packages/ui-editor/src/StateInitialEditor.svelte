<script lang="ts">
  import { isUiValueOfType, type UiDocument, type UiExpression, type UiValue } from '@victframework/ui';
  import { untrack, onDestroy, type Snippet } from 'svelte';
  import { setStateInitial, type TransactionDraft } from './commands.js';
  import type { EditorLabels } from './inspector-ux.js';
  let { document, expression, labels = {}, onApply, compact = false, onDirtyChange, toolbar }: {
    toolbar?: Snippet<[{apply:()=>void;dirty:boolean}]>;
    document: UiDocument; expression?: UiExpression; labels?: EditorLabels; onApply: (draft: TransactionDraft) => boolean | void; compact?: boolean; onDirtyChange?: (dirty: boolean) => void;
  } = $props();
  const key = $derived(expression?.type === 'ref' && expression.path.startsWith('state.') ? expression.path.slice(6) : '');
  const declaration = $derived(document.localState[key]);
  let raw = $state('');
  let error = $state('');
  $effect(() => {
    const initial = declaration?.initial;
    raw = Array.isArray(initial) ? initial.join('\n') : String(initial ?? '');
    error = '';
  });
  const initialRaw = $derived(Array.isArray(declaration?.initial) ? declaration.initial.join('\n') : String(declaration?.initial ?? ''));
  const dirty = $derived(raw !== initialRaw);
  $effect(() => { const changed = dirty; untrack(() => onDirtyChange?.(changed)); });
  onDestroy(() => onDirtyChange?.(false));
  function cancel() { raw = initialRaw; error = ''; onDirtyChange?.(false); }
  function apply() {
    if (!declaration) return;
    let value: UiValue;
    if (declaration.type === 'boolean') value = raw === 'true';
    else if (declaration.type === 'number') value = raw.trim() ? Number(raw) : NaN;
    else if (declaration.type === 'stringList') value = raw === '' ? [] : raw.split('\n');
    else if (declaration.type === 'numberList') value = raw.trim() === '' ? [] : raw.split('\n').map(line => line.trim() ? Number(line) : NaN);
    else value = raw;
    if (!isUiValueOfType(value, declaration.type)) { error = `Enter a valid ${declaration.type} starting value.`; return; }
    error = '';
    onDirtyChange?.(false);
    const applied = onApply(setStateInitial({requestId: crypto.randomUUID(),document,key,value}));
    if(applied === false) onDirtyChange?.(dirty);
  }
</script>
{#if declaration}
  <div class="starting-value" class:compact>
    {#if toolbar}{@render toolbar({apply,dirty})}{/if}
    <label>Starting value
      {#if declaration.type === 'boolean'}
        <select aria-label="Starting value" bind:value={raw}><option value="false">{compact ? 'No' : 'false'}</option><option value="true">{compact ? 'Yes' : 'true'}</option></select>
      {:else if declaration.type === 'number'}
        <input aria-label="Starting value" type="number" value={raw} oninput={event => raw = event.currentTarget.value} onkeydown={event => { if(event.key === 'Enter') apply(); }} />
      {:else}<textarea aria-label="Starting value" bind:value={raw} rows="3"></textarea>{/if}
    </label>
    {#if declaration.type === 'stringList' || declaration.type === 'numberList'}<p>One value per line.</p>{/if}
    {#if !compact}<p>Saved with your screen. Shared by controls connected to {labels.state?.[key] ?? key}. Use Interact for temporary test input.</p>{/if}
    <div class="value-actions">{#if !toolbar}<button type="button" disabled={compact && !dirty} onclick={apply}>{compact ? 'Apply' : 'Apply starting value'}</button>{/if}{#if compact && dirty}<button type="button" onclick={cancel}>Cancel</button>{/if}</div>
    {#if error}<p role="alert">{error}</p>{/if}
  </div>
{/if}
<style>
  .starting-value {margin:10px 0;padding:10px;border:1px solid var(--ui-editor-line,#d7dce5);border-radius:6px;background:var(--ui-editor-input,#fff);}
  .compact {margin:0;padding:0;border:0;background:transparent;}
  .value-actions {display:flex;gap:6px;margin-top:10px;} :disabled {opacity:.45;cursor:default;}
  label {display:grid;gap:5px;font-size:11px;font-weight:600;}
  input,textarea,select,button {font:inherit;box-sizing:border-box;border:1px solid var(--ui-editor-line,#d7dce5);border-radius:4px;background:var(--ui-editor-input,#fff);color:inherit;padding:6px 8px;}
  input,textarea,select {width:100%;min-width:0;} textarea {resize:vertical;}
  button {cursor:pointer;color:var(--ui-editor-accent,#355cc9);}
  p {font-size:11px;line-height:1.5;color:var(--ui-editor-muted,#667085);margin:7px 0;}
  [role=alert] {color:#a13c4b;}
  :focus-visible {outline:2px solid var(--ui-editor-accent,#355cc9);outline-offset:2px;}
</style>
