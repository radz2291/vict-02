import { describe, expect, it, vi } from 'vitest';
import { renderVictApplication } from '@victframework/ui-svelte';
import { substitutePathParams } from '@victframework/ui-svelte';
import { probeApp, testRegistry, ROWS } from './fixtures.js';

/**
 * TaskLedger platform-gap renderer behavior (Stage 8 F6 follow-up):
 * - versioned registered island cells with row-derived props;
 * - declared row actions (dispatch and parameterized navigation);
 * - the @2 count surface (view total).
 */

describe('island table cells', () => {
  it('renders the versioned registered component in the declared cell with row-derived props', () => {
    const mounted = renderVictApplication({
      plan: probeApp({
        role: 'table',
        id: 'x',
        viewId: 'v.items',
        queryActionId: 'act.query',
        pageSize: 10,
        columns: [
          { field: 'title', label: 'Title' },
          {
            field: 'status',
            label: 'Status',
            componentId: 'cmp.badge',
            revision: '1',
            props: { label: 'status' },
          },
        ],
      }),
      registry: testRegistry(),
      dispatch: async () => ({ ok: true }),
      viewData: { 'v.items': { rows: ROWS, total: ROWS.length } },
      path: '/',
    });
    try {
      const badges = mounted.output.querySelectorAll('[data-testid="custom-badge"]');
      expect(badges.length).toBe(3);
      // Props derive from each row: the badge label prop is the row's status.
      const texts = [...badges].map((badge) => badge.textContent);
      expect(texts).toEqual(['active', 'draft', 'active']);
    } finally {
      mounted.unmount();
    }
  });
});

describe('declared row actions', () => {
  it('dispatches the declared action with row-derived input', async () => {
    const dispatch = vi.fn(async () => ({ ok: true }));
    const onInvalidate = vi.fn();
    const mounted = renderVictApplication({
      plan: probeApp({
        role: 'table',
        id: 'x',
        viewId: 'v.items',
        queryActionId: 'act.query',
        pageSize: 10,
        rowAction: { actionId: 'act.create', label: 'Complete', input: { id: 'id' } },
      }),
      registry: testRegistry(),
      dispatch,
      viewData: { 'v.items': { rows: ROWS, total: ROWS.length } },
      onInvalidate,
      path: '/',
    });
    try {
      const buttons = mounted.output.querySelectorAll<HTMLButtonElement>(
        '[data-testid="table-row-action"]',
      );
      expect(buttons.length).toBe(3);
      buttons[1]!.click();
      await Promise.resolve();
      await Promise.resolve();
      expect(dispatch).toHaveBeenCalledWith('act.create', { id: 'i-2' });
      expect(onInvalidate).toHaveBeenCalled();
    } finally {
      mounted.unmount();
    }
  });

  it('substitutes declared route parameters for a navigation row action', async () => {
    const navigate = vi.fn();
    const dispatch = vi.fn(async () => ({
      ok: false as const,
      code: 'UNSUPPORTED_ACTION',
      message: 'navigation never crosses the dispatcher',
    }));
    const mounted = renderVictApplication({
      plan: probeApp(
        {
          role: 'table',
          id: 'x',
          viewId: 'v.items',
          pageSize: 10,
          rowAction: { actionId: 'act.edit', label: 'Edit', input: { id: 'id' } },
        },
        {
          routes: [
            { id: 'home', path: '/', screenId: 's.home' },
            { id: 'task', path: '/tasks/:id', screenId: 's.home' },
          ],
          actions: [
            { kind: 'local', id: 'act.local', revision: '1' },
            {
              kind: 'mutation',
              id: 'act.create',
              revision: '1',
              resourceId: 'items',
              resourceRevision: '1',
              op: 'create',
              inputContractId: 'test.item.input',
            },
            { kind: 'navigation', id: 'act.edit', revision: '1', routeId: 'task' },
          ],
        },
      ),
      registry: testRegistry(),
      dispatch,
      viewData: { 'v.items': { rows: ROWS, total: ROWS.length } },
      path: '/',
      navigate,
    });
    try {
      const buttons = mounted.output.querySelectorAll<HTMLButtonElement>(
        '[data-testid="table-row-action"]',
      );
      buttons[0]!.click();
      await Promise.resolve();
      await Promise.resolve();
      // The parameterized navigation substitutes the row identity; the raw
      // declared path (with ':id') is never navigated and the dispatcher is
      // never called.
      expect(navigate).toHaveBeenCalledWith('/tasks/i-1');
      expect(navigate).not.toHaveBeenCalledWith('/tasks/:id');
      expect(dispatch).not.toHaveBeenCalled();
    } finally {
      mounted.unmount();
    }
  });

  it('leaves unsubstituted parameter segments declared (honest route failure)', () => {
    // The pure parameter-substitution contract.
    expect(substitutePathParams('/tasks/:id', { id: 'i-1' })).toBe('/tasks/i-1');
    expect(substitutePathParams('/tasks/:id', {})).toBe('/tasks/:id');
    expect(substitutePathParams('/tasks/:id', undefined)).toBe('/tasks/:id');
  });
});

describe('count surface', () => {
  it('renders the view datum total with an accessible label', () => {
    const mounted = renderVictApplication({
      plan: probeApp(
        { role: 'count', id: 'x', viewId: 'v.items', label: 'Open items' },
        {
          views: [
            {
              viewId: 'v.items',
              resourceId: 'items',
              resourceRevision: '1',
              fields: ['id', 'title'],
              filters: { status: 'open' },
            },
          ],
        },
      ),
      registry: testRegistry(),
      dispatch: async () => ({ ok: true }),
      viewData: { 'v.items': { rows: [{ id: 'i-1' }], total: 7 } },
      path: '/',
    });
    try {
      const count = mounted.output.querySelector('[data-testid="count-value"]');
      expect(count).not.toBeNull();
      expect(count?.textContent).toContain('Open items');
      expect(count?.textContent).toContain('7');
      expect(count?.querySelector('[aria-live="polite"]')?.textContent).toBe('7');
    } finally {
      mounted.unmount();
    }
  });

  it('renders 0 when the view datum is absent', () => {
    const mounted = renderVictApplication({
      plan: probeApp({ role: 'count', id: 'x', viewId: 'v.items' }),
      registry: testRegistry(),
      dispatch: async () => ({ ok: true }),
      viewData: {},
      path: '/',
    });
    try {
      const value = mounted.output.querySelector('[data-testid="count-value"]');
      expect(value?.textContent).toContain('0');
    } finally {
      mounted.unmount();
    }
  });
});
