/**
 * Restart scenario 15.1 (real process boundary) + secret canaries.
 *
 * Usage (child process, under tsx):
 *   node --import tsx restart-basic.ts first  <db> <reportOut>
 *   node --import tsx restart-basic.ts second <db> <reportOut> <reportIn>
 *   node --import tsx restart-basic.ts dump   <db> <reportOut>
 *
 * `first`  publishes/selects an activation, completes a run (and a failing
 *          run with thrown canaries), closes the database, writes a report.
 * `second` reopens the same database in a NEW process, restores the exact
 *          activation from current registered code, reads the identical
 *          run/events, verifies equality with the first report, and writes
 *          its own report.
 * `dump`   prints every stored run and event (safe records only) plus the
 *          retention mode, for canary scanning by the parent test.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRuntime, toCanonicalJson } from '../../../runtime/src/index.js';
import { createSqliteStores } from '../../src/index.js';
import { defineZodContract } from '../../../contracts/src/zod/index.js';
import { z } from 'zod';

const Count = defineZodContract('rb.count', '1', z.object({ count: z.number() }));
// Output contract that KEEPS the nested field: under explicit full retention
// the complete validated output (canary included) is stored by choice.
const EchoOut = defineZodContract(
  'rb.echo-out',
  '1',
  z.object({ count: z.number(), nested: z.object({ secret: z.string() }) }),
);

// Distinct canaries injected through ordinary channels. None of these may
// appear in default-retention storage.
const CANARY_INPUT = 'rb-canary-INPUT-4f7a19';
const CANARY_OUTPUT_NESTED = 'rb-canary-OUTPUT-91bb20';
const CANARY_THROWN = 'rb-canary-THROWN-77cc31';
const CANARY_CAUSE = 'rb-canary-CAUSE-52dd42';
const CANARY_SCHEMA_MESSAGE = 'rb-canary-SCHEMA-63ee53';

const CountNonNegative = defineZodContract(
  'rb.count-nonneg',
  '1',
  z.object({
    count: z.number().refine((value) => value >= 0, {
      // Author-supplied message embedding a secret: never trusted, never copied.
      message: `Denied for value: ${CANARY_SCHEMA_MESSAGE}`,
    }),
  }),
  { description: 'a non-negative count' },
);

function buildRuntime(dbPath: string) {
  const retention = (process.env.VICT_RETENTION === 'full' ? 'full' : 'summary') as
    'summary' | 'full';
  const stores = createSqliteStores({ path: dbPath });
  const runtime = createRuntime({ stores, payloadRetention: retention });
  runtime.registerCapability({
    id: 'rb.echo',
    revision: '1',
    effect: 'pure',
    input: Count,
    output: EchoOut,
    invoke: (input) => ({ count: input.count, nested: { secret: CANARY_OUTPUT_NESTED } }),
  });
  runtime.registerCapability({
    id: 'rb.failing',
    revision: '1',
    effect: 'pure',
    input: Count,
    output: Count,
    invoke: (input) => {
      if (input.count < 0) {
        const cause = new Error(`${CANARY_CAUSE} deeper`);
        throw new Error(`${CANARY_THROWN} surface`, { cause });
      }
      return input;
    },
  });
  // Input contract whose custom schema message embeds a canary; the
  // framework-generated issue text replaces it.
  runtime.registerCapability({
    id: 'rb.guarded',
    revision: '1',
    effect: 'pure',
    input: CountNonNegative,
    output: Count,
    invoke: (input) => input,
  });
  return { runtime, stores };
}

const GRAPH = {
  id: 'rb-graph',
  entry: 'only',
  nodes: [{ id: 'only', capability: 'rb.echo' }],
  edges: [],
};

const FAIL_GRAPH = {
  id: 'rb-fail-graph',
  entry: 'only',
  nodes: [{ id: 'only', capability: 'rb.failing' }],
  edges: [],
};

const GUARD_GRAPH = {
  id: 'rb-guard-graph',
  entry: 'only',
  nodes: [{ id: 'only', capability: 'rb.guarded' }],
  edges: [],
};

async function first(dbPath: string, reportOut: string): Promise<void> {
  const { runtime, stores } = buildRuntime(dbPath);
  const activation = await runtime.activate(GRAPH);
  if (!activation.ok) {
    throw new Error(`first: activation failed: ${JSON.stringify(activation.issues)}`);
  }
  const completed = await runtime.run({ count: 3, note: CANARY_INPUT });
  if (completed.status !== 'completed') {
    throw new Error(`first: run did not complete: ${completed.status}`);
  }
  const failedActivation = await runtime.activate(FAIL_GRAPH);
  if (!failedActivation.ok) {
    throw new Error('first: fail-graph activation failed');
  }
  const failed = await runtime.run({ count: -5, note: CANARY_INPUT });
  if (failed.status !== 'failed') {
    throw new Error(`first: failure run unexpectedly ${failed.status}`);
  }
  // A schema-rejected run: the custom schema message embeds a canary.
  const guardedActivation = await runtime.activate(GUARD_GRAPH);
  if (!guardedActivation.ok) {
    throw new Error('first: guard-graph activation failed');
  }
  const guarded = await runtime.run({ count: -7, note: CANARY_INPUT });
  if (guarded.status !== 'failed') {
    throw new Error(`first: guard run unexpectedly ${guarded.status}`);
  }
  const completedRecord = await runtime.getRun(completed.runId);
  const failedRecord = await runtime.getRun(failed.runId);
  const completedSummaryEvent = completed.trace.find((event) => event.type === 'run.completed');
  const completedOutputSummary =
    completedSummaryEvent && 'output' in completedSummaryEvent
      ? (completedSummaryEvent as { output: unknown }).output
      : undefined;
  await stores.dispose();

  writeFileSync(
    reportOut,
    JSON.stringify(
      {
        completed: {
          runId: completed.runId,
          activationVersion: completed.activationVersion,
          graphVersion: completed.graphVersion,
          capabilitySetVersion: completed.capabilitySetVersion,
          steps: completedRecord?.steps ?? 0,
          trace: completed.trace.map((event) => ({ seq: event.seq, type: event.type })),
          outputSummary: completedOutputSummary,
          durableOutputPresent: 'output' in (completedRecord ?? {}),
        },
        failed: {
          runId: failed.runId,
          activationVersion: failed.activationVersion,
          error: failed.error,
          steps: failedRecord?.steps ?? 0,
          trace: failed.trace.map((event) => ({ seq: event.seq, type: event.type })),
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log('FIRST_OK');
}

async function second(dbPath: string, reportOut: string, reportIn: string): Promise<void> {
  const { runtime, stores } = buildRuntime(dbPath);
  const firstReport = JSON.parse(readFileSync(reportIn, 'utf8')) as {
    completed: {
      runId: string;
      activationVersion: string;
      graphVersion: string;
      capabilitySetVersion: string;
      steps: number;
      trace: Array<{ seq: number; type: string }>;
      outputSummary: unknown;
      durableOutputPresent: boolean;
    };
    failed: {
      runId: string;
      activationVersion: string;
      error: unknown;
      steps: number;
      trace: Array<{ seq: number; type: string }>;
    };
  };

  // Restore the completed run's activation exactly from current code.
  const restored = await runtime.restoreActivation(GRAPH, {
    activationVersion: firstReport.completed.activationVersion,
  });
  if (!restored.ok) {
    throw new Error(`second: restoration failed: ${restored.code} ${restored.message}`);
  }

  const record = await runtime.getRun(firstReport.completed.runId);
  if (!record) {
    throw new Error('second: completed run not found');
  }
  const events = record.trace;
  const identityMatches =
    record.activationVersion === firstReport.completed.activationVersion &&
    record.graphVersion === firstReport.completed.graphVersion &&
    record.capabilitySetVersion === firstReport.completed.capabilitySetVersion &&
    record.steps === firstReport.completed.steps &&
    events.map((event) => ({ seq: event.seq, type: event.type })).length ===
      firstReport.completed.trace.length &&
    events.every(
      (event, index) =>
        event.seq === firstReport.completed.trace[index]?.seq &&
        event.type === firstReport.completed.trace[index]?.type,
    );

  // The failed run and its sanitised error survive as well.
  const restoredFail = await runtime.restoreActivation(FAIL_GRAPH, {
    activationVersion: firstReport.failed.activationVersion,
  });
  if (!restoredFail.ok) {
    throw new Error(`second: fail-graph restoration failed: ${restoredFail.code}`);
  }
  const failedRecord = await runtime.getRun(firstReport.failed.runId);
  if (!failedRecord || failedRecord.status !== 'failed') {
    throw new Error('second: failed run not found or wrong status');
  }
  const errorMatches =
    toCanonicalJson(failedRecord.error ?? {}) === toCanonicalJson(firstReport.failed.error ?? {});

  // Re-reading through the durable store agrees with the in-memory trace.
  const storedEvents = await stores.execution.listEvents(firstReport.completed.runId);
  await stores.dispose();

  writeFileSync(
    reportOut,
    JSON.stringify(
      {
        identityMatches,
        outputSummaryMatches:
          toCanonicalJson(record.outputSummary ?? null) ===
          toCanonicalJson(firstReport.completed.outputSummary ?? null),
        durableOutputPresent: 'output' in record,
        errorMatches,
        restoredActivation: restored.activationVersion,
        storedEventCount: storedEvents.length,
        completedRecord: {
          runId: record.runId,
          activationVersion: record.activationVersion,
          graphVersion: record.graphVersion,
          capabilitySetVersion: record.capabilitySetVersion,
          steps: record.steps,
          trace: record.trace.map((event) => ({ seq: event.seq, type: event.type })),
          outputSummary: record.outputSummary,
          status: record.status,
        },
        failedStatus: failedRecord.status,
        failedErrorCode: failedRecord.error?.code,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log('SECOND_OK');
}

async function dump(dbPath: string, reportOut: string): Promise<void> {
  const stores = createSqliteStores({ path: dbPath });
  const runs = await stores.execution.listRuns();
  const dump: Array<Record<string, unknown>> = [];
  for (const run of runs) {
    const events = await stores.execution.listEvents(run.runId);
    dump.push({ run, events: events.map((event) => JSON.parse(event.payload) as unknown) });
  }
  await stores.dispose();
  writeFileSync(reportOut, JSON.stringify(dump, null, 2), 'utf8');
  console.log('DUMP_OK');
}

const [, , mode, dbPath, reportOut, reportIn] = process.argv;
const runners: Record<string, () => Promise<void>> = {
  first: () => first(dbPath as string, reportOut as string),
  second: () => second(dbPath as string, reportOut as string, reportIn as string),
  dump: () => dump(dbPath as string, reportOut as string),
};
const run = runners[mode ?? ''];
if (!run) {
  console.error(`unknown mode '${String(mode)}'`);
  process.exit(2);
}
run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
