import { describe, expect, it } from 'vitest';
import { retryRm } from './helpers/retry-rm.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteStores, openDatabase, inTransaction } from '@vict/store-sqlite';
import { toCanonicalJson } from '@vict/runtime';
import type { ActivationManifest, KernelEvent, StoredActivation } from '@vict/runtime';
import type { DisposableVictStores } from '@vict/runtime';

/**
 * Corruption and schema adversarial cases (15.6): malformed JSON,
 * internally inconsistent records, unsupported future schema, invalid
 * sequences, and dangling selection targets all fail closed and keep the
 * data inspectable where possible.
 */

const MANIFEST: ActivationManifest = {
  manifestSchema: 'vict.activation-manifest@1',
  graphId: 'corr-graph',
  graph: {
    schema: 'vict.graph@1',
    id: 'corr-graph',
    entry: 'n1',
    nodes: [{ id: 'n1', capability: 'cap.a', input: null, output: null }],
    edges: [],
  },
  graphVersion: 'v1_corr-graph',
  capabilitySetVersion: 'v1_corr-cap',
  activationVersion: 'v1_corr-act',
  bindings: [{ capability: 'cap.a', revision: '1', effect: 'pure', input: null, output: null }],
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
    graphId: MANIFEST.graphId,
    graphVersion: MANIFEST.graphVersion,
    capabilitySetVersion: MANIFEST.capabilitySetVersion,
    activationVersion: MANIFEST.activationVersion,
    timestamp: 1_000 + seq,
    type,
    ...extra,
  }) as KernelEvent;

async function withCorruptibleStores(
  run: (stores: DisposableVictStores, path: string, raw: () => DatabaseSync) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'vict-corr-'));
  const path = join(dir, 'corr.db');
  const stores = createSqliteStores({ path });
  await stores.catalog.publish({
    manifest: MANIFEST,
    canonicalManifest: toCanonicalJson(MANIFEST),
  });
  const handle = openDatabase({ path });
  try {
    await run(stores, path, () => handle.db);
  } finally {
    await stores.dispose();
    handle.close();
    await retryRm(dir);
  }
}

