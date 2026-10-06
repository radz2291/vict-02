<script lang="ts">
  /**
   * The GENERIC document renderer (U1): renders one compiled
   * `vict.ui-render-plan@1` instruction. Recursive; occurrence keys carry
   * the component-instance path and repeat record keys so selection always
   * maps back to THE source occurrence (never a DOM handle).
   */
  import type {
    UiRenderInstruction,
    UiRenderPlan,
  } from '@victframework/ui';
  import {
    asRecord,
    conditionsOf,
    evaluatedComponentProps,
    evaluateCondition,
    occurrenceKey,
    resolveValue,
    uniqueRepeatKeys,
    type DocumentScope,
  } from './logic.js';
  import Self from './RenderNode.svelte';

  interface Props {
    readonly instruction: UiRenderInstruction;
    readonly plan: UiRenderPlan;
    readonly scope: DocumentScope;
    readonly instancePath: readonly string[];
    readonly repeatKeys: readonly string[];
    /** Slot fills of the nearest component INSTANCE frame (slotName → instructions). */
    readonly slotFills: Readonly<Record<string, readonly UiRenderInstruction[]>>;
    readonly dispatch: (actionId: string, input?: unknown) => Promise<unknown>;
    readonly navigate: (routeId: string, params?: Readonly<Record<string, unknown>>) => void;
    readonly setState: (key: string, value: unknown) => void;
    readonly selectOccurrence?: (occurrence: string) => void;
    /** Render-time diagnostic channel (e.g. duplicate repeat keys). */
    readonly reportDiagnostic?: (diagnostic: { readonly code: string; readonly message: string; readonly detail?: Readonly<Record<string, unknown>> }) => void;
    /** Additional class for the ROOT element of this subtree (component instance frames). */
    readonly extraClass?: string;
  }

  let {
    instruction,
    plan,
    scope,
    instancePath,
    repeatKeys,
    slotFills,
    dispatch,
    navigate,
    setState,
    selectOccurrence,
    reportDiagnostic,
    extraClass,
  }: Props = $props();

  const conditions = $derived(conditionsOf(plan));
  const occ = $derived(occurrenceKey(instruction.occurrenceKey, repeatKeys));

  const evaluatedAttributes = $derived.by(() => {
    if (instruction.kind !== 'element') return {} as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const attribute of instruction.attributes) {
      out[attribute.name] = resolveValue(attribute.value, scope);
    }
    return out;
  });

  async function runInteractions(event: MouseEvent | SubmitEvent): Promise<void> {
    if (instruction.kind !== 'element') return;
    for (const interaction of instruction.interactions) {
      if (interaction.on === 'click' && !(event instanceof MouseEvent)) continue;
      if (interaction.on === 'submit' && !(event instanceof SubmitEvent)) continue;
      if (interaction.action === 'invokeAction') {
        const input: Record<string, unknown> = {};
        for (const [name, expression] of Object.entries(interaction.params)) {
          input[name] = resolveValue({ type: 'expression', expression }, scope);
        }
        event.preventDefault();
        await dispatch(interaction.actionId as string, input);
      } else if (interaction.action === 'navigate') {
        const params: Record<string, unknown> = {};
        for (const [name, expression] of Object.entries(interaction.params)) {
          params[name] = resolveValue({ type: 'expression', expression }, scope);
        }
        event.preventDefault();
        navigate(interaction.routeId as string, params);
      }
    }
  }

  function handleChange(event: Event): void {
    if (instruction.kind !== 'element') return;
    for (const interaction of instruction.interactions) {
      if (interaction.on !== 'change' || interaction.action !== 'setState') continue;
      const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      const declared = interaction.params['value'];
      const fallback = declared !== undefined ? resolveValue({ type: 'expression', expression: declared }, scope) : undefined;
      let value: unknown = fallback;
      if (target !== null) {
        if (target instanceof HTMLInputElement && target.type === 'checkbox') value = target.checked;
        else if (target instanceof HTMLInputElement && target.type === 'number') {
          const parsed = Number(target.value);
          value = target.value === '' ? fallback : Number.isFinite(parsed) ? parsed : fallback;
        } else value = target.value;
      }
      setState(interaction.stateKey as string, value);
    }
  }

  const branchChildren = $derived.by(() => {
    if (instruction.kind !== 'conditional') return [];
    for (const branch of instruction.branches) {
      if (branch.when === undefined) return branch.children;
      if (evaluateCondition(branch.when, conditions, scope)) return branch.children;
    }
    return [];
  });

</script>

