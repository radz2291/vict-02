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
    UiExtensionDescriptor,
    UiValue,
  } from '@victframework/ui';
  import { isUiValueOfType, copyUiValue } from '@victframework/ui';
  import {
    resolveSvelteComponent,
    type UiSvelteComponentImplementation,
    type UiSvelteComponentIO,
    type UiSvelteExtensionImplementation,
  } from './extensions.js';
  import {
    asRecord,
    rootClassFor,
    bindingStyleVariables,
    conditionsOf,
    evaluateComponentPropValues,
    evaluateCondition,
    occurrenceKey,
    resolveValue,
    uniqueRepeatKeys,
    type DocumentScope,
  } from './logic.js';
  import { onDestroy } from 'svelte';
  import SlotSnippets from './SlotSnippets.svelte';
  import Self from './RenderNode.svelte';

  interface Props {
    readonly instruction: UiRenderInstruction;
    readonly plan: UiRenderPlan;
    readonly generation?: symbol;
    /** @deprecated Generation tokens fence outputs; retained for existing direct consumers. */
    readonly planHolder?: { readonly plan: UiRenderPlan };
    readonly ownerId?: string;
    readonly slotScope?: DocumentScope;
    readonly actionStatuses?: Readonly<Record<string, import('./extensions.js').UiComponentActionStatus>>;
    readonly extensionDescriptors?: readonly UiExtensionDescriptor[];
    readonly extensionImplementations?: readonly (
      | UiSvelteExtensionImplementation
      | UiSvelteComponentImplementation
    )[];
    readonly scope: DocumentScope;
    readonly instancePath: readonly string[];
    readonly repeatKeys: readonly string[];
    /** Slot fills of the nearest component INSTANCE frame (slotName → instructions). */
    readonly slotFills: Readonly<Record<string, readonly UiRenderInstruction[]>>;
    readonly dispatch: (actionId: string, input?: unknown) => Promise<unknown>;
    readonly navigate: (routeId: string, params?: Readonly<Record<string, unknown>>) => void;
    readonly setState: (key: string, value: unknown) => void;
    readonly selectOccurrence?: (occurrence: string) => void;
    /** Render-time diagnostic channel (duplicate keys, component gates, …). */
    readonly reportDiagnostic?: (diagnostic: { readonly code: string; readonly message: string; readonly detail?: Readonly<Record<string, unknown>> }) => void;
    /** Additional class for the ROOT element of this subtree (component instance frames). */
    readonly extraClass?: string;
    readonly extraStyle?: string;
  }

  let {
    instruction,
    plan,
    generation,
    ownerId,
    slotScope,
    actionStatuses = {},
    extensionDescriptors = [],
    extensionImplementations = [],
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
    extraStyle,
  }: Props = $props();

  const conditions = $derived(conditionsOf(plan));
  const occ = $derived(occurrenceKey(instruction.occurrenceKey, repeatKeys));
  const extension = $derived(instruction.kind === 'extension'
    ? resolveSvelteComponent(instruction, extensionDescriptors, extensionImplementations)
    : undefined);
  $effect(() => {
    if (extension !== undefined && !extension.ok) reportDiagnostic?.(extension.diagnostic);
  });

  let alive = true;
  onDestroy(() => { alive = false; });
  // Capture authority separately from reactive props/state. Keyed repeat rows
  // keep callbacks with their logical record; replacing a record expires them.
  const effectiveGeneration = $derived.by(() => { if (generation !== undefined) return generation; void plan; return Symbol('plan'); });
  interface OutputAuthority { instruction: UiRenderInstruction; generation: symbol; occurrence: string; record?: Readonly<Record<string, unknown>>; recordScope?: Readonly<Record<string, unknown>>; repeats?: DocumentScope['repeatItems']; }
  let previousAuthority: OutputAuthority | undefined;
  const authority = $derived.by(() => {
    const next = { instruction, generation: effectiveGeneration, occurrence: occ, record: scope.repeatItem?.value, recordScope: scope.record, repeats: scope.repeatItems };
    if (previousAuthority?.instruction === next.instruction && previousAuthority.generation === next.generation &&
      previousAuthority.occurrence === next.occurrence && previousAuthority.record === next.record && previousAuthority.recordScope === next.recordScope &&
      Object.keys(previousAuthority.repeats ?? {}).length === Object.keys(next.repeats ?? {}).length &&
      Object.entries(previousAuthority.repeats ?? {}).every(([name, value]) => next.repeats?.[name] === value)) return previousAuthority;
    previousAuthority = next;
    return next;
  });
  const componentValues = $derived(instruction.kind === 'component' || instruction.kind === 'extension'
    ? evaluateComponentPropValues(instruction, scope) : { values: {}, invalidNames: [] });
  $effect(() => {
    if (componentValues.invalidNames.length) reportDiagnostic?.({ code: 'UI_COMPONENT_PROP_VALUE_REJECTED',
      message: 'Evaluated component properties must match their declared types.',
      detail: { nodeId: instruction.nodeId, occurrenceKey: occ, properties: componentValues.invalidNames } });
  });
  const io: UiSvelteComponentIO = $derived.by(() => {
    const captured = authority;
    const owner = captured.instruction;
    const actionBinding = owner.kind === 'extension' ? Object.values(owner.outputBindings ?? {}).find(binding => 'invokeAction' in binding) : undefined;
    const action = actionBinding && 'invokeAction' in actionBinding ? actionStatuses[actionBinding.invokeAction.actionId] : undefined;
    return { action, emit(output, payload) {
      const stale = !alive || captured !== authority;
      if (owner.kind !== 'extension') return;
      const decl = owner.outputDecls?.find(entry => entry.name === output);
      if (stale || decl === undefined || (decl.payload === 'void' ? payload !== undefined : !isUiValueOfType(payload, decl.payload))) {
        reportDiagnostic?.({ code: stale ? 'UI_COMPONENT_OUTPUT_STALE' : 'UI_COMPONENT_OUTPUT_REJECTED',
          message: stale ? 'Output belongs to an expired occurrence or generation.' : `Output '${output}' requires its declared payload.`,
          detail: { nodeId: owner.nodeId, occurrenceKey: captured.occurrence, output } });
        return;
      }
      const delivered = payload === undefined ? undefined : copyUiValue(payload);
      const binding = owner.outputBindings?.[output];
      if (binding === undefined) return;
      const bindingScope = { ...scope, output: delivered };
      if ('setState' in binding) {
        const value = binding.setState.value === undefined ? delivered : resolveValue({ type: 'expression', expression: binding.setState.value }, bindingScope);
        setState(binding.setState.key, value);
      } else {
        const input = Object.fromEntries(Object.entries(binding.invokeAction.input ?? {}).map(([name, expression]) =>
          [name, deliveredInput(expression, bindingScope)]));
        void dispatch(binding.invokeAction.actionId, Object.keys(input).length ? input : undefined);
      }
    } };
  });
  function deliveredInput(expression: import('@victframework/ui').UiExpression, values: DocumentScope): unknown {
    const value = resolveValue({ type: 'expression', expression }, values);
    return Array.isArray(value) ? value.slice() : value;
  }
  const presentation = $derived.by(() => {
    const owner = instruction;
    const root = rootClassFor(plan);
    return { target(name: string) {
      if (owner.kind !== 'extension' || !owner.styleTargets?.includes(name)) return { class: '' };
      const primary = name === owner.styleTargets[0];
      return {
        class: [root, ...(primary ? owner.classes ?? [] : []) , ...(primary && extraClass ? [extraClass] : [])].join(' '),
        style: primary ? [bindingStyleVariables(owner.styleRuleIds ?? [], plan, scope), extraStyle ?? ''].join(' ') : undefined,
        'data-ui-owner': ownerId, 'data-ui-primary': primary ? '' : undefined,
        'data-ui-node': owner.nodeId, 'data-ui-occ': occ, 'data-ui-part': name,
        onpointerdown(event: PointerEvent) { event.stopPropagation(); selectOccurrence?.(occ); },
      };
    } };
  });

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

  /** Void elements must not render a children slot (Svelte warning + invalid HTML). */
  const VOID_TAGS = new Set(['input', 'br', 'hr', 'img', 'meta', 'link', 'source', 'wbr', 'col']);

