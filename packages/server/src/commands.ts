import { createHash } from 'node:crypto';
import type {
  ActivationCatalog,
  AgentControlStores,
  CommandConfirmationReceipt,
  ControlAuditEvent,
  DurableWaitState,
  ExecutionStore,
  RunQuery,
  StoredActivation,
  StoredEvent,
  StoredRun,
  StoredRunStatus,
  CommandConfirmationReceiptStore,
} from '@victframework/runtime';
import {
  COMMAND_IDEMPOTENCY_KEY_PATTERN,
  toCanonicalJson,
  VictControlError,
  VictStoreError,
  VICT_IDEMPOTENCY_FENCE_CONFLICT,
  commandIdempotencyFenceToken,
  type CommandIdempotencyReceipt,
} from '@victframework/runtime';
import type { ServerActorContext } from './auth.js';

/**
 * Stage 06B — the transport-free, versioned command service (API-002).
 *
 * The HTTP transport and the CLI consume the SAME typed dispatcher; no
 * caller bypasses governance. Properties enforced HERE (below the
 * transport, fail closed):
 *
 * - ONE command registry: authorization scope, closed payload field set,
 *   and the mutation/idempotency policy are declared TOGETHER per command,
 *   so the command list, the scope matrix, and the mutation list cannot
 *   silently diverge;
 * - AUTHORIZATION MATRIX: every command's required scope is asserted from
 *   the closed scope vocabulary BEFORE any store access;
 * - CLOSED PAYLOAD SCHEMAS: unknown fields and non-object payloads are
 *   rejected (never silently converted to `{}`); payloads are canonicalized
 *   ONCE into plain data (own enumerable properties only — accessors,
 *   proxies that throw, and enumeration traps fail with a stable,
 *   non-echoing error) and that SAME canonical form is used for the
 *   request digest and for execution;
 * - DURABLE COMMAND IDEMPOTENCY: every state-changing command requires a
 *   bounded `Idempotency-Key`; receipts are NAMESPACED by (authenticated
 *   actor, command, key) and bind the canonical request digest. A pending
 *   receipt carries a durable LEASE (owner + expiry): concurrent
 *   duplicates answer `IN_PROGRESS`, a crashed claim's expired lease is
 *   taken over on retry (fenced re-execution through the domain's own
 *   idempotency), deterministic failures settle `failed` and replay, and
 *   retryable infrastructure failures RELEASE the claim instead of being
 *   permanently confused with command failure;
 * - SAFE RECEIPT RETENTION: receipts store a per-command SAFE replay
 *   projection (stable codes, identifiers, content references) — never the
 *   full command response, rationale, application rows, model content, or
 *   tool data. An authorized replay result is reconstructed from its
 *   authoritative domain when necessary;
 * - CONTROLLED RECOVERY FENCE (Stage 9 G2): the four migrated mutations
 *   (`run.cancel`, `activation.select`, `release.select`,
 *   `release.rollback`) and the new `run.resolve` / `run.signal`
 *   interventions require a server-issued confirmation receipt; the legacy
 *   unconfirmed shape is rejected (`VICT_CONFIRMATION_REQUIRED`) for EVERY
 *   actor class including administrator — the all-scopes policy grants
 *   authority, never bypass. Checks follow the frozen Phase 1–4 order:
 *   settled idempotency replay first (digest of the COMPLETE confirmation
 *   request), then the non-echoing receipt chain, then durable fenced
 *   claims on BOTH stores, then execution under the domain idempotency
 *   fence and fenced settlement of BOTH stores.
 * - stable, structured, non-echoing errors.
 */

/** The versioned command envelope marker. */
export const VICT_COMMAND_SCHEMA = 'vict.command@1';

/** Closed command names (version 1). */
export const VICT_COMMANDS = [
  'health.inspect',
  'compatibility.inspect',
  'actor.whoami',
  'changeset.propose',
  'changeset.revise',
  'changeset.execute-check',
  'changeset.attach-evidence',
  'changeset.decide',
  'changeset.commit',
  'changeset.get',
  'changeset.list',
  'release.publish',
  'release.select',
  'release.rollback',
  'release.get-selected',
  'release.list',
  'release.selections',
  'activation.select',
  'activation.list',
  'activation.get',
  'activation.selected',
  'run.cancel',
  'run.resolve',
  'run.signal',
  'run.list',
  'run.get',
  'run.events',
  'run.waits',
  'run.detail',
  'agent.turn.start',
  'agent.turn.cancel',
  'agent.turn.get',
  'agent.tool.approve',
  'agent.tool.decline',
  'stream.inspect',
  'app.data.query',
  'app.data.mutate',
  'app.data.action',
  'audit.search',
] as const;
export type VictCommandName = (typeof VICT_COMMANDS)[number];

/**
 * The ONE command registry: every command declares its required scope
 * (closed vocabulary; `*` = authenticated any), its exact payload field
 * set, and whether it MUTATES durable state (creates runs, audits,
 * receipts, approvals, effects, or mutations) and is therefore governed by
 * durable idempotency. Default policy remains denial: a command absent
 * from this table does not exist.
 */
interface CommandSpec {
  readonly scope: string;
  readonly fields: readonly string[];
  readonly mutation: boolean;
}

const COMMAND_REGISTRY: Readonly<Record<VictCommandName, CommandSpec>> = {
  'health.inspect': { scope: '*', fields: [], mutation: false },
  'compatibility.inspect': { scope: '*', fields: [], mutation: false },
  'actor.whoami': { scope: '*', fields: [], mutation: false },
  'changeset.propose': {
    scope: 'changeset.propose',
    fields: [
      'changesetId',
      'base',
      'operations',
      'rationale',
      'riskClass',
      'requiredApproverCount',
      'expiresAt',
    ],
    mutation: true,
  },
  'changeset.revise': {
    scope: 'changeset.revise',
    fields: [
      'changesetId',
      'operations',
      'rationale',
      'riskClass',
      'requiredApproverCount',
      'expiresAt',
    ],
    mutation: true,
  },
  // Creates a durable control run: mutation-governed.
  'changeset.execute-check': {
    scope: 'changeset.propose',
    fields: ['changesetId', 'kind'],
    mutation: true,
  },
  'changeset.attach-evidence': {
    scope: 'changeset.propose',
    fields: ['changesetId', 'kind', 'runId'],
    mutation: true,
  },
  'changeset.decide': {
    scope: 'changeset.approve',
    fields: ['changesetId', 'decision', 'reason'],
    mutation: true,
  },
  'changeset.commit': { scope: 'changeset.commit', fields: ['changesetId'], mutation: true },
  'changeset.get': { scope: 'changeset.read', fields: ['changesetId'], mutation: false },
  'changeset.list': { scope: 'changeset.read', fields: [], mutation: false },
  'release.publish': {
    scope: 'release.publish',
    fields: [
      'releaseVersion',
      'applicationId',
      'applicationVersion',
      'rendererIdentity',
      'componentRegistryIdentity',
      'dataAdapterIdentity',
      'activationBinding',
    ],
    mutation: true,
  },
  'release.select': {
    scope: 'release.select',
    fields: ['applicationId', 'releaseVersion', 'confirmation'],
    mutation: true,
  },
  'release.rollback': {
    scope: 'release.select',
    fields: ['applicationId', 'targetReleaseVersion', 'confirmation'],
    mutation: true,
  },
  'release.get-selected': { scope: 'release.read', fields: ['applicationId'], mutation: false },
  'release.list': { scope: 'release.read', fields: ['applicationId'], mutation: false },
  'release.selections': { scope: 'release.read', fields: ['applicationId'], mutation: false },
  'activation.list': {
    scope: 'activation.read',
    fields: ['graphId', 'limit'],
    mutation: false,
  },
  'activation.get': {
    scope: 'activation.read',
    fields: ['activationVersion'],
    mutation: false,
  },
  'activation.selected': { scope: 'activation.read', fields: ['graphId'], mutation: false },
  'run.list': {
    scope: 'run.read',
    fields: ['status', 'graphId', 'activationVersion', 'limit', 'offset'],
    mutation: false,
  },
  'run.get': { scope: 'run.read', fields: ['runId'], mutation: false },
  'run.events': { scope: 'run.read', fields: ['runId', 'afterSeq', 'limit'], mutation: false },
  'run.waits': { scope: 'run.read', fields: ['runId'], mutation: false },
  // PROTECTED DETAIL (Stage 9 D-5): DISTINCT scope, retention check, and
  // per-access audit. Never inferred from `run.read`; no default role holds
  // this scope — it is reached only through explicit deployment grants
  // (or the administrator all-scopes policy).
  'run.detail': { scope: 'run.detail', fields: ['runId'], mutation: false },
  'audit.search': {
    scope: 'audit.read',
    fields: ['subjectType', 'subjectId', 'limit'],
    mutation: false,
  },
  'activation.select': {
    scope: 'activation.select',
    fields: ['graphId', 'activationVersion', 'confirmation'],
    mutation: true,
  },
  'run.cancel': { scope: 'run.cancel', fields: ['runId', 'reasonCode', 'confirmation'], mutation: true },
  'run.resolve': { scope: 'run.resolve', fields: ['runId', 'resolution', 'confirmation'], mutation: true },
  'run.signal': { scope: 'run.signal', fields: ['runId', 'signalName', 'confirmation'], mutation: true },
  'agent.turn.start': {
    scope: 'agent.turn.start',
    fields: ['threadId', 'input', 'applicationReleaseVersion'],
    mutation: true,
  },
  'agent.turn.cancel': {
    scope: 'agent.turn.cancel',
    fields: ['turnId', 'reasonCode'],
    mutation: true,
  },
  'agent.turn.get': { scope: 'run.read', fields: ['turnId'], mutation: false },
  'agent.tool.approve': {
    scope: 'agent.tool.approve',
    fields: ['approvalId', 'reason', 'decision'],
    mutation: true,
  },
  'agent.tool.decline': {
    scope: 'agent.tool.decline',
    fields: ['approvalId', 'reason', 'decision'],
    mutation: true,
  },
  'stream.inspect': { scope: 'agent.stream.read', fields: ['streamId'], mutation: false },
  'app.data.query': {
    scope: 'app.data.read',
    fields: ['resourceId', 'releaseVersion', 'filters'],
    mutation: false,
  },
  'app.data.mutate': {
    scope: 'app.data.write',
    // Stage 07C Phase F (F-8 correction): the closed payload field set gains
    // the OPTIONAL compiled-plan action identity (`actionId`,
    // `expectedActionRevision`) and the closed mutation envelope (`mutation`)
    // that carries the declared mutation request (op/id/input/idempotencyKey)
    // across the governed boundary. The legacy identity-only shape (payload
    // without `mutation`) is unchanged. Unknown fields at either level still
    // fail closed below (`#assertPayloadFields` and the envelope capture in
    // `app-remote.ts`).
    fields: [
      'resourceId',
      'releaseVersion',
      'expectedRevision',
      'actionKind',
      'actionId',
      'expectedActionRevision',
      'mutation',
    ],
    mutation: true,
  },
  'app.data.action': {
    scope: 'app.data.write',
    fields: [
      'resourceId',
      'releaseVersion',
      'expectedRevision',
      'actionKind',
      'actionId',
      'expectedActionRevision',
      'mutation',
    ],
    mutation: true,
  },
};

/**
 * True when the command mutates durable state (idempotency-governed).
 * Derived from the ONE registry — the mutation policy can never silently
 * diverge from the command list.
 */
export function isMutationCommand(command: string): boolean {
  const spec = (COMMAND_REGISTRY as Record<string, CommandSpec | undefined>)[command];
  return spec?.mutation === true;
}

// ---- Stage 9 G2 — the confirmation boundary (constants) ---------------------

/**
 * The receipt-gated commands (frozen G2 contract): the four migrated
 * mutations with their names/fields/scopes UNCHANGED (additively gaining
 * the REQUIRED `confirmation` payload member) and the two new intervention
 * commands that are receipt-gated from day one.
 */
export type ConfirmationGatedCommand =
  | 'run.cancel'
  | 'release.select'
  | 'release.rollback'
  | 'activation.select'
  | 'run.resolve'
  | 'run.signal';

export const CONFIRMATION_REQUIRED_COMMANDS: ReadonlySet<string> = new Set<ConfirmationGatedCommand>([
  'run.cancel',
  'release.select',
  'release.rollback',
  'activation.select',
  'run.resolve',
  'run.signal',
]);

/** Closed `run.resolve` resolution vocabulary (pinned proposal §4.2). */
export const RUN_RESOLUTIONS = ['retry', 'confirm_applied', 'fail', 'cancel'] as const;
export type RunResolution = (typeof RUN_RESOLUTIONS)[number];

/** The internal prepare idempotency namespace command. */
export function confirmationPrepareCommand(command: string): string {
  return `confirmation.prepare:${command}`;
}

/** The pinned replacement budget: FIVE replacement receipts per (actor,
 * command, key). Beyond it, a same-key same-digest prepare replays the
 * latest receipt's truthful status — NEVER an idempotency conflict. */
export const CONFIRMATION_REPLACEMENT_BUDGET = 5;

/** The accepted prepare-TTL default (D-OPEN-1): 10 minutes. */
export const DEFAULT_CONFIRMATION_TTL_MS = 600_000;

/**
 * The internal executor port binding the runtime's EXISTING blocked-run
 * resolution path (`resolveBlocked` orchestration mechanics). No arbitrary
 * timer-fire command is invented; the receipt-gated `run.resolve` command
 * drives this composition port.
 */
export interface RunResolutionPort {
  resolveBlocked(input: {
    runId: string;
    resolution: RunResolution;
    actorId: string;
    requestId: string;
  }): Promise<unknown>;
}

/**
 * The composition port binding the EXISTING durable-signal driver: the
 * receipt-gated `run.signal` command delivers a named signal to one run's
 * durable wait through this port (identity fields only).
 */
