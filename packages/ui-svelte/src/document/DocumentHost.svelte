<script lang="ts">
  /**
   * DocumentHost — mounts one compiled `vict.ui-render-plan@1` (U1).
   *
   * This is the ONE renderer entry for both the authoring canvas and the
   * normal application consumer (U1-02): the same plan renders in the
   * editor host and a plain product route. Owns document local state
   * (typed declarations from the source), token/style mounting (scoped
   * under a root class), interaction dispatch and accessible surfaces.
   * Editor and scenario concerns stay OUT of this component.
   */
  import type { UiRenderPlan, UiLocalStateDecl, UiExtensionDescriptor, UiValue } from '@victframework/ui';
  import { isUiValueOfType } from '@victframework/ui';
  import { untrack } from 'svelte';
  import type {
    UiSvelteComponentImplementation,
    UiSvelteExtensionImplementation,
  } from './extensions.js';
  import RenderNode from './RenderNode.svelte';
  import { rootClassFor, styleRulesToCss, type DocumentScope } from './logic.js';

  interface Props {
    readonly plan: UiRenderPlan;
    /** Explicit metadata/code registration, shared by product and editor. */
    readonly extensionDescriptors?: readonly UiExtensionDescriptor[];
    readonly extensionImplementations?: readonly (
      | UiSvelteExtensionImplementation
      | UiSvelteComponentImplementation
    )[];
    /** Data scope: view fields / record fields for `view.*` / `record.*` refs. */
    readonly view?: Readonly<Record<string, unknown>>;
    readonly record?: Readonly<Record<string, unknown>>;
    /** Local state declarations from the SOURCE document (typed initials). */
    readonly localState?: Readonly<Record<string, UiLocalStateDecl>>;
    /** Ephemeral orchestration values for declared local presentation state only (widened carrier, §10.1a). */
    readonly stateValues?: Readonly<Record<string, UiValue>>;
    /** Action dispatch below the renderer boundary (the ONLY way actions run). */
    readonly dispatch: (actionId: string, input?: unknown) => Promise<unknown>;
    /** Route navigation hook (route id + resolved params). */
    readonly navigate: (routeId: string, params?: Readonly<Record<string, unknown>>) => void;
    /** Editor selection hook (occurrence key), used by the authoring canvas only. */
    readonly selectOccurrence?: (occurrence: string) => void;
    /** Render-time diagnostic channel (duplicate keys, etc.). */
    readonly onRenderDiagnostic?: (diagnostic: { readonly code: string; readonly message: string; readonly detail?: Readonly<Record<string, unknown>> }) => void;
    /** Reset signal: a NEW symbol re-initializes local state (preview reset). */
    readonly resetSignal?: symbol;
    /** Root element for the document subtree. */
    readonly as?: 'div' | 'section' | 'article';
    readonly ariaLabel?: string;
  }

  let {
    plan,
    extensionDescriptors = [],
    extensionImplementations = [],
    view = {},
    record = {},
    localState = {},
    stateValues = {},
    dispatch,
    navigate,
    selectOccurrence,
    onRenderDiagnostic,
    resetSignal,
    as = 'div',
    ariaLabel,
  }: Props = $props();

  /**
   * The mounted-plan holder (amendment §5.3): emissions compare against
   * this identity so late callbacks from a superseded plan are dropped.
   */
  const planHolder: { plan: typeof plan } = { plan };
  $effect(() => {
    planHolder.plan = plan;
  });

  function initialValues(): Record<string, unknown> {
    const bag: Record<string, unknown> = {};
    for (const [key, decl] of Object.entries(localState)) {
      bag[key] = decl.initial;
    }
    // Seed SSR and the first client render consistently. The reactive merge
    // below reports invalid supplied keys without leaking their values.
    for (const [key, value] of Object.entries(stateValues)) {
      const decl = Object.hasOwn(localState, key) ? localState[key] : undefined;
      if (decl !== undefined && isUiValueOfType(value, decl.type)) bag[key] = value;
    }
    return bag;
  }

  let stateBag: Record<string, unknown> = $state(initialValues());
  let lastSignal: symbol | undefined = $state<symbol | undefined>(undefined);

  $effect(() => {
    const signal = resetSignal;
    const values = stateValues;
    const declarations = localState;
    const supplied = Object.entries(values ?? {});
    // Local edits must not retrigger the merge. Reset precedes supplied values
    // in the same effect, so one host update has deterministic ordering.
    untrack(() => {
      if (signal !== undefined && signal !== lastSignal) {
        lastSignal = signal;
        const fresh = initialValues();
        for (const key of Object.keys(stateBag)) delete stateBag[key];
        Object.assign(stateBag, fresh);
      }
      for (const [key, value] of supplied) {
        const declaration = Object.hasOwn(declarations, key) ? declarations[key] : undefined;
        if (declaration === undefined || !isUiValueOfType(value, declaration.type)) {
          onRenderDiagnostic?.({
            code: 'UI_RENDER_STATE_VALUE_REJECTED',
            message: 'Host presentation state must match an explicitly declared local state type.',
            detail: { stateKey: key, reason: declaration === undefined ? 'undeclared' : 'type-mismatch' },
          });
          continue;
        }
        stateBag[key] = value;
      }
    });
  });

  function setState(key: string, value: unknown): void {
    if (localState[key] === undefined) return; // undeclared keys are validation errors; never invented here
    stateBag[key] = value;
  }

  const tokens: Record<string, string> = $derived(
    Object.fromEntries(
      (plan.style.rules.find((rule) => rule.layer === 'token')?.declarations ?? []).map(
        (declaration) => [
          declaration.property.replace('--ui-token-', ''),
          declaration.value.type === 'literal' ? String(declaration.value.value) : '',
        ],
      ),
    ),
  );

  const scope: DocumentScope = $derived({
    view,
    record,
    state: stateBag,
    tokens,
  });

  const rootClass = $derived(rootClassFor(plan));
  const css = $derived(styleRulesToCss(plan, rootClass));
</script>

<svelte:head>
  {@html `<style data-ui-style="${rootClass}">${css}</style>`}
</svelte:head>

<svelte:element
  this={as}
  class={rootClass}
  data-ui-document={plan.documentId}
  data-ui-revision={plan.revision}
  aria-label={ariaLabel}
>
  {#key plan.sourceDigest}
    {#each plan.structure as instruction (instruction.occurrenceKey)}
      <RenderNode
        {instruction}
        {plan}
        {planHolder}
        {extensionDescriptors}
        {extensionImplementations}
        {scope}
        instancePath={[]}
        repeatKeys={[]}
        slotFills={{}}
        {dispatch}
        {navigate}
        {setState}
        {selectOccurrence}
        reportDiagnostic={onRenderDiagnostic}
      />
    {/each}
  {/key}
</svelte:element>
