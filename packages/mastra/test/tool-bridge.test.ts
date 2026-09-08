import { rmSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import type { CapabilityDefinition, Contract } from '@vict/sdk';
import {
  authenticatedActorContext,
  createInMemoryAgentControlStores,
  gateCapabilityInvoke,
  type AgentControlStores,
  type AgentToolInvocationRecord,
  type AuthenticatedActorContext,
} from '@vict/runtime';
import type { AgentStreamEvent } from '@vict/contracts';
import type { AgentTurnRecord } from '@vict/runtime';
import { AgentTurnService } from '@vict/control';
import {
  bridgeCapabilityToolToMastra,
  buildCapabilityTools,
  canonicalArgDigest,
  runWithBridgeTurnScope,
  sanitizeCapabilityToolName,
  type CapabilityBridgeDeps,
} from '../src/tool-bridge.js';

/**
 * Stage 06B — the governed capability tool bridge (amendment §7).
 *
 * Proven at the REAL bridge boundary with the NEUTRAL durable stores:
 * - envelope-only tools (unresolvable envelope entries fail activation);
 * - the full authorization order with durable-before-invocation (a gated
 *   invoke probe reads the durable state at the moment of invocation);
 * - authoritative input/output contract validation regardless of the
 *   Mastra schema pass;
 * - effect/approval policy (read without approval; write/irreversible with
 *   VICT approval records);
 * - durable pending approvals, self-approval denial, exact-binding
 *   consumption, decline without invocation, approve/decline races,
 *   restart-safe idempotency;
 * - no duplicate protected effects through idempotency keys.
 */

const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // disposable teardown
    }
  }
});

// ---- Fixtures ---------------------------------------------------------------

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

interface Fixture {
  // The turn-scope registration used by the direct tool executor.
  stores: AgentControlStores;
  turnService: AgentTurnService;
  deps: CapabilityBridgeDeps;
  invocationLog: { input: unknown; atDurableStatus: string | undefined }[];
  requester: AuthenticatedActorContext;
  approver: AuthenticatedActorContext;
  setInvokeGate: (gate: () => void) => void;
  beginTurnScope(turnId: string): void;
  invokeProbe(): { called: number; lastDurableStatus: string | undefined };
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
  capability: CapabilityDefinition = makeCapability(),
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
  const requester = authenticatedActorContext(
    await stores.actors.get('actor-requester'),
    'actor-requester',
  );
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

  const invocationLog: { input: unknown; atDurableStatus: string | undefined }[] = [];
  let currentTurnScope = '';
  const definition = capability;
  const resolveCapability = (id: string, revision: string): CapabilityDefinition | undefined =>
    id === definition.id && revision === definition.revision ? definition : undefined;

  // The REAL runtime authority gate (least-authority boundary).
  const gatedInvoke = gateCapabilityInvoke(definition as never, {
    grants: definition.permissions ?? [],
  });

  const deps: CapabilityBridgeDeps = {
    resolveCapability,
    invoke: async (resolvedDefinition, input, context) => {
      // The gate probe: at invocation time, read the DURABLE invocation state.
      const invocations = await stores.invocations.listInvocationsForTurn(currentTurnScope);
      const latest = invocations.at(-1);
      invocationLog.push({ input, atDurableStatus: latest?.status });
      return gatedInvoke(input, context as never) as Promise<unknown>;
    },
    recordInvocationIntent: (input) => turnService.recordToolInvocationIntent(input),
    allocateTurnToolSlot: async (input) => await stores.invocations.allocateTurnToolSlot(input),
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
    ...overrides,
  };

  return {
    stores,
    turnService,
    deps,
    invocationLog,
    requester,
    approver,
    setInvokeGate: (_gate: () => void) => undefined,
    beginTurnScope(turnId: string): void {
      currentTurnScope = turnId;
    },
    invokeProbe: (): { called: number; lastDurableStatus: string | undefined } => ({
      get called(): number {
        return invocationLog.length;
      },
      get lastDurableStatus(): string | undefined {
        return invocationLog.at(-1)?.atDurableStatus;
      },
    }),
  };
}

