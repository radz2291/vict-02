import { createInMemoryStores, createRuntime } from '@vict/runtime';
import type { KernelEvent } from '@vict/kernel';
import { describe, expect, it } from 'vitest';

/**
 * Stage 04 — Stage 03 LOW-1 closure: a throwing author contract parser is
 * caught at every supported validation boundary and converted into a
 * stable, framework-generated, sanitized TERMINAL failure.
 *
 * - The raw thrown message, nested causes, issue-getter values, and payloads
 *   are never retained (canary-scanned across events, error, and history).
 * - No capability downstream of the failed validation may run.
 * - In durable execution the run commits a terminal failed outcome instead
 *   of a silent reclaim loop; repeated recovery attempts change nothing.
 * - Sequential and durable engines behave identically (terminal failure).
 */

const CANARY = 'RA4-PARSER-CANARY-hunter2';
const CANARY_NESTED = 'RA4-PARSER-CANARY-nested-token';

/** A parser that THROWS with hostile content (message + nested cause). */
function throwingParser(): { ok: true; value: unknown; issues?: undefined } {
  const cause = new Error(`nested cause ${CANARY_NESTED}`);
  throw new Error(`hostile parser threw ${CANARY}`, { cause });
}

/** A rejecting parser whose ISSUE OBJECTS carry hostile getters. */
function hostileIssuesParser(input: unknown): { ok: boolean; value?: unknown; issues?: unknown[] } {
  if (typeof input === 'string') {
    return {
      ok: false,
      issues: [
        {
          get code(): string {
            throw new Error(`getter canary ${CANARY}`);
          },
          get path(): string {
            throw new Error(`getter canary ${CANARY}`);
          },
        },
      ],
    };
  }
  return { ok: true, value: input };
}

function assertNoCanary(value: unknown, label: string): void {
  const serialized = JSON.stringify(value) ?? '';
  expect(serialized, label).not.toContain(CANARY);
  expect(serialized, label).not.toContain(CANARY_NESTED);
}

describe('Stage 04 LOW-1: throwing contract parsers fail safely (sequential engine)', () => {
  it('a throwing INPUT parser terminates the run with a sanitized error and no downstream invocation', async () => {
    const runtime = createRuntime();
    const events: KernelEvent[] = [];
    let downstreamCalls = 0;
    runtime
      .registerContract({
        id: 'c.threw',
        revision: '1',
        expected: 'anything',
        parse: throwingParser,
      })
      .registerCapability({
        id: 'seed',
        revision: '1',
        effect: 'pure',
        invoke: (input: unknown) => input,
      })
      .registerCapability({
        id: 'downstream',
        revision: '1',
        effect: 'pure',
        invoke: (input: unknown) => {
          downstreamCalls += 1;
          return input;
        },
      });
    const activation = await runtime.activate({
      id: 'g.seq-throw',
      entry: 'seed',
      nodes: [
        { id: 'seed', capability: 'seed', input: 'c.threw' },
        { id: 'down', capability: 'downstream' },
      ],
      edges: [{ from: 'seed', to: 'down' }],
    });
    expect(activation.ok).toBe(true);

    const result = await runtime.run(
      { payload: CANARY },
      {
        onEvent: (event) => events.push(event),
      },
    );
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('VICT_KERNEL_CONTRACT_PARSER_THREW');
    expect(downstreamCalls).toBe(0);
    // Even WITH an error edge the run must terminate (a parser throw is a
    // hostile boundary, not data-level rejection).
    assertNoCanary(result.error, 'error');
    assertNoCanary(events, 'events');
    const history = await runtime.listRuns();
    assertNoCanary(history, 'history');
  });

  it('a throwing OUTPUT parser terminates the run identically', async () => {
    const runtime = createRuntime();
    let downstreamCalls = 0;
    runtime
      .registerContract({
        id: 'c.threw-out',
        revision: '1',
        expected: 'anything',
        parse: throwingParser,
      })
      .registerCapability({
        id: 'seed',
        revision: '1',
        effect: 'pure',
        invoke: () => CANARY,
      })
      .registerCapability({
        id: 'downstream',
        revision: '1',
        effect: 'pure',
        invoke: (input: unknown) => {
          downstreamCalls += 1;
          return input;
        },
      });
    await runtime.activate({
      id: 'g.seq-throw-out',
      entry: 'seed',
      nodes: [
        { id: 'seed', capability: 'seed', output: 'c.threw-out' },
        { id: 'down', capability: 'downstream' },
      ],
      edges: [{ from: 'seed', to: 'down' }],
    });
    const result = await runtime.run('irrelevant');
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('VICT_KERNEL_CONTRACT_PARSER_THREW');
    expect(downstreamCalls).toBe(0);
    assertNoCanary(result.error, 'error');
  });

  it('hostile issue getters on a REJECTING parser cannot leak or wedge execution', async () => {
    const runtime = createRuntime();
    runtime.registerContract({
      id: 'c.hostile-issues',
      revision: '1',
      expected: 'anything',
      // The hostile issue shape is deliberately NOT a ContractIssue[]; the
      // runtime must sanitize it structurally (the cast documents that the
      // untrusted content crosses the boundary as-is).
      parse: (input: unknown) => hostileIssuesParser(input) as never,
    });
    runtime.registerCapability({
      id: 'seed',
      revision: '1',
      effect: 'pure',
      invoke: (input: unknown) => input,
    });
    await runtime.activate({
      id: 'g.hostile-issues',
      entry: 'seed',
      nodes: [{ id: 'seed', capability: 'seed', input: 'c.hostile-issues' }],
      edges: [],
    });
    const result = await runtime.run(CANARY);
    expect(result.status).toBe('failed');
    // Standard sanitized contract rejection — getter values never observed.
    expect(result.error?.code).toBe('VICT_KERNEL_CONTRACT_REJECTED');
    assertNoCanary(result.error, 'error');
    const issues = (result.error?.details as { issues?: { code: string }[] })?.issues ?? [];
    expect(issues.every((issue) => issue.code === 'untrusted_issue')).toBe(true);
  });
});

