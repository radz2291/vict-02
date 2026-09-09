import { createHash } from 'node:crypto';
import {
  validateAgentStreamEvent,
  type AgentStreamEvent,
  type AgentStreamEventKind,
} from '@victframework/contracts';
import type { EffectClass } from '@victframework/kernel';
import { toCanonicalJson } from './serialization.js';

/**
 * Stage 06B — neutral control-plane and governed-remote-execution ports.
 *
 * This module defines the durable records, closed state machines, and store
 * ports for:
 *
 * - authenticated actors, roles, and scopes (SEC-001/SEC-002; default deny);
 * - ChangeSets with immutable content identity, evidence, approvals,
 *   expiry, and forward-only status (CTRL-001..CTRL-007);
 * - Application Release publish/select/rollback over immutable versions;
 * - audit events for every attributable transition;
 * - durable agent turns, tool invocations (durable-before-invocation), and
 *   VICT-authoritative approval records (AI-006/AI-007/MSTR-005);
 * - the durable agent-stream ledger (per-stream monotonic sequences,
 *   durable milestones, transient deltas — AI-009, `vict.agent-stream@1`).
 *
 * In-memory reference implementations live in `control-in-memory.ts`; the
 * SQLite adapter implements the same ports in `@victframework/store-sqlite` and both
 * pass the shared conformance suite (`control-conformance.ts`).
 *
 * These are NEUTRAL ports: no Mastra, HTTP, transport, or provider type
 * appears here.
 */

// ---- Identifier and hashing primitives -------------------------------------

/** Bounded namespace identifier for control-plane and agent records. */
export const CONTROL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;

/** Validate one bounded namespace identifier (throws a stable error). */
export function assertControlId(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !CONTROL_ID_PATTERN.test(value)) {
    throw new VictControlError(
      'VICT_CONTROL_ID_INVALID',
      `${field} must be a bounded namespace identifier (at most 128 characters; letters, digits, '.', '_', ':', '@', '-').`,
    );
  }
}

/** Stable bounded safe-integer validation. */
export function assertControlTimestamp(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new VictControlError(
      'VICT_CONTROL_TIMESTAMP_INVALID',
      `${field} must be a finite epoch-ms integer.`,
    );
  }
}

/**
 * Stable content identity over strict canonical data. The canonicalizer is
 * the Stage 01 verified canonical JSON; identity MUST NOT be derived from
 * function text, timestamps of capture, or mutable objects.
 */
export function controlContentHash(payload: unknown): string {
  // A versioned prefix keeps content identities domain-scoped.
  return `v1_${sha256Hex(`vict.control-content@1\u0000${toCanonicalJson(payload)}`)}`;
}

/** Bounded safe string field (rationales, summaries, reason codes). */
export function assertBoundedString(
  value: unknown,
  field: string,
  max: number,
  allowEmpty = false,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    (value.length === 0 && !allowEmpty) ||
    value.length > max ||
    // Control characters and other unsafe content are rejected; the value
    // itself is never echoed into diagnostics.
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)
  ) {
    throw new Error(
      `VICT_CONTROL_FIELD_INVALID: ${field} must be a bounded string of at most ${max} characters without control characters.`,
    );
  }
}

function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

// ---- Actors, roles, and scopes ---------------------------------------------

/** The closed reference role vocabulary (system reference §14.2). */
export const ACTOR_ROLES = [
  'viewer',
  'developer',
  'operator',
  'approver',
  'administrator',
] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

/** The closed scope vocabulary enforced below the HTTP/CLI/UI layers. */
export const ACTOR_SCOPES = [
  'changeset.propose',
  'changeset.revise',
  'changeset.approve',
  'changeset.commit',
  'changeset.read',
  'release.publish',
  'release.select',
  'release.read',
  'activation.select',
  'activation.read',
  'run.read',
  'run.cancel',
  'operator.resolve',
  'agent.turn.start',
  'agent.turn.cancel',
  'agent.tool.approve',
  'agent.tool.decline',
  'agent.stream.read',
  'app.data.read',
  'app.data.write',
  'conversation.read',
  'conversation.delete',
  'audit.read',
] as const;
export type ActorScope = (typeof ACTOR_SCOPES)[number];

/** Deterministic role → scope policy (default policy is denial). */
export const ROLE_SCOPES: Readonly<Record<ActorRole, readonly ActorScope[]>> = {
  viewer: ['changeset.read', 'release.read', 'activation.read', 'run.read', 'audit.read'],
  developer: [
    'changeset.read',
    'changeset.propose',
    'changeset.revise',
    'release.read',
    'activation.read',
    'run.read',
    'agent.turn.start',
    'agent.turn.cancel',
    'agent.stream.read',
    'app.data.read',
    'audit.read',
  ],
  operator: [
    'changeset.read',
    'release.read',
    'release.select',
    'activation.read',
    'activation.select',
    'run.read',
    'run.cancel',
    'operator.resolve',
    'agent.turn.cancel',
    'agent.stream.read',
    'app.data.read',
    'app.data.write',
    'conversation.read',
    'conversation.delete',
    'audit.read',
  ],
  approver: [
    'changeset.read',
    'changeset.approve',
    'agent.tool.approve',
    'agent.tool.decline',
    'release.read',
    'activation.read',
    'run.read',
    'audit.read',
  ],
  administrator: [...ACTOR_SCOPES],
};

export type ActorStatus = 'active' | 'disabled';

/** One authoritative actor record (server-side truth, never client-supplied). */
export interface ActorRecord {
  readonly actorId: string;
  readonly status: ActorStatus;
  readonly roles: readonly ActorRole[];
  /** Epoch-ms creation time from the injected clock. */
  readonly createdAt: number;
}

/** Port resolving actor records from the authoritative directory. */
export interface ActorDirectory {
  get(actorId: string): Promise<ActorRecord | undefined>;
  list(): Promise<readonly ActorRecord[]>;
  upsert(record: ActorRecord): Promise<void>;
}

/**
 * Derive the permitted scopes of one actor record. Unknown, disabled, and
 * malformed actors fail closed: no scopes are derived. Roles outside the
 * closed vocabulary are ignored (fail closed, never widened).
 */
export function authoritativeScopes(actor: ActorRecord | undefined): readonly ActorScope[] {
  if (actor === undefined || actor.status !== 'active') {
    return [];
  }
  const scopes = new Set<ActorScope>();
  for (const role of actor.roles) {
    if (!(ACTOR_ROLES as readonly string[]).includes(role)) {
      continue;
    }
    for (const scope of ROLE_SCOPES[role]) {
      scopes.add(scope);
    }
  }
  return [...scopes].sort();
}

/** Authoritative server-side actor context (the ONLY identity authority). */
export interface AuthenticatedActorContext {
  readonly actorId: string;
  readonly roles: readonly ActorRole[];
  readonly scopes: readonly ActorScope[];
  /**
   * The permitted Mastra memory identity, derived ONLY from the
   * authenticated VICT actor (MSTR-007): `vict-actor-<actorId>`.
   */
  readonly mastraResourceId: string;
}

/**
 * Derive the authoritative server context from a resolved actor record.
 * Unknown, disabled, malformed, or mismatched actors fail closed.
 */
export function authenticatedActorContext(
  actor: ActorRecord | undefined,
  requestedActorId: string,
): AuthenticatedActorContext {
  // Mismatch between the authenticated identity and any requested actor id
  // is denied: the authenticated record is the only authority.
  if (actor === undefined || actor.status !== 'active' || actor.actorId !== requestedActorId) {
    throw new VictControlError(
      'VICT_ACTOR_UNAUTHENTICATED',
      'VICT_ACTOR_UNAUTHENTICATED: the actor could not be authenticated.',
    );
  }
  assertControlId(actor.actorId, 'actorId');
  return {
    actorId: actor.actorId,
    roles: [...actor.roles],
    scopes: authoritativeScopes(actor),
    mastraResourceId: `vict-actor-${actor.actorId}`,
  };
}

/** Stable authorization denial (never echoes the attempted operation's payload). */
export class ActorScopeDeniedError extends Error {
  readonly code = 'VICT_ACTOR_SCOPE_DENIED';
  readonly scope: string;
  constructor(scope: string) {
    super(`VICT_ACTOR_SCOPE_DENIED: the authenticated actor does not hold the '${scope}' scope.`);
    this.name = 'ActorScopeDeniedError';
    this.scope = scope;
  }
}

/** Enforce one scope (fail closed; stable non-echoing denial). */
export function assertActorScope(context: AuthenticatedActorContext, scope: ActorScope): void {
  if (!context.scopes.includes(scope)) {
    throw new ActorScopeDeniedError(scope);
  }
}

