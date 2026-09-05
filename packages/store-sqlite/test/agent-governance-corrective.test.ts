import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createSqliteAgentGovernanceStore } from '../src/index.js';
import type { AgentActivationRecord } from '@vict/runtime';

/**
 * Stage 06A corrective regressions — governance-record invariants on the
 * DURABLE SQLite store, shared with the in-memory store so the adapters
 * cannot diverge:
 *
 * - activation records are validated BEFORE persistence (malformed,
 *   inconsistent, or secret-bearing records never enter the database);
 * - deletion intents must start pending with no receipts (arbitrary initial
 *   states and fabricated receipts are rejected);
 * - state transitions are forward-only AND stepwise (no skipped
 *   transitions; completion requires the receipts of each step);
 * - the memory receipt requires the application-domain receipt;
 * - legal idempotent retries are preserved;
 * - activation restoration works across close/reopen AND a FRESH PROCESS.
 */

const SECRET_INJECTION = 'sqlite-secret-CANARY-77e3';

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

function makeSqliteStore(): ReturnType<typeof createSqliteAgentGovernanceStore> {
  return createSqliteAgentGovernanceStore({
    path: join(tempDir('vict-agent-corrective-'), 'ops.db'),
  });
}

function validActivationRecord(): AgentActivationRecord {
  return {
    recordSchema: 'vict.agent-activation-record@1',
    activationVersion: `v1_${'a'.repeat(64)}`,
    agentProfileVersion: `v1_${'b'.repeat(64)}`,
    agentId: 'agent.sqlite',
    agentRevision: '1',
    canonicalManifest: '{"schema":"vict.agent-activation@2"}',
    artifacts: [
      { kind: 'capability', id: 'cap.a', revision: '1' },
      { kind: 'instructions', id: 'instructions.a', revision: '1' },
    ],
    createdAt: 42,
  };
}

describe('sqlite governance store — activation-record validation before persistence', () => {
  it('rejects malformed activation records before they reach the database', async () => {
    {
      const store = makeSqliteStore();
      try {
        await expect(store.saveAgentActivation(validActivationRecord())).resolves.toBeUndefined();
        const cases: Array<{ label: string; mutate: (record: Record<string, unknown>) => void }> = [
          {
            label: 'unknown schema marker',
            mutate: (record) => {
              record.recordSchema = 'vict.agent-activation-record@2';
            },
          },
          {
            label: 'non-canonical activationVersion',
            mutate: (record) => {
              record.activationVersion = 'totally-not-canonical';
            },
          },
          {
            label: 'malformed artifact entry',
            mutate: (record) => {
              record.artifacts = [{ kind: 12, id: 'x' }];
            },
          },
          {
            label: 'missing canonicalManifest',
            mutate: (record) => {
              record.canonicalManifest = '';
            },
          },
          {
            label: 'secret-bearing injected field',
            mutate: (record) => {
              record.injected = SECRET_INJECTION;
            },
          },
        ];
        let index = 0;
        for (const entry of cases) {
          index += 1;
          const record = validActivationRecord() as unknown as Record<string, unknown>;
          record.activationVersion = `v1_${String(index).padStart(64, '0')}`;
          entry.mutate(record);
          await expect(
            store.saveAgentActivation(record as unknown as AgentActivationRecord),
          ).rejects.toThrow();
          // The rejected record's content is nowhere in the store.
          const read = await store.getAgentActivation(
            (record as { activationVersion: string }).activationVersion,
          );
          expect(read).toBeUndefined();
        }
        expect(JSON.stringify(await store.listOpenDeletionIntents())).not.toContain(
          SECRET_INJECTION,
        );
      } finally {
        store.close();
      }
    }
  });
});