describe('Stage 04 LOW-1: throwing contract parsers fail safely (durable engine, in-memory)', () => {
  it('commits a terminal failed outcome — no silent reclaim loop, no downstream run', async () => {
    const stores = createInMemoryStores();
    const runtime = createRuntime({
      stores,
      ids: { runId: () => `run_throw_${Math.random().toString(16).slice(2, 8)}` },
    });
    const events: KernelEvent[] = [];
    let downstreamCalls = 0;
    runtime
      .registerContract({
        id: 'd.threw',
        revision: '1',
        expected: 'anything',
        parse: (input: unknown) => {
          void input;
          throw new Error(`durable hostile parser ${CANARY}`);
        },
      })
      .registerCapability({
        id: 'seed',
        revision: '1',
        effect: 'pure',
        invoke: (input: unknown) => input,
      })
      .registerCapability({
        id: 'downstream',
        revision: '1',
        effect: 'pure',
        invoke: (input: unknown) => {
          downstreamCalls += 1;
          return input;
        },
      });
    // A trailing control node makes this a Stage 03 durable-engine graph.
    const activation = await runtime.activate({
      id: 'g.dur-throw',
      entry: 'seed',
      nodes: [
        { id: 'seed', capability: 'seed', input: 'd.threw' },
        { id: 'down', capability: 'downstream' },
        { id: 'hold', kind: 'wait', wait: { kind: 'timer', delayMs: 60_000 } },
        { id: 'end', capability: 'downstream' },
      ],
      edges: [
        { from: 'seed', to: 'down' },
        { from: 'down', to: 'hold' },
        { from: 'hold', to: 'end' },
      ],
    });
    expect(activation.ok).toBe(true);

    const result = await runtime.run(CANARY, {
      mode: 'normal',
      onEvent: (event) => events.push(event),
    });
    // The run is TERMINAL failed — never a nonterminal reclaim state.
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('VICT_RUNTIME_CONTRACT_PARSER_THREW');
    expect(downstreamCalls).toBe(0);

    // Lease recovery / repeated pumps cannot resurrect or re-invoke.
    await runtime.recoverOrchestration({ resume: true });
    await runtime.processDueTimers();
    const record = await stores.orchestration?.getOrchestrationRun(result.runId);
    expect(record?.status).toBe('failed');
    expect(downstreamCalls).toBe(0);

    // The sanitizer kept the thrown message out of every observable surface.
    assertNoCanary(result.error, 'error');
    assertNoCanary(events, 'events');
    assertNoCanary(record, 'run record');

    // Exactly one failed attempt: no re-claim cycle.
    const failedEvents = events.filter((event) => event.type === 'run.failed');
    expect(failedEvents).toHaveLength(1);
  });

  it('a throwing OUTPUT parser on a durable node commits the same terminal failure', async () => {
    const stores = createInMemoryStores();
    const runtime = createRuntime({
      stores,
      ids: { runId: () => `run_throw_out_${Math.random().toString(16).slice(2, 8)}` },
    });
    let downstreamCalls = 0;
    runtime
      .registerContract({
        id: 'd.threw-out',
        revision: '1',
        expected: 'anything',
        parse: () => {
          throw new Error(`durable hostile output parser ${CANARY}`);
        },
      })
      .registerCapability({
        id: 'seed',
        revision: '1',
        effect: 'pure',
        invoke: () => 'ok',
      })
      .registerCapability({
        id: 'downstream',
        revision: '1',
        effect: 'pure',
        invoke: (input: unknown) => {
          downstreamCalls += 1;
          return input;
        },
      });
    await runtime.activate({
      id: 'g.dur-throw-out',
      entry: 'seed',
      nodes: [
        { id: 'seed', capability: 'seed', output: 'd.threw-out' },
        { id: 'down', capability: 'downstream' },
        { id: 'hold', kind: 'wait', wait: { kind: 'timer', delayMs: 60_000 } },
        { id: 'end', capability: 'downstream' },
      ],
      edges: [
        { from: 'seed', to: 'down' },
        { from: 'down', to: 'hold' },
        { from: 'hold', to: 'end' },
      ],
    });
    const result = await runtime.run('go');
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('VICT_RUNTIME_CONTRACT_PARSER_THREW');
    expect(downstreamCalls).toBe(0);
    const record = await stores.orchestration?.getOrchestrationRun(result.runId);
    expect(record?.status).toBe('failed');
    assertNoCanary(result.error, 'error');
    assertNoCanary(record, 'run record');
  });

  it('a throwing SIGNAL payload parser leaves the wait open with a structured rejection', async () => {
    const stores = createInMemoryStores();
    const runtime = createRuntime({
      stores,
      ids: { runId: () => `run_sig_throw_${Math.random().toString(16).slice(2, 8)}` },
    });
    runtime
      .registerContract({
        id: 'd.sig-threw',
        revision: '1',
        expected: 'anything',
        parse: () => {
          throw new Error(`signal parser canary ${CANARY}`);
        },
      })
      .registerCapability({
        id: 'pure',
        revision: '1',
        effect: 'pure',
        invoke: (input: unknown) => input,
      });
    const activation = await runtime.activate({
      id: 'g.sig-threw',
      entry: 'w',
      nodes: [
        { id: 'w', kind: 'wait', wait: { kind: 'signal', name: 'go', contract: 'd.sig-threw' } },
        { id: 'done', capability: 'pure' },
      ],
      edges: [{ from: 'w', to: 'done' }],
    });
    expect(activation.ok).toBe(true);
    const parked = await runtime.run('ignored');
    expect(parked.status).toBe('waiting');
    const waitId = parked.waits?.[0]?.waitId as string;

    const signal = await runtime.signal({
      runId: parked.runId,
      waitId,
      signalId: 'sig-1',
      signalName: 'go',
      payload: CANARY,
    });
    // Structured rejection; the wait remains open; nothing leaked.
    expect(signal.ok).toBe(false);
    if (!signal.ok) {
      expect(signal.message).not.toContain(CANARY);
    }
    const record = await stores.orchestration?.getOrchestrationRun(parked.runId);
    expect(record?.status).toBe('waiting');
    assertNoCanary(record, 'run record after hostile signal');
  });
});