/** In-memory ActorDirectory (tests and local compositions). */
export class InMemoryActorDirectory implements ActorDirectory {
  readonly #actors = new Map<string, ActorRecord>();

  async get(actorId: string): Promise<ActorRecord | undefined> {
    const record = this.#actors.get(actorId);
    return record === undefined ? undefined : { ...record, roles: [...record.roles] };
  }

  async list(): Promise<readonly ActorRecord[]> {
    return [...this.#actors.values()]
      .sort((a, b) => (a.actorId < b.actorId ? -1 : 1))
      .map((record) => ({ ...record, roles: [...record.roles] }));
  }

  async upsert(record: ActorRecord): Promise<void> {
    assertControlId(record.actorId, 'actorId');
    if (record.status !== 'active' && record.status !== 'disabled') {
      throw new VictControlError(
        'VICT_CONTROL_FIELD_INVALID',
        'actor status must be active or disabled.',
      );
    }
    if (!Array.isArray(record.roles)) {
      throw new VictControlError('VICT_CONTROL_FIELD_INVALID', 'actor roles must be an array.');
    }
    for (const role of record.roles) {
      if (!(ACTOR_ROLES as readonly string[]).includes(role)) {
        throw new VictControlError(
          'VICT_CONTROL_FIELD_INVALID',
          'actor roles must use the closed role vocabulary.',
        );
      }
    }
    assertControlTimestamp(record.createdAt, 'actor.createdAt');
    this.#actors.set(record.actorId, { ...record, roles: [...record.roles] });
  }
}

// ---- ChangeSets --------------------------------------------------------------

/** The versioned ChangeSet schema marker. */
export const CHANGESET_SCHEMA = 'vict.changeset@1';

/** Risk/effect classification of a proposed change. */
export type ChangeSetRiskClass = 'low' | 'medium' | 'high';

/** Closed typed operation: a reference to immutable published identity. */
export type ChangeSetOperation =
  | {
      readonly kind: 'select-activation';
      readonly graphId: string;
      readonly activationVersion: string;
    }
  | {
      kind: 'rollback-activation';
      graphId: string;
      targetActivationVersion: string;
    }
  | {
      kind: 'publish-and-select-release';
      release: ApplicationReleaseContent;
    }
  | { kind: 'select-release'; applicationId: string; releaseVersion: string }
  | {
      kind: 'rollback-release';
      applicationId: string;
      targetReleaseVersion: string;
    };

/** The closed immutable release content a ChangeSet may publish. */
export type ApplicationReleaseContent = Pick<
  ApplicationReleaseRecord,
  | 'releaseVersion'
  | 'applicationId'
  | 'applicationVersion'
  | 'rendererIdentity'
  | 'componentRegistryIdentity'
  | 'dataAdapterIdentity'
  | 'activationBinding'
>;

/** Validation evidence attached to a ChangeSet (bound to an EXECUTED run). */
export interface ChangeSetValidationEvidence {
  /** Identity of the authoritative VICT-executed validation run. */
  readonly runId: string;
  readonly outcome: 'passed' | 'failed';
  readonly recordedAt: number;
  /** The EXACT ChangeSet content identity the run was executed against. */
  readonly contentHash: string;
  /** The EXACT expected base identity the run was executed against. */
  readonly base: ChangeSetBase;
  /** The runner/profile version identity that executed the run. */
  readonly runnerProfile: string;
  /** The authenticated actor for whom the run was executed. */
  readonly actorId: string;
}

/** Simulation evidence attached to a ChangeSet (bound to an EXECUTED run). */
export interface ChangeSetSimulationEvidence {
  /** Identity of the authoritative VICT-executed simulation run. */
  readonly runId: string;
  readonly outcome: 'passed' | 'failed' | 'blocked';
  readonly recordedAt: number;
  /** The EXACT ChangeSet content identity the run was executed against. */
  readonly contentHash: string;
  /** The EXACT expected base identity the run was executed against. */
  readonly base: ChangeSetBase;
  /** The runner/profile version identity that executed the run. */
  readonly runnerProfile: string;
  /** The authenticated actor for whom the run was executed. */
  readonly actorId: string;
}

/** Forward-only ChangeSet status. `applying` is a DURABLE, non-final
 * state: a commit whose operations are being applied (saga). A failure
 * inside `applying` leaves the record truthfully `applying` — never a
 * falsely final state — and deterministic recovery completes it. */
export type ChangeSetStatus =
  'draft' | 'approved' | 'applying' | 'committed' | 'declined' | 'expired';

/** One proposed, version-guarded control-plane change. */
export interface ChangeSetRecord {
  readonly changesetId: string;
  readonly schema: typeof CHANGESET_SCHEMA;
  readonly authorActorId: string;
  readonly createdAt: number;
  /** The exact expected base identity/version (concurrency guard). */
  readonly base: ChangeSetBase;
  /** Closed, typed operations (never executable functions or JSON patches). */
  readonly operations: readonly ChangeSetOperation[];
  /** Rationale or safe reference (bounded, no payloads). */
  readonly rationale: string;
  readonly riskClass: ChangeSetRiskClass;
  /** Required approval policy (count of distinct approvers). */
  readonly requiredApproverCount: number;
  /** Epoch-ms expiry of the proposal. */
  readonly expiresAt: number;
  readonly validation: ChangeSetValidationEvidence | undefined;
  readonly simulation: ChangeSetSimulationEvidence | undefined;
  /** Immutable content identity — approvals bind to EXACTLY this hash. */
  readonly contentHash: string;
  readonly status: ChangeSetStatus;
}

/** The sentinel base version meaning 'no version is currently selected'. */
export const CHANGESET_BASE_NONE = 'none';

/** The expected base identity/version of a ChangeSet. */
export interface ChangeSetBase {
  readonly kind: 'activation' | 'release';
  /** The graphId (for activations) or applicationId (for releases). */
  readonly subjectId: string;
  /** The expected currently-selected version at proposal and commit time. */
  readonly expectedVersion: string;
}

/** One control-plane approval decision (bound to the exact content hash). */
export interface ChangeSetApprovalDecision {
  readonly approvalId: string;
  readonly changesetId: string;
  /** The exact content hash the decision binds to. */
  readonly contentHash: string;
  readonly approverActorId: string;
  readonly decision: 'approved' | 'declined';
  readonly decidedAt: number;
}

// ---- Authoritative governance runs (trusted executed VICT boundary) --------

/** The closed governance-run vocabulary. */
export type ControlRunKind = 'validation' | 'simulation';

/**
 * One authoritative validation/simulation run EXECUTED by the trusted VICT
 * boundary. Run records are the ONLY source from which ChangeSet evidence
 * may be derived; caller-claimed evidence is verified against these
 * durable records before it can authorize a commit.
 */
export interface ControlRunRecord {
  readonly runId: string;
  readonly kind: ControlRunKind;
  /** The ChangeSet subject the run was executed against. */
  readonly changesetId: string;
  /** The EXACT content identity the run was executed against. */
  readonly contentHash: string;
  /** The EXACT expected base identity at run time. */
  readonly base: ChangeSetBase;
  /** The EXACT operation set the run covered (canonical content). */
  readonly operations: readonly ChangeSetOperation[];
  /** The runner/profile version identity that executed the run. */
  readonly runnerProfile: string;
  /** The authenticated actor the run was executed for. */
  readonly actorId: string;
  readonly outcome: 'passed' | 'failed' | 'blocked';
  /** Epoch-ms execution time from the injected clock. */
  readonly createdAt: number;
  /** The EXACT observed subject base at run time (what the run verified):
   * the currently selected version for the subject, with the
   * `CHANGESET_BASE_NONE` sentinel for explicit absence. This proves what
   * base the run actually checked (never a caller claim). */
  readonly observedBase?: ChangeSetBase;
  /** Simulation-run detail: the exact simulation inputs, per-operation
   * identities and outcomes of the sandboxed execution (IDs and outcomes
   * only — never payloads). Validation runs carry `undefined`. */
  readonly detail?: ControlRunDetail;
}

/** Per-operation simulation outcome (operation identity + outcome only). */
export interface ControlRunOperationOutcome {
  readonly operationIndex: number;
  readonly operationDigest: string;
  readonly outcome: 'applied' | 'failed' | 'blocked';
  /** Stable sanitized code when not applied. */
  readonly code?: string;
}

/** The safe detail record of an executed simulation run. */
export interface ControlRunDetail {
  readonly simulator: string;
  /** The exact sandbox inputs: the subject base and activation/release
   * inputs derived from durable state at simulation time (IDs only). */
  readonly inputs: {
    readonly base: ChangeSetBase;
    readonly operationIdentities: readonly string[];
  };
  readonly operations: readonly ControlRunOperationOutcome[];
}

/** One durable receipt of a single applied ChangeSet operation (saga).
 *
 * The receipt is written in TWO states that make the external effect
 * exactly-once even across a crash between effect and receipt:
 *
 * - `prepared`: the durable OPERATION INTENT, recorded BEFORE the effect
 *   runs. It carries the stable operation identity and the subject guard
 *   (fencing data) captured at prevalidation.
 * - `applied`: recorded after the effect (atomically with it where the
 *   effect shares the store's transaction boundary).
 *
 * Recovery verifies the TARGET state for prepared intents (a selection
 * with the same operation identity already applied) and never repeats the
 * effect: it either confirms the target state and marks the receipt
 * applied, or re-applies through the same idempotent/fenced effect path.
 */
export interface ChangeSetOperationReceipt {
  readonly changesetId: string;
  /** Zero-based index of the operation inside the ChangeSet. */
  readonly operationIndex: number;
  readonly operationKind: ChangeSetOperation['kind'];
  /** Stable operation identity: derived from ChangeSet ID, content hash,
   * operation index, and the exact operation content. */
  readonly operationDigest: string;
  /** Stable identity of the applied effect (idempotency anchor). */
  readonly effectRef: string;
  readonly actorId: string;
  readonly appliedAt: number;
  /** `prepared` (intent, pre-effect) or `applied` (post-effect). */
  readonly state: 'prepared' | 'applied';
  /** Serialized subject guard (expected base/selection revision) captured
   * at intent time; re-used verbatim by idempotent re-application. */
  readonly guardJson: string | undefined;
}

/** Derive the stable operation identity for one ChangeSet operation. */
export function changeSetOperationIdentity(input: {
  changesetId: string;
  contentHash: string;
  operationIndex: number;
  operation: ChangeSetOperation;
}): string {
  return controlContentHash({
    domain: 'vict.changeset-operation@1',
    changesetId: input.changesetId,
    contentHash: input.contentHash,
    operationIndex: input.operationIndex,
    operation: input.operation,
  });
}

/**
 * The CLOSED structural vocabulary of one ChangeSet operation kind: every
 * kind declares its EXACT required own members. A declaration that misses
 * a member, adds a member, or mistypes a member is malformed and can
 * never reach a content hash or a durable record.
 */
const CHANGESET_OPERATION_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'select-activation': ['kind', 'graphId', 'activationVersion'],
  'rollback-activation': ['kind', 'graphId', 'targetActivationVersion'],
  'publish-and-select-release': ['kind', 'release'],
  'select-release': ['kind', 'applicationId', 'releaseVersion'],
  'rollback-release': ['kind', 'applicationId', 'targetReleaseVersion'],
};

