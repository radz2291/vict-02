import { expect, test, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { XYHandle, ConnectionMode, Position, type InternalNodeBase } from '@xyflow/system';
import { portProbe } from './port-projection-independent-probe.js';
import Host from './NestedConnectPolicyHost.svelte';
import { graphFixture } from './editor-fixture.js';
import {
  createWorkspaceSession,
  workspacePorts,
  workspaceConnectionIssue,
  type WorkspaceGraph,
} from '../src/composition/workspace-model.js';
import type { GraphWorkspaceContext } from '../src/composition/context.js';
vi.mock('@xyflow/svelte', async (original) => ({
  ...(await original<typeof import('@xyflow/svelte')>()),
  SvelteFlow: (await import('./PortProjectionIndependentEngine.svelte')).default,
}));
const settle = async () => {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 20));
  flushSync();
};
function workspace() {
  let graph: WorkspaceGraph = graphFixture();
  graph.edges = [];
  const session = createWorkspaceSession(graph, false, () => []);
  const calls: unknown[] = [];
  const value = {
    get graph() {
      return graph;
    },
    readOnly: false,
    selection: { nodes: [], edges: [] },
    viewFor: () => undefined,
    frame: () => ({ key: 'body', props: {} }),
    ports: (node: { id: string }) => workspacePorts(graph, node.id),
    connectionIssue: (edge: Parameters<typeof workspaceConnectionIssue>[1]) =>
      workspaceConnectionIssue(graph, edge),
    remember: () => {},
    select: () => {},
    apply(ops: Parameters<typeof session.apply>[0], revision?: number) {
      const result = session.apply(ops, revision ?? graph.revision);
      if (result.ok) {
        graph = result.graph;
        calls.push(ops);
      }
    },
  } as unknown as GraphWorkspaceContext;
  return { value, calls };
}

test.each([false, true])(
  'pinned native-style drag stays on a small nested target (retained=%s)',
  async (retained) => {
    const h = workspace(),
      changes: string[] = [],
      target = document.createElement('div');
    document.body.append(target);
    const app = mount(Host, {
      target,
      props: { workspace: h.value, nested: true, retained, change: (value) => changes.push(value) },
    });
    await settle();
    const p = portProbe.current!;
    const id = (p.nodes as { data: { projectHandle: (node: string, port: string) => string } }[])[0]
        .data.projectHandle,
      sourceId = id('a', 'out'),
      targetId = id('c', 'in');
    const root = document.createElement('div'),
      from = document.createElement('div'),
      to = document.createElement('div');
    root.append(from, to);
    target.append(root);
    from.className = 'svelte-flow__handle source connectable connectableend';
    to.className = 'svelte-flow__handle target connectable connectableend';
    for (const [element, nodeId, handleId, type] of [
      [from, 'a', sourceId, 'source'],
      [to, 'c', targetId, 'target'],
    ] as const) {
      element.dataset.nodeid = nodeId;
      element.dataset.handleid = handleId;
      element.dataset.id = `1-${nodeId}-${handleId}-${type}`;
    }
    const rectangle = vi
      .spyOn(root, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(0, 0, 200, 121));
    let pan = 0,
      state: { fromHandle?: unknown } | undefined;
    const panCalls: number[] = [],
      frames = new Map<number, FrameRequestCallback>();
    let ticket = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++ticket, callback);
      return ticket;
    });
    vi.stubGlobal('cancelAnimationFrame', (value: number) => frames.delete(value));
    const hit = vi
      .spyOn(document, 'elementFromPoint')
      .mockImplementation((x, y) =>
        Math.abs(x - 80) <= 5 && Math.abs(y - (20 + pan)) <= 5 ? to : document.body,
      );
    const node = (
      nodeId: string,
      handleId: string,
      type: 'source' | 'target',
      x: number,
      y: number,
    ) =>
      ({
        id: nodeId,
        position: { x, y },
        data: {},
        measured: { width: 10, height: 10 },
        internals: {
          positionAbsolute: { x, y },
          handleBounds: {
            [type]: [
              {
                id: handleId,
                type,
                nodeId,
                position: type === 'source' ? Position.Right : Position.Left,
                x: 0,
                y: 0,
                width: 10,
                height: 10,
              },
            ],
          },
        },
      }) as InternalNodeBase;
    const options = {
      handleId: sourceId,
      nodeId: 'a',
      isTarget: false,
      domNode: root,
      nodeLookup: new Map([
        ['a', node('a', sourceId, 'source', 45, 10)],
        ['c', node('c', targetId, 'target', 75, 15)],
      ]),
      connectionMode: ConnectionMode.Strict,
      connectionRadius: 20,
      lib: 'svelte',
      flowId: '1',
      autoPanOnConnect: p.autoPanOnConnect !== false,
      autoPanSpeed: 15,
      panBy: ({ y }: { y: number }) => {
        pan += y;
        panCalls.push(y);
        return Promise.resolve(true);
      },
      getTransform: () => [0, pan, 1],
      getFromHandle: () => state?.fromHandle,
      updateConnection: (value: typeof state) => {
        state = value;
      },
      cancelConnection: () => {
        state = undefined;
      },
      onConnectStart: (event: object) =>
        (p.onconnectstart as ((event: object) => void) | undefined)?.(event),
      onConnect: (value: unknown) => (p.onbeforeconnect as (value: unknown) => boolean)(value),
      onConnectEnd: () => (p.onconnectend as (() => void) | undefined)?.(),
      isValidConnection: p.isValidConnection,
      handleDomNode: from,
    } as Parameters<typeof XYHandle.onPointerDown>[1];
    from.addEventListener('mousedown', (event) => XYHandle.onPointerDown(event, options));
    try {
      from.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 50, clientY: 15 }),
      );
      document.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 80, clientY: 20 }),
      );
      for (let index = 0; index < 5; index++) {
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach((callback) => callback(index * 16));
      }
      document.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: 80, clientY: 20 }),
      );
      document.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, button: 0, clientX: 80, clientY: 20 }),
      );
      await settle();
      expect.soft(panCalls).toEqual([]);
      expect.soft(retained ? changes.length : h.calls.length).toBe(1);
      const graph = retained ? JSON.parse(changes[0]) : h.value.graph;
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]).toMatchObject({
        source: 'a',
        sourcePort: 'out',
        target: 'c',
        targetPort: 'in',
      });
    } finally {
      await unmount(app);
      target.remove();
      rectangle.mockRestore();
      hit.mockRestore();
      vi.unstubAllGlobals();
    }
  },
);
test('top-level authored viewport retains upstream auto-pan policy', async () => {
  const h = workspace(),
    target = document.createElement('div');
  document.body.append(target);
  const app = mount(Host, {
    target,
    props: { workspace: h.value, nested: false, change: () => {} },
  });
  try {
    await settle();
    expect(portProbe.current!.autoPanOnConnect).not.toBe(false);
  } finally {
    await unmount(app);
    target.remove();
  }
});