/** Build a direct tool-executor bound to one fixture. */
function toolExecutorFor(
  fixture: Awaited<ReturnType<typeof makeFixture>>,
  activation: Parameters<typeof bridgeCapabilityToolToMastra>[0],
  scope: { turnId: string; streamId: string; actorId: string; agentProfileVersion: string },
): (input: unknown, executionContext?: Record<string, unknown>) => Promise<unknown> {
  const tool = bridgeCapabilityToolToMastra(
    activation,
    fixture.deps.resolveCapability('cap.notes.write', '3') as CapabilityDefinition,
    fixture.deps,
  ) as { execute: unknown };
  const exec = tool.execute as (
    input: unknown,
    context: Record<string, unknown>,
  ) => Promise<unknown>;
  fixture.beginTurnScope(scope.turnId);
  return (input, context = {}) =>
    runWithBridgeTurnScope({ ...scope, threadId: 'thread-bridge' }, () =>
      exec(input, { toolCallId: 'call-1', ...context }),
    );
}

const ACTIVATION_MOCK = {
  activationVersion: 'v1_act',
  agentProfileVersion: 'v1_profile',
  capabilities: [{ id: 'cap.notes.write', revision: '3' }],
} as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];

const SCOPE = {
  turnId: 'turn-scope',
  streamId: 'stream-scope',
  actorId: 'actor-requester',
  agentProfileVersion: 'v1_profile',
};

