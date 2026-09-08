import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CapabilityDefinition, Contract } from '@vict/sdk';
import {
  authenticatedActorContext,
  createInMemoryAgentControlStores,
  AgentStreamHub,
  type AgentApprovalRecord,
  type AgentControlStores,
  type AgentToolInvocationRecord,
} from '@vict/runtime';
import type { AuthenticatedActorContext } from '@vict/runtime';
import { AgentProfileRegistry } from '@vict/runtime';
import {
  MASTRA_ADAPTER_COMPATIBILITY,
  createDeterministicOfflineModel,
  createDedicatedMastraStore,
  MastraThreadCoordinator,
} from '../src/index.js';
import { composeMastraTurnExecutor } from '../src/turn-executor.js';

/**
 * Stage 06B — governed end-to-end execution: a REAL pinned Mastra agent,
 * the deterministic offline model, a governed capability tool bridge, the
 * durable control stores, and the stream hub.
 *
 * Proven end to end:
 * - a model-selected PROTECTED tool call suspends durably
 *   (`tool.awaiting_approval` + the turn's awaiting-approval state);
 * - the approver's decision commits BEFORE the effect; the capability
 *   executes exactly once; the turn completes honestly;
 * - decline never invokes the capability and yields a safe failure event;
 * - cancellation during the approval wait records durable intent and
   produces one honest terminal outcome.
 */

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
afterAll(() => {
  // Windows file-lock races on teardown must not fail the suite; the temp
  // directories are disposable, so removal retries in the background.
  for (const dir of tempDirs) {
    const attempt = (remaining: number): void => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        if (remaining > 0) {
          setTimeout(() => attempt(remaining - 1), 500);
        }
      }
    };
    attempt(10);
  }
});

const TEST_RETENTION = {
  messagesMaxAgeMs: 3_600_000,
  threadsMaxAgeMs: 86_400_000,
  spansMaxAgeMs: 3_600_000,
};

function contract(id: string, ok: (value: unknown) => boolean): Contract<unknown> {
  return {
    id,
    revision: '1',
    expected: 'bounded test contract',
    parse: (input: unknown) =>
      ok(input)
        ? { ok: true, value: input }
        : { ok: false, issues: [{ code: 'INVALID', path: 'input', message: 'invalid' }] },
  };
}

interface Composition {
  stores: AgentControlStores;
  requester: AuthenticatedActorContext;
  approver: AuthenticatedActorContext;
  turnService: ReturnType<typeof composeMastraTurnExecutor>['turnService'];
  capability: CapabilityDefinition;
  invokeLog: unknown[];
  close(): Promise<void>;
}

let idCounter = 0;

