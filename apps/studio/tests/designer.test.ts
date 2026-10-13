import { describe, expect, it } from 'vitest';
import { applyUiEdit } from '@victframework/ui';
import {
  newScreen,
  compileScreen,
  screenIssues,
  designerCatalogs,
} from '../src/lib/designer/application.js';
import { screenStore } from '../src/lib/designer/storage.js';
import { createScreenSimulation, screenDispatcher } from '../src/lib/designer/execution.js';

describe('Studio canonical screen integration', () => {
  it('attaches one minimal screen through @3 and binds every style edit into application identity', () => {
    const source = newScreen('Identity test', 'identity-test');
    const before = compileScreen(source);
    expect(before.ok).toBe(true);
    const edited = applyUiEdit(
      { document: source, revision: 'r1' },
      {
        requestId: 'style',
        expectedDocumentRevision: 'r1',
        commands: [
          {
            op: 'setStyleDeclaration',
            nodeId: 'screen',
            property: 'color',
            value: { type: 'text', value: '#164abb' },
          },
        ],
      },
      designerCatalogs,
    );
    expect(edited.ok).toBe(true);
    if (!edited.ok || !before.ok) return;
    const after = compileScreen(edited.document);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.plan.applicationVersion).not.toBe(before.plan.applicationVersion);
    expect(after.plan.documentPlans?.[`${source.id}@r1`]?.documentId).toBe(source.id);
  });
  it('replays the exact saved source and refuses stale writes and corrupt bytes', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    const source = newScreen('Saved test', 'save-test');
    const store = screenStore(storage, source.id);
    const saved = { ...source, revision: 'r2' };
    expect(
      store.save({ document: saved, expectedStoredRevision: 'r1', newStoredRevision: 'r2' }).ok,
    ).toBe(true);
    expect(store.load()).toMatchObject({ status: 'loaded', document: saved, storedRevision: 'r2' });
    expect(
      store.save({ document: source, expectedStoredRevision: 'r1', newStoredRevision: 'r3' }).ok,
    ).toBe(false);
    const key = [...memory.keys()][0]!;
    memory.set(key, '{corrupt');
    expect(store.load()).toMatchObject({ status: 'invalid', overwritable: false });
    expect(
      store.save({ document: source, expectedStoredRevision: 'r2', newStoredRevision: 'r3' }).ok,
    ).toBe(false);
    expect(memory.get(key)).toBe('{corrupt');
  });
  it('fails closed on undeclared actions, missing inputs, denied permission and reset during execution', async () => {
    const compiled = compileScreen(newScreen('Execution test', 'execution-test'));
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const controls = { denied: false, failNext: false };
    const adapter = createScreenSimulation(controls);
    const dispatch = screenDispatcher(compiled.plan, adapter);
    expect(await dispatch.execute('undeclared')).toMatchObject({
      ok: false,
      code: 'ACTION_UNDECLARED',
    });
    expect(await dispatch.execute('demo.submit', {})).toMatchObject({
      ok: false,
      code: 'CONTRACT_REJECTED',
    });
    controls.denied = true;
    expect(
      await dispatch.execute('demo.submit', { message: 'test', accepted: true }),
    ).toMatchObject({ ok: false, code: 'DATA_UNAUTHORIZED' });
    controls.denied = false;
    const pending = dispatch.execute('demo.submit', { message: 'test', accepted: true });
    adapter.reset();
    expect(await pending).toMatchObject({ ok: false, code: 'DATA_STALE' });
    expect(
      await dispatch.execute('demo.submit', { message: 'test', accepted: true }),
    ).toMatchObject({ ok: true, value: 'Simulated submission: test' });
  });
  it('refuses a source with unknown action references at the joint application boundary', () => {
    const source = newScreen('Unknown action', 'unknown-action');
    const root = source.nodes.screen!;
    const invalid = {
      ...source,
      nodes: {
        ...source.nodes,
        screen: {
          ...root,
          interactions: [
            { on: 'click' as const, action: 'invokeAction' as const, actionId: 'arbitrary.action' },
          ],
        },
      },
    };
    expect(screenIssues(invalid).length).toBeGreaterThan(0);
  });
});
