/** Optional canonical host history. Standalone consumers may use local GraphSession history. */
import type { GraphDocument, GraphIssue } from './model.js';
import type { GraphSelection } from './model.js';
import type { GraphDocumentV2 } from './model-v2.js';
export const GRAPH_EDITOR_HOST = Symbol.for('vict.flow.editor-host@1');
/** Occurrence-aware source authority. @1 remains a compatibility fallback. */
export const GRAPH_EDITOR_HOST_V2 = Symbol.for('vict.flow.editor-host@2');
export type GraphOccurrenceRoute = readonly {
  readonly workspaceNodeId: string;
  readonly graphNodeId: string;
  readonly expectedGraphRevision: number;
}[];
export interface GraphOccurrenceIdentity {
  readonly nodeId: string;
  readonly occurrenceKey: string;
  readonly occurrenceRoute: GraphOccurrenceRoute;
}
export type GraphAuthoringDisposition =
  | { readonly kind: 'source'; readonly history: GraphHistoryController }
  | { readonly kind: 'runtime' }
  | { readonly kind: 'refused'; readonly message: string };
export interface GraphEditorHostV2 extends Omit<GraphEditorHost, 'historyFor'> {
  authoringFor(identity: GraphOccurrenceIdentity): GraphAuthoringDisposition;
}
export interface GraphHistoryController {
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
}
export interface GraphEditorHost {
  historyFor(identity: {
    nodeId: string;
    occurrenceKey: string;
  }): GraphHistoryController | undefined;
  validate?(
    identity: { nodeId: string; occurrenceKey: string },
    graph: GraphDocument,
  ): readonly GraphIssue[];
  /** Explicit v2 hook: existing v1 validators never receive a new model shape. */
  validateV2?(
    identity: { nodeId: string; occurrenceKey: string },
    graph: GraphDocumentV2,
  ): readonly GraphIssue[];
  presentationFor?(identity: {
    nodeId: string;
    occurrenceKey: string;
  }): GraphPresentationController | undefined;
}
export interface GraphPresentationState {
  viewport: { x: number; y: number; zoom: number };
  selection: GraphSelection;
}
export interface GraphPresentationController {
  get(): GraphPresentationState | undefined;
  set(state: GraphPresentationState): void;
}
