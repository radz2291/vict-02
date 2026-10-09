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
  import { isUiValueOfType, copyUiValue, actionFeedback } from '@victframework/ui';
  import { untrack, onDestroy } from 'svelte';
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
    readonly actionState?: Readonly<Record<string, import('./extensions.js').UiActionStateConnection>>;
    readonly onActionResult?: (actionId: string, result: unknown) => void;
    readonly onStateChange?: (key: string, value: UiValue) => void;
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
    onStateChange,
    actionState = {},
    onActionResult,
    as = 'div',
    ariaLabel,
  }: Props = $props();

  // A new token expires every retained emission on plan replacement or reset,
  // including a replacement whose canonical source digest is unchanged.
  const ownerId = $props.id();
  let alive = true;
  onDestroy(() => { alive = false; });
  const generation = $derived.by(() => {
    void plan;
    void resetSignal;
    return Symbol('document-generation');
  });

  function initialValues(): Record<string, unknown> {
    const bag: Record<string, unknown> = {};
    for (const [key, decl] of Object.entries(localState)) {
      if (isUiValueOfType(decl.initial, decl.type)) bag[key] = copyUiValue(decl.initial);
    }
    // Seed SSR and the first client render consistently. The reactive merge
    // below reports invalid supplied keys without leaking their values.
    for (const [key, value] of Object.entries(stateValues)) {
      const decl = Object.hasOwn(localState, key) ? localState[key] : undefined;
      if (decl !== undefined && isUiValueOfType(value, decl.type)) bag[key] = copyUiValue(value);
    }
    return bag;
  }

  let stateBag: Record<string, unknown> = $state(initialValues());
  let acceptedSupplied: Record<string, UiValue> = {};
  let lastDocumentId = $state(plan.documentId);
  let lastSignal: symbol | undefined = $state<symbol | undefined>(undefined);

  $effect.pre(() => {
    const documentId = plan.documentId;
    const signal = resetSignal;
    const values = stateValues;
    const declarations = localState;
    const supplied = Object.entries(values ?? {});
    // Local edits must not retrigger the merge. Reset precedes supplied values
    // in the same effect, so one host update has deterministic ordering.
    untrack(() => {
      if (documentId !== lastDocumentId || (signal !== undefined && signal !== lastSignal)) {
        lastDocumentId = documentId;
        lastSignal = signal;
        const fresh = initialValues();
        for (const key of Object.keys(stateBag)) delete stateBag[key];
        Object.assign(stateBag, fresh);
        acceptedSupplied = {};
      }
      for (const key of Object.keys(stateBag)) {
        const declaration = declarations[key];
        if (declaration === undefined) delete stateBag[key];
        else if (!isUiValueOfType(stateBag[key], declaration.type)) {
          if (isUiValueOfType(declaration.initial, declaration.type)) stateBag[key] = copyUiValue(declaration.initial);
        }
      }
      for (const [key, declaration] of Object.entries(declarations)) {
        if (!Object.hasOwn(stateBag, key) && isUiValueOfType(declaration.initial, declaration.type)) stateBag[key] = copyUiValue(declaration.initial);
      }
      const nextSupplied: Record<string, UiValue> = {};
      // Supply is an update channel, not ownership of the local key. Removal
      // relinquishes supply without undoing a local correction. Invalid
      // values never enter the accepted snapshot.

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
        nextSupplied[key] = copyUiValue(value);
        if (!Object.hasOwn(acceptedSupplied, key) || !sameValue(acceptedSupplied[key], value)) {
          stateBag[key] = copyUiValue(value);
        }
      }
      acceptedSupplied = nextSupplied;
    });
  });

  function sameValue(left: unknown, right: UiValue): boolean {
    return Array.isArray(left) && Array.isArray(right)
      ? left.length === right.length && left.every((value, index) => value === right[index])
      : left === right;
  }

  function setState(key: string, value: unknown): void {
    const declaration = Object.hasOwn(localState, key) ? localState[key] : undefined;
    if (declaration === undefined || !isUiValueOfType(value, declaration.type)) {
      onRenderDiagnostic?.({ code: 'UI_RENDER_STATE_VALUE_REJECTED',
        message: 'An evaluated state write must match its declared type.', detail: { stateKey: key } });
      return;
    }
    if (sameValue(stateBag[key], value)) return;
    stateBag[key] = copyUiValue(value);
    onStateChange?.(key, copyUiValue(value));
  }

  let actionStatuses = $state<Record<string, import('./extensions.js').UiComponentActionStatus>>({});
  const runs = new Map<string, symbol>();
  $effect(() => {
    void generation;
    untrack(() => {
      for (const [id, status] of Object.entries(actionStatuses)) {
        const key = actionState[id]?.pending;
        if (status.pending && key && localState[key]?.type === 'boolean') setState(key, false);
      }
      actionStatuses = {}; runs.clear();
    });
  });
  async function runAction(actionId: string, input?: unknown): Promise<unknown> {
    const token = generation;
    const run = Symbol(actionId);
    const connection = actionState[actionId];
    runs.set(actionId, run);
    actionStatuses[actionId] = { pending: true, feedback: null };
    if (connection?.pending) setState(connection.pending, true);
    if (connection?.error) setState(connection.error, '');
    let result: unknown;
    try { result = await dispatch(actionId, input); }
    catch { result = { ok: false, code: 'ACTION_FAILED', message: 'The action could not be completed.' }; }
    if (!alive || token !== generation || runs.get(actionId) !== run) return result;
    const outcome = typeof result === 'object' && result !== null && 'ok' in result && typeof result.ok === 'boolean'
      ? { ok: result.ok, ...('code' in result && typeof result.code === 'string' ? { code: result.code } : {}), ...('message' in result && typeof result.message === 'string' ? { message: result.message } : {}) }
      : { ok: false, code: 'ACTION_RESULT_INVALID', message: 'The action returned an invalid result.' };
    actionStatuses[actionId] = { pending: false, feedback: actionFeedback(outcome) };
    if (connection?.pending) setState(connection.pending, false);
    if (connection?.error) setState(connection.error, outcome.ok ? '' : outcome.message ?? 'The action failed.');
    if (outcome.ok) {
      if (connection?.result && typeof result === 'object' && result !== null && 'value' in result) setState(connection.result, result.value);
      for (const [key, value] of Object.entries(connection?.successValues ?? {})) setState(key, value);
    }
    onActionResult?.(actionId, result);
    return result;
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
  data-ui-owner-root={ownerId}
  data-ui-document={plan.documentId}
  data-ui-revision={plan.revision}
  aria-label={ariaLabel}
>
  {#key generation}
    {#each plan.structure as instruction (instruction.occurrenceKey)}
      <RenderNode
        {instruction}
        {plan}
        {generation}
        {ownerId}
        {extensionDescriptors}
        {extensionImplementations}
        {scope}
        instancePath={[]}
        repeatKeys={[]}
        slotFills={{}}
        dispatch={runAction}
        {actionStatuses}
        {navigate}
        {setState}
        {selectOccurrence}
        reportDiagnostic={onRenderDiagnostic}
      />
    {/each}
  {/key}
</svelte:element>
