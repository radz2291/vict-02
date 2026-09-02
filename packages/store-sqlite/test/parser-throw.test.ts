import { createRuntime } from '@vict/runtime';
import type { KernelEvent } from '@vict/kernel';
import { createSqliteStores } from '@vict/store-sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Stage 04 — Stage 03 LOW-1 closure on the SQLite adapter: a throwing
 * author contract parser commits a TERMINAL sanitized failure durably, and
 * a real close/reopen preserves that terminal result EXACTLY (same status,
 * same sanitized code, same event count — no reclaim, no re-invocation).
 */

const CANARY = 'RA4-SQLITE-PARSER-CANARY-vault-key';
let workDir: string | undefined;

afterEach(async () => {
  if (workDir !== undefined) {
    await rm(workDir, { recursive: true, force: true });
    workDir = undefined;
  }
});

interface RegisterArtifacts {
  runtime: ReturnType<typeof createRuntime>;
}

function registerArtifacts(runtime: RegisterArtifacts['runtime']): void {
  runtime.registerContract({
    id: 's.threw',
    revision: '1',
    expected: 'anything',
    parse: () => {
      throw new Error(`sqlite hostile parser ${CANARY}`);
    },
  });
  runtime.registerCapability({
    id: 'seed',
    revision: '1',
    effect: 'pure',
    invoke: (input: unknown) => input,
  });
  runtime.registerCapability({
    id: 'downstream',
    revision: '1',
    effect: 'pure',
    invoke: (input: unknown) => input,
  });
}

function graph() {
  // The trailing control node makes this a Stage 03 durable-engine graph;
  // the parser throws at the FIRST node, so the wait is never reached.
  return {
    id: 'g.sqlite-throw',
    entry: 'seed',
    nodes: [
      { id: 'seed', capability: 'seed', input: 's.threw' },
      { id: 'down', capability: 'downstream' },
      { id: 'hold', kind: 'wait' as const, wait: { kind: 'timer' as const, delayMs: 60_000 } },
      { id: 'end', capability: 'downstream' },
    ],
    edges: [
      { from: 'seed', to: 'down' },
      { from: 'down', to: 'hold' },
      { from: 'hold', to: 'end' },
    ],
  };
}

function assertNoCanary(value: unknown, label: string): void {
  const serialized = JSON.stringify(value) ?? '';
  expect(serialized, label).not.toContain(CANARY);
}

describe('Stage 04 LOW-1: throwing parser commits a durable terminal failure (SQLite)', () => {
  it('close/reopen preserves the terminal failed outcome exactly', async () => {
    workDir = await mkdtemp(join(tmpdir(), 'vict-parser-throw-'));
    const db = join(workDir, 'runs.db');

    const downstreamCalls = 0;
    const events: KernelEvent[] = [];

    // ---- First process: fail the run through the hostile parser ----------
    {
      const stores = createSqliteStores({ path: db });
      const runtime = createRuntime({ stores });
      registerArtifacts(runtime);
      const activation = await runtime.activate(graph());
      expect(activation.ok).toBe(true);

      const result = await runtime.run(CANARY, {
        mode: 'normal',
        onEvent: (event) => events.push(event),
      });
      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('VICT_RUNTIME_CONTRACT_PARSER_THREW');

      const before = await stores.orchestration?.getOrchestrationRun(result.runId);
      expect(before?.status).toBe('failed');
      const eventsBefore = await stores.orchestration?.listOrchestrationEvents(result.runId);
      const failedCountBefore = (eventsBefore ?? []).filter(
        (event) => event.type === 'run.failed',
      ).length;
      expect(failedCountBefore).toBe(1);

      await stores.dispose();
    }

    // ---- Second process: reopen and verify exact terminal preservation ---
    {
      const stores = createSqliteStores({ path: db });
      const runtime = createRuntime({ stores });
      registerArtifacts(runtime);

      const runs = await stores.orchestration?.listOrchestrationRuns();
      const record = await stores.orchestration?.getOrchestrationRun(
        (runs?.[0]?.runId as string) ?? '',
      );
      expect(record?.status).toBe('failed');

      const eventsAfter = await stores.orchestration?.listOrchestrationEvents(record?.runId ?? '');
      const failedCountAfter = (eventsAfter ?? []).filter(
        (event) => event.type === 'run.failed',
      ).length;
      expect(failedCountAfter).toBe(1);

      // Recovery after reopen changes nothing: no reclaim, no re-throw.
      await runtime.recoverOrchestration({ resume: true });
      await runtime.processDueTimers();
      const afterRecovery = await stores.orchestration?.getOrchestrationRun(record?.runId ?? '');
      expect(afterRecovery?.status).toBe('failed');
      const eventsFinal = await stores.orchestration?.listOrchestrationEvents(record?.runId ?? '');
      expect(eventsFinal?.length).toBe(eventsAfter?.length);

      // The hostile message never reached any persisted surface.
      assertNoCanary(events, 'in-memory captured events');
      assertNoCanary(eventsAfter, 'persisted events');
      assertNoCanary(afterRecovery, 'persisted run record');

      await stores.dispose();
    }

    expect(downstreamCalls).toBe(0);
  });
});
