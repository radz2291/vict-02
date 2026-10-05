/**
 * `@victframework/ui-editor` — editor session core + canvas/inspector/history
 * modules (API-SPEC §9). Svelte at the boundary only; all document semantics
 * live in `@victframework/ui`'s frozen session/transaction engine.
 */

export { EditorBridge } from './bridge.js';
export type { DocumentStorePort, EditorBridgeState } from './bridge.js';
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
  setStyle,
  setTextLiteral,
} from './commands.js';
export type { TransactionDraft } from './commands.js';
export { isSelected, resolveOccurrence } from './occurrence.js';
export type { OccurrenceReport } from './occurrence.js';
