import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { retryRm } from './helpers/retry-rm.js';
import { createSqliteAgentControlStores, createSqliteStores } from '@victframework/store-sqlite';
import { DatabaseSync } from 'node:sqlite';

/**
 * Open ONE shared database handle with the documented driver PRAGMAs
 * (applied by the driver on its own opens) and share it between the two
 * store families without transferring ownership of the handle.
 */
function openShared(path: string): { db: DatabaseSync; close(): void } {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA journal_mode = wal;');
  db.exec('PRAGMA synchronous = FULL;');
  return { db, close: (): void => undefined };
}
import { commandIdempotencyFenceToken, VictControlError } from '@victframework/runtime';
import {
  canonicalJson,
  canonicalSemanticForm,
  computeActivationVersion,
  computeCapabilitySetVersion,
  computeGraphVersion,
} from '@victframework/kernel';

/**
 * Stage 06B final reliability correction — durable (SQLite) restart and
 * fence suites:
 * - R2: the durable turn-execution tool slot is allocated BEFORE the
 *   invocation and is reused across a close/reopen restart (one identity);
 * - R3: the settlement fence token survives restarts; a STALE owner can
 *   neither settle nor release a claim that a takeover re-fenced;
 * - R4: the explicit absent-selection guard and the activation operation
 *   identity are durable across close/reopen.
 */

const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs) {
    void retryRm(dir);
  }
});

async function withPath(run: (path: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'vict-rel-'));
  tempDirs.push(dir);
  await run(join(dir, 'control.db'));
}

const LEASE_ACTOR = {
  actorId: 'actor-rel',
  command: 'changeset.commit',
  idempotencyKey: 'rel-key',
};

describe('R2: durable turn-execution tool slot across restart', () => {
  it('the same logical request reuses the SAME slot identity after close/reopen', async () => {
    await withPath(async (path) => {
      const first = createSqliteAgentControlStores({ path });
      try {
        const a = await first.invocations.allocateTurnToolSlot({
          turnId: 'turn-slot',
          toolName: 'cap.notes.write',
          argDigest: 'digest-A',
        });
        const b = await first.invocations.allocateTurnToolSlot({
          turnId: 'turn-slot',
          toolName: 'cap.notes.write',
          argDigest: 'digest-B',
        });
        expect(a.slot).toBe(1);
        expect(b.slot).toBe(2);
        expect(a.toolCallId).not.toBe(b.toolCallId);
        // Same logical request BEFORE the restart: same slot, no drift.
        const aAgain = await first.invocations.allocateTurnToolSlot({
          turnId: 'turn-slot',
          toolName: 'cap.notes.write',
          argDigest: 'digest-A',
        });
        expect(aAgain.toolCallId).toBe(a.toolCallId);
        expect(aAgain.slot).toBe(1);
      } finally {
        first.close();
      }
      // RESTART: a fresh process-equivalent adapter over the SAME file.
      const second = createSqliteAgentControlStores({ path });
      try {
        const aAfter = await second.invocations.allocateTurnToolSlot({
          turnId: 'turn-slot',
          toolName: 'cap.notes.write',
          argDigest: 'digest-A',
        });
        expect(aAfter.toolCallId).toBe('slot-1-' + aAfter.toolCallId.slice('slot-1-'.length));
        const c = await second.invocations.allocateTurnToolSlot({
          turnId: 'turn-slot',
          toolName: 'cap.notes.write',
          argDigest: 'digest-C',
        });
        // The next monotonic slot continues from the durable maximum —
        // never from a row count, never from a clock.
        expect(c.slot).toBe(3);
      } finally {
        second.close();
      }
    });
  });
});

