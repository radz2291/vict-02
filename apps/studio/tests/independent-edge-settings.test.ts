// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import type { UiScopedSlotFrame } from '@victframework/ui-svelte';
import { type GraphWorkspaceContext, type GraphEditorHostV2 } from '@victframework/ui-flow-svelte';
import Harness from './fixtures/IndependentEdgeHarness.svelte';

const initial = JSON.stringify({
  schema: 'vict.flow-graph@3',
  revision: 0,
  nodeTypes: [
    {
      id: 'cell',
      label: 'Cell',
      parameters: {},
      ports: [
        { id: 'out', label: 'Out', direction: 'output', type: 'text' },
        { id: 'in', label: 'In', direction: 'input', type: 'text' },
      ],
    },
  ],
  nodes: ['a', 'b', 'c'].map((id, i) => ({
    id,
    type: 'cell',
    label: id,
    position: { x: i * 200, y: 0 },
    values: {},
  })),
  edges: [
    { id: 'same-edge', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' },
    { id: 'second-edge', source: 'a', sourcePort: 'out', target: 'c', targetPort: 'in' },
  ],
});
const settle = async () => {
  flushSync();
  await Promise.resolve();
  flushSync();
};
async function open(host?: GraphEditorHostV2) {
  const target = document.createElement('div');
  document.body.append(target);
  let context!: GraphWorkspaceContext;
  const frames: Record<string, UiScopedSlotFrame> = {},
    events: Array<[string, unknown]> = [];
  const app = mount(Harness, {
    target,
    props: {
      initial,
      host,
      emit: (name: string, value: unknown) => events.push([name, value]),
      expose: (value: GraphWorkspaceContext) => {
        context = value;
      },
      frame: (key: string, value: UiScopedSlotFrame) => {
        frames[key] = value;
      },
    },
  });
  await settle();
  return {
    app,
    target,
    frames,
    events,
    get context() {
      return context;
    },
    async close() {
      await unmount(app);
      target.remove();
    },
  };
}

it('independent: stale frames cannot write after selection changes away/back, source replacement or invalid input', async () => {
  const v = await open();
  try {
    v.context.select({ nodes: [], edges: ['same-edge'] });
    await settle();
    const original = v.frames.selection;
    v.context.select({ nodes: [], edges: ['second-edge'] });
    await settle();
    v.context.select({ nodes: [], edges: ['same-edge'] });
    await settle();
    original.onStateChange?.('color', '#f00');
    expect(v.context.graph.edges[0].appearance).toBeUndefined();
    const current = v.frames.selection;
    v.app.replace(initial.replace('"revision":0', '"revision":7'));
    await settle();
    current.onStateChange?.('color', '#0f0');
    expect(v.context.graph.edges[0].appearance).toBeUndefined();
    const valid = v.frames.canvas;
    v.app.replace('invalid JSON');
    await settle();
    valid.onStateChange?.('color', '#00f');
    expect(v.context.graph.edgeDefaults).toBeUndefined();
  } finally {
    await v.close();
  }
});

it('independent: identical edge IDs in separate public workspaces retain isolated native-control writes', async () => {
  const a = await open(),
    b = await open();
  try {
    a.context.select({ nodes: [], edges: ['same-edge'] });
    b.context.select({ nodes: [], edges: ['same-edge'] });
    await settle();
    const input = a.target.querySelector<HTMLInputElement>('[aria-label="selection color"]')!;
    input.value = '#abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(a.context.graph.edges[0].appearance).toEqual({ color: '#abc' });
    expect(b.context.graph.edges[0].appearance).toBeUndefined();
    expect(b.events.filter(([name]) => name === 'graphChange')).toHaveLength(0);
    a.context.select({ nodes: ['a'], edges: ['same-edge'] });
    await settle();
    const before = JSON.stringify(a.context.graph);
    a.frames.selection.onStateChange?.('color', '#fff');
    expect(JSON.stringify(a.context.graph)).toBe(before);
  } finally {
    await a.close();
    await b.close();
  }
});

it('independent: source-host refusal prevents writes and graph3 never invokes the legacy validation hook', async () => {
  let oldCalls = 0,
    newCalls = 0;
  const host: GraphEditorHostV2 = {
    authoringFor: () => ({ kind: 'refused', message: 'Source occurrence unavailable' }),
    validateV2: () => {
      oldCalls++;
      return [];
    },
    validateV3: () => {
      newCalls++;
      return [];
    },
  };
  const v = await open(host);
  try {
    expect(oldCalls).toBe(0);
    expect(newCalls).toBeGreaterThan(0);
    expect(v.frames.canvas.props.readOnly).toBe(true);
    const before = JSON.stringify(v.context.graph);
    v.frames.canvas.onStateChange?.('width', 9);
    expect(JSON.stringify(v.context.graph)).toBe(before);
    expect(v.events.filter(([name]) => name === 'graphChange')).toHaveLength(0);
  } finally {
    await v.close();
  }
});

it('independent: a retained scoped callback cannot publish after its workspace unmounts', async () => {
  const v = await open();
  const frame = v.frames.canvas;
  await v.close();
  const before = v.events.length;
  frame.onStateChange?.('color', '#abc');
  frame.onOutput?.('reset');
  expect(v.events).toHaveLength(before);
});
