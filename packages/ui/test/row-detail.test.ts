import { describe, expect, it } from 'vitest';
import { deriveUiPlan } from '../src/index.js';

/**
 * FT-1: the definition-declared row→detail navigation binding is derived on
 * BOTH record roles (table + view). A well-formed declaration survives; a
 * malformed one is discarded; absence derives nothing — no behavior change.
 */

function planWith(surface: Record<string, unknown>): ReturnType<typeof deriveUiPlan> {
  return deriveUiPlan({
    screens: {
      's.home': {
        title: 'Home',
        layout: [{ surfaces: [surface as never] }],
      },
    },
    views: {
      'v.items': { resourceId: 'r', fields: ['id', 'runId'] },
    },
  } as never);
}

describe('deriveUiPlan: rowDetail navigation binding (FT-1)', () => {
  it('derives the binding on a table surface', () => {
    const plan = planWith({
      role: 'table',
      id: 't',
      viewId: 'v.items',
      rowDetail: { routeId: 'run-detail', label: 'Open run', param: { runId: 'runId' } },
    });
    expect(plan.tables['t']?.rowDetail).toEqual({
      routeId: 'run-detail',
      label: 'Open run',
      param: { runId: 'runId' },
    });
  });

  it('derives the binding on a view-record surface (UiPlan.views)', () => {
    const plan = planWith({
      role: 'view',
      id: 'vw',
      viewId: 'v.items',
      rowDetail: { routeId: 'item-detail', param: { id: 'id' } },
    });
    expect(plan.views['vw']?.rowDetail).toEqual({
      routeId: 'item-detail',
      label: 'Open',
      param: { id: 'id' },
    });
  });

  it('renders nothing when the binding is absent (negative criterion)', () => {
    const tablePlan = planWith({ role: 'table', id: 't', viewId: 'v.items' });
    expect(tablePlan.tables['t']?.rowDetail).toBeUndefined();
    const viewPlan = planWith({ role: 'view', id: 'vw', viewId: 'v.items' });
    expect(viewPlan.views['vw']?.rowDetail).toBeUndefined();
    // No view intent at all for unrelated surfaces (or empty plans).
    expect(deriveUiPlan({ screens: {} } as never).views).toEqual({});
  });

  it('substitutes presentation defaults: label defaults to "Open", param to { id: "id" }', () => {
    const plan = planWith({
      role: 'view',
      id: 'vw',
      viewId: 'v.items',
      rowDetail: { routeId: 'd' },
    });
    expect(plan.views['vw']?.rowDetail).toEqual({
      routeId: 'd',
      label: 'Open',
      param: { id: 'id' },
    });
  });

  it('discards a binding without a well-formed routeId; falls back to defaults for malformed optional members (compiler already rejects all of these)', () => {
    for (const malformed of [undefined, { routeId: '' }, { routeId: 7 }]) {
      const plan = planWith({ role: 'view', id: 'vw', viewId: 'v.items', rowDetail: malformed });
      expect(plan.views['vw']?.rowDetail).toBeUndefined();
    }
    // Malformed optional members degrade to the presentation defaults.
    const plan = planWith({
      role: 'view',
      id: 'vw',
      viewId: 'v.items',
      rowDetail: { routeId: 'd', param: 'id', label: 42 },
    });
    expect(plan.views['vw']?.rowDetail).toEqual({
      routeId: 'd',
      label: 'Open',
      param: { id: 'id' },
    });
  });
});
