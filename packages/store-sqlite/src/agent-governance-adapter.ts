import { DatabaseSync } from 'node:sqlite';
import {
  assertDeletionStateTransition,
  VictStoreError,
  validateAgentActivationRecord,
  type AgentActivationRecord,
  type AgentDeletionIntentRecord,
  type AgentDeletionIntentState,
  type AgentDeletionStep,
  type AgentGovernanceStore,
} from '@vict/runtime';
import { openDatabase, safeRun, inTransaction, type OpenDatabase } from './driver.js';
import { runMigrations } from './migrations.js';

/**
 * SQLite adapter for durable agent-governance records (Stage 06A).
 *
 * Stores deletion intents, per-step deletion receipts, and persisted
 * agent-activation identity records in the SAME operational SQLite database
 * domain as the Stage 02 stores — deletion intents and activation identity
 * are VICT operational audit data — with tables structurally disjoint from
 * every existing operational table (additive `vict_agent_*` schema,
 * migration version 3).
 *
 * Semantics are SHARED with the in-memory implementation through the same
 * invariant helpers (conformance-tested so the adapters cannot diverge):
 * - activation records are structurally validated BEFORE persistence
 *   (closed field sets, canonical versions, well-formed artifact entries);
 * - activation records are idempotent by `activationVersion`; same-version
 *   different-content is a collision (fail closed);
 * - deletion intents must be recorded as `pending` with no receipts;
 *   arbitrary initial states and fabricated receipts are rejected;
 * - deletion intents are idempotent by `intentId`; conflicting content is
 *   a collision;
 * - receipts are idempotent per (intentId, step) — a duplicate receipt is a
 *   no-op, never a duplicate row; the memory receipt requires the
 *   application-domain receipt (out-of-order receipts are rejected);
 * - intent state transitions are forward-only AND stepwise (no skips).
 */

interface IntentRow {
  intent_id: string;
  conversation_id: string;
  actor_id: string;
  state: string;
  created_at: string;
  updated_at: string;
}

interface ReceiptRow {
  intent_id: string;
  step: string;
  at: string;
}

