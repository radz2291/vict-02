import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  createSqliteAgentControlStores,
  CURRENT_SCHEMA_VERSION,
  openDatabase,
  readSchemaVersion,
  runMigrations,
  SCHEMA_MIGRATIONS,
} from '../src/index.js';
import { VICT_EFFECT_POLICY_IDENTITY } from '@victframework/runtime';
import type { AgentToolInvocationRecord } from '@victframework/runtime';

/**
 * VICT-M-1 focused durable-evidence controls (frozen contract
 * `docs/report/VICT-M-1-REMEDIATION-CONTRACT.md` §7/§9, controls 12–13).
 *
 * Migration 10 (`m1-approval-decision-evidence`) is atomic and
 * forward-only: legacy invocation rows are backfilled ONLY from the fixed
 * 0.2.0 rule (derivable unambiguously from the NOT-NULL closed-vocabulary
 * `effect` column), every unrelated value is preserved byte-truthfully,
 * historical effects are never rewritten, a failing migration rolls back,
 * and the new decision evidence is immutable after intent across
 * claims, settlements, and restarts.
 */

interface LegacyInvocationRow {
  readonly [column: string]: string | number | null | undefined;
}

const LEGACY_TURN = {
  turn_id: 'turn-legacy-1',
  stream_id: 'stream-legacy-1',
  thread_id: 'thread-legacy-1',
  actor_id: 'actor-legacy',
  agent_profile_version: 'v1',
  input_summary: 'legacy turn',
  status: 'completed',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:01.000Z',
};

function legacyInvocation(
  invocationId: string,
  idempotencyKey: string,
  effect: string,
): LegacyInvocationRow {
  return {
    invocation_id: invocationId,
    turn_id: LEGACY_TURN.turn_id,
    tool_call_id: `call-${invocationId}`,
    tool_name: 'qlt.proposal.draft',
    capability_id: 'qlt.proposal.draft',
    capability_revision: '1',
    effect,
    idempotency_key: idempotencyKey,
    actor_id: 'actor-legacy',
    arg_digest: `digest-${invocationId}`,
    argument_summary: 'object:1',
    status: 'completed',
    created_at: '2026-09-01T00:00:02.000Z',
    updated_at: '2026-09-01T00:00:03.000Z',
    completed_at: '2026-09-01T00:00:03.000Z',
    result_summary: 'object:1',
    error_code: null,
    run_fence_token: `fence-${invocationId}`,
    run_fence_at: '2026-09-01T00:00:02.500Z',
    run_owner_identity: 'bridge-owner',
    run_generation: 1,
  };
}

const LEGACY_INVOCATIONS = [
  legacyInvocation('inv-legacy-write', 'key-legacy-write', 'write'),
  legacyInvocation('inv-legacy-read', 'key-legacy-read', 'read'),
  legacyInvocation('inv-legacy-irrev', 'key-legacy-irrev', 'irreversible'),
];

function insertLegacyData(db: DatabaseSync): void {
  db.prepare(
    `INSERT INTO vict_agent_turn
      (turn_id, stream_id, thread_id, actor_id, agent_profile_version, input_summary, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
  ).run(
    LEGACY_TURN.turn_id,
    LEGACY_TURN.stream_id,
    LEGACY_TURN.thread_id,
    LEGACY_TURN.actor_id,
    LEGACY_TURN.agent_profile_version,
    LEGACY_TURN.input_summary,
    LEGACY_TURN.status,
    LEGACY_TURN.created_at,
    LEGACY_TURN.updated_at,
  );
  for (const row of LEGACY_INVOCATIONS) {
    db.prepare(
      `INSERT INTO vict_agent_tool_invocation
        (invocation_id, turn_id, tool_call_id, tool_name, capability_id, capability_revision, effect,
         idempotency_key, actor_id, arg_digest, argument_summary, status, created_at, updated_at,
         completed_at, result_summary, error_code, run_fence_token, run_fence_at, run_owner_identity, run_generation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    ).run(
      row['invocation_id'] as string,
      row['turn_id'] as string,
      row['tool_call_id'] as string,
      row['tool_name'] as string,
      row['capability_id'] as string,
      row['capability_revision'] as string,
      row['effect'] as string,
      row['idempotency_key'] as string,
      row['actor_id'] as string,
      row['arg_digest'] as string,
      row['argument_summary'] as string,
      row['status'] as string,
      row['created_at'] as string,
      row['updated_at'] as string,
      row['completed_at'] as string | null,
      row['result_summary'] as string | null,
      row['error_code'] as string | null,
      row['run_fence_token'] as string | null,
      row['run_fence_at'] as string | null,
      row['run_owner_identity'] as string | null,
      row['run_generation'] as number | null,
    );
  }
}

