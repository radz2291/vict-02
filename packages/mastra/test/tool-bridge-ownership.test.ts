import { describe, expect, it } from 'vitest';
import type { CapabilityDefinition, Contract } from '@victframework/sdk';
import {
  createInMemoryAgentControlStores,
  VictControlError,
  type AgentControlStores,
} from '@victframework/runtime';
import { AgentTurnService } from '@victframework/control';
import {
  bridgeCapabilityToolToMastra,
  canonicalArgDigest,
  runWithBridgeTurnScope,
  type CapabilityBridgeDeps,
} from '../src/tool-bridge.js';

/**
 * Stage 06B final boundary correction — live invocation ownership and
 * settlement (INVOCATION-1 + the attempt-fence policy; these tests FAIL at
 * 8bc8da1 and pass after):
 *
 * - a barrier-controlled duplicate with the SAME tool-call identity that
 *   arrives while the owner is durably `running` can NEVER mutate the
 *   owner's state: it awaits the same-process owner and replays the
 *   truthful terminal disposition; exactly ONE capability execution, ONE
 *   invocation record, and a truthful durable terminal state;
 * - normal success is returned ONLY after the exact durable `completed`
 *   transition is confirmed (a terminal-persistence fault yields the
 *   truthful outcome_unknown failure, never the output);
 * - a stale owner (an earlier fence/generation) can never settle a later
 *   claim generation;
 * - an abandoned `running` attempt (no live owner in this process) is
 *   reconciled conservatively to the fenced, NON-replayable
 *   `outcome_unknown` without executing anything.
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

const SCOPE = {
  turnId: 'turn-ownership',
  streamId: 'stream-ownership',
  actorId: 'actor-requester',
  agentProfileVersion: 'v1_profile',
};

const ACTIVATION = {
  activationVersion: 'v1_act',
  agentProfileVersion: 'v1_profile',
  capabilities: [{ id: 'cap.ownership', revision: '1' }],
} as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];

function makeCapability(overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
  return {
    id: 'cap.ownership',
    revision: '1',
    effect: 'read',
    input: neutralContract('cap.ownership.input', () => true),
    output: neutralContract('cap.ownership.output', () => true),
    invoke: async (input: unknown) => ({ done: true, echo: input }),
    ...overrides,
  } as CapabilityDefinition;
}

interface Fixture {
  stores: AgentControlStores;
  deps: CapabilityBridgeDeps;
  effectCount: () => number;
  setInvoke: (invoke: CapabilityDefinition['invoke']) => void;
  failSettleRun: (fail: boolean) => void;
  settleRunCalls: () => number;
}

async function makeFixture(capability: CapabilityDefinition = makeCapability()): Promise<Fixture> {
  let clockValue = 1000;
  const clock = (): number => (clockValue += 1);
  const stores = createInMemoryAgentControlStores();
  await stores.actors.upsert({
    actorId: 'actor-requester',
    status: 'active',
    roles: ['developer'],
    createdAt: 0,
  });
  let effectCount = 0;
  let idCounter = 0;
  let settleRunFailures = 0;
  let settleRunCalls = 0;
  let currentInvoke = capability.invoke;
  const turnService = new AgentTurnService({
    stores,
    clock,
    ids: {
      turnId: () => SCOPE.turnId,
      streamId: () => SCOPE.streamId,
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
      const invoke = currentInvoke ?? resolved.invoke ?? definition.invoke;
      return (await invoke(input, {} as never)) as unknown;
    },
    recordInvocationIntent: (input) => turnService.recordToolInvocationIntent(input),
    claimInvocationRun: (command) => stores.invocations.claimInvocationRun(command),
    settleInvocationRun: async (command) => {
      settleRunCalls += 1;
      if (settleRunFailures > 0) {
        settleRunFailures -= 1;
        throw new VictControlError('VICT_STORE_UNAVAILABLE', 'settlement store unavailable');
      }
      return stores.invocations.settleInvocationRun(command);
    },
    settleInvocationPending: (command) => stores.invocations.settleInvocationPending(command),
    reconcileAbandonedRun: (command) => stores.invocations.reconcileAbandonedRun(command),
    requestApproval: (input) => turnService.requestApproval(input),
    consumeApproval: (binding) => turnService.consumeApproval(binding),
    updateInvocationStatus: (command) => stores.invocations.updateInvocationStatus(command),
    clock,
    pollIntervalMs: 5,
    approvalExpiryMs: 5000,
  };
  return {
    stores,
    deps,
    effectCount: () => effectCount,
    setInvoke: (invoke) => {
      currentInvoke = invoke;
    },
    failSettleRun: (fail) => {
      if (fail) {
        settleRunFailures = 1;
      } else {
        settleRunFailures = 0;
      }
    },
    settleRunCalls: () => settleRunCalls,
  };
}

function toolExecutorFor(
  fixture: Fixture,
  toolCallId: string,
): (input: unknown, context?: Record<string, unknown>) => Promise<unknown> {
  const tool = bridgeCapabilityToolToMastra(
    ACTIVATION,
    fixture.deps.resolveCapability('cap.ownership', '1') as CapabilityDefinition,
    fixture.deps,
  ) as { execute: unknown };
  const exec = tool.execute as (i: unknown, c: unknown) => Promise<unknown>;
  return (input, context = {}) =>
    runWithBridgeTurnScope({ ...SCOPE, threadId: 'thread-ownership' }, () =>
      exec(input, { toolCallId, ...context }),
    );
}

async function seedTurn(fixture: Fixture, turnId = SCOPE.turnId): Promise<void> {
  await fixture.stores.turns.createTurnIntent({
    turnId,
    streamId: SCOPE.streamId,
    threadId: 'thread-ownership',
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

/** Resolve once the invocation for the turn reached the `running` state. */
async function awaitRunning(fixture: Fixture): Promise<string> {
  for (let i = 0; i < 400; i += 1) {
    const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
    const running = invocations.find((record) => record.status === 'running');
    if (running !== undefined) {
      return running.invocationId;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('the invocation never reached the durable running state');
}

describe('INVOCATION-1: a live duplicate cannot poison the winning owner', () => {
  it('the duplicate awaits the owner, the owner completes durably, and both outcomes are truthful', async () => {
    const fixture = await makeFixture(
      makeCapability({
        invoke: async (input: unknown) => ({ done: true, echo: input }),
      }),
    );
    await seedTurn(fixture);
    let releaseOwner!: () => void;
    const ownerGate = new Promise<void>((resolve) => {
      releaseOwner = resolve;
    });
    let ownerInvoked = 0;
    fixture.setInvoke(async (input: unknown) => {
      ownerInvoked += 1;
      await ownerGate;
      return { done: true, echo: input };
    });

    const exec = toolExecutorFor(fixture, 'call-owner-1');
    const ownerPromise = exec({ k: 'v' });
    const invocationId = await awaitRunning(fixture);
    expect(ownerInvoked).toBe(1);

    // The DUPLICATE: same logical call, same explicit toolCallId + args,
    // submitted while the owner is durably running.
    const duplicatePromise = exec({ k: 'v' });
    await new Promise((resolve) => setTimeout(resolve, 80));
    const mid = await fixture.stores.invocations.getInvocation(invocationId);
    // THE decisive truthfulness probe (failed at 8bc8da1: the duplicate
    // flipped the live owner to outcome_unknown here).
    expect(mid?.status).toBe('running');

    releaseOwner();
    const ownerResult = (await ownerPromise) as Record<string, unknown>;
    const duplicateResult = (await duplicatePromise) as Record<string, unknown>;

    // The owner receives the normal capability output ONLY after the exact
    // durable completed transition was confirmed.
    expect(ownerResult).toEqual({ done: true, echo: { k: 'v' } });
    const final = await fixture.stores.invocations.getInvocation(invocationId);
    expect(final?.status).toBe('completed');
    // The duplicate receives the explicit terminal replay disposition bound
    // to the SAME invocation — never raw output, never a second effect.
    expect(duplicateResult.victCapabilityReplay).toBeDefined();
    const replay = duplicateResult.victCapabilityReplay as Record<string, unknown>;
    expect(replay.disposition).toBe('completed');
    expect(replay.invocationId).toBe(invocationId);
    expect(replay.resultSummary).toMatch(/^object\(\d+ fields\)$/);
    expect(replay).not.toEqual(ownerResult);
    // Exactly ONE execution, ONE invocation, truthful terminal state.
    expect(ownerInvoked).toBe(1);
    expect(fixture.effectCount()).toBe(1);
    expect(await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId)).toHaveLength(1);
  });

  it('a concurrent claim loser becomes a duplicate (one owner per attempt generation)', async () => {
    // Two near-simultaneous submissions of the SAME identity: both pass the
    // pre-running phase, but the durable claim admits exactly ONE owner.
    const fixture = await makeFixture();
    await seedTurn(fixture);
    let started!: () => void;
    const ownerGate = new Promise<void>((resolve) => {
      started = resolve;
    });
    fixture.setInvoke(async (input: unknown) => {
      started();
      await ownerGate;
      return { done: true, echo: input };
    });
    const exec = toolExecutorFor(fixture, 'call-race-1');
    const first = exec({ k: 'v' });
    const second = exec({ k: 'v' });
    const results = (await Promise.all([first, second])) as Record<string, unknown>[];
    const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.status).toBe('completed');
    expect(fixture.effectCount()).toBe(1);
    const ownerResult = results.find((entry) => entry.done === true);
    const duplicateResult = results.find((entry) => entry.victCapabilityReplay !== undefined);
    expect(ownerResult).toBeDefined();
    expect(duplicateResult).toBeDefined();
    expect(started).toBeDefined();
  });
});

