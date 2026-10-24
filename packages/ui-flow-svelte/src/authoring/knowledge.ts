import type { UiAuthoringFragment, UiAuthoringPackage } from '@victframework/ui';
import { flowCanvasDescriptor, flowNodeDescriptor, flowEdgeDescriptor } from './descriptors.js';
import { specialistPublicExports } from './public-exports.js';
import compatibility from './compatibility.json' with { type: 'json' };

const canvas: UiAuthoringFragment = {
  root: 'canvas',
  nodes: [
    {
      kind: 'component',
      id: 'canvas',
      definitionId: 'vict.flow.canvas',
      revision: '1',
      slots: {
        nodes: { name: 'nodes', children: ['start', 'finish'] },
        edges: { name: 'edges', children: ['connection'] },
      },
    },
    {
      kind: 'component',
      id: 'start',
      definitionId: 'vict.flow.node',
      revision: '1',
      props: {
        id: { type: 'literal', value: 'start' },
        label: { type: 'literal', value: 'Start' },
        x: { type: 'literal', value: 20 },
        y: { type: 'literal', value: 40 },
      },
    },
    {
      kind: 'component',
      id: 'finish',
      definitionId: 'vict.flow.node',
      revision: '1',
      props: {
        id: { type: 'literal', value: 'finish' },
        label: { type: 'literal', value: 'Finish' },
        x: { type: 'literal', value: 280 },
        y: { type: 'literal', value: 40 },
      },
    },
    {
      kind: 'component',
      id: 'connection',
      definitionId: 'vict.flow.edge',
      revision: '1',
      props: {
        id: { type: 'literal', value: 'start-finish' },
        source: { type: 'literal', value: 'start' },
        target: { type: 'literal', value: 'finish' },
        label: { type: 'literal', value: 'Next' },
      },
    },
  ],
};
export const flowAuthoringPackage: UiAuthoringPackage = {
  compatibility,
  schema: 'vict.ui-authoring@1',
  packageName: '@victframework/ui-flow-svelte',
  packageVersion: '0.4.0-rc.1',
  registrations: [
    {
      descriptor: flowCanvasDescriptor,
      label: 'Flow canvas',
      family: 'flow',
      category: 'diagram',
      purpose: 'Read-only authored topology and positions with ephemeral pan, zoom and selection.',
      eligibility: { kind: 'standalone' },
      dependencies: [
        { id: flowNodeDescriptor.id, revision: '1' },
        { id: flowEdgeDescriptor.id, revision: '1' },
      ],
      guidance: [
        'Import @victframework/ui-flow-svelte/styles.css. Nodes and edges are canonical declaration children in explicit slots.',
        'Graph ids are local to this canvas occurrence and distinct from canonical source ids. Duplicate evaluated ids or unavailable endpoints refuse presentation.',
        'No dragging, connecting, deletion, executable node types or workflow execution is enabled. Change positions and topology through normal authored props and history.',
      ],
      seed: canvas,
      examples: [canvas],
    },
    {
      descriptor: flowNodeDescriptor,
      label: 'Flow node declaration',
      family: 'flow',
      category: 'diagram-part',
      purpose: 'Declare one visible card at scalar x/y in the owning canvas.',
      eligibility: { kind: 'part' },
      rules: [
        {
          kind: 'ancestorSlot',
          placements: [{ definitionId: 'vict.flow.canvas', revision: '1', slotName: 'nodes' }],
        },
        {
          kind: 'uniqueValue',
          property: 'id',
          providerIds: ['vict.flow.canvas'],
          slots: ['nodes'],
          namespace: 'flow-node',
          nonempty: true,
        },
        {
          kind: 'hostRequirement',
          capability: 'vict.flow.canvas-context@1',
          reason:
            'The nearest canvas owns this declaration and forwards the exact child presentation target onto its visible card.',
        },
      ],
      guidance: [
        'Not a standalone preview. Insert under canvas.nodes; wrappers, repeats and local definitions must preserve the provider slot.',
        'Evaluated ids must be unique in this canvas, and x/y must be finite numbers. Dynamic or repeated values are checked by the canvas at render time.',
      ],
      examples: [canvas],
    },
    {
      descriptor: flowEdgeDescriptor,
      label: 'Flow edge declaration',
      family: 'flow',
      category: 'diagram-part',
      purpose: 'Declare an edge between two unambiguous node ids in the owning canvas.',
      eligibility: { kind: 'part' },
      rules: [
        {
          kind: 'ancestorSlot',
          placements: [{ definitionId: 'vict.flow.canvas', revision: '1', slotName: 'edges' }],
        },
        {
          kind: 'uniqueValue',
          property: 'id',
          providerIds: ['vict.flow.canvas'],
          slots: ['edges'],
          namespace: 'flow-edge',
          nonempty: true,
        },
        {
          kind: 'hostRequirement',
          capability: 'vict.flow.canvas-context@1',
          reason:
            'The canvas validates evaluated endpoints and forwards the exact child target onto the visible SVG edge.',
        },
      ],
      guidance: [
        'Not a standalone preview. Insert under canvas.edges. source and target must each resolve to exactly one evaluated node id in the same canvas.',
        'Node and edge id namespaces are separate. No implicit workflow or connection mutation.',
      ],
      examples: [canvas],
    },
  ],
  exportDispositions: [
    {
      name: './authoring',
      disposition: 'registered',
      reason: 'Only exact scalar ABI canvas/node/edge declarations are authored here.',
    },
    ...specialistPublicExports.map((name) => ({
      name,
      disposition: name.startsWith('./authoring:') ? 'registration-api' : 'host-only',
      reason: name.startsWith('./authoring:')
        ? 'Descriptor, implementation or knowledge install data. Only exact registered descriptor identities are authored.'
        : 'Public code composition/type/helper API; graph arrays, callbacks and Studio structure adapters are not automatically authorable.',
    })),
  ],
};
