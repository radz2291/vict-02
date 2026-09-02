import { describe, expect, it } from 'vitest';
import {
  APPLICATION_DEFINITION_SCHEMA,
  APPLICATION_RELEASE_SCHEMA,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineResource,
} from '@vict/sdk';
import { compileApplication, createComponentRegistry } from '../src/index.js';
import type { ApplicationPlan } from '../src/index.js';
import { compileApplicationRelease } from '../src/index.js';

/**
 * RE-AUDIT MED-04-G-R permanent remediation suite — the release binding
 * verification context is MANDATORY and fail-closed.
 *
 * The binding context is an explicitly supplied argument. Release manifest
 * declarations are NOT accepted as proof of deployed identity:
 *
 * - an omitted, partial, or invalid context fails closed with the stable
 *   `RELEASE_BINDING_CONTEXT_REQUIRED` diagnostic (never a misleading
 *   mismatch code, never a silent compile);
 * - renderer and data-adapter identities are ALWAYS required (every valid
 *   release declares them);
 * - the component-registry identity snapshot is required when the release
 *   declares components;
 * - an exact activation reference requires the actually selected
 *   activation version (selection policies keep their documented
 *   semantics and require nothing);
 * - false ids, revisions, component sets, and activation identities fail;
 * - hostile context values never leak through diagnostics.
 *
 * TRUST BOUNDARY: VICT verifies EQUALITY against the supplied binding
 * snapshots; it cannot prove that hostile deployment tooling supplied
 * truthful snapshots. Deployment composition must source the context from
 * the actual selected renderer, registry, adapter, and activation.
 */

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
    id: 'app.release.ctx',
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
): Record<string, unknown> {
  return {
    schema: APPLICATION_RELEASE_SCHEMA,
    applicationId: plan.applicationId,
    applicationRevision: plan.applicationRevision,
    applicationVersion: plan.applicationVersion,
    renderer: { id: 'renderer.actual', revision: '1' },
    dataAdapter: { id: 'vict.in-memory-data', revision: '1' },
    victCompatibility: '^0.1.0',
    activation: { kind: 'policy' as const, selection: 'latest' as const },
    ...overrides,
  };
}

function actualRegistry(): ReturnType<typeof createComponentRegistry> {
  const registry = createComponentRegistry('registry.actual', '1');
  registry.register({ componentId: 'cmp.a', revision: '1', implementation: () => null });
  return registry;
}

function fullContext(
  registry: ReturnType<typeof createComponentRegistry>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    renderer: { id: 'renderer.actual', revision: '1' },
    componentRegistry: registry.identity(),
    dataAdapter: { id: 'vict.in-memory-data', revision: '1' },
    selectedActivationVersion: 'v1_activation-current',
    ...overrides,
  };
}

/** Plain-JS compile call with an arbitrary (possibly omitted) context. */
function compilePlain(
  release: unknown,
  plan: ApplicationPlan,
  ...rest: unknown[]
): ReturnType<typeof compileApplicationRelease> {
  return (
    compileApplicationRelease as unknown as (
      ...args: unknown[]
    ) => ReturnType<typeof compileApplicationRelease>
  )(release, plan, ...rest);
}