/**
 * The exact declared members of the ChangeSet base (closed structure).
 */
const CHANGESET_BASE_FIELDS: readonly string[] = ['kind', 'subjectId', 'expectedVersion'];

/**
 * Capture a CLOSED plain-data record without ever invoking caller code or
 * echoing captured values:
 *
 * - the value must be a non-null, non-array object whose prototype is
 *   exactly `Object.prototype` (or null) — class instances, exotic
 *   prototypes, and structs smuggled through exotic prototypes fail;
 * - property enumeration, `Reflect.ownKeys`, and descriptor reads are
 *   guarded — a hostile proxy that throws is rejected without a raw
 *   exception crossing the boundary;
 * - OWN string-keyed ENUMERABLE data properties only: accessors
 *   (getters/setters), inherited members, non-enumerable fields, and
 *   symbol keys are rejected, and getters are NEVER invoked (values are
 *   read exclusively through the captured property descriptor).
 * - the field set must be EXACTLY the declared closed set.
 *
 * The returned capture is a freshly allocated plain object owned by VICT
 * (the caller's object is never retained, frozen, or mutated).
 */
export function captureClosedControlRecord(
  raw: unknown,
  field: string,
  allowed: readonly string[] | undefined,
): Record<string, unknown> {
  // Every inspection primitive — including `Array.isArray`, which THROWS on
  // a revoked Proxy — is guarded: no raw exception ever crosses the boundary.
  let arrayLike: boolean;
  try {
    arrayLike = Array.isArray(raw);
  } catch {
    throw new VictControlError(
      'VICT_CONTROL_STRUCTURE_INVALID',
      `The ${field} could not be inspected; hostile containers are rejected.`,
    );
  }
  if (typeof raw !== 'object' || raw === null || arrayLike) {
    throw new VictControlError(
      'VICT_CONTROL_STRUCTURE_INVALID',
      `The ${field} must be a plain object with a closed field set.`,
    );
  }
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(raw);
  } catch {
    throw new VictControlError(
      'VICT_CONTROL_STRUCTURE_INVALID',
      `The ${field} could not be inspected; hostile containers are rejected.`,
    );
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new VictControlError(
      'VICT_CONTROL_STRUCTURE_INVALID',
      `The ${field} must be a plain data record; exotic prototypes are rejected.`,
    );
  }
  let ownKeys: PropertyKey[];
  try {
    ownKeys = Reflect.ownKeys(raw);
  } catch {
    throw new VictControlError(
      'VICT_CONTROL_STRUCTURE_INVALID',
      `The ${field} could not be enumerated; hostile containers are rejected.`,
    );
  }
  const capture: Record<string, unknown> = {};
  for (const key of ownKeys) {
    if (typeof key !== 'string') {
      throw new VictControlError(
        'VICT_CONTROL_STRUCTURE_INVALID',
        `The ${field} declares a symbol key; only plain data properties are accepted.`,
      );
    }
    if (allowed !== undefined && !allowed.includes(key)) {
      throw new VictControlError(
        'VICT_CONTROL_STRUCTURE_INVALID',
        `The ${field} declares a field outside the closed structure.`,
      );
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(raw, key);
    } catch {
      throw new VictControlError(
        'VICT_CONTROL_STRUCTURE_INVALID',
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
        'VICT_CONTROL_STRUCTURE_INVALID',
        `The ${field} declares an accessor, inherited, or non-enumerable member; only own enumerable data properties are accepted.`,
      );
    }
    capture[key] = descriptor.value;
  }
  for (const required of allowed ?? []) {
    if (!(required in capture)) {
      throw new VictControlError(
        'VICT_CONTROL_STRUCTURE_INVALID',
        `The ${field} is missing a required member of the closed structure.`,
      );
    }
  }
  return capture;
}

/**
 * Capture a CLOSED dense array without ever invoking caller code:
 *
 * - the value must be a REAL array (`Array.isArray` under a guard — a
 *   revoked Proxy throws there — whose prototype is exactly
 *   `Array.prototype`);
 * - the `length` is read through its OWN DESCRIPTOR under a guard (never a
 *   `get`, which would be a caller-controlled trap): it must be an own
 *   DATA property carrying a safe integer within [1, maxLength];
 * - `Reflect.ownKeys` (guarded) must declare EXACTLY the length and the
 *   dense index keys: extra string or symbol properties, sparse holes,
 *   non-enumerable indices, accessors, and hostile enumeration/descriptor
 *   traps are ALL rejected;
 * - elements are captured exclusively through their guarded own property
 *   DESCRIPTORS (enumerable data properties only) — caller `.map()`,
 *   iterators, getters, and index `get` traps are never consulted.
 *
 * The returned array is freshly allocated and owned by VICT (the caller's
 * array is never retained, frozen, or aliased).
 */
