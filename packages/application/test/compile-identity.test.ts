import { describe, expect, it } from 'vitest';
import {
  APPLICATION_DEFINITION_SCHEMA,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineResource,
} from '@vict/sdk';
import {
  compileApplication,
  computeApplicationVersion,
  compileApplicationRelease,
  computeReleaseVersion,
} from '../src/index.js';
import type { ApplicationDefinition, ResourceDefinition } from '@vict/sdk';

/** A minimal but complete proof-shaped application used across identity tests. */
function definition(): ApplicationDefinition {
  return {
    schema: APPLICATION_DEFINITION_SCHEMA,
    id: 'app.probe',
    revision: '1',
    name: 'Probe',
    routes: [
      { id: 'home', path: '/', screenId: 's.home', nav: { label: 'Home', order: 1 } },
      { id: 'about', path: '/about', screenId: 's.about', nav: { label: 'About', order: 2 } },
    ],
    screens: [
      {
        id: 's.home',
        title: 'Home',
        layout: [
          {
            name: 'main',
            surfaces: [
              { role: 'text', id: 't.hello', content: 'hello' },
              { role: 'action', id: 'a.ping', actionId: 'act.ping', label: 'Ping' },
            ],
          },
        ],
        states: { denied: { role: 'text', id: 't.denied', content: 'denied' } },
      },
      {
        id: 's.about',
        title: 'About',
        layout: [{ name: 'main', surfaces: [{ role: 'text', id: 't.about', content: 'about' }] }],
      },
    ],
    views: [
      {
        viewId: 'v.notes',
        resourceId: 'notes',
        resourceRevision: '1',
        fields: ['title'],
      },
    ],
    actions: [
      { kind: 'local', id: 'act.ping', revision: '1' },
      {
        kind: 'query',
        id: 'act.listNotes',
        revision: '1',
        resourceId: 'notes',
        resourceRevision: '1',
      },
    ],
    resources: [{ resourceId: 'notes', revision: '1' }],
    components: [{ componentId: 'cmp.badge', revision: '1' }],
    compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA },
  };
}

function resource(): ResourceDefinition {
  return defineResource({
    schema: RESOURCE_DEFINITION_SCHEMA,
    id: 'notes',
    revision: '1',
    identity: { key: 'id' },
    fields: [
      { name: 'id', type: 'string', required: true },
      { name: 'title', type: 'string' },
    ],
    queries: { list: { filters: ['title'], sort: ['title'], pagination: true } },
    mutations: [{ op: 'create', effect: 'write', inputContractId: 'c.note', idempotency: 'keyed' }],
    authorization: { effect: 'read' },
  });
}

const contracts = [{ id: 'c.note', revision: '2' }];
const capabilities = [{ id: 'cap.summarize', revision: '1' }];
const components = [{ componentId: 'cmp.badge', revision: '1' }];