</script>

{#if instruction.kind === 'element'}
  {@const children = instruction.children}
  <svelte:element
    this={instruction.tag}
    {...evaluatedAttributes}
    class={[...instruction.classes, ...(extraClass !== undefined ? [extraClass] : [])].join(' ')}
    data-ui-owner={ownerId}
    data-ui-node={instruction.nodeId}
    data-ui-occ={occ}
    style={[bindingStyleVariables(instruction.styleRuleIds, plan, scope), extraStyle ?? ''].join(' ')}
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
    {#if !VOID_TAGS.has(instruction.tag)}
    {#each children as child (child.occurrenceKey)}
      <Self
        instruction={child}
        {plan}
    {generation}
        {ownerId}
        {slotScope}
        {actionStatuses}
        {extensionDescriptors}
        {extensionImplementations}
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
    {/if}
  </svelte:element>
{:else if instruction.kind === 'text'}
  <span
    class="uv-text"
    data-ui-owner={ownerId}
    data-ui-node={instruction.nodeId}
    data-ui-occ={occ}
    style="display: contents"
    onclick={(event) => {
      if (selectOccurrence !== undefined) {
        event.stopPropagation();
        selectOccurrence(occ);
      }
    }}
  >
    {#if instruction.content.type === 'literal'}
      {instruction.content.value}
    {:else}
      {String(resolveValue({ type: 'expression', expression: instruction.content.expression }, scope) ?? '')}
    {/if}
  </span>
{:else if (instruction.kind === 'component' || instruction.kind === 'extension') && componentValues.invalidNames.length}
  <span class="uv-extension-unavailable" data-ui-owner={ownerId} data-ui-occ={occ} data-ui-node={instruction.nodeId} role="alert">This component has incompatible bound properties.</span>
{:else if instruction.kind === 'component'}
  {@const bodyScope = { ...scope, props: componentValues.values }}
  {@const childPath = [...instancePath, `${instruction.nodeId}@${instruction.definitionId}`]}
  <Self
    instruction={instruction.body}
    {plan}
    {generation}
        {ownerId}
        {actionStatuses}
    {extensionDescriptors}
    {extensionImplementations}
    scope={bodyScope}
    instancePath={childPath}
    {repeatKeys}
    slotFills={instruction.slots}
    slotScope={scope}
    {dispatch}
    {navigate}
    {setState}
    {selectOccurrence}
    {reportDiagnostic}
    extraClass={[...instruction.classes, extraClass ?? ''].join(' ')}
    extraStyle={[bindingStyleVariables(instruction.styleRuleIds, plan, scope), extraStyle ?? ''].join(' ')}
  />
{:else if instruction.kind === 'extension'}
  {@const extensionProps = componentValues.values }
  {#if extension?.ok && extension.kind === 'component'}
    {@const Implementation = extension.component}
    {@const extensionInstruction = instruction}
    {#snippet renderFill(children: readonly UiRenderInstruction[])}
      {#each children as child (child.occurrenceKey)}
        <Self instruction={child} {plan} {generation}
        {ownerId}
        {slotScope}
        {actionStatuses} {extensionDescriptors} {extensionImplementations}
          {scope} instancePath={[...instancePath, `${extensionInstruction.nodeId}@${extensionInstruction.extensionId}`]}
          {repeatKeys} slotFills={{}} {dispatch} {navigate} {setState} {selectOccurrence} {reportDiagnostic} />
      {/each}
    {/snippet}
    <SlotSnippets fills={instruction.slots ?? {}} names={Object.keys(instruction.slots ?? {})} {renderFill}>
      {#snippet children(slots)}
        <Implementation props={extensionProps} occurrenceKey={occ} nodeId={instruction.nodeId} {presentation} io={{ ...io, slots }} />
      {/snippet}
    </SlotSnippets>
  {:else if extension?.ok}
    {@const Implementation = extension.component}
    <span style="display: contents" data-ui-owner={ownerId} data-ui-occ={occ} data-ui-node={instruction.nodeId}
      onclick={event => { event.stopPropagation(); selectOccurrence?.(occ); }}>
      <Implementation props={extensionProps} occurrenceKey={occ} nodeId={instruction.nodeId} {presentation} />
    </span>
  {:else}
    <span class="uv-extension-unavailable" data-ui-occ={occ} data-ui-node={instruction.nodeId} role="note">This component is unavailable.</span>
  {/if}
{:else if instruction.kind === 'repeat'}
  {@const rows = resolveValue({ type: 'expression', expression: instruction.collection }, scope)}
  {#if Array.isArray(rows)}
    {@const resolvedRowKeys = rows.map((row, index) => String(resolveValue({ type: 'expression', expression: instruction.key }, { ...scope, repeatItem: { name: instruction.itemName, value: asRecord(row) } }) ?? index))}
    {@const uniqueRowKeys = uniqueRepeatKeys(resolvedRowKeys, instruction.nodeId, reportDiagnostic)}
    {#each rows as row, index (uniqueRowKeys[index])}
      {@const itemRecord = asRecord(row)}
      {@const itemScope = { ...scope, repeatItem: { name: instruction.itemName, value: itemRecord }, repeatItems: { ...scope.repeatItems, [instruction.itemName]: itemRecord } }}
      <Self
        instruction={instruction.template}
        {plan}
    {generation}
        {ownerId}
        {slotScope}
        {actionStatuses}
        {extensionDescriptors}
        {extensionImplementations}
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
    {generation}
        {ownerId}
        {slotScope}
        {actionStatuses}
      {extensionDescriptors}
      {extensionImplementations}
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
    {generation}
        {ownerId}
        slotScope={undefined}
        {actionStatuses}
        {extensionDescriptors}
        {extensionImplementations}
        scope={slotScope ?? scope}
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
    {generation}
        {ownerId}
        {slotScope}
        {actionStatuses}
        {extensionDescriptors}
        {extensionImplementations}
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
    {generation}
        {ownerId}
        {slotScope}
        {actionStatuses}
        {extensionDescriptors}
        {extensionImplementations}
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

