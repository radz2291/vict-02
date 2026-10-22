import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { UiDocument } from '@victframework/ui';
import { EditorBridge } from '@victframework/ui-editor';
import { newScreen, compileScreen, designerCatalogs } from '../src/lib/designer/application.js';
import { screenStore } from '../src/lib/designer/storage.js';
import { createScreenSimulation, screenDispatcher } from '../src/lib/designer/execution.js';

it('independently compiles the browser-authored saved source to the observed replay identity', () => {
  const source = JSON.parse(
    readFileSync(
      new URL('../../../docs/studio/verification-2026-10-22/authored-screen.json', import.meta.url),
      'utf8',
    ),
  ) as UiDocument;
  const result = compileScreen(source);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(source.revision).toBe('r1.r3');
  expect(result.plan.applicationVersion).toBe(
    'v1_862a38e431d1af0d675554b15074d691875c9b0c36d7d833a305344c77f5a81c',
  );
  expect(result.plan.documentPlans?.[`${source.id}@${source.revision}`]?.documentId).toBe(
    source.id,
  );
});

it('retains working source and history when the storage write throws, then retries successfully', () => {
  const source = newScreen('Write refusal', 'independent-write-refusal');
  const bytes = new Map<string, string>();
  let refuse = false;
  const storage = {
    getItem: (key: string) => bytes.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (refuse) throw new Error('Independent quota refusal');
      bytes.set(key, value);
    },
  };
  const store = screenStore(storage, source.id);
  const bridge = new EditorBridge({
    catalogs: designerCatalogs,
    store,
    initial: { document: source, storedRevision: 'r1' },
  });
  expect(bridge.save().ok).toBe(true);
  const storedBefore = [...bytes];
  expect(
    bridge.apply({
      requestId: 'edit',
      commands: [
        { op: 'setAttribute', nodeId: 'screen', name: 'aria-label', value: 'Retained draft' },
      ],
    }).ok,
  ).toBe(true);
  const workingBefore = bridge.getSnapshot();
  const documentBefore = bridge.document;
  refuse = true;
  expect(bridge.save().ok).toBe(false);
  expect([...bytes]).toEqual(storedBefore);
  expect(bridge.getSnapshot()).toEqual(workingBefore);
  expect(bridge.document).toEqual(documentBefore);
  refuse = false;
  expect(bridge.save().ok).toBe(true);
  expect(bridge.getSnapshot().dirty).toBe(false);
  expect(store.rawLoad()).toMatchObject({ status: 'loaded', document: bridge.document });
});

it('rolls back an entire mixed transaction if its second command is invalid', () => {
  const source = newScreen('Atomic challenge', 'independent-atomic');
  const bridge = new EditorBridge({
    catalogs: designerCatalogs,
    store: screenStore({ getItem: () => null, setItem: () => {} }, source.id),
    initial: { document: source, storedRevision: 'r1' },
  });
  const before = bridge.getSnapshot();
  expect(
    bridge.apply({
      requestId: 'mixed',
      commands: [
        { op: 'setAttribute', nodeId: 'screen', name: 'aria-label', value: 'Must not survive' },
        { op: 'move', nodeId: 'screen', newParentId: 'screen', index: 0 },
      ],
    }).ok,
  ).toBe(false);
  expect(bridge.document).toEqual(source);
  expect(bridge.getSnapshot()).toEqual(before);
});

it('clears fail-next exactly once and fences two pending actions across reset', async () => {
  const compiled = compileScreen(newScreen('Independent actions', 'independent-actions'));
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) return;
  const controls = { denied: false, failNext: true };
  const adapter = createScreenSimulation(controls);
  const dispatch = screenDispatcher(compiled.plan, adapter);
  const input = { message: 'Independent probe', accepted: true };
  expect(await dispatch.execute('demo.submit', input)).toMatchObject({
    ok: false,
    message: 'Simulated service failure. Try again.',
  });
  expect(controls.failNext).toBe(false);
  expect(await dispatch.execute('demo.submit', input)).toMatchObject({
    ok: true,
    value: 'Simulated submission: Independent probe',
  });
  const first = dispatch.execute('demo.submit', input);
  const second = dispatch.execute('demo.submit', input);
  adapter.reset();
  expect(await first).toMatchObject({ ok: false, code: 'DATA_STALE' });
  expect(await second).toMatchObject({ ok: false, code: 'DATA_STALE' });
});
