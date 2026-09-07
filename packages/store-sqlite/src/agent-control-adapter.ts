import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import {
  assertDeletionReceiptStep,
  InMemoryActorDirectory,
  isDurableStreamKind,
  VictControlError,
  validateAgentActivationRecord,
  type ActorDirectory,
  type AgentActivationRecord,
  type AgentApprovalRecord,
  type AgentApprovalStore,
  type AgentControlStores,
  type AgentDeletionStep,
  type AgentGovernanceStore,
  type AgentStreamLedgerEvent,
  type AgentStreamLedgerStore,
  type AgentToolInvocationRecord,
  type AgentToolInvocationStore,
  type AgentTurnRecord,
  type AgentTurnStore,
  type ApplicationReleaseRecord,
  type ActorRecord,
  type ChangeSetApprovalDecision,
  type ChangeSetRecord,
  type ControlAuditEvent,
  type ControlPlaneStore,
  type ReleaseSelectionRecord,
} from '@vict/runtime';
import { inTransaction, openDatabase, safeRun, type OpenDatabase } from './driver.js';
import { runMigrations } from './migrations.js';

/**
 * SQLite adapter for the Stage 06B control-plane and agent-execution
 * stores (same operational database domain, additive `vict_agent_*` /
 * `vict_*` tables from migration 5).
 *
 * Semantics are SHARED with the in-memory implementations through the same
 * behavioral conformance suite (`runAgentControlConformanceSuite`):
 * - ChangeSets are immutable-content records; raw updates enforce the
 *   content hash; approval decisions use a UNIQUE(changeset, approver)
 *   CAS so the first durable decision always stands;
 * - releases are immutable; selections are monotonic and attributable;
 * - turns obey the forward-only state machine with terminal fencing;
 * - tool invocations enforce durable-before-invocation and idempotency-key
 *   digest binding;
 * - approval records bind the exact capability/argument/turn identity and
 *   allow exactly one decision;
 * - the stream ledger assigns strictly monotonic sequences and persists
 *   durable kinds only.
 */

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function fromIso(value: string): number {
  return Date.parse(value);
}

function optionalIso(value: string | null): number | undefined {
  return value === null ? undefined : fromIso(value);
}

interface ChangeSetRow {
  changeset_id: string;
  schema: string;
  author_actor_id: string;
  created_at: string;
  base_json: string;
  operations_json: string;
  rationale: string;
  risk_class: string;
  required_approver_count: number;
  expires_at: string;
  validation_json: string | null;
  simulation_json: string | null;
  content_hash: string;
  status: string;
}

function rowToChangeSet(row: ChangeSetRow): ChangeSetRecord {
  return {
    changesetId: row.changeset_id,
    schema: row.schema as ChangeSetRecord['schema'],
    authorActorId: row.author_actor_id,
    createdAt: fromIso(row.created_at),
    base: JSON.parse(row.base_json) as ChangeSetRecord['base'],
    operations: JSON.parse(row.operations_json) as ChangeSetRecord['operations'],
    rationale: row.rationale,
    riskClass: row.risk_class as ChangeSetRecord['riskClass'],
    requiredApproverCount: row.required_approver_count,
    expiresAt: fromIso(row.expires_at),
    validation:
      row.validation_json === null
        ? undefined
        : (JSON.parse(row.validation_json) as ChangeSetRecord['validation']),
    simulation:
      row.simulation_json === null
        ? undefined
        : (JSON.parse(row.simulation_json) as ChangeSetRecord['simulation']),
    contentHash: row.content_hash,
    status: row.status as ChangeSetRecord['status'],
  };
}

interface TurnRow {
  turn_id: string;
  stream_id: string;
  thread_id: string;
  actor_id: string;
  agent_profile_version: string;
  activation_version: string | null;
  application_release_version: string | null;
  input_summary: string;
  status: string;
  created_at: string;
  updated_at: string;
  terminal_at: string | null;
  error_code: string | null;
  trace_id: string | null;
  vict_run_id: string | null;
  mastra_run_id: string | null;
}

function rowToTurn(row: TurnRow): AgentTurnRecord {
  return {
    turnId: row.turn_id,
    streamId: row.stream_id,
    threadId: row.thread_id,
    actorId: row.actor_id,
    agentProfileVersion: row.agent_profile_version,
    activationVersion: row.activation_version ?? undefined,
    applicationReleaseVersion: row.application_release_version ?? undefined,
    inputSummary: row.input_summary,
    status: row.status as AgentTurnRecord['status'],
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
    terminalAt: optionalIso(row.terminal_at),
    errorCode: row.error_code ?? undefined,
    traceId: row.trace_id ?? undefined,
    victRunId: row.vict_run_id ?? undefined,
    mastraRunId: row.mastra_run_id ?? undefined,
  };
}

interface InvocationRow {
  invocation_id: string;
  turn_id: string;
  tool_call_id: string;
  tool_name: string;
  capability_id: string;
  capability_revision: string;
  effect: string;
  idempotency_key: string;
  actor_id: string;
  arg_digest: string;
  argument_summary: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  result_summary: string | null;
  error_code: string | null;
}

function rowToInvocation(row: InvocationRow): AgentToolInvocationRecord {
  return {
    invocationId: row.invocation_id,
    turnId: row.turn_id,
    toolCallId: row.tool_call_id,
    toolName: row.tool_name,
    capabilityId: row.capability_id,
    capabilityRevision: row.capability_revision,
    effect: row.effect as AgentToolInvocationRecord['effect'],
    idempotencyKey: row.idempotency_key,
    actorId: row.actor_id,
    argDigest: row.arg_digest,
    argumentSummary: row.argument_summary,
    status: row.status as AgentToolInvocationRecord['status'],
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
    completedAt: optionalIso(row.completed_at),
    resultSummary: row.result_summary ?? undefined,
    errorCode: row.error_code ?? undefined,
  };
}

