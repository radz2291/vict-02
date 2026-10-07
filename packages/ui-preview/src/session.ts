/**
 * Preview scenario orchestration (API-SPEC §6.2) — `packages/ui-preview`.
 *
 * Isolation rules (frozen):
 * - coverage is DECLARED per operation; a missing required double/handler is
 *   a `SCENARIO_COVERAGE_MISSING` denial — never a real-handler fallback;
 * - reset creates a NEW session identity; in-flight results from a replaced
 *   session are fenced (reported as `SESSION_STALE`, never applied);
 * - seeds/adapter state/doubles/local state reset coherently.
 *
 * The runtime boundary is a PORT: hosts hand the session their effective
 * doubles (registered via the real `runtime.registerDouble` path, snapshotted
 * at session creation). No hidden registries.
 */

import {
  uiDiagnostic,
  type UiDiagnostic,
  type UiScenario,
  type ScenarioActor,
  type ScenarioOperation,
} from '@victframework/ui';
import type {
  ApplicationDataAdapter,
  ApplicationDataRequestContext,
} from '@victframework/application';

/** Host-supplied effective doubles (capability id → bounded invoke). */
export interface PreviewRuntimePort {
  /** Snapshot taken at session creation; immutable within a run. */
  readonly snapshotDoubles: () => ReadonlyMap<string, (input: unknown) => Promise<unknown>>;
}

/**
 * Conforming data-adapter port (API-SPEC §6.2): data operations
 * (`resourceId:op`) dispatch through a conforming ApplicationDataAdapter
 * with the acting scenario actor's context — never a silent stub. When a
 * session declares no port, data operations fall back to the seeded
 * simulated rows (legacy preview behavior).
 */
export interface PreviewDataAdapterPort {
  readonly adapter: ApplicationDataAdapter;
  /** The request context for the acting scenario actor. */
  readonly context: (actor: ScenarioActor) => ApplicationDataRequestContext;
}

export type PreviewResult<T = unknown> =
  | { readonly ok: true; readonly sessionId: string; readonly value: T }
  | {
      readonly ok: false;
      readonly sessionId: string;
      readonly code: string;
      readonly message: string;
      readonly diagnostic?: UiDiagnostic;
    };

export interface CoverageEntry {
  readonly op: string;
  readonly implementation: ScenarioOperation['implementation'];
  readonly available: boolean;
  readonly reason: string;
}

export interface PreviewSessionOptions {
  readonly scenario: UiScenario;
  /** The acting scenario actor (defaults to the first declared actor). */
  readonly actorId?: string;
  readonly runtime?: PreviewRuntimePort;
  /** Conforming data-adapter port for `resourceId:op` operations. */
  readonly dataAdapter?: PreviewDataAdapterPort;
  /** Observable fencing: called when a stale result is dropped. */
  readonly onStale?: (info: { readonly sessionId: string; readonly supersededBy: string }) => void;
  /** Injectable delay (tests pass an immediate/controlled clock). */
  readonly delay?: (ms: number) => Promise<void>;
}

interface SessionState {
  readonly token: symbol;
  readonly rows: Map<string, Readonly<Record<string, unknown>>[]>;
}

let sessionCounter = 0;

/**
 * One preview session. Create via `createPreviewSession`; `reset()` returns
 * a NEW session (new identity + fresh seeds + fresh double snapshot) and
 * fences every in-flight result of the old one.
 */
export class PreviewSession {
  readonly id: string;
  readonly scenario: UiScenario;
  readonly actor: ScenarioActor;
  readonly coverage: readonly CoverageEntry[];
  readonly #runtime: PreviewRuntimePort | undefined;
  readonly #dataAdapter: PreviewDataAdapterPort | undefined;
  readonly #onStale: PreviewSessionOptions['onStale'];
  readonly #delay: (ms: number) => Promise<void>;
  #state: SessionState;
  #stale = false;

