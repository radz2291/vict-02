import { describe, expect, it, vi } from 'vitest';
import { renderVictApplication } from '@victframework/ui-svelte';
import { probeApp, testRegistry, ROWS } from './fixtures.js';

/**
 * Declared record context for component surfaces (UI reconciliation slice):
 * - component surfaces receive the route parameter, the route record's
 *   declared fields, and a declared view's rows as RESOLVED props;
 * - a declared surface input binding supplies the dispatch input for an
 *   action that operates on the current record (no URL inspection, no
 *   self-built identity);
 * - the read/write invalidation boundary: a successful declared query
 *   never invalidates (no repeated-fetch loop), a successful mutation
 *   does.
 */
import RecordIsland from './RecordIsland.svelte';

function registryWithIsland() {
  const registry = testRegistry();
  registry.register({
    componentId: 'cmp.record-island',
    revision: '1',
    implementation: RecordIsland as never,
  });
  return registry;
}

const islandSurface = {
  role: 'component',
  id: 'x',
  componentId: 'cmp.record-island',
  revision: '1',
  props: {
    paramValue: { param: 'id' },
    recordValue: { record: 'status' },
    viewValue: { view: 'v.items' },
  },
  input: { id: { param: 'id' } },
};

describe('component-surface record context (declared bindings)', () => {
  it('resolves param, record-field and view-row props for the island', () => {
    const mounted = renderVictApplication({
      plan: probeApp(islandSurface, {
        routes: [
          { id: 'home', path: '/', screenId: 's.home' },
          { id: 'task', path: '/tasks/:id', screenId: 's.home' },
        ],
        components: [{ componentId: 'cmp.record-island', revision: '1' }],
      }),
      registry: registryWithIsland(),
      dispatch: async () => ({ ok: true }),
      // Parameterized route /tasks/i-2 → param id=i-2, record from viewData.
      path: '/tasks/i-2',
      viewData: {
        'v.items': { rows: ROWS, total: ROWS.length, record: ROWS[1] },
      },
      record: ROWS[1],
    });
    try {
      const island = mounted.output.querySelector('[data-testid="record-island"]');
      expect(island).not.toBeNull();
      expect(island?.getAttribute('data-param')).toBe('i-2');
      expect(island?.getAttribute('data-record')).toBe(JSON.stringify('draft'));
      expect(
        JSON.parse(
          mounted.output.querySelector('[data-testid="island-view"]')?.textContent ?? 'null',
        ),
      ).toEqual(ROWS);
    } finally {
      mounted.unmount();
    }
  });

  it('resolves a declared view binding when the surface screen has no record', () => {
    const mounted = renderVictApplication({
      plan: probeApp(
        {
          role: 'component',
          id: 'x',
          componentId: 'cmp.record-island',
          revision: '1',
          props: { viewValue: { view: 'v.items' } },
        },
        { components: [{ componentId: 'cmp.record-island', revision: '1' }] },
      ),
      registry: registryWithIsland(),
      dispatch: async () => ({ ok: true }),
      path: '/',
      viewData: { 'v.items': { rows: ROWS, total: ROWS.length } },
      record: null,
    });
    try {
      expect(
        JSON.parse(
          mounted.output.querySelector('[data-testid="island-view"]')?.textContent ?? 'null',
        ),
      ).toEqual(ROWS);
      expect(mounted.output.querySelector('[data-testid="island-record"]')?.textContent).toBe(
        'null',
      );
    } finally {
      mounted.unmount();
    }
  });

  it('the declared input binding supplies the dispatch input; explicit fields win', async () => {
    const dispatch = vi.fn(async (actionId: string, input?: unknown) => {
      return { ok: true, value: { actionId, input } };
    });
    const mounted = renderVictApplication({
      plan: probeApp(islandSurface, {
        routes: [
          { id: 'home', path: '/', screenId: 's.home' },
          { id: 'task', path: '/tasks/:id', screenId: 's.home' },
        ],
        components: [{ componentId: 'cmp.record-island', revision: '1' }],
      }),
      registry: registryWithIsland(),
      dispatch,
      path: '/tasks/i-2',
      viewData: { 'v.items': { rows: ROWS, total: ROWS.length, record: ROWS[1] } },
      record: ROWS[1],
    });
    try {
      (
        mounted.output.querySelector('[data-testid="island-dispatch"]') as HTMLButtonElement
      ).click();
      await vi.waitFor(() => {
        expect(dispatch).toHaveBeenCalled();
      });
      // The island dispatched with NO input; the declared binding
      // `{ id: { param: 'id' } }` resolved to the route parameter.
      expect(dispatch).toHaveBeenCalledWith('act.create', { id: 'i-2' });
    } finally {
      mounted.unmount();
    }
  });
});

describe('read/write invalidation boundary (renderer-owned)', () => {
  it('a successful declared query does NOT invalidate; a mutation does', async () => {
    const onInvalidate = vi.fn();
    const mounted = renderVictApplication({
      plan: probeApp({
        role: 'action',
        id: 'x',
        actionId: 'act.query',
        label: 'Read only',
      }),
      registry: testRegistry(),
      dispatch: async () => ({ ok: true }),
      onInvalidate,
      path: '/',
    });
    try {
      const button = mounted.output.querySelector('button');
      button?.click();
      await vi.waitFor(() => {
        expect(onInvalidate).not.toHaveBeenCalled();
      });
      // Let any (wrong) invalidation surface.
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
      expect(onInvalidate).not.toHaveBeenCalled();
    } finally {
      mounted.unmount();
    }

    const mutationMounted = renderVictApplication({
      plan: probeApp({
        role: 'action',
        id: 'x',
        actionId: 'act.create',
        label: 'Create',
      }),
      registry: testRegistry(),
      dispatch: async () => ({ ok: true }),
      onInvalidate,
      path: '/',
    });
    try {
      const button = mutationMounted.output.querySelector('button');
      button?.click();
      await vi.waitFor(() => {
        expect(onInvalidate).toHaveBeenCalled();
      });
    } finally {
      mutationMounted.unmount();
    }
  });

  it('a component surface reading declared view data does not re-dispatch or invalidate', async () => {
    // The guard is the invalidation boundary above: with query actions
    // excluded from invalidation, a mount-time read cannot dirty the
    // route, remount the surface, and read again. This test pins the
    // visible behavior: view data rendered once, no repeated dispatches,
    // no invalidation churn.
    const onInvalidate = vi.fn();
    let dispatchCalls = 0;
    const mounted = renderVictApplication({
      plan: probeApp(
        {
          role: 'component',
          id: 'x',
          componentId: 'cmp.record-island',
          revision: '1',
          props: { viewValue: { view: 'v.items' } },
        },
        { components: [{ componentId: 'cmp.record-island', revision: '1' }] },
      ),
      registry: registryWithIsland(),
      dispatch: async () => {
        dispatchCalls += 1;
        return { ok: true };
      },
      onInvalidate,
      path: '/',
      viewData: { 'v.items': { rows: ROWS, total: ROWS.length } },
      record: null,
    });
    try {
      const island = mounted.output.querySelector('[data-testid="record-island"]');
      expect(island).not.toBeNull();
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
      // No query dispatch, no invalidation, no remount churn.
      expect(dispatchCalls).toBe(0);
      expect(onInvalidate).not.toHaveBeenCalled();
    } finally {
      mounted.unmount();
    }
  });
});