describe('sqlite governance store — deletion state machine invariants', () => {
  it('rejects arbitrary initial states and fabricated receipts', async () => {
    const store = makeSqliteStore();
    try {
      await expect(
        store.recordDeletionIntent({
          intentId: 'i-1',
          conversationId: 'c-1',
          actorId: 'a-1',
          createdAt: 1,
          state: 'completed',
          receipts: [],
        }),
      ).rejects.toThrow();
      await expect(
        store.recordDeletionIntent({
          intentId: 'i-2',
          conversationId: 'c-2',
          actorId: 'a-1',
          createdAt: 1,
          state: 'pending',
          receipts: [{ step: 'application-domain', at: 5 }],
        }),
      ).rejects.toThrow();
      // Neither fabricated record exists.
      expect(await store.getDeletionIntent('i-1')).toBeUndefined();
      expect(await store.getDeletionIntent('i-2')).toBeUndefined();
    } finally {
      store.close();
    }
  });

  it('rejects skipped transitions: pending directly to completed', async () => {
    const store = makeSqliteStore();
    try {
      await store.recordDeletionIntent({
        intentId: 'i-skip',
        conversationId: 'c-skip',
        actorId: 'a-1',
        createdAt: 1,
        state: 'pending',
        receipts: [],
      });
      await expect(store.updateDeletionIntentState('i-skip', 'completed')).rejects.toThrow();
      expect((await store.getDeletionIntent('i-skip'))?.state).toBe('pending');
    } finally {
      store.close();
    }
  });

  it('requires receipts in governed order: memory receipt without domain receipt is rejected', async () => {
    const store = makeSqliteStore();
    try {
      await store.recordDeletionIntent({
        intentId: 'i-order',
        conversationId: 'c-order',
        actorId: 'a-1',
        createdAt: 1,
        state: 'pending',
        receipts: [],
      });
      await expect(store.recordDeletionReceipt('i-order', 'mastra-memory', 10)).rejects.toThrow();
      // No receipt was recorded.
      expect((await store.getDeletionIntent('i-order'))?.receipts).toEqual([]);
      // The legal order succeeds and duplicates stay idempotent.
      await store.recordDeletionReceipt('i-order', 'application-domain', 20);
      await store.recordDeletionReceipt('i-order', 'mastra-memory', 30);
      await store.recordDeletionReceipt('i-order', 'mastra-memory', 31);
      expect((await store.getDeletionIntent('i-order'))?.receipts).toEqual([
        { step: 'application-domain', at: 20 },
        { step: 'mastra-memory', at: 30 },
      ]);
    } finally {
      store.close();
    }
  });

  it('legal idempotent retries are preserved across close/reopen', async () => {
    const dbPath = join(tempDir('vict-agent-corrective-retry-'), 'ops.db');
    const first = createSqliteAgentGovernanceStore({ path: dbPath });
    const record = {
      intentId: 'i-retry',
      conversationId: 'c-retry',
      actorId: 'a-1',
      createdAt: 1,
      state: 'pending' as const,
      receipts: [],
    };
    await first.recordDeletionIntent(record);
    await first.recordDeletionReceipt('i-retry', 'application-domain', 10);
    first.close();
    const second = createSqliteAgentGovernanceStore({ path: dbPath });
    try {
      // Idempotent intent re-record (same content) and duplicate receipt.
      await second.recordDeletionIntent(record);
      await second.recordDeletionReceipt('i-retry', 'application-domain', 10);
      const read = await second.getDeletionIntent('i-retry');
      expect(read?.state).toBe('pending');
      expect(read?.receipts).toEqual([{ step: 'application-domain', at: 10 }]);
    } finally {
      second.close();
    }
  });
});

