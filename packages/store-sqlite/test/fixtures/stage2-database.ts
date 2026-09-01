import { writeFileSync } from 'node:fs';
// The package specifier (NOT a relative dist import): under tsx it resolves
// to the source in unbuilt checkouts (a relative '../../dist/index.js' hard
// dependency on a prior build broke `npm test` in fresh clones), and to the
// built artifact in published usage. Same adapter the suite tests.
import { createSqliteStores } from '@vict/store-sqlite';
import { toCanonicalJson } from '@vict/runtime';
import {
  computeGraphVersion,
  computeCapabilitySetVersion,
  computeActivationVersion,
} from '@vict/kernel';

/**
 * Produce a REAL Stage 02 database (schema v1 semantics) with the actual
 * Stage 02 adapter behavior: an activation, a completed run, a failed run,
 * and a blocked run, each with their ordered event batches.
 *
 * This fixture is a Stage 02 artifact generator: it pins the Stage 02
 * store semantics (no orchestration tables) so the Stage 03 forward
 * migration test can prove real data migrates without loss.
 */

const [dbPath = '', reportPath = ''] = process.argv.slice(2);

interface ContractLike {
  parse(input: unknown): { ok: boolean; value?: unknown; issues: unknown[] };
}

const stringContract: ContractLike = {
  parse: (input: unknown) =>
    typeof input === 'string'
      ? { ok: true, value: input, issues: [] }
      : { ok: false, issues: [{ code: 'TYPE', path: '$', message: 'expected a string' }] },
};

function kernelEvent(
  runId: string,
  seq: number,
  identity: Record<string, string>,
  type: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    seq,
    runId,
    graphId: 'stage2-fixture',
    graphVersion: 'v1_fixturegraphversion000000000000000000000000000',
    capabilitySetVersion: 'v1_fixturecapabilitysetversion000000000000000000',
    activationVersion: 'v1_fixtureactivationversion00000000000000000000',
    timestamp: 1_700_000_000_000,
    type,
    ...extra,
  };
}

