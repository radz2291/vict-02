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

  const compiled = $derived.by(() => {
    return compileUiDocument(document, effectiveCatalogs.elements, extensions, {
      ...(effectiveCatalogs.actionIds !== undefined ? { actionIds: effectiveCatalogs.actionIds } : {}),
      ...(effectiveCatalogs.routeIds !== undefined ? { routeIds: effectiveCatalogs.routeIds } : {}),
      actionInputs: effectiveCatalogs.actionInputs,
      ...(effectiveCatalogs.viewFields !== undefined ? { viewFields: effectiveCatalogs.viewFields } : {}),
    });
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
    const ok = compiled.ok;
    let cancelled = false;
    void tick().then(() => {
      if (cancelled || canvasEl === undefined) return;
      const owner = canvasEl.querySelector<HTMLElement>('[data-ui-owner-root]')?.dataset.uiOwnerRoot;
      const targets = Array.from(globalThis.document.querySelectorAll<HTMLElement>('[data-ui-owner]')).filter(element => element.dataset.uiOwner === owner);
      for (const element of targets) element.removeAttribute('data-ui-selected');
      if (occurrence !== undefined) {
        const matching = targets.filter(element => element.dataset.uiOcc === occurrence);
        const target = matching.find(element => element.hasAttribute('data-ui-primary') && element.getBoundingClientRect().width > 0)
          ?? matching.find(element => element.getBoundingClientRect().width > 0);
        target?.setAttribute('data-ui-selected', '');
      }
    });
    return () => {
      cancelled = true;
    };
  });

  const canvasClasses = $derived(
    selectedOccurrence !== undefined ? 'uv-canvas uv-canvas-has-selection' : 'uv-canvas',
  );
</script>

{#if compiled.ok}
  <div class={canvasClasses} bind:this={canvasEl}>
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
