<script lang="ts">
  import { isUiValueOfType, type UiExpression, type UiValue, type UiValueType } from '@victframework/ui';
  interface Props {
    label: string;
    type: UiValueType | 'array';
    value?: UiExpression;
    defaultValue?: UiValue;
    references: readonly string[];
    onCommit: (expression: UiExpression | undefined) => void;
  }
  let { label, type, value, defaultValue, references, onCommit }: Props = $props();
  let mode = $state('default');
  let raw = $state('');
  let error = $state('');
  const list = $derived(type === 'array' || type === 'stringList' || type === 'numberList');
  const binding = $derived(value?.type === 'ref' ? value.path : undefined);
  $effect(() => {
    mode = value === undefined ? 'default' : value.type === 'literal' ? 'literal' : 'binding';
    raw = value?.type === 'literal' ? String(value.value ?? '') : value?.type === 'ref' ? value.path : '';
    error = '';
  });
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
    onCommit({ type: 'literal', value: candidate });
  }
  function choose(next: string): void {
    mode = next; error = '';
    if (next === 'default') onCommit(undefined);
    if (next === 'literal') raw = value?.type === 'literal' ? String(value.value ?? '') : String(defaultValue ?? (type === 'boolean' ? false : ''));
  }
</script>

<div class="expression-editor">
  <label>{label} <span>({type})</span>
    <select aria-label={`${label} source`} value={mode} onchange={event => choose(event.currentTarget.value)}>
      <option value="default">{defaultValue === undefined ? 'Unset' : 'Default'}</option>
      {#if !list}<option value="literal">Literal</option>{/if}
      <option value="binding">Binding</option>
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
      <input aria-label={`${label} value`} value={raw} oninput={event => raw = event.currentTarget.value} onkeydown={event => { if (event.key === 'Enter') literal(); }} />
      <button type="button" onclick={literal}>Apply value</button>
    {/if}
  {:else}
    {#if value !== undefined && value.type !== 'literal'}<p>Bound to: {describe(value)}</p>{/if}
    <select aria-label={`${label} reference`} value={binding ?? ''} onchange={event => { if (event.currentTarget.value) onCommit({ type: 'ref', path: event.currentTarget.value }); }}>
      <option value="">Choose a compatible reference…</option>
      {#if binding && !references.includes(binding)}<option value={binding}>{binding} (existing)</option>{/if}
      {#each references as reference (reference)}<option value={reference}>{reference}</option>{/each}
    </select>
    {#if !references.length}<p>No compatible references are declared.</p>{/if}
  {/if}
  {#if error}<p role="alert">{error}</p>{/if}
</div>

<style>
  .expression-editor { margin-block: 8px; }
  label { display: grid; gap: 4px; font-size: 12px; }
  label span, p { color: #67758c; font-size: 11px; }
  select, input { width: 100%; box-sizing: border-box; padding: 5px; border: 1px solid #dfe4ec; border-radius: 4px; }
  button { margin-top: 4px; }
</style>
