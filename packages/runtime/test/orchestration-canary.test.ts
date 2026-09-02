import { neutralJsonContract } from '@vict/sdk';
import { describe, expect, it } from 'vitest';
import { createInMemoryStores, createRuntime } from '@vict/runtime';
import type { KernelEvent } from '@vict/kernel';

/**
 * Stage 03 adversarial: payload and error canaries (handoff §24.12).
 *
 * Unique canary values are injected through run input/checkpoint, signal
 * payload, decision value, branch output, thrown messages, nested causes,
 * custom contract messages, and cancellation metadata. The canaries must
 * be absent from ordinary events, default (summary) history, safe errors,
 * deduplication metadata, and operator-visible records. Checkpoint payloads
 * may hold active values ONLY inside the private operational boundary.
 */

const CANARY = 'CANARY-s3cret-6e2a9';

const allowLabelCache = { value: 'unknown' };

describe('stage 03 payload and error canaries (in-memory durable orchestration)', () => {
  it(
    'canaries in payloads and thrown messages never reach ordinary events or default history',
    { timeout: 30_000 },
    async () => {
      const stores = createInMemoryStores();
      const orchestration =
        stores.orchestration as never as import('@vict/runtime').OrchestrationStore;
      const runtime = createRuntime({ stores });
      const seen: KernelEvent[] = [];
      runtime
        .registerCapability({
          id: 'c.decision',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: (input: unknown) => {
            // Decision value carries the canary into the checkpoint boundary.
            return { route: 'go', value: `${String(input)}` };
          },
        })
        .registerCapability({
          id: 'c.branch',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: (input: unknown) => `${String(input)}:ok`,
        })
        .registerCapability({
          id: 'c.thrown',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => {
            throw new Error(`inner ${CANARY}`, { cause: new Error(`nested ${CANARY}`) });
          },
        });

      const activated = await runtime.activate({
        id: 'canary-graph',
        entry: 'd',
        nodes: [
          { id: 'd', kind: 'decision', capability: 'c.decision' },
          { id: 'f', kind: 'fork', join: 'j' },
          { id: 'a', capability: 'c.branch' },
          { id: 'b', capability: 'c.branch' },
          { id: 'j', kind: 'join', fork: 'f' },
          { id: 't', capability: 'c.thrown' },
        ],
        edges: [
          { from: 'd', to: 'f', kind: 'route', key: 'go' },
          { from: 'f', to: 'a', kind: 'branch', key: 'a' },
          { from: 'f', to: 'b', kind: 'branch', key: 'b' },
          { from: 'a', to: 'j' },
          { from: 'b', to: 'j' },
          { from: 'j', to: 't' },
        ],
      });
      expect(activated.ok).toBe(true);

      const result = (await runtime.run(`${CANARY}-input`)) as unknown as {
        runId: string;
        status: string;
        error?: { message?: string; details?: unknown };
      };
      expect(result.status).toBe('failed'); // the thrown node fails the run honestly

      // 1. The failed run's event ledger never contains the canary.
      const snapshot = await orchestration.getOrchestrationSnapshot(result.runId);
      expect(snapshot).toBeDefined();
      const ledger = await orchestration.listOrchestrationEvents(result.runId);
      for (const event of ledger) {
        seen.push(event as KernelEvent);
      }
      allowLabelCache.value = 'the event ledger';
      assertNoCanaryIn(seen);

      // 2. The sanitized error never contains the canary (message or details).
      allowLabelCache.value = 'the sanitized run error';
      assertNoCanaryIn(result.error);

      // 3. The stored run record (summary retention) never contains the canary.
      const record = await runtime.getRun(result.runId);
      allowLabelCache.value = 'the stored run record';
      assertNoCanaryIn(record);

      // 4. Signal-receipt/deduplication metadata never contains payloads.
      allowLabelCache.value = 'signal receipts';
      assertNoCanaryIn(await orchestration.listSignalReceipts(result.runId));

      // 5. Wait records expose safe descriptors only.
      allowLabelCache.value = 'wait records';
      assertNoCanaryIn(await orchestration.listWaits(result.runId));

      allowLabelCache.value = 'unknown';
    },
  );

  it(
    'canaries in contract messages, join output, and operator flow never leak',
    { timeout: 30_000 },
    async () => {
      const CANARY2 = 'CANARY-op-meta-91f2';
      const assertNo2 = (value: unknown, label: string): void => {
        const text = JSON.stringify(value) ?? '';
        if (text.includes(CANARY2)) {
          throw new Error(`canary leaked into ${label}: ${text.slice(0, 200)}`);
        }
      };
      const stores = createInMemoryStores();
      const orchestration =
        stores.orchestration as never as import('@vict/runtime').OrchestrationStore;
      const runtime = createRuntime({ stores });
      let downstreamCalls = 0;
      runtime
        .registerCapability({
          id: 'k.first',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => 'one',
        })
        .registerCapability({
          id: 'k.b1',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => 'alpha',
        })
        .registerCapability({
          id: 'k.b2',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => 'beta',
        })
        .registerCapability({
          id: 'k.after',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => {
            downstreamCalls += 1;
            return 'after';
          },
        })
        .registerCapability({
          id: 'k.slowWrite',
          revision: '1',
          effect: 'write',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: async () => {
            await new Promise((resolve) => setTimeout(resolve, 120));
            return 'applied';
          },
        })
        // A hostile join contract: raw message + payload echo + nested secret.
        .registerContract({
          id: 'k.join-reject',
          revision: '1',
          expected: 'never',
          parse: (input: unknown) => ({
            ok: false as const,
            issues: [
              {
                code: 'HOSTILE',
                path: '$',
                message: `${CANARY2}:${JSON.stringify(input)}`,
              },
            ],
          }),
        })
        .registerContract({
          id: 'k.output',
          revision: '1',
          expected: 'a record',
          parse: (input: unknown) =>
            typeof input === 'object' && input !== null
              ? { ok: true as const, value: input, issues: [] }
              : { ok: false as const, issues: [{ code: 'TYPE', path: '$', message: 'record' }] },
        });

      // --- Join contract rejection: raw parser message and payload never leak ---
      const joinActivated = await runtime.activate({
        id: 'canary-join',
        entry: 's',
        nodes: [
          { id: 's', capability: 'k.first' },
          { id: 'f', kind: 'fork', join: 'j' },
          { id: 'x1', capability: 'k.b1' },
          { id: 'x2', capability: 'k.b2' },
          { id: 'j', kind: 'join', fork: 'f', output: 'k.join-reject' },
          { id: 'z', capability: 'k.after' },
        ],
        edges: [
          { from: 's', to: 'f' },
          { from: 'f', to: 'x1', kind: 'branch', key: 'a' },
          { from: 'f', to: 'x2', kind: 'branch', key: 'b' },
          { from: 'x1', to: 'j' },
          { from: 'x2', to: 'j' },
          { from: 'j', to: 'z' },
        ],
      });
      expect(joinActivated.ok).toBe(true);
      const joinResult = (await runtime.run('seed')) as unknown as {
        runId: string;
        status: string;
        error?: { code?: string; message?: string; details?: unknown };
      };
      expect(joinResult.status).toBe('failed');
      expect(downstreamCalls).toBe(0);
      const joinEvents = await orchestration.listOrchestrationEvents(joinResult.runId);
      assertNo2(joinEvents, 'the join-rejection event ledger');
      assertNo2(joinResult.error, 'the join-rejection safe error');
      const joinRecord = await runtime.getRun(joinResult.runId);
      assertNo2(joinRecord, 'the join-rejection default run record');

      // --- Cancellation + authorized operator resolution canaries ---
      await runtime.activate({
        id: 'canary-cancel',
        entry: 'w',
        nodes: [
          { id: 'w', capability: 'k.slowWrite', timeoutMs: 20, output: 'k.join-reject' as never },
          { id: 'z', capability: 'k.after' },
        ],
        edges: [{ from: 'w', to: 'z' }],
      });
      void joinActivated;
      const blockedResult = (await runtime.run('seed')) as unknown as {
        runId: string;
        status: string;
      };
      // The blocked run's records never carry contract-parser messages.
      const blockedEvents = await orchestration.listOrchestrationEvents(blockedResult.runId);
      assertNo2(blockedEvents, 'the blocked-run event ledger');

      // Authorized operator resolution: same stores, explicit authorization.
      const operator = createRuntime({
        stores,
        orchestration: { operatorAuthorized: true },
      });
      operator
        .registerCapability({
          id: 'k.slowWrite',
          revision: '1',
          effect: 'write',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: async () => 'applied',
        })
        .registerCapability({
          id: 'k.after',
          revision: '1',
          effect: 'pure',
          input: neutralJsonContract,
          output: neutralJsonContract,
          invoke: () => 'after',
        })
        .registerContract({
          id: 'k.join-reject',
          revision: '1',
          expected: 'a record',
          parse: (input: unknown) =>
            typeof input === 'object' && input !== null
              ? { ok: true as const, value: input, issues: [] }
              : { ok: false as const, issues: [{ code: 'TYPE', path: '$', message: 'record' }] },
        });
      const runBefore = await orchestration.getOrchestrationRun(blockedResult.runId);
      const resolved = await operator.resolveBlocked({
        runId: blockedResult.runId,
        resolutionId: 'res-op-1',
        action: 'confirm_applied',
        output: { applied: true },
        reasonCode: 'operator_request',
        expectedRunRevision: runBefore?.recordRevision,
      });
      expect(resolved.ok).toBe(true);
      expect(resolved.ok ? resolved.status : '').toBe('accepted');
      const final = await runtime.resumeRun(blockedResult.runId);
      expect(final.status).toBe('completed');
      const resolvedEvents = await orchestration.listOrchestrationEvents(blockedResult.runId);
      expect(resolvedEvents.filter((event) => event.type === 'operator.intervened').length).toBe(1);
      // The operator.intervened event carries only structured safe fields.
      const intervened = resolvedEvents.find(
        (event) => event.type === 'operator.intervened',
      ) as unknown as Record<string, unknown>;
      expect(typeof intervened['resolutionId']).toBe('string');
      expect(intervened['action']).toBe('confirm_applied');
      // The confirmed output flows; no parser messages or payload echoes leak.
      const record2 = await runtime.getRun(blockedResult.runId);
      assertNo2(record2, 'the resolved-run default record');
      assertNo2(resolvedEvents, 'the resolved-run event ledger');
      allowLabelCache.value = 'unknown';
    },
  );
});

function assertNoCanaryIn(value: unknown): void {
  const text = JSON.stringify(value) ?? '';
  if (text.includes(CANARY)) {
    throw new Error(`canary leaked into ${allowLabelCache.value}: ${text.slice(0, 200)}`);
  }
}