describe('RE-AUDIT MED-04-G-R: the release binding context is mandatory', () => {
  it('a context OMITTED from plain JavaScript fails closed (RELEASE_BINDING_CONTEXT_REQUIRED)', () => {
    const plan = compileProbePlan();
    const result = compilePlain(makeRelease(plan), plan);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toEqual([
        'RELEASE_BINDING_CONTEXT_REQUIRED',
      ]);
      expect(result.issues[0]?.path).toBe('context');
    }
  });

  it('undefined, null, and non-object contexts fail closed without echoing values', () => {
    const plan = compileProbePlan();
    for (const context of [undefined, null, 42, [], 1.5]) {
      const result = compilePlain(makeRelease(plan), plan, context);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.every((issue) => issue.code === 'RELEASE_BINDING_CONTEXT_REQUIRED'),
        ).toBe(true);
        if (String(context).length > 0) {
          expect(JSON.stringify(result.issues)).not.toContain(String(context));
        }
      }
    }
  });

  it('an empty context {} fails closed', () => {
    const plan = compileProbePlan();
    const result = compilePlain(makeRelease(plan), plan, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.issues.every((issue) => issue.code === 'RELEASE_BINDING_CONTEXT_REQUIRED'),
      ).toBe(true);
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('every partial context fails closed with precise paths', () => {
    const plan = compileProbePlan();
    const cases: [string, Record<string, unknown>, Record<string, unknown>, string][] = [
      [
        'renderer only',
        {},
        { renderer: { id: 'renderer.actual', revision: '1' } },
        'context.dataAdapter',
      ],
      [
        'renderer + dataAdapter (components declared)',
        {},
        {
          renderer: { id: 'renderer.actual', revision: '1' },
          dataAdapter: { id: 'vict.in-memory-data', revision: '1' },
        },
        'context.componentRegistry',
      ],
      [
        'missing selectedActivationVersion for an exact reference',
        { activation: { kind: 'reference', activationVersion: 'v1_stale' } },
        {
          renderer: { id: 'renderer.actual', revision: '1' },
          dataAdapter: { id: 'vict.in-memory-data', revision: '1' },
        },
        'context.selectedActivationVersion',
      ],
    ];
    for (const [name, releaseOverrides, context, expectedPath] of cases) {
      const release = makeRelease(plan, {
        components: {
          registryId: 'registry.actual',
          revision: '1',
          components: [{ componentId: 'cmp.a', revision: '1' }],
        },
        ...releaseOverrides,
      });
      const result = compilePlain(release, plan, context);
      expect(result.ok, name).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.every((issue) => issue.code === 'RELEASE_BINDING_CONTEXT_REQUIRED'),
          name,
        ).toBe(true);
        expect(
          result.issues.some((issue) => issue.path === expectedPath),
          name,
        ).toBe(true);
      }
    }
  });

  it('a policy activation requires NO selected activation version', () => {
    const plan = compileProbePlan();
    const registry = actualRegistry();
    // Policy activation: documented semantics retained; the release
    // compiles without any exact-activation requirement.
    const context = fullContext(registry);
    delete (context as Record<string, unknown>).selectedActivationVersion;
    const result = compilePlain(makeRelease(plan), plan, context);
    expect(result.ok).toBe(true);
  });

  it('an EXACT activation reference requires the actually selected activation version', () => {
    const plan = compileProbePlan();
    const registry = actualRegistry();
    const release = makeRelease(plan, {
      activation: { kind: 'reference', activationVersion: 'v1_activation-current' },
    });
    // Missing selectedActivationVersion: context failure, not a mismatch.
    const missing = compilePlain(release, plan, {
      renderer: { id: 'renderer.actual', revision: '1' },
      componentRegistry: registry.identity(),
      dataAdapter: { id: 'vict.in-memory-data', revision: '1' },
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.issues.map((issue) => issue.code)).toEqual([
        'RELEASE_BINDING_CONTEXT_REQUIRED',
      ]);
    }
    // A STALE exact activation fails with the precise mismatch code.
    const stale = compilePlain(release, plan, {
      ...fullContext(registry),
      selectedActivationVersion: 'v1_activation-other',
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.issues.map((issue) => issue.code)).toContain('RELEASE_ACTIVATION_MISMATCH');
    }
  });

  it('invalid context field shapes fail closed and never echo hostile values', () => {
    const plan = compileProbePlan();
    const registry = actualRegistry();
    const CANARY = 'HOSTILE-CONTEXT-CANARY-mgr';
    const exactRelease = makeRelease(plan, {
      activation: { kind: 'reference', activationVersion: 'v1_activation-current' },
    });
    const cases: [Record<string, unknown>, Record<string, unknown>][] = [
      [
        makeRelease(plan),
        { ...fullContext(registry), renderer: { id: { toString: () => CANARY }, revision: '1' } },
      ],
      [makeRelease(plan), { ...fullContext(registry), renderer: { id: 'renderer.actual' } }],
      [
        makeRelease(plan),
        { ...fullContext(registry), dataAdapter: { id: 'vict.in-memory-data', revision: null } },
      ],
      [
        makeRelease(plan),
        {
          ...fullContext(registry),
          componentRegistry: {
            registryId: 'registry.actual',
            revision: '1',
            components: [{ componentId: 'cmp.a' }],
          },
        },
      ],
      [
        makeRelease(plan),
        {
          ...fullContext(registry),
          componentRegistry: {
            registryId: 'registry.actual',
            revision: '1',
            components: 'all',
          },
        },
      ],
      [exactRelease, { ...fullContext(registry), selectedActivationVersion: 12345 }],
    ];
    for (const [release, context] of cases) {
      const result = compilePlain(release, plan, context);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.every((issue) => issue.code === 'RELEASE_BINDING_CONTEXT_REQUIRED'),
        ).toBe(true);
        expect(JSON.stringify(result.issues)).not.toContain(CANARY);
      }
    }
  });
});

