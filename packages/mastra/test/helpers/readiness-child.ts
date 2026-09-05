import { spawn, type ChildProcess } from 'node:child_process';

/**
 * Parent-side readiness barrier for real-subprocess crash fixtures (the
 * established Stage 03/05 pattern). The returned `ready` promise resolves
 * ONLY when the child emitted the exact readiness sentinel for the expected
 * stage — strictly after its durable checkpoint write — so the SIGKILL can
 * never precede the checkpoint. The timeoutMs option is a FAILURE GUARD for
 * "readiness was never reached" only; it is never part of a passing run's
 * coordination. Fixture infrastructure only.
 */

export interface ReadyChildResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export interface ReadyChild {
  child: ChildProcess;
  ready: Promise<void>;
  result: Promise<ReadyChildResult>;
}

export function spawnUntilReady(
  args: string[],
  expectedStage: string,
  options: { timeoutMs?: number; cwd?: string } = {},
): ReadyChild {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const cwd = options.cwd ?? process.cwd();

  const child = spawn(process.execPath, ['--import', 'tsx', ...args], {
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
          tail(stdout, 'stdout tail') +
          tail(stderr, 'stderr tail'),
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
      if (!readySettled && line === `vict-agent-ready:${expectedStage}`) {
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
          `fixture readiness for '${expectedStage}' was never reached: spawn failed (${error.message}).`,
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
          `fixture readiness for '${expectedStage}' was not observed: the child exited first ` +
            `status=${JSON.stringify(code)} signal=${JSON.stringify(signal)}` +
            tail(stdout, 'stdout tail'),
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