export interface RunSignalPort {
  signalWait(input: { runId: string; signalName: string; signalId: string }): Promise<unknown>;
}

/** A closed, versioned command request. */
export interface VictCommandRequest {
  readonly command: VictCommandName;
  /** Bounded, command-specific payload (validated per command below). */
  readonly payload: Record<string, unknown>;
  /**
   * Durable mutation idempotency key (REQUIRED for state-changing
   * commands; validated against the closed bounded format).
   */
  readonly idempotencyKey?: string;
}

/** A safe command result. */
export interface VictCommandResult {
  readonly ok: true;
  readonly data: Record<string, unknown>;
}

/** A structured command error (safe, non-echoing). */
export interface VictCommandError {
  readonly ok: false;
  readonly code: string;
}

export type VictCommandOutcome = VictCommandResult | VictCommandError;

export interface VictCommandServiceOptions {
  readonly stores: AgentControlStores;
  /** The composed control-plane service (ChangeSets/releases/audit). */
  readonly controlPlane: ControlPlanePort;
  /** The composed agent-turn service (optional in governance-only deployments). */
  readonly turnService?: TurnServiceLike;
  readonly clock?: () => number;
  /** The remote Application data/action boundary. */
  readonly appData?: AppDataPort;
  /**
   * Stage 9 operator reads (WP-1): the durable execution store for safe
   * run/event reads. Optional for backward compatibility; the run.* read
   * commands fail closed with a stable code when it is absent.
   */
  readonly execution?: ExecutionStore;
  /**
   * Stage 9 operator reads: the bounded orchestration port for wait
   * diagnosis (safe descriptors only; never checkpoint payloads).
   */
  readonly orchestration?: {
    listWaits(runId: string): Promise<readonly DurableWaitState[]>;
  };
  /**
   * Stage 9 operator reads: the activation catalog for graph/activation
   * identity and content inspection.
   */
  readonly catalog?: ActivationCatalog;
  /**
   * Durable lease duration for pending idempotency claims (default
   * 60_000 ms). A crashed claimer's lease expires and the key becomes
   * recoverable.
   */
  readonly idempotencyLeaseMs?: number;
  /** The lease owner token (defaults to a per-service instance token). */
  readonly idempotencyOwner?: string;
  /**
   * Stage 9 G2: the prepare-TTL (accepted default 10 minutes = 600_000 ms).
   * A prepared-but-unconsumed receipt expires truthfully after this time.
   */
  readonly confirmationTtlMs?: number;
  /**
   * Stage 9 G2: the internal blocked-run resolution executor (the EXISTING
   * runtime `resolveBlocked` path). The `run.resolve` command fails closed
   * with a stable code when it is not composed.
   */
  readonly runResolution?: RunResolutionPort;
  /**
   * Stage 9 G2: the internal durable-signal driver (the EXISTING signal
   * delivery path). The `run.signal` command fails closed with a stable
   * code when it is not composed.
   */
  readonly runSignals?: RunSignalPort;
}

/** The subset of AgentTurnService the dispatcher uses. */
export interface TurnServicePort {
  startTurn(
    actor: ServerActorContext,
    input: { threadId: string; input: string },
  ): Promise<unknown>;
  cancelTurn(
    actor: ServerActorContext,
    input: { turnId: string; reasonCode?: string },
  ): Promise<unknown>;
  getTurn(actor: ServerActorContext, turnId: string): Promise<unknown>;
  decideToolApproval(
    actor: ServerActorContext,
    input: { approvalId: string; decision: 'approved' | 'declined'; reason?: string },
  ): Promise<unknown>;
  reconcileAfterRestart(): Promise<{ cancelled: number; failed: number; pendingApprovals: number }>;
}

type TurnServiceLike = TurnServicePort;

/**
 * The remote Application data/action port (Stage 05 adapter semantics
 * preserved: typed resource queries and mutations across the SAME server
 * authorization boundary). Implemented in `app-remote.ts`.
 */
export interface AppDataPort {
  query(actor: ServerActorContext, input: Record<string, unknown>): Promise<unknown>;
  mutate(actor: ServerActorContext, input: Record<string, unknown>): Promise<unknown>;
}

/** Bounded field validation helpers (closed schemas; fail closed). */
function boundedId(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      `${field} must be a bounded identifier.`,
    );
  }
  return value;
}

/**
 * Bounded pagination/sequence parameter: an optional JSON number OR a
 * bounded decimal STRING (HTTP GET query parameters are strings by
 * nature) that must be a SAFE INTEGER inside `[min, max]`; `fallback`
 * applies when absent. Anything else fails closed.
 */
function boundedPageParam(
  value: unknown,
  field: string,
  max: number,
  fallback: number,
  min: number,
): number {
  if (value === undefined) {
    return fallback;
  }
  // Bounded numeric-string coercion BEFORE validation: at most 10 ASCII
  // digits with an optional leading minus — never an expression.
  const candidate =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^-?\d{1,10}$/.test(value)
        ? Number(value)
        : NaN;
  if (!Number.isSafeInteger(candidate) || candidate < min || candidate > max) {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      `${field} must be an integer between ${min} and ${max}.`,
    );
  }
  return candidate;
}

/** The closed durable-run status vocabulary (exhaustive by construction). */
const STORED_RUN_STATUS_FLAGS = {
  running: true,
  waiting: true,
  blocked: true,
  completed: true,
  failed: true,
  cancelled: true,
} satisfies Record<StoredRunStatus, true>;
const STORED_RUN_STATUSES = Object.freeze(
  Object.keys(STORED_RUN_STATUS_FLAGS) as StoredRunStatus[],
);

/**
 * The SAFE generic run projection (Stage 9 WP-1). Identity, status, safe
 * error and safe output summary ONLY — stored `output` never crosses the
 * generic read regardless of retention; the protected `run.detail` command
 * is the only authorized path to protected bytes.
 */
function safeRunProjection(run: StoredRun): Record<string, unknown> {
  return {
    runId: run.runId,
    graphId: run.graphId,
    graphVersion: run.graphVersion,
    capabilitySetVersion: run.capabilitySetVersion,
    activationVersion: run.activationVersion,
    status: run.status,
    mode: run.mode,
    retention: run.retention,
    steps: run.steps,
    currentNodeId: run.currentNodeId,
    ...(run.outputSummary !== undefined ? { outputSummary: run.outputSummary } : {}),
    ...(run.error !== undefined ? { error: run.error } : {}),
    recordRevision: run.recordRevision,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
  };
}

/**
 * The SAFE event projection: identity/timeline columns only. The stored
 * `payload` string can carry retention-gated kernel material and never
 * crosses the generic read.
 */
function safeEventProjection(event: StoredEvent): Record<string, unknown> {
  return {
    runId: event.runId,
    seq: event.seq,
    eventSchema: event.eventSchema,
    type: event.type,
    graphId: event.graphId,
    graphVersion: event.graphVersion,
    capabilitySetVersion: event.capabilitySetVersion,
    activationVersion: event.activationVersion,
    nodeId: event.nodeId,
    capabilityId: event.capabilityId,
    timestamp: event.timestamp,
  };
}

/** The SAFE wait projection: safe descriptors only, never checkpoints. */
function safeWaitProjection(wait: DurableWaitState): Record<string, unknown> {
  return {
    waitId: wait.waitId,
    runId: wait.runId,
    tokenId: wait.tokenId,
    nodeId: wait.nodeId,
    activationVersion: wait.activationVersion,
    kind: wait.kind,
    signalName: wait.signalName,
    dueAt: wait.dueAt,
    timeoutAt: wait.timeoutAt,
    status: wait.status,
    createdAt: wait.createdAt,
    resolvedAt: wait.resolvedAt,
    resolvedBy: wait.resolvedBy,
  };
}

/**
 * The SAFE activation projection: published identity plus a defensive
 * identity-level summary parsed from the canonical manifest (node/binding
 * counts and graph node ids). Nothing payload-shaped is disclosed.
 */
function safeActivationProjection(activation: StoredActivation): Record<string, unknown> {
  let nodeIds: string[] | undefined;
  let bindingCount: number | undefined;
  let contractCount: number | undefined;
  try {
    const manifest = JSON.parse(activation.canonicalManifest) as {
      graph?: { nodes?: unknown };
      bindings?: unknown;
      contracts?: unknown;
    };
    if (Array.isArray(manifest.graph?.nodes)) {
      nodeIds = (manifest.graph.nodes as unknown[])
        .map((node) =>
          typeof node === 'object' && node !== null && 'id' in (node as Record<string, unknown>)
            ? (node as Record<string, unknown>)['id']
            : undefined,
        )
        .filter((id): id is string => typeof id === 'string');
    }
    if (Array.isArray(manifest.bindings)) {
      bindingCount = manifest.bindings.length;
    }
    if (Array.isArray(manifest.contracts)) {
      contractCount = manifest.contracts.length;
    }
  } catch {
    // The manifest is presentation-only here; identity columns remain
    // truthful even if the canonical JSON were unreadable.
  }
  return {
    activationVersion: activation.activationVersion,
    manifestSchema: activation.manifestSchema,
    graphId: activation.graphId,
    graphVersion: activation.graphVersion,
    capabilitySetVersion: activation.capabilitySetVersion,
    createdAt: activation.createdAt,
    ...(nodeIds !== undefined ? { nodeIds, nodeCount: nodeIds.length } : {}),
    ...(bindingCount !== undefined ? { bindingCount } : {}),
    ...(contractCount !== undefined ? { contractCount } : {}),
  };
}

function boundedString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.length > max) {
    throw new VictControlError('VICT_COMMAND_FIELD_INVALID', `${field} must be a bounded string.`);
  }
  return value;
}

/** Canonical digest over the EXACT canonical request payload. */
function requestDigest(canonicalPayload: Record<string, unknown>): string {
  return createHash('sha256')
    .update(`vict.command@1\u0000${toCanonicalJson(canonicalPayload)}`, 'utf8')
    .digest('hex');
}

/**
 * Canonicalize one command payload into PLAIN data, exactly once, before
 * any digest or execution:
 *
 * - only OWN ENUMERABLE properties cross the boundary (inherited fields
 *   and non-enumerable state are dropped);
 * - accessor properties (getters/setters) are REJECTED — reading them
 *   would invoke hostile code and could leak or mutate;
 * - property enumeration or reads that THROW (proxies, traps) fail with a
 *   stable non-echoing error instead of a raw exception;
 * - nested values must be plain objects, arrays, or JSON scalars;
 * - an OWN `__proto__` key in any own form at any depth is REJECTED with the
 *   stable non-echoing code (Stage 07C Phase F handoff §6.8, the Stage 07A
 *   N-1 discipline applied to the command capture path): before this
 *   hardening such keys were silently dropped (scalar values) or silently
 *   promoted into the captured container's prototype (object values) by the
 *   `result[key] = value` assignment, so the rejected-form requirement can
 *   only be enforced HERE, at the single capture path.
 */
function canonicalPlainPayload(raw: unknown, depth = 0): Record<string, unknown> {
  if (depth > 8) {
    throw new VictControlError(
      'VICT_COMMAND_PAYLOAD_INVALID',
      'The command payload nests too deeply.',
    );
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new VictControlError(
      'VICT_COMMAND_PAYLOAD_INVALID',
      'The command payload must be a plain object; non-object payloads are never silently converted.',
    );
  }
  let keys: string[];
  try {
    keys = Object.keys(raw);
  } catch {
    throw new VictControlError(
      'VICT_COMMAND_PAYLOAD_INVALID',
      'The command payload could not be enumerated; hostile containers are rejected.',
    );
  }
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    let descriptor: PropertyDescriptor | undefined;
    let value: unknown;
    try {
      descriptor = Object.getOwnPropertyDescriptor(raw, key);
      if (descriptor === undefined) {
        throw new Error('own descriptor missing');
      }
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        throw new Error('accessor property');
      }
      if (key === '__proto__') {
        throw new VictControlError(
          'VICT_COMMAND_PAYLOAD_INVALID',
          'The command payload declares a prohibited special key; own prototype-key forms are rejected in any own form at any depth.',
        );
      }
      value = descriptor.value;
    } catch {
      throw new VictControlError(
        'VICT_COMMAND_PAYLOAD_INVALID',
        'The command payload declares an accessor or unreadable property; hostile containers are rejected.',
      );
    }
    result[key] = canonicalPlainValue(value, depth);
  }
  return result;
}

function canonicalPlainValue(value: unknown, depth: number): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new VictControlError(
        'VICT_COMMAND_PAYLOAD_INVALID',
        'The command payload contains a non-finite number.',
      );
    }
    return value;
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      let item: unknown;
      try {
        item = (value as unknown[])[index];
      } catch {
        throw new VictControlError(
          'VICT_COMMAND_PAYLOAD_INVALID',
          'The command payload contains an unreadable array entry.',
        );
      }
      out.push(canonicalPlainValue(item, depth + 1));
    }
    return out;
  }
  return canonicalPlainPayload(value, depth + 1);
}

/**
 * Capture the COMPLETE command request envelope as closed, VICT-owned
 * plain data BEFORE any individual field is read:
 *
 * - only OWN, ENUMERABLE, STRING-KEYED data properties cross the
 *   boundary — accessors (getters/setters), inherited members,
 *   non-enumerable fields, and symbol keys are rejected (getters are
 *   NEVER invoked — reading `request.command` off a hostile object before
 *   validation would execute caller code);
 * - exotic prototypes (class instances, hostile proxies over them) are
 *   rejected; enumeration and descriptor reads that THROW (hostile
 *   proxies, revoked Proxies, traps) fail with the stable structured
 *   error instead of a raw exception;
 * - the top-level field set is CLOSED: exactly `command`, `payload` and
 *   `idempotencyKey` as declared by `vict.command@1` — unknown fields
 *   fail;
 * - `payload` is captured recursively as plain data (same discipline)
 *   and the captured VICT-owned request is the ONLY thing used for
 *   authorization, digesting, and execution.
 */
