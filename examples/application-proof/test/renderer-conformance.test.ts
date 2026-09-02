import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import type { SurfaceRole } from '@vict/sdk';
import {
  APPLICATION_DEFINITION_SCHEMA,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineResource,
} from '@vict/sdk';
import { compileApplication } from '@vict/application';
import { createComponentRegistry, RendererDiagnostic } from '@vict/application/renderer';
import type { ApplicationPlan, ApplicationRenderer } from '@vict/application';
import { runRendererConformanceSuite } from '@vict/application/testing';
import Badge from '$lib/host/components/Badge.svelte';
import ApplicationHost from '$lib/host/ApplicationHost.svelte';
import { compileProofPlan } from '$lib/application/definition';

/**
 * The Svelte proof host passes the SAME shared renderer conformance suite
 * that any future renderer must pass: declared role coverage, honest
 * unsupported-role diagnostics, unknown-component/revision failures before
 * unsafe rendering, plan immutability, and idempotent teardown.
 */

/** A neutral ApplicationRenderer implemented by mounting the Svelte host. */
function createSvelteProofRenderer(): ApplicationRenderer {
  const dispatch = async () => ({ ok: true as const, value: null });
  return {
    id: 'renderer.svelte-proof',
    revision: '1',
    // The proof host implements these roles; standalone 'states' marker
    // surfaces are NOT supported (states render through screen.states).
    supportedSurfaceRoles: ['text', 'view', 'form', 'action', 'component'],
    render(plan: ApplicationPlan, bindings) {
      // Components come EXPLICITLY from the supplied bindings — the host
      // never consults a global or implicit registry.
      const target = document.createElement('div');
      document.body.appendChild(target);
      const instance = mount(ApplicationHost, {
        target,
        props: { plan, registry: bindings.components, dispatch, rows: [] },
      });
      flushSync();
      // Idempotent teardown (Svelte's unmount throws on the second call).
      let unmounted = false;
      return {
        output: target,
        unmount(): void {
          if (unmounted) {
            return;
          }
          unmounted = true;
          unmount(instance);
          target.remove();
        },
      };
    },
  };
}

const probeResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'notes',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'title', type: 'string' },
  ],
});

/** Compile a minimal valid plan whose only surface has the given role. */
function buildProbePlan(role: SurfaceRole): ApplicationPlan {
  const surface =
    role === 'text'
      ? ({ role: 'text', id: 'x', content: 'hi' } as const)
      : role === 'view'
        ? ({ role: 'view', id: 'x', viewId: 'v.notes' } as const)
        : role === 'form'
          ? ({ role: 'form', id: 'x', formId: 'f.note' } as const)
          : role === 'action'
            ? ({ role: 'action', id: 'x', actionId: 'act.clear', label: 'Go' } as const)
            : role === 'component'
              ? ({ role: 'component', id: 'x', componentId: 'cmp.badge', revision: '1' } as const)
              : ({ role: 'states', id: 'x', viewId: 'v.notes' } as const);
  const application = defineApplication({
    schema: APPLICATION_DEFINITION_SCHEMA,
    id: 'app.probe',
    revision: '1',
    routes: [{ id: 'home', path: '/', screenId: 's.main' }],
    screens: [
      {
        id: 's.main',
        title: 'Probe',
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
        submitActionId: 'act.clear',
      },
    ],
    actions: [{ kind: 'local', id: 'act.clear', revision: '1' }],
    resources: [{ resourceId: 'notes', revision: '1' }],
    components: [{ componentId: 'cmp.badge', revision: '1' }],
  });
  const result = compileApplication({
    application,
    resources: [probeResource],
    contracts: [{ id: 'c.note', revision: '1' }],
    components: [{ componentId: 'cmp.badge', revision: '1' }],
  });
  if (!result.ok) {
    throw new Error(`probe plan invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}

describe('Stage 04 proof: the Svelte host passes the SHARED renderer conformance suite', () => {
  it('passes runRendererConformanceSuite (roles, components, plan immutability)', () => {
    expect(() =>
      runRendererConformanceSuite({
        renderer: createSvelteProofRenderer(),
        basePlan: compileProofPlan(),
        buildProbePlan,
        makeBindings: () => {
          const components = createComponentRegistry('registry.proof', '1');
          components.register({ componentId: 'cmp.badge', revision: '1', implementation: Badge });
          return {
            components,
            dispatch: {
              execute: async () => {
                throw new Error('hostile action failure RA4-RENDERER-CANARY');
              },
            },
          };
        },
      }),
    ).not.toThrow();

    // Directly observable: an unsupported role fails honestly.
    const renderer = createSvelteProofRenderer();
    const plan = buildProbePlan('states');
    expect(() =>
      renderer.render(plan, {
        components: createComponentRegistry('registry.proof', '1'),
        dispatch: { execute: async () => ({ ok: true as const, value: null }) },
      }),
    ).toThrowError(RendererDiagnostic);
  });
});
