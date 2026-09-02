import type { ComponentReference, SurfaceRole } from '@vict/sdk';
import type { ApplicationPlan } from './compile.js';

/**
 * Framework-neutral renderer contract (Stage 04).
 *
 * A renderer consumes an IMMUTABLE Application Plan plus explicitly supplied
 * bindings (component registry, action dispatcher, application-data
 * adapter). It never mutates the plan, never consults a live registry
 * during render, never enforces authorization itself (visibility and
 * disabled state are presentation only), and fails with STRUCTURED
 * diagnostics instead of silently omitting unsupported surface roles,
 * unknown components, or unknown references.
 */

/** Structured renderer diagnostics. */
export type RendererDiagnosticCode =
  | 'RENDERER_UNSUPPORTED_ROLE'
  | 'RENDERER_UNKNOWN_COMPONENT'
  | 'RENDERER_COMPONENT_RESOLUTION_FAILED'
  | 'RENDERER_UNKNOWN_REFERENCE'
  | 'RENDERER_INVALID_PLAN'
  | 'RENDERER_UNSUPPORTED_PRESENTATION';

export class RendererDiagnostic extends Error {
  readonly code: RendererDiagnosticCode;
  readonly details?: Record<string, unknown>;

  constructor(code: RendererDiagnosticCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'RendererDiagnostic';
    this.code = code;
    this.details = details;
  }
}

/** Action execution result. Errors are SAFE structured values, never raw echoes. */
export type ActionResult<T = unknown> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly message: string };

/**
 * Executes application actions BELOW the renderer boundary. The renderer
 * treats this as the ONLY way an action runs; it never performs effectful
 * work itself and never treats visibility/disabled state as authorization.
 */
export interface ActionDispatcher {
  execute(actionId: string, input?: unknown): Promise<ActionResult>;
}

/** The explicitly supplied renderer bindings. */
export interface RendererBindings {
  readonly components: ComponentRegistry;
  readonly dispatch: ActionDispatcher;
}

/** A mounted (or otherwise produced) application surface. */
export interface RenderedApplication {
  /** Framework-chosen render result (e.g. a component instance). */
  readonly output: unknown;
  /** Idempotent teardown. */
  unmount(): void;
}

/**
 * A conforming renderer: id + revision participate in release identity;
 * supported roles are DECLARED and verified by conformance fixtures.
 */
export interface ApplicationRenderer {
  readonly id: string;
  readonly revision: string;
  /** The surface roles this renderer implements. */
  readonly supportedSurfaceRoles: readonly SurfaceRole[];
  render(plan: ApplicationPlan, bindings: RendererBindings): RenderedApplication;
}

/* ------------------------------------------------------------------ */
/* Versioned component registry                                        */
/* ------------------------------------------------------------------ */

export interface ComponentRegistration {
  readonly componentId: string;
  readonly revision: string;
  /** Trusted local implementation (e.g. a Svelte component). Never serialized. */
  readonly implementation: unknown;
}

/** Structured component-resolution outcome. */
export type ComponentResolution =
  | { readonly ok: true; readonly implementation: unknown }
  | {
      readonly ok: false;
      readonly code: 'UNKNOWN_COMPONENT' | 'COMPONENT_REVISION_MISMATCH';
      readonly message: string;
    };

/**
 * A versioned component registry: trusted local code registered OUTSIDE
 * the serializable definition, resolved by exact id/revision.
 */
export interface ComponentRegistry {
  readonly registryId: string;
  readonly revision: string;
  register(entry: ComponentRegistration): void;
  resolve(reference: ComponentReference): ComponentResolution;
  /** Frozen registry identity for release manifests. */
  identity(): {
    readonly registryId: string;
    readonly revision: string;
    readonly components: readonly ComponentReference[];
  };
}

export function createComponentRegistry(registryId: string, revision: string): ComponentRegistry {
  const entries = new Map<string, unknown>();
  return {
    registryId,
    revision,
    register(entry: ComponentRegistration): void {
      if (typeof entry.componentId !== 'string' || entry.componentId.length === 0) {
        throw new RendererDiagnostic('RENDERER_INVALID_PLAN', 'Component id must be non-empty.');
      }
      if (typeof entry.revision !== 'string' || entry.revision.length === 0) {
        throw new RendererDiagnostic(
          'RENDERER_INVALID_PLAN',
          `Component '${entry.componentId}' must declare a revision.`,
        );
      }
      const key = `${entry.componentId}@${entry.revision}`;
      if (entries.has(key)) {
        throw new RendererDiagnostic(
          'RENDERER_INVALID_PLAN',
          `Component '${key}' is already registered.`,
        );
      }
      entries.set(key, entry.implementation);
    },
    resolve(reference: ComponentReference): ComponentResolution {
      const key = `${reference.componentId}@${reference.revision}`;
      const exact = entries.get(key);
      if (exact !== undefined) {
        return { ok: true, implementation: exact };
      }
      const anyRevision = [...entries.keys()].find((candidate) =>
        candidate.startsWith(`${reference.componentId}@`),
      );
      if (anyRevision !== undefined) {
        return {
          ok: false,
          code: 'COMPONENT_REVISION_MISMATCH',
          message: `Component '${reference.componentId}' is registered at '${anyRevision.split('@')[1]}', not at declared revision '${reference.revision}'.`,
        };
      }
      return {
        ok: false,
        code: 'UNKNOWN_COMPONENT',
        message: `Component '${reference.componentId}' is not registered.`,
      };
    },
    identity() {
      return {
        registryId,
        revision,
        components: Object.freeze(
          [...entries.keys()]
            .map((key) => {
              const [componentId, componentRevision] = key.split('@');
              return { componentId: componentId ?? '', revision: componentRevision ?? '' };
            })
            .sort(
              (a, b) =>
                (a.componentId < b.componentId ? -1 : a.componentId > b.componentId ? 1 : 0) ||
                (a.revision < b.revision ? -1 : a.revision > b.revision ? 1 : 0),
            ),
        ),
      };
    },
  };
}
