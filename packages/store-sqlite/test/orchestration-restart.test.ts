import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';
import { spawnUntilReady } from './helpers/readiness-child.js';

/**
 * Cleanup after a SIGKILLed child: on Windows the killed process's
 * memory-mapped SQLite WAL can stay locked by the OS (AV/indexing) far
 * longer than after a normal close. Retry patiently before giving up; a
 * leaked temp file is reported but never masks the test outcome.
 */
async function cleanupAfterKill(dir: string): Promise<void> {
  for (let second = 0; second < 15; second++) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  // The worker's own lazy node:sqlite finalizers can hold the WAL mapping;
  // a separate process sees the file unlocked and removes it deterministically.
  spawnSync(
    process.execPath,
    ['-e', `require('node:fs').rmSync(${JSON.stringify(dir)}, { recursive: true, force: true });`],
    { timeout: 30_000 },
  );
}
import { DatabaseSync } from 'node:sqlite';

/**
 * Stage 03 real-process crash and restart fixtures (handoff §24.3–24.6).
 *
 * Every scenario crosses a REAL process boundary: a child process starts a
 * run and reaches a durable boundary (or is SIGKILLed mid-invocation), and
 * a fresh process reopens the same database, resolves the EXACT pinned
 * activation, and continues only the work that policy and identity make
 * safe — once at the VICT transition boundary.
 *
 * Kill coordination (Stage 03 fixture documentation, final
 * snapshot-correction pass): the three SIGKILL scenarios previously killed
 * the child at a FIXED elapsed deadline (`spawnSync(..., 3000,
 * { killSignal: 'SIGKILL' })`). Under parallel-suite load the child could
 * still be booting when the deadline elapsed, so it died before its durable
 * checkpoint existed and the parent's state read failed with ENOENT — the
 * LOW-05-B occurrence captured by the Stage 05 closure re-audit. The kill
 * decision is now an explicit readiness barrier: the child emits a stdout
 * sentinel strictly AFTER its fsynced checkpoint write, and the parent
 * kills only after observing it. A bounded parent-side timeout remains
 * purely as a failure guard for "readiness was never reached". The real
 * SIGKILL, real child process, real SQLite reopen, and exact recovery
 * semantics are unchanged; no production runtime source is involved.
 */

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const WORKER = 'packages/store-sqlite/test/fixtures/orchestration-worker.mts';

interface ChildResult {
  status: number | null;
  signal: string | null;
  stderr: string;
}

function runChild(
  args: string[],
  timeoutMs = 120_000,
  options: { killSignal?: NodeJS.Signals } = {},
): ChildResult {
  const result = spawnSync(process.execPath, ['--import', 'tsx', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
    ...(options.killSignal !== undefined ? { killSignal: options.killSignal } : {}),
  });
  return { status: result.status, signal: result.signal ?? null, stderr: result.stderr };
}

