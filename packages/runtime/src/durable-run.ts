import type { ExecutionMode, KernelEvent, KernelRunOutput, OutputSummary } from '@vict/kernel';
import type { VictError } from '@vict/contracts';
import type { PayloadRetention } from './types.js';
import type { ExecutionStore, RunStateUpdate } from './store-types.js';
import { VictStoreError } from './store-errors.js';

const TERMINAL_EVENTS: readonly string[] = ['run.completed', 'run.failed', 'run.blocked'];

export interface DurableRunContext {
  readonly runId: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly capabilitySetVersion: string;
  readonly activationVersion: string;
  readonly mode: ExecutionMode;
  readonly retention: PayloadRetention;
  readonly entryNodeId: string;
}

/**
 * Drives the durable lifecycle of one sequential run.
 *
 * Transaction model (DATA-003):
 * - the run is created atomically with its `run.started` event;
 * - each `node.started` is committed atomically with the current-node/step
 *   context update;
 * - a node result (`node.completed` / `node.failed` /
 *   `contract.rejected` / `effect.blocked`) plus its `signal.routed`
 *   follow-ups are committed as one transition;
 * - the terminal event is committed atomically with the terminal record —
 *   under `'full'` retention the complete validated output is attached.
 *
 * Write-ahead rule (Stage 02 safety invariant): writes are applied in
 * emission order by a FIFO queue, and `awaitDurableBoundary()` — the
 * kernel's `beforeInvoke` port — resolves only once every write enqueued so
 * far has committed. The kernel awaits it before every capability
 * invocation, so an intent is durable before the corresponding side effect
 * may begin: run creation and the first `node.started` commit before the
 * first invocation; a node-result batch and the next `node.started` commit
 * before the next invocation. A failed write is recorded; the boundary
 * rejects with the structured store error, so the capability is never
 * invoked, and later `onEvent` calls throw so execution fail-fasts.
 * Every write uses optimistic concurrency (expected record revision and
 * expected next event sequence).
 */
export class DurableRunTracker {
  readonly #execution: ExecutionStore;
  readonly #context: DurableRunContext;
  #output: unknown = undefined;
  #queue: Promise<void> = Promise.resolve();
  #expectedRecordRevision = 0;
  #expectedEventSeq = 0;
  #batch: KernelEvent[] = [];
  #batchNodeId: string | null = null;
  #nodeStarts = 0;
  #failure: { readonly error: unknown } | undefined;

  constructor(execution: ExecutionStore, context: DurableRunContext) {
    this.#execution = execution;
    this.#context = context;
  }

