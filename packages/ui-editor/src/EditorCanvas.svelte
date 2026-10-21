<script lang="ts">
  /**
   * EditorCanvas — renders the WORKING document through the same generic
   * DocumentHost the product uses (one renderer), and wires selection:
   * clicking a rendered element selects its source occurrence (the host
   * reports the full occurrence key incl. instance path + record keys).
   * The selection outline is a canvas-level presentation rule — never
   * document source.
   */
  import { tick, untrack, type Snippet } from 'svelte';
  import FloatingSelection from './FloatingSelection.svelte';
  import { literalTextTarget, editLiteralText } from './selection-tools.js';
  import { resolveOccurrence } from './occurrence.js';
  import type { TransactionDraft } from './commands.js';
  import { compositionParent } from './composition.js';
  import {projectComposition,authoredOccurrence,compositionSlots,type CompositionFocus} from './composition-focus.js';
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
    /** Design suppresses owned runtime input, including portals; omitted preserves existing consumers. */
    readonly interactionMode?: 'design' | 'interact';
    /** Enables literal text editing in Design through the canonical transaction boundary. */
    readonly onApply?: (draft: TransactionDraft) => boolean;
    /** Host-owned text editor replaces the default canvas overlay when supplied. */
    readonly onEditTextRequest?: (occurrence: string) => void;
    readonly editTextSignal?: symbol;
    readonly onTextEditingChange?: (editing: boolean) => void;
    /** Authoring-only tools anchored to the selected rendered occurrence. F10 focuses them. */
    readonly selectionTools?: Snippet;
    /** Source-slot viewport. Navigation only; the full document still compiles unchanged. */
    readonly compositionFocus?: CompositionFocus;
    readonly onOpenComposition?: (occurrence: string) => void;
    readonly selectionToolsPinned?: boolean;
    readonly selectionToolsReveal?: symbol;
    readonly selectionToolsPlacement?: 'above' | 'below';
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
    interactionMode = 'interact',
    onApply,
    editTextSignal,
    onEditTextRequest,
    onTextEditingChange,
    selectionTools,
    compositionFocus,
    onOpenComposition,
    selectionToolsPinned = false,
    selectionToolsReveal,
    selectionToolsPlacement,
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
  const focusedPlan=$derived(compiled.ok && interactionMode==='design' && compositionFocus?projectComposition(compiled.plan,document,compositionFocus,extensions,extensionImplementations.filter(entry=>'requiresParentContext' in entry && entry.requiresParentContext).map(entry=>entry.extensionId),extensionImplementations.filter(entry=>'compositionSlots' in entry && entry.compositionSlots?.includes(compositionFocus.slotName)).map(entry=>`${entry.extensionId}@${entry.revision}`)):undefined);

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
  let inlineEdit = $state<{ nodeId: string; value: string; left: number; top: number; width: number; revision: string }>();
  let textInput = $state<HTMLTextAreaElement>();
  $effect(() => { const editing = inlineEdit !== undefined; untrack(() => onTextEditingChange?.(editing)); });
  async function beginText(occurrence: string, target?: HTMLElement) {
    if (interactionMode !== 'design' || !canvasEl) return;
    const report = resolveOccurrence(occurrence, document);
    if (report.instancePath.some(step=>document.componentDefinitions[step.definitionId]) || report.repeatKeys.length) return;
    const content = literalTextTarget(document, report.sourceNodeId);
    if (!content) return;
    if (onEditTextRequest) { onEditTextRequest(occurrence); return; }
    if (!onApply) return;
    const owner = canvasEl.querySelector<HTMLElement>('[data-ui-owner-root]')?.dataset.uiOwnerRoot;
    const elements = [...globalThis.document.querySelectorAll<HTMLElement>('[data-ui-occ]')].filter(el => el.dataset.uiOwner === owner);
    let element = target ?? elements.find(el => el.dataset.uiOcc === occurrence);
    if (!element) for (const ancestor of toolAncestors) {
      element = elements.find(el => el.dataset.uiOcc === ancestor && el.getBoundingClientRect().width > 0);
      if (element) break;
    }
    if (!content || !element) return;
    while (element && element !== canvasEl && element.getBoundingClientRect().width === 0) element = element.parentElement ?? undefined;
    if (!element) return;
    const bounds = element.getBoundingClientRect(), canvas = canvasEl.getBoundingClientRect();
    const width = Math.min(Math.max(180, bounds.width), canvas.width);
    inlineEdit = { nodeId: report.sourceNodeId, value: content.value, left: Math.max(0, Math.min(bounds.left - canvas.left, canvas.width - width)), top: bounds.top - canvas.top, width, revision: JSON.stringify(document) };
    await tick(); textInput?.focus(); textInput?.select();
  }
  function finishText(commit: boolean) {
    const edit = inlineEdit;
    inlineEdit = undefined;
    if (commit && edit && edit.revision === JSON.stringify(document)) {
      const target = literalTextTarget(document, edit.nodeId);
      if (target && target.value !== edit.value) { const draft = editLiteralText(document, edit.nodeId, edit.value); if (draft) onApply?.(draft); }
    }
    canvasEl?.focus({ preventScroll: true });
  }
  $effect(() => { if (editTextSignal) untrack(() => { if (selectedOccurrence) void beginText(selectedOccurrence); }); });
  $effect(() => { if (inlineEdit && (inlineEdit.revision !== JSON.stringify(document) || interactionMode !== 'design')) inlineEdit = undefined; });
  $effect(() => {
    if (interactionMode !== 'design' || !canvasEl) return;
    const intercept = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[data-ui-inline-editor]')) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ui-occ]') : null;
      const owner = canvasEl?.querySelector<HTMLElement>('[data-ui-owner-root]')?.dataset.uiOwnerRoot;
      if (!owner || target?.dataset.uiOwner !== owner) return;
      if (selectionTools && event instanceof KeyboardEvent && event.key === 'F10') return;
      if ((onApply || onEditTextRequest) && event instanceof KeyboardEvent && (['F2', 'Delete', 'Backspace'].includes(event.key) || (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)))) return;
      if (event.type === 'dblclick' && target.dataset.uiOcc) {
        const node=resolveOccurrence(target.dataset.uiOcc,document).node;
        if(onOpenComposition && node && compositionSlots(document,node.id,extensions).length) onOpenComposition(target.dataset.uiOcc);
        else void beginText(target.dataset.uiOcc, target);
      }
      // Tab and Escape remain available for navigation and overlay dismissal. Activation/editing
      // events stop before catalog handlers, native inputs and form submission.
      if (event instanceof KeyboardEvent && (['Tab', 'Escape'].includes(event.key) || event.ctrlKey || event.metaKey)) return;
      if (event.cancelable) event.preventDefault();
      event.stopImmediatePropagation();
      if (event.type === 'pointerdown' || event.type === 'click' || (event instanceof KeyboardEvent && ['Enter', ' '].includes(event.key))) {
        if (target.dataset.uiOcc) onSelect(target.dataset.uiOcc);
      }
    };
    const events = ['pointerdown', 'click', 'dblclick', 'keydown', 'keyup', 'beforeinput', 'input', 'change', 'submit'] as const;
    for (const event of events) globalThis.document.addEventListener(event, intercept, true);
    return () => { for (const event of events) globalThis.document.removeEventListener(event, intercept, true); };
  });
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
  const toolAncestors = $derived.by(() => {
    if (!selectedOccurrence) return [];
    const selected = resolveOccurrence(selectedOccurrence, document);
    if (selected.repeatKeys.length || selected.instancePath.some(step => document.componentDefinitions[step.definitionId])) return [];
    const ancestors: string[] = [], seen = new Set<string>();
    let context = selectedOccurrence.split('|').slice(2);
    let id = selected.sourceNodeId;
    while (!seen.has(id)) {
      seen.add(id);
      const parent = compositionParent(document, id);
      if (!parent) break;
      id = parent.nodeId;
      const ownerIndex = context.findIndex(segment => segment.startsWith(`${id}@`));
      if (ownerIndex >= 0) context = context.slice(0, ownerIndex);
      context = context.filter(segment => !segment.startsWith(`portal:${id}:`));
      ancestors.push([document.id,id,...context].join('|'));
    }
    return ancestors;
  });
