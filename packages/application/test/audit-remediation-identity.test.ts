import { describe, expect, it } from 'vitest';
import {
  APPLICATION_DEFINITION_SCHEMA,
  APPLICATION_RELEASE_SCHEMA,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineResource,
} from '@vict/sdk';
import {
  compileApplication,
  createComponentRegistry,
  createInMemoryApplicationData,
} from '../src/index.js';
import type { ApplicationPlan } from '../src/index.js';
import { compileApplicationRelease } from '../src/index.js';

/**
 * Stage 04 audit remediation — HIGH-04-B (component-registry identity
 * aliasing), MED-04-G (release binding cross-checks), LOW-04-B/F (hostile
 * input, defensive release capture), and LOW-04-B (whitespace-only
 * identifiers).
 */

describe('HIGH-04-B: component-registry structural identity', () => {
  it('the exact collision from the audit coexists and resolves correctly', () => {
    const registry = createComponentRegistry('reg', '1');
    const implA = { name: 'impl-a' };
    const implB = { name: 'impl-b' };
    registry.register({ componentId: 'a', revision: '1@2', implementation: implA });
    registry.register({ componentId: 'a@1', revision: '2', implementation: implB });
    // Both resolve to their respective implementations.
    expect(registry.resolve({ componentId: 'a', revision: '1@2' })).toEqual({
      ok: true,
      implementation: implA,
    });
    expect(registry.resolve({ componentId: 'a@1', revision: '2' })).toEqual({
      ok: true,
      implementation: implB,
    });
    // identity() reports BOTH verbatim (no mis-parsed combined key).
    const identity = registry.identity();
    expect(identity.components).toEqual([
      { componentId: 'a', revision: '1@2' },
      { componentId: 'a@1', revision: '2' },
    ]);
  });

  it('multiple revisions of one component remain supported', () => {
    const registry = createComponentRegistry('reg', '1');
    const v1 = { name: 'v1' };
    const v2 = { name: 'v2' };
    registry.register({ componentId: 'cmp.multi', revision: '1', implementation: v1 });
    registry.register({ componentId: 'cmp.multi', revision: '2', implementation: v2 });
    expect(registry.resolve({ componentId: 'cmp.multi', revision: '1' })).toEqual({
      ok: true,
      implementation: v1,
    });
    expect(registry.resolve({ componentId: 'cmp.multi', revision: '2' })).toEqual({
      ok: true,
      implementation: v2,
    });
  });

  it('duplicate exact identity is rejected; empty and whitespace-only ids/revisions are rejected', () => {
    const registry = createComponentRegistry('reg', '1');
    registry.register({ componentId: 'cmp.x', revision: '1', implementation: null });
    expect(() =>
      registry.register({ componentId: 'cmp.x', revision: '1', implementation: () => null }),
    ).toThrowError();
    expect(() =>
      registry.register({ componentId: 'cmp.y', revision: '  ', implementation: () => null }),
    ).toThrowError();
    expect(() =>
      registry.register({ componentId: '   ', revision: '1', implementation: () => null }),
    ).toThrowError();
  });

  it('the identity snapshot is frozen and cannot be changed by later registry mutations', () => {
    const registry = createComponentRegistry('reg.identity', '1');
    registry.register({ componentId: 'cmp.snap', revision: '1', implementation: {} });
    const identity = registry.identity();
    expect(() => {
      (identity.components as unknown as unknown[]).push({ componentId: 'hijack', revision: '1' });
    }).toThrowError();
    registry.register({ componentId: 'cmp.later', revision: '1', implementation: () => null });
    expect(identity.components).toEqual([{ componentId: 'cmp.snap', revision: '1' }]);
  });
});

/* ------------------------------------------------------------------ */
/* Release binding cross-checks (MED-04-G)                              */
/* ------------------------------------------------------------------ */

const probeResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'notes',
  revision: '1',
  identity: { key: 'id' },
  fields: [{ name: 'id', type: 'string', required: true }],
});

