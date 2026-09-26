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
  import type { VictPlanView, PlanSurface, ActionResult } from './logic.js';
  import { tick, onDestroy } from 'svelte';
  import { actionFeedback, type UiFormField, type UiActionFeedback } from '@victframework/ui';
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
    run: (actionId: string, input?: unknown) => Promise<ActionResult | void>;
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
          readonly fields?: readonly { readonly name: string; readonly label: string; readonly required?: boolean; readonly widget?: unknown; readonly options?: UiFormField['options'] }[];
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
    ...(field.options ? { options: field.options } : {}),
  })));

  // Raw widget-boundary state (canonical model lives in form-values.ts).
  let formState = $state<FormState>({ text: {}, checked: {} });
  // Local, field-associated conversion errors (renderer-generated text only).
  let fieldErrors = $state<Record<string, string>>({});
  let pending = $state(false);
  let feedback = $state<UiActionFeedback | null>(null);
  let submissionVersion = 0;
  const actionIdentity = $derived(form?.submitActionId);
  const surfaceIdentity = $derived(surface.id);
  const applicationIdentity = $derived(plan.applicationId);
  const feedbackContext = $derived([applicationIdentity, surfaceIdentity, actionIdentity, identity].map(String).join('|'));
  let previousContext: string | undefined;
  $effect(() => {
    const context = feedbackContext;
    if (context === previousContext) return;
    previousContext = context;
    submissionVersion += 1;
    feedback = null;
    pending = false;
  });
  onDestroy(() => { submissionVersion += 1; });

  $effect(() => {
    // Edit forms prefill from the provided values through the canonical
    // normalization policy; the binding resets when the prefill identity
    // changes. This does NOT depend on any input event having occurred.
    void identity;
    formState = prefillFormState(fields, values ?? {});
    fieldErrors = {};
  });

  function clearFieldError(name: string): void {
    if (feedback?.kind === 'success') feedback = null;
    if (fieldErrors[name] !== undefined) {
      const next = { ...fieldErrors };
      delete next[name];
      fieldErrors = next;
    }
  }

  function onTextInput(name: string, value: string): void {
    // Numeric input remains raw text until the canonical submit conversion.
    formState = { ...formState, text: { ...formState.text, [name]: value } };
    clearFieldError(name);
  }

  function onCheckedInput(name: string, checked: boolean): void {
    formState = { ...formState, checked: { ...formState.checked, [name]: checked } };
    clearFieldError(name);
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const version = ++submissionVersion;
    const formElement = event.currentTarget as HTMLFormElement;
    const activeBefore = document.activeElement;
    feedback = null;
    // Canonical conversion at the declared widget boundary. Conversion
    // failures remain LOCAL to the form: no mutation is dispatched.
    const outcome = toSubmitPayload(fields, formState);
    if (!outcome.ok) {
      fieldErrors = { ...(outcome.fieldErrors ?? {}) };
      await tick();
      formElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    fieldErrors = {};
    const payload: Record<string, unknown> = { ...outcome.payload };
    if (identity !== undefined) {
      payload.__identity = identity;
    }
    pending = true;
    try {
      const actionId = String(form?.submitActionId);
      const result = await run(actionId, payload);
      if (version !== submissionVersion) return;
      if (result) {
        const knownErrors: Record<string, string> = {};
        if (!result.ok && result.code === 'CONTRACT_REJECTED') {
          for (const field of fields) {
            const message = result.fieldErrors?.[field.name];
            if (typeof message === 'string' && message.trim()) knownErrors[field.name] = message;
          }
        }
        fieldErrors = knownErrors;
        const hasUnmappedErrors = Object.keys(result.fieldErrors ?? {}).some(name => !fields.some(field => field.name === name));
        feedback = Object.keys(knownErrors).length > 0 && !hasUnmappedErrors ? null : actionFeedback(result, plan.actions[actionId]?.feedback, true);
      }
    } catch {
      if (version !== submissionVersion) return;
      feedback = actionFeedback({ ok: false }, plan.actions[String(form?.submitActionId)]?.feedback, true);
    } finally {
      if (version === submissionVersion) {
      pending = false;
      await tick();
      const invalid = formElement.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (invalid && (formElement.contains(document.activeElement) || document.activeElement === document.body)) invalid.focus();
      else if (document.activeElement === document.body && activeBefore instanceof HTMLElement && formElement.contains(activeBefore)) activeBefore.focus();
      }
    }
  }
</script>

{#if form !== undefined}
  <Form
    surfaceId={surface.id}
    formId={form.formId}
    fields={uiFields}
    text={formState.text}
    checked={formState.checked}
    errors={fieldErrors}
    {submitLabel}
    {feedback}
    actionId={form.submitActionId}
    {pending}
    onText={onTextInput}
    onChecked={onCheckedInput}
    onSubmit={(event) => { void submit(event); }}
  />
{/if}
