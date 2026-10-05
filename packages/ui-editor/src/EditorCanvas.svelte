<script lang="ts">
  /**
   * EditorCanvas — renders the WORKING document through the same generic
   * DocumentHost the product uses (one renderer), and wires selection:
   * clicking a rendered element selects its source occurrence (the host
   * reports the full occurrence key incl. instance path + record keys).
   * The selection outline is a canvas-level presentation rule — never
   * document source.
   */
  import DocumentHost from '@victframework/ui-svelte';
  import {
    compileUiDocument,
    defaultSemanticElementCatalog,
    type UiCatalogs,
    type UiDocument,
    type UiExtensionDescriptor,
    type UiLocalStateDecl,
  } from '@victframework/ui';

  interface Props {
    readonly document: UiDocument;
    readonly catalogs?: UiCatalogs;
    readonly extensions?: readonly UiExtensionDescriptor[];
    readonly localState?: Readonly<Record<string, UiLocalStateDecl>>;
    readonly view?: Readonly<Record<string, unknown>>;
    readonly record?: Readonly<Record<string, unknown>>;
    readonly selectedOccurrence?: string;
    readonly onSelect: (occurrence: string) => void;
    readonly dispatch: (actionId: string, input?: unknown) => Promise<unknown>;
    readonly navigate: (routeId: string, params?: Readonly<Record<string, unknown>>) => void;
    readonly ariaLabel?: string;
  }

  let {
    document,
    catalogs,
    extensions = [],
    localState = {},
    view = {},
    record = {},
    selectedOccurrence,
    onSelect,
    dispatch,
    navigate,
    ariaLabel = 'Document canvas',
  }: Props = $props();

  const effectiveCatalogs = $derived(
    catalogs ?? { elements: defaultSemanticElementCatalog(), actionIds: [], routeIds: [] },
  );

  const compiled = $derived.by(() => {
    return compileUiDocument(document, effectiveCatalogs.elements, extensions, {
      ...(effectiveCatalogs.actionIds !== undefined ? { actionIds: effectiveCatalogs.actionIds } : {}),
      ...(effectiveCatalogs.routeIds !== undefined ? { routeIds: effectiveCatalogs.routeIds } : {}),
      ...(effectiveCatalogs.viewFields !== undefined ? { viewFields: effectiveCatalogs.viewFields } : {}),
    });
  });

  function handleSelect(occurrence: string): void {
    onSelect(occurrence);
  }

  function escapeSelector(value: string): string {
    return value.replace(/"/g, '\\"');
  }
</script>

{#if compiled.ok}
  <div class="uv-canvas" class="uv-canvas-has-selection={selectedOccurrence !== undefined}">
    <style>
      .uv-canvas [data-ui-occ]:hover {
        outline: 1px dashed var(--ui-editor-hover, #7aa7ff);
        cursor: pointer;
      }
    </style>
    {#if selectedOccurrence !== undefined}
      <style>
        .uv-canvas [data-ui-occ='{escapeSelector(selectedOccurrence)}'] {
          outline: 2px solid var(--ui-editor-selected, #2b6cff);
          outline-offset: 1px;
        }
      </style>
    {/if}
    <DocumentHost
      plan={compiled.plan}
      {view}
      {record}
      {localState}
      {dispatch}
      {navigate}
      selectOccurrence={handleSelect}
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