export function captureClosedControlArray(
  raw: unknown,
  field: string,
  maxLength: number,
): readonly unknown[] {
  let arrayLike: boolean;
  try {
    arrayLike = Array.isArray(raw);
  } catch {
    throw new VictControlError(
      'VICT_CONTROL_STRUCTURE_INVALID',
      `The ${field} could not be inspected; hostile containers are rejected.`,
    );
  }
  if (!arrayLike) {
    throw new VictControlError(
      'VICT_CONTROL_STRUCTURE_INVALID',
      `The ${field} must be an array with a closed dense structure.`,
    );
  }
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(raw as object);
  } catch {
    throw new VictControlError(
      'VICT_CONTROL_STRUCTURE_INVALID',
      `The ${field} could not be inspected; hostile containers are rejected.`,
    );
  }
  if (prototype !== Array.prototype) {
    throw new VictControlError(
      'VICT_CONTROL_STRUCTURE_INVALID',
      `The ${field} must be a plain array; exotic prototypes are rejected.`,
    );
  }
  // The length is inspected through its guarded own DESCRIPTOR — never a
  // caller-controlled `get`.
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    lengthDescriptor = Object.getOwnPropertyDescriptor(raw as object, 'length');
  } catch {
    throw new VictControlError(
      'VICT_CONTROL_STRUCTURE_INVALID',
      `The ${field} could not be inspected; hostile containers are rejected.`,
    );
  }
  if (
    lengthDescriptor === undefined ||
    lengthDescriptor.get !== undefined ||
    lengthDescriptor.set !== undefined ||
    typeof lengthDescriptor.value !== 'number' ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 1 ||
    lengthDescriptor.value > maxLength
  ) {
    throw new VictControlError(
      'VICT_CONTROL_STRUCTURE_INVALID',
      `The ${field} length is outside the closed bounded structure.`,
    );
  }
  const length = lengthDescriptor.value;
  // The declared key set must be EXACTLY the dense index set plus length.
  let ownKeys: PropertyKey[];
  try {
    ownKeys = Reflect.ownKeys(raw as object);
  } catch {
    throw new VictControlError(
      'VICT_CONTROL_STRUCTURE_INVALID',
      `The ${field} could not be enumerated; hostile containers are rejected.`,
    );
  }
  const expectedKeys = new Set<PropertyKey>(['length']);
  for (let index = 0; index < length; index += 1) {
    expectedKeys.add(String(index));
  }
  if (ownKeys.length !== expectedKeys.size) {
    throw new VictControlError(
      'VICT_CONTROL_STRUCTURE_INVALID',
      `The ${field} declares members outside the closed dense structure.`,
    );
  }
  for (const key of ownKeys) {
    if (!expectedKeys.has(key)) {
      throw new VictControlError(
        'VICT_CONTROL_STRUCTURE_INVALID',
        `The ${field} declares a member outside the closed dense structure.`,
      );
    }
  }
  // Dense capture: every index must be an OWN ENUMERABLE DATA property read
  // through its guarded descriptor (accessors, holes, and non-enumerable
  // indices are rejected; caller getters are never invoked).
  const capture: unknown[] = new Array(length);
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(raw as object, String(index));
    } catch {
      throw new VictControlError(
        'VICT_CONTROL_STRUCTURE_INVALID',
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
        'VICT_CONTROL_STRUCTURE_INVALID',
        `The ${field} must be a dense array of own enumerable data elements.`,
      );
    }
    capture[index] = descriptor.value;
  }
  return capture;
}

/** Validate a required bounded string identifier member (exact type). */
function requireBoundedMember(capture: Record<string, unknown>, field: string): string {
  const value = capture[field];
  if (typeof value !== 'string') {
    throw new VictControlError(
      'VICT_CONTROL_FIELD_INVALID',
      `The member '${field}' must be a string.`,
    );
  }
  assertControlId(value, field);
  return value;
}

/**
 * Validate the structural shape of one ChangeSet operation (fail closed).
 *
 * EVERY required member of the operation kind is enforced with its exact
 * runtime type, non-empty bounded identifier form, and the closed own-field
 * set. Accessors, inherited/non-enumerable members, symbols, exotic
 * prototypes, and hostile proxies are rejected WITHOUT invoking getters or
 * echoing captured values. Only the validated VICT-owned canonical capture
 * is returned/hashed — never the original caller object.
 */
export function validateChangeSetOperation(operation: unknown): ChangeSetOperation {
  // Structural capture FIRST (closed plain-data discipline, no field-set
  // restriction yet) to read the kind identity WITHOUT invoking getters.
  const structure = captureClosedControlRecord(operation, 'ChangeSet operation', undefined);
  if (typeof structure.kind !== 'string' || !(structure.kind in CHANGESET_OPERATION_FIELDS)) {
    throw new VictControlError(
      'VICT_CONTROL_OPERATION_INVALID',
      'The ChangeSet operation kind is outside the closed vocabulary.',
    );
  }
  const kindCapture = structure.kind;
  const allowed = CHANGESET_OPERATION_FIELDS[kindCapture] as readonly string[];
  // Re-capture with the EXACT closed field set for the resolved kind.
  const capture = captureClosedControlRecord(operation, 'ChangeSet operation', allowed);
  if (capture.kind !== kindCapture) {
    throw new VictControlError(
      'VICT_CONTROL_OPERATION_INVALID',
      'The ChangeSet operation kind must be a stable string identity.',
    );
  }
  switch (kindCapture) {
    case 'select-activation':
      return {
        kind: 'select-activation',
        graphId: requireBoundedMember(capture, 'graphId'),
        activationVersion: requireBoundedMember(capture, 'activationVersion'),
      };
    case 'rollback-activation':
      return {
        kind: 'rollback-activation',
        graphId: requireBoundedMember(capture, 'graphId'),
        targetActivationVersion: requireBoundedMember(capture, 'targetActivationVersion'),
      };
    case 'publish-and-select-release':
      return {
        kind: 'publish-and-select-release',
        release: validateApplicationReleaseContent(capture.release),
      };
    case 'select-release':
      return {
        kind: 'select-release',
        applicationId: requireBoundedMember(capture, 'applicationId'),
        releaseVersion: requireBoundedMember(capture, 'releaseVersion'),
      };
    case 'rollback-release':
      return {
        kind: 'rollback-release',
        applicationId: requireBoundedMember(capture, 'applicationId'),
        targetReleaseVersion: requireBoundedMember(capture, 'targetReleaseVersion'),
      };
    default:
      throw new VictControlError(
        'VICT_CONTROL_OPERATION_INVALID',
        'The ChangeSet operation kind is outside the closed vocabulary.',
      );
  }
}

/** The closed immutable release content fields. */
const RELEASE_CONTENT_FIELDS = [
  'releaseVersion',
  'applicationId',
  'applicationVersion',
  'rendererIdentity',
  'componentRegistryIdentity',
  'dataAdapterIdentity',
  'activationBinding',
] as const;

/**
 * Validate one immutable Application Release content record (fail closed).
 * The content is captured as a CLOSED plain-data structure (exact member
 * set, exact string types, no accessors/symbols/hostile containers) and
 * the returned record is a fresh VICT-owned capture.
 */
export function validateApplicationReleaseContent(content: unknown): ApplicationReleaseContent {
  const capture = captureClosedControlRecord(
    content,
    'release content',
    RELEASE_CONTENT_FIELDS as readonly string[],
  );
  for (const field of RELEASE_CONTENT_FIELDS) {
    const value = capture[field];
    if (typeof value !== 'string') {
      throw new VictControlError(
        'VICT_CONTROL_RELEASE_INVALID',
        `The release member '${field}' must be a string.`,
      );
    }
    assertControlId(value, `release.${field}`);
  }
  return {
    releaseVersion: capture.releaseVersion as string,
    applicationId: capture.applicationId as string,
    applicationVersion: capture.applicationVersion as string,
    rendererIdentity: capture.rendererIdentity as string,
    componentRegistryIdentity: capture.componentRegistryIdentity as string,
    dataAdapterIdentity: capture.dataAdapterIdentity as string,
    activationBinding: capture.activationBinding as string,
  };
}

/** The exact declared members of the ChangeSet authoring input envelope. */
const CHANGESET_CONTENT_INPUT_FIELDS: readonly string[] = [
  'changesetId',
  'authorActorId',
  'createdAt',
  'base',
  'operations',
  'rationale',
  'riskClass',
  'requiredApproverCount',
  'expiresAt',
];

/** Validate a full ChangeSet authoring input and derive its content hash.
 *
 * The COMPLETE untrusted runtime input is CAPTURED at this boundary before
 * any member is read: the outer envelope must be a plain object with the
 * EXACT closed field set, and `base`, the operation list, and every
 * operation are captured through guarded descriptors (no caller getter,
 * iterator, `.map()`, or other caller-controlled behavior is ever
 * consulted; hostile/revoked proxies, sparse arrays, accessors, symbols,
 * non-enumerable members, and exotic prototypes are all rejected with ONE
 * stable, non-echoing error). Only VICT-owned validated captures are
 * hashed and returned; caller objects are never retained, frozen, or aliased.
 */