const VICT_COMMAND_ENVELOPE_FIELDS = ['command', 'payload', 'idempotencyKey'] as const;

function captureCommandEnvelope(raw: unknown): {
  command: unknown;
  payload: unknown;
  idempotencyKey: unknown;
} {
  // `command` and `payload` are always required; `idempotencyKey` is
  // conditionally required (state-changing commands enforce it below).
  const capture = captureClosedRecord(raw, 'command request', VICT_COMMAND_ENVELOPE_FIELDS, [
    'command',
    'payload',
  ]);
  return {
    command: capture.command,
    payload: capture.payload,
    idempotencyKey: capture.idempotencyKey,
  };
}

/**
 * Capture one closed plain-data record (the shared structural discipline
 * for the direct dispatcher and HTTP boundaries).
 */
function captureClosedRecord(
  raw: unknown,
  field: string,
  allowed: readonly string[],
  required: readonly string[] = allowed,
): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new VictControlError(
      'VICT_COMMAND_REQUEST_INVALID',
      `The ${field} must be a plain object with the closed vict.command@1 field set.`,
    );
  }
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(raw);
  } catch {
    throw new VictControlError(
      'VICT_COMMAND_REQUEST_INVALID',
      `The ${field} could not be inspected; hostile containers are rejected.`,
    );
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new VictControlError(
      'VICT_COMMAND_REQUEST_INVALID',
      `The ${field} must be a plain data record; exotic prototypes are rejected.`,
    );
  }
  let ownKeys: PropertyKey[];
  try {
    ownKeys = Reflect.ownKeys(raw);
  } catch {
    throw new VictControlError(
      'VICT_COMMAND_REQUEST_INVALID',
      `The ${field} could not be enumerated; hostile containers are rejected.`,
    );
  }
  const capture: Record<string, unknown> = {};
  for (const key of ownKeys) {
    if (typeof key !== 'string') {
      throw new VictControlError(
        'VICT_COMMAND_REQUEST_INVALID',
        `The ${field} declares a symbol key; only plain data properties are accepted.`,
      );
    }
    if (!allowed.includes(key)) {
      throw new VictControlError(
        'VICT_COMMAND_REQUEST_INVALID',
        `The ${field} declares a field outside the closed vict.command@1 envelope.`,
      );
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(raw, key);
    } catch {
      throw new VictControlError(
        'VICT_COMMAND_REQUEST_INVALID',
        `The ${field} could not be inspected; hostile containers are rejected.`,
      );
    }
    if (
      descriptor === undefined ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      descriptor.enumerable !== true
    ) {
      throw new VictControlError(
        'VICT_COMMAND_REQUEST_INVALID',
        `The ${field} declares an accessor, inherited, or non-enumerable member; only own enumerable data properties are accepted.`,
      );
    }
    capture[key] = descriptor.value;
  }
  for (const member of required) {
    if (!(member in capture)) {
      throw new VictControlError(
        'VICT_COMMAND_REQUEST_INVALID',
        `The ${field} is missing a required member of the closed envelope.`,
      );
    }
  }
  return capture;
}

/** Deterministic owner token for this service instance (lease holder). */
let serviceInstanceCounter = 0;

/**
 * The versioned command dispatcher: transport-free and shared by HTTP and
 * the CLI. Every command re-derives its authorization from the
 * authenticated server context (never from the payload) and mutates only
 * through the durable idempotency policy.
 */
export class VictCommandService {
  readonly #options: VictCommandServiceOptions;
  readonly #owner: string;
  readonly #leaseMs: number;
  readonly #confirmationTtlMs: number;
  /** Monotonic disambiguator for per-access protected-detail audit ids. */
  #detailAuditSeq = 0;
  /** Opaque receiptId generator nonce (never derived from payload bytes). */
  #confirmationSeq = 0;

  constructor(options: VictCommandServiceOptions) {
    this.#options = options;
    this.#leaseMs = options.idempotencyLeaseMs ?? 60_000;
    this.#confirmationTtlMs = options.confirmationTtlMs ?? DEFAULT_CONFIRMATION_TTL_MS;
    serviceInstanceCounter += 1;
    this.#owner = options.idempotencyOwner ?? `svc-${process.pid}-${serviceInstanceCounter}`;
  }

  /** Dispatch one command (closed schemas; durable idempotency; safe errors). */
  async dispatch(
    actor: ServerActorContext,
    request: VictCommandRequest,
  ): Promise<VictCommandOutcome> {
    // ---- Closed envelope capture (BEFORE any field read) ----------------
    // The COMPLETE request envelope is validated and captured as VICT-owned
    // plain data first: a throwing getter on `command` (or any other
    // member) never executes; unknown top-level fields never enter. The
    // captured request is the ONLY thing used below (authorization,
    // digesting, execution) — the caller's object is never retained.
    let captured: {
      command: unknown;
      payload: unknown;
      idempotencyKey: unknown;
    };
    try {
      captured = captureCommandEnvelope(request);
    } catch (error) {
      if (error instanceof VictControlError) {
        throw error;
      }
      throw new VictControlError(
        'VICT_COMMAND_REQUEST_INVALID',
        'The command request could not be captured; hostile containers are rejected.',
      );
    }
    const commandName = captured.command;
    if (
      typeof commandName !== 'string' ||
      !(VICT_COMMANDS as readonly string[]).includes(commandName)
    ) {
      return { ok: false, code: 'VICT_COMMAND_UNKNOWN' };
    }
    const command = commandName as VictCommandName;
    // ---- Canonical plain payload (ONE form for digest AND execution) ----
    // Hostile direct callers (getters, proxies, enumeration traps) fail
    // with the stable structured error, never a raw exception.
    let payload: Record<string, unknown>;
    try {
      payload = canonicalPlainPayload(captured.payload);
    } catch (error) {
      if (error instanceof VictControlError) {
        throw error;
      }
      throw new VictControlError(
        'VICT_COMMAND_PAYLOAD_INVALID',
        'The command payload could not be canonicalized; hostile containers are rejected.',
      );
    }
    // ---- Closed payload schema (fail closed on unknown fields) ----------
    this.#assertPayloadFields(command, payload);
    // ---- Authorization matrix (BELOW the transport; default deny) -------
    const spec = COMMAND_REGISTRY[command];
    if (spec.scope !== '*') {
      assertCommandScope(actor, spec.scope);
    }
    // ---- Durable idempotency policy for state-changing commands ---------
    if (spec.mutation) {
      return this.#dispatchIdempotent(actor, command, payload, captured.idempotencyKey);
    }
    return this.#execute(actor, command, payload, captured.idempotencyKey);
  }

