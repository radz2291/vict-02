//
// S9-03 CHANGESET BROWSER JOURNEY — pure contract helpers (server-shared).
//
// Mirrors the S9-04 confirmation journey pattern: a closed, pure table of
// command bodies / parsers / truthful banner texts used by the journey page
// server actions and pinned by the journey contract test. NO fetch and no
// target access happens here. Machinery facts relied on (packages/control/
// src/control-plane.ts, packages/server/src/commands.ts, packages/server/
// src/http.ts):
//   - propose/revise/decide/commit ride the standard command envelope
//     { schema: 'vict.command@1', command, payload } on the fixed POST
//     routes /vict/v1/changesets(+/revise|decide|commit), and EVERY
//     state-changing command requires a bounded Idempotency-Key
//     (COMMAND_IDEMPOTENCY_KEY_PATTERN). Changeset commands are NOT in
//     CONFIRMATION_REQUIRED_COMMANDS — governance integrity comes from
//     the control-plane machinery itself.
//   - propose/revise carry the closed authoring field set (changesetId,
//     base{kind,subjectId,expectedVersion}, operations, rationale,
//     riskClass low|medium|high, requiredApproverCount 1..8, expiresAt
//     epoch-ms > createdAt); contentHash derives from the validated
//     content (validateChangeSetContent).
//   - decide carries { changesetId, decision approved|declined } on the
//     changeset.approve scope; approvals bind the CURRENT contentHash.
//   - commit carries { changesetId } on the changeset.commit scope and is
//     IDEMPOTENT on an already-committed changeset: the SAME operation
//     receipts come back (control-plane.ts commit() status==='committed'
//     branch). A fresh commit after revision fails VICT_CONTROL_APPROVALS_
//     INVALIDATED because old approvals bind a different content hash.
//   - scope denials surface as VICT_ACTOR_SCOPE_DENIED (http.ts:176 → 403).
//   - low-risk commits require an authoritative PASSED validation run
//     (evidence policy #verifyCommitEvidence): changeset.execute-check
//     (kind validation|simulation) then attach-evidence with the run id.

/** Envelope marker of the versioned command transport (vict.command@1). */
export const CHANGESET_COMMAND_SCHEMA = 'vict.command@1';

/** The closed actor keys of the changeset journey (server-held credentials). */
export const CHANGESET_ACTORS = ['author', 'approver-a', 'approver-b'] as const;
export type ChangesetActor = (typeof CHANGESET_ACTORS)[number];

/** Closed risk-class vocabulary (control-types.ts ChangeSetRiskClass). */
const RISK_CLASSES = ['low', 'medium', 'high'] as const;
type RiskClass = (typeof RISK_CLASSES)[number];

/** Decisions accepted by changeset.decide (commands.ts decisionOf). */
const DECISIONS = ['approved', 'declined'] as const;

/** Bounded VICT identifier shape (CONTROL_ID_PATTERN mirror; max 128). */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;

/** A bounded identifier: the ONLY accepted user-supplied identity shape. */
export function isValidChangesetId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && ID_PATTERN.test(value);
}

/** Epoch-ms timestamp (bounded safe integer; up to 15 digits). */
export function isValidEpochMs(value: unknown): value is string {
  return typeof value === 'string' && /^\d{1,15}$/.test(value);
}

/** requiredApproverCount 1..8 (control-types.ts validateChangeSetContent). */
export function isValidApproverCount(value: unknown): value is string {
  return typeof value === 'string' && /^[1-8]$/.test(value);
}

/**
 * Bounded Idempotency-Key shape (COMMAND_IDEMPOTENCY_KEY_PATTERN mirror:
 * letters, digits, '.', '_', ':', '-'; at most 128) — required by the
 * target for EVERY state-changing command.
 */
export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

/** Decision vocabulary check. */
export function isValidDecision(value: string): value is (typeof DECISIONS)[number] {
  return (DECISIONS as readonly string[]).includes(value);
}

/** Risk-class vocabulary check. */
function isRiskClass(value: string): value is RiskClass {
  return (RISK_CLASSES as readonly string[]).includes(value);
}

/** The only operation kind the journey proposes (closed, never invented). */
const JOURNEY_OPERATION_KINDS = ['select-activation'] as const;

function isValidOperationKind(value: string): boolean {
  return (JOURNEY_OPERATION_KINDS as readonly string[]).includes(value);
}

