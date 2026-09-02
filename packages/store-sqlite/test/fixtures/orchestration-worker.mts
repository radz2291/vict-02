import { neutralJsonContract } from '@vict/contracts';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createSqliteStores } from '@vict/store-sqlite';
import { createRuntime } from '@vict/runtime';

/**
 * Orchestration restart worker (Stage 03 adversarial fixtures, handoff
 * §24.3/24.5/24.6). Invoked as a real child process; the parent controls
 * termination and recovery. Stages:
 *
 * - `start-wait`   activate + start a run, park at the durable signal wait, exit normally
 * - `signal`       reopen, resolve the EXACT activation, deliver one signal, resume to completion
 * - `start-timer`  park at a timer wait, exit
 * - `pump-timer`   reopen and pump due timers, resume to completion
 * - `start-hang`   start a run whose capability hangs forever (parent SIGKILLs it)
 * - `hang-write`   keyed-idempotent write that records an external ledger, then hangs (parent SIGKILLs it)
 * - `recover-pure` reopen after crash, recover policy-permitted work, complete
 * - `recover-write` reopen after the keyed-write crash; the external ledger reconciles; one external mutation
 * - `start-join-partial` partial fan-out: branch 'a' completes, branch 'b' hangs (parent SIGKILLs)
 * - `resume-join` reopen after the partial fan-out crash; completed branches are not re-invoked; the join validates once
 * - `start-join-terminal` park a branch at a signal wait feeding a TERMINAL join, exit
 * - `signal-join-terminal` reopen, signal, terminal join validates + completes with the canonical output
 */

const [stage, dbPath, statePath] = process.argv.slice(2);

async function await_readState(): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  try {
    return await readFile(statePath, 'utf8');
  } catch {
    return '{}';
  }
}

function writeState(state: Record<string, unknown>): void {
  writeFileSync(statePath, JSON.stringify(state));
}

const stringContract = {
  id: 'restart-string',
  revision: '1',
  expected: 'a string',
  parse: (input: unknown) =>
    typeof input === 'string'
      ? { ok: true as const, value: input, issues: [] }
      : { ok: false as const, issues: [{ code: 'TYPE', path: '$', message: 'expected a string' }] },
};

const hangContract = {
  id: 'restart-hang',
  revision: '1',
  expected: 'a string',
  parse: (input: unknown) =>
    typeof input === 'string'
      ? { ok: true as const, value: input, issues: [] }
      : { ok: false as const, issues: [{ code: 'TYPE', path: '$', message: 'expected a string' }] },
};

const stores = createSqliteStores({ path: dbPath });
const runtime = createRuntime({ stores, orchestration: { leaseMs: 1000 } });

function registerCommon(): void {
  runtime.registerContract(stringContract).registerCapability({
    id: 'first',
    revision: '1',
    effect: 'pure',
    input: neutralJsonContract,
    output: neutralJsonContract,
    invoke: () => 'one',
  });
}

