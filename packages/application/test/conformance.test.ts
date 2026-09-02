import { describe, expect, it } from 'vitest';
import {
  APPLICATION_DEFINITION_SCHEMA,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineResource,
} from '@vict/sdk';
import type { SurfaceRole } from '@vict/sdk';
import {
  compileApplication,
  createComponentRegistry,
  createInMemoryApplicationData,
  RendererDiagnostic,
} from '../src/index.js';
import type { ApplicationPlan } from '../src/index.js';
import { runRendererConformanceSuite } from '../src/testing.js';
import { runApplicationDataAdapterSuite } from '../src/testing.js';
import type { ApplicationRenderer, RendererBindings, RenderedApplication } from '../src/index.js';

/**
 * Stage 04: the SHARED conformance suites run against a neutral reference
 * renderer and the in-memory reference data adapter. The Svelte proof
 * renderer runs the SAME renderer suite in its own package tests.
 */

function compilePlanWithSurface(role: SurfaceRole, componentId = 'cmp.badge'): ApplicationPlan {
  const surface =
    role === 'text'
      ? { role: 'text' as const, id: 'x', content: 'hi' }
      : role === 'view'
        ? { role: 'view' as const, id: 'x', viewId: 'v.notes' }
        : role === 'form'
          ? { role: 'form' as const, id: 'x', formId: 'f.note' }
          : role === 'action'
            ? { role: 'action' as const, id: 'x', actionId: 'act.ping', label: 'Ping' }
            : role === 'component'
              ? { role: 'component' as const, id: 'x', componentId, revision: '1' }
              : { role: 'states' as const, id: 'x', viewId: 'v.notes' };
  const application = defineApplication({
    schema: APPLICATION_DEFINITION_SCHEMA,
    id: 'app.conformance',
    revision: '1',
    routes: [{ id: 'home', path: '/', screenId: 's.main' }],
    screens: [
      {
        id: 's.main',
        title: 'Main',
        layout: [{ name: 'main', surfaces: [surface] }],
      },
    ],
    views: [{ viewId: 'v.notes', resourceId: 'notes', resourceRevision: '1' }],
    forms: [
      {
        formId: 'f.note',
        resourceId: 'notes',
        resourceRevision: '1',
        inputContractId: 'c.note',
        fields: [{ name: 'title', label: 'Title' }],
        submitActionId: 'act.ping',
      },
    ],
    actions: [{ kind: 'local', id: 'act.ping', revision: '1' }],
    resources: [{ resourceId: 'notes', revision: '1' }],
    components: [{ componentId, revision: '1' }],
  });
  const result = compileApplication({
    application,
    resources: [
      defineResource({
        schema: RESOURCE_DEFINITION_SCHEMA,
        id: 'notes',
        revision: '1',
        identity: { key: 'id' },
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'title', type: 'string' },
        ],
      }),
    ],
    contracts: [{ id: 'c.note', revision: '1' }],
    components: [{ componentId, revision: '1' }],
  });
  if (!result.ok) {
    throw new Error(`probe plan invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}

/** A neutral reference renderer supporting text/action only. */
function makeReferenceRenderer(): ApplicationRenderer {
  const supported: readonly SurfaceRole[] = ['text', 'action'];
  const renderer: ApplicationRenderer = {
    id: 'renderer.reference',
    revision: '1',
    supportedSurfaceRoles: supported,
    render(plan: ApplicationPlan, bindings: RendererBindings): RenderedApplication {
      const parts: string[] = [];
      for (const { screen } of plan.routes) {
        for (const region of screen.layout) {
          for (const surface of region.surfaces) {
            if (!supported.includes(surface.role)) {
              throw new RendererDiagnostic(
                'RENDERER_UNSUPPORTED_ROLE',
                `Surface '${surface.id}' has role '${surface.role}', which this renderer does not support.`,
                { surfaceId: surface.id, role: surface.role },
              );
            }
            if (surface.role === 'text') {
              parts.push(surface.content);
            } else if (surface.role === 'action') {
              parts.push(`[action:${surface.label}]`);
              void bindings;
            }
          }
        }
      }
      return {
        output: parts.join('|'),
        unmount() {
          /* idempotent teardown */
        },
      };
    },
  };
  return renderer;
}

describe('Stage 04: shared renderer conformance suite (reference renderer)', () => {
  it('passes the shared suite and honestly rejects unsupported roles', () => {
    const renderer = makeReferenceRenderer();
    expect(() =>
      runRendererConformanceSuite({
        renderer,
        basePlan: compilePlanWithSurface('text'),
        buildProbePlan: (role) => compilePlanWithSurface(role),
        makeBindings: () => ({
          components: createComponentRegistry('registry.test', '1'),
          dispatch: { execute: async () => ({ ok: true as const, value: null }) },
        }),
      }),
    ).not.toThrow();

    // The probe behavior is directly observable: an unsupported role throws
    // a structured diagnostic, never silently renders.
    const plan = compilePlanWithSurface('view');
    expect(() =>
      renderer.render(plan, {
        components: createComponentRegistry('registry.test', '1'),
        dispatch: { execute: async () => ({ ok: true as const, value: null }) },
      }),
    ).toThrowError(RendererDiagnostic);
  });

  it('unknown components fail with structured diagnostics before rendering', () => {
    const renderer = makeReferenceRenderer();
    // A component-supporting renderer must resolve by exact id/revision.
    const componentRenderer: ApplicationRenderer = {
      ...renderer,
      supportedSurfaceRoles: ['text', 'action', 'component'],
      render(plan, bindings) {
        for (const { screen } of plan.routes) {
          for (const region of screen.layout) {
            for (const surface of region.surfaces) {
              if (surface.role === 'component') {
                const resolved = bindings.components.resolve({
                  componentId: surface.componentId,
                  revision: surface.revision,
                });
                if (!resolved.ok) {
                  throw new RendererDiagnostic(
                    resolved.code === 'UNKNOWN_COMPONENT'
                      ? 'RENDERER_UNKNOWN_COMPONENT'
                      : 'RENDERER_COMPONENT_RESOLUTION_FAILED',
                    resolved.message,
                    { componentId: surface.componentId },
                  );
                }
              }
            }
          }
        }
        return { output: 'ok', unmount() {} };
      },
    };
    const plan = compilePlanWithSurface('component');
    const registry = createComponentRegistry('registry.test', '1');
    registry.register({ componentId: 'cmp.badge', revision: '1', implementation: 'BADGE' });
    expect(
      componentRenderer.render(plan, {
        components: registry,
        dispatch: { execute: async () => ({ ok: true as const, value: null }) },
      }).output,
    ).toBe('ok');

    // Wrong revision is a structured failure.
    const wrongRevision = createComponentRegistry('registry.test', '1');
    wrongRevision.register({ componentId: 'cmp.badge', revision: '2', implementation: 'BADGE' });
    expect(() =>
      componentRenderer.render(plan, {
        components: wrongRevision,
        dispatch: { execute: async () => ({ ok: true as const, value: null }) },
      }),
    ).toThrowError(RendererDiagnostic);
  });
});

describe('Stage 04: shared application-data conformance suite (in-memory reference adapter)', () => {
  const resource = defineResource({
    schema: RESOURCE_DEFINITION_SCHEMA,
    id: 'tasks',
    revision: '1',
    identity: { key: 'id' },
    fields: [
      { name: 'id', type: 'string', required: true },
      { name: 'title', type: 'string' },
      { name: 'qty', type: 'number' },
    ],
    authorization: { effect: 'read', permissions: ['tasks.read'] },
    mutations: [
      {
        op: 'create',
        effect: 'write',
        idempotency: 'keyed',
        permissions: ['tasks.write'],
      },
    ],
  });

  it('passes every shared invariant', async () => {
    await expect(
      runApplicationDataAdapterSuite({
        resource,
        create: (seeds) => createInMemoryApplicationData([resource], { seeds: { tasks: seeds } }),
        readContext: { permissions: ['tasks.read'], effect: 'read' },
        writeContext: { permissions: ['tasks.read', 'tasks.write'], effect: 'write' },
        unauthorizedContext: { permissions: [], effect: 'read' },
      }),
    ).resolves.toBeUndefined();
  });

  it('the reference adapter keeps application data separate from VictStores', async () => {
    // Structural evidence: the adapter type surface carries no store
    // operations; the packaging isolation check proves no @vict/runtime
    // import exists in the emitted declarations.
    const adapter = createInMemoryApplicationData([resource]);
    expect(typeof adapter.query).toBe('function');
    expect(typeof adapter.mutate).toBe('function');
    expect((adapter as { stores?: unknown }).stores).toBeUndefined();
    const denied = await adapter.mutate(
      { resourceId: 'tasks', op: 'create', input: { id: 't1', title: 'x', qty: 1 } },
      { permissions: [], effect: 'write' },
    );
    expect(denied.ok).toBe(false);
  });
});
