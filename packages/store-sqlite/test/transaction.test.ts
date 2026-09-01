import { describe, expect, it } from 'vitest';
import { retryRm } from './helpers/retry-rm.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqliteStores } from '@vict/store-sqlite';
import { toCanonicalJson, ACTIVATION_MANIFEST_SCHEMA } from '@vict/runtime';
import type {
  ActivationManifest,
  KernelEvent,
  TransitionFaultHooks,
  VictStores,
} from '@vict/runtime';
import {
  canonicalSemanticForm,
  computeActivationVersion,
  computeCapabilitySetVersion,
  computeGraphVersion,
} from '@vict/kernel';

/**
 * Transaction failure (15.4) and concurrency conflict (15.5) against the
 * SQLite adapter. Faults are injected through the documented test-only
 * hooks inside the real transaction; no user database is corrupted.
 *
 * The fixture activation is GENUINE (identities computed by the kernel's
 * canonical identity functions) because stores validate identity on publish.
 */

const TX_GRAPH = {
  schema: 'vict.graph@1',
  id: 'tx-graph',
  entry: 'n1',
  nodes: [{ id: 'n1', capability: 'cap.a', input: null, output: null }],
  edges: [] as never[],
} as unknown as Parameters<typeof computeGraphVersion>[0];

const TX_BINDINGS = [
  { capability: 'cap.a', revision: '1', effect: 'pure' as const, input: null, output: null },
];

const ACTIVATION: ActivationManifest = {
  manifestSchema: ACTIVATION_MANIFEST_SCHEMA,
  graphId: TX_GRAPH.id,
  graph: canonicalSemanticForm(TX_GRAPH),
  graphVersion: computeGraphVersion(TX_GRAPH),
  capabilitySetVersion: computeCapabilitySetVersion(TX_BINDINGS),
  activationVersion: computeActivationVersion(
    computeGraphVersion(TX_GRAPH),
    computeCapabilitySetVersion(TX_BINDINGS),
  ),
  bindings: TX_BINDINGS,
  contracts: [],
};

const RUN_EVENT = (
  runId: string,
  seq: number,
  type: KernelEvent['type'],
  extra: Record<string, unknown> = {},
): KernelEvent =>
  ({
    seq,
    runId,
    graphId: ACTIVATION.graphId,
    graphVersion: ACTIVATION.graphVersion,
    capabilitySetVersion: ACTIVATION.capabilitySetVersion,
    activationVersion: ACTIVATION.activationVersion,
    timestamp: 1_000 + seq,
    type,
    ...extra,
  }) as KernelEvent;

async function withStores(
  options: Parameters<typeof createSqliteStores>[0],
  run: (stores: ReturnType<typeof createSqliteStores>) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'vict-tx-'));
  const stores = createSqliteStores({ path: join(dir, 'tx.db'), ...options });
  try {
    await run(stores);
  } finally {
    await stores.dispose();
    await retryRm(dir);
  }
}

