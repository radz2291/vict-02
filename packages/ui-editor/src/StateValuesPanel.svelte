<script lang="ts">
  /**
   * StateValuesPanel — preview-state editor for declared local state
   * (amendment §10.1a boundary 4). Edits the CANVAS-SEEDING `stateValues`
   * object (runtime orchestration values, not document source): scalar
   * inputs for string/number/boolean and list editors for
   * stringList/numberList, all validated by the one shared guard — an
   * invalid value is refused and surfaced, never silently seeded.
   * ISO date/time scalars get format-validated text inputs.
   */
  import type { UiLocalStateDecl, UiValue } from '@victframework/ui';
  import { isUiValueOfType } from '@victframework/ui';

  interface Props {
    readonly localState: Readonly<Record<string, UiLocalStateDecl>>;
    readonly stateValues: Readonly<Record<string, UiValue>>;
    readonly onChange: (key: string, value: UiValue | undefined) => void;
  }
  let { localState, stateValues, onChange }: Props = $props();

  const declarations = $derived(Object.values(localState));
  const draftText = $state<Record<string, string>>({});
  const listDraft = $state<Record<string, string>>({});
  const errors = $state<Record<string, string>>({});

  function typeLabel(type: UiLocalStateDecl['type']): string {
    return type === 'stringList'
      ? 'string list'
      : type === 'numberList'
        ? 'number list'
        : type === 'isoDate'
          ? 'date (YYYY-MM-DD)'
          : type === 'isoTime'
            ? 'time (HH:MM[:SS])'
            : type;
  }

  function scalarInputType(type: UiLocalStateDecl['type']): string {
    return type === 'number' ? 'number' : type === 'boolean' ? 'checkbox' : 'text';
  }

  function scalarChange(decl: UiLocalStateDecl, raw: string, checked: boolean): void {
    if (decl.type === 'boolean') {
      apply(decl, checked);
      return;
    }
    if (decl.type === 'number') {
      const parsed = Number(raw);
      if (raw !== '' && Number.isFinite(parsed)) apply(decl, parsed);
      else if (raw === '') onChange(decl.key, undefined);
      else errors[decl.key] = 'Not a finite number.';
      return;
    }
    apply(decl, raw);
  }

  function apply(decl: UiLocalStateDecl, value: UiValue): void {
    if (!isUiValueOfType(value, decl.type)) {
      errors[decl.key] = `Not a valid ${typeLabel(decl.type)} value.`;
      return;
    }
    delete errors[decl.key];
    onChange(decl.key, value);
  }

  function addListItem(decl: UiLocalStateDecl): void {
    const raw = (listDraft[decl.key] ?? '').trim();
    if (raw === '') return;
    const current = stateValues[decl.key];
    const list = Array.isArray(current) ? [...current] : [];
    const member = decl.type === 'stringList' ? raw : Number(raw);
    if (decl.type === 'numberList' && !Number.isFinite(member)) {
      errors[decl.key] = 'List members must be finite numbers.';
      return;
    }
    const next = [...list, member];
    apply(decl, next);
    listDraft[decl.key] = '';
  }

  function removeListItem(decl: UiLocalStateDecl, index: number): void {
    const current = stateValues[decl.key];
    if (!Array.isArray(current)) return;
    apply(decl, current.filter((_, i) => i !== index));
  }
</script>

<section class="uv-state-panel" aria-label="Preview state">
  <h3>Preview state</h3>
  <p class="hint">Seeds the canvas run. Editing here never changes document source.</p>
  {#each declarations as decl (decl.key)}
    <div class="state-row">
      <label class="state-label">
        <code>{decl.key}</code>
        <span class="state-type">{typeLabel(decl.type)}</span>
      </label>
      {#if decl.type === 'boolean'}
        <label class="state-inline">
          <input
            type="checkbox"
            checked={stateValues[decl.key] === true}
            onchange={(event) => scalarChange(decl, '', event.currentTarget.checked)}
          />
          <span>{stateValues[decl.key] === true ? 'true' : 'false'}</span>
        </label>
      {:else if decl.type === 'stringList' || decl.type === 'numberList'}
        <div class="list-editor">
          <ul>
            {#each Array.isArray(stateValues[decl.key]) ? (stateValues[decl.key] as readonly unknown[]) : [] as member, index (index)}
              <li>
                <span>{String(member)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${String(member)}`}
                  onclick={() => removeListItem(decl, index)}
                >×</button>
              </li>
            {/each}
          </ul>
          <div class="list-add">
            <input
              type={decl.type === 'numberList' ? 'number' : 'text'}
              placeholder={decl.type === 'numberList' ? 'number' : 'text'}
              bind:value={listDraft[decl.key]}
              aria-label={`Add ${decl.key} member`}
            />
            <button type="button" onclick={() => addListItem(decl)}>Add</button>
          </div>
        </div>
      {:else}
        <input
          type={scalarInputType(decl.type)}
          value={stateValues[decl.key] === undefined ? '' : String(stateValues[decl.key])}
          placeholder={decl.type === 'isoDate' ? 'YYYY-MM-DD' : decl.type === 'isoTime' ? 'HH:MM' : ''}
          aria-label={`${decl.key} value`}
          oninput={(event) => scalarChange(decl, event.currentTarget.value, false)}
        />
      {/if}
      {#if errors[decl.key]}<p class="state-error" role="alert">{errors[decl.key]}</p>{/if}
    </div>
  {:else}
    <p class="hint">This document declares no local state.</p>
  {/each}
</section>

<style>
  .uv-state-panel { border-bottom: 1px solid var(--ui-editor-line, #d7dce5); padding: 10px 14px; font: 12px/1.5 var(--ui-editor-font, 'Segoe UI', sans-serif); color: var(--ui-editor-ink, #202938); background: var(--ui-editor-panel, #f8f9fb); }
  h3 { font-size: 12px; margin: 0 0 4px; }
  .hint { color: var(--ui-editor-muted, #667085); font-size: 11px; margin: 4px 0 8px; }
  .state-row { margin: 8px 0; }
  .state-label { display: flex; gap: 6px; align-items: baseline; }
  code { background: var(--ui-editor-input, #fff); padding: 1px 4px; border: 1px solid var(--ui-editor-line, #d7dce5); border-radius: 4px; }
  .state-type { color: var(--ui-editor-muted, #667085); font-size: 11px; }
  .state-inline { display: inline-flex; gap: 6px; align-items: center; }
  input:not([type='checkbox']) { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--ui-editor-line, #d7dce5); border-radius: 5px; background: var(--ui-editor-input, #fff); font: inherit; margin-top: 4px; }
  .list-editor ul { list-style: none; margin: 4px 0; padding: 0; }
  .list-editor li { display: flex; justify-content: space-between; align-items: center; padding: 3px 6px; background: var(--ui-editor-input, #fff); border: 1px solid var(--ui-editor-line, #d7dce5); border-radius: 4px; margin: 2px 0; }
  .list-add { display: flex; gap: 4px; }
  .list-add input { margin-top: 0; }
  button { padding: 4px 8px; font: inherit; border: 1px solid var(--ui-editor-line, #d7dce5); border-radius: 4px; background: var(--ui-editor-input, #fff); cursor: pointer; }
  .state-error { color: #b3401f; font-size: 11px; margin: 2px 0; }
</style>