describe('sqlite corruption and schema adversarial cases', () => {
  it('malformed manifest JSON fails safely when read', async () => {
    await withCorruptibleStores(async (stores, _path, raw) => {
      inTransaction(raw(), () => {
        raw()
          .prepare(
            'UPDATE vict_activation SET canonical_manifest = ? WHERE activation_version = ?;',
          )
          .run('{not-json', MANIFEST.activationVersion);
      });
      let code: string | undefined;
      try {
        await stores.catalog.get(MANIFEST.activationVersion);
      } catch (cause) {
        code = (cause as { code?: string }).code;
      }
      expect(code).toBe('VICT_STORE_INVALID_RECORD');
      // The stored row is preserved for inspection.
      const row = raw().prepare('SELECT canonical_manifest FROM vict_activation;').get() as {
        canonical_manifest: string;
      };
      expect(row.canonical_manifest).toBe('{not-json');
    });
  });

  it('an activation row inconsistent with its manifest fails validation', async () => {
    await withCorruptibleStores(async (stores, _path, raw) => {
      inTransaction(raw(), () => {
        raw()
          .prepare('UPDATE vict_activation SET graph_version = ? WHERE activation_version = ?;')
          .run('v1_tampered', MANIFEST.activationVersion);
      });
      let code: string | undefined;
      try {
        await stores.catalog.get(MANIFEST.activationVersion);
      } catch (cause) {
        code = (cause as { code?: string }).code;
      }
      expect(code).toBe('VICT_STORE_INVALID_RECORD');
    });
  });

  it('an event payload that disagrees with its columns fails validation', async () => {
    await withCorruptibleStores(async (stores, _path, raw) => {
      await stores.execution.createRun({
        runId: 'corr-run',
        graphId: MANIFEST.graphId,
        graphVersion: MANIFEST.graphVersion,
        capabilitySetVersion: MANIFEST.capabilitySetVersion,
        activationVersion: MANIFEST.activationVersion,
        mode: 'normal',
        retention: 'summary',
        events: [RUN_EVENT('corr-run', 0, 'run.started')],
        timestamp: 1_000,
      });
      inTransaction(raw(), () => {
        raw()
          .prepare('UPDATE vict_run_event SET type = ? WHERE run_id = ? AND seq = 0;')
          .run('node.started', 'corr-run');
      });
      let code: string | undefined;
      try {
        await stores.execution.listEvents('corr-run');
      } catch (cause) {
        code = (cause as { code?: string }).code;
      }
      expect(code).toBe('VICT_STORE_INVALID_RECORD');
    });
  });

  it('a gapped event sequence fails validation on read', async () => {
    await withCorruptibleStores(async (stores, _path, raw) => {
      await stores.execution.createRun({
        runId: 'corr-run',
        graphId: MANIFEST.graphId,
        graphVersion: MANIFEST.graphVersion,
        capabilitySetVersion: MANIFEST.capabilitySetVersion,
        activationVersion: MANIFEST.activationVersion,
        mode: 'normal',
        retention: 'summary',
        events: [RUN_EVENT('corr-run', 0, 'run.started')],
        timestamp: 1_000,
      });
      // Corrupt: delete an interior event so the sequence has a gap.
      await stores.execution.commitTransition({
        runId: 'corr-run',
        expectedRecordRevision: 1,
        expectedNextEventSeq: 1,
        next: { currentNodeId: 'n1', steps: 1 },
        events: [RUN_EVENT('corr-run', 1, 'node.started', { nodeId: 'n1', capabilityId: 'cap.a' })],
        timestamp: 1_100,
      });
      await stores.execution.commitTransition({
        runId: 'corr-run',
        expectedRecordRevision: 2,
        expectedNextEventSeq: 2,
        next: { currentNodeId: 'n1', steps: 1 },
        events: [
          RUN_EVENT('corr-run', 2, 'node.completed', { nodeId: 'n1', capabilityId: 'cap.a' }),
        ],
        timestamp: 1_200,
      });
      inTransaction(raw(), () => {
        raw().prepare('DELETE FROM vict_run_event WHERE run_id = ? AND seq = 1;').run('corr-run');
      });
      let code: string | undefined;
      try {
        await stores.execution.listEvents('corr-run');
      } catch (cause) {
        code = (cause as { code?: string }).code;
      }
      expect(code).toBe('VICT_STORE_INVALID_RECORD');
    });
  });

  it('a selection row whose activation row is missing fails safely', async () => {
    await withCorruptibleStores(async (stores, _path, raw) => {
      await stores.catalog.select({
        graphId: MANIFEST.graphId,
        activationVersion: MANIFEST.activationVersion,
      });
      expect((await stores.catalog.getSelected(MANIFEST.graphId))?.activationVersion).toBe(
        MANIFEST.activationVersion,
      );
      // Corrupt: remove the activation row (foreign keys disabled for setup).
      raw().exec('PRAGMA foreign_keys = OFF;');
      inTransaction(raw(), () => {
        raw()
          .prepare('DELETE FROM vict_activation WHERE activation_version = ?;')
          .run(MANIFEST.activationVersion);
      });
      raw().exec('PRAGMA foreign_keys = ON;');
      const selected = await stores.catalog.getSelected(MANIFEST.graphId);
      expect(selected).toBeUndefined();
      // The dangling selection row remains inspectable.
      const selection = await stores.catalog.getSelection(MANIFEST.graphId);
      expect(selection?.activationVersion).toBe(MANIFEST.activationVersion);
    });
  });

  it('SQL text and bound values never appear in store error messages', async () => {
    await withCorruptibleStores(async (stores) => {
      let message = '';
      try {
        await stores.execution.createRun({
          runId: 'corr-run',
          graphId: MANIFEST.graphId,
          graphVersion: MANIFEST.graphVersion,
          capabilitySetVersion: MANIFEST.capabilitySetVersion,
          activationVersion: 'v1_missing-activation',
          mode: 'normal',
          retention: 'summary',
          events: [RUN_EVENT('corr-run', 0, 'run.started')],
          timestamp: 1_000,
        });
      } catch (cause) {
        message = (cause as Error).message;
      }
      expect(message).not.toMatch(/INSERT|SELECT|VALUES|vict_run/i);
    });
  });
});

/** Re-export for restart tests sharing fixture material. */
export const CORRUPTION_MANIFEST: StoredActivation = {
  activationVersion: MANIFEST.activationVersion,
  manifestSchema: MANIFEST.manifestSchema,
  graphId: MANIFEST.graphId,
  graphVersion: MANIFEST.graphVersion,
  capabilitySetVersion: MANIFEST.capabilitySetVersion,
  canonicalManifest: toCanonicalJson(MANIFEST),
  createdAt: 0,
};
