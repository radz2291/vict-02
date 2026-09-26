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
    pending?: boolean;
    onText: (name: string, value: string) => void;
    onChecked: (name: string, checked: boolean) => void;
    onSubmit: (event: SubmitEvent) => void;
  }
  let { surfaceId, formId, fields, text, checked, errors, submitLabel, pending = false, onText, onChecked, onSubmit }: Props = $props();
</script>

<!--
  `novalidate` keeps the browser from short-circuiting submission with
  native constraint validation when a `required` control is empty. The
  canonical form-value model owns required-error SEMANTICS (renderer-
  generated, field-associated errors with explicit aria-describedby
  links); without novalidate, real browsers block the submit event before
  that canonical path can run, and the associated per-field errors never
  render. The `required` attribute itself stays on controls so assistive
  technology still announces the required state.
-->
<form class="vict-form" data-surface={surfaceId} novalidate aria-busy={pending} onsubmit={onSubmit}>
  {#each fields as field (field.name)}
    <FormField {formId} {field} text={text[field.name] ?? ''} checked={checked[field.name] === true}
      disabled={pending} error={errors[field.name]} {onText} {onChecked} />
  {/each}
  {#if Object.keys(errors).length > 0}
    <Feedback kind="error" message="Please correct the highlighted fields." testId="form-local-validation" />
  {/if}
  <Button type="submit" disabled={pending} label={pending ? 'Saving…' : submitLabel} testId="form-submit" />
</form>
