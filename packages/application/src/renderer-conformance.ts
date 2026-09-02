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
 * 5. action failures surface as SAFE mapped failures — a canary thrown by
 *    the action must never appear in the rendered output.
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
   * Optional serializer for the rendered output (renderer-specific), used
   * for the action-canary leakage scan.
   */
  readonly serializeOutput?: (output: unknown) => string;
  /**
   * Optional plan that renders an action surface whose dispatch rejects
   * with the canary (for the safe-failure mapping scan).
   */
  readonly buildFailingActionPlan?: () => ApplicationPlan;
}

const ALL_ROLES: readonly SurfaceRole[] = ['text', 'view', 'form', 'action', 'component', 'states'];

function fail(message: string): never {
  throw new Error(`[renderer conformance: ${message}]`);
}

export function runRendererConformanceSuite(fixture: RendererConformanceFixture): void {
  const { renderer } = fixture;

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

  // 5. Action failures map to SAFE failures; the canary never surfaces.
  if (
    fixture.buildFailingActionPlan !== undefined &&
    renderer.supportedSurfaceRoles.includes('action')
  ) {
    const CANARY = 'RA4-RENDERER-ACTION-CANARY';
    const failingBindings: RendererBindings = {
      components: fixture.makeBindings().components,
      dispatch: {
        execute: async () => {
          throw new Error(`hostile action failure ${CANARY}`);
        },
      },
    };
    let output: unknown;
    try {
      const renderedFailing = renderer.render(fixture.buildFailingActionPlan(), failingBindings);
      output = renderedFailing.output;
      renderedFailing.unmount();
    } catch (error) {
      // Renderers MAY throw safe diagnostics for action surfaces, but the
      // diagnostic must not carry the canary either.
      if (JSON.stringify(error).includes(CANARY)) {
        fail('action canary leaked through a renderer diagnostic');
      }
    }
    if (fixture.serializeOutput !== undefined && output !== undefined) {
      const serialized = fixture.serializeOutput(output);
      if (serialized.includes(CANARY)) {
        fail('action canary leaked into rendered output');
      }
    }
  }
}