describe('activation restoration against SQLite across process boundaries', () => {
  it('close/reopen: the persisted record survives and re-validates identically', async () => {
    const dbPath = join(tempDir('vict-agent-corrective-reopen-'), 'ops.db');
    const record = validActivationRecord();
    const first = createSqliteAgentGovernanceStore({ path: dbPath });
    await first.saveAgentActivation(record);
    first.close();
    const second = createSqliteAgentGovernanceStore({ path: dbPath });
    try {
      const read = await second.getAgentActivation(record.activationVersion);
      expect(read).toEqual(record);
    } finally {
      second.close();
    }
  });

  it('fresh process: a record written by one node process restores in another', () => {
    const dir = tempDir('vict-agent-corrective-fresh-');
    const dbPath = join(dir, 'ops.db');
    const recordPath = join(dir, 'record.json');
    const repoRoot = resolve(__dirname, '..', '..', '..');
    const workerScript = join(dir, 'worker.mjs');
    // The worker runs against the BUILT @vict/store-sqlite dist (plain
    // Node, no tsx) — a genuine fresh-process boundary over the packed
    // runtime surfaces.
    writeFileSync(
      workerScript,
      [
        "import { createSqliteAgentGovernanceStore } from '@vict/store-sqlite';",
        'import { readFileSync, writeFileSync } from "node:fs";',
        'const [, , mode, dbPath, recordPath] = process.argv;',
        'const store = createSqliteAgentGovernanceStore({ path: dbPath });',
        'if (mode === "write") {',
        '  const record = JSON.parse(readFileSync(recordPath, "utf8"));',
        '  await store.saveAgentActivation(record);',
        '  console.log("written");',
        '} else {',
        '  const read = await store.getAgentActivation(JSON.parse(readFileSync(recordPath, "utf8")).activationVersion);',
        '  writeFileSync(recordPath + ".read", JSON.stringify(read));',
        '  console.log("read");',
        '}',
        'store.close();',
      ].join('\n'),
    );
    const record = validActivationRecord();
    writeFileSync(recordPath, JSON.stringify(record));
    const env = {
      ...process.env,
      NODE_PATH: join(repoRoot, 'node_modules'),
    };
    const options = { cwd: repoRoot, env, encoding: 'utf8' as const, timeout: 120_000 } as const;
    // Resolve @vict/store-sqlite from the workspace dist through a package
    // import map written next to the worker (plain node resolution).
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'vict-fresh-process-worker',
        private: true,
        type: 'module',
        imports: {},
        dependencies: {},
      }),
    );
    // The workspace dist is linked through a relative node_modules symlink
    // tree-free: create the consumer directory with a direct file dependency
    // is overkill here — instead resolve the dist entry directly.
    const distEntry = join(repoRoot, 'packages', 'store-sqlite', 'dist', 'index.js');
    expect(existsSync(distEntry)).toBe(true);
    writeFileSync(
      workerScript,
      [
        'import { readFileSync, writeFileSync } from "node:fs";',
        'import { pathToFileURL } from "node:url";',
        'const [, , mode, distPath, dbPath, recordPath] = process.argv;',
        'const { createSqliteAgentGovernanceStore } = await import(pathToFileURL(distPath));',
        'const store = createSqliteAgentGovernanceStore({ path: dbPath });',
        'if (mode === "write") {',
        '  const record = JSON.parse(readFileSync(recordPath, "utf8"));',
        '  await store.saveAgentActivation(record);',
        '  console.log("written");',
        '} else {',
        '  const read = await store.getAgentActivation(JSON.parse(readFileSync(recordPath, "utf8")).activationVersion);',
        '  writeFileSync(recordPath + ".read", JSON.stringify(read));',
        '  console.log("read");',
        '}',
        'store.close();',
      ].join('\n'),
    );
    const writeRun = spawnSync(
      process.execPath,
      [workerScript, 'write', distEntry, dbPath, recordPath],
      options,
    );
    expect(writeRun.status).toBe(0);
    expect(writeRun.stdout?.trim()).toBe('written');
    // A FRESH process reads the durable record back.
    const readRun = spawnSync(
      process.execPath,
      [workerScript, 'read', distEntry, dbPath, recordPath],
      options,
    );
    expect(readRun.status).toBe(0);
    const readBack = JSON.parse(
      readFileSync(recordPath + '.read', 'utf8'),
    ) as AgentActivationRecord;
    expect(readBack).toEqual(record);
  });
});