  /** Validate the payload against the command's closed field set. */
  #assertPayloadFields(command: VictCommandName, payload: Record<string, unknown>): void {
    const allowed = COMMAND_REGISTRY[command].fields;
    for (const key of Object.keys(payload)) {
      if (!allowed.includes(key)) {
        throw new VictControlError(
          'VICT_COMMAND_PAYLOAD_INVALID',
          `The command payload declares an unknown field for '${command}'.`,
        );
      }
    }
  }

  /**
   * The durable idempotency boundary for one state-changing command:
   * namespaced claim (actor + command + key) with a durable lease →
   * execute → settle. Deterministic failures settle `failed` (replayed);
   * retryable infrastructure failures RELEASE the claim. A crashed
   * claimer's expired lease is taken over on retry; the re-execution is
   * FENCED by the domain's own idempotency (turn intents, commit saga
   * receipts, selection operation identities, content-identity guards).
   */
  async #dispatchIdempotent(
    actor: ServerActorContext,
    command: VictCommandName,
    payload: Record<string, unknown>,
    idempotencyKey: unknown,
  ): Promise<VictCommandOutcome> {
    if (
      typeof idempotencyKey !== 'string' ||
      !COMMAND_IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
    ) {
      throw new VictControlError(
        'VICT_COMMAND_IDEMPOTENCY_KEY_INVALID',
        'A state-changing command requires a bounded Idempotency-Key (letters, digits, ".", "_", ":", "-"; at most 128 characters).',
      );
    }
    const digest = requestDigest(payload);
    const store = this.#options.stores.commandIdempotency;
    const now = this.#options.clock ?? (() => Date.now());
    const namespace = { actorId: actor.actorId, command, idempotencyKey };
    // The confirmation requirement is checked FIRST for the gated commands,
    // in the command service (never the transport): a legacy unconfirmed
    // shape fails closed for EVERY actor class including administrator.
    if (CONFIRMATION_REQUIRED_COMMANDS.has(command)) {
      requireConfirmationMember(payload);
    }
    // The settlement fence token of the claim generation THIS execution
    // owns: completion, deterministic failure, and release all present
    // exactly this token. A stale owner's settlement fails with a stable
    // conflict and never mutates the current claim.
    let fenceToken: string | undefined;
    // Confirmation-gated commands continue through the frozen Phase 1–4
    // order below; the plain mutation path keeps the pre-G2 behavior.
    if (CONFIRMATION_REQUIRED_COMMANDS.has(command)) {
      return this.#dispatchConfirmedIdempotent(
        actor,
        command,
        payload,
        idempotencyKey as string,
        digest,
        namespace,
      );
    }
    const existing = await store.getReceipt(namespace);
    if (existing !== undefined) {
      // The receipt binds actor + command kind + request digest.
      if (
        existing.actorId !== actor.actorId ||
        existing.command !== command ||
        existing.requestDigest !== digest
      ) {
        return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' };
      }
      if (existing.status === 'pending') {
        // Crash recovery: an EXPIRED lease may be taken over; a live lease
        // answers the stable in-progress conflict.
        const takeover = await store.takeOverExpiredLease({
          actorId: actor.actorId,
          command,
          idempotencyKey,
          owner: this.#owner,
          leaseUntil: now() + this.#leaseMs,
          at: now(),
        });
        if (takeover.outcome === 'not-expired') {
          return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS' };
        }
        // `taken`: fall through to fenced re-execution as the new owner
        // (with the takeover's NEW settlement fence token).
        fenceToken = takeover.outcome === 'taken' ? takeover.fenceToken : undefined;
      } else if (existing.status === 'failed') {
        return { ok: false, code: existing.responseCode ?? 'VICT_COMMAND_FAILED' };
      } else {
        return this.#replayResult(actor, command, existing);
      }
    } else {
      // Cross-command key reuse: the same actor reusing ONE Idempotency-Key
      // for a DIFFERENT command is a client bug and a stable conflict — the
      // key is not silently re-namespaced into a second logical request.
      const reused = await store.findReceiptByActorKey({ actorId: actor.actorId, idempotencyKey });
      if (reused !== undefined && reused.command !== command) {
        return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' };
      }
      const claimFenceToken = commandIdempotencyFenceToken({
        actorId: actor.actorId,
        command,
        idempotencyKey,
        owner: this.#owner,
        attempts: 1,
      });
      const claim = await store.claimReceipt({
        idempotencyKey,
        actorId: actor.actorId,
        command,
        requestDigest: digest,
        status: 'pending',
        responseCode: undefined,
        resultJson: undefined,
        createdAt: now(),
        settledAt: undefined,
        owner: this.#owner,
        leaseUntil: now() + this.#leaseMs,
        attempts: 1,
        fenceToken: claimFenceToken,
      });
      if (claim === 'exists') {
        // Lost the concurrent race: re-read for the truthful disposition.
        const raced = await store.getReceipt(namespace);
        if (
          raced !== undefined &&
          (raced.actorId !== actor.actorId ||
            raced.command !== command ||
            raced.requestDigest !== digest)
        ) {
          return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' };
        }
        if (raced !== undefined && raced.status === 'completed') {
          return this.#replayResult(actor, command, raced);
        }
        if (raced !== undefined && raced.status === 'failed') {
          return { ok: false, code: raced.responseCode ?? 'VICT_COMMAND_FAILED' };
        }
        return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS' };
      }
      // The fresh claim's settlement fence token.
      fenceToken = claimFenceToken;
    }
    if (fenceToken === undefined) {
      // Unreachable: every path that reaches execution owns a claim
      // generation. Fail closed rather than settle unfenced.
      throw new VictControlError(
        'VICT_IDEMPOTENCY_FENCE_CONFLICT',
        'No settlement fence token was allocated for this command execution.',
      );
    }
    try {
      const outcome = await this.#execute(actor, command, payload, idempotencyKey);
      if (outcome.ok) {
        await store.completeReceipt({
          actorId: actor.actorId,
          command,
          idempotencyKey,
          resultJson: JSON.stringify(safeResultProjection(command, outcome.data)),
          at: now(),
          fenceToken,
        });
      } else {
        await store.failReceipt({
          actorId: actor.actorId,
          command,
          idempotencyKey,
          responseCode: outcome.code,
          at: now(),
          fenceToken,
        });
      }
      return outcome;
    } catch (error) {
      if (error instanceof VictControlError) {
        // Deterministic command failure: durable, stable, replayed. A
        // fence conflict (a stale owner racing a takeover) is NEVER
        // recorded as this command's disposition — the record belongs to
        // the current claim owner.
        if (error.code !== VICT_IDEMPOTENCY_FENCE_CONFLICT) {
          await store
            .failReceipt({
              actorId: actor.actorId,
              command,
              idempotencyKey,
              responseCode: error.code,
              at: now(),
              fenceToken,
            })
            .catch(() => undefined);
        }
        throw error;
      }
      // RETRYABLE infrastructure failure: release the claim so a retry can
      // re-execute truthfully — never permanently confused with a
      // deterministic command failure. A fence conflict here means the
      // claim changed owners mid-flight; the release is skipped (never
      // touches the current owner's live claim).
      await store
        .releaseReceipt({ actorId: actor.actorId, command, idempotencyKey, at: now(), fenceToken })
        .catch(() => undefined);
      throw error;
    }
  }

  /**
   * Reconstruct an authorized replay result from its authoritative domain
   * where possible, using the SAFE projection stored in the receipt. The
   * projection itself never carries payloads; a replayed result that
   * requires the full record is re-derived under the CURRENT actor's
   * authorization (actor-scoped reads — never a data leak).
   */
  // ---- Stage 9 G2 — the confirmation boundary ------------------------

  /**
   * The confirmation-gated idempotency path: the frozen Phase 1–4 order
   * (proposal §5). Phase 1 is the EXISTING settled idempotency lookup bound
   * to the digest of the COMPLETE confirmation request (the payload itself
   * includes `confirmation.receiptId`); Phase 2 classifies the non-echoing
   * receipt chain; Phase 3 claims durably and FENCED on BOTH stores (the
   * receipt here, the command through the EXISTING idempotency store incl.
   * the cross-command `findReceiptByActorKey` check); Phase 4 executes
   * under the domain idempotency fence and settles BOTH stores (idempotency
   * result first, receipt converges under its fence — consumed on success,
   * `spent` on a persisted deterministic failure, fenced release on a
   * retryable infrastructure failure).
   */
  async #dispatchConfirmedIdempotent(
    actor: ServerActorContext,
    command: VictCommandName,
    payload: Record<string, unknown>,
    idempotencyKey: string,
    digest: string,
    namespace: { actorId: string; command: string; idempotencyKey: string },
  ): Promise<VictCommandOutcome> {
    const store = this.#options.stores.commandIdempotency;
    const confirmationStore = this.#options.stores.commandConfirmationReceipts;
    const now = this.#options.clock ?? (() => Date.now());
    const claimOwner = `${actor.actorId}\u0000${idempotencyKey}`;
    // ---- Phase 1: settled lookup (checked FIRST; replay precedes every
    // receipt-state check) ---------------------------------------------------
    const existing = await store.getReceipt(namespace);
    if (existing !== undefined) {
      if (
        existing.actorId !== actor.actorId ||
        existing.command !== command ||
        existing.requestDigest !== digest
      ) {
        return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' };
      }
      if (existing.status === 'failed') {
        // A deterministic recorded failure replays truthfully; the referenced
        // receipt converges to `spent` under the same fence (convergence is
        // best-effort; the recorded outcome is authoritative).
        const receiptId = this.#boundConfirmationOf(payload);
        if (receiptId !== undefined) {
          await this.#settleStoredReceipt(
            confirmationStore,
            actor,
            idempotencyKey,
            receiptId,
            'spent',
          );
        }
        return { ok: false, code: existing.responseCode ?? 'VICT_COMMAND_FAILED' };
      }
      if (existing.status === 'completed') {
        // Phase-1 precedence: the recorded result replays with NO new effect
        // even when the referenced receipt is now expired or spent (P-17,
        // P-18); the receipt converges to `consumed` under the same fence
        // when a crashed claim left it unsettled (P-21).
        const receiptId = this.#boundConfirmationOf(payload);
        if (receiptId !== undefined) {
          await this.#settleStoredReceipt(
            confirmationStore,
            actor,
            idempotencyKey,
            receiptId,
            'consumed',
          );
        }
        return this.#replayResult(actor, command, existing);
      }
      // `pending` claims fall through to the Phase-3 claim acquisition.
    } else {
      // Cross-command key reuse: one Idempotency-Key is never quietly
      // re-namespaced into a second logical request (P-8).
      const reused = await store.findReceiptByActorKey({
        actorId: actor.actorId,
        idempotencyKey,
      });
      if (reused !== undefined && reused.command !== command) {
        return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' };
      }
    }
    // ---- Phase 2: the receipt verification chain (non-echoing) -----------
    const classified = await this.#classifyReceiptChain(actor, command, payload);
    if (!classified.ok) {
      return { ok: false, code: classified.code };
    }
    const receipt = classified.receipt;
    // ---- Phase 3: durable claims, fenced on both stores ------------------
    let idempotencyFence: string;
    if (existing === undefined) {
      const claimFenceToken = commandIdempotencyFenceToken({
        actorId: actor.actorId,
        command,
        idempotencyKey,
        owner: this.#owner,
        attempts: 1,
      });
      const claim = await store.claimReceipt({
        idempotencyKey,
        actorId: actor.actorId,
        command,
        requestDigest: digest,
        status: 'pending',
        responseCode: undefined,
        resultJson: undefined,
        createdAt: now(),
        settledAt: undefined,
        owner: this.#owner,
        leaseUntil: now() + this.#leaseMs,
        attempts: 1,
        fenceToken: claimFenceToken,
      });
      if (claim === 'exists') {
        // Lost the concurrent race: re-read for the truthful disposition,
        // touching neither store further (the receipt claim never happens).
        const raced = await store.getReceipt(namespace);
        if (
          raced !== undefined &&
          (raced.actorId !== actor.actorId ||
            raced.command !== command ||
            raced.requestDigest !== digest)
        ) {
          return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' };
        }
        if (raced !== undefined && raced.status === 'completed') {
          return this.#replayResult(actor, command, raced);
        }
        if (raced !== undefined && raced.status === 'failed') {
          return { ok: false, code: raced.responseCode ?? 'VICT_COMMAND_FAILED' };
        }
        return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS' };
      }
      idempotencyFence = claimFenceToken;
    } else {
      const takeover = await store.takeOverExpiredLease({
        actorId: actor.actorId,
        command,
        idempotencyKey,
        owner: this.#owner,
        leaseUntil: now() + this.#leaseMs,
        at: now(),
      });
      if (takeover.outcome === 'not-expired') {
        return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS' };
      }
      if (takeover.outcome !== 'taken') {
        // Fail closed rather than settle unfenced ('missing' namespace cannot
        // reach here: Phase 1 established an existing pending receipt).
        throw new VictControlError(
          VICT_IDEMPOTENCY_FENCE_CONFLICT,
          'VICT_IDEMPOTENCY_FENCE_CONFLICT: no settlement fence token was allocated for this command execution.',
        );
      }
      idempotencyFence = takeover.fenceToken;
    }
    // The fenced receipt claim in the NEW confirmation store.
    const receiptClaim = await confirmationStore.startConsumption({
      receiptId: receipt.receiptId,
      owner: claimOwner,
      leaseUntil: now() + this.#leaseMs,
      at: now(),
    });
    if (receiptClaim.outcome !== 'claimed') {
      let code: string;
      switch (receiptClaim.outcome) {
        case 'missing':
          code = 'VICT_CONFIRMATION_UNAVAILABLE';
          break;
        case 'expired':
          code = 'VICT_CONFIRMATION_EXPIRED';
          break;
        case 'in-progress':
          // Another consume of the same receipt is in flight: the loser is
          // retryable, NOT a settled failure (P-2). Release the idempotency
          // claim (fenced) so a same-key retry re-executes truthfully.
          await store
            .releaseReceipt({
              actorId: actor.actorId,
              command,
              idempotencyKey,
              at: now(),
              fenceToken: idempotencyFence,
            })
            .catch(() => undefined);
          return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS' };
        default: {
          const reread = await confirmationStore.getReceipt(receipt.receiptId);
          code = reread?.status === 'expired' ? 'VICT_CONFIRMATION_EXPIRED' : 'VICT_CONFIRMATION_SPENT';
        }
      }
      // Deterministic classification: persist through the durable claim.
      await store
        .failReceipt({
          actorId: actor.actorId,
          command,
          idempotencyKey,
          responseCode: code,
          at: now(),
          fenceToken: idempotencyFence,
        })
        .catch(() => undefined);
      // The persistent stable outcome — recorded and returned (not thrown).
      await this.#auditConsumedOutcome(actor, command, receipt.receiptId, code);
      return { ok: false, code };
    }
    const receiptFence = receiptClaim.fenceToken;
    // ---- Phase 4: execute under the domain idempotency fence; settle BOTH
    // stores --------------------------------------------------------------
    try {
      const outcome = await this.#execute(actor, command, payload, idempotencyKey);
      if (outcome.ok) {
        await store.completeReceipt({
          actorId: actor.actorId,
          command,
          idempotencyKey,
          resultJson: JSON.stringify(safeResultProjection(command, outcome.data)),
          at: now(),
          fenceToken: idempotencyFence,
        });
      } else {
        await store.failReceipt({
          actorId: actor.actorId,
          command,
          idempotencyKey,
          responseCode: outcome.code,
          at: now(),
          fenceToken: idempotencyFence,
        });
        // Persisted deterministic failure: the receipt truthfully settles.
        await confirmationStore
          .settleConsumption({
            receiptId: receipt.receiptId,
            fenceToken: receiptFence,
            status: 'spent',
            consumedByKey: idempotencyKey,
            at: now(),
          })
          .catch(() => undefined);
        return outcome;
      }
      // The idempotency result settled FIRST; the receipt converges under
      // its own fence. A lost fence race converges on the Phase-1 replay.
      await confirmationStore
        .settleConsumption({
          receiptId: receipt.receiptId,
          fenceToken: receiptFence,
          status: 'consumed',
          consumedByKey: idempotencyKey,
          at: now(),
        })
        .catch(() => undefined);
      await this.#auditConsumed(actor, command, idempotencyKey, receipt.receiptId);
      return outcome;
    } catch (error) {
      if (error instanceof VictControlError) {
        if (error.code !== VICT_IDEMPOTENCY_FENCE_CONFLICT) {
          await store
            .failReceipt({
              actorId: actor.actorId,
              command,
              idempotencyKey,
              responseCode: error.code,
              at: now(),
              fenceToken: idempotencyFence,
            })
            .catch(() => undefined);
          await confirmationStore
            .settleConsumption({
              receiptId: receipt.receiptId,
              fenceToken: receiptFence,
              status: 'spent',
              consumedByKey: idempotencyKey,
              at: now(),
            })
            .catch(() => undefined);
        }
        throw error;
      }
      // RETRYABLE infrastructure failure: fenced releases on BOTH stores so
      // a retry re-executes truthfully — never a false terminal state.
      await store
        .releaseReceipt({
          actorId: actor.actorId,
          command,
          idempotencyKey,
          at: now(),
          fenceToken: idempotencyFence,
        })
        .catch(() => undefined);
      await confirmationStore
        .releaseConsumption({ receiptId: receipt.receiptId, fenceToken: receiptFence, at: now() })
        .catch(() => undefined);
      throw error;
    }
  }

  /** The bounded receipt id bound inside the confirmed request payload. */
  #boundConfirmationOf(payload: Record<string, unknown>): string | undefined {
    const confirmation = confirmationOf(payload);
    return confirmation.receiptId;
  }

  /**
   * Best-effort fenced convergence of a receipt whose claim generation this
   * (actor, key) already owned: the crash-recovery protocol that keeps both
   * stores eventually consistent (P-21).
   */
  async #settleStoredReceipt(
    store: CommandConfirmationReceiptStore,
    actor: ServerActorContext,
    idempotencyKey: string,
    receiptId: string,
    toStatus: 'consumed' | 'spent',
  ): Promise<void> {
    try {
      const receipt = await store.getReceipt(receiptId);
      if (receipt === undefined || receipt.actorId !== actor.actorId) {
        return;
      }
      if (receipt.status !== 'prepared') {
        return;
      }
      if (receipt.owner !== `${actor.actorId}\u0000${idempotencyKey}`) {
        return;
      }
      const at = (this.#options.clock ?? (() => Date.now()))();
      const claim = await store.startConsumption({
        receiptId,
        owner: `${actor.actorId}\u0000${idempotencyKey}`,
        leaseUntil: at + this.#leaseMs,
        at,
      });
      if (claim.outcome !== 'claimed') {
        return;
      }
      await store.settleConsumption({
        receiptId,
        fenceToken: claim.fenceToken,
        status: toStatus,
        consumedByKey: idempotencyKey,
        at,
      });
    } catch {
      // Best-effort convergence under the recorded outcome; never masks it.
    }
  }

  /**
   * Phase 2: the non-echoing receipt chain (REQUIRED → UNAVAILABLE →
   * MISMATCH → EXPIRED → STALE → SPENT). Returns `{ ok: false, code }` —
   * a stable persistent outcome with effect None — or the prepared
   * receipt. Never echoes receipt bytes.
   */
  async #classifyReceiptChain(
    actor: ServerActorContext,
    command: VictCommandName,
    payload: Record<string, unknown>,
  ): Promise<{ ok: false; code: string } | { ok: true; receipt: CommandConfirmationReceipt }> {
    const confirmationStore = this.#options.stores.commandConfirmationReceipts;
    const confirmation = confirmationOf(payload);
    const unavailable = (): { ok: false; code: string } => ({
      ok: false,
      code: 'VICT_CONFIRMATION_UNAVAILABLE',
    });
    if (confirmation.receiptId === undefined) {
      return unavailable();
    }
    const receipt = await confirmationStore.getReceipt(confirmation.receiptId);
    // Unknown receipts, other actors' receipts, and receipts issued by
    // another target are non-echoingly unavailable (R-5).
    if (receipt === undefined || receipt.actorId !== actor.actorId) {
      return unavailable();
    }
    if (receipt.command !== command) {
      // Wrong-command receipts are a canonical mismatch.
      return { ok: false, code: 'VICT_CONFIRMATION_MISMATCH' };
    }
    // Wrong canonical parameters (re-derived from the canonical payload —
    // never echoing the receipt's own bytes).
    if (receipt.payloadDigest !== confirmationReceiptDigest(command, payload)) {
      return { ok: false, code: 'VICT_CONFIRMATION_MISMATCH' };
    }
    // ---- chain order: EXPIRED → STALE → SPENT ----
    const at = (this.#options.clock ?? (() => Date.now()))();
    if (receipt.status === 'expired' || (receipt.status === 'prepared' && at >= receipt.expiryAt)) {
      return { ok: false, code: 'VICT_CONFIRMATION_EXPIRED' };
    }
    const current = await this.#currentSubjectRevision(command, receipt.subjectId);
    if (current !== undefined && receipt.expectedRevision !== current) {
      // Target revision changed after preparation: re-review, prepare again.
      return { ok: false, code: 'VICT_CONFIRMATION_STALE' };
    }
    if (receipt.status === 'spent' || receipt.status === 'consumed') {
      return { ok: false, code: 'VICT_CONFIRMATION_SPENT' };
    }
    return { ok: true, receipt };
  }

  /**
   * The CURRENT subject revision, read through the available read surface
   * (G1 reads; `undefined` when no read source is composed — the check
   * then cannot silently fail a receipt).
   */
  async #currentSubjectRevision(
    command: string,
    subjectId: string,
  ): Promise<number | null | undefined> {
    switch (command) {
      case 'run.cancel':
      case 'run.resolve':
      case 'run.signal': {
        const run = await this.#options.execution?.getRun(subjectId);
        return run === undefined ? undefined : run.recordRevision;
      }
      case 'activation.select': {
        const selection = await this.#options.catalog?.getSelection(subjectId);
        return selection === undefined ? null : selection.selectionRevision;
      }
      case 'release.select':
      case 'release.rollback': {
        const rows = await this.#options.stores.control.listReleaseSelections(subjectId);
        if (rows.length === 0) {
          return null;
        }
        return rows.reduce((max, row) => Math.max(max, row.selectionRevision), 0);
      }
      default:
        return undefined;
    }
  }

  /**
   * G2 `confirmation.prepare`: issue (or truthfully replay / replace) the
   * server-issued receipt for one gated intervention. Honors: prepare
   * claims in the EXISTING CommandIdempotencyStore under the namespace
   * `confirmation.prepare:<command>` with the digest of the canonical
   * prepare request; same key + digest with a live prepared receipt
   * replays the SAME receipt; after expiry a replacement receipt (at most
   * FIVE replacement attempts per (actor, command, key)); beyond budget
   * the latest receipt's truthful status replays — NEVER a conflict; a
   * digest change on the key ALWAYS answers the conflict BEFORE any
   * replacement logic.
   */
  async prepareConfirmation(
    actor: ServerActorContext,
    request: {
      readonly command: string;
      readonly payload: unknown;
      readonly idempotencyKey: string;
    },
  ): Promise<VictCommandOutcome> {
    const store = this.#options.stores.commandIdempotency;
    const confirmationStore = this.#options.stores.commandConfirmationReceipts;
    const now = this.#options.clock ?? (() => Date.now());
    const commandName = request.command;
    if (
      typeof commandName !== 'string' ||
      !CONFIRMATION_REQUIRED_COMMANDS.has(commandName) ||
      !(VICT_COMMANDS as readonly string[]).includes(commandName)
    ) {
      return { ok: false, code: 'VICT_COMMAND_UNKNOWN' };
    }
    const command = commandName as VictCommandName;
    // Prepare requires the TARGET command's mutation scope.
    const spec = COMMAND_REGISTRY[command];
    if (spec.scope !== '*') {
      assertCommandScope(actor, spec.scope);
    }
    if (
      typeof request.idempotencyKey !== 'string' ||
      !COMMAND_IDEMPOTENCY_KEY_PATTERN.test(request.idempotencyKey)
    ) {
      throw new VictControlError(
        'VICT_COMMAND_IDEMPOTENCY_KEY_INVALID',
        'Prepare requires a bounded Idempotency-Key (letters, digits, ".", "_", ":", "-"; at most 128 characters).',
      );
    }
    let payload: Record<string, unknown>;
    try {
      payload = canonicalPlainPayload(request.payload);
    } catch (error) {
      if (error instanceof VictControlError) {
        throw error;
      }
      throw new VictControlError(
        'VICT_COMMAND_PAYLOAD_INVALID',
        'The prepare payload could not be canonicalized; hostile containers are rejected.',
      );
    }
    // Closed prepare field set: the target command's semantic fields plus
    // the REQUIRED subject guard `expectedRevision`. Unknown fields fail.
    const prepareFields = [...semanticConfirmationFields(command), 'expectedRevision'];
    this.#assertPreparePayloadFields(command, payload, prepareFields);
    const subjectField = confirmationSubjectField(command);
    if (typeof payload[subjectField] !== 'string' || (payload[subjectField] as string).length === 0) {
      throw new VictControlError(
        'VICT_COMMAND_FIELD_INVALID',
        `The prepare payload must carry the subject identity '${subjectField}'.`,
      );
    }
    const subjectId = payload[subjectField] as string;
    const expectedRevision = payload['expectedRevision'];
    if (expectedRevision === undefined) {
      // expectedRevision is REQUIRED (proposal §4.4; no no-guard shape).
      throw new VictControlError(
        'VICT_CONFIRMATION_FIELD_REQUIRED',
        'VICT_CONFIRMATION_FIELD_REQUIRED: the prepare payload must carry the subject\'s current expectedRevision.',
      );
    }
    if (
      expectedRevision !== null &&
      (typeof expectedRevision !== 'number' ||
        !Number.isSafeInteger(expectedRevision) ||
        expectedRevision < 0)
    ) {
      throw new VictControlError(
        'VICT_COMMAND_FIELD_INVALID',
        'expectedRevision must be the subject\'s current revision (a safe integer, or null when truthfully none is selected).',
      );
    }
    const prepareDigest = requestDigest(payload);
    const prepareCommand = confirmationPrepareCommand(command);
    const prepareNamespace = {
      actorId: actor.actorId,
      command: prepareCommand,
      idempotencyKey: request.idempotencyKey,
    };
    let prepareClaimFence: string | undefined;
    const prepareStore = store;
    const existingPrepare = await prepareStore.getReceipt(prepareNamespace);
    if (existingPrepare === undefined) {
      const reused = await prepareStore.findReceiptByActorKey({
        actorId: actor.actorId,
        idempotencyKey: request.idempotencyKey,
      });
      if (reused !== undefined && reused.command !== prepareCommand) {
        return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' };
      }
      const claimFenceToken = commandIdempotencyFenceToken({
        actorId: actor.actorId,
        command: prepareCommand,
        idempotencyKey: request.idempotencyKey,
        owner: this.#owner,
        attempts: 1,
      });
      const claim = await prepareStore.claimReceipt({
        idempotencyKey: request.idempotencyKey,
        actorId: actor.actorId,
        command: prepareCommand,
        requestDigest: prepareDigest,
        status: 'pending',
        responseCode: undefined,
        resultJson: undefined,
        createdAt: now(),
        settledAt: undefined,
        owner: this.#owner,
        leaseUntil: now() + this.#leaseMs,
        attempts: 1,
        fenceToken: claimFenceToken,
      });
      if (claim === 'exists') {
        const raced = await prepareStore.getReceipt(prepareNamespace);
        if (
          raced !== undefined &&
          (raced.requestDigest !== prepareDigest || raced.command !== prepareCommand)
        ) {
          // A digest change on a claimed prepare key is ALWAYS a conflict
          // (P-24) — before any replacement logic.
          return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' };
        }
        if (raced !== undefined && raced.status === 'pending') {
          return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS' };
        }
        // raced === completed: fall through to the truthful receipt replay.
      } else {
        prepareClaimFence = claimFenceToken;
      }
    } else {
      if (existingPrepare.requestDigest !== prepareDigest) {
        // A digest change on the key — settled or unsettled — answers the
        // stable conflict BEFORE any replacement logic (P-24).
        return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' };
      }
      if (existingPrepare.status === 'pending') {
        const takeover = await prepareStore.takeOverExpiredLease({
          actorId: actor.actorId,
          command: prepareCommand,
          idempotencyKey: request.idempotencyKey,
          owner: this.#owner,
          leaseUntil: now() + this.#leaseMs,
          at: now(),
        });
        if (takeover.outcome === 'not-expired') {
          return { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS' };
        }
        prepareClaimFence = takeover.outcome === 'taken' ? takeover.fenceToken : undefined;
      }
      // A previously SETTLED prepare with the same digest replays through
      // the truthful receipt chain below (same receipt, or replacement).
    }
    // ---- receipt chain: replay / replacement (P-22..P-24) ----
    try {
      const chain = await confirmationStore.listReceiptsByPrepare({
        actorId: actor.actorId,
        command,
        prepareIdempotencyKey: request.idempotencyKey,
      });
      const latest = chain[chain.length - 1];
      if (latest !== undefined) {
        const elapsed = now() >= latest.expiryAt;
        if (latest.status === 'prepared' && !elapsed) {
          // Same actor + command + key + digest with a live prepared receipt
          // replays the SAME receipt (idempotent prepare; P-1).
          return ok({
            receiptId: latest.receiptId,
            command,
            payloadDigest: latest.payloadDigest,
            expectedRevision: latest.expectedRevision,
            subjectId: latest.subjectId,
            expiryAt: latest.expiryAt,
            createdBy: latest.actorId,
            createdAt: latest.createdAt,
            status: latest.status,
            replacementAttemptNo: latest.replacementAttemptNo,
          });
        }
        const superseded = elapsed && latest.status === 'prepared';
        const replacementsIssued = latest.replacementAttemptNo - 1;
        if (
          (latest.status === 'expired' || superseded) &&
          replacementsIssued < CONFIRMATION_REPLACEMENT_BUDGET
        ) {
          // Replacement: the expired receipt stays expired and auditable;
          // the fresh receipt is a NEW intent record (R-4/P-22).
          return await this.#issueConfirmationReceipt(actor, command, payload, request.idempotencyKey, latest.replacementAttemptNo + 1, prepareClaimFence);
        }
        // Beyond the replacement budget: replay the LATEST receipt's
        // truthful status. NEVER an idempotency conflict (P-23); the caller
        // is invited to use a FRESH prepare key.
        const effectiveStatus =
          latest.status === 'prepared' && now() >= latest.expiryAt
            ? 'expired'
            : latest.status;
        return ok({
          receiptId: latest.receiptId,
          command,
          status: effectiveStatus,
          recordedStatus: latest.status,
          replacementAttemptNo: latest.replacementAttemptNo,
          replayedStatus: true,
          confirmable: false,
        });
      }
      return await this.#issueConfirmationReceipt(actor, command, payload, request.idempotencyKey, 1, prepareClaimFence);
    } catch (error) {
      if (error instanceof VictControlError && error.code !== VICT_IDEMPOTENCY_FENCE_CONFLICT) {
        // Deterministic prepare failure settles the durable claim.
        if (prepareClaimFence !== undefined) {
          await prepareStore
            .failReceipt({
              actorId: actor.actorId,
              command: prepareCommand,
              idempotencyKey: request.idempotencyKey,
              responseCode: error.code,
              at: now(),
              fenceToken: prepareClaimFence,
            })
            .catch(() => undefined);
        }
        throw error;
      }
      // Retryable infrastructure failure: release the prepare claim.
      if (prepareClaimFence !== undefined) {
        await prepareStore
          .releaseReceipt({
            actorId: actor.actorId,
            command: prepareCommand,
            idempotencyKey: request.idempotencyKey,
            at: now(),
            fenceToken: prepareClaimFence,
          })
          .catch(() => undefined);
      }
      throw error;
    }
  }

  /** Issue one server-issued receipt (the prepare boundary's final step). */
  async #issueConfirmationReceipt(
    actor: ServerActorContext,
    command: VictCommandName,
    payload: Record<string, unknown>,
    prepareKey: string,
    replacementAttemptNo: number,
    prepareClaimFence: string | undefined,
  ): Promise<VictCommandOutcome> {
    const confirmationStore = this.#options.stores.commandConfirmationReceipts;
    const control = this.#options.stores.control;
    const now = this.#options.clock ?? (() => Date.now());
    const at = now();
    const payloadDigest = confirmationReceiptDigest(command, payload);
    const subjectId = payload[confirmationSubjectField(command)] as string;
    const receiptId = `cr-${createHash('sha256')
      .update(
        [
          command,
          actor.actorId,
          prepareKey,
          String(replacementAttemptNo),
          String(at),
          this.#owner,
          String((this.#confirmationSeq += 1)),
        ].join('\u0000'),
        'utf8',
      )
      .digest('hex')}`;
    const expectedRevision = payload['expectedRevision'] === undefined ? null : (payload['expectedRevision'] as number | null);
    const record: CommandConfirmationReceipt = {
      receiptId,
      actorId: actor.actorId,
      command,
      payloadDigest,
      subjectId,
      expectedRevision,
      expiryAt: at + this.#confirmationTtlMs,
      status: 'prepared',
      createdAt: at,
      consumedAt: undefined,
      consumedByKey: undefined,
      replacementAttemptNo,
      prepareIdempotencyKey: prepareKey,
      owner: undefined,
      claimUntil: undefined,
      attempts: 0,
      fenceToken: undefined,
    };
    const created = await confirmationStore.createReceipt(record);
    if (created === 'exists') {
      const existing = await confirmationStore.getReceipt(receiptId);
      if (existing !== undefined) {
        return this.#receiptPreparedView(existing);
      }
    }
    // Audit carries digest + identity ONLY — never a payload byte.
    await control.appendAuditEvent({
      auditId: `audit-confirm-${receiptId}`,
      at,
      actorId: actor.actorId,
      action: 'confirmation.prepared',
      subjectType: 'confirmation',
      subjectId: receiptId,
      summary: `command=${command} actor=${actor.actorId} subject=${subjectId} digest=${payloadDigest} replacementAttemptNo=${replacementAttemptNo}`,
    });
    // Settle the durable prepare claim with this receipt's summary when
    // this attempt owns the live claim generation.
    if (prepareClaimFence !== undefined) {
      await this.#options.stores.commandIdempotency
        .completeReceipt({
          actorId: actor.actorId,
          command: confirmationPrepareCommand(command),
          idempotencyKey: prepareKey,
          resultJson: JSON.stringify({ receiptId, replacementAttemptNo }),
          at,
          fenceToken: prepareClaimFence,
        })
        .catch(() => undefined);
    }
    return this.#receiptPreparedView(record);
  }

  /** The human-reviewable prepared-receipt summary (§4.1, safe fields). */
  #receiptPreparedView(record: CommandConfirmationReceipt): VictCommandOutcome {
    return ok({
      receiptId: record.receiptId,
      command: record.command,
      payloadDigest: record.payloadDigest,
      expectedRevision: record.expectedRevision,
      subjectId: record.subjectId,
      expiryAt: record.expiryAt,
      createdBy: record.actorId,
      createdAt: record.createdAt,
      status: record.status,
      replacementAttemptNo: record.replacementAttemptNo,
    });
  }

  /** Closed prepare payload field check (fail closed on unknown fields). */
  #assertPreparePayloadFields(
    command: VictCommandName,
    payload: Record<string, unknown>,
    allowed: readonly string[],
  ): void {
    for (const key of Object.keys(payload)) {
      if (!allowed.includes(key)) {
        throw new VictControlError(
          'VICT_COMMAND_PAYLOAD_INVALID',
          `The prepare payload declares an unknown field for '${command}'.`,
        );
      }
    }
  }

  /**
   * The single-receipt status read: authorized ONLY for the receipt's own
   * actor (same scope as the receipt's command mutation); any other actor
   * receives the non-echoing UNAVAILABLE outcome — never existence.
   */
  async getConfirmation(
    actor: ServerActorContext,
    receiptId: string,
  ): Promise<VictCommandOutcome> {
    const confirmationStore = this.#options.stores.commandConfirmationReceipts;
    const receipt = await confirmationStore.getReceipt(receiptId);
    if (receipt === undefined || receipt.actorId !== actor.actorId) {
      return { ok: false, code: 'VICT_CONFIRMATION_UNAVAILABLE' };
    }
    if (!(VICT_COMMANDS as readonly string[]).includes(receipt.command)) {
      return { ok: false, code: 'VICT_CONFIRMATION_UNAVAILABLE' };
    }
    const spec = COMMAND_REGISTRY[receipt.command as VictCommandName];
    if (spec.scope !== '*') {
      assertCommandScope(actor, spec.scope);
    }
    const at = (this.#options.clock ?? (() => Date.now()))();
    const effective =
      receipt.status === 'prepared' && at >= receipt.expiryAt ? 'expired' : receipt.status;
    return ok({
      confirmation: {
        receiptId: receipt.receiptId,
        command: receipt.command,
        status: effective,
        recordedStatus: receipt.status,
        subjectId: receipt.subjectId,
        expectedRevision: receipt.expectedRevision,
        payloadDigest: receipt.payloadDigest,
        expiryAt: receipt.expiryAt,
        createdAt: receipt.createdAt,
        consumedAt: receipt.consumedAt,
        consumedByKey: receipt.consumedByKey,
        replacementAttemptNo: receipt.replacementAttemptNo,
      },
    });
  }

  async #replayResult(
    actor: ServerActorContext,
    command: VictCommandName,
    receipt: CommandIdempotencyReceipt,
  ): Promise<VictCommandOutcome> {
    let projection: Record<string, unknown>;
    try {
      projection =
        receipt.resultJson === undefined
          ? {}
          : (JSON.parse(receipt.resultJson) as Record<string, unknown>);
    } catch {
      projection = {};
    }
    const changesetId = projection['changesetId'];
    if (
      typeof changesetId === 'string' &&
      (await this.#authorizedChangeset(actor, changesetId)) !== undefined
    ) {
      const record = await this.#authorizedChangeset(actor, changesetId);
      if (record !== undefined) {
        return { ok: true, data: { changeset: record } };
      }
    }
    const releaseVersion = projection['releaseVersion'];
    if (
      typeof releaseVersion === 'string' &&
      typeof projection['applicationId'] === 'string' &&
      (command === 'release.select' || command === 'release.rollback')
    ) {
      const release = await this.#options.stores.control.getRelease(releaseVersion);
      if (release !== undefined) {
        return {
          ok: true,
          data: {
            selection: {
              applicationId: projection['applicationId'],
              releaseVersion,
              selectionRevision: projection['selectionRevision'],
            },
          },
        };
      }
    }
    // Generic safe-projection replay (identifiers and stable codes only).
    return { ok: true, data: projection };
  }

  /** Actor-scoped ChangeSet read for replay reconstruction. */
  async #authorizedChangeset(actor: ServerActorContext, changesetId: string) {
    const get = this.#options.controlPlane.get;
    if (get === undefined) {
      return undefined;
    }
    try {
      return (await get.call(this.#options.controlPlane, actor, changesetId)) as
        Record<string, unknown> | undefined;
    } catch {
      return undefined;
    }
  }

  /** Execute one command (pre-validated payload; authorization asserted). */
  async #execute(
    actor: ServerActorContext,
    command: VictCommandName,
    payload: Record<string, unknown>,
    idempotencyKey: unknown,
  ): Promise<VictCommandOutcome> {
    switch (command) {
      case 'health.inspect':
        return ok({
          healthy: true,
          commandSchema: VICT_COMMAND_SCHEMA,
          turnExecutorComposed: this.#options.turnService !== undefined,
        });
      case 'compatibility.inspect':
        return ok({
          commandSchema: VICT_COMMAND_SCHEMA,
          streamSchema: 'vict.agent-stream@1',
          changesetSchema: 'vict.changeset@1',
          turnSchema: 'vict.agent-turn@1',
        });
      case 'actor.whoami':
        return ok({
          actorId: actor.actorId,
          roles: [...actor.roles],
          scopes: [...actor.scopes],
          mastraResourceId: actor.mastraResourceId,
        });
      case 'changeset.propose': {
        const record = await this.#options.controlPlane.propose(actor, {
          changesetId: boundedId(payload.changesetId, 'changesetId'),
          base: validateBase(payload.base),
          operations: requireArray(payload.operations, 'operations', 1, 64),
          rationale: boundedString(payload.rationale ?? '', 'rationale', 2000),
          riskClass: riskClass(payload.riskClass),
          requiredApproverCount: approverCount(payload.requiredApproverCount),
          expiresAt: boundedTimestamp(payload.expiresAt, 'expiresAt'),
        });
        return ok({ changeset: record as Record<string, unknown> });
      }
      case 'changeset.revise':
        return ok({
          changeset: (await this.#options.controlPlane.revise(actor, {
            changesetId: boundedId(payload.changesetId, 'changesetId'),
            operations: requireArray(payload.operations, 'operations', 1, 64),
            rationale: boundedString(payload.rationale ?? '', 'rationale', 2000),
            riskClass: riskClass(payload.riskClass),
            requiredApproverCount: approverCount(payload.requiredApproverCount),
            expiresAt: boundedTimestamp(payload.expiresAt, 'expiresAt'),
          })) as Record<string, unknown>,
        });
      case 'changeset.execute-check': {
        const kind =
          payload.kind === 'validation' || payload.kind === 'simulation' ? payload.kind : undefined;
        if (kind === undefined) {
          throw new VictControlError(
            'VICT_COMMAND_FIELD_INVALID',
            "kind must be 'validation' or 'simulation'.",
          );
        }
        const run = await this.#options.controlPlane.executeChangeSetCheck(actor, {
          changesetId: boundedId(payload.changesetId, 'changesetId'),
          kind,
        });
        return ok({ run: run as unknown as Record<string, unknown> });
      }
      case 'changeset.attach-evidence': {
        if (payload.kind !== 'validation' && payload.kind !== 'simulation') {
          throw new VictControlError(
            'VICT_COMMAND_FIELD_INVALID',
            "kind must be 'validation' or 'simulation'.",
          );
        }
        // The caller supplies ONLY the identity of an EXECUTED run; every
        // evidence field (outcome, timestamps, content hash, base binding,
        // runner profile, actor) is derived server-side from the durable
        // run record. Fabricated evidence cannot pass this boundary.
        const attach =
          payload.kind === 'validation'
            ? this.#options.controlPlane.attachValidationEvidence
            : this.#options.controlPlane.attachSimulationEvidence;
        return ok({
          changeset: (await attach.call(this.#options.controlPlane, actor, {
            changesetId: boundedId(payload.changesetId, 'changesetId'),
            runId: boundedId(payload.runId, 'runId'),
          })) as Record<string, unknown>,
        });
      }
      case 'changeset.decide':
        return ok({
          result: (await this.#options.controlPlane.decide(actor, {
            changesetId: boundedId(payload.changesetId, 'changesetId'),
            decision: decisionOf(payload.decision),
          })) as Record<string, unknown>,
        });
      case 'changeset.commit':
        return ok({
          result: (await this.#options.controlPlane.commit(actor, {
            changesetId: boundedId(payload.changesetId, 'changesetId'),
          })) as Record<string, unknown>,
        });
      case 'changeset.get': {
        const record = await this.#options.controlPlane.get(
          actor,
          boundedId(payload.changesetId, 'changesetId'),
        );
        if (record === undefined) {
          return { ok: false, code: 'VICT_CONTROL_CHANGESET_MISSING' };
        }
        return ok({ changeset: record as unknown as Record<string, unknown> });
      }
      case 'changeset.list':
        return ok({ changesets: await this.#options.controlPlane.list(actor) });
      case 'release.publish':
        return ok({
          release: (await this.#options.controlPlane.publishRelease(actor, {
            releaseVersion: boundedId(payload.releaseVersion, 'releaseVersion'),
            applicationId: boundedId(payload.applicationId, 'applicationId'),
            applicationVersion: boundedId(payload.applicationVersion, 'applicationVersion'),
            rendererIdentity: boundedId(payload.rendererIdentity, 'rendererIdentity'),
            componentRegistryIdentity: boundedId(
              payload.componentRegistryIdentity,
              'componentRegistryIdentity',
            ),
            dataAdapterIdentity: boundedId(payload.dataAdapterIdentity, 'dataAdapterIdentity'),
            activationBinding: boundedId(payload.activationBinding, 'activationBinding'),
          })) as Record<string, unknown>,
        });
      case 'release.select':
        return ok({
          selection: (await this.#options.controlPlane.selectRelease(actor, {
            applicationId: boundedId(payload.applicationId, 'applicationId'),
            releaseVersion: boundedId(payload.releaseVersion, 'releaseVersion'),
          })) as Record<string, unknown>,
        });
      case 'release.rollback':
        return ok({
          selection: (await this.#options.controlPlane.rollbackRelease(actor, {
            applicationId: boundedId(payload.applicationId, 'applicationId'),
            targetReleaseVersion: boundedId(payload.targetReleaseVersion, 'targetReleaseVersion'),
          })) as Record<string, unknown>,
        });
      case 'release.get-selected': {
        const release = await this.#options.controlPlane.getSelectedRelease(
          actor,
          boundedId(payload.applicationId, 'applicationId'),
        );
        if (release === undefined) {
          return { ok: false, code: 'VICT_CONTROL_RELEASE_MISSING' };
        }
        return ok({ release: release as unknown as Record<string, unknown> });
      }
      case 'activation.select': {
        // Direct activation selection (operator path): the authenticated
        // actor is asserted (activation.select scope) upstream and is the
        // ATTRIBUTED identity — never a synthetic "system" actor.
        const graphId = boundedId(payload.graphId, 'graphId');
        const activationVersion = boundedId(payload.activationVersion, 'activationVersion');
        const selection = await this.#options.controlPlane.selectActivation(actor, {
          graphId,
          activationVersion,
        });
        return ok({ selection: selection as unknown as Record<string, unknown> });
      }
      // ---- Stage 9 operator reads (WP-1): safe, bounded, scope-checked ----
      // Each helper returns the FULL outcome (ok/data or stable failure).
      case 'run.list':
        return this.#listRuns(payload);
      case 'run.get':
        return this.#getRunSafe(payload);
      case 'run.events':
        return this.#listRunEvents(payload);
      case 'run.waits':
        return this.#listRunWaits(payload);
      case 'run.detail':
        return this.#protectedRunDetail(actor, payload);
      case 'activation.list':
        return this.#listActivations(payload);
      case 'activation.get':
        return this.#getActivation(payload);
      case 'activation.selected':
        return this.#selectedActivation(payload);
      case 'release.list':
        return this.#listReleases(payload);
      case 'release.selections':
        return this.#listReleaseSelections(payload);
      case 'audit.search':
        return this.#searchAudit(payload);
      case 'run.cancel':
        return ok(await this.#cancelRun(actor, payload, idempotencyKey));
      case 'run.resolve': {
        const runResolution = this.#options.runResolution;
        if (runResolution === undefined) {
          throw new VictControlError(
            'VICT_RUN_STORE_UNAVAILABLE',
            'No run resolution executor is composed in this deployment; run resolution is unavailable.',
          );
        }
        if (
          typeof payload.resolution !== 'string' ||
          !(RUN_RESOLUTIONS as readonly string[]).includes(payload.resolution)
        ) {
          throw new VictControlError(
            'VICT_COMMAND_FIELD_INVALID',
            'resolution must use the closed vocabulary (retry, confirm_applied, fail, cancel).',
          );
        }
        const result = await runResolution.resolveBlocked({
          runId: boundedId(payload.runId, 'runId'),
          resolution: payload.resolution as RunResolution,
          actorId: actor.actorId,
          requestId: boundedId(idempotencyKey, 'requestId'),
        });
        return ok({
          result: (result ?? {}) as unknown as Record<string, unknown>,
        });
      }
      case 'run.signal': {
        const runSignals = this.#options.runSignals;
        if (runSignals === undefined) {
          throw new VictControlError(
            'VICT_RUN_STORE_UNAVAILABLE',
            'No durable signal driver is composed in this deployment; run signaling is unavailable.',
          );
        }
        return ok({
          result: (await runSignals.signalWait({
            runId: boundedId(payload.runId, 'runId'),
            signalName: boundedId(payload.signalName, 'signalName'),
            signalId: boundedId(idempotencyKey, 'signalId'),
          })) as unknown as Record<string, unknown>,
        });
      }
      case 'agent.turn.start': {
        const turnService = requireTurnService(this.#options.turnService);
        const result = (await turnService.startTurn(actor, {
          threadId: boundedId(payload.threadId, 'threadId'),
          input: boundedString(payload.input, 'input', 8000),
        })) as { turn: { turnId: string; streamId: string } };
        return ok({ turnId: result.turn.turnId, streamId: result.turn.streamId });
      }
      case 'agent.turn.cancel':
        return ok({
          result: (await requireTurnService(this.#options.turnService).cancelTurn(actor, {
            turnId: boundedId(payload.turnId, 'turnId'),
            ...(typeof payload.reasonCode === 'string' ? { reasonCode: payload.reasonCode } : {}),
          })) as Record<string, unknown>,
        });
      case 'agent.turn.get':
        return ok({
          turn: (await requireTurnService(this.#options.turnService).getTurn(
            actor,
            boundedId(payload.turnId, 'turnId'),
          )) as unknown as Record<string, unknown>,
        });
      case 'agent.tool.approve':
      case 'agent.tool.decline': {
        const decision = command === 'agent.tool.approve' ? 'approved' : 'declined';
        return ok({
          approval: (await requireTurnService(this.#options.turnService).decideToolApproval(actor, {
            approvalId: boundedId(payload.approvalId, 'approvalId'),
            decision,
            ...(typeof payload.reason === 'string' && payload.reason.length > 0
              ? { reason: boundedString(payload.reason, 'reason', 200) }
              : {}),
          })) as unknown as Record<string, unknown>,
        });
      }
      case 'stream.inspect': {
        // ACTOR-SCOPED stream inspection: identifiers of other actors are
        // never disclosed; privileged `operator.resolve` holders see all.
        const streamId = boundedId(payload.streamId, 'streamId');
        const ledger = this.#options.stores.streamLedger;
        const privileged = actor.scopes.includes('operator.resolve');
        const turnRows = await this.#options.stores.turns.listTurns();
        const ownStreamIds = new Set(
          turnRows
            .filter((turn) => privileged || turn.actorId === actor.actorId)
            .map((turn) => turn.streamId),
        );
        const owned = ownStreamIds.has(streamId);
        if (!owned) {
          // Existence is not disclosed across the actor boundary.
          return { ok: false, code: 'VICT_STREAM_ACTOR_MISMATCH' };
        }
        return ok({
          streamId,
          latestSeq: await ledger.latestSeq(streamId),
          streams: [...ownStreamIds].sort(),
        });
      }
      case 'app.data.query':
        return ok({ result: await requireAppData(this.#options.appData).query(actor, payload) });
      case 'app.data.mutate':
        return ok({ result: await requireAppData(this.#options.appData).mutate(actor, payload) });
      case 'app.data.action':
        return ok({ result: await requireAppData(this.#options.appData).mutate(actor, payload) });
      default:
        return { ok: false, code: 'VICT_COMMAND_UNKNOWN' };
    }
  }

  /** Durable, actor-authorized run cancellation over the composed store. */
  async #cancelRun(
    actor: ServerActorContext,
    payload: Record<string, unknown>,
    idempotencyKey: unknown,
  ): Promise<Record<string, unknown>> {
    const cancelRun = this.#options.controlPlane.cancelRun;
    if (cancelRun === undefined) {
      throw new VictControlError(
        'VICT_RUN_STORE_UNAVAILABLE',
        'No orchestration store is composed in this deployment; run cancellation is unavailable.',
      );
    }
    return (await cancelRun({
      runId: boundedId(payload.runId, 'runId'),
      actorId: actor.actorId,
      requestId: boundedId(
        typeof payload.reasonCode === 'string' &&
          payload.reasonCode.length > 0 &&
          idempotencyKey === undefined
          ? payload.reasonCode
          : idempotencyKey,
        'requestId',
      ),
      reasonCode: typeof payload.reasonCode === 'string' ? payload.reasonCode : 'operator',
    })) as Record<string, unknown>;
  }

  /** Durable, attributable confirmation-consumed audit (digest/identity only). */
  async #auditConsumed(
    actor: ServerActorContext,
    command: string,
    idempotencyKey: string,
    receiptId: string,
  ): Promise<void> {
    const at = (this.#options.clock ?? (() => Date.now()))();
    await this.#options.stores.control
      .appendAuditEvent({
        auditId: `audit-confirm-consumed-${receiptId}-${at}-${(this.#detailAuditSeq += 1)}`,
        at,
        actorId: actor.actorId,
        action: 'confirmation.consumed',
        subjectType: 'confirmation',
        subjectId: receiptId,
        summary: `command=${command} actor=${actor.actorId} outcome=consumed`,
      })
      .catch(() => undefined);
  }

  /** The consumed-chain outcome (classification failure) audit line. */
  async #auditConsumedOutcome(
    actor: ServerActorContext,
    command: string,
    receiptId: string,
    outcome: string,
  ): Promise<void> {
    const at = (this.#options.clock ?? (() => Date.now()))();
    await this.#options.stores.control
      .appendAuditEvent({
        auditId: `audit-confirm-outcome-${receiptId}-${at}-${(this.#detailAuditSeq += 1)}`,
        at,
        actorId: actor.actorId,
        action: 'confirmation.consumed',
        subjectType: 'confirmation',
        subjectId: receiptId,
        summary: `command=${command} actor=${actor.actorId} outcome=${outcome}`,
      })
      .catch(() => undefined);
  }

  // ---- Stage 9 operator reads (WP-1) ---------------------------------
  // Safe-summary, bounded, scope-checked reads. The generic run surface
  // NEVER discloses stored `output` (even under 'full' retention); the
  // protected `run.detail` command is the only authorized path, behind the
  // DISTINCT `run.detail` scope, a retention check, and per-access audit.

  #requireExecution(): ExecutionStore {
    const execution = this.#options.execution;
    if (execution === undefined) {
      throw new VictControlError(
        'VICT_OPERATOR_READ_UNAVAILABLE',
        'No execution store is composed in this deployment; operator run reads are unavailable.',
      );
    }
    return execution;
  }

  #requireCatalog(): ActivationCatalog {
    const catalog = this.#options.catalog;
    if (catalog === undefined) {
      throw new VictControlError(
        'VICT_OPERATOR_READ_UNAVAILABLE',
        'No activation catalog is composed in this deployment; activation reads are unavailable.',
      );
    }
    return catalog;
  }

  #requireOrchestration(): { listWaits(runId: string): Promise<readonly DurableWaitState[]> } {
    const orchestration = this.#options.orchestration;
    if (orchestration === undefined) {
      throw new VictControlError(
        'VICT_OPERATOR_READ_UNAVAILABLE',
        'No orchestration port is composed in this deployment; wait reads are unavailable.',
      );
    }
    return orchestration;
  }

  async #listRuns(payload: Record<string, unknown>): Promise<VictCommandOutcome> {
    const execution = this.#requireExecution();
    const statusFilter = payload.status;
    if (
      statusFilter !== undefined &&
      (typeof statusFilter !== 'string' ||
        !(STORED_RUN_STATUSES as readonly string[]).includes(statusFilter))
    ) {
      throw new VictControlError(
        'VICT_COMMAND_FIELD_INVALID',
        'status must use the closed durable-run status vocabulary.',
      );
    }
    const query: RunQuery = {
      ...(statusFilter !== undefined ? { status: statusFilter as StoredRunStatus } : {}),
      ...(payload.graphId !== undefined ? { graphId: boundedId(payload.graphId, 'graphId') } : {}),
      ...(payload.activationVersion !== undefined
        ? { activationVersion: boundedId(payload.activationVersion, 'activationVersion') }
        : {}),
    };
    const limit = boundedPageParam(payload.limit, 'limit', 100, 50, 1);
    const offset = boundedPageParam(payload.offset, 'offset', 10_000, 0, 0);
    const runs = await execution.listRuns(query);
    // Deterministic ordering: createdAt ascending, then runId — stable
    // across pages; the store's natural order is never relied on.
    const sorted = [...runs].sort(
      (a, b) => a.createdAt - b.createdAt || (a.runId < b.runId ? -1 : a.runId > b.runId ? 1 : 0),
    );
    const page = sorted.slice(offset, offset + limit);
    return ok({
      runs: page.map(safeRunProjection),
      total: sorted.length,
      offset,
      limit,
      hasMore: offset + page.length < sorted.length,
    });
  }

  async #getRunSafe(payload: Record<string, unknown>): Promise<VictCommandOutcome> {
    const run = await this.#requireExecution().getRun(boundedId(payload.runId, 'runId'));
    if (run === undefined) {
      // Existence of other runs is never disclosed through this command.
      return { ok: false, code: 'VICT_RUN_MISSING' };
    }
    return ok({ run: safeRunProjection(run) });
  }

  async #listRunEvents(payload: Record<string, unknown>): Promise<VictCommandOutcome> {
    const execution = this.#requireExecution();
    const runId = boundedId(payload.runId, 'runId');
    const run = await execution.getRun(runId);
    if (run === undefined) {
      return { ok: false, code: 'VICT_RUN_MISSING' };
    }
    const afterSeq = boundedPageParam(payload.afterSeq, 'afterSeq', 1_000_000_000, -1, -1);
    const limit = boundedPageParam(payload.limit, 'limit', 500, 100, 1);
    const events = await execution.listEvents(runId, afterSeq);
    const sorted = [...events].sort((a, b) => a.seq - b.seq);
    const page = sorted.slice(0, limit);
    return ok({
      runId,
      // Identity/timeline columns ONLY: the stored event payload can carry
      // retention-gated kernel material and never crosses the generic read.
      events: page.map(safeEventProjection),
      nextSeq: page.length > 0 ? (page[page.length - 1] as StoredEvent).seq : afterSeq,
      hasMore: sorted.length > page.length,
    });
  }

  async #listRunWaits(payload: Record<string, unknown>): Promise<VictCommandOutcome> {
    const execution = this.#requireExecution();
    const runId = boundedId(payload.runId, 'runId');
    const run = await execution.getRun(runId);
    if (run === undefined) {
      return { ok: false, code: 'VICT_RUN_MISSING' };
    }
    try {
      const waits = await this.#requireOrchestration().listWaits(runId);
      return ok({ runId, waits: waits.map(safeWaitProjection) });
    } catch (error) {
      // The execution store and the orchestration store are SEPARATE layers:
      // a run without an orchestration-store counterpart truthfully has no
      // orchestration waits. Real store faults propagate.
      if (error instanceof VictStoreError && error.code === 'VICT_STORE_RUN_NOT_FOUND') {
        return ok({ runId, waits: [] });
      }
      throw error;
    }
  }

  async #protectedRunDetail(
    actor: ServerActorContext,
    payload: Record<string, unknown>,
  ): Promise<VictCommandOutcome> {
    const execution = this.#requireExecution();
    const runId = boundedId(payload.runId, 'runId');
    const run = await execution.getRun(runId);
    if (run === undefined) {
      return { ok: false, code: 'VICT_RUN_MISSING' };
    }
    // PER-ACCESS AUDIT (D-5): every authorized retrieval of protected
    // material is durably attributable (actor, run, action, time).
    const at = (this.#options.clock ?? (() => Date.now()))();
    const auditEvent: ControlAuditEvent = {
      auditId: `audit-run-detail-${run.runId}-${at}-${(this.#detailAuditSeq += 1)}`,
      at,
      actorId: actor.actorId,
      action: 'run.detail.accessed',
      subjectType: 'run',
      subjectId: run.runId,
      summary: 'protected run detail retrieved under the run.detail scope',
    };
    await this.#options.stores.control.appendAuditEvent(auditEvent);
    // RETENTION CHECK (D-5): protected bytes exist only under 'full'
    // retention; a summary-retention run truthfully reports that nothing
    // is available — nothing is silently synthesized or leaked.
    if (run.retention !== 'full') {
      return ok({
        run: safeRunProjection(run),
        protectedOutput: null,
        protectedAvailable: false,
        retention: run.retention,
      });
    }
    return ok({
      run: safeRunProjection(run),
      protectedOutput: run.output ?? null,
      protectedAvailable: true,
      retention: run.retention,
    });
  }

  async #listActivations(payload: Record<string, unknown>): Promise<VictCommandOutcome> {
    const catalog = this.#requireCatalog();
    const graphId =
      payload.graphId === undefined ? undefined : boundedId(payload.graphId, 'graphId');
    const limit = boundedPageParam(payload.limit, 'limit', 200, 100, 1);
    const all = await catalog.list();
    const filtered = graphId === undefined ? all : all.filter((a) => a.graphId === graphId);
    const sorted = [...filtered].sort((a, b) => {
      if (a.createdAt !== b.createdAt) {
        return a.createdAt - b.createdAt;
      }
      return a.activationVersion < b.activationVersion
        ? -1
        : a.activationVersion > b.activationVersion
          ? 1
          : 0;
    });
    return ok({
      activations: sorted.slice(0, limit).map(safeActivationProjection),
      total: sorted.length,
    });
  }

  async #getActivation(payload: Record<string, unknown>): Promise<VictCommandOutcome> {
    const activation = await this.#requireCatalog().get(
      boundedId(payload.activationVersion, 'activationVersion'),
    );
    if (activation === undefined) {
      return { ok: false, code: 'VICT_STORE_ACTIVATION_NOT_FOUND' };
    }
    return ok({ activation: safeActivationProjection(activation) });
  }

  async #selectedActivation(payload: Record<string, unknown>): Promise<VictCommandOutcome> {
    const graphId = boundedId(payload.graphId, 'graphId');
    const selection = await this.#requireCatalog().getSelection(graphId);
    // Truthful absence (NOT an error): an unselected graph is a distinct,
    // inspectable state, never a silent fallback.
    return ok({
      graphId,
      selection:
        selection === undefined
          ? null
          : {
              graphId: selection.graphId,
              activationVersion: selection.activationVersion,
              selectionRevision: selection.selectionRevision,
              selectedAt: selection.selectedAt,
              ...(selection.operationId !== undefined
                ? { operationId: selection.operationId }
                : {}),
            },
    });
  }

  async #listReleases(payload: Record<string, unknown>): Promise<VictCommandOutcome> {
    const releases = await this.#options.stores.control.listReleases(
      boundedId(payload.applicationId, 'applicationId'),
    );
    return ok({ releases: releases as unknown as Record<string, unknown>[] });
  }

  async #listReleaseSelections(payload: Record<string, unknown>): Promise<VictCommandOutcome> {
    const selections = await this.#options.stores.control.listReleaseSelections(
      boundedId(payload.applicationId, 'applicationId'),
    );
    return ok({ selections: selections as unknown as Record<string, unknown>[] });
  }

  async #searchAudit(payload: Record<string, unknown>): Promise<VictCommandOutcome> {
    const subjectType =
      payload.subjectType === undefined ? undefined : boundedId(payload.subjectType, 'subjectType');
    const subjectId =
      payload.subjectId === undefined ? undefined : boundedId(payload.subjectId, 'subjectId');
    const limit = boundedPageParam(payload.limit, 'limit', 200, 100, 1);
    const events = await this.#options.stores.control.listAuditEvents({
      ...(subjectType !== undefined ? { subjectType } : {}),
      ...(subjectId !== undefined ? { subjectId } : {}),
    });
    // Deterministic newest-first ordering; bounded page.
    const sorted = [...events].sort(
      (a, b) => b.at - a.at || (a.auditId < b.auditId ? -1 : a.auditId > b.auditId ? 1 : 0),
    );
    return ok({
      events: sorted.slice(0, limit) as unknown as Record<string, unknown>[],
      total: sorted.length,
    });
  }
}

