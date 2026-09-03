<script lang="ts">
  /**
   * The `form` role: a contract-validated create/edit form. Field
   * presentation is definition-driven; VALIDATION always happens at the
   * declared contract crossing the typed action boundary below the UI —
   * the renderer only reflects the structured result.
   */
  import type { VictPlanView, PlanSurface } from './logic.js';

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
          readonly fields?: readonly { readonly name: string; readonly label: string; readonly required?: boolean; readonly widget?: string }[];
          readonly submitActionId: string;
        }
      | undefined,
  );

  let formValues = $state<Record<string, string>>({});

  $effect(() => {
    // Edit forms prefill from the provided values; the binding resets when
    // the prefill identity changes.
    void identity;
    const next: Record<string, string> = {};
    for (const field of form?.fields ?? []) {
      const value = values[field.name];
      next[field.name] = value === undefined || value === null ? '' : String(value);
    }
    formValues = next;
  });

  const fields = $derived(form?.fields ?? []);

  function inputType(widget: unknown): string {
    switch (widget) {
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

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const payload: Record<string, unknown> = { ...formValues };
    if (identity !== undefined) {
      payload.__identity = identity;
    }
    await run(String(form?.submitActionId), payload);
  }
</script>

{#if form !== undefined}
  <form class="vict-form" data-surface={surface.id} onsubmit={(event) => void submit(event)}>
    {#each fields as field (field.name)}
      <div class="vict-field">
        <label class="vict-field-label" for="vict-field-{form.formId}-{field.name}">
          {field.label}{field.required === true ? ' *' : ''}
        </label>
        {#if field.widget === 'json'}
          <textarea
            class="vict-textarea"
            id="vict-field-{form.formId}-{field.name}"
            name={field.name}
            rows="3"
            bind:value={formValues[field.name]}
          ></textarea>
        {:else}
          <input
            class="vict-input"
            id="vict-field-{form.formId}-{field.name}"
            name={field.name}
            type={inputType(field.widget)}
            required={field.required === true}
            bind:value={formValues[field.name]}
          />
        {/if}
      </div>
    {/each}
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
</style>