export interface ProposeBody {
  readonly command: 'changeset.propose';
  readonly payload: {
    readonly changesetId: string;
    readonly base: {
      readonly kind: 'activation' | 'release';
      readonly subjectId: string;
      readonly expectedVersion: string;
    };
    readonly operations: readonly {
      readonly kind: 'select-activation';
      readonly graphId: string;
      readonly activationVersion: string;
    }[];
    readonly rationale: string;
    readonly riskClass: RiskClass;
    readonly requiredApproverCount: number;
    readonly expiresAt: number;
  };
}

/**
 * Build the propose command body. EVERY member is validated BEFORE any
 * fetch; unknown operation kinds, unbounded ids, or malformed numbers
 * return null (fail closed below-transport, no fetch).
 */
export function buildProposeBody(fields: Record<string, unknown>): ProposeBody | null {
  const changesetId = fields['changesetId'];
  const baseKind = fields['baseKind'];
  const baseSubjectId = fields['baseSubjectId'];
  const baseExpectedVersion = fields['baseExpectedVersion'];
  const operationKind = fields['operationKind'];
  const graphId = fields['graphId'];
  const activationVersion = fields['activationVersion'];
  const rationale = fields['rationale'];
  const riskClass = fields['riskClass'];
  const requiredApproverCount = fields['requiredApproverCount'];
  const expiresAt = fields['expiresAt'];
  if (
    !isValidChangesetId(changesetId) ||
    (baseKind !== 'activation' && baseKind !== 'release') ||
    !isValidChangesetId(baseSubjectId) ||
    !isValidChangesetId(baseExpectedVersion) ||
    !isValidOperationKind(operationKind as string) ||
    !isValidChangesetId(graphId) ||
    !isValidChangesetId(activationVersion) ||
    typeof rationale !== 'string' ||
    rationale.length === 0 ||
    rationale.length > 2000 ||
    !isRiskClass(riskClass as string) ||
    !isValidApproverCount(requiredApproverCount) ||
    !isValidEpochMs(expiresAt)
  ) {
    return null;
  }
  return {
    command: 'changeset.propose',
    payload: {
      changesetId,
      base: {
        kind: baseKind as 'activation' | 'release',
        subjectId: baseSubjectId,
        expectedVersion: baseExpectedVersion,
      },
      operations: [{ kind: 'select-activation', graphId, activationVersion }],
      rationale,
      riskClass: riskClass as RiskClass,
      requiredApproverCount: Number(requiredApproverCount),
      expiresAt: Number(expiresAt),
    },
  };
}

/**
 * Build the revise command body (author-only at the target). The journey
 * demo passes the SAME operation content with a CHANGED rationale: the
 * content hash CHANGES, so earlier approvals stop binding
 * (VICT_CONTROL_APPROVALS_INVALIDATED on a later commit).
 */
export function buildReviseBody(
  fields: Record<string, unknown>,
): { command: 'changeset.revise'; payload: Omit<ProposeBody['payload'], 'base'> } | null {
  // The revise payload carries the closed revise field set EXACTLY: the
  // target's command registry for changeset.revise is [changesetId,
  // operations, rationale, riskClass, requiredApproverCount, expiresAt] —
  // the base is NOT re-authorable (the proposal keeps its declared base;
  // the target revalidates against the stored record.base). The target
  // derives the NEW content hash from the changed content and DEMOTES an
  // approved changeset to 'draft' — earlier approvals stop binding and a
  // later commit fails closed.
  const propose = buildProposeBody(fields);
  if (propose === null) {
    return null;
  }
  const { base: _omitted, ...revisePayload } = propose.payload;
  void _omitted;
  return { command: 'changeset.revise', payload: revisePayload };
}

/** Build the decide command body (closed vocabulary; reason is omitted). */
export function buildDecideBody(fields: Record<string, unknown>): {
  command: 'changeset.decide';
  payload: { changesetId: string; decision: 'approved' | 'declined' };
} | null {
  const changesetId = fields['changesetId'];
  const decision = fields['decision'];
  if (!isValidChangesetId(changesetId) || !isValidDecision(decision as string)) {
    return null;
  }
  const decided: 'approved' | 'declined' = decision as 'approved' | 'declined';
  return { command: 'changeset.decide', payload: { changesetId, decision: decided } };
}

/** Build the commit command body ({ changesetId } exactly). */
export function buildCommitBody(
  fields: Record<string, unknown>,
): { command: 'changeset.commit'; payload: { changesetId: string } } | null {
  const changesetId = fields['changesetId'];
  if (!isValidChangesetId(changesetId)) {
    return null;
  }
  return { command: 'changeset.commit', payload: { changesetId } };
}

/** Build the execute-check command body (kind fixed by the caller). */
export function buildCheckBody(fields: Record<string, unknown>): {
  command: 'changeset.execute-check';
  payload: { changesetId: string; kind: 'validation' };
} | null {
  const changesetId = fields['changesetId'];
  if (!isValidChangesetId(changesetId)) {
    return null;
  }
  return { command: 'changeset.execute-check', payload: { changesetId, kind: 'validation' } };
}