// ---- Stage 9 G2 — confirmation-boundary helpers (module-level) --------------

/**
 * The legacy fence: the gated mutation commands REQUIRE the `confirmation`
 * payload member in the command service itself (never the transport).
 */
function requireConfirmationMember(payload: Record<string, unknown>): void {
  if (payload['confirmation'] === undefined) {
    throw new VictControlError(
      'VICT_CONFIRMATION_REQUIRED',
      'VICT_CONFIRMATION_REQUIRED: this command requires a server-issued confirmation; call confirmation.prepare first, then re-send with confirmation{receiptId}.',
    );
  }
}

/** The presented confirmation member (shape-validated, never echoed). */
function confirmationOf(payload: Record<string, unknown>): {
  readonly receiptId: string | undefined;
  readonly malformed: boolean;
} {
  const raw = payload['confirmation'];
  if (raw === undefined) {
    return { receiptId: undefined, malformed: false };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { receiptId: undefined, malformed: true };
  }
  const record = raw as Record<string, unknown>;
  const keys = Object.keys(record);
  const receiptId = record['receiptId'];
  const malformed =
    keys.length !== 1 ||
    keys[0] !== 'receiptId' ||
    typeof receiptId !== 'string' ||
    receiptId.length === 0 ||
    receiptId.length > 128;
  return malformed ? { receiptId: undefined, malformed: true } : { receiptId, malformed: false };
}

