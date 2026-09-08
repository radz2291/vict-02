/** Minimal test-runner seam: the caller supplies the framework bindings. */
export interface ConformanceRunner {
  describe(name: string, fn: () => void): void;
  it(name: string, fn: () => Promise<void> | void): void;
  expect<T>(actual: T): {
    toBe(expected: T): void;
    toEqual(expected: unknown): void;
    toHaveLength(n: number): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toContain(expected: unknown): void;
    not: {
      toContain(expected: unknown): void;
      toBe(expected: T): void;
    };
    resolves: {
      toEqual(expected: unknown): Promise<void>;
      toBeDefined(): Promise<void>;
      toBeUndefined(): Promise<void>;
    };
    rejects: { toThrow(pattern?: RegExp | string): Promise<void> };
  };
}
import { createInMemoryAgentControlStores } from './control-in-memory.js';
import type {
  AgentApprovalRecord,
  AgentControlStores,
  AgentStreamLedgerEvent,
  AgentToolInvocationRecord,
  AgentTurnRecord,
  ApplicationReleaseRecord,
  ChangeSetApprovalDecision,
  ChangeSetRecord,
  ControlAuditEvent,
} from './control-types.js';
import {
  controlContentHash,
  validateChangeSetContent,
  VICT_IDEMPOTENCY_FENCE_CONFLICT,
} from './control-types.js';

/**
 * Stage 06B shared conformance suite for the control-plane and
 * agent-execution stores. The SAME behavioral source runs against the
 * in-memory reference adapter AND the durable SQLite adapter, so the two
 * adapters cannot diverge on:
 *
 * - ChangeSet durability (idempotent save, collision rejection,
 *   content-identity guard on raw updates, first-wins approval decisions);
 * - release governance (immutable publish, monotonic selections,
 *   rollback-as-select);
 * - audit events (idempotent append, filtered reads);
 * - turn state machine (forward-only, terminal fencing, cancel-intent
 *   dedup, restart reconciliation);
 * - tool invocations (durable-before-invocation intent, idempotency-key
 *   dedup with digest collision detection, terminal fencing);
 * - approval records (one pending per invocation, first decision wins,
 *   idempotent identical decisions, expiry);
 * - stream ledger (strictly monotonic per-stream sequences, transient
 *   delta non-persistence, durable milestone rows, ordered replay,
 *   reopen equivalence).
 */

/** A conformance factory producing a store set. */
export interface AgentControlConformanceFactory {
  readonly name: string;
  create(options?: {
    readonly path?: string;
  }): Promise<AgentControlStores & { dispose(): Promise<void> | void }>;
  /** A fresh durable database path for one reopen scenario. */
  freshPath?(): string;
  /** Reopen the SAME durable state in a fresh adapter instance (SQLite). */
  reopen?(options: {
    readonly path: string;
  }): Promise<AgentControlStores & { dispose(): Promise<void> | void }>;
}

/** Valid ChangeSet content fixture. */
function changesetContentFixture(
  overrides: Record<string, unknown> = {},
): Parameters<typeof validateChangeSetContent>[0] {
  return {
    changesetId: 'changeset-cf-1',
    authorActorId: 'actor-author',
    createdAt: 1000,
    base: { kind: 'release', subjectId: 'app.cf', expectedVersion: 'release-cf-1' },
    operations: [
      {
        kind: 'select-activation',
        graphId: 'graph.cf',
        activationVersion: 'v2_cfactivation',
      },
    ],
    rationale: 'Conformance proposal',
    riskClass: 'low',
    requiredApproverCount: 1,
    expiresAt: 9000,
    ...overrides,
  };
}

function makeChangeSetRecord(
  overrides: Record<string, unknown> = {},
  contentOverrides: Record<string, unknown> = {},
): ChangeSetRecord {
  const content = changesetContentFixture(contentOverrides);
  const validated = validateChangeSetContent(content);
  return {
    changesetId: content.changesetId,
    schema: 'vict.changeset@1',
    authorActorId: content.authorActorId,
    createdAt: content.createdAt,
    base: validated.base,
    operations: validated.operations,
    rationale: validated.rationale,
    riskClass: validated.riskClass,
    requiredApproverCount: validated.requiredApproverCount,
    expiresAt: validated.expiresAt,
    validation: undefined,
    simulation: undefined,
    contentHash: validated.contentHash,
    status: 'draft',
    ...overrides,
  } as ChangeSetRecord;
}

function makeReleaseFixture(releaseVersion: string): ApplicationReleaseRecord {
  return {
    releaseVersion,
    applicationId: 'app.cf',
    applicationVersion: 'appver-cf-1',
    rendererIdentity: 'renderer-svelte@1',
    componentRegistryIdentity: 'registry@1',
    dataAdapterIdentity: 'appdata-sqlite@1',
    activationBinding: 'activation-cf-1',
    publishedByActorId: 'actor-author',
    publishedAt: 1000,
    contentHash: controlContentHash({ releaseVersion, applicationId: 'app.cf' }),
  };
}

function makeTurnFixture(turnId: string): AgentTurnRecord {
  return {
    turnId,
    streamId: `stream-${turnId}`,
    threadId: 'thread-cf-1',
    actorId: 'actor-turn',
    agentProfileVersion: 'v1_turncf',
    activationVersion: 'v1_actcf',
    applicationReleaseVersion: undefined,
    inputSummary: 'input-summary-only',
    status: 'intent',
    createdAt: 1000,
    updatedAt: 1000,
    terminalAt: undefined,
    errorCode: undefined,
    traceId: undefined,
    victRunId: undefined,
    mastraRunId: undefined,
  };
}

