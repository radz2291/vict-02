// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { EditorBridge } from '@victframework/ui-editor';
import { graphFoundationExample } from '../src/lib/designer/foundation-examples.js';
import { designerCatalogs } from '../src/lib/designer/application.js';
import Canvas from './fixtures/SourceEchoCanvas.svelte';
const settle = async () => {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 40));
  flushSync();
};
it('retained graph1 GraphSurface adopts source Redo before its next ordinary field edit', async () => {
  const source = graphFoundationExample(),
    bridge = new EditorBridge({
      catalogs: designerCatalogs,
      store: {
        load: () => ({ status: 'empty' }),
        save: () => ({
          ok: false,
          code: 'PROBE_NO_SAVE',
          reason: 'This diagnostic does not persist',
        }),
      },
      initial: { document: source, storedRevision: 'r1' },
    });
  const target = document.createElement('div');
  document.body.append(target);
  const diagnostics: unknown[] = [];
  const app = mount(Canvas, {
    target,
    props: { bridge, onDiagnostic: (issue: unknown) => diagnostics.push(issue) },
  });
  await settle();
  const graph = () => JSON.parse(String(bridge.document.localState.graph.initial));
  try {
    const before = graph(),
      node = target.querySelector<HTMLElement>('.svelte-flow__node[data-id="observe"]')!;
    expect(node).toBeTruthy();
    node.click();
    await settle();
    node.focus();
    node.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        code: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const moved = graph(),
      movedPosition = moved.nodes.find((item: { id: string }) => item.id === 'observe').position;
    expect(movedPosition.x).toBe(
      before.nodes.find((item: { id: string }) => item.id === 'observe').position.x + 10,
    );
    expect(bridge.undo().ok).toBe(true);
    await settle();
    expect(bridge.redo().ok).toBe(true);
    await settle();
    expect(graph()).toEqual(moved);
    const field = target.querySelector<HTMLTextAreaElement>(
      '[data-graph-node="observe"] [data-field="notes"] textarea',
    )!;
    field.value = 'After redo keeps moved position';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    console.log(
      JSON.stringify({
        before: before.revision,
        moved: moved.revision,
        after: graph().revision,
        expectedPosition: movedPosition,
        actualPosition: graph().nodes.find((item: { id: string }) => item.id === 'observe')
          .position,
        diagnostics,
      }),
    );
    expect(graph().revision).toBe(moved.revision + 1);
    expect(graph().nodes.find((item: { id: string }) => item.id === 'observe').position).toEqual(
      movedPosition,
    );
    expect(graph().nodes.find((item: { id: string }) => item.id === 'observe').values.notes).toBe(
      'After redo keeps moved position',
    );
    expect(diagnostics).toEqual([]);
  } finally {
    await unmount(app);
    target.remove();
  }
});
