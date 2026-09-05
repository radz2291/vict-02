import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { AgentProfileRegistry, type AgentActivationRecord } from '@vict/runtime';
import {
  createSqliteAgentGovernanceStore,
  CURRENT_SCHEMA_VERSION,
  readSchemaVersion,
} from '../src/index.js';

/**
 * Build a REAL activation record through the registry: the store boundary
 * validates the canonical manifest and recomputes the record identity, so
 * durable-conformance records must come from the actual activation
 * pipeline (fabricated records are rejected before storage).
 */
function realActivationRecord(): AgentActivationRecord {
  const registry = new AgentProfileRegistry();
  registry.registerArtifact({
    kind: 'instructions',
    id: 'instructions.governance',
    revision: '1',
    text: 'Governance conformance instructions.',
  });
  registry.registerArtifact({
    kind: 'memory-policy',
    id: 'memory-policy.governance',
    revision: '1',
    config: { lastMessages: 5, workingMemory: { enabled: false }, semanticRecall: false },
  });
  registry.registerProfile({
    schema: 'vict.agent-profile@1',
    id: 'agent.governance.sqlite',
    revision: '1',
    instructions: { id: 'instructions.governance', revision: '1' },
    modelProfile: {
      id: 'model.governance',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: {},
    turnPolicy: { maxSteps: 2, maxToolCalls: 0, onLimit: 'fail-closed' },
    memoryPolicy: { id: 'memory-policy.governance', revision: '1' },
    guardrails: [],
    helperTools: [],
    capabilities: [],
    adapter: {
      id: '@vict/mastra',
      revision: '1',
      runtimePackages: {
        '@mastra/core': '1.64.0',
        '@mastra/memory': '1.28.2',
        '@mastra/libsql': '1.22.3',
        '@mastra/observability': '1.17.5',
      },
    },
  });
  const activation = registry.activateAgentProfile({
    id: 'agent.governance.sqlite',
    revision: '1',
  });
  return {
    recordSchema: 'vict.agent-activation-record@1',
    activationVersion: activation.activationVersion,
    agentProfileVersion: activation.agentProfileVersion,
    agentId: activation.profile.profile.id,
    agentRevision: activation.profile.profile.revision,
    canonicalManifest: activation.canonicalManifestJson,
    artifacts: activation.artifactList.map((entry) => ({
      kind: entry.kind,
      id: entry.id,
      revision: entry.revision,
    })),
    createdAt: activation.createdAt,
  };
}

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
      const record = realActivationRecord();
      await store.saveAgentActivation(record);
      await store.saveAgentActivation(record);
      const read = await store.getAgentActivation(record.activationVersion);
      expect(read?.agentId).toBe('agent.governance.sqlite');
      // A fabricated record (made-up hash/manifest) is rejected BEFORE
      // storage — nothing persists under the fabricated version.
      const fabricated = {
        ...record,
        activationVersion: 'v1_' + 'a'.repeat(64),
        canonicalManifest: '{"schema":"vict.agent-activation@3"}',
      };
      await expect(store.saveAgentActivation(fabricated)).rejects.toThrow();
      expect(await store.getAgentActivation('v1_' + 'a'.repeat(64))).toBeUndefined();
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
      await store.recordDeletionReceipt(intent.intentId, 'memory-store', 300);
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