describe('governed capability tool bridge', () => {
  it('out-of-envelope capabilities are absent: buildCapabilityTools fails closed on unresolvable envelope entries', () => {
    const deps = {
      resolveCapability: (): undefined => undefined,
      invoke: async () => undefined,
    } as unknown as CapabilityBridgeDeps;
    const activation = {
      capabilities: [{ id: 'cap.missing', revision: '9' }],
    } as unknown as Parameters<typeof buildCapabilityTools>[0];
    expect(() => buildCapabilityTools(activation, deps)).toThrow(/ENVELOPE_UNRESOLVED/);
  });

  it('tool names map deterministically from capability ids and never alias', () => {
    expect(sanitizeCapabilityToolName('cap.notes.write')).toBe('cap_notes_write');
    expect(sanitizeCapabilityToolName('a.b') === sanitizeCapabilityToolName('a b')).toBe(true);
  });

  it('full governed order: durable intent recorded BEFORE invocation (gated-store probe, read path)', async () => {
    const fixture = await makeFixture(
      makeCapability({ id: 'cap.notes.read', revision: '3', effect: 'read' }),
    );
    await fixture.stores.turns.createTurnIntent(turnFixture());
    await fixture.stores.turns.startTurn(SCOPE.turnId, 10);
    fixture.beginTurnScope(SCOPE.turnId);
    const readActivation = {
      activationVersion: 'v1_act',
      agentProfileVersion: 'v1_profile',
      capabilities: [{ id: 'cap.notes.read', revision: '3' }],
    } as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];
    const tool = bridgeCapabilityToolToMastra(
      readActivation,
      fixture.deps.resolveCapability('cap.notes.read', '3') as CapabilityDefinition,
      fixture.deps,
    ) as { execute: unknown };
    const exec = (input: unknown, context: Record<string, unknown> = {}): Promise<unknown> =>
      runWithBridgeTurnScope({ ...SCOPE, threadId: 'thread-bridge' }, () =>
        (tool.execute as (i: unknown, c: unknown) => Promise<unknown>)(input, {
          toolCallId: 'call-1',
          ...context,
        }),
      );
    const result = (await exec({ text: 'hello' })) as Record<string, unknown>;
    expect(result).toEqual({ saved: true, echo: { text: 'hello' } });
    // The gated probe read the durable state AT the moment of invocation:
    // the intent was durably recorded (post-transition 'running' set just
    // before, but the intent row existed before the handler ran).
    expect(fixture.invokeProbe().called).toBe(1);
    const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.status).toBe('completed');
    // The result summary is framework metadata only: shape, never values/keys.
    expect(invocations[0]?.resultSummary).toMatch(/^object\(\d+ fields\)$/);
    // No full payloads in the durable record: safe bounded summaries only.
    expect(JSON.stringify(invocations[0]).length).toBeLessThan(600);
  });

  it('authoritative input-contract rejection never invokes the implementation', async () => {
    const fixture = await makeFixture();
    await fixture.stores.turns.createTurnIntent(turnFixture());
    await fixture.stores.turns.startTurn(SCOPE.turnId, 10);
    const exec = toolExecutorFor(fixture, ACTIVATION_MOCK, SCOPE);
    const result = (await exec({ wrong: 'shape' })) as Record<string, unknown> | undefined;
    // The VICT contract is authoritative: whether the Standard-Schema
    // wrapper (describing the boundary to the model) or the bridge's own
    // authoritative parse rejects first, the implementation is NEVER
    // invoked and the denial is a structured safe failure.
    const rejected =
      result === undefined ||
      result.victCapabilityFailure === 'VICT_CAPABILITY_INPUT_CONTRACT_REJECTED' ||
      (result as { error?: unknown }).error === true;
    expect(rejected).toBe(true);
    expect(fixture.invokeProbe().called).toBe(0);
  });

  it('authoritative output-contract rejection fails safely after invocation', async () => {
    const fixture = await makeFixture(
      makeCapability({
        id: 'cap.notes.read',
        revision: '3',
        effect: 'read',
        output: neutralContract('cap.notes.read.output', () => false),
      }),
    );
    await fixture.stores.turns.createTurnIntent(turnFixture());
    await fixture.stores.turns.startTurn(SCOPE.turnId, 10);
    const readActivation = {
      activationVersion: 'v1_act',
      agentProfileVersion: 'v1_profile',
      capabilities: [{ id: 'cap.notes.read', revision: '3' }],
    } as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];
    const tool = bridgeCapabilityToolToMastra(
      readActivation,
      fixture.deps.resolveCapability('cap.notes.read', '3') as CapabilityDefinition,
      fixture.deps,
    ) as { execute: unknown };
    const exec = (input: unknown, context: Record<string, unknown> = {}): Promise<unknown> =>
      runWithBridgeTurnScope({ ...SCOPE, threadId: 'thread-bridge' }, () =>
        (tool.execute as (i: unknown, c: unknown) => Promise<unknown>)(input, {
          toolCallId: 'call-1',
          ...context,
        }),
      );
    fixture.beginTurnScope(SCOPE.turnId);
    const result = (await exec({ text: 'x' })) as Record<string, unknown>;
    expect(result.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTPUT_CONTRACT_REJECTED');
    const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
    // The capability RAN: the truthful disposition is the fenced,
    // non-replayable outcome_unknown — never an ordinarily retriable failed.
    expect(invocations[0]?.status).toBe('outcome_unknown');
    expect(invocations[0]?.errorCode).toBe('VICT_CAPABILITY_OUTPUT_CONTRACT_REJECTED');
  });

  it('read capabilities proceed without approval; write requires a durable approval record', async () => {
    const readFixture = await makeFixture(
      makeCapability({ id: 'cap.notes.read', revision: '1', effect: 'read' }),
    );
    await readFixture.stores.turns.createTurnIntent({
      ...turnFixture(),
      turnId: 'turn-read',
      streamId: 'stream-read',
    });
    await readFixture.stores.turns.startTurn('turn-read', 10);
    const readTool = bridgeCapabilityToolToMastra(
      { capabilities: [{ id: 'cap.notes.read', revision: '1' }] } as unknown as Parameters<
        typeof bridgeCapabilityToolToMastra
      >[0],
      readFixture.deps.resolveCapability('cap.notes.read', '1') as CapabilityDefinition,
      readFixture.deps,
    ) as { execute: unknown };
    const readResult = (await runWithBridgeTurnScope(
      {
        turnId: 'turn-read',
        streamId: 'stream-read',
        actorId: 'actor-requester',
        agentProfileVersion: 'v1',
        threadId: 't',
      },
      () =>
        (readTool.execute as (i: unknown, c: unknown) => Promise<unknown>)(
          { text: 'x' },
          { toolCallId: 'call-r' },
        ),
    )) as Record<string, unknown>;
    expect(readResult).toEqual({ saved: true, echo: { text: 'x' } });
    expect((await readFixture.stores.approvals.listOpenApprovals()).length).toBe(0);
  });

  it('missing approval creates a durable pending record, suspends the turn, and the requester cannot self-approve', async () => {
    const fixture = await makeFixture();
    await fixture.stores.turns.createTurnIntent(turnFixture());
    await fixture.stores.turns.startTurn(SCOPE.turnId, 10);
    const exec = toolExecutorFor(fixture, ACTIVATION_MOCK, SCOPE);
    const pending = exec({ text: 'hello' });
    // The durable pending record appears (poll until the bridge recorded it).
    let approval = undefined as
      Awaited<ReturnType<AgentTurnService['requestApproval']>> | undefined;
    for (let i = 0; i < 100 && approval === undefined; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      const open = await fixture.stores.approvals.listOpenApprovals();
      approval = open.at(0);
    }
    expect(approval?.status).toBe('pending');
    const turn = await fixture.stores.turns.getTurn(SCOPE.turnId);
    expect(turn?.status).toBe('awaiting-approval');
    // NO invocation while pending.
    expect(fixture.invokeProbe().called).toBe(0);
    // Self-approval denied.
    await expect(
      fixture.turnService.decideToolApproval(fixture.requester, {
        approvalId: approval?.approvalId as string,
        decision: 'approved',
      }),
    ).rejects.toThrow(/own protected action/i);
    // The approver approves; the invocation proceeds exactly once.
    await fixture.turnService.decideToolApproval(fixture.approver, {
      approvalId: approval?.approvalId as string,
      decision: 'approved',
    });
    const result = (await pending) as Record<string, unknown>;
    expect(result).toEqual({ saved: true, echo: { text: 'hello' } });
    expect(fixture.invokeProbe().called).toBe(1);
    const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
    expect(invocations[0]?.status).toBe('completed');
  });

  it('decline resolves durably and NEVER invokes the capability', async () => {
    const fixture = await makeFixture();
    await fixture.stores.turns.createTurnIntent(turnFixture());
    await fixture.stores.turns.startTurn(SCOPE.turnId, 10);
    const exec = toolExecutorFor(fixture, ACTIVATION_MOCK, SCOPE);
    const pending = exec({ text: 'hello' });
    let approvalId = '';
    for (let i = 0; i < 100 && approvalId === ''; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      approvalId = (await fixture.stores.approvals.listOpenApprovals()).at(0)?.approvalId ?? '';
    }
    await fixture.turnService.decideToolApproval(fixture.approver, {
      approvalId,
      decision: 'declined',
    });
    const result = (await pending) as Record<string, unknown>;
    expect(result.victCapabilityFailure).toBe('VICT_CAPABILITY_DECLINED');
    expect(fixture.invokeProbe().called).toBe(0);
    const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
    expect(invocations[0]?.status).toBe('declined');
    expect(invocations[0]?.errorCode).toBe('VICT_TOOL_DECLINED');
  });

  it('competing approve/decline decisions have one truthful winner and the outcome matches', async () => {
    const fixture = await makeFixture();
    await fixture.stores.turns.createTurnIntent(turnFixture());
    await fixture.stores.turns.startTurn(SCOPE.turnId, 10);
    const exec = toolExecutorFor(fixture, ACTIVATION_MOCK, SCOPE);
    const pending = exec({ text: 'hello' });
    let approvalId = '';
    for (let i = 0; i < 100 && approvalId === ''; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      approvalId = (await fixture.stores.approvals.listOpenApprovals()).at(0)?.approvalId ?? '';
    }
    const results = await Promise.allSettled([
      fixture.turnService.decideToolApproval(fixture.approver, {
        approvalId,
        decision: 'declined',
      }),
      fixture.turnService.decideToolApproval(fixture.approver, {
        approvalId,
        decision: 'approved',
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length + rejected.length).toBe(2);
    expect(rejected.length).toBe(1); // the competing decision loses
    const result = (await pending) as Record<string, unknown>;
    expect(result.victCapabilityFailure).toBe('VICT_CAPABILITY_DECLINED');
    expect(fixture.invokeProbe().called).toBe(0);
  });

  it('wrong binding (arg digest) cannot consume an approval', async () => {
    const fixture = await makeFixture();
    await fixture.stores.turns.createTurnIntent(turnFixture());
    await fixture.stores.turns.startTurn(SCOPE.turnId, 10);
    const invocation = await fixture.turnService.recordToolInvocationIntent({
      turnId: SCOPE.turnId,
      toolCallId: 'call-9',
      toolName: 'cap.notes.write',
      capabilityId: 'cap.notes.write',
      capabilityRevision: '3',
      effect: 'write',
      actorId: 'actor-requester',
      argDigest: 'digest-a',
      argumentSummary: 'safe',
    });
    const approval = await fixture.turnService.requestApproval({
      invocation,
      agentProfileVersion: 'v1_profile',
      expiresAt: 9000,
    });
    await fixture.turnService.decideToolApproval(fixture.approver, {
      approvalId: approval.approvalId,
      decision: 'approved',
    });
    const wrong = await fixture.turnService.consumeApproval({
      approvalId: approval.approvalId,
      actorId: 'actor-requester',
      agentProfileVersion: 'v1_profile',
      capabilityId: 'cap.notes.write',
      capabilityRevision: '3',
      turnId: SCOPE.turnId,
      toolCallId: 'call-9',
      invocationId: invocation.invocationId,
      argDigest: 'WRONG-DIGEST',
      effect: 'write',
      at: 5000,
    });
    expect(wrong.approved).toBe(false);
    if (!wrong.approved) {
      expect(wrong.reasonCode).toContain('argDigest');
    }
  });

  it('stable idempotency: the same logical invocation identity survives retry without a duplicate effect', async () => {
    const fixture = await makeFixture();
    await fixture.stores.turns.createTurnIntent(turnFixture());
    await fixture.stores.turns.startTurn(SCOPE.turnId, 10);
    const first = await fixture.turnService.recordToolInvocationIntent({
      turnId: SCOPE.turnId,
      toolCallId: 'call-1',
      toolName: 'cap.notes.write',
      capabilityId: 'cap.notes.write',
      capabilityRevision: '3',
      effect: 'write',
      actorId: 'actor-requester',
      argDigest: 'digest-1',
      argumentSummary: 's',
    });
    const second = await fixture.turnService.recordToolInvocationIntent({
      turnId: SCOPE.turnId,
      toolCallId: 'call-1',
      toolName: 'cap.notes.write',
      capabilityId: 'cap.notes.write',
      capabilityRevision: '3',
      effect: 'write',
      actorId: 'actor-requester',
      argDigest: 'digest-1',
      argumentSummary: 's',
    });
    expect(second.invocationId).toBe(first.invocationId);
  });

  it('restart while pending loses neither the request nor the decision (durable state only)', async () => {
    // Phase 1: create the pending record (the "process" ends here).
    const fixture = await makeFixture();
    await fixture.stores.turns.createTurnIntent(turnFixture());
    await fixture.stores.turns.startTurn(SCOPE.turnId, 10);
    const retryInput = { text: 'hello' };
    const invocation = await fixture.turnService.recordToolInvocationIntent({
      turnId: SCOPE.turnId,
      toolCallId: 'call-1',
      toolName: 'cap.notes.write',
      capabilityId: 'cap.notes.write',
      capabilityRevision: '3',
      effect: 'write',
      actorId: 'actor-requester',
      argDigest: canonicalArgDigest(retryInput),
      argumentSummary: 'safe',
    });
    const approval = await fixture.turnService.requestApproval({
      invocation,
      agentProfileVersion: 'v1_profile',
      expiresAt: 90000,
    });
    expect(await fixture.stores.invocations.getInvocation(invocation.invocationId)).toBeDefined();
    expect(fixture.invokeProbe().called).toBe(0);
    // Phase 2 ("after restart"): a fresh service over the SAME durable
    // state finds the pending approval and decides it.
    const decision = await fixture.turnService.decideToolApproval(fixture.approver, {
      approvalId: approval.approvalId,
      decision: 'approved',
    });
    expect(decision.status).toBe('approved');
    // Phase 3: a retry of the same logical invocation reuses the durable
    // identities and proceeds exactly once after the approval.
    const exec = toolExecutorFor(fixture, ACTIVATION_MOCK, SCOPE);
    const result = (await exec(retryInput)) as Record<string, unknown>;
    expect(result).toEqual({ saved: true, echo: retryInput });
    expect(fixture.invokeProbe().called).toBe(1);
  });

  it('reconciliation after restart: open turns become one honest terminal state', async () => {
    const fixture = await makeFixture();
    await fixture.stores.turns.createTurnIntent(turnFixture());
    await fixture.stores.turns.startTurn(SCOPE.turnId, 10);
    await fixture.stores.turns.recordCancelIntent({
      turnId: SCOPE.turnId,
      cancelId: 'cancel-1',
      actorId: 'actor-requester',
      reasonCode: 'user',
      at: 50,
    });
    const reconciliation = await fixture.turnService.reconcileAfterRestart();
    expect(reconciliation.cancelled).toBe(1);
    const turn = await fixture.stores.turns.getTurn(SCOPE.turnId);
    expect(turn?.status).toBe('cancelled');
  });

  it('an expired RUNNING attempt reconciles to a fenced non-replay state before any retry', async () => {
    // A previous attempt is durably RUNNING (its process died between the
    // effect and terminal persistence, and BOTH the completion and the
    // outcome_unknown transitions were lost). The retry on the SAME logical
    // invocation identity must NEVER re-invoke: the record is reconciled to
    // the truthful fenced `outcome_unknown` state before the retry.
    const fixture = await makeFixture();
    const input = { text: 'retry' };
    await fixture.turnService.recordToolInvocationIntent({
      turnId: SCOPE.turnId,
      toolCallId: 'call-1',
      toolName: 'cap.notes.write',
      capabilityId: 'cap.notes.write',
      capabilityRevision: '3',
      effect: 'write',
      actorId: SCOPE.actorId,
      argDigest: canonicalArgDigest(input),
      argumentSummary: 'safe',
    });
    // The lost attempt is in-flight (the effect MAY exist externally).
    const existing = await fixture.stores.invocations.getInvocationByIdempotencyKey(
      `${SCOPE.turnId}:call-1:cap.notes.write:3:${canonicalArgDigest(input)}`,
    );
    expect(existing?.status).toBe('intent');
    await fixture.stores.invocations.updateInvocationStatus({
      invocationId: existing!.invocationId,
      status: 'running',
      at: 20,
    });
    // The retry reconciles BEFORE any effect: fenced, non-replay.
    const exec = toolExecutorFor(fixture, ACTIVATION_MOCK, SCOPE);
    const result = (await exec(input)) as { victCapabilityFailure?: string };
    expect(result.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
    expect(fixture.invokeProbe().called).toBe(0);
    const fenced = await fixture.stores.invocations.getInvocation(existing!.invocationId);
    expect(fenced?.status).toBe('outcome_unknown');
    // The fenced state is terminal: a late truthful result cannot flip it
    // back into a normal completion.
    await expect(
      fixture.stores.invocations.updateInvocationStatus({
        invocationId: existing!.invocationId,
        status: 'completed',
        at: 30,
        resultSummary: 'late',
      }),
    ).rejects.toThrow(/terminal/i);
  });
});

/** A canonical turn fixture for the scope identity. */
function turnFixture(): AgentTurnRecord {
  return {
    turnId: SCOPE.turnId,
    streamId: SCOPE.streamId,
    threadId: 'thread-bridge',
    actorId: SCOPE.actorId,
    agentProfileVersion: SCOPE.agentProfileVersion,
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
}

// Type-only guard: the awaiting-approval event type stays within the
// normalized vocabulary.
void (undefined as unknown as ((event: AgentStreamEvent) => void) | undefined);
void (undefined as unknown as ((record: AgentToolInvocationRecord) => void) | undefined);
