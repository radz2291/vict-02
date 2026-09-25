<script lang="ts">
  import type { UiFormField } from '@victframework/ui';
  import Button from './Button.svelte';
  import Feedback from './Feedback.svelte';
  import FormField from './FormField.svelte';
  interface Props {
    surfaceId: string;
    formId: string;
    fields: readonly UiFormField[];
    text: Readonly<Record<string, string>>;
    checked: Readonly<Record<string, boolean>>;
    errors: Readonly<Record<string, string>>;
    submitLabel: string;
    onText: (name: string, value: string) => void;
    onChecked: (name: string, checked: boolean) => void;
    onSubmit: (event: SubmitEvent) => void;
  }
  let { surfaceId, formId, fields, text, checked, errors, submitLabel, onText, onChecked, onSubmit }: Props = $props();
</script>

<form class="vict-form" data-surface={surfaceId} onsubmit={onSubmit}>
  {#each fields as field (field.name)}
    <FormField {formId} {field} text={text[field.name] ?? ''} checked={checked[field.name] === true}
      error={errors[field.name]} {onText} {onChecked} />
  {/each}
  {#if Object.keys(errors).length > 0}
    <Feedback kind="error" message="Please correct the highlighted fields." testId="form-local-validation" />
  {/if}
  <Button type="submit" label={submitLabel} testId="form-submit" />
</form>
