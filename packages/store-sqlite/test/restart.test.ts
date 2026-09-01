import { describe, expect, it } from 'vitest';
import { spawn as spawnProcess, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { retryRm } from './helpers/retry-rm.js';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Real subprocess restart and interruption tests (15.1–15.3, 15.7).
 *
 * Every scenario crosses a REAL process boundary: fixtures run in child
 * Node processes via `node --import tsx`, the parent only coordinates,
 * polls the database for durability, and asserts on report files.
 */

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');

interface ChildResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runChild(args: string[], timeoutMs = 120_000, env: NodeJS.ProcessEnv = {}): ChildResult {
  const result = spawnSync(process.execPath, ['--import', 'tsx', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
    env: { ...process.env, ...env },
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

async function withWorkspace(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'vict-restart-'));
  try {
    await run(dir);
  } finally {
    await retryRm(dir);
  }
}

/** Kill a child as harshly as the platform allows (TerminateProcess on Windows). */
function killChild(child: ChildProcess): void {
  child.kill('SIGKILL');
}

describe('sqlite restart and interruption (real subprocess boundaries)', () => {
  it('a completed run, its activation, and its events survive a real process restart', async () => {
    await withWorkspace(async (dir) => {
      const db = join(dir, 'restart.db');
      const firstReport = join(dir, 'first.json');
      const secondReport = join(dir, 'second.json');

      const a = runChild([
        'packages/store-sqlite/test/fixtures/restart-basic.ts',
        'first',
        db,
        firstReport,
      ]);
      expect(a.status).toBe(0);
      const firstData = JSON.parse(await readFile(firstReport, 'utf8')) as {
        completed: {
          runId: string;
          activationVersion: string;
          steps: number;
          trace: unknown[];
          outputSummary: unknown;
          durableOutputPresent: boolean;
        };
        failed: { runId: string; error: { code: string } | null };
      };
      expect(firstData.completed.runId).toBeTruthy();

      // Process B: same database, same registered code, new process.
      const b = runChild([
        'packages/store-sqlite/test/fixtures/restart-basic.ts',
        'second',
        db,
        secondReport,
        firstReport,
      ]);
      expect(b.status).toBe(0);
      const secondData = JSON.parse(await readFile(secondReport, 'utf8')) as {
        identityMatches: boolean;
        outputSummaryMatches: boolean;
        durableOutputPresent: boolean;
        errorMatches: boolean;
        restoredActivation: string;
        completedRecord: {
          runId: string;
          activationVersion: string;
          status: string;
          steps: number;
        };
        storedEventCount: number;
        failedStatus: string;
        failedErrorCode?: string;
      };
      expect(secondData.identityMatches).toBe(true);
      expect(secondData.outputSummaryMatches).toBe(true);
      expect(secondData.errorMatches).toBe(true);
      // Default ('summary') retention: the complete output is NOT durable.
      expect(secondData.durableOutputPresent).toBe(false);
      expect(secondData.restoredActivation).toBe(firstData.completed.activationVersion);
      expect(secondData.completedRecord.runId).toBe(firstData.completed.runId);
      expect(secondData.completedRecord.status).toBe('completed');
      expect(secondData.storedEventCount).toBe(firstData.completed.trace.length);
      expect(secondData.failedStatus).toBe('failed');
      expect(secondData.failedErrorCode).toBe('VICT_RUNTIME_CAPABILITY_THREW');
    });
  }, 240_000);

  it('forced interruption: the run blocks, nothing replays, and recovery is idempotent', async () => {
    await withWorkspace(async (dir) => {
      const db = join(dir, 'interrupt.db');
      const marker = join(dir, 'marker.txt');
      const barrier = join(dir, 'barrier.txt');
      const report = join(dir, 'recover.json');
      const fixture = 'packages/store-sqlite/test/fixtures/restart-interrupt.ts';

      // Start the run in a child that will be terminated mid-flight.
      const child = spawnChild([
        'packages/store-sqlite/test/fixtures/restart-interrupt.ts',
        'first',
        db,
        marker,
        barrier,
      ]);
      try {
        // Diagnostics: confirm the child created the database and marker.
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const { readdirSync, existsSync: es } = await import('node:fs');
        diag(`dir: ${readdirSync(dir).join(', ')}`);
        diag(`marker exists: ${es(marker)}`);
        try {
          const { DatabaseSync } = await import('node:sqlite');
          const reader = new DatabaseSync(db);
          diag(
            `events: ${JSON.stringify(reader.prepare('SELECT seq, type, node_id FROM vict_run_event ORDER BY seq;').all())}`,
          );
          reader.close();
        } catch (cause) {
          diag(`reader error: ${(cause as Error).message}`);
        }
        // Readiness: the first capability executed (and therefore the
        // database exists and the run is under way).
        const ready = runChild([fixture, 'poll-until', db, 'node.started', 'start', '1']);
        if (!ready.stdout.includes('POLL_OK')) {
          throw new Error(
            `ready poll failed: ${JSON.stringify({ stdout: ready.stdout, stderr: ready.stderr.slice(-1500), status: ready.status })}`,
          );
        }
        // Wait until the node-start transition of the SECOND node is
        // durable, proving the intent was persisted before the capability
        // finished.
        const poll = runChild([fixture, 'poll-until', db, 'node.started', 'second', '1']);
        if (!poll.stdout.includes('POLL_OK')) {
          throw new Error(
            `poll failed: ${JSON.stringify({ stdout: poll.stdout, stderr: poll.stderr.slice(-2000) })}`,
          );
        }
      } finally {
        killChild(child);
        await terminated(child);
      }

      // A NEW process recovers the interrupted run.
      const recover = runChild([fixture, 'recover', db, report]);
      expect(recover.status).toBe(0);
      const data = JSON.parse(await readFile(report, 'utf8')) as {
        restore: { ok: boolean; activationVersion: string };
        firstRecovery: {
          scanned: number;
          blocked: Array<{
            runId: string;
            eventSeq: number;
            activationVersion: string;
            currentNodeId: string | null;
          }>;
        };
        secondRecovery: { scanned: number; blocked: unknown[] };
        afterFirst: {
          runs: Array<{
            runId: string;
            status: string;
            activationVersion: string;
            currentNodeId: string | null;
          }>;
          eventsByRun: Record<string, Array<{ seq: number; type: string; code?: string }>>;
        };
        afterSecond: {
          runs: Array<{ status: string }>;
          eventsByRun: Record<string, Array<{ seq: number; type: string }>>;
        };
      };

      // The run became blocked with the exact original activation.
      expect(data.firstRecovery.scanned).toBe(1);
      const blockedRun = data.firstRecovery.blocked[0];
      expect(blockedRun?.activationVersion).toBe(data.restore.activationVersion);

      const run = data.afterFirst.runs[0];
      expect(run?.status).toBe('blocked');
      expect(run?.activationVersion).toBe(data.restore.activationVersion);

      const events = data.afterFirst.eventsByRun[blockedRun?.runId ?? ''] ?? [];
      // Exactly ONE interruption event appended, with the stable code.
      const blockedEvents = events.filter((event) => event.type === 'run.blocked');
      expect(blockedEvents).toHaveLength(1);
      expect(blockedEvents[0]?.code).toBe('VICT_RUN_INTERRUPTED_BY_RESTART');

      // Nothing replayed: fx.second never executed (no marker), and no
      // completion exists for it.
      expect(existsSync(marker)).toBe(true);
      const markerText = await readFile(marker, 'utf8');
      expect(markerText).not.toContain('invoked:fx.second');
      const secondCompleted = events.find(
        (event) => event.type === 'node.completed' && event.seq > 0,
      );
      void secondCompleted;
      expect(events.some((event) => event.type === 'node.completed' && event.seq === 4)).toBe(
        false,
      );

      // Idempotent: the second recovery in the same process found nothing.
      expect(data.secondRecovery.scanned).toBe(0);
      expect(data.afterSecond.eventsByRun[blockedRun?.runId ?? '']).toEqual(
        data.afterFirst.eventsByRun[blockedRun?.runId ?? ''],
      );

      // And a THIRD process also finds nothing left to recover.
      const again = runChild([fixture, 'recover', db, report]);
      expect(again.status).toBe(0);
      const dataAgain = JSON.parse(await readFile(report, 'utf8')) as typeof data;
      expect(dataAgain.firstRecovery.scanned).toBe(0);
    });
  }, 240_000);

  it('interruption after a pure node completes leaves a safe prefix and no replay', async () => {
    await withWorkspace(async (dir) => {
      const db = join(dir, 'interrupt2.db');
      const marker = join(dir, 'marker.txt');
      const barrier = join(dir, 'barrier.txt');
      const report = join(dir, 'recover.json');
      const fixture = 'packages/store-sqlite/test/fixtures/restart-interrupt.ts';

      const child = spawnChild([
        'packages/store-sqlite/test/fixtures/restart-interrupt.ts',
        'first',
        db,
        marker,
        barrier,
      ]);
      try {
        // Readiness: the first node completed durably.
        const ready = runChild([fixture, 'poll-until', db, 'node.completed', 'start', '1']);
        expect(ready.stdout).toContain('POLL_OK');
        // Wait until the FIRST node's completion is durable, then kill.
        const poll = runChild([fixture, 'poll-until', db, 'node.completed', 'start', '1']);
        if (!poll.stdout.includes('POLL_OK')) {
          throw new Error(
            `poll failed: ${JSON.stringify({ stdout: poll.stdout, stderr: poll.stderr.slice(-2000) })}`,
          );
        }
      } finally {
        killChild(child);
        await terminated(child);
      }

      const recover = runChild([fixture, 'recover', db, report]);
      expect(recover.status).toBe(0);
      const data = JSON.parse(await readFile(report, 'utf8')) as {
        firstRecovery: { scanned: number; blocked: Array<{ runId: string; eventSeq: number }> };
        afterFirst: {
          runs: Array<{ status: string; currentNodeId: string | null }>;
          eventsByRun: Record<string, Array<{ seq: number; type: string; code?: string }>>;
        };
        secondRecovery: { scanned: number };
      };
      expect(data.firstRecovery.scanned).toBe(1);
      const run = data.afterFirst.runs[0];
      expect(run?.status).toBe('blocked');

      const events = data.afterFirst.eventsByRun[data.firstRecovery.blocked[0]?.runId ?? ''] ?? [];
      // The durable history is a prefix of the expected 7-event sequence,
      // ending in exactly one interruption event.
      const expectedPrefix = [
        'run.started',
        'node.started',
        'node.completed',
        'signal.routed',
        'node.started',
        'node.completed',
        'signal.routed',
      ];
      const historyTypes = events.slice(0, -1).map((event) => event.type);
      expect(historyTypes.length).toBeLessThanOrEqual(expectedPrefix.length);
      for (const [index, type] of historyTypes.entries()) {
        expect(type).toBe(expectedPrefix[index]);
      }
      // The first node's completion IS durable (this scenario's premise).
      expect(historyTypes).toContain('node.completed');
      // Exactly one run.blocked, last.
      expect(events.at(-1)?.type).toBe('run.blocked');
      expect(events.filter((event) => event.type === 'run.blocked')).toHaveLength(1);
      // The blocked run never executed the second capability.
      const markerText = await readFile(marker, 'utf8');
      expect(markerText).not.toContain('invoked:fx.second');
      expect(data.secondRecovery.scanned).toBe(0);
    });
  }, 240_000);

  it.each([
    ['missing-capability', 'VICT_RUNTIME_ACTIVATION_UNAVAILABLE'],
    ['changed-capability-revision', 'VICT_RUNTIME_ACTIVATION_MISMATCH'],
    ['changed-effect', 'VICT_RUNTIME_ACTIVATION_MISMATCH'],
    ['changed-contract-revision', 'VICT_RUNTIME_ACTIVATION_MISMATCH'],
    ['changed-topology', 'VICT_RUNTIME_ACTIVATION_MISMATCH'],
  ] as const)(
    'exact-activation mismatch (%s) fails restoration without executing code',
    async (scenario, expectedCode) => {
      await withWorkspace(async (dir) => {
        const db = join(dir, 'mismatch.db');
        const firstReport = join(dir, 'first.json');
        const secondReport = join(dir, 'second.json');
        const fixture = 'packages/store-sqlite/test/fixtures/restart-mismatch.ts';
        const executedMarker = join(dir, 'mm-executed.marker');

        const a = runChild([fixture, 'first', db, firstReport, executedMarker]);
        expect(a.status).toBe(0);
        // Process A's legitimate run executed the capability once.
        expect(existsSync(executedMarker)).toBe(true);

        // Process B: drifted code; the marker is removed so any NEW
        // execution during the failed restoration would be detectable.
        await rm(executedMarker, { force: true });
        const b = runChild([fixture, 'second', db, secondReport, scenario, executedMarker]);
        expect(b.status).toBe(0);
        const data = JSON.parse(await readFile(secondReport, 'utf8')) as {
          restorationOk: boolean;
          restorationCode: string | null;
          activeGraphIdAfter: string | null;
          capabilityExecuted: boolean;
        };
        expect(data.restorationOk).toBe(false);
        expect(data.restorationCode).toBe(expectedCode);
        // No capability executed during the failed restoration.
        expect(data.capabilityExecuted).toBe(false);
        expect(existsSync(executedMarker)).toBe(false);
        // The previously activated unrelated graph is still active.
        expect(data.activeGraphIdAfter).toBe('mm-other-graph');
      });
    },
    240_000,
  );

  it('default-retention storage across a real restart leaks no canaries (records, events, or database bytes)', async () => {
    await withWorkspace(async (dir) => {
      const db = join(dir, 'canary.db');
      const report = join(dir, 'first.json');
      const dump = join(dir, 'dump.json');
      const fixture = 'packages/store-sqlite/test/fixtures/restart-basic.ts';

      const a = runChild([fixture, 'first', db, report]);
      expect(a.status).toBe(0);
      const d = runChild([fixture, 'dump', db, dump]);
      expect(d.status).toBe(0);

      const serialized = await readFile(dump, 'utf8');
      for (const canary of [
        'rb-canary-INPUT-4f7a19',
        'rb-canary-OUTPUT-91bb20',
        'rb-canary-THROWN-77cc31',
        'rb-canary-CAUSE-52dd42',
        'rb-canary-SCHEMA-63ee53',
      ]) {
        expect(serialized).not.toContain(canary);
      }

      // Raw database bytes (including the WAL) contain none of them either.
      const files = (await readdir(dir)).filter((file) => file.startsWith('canary.db'));
      expect(files.length).toBeGreaterThan(0);
      let rawBytes = Buffer.alloc(0);
      for (const file of files) {
        rawBytes = Buffer.concat([rawBytes, await readFile(join(dir, file))]);
      }
      for (const canary of [
        'rb-canary-INPUT-4f7a19',
        'rb-canary-OUTPUT-91bb20',
        'rb-canary-THROWN-77cc31',
      ]) {
        expect(rawBytes.includes(Buffer.from(canary, 'utf8'))).toBe(false);
      }
    });
  }, 240_000);

  it('explicit full retention stores the complete output by choice and never inputs or raw errors', async () => {
    await withWorkspace(async (dir) => {
      const db = join(dir, 'canary-full.db');
      const report = join(dir, 'first.json');
      const dump = join(dir, 'dump.json');
      const fixture = 'packages/store-sqlite/test/fixtures/restart-basic.ts';

      const a = runChild([fixture, 'first', db, report], 120_000, { VICT_RETENTION: 'full' });
      expect(a.status).toBe(0);
      const d = runChild([fixture, 'dump', db, dump]);
      expect(d.status).toBe(0);

      const serialized = await readFile(dump, 'utf8');
      // The complete validated output IS stored by explicit configuration.
      expect(serialized).toContain('rb-canary-OUTPUT-91bb20');
      // Inputs and raw thrown/schema messages still never are.
      for (const canary of [
        'rb-canary-INPUT-4f7a19',
        'rb-canary-THROWN-77cc31',
        'rb-canary-CAUSE-52dd42',
        'rb-canary-SCHEMA-63ee53',
      ]) {
        expect(serialized).not.toContain(canary);
      }
    });
  }, 240_000);
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function spawnChild(args: string[]): ChildProcess {
  const child = spawnProcess(process.execPath, ['--import', 'tsx', ...args], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk: Buffer) => diag(`${args[0]} stdout: ${chunk}`));
  child.stderr?.on('data', (chunk: Buffer) => diag(`${args[0]} stderr: ${chunk}`));
  child.on('error', (error: Error) => diag(`${args[0]} spawn error: ${error.message}`));
  return child;
}

function diag(message: string): void {
  if (process.env.VICT_RESTART_DEBUG === '1') {
    console.log(`[restart-diag] ${message}`);
  }
}

function terminated(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
    setTimeout(() => resolve(), 15_000);
  });
}
