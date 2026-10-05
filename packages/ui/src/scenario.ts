/**
 * `vict.ui-scenario@1` — preview scenario protocol types (API-SPEC §6.2).
 * Orchestration and fencing live in `packages/ui-preview`; these are the
 * neutral protocol shapes every participant speaks.
 */

import type { UiPrimitiveType } from './document.js';

export type ScenarioImplementation = 'simulated' | 'local' | 'external' | 'unavailable';

export interface SeedSpec {
  /** Resource id → seeded rows (deterministic order as authored). */
  readonly rows: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  /** Deterministic seed for any randomized behavior (reserved). */
  readonly random?: string;
}

export interface ClockPolicy {
  /** Deterministic start ISO timestamp (reserved; U1 uses real time). */
  readonly startAt?: string;
}

export interface ScenarioActor {
  readonly actorId: string;
  readonly role: string;
  readonly permissions: readonly string[];
}

/** Declared outcome of one simulated operation. */
export interface OutcomeSpec {
  /** Settled outcome kind. */
  readonly kind: 'rows' | 'row' | 'success' | 'failure' | 'denied' | 'conflict';
  /** Rows returned for read outcomes. */
  readonly rows?: readonly Readonly<Record<string, unknown>>[];
  /** Row returned for a get outcome. */
  readonly row?: Readonly<Record<string, unknown>>;
  /** Structured error code for failure/denied/conflict outcomes. */
  readonly code?: string;
  readonly message?: string;
  /** Configured simulated latency (ms) before the outcome settles. */
  readonly delayMs?: number;
}

export interface ScenarioOperation {
  /** Capability id (capability operations) or `resourceId:op` (data operations). */
  readonly op: string;
  readonly implementation: ScenarioImplementation;
  readonly outcome?: OutcomeSpec;
}

export interface UiScenario {
  readonly schema: 'vict.ui-scenario@1';
  readonly scenarioId: string;
  readonly references: {
    readonly application: { readonly id: string; readonly revision: string };
    readonly documents: Readonly<Record<string, string>>;
  };
  readonly seeds: { readonly domain: SeedSpec; readonly random?: SeedSpec; readonly clock?: ClockPolicy };
  readonly actors: readonly ScenarioActor[];
  readonly operations: readonly ScenarioOperation[];
  /** Reset creates a NEW session identity (frozen fencing rule). */
  readonly resetBoundary: 'session';
}

/** Typed actor-facing state declaration helper (scenario local state). */
export interface ScenarioStateDecl {
  readonly key: string;
  readonly type: UiPrimitiveType;
  readonly initial: string | number | boolean;
}

/** Guard: the minimal structural shape a scenario must satisfy. */
export function isUiScenario(value: unknown): value is UiScenario {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { schema?: unknown }).schema === 'vict.ui-scenario@1' &&
    typeof (value as { scenarioId?: unknown }).scenarioId === 'string' &&
    Array.isArray((value as { operations?: unknown }).operations)
  );
}
