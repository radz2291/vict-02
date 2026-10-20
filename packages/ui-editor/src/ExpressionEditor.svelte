<script lang="ts">
  import { untrack } from 'svelte';
  import { isUiValueOfType, type UiExpression, type UiValue, type UiValueType } from '@victframework/ui';
  interface Props {
    label: string;
    displayLabel?: string;
    referenceLabels?: Readonly<Record<string, string>>;
    type: UiValueType | 'array';
    value?: UiExpression;
    defaultValue?: UiValue;
    references: readonly string[];
    compact?: boolean;
    onDraftChange?: (dirty: boolean) => void;
    onCommit: (expression: UiExpression | undefined) => boolean | void;
  }
  let { label, displayLabel, referenceLabels = {}, type, value, defaultValue, references, compact = false, onDraftChange, onCommit }: Props = $props();
  let dirty = $state(false);
  function mark(next: boolean) { dirty = next; onDraftChange?.(next); }
  function commit(expression: UiExpression | undefined) { mark(false); if(onCommit(expression) === false) mark(true); }
  function reset() { mode = value === undefined ? 'default' : value.type === 'literal' ? 'literal' : 'binding'; raw = value?.type === 'literal' ? String(value.value ?? '') : value?.type === 'ref' ? value.path : ''; error = ''; mark(false); }
  let mode = $state('default');
  let raw = $state('');
  let error = $state('');
  const list = $derived(type === 'array' || type === 'stringList' || type === 'numberList');
  const binding = $derived(value?.type === 'ref' ? value.path : undefined);
  const sourceKey = $derived(JSON.stringify(value));
  $effect(() => { sourceKey; untrack(reset); });

  function describe(expression: UiExpression): string {
    switch (expression.type) {
      case 'ref': return expression.path;
      case 'literal': return String(expression.value);
      case 'compare': return `${describe(expression.left)} ${expression.op} ${describe(expression.right)}`;
      case 'boolean': return `${expression.op} (${expression.terms.map(describe).join(', ')})`;
      case 'conditionalValue': return `when ${describe(expression.when)}, use ${describe(expression.then)}, otherwise ${describe(expression.otherwise)}`;
      case 'op': return `${expression.name} (${expression.args.map(describe).join(', ')})`;
    }
  }
  function literal(): void {
    const candidate = type === 'boolean' ? raw === 'true' : type === 'number' ? (raw.trim() === '' ? undefined : Number(raw)) : raw;
    if (type === 'array' || !isUiValueOfType(candidate, type) || Array.isArray(candidate)) {
      error = `Enter a valid ${type} value.`; return;
    }
    error = '';
    commit({ type: 'literal', value: candidate });
  }
  function choose(next: string): void {
    mode = next; error = '';
    if (next === 'default') commit(undefined); else if(onDraftChange) mark(true);
    if (next === 'literal') raw = value?.type === 'literal' ? String(value.value ?? '') : String(defaultValue ?? (type === 'boolean' ? false : ''));
  }
</script>

<svelte:window onkeydown={event=>{if(event.key==='Escape' && dirty && onDraftChange && !event.defaultPrevented){event.preventDefault();event.stopPropagation();reset();}}}/>
<div class="expression-editor" class:compact>
  <label>{displayLabel ?? label} {#if !displayLabel}<span>({type})</span>{/if}
    <select aria-label={`${label} source`} value={mode} onchange={event => choose(event.currentTarget.value)}>
      <option value="default">{defaultValue === undefined ? 'Unset' : 'Default'}</option>
      {#if !list}<option value="literal">{displayLabel ? 'Fixed value' : 'Literal'}</option>{/if}
      <option value="binding">{displayLabel ? 'State / expression' : 'Binding'}</option>
    </select>
  </label>
  {#if mode === 'default'}
    <p>{defaultValue === undefined ? 'No default declared.' : `Default: ${Array.isArray(defaultValue) ? defaultValue.join(', ') || 'empty list' : String(defaultValue) || 'empty string'}`}</p>
  {:else if mode === 'literal'}
    {#if type === 'boolean'}
      <select aria-label={`${label} value`} value={raw} onchange={event => { raw = event.currentTarget.value; literal(); }}>
        <option value="false">false</option><option value="true">true</option>
      </select>
      <button type="button" onclick={literal}>Apply value</button>
    {:else}
      <input aria-label={`${label} value`} value={raw} oninput={event => { raw = event.currentTarget.value; if(onDraftChange) mark(true); }} onkeydown={event => { if (event.key === 'Enter') {event.preventDefault(); literal();} else if(event.key==='Escape' && onDraftChange && dirty){event.preventDefault();event.stopPropagation();reset();} }} />
      <button type="button" onclick={literal}>Apply value</button>
    {/if}
  {:else}
    {#if value !== undefined && value.type !== 'literal'}<p>Bound to: {value.type === 'ref' ? referenceLabels[value.path] ?? describe(value) : describe(value)}</p>{/if}
    <select aria-label={`${label} reference`} value={binding ?? ''} onchange={event => { if (event.currentTarget.value) commit({ type: 'ref', path: event.currentTarget.value }); }}>
      <option value="">Choose a compatible reference…</option>
      {#if binding && !references.includes(binding)}<option value={binding}>{binding} (existing)</option>{/if}
      {#each references as reference (reference)}<option value={reference}>{referenceLabels[reference] ?? reference}</option>{/each}
    </select>
    {#if !references.length}<p>No compatible references are declared.</p>{/if}
  {/if}
  {#if onDraftChange && dirty}<button type="button" onclick={reset}>Cancel</button>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
</div>

<style>
  .compact {margin-block:0;}.compact :is(input,select,button) {min-height:27px;padding:4px 6px;font-size:11px;}.compact p {margin:5px 0;}
  .expression-editor { margin-block: 8px; }
  label { display: grid; gap: 4px; font-size: 11px; }
  label span, p { color: var(--ui-editor-muted,#667085); font-size: 11px; line-height:1.5; }
  select,input,button {font:inherit;box-sizing:border-box;padding:6px 8px;border:1px solid var(--ui-editor-line,#d7dce5);border-radius:4px;background:var(--ui-editor-input,#fff);color:inherit;min-height:28px;}
  select,input {width:100%;min-width:0;}
  button {margin-top:4px;cursor:pointer;}
  :focus-visible {outline:2px solid var(--ui-editor-accent,#355cc9);outline-offset:2px;}
</style>