export function validateChangeSetContent(untrustedInput: unknown): {
  changesetId: string;
  base: ChangeSetBase;
  operations: readonly ChangeSetOperation[];
  rationale: string;
  riskClass: ChangeSetRiskClass;
  requiredApproverCount: number;
  expiresAt: number;
  contentHash: string;
} {
  // ---- 1. CAPTURE the complete outer envelope (closed field set) BEFORE
  // any semantic inspection. Scalar members are captured by descriptor
  // value too, so caller getters never run (a getter on ANY outer field —
  // not only `base` — is rejected without being invoked).
  const input = captureClosedControlRecord(
    untrustedInput,
    'ChangeSet authoring input',
    CHANGESET_CONTENT_INPUT_FIELDS,
  ) as {
    changesetId: unknown;
    authorActorId: unknown;
    createdAt: unknown;
    base: unknown;
    operations: unknown;
    rationale: unknown;
    riskClass: unknown;
    requiredApproverCount: unknown;
    expiresAt: unknown;
  };
  if (typeof input.changesetId !== 'string') {
    throw new VictControlError('VICT_CONTROL_FIELD_INVALID', 'the ChangeSet id is malformed.');
  }
  if (typeof input.authorActorId !== 'string') {
    throw new VictControlError('VICT_CONTROL_FIELD_INVALID', 'the ChangeSet author is malformed.');
  }
  if (
    typeof input.createdAt !== 'number' ||
    !Number.isSafeInteger(input.createdAt) ||
    typeof input.expiresAt !== 'number' ||
    !Number.isSafeInteger(input.expiresAt)
  ) {
    throw new VictControlError(
      'VICT_CONTROL_FIELD_INVALID',
      'the ChangeSet timestamps are malformed.',
    );
  }
  assertControlId(input.changesetId, 'changesetId');
  assertControlId(input.authorActorId, 'authorActorId');
  assertControlTimestamp(input.createdAt, 'createdAt');
  assertControlTimestamp(input.expiresAt, 'expiresAt');
  if (input.expiresAt <= input.createdAt) {
    throw new VictControlError(
      'VICT_CONTROL_FIELD_INVALID',
      'a ChangeSet must expire after its creation.',
    );
  }
  // ---- 2. The base is CAPTURED (closed plain-data structure: exactly its
  // declared members, exact string types, no accessors/symbols/hostile
  // containers) before semantic inspection — a hostile `base.kind` getter
  // is never invoked and a revoked proxy never escapes a raw TypeError.
  const baseCapture = captureClosedControlRecord(
    input.base,
    'ChangeSet base',
    CHANGESET_BASE_FIELDS as readonly string[],
  );
  if (baseCapture.kind !== 'activation' && baseCapture.kind !== 'release') {
    throw new VictControlError('VICT_CONTROL_FIELD_INVALID', 'the ChangeSet base is malformed.');
  }
  if (
    typeof baseCapture.subjectId !== 'string' ||
    typeof baseCapture.expectedVersion !== 'string'
  ) {
    throw new VictControlError('VICT_CONTROL_FIELD_INVALID', 'the ChangeSet base is malformed.');
  }
  assertControlId(baseCapture.subjectId, 'base.subjectId');
  assertControlId(baseCapture.expectedVersion, 'base.expectedVersion');
  const base: ChangeSetBase = {
    kind: baseCapture.kind,
    subjectId: baseCapture.subjectId,
    expectedVersion: baseCapture.expectedVersion,
  };
  // ---- 3. The operation list is CAPTURED as a closed dense array through
  // guarded descriptors (never caller `.map()`/iterators); sparse arrays,
  // extra/symbol properties, accessor or non-enumerable indices, exotic
  // prototypes, and revoked/hostile proxies all fail with ONE stable error.
  const operationsCapture = captureClosedControlArray(
    input.operations,
    'ChangeSet operation list',
    64,
  );
  const operations: ChangeSetOperation[] = [];
  for (const operation of operationsCapture) {
    operations.push(validateChangeSetOperation(operation));
  }
  if (typeof input.rationale !== 'string') {
    throw new VictControlError('VICT_CONTROL_FIELD_INVALID', 'the rationale is malformed.');
  }
  assertBoundedString(input.rationale, 'rationale', 2000);
  if (input.riskClass !== 'low' && input.riskClass !== 'medium' && input.riskClass !== 'high') {
    throw new VictControlError(
      'VICT_CONTROL_FIELD_INVALID',
      'riskClass must be low, medium, or high.',
    );
  }
  if (
    typeof input.requiredApproverCount !== 'number' ||
    !Number.isSafeInteger(input.requiredApproverCount) ||
    input.requiredApproverCount < 1 ||
    input.requiredApproverCount > 8
  ) {
    throw new VictControlError(
      'VICT_CONTROL_FIELD_INVALID',
      'requiredApproverCount must be a safe integer between 1 and 8.',
    );
  }
  // The content identity is derived from the VALIDATED VICT-owned captures
  // (the closed base structure and the canonical operation set) — never from
  // the original caller objects (which could carry accessors, symbols, or
  // exotic prototypes and are never retained).
  const contentHash = controlContentHash({
    schema: CHANGESET_SCHEMA,
    authorActorId: input.authorActorId,
    base,
    operations,
    rationale: input.rationale,
    riskClass: input.riskClass,
    requiredApproverCount: input.requiredApproverCount,
    expiresAt: input.expiresAt,
  });
  return {
    changesetId: input.changesetId,
    base,
    operations,
    rationale: input.rationale,
    riskClass: input.riskClass,
    requiredApproverCount: input.requiredApproverCount,
    expiresAt: input.expiresAt,
    contentHash,
  };
}

/** The durable ChangeSet store port. */
export interface ControlPlaneStore {
  saveChangeSet(record: ChangeSetRecord): Promise<void>;
  getChangeSet(changesetId: string): Promise<ChangeSetRecord | undefined>;
  listChangeSets(): Promise<readonly ChangeSetRecord[]>;
  /** Update one ChangeSet with optimistic compare-and-set on its status. */
  updateChangeSet(
    changesetId: string,
    update: (record: ChangeSetRecord) => ChangeSetRecord,
  ): Promise<ChangeSetRecord>;
  /**
   * Revise a ChangeSet's CONTENT (draft/approved only): the update may
   * derive a NEW immutable content identity; the implementation must reset
   * validation/simulation evidence atomically with the new content.
   */
  reviseChangeSetContent(
    changesetId: string,
    revise: (record: ChangeSetRecord) => ChangeSetRecord,
  ): Promise<ChangeSetRecord>;
  recordChangeSetApproval(decision: ChangeSetApprovalDecision): Promise<void>;
  listChangeSetApprovals(changesetId: string): Promise<readonly ChangeSetApprovalDecision[]>;

  /** Durable record of one authoritative governance run (idempotent by runId). */
  recordControlRun(record: ControlRunRecord): Promise<void>;
  getControlRun(runId: string): Promise<ControlRunRecord | undefined>;

  /**
   * Durable saga receipts for applied ChangeSet operations. The protocol
   * is: record the PREPARED intent (idempotent by (changesetId, index);
   * conflicting content under the same identity fails closed) BEFORE the
   * effect, then record the APPLIED state after the effect (atomically
   * with it where effect and receipt share a transaction). Recovery skips
   * operations whose receipt is `applied` and VERIFIES target state for
   * `prepared` intents — it never manufactures a receipt merely because
   * the operation was supposed to run.
   */
  recordOperationIntent(receipt: ChangeSetOperationReceipt): Promise<'recorded' | 'exists'>;
  markOperationApplied(input: {
    changesetId: string;
    operationIndex: number;
    at: number;
  }): Promise<ChangeSetOperationReceipt>;
  recordOperationReceipt(receipt: ChangeSetOperationReceipt): Promise<void>;
  listOperationReceipts(changesetId: string): Promise<readonly ChangeSetOperationReceipt[]>;

  /**
   * Compare-and-set the ChangeSet status (one winner). The update is
   * applied only when the CURRENT durable status equals `expectedStatus`;
   * a mismatch throws `VICT_CONTROL_CHANGESET_STATUS_CONFLICT`.
   */
  compareAndSetChangeSetStatus(input: {
    changesetId: string;
    expectedStatus: ChangeSetStatus;
    nextStatus: ChangeSetStatus;
  }): Promise<ChangeSetRecord>;

  publishRelease(record: ApplicationReleaseRecord): Promise<void>;
  getRelease(releaseVersion: string): Promise<ApplicationReleaseRecord | undefined>;
  listReleases(applicationId: string): Promise<readonly ApplicationReleaseRecord[]>;
  /**
   * Select one release with the operation protocol: `operationId` is the
   * idempotency/fencing key (re-application returns the ORIGINAL selection
   * revision without adding another one; conflicting content under the
   * same identity fails closed) and `expectedBaseVersion` is the
   * SUBJECT-LEVEL base guard (the currently selected release version for
   * the application; `'none'`-equivalent when no version is selected).
   * The guard is evaluated ATOMICALLY inside the selection mutation — two
   * ChangeSets racing on one base produce exactly one winner, and the
   * loser receives `VICT_CONTROL_BASE_STALE` with NO effects.
   */
  selectRelease(command: {
    applicationId: string;
    releaseVersion: string;
    actorId: string;
    at: number;
    reason: 'select' | 'rollback';
    readonly operationId?: string;
    readonly expectedBaseVersion?: string;
  }): Promise<{ selectionRevision: number }>;
  getSelectedRelease(applicationId: string): Promise<ApplicationReleaseRecord | undefined>;
  listReleaseSelections(applicationId: string): Promise<readonly ReleaseSelectionRecord[]>;
  /**
   * OPTIONAL atomic composition: publish the release, apply the guarded
   * selection, and record the APPLIED operation receipt in ONE durable
   * transaction (closes the effect/receipt dual-write gap where the
   * effect shares the store). Implementations without a shared
   * transaction boundary may omit it; the service then uses the
   * intent → effect → applied protocol.
   */
  applyReleaseOperation?(input: {
    release: ApplicationReleaseRecord;
    selection: {
      applicationId: string;
      releaseVersion: string;
      actorId: string;
      at: number;
      reason: 'select' | 'rollback';
      operationId: string;
      expectedBaseVersion?: string;
    };
    receipt: ChangeSetOperationReceipt;
  }): Promise<{ selectionRevision: number }>;

