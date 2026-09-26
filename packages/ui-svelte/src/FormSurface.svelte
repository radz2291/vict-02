<script lang="ts">
  /**
   * The `form` role: a contract-validated create/edit form. Field
   * presentation is definition-driven; VALIDATION always happens at the
   * declared contract crossing the typed action boundary below the UI —
   * the renderer only reflects the structured result.
   *
   * Value handling is the centralized type-aware form-value model
   * (`form-values.ts`): prefill and submit both convert at the DECLARED
   * widget boundary, so untouched numeric prefills stay numbers, `0` stays
   * `0`, and invalid conversions stay local field errors that never
   * dispatch a malformed mutation (HIGH-05-A remediation). Create and edit
   * forms share this exact policy.
   */
  import type { VictPlanView, PlanSurface } from './logic.js';
  import type { UiFormField } from '@victframework/ui';
  import Form from './Form.svelte';
  import {
    prefillFormState,
    toSubmitPayload,
    widgetKind,
    type FormState,
  } from './form-values.js';

  interface Props {
    surface: PlanSurface;
    plan: VictPlanView;
    run: (actionId: string, input?: unknown) => Promise<void>;
    /** Optional identity for edit forms (prefills and becomes the update target). */
    identity?: unknown;
    /** Prefill values for edit forms. */
    values?: Record<string, unknown>;
    submitLabel?: string;
  }

  let { surface, plan, run, identity, values = {}, submitLabel = 'Save' }: Props = $props();

  const form = $derived(
    plan.forms?.[String(surface.formId)] as
      | {
          readonly formId: string;
          readonly fields?: readonly { readonly name: string; readonly label: string; readonly required?: boolean; readonly widget?: unknown }[];
          readonly submitActionId: string;
        }
      | undefined,
  );

  const fields = $derived(form?.fields ?? []);
  const uiFields = $derived(fields.map((field): UiFormField => ({
    name: field.name,
    label: field.label,
    required: field.required === true,
    widget: widgetKind(field.widget),
  })));

  // Raw widget-boundary state (canonical model lives in form-values.ts).
  let state = $state<FormState>({ text: {}, checked: {} });
  // Local, field-associated conversion errors (renderer-generated text only).
  let fieldErrors = $state<Record<string, string>>({});

  $effect(() => {
    // Edit forms prefill from the provided values through the canonical
    // normalization policy; the binding resets when the prefill identity
    // changes. This does NOT depend on any input event having occurred.
    void identity;
    state = prefillFormState(fields, values ?? {});
    fieldErrors = {};
  });

  function clearFieldError(name: string): void {
    if (fieldErrors[name] !== undefined) {
      const next = { ...fieldErrors };
      delete next[name];
      fieldErrors = next;
    }
  }

  function onTextInput(name: string, value: string): void {
    // Numeric input remains raw text until the canonical submit conversion.
    state = { ...state, text: { ...state.text, [name]: value } };
    clearFieldError(name);
  }

  function onCheckedInput(name: string, checked: boolean): void {
    state = { ...state, checked: { ...state.checked, [name]: checked } };
    clearFieldError(name);
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    // Canonical conversion at the declared widget boundary. Conversion
    // failures remain LOCAL to the form: no mutation is dispatched.
    const outcome = toSubmitPayload(fields, state);
    if (!outcome.ok) {
      fieldErrors = { ...(outcome.fieldErrors ?? {}) };
      return;
    }
    fieldErrors = {};
    const payload: Record<string, unknown> = { ...outcome.payload };
    if (identity !== undefined) {
      payload.__identity = identity;
    }
    await run(String(form?.submitActionId), payload);
  }
</script>

{#if form !== undefined}
  <Form
    surfaceId={surface.id}
    formId={form.formId}
    fields={uiFields}
    text={state.text}
    checked={state.checked}
    errors={fieldErrors}
    {submitLabel}
    onText={onTextInput}
    onChecked={onCheckedInput}
    onSubmit={(event) => { void submit(event); }}
  />
{/if}
