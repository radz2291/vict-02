import { createHash } from 'node:crypto';
import type { AgentStreamEventKind } from '@vict/contracts';
import type { EffectClass } from '@vict/kernel';
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
 * SQLite adapter implements the same ports in `@vict/store-sqlite` and both
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
    throw new Error(
      `VICT_CONTROL_ID_INVALID: ${field} must be a bounded namespace identifier (at most 128 characters; letters, digits, '.', '_', ':', '@', '-').`,
    );
  }
}

/** Stable bounded safe-integer validation. */
export function assertControlTimestamp(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`VICT_CONTROL_TIMESTAMP_INVALID: ${field} must be a finite epoch-ms integer.`);
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
    throw new Error('VICT_ACTOR_UNAUTHENTICATED: the actor could not be authenticated.');
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
      throw new Error('VICT_CONTROL_FIELD_INVALID: actor status must be active or disabled.');
    }
    if (!Array.isArray(record.roles)) {
      throw new Error('VICT_CONTROL_FIELD_INVALID: actor roles must be an array.');
    }
    for (const role of record.roles) {
      if (!(ACTOR_ROLES as readonly string[]).includes(role)) {
        throw new Error(
          'VICT_CONTROL_FIELD_INVALID: actor roles must use the closed role vocabulary.',
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
}

/** One durable receipt of a single applied ChangeSet operation (saga). */
export interface ChangeSetOperationReceipt {
  readonly changesetId: string;
  /** Zero-based index of the operation inside the ChangeSet. */
  readonly operationIndex: number;
  readonly operationKind: ChangeSetOperation['kind'];
  /** Content identity of the exact operation that was applied. */
  readonly operationDigest: string;
  /** Stable identity of the applied effect (idempotency anchor). */
  readonly effectRef: string;
  readonly actorId: string;
  readonly appliedAt: number;
}

/** Validate the structural shape of one ChangeSet operation (fail closed). */
export function validateChangeSetOperation(operation: unknown): ChangeSetOperation {
  if (typeof operation !== 'object' || operation === null) {
    throw new Error('VICT_CONTROL_OPERATION_INVALID: a ChangeSet operation must be an object.');
  }
  const candidate = operation as Record<string, unknown>;
  const kind = candidate.kind;
  const expectFields = (fields: readonly string[]): void => {
    for (const key of Object.keys(candidate)) {
      if (!fields.includes(key)) {
        throw new Error(
          'VICT_CONTROL_OPERATION_INVALID: a ChangeSet operation declares an unknown field; executable functions and unrestricted patches are never persisted.',
        );
      }
    }
    for (const field of fields) {
      if (field === 'kind') {
        continue;
      }
      const value = candidate[field];
      if (typeof value !== 'string') {
        // Non-string fields (e.g. release content) are validated by their
        // dedicated closed-schema validator.
        continue;
      }
      assertControlId(value, `operation.${field}`);
    }
  };
  switch (kind) {
    case 'select-activation':
      expectFields(['kind', 'graphId', 'activationVersion']);
      return {
        kind: 'select-activation',
        graphId: candidate.graphId as string,
        activationVersion: candidate.activationVersion as string,
      };
    case 'rollback-activation':
      expectFields(['kind', 'graphId', 'targetActivationVersion']);
      return {
        kind: 'rollback-activation',
        graphId: candidate.graphId as string,
        targetActivationVersion: candidate.targetActivationVersion as string,
      };
    case 'publish-and-select-release':
      expectFields(['kind', 'release']);
      return {
        kind: 'publish-and-select-release',
        release: validateApplicationReleaseContent(candidate.release),
      };
    case 'select-release':
      expectFields(['kind', 'applicationId', 'releaseVersion']);
      return {
        kind: 'select-release',
        applicationId: candidate.applicationId as string,
        releaseVersion: candidate.releaseVersion as string,
      };
    case 'rollback-release':
      expectFields(['kind', 'applicationId', 'targetReleaseVersion']);
      return {
        kind: 'rollback-release',
        applicationId: candidate.applicationId as string,
        targetReleaseVersion: candidate.targetReleaseVersion as string,
      };
    default:
      throw new Error(
        'VICT_CONTROL_OPERATION_INVALID: the ChangeSet operation kind is outside the closed vocabulary.',
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

/** Validate one immutable Application Release content record (fail closed). */
export function validateApplicationReleaseContent(content: unknown): ApplicationReleaseContent {
  if (typeof content !== 'object' || content === null || Array.isArray(content)) {
    throw new Error('VICT_CONTROL_RELEASE_INVALID: release content must be an object.');
  }
  const candidate = content as Record<string, unknown>;
  for (const key of Object.keys(candidate)) {
    if (!(RELEASE_CONTENT_FIELDS as readonly string[]).includes(key)) {
      throw new Error('VICT_CONTROL_RELEASE_INVALID: release content declares an unknown field.');
    }
  }
  for (const field of RELEASE_CONTENT_FIELDS) {
    assertControlId(candidate[field], `release.${field}`);
  }
  return {
    releaseVersion: candidate.releaseVersion as string,
    applicationId: candidate.applicationId as string,
    applicationVersion: candidate.applicationVersion as string,
    rendererIdentity: candidate.rendererIdentity as string,
    componentRegistryIdentity: candidate.componentRegistryIdentity as string,
    dataAdapterIdentity: candidate.dataAdapterIdentity as string,
    activationBinding: candidate.activationBinding as string,
  };
}

/** Validate a full ChangeSet authoring input and derive its content hash. */
export function validateChangeSetContent(input: {
  changesetId: string;
  authorActorId: string;
  createdAt: number;
  base: ChangeSetBase;
  operations: readonly unknown[];
  rationale: string;
  riskClass: ChangeSetRiskClass;
  requiredApproverCount: number;
  expiresAt: number;
}): {
  base: ChangeSetBase;
  operations: readonly ChangeSetOperation[];
  rationale: string;
  riskClass: ChangeSetRiskClass;
  requiredApproverCount: number;
  expiresAt: number;
  contentHash: string;
} {
  assertControlId(input.changesetId, 'changesetId');
  assertControlId(input.authorActorId, 'authorActorId');
  assertControlTimestamp(input.createdAt, 'createdAt');
  assertControlTimestamp(input.expiresAt, 'expiresAt');
  if (input.expiresAt <= input.createdAt) {
    throw new Error('VICT_CONTROL_FIELD_INVALID: a ChangeSet must expire after its creation.');
  }
  if (
    typeof input.base !== 'object' ||
    input.base === null ||
    !['activation', 'release'].includes((input.base as ChangeSetBase).kind)
  ) {
    throw new Error('VICT_CONTROL_FIELD_INVALID: the ChangeSet base is malformed.');
  }
  const base = input.base as ChangeSetBase;
  assertControlId(base.subjectId, 'base.subjectId');
  assertControlId(base.expectedVersion, 'base.expectedVersion');
  if (
    !Array.isArray(input.operations) ||
    input.operations.length === 0 ||
    input.operations.length > 64
  ) {
    throw new Error(
      'VICT_CONTROL_FIELD_INVALID: a ChangeSet must declare between 1 and 64 closed operations.',
    );
  }
  const operations = input.operations.map((operation) => validateChangeSetOperation(operation));
  assertBoundedString(input.rationale, 'rationale', 2000);
  if (!['low', 'medium', 'high'].includes(input.riskClass)) {
    throw new Error('VICT_CONTROL_FIELD_INVALID: riskClass must be low, medium, or high.');
  }
  if (
    typeof input.requiredApproverCount !== 'number' ||
    !Number.isSafeInteger(input.requiredApproverCount) ||
    input.requiredApproverCount < 1 ||
    input.requiredApproverCount > 8
  ) {
    throw new Error(
      'VICT_CONTROL_FIELD_INVALID: requiredApproverCount must be a safe integer between 1 and 8.',
    );
  }
  const contentHash = controlContentHash({
    schema: CHANGESET_SCHEMA,
    authorActorId: input.authorActorId,
    base: input.base,
    operations: input.operations,
    rationale: input.rationale,
    riskClass: input.riskClass,
    requiredApproverCount: input.requiredApproverCount,
    expiresAt: input.expiresAt,
  });
  return {
    base: input.base,
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
   * Durable saga receipts for applied ChangeSet operations (idempotent by
   * (changesetId, operationIndex)). Recovery completes a commit exactly
   * once by skipping operations that already carry a receipt.
   */
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
  selectRelease(command: {
    applicationId: string;
    releaseVersion: string;
    actorId: string;
    at: number;
    reason: 'select' | 'rollback';
  }): Promise<{ selectionRevision: number }>;
  getSelectedRelease(applicationId: string): Promise<ApplicationReleaseRecord | undefined>;
  listReleaseSelections(applicationId: string): Promise<readonly ReleaseSelectionRecord[]>;

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

/** One durable protected tool-invocation record. */
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
}

/** The durable tool-invocation store port. */
export interface AgentToolInvocationStore {
  recordInvocationIntent(record: AgentToolInvocationRecord): Promise<AgentToolInvocationRecord>;
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
  /** Durable events after the given sequence, in sequence order. */
  listEventsFrom(streamId: string, afterSeq: number): Promise<readonly AgentStreamLedgerEvent[]>;
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
 * One durable command-idempotency receipt. A receipt binds the idempotency
 * key to the authenticated actor, the command kind, the canonical request
 * digest, and the durable result or terminal disposition.
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
  /** Canonical JSON of the durable result when status is `completed`. */
  readonly resultJson: string | undefined;
  readonly createdAt: number;
  readonly settledAt: number | undefined;
}

/** The durable command-idempotency store port (one winner per key). */
export interface CommandIdempotencyStore {
  /**
   * Insert-if-absent. Returns `claimed` for exactly one concurrent caller
   * (the winner); every other caller receives `exists` with the existing
   * durable receipt.
   */
  claimReceipt(record: CommandIdempotencyReceipt): Promise<'claimed' | 'exists'>;
  getReceipt(idempotencyKey: string): Promise<CommandIdempotencyReceipt | undefined>;
  completeReceipt(input: { idempotencyKey: string; resultJson: string; at: number }): Promise<void>;
  failReceipt(input: { idempotencyKey: string; responseCode: string; at: number }): Promise<void>;
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