{#if instruction.kind === 'element'}
  {@const children = instruction.children}
  <svelte:element
    this={instruction.tag}
    {...evaluatedAttributes}
    class={[...instruction.classes, ...(extraClass !== undefined ? [extraClass] : [])].join(' ')}
    data-ui-node={instruction.nodeId}
    data-ui-occ={occ}
    onclick={(event) => {
      // Selection and interactions address the INNERMOST declared element;
      // bubbling to ancestor handlers would overwrite the selection.
      event.stopPropagation();
      if (instruction.interactions.some((interaction) => interaction.on === 'click')) {
        void runInteractions(event);
      } else {
        selectOccurrence?.(occ);
      }
    }}
    onsubmit={(event) => {
      event.stopPropagation();
      if (instruction.interactions.some((interaction) => interaction.on === 'submit')) {
        void runInteractions(event);
      }
    }}
    onchange={handleChange}
    oninput={handleChange}
  >
    {#each children as child (child.occurrenceKey)}
      <Self
        instruction={child}
        {plan}
        {scope}
        {instancePath}
        {repeatKeys}
        {slotFills}
        {dispatch}
        {navigate}
        {setState}
        {selectOccurrence}
        {reportDiagnostic}
        extraClass={undefined}
      />
    {/each}
  </svelte:element>
{:else if instruction.kind === 'text'}
  <span
    class="uv-text"
    data-ui-node={instruction.nodeId}
    data-ui-occ={occ}
    style="display: contents"
    onclick={(event) => {
      event.stopPropagation();
      selectOccurrence?.(occ);
    }}
  >
    {#if instruction.content.type === 'literal'}
      {instruction.content.value}
    {:else}
      {String(resolveValue({ type: 'expression', expression: instruction.content.expression }, scope) ?? '')}
    {/if}
  </span>
{:else if instruction.kind === 'component'}
  {@const bodyScope = { ...scope, props: evaluatedComponentProps(instruction, scope) }}
  {@const childPath = [...instancePath, `${instruction.nodeId}@${instruction.definitionId}`]}
  <Self
    instruction={instruction.body}
    {plan}
    scope={bodyScope}
    instancePath={childPath}
    {repeatKeys}
    slotFills={instruction.slots}
    {dispatch}
    {navigate}
    {setState}
    {selectOccurrence}
    {reportDiagnostic}
    extraClass={instruction.classes[0]}
  />
{:else if instruction.kind === 'extension'}
  {@const extensionProps = evaluatedComponentProps(instruction, scope)}
  <!-- Declared U1 limit: extensions render as labeled placeholders. -->
  <div
    class="uv-extension-placeholder"
    data-ui-node={instruction.nodeId}
    data-ui-occ={occ}
    data-extension-id={instruction.extensionId}
    role="img"
    aria-label={`Extension ${instruction.extensionId} (renderer pending in U1)`}
  >
    <span>Extension {instruction.extensionId}</span>
    <pre>{JSON.stringify(extensionProps)}</pre>
  </div>
{:else if instruction.kind === 'repeat'}
  {@const rows = resolveValue({ type: 'expression', expression: instruction.collection }, scope)}
  {#if Array.isArray(rows)}
    {@const resolvedRowKeys = rows.map((row, index) => String(resolveValue({ type: 'expression', expression: instruction.key }, { ...scope, repeatItem: { name: instruction.itemName, value: asRecord(row) } }) ?? index))}
    {@const uniqueRowKeys = uniqueRepeatKeys(resolvedRowKeys, instruction.nodeId, reportDiagnostic)}
    {#each rows as row, index}
      {@const itemScope = { ...scope, repeatItem: { name: instruction.itemName, value: asRecord(row) } }}
      <Self
        instruction={instruction.template}
        {plan}
        scope={itemScope}
        {instancePath}
        repeatKeys={[...repeatKeys, uniqueRowKeys[index] ?? String(index)]}
        {slotFills}
        {dispatch}
        {navigate}
        {setState}
        {selectOccurrence}
        {reportDiagnostic}
      />
    {/each}
  {:else}
    <span class="uv-error" data-ui-occ={occ}>repeat collection is not an array</span>
  {/if}
{:else if instruction.kind === 'conditional'}
  {#each branchChildren as child (child.occurrenceKey)}
    <Self
      instruction={child}
      {plan}
      {scope}
      {instancePath}
      {repeatKeys}
      {slotFills}
      {dispatch}
      {navigate}
      {setState}
      {selectOccurrence}
      {reportDiagnostic}
    />
  {/each}
{:else if instruction.kind === 'slot'}
  {@const fill = slotFills[instruction.name]}
  {#if fill !== undefined && fill.length > 0}
    {#each fill as child (child.occurrenceKey)}
      <Self
        instruction={child}
        {plan}
        {scope}
        {instancePath}
        {repeatKeys}
        slotFills={{}}
        {dispatch}
        {navigate}
        {setState}
        {selectOccurrence}
        {reportDiagnostic}
      />
    {/each}
  {:else}
    {#each instruction.fallback as child (child.occurrenceKey)}
      <Self
        instruction={child}
        {plan}
        {scope}
        {instancePath}
        {repeatKeys}
        {slotFills}
        {dispatch}
        {navigate}
        {setState}
        {selectOccurrence}
        {reportDiagnostic}
      />
    {/each}
  {/if}
{:else if instruction.kind === 'unsupported'}
  <div class="uv-unsupported" data-ui-node={instruction.nodeId} data-ui-occ={occ} role="note">
    Unsupported feature: {instruction.feature}
    {#each instruction.children as child (child.occurrenceKey)}
      <Self
        instruction={child}
        {plan}
        {scope}
        {instancePath}
        {repeatKeys}
        {slotFills}
        {dispatch}
        {navigate}
        {setState}
        {selectOccurrence}
        {reportDiagnostic}
      />
    {/each}
  </div>
{/if}

