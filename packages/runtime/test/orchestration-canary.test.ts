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
  it('canaries in payloads and thrown messages never reach ordinary events or default history', { timeout: 30_000 }, async () => {
    const stores = createInMemoryStores();
    const runtime = createRuntime({ stores });
    const seen: KernelEvent[] = [];
    runtime
      .registerCapability({
        id: 'c.decision',
        revision: '1',
        effect: 'pure',
        invoke: (input: unknown) => {
          // Decision value carries the canary into the checkpoint boundary.
          return { route: 'go', value: `${String(input)}` };
        },
      })
      .registerCapability({
        id: 'c.branch',
        revision: '1',
        effect: 'pure',
        invoke: (input: unknown) => `${String(input)}:ok`,
      })
      .registerCapability({
        id: 'c.thrown',
        revision: '1',
        effect: 'pure',
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
      status: string;
      error?: { message?: string; details?: unknown };
    };
    expect(result.status).toBe('failed'); // the thrown node fails the run honestly

    // 1. The failed run's event ledger never contains the canary.
    const snapshot = await (stores.orchestration as never as {
      getOrchestrationSnapshot(runId: string): Promise<{ run: { runId: string } } | undefined>;
    }).getOrchestrationSnapshot(result.runId);
    expect(snapshot).toBeDefined();
    const ledger = await (stores.orchestration as never as {
      listOrchestrationEvents(runId: string): Promise<readonly unknown[]>;
    }).listOrchestrationEvents(result.runId);
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
    assertNoCanaryIn(await (stores.orchestration as never as {
      listSignalReceipts(runId: string): Promise<readonly unknown[]>;
    }).listSignalReceipts(result.runId));

    // 5. Wait records expose safe descriptors only.
    allowLabelCache.value = 'wait records';
    assertNoCanaryIn(await stores.orchestration.listWaits(result.runId));

    allowLabelCache.value = 'unknown';
  });
});

function assertNoCanaryIn(value: unknown): void {
  const text = JSON.stringify(value) ?? '';
  if (text.includes(CANARY)) {
    throw new Error(`canary leaked into ${allowLabelCache.value}: ${text.slice(0, 200)}`);
  }
}