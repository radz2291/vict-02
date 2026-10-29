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
  import { isUiValueOfType, copyUiValue, stableJson } from '@victframework/ui';
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
    type DocumentSlotFrame,
  } from './logic.js';
  import { onDestroy, untrack, getContext, tick } from 'svelte';
  import { UI_APPLICATION_DOCUMENT, type UiApplicationDocument } from './extensions.js';
  import SlotSnippets from './SlotSnippets.svelte';
  import ScopedSlotSnippets from './ScopedSlotSnippets.svelte';
  import ScopedSlotInstance from './ScopedSlotInstance.svelte';
  import type {UiScopedSlotFrame} from './extensions.js';
  import Self from './RenderNode.svelte';
  import { interactiveSlotLabels } from './slot-labels.js';
  import { runtimeAuthoringIssues } from './authoring-runtime.js';

  interface Props {
    readonly instruction: UiRenderInstruction;
    readonly plan: UiRenderPlan;
    /** Exact occurrence requesting an adapter-owned inline surface. Never authored. */
    readonly componentSurface?: { readonly occurrenceKey: string; readonly slotName: string };
    readonly generation?: symbol;
    /** @deprecated Generation tokens fence outputs; retained for existing direct consumers. */
    readonly planHolder?: { readonly plan: UiRenderPlan };
    readonly ownerId?: string;
    readonly slotScope?: DocumentScope;
    readonly slotFrame?: DocumentSlotFrame;
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
    readonly emitScoped?: (output:string,payload?:UiValue)=>void;
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
    componentSurface,
    generation,
    ownerId,
    slotScope,
    slotFrame,
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
    emitScoped,
    selectOccurrence,
    reportDiagnostic,
    extraClass,
    extraStyle,
  }: Props = $props();
  const applicationDocument = getContext<UiApplicationDocument | undefined>(UI_APPLICATION_DOCUMENT);

  // Observer callbacks belong to the host. Reading/writing its activity
  // state must not become a dependency of a renderer effect or derived.
  function diagnose(diagnostic: Parameters<NonNullable<Props['reportDiagnostic']>>[0]): void {
    untrack(() => reportDiagnostic?.(diagnostic));
  }

  const conditions = $derived(conditionsOf(plan));
  const effectiveSlotFrame = $derived(slotFrame ?? { fills: slotFills, scope: slotScope ?? scope });
  const occ = $derived(occurrenceKey(instruction.occurrenceKey, repeatKeys));
  const extension = $derived(instruction.kind === 'extension'
    ? resolveSvelteComponent(instruction, extensionDescriptors, extensionImplementations)
    : undefined);
  $effect(() => {
    if (extension !== undefined && !extension.ok) diagnose(extension.diagnostic);
  });

  let alive = true;
  onDestroy(() => { alive = false; });
  // Capture authority separately from reactive props/state. Keyed repeat rows
  // keep callbacks with their logical record; replacing a record expires them.
  const effectiveGeneration = $derived.by(() => { if (generation !== undefined) return generation; void plan; return Symbol('plan'); });
  interface OutputAuthority { instruction: UiRenderInstruction; generation: symbol; occurrence: string; props?: Readonly<Record<string,unknown>>; record?: Readonly<Record<string, unknown>>; recordScope?: Readonly<Record<string, unknown>>; repeats?: DocumentScope['repeatItems']; }
  let previousAuthority: OutputAuthority | undefined;
  const authority = $derived.by(() => {
    const next = { instruction, generation: effectiveGeneration, occurrence: occ, props:scope.props, record: scope.repeatItem?.value, recordScope: scope.record, repeats: scope.repeatItems };
    if (previousAuthority?.instruction === next.instruction && previousAuthority.generation === next.generation &&
      previousAuthority.occurrence === next.occurrence && previousAuthority.props===next.props && previousAuthority.record === next.record && previousAuthority.recordScope === next.recordScope &&
      Object.keys(previousAuthority.repeats ?? {}).length === Object.keys(next.repeats ?? {}).length &&
      Object.entries(previousAuthority.repeats ?? {}).every(([name, value]) => next.repeats?.[name] === value)) return previousAuthority;
    previousAuthority = next;
    return next;
  });
  const componentValues = $derived(instruction.kind === 'component' || instruction.kind === 'extension'
    ? evaluateComponentPropValues(instruction, scope) : { values: {}, invalidNames: [] });
  const semanticIssues = $derived(instruction.kind === 'extension' ? runtimeAuthoringIssues(instruction,scope,plan,extensionImplementations,effectiveSlotFrame) : []);
  $effect(() => { for(const issue of semanticIssues) diagnose(issue); });
  $effect(() => {
    if (componentValues.invalidNames.length) diagnose({ code: 'UI_EXPR_TYPE_MISMATCH',
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
        diagnose({ code: stale ? 'UI_COMPONENT_OUTPUT_STALE' : 'UI_COMPONENT_OUTPUT_REJECTED',
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
      } else if ('emit' in binding) {
        const payload=binding.emit.value===undefined?delivered:resolveValue({type:'expression',expression:binding.emit.value},bindingScope);
        emitScoped?.(binding.emit.output,payload as UiValue|undefined);
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
  function selectTarget(event: PointerEvent): void {
    const closest = (event.target as Element | null)?.closest('[data-ui-occ]');
    if (closest === event.currentTarget) selectOccurrence?.(occ);
  }
  const presentation = $derived.by(() => {
    const owner = instruction;
    const root = rootClassFor(plan);
    return { ownerDocument: applicationDocument?.(), scopeClass: root, compositionSlot: componentSurface?.occurrenceKey === occ && extension?.ok && extension.kind === 'component' && extension.compositionSlots?.includes(componentSurface.slotName) ? componentSurface.slotName : undefined, target(name: string) {
      if (owner.kind !== 'extension' || !owner.styleTargets?.includes(name)) return { class: '' };
      const primary = name === owner.styleTargets[0];
      return {
        class: [...(primary ? owner.classes ?? [] : []), ...(owner.partClasses?.[name] ? [owner.partClasses[name]] : []), ...(primary && extraClass ? [extraClass] : [])].join(' '),
        style: [primary ? bindingStyleVariables(owner.styleRuleIds ?? [], plan, scope) : '', bindingStyleVariables(owner.partStyleRuleIds?.[name] ?? [], plan, scope), primary ? extraStyle ?? '' : ''].filter(Boolean).join(' ') || undefined,
        'data-ui-owner': ownerId, 'data-ui-primary': primary ? '' : undefined,
        'data-ui-node': owner.nodeId, 'data-ui-occ': occ, 'data-ui-part': name,
        onpointerdowncapture: selectTarget,
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

  async function handleChange(event: Event): Promise<void> {
    if (instruction.kind !== 'element') return;
    const native=event.target as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|null;
    let delivered=false;
    for (const interaction of instruction.interactions) {
      if (interaction.on !== 'change' || interaction.action !== 'setState') continue;
      const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      const declared = interaction.params['value'];
      const fallback = declared !== undefined ? resolveValue({ type: 'expression', expression: declared }, scope) : undefined;
      let value: unknown = fallback;
      if (target !== null) {
        if (target.localName === 'input' && ['checkbox','radio'].includes((target as HTMLInputElement).type)) value = (target as HTMLInputElement).checked;
        else if (target.localName === 'input' && (target as HTMLInputElement).type === 'number') {
          const parsed = Number(target.value);
          value = target.value === '' ? fallback : Number.isFinite(parsed) ? parsed : fallback;
        } else value = target.value;
      }
      setState(interaction.stateKey as string, value);
      delivered=true;
    }
    if(!delivered||!native)return;
    // A domain host may reject a controlled write while its canonical value
    // remains unchanged. Svelte then has no changed attribute to flush back.
    // Reconcile only expression-controlled native properties after the host's
    // synchronous transaction/reactive update; keep untouched fields/cursors.
    await tick();
    if(!alive||!native.isConnected||instruction.kind!=='element'||native.getAttribute('data-ui-occ')!==occ)return;
    const controlled=(name:string)=>instruction.kind==='element'&&instruction.attributes.some(attribute=>attribute.name===name&&attribute.value.type==='expression');
    if(native.localName==='input'&&['checkbox','radio'].includes((native as HTMLInputElement).type)&&controlled('checked')){
      const next=evaluatedAttributes.checked===true;
      if((native as HTMLInputElement).checked!==next)(native as HTMLInputElement).checked=next;
    }else if(['input','textarea','select'].includes(native.localName)&&controlled('value')){
      const next=String(evaluatedAttributes.value??'');
      if(native.value!==next)native.value=next;
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
  function handleElementClick(event: MouseEvent): void {
    if (instruction.kind !== 'element') return;
    event.stopPropagation();
    if (instruction.interactions.some(interaction => interaction.on === 'click')) void runInteractions(event);
    else if ((event.target as Element | null)?.closest('[data-ui-occ]') === event.currentTarget) selectOccurrence?.(occ);
  }
  function handleElementSubmit(event: SubmitEvent): void {
    if (instruction.kind !== 'element') return;
    event.stopPropagation();
    if (instruction.interactions.some(interaction => interaction.on === 'submit')) void runInteractions(event);
  }
  const elementProps = $derived(instruction.kind === 'element' ? {
    ...evaluatedAttributes,
    class: [...instruction.classes, ...(extraClass !== undefined ? [extraClass] : [])].join(' '),
    'data-ui-owner': ownerId, 'data-ui-node': instruction.nodeId, 'data-ui-occ': occ,
    style: [bindingStyleVariables(instruction.styleRuleIds, plan, scope), extraStyle ?? ''].join(' '),
    onclick: handleElementClick, onsubmit: handleElementSubmit, onchange: handleChange, oninput: handleChange,
  } : {});

</script>

{#if instruction.kind === 'element'}
  {@const children = instruction.children}
  {#if VOID_TAGS.has(instruction.tag)}
  <svelte:element this={instruction.tag} {...elementProps} />
  {:else}
  <svelte:element
    this={instruction.tag}
    {...elementProps}
  >
    {#each children as child (child.occurrenceKey)}
      <Self
        instruction={child}
        {plan}
    {generation} {componentSurface}
        {ownerId}
        {slotScope}
        {actionStatuses}
        {extensionDescriptors}
        {extensionImplementations}
        {scope}
        {instancePath}
        {repeatKeys}
        {slotFills}
        slotFrame={effectiveSlotFrame}
        {dispatch}
        {navigate}
        {setState} {emitScoped}
        {selectOccurrence}
        {reportDiagnostic}
        extraClass={undefined}
      />
    {/each}
  </svelte:element>
  {/if}
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
  <span class="uv-extension-unavailable" data-ui-owner={ownerId} onpointerdowncapture={selectTarget} data-ui-occ={occ} data-ui-node={instruction.nodeId} role="alert">This component has incompatible bound properties.</span>
{:else if instruction.kind === 'component'}
  {@const bodyScope = { ...scope, props: componentValues.values }}
  {@const childPath = [...instancePath, `${instruction.nodeId}@${instruction.definitionId}`]}
  <Self
    instruction={instruction.body}
    {plan}
    {generation} {componentSurface}
        {ownerId}
        {actionStatuses}
    {extensionDescriptors}
    {extensionImplementations}
    scope={bodyScope}
    instancePath={childPath}
    {repeatKeys}
    slotFills={instruction.slots}
    slotScope={scope}
    slotFrame={{fills:instruction.slots,scope,parent:effectiveSlotFrame}}
    {dispatch}
    {navigate}
    {setState} {emitScoped}
    {selectOccurrence}
    {reportDiagnostic}
    extraClass={[...instruction.classes, extraClass ?? ''].join(' ')}
    extraStyle={[bindingStyleVariables(instruction.styleRuleIds, plan, scope), extraStyle ?? ''].join(' ')}
  />
{:else if instruction.kind === 'extension' && semanticIssues.length}
  <span class="uv-extension-unavailable" data-ui-owner={ownerId} onpointerdowncapture={selectTarget} data-ui-occ={occ} data-ui-node={instruction.nodeId} role="alert">{semanticIssues[0]?.message}</span>
{:else if instruction.kind === 'extension'}
  {@const extensionProps = componentValues.values }
  {#if extension?.ok && extension.kind === 'component'}
    {@const Implementation = extension.component}
    {@const extensionInstruction = instruction}
    {#snippet renderFill(children: readonly UiRenderInstruction[])}
      {#each children as child (child.occurrenceKey)}
        <Self instruction={child} {plan} {generation} {componentSurface}
        {ownerId}
        {slotScope}
        {actionStatuses} {extensionDescriptors} {extensionImplementations}
          {scope} instancePath={[...instancePath, `${extensionInstruction.nodeId}@${extensionInstruction.extensionId}`]}
          {repeatKeys} {slotFills} slotFrame={effectiveSlotFrame} {dispatch} {navigate} {setState} {emitScoped} {selectOccurrence} {reportDiagnostic} />
      {/each}
    {/snippet}
    {#snippet renderScopedFill(instructions:readonly UiRenderInstruction[],declaration:import('@victframework/ui').UiSlotScope,frame:UiScopedSlotFrame)}
      {#key `${frame.key}:${stableJson(declaration)}`}
        <ScopedSlotInstance {declaration} {frame} generation={effectiveGeneration} report={(code,message)=>diagnose({code,message,detail:{nodeId:instruction.nodeId,occurrenceKey:occ}})}>
          {#snippet children(props,state,write,emit)}
            {#each instructions as child (child.occurrenceKey)}
              <Self instruction={child} {plan} {generation} {componentSurface} {ownerId} {actionStatuses} {extensionDescriptors} {extensionImplementations}
                scope={{...scope,props,state,scopedConditions:declaration.conditions}} instancePath={[...instancePath,`${extensionInstruction.nodeId}@${extensionInstruction.extensionId}`,`scope:${encodeURIComponent(frame.key)}`]}
                repeatKeys={[...repeatKeys,`scope:${encodeURIComponent(frame.key)}`]} {slotFills} {slotScope} slotFrame={effectiveSlotFrame} {dispatch} {navigate} setState={write} emitScoped={emit} {selectOccurrence} {reportDiagnostic}/>
            {/each}
          {/snippet}
        </ScopedSlotInstance>
      {/key}
    {/snippet}
    <SlotSnippets fills={instruction.slots ?? {}} names={Object.keys(instruction.slots ?? {}).filter(name=>!instruction.slotScopes?.[name])} {renderFill}>
      {#snippet children(slots)}
        <ScopedSlotSnippets fills={instruction.slots??{}} scopes={instruction.slotScopes??{}} names={Object.keys(instruction.slotScopes??{})} renderFill={renderScopedFill}>
          {#snippet children(scopedSlots)}
            <Implementation props={extensionProps} occurrenceKey={occ} nodeId={instruction.nodeId} {presentation} io={{ ...io, slots, scopedSlots, slotLabels: interactiveSlotLabels(instruction.slots??{},scope) }} />
          {/snippet}
        </ScopedSlotSnippets>
      {/snippet}
    </SlotSnippets>
  {:else if extension?.ok}
    {@const Implementation = extension.component}
    <span style="display: contents" data-extension-id={instruction.extensionId} data-ui-owner={ownerId} data-ui-occ={occ} data-ui-node={instruction.nodeId}
      onclick={event => { event.stopPropagation(); selectOccurrence?.(occ); }}>
      <Implementation props={extensionProps} occurrenceKey={occ} nodeId={instruction.nodeId} {presentation} />
    </span>
  {:else}
    <span class="uv-extension-unavailable" data-ui-owner={ownerId} onpointerdowncapture={selectTarget} data-ui-occ={occ} data-ui-node={instruction.nodeId} role="note">This component is unavailable.</span>
  {/if}
{:else if instruction.kind === 'repeat'}
  {@const rows = resolveValue({ type: 'expression', expression: instruction.collection }, scope)}
  {#if Array.isArray(rows)}
    {@const resolvedRowKeys = rows.map((row, index) => String(resolveValue({ type: 'expression', expression: instruction.key }, { ...scope, repeatItem: { name: instruction.itemName, value: asRecord(row) } }) ?? index))}
    {@const uniqueRowKeys = uniqueRepeatKeys(resolvedRowKeys, instruction.nodeId, diagnose)}
    {#each rows as row, index (uniqueRowKeys[index])}
      {@const itemRecord = asRecord(row)}
      {@const itemScope = { ...scope, repeatItem: { name: instruction.itemName, value: itemRecord }, repeatItems: { ...scope.repeatItems, [instruction.itemName]: itemRecord } }}
      <Self
        instruction={instruction.template}
        {plan}
    {generation} {componentSurface}
        {ownerId}
        {slotScope}
        {actionStatuses}
        {extensionDescriptors}
        {extensionImplementations}
        scope={itemScope}
        {instancePath}
        repeatKeys={[...repeatKeys, uniqueRowKeys[index] ?? String(index)]}
        {slotFills}
        slotFrame={effectiveSlotFrame}
        {dispatch}
        {navigate}
        {setState} {emitScoped}
        {selectOccurrence}
        {reportDiagnostic}
      />
    {/each}
  {:else}
    <span class="uv-error" data-ui-owner={ownerId} onpointerdowncapture={selectTarget} data-ui-occ={occ}>repeat collection is not an array</span>
  {/if}
{:else if instruction.kind === 'conditional'}
  {#each branchChildren as child (child.occurrenceKey)}
    <Self
      instruction={child}
      {plan}
    {generation} {componentSurface}
        {ownerId}
        {slotScope}
        {actionStatuses}
      {extensionDescriptors}
      {extensionImplementations}
      {scope}
      {instancePath}
      {repeatKeys}
      {slotFills}
      slotFrame={effectiveSlotFrame}
      {dispatch}
      {navigate}
      {setState} {emitScoped}
      {selectOccurrence}
      {reportDiagnostic}
    />
  {/each}
{:else if instruction.kind === 'slot'}
  {@const fill = effectiveSlotFrame.fills[instruction.name]}
  {#if fill !== undefined && fill.length > 0}
    {#each fill as child (child.occurrenceKey)}
      <Self
        instruction={child}
        {plan}
    {generation} {componentSurface}
        {ownerId}
        slotScope={undefined}
        slotFrame={effectiveSlotFrame.parent ?? {fills:{},scope:effectiveSlotFrame.scope}}
        {actionStatuses}
        {extensionDescriptors}
        {extensionImplementations}
        scope={effectiveSlotFrame.scope}
        {instancePath}
        {repeatKeys}
        slotFills={{}}
        {dispatch}
        {navigate}
        {setState} {emitScoped}
        {selectOccurrence}
        {reportDiagnostic}
      />
    {/each}
  {:else}
    {#each instruction.fallback as child (child.occurrenceKey)}
      <Self
        instruction={child}
        {plan}
    {generation} {componentSurface}
        {ownerId}
        {slotScope}
        {actionStatuses}
        {extensionDescriptors}
        {extensionImplementations}
        {scope}
        {instancePath}
        {repeatKeys}
        {slotFills}
        slotFrame={effectiveSlotFrame}
        {dispatch}
        {navigate}
        {setState} {emitScoped}
        {selectOccurrence}
        {reportDiagnostic}
      />
    {/each}
  {/if}
{:else if instruction.kind === 'unsupported'}
  <div class="uv-unsupported" data-ui-owner={ownerId} onpointerdowncapture={selectTarget} data-ui-node={instruction.nodeId} data-ui-occ={occ} role="note">
    Unsupported feature: {instruction.feature}
    {#each instruction.children as child (child.occurrenceKey)}
      <Self
        instruction={child}
        {plan}
    {generation} {componentSurface}
        {ownerId}
        {slotScope}
        {actionStatuses}
        {extensionDescriptors}
        {extensionImplementations}
        {scope}
        {instancePath}
        {repeatKeys}
        {slotFills}
        slotFrame={effectiveSlotFrame}
        {dispatch}
        {navigate}
        {setState} {emitScoped}
        {selectOccurrence}
        {reportDiagnostic}
      />
    {/each}
  </div>
{/if}

