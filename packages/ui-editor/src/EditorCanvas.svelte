<script lang="ts">
  /**
   * EditorCanvas — renders the WORKING document through the same generic
   * DocumentHost the product uses (one renderer), and wires selection:
   * clicking a rendered element selects its source occurrence (the host
   * reports the full occurrence key incl. instance path + record keys).
   * The selection outline is a canvas-level presentation rule — never
   * document source.
   */
  import { tick } from 'svelte';
  import {
    DocumentHost,
    type UiSvelteComponentImplementation,
    type UiSvelteExtensionImplementation,
  } from '@victframework/ui-svelte';
  import {
    compileUiDocument,
    defaultSemanticElementCatalog,
    type UiCatalogs,
    type UiDocument,
    type UiExtensionDescriptor,
    type UiLocalStateDecl,
    type UiRenderPlan,
    type UiValue,
  } from '@victframework/ui';

  interface Props {
    readonly document: UiDocument;
    readonly catalogs?: UiCatalogs;
    readonly extensions?: readonly UiExtensionDescriptor[];
    readonly extensionImplementations?: readonly (
      | UiSvelteExtensionImplementation
      | UiSvelteComponentImplementation
    )[];
    readonly actionState?: Readonly<Record<string, import('@victframework/ui-svelte').UiActionStateConnection>>;
    readonly resetSignal?: symbol;
    readonly onStateChange?: (key: string, value: UiValue) => void;
    readonly stateValues?: Readonly<Record<string, UiValue>>;
    readonly localState?: Readonly<Record<string, UiLocalStateDecl>>;
    readonly view?: Readonly<Record<string, unknown>>;
    readonly record?: Readonly<Record<string, unknown>>;
    readonly selectedOccurrence?: string;
    readonly onSelect: (occurrence: string) => void;
    readonly dispatch: (actionId: string, input?: unknown) => Promise<unknown>;
    readonly navigate: (routeId: string, params?: Readonly<Record<string, unknown>>) => void;
    /** Render-time diagnostics (duplicate keys, …) surfaced to the host. */
    readonly onRenderDiagnostic?: (diagnostic: {
      readonly code: string;
      readonly message: string;
      readonly detail?: Readonly<Record<string, unknown>>;
    }) => void;
    /** The compiled plan (for Layers/activity surfaces composing this canvas). */
    readonly onPlan?: (plan: UiRenderPlan) => void;
    readonly ariaLabel?: string;
  }

  let {
    document,
    catalogs,
    extensions = [],
    extensionImplementations = [],
    actionState,
    resetSignal,
    onStateChange,
    stateValues = {},
    localState = {},
    view = {},
    record = {},
    selectedOccurrence,
    onSelect,
    dispatch,
    navigate,
    onRenderDiagnostic,
    onPlan,
    ariaLabel = 'Document canvas',
  }: Props = $props();

  const effectiveCatalogs = $derived(
    catalogs ?? { elements: defaultSemanticElementCatalog(), actionIds: [], routeIds: [] },
  );

  // Compiling reads the authored source only. Selection notifications and
  // host-state mirrors can re-evaluate this derived without changing source;
  // they must not manufacture a replacement plan / expire an active action.
  let priorCompilation: { source: UiDocument; inputs: string; result: ReturnType<typeof compileUiDocument> } | undefined;
  const compiled = $derived.by(() => {
    const inputs = JSON.stringify([document, effectiveCatalogs, extensions]);
    if (priorCompilation?.source === document && priorCompilation.inputs === inputs) return priorCompilation.result;
    const result = compileUiDocument(document, effectiveCatalogs.elements, extensions, {
      ...(effectiveCatalogs.actionIds !== undefined ? { actionIds: effectiveCatalogs.actionIds } : {}),
      ...(effectiveCatalogs.routeIds !== undefined ? { routeIds: effectiveCatalogs.routeIds } : {}),
      actionInputs: effectiveCatalogs.actionInputs,
      ...(effectiveCatalogs.viewFields !== undefined ? { viewFields: effectiveCatalogs.viewFields } : {}),
    });
    priorCompilation = { source: document, inputs, result };
    return result;
  });

  function handleSelect(occurrence: string): void {
    onSelect(occurrence);
  }

  $effect(() => {
    if (compiled.ok) onPlan?.(compiled.plan);
  });

  // Selection outline: applied as a data attribute on the exact selected
  // occurrence element. A dynamic selector cannot be expressed in the
  // component's style sheet (the markup-level style element is static), so
  // the previous inline rule never matched anything and the outline
  // silently never rendered.
  let canvasEl = $state<HTMLElement | undefined>(undefined);
  $effect(() => {
    const occurrence = selectedOccurrence;
    void compiled;
    let cancelled = false;
    let observer: MutationObserver | undefined;
    let marked: HTMLElement | undefined;
    const mark = () => {
      if (cancelled || canvasEl === undefined) return;
      const owner = canvasEl.querySelector<HTMLElement>('[data-ui-owner-root]')?.dataset.uiOwnerRoot;
      if (owner === undefined) return;
      // Include detached canvases as well as owned portals. An absent owner
      // never matches another editor's unowned occurrences.
      const targets = [...new Set([
        ...canvasEl.querySelectorAll<HTMLElement>('[data-ui-occ]'),
        ...globalThis.document.querySelectorAll<HTMLElement>('[data-ui-owner]'),
      ])].filter(element => element.dataset.uiOwner === owner);
      for (const element of targets) element.removeAttribute('data-ui-selected');
      const matching = targets.filter(element => element.dataset.uiOcc === occurrence);
      marked = occurrence === undefined ? undefined
        : matching.find(element => element.hasAttribute('data-ui-primary')) ?? matching[0];
      marked?.setAttribute('data-ui-selected', '');
    };
    void tick().then(() => {
      if (cancelled || canvasEl === undefined) return;
      mark();
      // A selected closed part can acquire its primary portal target later.
      // Observe membership, never layout, and mark only this canvas's owner.
      observer = new MutationObserver(mark);
      observer.observe(globalThis.document.body, { childList: true, subtree: true });
      observer.observe(canvasEl, { childList: true, subtree: true });
    });
    return () => { cancelled = true; observer?.disconnect(); marked?.removeAttribute('data-ui-selected'); };
  });

  const canvasClasses = $derived(
    selectedOccurrence !== undefined ? 'uv-canvas uv-canvas-has-selection' : 'uv-canvas',
  );