function compileProbePlan(): ApplicationPlan {
  const application = defineApplication({
    schema: APPLICATION_DEFINITION_SCHEMA,
    id: 'app.release.probe',
    revision: '1',
    routes: [{ id: 'home', path: '/', screenId: 's.main' }],
    screens: [
      {
        id: 's.main',
        title: 'Probe',
        layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't', content: 'hi' }] }],
      },
    ],
    actions: [],
    resources: [{ resourceId: 'notes', revision: '1' }],
  });
  const result = compileApplication({ application, resources: [probeResource] });
  if (!result.ok) {
    throw new Error(`probe plan invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}

function makeRelease(
  plan: ApplicationPlan,
  overrides: Record<string, unknown> = {},
): import('@vict/sdk').ApplicationRelease & Record<string, unknown> {
  return {
    schema: APPLICATION_RELEASE_SCHEMA,
    applicationId: plan.applicationId,
    applicationRevision: plan.applicationRevision,
    applicationVersion: plan.applicationVersion,
    renderer: { id: 'renderer.svelte-proof', revision: '1' },
    dataAdapter: { id: 'vict.in-memory-data', revision: '1' },
    victCompatibility: '^0.1.0',
    activation: { kind: 'policy' as const, selection: 'latest' as const },
    ...overrides,
  };
}

describe('MED-04-G: releases cross-check actual supplied bindings', () => {
  it('a release compiled against its real bindings succeeds and captures identity', () => {
    const plan = compileProbePlan();
    const registry = createComponentRegistry('reg.probe', '1');
    registry.register({ componentId: 'cmp.a', revision: '1', implementation: () => null });
    const result = compileApplicationRelease(
      makeRelease(plan, {
        components: {
          registryId: 'reg.probe',
          revision: '1',
          components: [{ componentId: 'cmp.a', revision: '1' }],
        },
      }),
      plan,
      {
        renderer: { id: 'renderer.svelte-proof', revision: '1' },
        componentRegistry: registry.identity(),
        dataAdapter: { id: 'vict.in-memory-data', revision: '1' },
        selectedActivationVersion: 'v1_activation',
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.release.releaseVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    }
  });

  it('rejects wrong renderer, wrong registry, wrong component list, wrong adapter, stale activation', () => {
    const plan = compileProbePlan();
    const registry = createComponentRegistry('reg.probe', '1');
    registry.register({ componentId: 'cmp.a', revision: '1', implementation: () => null });
    const base = {
      componentRegistry: {
        registryId: 'reg.probe',
        revision: '1',
        components: registry.identity().components,
      },
      renderer: { id: 'renderer.svelte-proof', revision: '1' },
      dataAdapter: { id: 'vict.in-memory-data', revision: '1' },
    };
    const expectIssue = (
      releaseOverrides: Record<string, unknown>,
      contextOverrides: Record<string, unknown>,
      code: string,
    ): void => {
      const result = compileApplicationRelease(makeRelease(plan, releaseOverrides), plan, {
        ...base,
        ...contextOverrides,
      } as never);
      if (result.ok) {
        throw new Error(`expected issue ${code} but the release compiled: ${code}`);
      }
      expect(result.issues.map((issue) => issue.code)).toContain(code);
    };
    // Wrong renderer id and revision.
    expectIssue(
      {},
      { renderer: { id: 'renderer.other', revision: '1' } },
      'RELEASE_RENDERER_MISMATCH',
    );
    expectIssue(
      {},
      { renderer: { id: 'renderer.svelte-proof', revision: '9' } },
      'RELEASE_RENDERER_MISMATCH',
    );
    // Wrong registry identity.
    expectIssue(
      {
        components: {
          registryId: 'reg.probe',
          revision: '1',
          components: [{ componentId: 'cmp.a', revision: '1' }],
        },
      },
      {
        componentRegistry: { registryId: 'reg.other', revision: '1', components: [] },
      },
      'RELEASE_COMPONENT_REGISTRY_MISMATCH',
    );
    // Wrong registry revision.
    expectIssue(
      {
        components: {
          registryId: 'reg.probe',
          revision: '1',
          components: [{ componentId: 'cmp.a', revision: '1' }],
        },
      },
      {
        componentRegistry: {
          registryId: 'reg.probe',
          revision: '2',
          components: registry.identity().components,
        },
      },
      'RELEASE_COMPONENT_REGISTRY_MISMATCH',
    );
    // Missing component in the actual registry.
    expectIssue(
      {
        components: {
          registryId: 'reg.probe',
          revision: '1',
          components: [{ componentId: 'cmp.a', revision: '1' }],
        },
      },
      { componentRegistry: { registryId: 'reg.probe', revision: '1', components: [] } },
      'RELEASE_COMPONENT_MISMATCH',
    );
    // Extra component the release does not bind.
    const extraRegistry = createComponentRegistry('reg.probe', '1');
    extraRegistry.register({ componentId: 'cmp.a', revision: '1', implementation: () => null });
    extraRegistry.register({ componentId: 'cmp.extra', revision: '1', implementation: () => null });
    expectIssue(
      {
        components: {
          registryId: 'reg.probe',
          revision: '1',
          components: [{ componentId: 'cmp.a', revision: '1' }],
        },
      },
      {
        componentRegistry: {
          registryId: 'reg.probe',
          revision: '1',
          components: extraRegistry.identity().components,
        },
      },
      'RELEASE_COMPONENT_MISMATCH',
    );
    // Wrong data adapter.
    expectIssue(
      {},
      { dataAdapter: { id: 'other.adapter', revision: '1' } },
      'RELEASE_DATA_ADAPTER_MISMATCH',
    );
    // Stale activation binding.
    expectIssue(
      {
        activation: { kind: 'reference', activationVersion: 'v1_stale' },
      },
      { selectedActivationVersion: 'v1_current' },
      'RELEASE_ACTIVATION_MISMATCH',
    );
  });

  it('later live registry mutation does not change the compiled release identity', () => {
    const plan = compileProbePlan();
    const registry = createComponentRegistry('reg.probe', '1');
    registry.register({ componentId: 'cmp.a', revision: '1', implementation: () => null });
    const releaseInput = makeRelease(plan, {
      components: {
        registryId: 'reg.probe',
        revision: '1',
        components: [{ componentId: 'cmp.a', revision: '1' }],
      },
    });
    const result = compileApplicationRelease(releaseInput, plan, {
      componentRegistry: {
        registryId: 'reg.probe',
        revision: '1',
        components: registry.identity().components,
      },
      renderer: { id: 'renderer.svelte-proof', revision: '1' },
      dataAdapter: { id: 'vict.in-memory-data', revision: '1' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const releaseVersion = result.release.releaseVersion;
      // Later mutation of the INPUT object cannot change the captured release.
      (releaseInput as unknown as Record<string, unknown>).renderer = {
        id: 'renderer.hijacked',
        revision: '9',
      };
      expect(result.release.manifest.renderer).toEqual({
        id: 'renderer.svelte-proof',
        revision: '1',
      });
      expect(result.release.releaseVersion).toBe(releaseVersion);
    }
  });

  it('the release compiler never throws for hostile input (getters, proxies)', () => {
    const plan = compileProbePlan();
    const hostile = makeRelease(plan);
    Object.defineProperty(hostile, 'renderer', {
      get() {
        throw new Error('hostile getter canary RELEASE-1');
      },
    });
    const result = compileApplicationRelease(hostile, plan, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('RELEASE_COMPILATION_FAILED');
      expect(JSON.stringify(result.issues)).not.toContain('RELEASE-1');
    }
  });

  it('whitespace-only identifiers and unsafe provenance values are rejected', () => {
    const plan = compileProbePlan();
    const bad = compileApplicationRelease(
      makeRelease(plan, {
        renderer: { id: '   ', revision: '1' },
        provenance: { author: '   ' },
      }),
      plan,
      {},
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.issues.map((issue) => issue.code)).toContain('RELEASE_INVALID_IDENTIFIER');
    }
  });

  it('the compiled release deep-freezes the manifest without freezing the CALLER object', () => {
    const plan = compileProbePlan();
    const releaseInput = makeRelease(plan);
    const result = compileApplicationRelease(releaseInput, plan, {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.isFrozen(result.release.manifest)).toBe(true);
      // The caller's object was never frozen (LOW-04-F).
      expect(Object.isFrozen(releaseInput)).toBe(false);
      expect(Object.isFrozen(releaseInput.renderer)).toBe(false);
    }
  });
});

void createInMemoryApplicationData;
void createComponentRegistry;