/** The semantic (semantic-parameters) fields of a gated command. */
function semanticConfirmationFields(command: string): readonly string[] {
  const spec = (COMMAND_REGISTRY as Record<string, CommandSpec | undefined>)[command];
  return spec === undefined ? [] : spec.fields.filter((field) => field !== 'confirmation');
}

/**
 * The canonical digest over the semantic parameters of the confirmed
 * request — EXCLUDES the confirmation member itself (and the receipt id
 * inside it) and the prepare-only `expectedRevision` guard. The SAME
 * digest binds both the prepared receipt and the consuming request.
 */
function confirmationReceiptDigest(
  command: string,
  payload: Record<string, unknown>,
): string {
  const semantic: Record<string, unknown> = {};
  for (const field of semanticConfirmationFields(command)) {
    if (payload[field] !== undefined) {
      semantic[field] = payload[field];
    }
  }
  return createHash('sha256')
    .update(
      `vict.confirmation@1\u0000${toCanonicalJson({ command, payload: semantic })}`,
      'utf8',
    )
    .digest('hex');
}

/** The payload subject field of a gated command. */
function confirmationSubjectField(command: string): string {
  switch (command) {
    case 'run.cancel':
    case 'run.resolve':
    case 'run.signal':
      return 'runId';
    case 'activation.select':
      return 'graphId';
    default:
      return 'applicationId';
  }
}

