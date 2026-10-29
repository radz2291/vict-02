import type { Snippet } from 'svelte';
import type { UiScopedSlotFrame } from '@victframework/ui-svelte';
import type { GraphDocument, GraphNode, GraphOperation, GraphPort, GraphSelection } from '../editor/model.js';
import type { GraphPresentationState } from '../editor/host.js';

export const GRAPH_WORKSPACE = Symbol('vict.flow.workspace@1');
export const GRAPH_BODY = Symbol('vict.flow.node-body@1');
/** Runtime-only adapter. Canonical bodies and bindings remain in the UI document. */
export interface GraphWorkspaceContext {
  readonly graph: GraphDocument;
  readonly selection: GraphSelection;
  readonly readOnly: boolean;
  viewFor(projectionKey: string): GraphPresentationState | undefined;
  readonly body: Snippet<[UiScopedSlotFrame]> | undefined;
  frame(node: GraphNode, projectionKey?: string): UiScopedSlotFrame;
  apply(operations: readonly GraphOperation[], expectedRevision?: number): void;
  select(selection: GraphSelection): void;
  remember(projectionKey: string, viewport: {x:number;y:number;zoom:number}): void;
  undo(): void;
  redo(): void;
}
export interface GraphBodyContext {
  readonly nodeId: string;
  readonly ports: readonly GraphPort[];
  readonly readOnly: boolean;
  registerPort(id: string, token: symbol): () => void;
  uniquePort(id: string): boolean;
}