interface ApprovalRow {
  approval_id: string;
  kind: string;
  turn_id: string;
  invocation_id: string;
  tool_call_id: string;
  tool_name: string;
  capability_id: string;
  capability_revision: string;
  effect: string;
  actor_id: string;
  agent_profile_version: string;
  arg_digest: string;
  environment: string;
  required_approver_role: string;
  status: string;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
  approver_actor_id: string | null;
  decision_reason: string | null;
}

function rowToApproval(row: ApprovalRow): AgentApprovalRecord {
  return {
    approvalId: row.approval_id,
    kind: row.kind as AgentApprovalRecord['kind'],
    turnId: row.turn_id,
    invocationId: row.invocation_id,
    toolCallId: row.tool_call_id,
    toolName: row.tool_name,
    capabilityId: row.capability_id,
    capabilityRevision: row.capability_revision,
    effect: row.effect as AgentApprovalRecord['effect'],
    actorId: row.actor_id,
    agentProfileVersion: row.agent_profile_version,
    argDigest: row.arg_digest,
    environment: row.environment,
    requiredApproverRole: row.required_approver_role as AgentApprovalRecord['requiredApproverRole'],
    status: row.status as AgentApprovalRecord['status'],
    createdAt: fromIso(row.created_at),
    expiresAt: fromIso(row.expires_at),
    decidedAt: optionalIso(row.decided_at),
    approverActorId: row.approver_actor_id ?? undefined,
    decisionReason: row.decision_reason ?? undefined,
  };
}

interface ReleaseRow {
  release_version: string;
  application_id: string;
  application_version: string;
  renderer_identity: string;
  component_registry_identity: string;
  data_adapter_identity: string;
  activation_binding: string;
  published_by_actor_id: string;
  published_at: string;
  content_hash: string;
}

function rowToRelease(row: ReleaseRow): ApplicationReleaseRecord {
  return {
    releaseVersion: row.release_version,
    applicationId: row.application_id,
    applicationVersion: row.application_version,
    rendererIdentity: row.renderer_identity,
    componentRegistryIdentity: row.component_registry_identity,
    dataAdapterIdentity: row.data_adapter_identity,
    activationBinding: row.activation_binding,
    publishedByActorId: row.published_by_actor_id,
    publishedAt: fromIso(row.published_at),
    contentHash: row.content_hash,
  };
}

interface StreamEventRow {
  stream_id: string;
  seq: number;
  kind: string;
  payload: string;
  created_at: string;
}

function rowToLedgerEvent(row: StreamEventRow): AgentStreamLedgerEvent {
  return {
    streamId: row.stream_id,
    seq: row.seq,
    kind: row.kind as AgentStreamLedgerEvent['kind'],
    payload: row.payload,
    createdAt: fromIso(row.created_at),
  };
}

export interface SqliteAgentControlOptions {
  readonly path?: string;
  readonly database?: DatabaseSync;
  readonly migrations?: Parameters<typeof runMigrations>[1];
}

/** The SQLite control-store set with a sync close. */
export interface SqliteAgentControlStoreSet extends AgentControlStores {
  close(): void;
}