/**
 * The SAFE per-command replay projection stored in the durable receipt.
 * Only stable codes, safe identifiers, and content references are
 * retained — NEVER full command responses, rationale text, application
 * rows, model content, tool data, or unrestricted payloads. An authorized
 * replay that needs the full record re-derives it from the authoritative
 * domain under the current actor's authorization.
 */
function safeResultProjection(
  command: VictCommandName,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const pick = (
    source: Record<string, unknown>,
    fields: readonly string[],
  ): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const field of fields) {
      const value = source[field];
      if (
        value !== undefined &&
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      ) {
        out[field] = value;
      }
    }
    return out;
  };
  switch (command) {
    case 'changeset.propose':
    case 'changeset.revise': {
      const changeset = (data['changeset'] ?? {}) as Record<string, unknown>;
      return {
        command,
        ...pick(changeset, ['changesetId', 'contentHash', 'status']),
      };
    }
    case 'changeset.execute-check': {
      const run = (data['run'] ?? {}) as Record<string, unknown>;
      return { command, ...pick(run, ['runId', 'kind', 'outcome']) };
    }
    case 'changeset.attach-evidence': {
      const changeset = (data['changeset'] ?? {}) as Record<string, unknown>;
      const validation = (changeset['validation'] ?? undefined) as
        Record<string, unknown> | undefined;
      const simulation = (changeset['simulation'] ?? undefined) as
        Record<string, unknown> | undefined;
      return {
        command,
        changesetId: changeset['changesetId'],
        ...(validation !== undefined && typeof validation === 'object'
          ? { validationOutcome: validation['outcome'] }
          : {}),
        ...(simulation !== undefined && typeof simulation === 'object'
          ? { simulationOutcome: simulation['outcome'] }
          : {}),
      };
    }
    case 'changeset.decide': {
      const result = (data['result'] ?? {}) as Record<string, unknown>;
      const decision = (result['decision'] ?? undefined) as Record<string, unknown> | undefined;
      return {
        command,
        changesetId: result['changesetId'],
        ...(decision !== undefined && typeof decision === 'object'
          ? pick(decision, ['decision'])
          : {}),
      };
    }
    case 'changeset.commit': {
      const result = (data['result'] ?? {}) as Record<string, unknown>;
      const record = (result['record'] ?? {}) as Record<string, unknown>;
      const applied = Array.isArray(result['applied'])
        ? (result['applied'] as unknown[]).length
        : undefined;
      return {
        command,
        changesetId: record['changesetId'],
        status: record['status'],
        ...(applied !== undefined ? { appliedCount: applied } : {}),
      };
    }
    case 'release.publish': {
      const release = (data['release'] ?? {}) as Record<string, unknown>;
      return { command, ...pick(release, ['releaseVersion', 'applicationId', 'contentHash']) };
    }
    case 'release.select':
    case 'release.rollback': {
      const selection = (data['selection'] ?? {}) as Record<string, unknown>;
      return {
        command,
        ...pick(selection, ['applicationId', 'releaseVersion', 'selectionRevision']),
      };
    }
    case 'activation.select': {
      const selection = (data['selection'] ?? {}) as Record<string, unknown>;
      return { command, ...pick(selection, ['graphId', 'activationVersion', 'selectionRevision']) };
    }
    case 'run.cancel': {
      return { command, ...pick(data, ['runId', 'status']) };
    }
    case 'run.resolve': {
      const result = (data['result'] ?? data) as Record<string, unknown>;
      return { command, ...pick(result, ['runId', 'resolution', 'status']) };
    }
    case 'run.signal': {
      const result = (data['result'] ?? data) as Record<string, unknown>;
      return { command, ...pick(result, ['runId', 'signalName', 'status']) };
    }
    case 'agent.turn.start':
      return { command, ...pick(data, ['turnId', 'streamId']) };
    case 'agent.turn.cancel': {
      const result = (data['result'] ?? {}) as Record<string, unknown>;
      return { command, ...pick(result, ['turnId', 'status']) };
    }
    case 'agent.tool.approve':
    case 'agent.tool.decline': {
      const approval = (data['approval'] ?? {}) as Record<string, unknown>;
      return { command, ...pick(approval, ['approvalId', 'status']) };
    }
    case 'app.data.mutate':
    case 'app.data.action':
      // Application mutation results live in the AUTHORITATIVE application
      // domain: only the requested identities are referenced here.
      return {
        command,
        ...pick(data, ['resourceId', 'releaseVersion']),
      };
    default:
      return { command };
  }
}

