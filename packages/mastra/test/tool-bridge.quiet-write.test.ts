import { describe, expect, it } from 'vitest';
import type { AgentControlStores, AgentTurnRecord } from '@victframework/runtime';
import { authenticatedActorContext, VICT_EFFECT_POLICY_IDENTITY } from '@victframework/runtime';
import type { AuthenticatedActorContext } from '@victframework/runtime';
import { AgentTurnService } from '@victframework/control';
import type { AgentStreamEvent, Contract } from '@victframework/contracts';
import type { CapabilityDefinition } from '@victframework/sdk';
import type { CapabilityBridgeDeps, HostQuietWriteApprovalPolicy } from '@victframework/mastra';
import {
  bridgeCapabilityToolToMastra,
  buildCapabilityTools,
  runWithBridgeTurnScope,
} from '@victframework/mastra';
import { createInMemoryAgentControlStores, gateCapabilityInvoke } from '@victframework/runtime';

/**
 * VICT-M-1 focused negative controls (frozen contract
 * `docs/report/VICT-M-1-REMEDIATION-CONTRACT.md` §9, controls 3–12).
 *
 * The truthful-effect remediation: effect truth, the per-invocation
 * approval decision, and its closed-code policy basis are independently
 * represented and durably recorded at intent time. A host-owned EXACT
 * quiet-write policy may permit ONE write capability at ONE revision to
 * proceed without a separate approval wait — never an irreversible one,
 * never a wildcard, never capability-controlled.
 */

function neutralContract(id: string, ok: (value: unknown) => boolean): Contract<unknown> {
  return {
    id,
    revision: '1',
    expected: 'bounded test contract',
    parse: (input: unknown) =>
      ok(input)
        ? { ok: true as const, value: input }
        : { ok: false as const, issues: [{ path: 'input', message: 'invalid', code: 'INVALID' }] },
  };
}

