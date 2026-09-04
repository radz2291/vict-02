import { spawn, type ChildProcess } from 'node:child_process';
import { isReadyLine } from '../fixtures/readiness.js';

/**
 * Parent-side readiness barrier for real-subprocess crash fixtures.
 *
 * Replaces elapsed-time kill coordination (the old fixed 3000 ms
 * `spawnSync(..., { timeout, killSignal: 'SIGKILL' })` deadline) with an
 * explicit readiness observation: the returned `ready` promise resolves ONLY
 * when the child has emitted the exact readiness sentinel for the expected
 * stage — which the child does strictly after its durable checkpoint write.
 * The kill therefore can never precede the checkpoint.
 *
 * The `timeoutMs` option is a FAILURE GUARD for "readiness was never
 * reached" only: when it fires, the child is SIGKILLed and `ready` rejects
 * with a bounded, explicit fixture error. It is never part of a passing
 * run's coordination.
 *
 * Fixture infrastructure only — no production runtime source is involved.
 */

export interface ReadyChildResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export interface ReadyChild {
  child: ChildProcess;
  /** Resolves after the exact readiness sentinel was observed; rejects
   * (with a clear bounded fixture error) if the child exits first or the
   * failure-guard timeout elapses. */
  ready: Promise<void>;
  /** Resolves when the process exits (by any means). */
  result: Promise<ReadyChildResult>;
}

export function spawnUntilReady(
  args: string[],
  expectedStage: string,
  options: { timeoutMs?: number; cwd?: string } = {},
): ReadyChild {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const cwd = options.cwd ?? process.cwd();

  const child = spawn(process.execPath, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');

  let stdout = '';
  let stderr = '';
  let lineBuffer = '';
  let readySettled = false;

  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  let resolveResult!: (result: ReadyChildResult) => void;
  const result = new Promise<ReadyChildResult>((resolve) => {
    resolveResult = resolve;
  });

  // Bounded failure guard: fires ONLY when readiness was never reached.
  const guard = setTimeout(() => {
    if (readySettled) {
      return;
    }
    readySettled = true;
    child.kill('SIGKILL');
    rejectReady(
      new Error(
        `fixture readiness for '${expectedStage}' was NOT observed within ${timeoutMs} ms ` +
          `(bounded failure guard); the child was killed and must not be treated as ready.` +
          `${tail(stdout, 'stdout tail')}${tail(stderr, 'stderr tail')}`,
      ),
    );
  }, timeoutMs);

  child.stdout?.on('data', (chunk: string) => {
    stdout += chunk;
    lineBuffer += chunk;
    let newlineIndex = lineBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = lineBuffer.slice(0, newlineIndex).replace(/\r$/, '');
      lineBuffer = lineBuffer.slice(newlineIndex + 1);
      // ONLY the exact sentinel counts; malformed or wrong-stage lines are
      // ignored and never trigger or substitute for readiness.
      if (!readySettled && isReadyLine(line, expectedStage)) {
        readySettled = true;
        clearTimeout(guard);
        resolveReady();
      }
      newlineIndex = lineBuffer.indexOf('\n');
    }
  });
  child.stderr?.on('data', (chunk: string) => {
    stderr += chunk;
  });
  child.on('error', (error: Error) => {
    clearTimeout(guard);
    if (!readySettled) {
      readySettled = true;
      rejectReady(
        new Error(
          `fixture readiness for '${expectedStage}' was never reached: the child failed to ` +
            `spawn (${error.message}).`,
        ),
      );
    }
  });
  child.on('close', (code, signal) => {
    clearTimeout(guard);
    if (!readySettled) {
      readySettled = true;
      rejectReady(
        new Error(
          `fixture readiness for '${expectedStage}' was not observed: the child exited before ` +
            `emitting the exact readiness sentinel ` +
            ` status=${JSON.stringify(code)} signal=${JSON.stringify(signal)}` +
            `${tail(stdout, 'stdout tail')}`,
        ),
      );
    }
    resolveResult({ status: code, signal, stdout, stderr });
  });

  return { child, ready, result };
}

function tail(text: string, label: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return '';
  }
  const clipped = trimmed.length > 2000 ? `…${trimmed.slice(-2000)}` : trimmed;
  return ` [${label}] ${clipped}`;
}
