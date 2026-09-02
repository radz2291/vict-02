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
import { RendererDiagnostic } from '@vict/application/renderer';
import type { ApplicationPlan } from '@vict/application';
import { runRendererConformanceSuite } from '@vict/application/testing';
import { compileProofPlan } from '$lib/application/definition';
import { createProofComponentRegistry, createProofRenderer } from '$lib/host/proof-renderer';
import ApplicationHost from '$lib/host/ApplicationHost.svelte';

/**
 * The Svelte proof host passes the SAME shared renderer conformance suite
 * that any future renderer must pass: declared role coverage, honest
 * unsupported-role diagnostics, unknown-component/revision failures before
 * unsafe rendering, plan immutability, idempotent teardown — and the
 * MANDATORY hostile-action canary scenario (LOW-04-E remediation): real
 * clicks, dispatcher rejections of every shape (synchronous throw,
 * rejected promise, nested causes), `error.message`/stack/cause/details
 * inspection (not only `JSON.stringify`), zero unhandled rejections, and
 * the declared safe failure state actually rendered.
 */

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
            ? ({ role: 'action', id: 'act.remote', label: 'Go' } as const)
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
    actions: [
      { kind: 'local', id: 'act.clear', revision: '1' },
      {
        kind: 'query',
        id: 'act.remote',
        revision: '1',
        resourceId: 'notes',
        resourceRevision: '1',
      },
    ],
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
  it('passes runRendererConformanceSuite including the mandatory hostile-action canary', async () => {
    await expect(
      runRendererConformanceSuite({
        renderer: createProofRenderer(async () => ({ ok: true as const, value: null })),
        basePlan: compileProofPlan(),
        buildProbePlan,
        // The hostile-action scenario: a plan rendering a REMOTE action
        // surface whose dispatch rejects with the canary.
        buildFailingActionPlan: () => buildProbePlan('action'),
        makeBindings: () => {
          const components = createProofComponentRegistry();
          return {
            components,
            dispatch: {
              execute: async () => {
                throw new Error('hostile action failure RA4-RENDERER-CANARY');
              },
            },
          };
        },
        serializeOutput: (output) => (output as HTMLElement).innerHTML ?? String(output),
        // A REAL action invocation/click through the rendered host.
        triggerAction: async (output) => {
          const target = output as HTMLElement;
          const actionButton = target.querySelector<HTMLButtonElement>(
            'button[data-surface][data-action-kind]:not([data-action-kind="local"])',
          );
          if (actionButton !== null) {
            actionButton.click();
          }
          // Let the dispatcher rejection land and be handled.
          await new Promise((resolve) => setTimeout(resolve, 20));
          flushSync();
        },
        // The declared safe failure state must render; the canary must not.
        getFailureStateText: (output) => {
          const target = output as HTMLElement;
          const failure = target.querySelector('[data-testid="failure-state"]');
          return failure?.textContent ?? undefined;
        },
      }),
    ).resolves.toBeUndefined();
  });

  // Directly observable: an unsupported role fails honestly.
  it('an unsupported role fails with a structured diagnostic', () => {
    const renderer = createProofRenderer(async () => ({ ok: true as const, value: null }));
    const plan = buildProbePlan('states');
    expect(() =>
      renderer.render(plan, {
        components: createProofComponentRegistry(),
        dispatch: { execute: async () => ({ ok: true as const, value: null }) },
      }),
    ).toThrowError(RendererDiagnostic);
  });

  // Negative control: the OLD host (pre-remediation) propagated dispatcher
  // rejections as unhandled rejections and never rendered the failure
  // state. The strengthened suite fails against that behavior because
  // getFailureStateText would return undefined while the canary surfaced
  // as an unhandled rejection.
  it('a dispatcher rejection renders the declared safe failure state, never the canary', async () => {
    const CANARY = 'RA4-PROOF-DISPATCH-CANARY';
    const target = document.createElement('div');
    document.body.appendChild(target);
    const instance = mount(ApplicationHost, {
      target,
      props: {
        plan: compileProofPlan(),
        registry: createProofComponentRegistry(),
        dispatch: async () => {
          throw new Error(`hostile dispatcher failure ${CANARY}`);
        },
        rows: [],
      },
    });
    flushSync();
    try {
      // Click the non-local VICT capability action: the dispatcher rejects.
      const button = target.querySelector<HTMLButtonElement>('button[data-surface="sa.summarize"]');
      expect(button).not.toBeNull();
      button!.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
      flushSync();
      // The declared failure state rendered.
      const failure = target.querySelector('[data-testid="failure-state"]');
      expect(failure?.textContent).toContain('Something failed safely.');
      // No canary anywhere in the DOM.
      expect(target.innerHTML).not.toContain(CANARY);
    } finally {
      unmount(instance);
      target.remove();
    }
  });
});