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
  import { isUiValueOfType } from '@victframework/ui';
  import {
    resolveSvelteComponent,
    type UiSvelteComponentImplementation,
    type UiSvelteComponentIO,
    type UiSvelteExtensionImplementation,
  } from './extensions.js';
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
    /**
     * The host's plan holder: `holder.plan` tracks the currently mounted
     * plan identity so late emissions from a superseded plan are dropped
     * (amendment §5.3 generation gate).
     */
    readonly planHolder: { readonly plan: UiRenderPlan };
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
  }

  let {
    instruction,
    plan,
    planHolder,
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
  }: Props = $props();

  const conditions = $derived(conditionsOf(plan));
  const occ = $derived(occurrenceKey(instruction.occurrenceKey, repeatKeys));
  const extension = $derived(instruction.kind === 'extension'
    ? resolveSvelteComponent(instruction, extensionDescriptors, extensionImplementations)
    : undefined);
  $effect(() => {
    if (extension !== undefined && !extension.ok) reportDiagnostic?.(extension.diagnostic);
  });

  // ---- component-ABI output channel (amendment §3.4/§5.3) -----------------
  // Stale safety: each emission is stamped with the occurrence and the
  // mounted plan generation. Emissions after unmount or after the host's
  // plan was replaced are dropped with a dev-only diagnostic — a stale
  // callback can never write state or dispatch an action for a different
  // document generation. Renderer-enforced; wrappers cannot opt out.
  let mounted = $state(true);
  $effect(() => () => { mounted = false; });
  function emitOutput(output: string, payload?: UiValue): void {
    if (instruction.kind !== 'extension') return;
    const stale = !mounted || planHolder.plan !== plan;
    if (
      stale ||
      instruction.outputDecls === undefined ||
      instruction.outputDecls.find((decl) => decl.name === output) === undefined ||
      (() => {
        const decl = instruction.outputDecls?.find((decl) => decl.name === output);
        if (decl === undefined) return true;
        if (decl.payload === 'void') return payload !== undefined;
        if (payload === undefined) return false;
        return !isUiValueOfType(payload, decl.payload);
      })()
    ) {
      reportDiagnostic?.({
        code: stale ? 'UI_COMPONENT_OUTPUT_STALE' : 'UI_COMPONENT_OUTPUT_REJECTED',
        message: stale
          ? 'Output emission arrived after its occurrence unmounted or its plan was replaced.'
          : `Output emission '${output}' does not match a declared, correctly-typed output.`,
        detail: { nodeId: instruction.nodeId, occurrenceKey: occ, output },
      });
      return;
    }
    const decl = instruction.outputDecls.find((decl) => decl.name === output)!;
    // Ownership (§10.1a): the bridge copies array payloads before delivery —
    // a wrapper holding a mutable array cannot mutate delivered history.
    const delivered: UiValue | undefined = Array.isArray(payload) ? [...payload] : payload;
    const binding = instruction.outputBindings?.[output];
    if (binding === undefined) return; // declared but unwired: authored no-op
    const bindingScope: DocumentScope = { ...scope, output: delivered };
    if ('setState' in binding) {
      const value =
        binding.setState.value !== undefined
          ? resolveValue({ type: 'expression', expression: binding.setState.value }, bindingScope)
          : delivered;
      setState(binding.setState.key, value);
    } else {
      const input: Record<string, unknown> = {};
      for (const [name, expression] of Object.entries(binding.invokeAction.input ?? {})) {
        input[name] = resolveValue({ type: 'expression', expression }, bindingScope);
      }
      void dispatch(
        binding.invokeAction.actionId,
        Object.keys(input).length > 0 ? input : undefined,
      );
    }
  }
  const io: UiSvelteComponentIO = $derived({ emit: emitOutput });
  /** Declared, filled slot names (capability-validated by the resolver). */
  const filledSlotNames = $derived(
    instruction.kind === 'extension' ? Object.keys(instruction.slots ?? {}) : [],
  );

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
    {#if !VOID_TAGS.has(instruction.tag)}
    {#each children as child (child.occurrenceKey)}
      <Self
        instruction={child}
        {plan}
    {planHolder}
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
{:else if instruction.kind === 'component'}
  {@const bodyScope = { ...scope, props: evaluatedComponentProps(instruction, scope) }}
  {@const childPath = [...instancePath, `${instruction.nodeId}@${instruction.definitionId}`]}
  <Self
    instruction={instruction.body}
    {plan}
    {planHolder}
    {extensionDescriptors}
    {extensionImplementations}
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
  <!-- Selection metadata only: the registered component supplies its own keyboard controls. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    data-ui-node={instruction.nodeId}
    data-ui-occ={occ}
    data-extension-id={instruction.extensionId}
    style="display: contents"
    onclick={(event) => {
      selectOccurrence?.(occ);
      // Authored parent interactions and native submit semantics remain active.
      if (!(event.target instanceof Element) || event.target.closest('button,input,select,textarea,a') === null) event.stopPropagation();
    }}
  >
    {#if extension?.ok && extension.kind === 'component'}
      {@const Implementation = extension.component}
      {#snippet renderFill(children: readonly UiRenderInstruction[])}
        {#each children as child (child.occurrenceKey)}
          <Self
            instruction={child}
            {plan}
            {planHolder}
            {extensionDescriptors}
            {extensionImplementations}
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
      {/snippet}
      {@const componentIo: UiSvelteComponentIO = { emit: emitOutput }}
      <Implementation props={extensionProps} occurrenceKey={occ} nodeId={instruction.nodeId} io={componentIo}>
        {#if filledSlotNames.length > 0}
          {@render renderFill((instruction.slots ?? {})[filledSlotNames[0] as string] ?? [])}
        {/if}
      </Implementation>
    {:else if extension?.ok}
      {@const Implementation = extension.component}
      <Implementation props={extensionProps} occurrenceKey={occ} nodeId={instruction.nodeId} />
    {:else}
      <span class="uv-extension-unavailable" role="note">This component is unavailable.</span>
    {/if}
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
    {planHolder}
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
    {planHolder}
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
    {planHolder}
        {extensionDescriptors}
        {extensionImplementations}
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
    {planHolder}
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
    {planHolder}
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

