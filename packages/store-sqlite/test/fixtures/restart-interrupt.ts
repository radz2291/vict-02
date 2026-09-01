/**
 * Forced-interruption fixtures (15.2). Runs in a child process under tsx.
 *
 * Modes:
 *   first <db> <marker> <barrier> <pollTarget>
 *     Runs the two-node graph. fx.start completes quickly; fx.second writes
 *     its marker then blocks behind the barrier file forever. The parent
 *     polls the database for `pollTarget` durability (node.started:second |
 *     node.completed:start), kills this process, and never creates the
 *     barrier.
 *
 *   recover <db>
 *     A NEW process: registers the same code, restores the exact activation,
 *     calls recoverInterruptedRuns() twice (idempotence check), prints the
 *     durable run/events after each call.
 */
import { writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { buildRuntime, FX_GRAPH } from './shared.js';
import { createSqliteStores } from '../../src/index.js';

async function first(db: string, marker: string, barrier: string): Promise<void> {
  const { runtime, stores } = buildRuntime({ db, marker, barrier });
  const activation = await runtime.activate(FX_GRAPH);
  if (!activation.ok) {
    throw new Error(`interrupt first: activation failed: ${JSON.stringify(activation.issues)}`);
  }
  const result = await runtime.run({ count: 1 });
  // This line is only reached if the barrier file is created; the parent
  // kills the process first in interruption scenarios.
  await stores.dispose();
  writeFileSync(barrier, 'done\n', 'utf8');
  console.log(`FIRST_FINISHED status=${result.status}`);
  process.exit(0);
}

function durableCount(dbPath: string, type: string, nodeId: string | null): number {
  // Read-write on purpose: after a hard kill, WAL recovery requires write
  // access; a read-only connection would fail on the -wal file.
  const reader = new DatabaseSync(dbPath);
  try {
    const rows = reader
      .prepare(
        'SELECT COUNT(*) AS c FROM vict_run_event WHERE type = ? AND node_id IS NOT DISTINCT FROM ?;',
      )
      .all(type, nodeId) as unknown as { c: number }[];
    return rows[0]?.c ?? 0;
  } finally {
    reader.close();
  }
}

async function recover(db: string, reportOut: string): Promise<void> {
  const marker = '';
  const barrier = '';
  const { runtime, stores } = buildRuntime({ db, marker, barrier });
  const restore = await runtime.restoreActivation(FX_GRAPH);
  if (!restore.ok) {
    throw new Error(`recover: restoration failed: ${restore.code} ${restore.message}`);
  }
  const firstRecovery = await runtime.recoverInterruptedRuns();
  const afterFirst = await snapshot(db);
  const secondRecovery = await runtime.recoverInterruptedRuns();
  const afterSecond = await snapshot(db);
  await stores.dispose();
  writeFileSync(
    reportOut,
    JSON.stringify(
      {
        restore: { ok: restore.ok, activationVersion: restore.activationVersion },
        firstRecovery,
        secondRecovery,
        afterFirst,
        afterSecond,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log('RECOVER_OK');
}

interface Snapshot {
  runs: Array<Record<string, unknown>>;
  eventsByRun: Record<string, Array<{ seq: number; type: string; code?: string }>>;
}

async function snapshot(dbPath: string): Promise<Snapshot> {
  const stores = createSqliteStores({ path: dbPath });
  try {
    const runs = await stores.execution.listRuns();
    const eventsByRun: Snapshot['eventsByRun'] = {};
    for (const run of runs) {
      const events = await stores.execution.listEvents(run.runId);
      eventsByRun[run.runId] = events.map((event) => {
        const payload = JSON.parse(event.payload) as { code?: string };
        return { seq: event.seq, type: event.type, code: payload.code };
      });
    }
    return {
      runs: runs.map(
        (run: {
          runId: string;
          status: string;
          activationVersion: string;
          currentNodeId: string | null;
          steps: number;
          recordRevision: number;
        }) => ({
          runId: run.runId,
          status: run.status,
          activationVersion: run.activationVersion,
          currentNodeId: run.currentNodeId,
          steps: run.steps,
          recordRevision: run.recordRevision,
        }),
      ),
      eventsByRun,
    };
  } finally {
    await stores.dispose();
  }
}

const [, , mode, dbPath, arg2, arg3, arg4] = process.argv;

if (mode === 'first') {
  first(dbPath as string, arg2 as string, arg3 as string).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
} else if (mode === 'recover') {
  recover(dbPath as string, arg2 as string).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
} else if (mode === 'poll-until') {
  // Parent-side helper executed in a child for isolation: wait until the
  // given durable event condition holds, then exit 0.
  const type = arg2 as string;
  const nodeId = (arg3 as string) || null;
  const needed = Number(arg4 ?? '1');
  const deadline = Date.now() + 60_000;
  const tick = (): void => {
    try {
      if (durableCount(dbPath as string, type, nodeId) >= needed) {
        console.log('POLL_OK');
        process.exit(0);
      }
    } catch (cause) {
      // The database may not exist yet; keep retrying until the deadline.
      console.error('poll retry:', (cause as Error).message);
    }
    if (Date.now() > deadline) {
      console.error('POLL_TIMEOUT');
      process.exit(3);
    }
    setTimeout(tick, 25);
  };
  tick();
} else {
  console.error(`unknown mode '${String(mode)}'`);
  console.error('unknown mode');
  process.exit(2);
}
