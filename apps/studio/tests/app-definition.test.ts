import { describe, expect, it } from 'vitest';
import { compileStudioPlan, studioApplication } from '$lib/application/index.js';
import { STUDIO_RESOURCES } from '$lib/shared/contract.js';

/** Read the declared FT-1 row→detail binding off a surface (if any). */
function runDetailBinding(surface: Record<string, unknown> | undefined): unknown {
  return surface?.rowDetail;
}

/**
 * App-definition invariants for the G1 Studio read-only operator surface.
 * These guard the agreed interface: exact route set, EMPTY mutations on
 * every resource (read-only), no mutation/capability actions, and the
 * route-param === identityField convention.
 */

// Stage 9 G2 interface amendment (S9-04 + S9-03 journey surfaces): the
// G1 resource set, empty-mutations invariant and zero-actions invariant
// are asserted unchanged below.
const EXPECTED_ROUTES = [
  '/',
  '/runs',
  '/runs/:runId',
  '/activations',
  '/releases',
  '/audit',
  '/confirmations',
  '/changesets',
];

describe('studio application definition', () => {
  it('compiles into an immutable plan', () => {
    const plan = compileStudioPlan();
    expect(plan.applicationId).toBe('app.vict-studio');
    expect(plan.applicationRevision).toBe('1');
    expect(typeof plan.toJSON()).toBe('object');
  });

  it('contains exactly the agreed route paths (G1 read surface + the additive G2 confirmation journey route)', () => {
    const plan = compileStudioPlan();
    const paths = plan.routes.map((entry) => entry.route.path).sort();
    expect(paths).toEqual([...EXPECTED_ROUTES].sort());
  });

  it('declares the S9-03 changeset journey route additively (its own screen, form-free)', () => {
    const plan = compileStudioPlan();
    const route = plan.routes.find((entry) => entry.route.path === '/changesets');
    expect(route).toBeDefined();
    const screen = plan.screens['s.changesets'];
    expect(screen).toBeDefined();
    // No form surface anywhere on the journey screen (forms live in the
    // SvelteKit route; the definition keeps the G1 zero-form discipline).
    const walk = (surfaces: readonly { role?: string }[]): void => {
      for (const surface of surfaces) expect(surface.role).not.toBe('form');
    };
    for (const region of screen!.layout) walk(region.surfaces);
  });

  it('declares all nine contract resources with EMPTY mutations (read-only)', () => {
    const plan = compileStudioPlan();
    for (const resourceId of STUDIO_RESOURCES) {
      const resource = plan.resources[resourceId];
      expect(resource, `resource ${resourceId} missing`).toBeDefined();
      expect(resource.mutations).toEqual([]);
    }
    expect(Object.keys(plan.resources).sort()).toEqual([...STUDIO_RESOURCES].sort());
  });

  it('declares no mutation or capability actions (zero actions overall)', () => {
    const plan = compileStudioPlan();
    const actions = Object.values(plan.actions);
    expect(actions).toHaveLength(0);
    for (const action of actions) {
      expect(action.kind).not.toBe('mutation');
      expect(action.kind).not.toBe('capability');
    }
    // And no surface binds a form anywhere.
    for (const screen of Object.values(plan.screens)) {
      const walk = (surfaces: readonly { role?: string }[]): void => {
        for (const surface of surfaces) {
          expect(surface.role).not.toBe('form');
        }
      };
      for (const region of screen.layout) walk(region.surfaces);
    }
  });

  it('uses the route-param === identityField convention for the detail route', () => {
    const plan = compileStudioPlan();
    const runDetail = plan.routes.find((entry) => entry.route.path === '/runs/:runId');
    expect(runDetail).toBeDefined();
    const paramNames = [...runDetail!.route.path.matchAll(/:([A-Za-z]+)/g)].map((m) => m[1]);
    expect(paramNames).toEqual(['runId']);
    expect(plan.resources.runs.identity.key).toBe('runId');
  });

  it('declares the FT-1 row→detail navigation binding on the run-list surface', () => {
    const plan = compileStudioPlan();
    const screen = plan.screens['s.runs'];
    expect(screen).toBeDefined();
    const surfaces: Array<Record<string, unknown>> = [];
    for (const region of screen.layout) {
      surfaces.push(...(region.surfaces as unknown as Array<Record<string, unknown>>));
    }
    const runList = surfaces.find((surface) => surface.id === 'vw.runs');
    expect(runDetailBinding(runList)).toEqual({
      routeId: 'run-detail',
      label: 'Open run',
      param: { runId: 'runId' },
    });
    // The binding targets the declared run-detail route and maps its single
    // path parameter from the row identity field.
    const route = plan.routes.find((entry) => entry.route.id === 'run-detail');
    expect(route?.route.path).toBe('/runs/:runId');
    // No other view/table surface declares a rowDetail binding (navigation-
    // only scope: the binding appears exactly once, on the run list).
    const bound: Record<string, unknown>[] = [];
    for (const [, candidate] of Object.entries(plan.screens)) {
      const layout = (candidate as unknown as { layout: Array<{ surfaces: Array<Record<string, unknown>> }> })
        .layout;
      for (const region of layout) {
        bound.push(...region.surfaces.filter((surface) => runDetailBinding(surface) !== undefined));
      }
    }
    expect(bound).toHaveLength(1);
    expect((bound[0] as Record<string, unknown>).id).toBe('vw.runs');
  });

  it('binds the named component on the definition identity', () => {
    expect(studioApplication.components).toEqual([
      { componentId: 'cmp.target-connection-status', revision: '1' },
      // Stage 9 G2 (S9-04): the named confirmation-review island joins the
      // definition's declared component set (additive; G1 invariants unchanged).
      { componentId: 'cmp.confirmation-review', revision: '1' },
    ]);
  });
});
