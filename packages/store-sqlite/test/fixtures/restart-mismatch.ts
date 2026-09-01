/**
 * Exact-activation mismatch fixtures (15.3). Child process under tsx.
 *
 * Modes:
 *   first <db> <reportOut>
 *     Register canonical code, activate, complete one run, close.
 *
 *   second <db> <reportOut> <scenario>
 *     scenario ∈ missing-capability | changed-capability-revision |
 *                changed-effect | changed-contract-revision |
 *                changed-topology
 *     Register the scenario's (deliberately drifted) code, activate an
 *     unrelated valid graph, then attempt exact restoration of the stored
 *     activation. Restoration must fail without executing anything and
 *     without replacing the active graph.
 */
import { writeFileSync, existsSync } from 'node:fs';
import { createRuntime } from '../../../runtime/src/index.js';
import type { RestorationResult } from '../../../runtime/src/index.js';
import { createSqliteStores } from '../../src/index.js';
import { defineZodContract } from '../../../contracts/src/zod/index.js';
import { z } from 'zod';

const Count = defineZodContract('mm.count', '1', z.object({ count: z.number() }));
const CountV2 = defineZodContract('mm.count', '2', z.object({ count: z.number().int() }));

let EXECUTED_MARKER_FILE = '';

function setMarkerFile(path: string): void {
  EXECUTED_MARKER_FILE = path;
}

function baseCapability(extra: Partial<{ revision: string; effect: 'pure' | 'write' }> = {}) {
  return {
    id: 'mm.cap',
    revision: extra.revision ?? '1',
    effect: extra.effect ?? ('pure' as const),
    input: Count,
    output: Count,
    invoke: (input: { count: number }) => {
      writeFileSync(EXECUTED_MARKER_FILE, 'executed', 'utf8');
      return { count: input.count + 1 };
    },
  };
}

const OTHER_CAPABILITY = {
  id: 'mm.other',
  revision: '1',
  effect: 'pure' as const,
  invoke: (input: unknown) => input,
};

const GRAPH = {
  id: 'mm-graph',
  entry: 'only',
  nodes: [{ id: 'only', capability: 'mm.cap' }],
  edges: [],
};

const OTHER_GRAPH = {
  id: 'mm-other-graph',
  entry: 'o',
  nodes: [{ id: 'o', capability: 'mm.other' }],
  edges: [],
};

const CHANGED_TOPOLOGY_GRAPH = {
  id: 'mm-graph',
  entry: 'only',
  nodes: [
    { id: 'only', capability: 'mm.cap' },
    { id: 'second', capability: 'mm.other' },
  ],
  edges: [{ from: 'only', to: 'second' }],
};

function build(dbPath: string) {
  const stores = createSqliteStores({ path: dbPath });
  return { stores, runtime: createRuntime({ stores }) };
}

async function first(dbPath: string, reportOut: string, markerPath: string): Promise<void> {
  setMarkerFile(markerPath);
  const { runtime, stores } = build(dbPath);
  runtime.registerCapability(baseCapability());
  const activation = await runtime.activate(GRAPH);
  if (!activation.ok) {
    throw new Error(`mismatch first: activation failed: ${JSON.stringify(activation.issues)}`);
  }
  const result = await runtime.run({ count: 1 });
  if (result.status !== 'completed') {
    throw new Error(`mismatch first: run ${result.status}`);
  }
  await stores.dispose();
  writeFileSync(
    reportOut,
    JSON.stringify({ activationVersion: activation.activationVersion, runId: result.runId }),
    'utf8',
  );
  console.log('FIRST_OK');
}

async function second(
  dbPath: string,
  reportOut: string,
  scenario: string,
  markerPath: string,
): Promise<void> {
  setMarkerFile(markerPath);
  const { runtime, stores } = build(dbPath);

  // Drifted code per scenario.
  switch (scenario) {
    case 'missing-capability': {
      // mm.cap is not registered at all; only the unrelated capability.
      runtime.registerCapability(OTHER_CAPABILITY);
      break;
    }
    case 'changed-capability-revision': {
      runtime.registerCapability(baseCapability({ revision: '2' }));
      runtime.registerCapability(OTHER_CAPABILITY);
      break;
    }
    case 'changed-effect': {
      // Effect class changed WITHOUT a revision bump: identity must still
      // detect the drift (effect classes feed capabilitySetVersion).
      runtime.registerCapability(baseCapability({ effect: 'write' }));
      runtime.registerCapability(OTHER_CAPABILITY);
      break;
    }
    case 'changed-contract-revision': {
      // Same capability id/revision but its input contract was republished
      // with a new revision (new registry context models the deliberate
      // contract change).
      const drifted = {
        id: 'mm.cap',
        revision: '1',
        effect: 'pure' as const,
        input: CountV2,
        output: CountV2,
        invoke: (input: { count: number }) => {
          writeFileSync(EXECUTED_MARKER_FILE, 'executed', 'utf8');
          return { count: input.count + 1 };
        },
      };
      runtime.registerCapability(drifted);
      runtime.registerCapability(OTHER_CAPABILITY);
      break;
    }
    case 'changed-topology': {
      runtime.registerCapability(baseCapability());
      runtime.registerCapability(OTHER_CAPABILITY);
      break;
    }
    default:
      throw new Error(`unknown scenario '${scenario}'`);
  }

  // Select an unrelated valid graph first: a failed restoration must leave
  // THIS graph active and runnable.
  const otherActivation = await runtime.activate(OTHER_GRAPH);
  if (!otherActivation.ok) {
    throw new Error(
      `mismatch second: other graph failed to activate: ${JSON.stringify(otherActivation.issues)}`,
    );
  }

  const definition = scenario === 'changed-topology' ? CHANGED_TOPOLOGY_GRAPH : GRAPH;
  const restoration: RestorationResult = await runtime.restoreActivation(definition);

  const activeAfter = runtime.activeGraph();
  await stores.dispose();

  const executed = existsSync(EXECUTED_MARKER_FILE);

  writeFileSync(
    reportOut,
    JSON.stringify(
      {
        scenario,
        restorationOk: restoration.ok,
        restorationCode: restoration.ok ? null : restoration.code,
        differences: restoration.ok ? [] : (restoration.differences ?? []),
        activeGraphIdAfter: activeAfter?.id ?? null,
        activeActivationVersionAfter: activeAfter?.activationVersion ?? null,
        capabilityExecuted: executed,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log('SECOND_OK');
}

const [, , mode, dbPath, arg2, arg3, arg4] = process.argv;
if (mode === 'first') {
  first(dbPath as string, arg2 as string, arg3 as string).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
} else if (mode === 'second') {
  second(dbPath as string, arg2 as string, arg3 as string, arg4 as string).catch(
    (error: unknown) => {
      console.error(error);
      process.exit(1);
    },
  );
} else {
  console.error(`unknown mode '${String(mode)}'`);
  process.exit(2);
}
