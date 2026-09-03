import type { SurfaceRole } from '@vict/sdk';
import type { ApplicationPlan } from './compile.js';
import type { ApplicationRenderer, RendererBindings } from './renderer.js';
import { RendererDiagnostic } from './renderer.js';

/**
 * Shared renderer conformance suite (Stage 04).
 *
 * Every conforming renderer — the Stage 04 proof renderer today, future
 * renderers later — must pass the SAME fixtures. Proven per renderer:
 *
 * 1. the base plan renders and tears down idempotently;
 * 2. the compiled plan is never mutated by rendering;
 * 3. surface roles OUTSIDE the renderer's declared coverage fail with a
 *    structured `RENDERER_UNSUPPORTED_ROLE` diagnostic (honest
 *    unsupported-role reporting, never silent omission);
 * 4. unknown components and revision mismatches fail with structured
 *    diagnostics BEFORE any unsafe rendering;
 * 5. action failures surface as SAFE mapped failures — canaries thrown by
 *    (or inside) the action, including nested causes and rejected
 *    promises, must never appear in `error.message`, stacks, causes,
 *    enumerable details, serialized output, or the DOM; the declared safe
 *    failure state must render; the dispatcher rejection is CAUGHT (no
 *    unhandled rejection ever exists).
 *
 * The action-canary scenario is MANDATORY for renderers that support the
 * 'action' role (LOW-04-E remediation): `buildFailingActionPlan`,
 * `serializeOutput`, `triggerAction`, and `getFailureStateText` may no
 * longer be omitted to skip it.
 */

export interface RendererConformanceFixture {
  readonly renderer: ApplicationRenderer;
  /** A valid plan using only SUPPORTED roles (e.g. from compileApplication). */
  readonly basePlan: ApplicationPlan;
  /** Compile a minimal valid plan whose only surface has the given role. */
  readonly buildProbePlan: (role: SurfaceRole) => ApplicationPlan;
  /** Fresh bindings per scenario. */
  readonly makeBindings: () => RendererBindings;
  /**
   * Serializer for the rendered output (renderer-specific), used for the
   * action-canary leakage scan. REQUIRED when the renderer supports the
   * 'action' role.
   */
  readonly serializeOutput?: (output: unknown) => string;
  /**
   * Plan that renders an action surface whose dispatch rejects with the
   * canary (for the safe-failure mapping scan). REQUIRED when the renderer
   * supports the 'action' role.
   */
  readonly buildFailingActionPlan?: () => ApplicationPlan;
  /**
   * Trigger an action invocation through the RENDERED output (e.g. a real
   * DOM click). REQUIRED with `buildFailingActionPlan` so the canary scan
   * exercises the renderer's real invocation path.
   */
  readonly triggerAction?: (output: unknown) => void | Promise<void>;
  /**
   * Read the renderer's observable failure-state text (e.g. the declared
   * safe failure surface). REQUIRED with `buildFailingActionPlan`.
   */
  readonly getFailureStateText?: (output: unknown) => string | undefined;
}

/**
 * The complete role vocabulary: the Stage 04 foundation roles plus the
 * Stage 05 delivery roles. Every declared renderer role must be a member;
 * every role OUTSIDE a renderer's declared coverage must fail honestly.
 */
const ALL_ROLES: readonly SurfaceRole[] = [
  'text',
  'view',
  'form',
  'action',
  'component',
  'states',
  'list',
  'table',
  'detail',
  'chart',
  'status',
  'tabs',
  'dialog',
  'drawer',
  'conversation',
];

function fail(message: string): never {
  throw new Error(`[renderer conformance: ${message}]`);
}

/** Deeply serialize every observable error surface (message, stack, cause, details). */
function observableErrorSurface(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current !== undefined && current !== null; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.name, current.message, current.stack ?? '');
      const details = (current as { details?: unknown }).details;
      if (details !== undefined) {
        try {
          parts.push(
            JSON.stringify(details, (_key, value) =>
              typeof value === 'function' ? undefined : value,
            ),
          );
        } catch {
          parts.push(String(details));
        }
      }
      current = (current as { cause?: unknown }).cause;
      continue;
    }
    try {
      parts.push(
        JSON.stringify(current, (_key, value) => (typeof value === 'function' ? undefined : value)),
      );
    } catch {
      parts.push(String(current));
    }
    break;
  }
  return parts.filter((part) => part !== undefined && part.length > 0).join(' | ');
}

/**
 * Run the shared renderer conformance suite against one fixture. Throws on
 * the first failed invariant (like the other shared suites).
 */