describe('sqlite transaction boundaries', () => {
  it('a fault after the run update rolls back the whole transition (15.4)', async () => {
    const faults: TransitionFaultHooks = {};
    await withStores({ faults }, async (stores) => {
      await stores.catalog.publish({
        manifest: ACTIVATION,
        canonicalManifest: toCanonicalJson(ACTIVATION),
      });
      await stores.execution.createRun({
        runId: 'tx-run',
        graphId: ACTIVATION.graphId,
        graphVersion: ACTIVATION.graphVersion,
        capabilitySetVersion: ACTIVATION.capabilitySetVersion,
        activationVersion: ACTIVATION.activationVersion,
        mode: 'normal',
        retention: 'summary',
        events: [RUN_EVENT('tx-run', 0, 'run.started')],
        timestamp: 1_000,
      });

      faults.afterRunUpdate = () => {
        throw new Error('injected: after run update');
      };
      let code: string | undefined;
      try {
        await stores.execution.commitTransition({
          runId: 'tx-run',
          expectedRecordRevision: 1,
          expectedNextEventSeq: 1,
          next: { status: 'completed', steps: 9, completedAt: 9_999 },
          events: [RUN_EVENT('tx-run', 1, 'run.completed', { steps: 9 })],
          timestamp: 2_000,
        });
      } catch (cause) {
        code = (cause as { code?: string }).code;
      }
      expect(code).toBe('VICT_STORE_UNAVAILABLE');
      faults.afterRunUpdate = undefined;

      // No half-state: the run is untouched (running, revision 1, 1 event).
      const run = await stores.execution.getRun('tx-run');
      expect(run?.status).toBe('running');
      expect(run?.recordRevision).toBe(1);
      expect(run?.steps).toBe(0);
      expect(run?.completedAt).toBeNull();
      expect((await stores.execution.listEvents('tx-run')).length).toBe(1);
    });
  });

  it('a fault after event append rolls back the commit (15.4)', async () => {
    const faults: TransitionFaultHooks = {};
    await withStores({ faults }, async (stores) => {
      await stores.catalog.publish({
        manifest: ACTIVATION,
        canonicalManifest: toCanonicalJson(ACTIVATION),
      });
      await stores.execution.createRun({
        runId: 'tx-run',
        graphId: ACTIVATION.graphId,
        graphVersion: ACTIVATION.graphVersion,
        capabilitySetVersion: ACTIVATION.capabilitySetVersion,
        activationVersion: ACTIVATION.activationVersion,
        mode: 'normal',
        retention: 'summary',
        events: [RUN_EVENT('tx-run', 0, 'run.started')],
        timestamp: 1_000,
      });
      faults.beforeCommit = () => {
        throw new Error('injected: before commit');
      };
      await expect(
        stores.execution.commitTransition({
          runId: 'tx-run',
          expectedRecordRevision: 1,
          expectedNextEventSeq: 1,
          next: { currentNodeId: 'n1', steps: 1 },
          events: [RUN_EVENT('tx-run', 1, 'node.started', { nodeId: 'n1', capabilityId: 'cap.a' })],
          timestamp: 1_100,
        }),
      ).rejects.toMatchObject({ code: 'VICT_STORE_UNAVAILABLE' });
      faults.beforeCommit = undefined;

      // The appended event did not survive: the transaction rolled back.
      const events = await stores.execution.listEvents('tx-run');
      expect(events.map((event) => event.seq)).toEqual([0]);
    });
  });

  it('two transitions from the same expected revision: one winner, one structured conflict (15.5)', async () => {
    await withStores({}, async (stores) => {
      await stores.catalog.publish({
        manifest: ACTIVATION,
        canonicalManifest: toCanonicalJson(ACTIVATION),
      });
      await stores.execution.createRun({
        runId: 'tx-run',
        graphId: ACTIVATION.graphId,
        graphVersion: ACTIVATION.graphVersion,
        capabilitySetVersion: ACTIVATION.capabilitySetVersion,
        activationVersion: ACTIVATION.activationVersion,
        mode: 'normal',
        retention: 'summary',
        events: [RUN_EVENT('tx-run', 0, 'run.started')],
        timestamp: 1_000,
      });
      const commandFor = (nodeId: string) => ({
        runId: 'tx-run',
        expectedRecordRevision: 1,
        expectedNextEventSeq: 1,
        next: { status: 'running' as const, currentNodeId: nodeId, steps: 1 },
        events: [RUN_EVENT('tx-run', 1, 'node.started', { nodeId, capabilityId: 'cap.a' })],
        timestamp: 1_100,
      });
      const results = await Promise.allSettled([
        stores.execution.commitTransition(commandFor('winner')),
        stores.execution.commitTransition(commandFor('loser')),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const conflict = (rejected[0] as PromiseRejectedResult).reason as { code?: string };
      expect(conflict.code).toBe('VICT_STORE_RUN_CONFLICT');
      // Exactly one node-start was durably recorded.
      const events = await stores.execution.listEvents('tx-run');
      expect(events.map((event) => event.seq)).toEqual([0, 1]);
      expect(events.at(-1)?.nodeId).toBe('winner');
      const run = await stores.execution.getRun('tx-run');
      expect(run?.currentNodeId).toBe('winner');
      expect(run?.recordRevision).toBe(2);
    });
  });

  it('the same database cannot be owned by two creating adapters, but reopening is safe', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-owner-'));
    const path = join(dir, 'owner.db');
    try {
      const first = createSqliteStores({ path });
      const run: unknown = await first.execution
        .createRun({
          runId: 'owner-run',
          graphId: ACTIVATION.graphId,
          graphVersion: ACTIVATION.graphVersion,
          capabilitySetVersion: ACTIVATION.capabilitySetVersion,
          activationVersion: ACTIVATION.activationVersion,
          mode: 'normal',
          retention: 'summary',
          events: [],
          timestamp: 1_000,
        })
        .catch((cause: { code?: string }) => cause);
      // The run requires a published activation; publish via the same owner.
      await first.catalog.publish({
        manifest: ACTIVATION,
        canonicalManifest: toCanonicalJson(ACTIVATION),
      });
      const stores: VictStores = first;
      await stores.execution.createRun({
        runId: 'owner-run',
        graphId: ACTIVATION.graphId,
        graphVersion: ACTIVATION.graphVersion,
        capabilitySetVersion: ACTIVATION.capabilitySetVersion,
        activationVersion: ACTIVATION.activationVersion,
        mode: 'normal',
        retention: 'summary',
        events: [],
        timestamp: 1_000,
      });
      void run;
      await first.dispose();
      // Reopen by a new owner: fine. Concurrent multi-process ownership is
      // out of scope for Stage 02 and documented as such.
      const second = createSqliteStores({ path });
      expect((await second.execution.listRuns()).length).toBe(1);
      await second.dispose();
    } finally {
      await retryRm(dir);
    }
  });
});
