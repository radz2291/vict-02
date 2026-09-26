<script lang="ts">
  import type { UiFormField } from '@victframework/ui';
  interface Props {
    formId: string;
    field: UiFormField;
    text: string;
    checked: boolean;
    error?: string;
    onText: (name: string, value: string) => void;
    onChecked: (name: string, checked: boolean) => void;
  }
  let { formId, field, text, checked, error, onText, onChecked }: Props = $props();
  const id = $derived(`vict-field-${formId}-${field.name}`);
  const errorId = $derived(`vict-field-error-${formId}-${field.name}`);
</script>

<div class="vict-field" data-field={field.name}>
  <label class="vict-field-label" for={id}>{field.label}{field.required ? ' *' : ''}</label>
  {#if field.widget === 'json'}
    <textarea class="vict-textarea" {id} name={field.name} rows="3"
      aria-invalid={error !== undefined ? 'true' : undefined}
      aria-describedby={error !== undefined ? errorId : undefined}
      value={text}
      oninput={(event) => onText(field.name, event.currentTarget.value)}></textarea>
  {:else if field.widget === 'boolean'}
    <input class="vict-checkbox" {id} name={field.name} type="checkbox"
      aria-invalid={error !== undefined ? 'true' : undefined}
      aria-describedby={error !== undefined ? errorId : undefined}
      {checked}
      onchange={(event) => onChecked(field.name, event.currentTarget.checked)} />
  {:else}
    <input class="vict-input" {id} name={field.name}
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