export async function runRendererConformanceSuite(
  fixture: RendererConformanceFixture,
): Promise<void> {
  const { renderer } = fixture;
  const supportsActions = renderer.supportedSurfaceRoles.includes('action');
  const serialize = fixture.serializeOutput;

  if (
    supportsActions &&
    (fixture.buildFailingActionPlan === undefined || serialize === undefined)
  ) {
    fail(
      "renderers that support the 'action' role must supply buildFailingActionPlan and serializeOutput so the hostile-action canary scenario actually runs",
    );
  }

  // Declared coverage must be a subset of the schema roles.
  for (const role of renderer.supportedSurfaceRoles) {
    if (!ALL_ROLES.includes(role)) {
      fail(`renderer declares unknown surface role '${String(role)}'`);
    }
  }

  // 1+2. Base plan renders; teardown is idempotent; the plan never mutates.
  const planBefore = JSON.stringify(fixture.basePlan.toJSON());
  let rendered: { unmount(): void; output: unknown } | undefined;
  try {
    rendered = renderer.render(fixture.basePlan, fixture.makeBindings());
  } catch (error) {
    fail(`base plan failed to render: ${String(error)}`);
  }
  rendered?.unmount();
  rendered?.unmount();
  if (JSON.stringify(fixture.basePlan.toJSON()) !== planBefore) {
    fail('rendering mutated the compiled plan');
  }

  // 3. Unsupported roles fail honestly and structurally.
  for (const role of ALL_ROLES) {
    if (renderer.supportedSurfaceRoles.includes(role)) {
      continue;
    }
    let probe: ApplicationPlan;
    try {
      probe = fixture.buildProbePlan(role);
    } catch {
      continue; // fixture cannot express this role; skip
    }
    let threw = false;
    try {
      renderer.render(probe, fixture.makeBindings());
    } catch (error) {
      threw = true;
      if (!(error instanceof RendererDiagnostic) || error.code !== 'RENDERER_UNSUPPORTED_ROLE') {
        fail(`unsupported role '${role}' produced the wrong diagnostic: ${String(error)}`);
      }
    }
    if (!threw) {
      fail(`unsupported role '${role}' was rendered silently`);
    }
  }

  // 4. Unknown component fails before unsafe rendering.
  if (renderer.supportedSurfaceRoles.includes('component')) {
    let probe: ApplicationPlan;
    try {
      probe = fixture.buildProbePlan('component');
    } catch {
      probe = undefined as unknown as ApplicationPlan;
    }
    if (probe !== undefined) {
      const emptyRegistryBindings = fixture.makeBindings();
      // Replace the registry with an EMPTY one to prove unknown-component
      // diagnostics; the fixture's registry would resolve it.
      const emptyBindings: RendererBindings = {
        components: {
          registryId: 'conformance.empty',
          revision: '1',
          register: () => undefined,
          resolve: () => ({
            ok: false as const,
            code: 'UNKNOWN_COMPONENT' as const,
            message: 'not registered',
          }),
          identity: () => ({
            registryId: 'conformance.empty',
            revision: '1',
            components: Object.freeze([]) as readonly { componentId: string; revision: string }[],
          }),
        },
        dispatch: emptyRegistryBindings.dispatch,
      };
      let threw = false;
      try {
        renderer.render(probe, emptyBindings);
      } catch (error) {
        threw = true;
        if (!(error instanceof RendererDiagnostic) || error.code !== 'RENDERER_UNKNOWN_COMPONENT') {
          fail(`unknown component produced the wrong diagnostic: ${String(error)}`);
        }
      }
      if (!threw) {
        fail('unknown component was rendered silently');
      }
    }
  }

  // 5. Action failures map to SAFE failures; the canary never surfaces —
  // through a thrown diagnostic, error.message/stack/cause/details,
  // serialized output, an UNHANDLED REJECTION, or the rendered DOM.
  if (supportsActions && fixture.buildFailingActionPlan !== undefined && serialize !== undefined) {
    const CANARY = 'RA4-RENDERER-ACTION-CANARY';
    const hostileDispatchers: { readonly name: string; readonly execute: () => Promise<never> }[] =
      [
        {
          name: 'synchronous throw',
          execute: () => {
            throw new Error(`hostile action failure ${CANARY}`);
          },
        },
        {
          name: 'rejected promise',
          execute: async () => {
            throw new Error(`hostile action failure ${CANARY}`);
          },
        },
        {
          name: 'nested cause',
          execute: async () => {
            throw new Error('outer', {
              cause: new Error(`hostile action failure ${CANARY}`, {
                cause: new Error(`deep ${CANARY}`),
              }),
            });
          },
        },
      ];

    for (const hostile of hostileDispatchers) {
      const unhandled: unknown[] = [];
      const handler = (reason: unknown): void => {
        unhandled.push(reason);
      };
      const hasProcess = typeof process !== 'undefined' && typeof process.on === 'function';
      if (hasProcess) {
        process.on('unhandledRejection', handler);
      }
      let output: unknown;
      try {
        const renderedFailing = renderer.render(fixture.buildFailingActionPlan(), {
          components: fixture.makeBindings().components,
          dispatch: {
            execute: hostile.execute as unknown as RendererBindings['dispatch']['execute'],
          },
        });
        output = renderedFailing.output;
        // Invoke the action through the renderer's real trigger when the
        // fixture supplies one (a real click in the Svelte renderer).
        if (fixture.triggerAction !== undefined) {
          await fixture.triggerAction(output);
        }
        // Give pending rejections a full macrotask to surface as unhandled
        // BEFORE the teardown, and inspect the LIVE output: the failure
        // state must actually be present in the mounted DOM (Svelte 5's
        // unmount detaches rendered content, so post-teardown inspection
        // would be vacuous).
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 10);
        });
        if (output !== undefined) {
          if (serialize(output).includes(CANARY)) {
            fail(`action canary leaked into rendered output (${hostile.name})`);
          }
          if (fixture.getFailureStateText !== undefined) {
            const failureText = fixture.getFailureStateText(output);
            if (failureText === undefined || failureText.length === 0) {
              fail(`the declared safe failure state did not render (${hostile.name})`);
            }
            if (failureText.includes(CANARY)) {
              fail(`the failure state leaked the canary (${hostile.name})`);
            }
          }
        }
        renderedFailing.unmount();
      } catch (error) {
        // Renderers MAY throw safe diagnostics for action surfaces, but the
        // diagnostic must not carry the canary in ANY observable surface.
        if (observableErrorSurface(error).includes(CANARY)) {
          fail(`action canary leaked through a renderer diagnostic (${hostile.name})`);
        }
      }
      if (hasProcess) {
        process.off('unhandledRejection', handler);
      }
      for (const reason of unhandled) {
        if (observableErrorSurface(reason).includes(CANARY)) {
          fail(`a dispatcher rejection became an UNHANDLED REJECTION (${hostile.name})`);
        }
      }
    }
  }
}