  appendAuditEvent(event: ControlAuditEvent): Promise<void>;
  listAuditEvents(subject: {
    subjectType?: string;
    subjectId?: string;
  }): Promise<readonly ControlAuditEvent[]>;
}

/** One published immutable Application Release. */
export interface ApplicationReleaseRecord {
  readonly releaseVersion: string;
  readonly applicationId: string;
  readonly applicationVersion: string;
  readonly rendererIdentity: string;
  readonly componentRegistryIdentity: string;
  readonly dataAdapterIdentity: string;
  readonly activationBinding: string;
  readonly publishedByActorId: string;
  readonly publishedAt: number;
  /** Immutable content identity of the release record. */
  readonly contentHash: string;
}

/** Alias used inside operation validation (defined above; kept for parity). */
type ApplicationReleaseContentAlias = ApplicationReleaseContent;
void (undefined as unknown as ApplicationReleaseContentAlias | undefined);

/** One immutable release selection (selection is monotonic; rollback = select). */
export interface ReleaseSelectionRecord {
  readonly applicationId: string;
  readonly releaseVersion: string;
  readonly selectionRevision: number;
  readonly actorId: string;
  readonly at: number;
  /** `select` or `rollback` — distinct, attributable operations. */
  readonly reason: 'select' | 'rollback';
  /** The ChangeSet operation identity that produced this selection, when
   * selection ran under the operation protocol (idempotency anchor). */
  readonly operationId?: string;
}

/** One attributable audit event (safe summaries only). */
export interface ControlAuditEvent {
  readonly auditId: string;
  readonly at: number;
  readonly actorId: string;
  readonly action: ControlAuditAction;
  readonly subjectType: string;
  readonly subjectId: string;
  /** Safe bounded summary — never payloads, never credentials. */
  readonly summary: string;
}

/** The closed audit action vocabulary. */
export const CONTROL_AUDIT_ACTIONS = [
  'changeset.proposed',
  'changeset.revised',
  'changeset.evidence-attached',
  'changeset.approved',
  'changeset.declined',
  'changeset.committed',
  'changeset.expired',
  'release.published',
  'release.selected',
  'release.rolled-back',
  'activation.selected',
  'activation.rolled-back',
  'actor.recorded',
  'run.cancelled',
  'turn.cancelled',
  'approval.decided',
  'approval.expired',
  'operator.intervened',
] as const;
export type ControlAuditAction = (typeof CONTROL_AUDIT_ACTIONS)[number];

// ---- Agent turns ------------------------------------------------------------

export const AGENT_TURN_SCHEMA = 'vict.agent-turn@1';

export type AgentTurnStatus =
  'intent' | 'running' | 'awaiting-approval' | 'completed' | 'failed' | 'cancelled' | 'blocked';

/** One durable agent-turn record (VICT-authoritative). */
export interface AgentTurnRecord {
  readonly turnId: string;
  readonly streamId: string;
  readonly threadId: string;
  readonly actorId: string;
  readonly agentProfileVersion: string;
  readonly activationVersion: string | undefined;
  /** Application Release identity pinned for the turn, when applicable. */
  readonly applicationReleaseVersion: string | undefined;
  /** Safe bounded input summary — NEVER the full prompt. */
  readonly inputSummary: string;
  readonly status: AgentTurnStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly terminalAt: number | undefined;
  readonly errorCode: string | undefined;
  /** Correlation identities (IDs, never payloads). */
  readonly traceId: string | undefined;
  readonly victRunId: string | undefined;
  readonly mastraRunId: string | undefined;
}

/** Correlation update for a turn (IDs only). */
export interface AgentTurnCorrelation {
  readonly traceId?: string;
  readonly victRunId?: string;
  readonly mastraRunId?: string;
}

/** The durable agent-turn store port. */
export interface AgentTurnStore {
  createTurnIntent(record: AgentTurnRecord): Promise<void>;
  getTurn(turnId: string): Promise<AgentTurnRecord | undefined>;
  listTurns(): Promise<readonly AgentTurnRecord[]>;
  listOpenTurns(): Promise<readonly AgentTurnRecord[]>;
  startTurn(turnId: string, at: number): Promise<AgentTurnRecord>;
  awaitApproval(turnId: string, at: number, approvalId: string): Promise<AgentTurnRecord>;
  resumeTurn(turnId: string, at: number): Promise<AgentTurnRecord>;
  recordTurnCorrelation(turnId: string, correlation: AgentTurnCorrelation): Promise<void>;
  completeTurn(command: {
    turnId: string;
    status: 'completed' | 'failed' | 'cancelled' | 'blocked';
    at: number;
    errorCode?: string;
  }): Promise<AgentTurnRecord>;
  recordCancelIntent(command: {
    turnId: string;
    cancelId: string;
    actorId: string;
    reasonCode: string;
    at: number;
  }): Promise<{ accepted: boolean; duplicate: boolean }>;
  hasCancelIntent(turnId: string): Promise<boolean>;
  /** Restart reconciliation: force one honest terminal state for an open turn. */
  reconcileTurn(command: {
    turnId: string;
    status: 'failed' | 'cancelled' | 'blocked';
    reasonCode: string;
    at: number;
  }): Promise<AgentTurnRecord | undefined>;
  listCancelIntents(
    turnId: string,
  ): Promise<readonly { cancelId: string; actorId: string; reasonCode: string; at: number }[]>;
}

// ---- Tool invocations (durable-before-invocation) ----------------------------

export type AgentToolInvocationStatus =
  | 'intent'
  | 'approved'
  | 'running'
  | 'completed'
  | 'failed'
  | 'declined'
  | 'cancelled'
  | 'outcome_unknown';

/** One durable turn-execution tool slot (stable tool-call identity). */
export interface TurnToolSlotAllocation {
  /** The 1-based monotonic slot index within the turn. */
  readonly slot: number;
  /** The stable tool-call identity derived from the persisted slot. */
  readonly toolCallId: string;
  readonly turnId: string;
  readonly toolName: string;
  readonly argDigest: string;
}

/** One durable protected tool-invocation record.
 *
 * LIVE-OWNER FENCING (Stage 06B final boundary correction): the optional
 * `runFence*` members are stamped by `claimInvocationRun` when ONE owner
 * claims the invocation's execution attempt, carried through the durable
 * `running` state, and required as EXACT BINDING on every fenced terminal
 * settlement. `runGeneration` increments on every claim and on every
 * reconciliation, so a stale owner can never settle a later generation.
 */
export interface AgentToolInvocationRecord {
  readonly invocationId: string;
  readonly turnId: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly capabilityId: string;
  readonly capabilityRevision: string;
  readonly effect: EffectClass;
  /** Deterministic idempotency key for the logical invocation. */
  readonly idempotencyKey: string;
  readonly actorId: string;
  /** Canonical argument digest — never the arguments themselves. */
  readonly argDigest: string;
  /** Safe bounded argument summary (never full payloads). */
  readonly argumentSummary: string;
  readonly status: AgentToolInvocationStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly completedAt: number | undefined;
  /** Safe bounded result summary — never full payloads. */
  readonly resultSummary: string | undefined;
  readonly errorCode: string | undefined;
  /** The fence token of the CURRENT execution attempt (claim-bound). */
  readonly runFenceToken?: string | undefined;
  /** When the current attempt was claimed (epoch ms). */
  readonly runFenceAt?: number | undefined;
  /** The process identity that claimed the current attempt. */
  readonly runOwnerIdentity?: string | undefined;
  /** Monotonic attempt generation (incremented per claim/reconciliation). */
  readonly runGeneration?: number;
}