  constructor(options: PreviewSessionOptions) {
    sessionCounter += 1;
    this.id = `preview-session-${sessionCounter}`;
    this.scenario = options.scenario;
    this.actor = options.actorId
      ? (options.scenario.actors.find((actor) => actor.actorId === options.actorId) ??
        (options.scenario.actors[0] as ScenarioActor))
      : (options.scenario.actors[0] as ScenarioActor);
    this.#runtime = options.runtime;
    this.#dataAdapter = options.dataAdapter;
    this.#onStale = options.onStale;
    this.#delay =
      options.delay ??
      ((ms) =>
        new Promise((resolve) => {
          setTimeout(resolve, ms);
        }));
    // The session's EFFECTIVE double snapshot is captured ONCE at the
    // creation boundary (immutability): coverage checks and execution use
    // this same map. Registry changes after creation affect only FUTURE
    // sessions (reset()/new createPreviewSession capture a fresh snapshot).
    this.#doubles = new Map(options.runtime?.snapshotDoubles() ?? []);
    this.#state = this.freshState();
    this.coverage = this.computeCoverage();
  }

  /** The effective double snapshot, captured at session creation. */
  readonly #doubles: ReadonlyMap<string, (input: unknown) => Promise<unknown>>;

  /** True when this session's fencing token no longer matches `token`. */
  #superseded(token: symbol): boolean {
    return token !== this.#state.token;
  }

  /** The canonical SESSION_STALE result (fenced by a newer session identity). */
  #staleResult<T>(): PreviewResult<T> {
    this.#onStale?.({ sessionId: this.id, supersededBy: this.id });
    return {
      ok: false,
      sessionId: this.id,
      code: 'SESSION_STALE',
      message: 'The session was reset while this operation was in flight; the result was dropped.',
      diagnostic: uiDiagnostic('SESSION_STALE', 'Result fenced by a newer session.', {
        sessionId: this.id,
        supersededBy: this.id,
      }),
    };
  }

  #freshToken(): symbol {
    return Symbol(this.id);
  }

  private freshState(): SessionState {
    const rows = new Map<string, Readonly<Record<string, unknown>>[]>();
    for (const [resourceId, seeded] of Object.entries(this.scenario.seeds.domain.rows)) {
      rows.set(
        resourceId,
        seeded.map((row) => ({ ...(row as Record<string, unknown>) })),
      );
    }
    return { token: this.#freshToken(), rows };
  }

  private computeCoverage(): CoverageEntry[] {
    return this.scenario.operations.map((operation) => {
      if (operation.implementation === 'unavailable') {
        return {
          op: operation.op,
          implementation: operation.implementation,
          available: false,
          reason: 'declared unavailable',
        };
      }
      const isCapability = !operation.op.includes(':');
      if (isCapability) {
        const registered = this.#doubles.has(operation.op);
        return {
          op: operation.op,
          implementation: operation.implementation,
          available: registered,
          reason: registered ? 'registered double' : 'no registered double',
        };
      }
      // data operations are covered by the seeded simulated adapter
      return {
        op: operation.op,
        implementation: operation.implementation,
        available: true,
        reason: 'simulated adapter',
      };
    });
  }

  /** Diagnostics for every declared-but-unavailable operation. */
  coverageDiagnostics(): readonly UiDiagnostic[] {
    return this.coverage
      .filter((entry) => !entry.available)
      .map((entry) =>
        uiDiagnostic(
          'SCENARIO_COVERAGE_MISSING',
          `Operation '${entry.op}' has no implementation in this scenario.`,
          {
            op: entry.op,
            implementation: 'unavailable',
          },
        ),
      );
  }

  /** True while this session is the current one (not reset). */
  get isLive(): boolean {
    return !this.#stale;
  }

  /** Current fencing token (opaque). */
  get token(): symbol {
    return this.#state.token;
  }

  /** Seeded rows snapshot (read-only view for dependent views). */
  rows(resourceId: string): readonly Readonly<Record<string, unknown>>[] {
    return this.#state.rows.get(resourceId) ?? [];
  }

  /**
   * Run one declared scenario operation. `op` is either a capability id
   * (registered double, per the runtime port) or `resourceId:dataOp` for
   * data operations through the simulated adapter.
   */
  async run<T = unknown>(op: string, input?: unknown): Promise<PreviewResult<T>> {
    const token = this.#state.token;
    const operation = this.scenario.operations.find((candidate) => candidate.op === op);
    if (operation === undefined || operation.implementation === 'unavailable') {
      return {
        ok: false,
        sessionId: this.id,
        code: 'SCENARIO_COVERAGE_MISSING',
        message: `Operation '${op}' is not implemented in this scenario; nothing ran.`,
        diagnostic: uiDiagnostic(
          'SCENARIO_COVERAGE_MISSING',
          `Operation '${op}' has no implementation.`,
          {
            op,
            implementation: 'unavailable',
          },
        ),
      };
    }
    // Actor permission gate (capability ops): an actor may run ops under
    // the same two-segment permission root (qlt.inspection.*), the exact
    // op, or '*'. Denial leaves state unchanged. Data operations
    // (`resource:verb`) are preview-local simulated coverage — their denial
    // coverage is a DECLARED outcome; real permission enforcement lives at
    // the real adapter boundary (U1-05).
    if (!operation.op.includes(':')) {
      const permissionRoot = operation.op;
      const opRoot = permissionRoot.split('.').slice(0, 2).join('.');
      const permitted =
        this.actor.permissions.includes('*') ||
        this.actor.permissions.includes(permissionRoot) ||
        this.actor.permissions.some((permission) => {
          // Scenario ops are short ('inspection.approve'); declared
          // permissions are fully qualified ('qlt.inspection.approve').
          // Match the permission's DOMAIN tail against the op root.
          const segments = permission.split('.');
          const tail = segments.slice(-2).join('.');
          return tail === opRoot || permission === permissionRoot;
        });
      // An actor with an EMPTY permission list is denied everything: the
      // gate applies regardless of list length (MAJOR-1 repair).
      if (!permitted) {
        return {
          ok: false,
          sessionId: this.id,
          code: 'OPERATION_DENIED',
          message: `Actor '${this.actor.actorId}' lacks permission for '${op}'.`,
          diagnostic: uiDiagnostic(
            'OPERATION_DENIED',
            'Permission denied by the preview actor policy.',
            {
              op,
              actor: this.actor.actorId,
              reason: 'missing permission',
            },
          ),
        };
      }
    }

    if (operation.op.includes(':')) {
      return this.#runDataOp<T>(operation, token, input);
    }
    return this.#runCapabilityOp<T>(operation, token, input);
  }

  async #settle<T>(
    token: symbol,
    delayMs: number | undefined,
    produce: () => PreviewResult<T> | Promise<PreviewResult<T>>,
  ): Promise<PreviewResult<T>> {
    if (delayMs !== undefined && delayMs > 0) {
      await this.#delay(delayMs);
    }
    if (token !== this.#state.token) {
      // FENCED: the session was reset while this operation was in flight.
      this.#onStale?.({ sessionId: this.id, supersededBy: this.id });
      return {
        ok: false,
        sessionId: this.id,
        code: 'SESSION_STALE',
        message:
          'The session was reset while this operation was in flight; the result was dropped.',
        diagnostic: uiDiagnostic('SESSION_STALE', 'Result fenced by a newer session.', {
          sessionId: this.id,
          supersededBy: this.id,
        }),
      };
    }
    return produce();
  }

  async #runCapabilityOp<T>(
    operation: ScenarioOperation,
    token: symbol,
    input: unknown,
  ): Promise<PreviewResult<T>> {
    const invoke = this.#doubles.get(operation.op);
    if (invoke === undefined) {
      return {
        ok: false,
        sessionId: this.id,
        code: 'SCENARIO_COVERAGE_MISSING',
        message: `No registered double for capability '${operation.op}'; the real handler was NOT invoked.`,
        diagnostic: uiDiagnostic('SCENARIO_COVERAGE_MISSING', 'Missing required double.', {
          op: operation.op,
          implementation: 'unavailable',
        }),
      };
    }
    return this.#settle<T>(token, operation.outcome?.delayMs, async () => {
      if (operation.outcome?.kind === 'failure') {
        return {
          ok: false,
          sessionId: this.id,
          code: operation.outcome.code ?? 'SIMULATED_FAILURE',
          message:
            operation.outcome.message ?? 'The simulated operation failed (declared outcome).',
        };
      }
      if (operation.outcome?.kind === 'denied') {
        return {
          ok: false,
          sessionId: this.id,
          code: 'OPERATION_DENIED',
          message: operation.outcome.message ?? 'The simulated operation was denied.',
          diagnostic: uiDiagnostic('OPERATION_DENIED', 'Denied by declared scenario outcome.', {
            op: operation.op,
            actor: this.actor.actorId,
            reason: operation.outcome.code ?? 'declared',
          }),
        };
      }
      try {
        // A rejecting async double is a FAILED simulation (MINOR-2 repair):
        // never reported as success with an unawaited rejected promise.
        const raw = await invoke(input);
        // Post-await fencing: the session may have been reset WHILE the
        // double was executing. A superseded operation settles as
        // SESSION_STALE — its result never reaches the current session's
        // state, feedback or domain projection.
        if (this.#superseded(token)) return this.#staleResult<T>();
        return { ok: true, sessionId: this.id, value: raw as T };
      } catch (error) {
        if (this.#superseded(token)) return this.#staleResult<T>();
        return {
          ok: false,
          sessionId: this.id,
          code: 'SIMULATED_FAILURE',
          message: `The simulated double rejected: ${String(error instanceof Error ? error.message : error)}`,
        };
      }
    });
  }

  async #runDataOp<T>(
    operation: ScenarioOperation,
    token: symbol,
    input: unknown,
  ): Promise<PreviewResult<T>> {
    const [resourceId, dataOp] = operation.op.split(':') as [string, string];
    // Declared failure/denied outcomes short-circuit BEFORE any adapter call
    // (the declared outcome IS the simulation contract; nothing else runs).
    const outcome = operation.outcome;
    if (outcome?.kind === 'failure' || outcome?.kind === 'denied') {
      return this.#settle<T>(token, outcome.delayMs, () => {
        if (outcome.kind === 'denied') {
          return {
            ok: false,
            sessionId: this.id,
            code: 'OPERATION_DENIED',
            message: outcome.message ?? 'Denied.',
            diagnostic: uiDiagnostic('OPERATION_DENIED', 'Denied by declared scenario outcome.', {
              op: operation.op,
              actor: this.actor.actorId,
              reason: outcome.code ?? 'declared',
            }),
          };
        }
        return {
          ok: false,
          sessionId: this.id,
          code: outcome.code ?? 'SIMULATED_FAILURE',
          message: outcome.message ?? 'The simulated data operation failed (declared outcome).',
        };
      });
    }
    const port = this.#dataAdapter;
    if (port !== undefined) {
      // Frozen boundary: data operations dispatch through the conforming
      // adapter with the acting actor's context. The delay (if declared)
      // still applies, and a reset during the call fences the result.
      return this.#settle<T>(token, outcome?.delayMs, async () => {
        const context = port.context(this.actor);
        let result: Awaited<ReturnType<ApplicationDataAdapter['query']>>;
        if (dataOp === 'list' || dataOp === 'get') {
          result = await port.adapter.query(
            dataOp === 'list'
              ? { op: 'list', resourceId }
              : { op: 'get', resourceId, id: (input as { id?: string } | undefined)?.id },
            context,
          );
        } else {
          const payload = (input ?? {}) as {
            readonly id?: string;
            readonly input?: Record<string, unknown>;
            readonly idempotencyKey?: string;
          };
          result = await port.adapter.mutate(
            {
              resourceId,
              op: dataOp,
              id: payload.id,
              input: payload.input ?? input,
              idempotencyKey: payload.idempotencyKey,
            },
            context,
          );
        }
        // Post-await fencing: a reset during the adapter call drops the result.
        if (this.#superseded(token)) return this.#staleResult<T>();
        if (!result.ok) {
          return {
            ok: false,
            sessionId: this.id,
            code: result.code,
            message: result.message,
          };
        }
        if (result.row !== undefined)
          return { ok: true, sessionId: this.id, value: result.row as T };
        if (result.rows !== undefined)
          return { ok: true, sessionId: this.id, value: { rows: result.rows } as T };
        return { ok: true, sessionId: this.id, value: result as T };
      });
    }
    return this.#settle<T>(token, operation.outcome?.delayMs, () => {
      if (outcome?.kind === 'failure') {
        return {
          ok: false,
          sessionId: this.id,
          code: outcome.code ?? 'SIMULATED_FAILURE',
          message: outcome.message ?? 'The simulated data operation failed (declared outcome).',
        };
      }
      if (outcome?.kind === 'denied') {
        return {
          ok: false,
          sessionId: this.id,
          code: 'OPERATION_DENIED',
          message: outcome.message ?? 'Denied.',
          diagnostic: uiDiagnostic('OPERATION_DENIED', 'Denied by declared scenario outcome.', {
            op: operation.op,
            actor: this.actor.actorId,
            reason: outcome.code ?? 'declared',
          }),
        };
      }
      const rows = this.#state.rows.get(resourceId) ?? [];
      if (dataOp === 'list') {
        return { ok: true, sessionId: this.id, value: { rows } as T };
      }
      if (dataOp === 'get') {
        const id = (input as { id?: string } | undefined)?.id;
        const row = rows.find((candidate) => candidate['id'] === id);
        if (row === undefined) {
          return {
            ok: false,
            sessionId: this.id,
            code: 'DATA_UNKNOWN_IDENTITY',
            message: `No '${resourceId}' row '${String(id)}'.`,
          };
        }
        return { ok: true, sessionId: this.id, value: { row } as T };
      }
      if (dataOp === 'mutate') {
        return this.mutateRow<T>(resourceId, operation, input);
      }
      return {
        ok: false,
        sessionId: this.id,
        code: 'DATA_UNSUPPORTED_QUERY',
        message: `Unsupported data op '${dataOp}'.`,
      };
    });
  }

  private mutateRow<T>(
    resourceId: string,
    operation: ScenarioOperation,
    input: unknown,
  ): PreviewResult<T> {
    const rows: readonly Readonly<Record<string, unknown>>[] =
      this.#state.rows.get(resourceId) ?? [];
    const payload = (input ?? {}) as {
      readonly id?: string;
      readonly input?: Record<string, unknown>;
      readonly expectedDomainRevision?: number;
    };
    const index = rows.findIndex((candidate) => candidate['id'] === payload.id);
    if (index === -1) {
      return {
        ok: false,
        sessionId: this.id,
        code: 'DATA_UNKNOWN_IDENTITY',
        message: `No '${resourceId}' row '${String(payload.id)}'.`,
      };
    }
    const current = rows[index] as Record<string, unknown>;
    // Optimistic concurrency on decisions (frozen domain rule).
    if (
      payload.expectedDomainRevision !== undefined &&
      current['domainRevision'] !== payload.expectedDomainRevision
    ) {
      return {
        ok: false,
        sessionId: this.id,
        code: 'DOMAIN_CONFLICT',
        message: `Domain revision moved (expected ${String(payload.expectedDomainRevision)}, actual ${String(current['domainRevision'])}); state unchanged.`,
        diagnostic: uiDiagnostic('DOMAIN_CONFLICT', 'Stale decision.', {
          op: operation.op,
          expectedDomainRevision: payload.expectedDomainRevision,
          actualDomainRevision: current['domainRevision'],
        }),
      };
    }
    const next: Record<string, unknown> = {
      ...current,
      ...(payload.input ?? {}),
      domainRevision: Number(current['domainRevision'] ?? 0) + 1,
    };
    const updated = [...rows];
    updated[index] = next;
    this.#state.rows.set(resourceId, updated);
    return { ok: true, sessionId: this.id, value: { row: next } as T };
  }

  /**
   * Reset: a NEW session identity with fresh seeds and a fresh double
   * snapshot; every in-flight operation of THIS session becomes stale.
   */
  reset(): PreviewSession {
    this.#stale = true;
    // Rotate the fencing token + discard seed state: every in-flight
    // operation of THIS session now compares against the NEW token and is
    // fenced as SESSION_STALE when it settles.
    this.#state = this.freshState();
    const next = new PreviewSession({
      scenario: this.scenario,
      actorId: this.actor.actorId,
      ...(this.#runtime !== undefined ? { runtime: this.#runtime } : {}),
      // The data-adapter port carries over: the reset session dispatches
      // through the SAME declared boundary (new identity, same port).
      ...(this.#dataAdapter !== undefined ? { dataAdapter: this.#dataAdapter } : {}),
      ...(this.#onStale !== undefined ? { onStale: this.#onStale } : {}),
      ...(this.#delay !== undefined ? { delay: this.#delay } : {}),
    });
    return next;
  }
}

/** Create one preview session (the supported entry). */
export function createPreviewSession(options: PreviewSessionOptions): PreviewSession {
  return new PreviewSession(options);
}