/** Build the attach-evidence command body from an EXECUTED run id. */
export function buildAttachEvidenceBody(fields: Record<string, unknown>): {
  command: 'changeset.attach-evidence';
  payload: { changesetId: string; kind: 'validation'; runId: string };
} | null {
  const changesetId = fields['changesetId'];
  const runId = fields['runId'];
  if (!isValidChangesetId(changesetId) || !isValidChangesetId(runId)) {
    return null;
  }
  return {
    command: 'changeset.attach-evidence',
    payload: { changesetId, kind: 'validation', runId },
  };
}

/* ------------------------------------------------------------------ */
/* Truthful banner texts                                               */
/* ------------------------------------------------------------------ */

/**
 * Banner text for a failed target round-trip. Every banner restates the
 * STABLE code the target issued plus what did NOT happen — never raw
 * error bytes, never invented state.
 */
export function failureBannerText(code: string): string {
  switch (code) {
    case 'VICT_ACTOR_SCOPE_DENIED':
      return (
        'Refused (VICT_ACTOR_SCOPE_DENIED): this server-held credential does not hold the ' +
        'scope the target requires for that command — the separate-approver boundary held. ' +
        'No decision was recorded and the changeset state is unchanged.'
      );
    case 'VICT_CONTROL_CHANGESET_NOT_APPROVED':
      return (
        'Commit refused (VICT_CONTROL_CHANGESET_NOT_APPROVED): the changeset was never ' +
        'promoted to approved — no operation was applied and no audit/commit effect exists.'
      );
    case 'VICT_CONTROL_APPROVALS_INVALIDATED':
      return (
        'Commit refused (VICT_CONTROL_APPROVALS_INVALIDATED): the recorded approvals bind a ' +
        'CHANGED content hash (the proposal was revised, so the approval decisions no longer ' +
        'bind the current content) — nothing was applied; fresh approvals are required.'
      );
    case 'VICT_CONTROL_CHANGESET_NOT_DRAFT':
      return (
        'Refused (VICT_CONTROL_CHANGESET_NOT_DRAFT): the changeset is no longer open for ' +
        'this operation — nothing was changed.'
      );
    case 'VICT_CONTROL_CHANGESET_MISSING':
      return (
        'Refused (VICT_CONTROL_CHANGESET_MISSING): the target has no changeset with this id; ' +
        'nothing is claimed and nothing was changed.'
      );
    case 'VICT_CONTROL_CHANGESET_EXPIRED':
      return 'Refused (VICT_CONTROL_CHANGESET_EXPIRED): the proposal expired before this step — nothing was changed.';
    case 'VICT_CONTROL_BASE_STALE':
      return (
        'Refused (VICT_CONTROL_BASE_STALE): the declared base is no longer the current subject ' +
        'selection — the commit failed closed before ANY mutation.'
      );
    case 'VICT_CONTROL_EVIDENCE_MISSING':
    case 'VICT_CONTROL_EVIDENCE_FAILED':
    case 'VICT_CONTROL_EVIDENCE_STALE':
    case 'VICT_CONTROL_EVIDENCE_NOT_AUTHORITATIVE':
      return (
        `Commit refused (${code}): the risk-class evidence policy is not satisfied by an ` +
        'authoritative PASSED validation run — nothing was applied.'
      );
    case 'VICT_COMMAND_FIELD_INVALID':
    case 'VICT_COMMAND_PAYLOAD_INVALID':
    case 'VICT_CONTROL_FIELD_INVALID':
    case 'VICT_CONTROL_OPERATION_INVALID':
    case 'VICT_CONTROL_ID_INVALID':
    case 'VICT_CONTROL_TIMESTAMP_INVALID':
    case 'VICT_CONTROL_RELEASE_INVALID':
      return (
        `Refused (${code}): the target rejected the request shape — nothing was changed. ` +
        'Re-check the bounded fields before retrying.'
      );
    case 'VICT_COMMAND_IDEMPOTENCY_KEY_INVALID':
      return 'Refused (VICT_COMMAND_IDEMPOTENCY_KEY_INVALID): a bounded Idempotency-Key is required for every state-changing changeset command.';
    case 'VICT_COMMAND_IDEMPOTENCY_CONFLICT':
      return (
        'Refused (VICT_COMMAND_IDEMPOTENCY_CONFLICT): this Idempotency-Key was already used ' +
        'with different content — use a fresh key to continue; no duplicate effect was created.'
      );
    case 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS':
      return 'Refused (VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS): the target is still settling the first attempt; retry later.';
    case 'VICT_COMMAND_UNKNOWN':
      return 'Refused (VICT_COMMAND_UNKNOWN): the target does not know this command.';
    default:
      return `The target refused this step (${code}). Nothing more can be claimed here; judge the outcome on the target.`;
  }
}

