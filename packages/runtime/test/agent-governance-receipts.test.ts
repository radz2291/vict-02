import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ConversationDeletionCoordinator,
  InMemoryAgentGovernanceStore,
  type AgentDeletionIntentRecord,
  type AgentGovernanceStore,
} from '../src/index.js';
import { createSqliteAgentGovernanceStore } from '@vict/store-sqlite';

/**
 * SHARED deletion-receipt conformance (boundary remediation, MSTR-011).
 *
 * ONE behavioral source executed against BOTH store adapters — the
 * in-memory store AND the durable SQLite store — so the adapters cannot
 * diverge on the receipt-enforced state machine:
 *
 * - entering `application-domain-deleted` REQUIRES the durable
 *   application-domain receipt;
 * - entering `completed` REQUIRES BOTH durable receipts;
 * - the receipt-free two-step bypass (`pending →
 *   application-domain-deleted → completed`) fails at the FIRST
 *   transition and leaves the stored state unchanged;
 * - the rejection is durable: after SQLite close/reopen the state is
 *   still unchanged and the bypass is still rejected;
 * - valid receipt-backed completion still succeeds, and coordinator
 *   recovery (crash between receipt and state advance) still completes
 *   idempotently.
 *
 * Cross-store atomicity is NOT claimed (and is impossible): each adapter
 * proves the check-and-update ATOMICITY of its own store only.
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

/** The shared conformance suite: identical behavior for every backend. */
function deletionReceiptConformance(
  name: string,
  makeStore: () => AgentGovernanceStore & { close?(): Promise<void> | void },
): void {
  describe(`deletion receipts at the store boundary — ${name}`, () => {
    it('rejects the two-step receipt-free bypass and leaves the state unchanged', async () => {
      const store = makeStore();
      try {
        await store.recordDeletionIntent({
          intentId: 'intent-bypass',
          conversationId: 'conv-bypass',
          actorId: 'actor-1',
          createdAt: 1,
          state: 'pending',
          receipts: [],
        });
        // Step 1 of the bypass: application-domain-deleted with ZERO
        // receipts — rejected.
        await expect(
          store.updateDeletionIntentState('intent-bypass', 'application-domain-deleted'),
        ).rejects.toThrow(/RECEIPT_REQUIRED/);
        // The stored state is UNCHANGED.
        expect((await store.getDeletionIntent('intent-bypass'))?.state).toBe('pending');
        expect((await store.getDeletionIntent('intent-bypass'))?.receipts).toEqual([]);
        // Even WITH a receipt recorded, entering `completed` from `pending`
        // remains a skip (stepwise invariant) and is rejected.
        await store.recordDeletionReceipt('intent-bypass', 'application-domain', 10);
        await expect(
          store.updateDeletionIntentState('intent-bypass', 'completed'),
        ).rejects.toThrow();
        // The stored state is STILL unchanged.
        expect((await store.getDeletionIntent('intent-bypass'))?.state).toBe('pending');
      } finally {
        await store.close?.();
      }
    });

    it('entering completed requires BOTH receipts; each missing receipt is rejected', async () => {
      const store = makeStore();
      try {
        await store.recordDeletionIntent({
          intentId: 'intent-both',
          conversationId: 'conv-both',
          actorId: 'actor-1',
          createdAt: 1,
          state: 'pending',
          receipts: [],
        });
        await store.recordDeletionReceipt('intent-both', 'application-domain', 10);
        await store.updateDeletionIntentState('intent-both', 'application-domain-deleted');
        // Only the domain receipt exists: completion is refused.
        await expect(store.updateDeletionIntentState('intent-both', 'completed')).rejects.toThrow(
          /RECEIPT_REQUIRED/,
        );
        expect((await store.getDeletionIntent('intent-both'))?.state).toBe(
          'application-domain-deleted',
        );
        // The memory receipt alone can never exist without the domain
        // receipt — and with both, completion succeeds.
        await store.recordDeletionReceipt('intent-both', 'memory-store', 20);
        await store.updateDeletionIntentState('intent-both', 'completed');
        expect((await store.getDeletionIntent('intent-both'))?.state).toBe('completed');
      } finally {
        await store.close?.();
      }
    });

    it('receipt-backed completion is idempotent and regressions stay rejected', async () => {
      const store = makeStore();
      try {
        await store.recordDeletionIntent({
          intentId: 'intent-idem',
          conversationId: 'conv-idem',
          actorId: 'actor-1',
          createdAt: 1,
          state: 'pending',
          receipts: [],
        });
        await store.recordDeletionReceipt('intent-idem', 'application-domain', 10);
        await store.recordDeletionReceipt('intent-idem', 'memory-store', 20);
        // Same-state updates are idempotent no-ops.
        await store.updateDeletionIntentState('intent-idem', 'pending');
        await store.updateDeletionIntentState('intent-idem', 'application-domain-deleted');
        await store.updateDeletionIntentState('intent-idem', 'application-domain-deleted');
        await store.updateDeletionIntentState('intent-idem', 'completed');
        await store.updateDeletionIntentState('intent-idem', 'completed');
        const record = await store.getDeletionIntent('intent-idem');
        expect(record?.state).toBe('completed');
        // Regressions stay rejected after completion.
        await expect(store.updateDeletionIntentState('intent-idem', 'pending')).rejects.toThrow();
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

deletionReceiptConformance('in-memory', () => new InMemoryAgentGovernanceStore());

describe('deletion receipts at the store boundary — sqlite (durable rejection)', () => {
  it('the receipt-free bypass stays rejected and unchanged after close/reopen', async () => {
    const dbPath = join(tempDir('vict-receipts-reopen-'), 'ops.db');
    const first = createSqliteAgentGovernanceStore({ path: dbPath });
    await first.recordDeletionIntent({
      intentId: 'intent-reopen',
      conversationId: 'conv-reopen',
      actorId: 'actor-1',
      createdAt: 1,
      state: 'pending',
      receipts: [],
    });
    await expect(
      first.updateDeletionIntentState('intent-reopen', 'application-domain-deleted'),
    ).rejects.toThrow(/RECEIPT_REQUIRED/);
    first.close();

    const second = createSqliteAgentGovernanceStore({ path: dbPath });
    try {
      const record = await second.getDeletionIntent('intent-reopen');
      expect(record?.state).toBe('pending');
      expect(record?.receipts).toEqual([]);
      // The bypass is STILL rejected on the reopened store.
      await expect(
        second.updateDeletionIntentState('intent-reopen', 'application-domain-deleted'),
      ).rejects.toThrow(/RECEIPT_REQUIRED/);
      await expect(
        second.updateDeletionIntentState('intent-reopen', 'completed'),
      ).rejects.toThrow();
      expect((await second.getDeletionIntent('intent-reopen'))?.state).toBe('pending');
    } finally {
      second.close();
    }
  });
});

describe('valid receipt-backed deletion and recovery still succeed on both adapters', () => {
  function coordinatorFlow(
    name: string,
    makeStore: () => AgentGovernanceStore & { close?(): Promise<void> | void },
  ): void {
    it(`coordinator deletion + crash recovery complete idempotently — ${name}`, async () => {
      const governance = makeStore();
      try {
        const deleted: string[] = [];
        const coordinator = new ConversationDeletionCoordinator({
          governance,
          domain: {
            deleteConversation: async (conversationId: string) => {
              deleted.push(`domain:${conversationId}`);
              return { deleted: true };
            },
          },
          memory: {
            deleteConversationThread: async (conversationId: string) => {
              deleted.push(`memory:${conversationId}`);
              return { deleted: true };
            },
          },
          clock: (() => {
            let tick = 0;
            return () => ++tick * 10;
          })(),
        });
        // Full governed deletion: both steps execute once, receipts recorded,
        // state advanced receipt-backed to completed.
        const outcome = await coordinator.deleteConversation({
          conversationId: 'conv-flow',
          actorId: 'actor-1',
        });
        expect(outcome.status).toBe('completed');
        expect(deleted).toEqual(['domain:conv-flow', 'memory:conv-flow']);
        const record = await governance.getDeletionIntent('vict-del-conv-flow');
        expect(record?.state).toBe('completed');
        expect(record?.receipts.map((receipt) => receipt.step)).toEqual([
          'application-domain',
          'memory-store',
        ]);
        // Re-deletion is a no-op (idempotent, no store touches).
        deleted.length = 0;
        const again = await coordinator.deleteConversation({
          conversationId: 'conv-flow',
          actorId: 'actor-1',
        });
        expect(again.status).toBe('completed');
        expect(deleted).toEqual([]);
        // Crash recovery with a SIMULATED partial deletion: a NEW intent is
        // driven to the domain receipt, then recovery completes the rest.
        await governance.recordDeletionIntent({
          intentId: 'vict-del-conv-partial',
          conversationId: 'conv-partial',
          actorId: 'actor-1',
          createdAt: 5,
          state: 'pending',
          receipts: [],
        });
        await governance.recordDeletionReceipt('vict-del-conv-partial', 'application-domain', 6);
        deleted.length = 0;
        const recovery = await coordinator.recoverPending();
        expect(recovery.completed).toBe(1);
        expect(deleted).toEqual(['memory:conv-partial']);
        const partial = await governance.getDeletionIntent('vict-del-conv-partial');
        expect(partial?.state).toBe('completed');
        // Idempotent recovery: nothing left open, no duplicate steps.
        const second = await coordinator.recoverPending();
        expect(second.resumed).toBe(0);
        expect(deleted).toEqual(['memory:conv-partial']);
      } finally {
        await governance.close?.();
      }
    });
  }
  coordinatorFlow('in-memory', () => new InMemoryAgentGovernanceStore());
  coordinatorFlow('sqlite', () =>
    createSqliteAgentGovernanceStore({ path: join(tempDir('vict-receipts-flow-'), 'ops.db') }),
  );
});

/** Type-level guard: receipts stay ordered and immutable on records. */
describe('deletion intent records keep their receipt ordering', () => {
  it('receipts are returned in governed order regardless of insertion', async () => {
    const store = new InMemoryAgentGovernanceStore();
    await store.recordDeletionIntent({
      intentId: 'i',
      conversationId: 'c',
      actorId: 'a',
      createdAt: 0,
      state: 'pending',
      receipts: [],
    });
    await store.recordDeletionReceipt('i', 'application-domain', 2);
    await store.recordDeletionReceipt('i', 'memory-store', 1);
    const record: AgentDeletionIntentRecord | undefined = await store.getDeletionIntent('i');
    expect(record?.receipts.map((receipt) => receipt.step)).toEqual([
      'application-domain',
      'memory-store',
    ]);
  });

  it('unknown receipt steps are rejected at the in-memory durable boundary (parity with the SQLite CHECK)', async () => {
    const store = new InMemoryAgentGovernanceStore();
    await store.recordDeletionIntent({
      intentId: 'i-domain',
      conversationId: 'c',
      actorId: 'a',
      createdAt: 0,
      state: 'pending',
      receipts: [],
    });
    // The former pre-verification literal is no longer in the governed
    // step domain, and neither is any arbitrary token.
    await expect(
      store.recordDeletionReceipt('i-domain', 'mastra-memory' as never, 1),
    ).rejects.toThrow(/VICT_AGENT_DELETION_RECEIPT_STEP_INVALID/);
    await expect(
      store.recordDeletionReceipt('i-domain', 'made-up-step' as never, 2),
    ).rejects.toThrow(/VICT_AGENT_DELETION_RECEIPT_STEP_INVALID/);
    // The rejections left the record untouched.
    const record: AgentDeletionIntentRecord | undefined = await store.getDeletionIntent('i-domain');
    expect(record?.receipts).toEqual([]);
  });
});