describe('orchestration restart and crash (real subprocess boundaries)', () => {
  it(
    'a signal wait survives a real process restart; one signal resumes once',
    { timeout: 90_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-restart-'));
      try {
        const db = join(dir, 'restart.db');
        const state = join(dir, 'state.json');
        const a = runChild([WORKER, 'start-wait', db, state]);
        expect(a.status).toBe(0);
        const stateData = JSON.parse(await readFile(state, 'utf8')) as {
          runId: string;
          activationVersion: string;
        };
        expect(stateData.runId).toBeTruthy();

        // Process B: reopen, resolve exact activation, one signal, resume.
        const b = runChild([WORKER, 'signal', db, state]);
        expect(b.status).toBe(0);

        // Durable facts: exactly one signal receipt and one resume transition.
        const dbFile = new DatabaseSync(db);
        try {
          const receipts = dbFile
            .prepare('SELECT COUNT(*) AS c FROM vict_signal_receipt WHERE signal_id = ?;')
            .get('restart-sig-1') as { c: number };
          expect(receipts.c).toBe(1);
          const resumes = dbFile
            .prepare("SELECT COUNT(*) AS c FROM vict_run_event WHERE type = 'run.resumed';")
            .get() as { c: number };
          expect(resumes.c).toBe(1);
        } finally {
          dbFile.close();
        }
      } finally {
        await cleanupAfterKill(dir);
      }
    },
  );

  it(
    'a timer that becomes due while the process is offline fires exactly once after restart',
    { timeout: 90_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-restart-timer-'));
      try {
        const db = join(dir, 'restart.db');
        const state = join(dir, 'state.json');
        const a = runChild([WORKER, 'start-timer', db, state]);
        expect(a.status).toBe(0);
        const b = runChild([WORKER, 'pump-timer', db, state]);
        expect(b.status).toBe(0);
        const db2 = new DatabaseSync(db);
        try {
          const fired = db2
            .prepare("SELECT COUNT(*) AS c FROM vict_run_event WHERE type = 'timer.fired';")
            .get() as { c: number };
          expect(fired.c).toBe(1);
          const resumed = db2
            .prepare("SELECT COUNT(*) AS c FROM vict_run_event WHERE type = 'run.resumed';")
            .get() as { c: number };
          expect(resumed.c).toBe(1);
        } finally {
          db2.close();
        }
      } finally {
        await cleanupAfterKill(dir);
      }
    },
  );

  it(
    'SIGKILL during a pure attempt: durable intent first, stale result fenced, one policy retry completes',
    { timeout: 90_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-crash-pure-'));
      try {
        const db = join(dir, 'crash.db');
        const state = join(dir, 'state.json');
        // Readiness barrier: the parent starts the real child and kills it
        // ONLY after the child durably wrote its checkpoint and emitted the
        // explicit readiness sentinel — never because an elapsed deadline
        // fired. The bounded timeout inside spawnUntilReady is a failure
        // guard for "readiness was never reached", not coordination.
        const child = spawnUntilReady(
          ['--import', 'tsx', WORKER, 'start-hang', db, state],
          'start-hang',
        );
        await child.ready;
        // Causal proof: the durable checkpoint exists BEFORE the kill.
        const stateData = JSON.parse(await readFile(state, 'utf8')) as {
          runId: string;
          hanging: boolean;
        };
        expect(stateData.hanging).toBe(true);
        // The real crash: parent-side SIGKILL mid-invocation.
        child.child.kill('SIGKILL');
        const killed = await child.result;
        expect(killed.signal).toBe('SIGKILL');
        await writeFile(state, JSON.stringify({ runId: stateData.runId }));

        // A fresh process recovers: pure recompute is policy-permitted.
        const b = runChild([WORKER, 'recover-pure', db, state]);
        expect(b.status).toBe(0);

        // Durable evidence: two attempts, one logical invocation, stable key.
        const dbFile = new DatabaseSync(db);
        try {
          const attempts = dbFile
            .prepare(
              'SELECT attempt_number, invocation_id FROM vict_attempt ORDER BY attempt_number;',
            )
            .all() as unknown as {
            attempt_number: number;
            invocation_id: string;
          }[];
          expect(attempts.length).toBe(2);
          expect(attempts[0]?.invocation_id === attempts[1]?.invocation_id).toBe(true);
          const started = dbFile
            .prepare("SELECT COUNT(*) AS c FROM vict_run_event WHERE type = 'node.started';")
            .get() as { c: number };
          expect(started.c).toBe(2);
        } finally {
          dbFile.close();
        }
      } finally {
        await cleanupAfterKill(dir);
      }
    },
  );

  it(
    'SIGKILL after the external keyed-write commit causes exactly one external mutation',
    { timeout: 90_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-crash-write-'));
      try {
        const db = join(dir, 'crash.db');
        const state = join(dir, 'state.json');
        // Readiness barrier: kill ONLY after the durable external ledger
        // entry exists and the readiness sentinel was observed.
        const child = spawnUntilReady(
          ['--import', 'tsx', WORKER, 'hang-write', db, state],
          'hang-write',
        );
        await child.ready;
        // Causal proof: the external mutation is durable BEFORE the kill.
        const earlyLedger = JSON.parse(await readFile(`${state}.ledger`, 'utf8')) as Record<
          string,
          { count: number; result: string }
        >;
        expect(Object.values(earlyLedger).filter((entry) => entry.count === 1).length).toBe(1);
        // The real crash: parent-side SIGKILL before the VICT completion commit.
        child.child.kill('SIGKILL');
        const killed = await child.result;
        expect(killed.signal).toBe('SIGKILL');

        // Fresh process: recover with the SAME key; the external ledger reconciles.
        const b = runChild([WORKER, 'recover-write', db, state]);
        expect(b.status).toBe(0);

        // Exactly one external mutation in the disposable ledger.
        const ledger = JSON.parse(await readFile(`${state}.ledger`, 'utf8')) as Record<
          string,
          { count: number; result: string }
        >;
        const mutations = Object.values(ledger).filter((entry) => entry.count === 1);
        expect(mutations.length).toBe(1);

        // VICT records one completed logical invocation with two attempts.
        const db2 = new DatabaseSync(db);
        try {
          const attempts = db2
            .prepare('SELECT attempt_number FROM vict_attempt ORDER BY attempt_number;')
            .all() as unknown as {
            attempt_number: number;
          }[];
          expect(attempts.length).toBe(2);
        } finally {
          db2.close();
        }
        // A killed child's SQLite lock clears after a settle on Windows; under
        // vitest the release can lag a few seconds behind standalone runs.
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } finally {
        await cleanupAfterKill(dir);
      }
    },
  );

  it(
    'partial fan-out SIGKILL: completed branches are not re-invoked; the join validates and completes once',
    { timeout: 120_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-join-partial-'));
      try {
        const db = join(dir, 'join.db');
        const state = join(dir, 'state.json');
        // Readiness barrier: kill ONLY after branchB's durable ledger bump
        // and state checkpoint exist and the readiness sentinel was seen.
        const child = spawnUntilReady(
          ['--import', 'tsx', WORKER, 'start-join-partial', db, state],
          'start-join-partial',
        );
        await child.ready;
        // Causal proof: the durable checkpoints exist BEFORE the kill.
        const stateData = JSON.parse(await readFile(state, 'utf8')) as {
          runId: string;
          hanging: boolean;
        };
        expect(stateData.hanging).toBe(true);
        expect(stateData.runId).toBeTruthy();
        // The real crash: parent-side SIGKILL mid-fan-out.
        child.child.kill('SIGKILL');
        const killed = await child.result;
        expect(killed.signal).toBe('SIGKILL');

        // Fresh process: only the interrupted safe work resumes.
        const b = runChild([WORKER, 'resume-join', db, state]);
        expect(b.status).toBe(0);
        const finalState = JSON.parse(await readFile(state, 'utf8')) as {
          status: string;
          joinCompleted: number;
          branchCompleted: number;
        };
        expect(finalState.status).toBe('completed');
        expect(finalState.joinCompleted).toBe(1);
        expect(finalState.branchCompleted).toBe(2);

        // The external ledger: branch 'a' was invoked exactly ONCE across
        // both processes (never re-run after the crash); branch 'b' twice
        // (one killed attempt + one recovered attempt of the same logical
        // invocation); the join contract parsed exactly once.
        const ledger = JSON.parse(await readFile(`${state}.ledger`, 'utf8')) as Record<
          string,
          number
        >;
        expect(ledger['branchA']).toBe(1);
        expect(ledger['branchB']).toBe(2);
        expect(ledger['joinParse']).toBe(1);
      } finally {
        await cleanupAfterKill(dir);
      }
    },
  );

  it(
    'a terminal join validates its contract and completes with the canonical output across close/reopen',
    { timeout: 120_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-join-terminal-'));
      try {
        const db = join(dir, 'terminal.db');
        const state = join(dir, 'state.json');
        // Process A: fork with a parked branch feeding a terminal join; exit.
        const a = runChild([WORKER, 'start-join-terminal', db, state]);
        expect(a.status).toBe(0);
        const stateData = JSON.parse(await readFile(state, 'utf8')) as {
          runId: string;
          waitId: string | null;
          activationVersion: string;
        };
        expect(stateData.runId).toBeTruthy();

        // Process B: reopen, signal, join validates + completes durably.
        const b = runChild([WORKER, 'signal-join-terminal', db, state]);
        expect(b.status).toBe(0);
        const finalState = JSON.parse(await readFile(state, 'utf8')) as {
          joinCompleted: number;
          output: string;
        };
        expect(finalState.joinCompleted).toBe(1);
        expect(finalState.output).toBe(JSON.stringify({ a: 'ALPHA', b: 'GO' }));

        // The join contract parsed exactly once across both processes.
        const ledger = JSON.parse(await readFile(`${state}.ledger`, 'utf8')) as Record<
          string,
          number
        >;
        expect(ledger['joinParse']).toBe(1);
        expect(ledger['branchA']).toBe(1);

        // Durable facts: exactly one join completion and one resume.
        const dbFile = new DatabaseSync(db);
        try {
          const joins = dbFile
            .prepare("SELECT COUNT(*) AS c FROM vict_run_event WHERE type = 'join.completed';")
            .get() as { c: number };
          expect(joins.c).toBe(1);
          const resumed = dbFile
            .prepare("SELECT COUNT(*) AS c FROM vict_run_event WHERE type = 'run.resumed';")
            .get() as { c: number };
          expect(resumed.c).toBe(1);
        } finally {
          dbFile.close();
        }
      } finally {
        await cleanupAfterKill(dir);
      }
    },
  );
});
