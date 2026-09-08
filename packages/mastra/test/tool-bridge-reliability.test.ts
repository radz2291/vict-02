import { describe, expect, it } from 'vitest';
import type { CapabilityDefinition, Contract } from '@vict/sdk';
import {
  authenticatedActorContext,
  createInMemoryAgentControlStores,
  type AgentControlStores,
  type AuthenticatedActorContext,
} from '@vict/runtime';
import { AgentTurnService } from '@vict/control';
import {
  bridgeCapabilityToolToMastra,
  canonicalArgDigest,
  runWithBridgeTurnScope,
  type CapabilityBridgeDeps,
} from '../src/tool-bridge.js';

/**
 * Stage 06B final reliability correction — R1 (terminal invocation replay)
 * and R2 (stable tool-call identity).
 *
 * Proven at the REAL bridge boundary:
 * - a completed invocation NEVER executes again: the second submission of
 *   the same logical request (same turn, same explicit toolCallId, same
 *   capability id/revision, same canonical arguments) returns the stable
 *   safe replay envelope and the effect count stays exactly ONE;
 * - failed/declined/cancelled/outcome-unknown records replay their stable
 *   safe disposition without invoking;
 * - a capability that THREW (or whose output violated its contract) is
 *   fenced as outcome_unknown and never becomes ordinarily retriable;
 * - the framework-supplied toolCallId IS the occurrence identity: without
 *   one the bridge fails closed (VICT_CAPABILITY_TOOL_IDENTITY_REQUIRED)
 *   with zero durable/effectful work, and a retry of the SAME occurrence
 *   identity reuses ONE identity and executes at most once. Occurrence
 *   identity is never inferred from arguments alone.
 */

function neutralContract(id: string, ok: (value: unknown) => boolean): Contract<unknown> {
  return {
    id,
    revision: '1',
    expected: 'bounded test contract',
    parse: (input: unknown): ReturnType<Contract<unknown>['parse']> =>
      ok(input)
        ? { ok: true, value: input }
        : { ok: false, issues: [{ path: 'input', message: 'invalid', code: 'INVALID' }] },
  };
}

function makeCapability(overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
  return {
    id: 'cap.notes.write',
    revision: '3',
    effect: 'write',
    input: neutralContract('cap.notes.write.input', (value) => {
      return (
        typeof value === 'object' && value !== null && 'text' in (value as Record<string, unknown>)
      );
    }),
    output: neutralContract('cap.notes.write.output', (value) => {
      return (
        typeof value === 'object' && value !== null && 'saved' in (value as Record<string, unknown>)
      );
    }),
    invoke: async (input: unknown) => ({ saved: true, echo: input }),
    ...overrides,
  } as CapabilityDefinition;
}

const SCOPE = {
  turnId: 'turn-reliability',
  streamId: 'stream-reliability',
  actorId: 'actor-requester',
  agentProfileVersion: 'v1_profile',
};

const ACTIVATION = {
  activationVersion: 'v1_act',
  agentProfileVersion: 'v1_profile',
  capabilities: [
    { id: 'cap.notes.write', revision: '3' },
    { id: 'cap.notes.read', revision: '3' },
  ],
} as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];

interface Fixture {
  stores: AgentControlStores;
  deps: CapabilityBridgeDeps;
  effectCount: () => number;
  requester: AuthenticatedActorContext;
  approver: AuthenticatedActorContext;
}