interface Fixture {
  stores: AgentControlStores;
  turnService: AgentTurnService;
  deps: CapabilityBridgeDeps;
  awaitingApprovalEvents: AgentStreamEvent[];
  invokeCount: () => number;
  approver: AuthenticatedActorContext;
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

async function makeFixture(
  capability: CapabilityDefinition,
  overrides: Partial<CapabilityBridgeDeps> = {},
): Promise<Fixture> {
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
  const approver = authenticatedActorContext(
    await stores.actors.get('actor-approver'),
    'actor-approver',
  );

  let turnCounter = 0;
  let idCounter = 0;
  const turnService = new AgentTurnService({
    stores,
    clock,
    ids: {
      turnId: () => `turn-b${(turnCounter += 1)}`,
      streamId: () => `stream-b${turnCounter}`,
      invocationId: () => `inv-${(idCounter += 1)}`,
      approvalId: () => `approval-${idCounter}`,
      idempotencyKey: () => `key-${idCounter}`,
      cancelId: () => `cancel-${idCounter}`,
    },
  });

  let invokeCalls = 0;
  const awaitingApprovalEvents: AgentStreamEvent[] = [];
  const gatedInvoke = gateCapabilityInvoke(capability as never, {
    grants: capability.permissions ?? [],
  });

  const deps: CapabilityBridgeDeps = {
    resolveCapability: (id, revision) =>
      id === capability.id && revision === capability.revision ? capability : undefined,
    invoke: async (_resolvedDefinition, input, context) => {
      invokeCalls += 1;
      return gatedInvoke(input, context as never) as Promise<unknown>;
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
    emitAwaitingApproval: async (event) => {
      awaitingApprovalEvents.push(event);
    },
    clock,
    pollIntervalMs: 5,
    approvalExpiryMs: 400,
    ...overrides,
  };

  return {
    stores,
    turnService,
    deps,
    awaitingApprovalEvents,
    invokeCount: () => invokeCalls,
    approver,
  };
}

interface TurnScope {
  readonly turnId: string;
  readonly streamId: string;
  readonly actorId: string;
  readonly agentProfileVersion: string;
}

let turnSeq = 0;

/** Create + start one real durable turn; return the bridge turn scope. */
async function beginTurn(fixture: Fixture): Promise<TurnScope> {
  const turnId = `turn-quiet-${(turnSeq += 1)}`;
  const scope: TurnScope = {
    turnId,
    streamId: `stream-quiet-${turnSeq}`,
    actorId: 'actor-requester',
    agentProfileVersion: 'v1_profile',
  };
  const turn: AgentTurnRecord = {
    turnId,
    streamId: scope.streamId,
    threadId: 'thread-bridge',
    actorId: scope.actorId,
    agentProfileVersion: scope.agentProfileVersion,
    activationVersion: undefined,
    applicationReleaseVersion: undefined,
    inputSummary: 's',
    status: 'intent',
    createdAt: 1,
    updatedAt: 1,
    terminalAt: undefined,
    errorCode: undefined,
    traceId: undefined,
    victRunId: undefined,
    mastraRunId: undefined,
  };
  await fixture.stores.turns.createTurnIntent(turn);
  await fixture.stores.turns.startTurn(turnId, 10);
  return scope;
}

function executorFor(
  fixture: Fixture,
  capability: CapabilityDefinition,
  scope: TurnScope,
): (input: unknown, executionContext?: Record<string, unknown>) => Promise<unknown> {
  const activation = {
    activationVersion: 'v1_act',
    agentProfileVersion: 'v1_profile',
    capabilities: [{ id: capability.id, revision: capability.revision }],
  } as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];
  const tool = bridgeCapabilityToolToMastra(activation, capability, fixture.deps) as {
    execute: unknown;
  };
  const exec = tool.execute as (
    input: unknown,
    context: Record<string, unknown>,
  ) => Promise<unknown>;
  return (input, context = {}) =>
    runWithBridgeTurnScope({ ...scope, threadId: 'thread-bridge' }, () =>
      exec(input, { toolCallId: 'call-1', ...context }),
    );
}

const WRITE_FIXTURE_INPUT = { text: 'bounded probe content' };

async function latestInvocation(
  fixture: Fixture,
  turnId: string,
): Promise<Record<string, unknown>> {
  const invocations = await fixture.stores.invocations.listInvocationsForTurn(turnId);
  return invocations.at(-1) as unknown as Record<string, unknown>;
}

/** Poll until one open approval exists, then DECLINE it as the distinct
 * approver actor (resolving the suspended tool call deterministically). */
async function firstOpenApprovalThenDecline(
  fixture: Fixture,
): Promise<{ approvalId: string } | undefined> {
  for (let i = 0; i < 200; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const open = await fixture.stores.approvals.listOpenApprovals();
    const approval = open.at(0) as { approvalId: string } | undefined;
    if (approval !== undefined) {
      await fixture.turnService.decideToolApproval(fixture.approver, {
        approvalId: approval.approvalId,
        decision: 'declined',
      });
      return approval;
    }
  }
  return undefined;
}

const QUIET_POLICY = (id: string, revision: string): HostQuietWriteApprovalPolicy => ({
  policyIdentity: 'test.quiet-write@1',
  entries: [{ capabilityId: id, capabilityRevision: revision }],
});

describe('VICT-M-1 quiet-write host policy and durable decision evidence', () => {
  it('control 3: the exact host policy executes a write without a separate approval wait and records the truthful evidence', async () => {
    const capability = makeCapability();
    const fixture = await makeFixture(capability, {
      quietWriteApprovals: QUIET_POLICY('cap.notes.write', '3'),
    });
    const scope = await beginTurn(fixture);
    const execute = executorFor(fixture, capability, scope);
    const result = (await execute(WRITE_FIXTURE_INPUT)) as Record<string, unknown>;

    // The capability RAN (no approval suspension) and completed normally.
    expect(fixture.invokeCount()).toBe(1);
    expect(result).toMatchObject({ saved: true });

    const record = await latestInvocation(fixture, scope.turnId);
    expect(record['effect']).toBe('write');
    expect(record['approvalRequired']).toBe(false);
    expect(record['approvalDisposition']).toBe('host-policy-write-without-separate-approval');
    expect(record['effectPolicyIdentity']).toBe(VICT_EFFECT_POLICY_IDENTITY);
    expect(record['status']).toBe('completed');
    // The full governed chain still ran: claim + fence + generation.
    expect(record['runFenceToken']).toBeTruthy();
    expect(record['runGeneration']).toBe(1);

    // Control 10: zero approval records, zero approver identities, zero
    // awaiting-approval events; the turn never suspended.
    expect(await fixture.stores.approvals.listOpenApprovals()).toEqual([]);
    expect(fixture.awaitingApprovalEvents).toEqual([]);
  });

  it('control 4: removing the policy restores approval-required behavior (durable pending approval, suspended turn)', async () => {
    const capability = makeCapability();
    const fixture = await makeFixture(capability);
    const scope = await beginTurn(fixture);
    const execute = executorFor(fixture, capability, scope);
    const pending = execute(WRITE_FIXTURE_INPUT);
    const approval = await firstOpenApprovalThenDecline(fixture);
    expect(approval?.approvalId).toBeTruthy();
    const record = await latestInvocation(fixture, scope.turnId);
    expect(record['effect']).toBe('write');
    expect(record['approvalRequired']).toBe(true);
    expect(record['approvalDisposition']).toBe('default-effect-policy');
    expect(record['effectPolicyIdentity']).toBe(VICT_EFFECT_POLICY_IDENTITY);
    const turn = await fixture.stores.turns.getTurn(scope.turnId);
    expect(turn?.status).toBe('awaiting-approval');
    // The capability never ran while awaiting approval.
    expect(fixture.invokeCount()).toBe(0);
    // The distinct approver's decline settles the attempt truthfully.
    const declined = (await pending) as Record<string, unknown>;
    expect(declined['victCapabilityFailure']).toBe('VICT_CAPABILITY_DECLINED');
  });

  it('control 5: a wrong revision or wrong capability ID can never receive the quiet-write disposition', async () => {
    for (const policy of [
      QUIET_POLICY('cap.notes.write', '2'), // wrong revision
      QUIET_POLICY('cap.other.write', '3'), // wrong capability id
    ]) {
      const capability = makeCapability();
      const fixture = await makeFixture(capability, { quietWriteApprovals: policy });
      const scope = await beginTurn(fixture);
      const execute = executorFor(fixture, capability, scope);
      const pending = execute(WRITE_FIXTURE_INPUT);
      const approval = await firstOpenApprovalThenDecline(fixture);
      expect(approval?.approvalId).toBeTruthy();
      const record = await latestInvocation(fixture, scope.turnId);
      expect(record['approvalRequired']).toBe(true);
      expect(record['approvalDisposition']).toBe('default-effect-policy');
      await pending;
    }
  });

  it('control 6: malformed, duplicate, unmatched, read-target, and irreversible-target policy entries fail closed at build time', () => {
    const write = makeCapability();
    const read = makeCapability({ id: 'cap.notes.read', revision: '1', effect: 'read' });
    const irreversible = makeCapability({
      id: 'cap.notes.irrev',
      revision: '1',
      effect: 'irreversible',
    });
    const all = [write, read, irreversible];

    const cases: Array<{
      policy: unknown;
      capabilities: { id: string; revision: string }[];
      code: string;
    }> = [
      {
        policy: { policyIdentity: '', entries: [] },
        capabilities: [{ id: 'cap.notes.write', revision: '3' }],
        code: 'VICT_HOST_QUIET_WRITE_POLICY_MALFORMED_ENTRY',
      },
      {
        policy: {
          policyIdentity: 'test@1',
          entries: [{ capabilityId: 'x', capabilityRevision: 2 }],
        },
        capabilities: [{ id: 'cap.notes.write', revision: '3' }],
        code: 'VICT_HOST_QUIET_WRITE_POLICY_MALFORMED_ENTRY',
      },
      {
        policy: 'not-a-policy',
        capabilities: [{ id: 'cap.notes.write', revision: '3' }],
        code: 'VICT_HOST_QUIET_WRITE_POLICY_MALFORMED_ENTRY',
      },
      {
        policy: {
          policyIdentity: 'test@1',
          entries: [
            { capabilityId: 'cap.notes.write', capabilityRevision: '3' },
            { capabilityId: 'cap.notes.write', capabilityRevision: '3' },
          ],
        },
        capabilities: [{ id: 'cap.notes.write', revision: '3' }],
        code: 'VICT_HOST_QUIET_WRITE_POLICY_DUPLICATE_ENTRY',
      },
      {
        policy: QUIET_POLICY('cap.absent', '9'),
        capabilities: [{ id: 'cap.notes.write', revision: '3' }],
        code: 'VICT_HOST_QUIET_WRITE_POLICY_UNRESOLVED_TARGET',
      },
      {
        policy: QUIET_POLICY('cap.notes.read', '1'),
        capabilities: [
          { id: 'cap.notes.write', revision: '3' },
          { id: 'cap.notes.read', revision: '1' },
        ],
        code: 'VICT_HOST_QUIET_WRITE_POLICY_TARGET_NOT_WRITE',
      },
      {
        // Control 9 (build half): an irreversible capability can never be
        // exempted — the entry is refused at composition time.
        policy: QUIET_POLICY('cap.notes.irrev', '1'),
        capabilities: [
          { id: 'cap.notes.write', revision: '3' },
          { id: 'cap.notes.irrev', revision: '1' },
        ],
        code: 'VICT_HOST_QUIET_WRITE_POLICY_TARGET_NOT_WRITE',
      },
    ];

    for (const { policy, capabilities, code } of cases) {
      const activation = {
        activationVersion: 'v1_act',
        agentProfileVersion: 'v1_profile',
        capabilities,
      } as unknown as Parameters<typeof buildCapabilityTools>[0];
      const deps = {
        resolveCapability: (id: string, revision: string) =>
          all.find((c) => c.id === id && c.revision === revision),
        invoke: async () => undefined,
        quietWriteApprovals: policy as HostQuietWriteApprovalPolicy,
      } as unknown as CapabilityBridgeDeps;
      let thrown: string | undefined;
      try {
        buildCapabilityTools(activation, deps);
      } catch (error) {
        thrown = (error as Error).message;
      }
      expect(
        thrown,
        `expected ${code} for ${JSON.stringify(policy)} but got: ${thrown ?? 'no throw'}`,
      ).toContain(code);
    }
  });

  it('control 7: a capability cannot self-exempt — a hostile self-describing definition is inert', async () => {
    const hostile = makeCapability({
      // The definition tries to carry its own quiet-write authorization.
      // `CapabilityDefinition` has no such member and the bridge reads the
      // policy ONLY from composition deps — the extra property is inert.
      ...({ quietWriteApprovals: QUIET_POLICY('cap.notes.write', '3') } as Record<string, unknown>),
    } as unknown as CapabilityDefinition);
    const fixture = await makeFixture(hostile);
    const scope = await beginTurn(fixture);
    const execute = executorFor(fixture, hostile, scope);
    const pending = execute(WRITE_FIXTURE_INPUT);
    const approval = await firstOpenApprovalThenDecline(fixture);
    expect(approval?.approvalId).toBeTruthy();
    const record = await latestInvocation(fixture, scope.turnId);
    expect(record['approvalRequired']).toBe(true);
    expect(record['approvalDisposition']).toBe('default-effect-policy');
    await pending;
  });

  it('control 9 (runtime half): an irreversible capability without any policy keeps requiring approval', async () => {
    const capability = makeCapability({
      id: 'cap.notes.irrev',
      revision: '1',
      effect: 'irreversible',
    });
    const fixture = await makeFixture(capability);
    const scope = await beginTurn(fixture);
    const execute = executorFor(fixture, capability, scope);
    const pending = execute(WRITE_FIXTURE_INPUT);
    const approval = await firstOpenApprovalThenDecline(fixture);
    expect(approval?.approvalId).toBeTruthy();
    const record = await latestInvocation(fixture, scope.turnId);
    expect(record['effect']).toBe('irreversible');
    expect(record['approvalRequired']).toBe(true);
    expect(record['approvalDisposition']).toBe('default-effect-policy');
    await pending;
  });

  it('control 11: a quiet write replays the terminal disposition without a second effect', async () => {
    const capability = makeCapability();
    const fixture = await makeFixture(capability, {
      quietWriteApprovals: QUIET_POLICY('cap.notes.write', '3'),
    });
    const scope = await beginTurn(fixture);
    const execute = executorFor(fixture, capability, scope);
    await execute(WRITE_FIXTURE_INPUT);
    expect(fixture.invokeCount()).toBe(1);
    // Retry of the SAME occurrence: the terminal replay envelope is
    // returned and the capability is never invoked again.
    const replay = (await execute(WRITE_FIXTURE_INPUT)) as Record<string, unknown>;
    expect(fixture.invokeCount()).toBe(1);
    expect(replay['victCapabilityReplay']).toBeDefined();
    expect((replay['victCapabilityReplay'] as Record<string, unknown>)['disposition']).toBe(
      'completed',
    );
  });
});
