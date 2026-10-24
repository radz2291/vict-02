import type { UiExtensionDescriptor } from '@victframework/ui';
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
export const flowAuthoringDescriptors = [
  flowCanvasDescriptor,
  flowNodeDescriptor,
  flowEdgeDescriptor,
] as const;