/** The durable tool-invocation store port. */
export interface AgentToolInvocationStore {
  recordInvocationIntent(record: AgentToolInvocationRecord): Promise<AgentToolInvocationRecord>;
  /**
   * Allocate (or re-read) the DURABLE turn-execution tool slot for one
   * logical tool request. The slot is a separately persisted allocation
   * keyed by (turnId, toolName, argDigest): the FIRST allocation assigns
   * the next monotonic slot for the turn and persists it BEFORE any
   * invocation; every later call with the same key — including after a
   * restart — returns the SAME slot and the SAME stable toolCallId.
   * Logical tool-call identity therefore never derives from time, process
   * counters, or the number of rows currently present.
   */
  allocateTurnToolSlot(input: {
    turnId: string;
    toolName: string;
    argDigest: string;
  }): Promise<TurnToolSlotAllocation>;
  getInvocation(invocationId: string): Promise<AgentToolInvocationRecord | undefined>;
  getInvocationByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<AgentToolInvocationRecord | undefined>;
  updateInvocationStatus(command: {
    invocationId: string;
    status:
      | 'approved'
      | 'running'
      | 'completed'
      | 'failed'
      | 'declined'
      | 'cancelled'
      | 'outcome_unknown';
    at: number;
    resultSummary?: string;
    errorCode?: string;
  }): Promise<AgentToolInvocationRecord>;
  listInvocationsForTurn(turnId: string): Promise<readonly AgentToolInvocationRecord[]>;

  /**
   * CLAIM the invocation's execution attempt for ONE live owner: the durable
   * status moves `intent`|`approved` → `running` and the record is stamped
   * with the attempt fence (token, owner identity, claim time) and the next
   * attempt generation. Exactly one claim per generation wins: a claim on an
   * already-running record throws `VICT_CONTROL_INVOCATION_OWNER_ACTIVE`
   * (the caller is the duplicate of a live owner) and a claim on a terminal
   * record throws the stable terminal error. Duplicates NEVER mutate a
   * live-owned record through any other command.
   */
  claimInvocationRun(command: {
    invocationId: string;
    fenceToken: string;
    ownerIdentity: string;
    at: number;
  }): Promise<AgentToolInvocationRecord>;

  /**
   * FENCED terminal settlement (`completed` | `failed` | `outcome_unknown`):
   * accepted ONLY from the durable `running` state while the observed fence
   * token equals the command's fence token — the caller must be the CURRENT
   * owner of the attempt. An exact rematch of the requested terminal state
   * AND its binding (status + errorCode + resultSummary) under the SAME
   * fence is idempotent; every other conflict fails with a structured,
   * non-echoing error (`VICT_CONTROL_INVOCATION_FENCE_MISMATCH` for a stale
   * owner, `VICT_CONTROL_INVOCATION_TERMINAL`/`REGRESSION` otherwise). A
   * stale owner can never settle a later claim generation.
   */
  settleInvocationRun(command: {
    invocationId: string;
    fenceToken: string;
    status: 'completed' | 'failed' | 'outcome_unknown';
    at: number;
    resultSummary?: string;
    errorCode?: string;
  }): Promise<AgentToolInvocationRecord>;

  /**
   * PRE-RUNNING terminal settlement (`failed` | `declined` | `cancelled`):
   * applies only while the durable state is pre-running (`intent` or
   * `approved`). An exact rematch (same status AND same errorCode) is
   * idempotent; a conflict with a different terminal state or binding fails;
   * a record already claimed (`running`) is never touched
   * (`VICT_CONTROL_INVOCATION_OWNER_ACTIVE`).
   */
  settleInvocationPending(command: {
    invocationId: string;
    status: 'failed' | 'declined' | 'cancelled';
    at: number;
    errorCode?: string;
  }): Promise<AgentToolInvocationRecord>;

  /**
   * Conservative reconciliation of an ABANDONED `running` attempt (its
   * owner is provably lost — no live owner exists for the recorded claim):
   * the record is fenced to the terminal, NON-REPLAYABLE `outcome_unknown`
   * without executing anything. Accepted ONLY when the observed durable
   * state is exactly `running` AND the observed fence token equals
   * `observedFenceToken` (idempotent only on that exact binding); the fence
   * advances to `reconciledFenceToken` and the generation increments, so a
   * stale owner's later settlement fails. Every other observed state fails
   * with a structured, non-echoing error.
   */
  reconcileAbandonedRun(command: {
    invocationId: string;
    observedFenceToken: string;
    reconciledFenceToken: string;
    at: number;
  }): Promise<AgentToolInvocationRecord>;
}

// ---- VICT-authoritative approval records -------------------------------------

export type AgentApprovalStatus = 'pending' | 'approved' | 'declined' | 'expired';

/**
 * One VICT-authoritative approval record (MSTR-005). The record binds the
 * decision to the EXACT requesting actor, activation/agent profile,
 * capability revision, turn/tool-call/invocation identity, canonical
 * argument digest, effect class, and environment — nothing else can
 * consume it.
 */
export interface AgentApprovalRecord {
  readonly approvalId: string;
  readonly kind: 'tool-invocation';
  readonly turnId: string;
  readonly invocationId: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly capabilityId: string;
  readonly capabilityRevision: string;
  readonly effect: EffectClass;
  readonly actorId: string;
  readonly agentProfileVersion: string;
  readonly argDigest: string;
  readonly environment: string;
  readonly requiredApproverRole: ActorRole;
  readonly status: AgentApprovalStatus;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly decidedAt: number | undefined;
  readonly approverActorId: string | undefined;
  /** Safe bounded reason/metadata — never payloads. */
  readonly decisionReason: string | undefined;
}

/** The durable approval store port (VICT-authoritative decisions). */
export interface AgentApprovalStore {
  createPendingApproval(record: AgentApprovalRecord): Promise<AgentApprovalRecord>;
  getApproval(approvalId: string): Promise<AgentApprovalRecord | undefined>;
  listOpenApprovals(): Promise<readonly AgentApprovalRecord[]>;
  listApprovalsForInvocation(invocationId: string): Promise<readonly AgentApprovalRecord[]>;
  decideApproval(command: {
    approvalId: string;
    approverActorId: string;
    decision: 'approved' | 'declined';
    decidedAt: number;
    decisionReason?: string;
  }): Promise<AgentApprovalRecord>;
  expireApproval(command: { approvalId: string; at: number }): Promise<AgentApprovalRecord>;
}

// ---- Stream ledger ------------------------------------------------------------

/**
 * One durably-ordered agent-stream event row. Only DURABLE kinds are
 * persisted rows; `text.delta` consumes a sequence number but is retained
 * only in the bounded transient buffer (never in operational history by
 * default).
 */
export interface AgentStreamLedgerEvent {
  readonly streamId: string;
  readonly seq: number;
  readonly kind: AgentStreamEventKind;
  /** Canonical JSON of the kind-specific safe payload fields. */
  readonly payload: string;
  readonly createdAt: number;
}

/** The durable stream-ledger store port. */
export interface AgentStreamLedgerStore {
  /**
   * Append one event to a stream. Assigns the next strictly monotonic
   * sequence; persists a row only for durable kinds (transient kinds
   * advance the sequence without a row). Returns the assigned sequence.
   */
  appendEvent(command: {
    streamId: string;
    kind: AgentStreamEventKind;
    payload: string;
    at: number;
  }): Promise<{ seq: number; persisted: boolean }>;
  latestSeq(streamId: string): Promise<number>;
  /**
   * Durable events after the given sequence, in sequence order. The
   * optional `limit` bounds one read (paged replay); implementations MUST
   * accept calls without it.
   */
  listEventsFrom(
    streamId: string,
    afterSeq: number,
    limit?: number,
  ): Promise<readonly AgentStreamLedgerEvent[]>;
  listStreamIds(): Promise<readonly string[]>;
}

/** Durable kinds that a ledger row persists (transient kinds never persist). */
export function isDurableStreamKind(kind: AgentStreamEventKind): boolean {
  return kind !== 'text.delta';
}

// ---- The composed control-plane store set -------------------------------------

// ---- Durable command idempotency -----------------------------------------

/** The closed, bounded idempotency-key format (HTTP + CLI surface). */
export const COMMAND_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/**
 * One durable command-idempotency receipt. Receipts are NAMESPACED by
 * (authenticated actor, command, idempotency key): two actors using the
 * same client-generated key never interfere, and the canonical request
 * digest is bound INSIDE that namespace.
 *
 * A `pending` receipt carries a durable LEASE (owner + expiry): the
 * claiming process renews/holds the lease while executing. A crash leaves
 * the lease to expire, after which a retrying caller may take the claim
 * over (attempt counter incremented) instead of the key being stuck as
 * in-progress forever. A `failed` receipt is a DETERMINISTIC command
 * failure (stable code, replayed); retryable infrastructure failures are
 * RELEASED instead so a retry re-executes truthfully.
 */
