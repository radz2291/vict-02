import { createRuntime } from '@vict/runtime';
import type { KernelEvent } from '@vict/kernel';
import { describe, expect, it } from 'vitest';

/**
 * Stage 03 smoke: a control graph — pure decision route → two-branch fork →
 * deterministic join → durable signal wait → keyed-idempotent write → done.
 * Runs on the in-memory durable orchestration engine.
 */

describe('stage 03 orchestration smoke (in-memory)', () => {
  it('routes a decision, fans out, joins deterministically, waits for a signal, and completes a keyed write', async () => {
    const runtime = createRuntime({
      ids: { runId: () => `run_smoke_${Math.random().toString(16).slice(2, 8)}` },
    });
    const events: KernelEvent[] = [];
    let routeCalls = 0;
    let branchACalls = 0;
    let branchBCalls = 0;
    const writeCalls: string[] = [];

    runtime
      .registerCapability({
        id: 'route',
        revision: '1',
        effect: 'pure',
        invoke: (input: unknown) => {
          routeCalls += 1;
          return { route: 'split', value: String(input) };
        },
      })
      .registerCapability({
        id: 'branchA',
        revision: '1',
        effect: 'pure',
        invoke: (input: unknown) => {
          branchACalls += 1;
          return `A:${String(input)}`;
        },
      })
      .registerCapability({
        id: 'branchB',
        revision: '1',
        effect: 'pure',
        invoke: (input: unknown) => {
          branchBCalls += 1;
          return `B:${String(input)}`;
        },
      })
      .registerCapability({
        id: 'waitCap',
        revision: '1',
        effect: 'pure',
        invoke: (input: unknown) => input,
      })
      .registerCapability({
        id: 'afterWait',
        revision: '1',
        effect: 'pure',
        invoke: (input: unknown) => input,
      })
      .registerCapability({
        id: 'keyedWrite',
        revision: '1',
        effect: 'write',
        idempotency: 'keyed',
        invoke: (input: unknown, context) => {
          writeCalls.push(`${context.idempotencyKey}:${String(input)}`);
          return `written:${String(input)}`;
        },
      });

    const activation = await runtime.activate({
      id: 'orch-smoke',
      entry: 'd',
      nodes: [
        { id: 'd', kind: 'decision', capability: 'route' },
        { id: 'f', kind: 'fork', join: 'j' },
        { id: 'a', capability: 'branchA' },
        { id: 'b', capability: 'branchB' },
        { id: 'j', kind: 'join', fork: 'f' },
        { id: 'w2', kind: 'wait', wait: { kind: 'signal', name: 'go' } },
        { id: 'aw', capability: 'afterWait' },
        {
          id: 'wr',
          capability: 'keyedWrite',
          retry: {
            maxAttempts: 3,
            retryOn: ['VICT_RUNTIME_CAPABILITY_THREW'],
            backoff: { kind: 'fixed', delayMs: 1 },
          },
        },
      ],
      edges: [
        { from: 'd', to: 'f', kind: 'route', key: 'split' },
        { from: 'f', to: 'a', kind: 'branch', key: 'a' },
        { from: 'f', to: 'b', kind: 'branch', key: 'b' },
        { from: 'a', to: 'j', kind: 'success' },
        { from: 'b', to: 'j', kind: 'success' },
        { from: 'j', to: 'w2', kind: 'success' },
        { from: 'w2', to: 'aw', kind: 'success' },
        { from: 'aw', to: 'wr', kind: 'success' },
      ],
    });
    expect(activation.ok).toBe(true);

    const result = await runtime.run<{ value: string }>(
      { value: 'seed' },
      { mode: 'normal', onEvent: (e) => events.push(e) },
    );
    expect(result.status).toBe('waiting');
    expect(result.waits?.length).toBe(1);
    const waitId = result.waits?.[0]?.waitId as string;

    const signal = await runtime.signal({
      runId: result.runId,
      waitId,
      signalId: 'sig-1',
      signalName: 'go',
      payload: 'resumed',
    });
    expect(signal.ok).toBe(true);
    expect(signal.ok ? signal.status : '').toBe('accepted');

    const final = await runtime.resumeRun<string>(result.runId);
    expect(final.status).toBe('completed');
    expect(routeCalls).toBe(1);
    expect(branchACalls).toBe(1);
    expect(branchBCalls).toBe(1);
    expect(writeCalls.length).toBe(1);
    expect(final.output).toBe('written:resumed');

    // Duplicate signal delivery is idempotent.
    const duplicate = await runtime.signal({
      runId: result.runId,
      waitId,
      signalId: 'sig-1',
      signalName: 'go',
      payload: 'resumed',
    });
    expect(duplicate.ok).toBe(true);
    expect(duplicate.ok ? duplicate.status : '').toBe('duplicate');
  });
});
