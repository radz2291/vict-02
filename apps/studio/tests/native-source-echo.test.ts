// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { EditorBridge } from '@victframework/ui-editor';
import type { UiDocument } from '@victframework/ui';
import actualSource from '../../../docs/studio/foundation-evidence/architecture-realignment-20261030/actual-agent-live-20261030/stage-2-after-manual-control-source.json';
import { designerCatalogs } from '../src/lib/designer/application.js';
import { screenPlacementIssues } from '../src/lib/designer/placement.js';
import { screenStore } from '../src/lib/designer/storage.js';
import { sourceRuntimeRefresh } from '../src/lib/designer/source-runtime-refresh.js';
import Canvas from './fixtures/SourceEchoCanvas.svelte';
const settle = async () => {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 30));
  flushSync();
};
it('keeps the actual exported agent app input focused through consecutive canonical input echoes', async () => {
  // Read-only copy of the retained actual-agent source; DOM edits below use
  // the genuine EditorCanvas/EditorBridge path in disposable happy-dom storage.
  const source = JSON.parse(JSON.stringify(actualSource)) as UiDocument,
    diagnostics: { code: string }[] = [];
  const bridge = new EditorBridge({
    catalogs: designerCatalogs,
    validateDocument: screenPlacementIssues,
    store: screenStore(localStorage, source.id),
    initial: { document: source, storedRevision: source.revision },
  });
  const target = document.createElement('div');
  document.body.append(target);
  const app = mount(Canvas, {
    target,
    props: { bridge, onDiagnostic: (issue: { code: string }) => diagnostics.push(issue) },
  });
  await settle();
  try {
    const input = target.querySelector<HTMLInputElement>('[data-ui-node="url-control"]')!;
    expect(input).toBeTruthy();
    input.focus();
    for (const character of ['a', 'b', 'c']) {
      input.value += character;
      input.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertText', data: character }),
      );
      await settle();
      expect(target.querySelector('[data-ui-node="url-control"]')).toBe(input);
      expect(document.activeElement).toBe(input);
    }
    input.value = input.value.slice(0, -1);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'historyUndo' }));
    await settle();
    expect(target.querySelector('[data-ui-node="url-control"]')).toBe(input);
    expect(document.activeElement).toBe(input);
    const graph = JSON.parse(String(bridge.document.localState['evidence-graph'].initial));
    expect(graph.nodes[0].values.url).toBe(input.value);
    expect(graph.nodes[0].position).toEqual({ x: 40, y: 40 });
    expect(diagnostics).toEqual([]);
    app.reset();
    await settle();
    expect(target.querySelector('[data-ui-node="url-control"]')).not.toBe(input);
  } finally {
    await unmount(app);
    target.remove();
    localStorage.clear();
  }
});
it('reconciles compatible values and canonical graphs without a renderer reset for same-document source', () => {
  const source = actualSource as UiDocument,
    values = {
      'evidence-graph': 'stale runtime',
      message: 'keep temporary draft',
      invented: 'remove',
    };
  expect(sourceRuntimeRefresh(source, values, source.id)).toEqual({
    values: {
      'evidence-graph': source.localState['evidence-graph'].initial,
      message: 'keep temporary draft',
    },
    removed: ['invented'],
    resetRenderer: false,
  });
  expect(sourceRuntimeRefresh(source, values, 'different-document').resetRenderer).toBe(true);
});
