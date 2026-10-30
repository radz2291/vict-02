import type { GraphDocument } from '../src/editor/model.js';
export const graphFixture = (): GraphDocument => ({
  schema: 'vict.flow-graph@1',
  revision: 3,
  nodeTypes: [
    {
      id: 'processor',
      label: 'Processor',
      fields: [
        { id: 'prompt', label: 'Prompt', kind: 'textarea', default: '' },
        { id: 'items', label: 'Items', kind: 'list', default: [] },
        { id: 'amount', label: 'Amount', kind: 'slider', default: 1, min: 0, max: 10 },
        { id: 'enabled', label: 'Enabled', kind: 'toggle', default: true },
      ],
      ports: [
        { id: 'in', label: 'Input', direction: 'input', type: 'text', maxConnections: 1 },
        { id: 'out', label: 'Output', direction: 'output', type: 'text' },
      ],
    },
  ],
  nodes: [
    {
      id: 'a',
      type: 'processor',
      label: 'First',
      position: { x: 0, y: 0 },
      values: { prompt: 'original', items: ['one'] },
    },
    {
      id: 'b',
      type: 'processor',
      label: 'Second',
      position: { x: 400, y: 0 },
      values: { amount: 2 },
    },
    { id: 'c', type: 'processor', label: 'Third', position: { x: 800, y: 0 }, values: {} },
  ],
  edges: [{ id: 'ab', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' }],
});