function rowToIntent(row: IntentRow, receipts: readonly ReceiptRow[]): AgentDeletionIntentRecord {
  return {
    intentId: row.intent_id,
    conversationId: row.conversation_id,
    actorId: row.actor_id,
    createdAt: Date.parse(row.created_at),
    state: row.state as AgentDeletionIntentState,
    receipts: receipts.map((receipt) => ({
      step: receipt.step as AgentDeletionStep,
      at: Date.parse(receipt.at),
    })),
  };
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Options for `createSqliteAgentGovernanceStore`. */
export interface SqliteAgentGovernanceOptions {
  /** Database file path or `':memory:'`. Default `':memory:'`. */
  readonly path?: string;
  /** A pre-opened database handle (test/integration infrastructure; the caller owns its pragmas). */
  readonly database?: DatabaseSync;
  /** Injected migration options (tests); defaults to the shipped migration set. */
  readonly migrations?: Parameters<typeof runMigrations>[1];
}

/** The SQLite governance store: governance semantics plus a sync close. */
export interface SqliteAgentGovernanceStore extends Omit<AgentGovernanceStore, 'close'> {
  close(): void;
}

/**
 * Create a durable SQLite-backed AgentGovernanceStore. The store migrates
 * the database to the current operational schema version (additive), so it
 * can share one file with `createSqliteStores` or run in a dedicated file.
 */
export function createSqliteAgentGovernanceStore(
  options: SqliteAgentGovernanceOptions = {},
): SqliteAgentGovernanceStore {
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

  const insertActivation = (record: AgentActivationRecord): void => {
    const existing = db
      .prepare(
        'SELECT canonical_manifest, agent_profile_version, agent_id, agent_revision, artifacts, created_at FROM vict_agent_activation WHERE activation_version = ?;',
      )
      .get(record.activationVersion) as
      | {
          canonical_manifest: string;
          agent_profile_version: string;
          agent_id: string;
          agent_revision: string;
          artifacts: string;
          created_at: string;
        }
      | undefined;
    if (existing !== undefined) {
      const matches =
        existing.canonical_manifest === record.canonicalManifest &&
        existing.agent_profile_version === record.agentProfileVersion &&
        existing.agent_id === record.agentId &&
        existing.agent_revision === record.agentRevision &&
        existing.artifacts === JSON.stringify(record.artifacts) &&
        existing.created_at === toIso(record.createdAt);
      if (!matches) {
        throw new VictStoreError(
          'VICT_STORE_ACTIVATION_COLLISION',
          'An agent-activation record with this version already exists with different content.',
          { operation: 'agentGovernance.saveActivation' },
        );
      }
      return; // idempotent republish
    }
    db.prepare(
      `INSERT INTO vict_agent_activation
        (activation_version, agent_profile_version, agent_id, agent_revision, canonical_manifest, artifacts, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?);`,
    ).run(
      record.activationVersion,
      record.agentProfileVersion,
      record.agentId,
      record.agentRevision,
      record.canonicalManifest,
      JSON.stringify(record.artifacts),
      toIso(record.createdAt),
    );
  };

  return {
    async saveAgentActivation(record: AgentActivationRecord): Promise<void> {
      const validation = validateAgentActivationRecord(record);
      if (!validation.ok) {
        throw new VictStoreError(
          'VICT_STORE_INVALID_COMMAND',
          `The activation record is malformed and was not persisted: ${validation.reason}`,
          { operation: 'agentGovernance.saveActivation' },
        );
      }
      safeRun('agentGovernance.saveActivation', () =>
        inTransaction(db, () => {
          insertActivation(record);
        }),
      );
    },

    async getAgentActivation(
      activationVersion: string,
    ): Promise<AgentActivationRecord | undefined> {
      return safeRun('agentGovernance.getActivation', () => {
        const row = db
          .prepare('SELECT * FROM vict_agent_activation WHERE activation_version = ?;')
          .get(activationVersion) as
          | {
              activation_version: string;
              agent_profile_version: string;
              agent_id: string;
              agent_revision: string;
              canonical_manifest: string;
              artifacts: string;
              created_at: string;
            }
          | undefined;
        if (row === undefined) {
          return undefined;
        }
        return {
          recordSchema: 'vict.agent-activation-record@1' as const,
          activationVersion: row.activation_version,
          agentProfileVersion: row.agent_profile_version,
          agentId: row.agent_id,
          agentRevision: row.agent_revision,
          canonicalManifest: row.canonical_manifest,
          artifacts: JSON.parse(row.artifacts) as AgentActivationRecord['artifacts'],
          createdAt: Date.parse(row.created_at),
        };
      });
    },

    async recordDeletionIntent(record: AgentDeletionIntentRecord): Promise<void> {
      if (record.state !== 'pending' || (record.receipts && record.receipts.length > 0)) {
        throw new VictStoreError(
          'VICT_STORE_INVALID_COMMAND',
          'A deletion intent must be recorded as pending with no receipts; arbitrary initial states and fabricated receipts are rejected.',
          { operation: 'agentGovernance.recordIntent' },
        );
      }
      safeRun('agentGovernance.recordIntent', () =>
        inTransaction(db, () => {
          const existing = db
            .prepare(
              'SELECT conversation_id, actor_id, created_at FROM vict_agent_deletion_intent WHERE intent_id = ?;',
            )
            .get(record.intentId) as
            { conversation_id: string; actor_id: string; created_at: string } | undefined;
          if (existing !== undefined) {
            if (
              existing.conversation_id !== record.conversationId ||
              existing.actor_id !== record.actorId ||
              existing.created_at !== toIso(record.createdAt)
            ) {
              throw new VictStoreError(
                'VICT_STORE_INVALID_COMMAND',
                'A deletion intent with this id already exists with different content.',
                { operation: 'agentGovernance.recordIntent' },
              );
            }
            return; // idempotent
          }
          const now = toIso(record.createdAt);
          db.prepare(
            `INSERT INTO vict_agent_deletion_intent (intent_id, conversation_id, actor_id, state, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?);`,
          ).run(record.intentId, record.conversationId, record.actorId, record.state, now, now);
          for (const receipt of record.receipts) {
            db.prepare(
              'INSERT OR IGNORE INTO vict_agent_deletion_receipt (intent_id, step, at) VALUES (?, ?, ?);',
            ).run(record.intentId, receipt.step, toIso(receipt.at));
          }
        }),
      );
    },

    async getDeletionIntent(intentId: string): Promise<AgentDeletionIntentRecord | undefined> {
      return safeRun('agentGovernance.getIntent', () => {
        const row = db
          .prepare('SELECT * FROM vict_agent_deletion_intent WHERE intent_id = ?;')
          .get(intentId) as IntentRow | undefined;
        if (row === undefined) {
          return undefined;
        }
        const receipts = db
          .prepare(
            'SELECT intent_id, step, at FROM vict_agent_deletion_receipt WHERE intent_id = ? ORDER BY step ASC;',
          )
          .all(intentId) as unknown as ReceiptRow[];
        return rowToIntent(row, receipts);
      });
    },

    async listOpenDeletionIntents(): Promise<readonly AgentDeletionIntentRecord[]> {
      return safeRun('agentGovernance.listOpenIntents', () => {
        const rows = db
          .prepare(
            "SELECT * FROM vict_agent_deletion_intent WHERE state <> 'completed' ORDER BY intent_id ASC;",
          )
          .all() as unknown as IntentRow[];
        return rows.map((row) => {
          const receipts = db
            .prepare(
              'SELECT intent_id, step, at FROM vict_agent_deletion_receipt WHERE intent_id = ? ORDER BY step ASC;',
            )
            .all(row.intent_id) as unknown as ReceiptRow[];
          return rowToIntent(row, receipts);
        });
      });
    },

    async recordDeletionReceipt(
      intentId: string,
      step: AgentDeletionStep,
      at: number,
    ): Promise<void> {
      safeRun('agentGovernance.recordReceipt', () =>
        inTransaction(db, () => {
          const intent = db
            .prepare('SELECT intent_id FROM vict_agent_deletion_intent WHERE intent_id = ?;')
            .get(intentId) as { intent_id: string } | undefined;
          if (intent === undefined) {
            throw new VictStoreError(
              'VICT_STORE_INVALID_COMMAND',
              'The deletion intent does not exist.',
              { operation: 'agentGovernance.recordReceipt' },
            );
          }
          // Receipt order mirrors the governed execution order (shared with
          // the in-memory store): the memory receipt requires the
          // application-domain receipt.
          if (step === 'mastra-memory') {
            const domainReceipt = db
              .prepare(
                'SELECT step FROM vict_agent_deletion_receipt WHERE intent_id = ? AND step = ?;',
              )
              .get(intentId, 'application-domain');
            if (domainReceipt === undefined) {
              throw new VictStoreError(
                'VICT_STORE_INVALID_COMMAND',
                'The memory step receipt requires the application-domain receipt to exist first.',
                { operation: 'agentGovernance.recordReceipt' },
              );
            }
          }
          // Idempotent: INSERT OR IGNORE makes a duplicate receipt a no-op
          // (primary key intent_id + step), never a duplicate row.
          db.prepare(
            'INSERT OR IGNORE INTO vict_agent_deletion_receipt (intent_id, step, at) VALUES (?, ?, ?);',
          ).run(intentId, step, toIso(at));
        }),
      );
    },

    async updateDeletionIntentState(
      intentId: string,
      state: AgentDeletionIntentState,
    ): Promise<void> {
      safeRun('agentGovernance.updateIntentState', () =>
        inTransaction(db, () => {
          const row = db
            .prepare('SELECT state FROM vict_agent_deletion_intent WHERE intent_id = ?;')
            .get(intentId) as { state: AgentDeletionIntentState } | undefined;
          if (row === undefined) {
            throw new VictStoreError(
              'VICT_STORE_INVALID_COMMAND',
              'The deletion intent does not exist.',
              { operation: 'agentGovernance.updateIntentState' },
            );
          }
          assertDeletionStateTransition(row.state, state);
          db.prepare(
            'UPDATE vict_agent_deletion_intent SET state = ?, updated_at = ? WHERE intent_id = ?;',
          ).run(state, toIso(Date.now()), intentId);
        }),
      );
    },

    close(): void {
      handle.close();
    },
  };
}