describe('attempt fencing: stale owners, abandoned attempts, persistence faults', () => {
  it('a stale owner can never settle a later claim generation (exact fence binding)', async () => {
    const fixture = await makeFixture();
    await seedTurn(fixture);
    const invocation = await fixture.stores.invocations.recordInvocationIntent({
      invocationId: 'inv-fence-1',
      turnId: SCOPE.turnId,
      toolCallId: 'call-fence-1',
      toolName: 'cap.ownership',
      capabilityId: 'cap.ownership',
      capabilityRevision: '1',
      effect: 'read',
      idempotencyKey: `${SCOPE.turnId}:call-fence-1:cap.ownership:1:digest`,
      actorId: 'actor-requester',
      argDigest: 'digest',
      argumentSummary: 'object(1 fields)',
      status: 'intent',
      createdAt: 2,
      updatedAt: 2,
      completedAt: undefined,
      resultSummary: undefined,
      errorCode: undefined,
    });
    // Generation 1 owner claims.
    const claimed = await fixture.stores.invocations.claimInvocationRun({
      invocationId: invocation.invocationId,
      fenceToken: 'fence-gen-1',
      ownerIdentity: 'owner-A',
      at: 10,
    });
    expect(claimed.status).toBe('running');
    expect(claimed.runGeneration).toBe(1);
    expect(claimed.runFenceToken).toBe('fence-gen-1');
    // A SECOND claim on the live attempt is refused (the caller is a
    // duplicate) and the record is untouched.
    await expect(
      fixture.stores.invocations.claimInvocationRun({
        invocationId: invocation.invocationId,
        fenceToken: 'fence-gen-2-claim',
        ownerIdentity: 'owner-B',
        at: 11,
      }),
    ).rejects.toThrow(/live owner/);
    // Reconciliation re-fences the record to a LATER generation.
    const reconciled = await fixture.stores.invocations.reconcileAbandonedRun({
      invocationId: invocation.invocationId,
      observedFenceToken: 'fence-gen-1',
      reconciledFenceToken: 'fence-gen-2-reconciled',
      at: 12,
    });
    expect(reconciled.status).toBe('outcome_unknown');
    expect(reconciled.runGeneration).toBe(2);
    // THE STALE OWNER (generation 1) can never settle the later generation.
    await expect(
      fixture.stores.invocations.settleInvocationRun({
        invocationId: invocation.invocationId,
        fenceToken: 'fence-gen-1',
        status: 'completed',
        at: 13,
        resultSummary: 'stale-owner-lies',
      }),
    ).rejects.toThrow(VictControlError);
    const after = await fixture.stores.invocations.getInvocation(invocation.invocationId);
    expect(after?.status).toBe('outcome_unknown');
    expect(after?.resultSummary).toBeUndefined();
    // Even a duplicate outcome_unknown settlement from the stale owner
    // cannot pass the fence binding.
    await expect(
      fixture.stores.invocations.settleInvocationRun({
        invocationId: invocation.invocationId,
        fenceToken: 'fence-gen-1',
        status: 'outcome_unknown',
        at: 14,
      }),
    ).rejects.toThrow(VictControlError);
  });

  it('reconciliation is exact-binding: wrong fence or non-running state is refused', async () => {
    const fixture = await makeFixture();
    await seedTurn(fixture);
    const invocation = await fixture.stores.invocations.recordInvocationIntent({
      invocationId: 'inv-fence-2',
      turnId: SCOPE.turnId,
      toolCallId: 'call-fence-2',
      toolName: 'cap.ownership',
      capabilityId: 'cap.ownership',
      capabilityRevision: '1',
      effect: 'read',
      idempotencyKey: `${SCOPE.turnId}:call-fence-2:cap.ownership:1:digest`,
      actorId: 'actor-requester',
      argDigest: 'digest',
      argumentSummary: 'object(1 fields)',
      status: 'intent',
      createdAt: 2,
      updatedAt: 2,
      completedAt: undefined,
      resultSummary: undefined,
      errorCode: undefined,
    });
    await fixture.stores.invocations.claimInvocationRun({
      invocationId: invocation.invocationId,
      fenceToken: 'fence-live',
      ownerIdentity: 'owner-A',
      at: 10,
    });
    // Wrong observed fence: refused, state untouched.
    await expect(
      fixture.stores.invocations.reconcileAbandonedRun({
        invocationId: invocation.invocationId,
        observedFenceToken: 'fence-WRONG',
        reconciledFenceToken: 'fence-next',
        at: 11,
      }),
    ).rejects.toThrow(VictControlError);
    expect((await fixture.stores.invocations.getInvocation(invocation.invocationId))?.status).toBe(
      'running',
    );
    // Exact observed binding: the abandoned attempt becomes fenced
    // outcome_unknown WITHOUT executing anything.
    const reconciled = await fixture.stores.invocations.reconcileAbandonedRun({
      invocationId: invocation.invocationId,
      observedFenceToken: 'fence-live',
      reconciledFenceToken: 'fence-next',
      at: 12,
    });
    expect(reconciled.status).toBe('outcome_unknown');
    expect(reconciled.errorCode).toBe('VICT_CONTROL_INVOCATION_RUN_RECONCILED');
    // A SECOND reconciliation is refused (the observed state moved) —
    // idempotent truthfulness, never a state-changing guess.
    await expect(
      fixture.stores.invocations.reconcileAbandonedRun({
        invocationId: invocation.invocationId,
        observedFenceToken: 'fence-live',
        reconciledFenceToken: 'fence-next-2',
        at: 13,
      }),
    ).rejects.toThrow(VictControlError);
    expect((await fixture.stores.invocations.getInvocation(invocation.invocationId))?.status).toBe(
      'outcome_unknown',
    );
  });

  it('a retry after reconciliation returns outcome_unknown and NEVER re-executes the effect', async () => {
    const fixture = await makeFixture();
    await seedTurn(fixture);
    // Simulate an abandoned attempt: claim through the store directly (no
    // live bridge owner), as a crashed process life would leave behind.
    const args = { k: 'abandoned' };
    const invocation = await fixture.deps.recordInvocationIntent({
      turnId: SCOPE.turnId,
      toolCallId: 'call-abandoned-1',
      toolName: 'cap.ownership',
      capabilityId: 'cap.ownership',
      capabilityRevision: '1',
      effect: 'read',
      actorId: 'actor-requester',
      argDigest: canonicalArgDigest(args),
      argumentSummary: 'object(1 fields)',
    });
    await fixture.stores.invocations.claimInvocationRun({
      invocationId: invocation.invocationId,
      fenceToken: 'fence-crashed-life',
      ownerIdentity: 'owner-dead-process',
      at: 10,
    });
    // The bridge retry observes the running record with NO live owner in
    // this process: it reconciles conservatively and reports the truthful
    // non-replayable failure.
    const exec = toolExecutorFor(fixture, 'call-abandoned-1');
    void args;
    const result = (await exec({ k: 'abandoned' })) as Record<string, unknown>;
    expect(result.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
    expect(fixture.effectCount()).toBe(0);
    const final = await fixture.stores.invocations.getInvocation(invocation.invocationId);
    expect(final?.status).toBe('outcome_unknown');
    // Subsequent retries stay fenced (never replay, never re-execute).
    const retry = (await exec({ k: 'abandoned' })) as Record<string, unknown>;
    expect(retry.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
    expect(fixture.effectCount()).toBe(0);
  });

  it('a terminal-persistence fault NEVER yields normal success', async () => {
    const fixture = await makeFixture();
    await seedTurn(fixture);
    // The completed settlement write FAILS (store unavailable): the exact
    // durable `completed` transition is never confirmed, so the model must
    // receive the truthful outcome_unknown failure — never the output.
    fixture.failSettleRun(true);
    const exec = toolExecutorFor(fixture, 'call-fault-1');
    const result = (await exec({ k: 'v' })) as Record<string, unknown>;
    expect(result).not.toEqual({ done: true, echo: { k: 'v' } });
    expect(result.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
    // The fenced fallback also attempted a truthful outcome_unknown.
    expect(fixture.settleRunCalls()).toBeGreaterThanOrEqual(2);
    fixture.failSettleRun(false);
    const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.status).toBe('outcome_unknown');
    // The durable record and the returned outcome AGREE (both unknown).
    expect(invocations[0]?.errorCode).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
    // And a later retry is fenced — never an ordinary re-invocation.
    const retry = (await exec({ k: 'v' })) as Record<string, unknown>;
    expect(retry.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
    expect(fixture.effectCount()).toBe(1);
  });

  it('pre-running settlements are exact-binding and never touch a claimed attempt', async () => {
    const fixture = await makeFixture();
    await seedTurn(fixture);
    const invocation = await fixture.stores.invocations.recordInvocationIntent({
      invocationId: 'inv-pending-1',
      turnId: SCOPE.turnId,
      toolCallId: 'call-pending-1',
      toolName: 'cap.ownership',
      capabilityId: 'cap.ownership',
      capabilityRevision: '1',
      effect: 'read',
      idempotencyKey: `${SCOPE.turnId}:call-pending-1:cap.ownership:1:digest`,
      actorId: 'actor-requester',
      argDigest: 'digest',
      argumentSummary: 'object(1 fields)',
      status: 'intent',
      createdAt: 2,
      updatedAt: 2,
      completedAt: undefined,
      resultSummary: undefined,
      errorCode: undefined,
    });
    // Exact-binding idempotency: the same disposition twice is one state.
    const first = await fixture.stores.invocations.settleInvocationPending({
      invocationId: invocation.invocationId,
      status: 'declined',
      at: 10,
      errorCode: 'VICT_TOOL_DECLINED',
    });
    const second = await fixture.stores.invocations.settleInvocationPending({
      invocationId: invocation.invocationId,
      status: 'declined',
      at: 11,
      errorCode: 'VICT_TOOL_DECLINED',
    });
    expect(second.status).toBe(first.status);
    expect(second.errorCode).toBe('VICT_TOOL_DECLINED');
    // A DIFFERENT disposition under the same identity is a conflict.
    await expect(
      fixture.stores.invocations.settleInvocationPending({
        invocationId: invocation.invocationId,
        status: 'cancelled',
        at: 12,
        errorCode: 'VICT_TURN_CANCELLED',
      }),
    ).rejects.toThrow(VictControlError);
    expect((await fixture.stores.invocations.getInvocation(invocation.invocationId))?.status).toBe(
      'declined',
    );
    // A claimed (running) attempt is never touched by a pending settlement.
    const live = await fixture.deps.recordInvocationIntent({
      turnId: SCOPE.turnId,
      toolCallId: 'call-pending-2',
      toolName: 'cap.ownership',
      capabilityId: 'cap.ownership',
      capabilityRevision: '1',
      effect: 'read',
      actorId: 'actor-requester',
      argDigest: 'digest-2',
      argumentSummary: 'object(1 fields)',
    });
    await fixture.stores.invocations.claimInvocationRun({
      invocationId: live.invocationId,
      fenceToken: 'fence-pending',
      ownerIdentity: 'owner-A',
      at: 20,
    });
    await expect(
      fixture.stores.invocations.settleInvocationPending({
        invocationId: live.invocationId,
        status: 'failed',
        at: 21,
        errorCode: 'LATE',
      }),
    ).rejects.toThrow(/live owner/);
    expect((await fixture.stores.invocations.getInvocation(live.invocationId))?.status).toBe(
      'running',
    );
  });
});
