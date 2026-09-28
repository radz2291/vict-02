<script lang="ts">
  import Select from './Select.svelte';
  import type { UiFormField } from '@victframework/ui';
  interface Props {
    formId: string;
    field: UiFormField;
    text: string;
    checked: boolean;
    error?: string;
    disabled?: boolean;
    onText: (name: string, value: string) => void;
    onChecked: (name: string, checked: boolean) => void;
  }
  let { formId, field, text, checked, error, disabled = false, onText, onChecked }: Props = $props();
  const id = $derived(`vict-field-${formId}-${field.name}`);
  const errorId = $derived(`vict-field-error-${formId}-${field.name}`);
</script>

<div class="vict-field" class:vict-field--boolean={field.widget === 'boolean'} data-field={field.name}>
  <label class="vict-field-label" for={id}>{field.label}{field.required ? ' *' : ''}</label>
  {#if field.widget === 'json'}
    <textarea class="vict-textarea" {id} name={field.name} {disabled} rows="3"
      aria-invalid={error !== undefined ? 'true' : undefined}
      aria-describedby={error !== undefined ? errorId : undefined}
      value={text}
      oninput={(event) => onText(field.name, event.currentTarget.value)}></textarea>
  {:else if field.widget === 'select'}
    <Select {id} name={field.name} {disabled} value={text} options={field.options ?? []}
      required={field.required} invalid={error !== undefined} describedBy={error !== undefined ? errorId : undefined}
      onChange={(value) => onText(field.name, value)} />
  {:else if field.widget === 'boolean'}
    <input class="vict-checkbox" {id} name={field.name} {disabled} type="checkbox"
      aria-invalid={error !== undefined ? 'true' : undefined}
      aria-describedby={error !== undefined ? errorId : undefined}
      {checked}
      onchange={(event) => onChecked(field.name, event.currentTarget.checked)} />
  {:else}
    <input class="vict-input" {id} name={field.name} {disabled}
      type={field.widget === 'number' ? 'number' : field.widget === 'date' ? 'date' : 'text'}
      step={field.widget === 'number' ? 'any' : undefined}
      required={field.required}
      aria-invalid={error !== undefined ? 'true' : undefined}
      aria-describedby={error !== undefined ? errorId : undefined}
      value={text}
      oninput={(event) => onText(field.name, event.currentTarget.value)} />
  {/if}
  {#if error !== undefined}
    <p class="vict-field-error" id={errorId} data-testid="form-field-error-{field.name}">{error}</p>
  {/if}
</div>
