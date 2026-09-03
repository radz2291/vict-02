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

  function inputType(widget: unknown): string {
    switch (widgetKind(widget)) {
      case 'number':
        return 'number';
      case 'boolean':
        return 'checkbox';
      case 'date':
        return 'date';
      default:
        return 'text';
    }
  }

  function clearFieldError(name: string): void {
    if (fieldErrors[name] !== undefined) {
      const next = { ...fieldErrors };
      delete next[name];
      fieldErrors = next;
    }
  }

  function onNumberInput(name: string, event: Event): void {
    // Number inputs keep the RAW text boundary state — Svelte's numeric
    // input coercion must not silently decide the submitted type.
    const target = event.currentTarget as HTMLInputElement;
    state = { ...state, text: { ...state.text, [name]: target.value } };
    clearFieldError(name);
  }

  function onCheckedInput(name: string, event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    state = { ...state, checked: { ...state.checked, [name]: target.checked } };
    clearFieldError(name);
  }

  const hasFieldErrors = $derived(Object.keys(fieldErrors).length > 0);

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
  <form class="vict-form" data-surface={surface.id} onsubmit={(event) => void submit(event)}>
    {#each fields as field (field.name)}
      <div class="vict-field" data-field={field.name}>
        <label class="vict-field-label" for="vict-field-{form.formId}-{field.name}">
          {field.label}{field.required === true ? ' *' : ''}
        </label>
        {#if field.widget === 'json'}
          <textarea
            class="vict-textarea"
            id="vict-field-{form.formId}-{field.name}"
            name={field.name}
            rows="3"
            aria-invalid={fieldErrors[field.name] !== undefined ? 'true' : undefined}
            aria-describedby={fieldErrors[field.name] !== undefined
              ? `vict-field-error-${form.formId}-${field.name}`
              : undefined}
            bind:value={state.text[field.name]}
            oninput={() => clearFieldError(field.name)}
          ></textarea>
        {:else if widgetKind(field.widget) === 'boolean'}
          <input
            class="vict-checkbox"
            id="vict-field-{form.formId}-{field.name}"
            name={field.name}
            type="checkbox"
            aria-invalid={fieldErrors[field.name] !== undefined ? 'true' : undefined}
            aria-describedby={fieldErrors[field.name] !== undefined
              ? `vict-field-error-${form.formId}-${field.name}`
              : undefined}
            checked={state.checked[field.name] === true}
            onchange={(event) => onCheckedInput(field.name, event)}
          />
        {:else if widgetKind(field.widget) === 'number'}
          <!-- Explicit value/oninput binding: Svelte's numeric input
               coercion must not decide the submitted type; the canonical
               model converts at the declared widget boundary. -->
          <input
            class="vict-input"
            id="vict-field-{form.formId}-{field.name}"
            name={field.name}
            type="number"
            step="any"
            required={field.required === true}
            aria-invalid={fieldErrors[field.name] !== undefined ? 'true' : undefined}
            aria-describedby={fieldErrors[field.name] !== undefined
              ? `vict-field-error-${form.formId}-${field.name}`
              : undefined}
            value={state.text[field.name] ?? ''}
            oninput={(event) => onNumberInput(field.name, event)}
          />
        {:else}
          <input
            class="vict-input"
            id="vict-field-{form.formId}-{field.name}"
            name={field.name}
            type={inputType(field.widget)}
            required={field.required === true}
            aria-invalid={fieldErrors[field.name] !== undefined ? 'true' : undefined}
            aria-describedby={fieldErrors[field.name] !== undefined
              ? `vict-field-error-${form.formId}-${field.name}`
              : undefined}
            bind:value={state.text[field.name]}
            oninput={() => clearFieldError(field.name)}
          />
        {/if}
        {#if fieldErrors[field.name] !== undefined}
          <p
            class="vict-field-error"
            id="vict-field-error-{form.formId}-{field.name}"
            data-testid="form-field-error-{field.name}"
          >
            {fieldErrors[field.name]}
          </p>
        {/if}
      </div>
    {/each}
    {#if hasFieldErrors}
      <p class="vict-alert" role="alert" data-testid="form-local-validation">
        Please correct the highlighted fields.
      </p>
    {/if}
    <button type="submit" class="vict-btn" data-testid="form-submit">{submitLabel}</button>
  </form>
{/if}

<style>
  .vict-form {
    background: var(--vict-color-surface);
    border: 1px solid var(--vict-color-border);
    border-radius: var(--vict-radius-base);
    padding: calc(var(--vict-spacing-unit) * 3);
    max-width: 32rem;
  }

  .vict-field-error {
    margin: calc(var(--vict-spacing-unit) * 0.5) 0 0;
    font-size: 0.8125rem;
    color: var(--vict-color-danger);
  }
</style>