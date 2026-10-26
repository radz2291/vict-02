/**
 * `@victframework/ui-editor` — editor session core + canvas/inspector/history
 * modules (API-SPEC §9). Svelte at the boundary only; all document semantics
 * live in `@victframework/ui`'s frozen session/transaction engine.
 */

export { default as EditorCanvas } from './EditorCanvas.svelte';
export { default as Composer } from './Composer.svelte';
export { default as CompositionNavigator } from './CompositionNavigator.svelte';
export { authoredOccurrence, compositionSlots, compositionMembers, compositionTrail, firstCompositionSlot, projectComposition } from './composition-focus.js';
export type { CompositionFocus } from './composition-focus.js';
export { default as SelectionToolbar } from './SelectionToolbar.svelte';
export { default as SelectionPalette } from './SelectionPalette.svelte';
export { literalTextTarget, editLiteralText, duplicateSubtree } from './selection-tools.js';
export { default as PanelResizer } from './PanelResizer.svelte';
export {
  insertSubtree,
  canInsertRecipe,
  insertRecipe,
  compositionTargets,
  detachedContent,
  detachSlotContent,
  compositionParent,
  compositionChildren,
  compositionName,
  compositionNames,
  moveRelative,
} from './composition.js';
export { conditionalStyleConflicts, allowConditionalStyles } from './responsive-style.js';
export type { CompositionTarget, InsertRecipe } from './composition.js';
export { default as HistoryPanel } from './HistoryPanel.svelte';
export { default as Inspector } from './Inspector.svelte';
export { default as Layers } from './Layers.svelte';
export { default as StateInitialEditor } from './StateInitialEditor.svelte';
export { default as StateValuesPanel } from './StateValuesPanel.svelte';
export type { EditorLabels } from './inspector-ux.js';
export { EditorBridge } from './bridge.js';
export type { DocumentStorePort, EditorBridgeState, DocumentStoreLoadResult } from './bridge.js';
export {
  classifyStored,
  createLocalStorageDocumentStore,
  type LocalStorageDocumentStore,
  type LocalStorageStoreLoad,
  type LocalStorageStoreOptions,
} from './local-storage-store.js';
export {
  bindExpression,
  connectInteraction,
  fillSlot,
  insertElement,
  insertText,
  moveNode,
  removeNode,
  rootIdOf,
  setAttribute,
  setConditionalStyle,
  setOutputBinding,
  setStyle,
  setBaseStyle,
  setStateInitial,
  wireNativeInput,
  setTextLiteral,
} from './commands.js';
export type { TransactionDraft } from './commands.js';
export { isSelected, resolveOccurrence } from './occurrence.js';
export type { OccurrenceReport } from './occurrence.js';

export { interactiveSlotConflicts } from './interactive-slots.js';
export { authoringRecipe, insertRegisteredComponent, insertRegisteredElement } from './registered-authoring.js';
export { defineStyleSource, attachStyleSource, detachStyleSource, removeStyleSource, StyleSourceEditError } from './style-sources.js';

export {selectionOperation, occurrenceRange} from './selection-intent.js';
export type {SelectionOperation, OccurrenceSelectionIntent} from './selection-intent.js';
