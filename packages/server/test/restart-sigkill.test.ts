import { afterAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Stage 06B — REAL child-process SIGKILL fixtures (§11).
 *
 * A real Node worker composes the full shipped stack (SQLite durable
 * control stores + control services + the versioned HTTP command surface)
 * and is SIGKILLed by the parent at material cross-store boundaries:
 *
 * 1. crash while a protected tool approval is PENDING (after the durable
 *    intent + pending approval, before any decision);
 * 2. crash AFTER the VICT approval but BEFORE the protected effect
 *    (before Mastra resume);
 * 3. retry/restart of the SAME logical invocation (deterministic
 *    idempotency key) must not duplicate the effect;
 * 4. durable turn cancellation across restart;
 * 5. durable stream milestones replay over real HTTP from a fresh
 *    process.
 *
 * Readiness is observed via sentinel files — never sleeps-for-correctness.
 */

const workerPath = fileURLToPath(new URL('./fixtures/sigkill-worker.mjs', import.meta.url));

const dirs: string[] = [];
const children: ChildProcess[] = [];

afterAll(() => {
  for (const child of children) {
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGKILL');
    }
  }
  for (const dir of dirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows file-lock teardown is best-effort in fixtures.
    }
  }
});

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vict-sigkill-'));
  dirs.push(dir);
  return dir;
}

interface WorkerHandle {
  child: ChildProcess;
  port: number;
  sentinel: string;
  extra: string[];
}