async function main(): Promise<void> {
  if (stage === 'start-wait' || stage === 'start-timer') {
    registerCommon();
    runtime.registerCapability({
      id: 'second',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      invoke: (input: unknown) => `got:${String(input)}`,
    });
    const definition =
      stage === 'start-timer'
        ? {
            id: 'restart-timer',
            entry: 'a',
            nodes: [
              { id: 'a', capability: 'first' },
              { id: 't', kind: 'wait' as const, wait: { kind: 'timer' as const, delayMs: 5 } },
              { id: 'b', capability: 'second', output: 'restart-string' },
            ],
            edges: [
              { from: 'a', to: 't' },
              { from: 't', to: 'b' },
            ],
          }
        : {
            id: 'restart-wait',
            entry: 'a',
            nodes: [
              { id: 'a', capability: 'first' },
              { id: 'w', kind: 'wait' as const, wait: { kind: 'signal' as const, name: 'go' } },
              { id: 'b', capability: 'second', output: 'restart-string' },
            ],
            edges: [
              { from: 'a', to: 'w' },
              { from: 'w', to: 'b' },
            ],
          };
    const activated = await runtime.activate(definition);
    if (!activated.ok) {
      throw new Error(
        `activation failed: ${JSON.stringify(activated.issues.map((issue) => issue.code))}`,
      );
    }
    const result = await runtime.run('seed');
    if (result.status !== 'waiting') {
      throw new Error(`expected waiting, got ${result.status}`);
    }
    writeState({
      runId: result.runId,
      activationVersion: activated.activationVersion,
      waitId: result.waits?.[0]?.waitId ?? null,
    });
    await stores.dispose();
    return;
  }

  if (stage === 'signal' || stage === 'pump-timer') {
    registerCommon();
    runtime.registerCapability({
      id: 'second',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      invoke: (input: unknown) => `got:${String(input)}`,
    });
    const state = JSON.parse(await await_readState()) as { runId: string; waitId: string | null };
    const stored = await stores.orchestration.getOrchestrationRun(state.runId);
    if (!stored) {
      throw new Error('run not found after restart');
    }
    // The run must resolve ONLY under its exact pinned activation.
    if (stage === 'signal') {
      const delivered = await runtime.signal({
        runId: state.runId,
        waitId: state.waitId as string,
        signalId: 'restart-sig-1',
        signalName: 'go',
        payload: 'resumed',
      });
      if (!delivered.ok || delivered.status !== 'accepted') {
        throw new Error(`signal delivery failed: ${JSON.stringify(delivered)}`);
      }
      const final = await runtime.resumeRun(state.runId);
      if (final.status !== 'completed' || final.output !== 'got:resumed') {
        throw new Error(`unexpected final: ${final.status} ${String(final.output)}`);
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 30));
      const pumped = await runtime.processDueTimers({ runId: state.runId });
      if (pumped.fired !== 1) {
        throw new Error(`expected one due timer, fired ${pumped.fired}`);
      }
      const final = await runtime.resumeRun(state.runId);
      if (final.status !== 'completed' || final.output !== 'got:one') {
        throw new Error(`unexpected final: ${final.status} ${String(final.output)}`);
      }
    }
    await stores.dispose();
    return;
  }

  if (stage === 'start-hang') {
    registerCommon();
    runtime.registerContract(hangContract);
    runtime.registerCapability({
      id: 'hang',
      revision: '1',
      effect: 'pure',
      input: neutralJsonContract,
      output: neutralJsonContract,
      invoke: async () => {
        // Notify the parent that durable intent has committed and the
        // handler is in flight, then never return. The interval keeps the
        // event loop alive so the parent's kill is the real crash.
        writeState({ hanging: true });
        // Stay referenced: the parent's kill must be the real crash.
        setInterval(() => undefined, 1_000_000);
        await new Promise(() => undefined);
      },
    });
    await runtime.activate({
      id: 'restart-hang',
      entry: 'h',
      nodes: [
        {
          id: 'h',
          capability: 'hang',
          retry: {
            maxAttempts: 3,
            retryOn: ['VICT_RUNTIME_CAPABILITY_THREW'],
            backoff: { kind: 'fixed', delayMs: 1 },
          },
          output: 'restart-hang',
        },
      ],
      edges: [],
    });
    await runtime.run('seed');
    return; // never reached
  }

  if (stage === 'hang-write') {
    registerCommon();
    const ledgerPath = `${statePath}.ledger`;
    const readLedger = (): Record<string, { count: number; result: string }> => {
      if (!existsSync(ledgerPath)) {
        return {};
      }
      return JSON.parse(readFileSync(ledgerPath, 'utf8')) as Record<
        string,
        { count: number; result: string }
      >;
    };
    const writeLedger = (ledger: Record<string, { count: number; result: string }>): void => {
      writeFileSync(ledgerPath, JSON.stringify(ledger));
    };
    runtime.registerCapability({
      id: 'keyedWrite',
      revision: '1',
      effect: 'write',
      idempotency: 'keyed',
      input: neutralJsonContract,
      output: neutralJsonContract,
      invoke: async (input: unknown, context) => {
        const key = context.idempotencyKey as string;
        const ledger = readLedger();
        const prior = ledger[key];
        if (prior !== undefined) {
          // Reconciled repeat: one external mutation, prior result returned.
          return prior.result;
        }
        // Simulate the external commit, then hang so the parent SIGKILLs us
        // BEFORE the VICT completion commit.
        ledger[key] = { count: 1, result: `mutated:${String(input)}` };
        writeLedger(ledger);
        const keepAlive = setInterval(() => undefined, 1_000_000);
        void keepAlive;
        await new Promise(() => undefined);
        return 'unreachable';
      },
    });
    await runtime.activate({
      id: 'restart-keyed-write',
      entry: 'w',
      nodes: [
        {
          id: 'w',
          capability: 'keyedWrite',
          retry: { maxAttempts: 3, retryOn: ['timeout'], backoff: { kind: 'fixed', delayMs: 1 } },
          output: 'restart-string',
        },
      ],
      edges: [],
    });
    await runtime.run('seed');
    return; // never reached
  }

  if (stage === 'recover-pure' || stage === 'recover-write') {
    // Let the killed process's WAL settle before reopening.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const state = JSON.parse(await await_readState()) as { runId?: string };
    registerCommon();
    runtime.registerContract(hangContract);
    // The killed child could not persist its run id (run() never returned);
    // recover the single nonterminal run by durable lookup instead.
    if (state.runId === undefined) {
      const candidates = await stores.orchestration.listOrchestrationRuns({ status: 'running' });
      state.runId = candidates[0]?.runId;
    }
    if (stage === 'recover-pure') {
      runtime.registerCapability({
        id: 'hang',
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: (input: unknown) => `recovered:${String(input)}`,
      });
    } else {
      runtime.registerCapability({
        id: 'keyedWrite',
        revision: '1',
        effect: 'write',
        idempotency: 'keyed',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: (input: unknown, context) => {
          const ledger = JSON.parse(readFileSync(`${statePath}.ledger`, 'utf8')) as Record<
            string,
            { count: number; result: string }
          >;
          const prior = ledger[context.idempotencyKey as string];
          if (prior === undefined) {
            throw new Error('the external ledger lost the prior mutation');
          }
          return prior.result;
        },
      });
    }
    const recovered = await runtime.recoverOrchestration({ resume: true, concurrency: 2 });
    if (recovered.reclaimed.length !== 1) {
      throw new Error(`expected exactly one reclaimed claim, got ${JSON.stringify(recovered)}`);
    }
    const run = await stores.orchestration.getOrchestrationRun(state.runId);
    if (run === undefined || run.status !== 'completed') {
      throw new Error(`unexpected run status after recovery: ${String(run?.status)}`);
    }
    writeState({ ...state, recovered: true, reclaimed: recovered.reclaimed });
    await stores.dispose();
    return;
  }

  if (stage === 'start-join-partial') {
    // Partial fan-out interruption: branch 'a' completes durably, branch
    // 'b' hangs forever (parent SIGKILLs). An external ledger records every
    // capability invocation and join-contract parse across processes.
    const ledgerPath = `${statePath}.ledger`;
    const bump = (key: string): void => {
      const ledger = existsSync(ledgerPath)
        ? (JSON.parse(readFileSync(ledgerPath, 'utf8')) as Record<string, number>)
        : {};
      ledger[key] = (ledger[key] ?? 0) + 1;
      writeFileSync(ledgerPath, JSON.stringify(ledger));
    };
    registerCommon();
    runtime.registerContract({
      id: 'join-upper',
      revision: '1',
      expected: 'a record of strings',
      parse: (input: unknown) => {
        bump('joinParse');
        if (typeof input !== 'object' || input === null) {
          return {
            ok: false as const,
            issues: [{ code: 'TYPE', path: '$', message: 'expected a record' }],
          };
        }
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
          out[key] = String(value).toUpperCase();
        }
        return { ok: true as const, value: out, issues: [] };
      },
    });
    runtime
      .registerCapability({
        id: 'jstart',
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: () => 'seed',
      })
      .registerCapability({
        id: 'branchA',
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: () => {
          bump('branchA');
          return 'alpha';
        },
      })
      .registerCapability({
        id: 'branchB',
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: (input: unknown, context) => {
          bump('branchB');
          // Durable intent has committed; the handler now hangs so the
          // parent's SIGKILL is a real mid-fan-out crash.
          writeState({ hanging: true, runId: context.runId });
          setInterval(() => undefined, 1_000_000);
          void input;
          return new Promise<string>(() => undefined);
        },
      })
      .registerCapability({
        id: 'after',
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: (input: unknown) => `after:${JSON.stringify(input)}`,
      });
    const activated = await runtime.activate({
      id: 'restart-join-partial',
      entry: 's',
      nodes: [
        { id: 's', capability: 'jstart' },
        { id: 'f', kind: 'fork' as const, join: 'j' },
        { id: 'a', capability: 'branchA' },
        { id: 'b', capability: 'branchB' },
        { id: 'j', kind: 'join' as const, fork: 'f', output: 'join-upper' },
        { id: 'z', capability: 'after' },
      ],
      edges: [
        { from: 's', to: 'f' },
        { from: 'f', to: 'a', kind: 'branch' as const, key: 'a' },
        { from: 'f', to: 'b', kind: 'branch' as const, key: 'b' },
        { from: 'a', to: 'j' },
        { from: 'b', to: 'j' },
        { from: 'j', to: 'z' },
      ],
    });
    if (!activated.ok) {
      throw new Error(
        `activation failed: ${JSON.stringify(activated.issues.map((issue) => issue.code))}`,
      );
    }
    await runtime.run('seed');
    return; // never reached: branchB hangs forever
  }

  if (stage === 'resume-join') {
    // Fresh process after the partial-fan-out SIGKILL: completed branches
    // are NOT invoked again; only the interrupted safe work resumes.
    const ledgerPath = `${statePath}.ledger`;
    const bump = (key: string): void => {
      const ledger = existsSync(ledgerPath)
        ? (JSON.parse(readFileSync(ledgerPath, 'utf8')) as Record<string, number>)
        : {};
      ledger[key] = (ledger[key] ?? 0) + 1;
      writeFileSync(ledgerPath, JSON.stringify(ledger));
    };
    registerCommon();
    runtime.registerContract({
      id: 'join-upper',
      revision: '1',
      expected: 'a record of strings',
      parse: (input: unknown) => {
        bump('joinParse');
        if (typeof input !== 'object' || input === null) {
          return {
            ok: false as const,
            issues: [{ code: 'TYPE', path: '$', message: 'expected a record' }],
          };
        }
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
          out[key] = String(value).toUpperCase();
        }
        return { ok: true as const, value: out, issues: [] };
      },
    });
    runtime
      .registerCapability({
        id: 'jstart',
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: () => 'seed',
      })
      .registerCapability({
        id: 'branchA',
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: () => {
          bump('branchA');
          return 'alpha';
        },
      })
      .registerCapability({
        id: 'branchB',
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: () => {
          bump('branchB');
          return 'beta';
        },
      })
      .registerCapability({
        id: 'after',
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: (input: unknown) => `after:${JSON.stringify(input)}`,
      });
    await new Promise((resolve) => setTimeout(resolve, 1500)); // lease expiry + WAL settle
    const recovered = await runtime.recoverOrchestration({ resume: true, concurrency: 2 });
    if (recovered.reclaimed.length !== 1) {
      throw new Error(`expected one reclaimed claim, got ${JSON.stringify(recovered)}`);
    }
    const candidates = await stores.orchestration.listOrchestrationRuns({});
    const runId = candidates[0]?.runId;
    const run = await stores.orchestration.getOrchestrationRun(runId as string);
    if (run === undefined || run.status !== 'completed') {
      throw new Error(`unexpected run status after join recovery: ${String(run?.status)}`);
    }
    const events = await stores.orchestration.listOrchestrationEvents(runId as string);
    const joinCompleted = events.filter((event) => event.type === 'join.completed').length;
    const branchCompleted = events.filter((event) => event.type === 'branch.completed').length;
    writeState({
      recovered: true,
      status: run.status,
      joinCompleted,
      branchCompleted,
      events: events.length,
    });
    await stores.dispose();
    return;
  }

  if (stage === 'start-join-terminal' || stage === 'signal-join-terminal') {
    const ledgerPath = `${statePath}.ledger`;
    const bump = (key: string): void => {
      const ledger = existsSync(ledgerPath)
        ? (JSON.parse(readFileSync(ledgerPath, 'utf8')) as Record<string, number>)
        : {};
      ledger[key] = (ledger[key] ?? 0) + 1;
      writeFileSync(ledgerPath, JSON.stringify(ledger));
    };
    registerCommon();
    runtime.registerContract({
      id: 'join-terminal-upper',
      revision: '1',
      expected: 'a record of strings',
      parse: (input: unknown) => {
        bump('joinParse');
        if (typeof input !== 'object' || input === null) {
          return {
            ok: false as const,
            issues: [{ code: 'TYPE', path: '$', message: 'expected a record' }],
          };
        }
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
          out[key] = String(value).toUpperCase();
        }
        return { ok: true as const, value: out, issues: [] };
      },
    });
    runtime
      .registerCapability({
        id: 'jstart',
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: () => 'seed',
      })
      .registerCapability({
        id: 'branchA',
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: () => {
          bump('branchA');
          return 'alpha';
        },
      })
      .registerCapability({
        id: 'branchB',
        revision: '1',
        effect: 'pure',
        input: neutralJsonContract,
        output: neutralJsonContract,
        invoke: () => {
          bump('branchB');
          return 'beta';
        },
      });
    const definition = {
      id: 'restart-join-terminal',
      entry: 's',
      nodes: [
        { id: 's', capability: 'jstart' },
        { id: 'f', kind: 'fork' as const, join: 'j' },
        { id: 'a', capability: 'branchA' },
        {
          id: 'w',
          kind: 'wait' as const,
          wait: { kind: 'signal' as const, name: 'release' },
        },
        { id: 'b', capability: 'branchB' },
        {
          id: 'j',
          kind: 'join' as const,
          fork: 'f',
          output: 'join-terminal-upper',
        },
      ],
      edges: [
        { from: 's', to: 'f' },
        { from: 'f', to: 'a', kind: 'branch' as const, key: 'a' },
        { from: 'f', to: 'b', kind: 'branch' as const, key: 'b' },
        { from: 'a', to: 'j' },
        { from: 'w', to: 'j' },
        { from: 'b', to: 'w' },
      ],
    };
    if (stage === 'start-join-terminal') {
      const activated = await runtime.activate(definition);
      if (!activated.ok) {
        throw new Error(
          `activation failed: ${JSON.stringify(activated.issues.map((issue) => issue.code))}`,
        );
      }
      const result = await runtime.run('seed');
      if (result.status !== 'waiting') {
        throw new Error(`expected waiting, got ${result.status}`);
      }
      writeState({
        runId: result.runId,
        activationVersion: activated.activationVersion,
        waitId: result.waits?.[0]?.waitId ?? null,
      });
      await stores.dispose();
      return;
    }
    // signal-join-terminal: reopen, resolve the EXACT activation, deliver
    // the signal, and let the join validate + complete across the restart.
    const state = JSON.parse(await await_readState()) as {
      runId: string;
      waitId: string | null;
    };
    const delivered = await runtime.signal({
      runId: state.runId,
      waitId: state.waitId as string,
      signalId: 'join-term-sig-1',
      signalName: 'release',
      payload: 'go',
    });
    if (!delivered.ok || delivered.status !== 'accepted') {
      throw new Error(`signal delivery failed: ${JSON.stringify(delivered)}`);
    }
    const final = await runtime.resumeRun(state.runId);
    if (final.status !== 'completed') {
      throw new Error(`expected completed terminal join, got ${final.status}`);
    }
    // Branch 'a' completes with its capability output; branch 'b' completes
    // with the RESUMED signal payload (the documented wait-wake semantics:
    // the resolved payload is the continuation value across the wait).
    const expected = JSON.stringify({ a: 'ALPHA', b: 'GO' });
    if (JSON.stringify(final.output) !== expected) {
      throw new Error(`unexpected terminal join output: ${JSON.stringify(final.output)}`);
    }
    const events = await stores.orchestration.listOrchestrationEvents(state.runId);
    const joinCompleted = events.filter((event) => event.type === 'join.completed').length;
    writeState({ resumed: true, joinCompleted, output: JSON.stringify(final.output) });
    await stores.dispose();
    return;
  }

  throw new Error(`unknown stage '${stage}'`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    const detail = error as {
      code?: string;
      details?: unknown;
      driverCause?: { message?: string };
    };
    console.error(
      'WORKER FAILED:',
      error instanceof Error ? error.message : String(error),
      '| code:',
      detail.code ?? '(none)',
      '| cause:',
      detail.driverCause?.message ?? '(none)',
      '| details:',
      JSON.stringify(detail.details ?? {}),
    );
    process.exit(1);
  });
