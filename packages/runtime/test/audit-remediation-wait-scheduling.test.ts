import { describe, expect, it } from 'vitest';
import { defineCapability, defineGraph, neutralJsonContract } from '@vict/sdk';
import { createRuntime } from '@vict/runtime';

/**
 * Stage 04 audit remediation — MED-04-E: the unapproved seven-day wait
 * ceiling is removed. Long-lived waits are supported; scheduling-time
 * overflow beyond the safe persisted-timestamp domain fails structurally.
 */

const Pure = defineCapability({
  id: 'ws.pure',
  revision: '1',
  effect: 'pure',
  input: neutralJsonContract,
  output: neutralJsonContract,
  invoke: (input: unknown) => input,
});

function timerGraph(delayMs: number): Parameters<ReturnType<typeof createRuntime>['activate']>[0] {
  return defineGraph({
    id: `g.timer.${String(delayMs)}`,
    entry: 'a',
    nodes: [
      { id: 'a', capability: 'ws.pure' },
      { id: 't', kind: 'wait', wait: { kind: 'timer', delayMs } },
      { id: 'after', capability: 'ws.pure' },
    ],
    edges: [
      { from: 'a', to: 't' },
      { from: 't', to: 'after' },
    ],
  });
}

function signalGraph(
  timeoutMs: number,
): Parameters<ReturnType<typeof createRuntime>['activate']>[0] {
  return defineGraph({
    id: `g.signal.${String(timeoutMs)}`,
    entry: 'a',
    nodes: [
      { id: 'a', capability: 'ws.pure' },
      {
        id: 'w',
        kind: 'wait',
        wait: { kind: 'signal', name: 'go', timeoutMs },
      },
      { id: 'success', capability: 'ws.pure' },
      { id: 'fallback', capability: 'ws.pure' },
    ],
    edges: [
      { from: 'a', to: 'w' },
      { from: 'w', to: 'success' },
      { from: 'w', to: 'fallback', kind: 'timeout' },
    ],
  });
}

async function activatedRuntime(
  definition: Parameters<ReturnType<typeof createRuntime>['activate']>[0],
): Promise<ReturnType<typeof createRuntime>> {
  const runtime = createRuntime();
  runtime.registerCapability(Pure);
  const activation = await runtime.activate(definition);
  if (!activation.ok) {
    throw new Error(`activation failed: ${JSON.stringify(activation.issues)}`);
  }
  return runtime;
}

describe('MED-04-E: long-lived waits are supported without the seven-day ceiling', () => {
  it('seven days + 1 ms compiles and parks the run', async () => {
    const runtime = await activatedRuntime(timerGraph(7 * 24 * 60 * 60 * 1000 + 1));
    const result = await runtime.run('seed');
    expect(result.status).toBe('waiting');
  });

  it('30 days compiles and parks the run', async () => {
    const runtime = await activatedRuntime(timerGraph(30 * 24 * 60 * 60 * 1000));
    const result = await runtime.run('seed');
    expect(result.status).toBe('waiting');
  });

  it('one year compiles and parks the run', async () => {
    const runtime = await activatedRuntime(timerGraph(365 * 24 * 60 * 60 * 1000));
    const result = await runtime.run('seed');
    expect(result.status).toBe('waiting');
  });

  it('a signal-wait timeout of one year compiles and parks the run', async () => {
    const runtime = await activatedRuntime(signalGraph(365 * 24 * 60 * 60 * 1000));
    const result = await runtime.run('seed');
    expect(result.status).toBe('waiting');
  });

  it('zero, negative, fractional, NaN and Infinity fail during compilation', async () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const runtime = createRuntime();
      runtime.registerCapability(Pure);
      const activation = await runtime.activate(
        defineGraph({
          id: `g.timer.bad.${String(bad)}`,
          entry: 'a',
          nodes: [
            { id: 'a', capability: 'ws.pure' },
            { id: 't', kind: 'wait', wait: { kind: 'timer', delayMs: bad as number } },
          ],
          edges: [],
        }) as never,
      );
      expect(activation.ok).toBe(false);
      if (!activation.ok) {
        expect(activation.issues.map((issue) => issue.code)).toContain('INVALID_WAIT_BOUND');
      }
    }
  });

  it('the largest safely schedulable duration parks the run; overflow fails structurally at scheduling time', async () => {
    // The largest delay whose deadline still fits the safe persisted-
    // timestamp domain (clock.now() + delay <= 2^53 - 1): with now ~1.7e12,
    // the largest schedulable duration is ~8.99e15 - now.
    const largestSchedulable = 8.8e15;
    const runtime = await activatedRuntime(timerGraph(largestSchedulable));
    const parked = await runtime.run('seed');
    expect(parked.status).toBe('waiting');

    // An overflow-producing duration compiles (it is a positive safe
    // integer) but FAILS STRUCTURALLY when the timer is scheduled — the
    // deadline would leave the safe persisted-timestamp domain.
    const overflowRuntime = createRuntime();
    overflowRuntime.registerCapability(Pure);
    const overflowActivation = await overflowRuntime.activate(
      timerGraph(Number.MAX_SAFE_INTEGER - 1),
    );
    expect(overflowActivation.ok).toBe(true);
    const overflow = await overflowRuntime.run('seed');
    expect(overflow.status).toBe('failed');
    // The scheduling failure is a stable structured failure, not a crash
    // and never a silently persisted unusable timestamp.
    expect(JSON.stringify(overflow.error ?? overflow)).toContain('VICT_ORCH');
  });
});