describe('R3: settlement fences survive restarts and fence off stale owners', () => {
  it('a stale owner cannot settle or release after a takeover re-fenced the claim', async () => {
    await withPath(async (path) => {
      const first = createSqliteAgentControlStores({ path });
      const claimToken = commandIdempotencyFenceToken({
        ...LEASE_ACTOR,
        owner: 'svc-first',
        attempts: 1,
      });
      const claim = {
        ...LEASE_ACTOR,
        requestDigest: 'digest-rel',
        status: 'pending' as const,
        responseCode: undefined,
        resultJson: undefined,
        createdAt: 1000,
        settledAt: undefined,
        owner: 'svc-first',
        leaseUntil: 1050,
        attempts: 1,
        fenceToken: claimToken,
      };
      try {
        expect(await first.commandIdempotency.claimReceipt(claim)).toBe('claimed');
        // The stale (first) owner CANNOT settle its own claim with a wrong
        // token and the receipt stays byte-identical.
        await expect(
          first.commandIdempotency.completeReceipt({
            ...LEASE_ACTOR,
            resultJson: '{"stale":true}',
            at: 1001,
            fenceToken: 'vict-fence-stale',
          }),
        ).rejects.toThrow(VictControlError);
        const before = await first.commandIdempotency.getReceipt(LEASE_ACTOR);
        await expect(
          first.commandIdempotency.releaseReceipt({
            ...LEASE_ACTOR,
            at: 1001,
            fenceToken: 'vict-fence-stale',
          }),
        ).rejects.toThrow(VictControlError);
        const after = await first.commandIdempotency.getReceipt(LEASE_ACTOR);
        expect(JSON.stringify(after)).toBe(JSON.stringify(before));
      } finally {
        first.close();
      }
      // RESTART + takeover: the expired lease is taken with a NEW token.
      const second = createSqliteAgentControlStores({ path });
      try {
        const takeover = await second.commandIdempotency.takeOverExpiredLease({
          ...LEASE_ACTOR,
          owner: 'svc-second',
          leaseUntil: 1100,
          at: 1101,
        });
        expect(takeover.outcome).toBe('taken');
        if (takeover.outcome !== 'taken') throw new Error('unreachable');
        expect(takeover.fenceToken).not.toBe(claimToken);
        // The STALE owner's token cannot settle the re-fenced claim after
        // the restart either.
        await expect(
          second.commandIdempotency.completeReceipt({
            ...LEASE_ACTOR,
            resultJson: '{"stale":true}',
            at: 1102,
            fenceToken: claimToken,
          }),
        ).rejects.toThrow(VictControlError);
        // The current owner settles with the NEW token.
        await second.commandIdempotency.completeReceipt({
          ...LEASE_ACTOR,
          resultJson: '{"settled":true}',
          at: 1103,
          fenceToken: takeover.fenceToken,
        });
        const settled = await second.commandIdempotency.getReceipt(LEASE_ACTOR);
        expect(settled?.status).toBe('completed');
        expect(settled?.fenceToken).toBeUndefined();
      } finally {
        second.close();
      }
    });
  });
});

describe('R4: activation absence guard and operation identity are durable', () => {
  it('the explicit absent-selection guard and operationId survive close/reopen', async () => {
    await withPath(async (path) => {
      // One shared database handle drives BOTH store families (the
      // activation catalog lives in the orchestration store set).
      const shared = openShared(path);
      const db = shared.db;
      const first = createSqliteAgentControlStores({ database: db });
      const firstCatalog = createSqliteStores({ database: shared });
      const graph = {
        schema: 'vict.graph@1',
        id: 'graph-rel',
        entry: 'n1',
        nodes: [{ id: 'n1', capability: 'cap.rel', input: null, output: null }],
        edges: [],
      } as unknown as Parameters<typeof computeGraphVersion>[0];
      const bindings = [
        {
          capability: 'cap.rel',
          revision: '1',
          effect: 'pure' as const,
          input: null,
          output: null,
        },
      ];
      const graphVersion = computeGraphVersion(graph);
      const capabilitySetVersion = computeCapabilitySetVersion(bindings);
      const ACTIVATION = {
        manifestSchema: 'vict.activation-manifest@1' as const,
        graphId: 'graph-rel',
        graph: canonicalSemanticForm(graph),
        graphVersion,
        capabilitySetVersion,
        activationVersion: computeActivationVersion(graphVersion, capabilitySetVersion),
        bindings,
        contracts: [],
      };
      try {
        await firstCatalog.catalog.publish({
          manifest: ACTIVATION,
          canonicalManifest: canonicalJson(ACTIVATION),
        });
        expect(await firstCatalog.catalog.getSelection('graph-rel')).toBeUndefined();
        // EXPLICIT absence guard wins over an absent selection.
        const selection = await firstCatalog.catalog.select({
          graphId: 'graph-rel',
          activationVersion: ACTIVATION.activationVersion,
          expectedSelectionRevision: 'none',
          operationId: 'op-rel-1',
        });
        expect(selection.selectionRevision).toBe(1);
        expect(selection.operationId).toBe('op-rel-1');
      } finally {
        await firstCatalog.dispose();
        first.close();
        shared.db.close();
      }
      // RESTART: the selection (with its operation identity) is durable.
      const shared2 = openShared(path);
      const second = createSqliteAgentControlStores({ database: shared2.db });
      const secondCatalog = createSqliteStores({ database: shared2 });
      try {
        const restored = await secondCatalog.catalog.getSelection('graph-rel');
        expect(restored?.operationId).toBe('op-rel-1');
        expect(restored?.selectionRevision).toBe(1);
        // Re-application under the SAME operation identity returns the
        // ORIGINAL selection without adding a revision.
        const reapplied = await secondCatalog.catalog.select({
          graphId: 'graph-rel',
          activationVersion: ACTIVATION.activationVersion,
          operationId: 'op-rel-1',
        });
        expect(reapplied.selectionRevision).toBe(1);
        // The explicit absence guard now CONFLICTS (a selection exists).
        await expect(
          secondCatalog.catalog.select({
            graphId: 'graph-rel',
            activationVersion: ACTIVATION.activationVersion,
            expectedSelectionRevision: 'none',
          }),
        ).rejects.toThrow(/expected ABSENT selection does not match/);
      } finally {
        await secondCatalog.dispose();
        second.close();
        shared2.db.close();
      }
    });
  });
});
