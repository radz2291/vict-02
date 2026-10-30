// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { EditorBridge } from '@victframework/ui-editor';
import type { UiDocument, UiExtensionDescriptor } from '@victframework/ui';
import retained from './fixtures/pointer-history-actual-source.json';
import { designerCatalogs } from '../src/lib/designer/application.js';
import Canvas from './fixtures/HistoryEchoCanvas.svelte';
const settle = async () => {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 40));
  flushSync();
};
const model = (bridge: EditorBridge) =>
  JSON.parse(String(bridge.document.localState['evidence-graph'].initial));
const position = (bridge: EditorBridge) =>
  model(bridge).nodes.find((node: { id: string }) => node.id === 'source-note-2').position;
async function open() {
  const initial = JSON.parse(JSON.stringify(retained)) as UiDocument,
    workspace = initial.nodes['desk-workspace'];
  if (workspace.kind !== 'component') throw Error('fixture');
  const source: UiDocument = {
    ...initial,
    nodes: {
      ...initial.nodes,
      'desk-workspace': {
        ...workspace,
        slots: {
          ...workspace.slots,
          content: {
            ...workspace.slots!.content,
            children: [...workspace.slots!.content.children, 'history-probe'],
          },
        },
      },
      'history-probe': {
        kind: 'component',
        id: 'history-probe',
        definitionId: 'test.history-commands',
        revision: '1',
      },
    },
  };
  const descriptor: UiExtensionDescriptor = {
    id: 'test.history-commands',
    revision: '1',
    abi: 'vict.ui-component-abi@1',
    events: ['vict.ui-component-abi@1'],
    rendererImplementationId: 'test.history-commands',
    props: [],
    outputs: [],
  };
  const bridge = new EditorBridge({
    catalogs: { ...designerCatalogs, extensions: [...designerCatalogs.extensions, descriptor] },
    store: {
      load: () => ({ status: 'empty' }),
      save: () => ({
        ok: false,
        code: 'PROBE_NO_SAVE',
        reason: 'This diagnostic does not persist',
      }),
    },
    initial: { document: source, storedRevision: source.revision },
  });
  const target = document.createElement('div');
  document.body.append(target);
  const diagnostics: unknown[] = [];
  const app = mount(Canvas, {
    target,
    props: { bridge, onDiagnostic: (issue: unknown) => diagnostics.push(issue) },
  });
  await settle();
  const click = async (label: string) => {
    const button = [...target.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === label,
    )!;
    expect(button).toBeTruthy();
    button.click();
    await settle();
  };
  return {
    bridge,
    target,
    diagnostics,
    click,
    async close() {
      await unmount(app);
      target.remove();
    },
  };
}
it('adopts settled source Redo back into the rendered workspace model', async () => {
  const view = await open();
  try {
    await view.click('Probe moveNodes');
    expect(model(view.bridge).revision).toBe(161);
    expect(position(view.bridge).x).toBe(527.8139007098847);
    expect(view.bridge.undo().ok).toBe(true);
    await settle();
    expect(position(view.bridge)).toEqual({ x: 330, y: 80 });
    expect(view.bridge.redo().ok).toBe(true);
    await settle();
    expect(model(view.bridge).revision).toBe(161);
    expect(position(view.bridge).x).toBe(527.8139007098847);
    const visual = view.target.querySelector<HTMLElement>(
      '.svelte-flow__node[data-id="source-note-2"]',
    )!.style.transform;
    expect(visual).toContain('527.8139007098847');
  } finally {
    await view.close();
  }
});
it('retains settled Redo position and sibling values through subsequent selected-edge removal and reconnection', async () => {
  const view = await open();
  try {
    const before = model(view.bridge);
    await view.click('Probe moveNodes');
    view.bridge.undo();
    await settle();
    view.bridge.redo();
    await settle();
    const sourceAfterRedo = model(view.bridge);
    expect(sourceAfterRedo.revision).toBe(161);
    await view.click('Probe select edge');
    await view.click('Probe remove edge');
    await view.click('Probe connect');
    const after = model(view.bridge);
    console.log(
      JSON.stringify({
        before: before.revision,
        sourceAfterRedo: sourceAfterRedo.revision,
        renderedPosition: view.target.querySelector<HTMLElement>(
          '.svelte-flow__node[data-id="source-note-2"]',
        )!.style.transform,
        finalRevision: after.revision,
        finalPosition: position(view.bridge),
        diagnostics: view.diagnostics,
      }),
    );
    expect(after.edges).toHaveLength(2);
    expect(after.revision).toBe(163);
    expect(position(view.bridge)).toEqual({ x: 527.8139007098847, y: -42.927209726856944 });
    expect(after.nodes.find((node: { id: string }) => node.id === 'source-note-1').values).toEqual(
      before.nodes.find((node: { id: string }) => node.id === 'source-note-1').values,
    );
    expect(view.diagnostics).toEqual([]);
  } finally {
    await view.close();
  }
});