</script>

{#if compiled.ok}
  <div class={canvasClasses} bind:this={canvasEl}>
    {#if compiled.plan.diagnostics.length > 0}
      <ul class="uv-canvas-diagnostics" aria-label="Document diagnostics">
        {#each compiled.plan.diagnostics as diagnostic}
          <li>{diagnostic.code}: {diagnostic.message}</li>
        {/each}
      </ul>
    {/if}
    <style>
      .uv-canvas [data-ui-occ]:hover {
        outline: 1px dashed var(--ui-editor-hover, #7aa7ff);
        cursor: pointer;
      }
      [data-ui-selected] {
        outline: 2px solid var(--ui-editor-selected, #2b6cff);
        outline-offset: 1px;
      }
    </style>
    <DocumentHost
      plan={compiled.plan}
      extensionDescriptors={extensions}
      {extensionImplementations}
      {stateValues}
      {view}
      {record}
      localState={Object.keys(localState).length ? localState : document.localState}
      {resetSignal}
      {actionState}
      {onStateChange}
      {dispatch}
      {navigate}
      selectOccurrence={handleSelect}
      onRenderDiagnostic={onRenderDiagnostic}
      ariaLabel={ariaLabel}
    />
  </div>
{:else}
  <div class="uv-canvas-error" role="alert">
    The working document does not compile:
    <ul>
      {#each compiled.issues as issue}
        <li>{issue.code}: {issue.message}</li>
      {/each}
    </ul>
  </div>
{/if}