function makeInvocationFixture(invocationId: string, turnId: string): AgentToolInvocationRecord {
  return {
    invocationId,
    turnId,
    toolCallId: `call-${invocationId}`,
    toolName: 'cap.one',
    capabilityId: 'cap.one',
    capabilityRevision: '1',
    effect: 'write',
    idempotencyKey: `key-${invocationId}`,
    actorId: 'actor-turn',
    argDigest: 'digest-cf',
    argumentSummary: 'safe-summary',
    status: 'intent',
    createdAt: 1000,
    updatedAt: 1000,
    completedAt: undefined,
    resultSummary: undefined,
    errorCode: undefined,
  };
}

function makeApprovalFixture(
  approvalId: string,
  invocationId: string,
  turnId = 'turn-cf',
): AgentApprovalRecord {
  return {
    approvalId,
    kind: 'tool-invocation',
    turnId,
    invocationId,
    toolCallId: `call-${invocationId}`,
    toolName: 'cap.one',
    capabilityId: 'cap.one',
    capabilityRevision: '1',
    effect: 'write',
    actorId: 'actor-requester',
    agentProfileVersion: 'v1_turncf',
    argDigest: 'digest-cf',
    environment: 'local',
    requiredApproverRole: 'approver',
    status: 'pending',
    createdAt: 1000,
    expiresAt: 9000,
    decidedAt: undefined,
    approverActorId: undefined,
    decisionReason: undefined,
  };
}