/** The truthful success banner of a commit (first apply AND the idempotent replay). */
export function commitBannerText(appliedCount: number, changesetId: string): string {
  return (
    `Commit accepted for ${changesetId}: status committed; ${appliedCount} durable operation ` +
    'receipt(s). Every operation was applied EXACTLY ONCE (receipt-backed, no partial state). ' +
    'Repeating the commit is the IDEMPOTENT REPLAY of the first: the target returns the SAME ' +
    'receipts with one outcome and NEVER applies a second effect — no duplicate effect exists.'
  );
}

/* ------------------------------------------------------------------ */
/* Narrow parsers (truthful projections; missing stays missing)         */
/* ------------------------------------------------------------------ */

export interface ChangesetSummary {
  readonly changesetId: string;
  readonly status: string;
  readonly contentHash: string;
  readonly authorActorId: string;
  readonly riskClass: string;
  readonly requiredApproverCount: string;
  readonly operations: readonly {
    readonly index: number;
    readonly kind: string;
    readonly subject: string;
  }[];
  readonly baseKind: string | null;
  readonly baseSubjectId: string | null;
  readonly baseExpectedVersion: string | null;
  readonly validationOutcome: string | null;
  readonly validationRunId: string | null;
  readonly simulationOutcome: string | null;
  readonly simulationRunId: string | null;
}

/** Narrow a changeset record; `null` when the shape is not a record. */
export function asChangesetSummary(data: unknown): ChangesetSummary | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  // Integrator seam note (S9-03): the transport unwraps the target envelope
  // to the inner command result; propose/revise/get/attach-evidence nest the
  // changeset record under `changeset`. Accept BOTH the nested and
  // (defensively) the flattened record — never anything else.
  const outer = data as Record<string, unknown>;
  const record = ((typeof outer['changeset'] === 'object' ? outer['changeset'] : null) ??
    data) as Record<string, unknown>;
  const str = (key: string): string | undefined =>
    typeof record[key] === 'string' ? (record[key] as string) : undefined;
  const changesetId = str('changesetId');
  const contentHash = str('contentHash');
  const status = str('status');
  if (changesetId === undefined || contentHash === undefined || status === undefined) {
    return null;
  }
  const operations: { index: number; kind: string; subject: string }[] = [];
  if (Array.isArray(record['operations'])) {
    record['operations'].forEach((operation, index) => {
      if (typeof operation !== 'object' || operation === null) {
        return;
      }
      const op = operation as Record<string, unknown>;
      const kind = typeof op['kind'] === 'string' ? op['kind'] : 'unknown';
      const subject =
        typeof op['activationVersion'] === 'string'
          ? (op['activationVersion'] as string)
          : typeof op['targetActivationVersion'] === 'string'
            ? (op['targetActivationVersion'] as string)
            : typeof op['releaseVersion'] === 'string'
              ? (((op['release'] as Record<string, unknown>)?.['releaseVersion'] as string) ??
                (op['releaseVersion'] as string))
              : 'unknown';
      operations.push({ index, kind, subject });
    });
  }
  const validation = record['validation'];
  const simulation = record['simulation'];
  const evidence = (value: unknown, key: string): string | null =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)[key] === 'string'
      ? ((value as Record<string, unknown>)[key] as string)
      : null;
  return {
    changesetId,
    status,
    contentHash,
    authorActorId: str('authorActorId') ?? '',
    riskClass: str('riskClass') ?? '',
    requiredApproverCount:
      typeof record['requiredApproverCount'] === 'number'
        ? String(record['requiredApproverCount'])
        : '',
    operations,
    baseKind: str('base') ? String((record['base'] as Record<string, unknown>)['kind']) : null,
    baseSubjectId:
      typeof record['base'] === 'object' && record['base'] !== null
        ? (((record['base'] as Record<string, unknown>)['subjectId'] as string | undefined) ?? null)
        : null,
    baseExpectedVersion:
      typeof record['base'] === 'object' && record['base'] !== null
        ? (((record['base'] as Record<string, unknown>)['expectedVersion'] as string | undefined) ??
          null)
        : null,
    validationOutcome: evidence(validation, 'outcome'),
    validationRunId: evidence(validation, 'runId'),
    simulationOutcome: evidence(simulation, 'outcome'),
    simulationRunId: evidence(simulation, 'runId'),
  };
}

