import { closeSync, fsyncSync, openSync, writeSync } from 'node:fs';

/**
 * Stage 06A fixture readiness barrier (the established Stage 03/05 pattern:
 * kills are gated on durable checkpoints, never on elapsed time).
 *
 *   1. parent starts the real child process;
 *   2. child boots, composes the adapter, reaches the intended stage;
 *   3. child durably writes its state file (fsync below);
 *   4. child emits the readiness sentinel on stdout — STRICTLY AFTER the
 *      durable write completed;
 *   5. parent waits for the sentinel;
 *   6. parent sends SIGKILL;
 *   7. recovery assertions run against the durable state.
 *
 * No elapsed-time value decides when the child dies. A bounded parent-side
 * timeout remains purely a failure guard for "readiness was never reached".
 * Fixture infrastructure only — no production runtime source is involved.
 */

export function durableWrite(statePath: string, state: unknown): void {
  const payload = JSON.stringify(state, null, 2);
  const handle = openSync(statePath, 'w');
  try {
    writeSync(handle, payload);
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
}

export function emitReady(stage: string): void {
  process.stdout.write(`vict-agent-ready:${stage}\n`);
}

export function isReadyLine(line: string, stage: string): boolean {
  return line === `vict-agent-ready:${stage}`;
}

/** Hang forever (used by SIGKILL fixtures after emitting their sentinel). */
export function hang(): never {
  return new Promise<never>(() => undefined) as never;
}