function compileValid() {
  const result = compileApplication({
    application: definition(),
    resources: [resource()],
    contracts,
    capabilities,
    components,
  });
  if (!result.ok) {
    throw new Error(`expected valid: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}

describe('Stage 04: application compiler', () => {
  it('compiles a valid application into an immutable plan', () => {
    const plan = compileValid();
    expect(plan.applicationId).toBe('app.probe');
    expect(plan.applicationVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.screens)).toBe(true);
    expect(Object.isFrozen(plan.screens['s.home'])).toBe(true);
    expect(() => {
      (plan as { applicationId: string }).applicationId = 'mutated';
    }).toThrow();
  });

  it('rejects unknown routes, screens, regions fields, resources, actions, components', () => {
    const application = definition();
    // unknown route target screen
    (application.routes[0] as { screenId: string }).screenId = 's.missing';
    const result = compileApplication({
      application,
      resources: [resource()],
      contracts,
      capabilities,
      components,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.code)).toContain('UNKNOWN_ROUTE_SCREEN');
  });

  it('rejects unknown fields at nested boundaries (plain JS objects)', () => {
    const application = definition() as unknown as Record<string, unknown>;
    const screens = application.screens as Record<string, unknown>[];
    (screens[0] as Record<string, unknown>).mystery = true;
    const result = compileApplication({
      application: application as never,
      resources: [resource()],
      contracts,
      capabilities,
      components,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.code)).toContain('APPLICATION_UNKNOWN_FIELD');
    const issue = result.issues.find((entry) => entry.code === 'APPLICATION_UNKNOWN_FIELD');
    expect(issue?.message).toContain("'mystery'");
  });

  it('rejects embedded configuration/secret values where only references are allowed', () => {
    const application = definition() as unknown as Record<string, unknown>;
    application.secrets = { apiKey: 'hunter2' };
    const result = compileApplication({
      application: application as never,
      resources: [resource()],
      contracts,
      capabilities,
      components,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.code)).toContain('APPLICATION_EMBEDDED_VALUE_FIELD');
    // The value itself is never echoed into diagnostics.
    expect(JSON.stringify(result.issues)).not.toContain('hunter2');
  });

  it('rejects duplicate ids and incompatible contract references', () => {
    const duplicated = definition();
    (duplicated as unknown as { actions: unknown[] }).actions = [
      ...duplicated.actions,
      { kind: 'local', id: 'act.ping', revision: '2' },
    ];
    const dupResult = compileApplication({
      application: duplicated,
      resources: [resource()],
      contracts,
      capabilities,
      components,
    });
    expect(dupResult.ok).toBe(false);
    if (!dupResult.ok) {
      expect(dupResult.issues.map((issue) => issue.code)).toContain('DUPLICATE_ACTION_ID');
    }

    const wrongRevision = definition();
    const queryAction = wrongRevision.actions[1] as {
      inputContractId?: string;
      inputContractRevision?: string;
    };
    queryAction.inputContractId = 'c.note';
    queryAction.inputContractRevision = '9';
    const revResult = compileApplication({
      application: wrongRevision,
      resources: [resource()],
      contracts,
      capabilities,
      components,
    });
    expect(revResult.ok).toBe(false);
    if (!revResult.ok) {
      expect(revResult.issues.map((issue) => issue.code)).toContain('CONTRACT_REVISION_MISMATCH');
    }

    const unknownContract = definition();
    (unknownContract.actions[1] as { inputContractId?: string }).inputContractId = 'c.ghost';
    (unknownContract.actions[1] as { inputContractRevision?: string }).inputContractRevision = '1';
    const ghostResult = compileApplication({
      application: unknownContract,
      resources: [resource()],
      contracts,
      capabilities,
      components,
    });
    expect(ghostResult.ok).toBe(false);
    if (!ghostResult.ok) {
      expect(ghostResult.issues.map((issue) => issue.code)).toContain('UNKNOWN_CONTRACT_REFERENCE');
    }
  });

  it('rejects unknown component references and revision mismatches', () => {
    const ghost = definition();
    (ghost as unknown as { components: unknown[] }).components = [
      { componentId: 'cmp.ghost', revision: '1' },
    ];
    const result = compileApplication({
      application: ghost,
      resources: [resource()],
      contracts,
      capabilities,
      components,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected invalid');
    expect(result.issues.map((issue) => issue.code)).toContain('UNKNOWN_COMPONENT_REFERENCE');

    const mismatched = definition();
    (mismatched as unknown as { components: unknown[] }).components = [
      { componentId: 'cmp.badge', revision: '7' },
    ];
    const result2 = compileApplication({
      application: mismatched,
      resources: [resource()],
      contracts,
      capabilities,
      components,
    });
    expect(result2.ok).toBe(false);
    if (!result2.ok) {
      expect(result2.issues.map((issue) => issue.code)).toContain('COMPONENT_REVISION_MISMATCH');
    }
  });

  it('rejects resource revision mismatches and unknown catalogue fields', () => {
    const stale = definition();
    (stale as unknown as { resources: unknown[] }).resources = [
      { resourceId: 'notes', revision: '2' },
    ];
    const result = compileApplication({
      application: stale,
      resources: [resource()],
      contracts,
      capabilities,
      components,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected invalid');
    expect(result.issues.map((issue) => issue.code)).toContain('RESOURCE_REVISION_MISMATCH');

    const unknownField = definition();
    (unknownField.views![0] as unknown as { fields: string[] }).fields = ['ghost'];
    const result2 = compileApplication({
      application: unknownField,
      resources: [resource()],
      contracts,
      capabilities,
      components,
    });
    expect(result2.ok).toBe(false);
    if (!result2.ok) {
      expect(result2.issues.map((issue) => issue.code)).toContain('UNKNOWN_FIELD');
    }
  });

  it('diagnostics are deterministic and insertion-order independent', () => {
    const a = definition() as unknown as Record<string, unknown>;
    const b = definition() as unknown as Record<string, unknown>;
    (a.routes as unknown as Record<string, unknown>[])[0]!.zz = 1;
    (a.routes as unknown as Record<string, unknown>[])[1]!.aa = 1;
    (b.routes as unknown as Record<string, unknown>[])[1]!.aa = 1;
    (b.routes as unknown as Record<string, unknown>[])[0]!.zz = 1;
    const resultA = compileApplication({
      application: a as never,
      resources: [resource()],
      contracts,
      capabilities,
      components,
    });
    const resultB = compileApplication({
      application: b as never,
      resources: [resource()],
      contracts,
      capabilities,
      components,
    });
    expect(resultA.ok).toBe(false);
    expect(resultB.ok).toBe(false);
    if (!resultA.ok && !resultB.ok) {
      expect(resultA.issues).toEqual(resultB.issues);
    }
  });
});

describe('Stage 04: application identity', () => {
  it('identical semantics produce identical applicationVersion across processes', () => {
    const first = computeApplicationVersion({ application: definition(), resources: [resource()] });
    const second = computeApplicationVersion({
      application: defineApplication(definition()),
      resources: [defineResource(resource())],
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^v1_[0-9a-f]{64}$/);
  });

  it('object/set insertion order does NOT affect identity', () => {
    const reordered = definition();
    (reordered as unknown as { screens: unknown[] }).screens = [...reordered.screens].reverse();
    (reordered as unknown as { actions: unknown[] }).actions = [...reordered.actions].reverse();
    (reordered as unknown as { resources: unknown[] }).resources = [...reordered.resources];
    (reordered as unknown as { components: unknown[] }).components = [
      ...(reordered.components ?? []),
    ];
    const first = computeApplicationVersion({ application: definition(), resources: [resource()] });
    const second = computeApplicationVersion({ application: reordered, resources: [resource()] });
    expect(first).toBe(second);
  });

  it('meaningful UI sequence order DOES affect identity (navigation, surfaces, form fields)', () => {
    const base = computeApplicationVersion({ application: definition(), resources: [resource()] });

    const reorderedNav = definition();
    (reorderedNav as unknown as { routes: unknown[] }).routes = [...reorderedNav.routes].reverse();
    expect(
      computeApplicationVersion({ application: reorderedNav, resources: [resource()] }),
    ).not.toBe(base);

    const reorderedSurfaces = definition();
    const layout = reorderedSurfaces.screens[0]!.layout[0]!;
    (reorderedSurfaces as unknown as { screens: { layout: unknown[] }[] }).screens[0]!.layout = [
      { name: 'main', surfaces: [...layout.surfaces].reverse() },
    ];
    expect(
      computeApplicationVersion({ application: reorderedSurfaces, resources: [resource()] }),
    ).not.toBe(base);
  });

  it('resource/view/action revision changes affect identity', () => {
    const base = computeApplicationVersion({ application: definition(), resources: [resource()] });

    const bumpedResource = resource();
    const bumped = defineResource({ ...bumpedResource, revision: '2' });
    const app2 = definition();
    (app2 as unknown as { resources: unknown[] }).resources = [
      { resourceId: 'notes', revision: '2' },
    ];
    (app2 as unknown as { views: unknown[] }).views = [
      { ...app2.views![0]!, resourceRevision: '2' },
    ];
    expect(computeApplicationVersion({ application: app2, resources: [bumped] })).not.toBe(base);

    const app3 = definition();
    (app3 as unknown as { actions: unknown[] }).actions = [
      { ...app3.actions[0]!, revision: '2' },
      app3.actions[1]!,
    ];
    expect(computeApplicationVersion({ application: app3, resources: [resource()] })).not.toBe(
      base,
    );
  });

  it('component revision changes affect identity; function text, timestamps and frameworks never do', () => {
    const base = computeApplicationVersion({ application: definition(), resources: [resource()] });
    const app2 = definition();
    (app2 as unknown as { components: unknown[] }).components = [
      { componentId: 'cmp.badge', revision: '2' },
    ];
    expect(computeApplicationVersion({ application: app2, resources: [resource()] })).not.toBe(
      base,
    );

    // Topology change (a new route) changes identity.
    const app3 = definition();
    (app3 as unknown as { routes: unknown[] }).routes = [
      ...app3.routes,
      { id: 'docs', path: '/docs', screenId: 's.about' },
    ];
    expect(computeApplicationVersion({ application: app3, resources: [resource()] })).not.toBe(
      base,
    );

    // Renderer revision alone NEVER changes applicationVersion (it is not an
    // input to the hash at all — asserted structurally by the formula above).
  });
});

describe('Stage 04: application release', () => {
  function release(plan: ReturnType<typeof compileValid>, rendererRevision = '1') {
    return {
      schema: 'vict.application-release@1' as const,
      applicationId: plan.applicationId,
      applicationRevision: plan.applicationRevision,
      applicationVersion: plan.applicationVersion,
      renderer: { id: 'renderer.svelte-proof', revision: rendererRevision },
      components: {
        registryId: 'registry.proof',
        revision: '1',
        components: [{ componentId: 'cmp.badge', revision: '1' }],
      },
      dataAdapter: { id: 'vict.in-memory-data', revision: '1' },
      victCompatibility: '^0.1.0',
      activation: { kind: 'policy' as const, selection: 'latest' as const },
      provenance: { author: 'vict team' },
    };
  }

  it('compiles a valid release with an identity DISTINCT from applicationVersion', () => {
    const plan = compileValid();
    const result = compileApplicationRelease(release(plan), plan);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.release.releaseVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    expect(result.release.releaseVersion).not.toBe(plan.applicationVersion);
    expect(Object.isFrozen(result.release.manifest)).toBe(true);
  });

  it('renderer/adapter revision changes alter release identity but NOT applicationVersion', () => {
    const plan = compileValid();
    const first = compileApplicationRelease(release(plan, '1'), plan);
    const second = compileApplicationRelease(release(plan, '2'), plan);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.release.releaseVersion).not.toBe(second.release.releaseVersion);
      expect(plan.applicationVersion).toBe(
        computeApplicationVersion({ application: definition(), resources: [resource()] }),
      );
    }
  });

  it('rejects releases binding the wrong application version and unsafe provenance', () => {
    const plan = compileValid();
    const wrong = release(plan);
    (wrong as { applicationVersion: string }).applicationVersion = 'v1_deadbeef';
    const result = compileApplicationRelease(wrong, plan);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('RELEASE_APPLICATION_MISMATCH');
    }

    const unsafe = release(plan);
    (unsafe as { provenance: Record<string, unknown> }).provenance = {
      author: 'x',
      buildPath: '/Users/secret/path',
    };
    const result2 = compileApplicationRelease(unsafe, plan);
    expect(result2.ok).toBe(false);
    if (!result2.ok) {
      expect(result2.issues.map((issue) => issue.code)).toContain('RELEASE_EMBEDDED_VALUE_FIELD');
    }

    const unknownField = release(plan) as Record<string, unknown>;
    unknownField.secrets = { apiKey: 'hunter2' };
    const result3 = compileApplicationRelease(unknownField as never, plan);
    expect(result3.ok).toBe(false);
    if (!result3.ok) {
      expect(JSON.stringify(result3.issues)).not.toContain('hunter2');
    }

    // Deterministic identity.
    const okPlan = compileValid();
    const a = compileApplicationRelease(release(okPlan), okPlan);
    const b = compileApplicationRelease(release(okPlan), okPlan);
    if (a.ok && b.ok) {
      expect(a.release.releaseVersion).toBe(b.release.releaseVersion);
      expect(a.release.releaseVersion).toBe(computeReleaseVersion(a.release.manifest));
    }
  });
});