describe('RE-AUDIT MED-04-G-R: false identities fail against a complete context', () => {
  it('false renderer id and revision fail', () => {
    const plan = compileProbePlan();
    const registry = actualRegistry();
    const wrongId = compilePlain(makeRelease(plan), plan, {
      ...fullContext(registry),
      renderer: { id: 'renderer.TOTALLY-FALSE', revision: '1' },
    });
    expect(wrongId.ok).toBe(false);
    if (!wrongId.ok) {
      expect(wrongId.issues.map((issue) => issue.code)).toContain('RELEASE_RENDERER_MISMATCH');
    }
    const wrongRevision = compilePlain(makeRelease(plan), plan, {
      ...fullContext(registry),
      renderer: { id: 'renderer.actual', revision: '999' },
    });
    expect(wrongRevision.ok).toBe(false);
    if (!wrongRevision.ok) {
      expect(wrongRevision.issues.map((issue) => issue.code)).toContain(
        'RELEASE_RENDERER_MISMATCH',
      );
    }
  });

  it('false data-adapter id and revision fail', () => {
    const plan = compileProbePlan();
    const registry = actualRegistry();
    const wrongId = compilePlain(makeRelease(plan), plan, {
      ...fullContext(registry),
      dataAdapter: { id: 'adapter.TOTALLY-FALSE', revision: '1' },
    });
    expect(wrongId.ok).toBe(false);
    if (!wrongId.ok) {
      expect(wrongId.issues.map((issue) => issue.code)).toContain('RELEASE_DATA_ADAPTER_MISMATCH');
    }
    const wrongRevision = compilePlain(makeRelease(plan), plan, {
      ...fullContext(registry),
      dataAdapter: { id: 'vict.in-memory-data', revision: '9' },
    });
    expect(wrongRevision.ok).toBe(false);
    if (!wrongRevision.ok) {
      expect(wrongRevision.issues.map((issue) => issue.code)).toContain(
        'RELEASE_DATA_ADAPTER_MISMATCH',
      );
    }
  });

  it('missing, extra, and wrong-revision components fail (exact list, components declared)', () => {
    const plan = compileProbePlan();
    const release = makeRelease(plan, {
      components: {
        registryId: 'registry.actual',
        revision: '1',
        components: [{ componentId: 'cmp.a', revision: '1' }],
      },
    });
    // Missing component in the actual snapshot.
    const empty = createComponentRegistry('registry.actual', '1');
    const missing = compilePlain(release, plan, fullContext(empty));
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.issues.map((issue) => issue.code)).toContain('RELEASE_COMPONENT_MISMATCH');
    }
    // Extra component the release does not bind.
    const extra = actualRegistry();
    extra.register({ componentId: 'cmp.extra', revision: '1', implementation: () => null });
    const extraResult = compilePlain(release, plan, fullContext(extra));
    expect(extraResult.ok).toBe(false);
    if (!extraResult.ok) {
      expect(extraResult.issues.map((issue) => issue.code)).toContain('RELEASE_COMPONENT_MISMATCH');
    }
    // Wrong component revision.
    const wrongRev = createComponentRegistry('registry.actual', '1');
    wrongRev.register({ componentId: 'cmp.a', revision: '2', implementation: () => null });
    const revResult = compilePlain(release, plan, fullContext(wrongRev));
    expect(revResult.ok).toBe(false);
    if (!revResult.ok) {
      expect(revResult.issues.map((issue) => issue.code)).toContain('RELEASE_COMPONENT_MISMATCH');
    }
  });

  it('matching complete bindings compile deterministically with the same release identity', () => {
    const plan = compileProbePlan();
    const registry = actualRegistry();
    const release = makeRelease(plan, {
      components: {
        registryId: 'registry.actual',
        revision: '1',
        components: [{ componentId: 'cmp.a', revision: '1' }],
      },
      activation: { kind: 'reference', activationVersion: 'v1_activation-current' },
    });
    const first = compilePlain(release, plan, fullContext(registry));
    const second = compilePlain(release, plan, fullContext(registry));
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.release.releaseVersion).toBe(second.release.releaseVersion);
      expect(first.release.releaseVersion).toMatch(/^v1_[0-9a-f]{64}$/);
      // Release identity is distinct from applicationVersion.
      expect(first.release.releaseVersion).not.toBe(plan.applicationVersion);
    }
  });

  it('release immutability and defensive capture are intact (caller object never frozen)', () => {
    const plan = compileProbePlan();
    const registry = actualRegistry();
    const release = makeRelease(plan);
    const result = compilePlain(release, plan, fullContext(registry));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.isFrozen(result.release.manifest)).toBe(true);
      expect(Object.isFrozen(release)).toBe(false);
      expect(Object.isFrozen(release.renderer)).toBe(false);
      // Later input mutation cannot change the captured release.
      (release as Record<string, unknown>).renderer = { id: 'renderer.hijacked', revision: '9' };
      expect(result.release.manifest.renderer).toEqual({ id: 'renderer.actual', revision: '1' });
    }
  });

  it('hostile release getters still produce RELEASE_COMPILATION_FAILED (never throws)', () => {
    const plan = compileProbePlan();
    const registry = actualRegistry();
    const hostile = makeRelease(plan);
    Object.defineProperty(hostile, 'renderer', {
      get() {
        throw new Error('hostile getter canary RE-AUDIT-MGR-1');
      },
    });
    const result = compilePlain(hostile, plan, fullContext(registry));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('RELEASE_COMPILATION_FAILED');
      expect(JSON.stringify(result.issues)).not.toContain('RE-AUDIT-MGR-1');
    }
  });
});
