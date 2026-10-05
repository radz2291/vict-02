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
  import type { UiRenderPlan, UiLocalStateDecl } from '@victframework/ui';
  import RenderNode from './RenderNode.svelte';
  import { rootClassFor, styleRulesToCss, type DocumentScope } from './logic.js';

  interface Props {
    readonly plan: UiRenderPlan;
    /** Data scope: view fields / record fields for `view.*` / `record.*` refs. */
    readonly view?: Readonly<Record<string, unknown>>;
    readonly record?: Readonly<Record<string, unknown>>;
    /** Local state declarations from the SOURCE document (typed initials). */
    readonly localState?: Readonly<Record<string, UiLocalStateDecl>>;
    /** Action dispatch below the renderer boundary (the ONLY way actions run). */
    readonly dispatch: (actionId: string, input?: unknown) => Promise<unknown>;
    /** Route navigation hook (route id + resolved params). */
    readonly navigate: (routeId: string, params?: Readonly<Record<string, unknown>>) => void;
    /** Editor selection hook (occurrence key), used by the authoring canvas only. */
    readonly selectOccurrence?: (occurrence: string) => void;
    /** Reset signal: a NEW symbol re-initializes local state (preview reset). */
    readonly resetSignal?: symbol;
    /** Root element for the document subtree. */
    readonly as?: 'div' | 'section' | 'article';
    readonly ariaLabel?: string;
  }

  let {
    plan,
    view = {},
    record = {},
    localState = {},
    dispatch,
    navigate,
    selectOccurrence,
    resetSignal,
    as = 'div',
    ariaLabel,
  }: Props = $props();

  function initialValues(): Record<string, unknown> {
    const bag: Record<string, unknown> = {};
    for (const [key, decl] of Object.entries(localState)) {
      bag[key] = decl.initial;
    }
    return bag;
  }

  let stateBag: Record<string, unknown> = $state(initialValues());
  let lastSignal: symbol | undefined = $state<symbol | undefined>(undefined);

  $effect(() => {
    if (resetSignal !== undefined && resetSignal !== lastSignal) {
      lastSignal = resetSignal;
      const fresh = initialValues();
      for (const key of Object.keys(stateBag)) delete stateBag[key];
      Object.assign(stateBag, fresh);
    }
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
        {scope}
        instancePath={[]}
        repeatKeys={[]}
        slotFills={{}}
        {dispatch}
        {navigate}
        {setState}
        {selectOccurrence}
      />
    {/each}
  {/key}
</svelte:element>