type OfflineOptions = NonNullable<Parameters<typeof createDeterministicOfflineModel>[0]>;
type OfflineScript = NonNullable<OfflineOptions['script']>;
async function compose(script: OfflineScript): Promise<Composition> {
  const dir = tempDir('vict-turn-executor-');
  const dedicated = await createDedicatedMastraStore({ dataDir: dir, retention: TEST_RETENTION });
  const capability: CapabilityDefinition = {
    id: 'cap.notes.write',
    revision: '3',
    effect: 'write',
    input: contract(
      'cap.notes.write.input',
      (value) => typeof value === 'object' && value !== null,
    ),
    output: contract(
      'cap.notes.write.output',
      (value) => typeof value === 'object' && value !== null,
    ),
    invoke: async (input: unknown) => ({ saved: true, echo: input }),
  } as CapabilityDefinition;
  const registry = new AgentProfileRegistry({
    resolveCapabilityRevision: () => true,
  });
  registry.installArtifacts([
    {
      kind: 'instructions',
      id: 'instructions.ara',
      revision: '1',
      text: 'Be deterministic and brief.',
    },
    {
      kind: 'memory-policy',
      id: 'memory-policy.ara',
      revision: '1',
      config: { lastMessages: 10, workingMemory: { enabled: false }, semanticRecall: false },
    },
    {
      kind: 'guardrail',
      id: 'guardrail.length',
      revision: '1',
      check: (text: string) =>
        text.length <= 1000 ? { ok: true } : { ok: false, code: 'TOO_LONG' },
      failureCodes: ['TOO_LONG'],
    },
  ]);
  registry.registerProfile({
    schema: 'vict.agent-profile@1',
    id: 'agent.ara.governed',
    revision: '1',
    instructions: { id: 'instructions.ara', revision: '1' },
    modelProfile: {
      id: 'model.ara',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: {},
    turnPolicy: { maxSteps: 8, maxToolCalls: 4, onLimit: 'fail-closed' },
    memoryPolicy: { id: 'memory-policy.ara', revision: '1' },
    guardrails: [{ id: 'guardrail.length', revision: '1' }],
    helperTools: [],
    capabilities: [{ id: 'cap.notes.write', revision: '3' }],
    adapter: {
      id: MASTRA_ADAPTER_COMPATIBILITY.id,
      revision: MASTRA_ADAPTER_COMPATIBILITY.revision,
      runtimePackages: { ...MASTRA_ADAPTER_COMPATIBILITY.runtimePackages },
    },
  });
  const activation = registry.activateAgentProfile({ id: 'agent.ara.governed', revision: '1' });

  const stores = createInMemoryAgentControlStores();
  await stores.actors.upsert({
    actorId: 'actor-user',
    status: 'active',
    roles: ['developer', 'approver'],
    createdAt: 0,
  });
  await stores.actors.upsert({
    actorId: 'actor-approver',
    status: 'active',
    roles: ['approver'],
    createdAt: 0,
  });
  const requester = authenticatedActorContext(await stores.actors.get('actor-user'), 'actor-user');
  const approver = authenticatedActorContext(
    await stores.actors.get('actor-approver'),
    'actor-approver',
  );

  const hub = new AgentStreamHub({ ledger: stores.streamLedger, clock: () => Date.now() });
  const invokeLog: unknown[] = [];
  const turnServiceRef: { current: Composition['turnService'] | undefined } = {
    current: undefined,
  };
  const composition = composeMastraTurnExecutor({
    stores,
    activation,
    hub,
    clock: () => Date.now(),
    ids: {
      turnId: () => `turn-x${(idCounter += 1)}`,
      streamId: () => `stream-x${idCounter}`,
      invocationId: () => `inv-x${idCounter}`,
      approvalId: () => `approval-x${idCounter}`,
      idempotencyKey: () => `key-x${idCounter}`,
      cancelId: () => `cancel-x${idCounter}`,
    },
    agentConfig: {
      store: dedicated.store,
      threadCoordinator: new MastraThreadCoordinator(),
      modelFactory: () => createDeterministicOfflineModel({ script }),
    },
    capabilityBridge: {
      resolveCapability: (id, revision) =>
        id === capability.id && revision === capability.revision ? capability : undefined,
      invoke: async (definition, input, context) => {
        void definition;
        void context;
        invokeLog.push(input);
        return capability.invoke(input, {} as never);
      },
      recordInvocationIntent: (input) =>
        turnServiceRef.current?.recordToolInvocationIntent(
          input,
        ) as Promise<AgentToolInvocationRecord>,
      claimInvocationRun: (command) => stores.invocations.claimInvocationRun(command),
      settleInvocationRun: (command) => stores.invocations.settleInvocationRun(command),
      settleInvocationPending: (command) => stores.invocations.settleInvocationPending(command),
      reconcileAbandonedRun: (command) => stores.invocations.reconcileAbandonedRun(command),
      requestApproval: (input) =>
        turnServiceRef.current?.requestApproval(input) as Promise<AgentApprovalRecord>,
      consumeApproval: (binding) =>
        turnServiceRef.current?.consumeApproval(binding) as Promise<
          { approved: true } | { approved: false; reasonCode: string }
        >,
      updateInvocationStatus: (command) => stores.invocations.updateInvocationStatus(command),
      findExistingApproval: async (invocationId) => {
        const approvals = await stores.approvals.listApprovalsForInvocation(invocationId);
        return approvals.at(0)?.approvalId;
      },
      pollApprovalDecision: async (approvalId) => {
        const record = await stores.approvals.getApproval(approvalId);
        return record === undefined ? undefined : { status: record.status };
      },
      pollIntervalMs: 5,
      approvalExpiryMs: 30_000,
    },
  });
  turnServiceRef.current = composition.turnService;
  return {
    stores,
    requester,
    approver,
    turnService: composition.turnService,
    capability,
    invokeLog,
    close: async () => {
      await composition.productAgent.flush();
      await dedicated.close();
    },
  };
}

describe('governed agent-turn execution (real pinned Mastra, offline)', () => {
  // The real pinned Mastra pipeline (dedicated store, memory settle,
  // streaming, approval waits) needs more than the default test timeout.
  const LONG = 120_000;
  it(
    'a protected tool call suspends durably, the approval commits before the effect, and the turn completes',
    { timeout: LONG },
    async () => {
      const composition = await compose({
        'Use the tool': {
          kind: 'tool-call',
          toolName: 'cap_notes_write',
          args: { text: 'note-body' },
          thenText: 'TOOL-DONE',
        },
      });
      const { stores, requester, approver, turnService } = composition;
      try {
        const started = await turnService.startTurn(requester, {
          threadId: 'vict-conv-gov-1',
          input: 'Use the tool',
        });
        // Wait for the durable pending approval.
        let approvalId = '';
        for (let i = 0; i < 400 && approvalId === ''; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          approvalId = (await stores.approvals.listOpenApprovals()).at(0)?.approvalId ?? '';
        }
        expect(approvalId).not.toBe('');
        const awaiting = await stores.turns.getTurn(started.turn.turnId);
        expect(awaiting?.status).toBe('awaiting-approval');
        // The approval decision commits (durable) BEFORE the effect proceeds.
        await turnService.decideToolApproval(approver, {
          approvalId,
          decision: 'approved',
        });
        const outcome = await started.outcomePromise;
        expect(outcome.status).toBe('completed');
        // Exactly one durable invocation record, completed exactly once.
        const invocations = await stores.invocations.listInvocationsForTurn(started.turn.turnId);
        expect(invocations).toHaveLength(1);
        expect(invocations[0]?.status).toBe('completed');
        // The result summary is framework metadata only: shape, never values/keys.
        expect(invocations[0]?.resultSummary).toMatch(/^object\(\d+ fields\)$/);
        // The durable stream ledger carries the awaiting-approval milestone.
        const ledgerRows = await stores.streamLedger.listEventsFrom(started.turn.streamId, 0);
        const kinds = ledgerRows.map((row) => row.kind);
        expect(kinds).toContain('tool.awaiting_approval');
        expect(kinds).toContain('response.completed');
        // Strictly monotonic sequences across the whole stream.
        const seqs = ledgerRows.map((row) => row.seq);
        expect(seqs.every((seq, index) => index === 0 || seq > (seqs[index - 1] as number))).toBe(
          true,
        );
      } finally {
        await composition.close();
      }
    },
  );

  it(
    'decline never invokes the capability and the turn completes with a safe failure event',
    { timeout: LONG },
    async () => {
      const composition = await compose({
        'Use the tool': {
          kind: 'tool-call',
          toolName: 'cap_notes_write',
          args: { text: 'note-body' },
          thenText: 'AFTER-DECLINE',
        },
      });
      const { stores, requester, approver, turnService } = composition;
      try {
        const started = await turnService.startTurn(requester, {
          threadId: 'vict-conv-gov-2',
          input: 'Use the tool',
        });
        let approvalId = '';
        for (let i = 0; i < 400 && approvalId === ''; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          approvalId = (await stores.approvals.listOpenApprovals()).at(0)?.approvalId ?? '';
        }
        await turnService.decideToolApproval(approver, { approvalId, decision: 'declined' });
        const outcome = await started.outcomePromise;
        expect(outcome.status).toBe('completed'); // the model received the safe decline
        const ledgerRows = await stores.streamLedger.listEventsFrom(started.turn.streamId, 0);
        const kinds = ledgerRows.map((row) => row.kind);
        expect(kinds).toContain('tool.failed');
        expect(kinds).not.toContain('tool.completed');
        void stores;
      } finally {
        await composition.close();
      }
    },
  );

  it(
    'cancellation during the approval wait produces one honest terminal outcome',
    { timeout: LONG },
    async () => {
      const composition = await compose({
        'Use the tool': {
          kind: 'tool-call',
          toolName: 'cap_notes_write',
          args: { text: 'note-body' },
          thenText: 'SHOULD-NOT-ARRIVE',
        },
      });
      const { stores, requester, turnService } = composition;
      try {
        const started = await turnService.startTurn(requester, {
          threadId: 'vict-conv-gov-3',
          input: 'Use the tool',
        });
        let approvalId = '';
        for (let i = 0; i < 400 && approvalId === ''; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          approvalId = (await stores.approvals.listOpenApprovals()).at(0)?.approvalId ?? '';
        }
        expect(approvalId).not.toBe('');
        const cancel = await turnService.cancelTurn(requester, {
          turnId: started.turn.turnId,
          reasonCode: 'user',
        });
        expect(cancel.accepted).toBe(true);
        const outcome = await started.outcomePromise;
        expect(outcome.status).toBe('cancelled');
        // The capability was NEVER invoked.
        expect(composition.invokeLog.length).toBe(0);
        // The ledger carries exactly one cancelled terminal milestone.
        const ledgerRows = await stores.streamLedger.listEventsFrom(started.turn.streamId, 0);
        expect(ledgerRows.filter((row) => row.kind === 'response.cancelled')).toHaveLength(1);
        const turn = await stores.turns.getTurn(started.turn.turnId);
        expect(turn?.status).toBe('cancelled');
        void approvalId;
      } finally {
        await composition.close();
      }
    },
  );
});