  /** Synchronous hook passed to the kernel; throws once a write has failed. */
  onEvent = (event: KernelEvent): void => {
    if (this.#failure) {
      throw this.#failure.error;
    }
    switch (event.type) {
      case 'run.started': {
        this.#enqueueCreate(event);
        break;
      }
      case 'node.started': {
        this.#flushBatch();
        this.#nodeStarts += 1;
        const expectedRevision = this.#expectedRecordRevision;
        const expectedSeq = this.#expectedEventSeq;
        this.#expectedRecordRevision += 1;
        this.#expectedEventSeq += 1;
        const steps = this.#nodeStarts;
        const nodeId = event.nodeId;
        this.#enqueue(async () => {
          await this.#execution.commitTransition({
            runId: this.#context.runId,
            expectedRecordRevision: expectedRevision,
            expectedNextEventSeq: expectedSeq,
            next: { status: 'running', currentNodeId: nodeId, steps },
            events: [event],
            timestamp: event.timestamp,
          });
        });
        break;
      }
      case 'node.completed':
      case 'node.failed':
      case 'effect.blocked':
      case 'contract.rejected': {
        this.#batch.push(event);
        this.#batchNodeId = event.nodeId;
        break;
      }
      case 'signal.routed': {
        if (this.#batch.length === 0) {
          // Defensive: routing normally rides with its node-result batch.
          this.#appendSingle(event);
        } else {
          this.#batch.push(event);
        }
        break;
      }
      default: {
        if (TERMINAL_EVENTS.includes(event.type)) {
          this.#batch.push(event);
          // The terminal transition is committed by finish(), after the
          // executor has returned and full-retention output is available.
        } else {
          this.#appendSingle(event);
        }
      }
    }
  };

  /**
   * Durable invocation boundary (the kernel's `beforeInvoke` port).
   *
   * Resolves only after every durable write enqueued so far — run creation,
   * any preceding node-result batch, and the current node's `node.started`
   * transition — has committed. Rejects with the recorded structured store
   * failure if any required write failed, which prevents the capability
   * from being invoked. Awaiting the queue is causal, not a timing
   * assumption: the queue promise settles only when all writes enqueued
   * before the boundary call have settled.
   */
  async awaitDurableBoundary(): Promise<void> {
    await this.#queue;
    if (this.#failure) {
      throw this.#failure.error;
    }
  }

  /**
   * Commit the terminal transition (and anything still batched), wait for
   * all outstanding writes, and rethrow the recorded storage failure if any.
   * The completed run's output is attached to the terminal record under
   * explicit `'full'` retention.
   */
  async finish(output: KernelRunOutput): Promise<void> {
    this.#output = output.output;
    this.#flushBatch();
    await this.#queue;
    if (this.#failure) {
      throw this.#failure.error;
    }
  }

  /**
   * Await outstanding writes after an execution error. Best effort: flush
   * the last factual batch so the durable record reflects what happened,
   * then surface the recorded storage failure (if any) or the given error.
   */
  async settle(error: unknown): Promise<never> {
    try {
      this.#flushBatch();
      await this.#queue;
    } catch {
      /* the recorded storage failure below takes precedence */
    }
    if (this.#failure) {
      throw this.#failure.error;
    }
    throw error;
  }

  #enqueue(write: () => Promise<void>): void {
    this.#queue = this.#queue.then(() => {
      if (this.#failure) {
        return;
      }
      return write().catch((error: unknown) => {
        if (!this.#failure) {
          this.#failure = { error };
        }
      });
    });
  }

  #enqueueCreate(event: KernelEvent): void {
    this.#expectedRecordRevision = 1;
    this.#expectedEventSeq += 1;
    this.#enqueue(async () => {
      await this.#execution.createRun({
        runId: this.#context.runId,
        graphId: this.#context.graphId,
        graphVersion: this.#context.graphVersion,
        capabilitySetVersion: this.#context.capabilitySetVersion,
        activationVersion: this.#context.activationVersion,
        mode: this.#context.mode,
        retention: this.#context.retention,
        currentNodeId: this.#context.entryNodeId,
        steps: 0,
        events: [event],
        timestamp: event.timestamp,
      });
    });
  }

  #appendSingle(event: KernelEvent): void {
    const expectedRevision = this.#expectedRecordRevision;
    const expectedSeq = this.#expectedEventSeq;
    this.#expectedRecordRevision += 1;
    this.#expectedEventSeq += 1;
    this.#enqueue(async () => {
      await this.#execution.commitTransition({
        runId: this.#context.runId,
        expectedRecordRevision: expectedRevision,
        expectedNextEventSeq: expectedSeq,
        next: {},
        events: [event],
        timestamp: event.timestamp,
      });
    });
  }

  #flushBatch(): void {
    if (this.#batch.length === 0) {
      return;
    }
    const batch = this.#batch;
    this.#batch = [];
    const batchNodeId = this.#batchNodeId;
    this.#batchNodeId = null;

    const expectedRevision = this.#expectedRecordRevision;
    const expectedSeq = this.#expectedEventSeq;
    this.#expectedRecordRevision += 1;
    this.#expectedEventSeq += batch.length;

    const last = batch.at(-1) as KernelEvent;
    const timestamp = last.timestamp;

    let next: RunStateUpdate = { status: 'running', currentNodeId: batchNodeId };

    if (
      last.type === 'run.completed' ||
      last.type === 'run.failed' ||
      last.type === 'run.blocked'
    ) {
      const status =
        last.type === 'run.completed'
          ? 'completed'
          : last.type === 'run.failed'
            ? 'failed'
            : 'blocked';
      const terminalFields: {
        status: 'completed' | 'failed' | 'blocked';
        steps: number;
        completedAt: number;
        error?: VictError;
        outputSummary?: OutputSummary;
        output?: unknown;
      } = {
        status,
        steps: last.steps,
        completedAt: timestamp,
      };
      if (last.type === 'run.failed') {
        terminalFields.error = last.error as VictError;
      }
      if (last.type === 'run.completed') {
        // Retention boundary (DATA-004/005): 'none' stores no summary at all;
        // the complete output rides only under explicit 'full' retention.
        if (this.#context.retention !== 'none') {
          terminalFields.outputSummary = last.output as OutputSummary;
        }
        if (this.#context.retention === 'full' && this.#output !== undefined) {
          terminalFields.output = this.#output;
        }
      }
      // 'run.blocked' keeps its reason/remediation/code in the event payload;
      // the record itself needs no fields beyond terminal status.
      next = { ...next, ...terminalFields };
    }

    this.#enqueue(async () => {
      await this.#execution.commitTransition({
        runId: this.#context.runId,
        expectedRecordRevision: expectedRevision,
        expectedNextEventSeq: expectedSeq,
        next,
        events: batch,
        timestamp,
      });
    });
  }
}

/** True when the given error is a structured store failure (safe to surface). */
export function isStoreError(error: unknown): error is VictStoreError {
  return error instanceof VictStoreError;
}
