import { describe, expect, it } from 'vitest';
import { compileStudioPlan, studioApplication } from '$lib/application/index.js';
import { STUDIO_RESOURCES } from '$lib/shared/contract.js';

/**
 * App-definition invariants for the G1 Studio read-only operator surface.
 * These guard the agreed interface: exact route set, EMPTY mutations on
 * every resource (read-only), no mutation/capability actions, and the
 * route-param === identityField convention.
 */

const EXPECTED_ROUTES = ['/', '/runs', '/runs/:runId', '/activations', '/releases', '/audit'];

describe('studio application definition', () => {
  it('compiles into an immutable plan', () => {
    const plan = compileStudioPlan();
    expect(plan.applicationId).toBe('app.vict-studio');
    expect(plan.applicationRevision).toBe('1');
    expect(typeof plan.toJSON()).toBe('object');
  });

  it('contains exactly the six agreed route paths', () => {
    const plan = compileStudioPlan();
    const paths = plan.routes.map((entry) => entry.route.path).sort();
    expect(paths).toEqual([...EXPECTED_ROUTES].sort());
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

  it('binds the named component on the definition identity', () => {
    expect(studioApplication.components).toEqual([
      { componentId: 'cmp.target-connection-status', revision: '1' },
    ]);
  });
});
