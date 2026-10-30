import { graphWorkspaceDescriptor, graphViewportDescriptor, graphPortDescriptor,graphWorkspaceDescriptorV2,graphViewportDescriptorV2,graphPortDescriptorV2 } from '../composition/descriptors.js';
import type { UiExtensionDescriptor } from '@victframework/ui';
import { graphEditorParts } from '../editor/presentation.js';
const base = {
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: ['vict.ui-component-abi@1'],
  rendererImplementationId: 'vict.svelte.flow.authoring',
  styleTargets: ['root'],
  outputs: [],
} as const;
export const flowCanvasDescriptor: UiExtensionDescriptor = {
  ...base,
  id: 'vict.flow.canvas',
  props: [
    { name: 'label', type: 'string', default: 'Flow diagram' },
    { name: 'height', type: 'number', default: 360 },
    { name: 'controls', type: 'boolean', default: true },
    { name: 'minimap', type: 'boolean', default: false },
    { name: 'background', type: 'boolean', default: true },
  ],
  slots: ['nodes', 'edges'],
  inspectionLimits: [
    'Read-only authored topology and positions. Pan, zoom and keyboard selection are ephemeral. No workflow execution.',
  ],
};
export const flowNodeDescriptor: UiExtensionDescriptor = {
  ...base,
  id: 'vict.flow.node',
  props: [
    { name: 'id', type: 'string' },
    { name: 'label', type: 'string', default: '' },
    { name: 'x', type: 'number', default: 0 },
    { name: 'y', type: 'number', default: 0 },
  ],
  slots: [],
};
export const flowEdgeDescriptor: UiExtensionDescriptor = {
  ...base,
  id: 'vict.flow.edge',
  props: [
    { name: 'id', type: 'string' },
    { name: 'source', type: 'string' },
    { name: 'target', type: 'string' },
    { name: 'label', type: 'string', default: '' },
  ],
  slots: [],
};
/** Separate identity preserves the original read-only diagram contract. */
export const flowEditorDescriptor: UiExtensionDescriptor = {
  ...base,
  id: 'vict.flow.editor',
  props: [
    {
      name: 'graph',
      type: 'string',
      default: '{"schema":"vict.flow-graph@1","revision":0,"nodeTypes":[],"nodes":[],"edges":[]}',
    },
    { name: 'label', type: 'string', default: 'Node editor' },
    { name: 'height', type: 'number', default: 600 },
    { name: 'readOnly', type: 'boolean', default: false },
  ],
  outputs: [
    {
      name: 'graphChange',
      payload: 'string',
      description:
        'Validated vict.flow-graph@1 JSON after one complete transaction. Bind graph and this output to the same declared string state; the host decides durable canonical save/history.',
    },
    {
      name: 'selectionChange',
      payload: 'string',
      description:
        'Transient selected application graph node/edge IDs as JSON. Never canonical UI occurrence IDs.',
    },
  ],
  slots: [],
  inspectionLimits: [
    'Graph JSON is a bounded versioned model, not executable code. A host persistence/history bridge is required for canonical source saves.',
    'Node families declare supported field kinds and typed ports. Connecting cards does not execute a workflow.',
    'System clipboard is not accessed: the visible portable selection buffer supports copy/paste.',
  ],
};
/** Explicit parts are a new contract; the retained root-only @1 is unchanged. */
export const flowEditorDescriptorV2: UiExtensionDescriptor = { ...flowEditorDescriptor, revision: '2', styleTargets: graphEditorParts };
export { graphWorkspaceDescriptor, graphViewportDescriptor, graphPortDescriptor,graphWorkspaceDescriptorV2,graphViewportDescriptorV2,graphPortDescriptorV2 };
export const flowAuthoringDescriptors = [
  graphWorkspaceDescriptorV2,graphViewportDescriptorV2,graphPortDescriptorV2,
  graphWorkspaceDescriptor, graphViewportDescriptor, graphPortDescriptor,
  flowCanvasDescriptor,
  flowNodeDescriptor,
  flowEdgeDescriptor,
  flowEditorDescriptor,
  flowEditorDescriptorV2,
] as const;