</script>

{#if compiled.ok}
  {#if canvasEl && selectedOccurrence && selectionTools && interactionMode === 'design' && !inlineEdit}
    <FloatingSelection canvas={canvasEl} occurrence={selectedOccurrence} fallbackOccurrences={toolAncestors} revealSignal={selectionToolsReveal} preferred={selectionToolsPlacement} pinned={selectionToolsPinned}>{@render selectionTools()}</FloatingSelection>
  {/if}
  <div class={canvasClasses} class:uv-canvas-design={interactionMode === 'design'} bind:this={canvasEl} tabindex="-1" style:position="relative">
    {#if inlineEdit}
      <div data-ui-inline-editor class="inline-text-editor" style:left={`${inlineEdit.left}px`} style:top={`${inlineEdit.top}px`} style:width={`${inlineEdit.width}px`}>
        <textarea aria-label="Edit canvas text" bind:this={textInput} value={inlineEdit.value} oninput={event => { if (inlineEdit) inlineEdit.value = event.currentTarget.value; }} onkeydown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); finishText(false); } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); finishText(true); } }}></textarea>
        <div><button type="button" onclick={() => finishText(true)}>Apply</button><button type="button" onclick={() => finishText(false)}>Cancel</button><span>Ctrl+Enter · apply</span></div>
      </div>
    {/if}
    {#if compiled.plan.diagnostics.length > 0}
      <ul class="uv-canvas-diagnostics" aria-label="Document diagnostics">
        {#each compiled.plan.diagnostics as diagnostic}
          <li>{diagnostic.code}: {diagnostic.message}</li>
        {/each}
      </ul>
    {/if}
    <style>
      .uv-canvas-design [data-ui-occ]:hover:not(:has([data-ui-occ]:hover)) {
        outline: 1px dashed var(--ui-editor-hover, #7aa7ff);
        cursor: pointer;
      }
      [data-ui-selected] {
        outline: 2px solid var(--ui-editor-selected, #2b6cff);
        outline-offset: 1px;
      }
    </style>
    <DocumentHost
      plan={focusedPlan ?? compiled.plan}
      componentSurface={focusedPlan && compositionFocus ? {occurrenceKey: authoredOccurrence(document,compositionFocus.nodeId) ?? '',slotName:compositionFocus.slotName} : undefined}
      extensionDescriptors={extensions}
      {extensionImplementations}
      {stateValues}
      {view}
      {record}
      localState={Object.keys(localState).length ? localState : document.localState}
      {resetSignal}
      {actionState}
      {onStateChange}
      dispatch={interactionMode === 'design' ? async () => ({ ok: false, code: 'UI_EDITOR_DESIGN_MODE', message: 'Switch to Interact to run behavior.' }) : dispatch}
      navigate={interactionMode === 'design' ? () => {} : navigate}
      selectOccurrence={interactionMode === 'interact' ? handleSelect : undefined}
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
<style>
  .inline-text-editor { position:absolute; z-index:10; max-width:100%; padding:6px; background:white; border:2px solid #5269bd; border-radius:4px; box-shadow:0 6px 24px #25334f26; box-sizing:border-box; }
  .inline-text-editor textarea { width:100%; min-height:68px; resize:vertical; padding:7px; border:1px solid #dce2eb; color:#263246; background:white; font:16px/1.4 system-ui,sans-serif; box-sizing:border-box; }
  .inline-text-editor > div { display:flex; align-items:center; gap:5px; margin-top:4px; }
  .inline-text-editor button { font:12px system-ui,sans-serif; padding:4px 8px; background:#fff; border:1px solid #dce2eb; border-radius:4px; cursor:pointer; }
  .inline-text-editor span { font:10px system-ui,sans-serif; color:#74829a; }
 :global(.uv-composition-context){display:block!important;position:relative!important;visibility:visible!important;}
 :global(.uv-composition-surface){display:block!important;position:relative!important;visibility:visible!important;min-height:160px;box-sizing:border-box;}
 :global(.uv-composition-tile){display:block!important;position:relative!important;visibility:visible!important;min-height:44px;border:1px dashed #a9b6d0;border-radius:6px;padding:12px;margin:6px 0;color:#5d6f95;background:#f6f8fc;cursor:pointer;font:12px/1.5 system-ui,sans-serif;}
</style>