/** Enforce one matrix scope (fail closed; stable non-echoing denial). */
function assertCommandScope(actor: ServerActorContext, scope: string): void {
  if (!actor.scopes.includes(scope as never)) {
    throw new VictControlError('VICT_ACTOR_SCOPE_DENIED', `the required scope is not held.`);
  }
}

/** Dispatch-level health of the composed turn service. */
function requireTurnService(turnService: TurnServiceLike | undefined): TurnServiceLike {
  if (turnService === undefined) {
    throw new VictControlError(
      'VICT_TURN_EXECUTOR_UNAVAILABLE',
      'No agent-turn service is composed in this deployment; turn commands are unavailable.',
    );
  }
  return turnService;
}

function requireAppData(appData: AppDataPort | undefined): AppDataPort {
  if (appData === undefined) {
    throw new VictControlError(
      'VICT_APPDATA_UNAVAILABLE',
      'No Application data adapter is composed in this deployment.',
    );
  }
  return appData;
}

// ---- Closed payload validation helpers -------------------------------------

function validateBase(base: unknown): {
  kind: 'activation' | 'release';
  subjectId: string;
  expectedVersion: string;
} {
  if (typeof base !== 'object' || base === null) {
    throw new VictControlError('VICT_COMMAND_FIELD_INVALID', 'base must be an object.');
  }
  const candidate = base as Record<string, unknown>;
  if (candidate.kind !== 'activation' && candidate.kind !== 'release') {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      'base.kind must be activation or release.',
    );
  }
  return {
    kind: candidate.kind,
    subjectId: boundedId(candidate.subjectId, 'base.subjectId'),
    expectedVersion: boundedId(candidate.expectedVersion, 'base.expectedVersion'),
  };
}

function requireArray(value: unknown, field: string, min: number, max: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      `${field} must be an array of ${min}..${max} items.`,
    );
  }
  return value;
}

function riskClass(value: unknown): 'low' | 'medium' | 'high' {
  if (value !== 'low' && value !== 'medium' && value !== 'high') {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      'riskClass must be low, medium, or high.',
    );
  }
  return value;
}

function approverCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 8) {
    throw new VictControlError('VICT_COMMAND_FIELD_INVALID', 'requiredApproverCount must be 1..8.');
  }
  return value;
}

function boundedTimestamp(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      `${field} must be an epoch-ms integer.`,
    );
  }
  return value;
}

function decisionOf(value: unknown): 'approved' | 'declined' {
  if (value !== 'approved' && value !== 'declined') {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      'decision must be approved or declined.',
    );
  }
  return value;
}

function ok(data: Record<string, unknown>): VictCommandOutcome {
  return { ok: true, data };
}

/** The ControlPlanePort: the control-plane surface the server composes. */
export interface ControlPlanePort {
  propose(
    actor: ServerActorContext,
    input: {
      changesetId: string;
      base: { kind: 'activation' | 'release'; subjectId: string; expectedVersion: string };
      operations: readonly unknown[];
      rationale: string;
      riskClass: 'low' | 'medium' | 'high';
      requiredApproverCount: number;
      expiresAt: number;
    },
  ): Promise<unknown>;
  revise(actor: ServerActorContext, input: Record<string, unknown>): Promise<unknown>;
  executeChangeSetCheck(
    actor: ServerActorContext,
    input: { changesetId: string; kind: 'validation' | 'simulation' },
  ): Promise<unknown>;
  attachValidationEvidence(
    actor: ServerActorContext,
    input: { changesetId: string; runId: string },
  ): Promise<unknown>;
  attachSimulationEvidence(
    actor: ServerActorContext,
    input: { changesetId: string; runId: string },
  ): Promise<unknown>;
  decide(
    actor: ServerActorContext,
    input: { changesetId: string; decision: 'approved' | 'declined' },
  ): Promise<unknown>;
  commit(actor: ServerActorContext, input: { changesetId: string }): Promise<unknown>;
  decline(actor: ServerActorContext, input: { changesetId: string }): Promise<unknown>;
  get(actor: ServerActorContext, changesetId: string): Promise<unknown>;
  list(actor: ServerActorContext): Promise<unknown>;
  publishRelease(actor: ServerActorContext, content: Record<string, unknown>): Promise<unknown>;
  selectRelease(actor: ServerActorContext, input: Record<string, unknown>): Promise<unknown>;
  rollbackRelease(actor: ServerActorContext, input: Record<string, unknown>): Promise<unknown>;
  getSelectedRelease(actor: ServerActorContext, applicationId: string): Promise<unknown>;
  auditTrail(subject: {
    subjectType?: string;
    subjectId?: string;
  }): Promise<readonly ControlAuditEvent[]>;
  selectActivation(
    actor: ServerActorContext,
    input: { graphId: string; activationVersion: string },
  ): Promise<unknown>;
  cancelRun?(input: {
    runId: string;
    actorId: string;
    requestId: string;
    reasonCode: string;
  }): Promise<unknown>;
}
