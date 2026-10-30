import { expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import type { UiValue } from '@victframework/ui';
import Host from './CompositionHost.svelte';
import { compositionDocument, typedCompositionDocument } from './composition-fixtures.js';
const settle = async () => {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 40));
  flushSync();
};
for (const version of [1, 2] as const)
  it(`independent workspace${version}: immediate own echo preserves local Undo, external same-revision replacement expires old echo`, async () => {
    const source =
      version === 1 ? compositionDocument('research') : typedCompositionDocument('research');
    const target = document.createElement('div');
    document.body.append(target);
    const writes: [string, UiValue][] = [],
      diagnostics: unknown[] = [];
    const app = mount(Host, {
      target,
      props: {
        source,
        host: { historyFor: () => undefined },
        onWrite: (key, value) => writes.push([key, value]),
        onDiagnostic: (issue) => diagnostics.push(issue),
      },
    });
    const latest = () => JSON.parse(String(writes.findLast(([key]) => key === 'graph')?.[1]));
    const click = async (label: string) => {
      const button = [...target.querySelectorAll<HTMLButtonElement>('button')].find(
        (element) => element.textContent?.trim() === label,
      )!;
      expect(button).toBeTruthy();
      button.click();
      await settle();
    };
    const change = async (value: string) => {
      const field = target.querySelector<HTMLInputElement>(
        '[data-graph-node="source-a"] [aria-label="Evidence URL"]',
      )!;
      expect(field).toBeTruthy();
      field.value = value;
      field.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
    };
    await settle();
    try {
      const original = JSON.parse(String(source.localState.graph.initial));
      await change('first');
      const first = latest();
      app.supply('graph', JSON.stringify(first));
      await settle();
      expect(writes.filter(([key]) => key === 'graph')).toHaveLength(1);
      await click('Undo local change');
      expect(latest().nodes.find((node: { id: string }) => node.id === 'source-a').label).toBe(
        original.nodes.find((node: { id: string }) => node.id === 'source-a').label,
      );
      // A no-op reparse would discard local history: Undo must actually emit.
      expect(writes.filter(([key]) => key === 'graph')).toHaveLength(2);
      await change('second');
      const emitted = latest();
      app.supply('graph', JSON.stringify(emitted));
      await settle();
      const replacement = JSON.parse(JSON.stringify(emitted));
      replacement.nodes.find((node: { id: string }) => node.id === 'source-a').position = {
        x: 900,
        y: 700,
      };
      app.supply('graph', JSON.stringify(replacement));
      await settle();
      // Deliberately keep the graph revision equal: external bytes, not a numeric
      // revision increase, establish the source/session replacement boundary.
      app.supply('graph', JSON.stringify(emitted));
      await settle();
      const before = writes.filter(([key]) => key === 'graph').length;
      await click('Name primary source');
      const after = latest();
      expect(writes.filter(([key]) => key === 'graph')).toHaveLength(before + 1);
      expect(after.revision).toBe(emitted.revision + 1);
      expect(after.nodes.find((node: { id: string }) => node.id === 'source-a').position).toEqual(
        emitted.nodes.find((node: { id: string }) => node.id === 'source-a').position,
      );
      expect(diagnostics).toEqual([]);
    } finally {
      await unmount(app);
      target.remove();
    }
  });
