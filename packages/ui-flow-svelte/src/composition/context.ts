import type { Snippet } from 'svelte';
import type { UiScopedSlotFrame } from '@victframework/ui-svelte';
import type { GraphEdge, GraphPort, GraphSelection, GraphIssue } from '../editor/model.js';
import type { GraphPresentationState } from '../editor/host.js';

export const GRAPH_WORKSPACE = Symbol('vict.flow.workspace@1');
export const GRAPH_BODY = Symbol('vict.flow.node-body@1');
/** Geometry consumes topology, never a control-specific parameter representation. */
export interface GraphWorkspaceNode {readonly id:string;readonly type:string;readonly label:string;readonly position:{x:number;y:number}}
export interface GraphWorkspaceGraph {readonly revision:number;readonly nodes:readonly GraphWorkspaceNode[];readonly edges:readonly GraphEdge[]}
/** Runtime-only adapter. Canonical bodies and bindings remain in the UI document. */
export interface GraphWorkspaceContext {
  readonly graph: GraphWorkspaceGraph;
  readonly selection: GraphSelection;
  readonly readOnly: boolean;
  viewFor(projectionKey: string): GraphPresentationState | undefined;
  readonly body: Snippet<[UiScopedSlotFrame]> | undefined;
  frame(node: GraphWorkspaceNode, projectionKey?: string): UiScopedSlotFrame;
  ports(node:GraphWorkspaceNode):readonly GraphPort[];
  connectionIssue(edge:GraphEdge):GraphIssue|undefined;
  /** Validated by the workspace's exact model version before applying. */
  apply(operations: readonly unknown[], expectedRevision?: number): void;
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