export interface CommandIdempotencyReceipt {
  readonly idempotencyKey: string;
  readonly actorId: string;
  readonly command: string;
  /** Canonical digest over the exact request payload. */
  readonly requestDigest: string;
  readonly status: 'pending' | 'completed' | 'failed';
  /** Stable failure code when status is `failed`. */
  readonly responseCode: string | undefined;
  /** SAFE per-command replay projection (identifiers/codes only — never
   * full command responses). */
  readonly resultJson: string | undefined;
  readonly createdAt: number;
  readonly settledAt: number | undefined;
  /** The lease owner (process/instance token) while `pending`. */
  readonly owner: string | undefined;
  /** Epoch-ms lease expiry while `pending` (crash-recovery bound). */
  readonly leaseUntil: number | undefined;
  /** How many times the claim has been (re-)taken (lease takeovers). */
  readonly attempts: number;
  /**
   * The immutable settlement FENCE token for the current claim generation.
   * Completion, deterministic failure, and release must present exactly
   * this token; a stale owner presenting a different token receives a
   * stable non-echoing conflict and the receipt is left byte-identical.
   * The token changes on every lease takeover (it is derived from the
   * namespace, owner, and attempt generation).
   */
  readonly fenceToken: string | undefined;
}

/** Stable structured conflict code thrown when a settlement fence mismatches. */
export const VICT_IDEMPOTENCY_FENCE_CONFLICT = 'VICT_IDEMPOTENCY_FENCE_CONFLICT';

/**
 * Derive the deterministic settlement fence token for one claim
 * generation. The token binds the namespace, the lease owner, and the
 * attempt generation: a lease takeover always produces a NEW token, so a
 * stale owner can never settle a claim it no longer owns.
 */
export function commandIdempotencyFenceToken(input: {
  actorId: string;
  command: string;
  idempotencyKey: string;
  owner: string;
  attempts: number;
}): string {
  return (
    'vict-fence-' +
    createHash('sha256')
      .update(
        `${input.actorId}\u0000${input.command}\u0000${input.idempotencyKey}\u0000${input.owner}\u0000${input.attempts}`,
        'utf8',
      )
      .digest('hex')
  );
}

/** The result of a lease takeover attempt (the NEW fence token on success). */
export type CommandIdempotencyLeaseTakeover =
  { outcome: 'taken'; fenceToken: string } | { outcome: 'not-expired' | 'missing' };

/** The namespaced lookup key of one receipt. */
export interface CommandIdempotencyName {
  readonly actorId: string;
  readonly command: string;
  readonly idempotencyKey: string;
}

/** The durable command-idempotency store port (one winner per namespace). */
export interface CommandIdempotencyStore {
  /**
   * Insert-if-absent within the (actor, command, key) namespace. Returns
   * `claimed` for exactly one concurrent caller (the winner); every other
   * caller receives `exists` with the durable receipt.
   */
  claimReceipt(record: CommandIdempotencyReceipt): Promise<'claimed' | 'exists'>;
  getReceipt(name: CommandIdempotencyName): Promise<CommandIdempotencyReceipt | undefined>;
  /**
   * Cross-command key reuse check: the receipt bound to (actor, key) under
   * ANY command kind, if one exists. The command-service policy layer uses
   * this to turn a client reusing one Idempotency-Key across DIFFERENT
   * commands into a stable conflict without relying on per-command
   * namespaces alone.
   */
  findReceiptByActorKey(input: {
    actorId: string;
    idempotencyKey: string;
  }): Promise<CommandIdempotencyReceipt | undefined>;
  completeReceipt(input: {
    actorId: string;
    command: string;
    idempotencyKey: string;
    resultJson: string;
    at: number;
    /** The claim's settlement fence token (exact generation match). */
    fenceToken: string;
  }): Promise<void>;
  failReceipt(input: {
    actorId: string;
    command: string;
    idempotencyKey: string;
    responseCode: string;
    at: number;
    /** The claim's settlement fence token (exact generation match). */
    fenceToken: string;
  }): Promise<void>;
  /**
   * Release a `pending` claim WITHOUT a terminal disposition — used for
   * RETRYABLE infrastructure failures so they are never permanently
   * confused with deterministic command failures. The key becomes
   * claimable again. The release is FENCED: only the current claim owner
   * generation may release; a stale owner receives a stable conflict and
   * the live claim is left byte-identical.
   */
  releaseReceipt(input: {
    actorId: string;
    command: string;
    idempotencyKey: string;
    at: number;
    /** The claim's settlement fence token (exact generation match). */
    fenceToken: string;
  }): Promise<void>;
  /**
   * Crash recovery: take over an EXPIRED pending lease. Returns `taken`
   * with the NEW settlement fence token (the caller is the new owner;
   * attempts incremented), `not-expired` (the previous owner may still be
   * executing), or `missing`.
   */
  takeOverExpiredLease(input: {
    actorId: string;
    command: string;
    idempotencyKey: string;
    owner: string;
    leaseUntil: number;
    at: number;
  }): Promise<CommandIdempotencyLeaseTakeover>;
}

/** The composed control-plane store set. */
export interface AgentControlStores {
  readonly actors: ActorDirectory;
  readonly control: ControlPlaneStore;
  readonly turns: AgentTurnStore;
  readonly invocations: AgentToolInvocationStore;
  readonly approvals: AgentApprovalStore;
  readonly streamLedger: AgentStreamLedgerStore;
  /** Durable command idempotency (state-changing HTTP/CLI commands). */
  readonly commandIdempotency: CommandIdempotencyStore;
}

/** Validation error for any control-plane structural violation. */
export class VictControlError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'VictControlError';
    this.code = code;
  }
}

/** Canonical JSON of one stream event's safe payload fields (context minus stream identity). */
export function streamEventPayloadOf(event: object): string {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event as Record<string, unknown>)) {
    if (key === 'streamId' || key === 'seq' || key === 'createdAt') {
      continue;
    }
    payload[key] = value;
  }
  return toCanonicalJson(payload);
}

// ---- The stream-ledger append gate (store-boundary schema enforcement) ------

/**
 * Validate ONE append against the final `vict.agent-stream@1` schema at
 * the STORE boundary — before any sequence state is incremented or any
 * storage mutated. The RAW ledger ports are the last line of defense:
 * plain-JavaScript callers cannot bypass the schema through them.
 *
 * Enforced here:
 * - the payload is a JSON object in CANONICAL form (non-canonical JSON is
 *   rejected, not silently re-serialized);
 * - the declared kind is inside the closed vocabulary and matches the
 *   payload's `kind` member;
 * - the reconstructed event (payload + stream identity + the sequence that
 *   WOULD be assigned) passes the complete field-level schema (unknown
 *   kinds/fields, malformed correlation IDs, unsafe codes, raw text in
 *   `content.completed`, invalid usage — all fail closed).
 *
 * Errors are stable and non-echoing: `VICT_STREAM_EVENT_INVALID` carries
 * schema issue CODES only, never the rejected values.
 */
export function validateStreamLedgerAppend(command: {
  streamId: string;
  kind: AgentStreamEventKind;
  payload: string;
  assignedSeq: number;
}): AgentStreamEvent {
  assertControlId(command.streamId, 'streamId');
  let parsed: unknown;
  try {
    parsed = JSON.parse(command.payload);
  } catch {
    throw new VictControlError(
      'VICT_STREAM_EVENT_INVALID',
      'The stream event payload is not valid JSON; the ledger rejects it without persisting anything.',
    );
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new VictControlError(
      'VICT_STREAM_EVENT_INVALID',
      'The stream event payload must be a JSON object.',
    );
  }
  // Canonical-form enforcement: the stored payload must be the canonical
  // serialization of its own content (no key-order drift, no whitespace).
  if (toCanonicalJson(parsed) !== command.payload) {
    throw new VictControlError(
      'VICT_STREAM_EVENT_INVALID',
      'The stream event payload is not canonical JSON; persisting it would break byte-stable replay.',
    );
  }
  const candidate = parsed as Record<string, unknown>;
  if (candidate['kind'] !== command.kind) {
    throw new VictControlError(
      'VICT_STREAM_EVENT_INVALID',
      'The payload kind does not match the declared event kind.',
    );
  }
  const event = {
    ...candidate,
    streamId: command.streamId,
    seq: command.assignedSeq,
  } as unknown as AgentStreamEvent;
  const validation = validateAgentStreamEvent(event);
  if (!validation.ok) {
    throw new VictControlError(
      'VICT_STREAM_EVENT_INVALID',
      `The event is not a valid vict.agent-stream@1 event (${validation.issues
        .map((issue) => issue.code)
        .join(', ')}).`,
    );
  }
  return event;
}