/** Spawn the worker and wait for the READY sentinel (with timeout). */
async function spawnWorker(
  mode: string,
  dir: string,
  extraArgs: string[] = [],
): Promise<WorkerHandle> {
  const sentinel = join(dir, `ready-${mode}-${process.pid}.txt`);
  const child = spawn(process.execPath, [
    workerPath,
    '--mode',
    mode,
    '--db',
    join(dir, 'control.db'),
    '--ready-file',
    sentinel,
    '--effects',
    join(dir, 'effects.log'),
    ...extraArgs,
  ]);
  children.push(child);
  const lines: string[] = [];
  child.stdout?.on('data', (chunk: Buffer) => {
    lines.push(chunk.toString());
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    lines.push(chunk.toString());
  });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (existsSync(sentinel)) {
      const content = readFileSync(sentinel, 'utf8');
      const ready = content.split('\n').find((line) => line.startsWith('READY '));
      if (ready !== undefined) {
        return {
          child,
          port: Number(ready.split(' ')[1]),
          sentinel,
          extra: content.split('\n').filter((line) => !line.startsWith('READY ')),
        };
      }
    }
    if (child.exitCode !== null) {
      throw new Error(`worker ${mode} exited early (${child.exitCode}): ${lines.join('')}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`worker ${mode} never became ready: ${lines.join('')}`);
}

function sigkill(child: ChildProcess): void {
  child.kill('SIGKILL');
}

interface BearerResponse {
  status: number;
  body: Record<string, unknown>;
}

async function post(
  port: number,
  path: string,
  payload: Record<string, unknown>,
  token: string,
  idempotencyKey?: string,
): Promise<BearerResponse> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(idempotencyKey !== undefined ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ payload }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

/** Run one worker phase to completion (no sentinel) and capture stdout. */
async function runPhase(mode: string, dir: string): Promise<string> {
  const child = spawn(process.execPath, [
    workerPath,
    '--mode',
    mode,
    '--db',
    join(dir, 'control.db'),
    '--ready-file',
    join(dir, `unused-${mode}.txt`),
    '--effects',
    join(dir, 'effects.log'),
  ]);
  children.push(child);
  let stdout = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  let stderr = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && child.exitCode === null) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  if (child.exitCode !== 0) {
    throw new Error(`worker ${mode} failed (${child.exitCode}): ${stderr}`);
  }
  return stdout.split('\n').find((line) => line.startsWith('STATE ')) ?? '';
}

describe('SIGKILL cross-store fixtures (real child processes)', () => {
  it('crash with a pending approval: no lost approval, approval over real HTTP, crash before resume, exactly-one effect on retry, no duplicate invocation', async () => {
    const dir = freshDir();

    // Phase A: durable intent + pending approval, then SIGKILL.
    const phaseA = await spawnWorker('setup-approval', dir);
    expect(phaseA.extra.some((line) => line.startsWith('PENDING appr-sk-1 inv-sk-1'))).toBe(true);
    sigkill(phaseA.child);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Phase B: a fresh process reconciles and serves; the approver decides
    // over REAL HTTP (distinct actor; never self-approval).
    const phaseB = await spawnWorker('serve', dir);
    const approved = await post(
      phaseB.port,
      '/vict/v1/approvals/appr-sk-1',
      { decision: 'approved' },
      'vict-test-token-approver',
      'sigkill-approve-1',
    );
    expect(approved.status).toBe(200);
    // Crash AFTER the VICT approval but BEFORE the protected effect.
    sigkill(phaseB.child);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Phase C: resume — the approval is NOT lost; the effect runs EXACTLY
    // once; the retried logical invocation is skipped as already-completed.
    // runPhase awaits the worker's EXIT, so the effects log is final when
    // read (the resume worker keeps running past READY and finishes the
    // replay-skip check asynchronously after the sentinel appears).
    const effectsFile = join(dir, 'effects.log');
    await runPhase('resume', dir);
    const effectLines = readFileSync(effectsFile, 'utf8')
      .split('\n')
      .filter((line) => line.startsWith('EFFECT '));
    expect(effectLines).toEqual(['EFFECT cap.notes.write']);
    expect(readFileSync(effectsFile, 'utf8')).toContain('REPLAY-SKIPPED completed');

    // Phase D: final durable state across yet another process boundary.
    const state = await runPhase('verify', dir);
    const parsed = JSON.parse(state.slice('STATE '.length)) as {
      approvalStatus: string;
      approverActorId: string;
      invocationCount: number;
      invocationStatus: string;
      turnStatus: string;
    };
    expect(parsed.approvalStatus).toBe('approved');
    expect(parsed.approverActorId).toBe('actor-approver');
    expect(parsed.invocationCount).toBe(1);
    expect(parsed.invocationStatus).toBe('completed');
    // Restart reconciliation produced ONE honest terminal state.
    expect(['cancelled', 'completed', 'failed']).toContain(parsed.turnStatus);
  }, 120_000);

  it('durable cancellation survives restart; reconciliation never resurrects a cancelled turn', async () => {
    const dir = freshDir();

    // Phase A: durable turn intent; cancel over REAL HTTP on the LIVE
    // process (durable cancel intent + terminal state), then SIGKILL.
    const phaseA = await spawnWorker('setup-approval', dir);
    const cancelled = await post(
      phaseA.port,
      '/vict/v1/turns/cancel',
      { turnId: 'turn-sk-1', reasonCode: 'VICT_REASON_OPERATOR_CANCEL' },
      'vict-test-token-operator',
      'sigkill-cancel-1',
    );
    expect(cancelled.status).toBe(200);
    sigkill(phaseA.child);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Phase B: a fresh process reconciles — the cancelled turn is never
    // resurrected; reconciliation leaves a terminal turn terminal.
    const phaseB = await spawnWorker('serve', dir);
    sigkill(phaseB.child);

    // Phase C: verify the durable terminal state from yet another process.
    const state = await runPhase('verify', dir);
    const parsed = JSON.parse(state.slice('STATE '.length)) as { turnStatus: string };
    expect(parsed.turnStatus).toBe('cancelled');
  }, 120_000);

  it('durable stream milestones replay over real HTTP from a fresh process after SIGKILL; transient deltas do not survive', async () => {
    const dir = freshDir();

    // Phase A: durable milestones + transient delta, then SIGKILL.
    const phaseA = await spawnWorker('setup-approval', dir);
    sigkill(phaseA.child);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Phase B: fresh process; reconnect from cursor 0 over REAL HTTP.
    const phaseB = await spawnWorker('serve', dir);
    const response = await fetch(
      `http://127.0.0.1:${phaseB.port}/vict/v1/streams/stream-sk-1?cursor=${encodeURIComponent('v1:stream-sk-1:0')}`,
      { headers: { authorization: 'Bearer vict-test-token-user' } },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type') ?? '').toContain('text/event-stream');
    const reader = response.body?.getReader();
    const chunks: string[] = [];
    const deadline = Date.now() + 3000;
    if (reader !== undefined) {
      for (;;) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          break;
        }
        const timer = new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), Math.min(remaining, 300)),
        );
        const tick = await Promise.race([reader.read(), timer]);
        if (tick === 'timeout') {
          continue;
        }
        if (tick.done) {
          break;
        }
        chunks.push(new TextDecoder().decode(tick.value));
        if (chunks.join('').includes('tool.started')) {
          break;
        }
      }
      await reader.cancel().catch(() => undefined);
    }
    const frames = chunks.join('');
    expect(frames).toContain('response.started');
    expect(frames).toContain('tool.started');
    // The transient delta died with the SIGKILLed process: durable
    // milestones replay; transient deltas do not.
    expect(frames).not.toContain('transient');
    sigkill(phaseB.child);
  }, 120_000);
});