async function makeFixture(capability: CapabilityDefinition = makeCapability()): Promise<Fixture> {
  let clockValue = 1000;
  const clock = (): number => (clockValue += 1);
  const stores = createInMemoryAgentControlStores();
  await stores.actors.upsert({
    actorId: 'actor-requester',
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
  const requester = authenticatedActorContext(
    await stores.actors.get('actor-requester'),
    'actor-requester',
  );
  const approver = authenticatedActorContext(
    await stores.actors.get('actor-approver'),
    'actor-approver',
  );
  let effectCount = 0;
  let idCounter = 0;
  const turnService = new AgentTurnService({
    stores,
    clock,
    ids: {
      turnId: () => 'turn-reliability',
      streamId: () => 'stream-reliability',
      invocationId: () => `inv-${(idCounter += 1)}`,
      approvalId: () => `approval-${idCounter}`,
      idempotencyKey: () => `key-${idCounter}`,
      cancelId: () => `cancel-${idCounter}`,
    },
  });
  const definition = capability;
  const deps: CapabilityBridgeDeps = {
    resolveCapability: (id, revision): CapabilityDefinition | undefined =>
      id === definition.id && revision === definition.revision ? definition : undefined,
    invoke: async (resolved, input) => {
      effectCount += 1;
      return (resolved.invoke ?? definition.invoke)(input, {} as never) as unknown;
    },
    recordInvocationIntent: (input) => turnService.recordToolInvocationIntent(input),
    claimInvocationRun: (command) => stores.invocations.claimInvocationRun(command),
    settleInvocationRun: (command) => stores.invocations.settleInvocationRun(command),
    settleInvocationPending: (command) => stores.invocations.settleInvocationPending(command),
    reconcileAbandonedRun: (command) => stores.invocations.reconcileAbandonedRun(command),
    requestApproval: (input) => turnService.requestApproval(input),
    consumeApproval: (binding) => turnService.consumeApproval(binding),
    updateInvocationStatus: (command) => stores.invocations.updateInvocationStatus(command),
    findExistingApproval: async (invocationId) => {
      const approvals = await stores.approvals.listApprovalsForInvocation(invocationId);
      return approvals.at(0)?.approvalId;
    },
    pollApprovalDecision: async (approvalId) => {
      const record = await stores.approvals.getApproval(approvalId);
      return record === undefined ? undefined : { status: record.status };
    },
    clock,
    pollIntervalMs: 5,
    approvalExpiryMs: 5000,
  };
  return { stores, deps, effectCount: () => effectCount, requester, approver };
}

function toolExecutorFor(
  fixture: Fixture,
  scope: typeof SCOPE,
  toolCallId?: string,
  capabilityId = 'cap.notes.write',
  revision = '3',
): (input: unknown, context?: Record<string, unknown>) => Promise<unknown> {
  const tool = bridgeCapabilityToolToMastra(
    ACTIVATION,
    fixture.deps.resolveCapability(capabilityId, revision) as CapabilityDefinition,
    fixture.deps,
  ) as { execute: unknown };
  const exec = tool.execute as (i: unknown, c: unknown) => Promise<unknown>;
  return (input, context = {}) =>
    runWithBridgeTurnScope({ ...scope, threadId: 'thread-rel' }, () =>
      exec(input, { ...(toolCallId !== undefined ? { toolCallId } : {}), ...context }),
    );
}

async function seedTurn(fixture: Fixture, turnId = SCOPE.turnId): Promise<void> {
  await fixture.stores.turns.createTurnIntent({
    turnId,
    streamId: 'stream-reliability',
    threadId: 'thread-rel',
    actorId: 'actor-requester',
    agentProfileVersion: 'v1_profile',
    activationVersion: undefined,
    applicationReleaseVersion: undefined,
    inputSummary: 'user-input:length=4',
    status: 'intent',
    createdAt: 1,
    updatedAt: 1,
    terminalAt: undefined,
    errorCode: undefined,
    traceId: undefined,
    victRunId: undefined,
    mastraRunId: undefined,
  });
  await fixture.stores.turns.startTurn(turnId, 2);
}

async function approvePending(fixture: Fixture): Promise<void> {
  let approvalId = '';
  for (let i = 0; i < 400 && approvalId === ''; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    approvalId = (await fixture.stores.approvals.listOpenApprovals()).at(0)?.approvalId ?? '';
  }
  expect(approvalId).not.toBe('');
  const decided = await fixture.stores.approvals.decideApproval({
    approvalId,
    approverActorId: 'actor-approver',
    decision: 'approved',
    decidedAt: 5000,
  });
  expect(decided.status).toBe('approved');
}

describe('R1: a terminal invocation never passes through capability invocation again', () => {
  it('an approved WRITE submitted twice with the same identity yields exactly ONE effect', async () => {
    const fixture = await makeFixture();
    await seedTurn(fixture);
    const exec = toolExecutorFor(fixture, SCOPE, 'call-once-1');
    // First submission: full governed flow (approval + invocation).
    const pending = exec({ text: 'note-body' });
    await approvePending(fixture);
    const first = (await pending) as Record<string, unknown>;
    expect(first).toEqual({ saved: true, echo: { text: 'note-body' } });
    expect(fixture.effectCount()).toBe(1);
    const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.status).toBe('completed');

    // Second submission: IDENTICAL turn, toolCallId, capability and args.
    const second = (await exec({ text: 'note-body' })) as Record<string, unknown>;
    // The replay envelope: a stable safe result reconstructed from the
    // durable terminal record — never a second effect, never raw output.
    expect(second.victCapabilityReplay).toBeDefined();
    const replay = second.victCapabilityReplay as Record<string, unknown>;
    expect(replay.disposition).toBe('completed');
    expect(replay.invocationId).toBe(invocations[0]?.invocationId);
    expect(replay.resultSummary).toMatch(/^object\(\d+ fields\)$/);
    // THE effect count is still exactly ONE.
    expect(fixture.effectCount()).toBe(1);
    expect(await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId)).toHaveLength(1);
  });

  it('pure and read classifications never require approval and replay the same way', async () => {
    for (const effect of ['pure', 'read'] as const) {
      const fixture = await makeFixture(
        makeCapability({ id: 'cap.notes.read', revision: '3', effect }),
      );
      await seedTurn(fixture);
      const exec = toolExecutorFor(fixture, SCOPE, `call-${effect}-1`, 'cap.notes.read');
      const first = (await exec({ text: 'x' })) as Record<string, unknown>;
      expect(first).toEqual({ saved: true, echo: { text: 'x' } });
      expect(fixture.effectCount()).toBe(1);
      const second = (await exec({ text: 'x' })) as Record<string, unknown>;
      expect(second.victCapabilityReplay).toBeDefined();
      expect((second.victCapabilityReplay as Record<string, unknown>).disposition).toBe(
        'completed',
      );
      expect(fixture.effectCount()).toBe(1);
    }
  });

  it('irreversible classifications require approval and an approved submission replays with one effect', async () => {
    const fixture = await makeFixture(
      makeCapability({ id: 'cap.notes.write', revision: '3', effect: 'irreversible' }),
    );
    await seedTurn(fixture);
    const exec = toolExecutorFor(fixture, SCOPE, 'call-irr-1');
    const pending = exec({ text: 'irr' });
    await approvePending(fixture);
    const first = (await pending) as Record<string, unknown>;
    expect(first).toEqual({ saved: true, echo: { text: 'irr' } });
    expect(fixture.effectCount()).toBe(1);
    const second = (await exec({ text: 'irr' })) as Record<string, unknown>;
    expect(second.victCapabilityReplay).toBeDefined();
    expect(fixture.effectCount()).toBe(1);
  });

  it('failed, declined, cancelled, and outcome_unknown records replay their stable safe disposition', async () => {
    for (const [status, expectedCode] of [
      ['failed', 'VICT_CAPABILITY_INVOCATION_FAILED'],
      ['declined', 'VICT_CAPABILITY_DECLINED'],
      ['cancelled', 'VICT_CAPABILITY_CANCELLED'],
      ['outcome_unknown', 'VICT_CAPABILITY_OUTCOME_UNKNOWN'],
    ] as const) {
      const fixture = await makeFixture();
      await seedTurn(fixture);
      // Pre-record the terminal invocation for this logical identity: the
      // SAME turn, toolCallId, capability id/revision, and the canonical
      // argument digest of the arguments the executor will submit — the
      // exact idempotency key the bridge derives.
      const args = { text: 'deterministic' };
      const argDigest = canonicalArgDigest(args);
      const invocation = await fixture.stores.invocations.recordInvocationIntent({
        invocationId: `inv-pre-${status}`,
        turnId: SCOPE.turnId,
        toolCallId: `call-${status}`,
        toolName: 'cap.notes.write',
        capabilityId: 'cap.notes.write',
        capabilityRevision: '3',
        effect: 'write',
        idempotencyKey: `${SCOPE.turnId}:call-${status}:cap.notes.write:3:${argDigest}`,
        actorId: 'actor-requester',
        argDigest,
        argumentSummary: 'object(1 fields)',
        status: 'intent',
        createdAt: 3,
        updatedAt: 3,
        completedAt: undefined,
        resultSummary: undefined,
        errorCode: undefined,
      });
      await fixture.stores.invocations.updateInvocationStatus({
        invocationId: invocation.invocationId,
        status,
        at: 4,
        ...(status === 'outcome_unknown' ? { errorCode: 'VICT_CAPABILITY_FENCED' } : {}),
      });
      const exec = toolExecutorFor(fixture, SCOPE, `call-${status}`);
      const result = (await exec(args)) as Record<string, unknown>;
      expect(result.victCapabilityFailure).toBe(expectedCode);
      // The capability was NEVER invoked.
      expect(fixture.effectCount()).toBe(0);
    }
  });

  it('a capability that THROWS is fenced as outcome_unknown and never ordinarily retriable', async () => {
    const fixture = await makeFixture(
      makeCapability({
        invoke: async () => {
          throw new Error('capability exploded');
        },
      }),
    );
    await seedTurn(fixture);
    const exec = toolExecutorFor(fixture, SCOPE, 'call-throw-1');
    const pending = exec({ text: 'boom' });
    await approvePending(fixture);
    const first = (await pending) as Record<string, unknown>;
    expect(first.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
    const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
    expect(invocations[0]?.status).toBe('outcome_unknown');
    // A retry of the same logical request replays the fenced disposition
    // WITHOUT invoking again.
    const second = (await exec({ text: 'boom' })) as Record<string, unknown>;
    expect(second.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
    expect(fixture.effectCount()).toBe(1);
  });
});

describe('R2: tool-call occurrence identity (fail closed without a framework id)', () => {
  it('a call WITHOUT a valid framework toolCallId fails closed with ZERO durable/effectful work', async () => {
    const fixture = await makeFixture(
      makeCapability({ id: 'cap.notes.read', revision: '3', effect: 'read' }),
    );
    await seedTurn(fixture);
    const before = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
    expect(before).toHaveLength(0);
    // NO valid toolCallId supplied: the bridge refuses BEFORE any durable
    // intent, approval, or capability invocation — occurrence identity is
    // NEVER inferred from the arguments alone (a digest-only key cannot
    // distinguish a retry from a second legitimate identical call).
    const exec = toolExecutorFor(fixture, SCOPE, undefined, 'cap.notes.read');
    const result = (await exec({ text: 'slot-probe' })) as Record<string, unknown>;
    expect(result.victCapabilityFailure).toBe('VICT_CAPABILITY_TOOL_IDENTITY_REQUIRED');
    expect(fixture.effectCount()).toBe(0);
    expect(await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId)).toHaveLength(0);
    // Also refused for a malformed (non-identifier) toolCallId.
    const hostile = toolExecutorFor(fixture, SCOPE, 'bad id with spaces', 'cap.notes.read');
    const denied = (await hostile({ text: 'slot-probe' })) as Record<string, unknown>;
    expect(denied.victCapabilityFailure).toBe('VICT_CAPABILITY_TOOL_IDENTITY_REQUIRED');
    expect(fixture.effectCount()).toBe(0);
    expect(await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId)).toHaveLength(0);
  });

  it('a retry of the SAME occurrence identity reuses ONE identity and executes at most once', async () => {
    const fixture = await makeFixture(
      makeCapability({ id: 'cap.notes.read', revision: '3', effect: 'read' }),
    );
    await seedTurn(fixture);
    const exec = toolExecutorFor(fixture, SCOPE, 'call-occurrence-1', 'cap.notes.read');
    const first = (await exec({ text: 'occurrence-probe' })) as Record<string, unknown>;
    expect(first).toEqual({ saved: true, echo: { text: 'occurrence-probe' } });
    const mid = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
    expect(mid).toHaveLength(1);
    expect(mid[0]?.toolCallId).toBe('call-occurrence-1');
    // The retry of the SAME occurrence identity (same toolCallId + args)
    // resolves to the SAME durable invocation: one record, one effect.
    const second = (await exec({ text: 'occurrence-probe' })) as Record<string, unknown>;
    expect(second.victCapabilityReplay).toBeDefined();
    expect((second.victCapabilityReplay as Record<string, unknown>).invocationId).toBe(
      mid[0]?.invocationId,
    );
    const after = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
    expect(after).toHaveLength(1);
    expect(fixture.effectCount()).toBe(1);
  });
});