/** Narrow a GET list `data.changesets` to truthful rows. */
export function asChangesetListRows(data: unknown): readonly ChangesetSummary[] {
  if (
    typeof data !== 'object' ||
    data === null ||
    !Array.isArray((data as Record<string, unknown>)['changesets'])
  ) {
    return [];
  }
  return ((data as Record<string, unknown>)['changesets'] as unknown[])
    .map((entry) => asChangesetSummary(entry))
    .filter((entry): entry is ChangesetSummary => entry !== null);
}

export interface DecisionSummary {
  readonly changesetId: string;
  readonly status: string;
  readonly contentHash: string;
  readonly decision: string;
  readonly approverActorId: string;
}

/** Narrow a decide `result` ({ record, decision }). */
export function asDecisionOutcome(data: unknown): DecisionSummary | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  // Integrator seam note (S9-03): the decide command nests the control-plane
  // { record, decision } result under `result`. Accept BOTH the nested and
  // (defensively) the direct result — never anything else.
  const outer = data as Record<string, unknown>;
  const result = (typeof outer['result'] === 'object' && outer['result'] !== null
    ? outer['result']
    : data) as Record<string, unknown>;
  const record = asChangesetSummary(result['record']);
  const decision =
    typeof result['decision'] === 'object' && result['decision'] !== null
      ? (result['decision'] as Record<string, unknown>)
      : undefined;
  const decisionValue =
    typeof decision?.['decision'] === 'string' ? (decision['decision'] as string) : null;
  const approver =
    typeof decision?.['approverActorId'] === 'string'
      ? (decision['approverActorId'] as string)
      : null;
  if (record === null || decisionValue === null) {
    return null;
  }
  return {
    changesetId: record.changesetId,
    status: record.status,
    contentHash: record.contentHash,
    decision: decisionValue,
    approverActorId: approver ?? '',
  };
}

export interface CommitSummary {
  readonly changesetId: string;
  readonly status: string;
  readonly contentHash: string;
  readonly appliedKinds: readonly string[];
  readonly appliedCount: number;
}

/**
 * Narrow a commit `result` ({ record, applied }) — `applied` is the
 * durable operation-receipt list (control-plane.ts commit()/resumeCommit);
 * its length is EXACTLY the number of applied operations and is the same
 * on the first commit and on the idempotent replay.
 */
export function asCommitOutcome(data: unknown): CommitSummary | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  // Integrator seam note (S9-03): the commit command nests the control-plane
  // { record, applied } result under `result`. Accept BOTH the nested and
  // (defensively) the direct result — never anything else.
  const outer = data as Record<string, unknown>;
  const result = (typeof outer['result'] === 'object' && outer['result'] !== null
    ? outer['result']
    : data) as Record<string, unknown>;
  const record = asChangesetSummary(result['record']);
  if (record === null || !Array.isArray(result['applied'])) {
    return null;
  }
  const appliedKinds = (result['applied'] as unknown[]).filter(
    (entry): entry is string => typeof entry === 'string',
  );
  return {
    changesetId: record.changesetId,
    status: record.status,
    contentHash: record.contentHash,
    appliedKinds,
    appliedCount: appliedKinds.length,
  };
}

export interface CommitView {
  readonly summary: CommitSummary;
  readonly bannerText: string;
}

/** The commit view (banner + receipt summary) for a successful commit. */
export function commitView(summary: CommitSummary): CommitView {
  return {
    summary,
    bannerText: commitBannerText(summary.appliedCount, summary.changesetId),
  };
}

export interface EvidenceSummary {
  readonly runId: string;
  readonly kind: string;
  readonly outcome: string;
  readonly changesetId: string;
  readonly contentHash: string | null;
  readonly attachedOutcome: string | null;
}

/** Narrow an execute-check `run` record. */
export function asCheckRun(data: unknown): { runId: string; kind: string; outcome: string } | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  // Integrator seam note (S9-03): the transport unwraps the target envelope
  // to the inner command result; the execute-check result nests the run
  // record under `run`. Accept BOTH the nested and (defensively) the
  // flattened record — never anything else.
  const outer = data as Record<string, unknown>;
  const candidate = outer['run'] ?? data;
  if (typeof candidate !== 'object' || candidate === null) {
    return null;
  }
  const run = candidate as Record<string, unknown>;
  if (
    typeof run['runId'] !== 'string' ||
    typeof run['kind'] !== 'string' ||
    typeof run['outcome'] !== 'string'
  ) {
    return null;
  }
  return { runId: run['runId'], kind: run['kind'], outcome: run['outcome'] };
}
