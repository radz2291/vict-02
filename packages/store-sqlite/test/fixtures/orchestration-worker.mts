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
      throw new Error(`activation failed: ${JSON.stringify(activated.issues.map((issue) => issue.code))}`);
    }
    const result = await runtime.run('seed');
    if (result.status !== 'waiting') {
      throw new Error(`expected waiting, got ${result.status}`);
    }
    writeState({ runId: result.runId, activationVersion: activated.activationVersion, waitId: result.waits?.[0]?.waitId ?? null });
    await stores.dispose();
    return;
  }

  if (stage === 'signal' || stage === 'pump-timer') {
    registerCommon();
    runtime.registerCapability({
      id: 'second',
      revision: '1',
      effect: 'pure',
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
          retry: { maxAttempts: 3, retryOn: ['VICT_RUNTIME_CAPABILITY_THREW'], backoff: { kind: 'fixed', delayMs: 1 } },
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
      return JSON.parse(readFileSync(ledgerPath, 'utf8')) as Record<string, { count: number; result: string }>;
    };
    const writeLedger = (ledger: Record<string, { count: number; result: string }>): void => {
      writeFileSync(ledgerPath, JSON.stringify(ledger));
    };
    runtime.registerCapability({
      id: 'keyedWrite',
      revision: '1',
      effect: 'write',
      idempotency: 'keyed',
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
        invoke: (input: unknown) => `recovered:${String(input)}`,
      });
    } else {
      runtime.registerCapability({
        id: 'keyedWrite',
        revision: '1',
        effect: 'write',
        idempotency: 'keyed',
        invoke: (input: unknown, context) => {
          const ledger = JSON.parse(readFileSync(`${statePath}.ledger`, 'utf8')) as Record<string, { count: number; result: string }>;
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

  throw new Error(`unknown stage '${stage}'`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    const detail = error as { code?: string; details?: unknown; driverCause?: { message?: string } };
    console.error(
      'WORKER FAILED:',
      error instanceof Error ? error.message : String(error),
      '| code:', detail.code ?? '(none)',
      '| cause:', detail.driverCause?.message ?? '(none)',
      '| details:', JSON.stringify(detail.details ?? {}),
    );
    process.exit(1);
  });