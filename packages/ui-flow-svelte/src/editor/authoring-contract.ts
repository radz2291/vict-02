import { graphWorkspaceDescriptor, graphWorkspaceDescriptorV2 } from '../composition/descriptors.js';
import { flowEditorDescriptor, flowEditorDescriptorV2 } from '../authoring/descriptors.js';

/** Host metadata only. This does not change saved graph or UI document schemas. */
export interface GraphAuthoringContract {
  readonly schema: 'vict.flow-authoring@1';
  readonly definitionId: string;
  readonly revision: string;
  readonly modelVersion: 1 | 2;
  readonly valueProp: 'graph';
  readonly changeOutput: 'graphChange';
  /** A host may author defaults only after resolving both bindings to one owner. */
  readonly persistence: 'explicit-bidirectional-state';
  readonly body?: {
    readonly slot: 'body';
    readonly nodeIdProp: 'nodeId';
    readonly controlledState: 'node-parameters' | 'legacy-node-fields';
  };
}

const registration = (
  descriptor: { readonly id: string; readonly revision: string },
  modelVersion: 1 | 2,
  body = false,
): GraphAuthoringContract => Object.freeze({
  schema: 'vict.flow-authoring@1',
  definitionId: descriptor.id,
  revision: descriptor.revision,
  modelVersion,
  valueProp: 'graph',
  changeOutput: 'graphChange',
  persistence: 'explicit-bidirectional-state',
  ...(body ? { body: Object.freeze({
    slot: 'body' as const,
    nodeIdProp: 'nodeId' as const,
    controlledState: modelVersion === 2 ? 'node-parameters' as const : 'legacy-node-fields' as const,
  }) } : {}),
});

/** Exact host registrations; ordinary components inside a node need no entry. */
export const graphAuthoringRegistrations: readonly GraphAuthoringContract[] = Object.freeze([
  registration(graphWorkspaceDescriptor, 1, true),
  registration(graphWorkspaceDescriptorV2, 2, true),
  registration(flowEditorDescriptor, 1),
  registration(flowEditorDescriptorV2, 1),
]);

/** Historical omitted revisions keep their explicit @1 identity, never sniff data. */
const unpinnedDefaults: Readonly<Record<string, string>> = Object.freeze({
  [graphWorkspaceDescriptor.id]: graphWorkspaceDescriptor.revision,
  [flowEditorDescriptor.id]: flowEditorDescriptor.revision,
});

export function graphAuthoringContract(definitionId: string, revision?: string): GraphAuthoringContract | undefined {
  const exactRevision = revision ?? (Object.hasOwn(unpinnedDefaults, definitionId) ? unpinnedDefaults[definitionId] : undefined);
  return graphAuthoringRegistrations.find(item => item.definitionId === definitionId && item.revision === exactRevision);
}