function readAllInvocations(path: string): LegacyInvocationRow[] {
  const db = new DatabaseSync(path);
  try {
    return db
      .prepare('SELECT * FROM vict_agent_tool_invocation ORDER BY invocation_id ASC;')
      .all() as LegacyInvocationRow[];
  } finally {
    db.close();
  }
}

describe('VICT-M-1 approval-decision evidence (SQLite migration 10)', () => {
  it('control 13: migration 10 backfills legacy rows from the fixed 0.2.0 rule and preserves every unrelated value', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-m1-evidence-'));
    try {
      const path = join(dir, 'm1.db');
      // Build a TRUE legacy database: schema version 9 (the complete 0.2.0
      // schema), with real turn + invocation rows written through the
      // legacy column list.
      {
        const handle = openDatabase({ path });
        const db = handle.db;
        try {
          runMigrations(db, { migrations: SCHEMA_MIGRATIONS.slice(0, 9) });
          expect(readSchemaVersion(db)).toBe(9);
          insertLegacyData(db);
        } finally {
          handle.close();
        }
      }
      const before = readAllInvocations(path);
      expect(before).toHaveLength(3);

      // Reopen through the full migration set: migration 10 runs.
      const stores = createSqliteAgentControlStores({ path });
      try {
        const db = new DatabaseSync(path);
        expect(readSchemaVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
        db.close();

        const after = readAllInvocations(path);
        expect(after).toHaveLength(3);
        const byId = new Map(after.map((row) => [row['invocation_id'], row]));
        const expectedDisposition = 'default-effect-policy';
        const expectedIdentity = VICT_EFFECT_POLICY_IDENTITY;
        for (const legacy of LEGACY_INVOCATIONS) {
          const row = byId.get(legacy['invocation_id'] as string) as LegacyInvocationRow;
          // Historical effect values are NEVER rewritten.
          expect(row['effect']).toBe(legacy['effect']);
          // The fixed 0.2.0 rule backfills the approval decision
          // unambiguously: write/irreversible → required; read → not.
          const expectedRequired =
            legacy['effect'] === 'write' || legacy['effect'] === 'irreversible' ? 1 : 0;
          expect(row['approval_required']).toBe(expectedRequired);
          expect(row['approval_disposition']).toBe(expectedDisposition);
          expect(row['effect_policy_identity']).toBe(expectedIdentity);
          // EVERY unrelated column is preserved byte-truthfully.
          for (const column of Object.keys(legacy)) {
            expect(row[column], `column ${column} of ${legacy['invocation_id']}`).toBe(
              legacy[column],
            );
          }
        }

        // The adapter SURFACES the backfilled evidence truthfully.
        const surfaced = await stores.invocations.getInvocation('inv-legacy-write');
        expect(surfaced?.approvalRequired).toBe(true);
        expect(surfaced?.approvalDisposition).toBe(expectedDisposition);
        expect(surfaced?.effectPolicyIdentity).toBe(expectedIdentity);
        const surfacedRead = await stores.invocations.getInvocation('inv-legacy-read');
        expect(surfacedRead?.approvalRequired).toBe(false);
      } finally {
        stores.close();
      }
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });

  it('a failing migration 10 rolls back: version stays 9 and no partial columns exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-m1-rollback-'));
    try {
      const path = join(dir, 'rollback.db');
      {
        const handle = openDatabase({ path });
        const db = handle.db;
        try {
          runMigrations(db, { migrations: SCHEMA_MIGRATIONS.slice(0, 9) });
          insertLegacyData(db);
        } finally {
          handle.close();
        }
      }
      // A deliberately broken migration 10: its backfill statement tries
      // to write an effect value outside the closed CHECK vocabulary —
      // the statement fails mid-migration and the WHOLE migration (the
      // already-applied ADD COLUMN included) must roll back.
      const brokenMigration10 = {
        version: 10,
        name: 'deliberately-broken-m1',
        statements: [
          `ALTER TABLE vict_agent_tool_invocation ADD COLUMN approval_required INTEGER;`,
          `UPDATE vict_agent_tool_invocation SET effect = 'not-an-effect';`,
        ],
      };
      let errorCode: string | undefined;
      try {
        const stores = createSqliteAgentControlStores({
          path,
          migrations: { migrations: [...SCHEMA_MIGRATIONS.slice(0, 9), brokenMigration10] },
        });
        stores.close();
      } catch (cause) {
        errorCode = (cause as { code?: string }).code;
      }
      expect(errorCode).toBe('VICT_STORE_MIGRATION_FAILED');

      // Rollback proof: the version stayed 9 and the partially added
      // column does NOT exist — no falsely advanced, half-migrated state.
      const db = new DatabaseSync(path);
      try {
        expect(readSchemaVersion(db)).toBe(9);
        const columns = db.prepare('PRAGMA table_info(vict_agent_tool_invocation);').all() as {
          name: string;
        }[];
        expect(columns.some((column) => column.name === 'approval_required')).toBe(false);
      } finally {
        db.close();
      }
      // The legacy rows are intact.
      expect(readAllInvocations(path)).toHaveLength(3);
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });

  it('new records carry the decision evidence; it is immutable through claim, settlement, and restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-m1-immutable-'));
    try {
      const path = join(dir, 'immutable.db');
      const stores = createSqliteAgentControlStores({ path });
      const record: AgentToolInvocationRecord = {
        invocationId: 'inv-m1-immutable',
        turnId: 'turn-m1-immutable',
        toolCallId: 'call-m1',
        toolName: 'qlt.proposal.draft',
        capabilityId: 'qlt.proposal.draft',
        capabilityRevision: '2',
        effect: 'write',
        idempotencyKey: 'key-m1-immutable',
        actorId: 'actor-m1',
        argDigest: 'digest-m1',
        argumentSummary: 'object:1',
        status: 'intent',
        createdAt: 1000,
        updatedAt: 1000,
        completedAt: undefined,
        resultSummary: undefined,
        errorCode: undefined,
        approvalRequired: false,
        approvalDisposition: 'host-policy-write-without-separate-approval',
        effectPolicyIdentity: VICT_EFFECT_POLICY_IDENTITY,
      };
      await stores.turns.createTurnIntent({
        turnId: record.turnId,
        streamId: 'stream-m1',
        threadId: 'thread-m1',
        actorId: record.actorId,
        agentProfileVersion: 'v1',
        activationVersion: undefined,
        applicationReleaseVersion: undefined,
        inputSummary: 'm1 probe turn',
        status: 'intent',
        createdAt: 1000,
        updatedAt: 1000,
        terminalAt: undefined,
        errorCode: undefined,
        traceId: undefined,
        victRunId: undefined,
        mastraRunId: undefined,
      });
      await stores.invocations.recordInvocationIntent(record);

      // Control 12: claim + fenced settlement NEVER mutate the evidence.
      const claimed = await stores.invocations.claimInvocationRun({
        invocationId: record.invocationId,
        fenceToken: 'fence-m1',
        ownerIdentity: 'bridge-owner',
        at: 2000,
      });
      expect(claimed.approvalRequired).toBe(false);
      expect(claimed.approvalDisposition).toBe('host-policy-write-without-separate-approval');
      await stores.invocations.settleInvocationRun({
        invocationId: record.invocationId,
        fenceToken: 'fence-m1',
        status: 'completed',
        at: 3000,
        resultSummary: 'object:1',
      });
      stores.close();

      // Restart: the reopened store surfaces the ORIGINAL decision snapshot.
      const reopened = createSqliteAgentControlStores({ path });
      try {
        const after = await reopened.invocations.getInvocation(record.invocationId);
        expect(after?.status).toBe('completed');
        expect(after?.effect).toBe('write');
        expect(after?.approvalRequired).toBe(false);
        expect(after?.approvalDisposition).toBe('host-policy-write-without-separate-approval');
        expect(after?.effectPolicyIdentity).toBe(VICT_EFFECT_POLICY_IDENTITY);
        // The idempotent re-record returns the EXISTING snapshot (the
        // retry path can never rewrite the decision).
        const rerecorded = await reopened.invocations.recordInvocationIntent(record);
        expect(rerecorded.approvalDisposition).toBe('host-policy-write-without-separate-approval');
        expect(rerecorded.invocationId).toBe(record.invocationId);
      } finally {
        reopened.close();
      }
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });

  it('the migration file is present in the source tree and named per the frozen contract', async () => {
    // Source-truth guard: the migration name is part of the frozen
    // evidence contract.
    const source = await readFile(new URL('../src/migrations.ts', import.meta.url), 'utf8');
    expect(source).toContain('version: 10,');
    expect(source).toContain("name: 'm1-approval-decision-evidence',");
  });
});
