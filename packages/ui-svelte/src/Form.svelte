<script lang="ts">
  import type { UiFormField, UiActionFeedback } from '@victframework/ui';
  import Button from './Button.svelte';
  import ActionFeedback from './ActionFeedback.svelte';
  import FormField from './FormField.svelte';
  interface Props {
    surfaceId: string;
    formId: string;
    fields: readonly UiFormField[];
    text: Readonly<Record<string, string>>;
    checked: Readonly<Record<string, boolean>>;
    errors: Readonly<Record<string, string>>;
    submitLabel: string;
    feedback?: UiActionFeedback | null;
    actionId?: string;
    pending?: boolean;
    onText: (name: string, value: string) => void;
    onChecked: (name: string, checked: boolean) => void;
    onSubmit: (event: SubmitEvent) => void;
  }
  let { surfaceId, formId, fields, text, checked, errors, submitLabel, feedback = null, actionId, pending = false, onText, onChecked, onSubmit }: Props = $props();
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
  {#if Object.keys(errors).length > 1}
    <div class="vict-form-summary" role="alert" data-testid="form-local-validation">
      <p>Check {Object.keys(errors).length} fields before saving:</p>
      <ul>{#each fields.filter(field => errors[field.name]) as field}
        <li><a href="#vict-field-{formId}-{field.name}" onclick={(event) => {
          event.preventDefault();
          document.getElementById('vict-field-' + formId + '-' + field.name)?.focus();
        }}>{field.label}</a></li>
      {/each}</ul>
    </div>
  {/if}
  <div class="vict-form-actions">
    <Button type="submit" disabled={pending} label={pending ? 'Saving…' : submitLabel} testId="form-submit" />
    <ActionFeedback {feedback} {actionId} />
  </div>
</form>