async function main(): Promise<void> {
  const stores = createSqliteStores({ path: dbPath });

  // Publish an activation exactly the way Stage 02's catalog validates it:
  // every identity must recompute from the canonical content.
  const definition = {
    id: 'stage2-fixture',
    entry: 'a',
    nodes: [
      { id: 'a', capability: 'c.a' },
      { id: 'b', capability: 'c.b' },
    ],
    edges: [{ from: 'a', to: 'b' }],
  };
  const graphVersion = computeGraphVersion(definition);
  const capabilitySetVersion = computeCapabilitySetVersion([
    { capability: 'c.a', revision: '1', effect: 'pure', input: null, output: null },
    { capability: 'c.b', revision: '1', effect: 'pure', input: null, output: null },
  ]);
  const activationVersion = computeActivationVersion(graphVersion, capabilitySetVersion);
  const manifest = {
    manifestSchema: 'vict.activation-manifest@1',
    graphId: 'stage2-fixture',
    graph: {
      schema: 'vict.graph@1',
      id: 'stage2-fixture',
      entry: 'a',
      nodes: [
        { id: 'a', capability: 'c.a', input: null, output: null },
        { id: 'b', capability: 'c.b', input: null, output: null },
      ],
      edges: [{ from: 'a', to: 'b', kind: 'success' }],
    },
    graphVersion,
    capabilitySetVersion,
    activationVersion,
    bindings: [
      {
        capability: 'c.a',
        revision: '1',
        effect: 'pure',
        input: null,
        output: null,
      },
      {
        capability: 'c.b',
        revision: '1',
        effect: 'pure',
        input: null,
        output: null,
      },
    ],
    contracts: [],
  };
  const canonicalManifest = toCanonicalJson(manifest);
  await stores.catalog.publishAndSelect({
    publish: { manifest: manifest as never, canonicalManifest },
    select: { graphId: 'stage2-fixture' },
  });

  const createRun = async (
    runId: string,
    events: readonly Record<string, unknown>[],
  ): Promise<void> => {
    await stores.execution.createRun({
      runId,
      graphId: 'stage2-fixture',
      graphVersion,
      capabilitySetVersion,
      activationVersion,
      mode: 'normal',
      retention: 'summary',
      currentNodeId: 'a',
      events: events as never,
      timestamp: 1_700_000_000_000,
    });
  };

  const identity = {
    graphId: 'stage2-fixture',
    graphVersion,
    capabilitySetVersion,
    activationVersion,
  };

  // Completed run.
  const completedId = 'run_stage2_completed';
  const completedIdentity = { runId: completedId, ...identity };
  await createRun(completedId, [
    { ...completedIdentity, seq: 0, type: 'run.started', timestamp: 1_700_000_000_000 },
    {
      ...completedIdentity,
      seq: 1,
      type: 'node.started',
      nodeId: 'a',
      capabilityId: 'c.a',
      timestamp: 1_700_000_000_000,
    },
    {
      ...completedIdentity,
      seq: 2,
      type: 'node.completed',
      nodeId: 'a',
      capabilityId: 'c.a',
      durationMs: 1,
      invokedVia: 'real',
      output: { shape: 'string', length: 4 },
      timestamp: 1_700_000_000_000,
    },
    {
      ...completedIdentity,
      seq: 3,
      type: 'signal.routed',
      kind: 'success',
      fromNodeId: 'a',
      toNodeId: 'b',
      timestamp: 1_700_000_000_000,
    },
    {
      ...completedIdentity,
      seq: 4,
      type: 'node.started',
      nodeId: 'b',
      capabilityId: 'c.b',
      timestamp: 1_700_000_000_001,
    },
    {
      ...completedIdentity,
      seq: 5,
      type: 'node.completed',
      nodeId: 'b',
      capabilityId: 'c.b',
      durationMs: 1,
      invokedVia: 'real',
      output: { shape: 'string', length: 4 },
      timestamp: 1_700_000_000_001,
    },
    {
      ...completedIdentity,
      seq: 6,
      type: 'run.completed',
      steps: 2,
      output: { shape: 'string', length: 4 },
      timestamp: 1_700_000_000_001,
    },
  ]);
  await stores.execution.commitTransition({
    runId: completedId,
    expectedRecordRevision: 1,
    expectedNextEventSeq: 7,
    next: {
      status: 'completed',
      steps: 2,
      completedAt: 1_700_000_000_002,
      outputSummary: { shape: 'string', length: 4 },
    },
    events: [],
    timestamp: 1_700_000_000_002,
  });

  // Failed run.
  const failedId = 'run_stage2_failed';
  const failedIdentity = { runId: failedId, ...identity };
  await createRun(failedId, [
    { ...failedIdentity, seq: 0, type: 'run.started', timestamp: 1_700_000_000_000 },
    {
      ...failedIdentity,
      seq: 1,
      type: 'node.started',
      nodeId: 'a',
      capabilityId: 'c.a',
      timestamp: 1_700_000_000_000,
    },
    {
      ...failedIdentity,
      seq: 2,
      type: 'node.failed',
      nodeId: 'a',
      capabilityId: 'c.a',
      durationMs: 1,
      error: { code: 'VICT_KERNEL_CONTRACT_REJECTED', message: 'sanitized', retryable: false },
      timestamp: 1_700_000_000_001,
    },
    {
      ...failedIdentity,
      seq: 3,
      type: 'run.failed',
      steps: 1,
      error: { code: 'VICT_KERNEL_CONTRACT_REJECTED', message: 'sanitized', retryable: false },
      timestamp: 1_700_000_000_001,
    },
  ]);
  await stores.execution.commitTransition({
    runId: failedId,
    expectedRecordRevision: 1,
    expectedNextEventSeq: 4,
    next: {
      status: 'failed',
      completedAt: 1_700_000_000_002,
      error: {
        code: 'VICT_KERNEL_CONTRACT_REJECTED',
        message: 'sanitized',
        retryable: false,
      } as never,
    },
    events: [],
    timestamp: 1_700_000_000_002,
  });

  // Blocked run (Stage 02 interruption semantics).
  const blockedId = 'run_stage2_blocked';
  const blockedIdentity = { runId: blockedId, ...identity };
  await createRun(blockedId, [
    { ...blockedIdentity, seq: 0, type: 'run.started', timestamp: 1_700_000_000_000 },
    {
      ...blockedIdentity,
      seq: 1,
      type: 'node.started',
      nodeId: 'a',
      capabilityId: 'c.a',
      timestamp: 1_700_000_000_000,
    },
  ]);

  const report = {
    runs: 3,
    activations: 1,
    completedRunId: completedId,
    failedRunId: failedId,
    blockedRunId: blockedId,
  };
  writeFileSync(reportPath, JSON.stringify(report));
  await stores.dispose();
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('FIXTURE FAILED:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
