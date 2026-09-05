import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  createSqliteAgentGovernanceStore,
  CURRENT_SCHEMA_VERSION,
  readSchemaVersion,
} from '../src/index.js';

/**
 * Stage 06A permanent regression: the SQLite agent-governance store —
 * additive migration (version 3), the same conformance discipline as the
 * in-memory store, real close/reopen, and durable receipt/intent semantics
 * (MSTR-011 restart model).
 */

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeSqliteStore(): ReturnType<typeof createSqliteAgentGovernanceStore> {
  return createSqliteAgentGovernanceStore({ path: join(tempDir('vict-agent-sqlite-'), 'ops.db') });
}

describe('agent governance store — sqlite', () => {
  it('persists and reads activation identity records idempotently', async () => {
    const store = makeSqliteStore();
    try {
      const record = {
        recordSchema: 'vict.agent-activation-record@1' as const,
        activationVersion: 'v1_' + 'a'.repeat(64),
        agentProfileVersion: 'v1_' + 'b'.repeat(64),
        agentId: 'agent.x',
        agentRevision: '1',
        canonicalManifest: '{"json":true}',
        artifacts: [{ kind: 'instructions' as const, id: 'i', revision: '1' }],
        createdAt: 42,
      };
      await store.saveAgentActivation(record);
      await store.saveAgentActivation(record);
      const read = await store.getAgentActivation(record.activationVersion);
      expect(read?.agentId).toBe('agent.x');
      await expect(store.saveAgentActivation({ ...record, agentId: 'other' })).rejects.toThrow(
        /different content/i,
      );
    } finally {
      store.close();
    }
  });

  it('records deletion intents idempotently and deduplicates receipts durably', async () => {
    const store = makeSqliteStore();
    try {
      const intent = {
        intentId: 'vict-del-conv-1',
        conversationId: 'conv-1',
        actorId: 'actor-1',
        createdAt: 100,
        state: 'pending' as const,
        receipts: [],
      };
      await store.recordDeletionIntent(intent);
      await store.recordDeletionIntent(intent);
      await store.recordDeletionReceipt(intent.intentId, 'application-domain', 200);
      await store.recordDeletionReceipt(intent.intentId, 'application-domain', 999);
      const read = await store.getDeletionIntent(intent.intentId);
      expect(read?.receipts).toEqual([{ step: 'application-domain', at: 200 }]);
      expect(await store.listOpenDeletionIntents()).toHaveLength(1);
      await store.updateDeletionIntentState(intent.intentId, 'application-domain-deleted');
      await store.recordDeletionReceipt(intent.intentId, 'mastra-memory', 300);
      await store.updateDeletionIntentState(intent.intentId, 'completed');
      expect(await store.listOpenDeletionIntents()).toHaveLength(0);
    } finally {
      store.close();
    }
  });

  it('survives close/reopen: intents, receipts, and activations persist in the operational schema', async () => {
    const dbPath = join(tempDir('vict-agent-sqlite-reopen-'), 'ops.db');
    const first = createSqliteAgentGovernanceStore({ path: dbPath });
    await first.recordDeletionIntent({
      intentId: 'vict-del-conv-9',
      conversationId: 'conv-9',
      actorId: 'actor-1',
      createdAt: 100,
      state: 'pending',
      receipts: [],
    });
    await first.recordDeletionReceipt('vict-del-conv-9', 'application-domain', 200);
    await first.updateDeletionIntentState('vict-del-conv-9', 'application-domain-deleted');
    first.close();

    // Reopen: a fresh handle over the same file sees all durable records.
    const second = createSqliteAgentGovernanceStore({ path: dbPath });
    try {
      const intent = await second.getDeletionIntent('vict-del-conv-9');
      expect(intent?.state).toBe('application-domain-deleted');
      expect(intent?.receipts).toEqual([{ step: 'application-domain', at: 200 }]);
      // Receipt dedupe survives reopen (primary key intent_id + step).
      await second.recordDeletionReceipt('vict-del-conv-9', 'application-domain', 9999);
      const after = await second.getDeletionIntent('vict-del-conv-9');
      expect(after?.receipts).toEqual([{ step: 'application-domain', at: 200 }]);
      const open = await second.listOpenDeletionIntents();
      expect(open.map((entry) => entry.intentId)).toEqual(['vict-del-conv-9']);
    } finally {
      second.close();
    }
  });

  it('applies the additive agent-governance migration without touching operational tables', () => {
    const dbPath = join(tempDir('vict-agent-sqlite-migr-'), 'ops.db');
    const store = createSqliteAgentGovernanceStore({ path: dbPath });
    store.close();
    const db = new DatabaseSync(dbPath);
    try {
      expect(readSchemaVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
      expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(3);
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all()
        .map((row) => (row as { name: string }).name);
      // Agent-governance tables exist…
      for (const table of [
        'vict_agent_activation',
        'vict_agent_deletion_intent',
        'vict_agent_deletion_receipt',
      ]) {
        expect(tables).toContain(table);
      }
      // …and the established operational tables remain untouched.
      for (const table of ['vict_schema_migration', 'vict_activation', 'vict_run']) {
        expect(tables).toContain(table);
      }
      // No Mastra-owned tables in the VICT operational store.
      expect(tables.some((table) => table.startsWith('mastra_'))).toBe(false);
    } finally {
      db.close();
    }
  });
});