/** Build and run the conformance suite against one store factory. */
export function runAgentControlConformanceSuite(
  factory: AgentControlConformanceFactory,
  runner: ConformanceRunner,
): void {
  const { it: t, expect } = runner;

  // ---- Corrective-finalization stores: runs, receipts, CAS, idempotency ----

  t(
    `[${factory.name}] control runs: idempotent record, content collision, exact read`,
    async () => {
      const stores = await factory.create();
      try {
        const record = makeChangeSetRecord();
        await stores.control.saveChangeSet(record);
        const run = {
          runId: 'run-cf-1',
          kind: 'validation',
          changesetId: record.changesetId,
          contentHash: record.contentHash,
          base: record.base,
          operations: record.operations,
          runnerProfile: 'vict.control-plane@1',
          actorId: 'actor-author',
          outcome: 'passed',
          createdAt: 5000,
        } as const;
        await stores.control.recordControlRun(run);
        await stores.control.recordControlRun(run); // idempotent re-record
        const stored = await stores.control.getControlRun('run-cf-1');
        expect(stored?.outcome).toBe('passed');
        expect(stored?.runnerProfile).toBe('vict.control-plane@1');
        await expect(
          stores.control.recordControlRun({ ...run, outcome: 'failed' }),
        ).rejects.toThrow(/different content/);
        expect(await stores.control.getControlRun('run-ghost')).toEqual(undefined);
      } finally {
        await stores.dispose();
      }
    },
  );

  t(`[${factory.name}] operation receipts: idempotent, ordered, collision-guarded`, async () => {
    const stores = await factory.create();
    try {
      const receipt = (index: number, effectRef: string) => ({
        changesetId: 'changeset-cf-1',
        operationIndex: index,
        operationKind: 'select-release' as const,
        operationDigest: `digest-${index}`,
        effectRef,
        actorId: 'actor-author',
        appliedAt: 6000 + index,
        state: 'applied' as const,
        guardJson: undefined,
      });
      // The two-state operation protocol: a PREPARED intent is recorded
      // first; conflicting content under the SAME identity fails closed;
      // the applied state settles it idempotently.
      const intent = {
        ...receipt(0, 'op:digest-0'),
        state: 'prepared' as const,
        guardJson: '{"expectedBaseVersion":"release-cf-1"}',
      };
      expect(await stores.control.recordOperationIntent(intent)).toBe('recorded');
      expect(await stores.control.recordOperationIntent(intent)).toBe('exists'); // idempotent
      await expect(
        stores.control.recordOperationIntent({
          ...intent,
          operationDigest: 'digest-DIFFERENT',
        }),
      ).rejects.toThrow(/conflicting content fails closed|different content/i);
      const marked = await stores.control.markOperationApplied({
        changesetId: 'changeset-cf-1',
        operationIndex: 0,
        at: 6100,
      });
      expect(marked.state).toBe('applied');
      await stores.control.recordOperationReceipt(receipt(1, 'effect:b'));
      const list = await stores.control.listOperationReceipts('changeset-cf-1');
      expect(list.map((entry) => entry.operationIndex)).toEqual([0, 1]);
      await expect(
        stores.control.recordOperationReceipt({ ...receipt(0, 'effect:a'), appliedAt: 9999 }),
      ).rejects.toThrow(/different content/);
    } finally {
      await stores.dispose();
    }
  });

  t(
    `[${factory.name}] compare-and-set status: exactly one winner, conflict otherwise`,
    async () => {
      const stores = await factory.create();
      try {
        const record = makeChangeSetRecord();
        await stores.control.saveChangeSet(record);
        const first = await stores.control.compareAndSetChangeSetStatus({
          changesetId: record.changesetId,
          expectedStatus: 'draft',
          nextStatus: 'applying',
        });
        expect(first.status).toBe('applying');
        await expect(
          stores.control.compareAndSetChangeSetStatus({
            changesetId: record.changesetId,
            expectedStatus: 'draft',
            nextStatus: 'committed',
          }),
        ).rejects.toThrow(/not in the expected status/);
        const second = await stores.control.compareAndSetChangeSetStatus({
          changesetId: record.changesetId,
          expectedStatus: 'applying',
          nextStatus: 'committed',
        });
        expect(second.status).toBe('committed');
      } finally {
        await stores.dispose();
      }
    },
  );

  t(
    `[${factory.name}] command idempotency: namespaced claim/complete/fail with one winner`,
    async () => {
      const stores = await factory.create();
      try {
        const receipt = {
          idempotencyKey: 'key-cf-1',
          actorId: 'actor-author',
          command: 'changeset.propose',
          requestDigest: 'digest-cf-1',
          status: 'pending',
          responseCode: undefined,
          resultJson: undefined,
          createdAt: 7000,
          settledAt: undefined,
          owner: 'svc-cf-1',
          leaseUntil: 8000,
          attempts: 1,
          fenceToken: 'fence-cf-1',
        } as const;
        expect(await stores.commandIdempotency.claimReceipt(receipt)).toBe('claimed');
        expect(await stores.commandIdempotency.claimReceipt(receipt)).toBe('exists');
        await stores.commandIdempotency.completeReceipt({
          actorId: 'actor-author',
          command: 'changeset.propose',
          idempotencyKey: 'key-cf-1',
          resultJson: '{"changesetId":"changeset-cf-1","status":"draft"}',
          at: 7001,
          fenceToken: 'fence-cf-1',
        });
        const completed = await stores.commandIdempotency.getReceipt({
          actorId: 'actor-author',
          command: 'changeset.propose',
          idempotencyKey: 'key-cf-1',
        });
        expect(completed?.status).toBe('completed');
        expect(completed?.resultJson).toBe('{"changesetId":"changeset-cf-1","status":"draft"}');
        // A settled receipt is never overwritten (and the fence no longer
        // owns a pending claim).
        await expect(
          stores.commandIdempotency.failReceipt({
            actorId: 'actor-author',
            command: 'changeset.propose',
            idempotencyKey: 'key-cf-1',
            responseCode: 'VICT_X',
            at: 7002,
            fenceToken: 'fence-cf-1',
          }),
        ).rejects.toThrow(VICT_IDEMPOTENCY_FENCE_CONFLICT);
        expect(
          (
            await stores.commandIdempotency.getReceipt({
              actorId: 'actor-author',
              command: 'changeset.propose',
              idempotencyKey: 'key-cf-1',
            })
          )?.status,
        ).toBe('completed');
        // A failure disposition round-trips.
        await stores.commandIdempotency.claimReceipt({
          ...receipt,
          idempotencyKey: 'key-cf-2',
          fenceToken: 'fence-cf-2',
        });
        await stores.commandIdempotency.failReceipt({
          actorId: 'actor-author',
          command: 'changeset.propose',
          idempotencyKey: 'key-cf-2',
          responseCode: 'VICT_CONTROL_CHANGESET_EXISTS',
          at: 7003,
          fenceToken: 'fence-cf-2',
        });
        const failed = await stores.commandIdempotency.getReceipt({
          actorId: 'actor-author',
          command: 'changeset.propose',
          idempotencyKey: 'key-cf-2',
        });
        expect(failed?.status).toBe('failed');
        expect(failed?.responseCode).toBe('VICT_CONTROL_CHANGESET_EXISTS');
      } finally {
        await stores.dispose();
      }
    },
  );

  t(
    `[${factory.name}] command idempotency: NAMESPACED by actor+command — the same key never interferes across actors or commands`,
    async () => {
      const stores = await factory.create();
      try {
        const base = {
          idempotencyKey: 'shared-key',
          actorId: 'actor-a',
          command: 'changeset.propose',
          requestDigest: 'digest-a',
          status: 'pending' as const,
          responseCode: undefined,
          resultJson: undefined,
          createdAt: 7000,
          settledAt: undefined,
          owner: 'svc-a',
          leaseUntil: 9000,
          attempts: 1,
          fenceToken: 'fence-a',
        };
        expect(await stores.commandIdempotency.claimReceipt(base)).toBe('claimed');
        // A second actor claiming the SAME client-generated key is a
        // DIFFERENT namespace: claimed, never conflicts, never sees a's
        // receipt.
        expect(
          await stores.commandIdempotency.claimReceipt({
            ...base,
            actorId: 'actor-b',
            requestDigest: 'digest-b',
            fenceToken: 'fence-b',
          }),
        ).toBe('claimed');
        // The same key under a different command is also a different
        // namespace.
        expect(
          await stores.commandIdempotency.claimReceipt({
            ...base,
            command: 'release.select',
            fenceToken: 'fence-c',
          }),
        ).toBe('claimed');
        await stores.commandIdempotency.completeReceipt({
          actorId: 'actor-a',
          command: 'changeset.propose',
          idempotencyKey: 'shared-key',
          resultJson: '{"changesetId":"cs-a"}',
          at: 7001,
          fenceToken: 'fence-a',
        });
        const a = await stores.commandIdempotency.getReceipt({
          actorId: 'actor-a',
          command: 'changeset.propose',
          idempotencyKey: 'shared-key',
        });
        const b = await stores.commandIdempotency.getReceipt({
          actorId: 'actor-b',
          command: 'changeset.propose',
          idempotencyKey: 'shared-key',
        });
        expect(a?.status).toBe('completed');
        expect(b?.status).toBe('pending');
      } finally {
        await stores.dispose();
      }
    },
  );

  t(
    `[${factory.name}] command idempotency: pending leases recover — expired claims are taken over, live claims are protected, retryable failures release`,
    async () => {
      const stores = await factory.create();
      try {
        await stores.commandIdempotency.claimReceipt({
          idempotencyKey: 'lease-key',
          actorId: 'actor-author',
          command: 'changeset.commit',
          requestDigest: 'digest-lease',
          status: 'pending',
          responseCode: undefined,
          resultJson: undefined,
          createdAt: 7000,
          settledAt: undefined,
          owner: 'svc-crashed',
          leaseUntil: 7050,
          attempts: 1,
          fenceToken: 'fence-crashed',
        });
        // A live lease is protected.
        expect(
          await stores.commandIdempotency.takeOverExpiredLease({
            actorId: 'actor-author',
            command: 'changeset.commit',
            idempotencyKey: 'lease-key',
            owner: 'svc-retry',
            leaseUntil: 7100,
            at: 7049,
          }),
        ).toEqual({ outcome: 'not-expired' });
        // After expiry the crashed claim is taken over (attempt counter
        // incremented, NEW fence token) — the key is never stuck as
        // in-progress forever.
        const takeover = await stores.commandIdempotency.takeOverExpiredLease({
          actorId: 'actor-author',
          command: 'changeset.commit',
          idempotencyKey: 'lease-key',
          owner: 'svc-retry',
          leaseUntil: 7150,
          at: 7051,
        });
        expect(takeover.outcome).toBe('taken');
        if (takeover.outcome !== 'taken') throw new Error('unreachable');
        expect(takeover.fenceToken === undefined).toBe(false);
        expect(takeover.fenceToken).not.toBe('fence-crashed');
        const taken = await stores.commandIdempotency.getReceipt({
          actorId: 'actor-author',
          command: 'changeset.commit',
          idempotencyKey: 'lease-key',
        });
        expect(taken?.owner).toBe('svc-retry');
        expect(taken?.attempts).toBe(2);
        expect(taken?.fenceToken).toBe(takeover.fenceToken);
        // A STALE owner (the crashed claimer's old fence token) can neither
        // settle nor release: stable conflict, receipt byte-identical.
        const beforeStale = JSON.stringify(
          await stores.commandIdempotency.getReceipt({
            actorId: 'actor-author',
            command: 'changeset.commit',
            idempotencyKey: 'lease-key',
          }),
        );
        await expect(
          stores.commandIdempotency.completeReceipt({
            actorId: 'actor-author',
            command: 'changeset.commit',
            idempotencyKey: 'lease-key',
            resultJson: '{"stale":true}',
            at: 7052,
            fenceToken: 'fence-crashed',
          }),
        ).rejects.toThrow(VICT_IDEMPOTENCY_FENCE_CONFLICT);
        await expect(
          stores.commandIdempotency.releaseReceipt({
            actorId: 'actor-author',
            command: 'changeset.commit',
            idempotencyKey: 'lease-key',
            at: 7052,
            fenceToken: 'fence-crashed',
          }),
        ).rejects.toThrow(VICT_IDEMPOTENCY_FENCE_CONFLICT);
        expect(
          JSON.stringify(
            await stores.commandIdempotency.getReceipt({
              actorId: 'actor-author',
              command: 'changeset.commit',
              idempotencyKey: 'lease-key',
            }),
          ),
        ).toBe(beforeStale);
        // A retryable infrastructure failure RELEASES the claim (fenced).
        await stores.commandIdempotency.releaseReceipt({
          actorId: 'actor-author',
          command: 'changeset.commit',
          idempotencyKey: 'lease-key',
          at: 7052,
          fenceToken: takeover.fenceToken,
        });
        expect(
          await stores.commandIdempotency.getReceipt({
            actorId: 'actor-author',
            command: 'changeset.commit',
            idempotencyKey: 'lease-key',
          }),
        ).toBeUndefined();
      } finally {
        await stores.dispose();
      }
    },
  );

  t(
    `[${factory.name}] release selection: operation-identity idempotency and the SUBJECT-LEVEL base CAS`,
    async () => {
      const stores = await factory.create();
      try {
        await stores.control.publishRelease(makeReleaseFixture('release-sel-1'));
        await stores.control.publishRelease(makeReleaseFixture('release-sel-2'));
        await stores.control.publishRelease(makeReleaseFixture('release-sel-3'));
        await stores.control.selectRelease({
          applicationId: 'app.cf',
          releaseVersion: 'release-sel-1',
          actorId: 'actor-author',
          at: 100,
          reason: 'select',
        });
        // Operation identity: re-application returns the ORIGINAL revision
        // without adding another selection; conflicting content under the
        // same identity fails closed.
        const first = await stores.control.selectRelease({
          applicationId: 'app.cf',
          releaseVersion: 'release-sel-2',
          actorId: 'actor-author',
          at: 200,
          reason: 'select',
          operationId: 'op-sel-1',
          expectedBaseVersion: 'release-sel-1',
        });
        const again = await stores.control.selectRelease({
          applicationId: 'app.cf',
          releaseVersion: 'release-sel-2',
          actorId: 'actor-author',
          at: 300,
          reason: 'select',
          operationId: 'op-sel-1',
          expectedBaseVersion: 'release-sel-2',
        });
        expect(again.selectionRevision).toBe(first.selectionRevision);
        const selections = await stores.control.listReleaseSelections('app.cf');
        expect(selections).toHaveLength(2); // seed + exactly ONE operation selection
        expect(selections.at(-1)?.operationId).toBe('op-sel-1');
        await expect(
          stores.control.selectRelease({
            applicationId: 'app.cf',
            releaseVersion: 'release-sel-3',
            actorId: 'actor-author',
            at: 400,
            reason: 'select',
            operationId: 'op-sel-1',
          }),
        ).rejects.toThrow(/conflicting content fails closed/i);
        // Base CAS: a second writer fencing on the SAME base loses with the
        // stable stale-base conflict and NO effect.
        await expect(
          stores.control.selectRelease({
            applicationId: 'app.cf',
            releaseVersion: 'release-sel-3',
            actorId: 'actor-2',
            at: 500,
            reason: 'select',
            operationId: 'op-sel-2',
            expectedBaseVersion: 'release-sel-1',
          }),
        ).rejects.toThrow(/base changed|exactly one concurrent/i);
        expect(await stores.control.listReleaseSelections('app.cf')).toHaveLength(2);
        // The winner fencing on the CURRENT base succeeds.
        await stores.control.selectRelease({
          applicationId: 'app.cf',
          releaseVersion: 'release-sel-3',
          actorId: 'actor-2',
          at: 600,
          reason: 'select',
          operationId: 'op-sel-3',
          expectedBaseVersion: 'release-sel-2',
        });
        expect((await stores.control.getSelectedRelease('app.cf'))?.releaseVersion).toBe(
          'release-sel-3',
        );
      } finally {
        await stores.dispose();
      }
    },
  );

  t(
    `[${factory.name}] stream ledger STORE-BOUNDARY validation: hostile writes are rejected without mutating sequence state`,
    async () => {
      const stores = await factory.create();
      try {
        const context =
          '"actorId":"actor-author","agentProfileVersion":"p","threadId":"thread-gate","turnId":"turn-gate"';
        // Seed one valid event so a rejected append must leave seq at 1.
        await stores.streamLedger.appendEvent({
          streamId: 'stream-gate',
          kind: 'response.started',
          payload: `{"actorId":"actor-author","agentProfileVersion":"p","kind":"response.started","threadId":"thread-gate","turnId":"turn-gate"}`,
          at: 1000,
        });
        expect(await stores.streamLedger.latestSeq('stream-gate')).toBe(1);
        // Unknown kind.
        await expect(
          stores.streamLedger.appendEvent({
            streamId: 'stream-gate',
            kind: 'evil.kind' as never,
            payload: `{"actorId":"actor-author","agentProfileVersion":"p","kind":"evil.kind","secret":"LEDGER-CANARY-GATE","threadId":"thread-gate","turnId":"turn-gate"}`,
            at: 1001,
          }),
        ).rejects.toThrow(/vict.agent-stream@1|kind/);
        // Declared kind mismatched with the payload kind.
        await expect(
          stores.streamLedger.appendEvent({
            streamId: 'stream-gate',
            kind: 'response.completed',
            payload: `{"actorId":"actor-author","agentProfileVersion":"p","code":"VICT_X","kind":"response.failed","threadId":"thread-gate","turnId":"turn-gate"}`,
            at: 1002,
          }),
        ).rejects.toThrow(/kind/);
        // Non-canonical JSON.
        await expect(
          stores.streamLedger.appendEvent({
            streamId: 'stream-gate',
            kind: 'response.completed',
            payload: `{  "kind" :  "response.completed",  ${context}}`,
            at: 1003,
          }),
        ).rejects.toThrow(/canonical/);
        // Raw text in content.completed (contentRef discipline).
        await expect(
          stores.streamLedger.appendEvent({
            streamId: 'stream-gate',
            kind: 'content.completed',
            payload: `{"actorId":"actor-author","agentProfileVersion":"p","kind":"content.completed","text":"raw secret content","threadId":"thread-gate","turnId":"turn-gate"}`,
            at: 1004,
          }),
        ).rejects.toThrow(/vict.agent-stream@1|UNKNOWN_FIELD|CONTENT_REF|kind/);
        // Malformed correlation id.
        await expect(
          stores.streamLedger.appendEvent({
            streamId: 'stream-gate',
            kind: 'response.completed',
            payload: `{"actorId":"actor-author","agentProfileVersion":"p","kind":"response.completed","threadId":"thread-gate","turnId":"turn-gate","victRunId":"bad id with spaces"}`,
            at: 1005,
          }),
        ).rejects.toThrow(/vict.agent-stream@1|INVALID_ID/);
        // NOTHING mutated: the sequence state and rows are unchanged and no
        // canary reached storage.
        expect(await stores.streamLedger.latestSeq('stream-gate')).toBe(1);
        expect((await stores.streamLedger.listEventsFrom('stream-gate', 0)).length).toBe(1);
        for (const row of await stores.streamLedger.listEventsFrom('stream-gate', 0)) {
          expect(row.payload).not.toContain('LEDGER-CANARY-GATE');
        }
      } finally {
        await stores.dispose();
      }
    },
  );

  // ---- ChangeSets ----------------------------------------------------------
  t(`[${factory.name}] changeset save/get round-trips and duplicate ids are rejected`, async () => {
    const stores = await factory.create();
    try {
      const record = makeChangeSetRecord();
      await stores.control.saveChangeSet(record);
      const stored = await stores.control.getChangeSet(record.changesetId);
      expect(stored).toEqual(record);
      await expect(stores.control.saveChangeSet(record)).rejects.toThrow(/already exists/);
      await expect(
        stores.control.saveChangeSet(makeChangeSetRecord({}, { rationale: 'different content' })),
      ).rejects.toThrow(/already exists/);
    } finally {
      await stores.dispose();
    }
  });

  t(`[${factory.name}] changeset raw update enforces the immutable content identity`, async () => {
    const stores = await factory.create();
    try {
      const record = makeChangeSetRecord();
      await stores.control.saveChangeSet(record);
      await stores.control.updateChangeSet(record.changesetId, (current) => ({
        ...current,
        status: 'approved',
      }));
      const updated = await stores.control.getChangeSet(record.changesetId);
      expect(updated?.status).toBe('approved');
      // Content mutation through the raw store update is refused.
      await expect(
        stores.control.updateChangeSet(record.changesetId, (current) => ({
          ...current,
          rationale: 'mutated',
          contentHash: controlContentHash({ tampered: true }),
        })),
      ).rejects.toThrow(/immutable content identity/);
    } finally {
      await stores.dispose();
    }
  });

  t(
    `[${factory.name}] changeset approval decisions: first wins, identical idempotent, conflict rejected`,
    async () => {
      const stores = await factory.create();
      try {
        const record = makeChangeSetRecord();
        await stores.control.saveChangeSet(record);
        const decision = (overrides: Record<string, unknown>): ChangeSetApprovalDecision => ({
          approvalId: `csa-${overrides.approver ?? 'a1'}`,
          changesetId: record.changesetId,
          contentHash: record.contentHash,
          approverActorId: (overrides.approver as string) ?? 'approver-1',
          decision: (overrides.decision as 'approved' | 'declined') ?? 'approved',
          decidedAt: 2000,
        });
        await stores.control.recordChangeSetApproval(decision({}));
        await stores.control.recordChangeSetApproval(decision({})); // idempotent
        await expect(
          stores.control.recordChangeSetApproval(decision({ decision: 'declined' })),
        ).rejects.toThrow(/competing decision|first durable decision/i);
        const approvals = await stores.control.listChangeSetApprovals(record.changesetId);
        expect(approvals).toHaveLength(1);
        expect(approvals[0]?.decision).toBe('approved');
      } finally {
        await stores.dispose();
      }
    },
  );

  // ---- Release governance -----------------------------------------------------
  t(`[${factory.name}] release publish is immutable and idempotent; collision fails`, async () => {
    const stores = await factory.create();
    try {
      const release = makeReleaseFixture('release-cf-1');
      await stores.control.publishRelease(release);
      await stores.control.publishRelease(release); // idempotent
      const stored = await stores.control.getRelease('release-cf-1');
      expect(stored).toEqual(release);
      await expect(
        stores.control.publishRelease({ ...release, applicationVersion: 'appver-cf-2' }),
      ).rejects.toThrow(/immutability guard|different content/);
    } finally {
      await stores.dispose();
    }
  });

  t(
    `[${factory.name}] release select/rollback produce monotonic attributable selections`,
    async () => {
      const stores = await factory.create();
      try {
        await stores.control.publishRelease(makeReleaseFixture('release-cf-1'));
        await stores.control.publishRelease(makeReleaseFixture('release-cf-2'));
        const first = await stores.control.selectRelease({
          applicationId: 'app.cf',
          releaseVersion: 'release-cf-1',
          actorId: 'operator-1',
          at: 1000,
          reason: 'select',
        });
        expect(first.selectionRevision).toBe(1);
        const rollback = await stores.control.selectRelease({
          applicationId: 'app.cf',
          releaseVersion: 'release-cf-1',
          actorId: 'operator-1',
          at: 2000,
          reason: 'rollback',
        });
        expect(rollback.selectionRevision).toBe(2);
        const forward = await stores.control.selectRelease({
          applicationId: 'app.cf',
          releaseVersion: 'release-cf-2',
          actorId: 'operator-1',
          at: 3000,
          reason: 'select',
        });
        expect(forward.selectionRevision).toBe(3);
        const selections = await stores.control.listReleaseSelections('app.cf');
        expect(selections.map((selection) => selection.reason)).toEqual([
          'select',
          'rollback',
          'select',
        ]);
        expect((await stores.control.getSelectedRelease('app.cf'))?.releaseVersion).toBe(
          'release-cf-2',
        );
        await expect(
          stores.control.selectRelease({
            applicationId: 'app.cf',
            releaseVersion: 'release-missing',
            actorId: 'operator-1',
            at: 4000,
            reason: 'select',
          }),
        ).rejects.toThrow(/does not exist/);
      } finally {
        await stores.dispose();
      }
    },
  );

  // ---- Audit ------------------------------------------------------------------
  t(`[${factory.name}] audit events are idempotent and attributable`, async () => {
    const stores = await factory.create();
    try {
      const event = (auditId: string): ControlAuditEvent => ({
        auditId,
        at: 1000,
        actorId: 'actor-1',
        action: 'changeset.proposed',
        subjectType: 'changeset',
        subjectId: 'changeset-cf-1',
        summary: 'proposed',
      });
      await stores.control.appendAuditEvent(event('audit-1'));
      await stores.control.appendAuditEvent(event('audit-1')); // idempotent
      await stores.control.appendAuditEvent({ ...event('audit-2'), subjectId: 'other' });
      expect((await stores.control.listAuditEvents({})).length).toBe(2);
      expect(
        (await stores.control.listAuditEvents({ subjectId: 'changeset-cf-1' })).map(
          (entry) => entry.auditId,
        ),
      ).toEqual(['audit-1']);
    } finally {
      await stores.dispose();
    }
  });

  // ---- Turns ------------------------------------------------------------------
  t(`[${factory.name}] turn state machine is forward-only with terminal fencing`, async () => {
    const stores = await factory.create();
    try {
      await stores.turns.createTurnIntent(makeTurnFixture('turn-cf'));
      await expect(
        stores.turns.createTurnIntent(makeTurnFixture('turn-cf')),
      ).resolves.toBeUndefined(); // idempotent re-intent
      const started = await stores.turns.startTurn('turn-cf', 1100);
      expect(started.status).toBe('running');
      await expect(stores.turns.startTurn('turn-cf', 1200)).rejects.toThrow(/transition/);
      const awaiting = await stores.turns.awaitApproval('turn-cf', 1300, 'approval-cf');
      expect(awaiting.status).toBe('awaiting-approval');
      await stores.turns.resumeTurn('turn-cf', 1400);
      const completed = await stores.turns.completeTurn({
        turnId: 'turn-cf',
        status: 'completed',
        at: 1500,
      });
      expect(completed.status).toBe('completed');
      expect(completed.terminalAt).toBe(1500);
      // Terminal fencing: no late writes.
      await expect(
        stores.turns.completeTurn({ turnId: 'turn-cf', status: 'failed', at: 1600 }),
      ).rejects.toThrow(/transition/);
      // Cancel-intent deduplication.
      const firstCancel = await stores.turns.recordCancelIntent({
        turnId: 'turn-cf',
        cancelId: 'cancel-1',
        actorId: 'actor-1',
        reasonCode: 'user',
        at: 1000,
      });
      expect(firstCancel).toEqual({ accepted: true, duplicate: false });
      const secondCancel = await stores.turns.recordCancelIntent({
        turnId: 'turn-cf',
        cancelId: 'cancel-1',
        actorId: 'actor-1',
        reasonCode: 'user',
        at: 1001,
      });
      expect(secondCancel).toEqual({ accepted: false, duplicate: true });
      expect(await stores.turns.hasCancelIntent('turn-cf')).toBe(true);
    } finally {
      await stores.dispose();
    }
  });

  t(`[${factory.name}] turn restart reconciliation is idempotent and honest`, async () => {
    const stores = await factory.create();
    try {
      await stores.turns.createTurnIntent(makeTurnFixture('turn-rc'));
      await stores.turns.startTurn('turn-rc', 1100);
      const reconciled = await stores.turns.reconcileTurn({
        turnId: 'turn-rc',
        status: 'failed',
        reasonCode: 'VICT_TURN_INTERRUPTED',
        at: 2000,
      });
      expect(reconciled?.status).toBe('failed');
      expect(reconciled?.errorCode).toBe('VICT_TURN_INTERRUPTED');
      const again = await stores.turns.reconcileTurn({
        turnId: 'turn-rc',
        status: 'failed',
        reasonCode: 'VICT_TURN_INTERRUPTED',
        at: 2100,
      });
      expect(again?.status).toBe('failed');
      expect(again?.terminalAt).toBe(2000);
    } finally {
      await stores.dispose();
    }
  });

  // ---- Tool invocations --------------------------------------------------------
  t(
    `[${factory.name}] invocation intents are durable-before-invocation with key dedup`,
    async () => {
      const stores = await factory.create();
      try {
        await stores.turns.createTurnIntent(makeTurnFixture('turn-cf'));
        const invocation = makeInvocationFixture('inv-1', 'turn-cf');
        const recorded = await stores.invocations.recordInvocationIntent(invocation);
        expect(recorded.status).toBe('intent');
        await expect(stores.invocations.recordInvocationIntent(invocation)).resolves.toEqual(
          invocation,
        ); // idempotent
        // Same key, different digest: collision.
        await expect(
          stores.invocations.recordInvocationIntent({
            ...invocation,
            invocationId: 'inv-2',
            argDigest: 'different',
          }),
        ).rejects.toThrow(/digest|key/i);
        // Same key, same digest: the EXISTING invocation is returned.
        const same = await stores.invocations.recordInvocationIntent({
          ...invocation,
          invocationId: 'inv-2',
        });
        expect(same.invocationId).toBe('inv-1');
        const advanced = await stores.invocations.updateInvocationStatus({
          invocationId: 'inv-1',
          status: 'running',
          at: 1200,
        });
        expect(advanced.status).toBe('running');
        // Terminal fencing: late results are refused.
        await stores.invocations.updateInvocationStatus({
          invocationId: 'inv-1',
          status: 'completed',
          at: 1300,
          resultSummary: 'ok',
        });
        await expect(
          stores.invocations.updateInvocationStatus({
            invocationId: 'inv-1',
            status: 'failed',
            at: 1400,
            errorCode: 'LATE',
          }),
        ).rejects.toThrow(/terminal|fenced/i);
      } finally {
        await stores.dispose();
      }
    },
  );

  // ---- Approvals ---------------------------------------------------------------
  t(
    `[${factory.name}] approval records: first decision wins, expiry, one pending per invocation`,
    async () => {
      const stores = await factory.create();
      try {
        await stores.turns.createTurnIntent(makeTurnFixture('turn-cf'));
        const approval = makeApprovalFixture('approval-cf-1', 'inv-cf-1');
        const created = await stores.approvals.createPendingApproval(approval);
        expect(created.status).toBe('pending');
        // A duplicate create for the SAME invocation reuses the pending record.
        const reused = await stores.approvals.createPendingApproval({
          ...approval,
          approvalId: 'approval-cf-other',
        });
        expect(reused.approvalId).toBe('approval-cf-1');
        await stores.approvals.decideApproval({
          approvalId: 'approval-cf-1',
          approverActorId: 'approver-1',
          decision: 'approved',
          decidedAt: 1500,
        });
        await stores.approvals.decideApproval({
          approvalId: 'approval-cf-1',
          approverActorId: 'approver-1',
          decision: 'approved',
          decidedAt: 1600,
        }); // idempotent identical
        await expect(
          stores.approvals.decideApproval({
            approvalId: 'approval-cf-1',
            approverActorId: 'approver-2',
            decision: 'declined',
            decidedAt: 1700,
          }),
        ).rejects.toThrow(/competing|first durable/i);
        const expiredFixture = makeApprovalFixture('approval-cf-2', 'inv-cf-2');
        await stores.approvals.createPendingApproval(expiredFixture);
        const expired = await stores.approvals.expireApproval({
          approvalId: 'approval-cf-2',
          at: 2000,
        });
        expect(expired.status).toBe('expired');
        await expect(
          stores.approvals.decideApproval({
            approvalId: 'approval-cf-2',
            approverActorId: 'approver-1',
            decision: 'approved',
            decidedAt: 2100,
          }),
        ).rejects.toThrow(/expired/i);
      } finally {
        await stores.dispose();
      }
    },
  );

  // ---- Stream ledger -------------------------------------------------------------
  t(
    `[${factory.name}] stream ledger assigns strictly monotonic sequences and persists only durable kinds`,
    async () => {
      const stores = await factory.create();
      try {
        const first = await stores.streamLedger.appendEvent({
          streamId: 'stream-cf',
          kind: 'response.started',
          payload:
            '{"actorId":"actor-author","agentProfileVersion":"p","kind":"response.started","threadId":"thread-cf","turnId":"turn-cf"}',
          at: 1000,
        });
        const delta = await stores.streamLedger.appendEvent({
          streamId: 'stream-cf',
          kind: 'text.delta',
          payload:
            '{"actorId":"actor-author","agentProfileVersion":"p","delta":"he","kind":"text.delta","threadId":"thread-cf","turnId":"turn-cf"}',
          at: 1001,
        });
        const third = await stores.streamLedger.appendEvent({
          streamId: 'stream-cf',
          kind: 'content.completed',
          payload:
            '{"actorId":"actor-author","agentProfileVersion":"p","contentRef":"conversation:vict-actor-actor-author/thread-cf/turn-cf","kind":"content.completed","threadId":"thread-cf","turnId":"turn-cf"}',
          at: 1002,
        });
        expect(first.seq).toBe(1);
        expect(first.persisted).toBe(true);
        expect(delta.seq).toBe(2);
        expect(delta.persisted).toBe(false); // text.delta is transient
        expect(third.seq).toBe(3);
        expect(third.persisted).toBe(true);
        expect(await stores.streamLedger.latestSeq('stream-cf')).toBe(3);
        const rows = await stores.streamLedger.listEventsFrom('stream-cf', 0);
        expect(rows.map((row) => row.seq)).toEqual([1, 3]);
        expect((rows as readonly AgentStreamLedgerEvent[])[1]?.payload).toBe(
          '{"actorId":"actor-author","agentProfileVersion":"p","contentRef":"conversation:vict-actor-actor-author/thread-cf/turn-cf","kind":"content.completed","threadId":"thread-cf","turnId":"turn-cf"}',
        );
        // Paged reads return the SAME rows (bounded replay paging).
        const page1 = await stores.streamLedger.listEventsFrom('stream-cf', 0, 1);
        const page2 = await stores.streamLedger.listEventsFrom(
          'stream-cf',
          page1.at(-1)?.seq ?? 0,
          10,
        );
        expect(page1.map((row) => row.seq)).toEqual([1]);
        expect(page2.map((row) => row.seq)).toEqual([3]);
        expect((await stores.streamLedger.listEventsFrom('stream-cf', 3)).length).toBe(0);
      } finally {
        await stores.dispose();
      }
    },
  );

  // ---- Reopen equivalence -------------------------------------------------------
  const reopen = factory.reopen;
  const freshPath = factory.freshPath;
  if (reopen !== undefined && freshPath !== undefined) {
    t(
      `[${factory.name}] durable state survives close/reopen with identical semantics`,
      async () => {
        const path = freshPath();
        const stores = await factory.create({ path });
        const record = makeChangeSetRecord();
        await stores.control.saveChangeSet(record);
        await stores.control.recordChangeSetApproval({
          approvalId: 'csa-1',
          changesetId: record.changesetId,
          contentHash: record.contentHash,
          approverActorId: 'approver-1',
          decision: 'approved',
          decidedAt: 2000,
        });
        await stores.turns.createTurnIntent(makeTurnFixture('turn-reopen'));
        await stores.turns.startTurn('turn-reopen', 1100);
        await stores.turns.completeTurn({ turnId: 'turn-reopen', status: 'completed', at: 1200 });
        const invocation = makeInvocationFixture('inv-reopen', 'turn-reopen');
        await stores.invocations.recordInvocationIntent(invocation);
        await stores.invocations.updateInvocationStatus({
          invocationId: 'inv-reopen',
          status: 'completed',
          at: 1300,
          resultSummary: 'done',
        });
        await stores.approvals.createPendingApproval(
          makeApprovalFixture('approval-reopen', 'inv-reopen', 'turn-reopen'),
        );
        await stores.streamLedger.appendEvent({
          streamId: 'stream-reopen',
          kind: 'content.completed',
          payload:
            '{"actorId":"actor-author","agentProfileVersion":"p","contentRef":"conversation:vict-actor-actor-author/thread-reopen/turn-reopen","kind":"content.completed","threadId":"thread-reopen","turnId":"turn-reopen"}',
          at: 1400,
        });
        await stores.streamLedger.appendEvent({
          streamId: 'stream-reopen',
          kind: 'text.delta',
          payload:
            '{"actorId":"actor-author","agentProfileVersion":"p","delta":"gone","kind":"text.delta","threadId":"thread-reopen","turnId":"turn-reopen"}',
          at: 1401,
        });
        // A durable idempotency receipt must survive the close/reopen too.
        await stores.commandIdempotency.claimReceipt({
          idempotencyKey: 'key-reopen',
          actorId: 'actor-author',
          command: 'changeset.propose',
          requestDigest: 'digest-reopen',
          status: 'completed',
          responseCode: undefined,
          resultJson: '{"changesetId":"changeset-reopen"}',
          createdAt: 1402,
          settledAt: 1403,
          owner: undefined,
          leaseUntil: undefined,
          attempts: 1,
          fenceToken: undefined,
        });
        await stores.dispose();

        const reopened = await reopen({ path });
        try {
          const stored = await reopened.control.getChangeSet(record.changesetId);
          expect(stored?.contentHash).toBe(record.contentHash);
          expect((await reopened.control.listChangeSetApprovals(record.changesetId)).length).toBe(
            1,
          );
          const turn = await reopened.turns.getTurn('turn-reopen');
          expect(turn?.status).toBe('completed');
          const invocationReopened = await reopened.invocations.getInvocation('inv-reopen');
          expect(invocationReopened?.status).toBe('completed');
          const approvalReopened = await reopened.approvals.getApproval('approval-reopen');
          expect(approvalReopened?.status).toBe('pending');
          const rows = await reopened.streamLedger.listEventsFrom('stream-reopen', 0);
          expect(rows.map((row) => row.kind)).toEqual(['content.completed']);
          expect(await reopened.streamLedger.latestSeq('stream-reopen')).toBe(2);
          const receipt = await reopened.commandIdempotency.getReceipt({
            actorId: 'actor-author',
            command: 'changeset.propose',
            idempotencyKey: 'key-reopen',
          });
          expect(receipt?.status).toBe('completed');
          expect(receipt?.resultJson).toBe('{"changesetId":"changeset-reopen"}');
        } finally {
          await reopened.dispose();
        }
      },
    );
  }
}

/** Convenience: run the suite against the in-memory factory. */
export function inMemoryAgentControlConformanceFactory(): AgentControlConformanceFactory {
  return {
    name: 'in-memory',
    async create() {
      return { ...createInMemoryAgentControlStores(), dispose: (): void => undefined };
    },
  };
}

/** Unused-import guard kept minimal. */
void (undefined as unknown as (stores?: AgentControlStores) => void);
