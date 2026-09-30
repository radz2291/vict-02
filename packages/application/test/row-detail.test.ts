import { describe, expect, it } from 'vitest';
import { compileApplication, type CompileApplicationInput } from '../src/index.js';

/**
 * FT-1 (G3-A): the closed @2 surface schema accepts exactly one additive
 * member — `rowDetail` on the 'view' and 'table' roles — as the DECLARATION
 * VEHICLE for the definition-driven row→detail navigation binding. The
 * accepted shape is bounded (declared routeId + optional label + a closed
 * route-parameter → row-field mapping); unknown fields stay rejected and
 * absence changes nothing.
 */

function fixture(
  surface: Record<string, unknown>,
  overrides?: { routePath?: string },
): Record<string, unknown> {
  return {
    application: {
      schema: 'vict.application@2',
      id: 'app.row-detail',
      revision: '1',
      routes: [
        { id: 'home', path: '/', screenId: 'screen' },
        { id: 'item-detail', path: overrides?.routePath ?? '/runs/:runId', screenId: 'detail' },
      ],
      screens: [
        {
          id: 'screen',
          title: 'Requests',
          layout: [{ name: 'main', surfaces: [surface] }],
        },
        { id: 'detail', title: 'Detail', layout: [{ name: 'main', surfaces: [] }] },
      ],
      views: [
        {
          viewId: 'v.items',
          resourceId: 'items',
          resourceRevision: '1',
          fields: ['id', 'runId'],
        },
      ],
      actions: [],
      resources: [{ resourceId: 'items', revision: '1' }],
    },
    resources: [
      {
        schema: 'vict.resource@1',
        id: 'items',
        revision: '1',
        identity: { key: 'id' },
        fields: [
          { name: 'id', type: 'string' },
          { name: 'runId', type: 'string' },
        ],
        mutations: [],
        authorization: { effect: 'read' },
      },
    ],
  };
}

const compile = (input: Record<string, unknown>) =>
  compileApplication(input as unknown as CompileApplicationInput);

/** First surface of the fixture's 'screen'. */
function firstSurface(result: {
  readonly ok?: unknown;
  readonly plan?: unknown;
}): Record<string, unknown> {
  if (!result.ok) throw new Error(String(result));
  const screen = (
    (result.plan as Record<string, unknown> | undefined)?.screens as
      Record<string, unknown> | undefined
  )?.['screen'] as unknown as {
    layout: Array<{ surfaces: Array<Record<string, unknown>> }>;
  };
  return screen.layout[0]!.surfaces[0]!;
}

describe('compileApplication: rowDetail binding (FT-1)', () => {
  it('emits the binding verbatim on view and table surfaces', () => {
    for (const role of ['view', 'table'] as const) {
      const compiled = compile(
        fixture({
          role,
          id: 'x',
          viewId: 'v.items',
          ...(role === 'table' ? { columns: [{ field: 'runId' }] } : {}),
          rowDetail: { routeId: 'item-detail', label: 'Open', param: { runId: 'runId' } },
        }),
      );
      expect(compiled.ok).toBe(true);
      expect(firstSurface(compiled).rowDetail).toEqual({
        routeId: 'item-detail',
        label: 'Open',
        param: { runId: 'runId' },
      });
    }
  });

  it('rejects an unknown routeId and a param name that is not a declared route parameter', () => {
    const unknownRoute = compile(
      fixture({ role: 'view', id: 'x', viewId: 'v.items', rowDetail: { routeId: 'nope' } }),
    );
    expect(unknownRoute.ok).toBe(false);
    const badParam = compile(
      fixture({
        role: 'view',
        id: 'x',
        viewId: 'v.items',
        rowDetail: { routeId: 'item-detail', param: { notAParam: 'runId' } },
      }),
    );
    expect(badParam.ok).toBe(false);
  });

  it('rejects row fields outside the bound view projection and non-plain shapes', () => {
    const badField = compile(
      fixture({
        role: 'view',
        id: 'x',
        viewId: 'v.items',
        rowDetail: { routeId: 'item-detail', param: { runId: 'secret' } },
      }),
    );
    expect(badField.ok).toBe(false);
    const notPlain = compile(
      fixture({ role: 'view', id: 'x', viewId: 'v.items', rowDetail: 'runs/:runId' }),
    );
    expect(notPlain.ok).toBe(false);
  });

  it('STILL rejects an unknown sibling surface field (the closure stays closed)', () => {
    const bad = compile(
      fixture({ role: 'view', id: 'x', viewId: 'v.items', rowHref: '/runs/xyz' }),
    );
    expect(bad.ok).toBe(false);
  });

  it('changes nothing when rowDetail is absent', () => {
    const compiled = compile(fixture({ role: 'view', id: 'x', viewId: 'v.items' }));
    expect(compiled.ok).toBe(true);
    const surface = firstSurface(compiled);
    expect(surface.rowDetail).toBeUndefined();
    expect(Object.isFrozen(surface)).toBe(true);
  });
});
