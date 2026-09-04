import { closeSync, fsyncSync, openSync, writeSync } from 'node:fs';

/**
 * Stage 03 fixture readiness barrier (final snapshot-correction hardening of
 * the documented LOW-05-B carry-forward).
 *
 * The crash fixtures used to coordinate the parent's SIGKILL with a FIXED
 * elapsed deadline (`spawnSync(..., 3000, { killSignal: 'SIGKILL' })`). Under
 * parallel-suite load the child could still be booting when the deadline
 * elapsed, so it was killed BEFORE its durable checkpoint existed and the
 * parent's state read failed with ENOENT — the occurrence captured in
 * full by the Stage 05 independent closure re-audit.
 *
 * Coordination is now an explicit readiness barrier:
 *
 *   1. parent starts the real child process;
 *   2. child boots, opens SQLite, activates the runtime and reaches the
 *      intended hanging branch;
 *   3. child durably writes its checkpoint/state (fsync below);
 *   4. child emits the readiness sentinel on stdout — STRICTLY AFTER the
 *      durable write completed;
 *   5. parent waits for the sentinel;
 *   6. parent sends SIGKILL;
 *   7. recovery assertions run against the durable state.
 *
 * No elapsed-time value decides when the child dies. A bounded wall-clock
 * timeout remains on the parent side purely as a failure guard for
 * "readiness was never reached"; it never triggers the kill in a passing run.
 * This is fixture infrastructure only: no production runtime source is
 * involved or modified.
 */

/** Exact readiness sentinel prefix. A stdout line counts ONLY when it equals
 * `${READY_SENTINEL_PREFIX} ${stage}` (modulo the trailing newline). Anything
 * else — prefixes, lookalikes, wrong stages, extra text — is ignored. */
export const READY_SENTINEL_PREFIX = '[vict-fixture-ready]';

/** Durable write: the data is flushed to the storage device (fsync) before
 * this returns, so a readiness signal emitted afterwards is causally after
 * an on-disk checkpoint. The fsync uses the write handle itself — on
 * Windows, fsyncing a separately opened read-only handle fails (EPERM). */
export function durableWrite(path: string, data: string): void {
  const fd = openSync(path, 'w');
  try {
    writeSync(fd, data);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Emit the readiness sentinel for `stage` on stdout (fd 1).
 *
 * The write is synchronous (no buffered loss on process.exit-style paths)
 * and retried on EAGAIN for non-blocking pipes. Callers MUST invoke this
 * only AFTER their durable checkpoint write has completed — that ordering
 * is the readiness contract. */
export function emitReady(stage: string): void {
  let line = `${READY_SENTINEL_PREFIX} ${stage}\n`;
  while (line.length > 0) {
    try {
      const written = writeSync(1, line);
      line = line.slice(written);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'EAGAIN') {
        continue;
      }
      throw error;
    }
  }
}

/** Whether one stdout line is the EXACT readiness sentinel for `stage`. */
export function isReadyLine(line: string, stage: string): boolean {
  return line === `${READY_SENTINEL_PREFIX} ${stage}`;
}
