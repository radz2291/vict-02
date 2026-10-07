/**
 * The inspection domain adapter + action dispatcher — the REAL execution
 * boundaries (U1-05, U3-03). No UI-only authorization: the server holds the
 * authorization profile; the adapter enforces declared permissions and the
 * domain rules (transitions, optimistic concurrency, replay) per
 * PROOF-DESIGN §1 and the frozen API-SPEC diagnostics (DOMAIN_CONFLICT,
 * DATA_IDEMPOTENT_REPLAY).
 *
 * U3: the domain rules live in ONE shared core (`applyDomainMutation`) —
 * the simulated in-memory adapter and the durable SQLite adapter both run
 * the SAME rules through this core; there is no second domain engine.
 */

import type {
  ApplicationDataAdapter,
  ApplicationDataMutationRequest,
  ApplicationDataQueryRequest,
  ApplicationDataRequestContext,
  ApplicationDataResult,
} from '@victframework/application';
import type { ActionResult } from '@victframework/ui-svelte';

export type InspectionStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface FindingRow {
  readonly id: string;
  readonly inspectionId: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface EvidenceRow {
  readonly id: string;
  readonly inspectionId: string;
  label: string;
  kind: 'note' | 'image-ref';
}

export interface ActivityRow {
  readonly id: string;
  readonly inspectionId: string;
  at: string;
  actor: string;
  entry: string;
}

export interface InspectionRow {
  readonly id: string;
  readonly title: string;
  status: InspectionStatus;
  readonly technician: string;
  readonly supervisor: string;
  submittedAt: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  domainRevision: number;
}

/** The server's authorization profile (never granted by the UI). */
export const serverGrants: readonly string[] = [
  'qlt.inspection.read',
  'qlt.inspection.submit',
  'qlt.inspection.approve',
  'qlt.inspection.reject',
  'qlt.inspection.revise',
  'qlt.inspection.edit',
];

/** Role → effective grants (the deployment maps roles; the UI cannot). */
export const roleGrants: Readonly<Record<string, readonly string[]>> = {
  supervisor: ['qlt.inspection.read', 'qlt.inspection.approve', 'qlt.inspection.reject'],
  technician: [
    'qlt.inspection.read',
    'qlt.inspection.submit',
    'qlt.inspection.revise',
    'qlt.inspection.edit',
  ],
};

export function grantsForRole(role: string): readonly string[] {
  return roleGrants[role] ?? ['qlt.inspection.read'];
}

export interface SeedInput {
  readonly inspections: readonly InspectionRow[];
  readonly findings: readonly FindingRow[];
  readonly evidence: readonly EvidenceRow[];
  readonly activity: readonly ActivityRow[];
}

export function seedDomain(): SeedInput {
  const now = '2026-10-06T09:00:00.000Z';
  return {
    inspections: [
      {
        id: 'i-101',
        title: 'Cold-chain compressor room',
        status: 'submitted',
        technician: 't.nguyen',
        supervisor: 's.hart',
        submittedAt: now,
        decidedAt: null,
        rejectionReason: null,
        domainRevision: 3,
      },
      {
        id: 'i-102',
        title: 'Dock leveller hydraulics',
        status: 'submitted',
        technician: 't.nguyen',
        supervisor: 's.hart',
        submittedAt: now,
        decidedAt: null,
        rejectionReason: null,
        domainRevision: 2,
      },
      {
        id: 'i-103',
        title: 'Fire shutter mechanism',
        status: 'submitted',
        technician: 'm.osei',
        supervisor: 's.hart',
        submittedAt: now,
        decidedAt: null,
        rejectionReason: null,
        domainRevision: 1,
      },
    ],
    findings: [
      {
        id: 'f-1',
        inspectionId: 'i-101',
        severity: 'high',
        description: 'Seal wear beyond tolerance',
      },
      {
        id: 'f-2',
        inspectionId: 'i-101',
        severity: 'low',
        description: 'Label fade on shutoff valve',
      },
      {
        id: 'f-3',
        inspectionId: 'i-102',
        severity: 'medium',
        description: 'Hydraulic weep at fitting 4B',
      },
    ],
    evidence: [
      { id: 'e-1', inspectionId: 'i-101', label: 'Compressor seal photo', kind: 'image-ref' },
      { id: 'e-2', inspectionId: 'i-101', label: 'Torque log excerpt', kind: 'note' },
      { id: 'e-3', inspectionId: 'i-102', label: 'Fitting 4B close-up', kind: 'image-ref' },
    ],
    activity: [
      {
        id: 'a-1',
        inspectionId: 'i-101',
        at: now,
        actor: 't.nguyen',
        entry: 'Inspection submitted for decision',
      },
      {
        id: 'a-2',
        inspectionId: 'i-102',
        at: now,
        actor: 't.nguyen',
        entry: 'Inspection submitted for decision',
      },
      {
        id: 'a-3',
        inspectionId: 'i-103',
        at: now,
        actor: 'm.osei',
        entry: 'Inspection submitted for decision',
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Shared domain core — ONE rule implementation for every adapter backend.
// ---------------------------------------------------------------------------

/** The domain tables a storage backend must expose to the shared core. */
export interface InspectionTables {
  readonly inspections: InspectionRow[];
  readonly findings: FindingRow[];
  readonly evidence: EvidenceRow[];
  readonly activity: ActivityRow[];
}

/** Injected clock (deterministic in scenarios/tests; system time in product). */
export interface DomainClock {
  now(): string;
}

export const systemClock: DomainClock = {
  now: () => new Date().toISOString(),
};

export interface LedgerLookup {
  /** Whether the key was recorded before. */
  readonly recorded: boolean;
  /** When recorded: does the stored input digest match the current one? */
  readonly digestMatches: boolean;
  /** When recorded: the row recorded under this key (for reconcile). */
  readonly rowJson?: string;
}

/**
 * Idempotency ledger. Keyed creates RECONCILE (same key + same input → the
 * recorded row, success); irreversible DECISIONS reject replays
 * (DATA_IDEMPOTENT_REPLAY, state unchanged — frozen PROOF-DESIGN §1).
 */
export interface DomainLedger {
  lookup(key: string, digest: string): LedgerLookup;
  record(key: string, digest: string, rowJson: string): void;
}

export function createMemoryLedger(): DomainLedger {
  const entries = new Map<string, { digest: string; rowJson: string }>();
  return {
    lookup(key, digest) {
      const found = entries.get(key);
      if (found === undefined) return { recorded: false, digestMatches: false };
      return {
        recorded: true,
        digestMatches: found.digest === digest,
        rowJson: found.rowJson,
      };
    },
    record(key, digest, rowJson) {
      entries.set(key, { digest, rowJson });
    },
  };
}

export type DomainOutcome =
  | { readonly ok: true; readonly row: Record<string, unknown>; readonly replayed?: boolean }
  | { readonly ok: false; readonly code: string; readonly message: string };

const failure = (code: string, message: string): DomainOutcome => ({ ok: false, code, message });

/** Stable input digest for ledger keys (sorted-key JSON; store-local only). */
function digestOf(value: unknown): string {
  const stable = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(stable);
    if (input !== null && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) => [k, stable(v)]),
      );
    }
    return input;
  };
  return JSON.stringify(stable(value));
}

const DECISION_STATUS: Readonly<Record<string, InspectionStatus>> = {
  approve: 'submitted',
  reject: 'submitted',
};

const DECISION_PERMISSION: Readonly<Record<string, string>> = {
  submit: 'qlt.inspection.submit',
  approve: 'qlt.inspection.approve',
  reject: 'qlt.inspection.reject',
  revise: 'qlt.inspection.revise',
};

/**
 * The ONE inspection-domain mutation implementation (permissions, status
 * transitions, mandatory rejection reason, expected domain revision, replay)
 * used by the simulated AND durable adapters. Every failure path leaves the
 * tables unchanged.
 */
export function applyInspectionMutation(
  tables: InspectionTables,
  request: ApplicationDataMutationRequest,
  context: ApplicationDataRequestContext,
  clock: DomainClock,
  ledger: DomainLedger,
): DomainOutcome {
  const row = tables.inspections.find((candidate) => candidate.id === request.id);
  if (row === undefined) {
    return failure('DATA_UNKNOWN_IDENTITY', 'No such inspection.');
  }
  const op = request.op;
  const requiredPermission = DECISION_PERMISSION[op];
  if (requiredPermission === undefined) {
    return failure('DATA_MUTATION_NOT_DECLARED', `Mutation '${op}' is not declared.`);
  }
  if (!context.permissions.includes(requiredPermission)) {
    return failure('DATA_UNAUTHORIZED', `${op} requires ${requiredPermission}.`);
  }
  const input = (request.input ?? {}) as {
    readonly expectedDomainRevision?: number;
    readonly rejectionReason?: string;
  };

  // Irreversible decisions (approve/reject) honor idempotency keys: a replay
  // of an already-recorded decision is rejected with DATA_IDEMPOTENT_REPLAY
  // and leaves state unchanged (frozen PROOF-DESIGN §1).
  if (op === 'approve' || op === 'reject') {
    if (request.idempotencyKey !== undefined) {
      const digest = digestOf({ op, id: request.id, input });
      const seen = ledger.lookup(request.idempotencyKey, digest);
      if (seen.recorded && seen.digestMatches) {
        return failure(
          'DATA_IDEMPOTENT_REPLAY',
          'This decision was already recorded; replaying it changes nothing.',
        );
      }
      if (seen.recorded) {
        return failure(
          'DATA_IDEMPOTENCY_CONFLICT',
          'This idempotency key was used for a different decision.',
        );
      }
    }
    if (row.status !== DECISION_STATUS[op]) {
      return failure(
        'DATA_INVALID_INPUT',
        `${op} requires status '${DECISION_STATUS[op]}' (found '${row.status}').`,
      );
    }
    if (input.expectedDomainRevision !== row.domainRevision) {
      return failure(
        'DOMAIN_CONFLICT',
        `Stale decision: expected domain revision ${String(input.expectedDomainRevision)}, actual ${String(row.domainRevision)}. State unchanged.`,
      );
    }
    const decidedAt = clock.now();
    const recordAndReturn = (updated: InspectionRow, entry: string): DomainOutcome => {
      if (request.idempotencyKey !== undefined) {
        ledger.record(
          request.idempotencyKey,
          digestOf({ op, id: request.id, input }),
          JSON.stringify(updated),
        );
      }
      tables.activity.push({
        id: `a-${tables.activity.length + 1}`,
        inspectionId: row.id,
        at: decidedAt,
        actor: context.actor ?? 'unknown',
        entry,
      });
      return { ok: true, row: { ...updated } };
    };
    if (op === 'approve') {
      const updated: InspectionRow = { ...row, status: 'approved', decidedAt, domainRevision: row.domainRevision + 1 };
      tables.inspections[tables.inspections.indexOf(row)] = updated;
      return recordAndReturn(updated, 'Inspection approved');
    }
    const reason = input.rejectionReason ?? '';
    if (reason.trim().length === 0) {
      return failure('DATA_INVALID_INPUT', 'A rejection reason is mandatory.');
    }
    const updated: InspectionRow = {
      ...row,
      status: 'rejected',
      rejectionReason: reason,
      decidedAt,
      domainRevision: row.domainRevision + 1,
    };
    tables.inspections[tables.inspections.indexOf(row)] = updated;
    return recordAndReturn(updated, `Inspection rejected — reason: ${reason}`);
  }

  if (op === 'submit') {
    if (row.status !== 'draft') {
      return failure(
        'DATA_INVALID_INPUT',
        `Submit requires status 'draft' (found '${row.status}').`,
      );
    }
    const at = clock.now();
    const updated: InspectionRow = {
      ...row,
      status: 'submitted',
      submittedAt: at,
      domainRevision: row.domainRevision + 1,
    };
    tables.inspections[tables.inspections.indexOf(row)] = updated;
    tables.activity.push({
      id: `a-${tables.activity.length + 1}`,
      inspectionId: row.id,
      at,
      actor: context.actor ?? 'unknown',
      entry: 'Inspection submitted for decision',
    });
    return { ok: true, row: { ...updated } };
  }

  // revise: rejected → draft; record-level decision fields clear; the reason
  // REMAINS in the activity trail; only the ASSIGNED technician may revise.
  if (context.actor !== row.technician) {
    return failure('DATA_UNAUTHORIZED', 'Only the assigned technician may revise.');
  }
  if (row.status !== 'rejected') {
    return failure(
      'DATA_INVALID_INPUT',
      `Revise requires status 'rejected' (found '${row.status}').`,
    );
  }
  const at = clock.now();
  const updated: InspectionRow = {
    ...row,
    status: 'draft',
    decidedAt: null,
    rejectionReason: null,
    domainRevision: row.domainRevision + 1,
  };
  tables.inspections[tables.inspections.indexOf(row)] = updated;
  tables.activity.push({
    id: `a-${tables.activity.length + 1}`,
    inspectionId: row.id,
    at,
    actor: context.actor ?? 'unknown',
    entry: 'Revise requested — returned to draft for corrections',
  });
  return { ok: true, row: { ...updated } };
}

interface ChildSpec {
  readonly permission: string;
  readonly requireInspection: boolean;
  readonly allowedStatuses: readonly InspectionStatus[] | undefined;
}

const CHILD_SPECS: Readonly<Record<string, ChildSpec>> = {
  finding: {
    permission: 'qlt.inspection.edit',
    requireInspection: true,
    allowedStatuses: ['draft', 'submitted'],
  },
  evidence: {
    permission: 'qlt.inspection.edit',
    requireInspection: true,
    allowedStatuses: undefined,
  },
};

/**
 * Keyed child-row create (`finding.add` / `evidence.add`). Findings may be
 * added to draft/submitted inspections only (frozen §1); evidence has no
 * status constraint. Same-key replays reconcile to the recorded row; failed
 * creates never consume the key.
 */
export function applyChildAdd(
  tables: InspectionTables,
  request: ApplicationDataMutationRequest,
  context: ApplicationDataRequestContext,
  clock: DomainClock,
  ledger: DomainLedger,
): DomainOutcome {
  const spec = CHILD_SPECS[request.resourceId];
  if (spec === undefined) {
    return failure('DATA_UNKNOWN_RESOURCE', `Unknown resource '${request.resourceId}'.`);
  }
  if (!context.permissions.includes(spec.permission)) {
    return failure('DATA_UNAUTHORIZED', `add requires ${spec.permission}.`);
  }
  const input = (request.input ?? {}) as Record<string, unknown>;
  const id = input['id'];
  if (typeof id !== 'string' || id.length === 0) {
    return failure('DATA_INVALID_INPUT', 'A row id is required.');
  }
  const isFinding = request.resourceId === 'finding';
  const digest = digestOf({ op: 'add', resourceId: request.resourceId, input });
  if (request.idempotencyKey !== undefined) {
    const seen = ledger.lookup(request.idempotencyKey, digest);
    if (seen.recorded && seen.digestMatches && seen.rowJson !== undefined) {
      // Keyed-create replay: reconcile to the recorded row (suite rule 5).
      return { ok: true, row: JSON.parse(seen.rowJson) as Record<string, unknown>, replayed: true };
    }
    if (seen.recorded) {
      return failure(
        'DATA_IDEMPOTENCY_CONFLICT',
        'This idempotency key was used for a different row.',
      );
    }
  }
  const existing = isFinding
    ? tables.findings.some((candidate) => candidate.id === id)
    : tables.evidence.some((candidate) => candidate.id === id);
  if (existing) {
    return failure('DATA_CONTRACT_REJECTED', `A ${request.resourceId} row '${id}' already exists.`);
  }
  const inspectionId = input['inspectionId'];
  const inspection =
    typeof inspectionId === 'string'
      ? tables.inspections.find((candidate) => candidate.id === inspectionId)
      : undefined;
  if (spec.requireInspection && inspection === undefined) {
    return failure('DATA_UNKNOWN_IDENTITY', 'No such inspection.');
  }
  if (spec.allowedStatuses !== undefined && inspection !== undefined) {
    if (!spec.allowedStatuses.includes(inspection.status)) {
      return failure(
        'DATA_INVALID_INPUT',
        `Findings can be added to draft/submitted inspections (found '${inspection.status}').`,
      );
    }
  }
  let stored: FindingRow | EvidenceRow;
  let entry: string;
  if (isFinding) {
    const finding: FindingRow = {
      id,
      inspectionId: String(inspectionId ?? ''),
      severity: (input['severity'] as FindingRow['severity'] ?? 'low'),
      description: String(input['description'] ?? ''),
    };
    tables.findings.push(finding);
    stored = finding;
    entry = `Finding added: ${finding.description}`;
  } else {
    const evidence: EvidenceRow = {
      id,
      inspectionId: String(inspectionId ?? ''),
      label: String(input['label'] ?? ''),
      kind: (input['kind'] as EvidenceRow['kind'] ?? 'note'),
    };
    tables.evidence.push(evidence);
    stored = evidence;
    entry = `Evidence added: ${evidence.label}`;
  }
  if (request.idempotencyKey !== undefined) {
    ledger.record(request.idempotencyKey, digest, JSON.stringify(stored));
  }
  tables.activity.push({
    id: `a-${tables.activity.length + 1}`,
    inspectionId: String(inspectionId ?? ''),
    at: clock.now(),
    actor: context.actor ?? 'unknown',
    entry,
  });
  return { ok: true, row: { ...stored } };
}

/** Generic list/get over one child table (shared by both adapters). */
export function queryTable(
  rows: readonly Record<string, unknown>[],
  request: ApplicationDataQueryRequest,
): ApplicationDataResult {
  if (request.op === 'get') {
    const row = rows.find((candidate) => candidate['id'] === request.id);
    if (row === undefined) {
      return { ok: false, code: 'DATA_UNKNOWN_IDENTITY', message: 'No such row.' };
    }
    return { ok: true, row: project(row, request.projection) };
  }
  let output = rows.map((row) => ({ ...row }));
  const filters = request.filters ?? {};
  for (const [field, value] of Object.entries(filters)) {
    output = output.filter((row) => row[field] === value);
  }
  const sort = request.sort ?? [];
  for (const spec of [...sort].reverse()) {
    output = [...output].sort((a, b) => compareValues(a[spec.field], b[spec.field], spec.direction));
  }
  const total = output.length;
  const offset = request.offset ?? 0;
  const limit = request.limit ?? output.length;
  output = output.slice(offset, offset + limit).map((row) => project(row, request.projection));
  return { ok: true, rows: output, total };
}

function project(
  row: Record<string, unknown>,
  projection: readonly string[] | undefined,
): Record<string, unknown> {
  if (projection === undefined) return row;
  return Object.fromEntries(projection.filter((name) => name in row).map((name) => [name, row[name]]));
}

function compareValues(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
  const base =
    a === b ? 0 : a === null || a === undefined ? 1 : b === null || b === undefined ? -1 : a < b ? -1 : 1;
  return direction === 'asc' ? base : -base;
}

// ---------------------------------------------------------------------------
// Simulated (in-memory) adapter — the U1 real boundary, now on the shared core.
// ---------------------------------------------------------------------------

export class InspectionDataAdapter implements ApplicationDataAdapter {
  readonly id = 'vict.inspection-memory';
  readonly revision = '1';
  readonly #tables: InspectionTables;
  readonly #ledger: DomainLedger;
  readonly #clock: DomainClock;

  constructor(seed: SeedInput, options?: { readonly clock?: DomainClock; readonly ledger?: DomainLedger }) {
    this.#tables = {
      inspections: seed.inspections.map((row) => ({ ...row })),
      findings: seed.findings.map((row) => ({ ...row })),
      evidence: seed.evidence.map((row) => ({ ...row })),
      activity: seed.activity.map((row) => ({ ...row })),
    };
    this.#clock = options?.clock ?? systemClock;
    this.#ledger = options?.ledger ?? createMemoryLedger();
  }

  query(
    request: ApplicationDataQueryRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult> {
    if (!context.permissions.includes('qlt.inspection.read')) {
      return Promise.resolve({ ok: false, code: 'DATA_UNAUTHORIZED', message: 'Read denied.' });
    }
    if (request.resourceId === 'inspection') {
      if (request.op === 'list') {
        return Promise.resolve({
          ok: true,
          rows: this.#tables.inspections.map((row) => this.joined(row)),
          total: this.#tables.inspections.length,
        });
      }
      if (request.op === 'get') {
        const row = this.#tables.inspections.find((candidate) => candidate.id === request.id);
        if (row === undefined) {
          return Promise.resolve({
            ok: false,
            code: 'DATA_UNKNOWN_IDENTITY',
            message: 'No such inspection.',
          });
        }
        return Promise.resolve({ ok: true, row: this.joined(row) });
      }
      return Promise.resolve({
        ok: false,
        code: 'DATA_UNSUPPORTED_QUERY',
        message: `Unsupported op '${request.op}'.`,
      });
    }
    if (request.resourceId === 'activity') {
      if (request.op !== 'list') {
        return Promise.resolve({
          ok: false,
          code: 'DATA_UNSUPPORTED_QUERY',
          message: `Unsupported op '${request.op}'.`,
        });
      }
      const filtered =
        request.filters?.['inspectionId'] !== undefined
          ? this.#tables.activity.filter(
              (row) => row.inspectionId === request.filters?.['inspectionId'],
            )
          : this.#tables.activity;
      return Promise.resolve(queryTable(filtered as unknown as Record<string, unknown>[], request));
    }
    if (request.resourceId === 'finding' || request.resourceId === 'evidence') {
      const rows = (
        request.resourceId === 'finding' ? this.#tables.findings : this.#tables.evidence
      ) as unknown as Record<string, unknown>[];
      return Promise.resolve(queryTable(rows, request));
    }
    return Promise.resolve({
      ok: false,
      code: 'DATA_UNKNOWN_RESOURCE',
      message: `Unknown resource '${request.resourceId}'.`,
    });
  }

  mutate(
    request: ApplicationDataMutationRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult> {
    const outcome =
      request.resourceId === 'inspection'
        ? applyInspectionMutation(this.#tables, request, context, this.#clock, this.#ledger)
        : applyChildAdd(this.#tables, request, context, this.#clock, this.#ledger);
    if (!outcome.ok) return Promise.resolve({ ok: false, code: outcome.code, message: outcome.message });
    const row = outcome.row;
    const inspection = this.#tables.inspections.find(
      (candidate) => candidate['id'] === row['id'],
    );
    return Promise.resolve({
      ok: true,
      row: inspection !== undefined ? this.joined(inspection) : row,
    });
  }

  /** Materialize the joined child collections (adapter-owned projection). */
  private joined(row: InspectionRow): Record<string, unknown> {
    return {
      ...row,
      findings: this.#tables.findings.filter((finding) => finding.inspectionId === row.id),
      evidence: this.#tables.evidence.filter((item) => item.inspectionId === row.id),
      activity: this.#tables.activity.filter((item) => item.inspectionId === row.id),
    };
  }

  /** Direct read for server-side dispatch (already permission-checked callers). */
  activityFor(inspectionId: string): readonly ActivityRow[] {
    return this.#tables.activity.filter((row) => row.inspectionId === inspectionId);
  }
}

// ---------------------------------------------------------------------------
// Action dispatch through the declared application actions (U1-05, U3-01).
// ---------------------------------------------------------------------------

export type InspectionActionId =
  | 'inspection.list'
  | 'inspection.get'
  | 'inspection.submit'
  | 'inspection.approve'
  | 'inspection.reject'
  | 'inspection.revise'
  | 'finding.add'
  | 'evidence.add';

const READ_ACTIONS: readonly string[] = ['inspection.list', 'inspection.get', 'inspection.activity'];
const INSPECTION_VERBS: readonly string[] = ['submit', 'approve', 'reject', 'revise'];

/** Map an action id to its adapter mutation verb (or undefined for reads). */
export function actionVerb(actionId: string): string | undefined {
  if (actionId === 'finding.add') return 'add-finding';
  if (actionId === 'evidence.add') return 'add-evidence';
  const verb = actionId.split('.')[1];
  return INSPECTION_VERBS.includes(verb) ? verb : undefined;
}

/**
 * The single server boundary. Every declared action — from the document's
 * interactions AND the native host controls — dispatches here with the
 * acting identity; the adapter enforces permissions and domain rules.
 */
export function createInspectionServer(data: InspectionDataAdapter) {
  return {
    adapter: data,
    async dispatch(
      actionId: string,
      input: unknown,
      actor: { readonly role: string; readonly actorId: string },
      options?: { readonly idempotencyKey?: string },
    ): Promise<ActionResult> {
      const permissions = grantsForRole(actor.role);
      const context: ApplicationDataRequestContext = {
        permissions,
        effect: READ_ACTIONS.includes(actionId) ? 'read' : 'write',
        actor: actor.actorId,
      };
      if (actionId === 'inspection.list') {
        const result = await data.query({ op: 'list', resourceId: 'inspection' }, context);
        if (!result.ok) return { ok: false, code: result.code, message: result.message };
        return { ok: true, value: { rows: result.rows ?? [] } };
      }
      if (actionId === 'inspection.get') {
        const payload = (input ?? {}) as { id?: string };
        const result = await data.query(
          { op: 'get', resourceId: 'inspection', id: payload.id },
          context,
        );
        if (!result.ok) return { ok: false, code: result.code, message: result.message };
        return { ok: true, value: result.row };
      }
      if (actionId === 'inspection.activity') {
        const payload = (input ?? {}) as { id?: string };
        const result = await data.query(
          { op: 'list', resourceId: 'activity', filters: { inspectionId: payload.id ?? '' } },
          context,
        );
        if (!result.ok) return { ok: false, code: result.code, message: result.message };
        return { ok: true, value: { rows: result.rows ?? [] } };
      }
      if (actionId === 'finding.add' || actionId === 'evidence.add') {
        const payload = (input ?? {}) as Record<string, unknown>;
        const result = await data.mutate(
          {
            resourceId: actionId === 'finding.add' ? 'finding' : 'evidence',
            op: 'add',
            id: typeof payload['id'] === 'string' ? payload['id'] : undefined,
            input: payload,
            idempotencyKey: options?.idempotencyKey,
          },
          context,
        );
        if (!result.ok) return { ok: false, code: result.code, message: result.message };
        return { ok: true, value: result.row };
      }
      const verb = actionVerb(actionId);
      if (verb !== undefined) {
        const payload = (input ?? {}) as {
          id?: string;
          expectedDomainRevision?: number;
          rejectionReason?: string;
        };
        const result = await data.mutate(
          {
            resourceId: 'inspection',
            op: verb,
            id: payload.id,
            input: {
              expectedDomainRevision: payload.expectedDomainRevision,
              rejectionReason: payload.rejectionReason,
            },
            idempotencyKey: options?.idempotencyKey,
          },
          context,
        );
        if (!result.ok) return { ok: false, code: result.code, message: result.message };
        return { ok: true, value: result.row };
      }
      return {
        ok: false,
        code: 'UNKNOWN_ACTION',
        message: `Action '${actionId}' is not declared.`,
      };
    },
  };
}