/** Create the durable SQLite AgentControlStores (migration 5 schema). */
export function createSqliteAgentControlStores(
  options: SqliteAgentControlOptions = {},
): SqliteAgentControlStoreSet {
  const handle: OpenDatabase =
    options.database !== undefined
      ? { db: options.database, close: () => undefined }
      : openDatabase(options);
  const { db } = handle;
  try {
    safeRun('store.migrate', () => {
      runMigrations(db, options.migrations as Parameters<typeof runMigrations>[1]);
    });
  } catch (cause) {
    if (options.database === undefined) {
      handle.close();
    }
    throw cause;
  }

  const actors: ActorDirectory = new InMemoryActorDirectoryFallback();

  const control: ControlPlaneStore = {
    async saveChangeSet(record: ChangeSetRecord): Promise<void> {
      safeRun('control.saveChangeSet', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare('SELECT changeset_id FROM vict_changeset WHERE changeset_id = ?;')
            .get(record.changesetId);
          if (existing !== undefined) {
            throw new VictControlError(
              'VICT_CONTROL_CHANGESET_EXISTS',
              'A ChangeSet with this id already exists; propose a distinct changesetId.',
            );
          }
          db.prepare(
            `INSERT INTO vict_changeset
              (changeset_id, schema, author_actor_id, created_at, base_json, operations_json, rationale,
               risk_class, required_approver_count, expires_at, validation_json, simulation_json, content_hash, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            record.changesetId,
            record.schema,
            record.authorActorId,
            toIso(record.createdAt),
            JSON.stringify(record.base),
            JSON.stringify(record.operations),
            record.rationale,
            record.riskClass,
            record.requiredApproverCount,
            toIso(record.expiresAt),
            record.validation === undefined ? null : JSON.stringify(record.validation),
            record.simulation === undefined ? null : JSON.stringify(record.simulation),
            record.contentHash,
            record.status,
          );
        }),
      );
    },

    async getChangeSet(changesetId: string): Promise<ChangeSetRecord | undefined> {
      return safeRun('control.getChangeSet', () => {
        const row = db
          .prepare('SELECT * FROM vict_changeset WHERE changeset_id = ?;')
          .get(changesetId) as ChangeSetRow | undefined;
        return row === undefined ? undefined : rowToChangeSet(row);
      });
    },

    async listChangeSets(): Promise<readonly ChangeSetRecord[]> {
      return safeRun('control.listChangeSets', () => {
        const rows = db
          .prepare('SELECT * FROM vict_changeset ORDER BY changeset_id ASC;')
          .all() as unknown as ChangeSetRow[];
        return rows.map((row) => rowToChangeSet(row));
      });
    },

    async updateChangeSet(
      changesetId: string,
      update: (record: ChangeSetRecord) => ChangeSetRecord,
    ): Promise<ChangeSetRecord> {
      return safeRun('control.updateChangeSet', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_changeset WHERE changeset_id = ?;')
            .get(changesetId) as ChangeSetRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_CHANGESET_MISSING',
              'The ChangeSet does not exist.',
            );
          }
          const current = rowToChangeSet(row);
          const updated = update(current);
          if (updated.changesetId !== changesetId) {
            throw new VictControlError(
              'VICT_CONTROL_CHANGESET_IMMUTABLE_ID',
              'A ChangeSet update may not change its changesetId.',
            );
          }
          if (updated.contentHash !== current.contentHash) {
            throw new VictControlError(
              'VICT_CONTROL_CONTENT_HASH_MISMATCH',
              'A ChangeSet update may not change its immutable content identity.',
            );
          }
          db.prepare(
            'UPDATE vict_changeset SET status = ?, validation_json = ?, simulation_json = ? WHERE changeset_id = ?;',
          ).run(
            updated.status,
            updated.validation === undefined ? null : JSON.stringify(updated.validation),
            updated.simulation === undefined ? null : JSON.stringify(updated.simulation),
            changesetId,
          );
          return updated;
        }),
      );
    },

    async recordChangeSetApproval(decision: ChangeSetApprovalDecision): Promise<void> {
      safeRun('control.recordChangeSetApproval', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare(
              'SELECT approval_id, content_hash, decision FROM vict_changeset_approval WHERE changeset_id = ? AND approver_actor_id = ?;',
            )
            .get(decision.changesetId, decision.approverActorId) as
            { approval_id: string; content_hash: string; decision: string } | undefined;
          if (existing !== undefined) {
            if (
              existing.decision !== decision.decision ||
              existing.content_hash !== decision.contentHash
            ) {
              throw new VictControlError(
                'VICT_CONTROL_APPROVAL_CONFLICT',
                'A competing decision already exists for this ChangeSet and approver; the first durable decision stands.',
              );
            }
            return; // idempotent identical decision
          }
          try {
            db.prepare(
              `INSERT INTO vict_changeset_approval
                (approval_id, changeset_id, content_hash, approver_actor_id, decision, decided_at)
              VALUES (?, ?, ?, ?, ?, ?);`,
            ).run(
              decision.approvalId,
              decision.changesetId,
              decision.contentHash,
              decision.approverActorId,
              decision.decision,
              toIso(decision.decidedAt),
            );
          } catch (cause) {
            // The UNIQUE(changeset, approver) constraint enforces the CAS
            // winner under concurrency.
            if (cause instanceof Error && cause.message.includes('UNIQUE')) {
              throw new VictControlError(
                'VICT_CONTROL_APPROVAL_CONFLICT',
                'A competing decision already exists for this ChangeSet and approver; the first durable decision stands.',
              );
            }
            throw cause;
          }
        }),
      );
    },

    async listChangeSetApprovals(
      changesetId: string,
    ): Promise<readonly ChangeSetApprovalDecision[]> {
      return safeRun('control.listChangeSetApprovals', () => {
        const rows = db
          .prepare(
            'SELECT * FROM vict_changeset_approval WHERE changeset_id = ? ORDER BY decided_at ASC, approval_id ASC;',
          )
          .all(changesetId) as unknown as {
          approval_id: string;
          changeset_id: string;
          content_hash: string;
          approver_actor_id: string;
          decision: string;
          decided_at: string;
        }[];
        return rows.map((row) => ({
          approvalId: row.approval_id,
          changesetId: row.changeset_id,
          contentHash: row.content_hash,
          approverActorId: row.approver_actor_id,
          decision: row.decision as ChangeSetApprovalDecision['decision'],
          decidedAt: fromIso(row.decided_at),
        }));
      });
    },

    async publishRelease(record: ApplicationReleaseRecord): Promise<void> {
      safeRun('control.publishRelease', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare('SELECT * FROM vict_release WHERE release_version = ?;')
            .get(record.releaseVersion) as ReleaseRow | undefined;
          if (existing !== undefined) {
            const matches = JSON.stringify(rowToRelease(existing)) === JSON.stringify(record);
            if (!matches) {
              throw new VictControlError(
                'VICT_CONTROL_RELEASE_COLLISION',
                'A release with this version exists with different content (immutability guard).',
              );
            }
            return; // idempotent republish
          }
          db.prepare(
            `INSERT INTO vict_release
              (release_version, application_id, application_version, renderer_identity,
               component_registry_identity, data_adapter_identity, activation_binding,
               published_by_actor_id, published_at, content_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            record.releaseVersion,
            record.applicationId,
            record.applicationVersion,
            record.rendererIdentity,
            record.componentRegistryIdentity,
            record.dataAdapterIdentity,
            record.activationBinding,
            record.publishedByActorId,
            toIso(record.publishedAt),
            record.contentHash,
          );
        }),
      );
    },

    async getRelease(releaseVersion: string): Promise<ApplicationReleaseRecord | undefined> {
      return safeRun('control.getRelease', () => {
        const row = db
          .prepare('SELECT * FROM vict_release WHERE release_version = ?;')
          .get(releaseVersion) as ReleaseRow | undefined;
        return row === undefined ? undefined : rowToRelease(row);
      });
    },

    async listReleases(applicationId: string): Promise<readonly ApplicationReleaseRecord[]> {
      return safeRun('control.listReleases', () => {
        const rows = db
          .prepare(
            'SELECT * FROM vict_release WHERE application_id = ? ORDER BY release_version ASC;',
          )
          .all(applicationId) as unknown as ReleaseRow[];
        return rows.map((row) => rowToRelease(row));
      });
    },

    async selectRelease(command: {
      applicationId: string;
      releaseVersion: string;
      actorId: string;
      at: number;
      reason: 'select' | 'rollback';
    }): Promise<{ selectionRevision: number }> {
      return safeRun('control.selectRelease', () =>
        inTransaction(db, () => {
          const release = db
            .prepare('SELECT application_id FROM vict_release WHERE release_version = ?;')
            .get(command.releaseVersion) as { application_id: string } | undefined;
          if (release === undefined || release.application_id !== command.applicationId) {
            throw new VictControlError(
              'VICT_CONTROL_RELEASE_MISSING',
              'The release version does not exist for this application.',
            );
          }
          const latest = db
            .prepare(
              'SELECT MAX(selection_revision) AS revision FROM vict_release_selection WHERE application_id = ?;',
            )
            .get(command.applicationId) as { revision: number | null };
          const selectionRevision = (latest.revision ?? 0) + 1;
          db.prepare(
            `INSERT INTO vict_release_selection
              (application_id, selection_revision, release_version, actor_id, at, reason)
            VALUES (?, ?, ?, ?, ?, ?);`,
          ).run(
            command.applicationId,
            selectionRevision,
            command.releaseVersion,
            command.actorId,
            toIso(command.at),
            command.reason,
          );
          return { selectionRevision };
        }),
      );
    },

    async getSelectedRelease(applicationId: string): Promise<ApplicationReleaseRecord | undefined> {
      return safeRun('control.getSelectedRelease', () => {
        const row = db
          .prepare(
            `SELECT release_version FROM vict_release_selection
             WHERE application_id = ? ORDER BY selection_revision DESC LIMIT 1;`,
          )
          .get(applicationId) as { release_version: string } | undefined;
        if (row === undefined) {
          return undefined;
        }
        const release = db
          .prepare('SELECT * FROM vict_release WHERE release_version = ?;')
          .get(row.release_version) as ReleaseRow | undefined;
        return release === undefined ? undefined : rowToRelease(release);
      });
    },

    async listReleaseSelections(applicationId: string): Promise<readonly ReleaseSelectionRecord[]> {
      return safeRun('control.listReleaseSelections', () => {
        const rows = db
          .prepare(
            'SELECT * FROM vict_release_selection WHERE application_id = ? ORDER BY selection_revision ASC;',
          )
          .all(applicationId) as unknown as {
          application_id: string;
          selection_revision: number;
          release_version: string;
          actor_id: string;
          at: string;
          reason: string;
        }[];
        return rows.map((row) => ({
          applicationId: row.application_id,
          releaseVersion: row.release_version,
          selectionRevision: row.selection_revision,
          actorId: row.actor_id,
          at: fromIso(row.at),
          reason: row.reason as ReleaseSelectionRecord['reason'],
        }));
      });
    },

    async appendAuditEvent(event: ControlAuditEvent): Promise<void> {
      safeRun('control.appendAuditEvent', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare('SELECT audit_id FROM vict_audit_event WHERE audit_id = ?;')
            .get(event.auditId);
          if (existing !== undefined) {
            return; // idempotent append
          }
          db.prepare(
            `INSERT INTO vict_audit_event (audit_id, at, actor_id, action, subject_type, subject_id, summary)
             VALUES (?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            event.auditId,
            toIso(event.at),
            event.actorId,
            event.action,
            event.subjectType,
            event.subjectId,
            event.summary,
          );
        }),
      );
    },

    async listAuditEvents(subject: {
      subjectType?: string;
      subjectId?: string;
    }): Promise<readonly ControlAuditEvent[]> {
      return safeRun('control.listAuditEvents', () => {
        const conditions: string[] = [];
        const params: SQLInputValue[] = [];
        if (subject.subjectType !== undefined) {
          conditions.push('subject_type = ?');
          params.push(subject.subjectType);
        }
        if (subject.subjectId !== undefined) {
          conditions.push('subject_id = ?');
          params.push(subject.subjectId);
        }
        const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
        const rows = db
          .prepare(
            `SELECT audit_id, at, actor_id, action, subject_type, subject_id, summary
             FROM vict_audit_event${where} ORDER BY at ASC, audit_id ASC;`,
          )
          .all(...params) as unknown as {
          audit_id: string;
          at: string;
          actor_id: string;
          action: string;
          subject_type: string;
          subject_id: string;
          summary: string;
        }[];
        return rows.map((row) => ({
          auditId: row.audit_id,
          at: fromIso(row.at),
          actorId: row.actor_id,
          action: row.action as ControlAuditEvent['action'],
          subjectType: row.subject_type,
          subjectId: row.subject_id,
          summary: row.summary,
        }));
      });
    },
  };

  const turns: AgentTurnStore = {
    async createTurnIntent(record: AgentTurnRecord): Promise<void> {
      safeRun('turns.createIntent', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare('SELECT * FROM vict_agent_turn WHERE turn_id = ?;')
            .get(record.turnId) as TurnRow | undefined;
          if (existing !== undefined) {
            if (JSON.stringify(rowToTurn(existing)) !== JSON.stringify(record)) {
              throw new VictControlError(
                'VICT_CONTROL_TURN_COLLISION',
                'A turn intent with this id already exists with different content.',
              );
            }
            return; // idempotent re-intent
          }
          if (record.status !== 'intent') {
            throw new VictControlError(
              'VICT_CONTROL_TURN_INVALID_STATE',
              'A new turn must be recorded as intent.',
            );
          }
          db.prepare(
            `INSERT INTO vict_agent_turn
              (turn_id, stream_id, thread_id, actor_id, agent_profile_version, activation_version,
               application_release_version, input_summary, status, created_at, updated_at,
               terminal_at, error_code, trace_id, vict_run_id, mastra_run_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            record.turnId,
            record.streamId,
            record.threadId,
            record.actorId,
            record.agentProfileVersion,
            record.activationVersion ?? null,
            record.applicationReleaseVersion ?? null,
            record.inputSummary,
            record.status,
            toIso(record.createdAt),
            toIso(record.updatedAt),
            record.terminalAt === undefined ? null : toIso(record.terminalAt),
            record.errorCode ?? null,
            record.traceId ?? null,
            record.victRunId ?? null,
            record.mastraRunId ?? null,
          );
        }),
      );
    },

    async getTurn(turnId: string): Promise<AgentTurnRecord | undefined> {
      return safeRun('turns.getTurn', () => {
        const row = db
          .prepare('SELECT * FROM vict_agent_turn WHERE turn_id = ?;')
          .get(turnId) as unknown as TurnRow | undefined;
        return row === undefined ? undefined : rowToTurn(row);
      });
    },

    async listTurns(): Promise<readonly AgentTurnRecord[]> {
      return safeRun('turns.listTurns', () => {
        const rows = db
          .prepare('SELECT * FROM vict_agent_turn ORDER BY turn_id ASC;')
          .all() as unknown as TurnRow[];
        return rows.map((row) => rowToTurn(row));
      });
    },

    async listOpenTurns(): Promise<readonly AgentTurnRecord[]> {
      return safeRun('turns.listOpenTurns', () => {
        const rows = db
          .prepare(
            "SELECT * FROM vict_agent_turn WHERE status IN ('intent', 'running', 'awaiting-approval') ORDER BY turn_id ASC;",
          )
          .all() as unknown as TurnRow[];
        return rows.map((row) => rowToTurn(row));
      });
    },

    async startTurn(turnId: string, at: number): Promise<AgentTurnRecord> {
      return transitionTurn(turnId, at, (status) => (status === 'intent' ? 'running' : undefined));
    },

    async awaitApproval(turnId: string, at: number, approvalId: string): Promise<AgentTurnRecord> {
      return transitionTurn(turnId, at, (status) =>
        status === 'running' ? 'awaiting-approval' : undefined,
      );
    },

    async resumeTurn(turnId: string, at: number): Promise<AgentTurnRecord> {
      return transitionTurn(turnId, at, (status) =>
        status === 'awaiting-approval' ? 'running' : undefined,
      );
    },

    async recordTurnCorrelation(
      turnId: string,
      correlation: { traceId?: string; victRunId?: string; mastraRunId?: string },
    ): Promise<void> {
      safeRun('turns.correlation', () =>
        inTransaction(db, () => {
          const row = db
            .prepare(
              'SELECT trace_id, vict_run_id, mastra_run_id FROM vict_agent_turn WHERE turn_id = ?;',
            )
            .get(turnId) as
            | { trace_id: string | null; vict_run_id: string | null; mastra_run_id: string | null }
            | undefined;
          if (row === undefined) {
            throw new VictControlError('VICT_CONTROL_TURN_MISSING', 'The turn does not exist.');
          }
          db.prepare(
            'UPDATE vict_agent_turn SET trace_id = ?, vict_run_id = ?, mastra_run_id = ? WHERE turn_id = ?;',
          ).run(
            correlation.traceId ?? row.trace_id,
            correlation.victRunId ?? row.vict_run_id,
            correlation.mastraRunId ?? row.mastra_run_id,
            turnId,
          );
        }),
      );
    },

    async completeTurn(command: {
      turnId: string;
      status: 'completed' | 'failed' | 'cancelled' | 'blocked';
      at: number;
      errorCode?: string;
    }): Promise<AgentTurnRecord> {
      return transitionTurn(
        command.turnId,
        command.at,
        (status) =>
          status === 'running' || status === 'awaiting-approval' || status === 'intent'
            ? command.status
            : undefined,
        command.errorCode,
      );
    },

    async recordCancelIntent(command: {
      turnId: string;
      cancelId: string;
      actorId: string;
      reasonCode: string;
      at: number;
    }): Promise<{ accepted: boolean; duplicate: boolean }> {
      return safeRun('turns.cancelIntent', () =>
        inTransaction(db, () => {
          const intentRow = db
            .prepare('SELECT turn_id FROM vict_agent_turn WHERE turn_id = ?;')
            .get(command.turnId);
          if (intentRow === undefined) {
            throw new VictControlError('VICT_CONTROL_TURN_MISSING', 'The turn does not exist.');
          }
          const existing = db
            .prepare(
              'SELECT cancel_id FROM vict_agent_turn_cancel WHERE turn_id = ? AND cancel_id = ?;',
            )
            .get(command.turnId, command.cancelId);
          if (existing !== undefined) {
            return { accepted: false, duplicate: true };
          }
          db.prepare(
            'INSERT INTO vict_agent_turn_cancel (turn_id, cancel_id, actor_id, reason_code, at) VALUES (?, ?, ?, ?, ?);',
          ).run(
            command.turnId,
            command.cancelId,
            command.actorId,
            command.reasonCode,
            toIso(command.at),
          );
          return { accepted: true, duplicate: false };
        }),
      );
    },

    async hasCancelIntent(turnId: string): Promise<boolean> {
      return safeRun('turns.hasCancelIntent', () => {
        const row = db
          .prepare('SELECT 1 AS one FROM vict_agent_turn_cancel WHERE turn_id = ? LIMIT 1;')
          .get(turnId);
        return row !== undefined;
      });
    },

    async reconcileTurn(command: {
      turnId: string;
      status: 'failed' | 'cancelled' | 'blocked';
      reasonCode: string;
      at: number;
    }): Promise<AgentTurnRecord | undefined> {
      return safeRun('turns.reconcile', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_agent_turn WHERE turn_id = ?;')
            .get(command.turnId) as TurnRow | undefined;
          if (row === undefined) {
            return undefined;
          }
          const current = rowToTurn(row);
          if (
            current.status === 'completed' ||
            current.status === 'failed' ||
            current.status === 'cancelled' ||
            current.status === 'blocked'
          ) {
            return current; // already terminal
          }
          db.prepare(
            'UPDATE vict_agent_turn SET status = ?, error_code = ?, terminal_at = ?, updated_at = ? WHERE turn_id = ?;',
          ).run(
            command.status,
            command.reasonCode,
            toIso(command.at),
            toIso(command.at),
            command.turnId,
          );
          return {
            ...current,
            status: command.status,
            errorCode: command.reasonCode,
            terminalAt: command.at,
            updatedAt: command.at,
          };
        }),
      );
    },

    async listCancelIntents(
      turnId: string,
    ): Promise<readonly { cancelId: string; actorId: string; reasonCode: string; at: number }[]> {
      return safeRun('turns.listCancelIntents', () => {
        const rows = db
          .prepare(
            'SELECT cancel_id, actor_id, reason_code, at FROM vict_agent_turn_cancel WHERE turn_id = ? ORDER BY at ASC, cancel_id ASC;',
          )
          .all(turnId) as unknown as {
          cancel_id: string;
          actor_id: string;
          reason_code: string;
          at: string;
        }[];
        return rows.map((row) => ({
          cancelId: row.cancel_id,
          actorId: row.actor_id,
          reasonCode: row.reason_code,
          at: fromIso(row.at),
        }));
      });
    },
  };

  /** Shared turn-transition helper (atomic read-validate-update). */
  function transitionTurn(
    turnId: string,
    at: number,
    allowed: (status: AgentTurnRecord['status']) => AgentTurnRecord['status'] | undefined,
    errorCode?: string,
  ): AgentTurnRecord {
    return safeRun('turns.transition', () =>
      inTransaction(db, () => {
        const row = db
          .prepare('SELECT * FROM vict_agent_turn WHERE turn_id = ?;')
          .get(turnId) as unknown as TurnRow | undefined;
        if (row === undefined) {
          throw new VictControlError('VICT_CONTROL_TURN_MISSING', 'The turn does not exist.');
        }
        const current = rowToTurn(row);
        const next = allowed(current.status);
        if (next === undefined) {
          throw new VictControlError(
            'VICT_CONTROL_TURN_INVALID_TRANSITION',
            `The turn status '${current.status}' cannot transition as requested.`,
          );
        }
        const terminal =
          next === 'completed' || next === 'failed' || next === 'cancelled' || next === 'blocked';
        db.prepare(
          'UPDATE vict_agent_turn SET status = ?, updated_at = ?, terminal_at = ?, error_code = ? WHERE turn_id = ?;',
        ).run(
          next,
          toIso(at),
          terminal ? toIso(at) : row.terminal_at,
          errorCode ?? row.error_code,
          turnId,
        );
        const updated = db
          .prepare('SELECT * FROM vict_agent_turn WHERE turn_id = ?;')
          .get(turnId) as unknown as TurnRow;
        return rowToTurn(updated);
      }),
    );
  }

  const invocations: AgentToolInvocationStore = {
    async recordInvocationIntent(
      record: AgentToolInvocationRecord,
    ): Promise<AgentToolInvocationRecord> {
      return safeRun('invocations.recordIntent', () =>
        inTransaction(db, () => {
          const byKey = db
            .prepare(
              'SELECT invocation_id FROM vict_agent_tool_invocation WHERE idempotency_key = ?;',
            )
            .get(record.idempotencyKey) as { invocation_id: string } | undefined;
          if (byKey !== undefined) {
            const existing = db
              .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
              .get(byKey.invocation_id) as unknown as InvocationRow;
            const existingRecord = rowToInvocation(existing);
            if (existingRecord.argDigest !== record.argDigest) {
              throw new VictControlError(
                'VICT_CONTROL_INVOCATION_KEY_COLLISION',
                'The idempotency key exists with a different canonical argument digest.',
              );
            }
            return existingRecord; // idempotent retry
          }
          const existing = db
            .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
            .get(record.invocationId) as unknown as InvocationRow | undefined;
          if (existing !== undefined) {
            if (JSON.stringify(rowToInvocation(existing)) !== JSON.stringify(record)) {
              throw new VictControlError(
                'VICT_CONTROL_INVOCATION_COLLISION',
                'An invocation with this id already exists with different content.',
              );
            }
            return rowToInvocation(existing);
          }
          if (record.status !== 'intent') {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_INVALID_STATE',
              'A new invocation must be recorded as intent (durable-before-invocation).',
            );
          }
          db.prepare(
            `INSERT INTO vict_agent_tool_invocation
              (invocation_id, turn_id, tool_call_id, tool_name, capability_id, capability_revision, effect,
               idempotency_key, actor_id, arg_digest, argument_summary, status, created_at, updated_at,
               completed_at, result_summary, error_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            record.invocationId,
            record.turnId,
            record.toolCallId,
            record.toolName,
            record.capabilityId,
            record.capabilityRevision,
            record.effect,
            record.idempotencyKey,
            record.actorId,
            record.argDigest,
            record.argumentSummary,
            record.status,
            toIso(record.createdAt),
            toIso(record.updatedAt),
            record.completedAt === undefined ? null : toIso(record.completedAt),
            record.resultSummary ?? null,
            record.errorCode ?? null,
          );
          return record;
        }),
      );
    },

    async getInvocation(invocationId: string): Promise<AgentToolInvocationRecord | undefined> {
      return safeRun('invocations.get', () => {
        const row = db
          .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
          .get(invocationId) as InvocationRow | undefined;
        return row === undefined ? undefined : rowToInvocation(row);
      });
    },

    async getInvocationByIdempotencyKey(
      idempotencyKey: string,
    ): Promise<AgentToolInvocationRecord | undefined> {
      return safeRun('invocations.getByKey', () => {
        const row = db
          .prepare('SELECT * FROM vict_agent_tool_invocation WHERE idempotency_key = ?;')
          .get(idempotencyKey) as InvocationRow | undefined;
        return row === undefined ? undefined : rowToInvocation(row);
      });
    },

    async updateInvocationStatus(command: {
      invocationId: string;
      status: 'approved' | 'running' | 'completed' | 'failed' | 'declined' | 'cancelled';
      at: number;
      resultSummary?: string;
      errorCode?: string;
    }): Promise<AgentToolInvocationRecord> {
      return safeRun('invocations.updateStatus', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
            .get(command.invocationId) as unknown as InvocationRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_MISSING',
              'The invocation does not exist.',
            );
          }
          const current = rowToInvocation(row);
          const ORDER: Readonly<Record<string, number>> = {
            intent: 0,
            approved: 1,
            running: 2,
            completed: 3,
            failed: 3,
            declined: 3,
            cancelled: 3,
          };
          const orderOf = (status: string): number => ORDER[status] ?? 0;
          if (orderOf(command.status) < orderOf(current.status)) {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_REGRESSION',
              'An invocation status may only move forward.',
            );
          }
          if (orderOf(current.status) >= 3 && command.status !== current.status) {
            throw new VictControlError(
              'VICT_CONTROL_INVOCATION_TERMINAL',
              'The invocation is already terminal; late results are fenced.',
            );
          }
          const terminal = orderOf(command.status) >= 3;
          db.prepare(
            `UPDATE vict_agent_tool_invocation
             SET status = ?, updated_at = ?, completed_at = ?, result_summary = ?, error_code = ?
             WHERE invocation_id = ?;`,
          ).run(
            command.status,
            toIso(command.at),
            terminal ? toIso(command.at) : row.completed_at,
            command.resultSummary ?? row.result_summary,
            command.errorCode ?? row.error_code,
            command.invocationId,
          );
          const updated = db
            .prepare('SELECT * FROM vict_agent_tool_invocation WHERE invocation_id = ?;')
            .get(command.invocationId) as unknown as InvocationRow;
          return rowToInvocation(updated);
        }),
      );
    },

    async listInvocationsForTurn(turnId: string): Promise<readonly AgentToolInvocationRecord[]> {
      return safeRun('invocations.listForTurn', () => {
        const rows = db
          .prepare(
            'SELECT * FROM vict_agent_tool_invocation WHERE turn_id = ? ORDER BY invocation_id ASC;',
          )
          .all(turnId) as unknown as InvocationRow[];
        return rows.map((row) => rowToInvocation(row));
      });
    },
  };

  const approvals: AgentApprovalStore = {
    async createPendingApproval(record: AgentApprovalRecord): Promise<AgentApprovalRecord> {
      return safeRun('approvals.createPending', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare('SELECT * FROM vict_agent_approval WHERE approval_id = ?;')
            .get(record.approvalId) as unknown as ApprovalRow | undefined;
          if (existing !== undefined) {
            if (JSON.stringify(rowToApproval(existing)) !== JSON.stringify(record)) {
              throw new VictControlError(
                'VICT_CONTROL_APPROVAL_COLLISION',
                'An approval with this id already exists with different content.',
              );
            }
            return rowToApproval(existing);
          }
          // One approval record per invocation: reuse an existing pending one.
          const byInvocation = db
            .prepare('SELECT * FROM vict_agent_approval WHERE invocation_id = ?;')
            .get(record.invocationId) as unknown as ApprovalRow | undefined;
          if (byInvocation !== undefined) {
            const reused = rowToApproval(byInvocation);
            if (reused.status === 'pending') {
              return reused;
            }
            throw new VictControlError(
              'VICT_CONTROL_APPROVAL_INVALID_STATE',
              'The invocation already has a decided approval record.',
            );
          }
          if (record.status !== 'pending') {
            throw new VictControlError(
              'VICT_CONTROL_APPROVAL_INVALID_STATE',
              'A new approval record must be pending.',
            );
          }
          db.prepare(
            `INSERT INTO vict_agent_approval
              (approval_id, kind, turn_id, invocation_id, tool_call_id, tool_name, capability_id,
               capability_revision, effect, actor_id, agent_profile_version, arg_digest, environment,
               required_approver_role, status, created_at, expires_at, decided_at, approver_actor_id, decision_reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          ).run(
            record.approvalId,
            record.kind,
            record.turnId,
            record.invocationId,
            record.toolCallId,
            record.toolName,
            record.capabilityId,
            record.capabilityRevision,
            record.effect,
            record.actorId,
            record.agentProfileVersion,
            record.argDigest,
            record.environment,
            record.requiredApproverRole,
            record.status,
            toIso(record.createdAt),
            toIso(record.expiresAt),
            record.decidedAt === undefined ? null : toIso(record.decidedAt),
            record.approverActorId ?? null,
            record.decisionReason ?? null,
          );
          return record;
        }),
      );
    },

    async getApproval(approvalId: string): Promise<AgentApprovalRecord | undefined> {
      return safeRun('approvals.get', () => {
        const row = db
          .prepare('SELECT * FROM vict_agent_approval WHERE approval_id = ?;')
          .get(approvalId) as ApprovalRow | undefined;
        return row === undefined ? undefined : rowToApproval(row);
      });
    },

    async listOpenApprovals(): Promise<readonly AgentApprovalRecord[]> {
      return safeRun('approvals.listOpen', () => {
        const rows = db
          .prepare(
            "SELECT * FROM vict_agent_approval WHERE status = 'pending' ORDER BY approval_id ASC;",
          )
          .all() as unknown as ApprovalRow[];
        return rows.map((row) => rowToApproval(row));
      });
    },

    async listApprovalsForInvocation(
      invocationId: string,
    ): Promise<readonly AgentApprovalRecord[]> {
      return safeRun('approvals.listForInvocation', () => {
        const rows = db
          .prepare('SELECT * FROM vict_agent_approval WHERE invocation_id = ?;')
          .all(invocationId) as unknown as ApprovalRow[];
        return rows.map((row) => rowToApproval(row));
      });
    },

    async decideApproval(command: {
      approvalId: string;
      approverActorId: string;
      decision: 'approved' | 'declined';
      decidedAt: number;
      decisionReason?: string;
    }): Promise<AgentApprovalRecord> {
      return safeRun('approvals.decide', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_agent_approval WHERE approval_id = ?;')
            .get(command.approvalId) as unknown as ApprovalRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_APPROVAL_MISSING',
              'The approval record does not exist.',
            );
          }
          const current = rowToApproval(row);
          if (current.status === 'approved' || current.status === 'declined') {
            if (current.status === command.decision) {
              return current; // idempotent identical decision
            }
            throw new VictControlError(
              'VICT_CONTROL_APPROVAL_CONFLICT',
              'A competing decision already stands; the first durable decision is the winner.',
            );
          }
          if (current.status === 'expired') {
            throw new VictControlError(
              'VICT_CONTROL_APPROVAL_EXPIRED',
              'The approval request expired and cannot be decided.',
            );
          }
          db.prepare(
            `UPDATE vict_agent_approval SET status = ?, decided_at = ?, approver_actor_id = ?, decision_reason = ?
             WHERE approval_id = ?;`,
          ).run(
            command.decision,
            toIso(command.decidedAt),
            command.approverActorId,
            command.decisionReason ?? row.decision_reason,
            command.approvalId,
          );
          const updated = db
            .prepare('SELECT * FROM vict_agent_approval WHERE approval_id = ?;')
            .get(command.approvalId) as unknown as ApprovalRow;
          return rowToApproval(updated);
        }),
      );
    },

    async expireApproval(command: {
      approvalId: string;
      at: number;
    }): Promise<AgentApprovalRecord> {
      return safeRun('approvals.expire', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT * FROM vict_agent_approval WHERE approval_id = ?;')
            .get(command.approvalId) as unknown as ApprovalRow | undefined;
          if (row === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_APPROVAL_MISSING',
              'The approval record does not exist.',
            );
          }
          const current = rowToApproval(row);
          if (current.status === 'expired') {
            return current; // idempotent
          }
          if (current.status !== 'pending') {
            throw new VictControlError(
              'VICT_CONTROL_APPROVAL_INVALID_STATE',
              'Only a pending approval can expire.',
            );
          }
          db.prepare(
            'UPDATE vict_agent_approval SET status = ?, decided_at = ? WHERE approval_id = ?;',
          ).run('expired', toIso(command.at), command.approvalId);
          return { ...current, status: 'expired' as const, decidedAt: command.at };
        }),
      );
    },
  };

  const streamLedger: AgentStreamLedgerStore = {
    async appendEvent(command: {
      streamId: string;
      kind: import('@vict/contracts').AgentStreamEventKind;
      payload: string;
      at: number;
    }): Promise<{ seq: number; persisted: boolean }> {
      return safeRun('ledger.appendEvent', () =>
        inTransaction(db, () => {
          const current = db
            .prepare('SELECT last_seq FROM vict_agent_stream WHERE stream_id = ?;')
            .get(command.streamId) as { last_seq: number } | undefined;
          if (current === undefined) {
            db.prepare('INSERT INTO vict_agent_stream (stream_id, last_seq) VALUES (?, 1);').run(
              command.streamId,
            );
          } else {
            db.prepare(
              'UPDATE vict_agent_stream SET last_seq = last_seq + 1 WHERE stream_id = ?;',
            ).run(command.streamId);
          }
          const next = (current?.last_seq ?? 0) + 1;
          const persisted = isDurableStreamKind(command.kind);
          if (persisted) {
            db.prepare(
              `INSERT INTO vict_agent_stream_event (stream_id, seq, kind, payload, created_at)
               VALUES (?, ?, ?, ?, ?);`,
            ).run(command.streamId, next, command.kind, command.payload, toIso(command.at));
          }
          return { seq: next, persisted };
        }),
      );
    },

    async latestSeq(streamId: string): Promise<number> {
      return safeRun('ledger.latestSeq', () => {
        const row = db
          .prepare('SELECT last_seq FROM vict_agent_stream WHERE stream_id = ?;')
          .get(streamId) as { last_seq: number } | undefined;
        return row?.last_seq ?? 0;
      });
    },

    async listEventsFrom(
      streamId: string,
      afterSeq: number,
    ): Promise<readonly AgentStreamLedgerEvent[]> {
      return safeRun('ledger.listFrom', () => {
        const rows = db
          .prepare(
            'SELECT stream_id, seq, kind, payload, created_at FROM vict_agent_stream_event WHERE stream_id = ? AND seq > ? ORDER BY seq ASC;',
          )
          .all(streamId, afterSeq) as unknown as StreamEventRow[];
        return rows.map((row) => rowToLedgerEvent(row));
      });
    },

    async listStreamIds(): Promise<readonly string[]> {
      return safeRun('ledger.listStreams', () => {
        const rows = db
          .prepare('SELECT stream_id FROM vict_agent_stream ORDER BY stream_id ASC;')
          .all() as unknown as { stream_id: string }[];
        return rows.map((row) => row.stream_id);
      });
    },
  };

  return {
    actors,
    control,
    turns,
    invocations,
    approvals,
    streamLedger,
    close(): void {
      handle.close();
    },
  };
}

/**
 * The actor directory is a small mutable registry; the SQLite actor table
 * exists for restart-safe local compositions, while the shipped conformance
 * and product compositions use the neutral in-memory directory seeded from
 * operator configuration (actor changes are administrative, audited, and
 * rare). The fallback reuses the neutral in-memory implementation.
 */
class InMemoryActorDirectoryFallback extends InMemoryActorDirectory {}

/** Unused-import guards for optional neutral integrations. */
export type SqliteAgentGovernanceStoreAlias = AgentGovernanceStore;
export type SqliteAgentActivationRecord = AgentActivationRecord;
export type SqliteAgentDeletionStep = AgentDeletionStep;
export const __agentControlGuards = {
  validateAgentActivationRecord,
  assertDeletionReceiptStep,
};
