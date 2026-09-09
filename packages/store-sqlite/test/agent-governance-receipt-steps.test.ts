import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  DELETION_RECEIPT_STEP_INVALID_MESSAGE,
  InMemoryAgentGovernanceStore,
  type AgentGovernanceStore,
} from '@victframework/runtime';
import { createSqliteAgentGovernanceStore } from '../src/index.js';

/**
 * LOW-06A-1 correction conformance — the SQLite governance adapter must
 * reject invalid or legacy receipt steps at its API boundary with the
 * SAME stable, non-echoing structured error as the in-memory adapter,
 * BEFORE any SQL mutation:
 *
 * - invalid input causes no database change (verified by byte-identical
 *   full database dumps across the rejection);
 * - behavior is identical after close/reopen;
 * - duplicate VALID receipts remain idempotent;
 * - concurrent duplicate valid receipts remain safe;
 * - plain-JavaScript callers (no TypeScript types) receive the same
 *   rejection for the same invalid input on BOTH adapters.
 */

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

/** Record a valid intent through the typed public surface. */
async function seedIntent(store: AgentGovernanceStore, intentId: string): Promise<void> {
  await store.recordDeletionIntent({
    intentId,
    conversationId: `conv-${intentId}`,
    actorId: 'actor-1',
    createdAt: 0,
    state: 'pending',
    receipts: [],
  });
}

/** Full raw database dump (table → rows) for byte-level change detection. */
function dumpDatabase(path: string): string {
  const db = new DatabaseSync(path);
  try {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;",
      )
      .all() as unknown as { name: string }[];
    const parts: string[] = [];
    for (const table of tables) {
      const rows = db.prepare(`SELECT * FROM ${table.name} ORDER BY 1, 2 ASC;`).all();
      parts.push(`${table.name}: ${JSON.stringify(rows)}`);
    }
    return parts.join('\n');
  } finally {
    db.close();
  }
}

/** The shared suite executed against BOTH adapters. */
function receiptStepConformance(
  name: string,
  makeStore: () => AgentGovernanceStore & { close?(): Promise<void> | void },
): void {
  describe(`deletion receipt-step domain at the API boundary — ${name}`, () => {
    it('rejects the legacy and arbitrary steps with the exact shared stable error, before any mutation', async () => {
      const store = makeStore();
      try {
        await seedIntent(store, 'intent-steps');
        // Plain-JavaScript invalid inputs (no TypeScript type system in the
        // way): the legacy pre-verification literal and arbitrary tokens.
        const invalidSteps: unknown[] = ['mastra-memory', 'made-up-step', '', 42, null, {}];
        for (const step of invalidSteps) {
          await expect(
            store.recordDeletionReceipt('intent-steps', step as never, 1),
          ).rejects.toThrow(DELETION_RECEIPT_STEP_INVALID_MESSAGE);
        }
        // The rejection left the record untouched.
        const record = await store.getDeletionIntent('intent-steps');
        expect(record?.receipts).toEqual([]);
      } finally {
        await store.close?.();
      }
    });

    it('fabricated receipts on a new intent are rejected and nothing is persisted', async () => {
      const store = makeStore();
      try {
        // New intents must be recorded with NO receipts (shared durable
        // rule): the fabricated receipt is rejected and nothing persists.
        await expect(
          store.recordDeletionIntent({
            intentId: 'intent-fabricated',
            conversationId: 'conv-fabricated',
            actorId: 'actor-1',
            createdAt: 0,
            state: 'pending',
            receipts: [{ step: 'application-domain' as never, at: 1 }],
          }),
        ).rejects.toThrow(/no receipts|must be recorded as pending/);
        const record = await store.getDeletionIntent('intent-fabricated');
        expect(record).toBeUndefined();
      } finally {
        await store.close?.();
      }
    });

    it('duplicate valid receipts remain idempotent and out-of-order memory receipts are rejected', async () => {
      const store = makeStore();
      try {
        await seedIntent(store, 'intent-idem');
        // The memory step requires the application-domain receipt first.
        await expect(store.recordDeletionReceipt('intent-idem', 'memory-store', 2)).rejects.toThrow(
          /VICT_AGENT_DELETION_RECEIPT_ORDER/,
        );
        await store.recordDeletionReceipt('intent-idem', 'application-domain', 1);
        await store.recordDeletionReceipt('intent-idem', 'application-domain', 1);
        await store.recordDeletionReceipt('intent-idem', 'memory-store', 2);
        await store.recordDeletionReceipt('intent-idem', 'memory-store', 2);
        const record = await store.getDeletionIntent('intent-idem');
        expect(record?.receipts.map((receipt) => receipt.step)).toEqual([
          'application-domain',
          'memory-store',
        ]);
      } finally {
        await store.close?.();
      }
    });
  });
}

receiptStepConformance('in-memory', () => new InMemoryAgentGovernanceStore());

describe('SQLite deletion receipt-step boundary (LOW-06A-1)', () => {
  receiptStepConformance('sqlite', () => createSqliteAgentGovernanceStore({ path: ':memory:' }));

  it('invalid steps cause NO database change (full-dump equality) and behavior is identical after close/reopen', async () => {
    const path = join(tempDir('vict-receipt-steps-'), 'ops.db');
    const before = createSqliteAgentGovernanceStore({ path });
    await seedIntent(before, 'intent-dump');
    await before.recordDeletionReceipt('intent-dump', 'application-domain', 1);
    const dumpBefore = dumpDatabase(path);
    for (const step of ['mastra-memory', 'made-up-step']) {
      await expect(before.recordDeletionReceipt('intent-dump', step as never, 2)).rejects.toThrow(
        DELETION_RECEIPT_STEP_INVALID_MESSAGE,
      );
    }
    const dumpAfter = dumpDatabase(path);
    expect(dumpAfter).toBe(dumpBefore);
    before.close();

    // Reopen: the invalid steps are still rejected, the valid receipt is
    // still durable, and the record is unchanged.
    const reopened = createSqliteAgentGovernanceStore({ path });
    try {
      await expect(
        reopened.recordDeletionReceipt('intent-dump', 'mastra-memory' as never, 3),
      ).rejects.toThrow(DELETION_RECEIPT_STEP_INVALID_MESSAGE);
      const record = await reopened.getDeletionIntent('intent-dump');
      expect(record?.receipts.map((receipt) => receipt.step)).toEqual(['application-domain']);
      expect(dumpDatabase(path)).toBe(dumpAfter);
    } finally {
      reopened.close();
    }
  });

  it('concurrent duplicate valid receipts remain safe (exactly one durable receipt)', async () => {
    const path = join(tempDir('vict-receipt-steps-conc-'), 'ops.db');
    const store = createSqliteAgentGovernanceStore({ path });
    try {
      await seedIntent(store, 'intent-concurrent');
      await Promise.all([
        store.recordDeletionReceipt('intent-concurrent', 'application-domain', 1),
        store.recordDeletionReceipt('intent-concurrent', 'application-domain', 1),
        store.recordDeletionReceipt('intent-concurrent', 'application-domain', 1),
      ]);
      const record = await store.getDeletionIntent('intent-concurrent');
      expect(record?.receipts).toHaveLength(1);
      expect(record?.receipts[0]?.step).toBe('application-domain');
    } finally {
      store.close();
    }
  });
});
