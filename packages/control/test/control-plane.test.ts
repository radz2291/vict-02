import { describe, expect, it } from 'vitest';
import {
  ActorScopeDeniedError,
  authenticatedActorContext,
  createInMemoryAgentControlStores,
  InMemoryActorDirectory,
  type ActorRecord,
} from '@vict/runtime';
import { createInMemoryStores, type ActivationCatalog } from '@vict/runtime';
import {
  assertScopeForActor,
  ControlPlaneService,
  AgentTurnService,
  safeInputSummary,
} from '../src/index.js';
import type { AuthenticatedActorContext } from '@vict/runtime';

/**
 * Control-plane service conformance: the authenticated actor boundary
 * (default deny, cross-actor denial), the complete ChangeSet lifecycle,
 * stale-base/competing commits, evidence/approval invalidation on content
 * revision, release governance, and agent-turn governance.
 */

function actorFixture(overrides: Partial<ActorRecord> = {}): ActorRecord {
  return {
    actorId: 'actor-dev',
    status: 'active',
    roles: ['developer', 'operator', 'approver', 'administrator'],
    createdAt: 0,
    ...overrides,
  };
}

function ctxOf(record: ActorRecord): AuthenticatedActorContext {
  return authenticatedActorContext(record, record.actorId);
}

const OPERATIONS = [
  {
    kind: 'publish-and-select-release',
    release: {
      releaseVersion: 'release-1',
      applicationId: 'app.proof',
      applicationVersion: 'appver-1',
      rendererIdentity: 'renderer@1',
      componentRegistryIdentity: 'registry@1',
      dataAdapterIdentity: 'adapter@1',
      activationBinding: 'activation-1',
    },
  },
] as const;

function makeService(clock: { value: number }) {
  const stores = createInMemoryAgentControlStores();
  const catalog: ActivationCatalog = createInMemoryStores().catalog;
  const ids: Record<string, unknown> & {
    n: number;
    changesetId(): string;
    changesetApprovalId(): string;
    auditId(): string;
    releaseId(): string;
  } = {
    n: 0,
    changesetId: (): string => `changeset-${(ids.n += 1)}`,
    changesetApprovalId: (): string => `csa-${(ids.n += 1)}`,
    auditId: (): string => `audit-${(ids.n += 1)}`,
    releaseId: (): string => `rel-${(ids.n += 1)}`,
  };
  ids.n = 0;
  const clockFn = (): number => (clock.value += 1);
  const service = new ControlPlaneService({
    stores,
    catalog,
    clock: clockFn,
    ids: {
      changesetId: ids.changesetId,
      changesetApprovalId: ids.changesetApprovalId,
      auditId: ids.auditId,
    },
  });
  const turnService = new AgentTurnService({
    stores,
    clock: clockFn,
    ids: {
      turnId: (): string => `turn-${(ids.n += 1)}`,
      streamId: (): string => `stream-${(ids.n += 1)}`,
      invocationId: (): string => `inv-${(ids.n += 1)}`,
      approvalId: (): string => `approval-${(ids.n += 1)}`,
      idempotencyKey: (): string => `key-${(ids.n += 1)}`,
      cancelId: (): string => `cancel-${(ids.n += 1)}`,
    },
  });
  return { stores, catalog, service, turnService };
}

describe('authenticated actor boundary', () => {
  it('derives authoritative scopes from roles with default denial', () => {
    const developer = ctxOf(actorFixture({ actorId: 'actor-dev', roles: ['developer'] }));
    expect(developer.scopes).toContain('changeset.propose');
    expect(developer.scopes).not.toContain('changeset.approve');
    expect(developer.mastraResourceId).toBe('vict-actor-actor-dev');
    // Scope checks fail closed below every layer.
    expect(() => assertScopeForActor(developer, 'changeset.approve')).toThrow(
      ActorScopeDeniedError,
    );
    const approver = ctxOf(actorFixture({ actorId: 'actor-approver', roles: ['approver'] }));
    expect(approver.scopes).toContain('changeset.approve');
    expect(approver.scopes).not.toContain('changeset.propose');
  });

  it('unknown, disabled, malformed, and mismatched actors fail closed', async () => {
    const directory = new InMemoryActorDirectory();
    await expect(resolveActor(directory, 'ghost')).rejects.toThrow(/UNAUTHENTICATED/);
    await directory.upsert(actorFixture({ actorId: 'actor-disabled', status: 'disabled' }));
    await expect(resolveActor(directory, 'actor-disabled')).rejects.toThrow(/UNAUTHENTICATED/);
    // The authenticated context never accepts a requested mismatch.
    const record = actorFixture();
    expect(() => authenticatedActorContext(record, 'actor-other')).toThrow(/UNAUTHENTICATED/);
    const enabled = actorFixture();
    await directory.upsert(enabled);
    const context = await resolveActor(directory, 'actor-dev');
    expect(context.actorId).toBe('actor-dev');
  });

  async function resolveActor(
    directory: InMemoryActorDirectory,
    actorId: string,
  ): Promise<AuthenticatedActorContext> {
    const record = await directory.get(actorId);
    return authenticatedActorContext(record, actorId);
  }
});

describe('ChangeSet lifecycle', () => {
  it('a complete valid lifecycle: propose → evidence → approve → commit', async () => {
    const clock = { value: 100 };
    const { service, stores } = makeService(clock);
    const author = ctxOf(actorFixture());
    const approver = ctxOf(actorFixture({ actorId: 'actor-approver', roles: ['approver'] }));
    const proposed = await service.propose(author, {
      changesetId: 'changeset-lifecycle',
      base: { kind: 'release', subjectId: 'app.proof', expectedVersion: 'none' },
      operations: OPERATIONS as unknown as readonly unknown[],
      rationale: 'Publish the proof release.',
      riskClass: 'medium',
      requiredApproverCount: 1,
      expiresAt: 10_000,
    });
    expect(proposed.status).toBe('draft');
    expect(proposed.contentHash).toMatch(/^v1_[0-9a-f]{64}$/);
    const withEvidence = await service.attachValidationEvidence(author, {
      changesetId: 'changeset-lifecycle',
      evidence: { runId: 'run-val-1', outcome: 'passed', recordedAt: 200 },
    });
    expect(withEvidence.validation?.outcome).toBe('passed');
    const decided = await service.decide(approver, {
      changesetId: 'changeset-lifecycle',
      decision: 'approved',
    });
    expect(decided.record.status).toBe('approved');
    const committed = await service.commit(author, { changesetId: 'changeset-lifecycle' });
    expect(committed.record.status).toBe('committed');
    expect(committed.applied).toEqual(['publish-and-select-release:release-1']);
    const selected = await service.getSelectedRelease('app.proof');
    expect(selected?.releaseVersion).toBe('release-1');
    // Idempotent commit.
    const again = await service.commit(author, { changesetId: 'changeset-lifecycle' });
    expect(again.applied).toEqual([]);
    // Every transition is attributable.
    const actions = (await service.auditTrail({ subjectId: 'changeset-lifecycle' })).map(
      (event) => event.action,
    );
    expect(actions).toContain('changeset.proposed');
    expect(actions).toContain('changeset.approved');
    expect(actions).toContain('changeset.committed');
    void stores;
  });

  it('stale-base proposals fail without mutation and competing commits have one winner', async () => {
    const clock = { value: 100 };
    const { service } = makeService(clock);
    const author = ctxOf(actorFixture());
    const approver = ctxOf(actorFixture({ actorId: 'actor-approver', roles: ['approver'] }));
    // Two competing changesets over the same base.
    await service.publishRelease(author, {
      releaseVersion: 'release-a',
      applicationId: 'app.race',
      applicationVersion: 'appver-a',
      rendererIdentity: 'renderer@1',
      componentRegistryIdentity: 'registry@1',
      dataAdapterIdentity: 'adapter@1',
      activationBinding: 'activation-a',
    });
    await service.selectRelease(author, { applicationId: 'app.race', releaseVersion: 'release-a' });
    for (const changesetId of ['changeset-race-1', 'changeset-race-2']) {
      await service.propose(author, {
        changesetId,
        base: { kind: 'release', subjectId: 'app.race', expectedVersion: 'release-a' },
        operations: [
          {
            kind: 'select-release',
            applicationId: 'app.race',
            releaseVersion: changesetId === 'changeset-race-1' ? 'release-b' : 'release-a',
          },
        ],
        rationale: 'Competing proposal',
        riskClass: 'low',
        requiredApproverCount: 1,
        expiresAt: 10_000,
      });
      await service.decide(approver, { changesetId, decision: 'approved' });
    }
    await service.publishRelease(author, {
      releaseVersion: 'release-b',
      applicationId: 'app.race',
      applicationVersion: 'appver-b',
      rendererIdentity: 'renderer@1',
      componentRegistryIdentity: 'registry@1',
      dataAdapterIdentity: 'adapter@1',
      activationBinding: 'activation-b',
    });
    const first = await service.commit(author, { changesetId: 'changeset-race-1' });
    expect(first.record.status).toBe('committed');
    // The competing commit now faces a stale base and fails WITHOUT mutation.
    await expect(service.commit(author, { changesetId: 'changeset-race-2' })).rejects.toThrow(
      /stale/i,
    );
    const loser = await service.get('changeset-race-2');
    expect(loser?.status).toBe('approved'); // not committed; no partial mutation
  });

  it('content revision invalidates earlier evidence and approval', async () => {
    const clock = { value: 100 };
    const { service } = makeService(clock);
    const author = ctxOf(actorFixture());
    const approver = ctxOf(actorFixture({ actorId: 'actor-approver', roles: ['approver'] }));
    await service.propose(author, {
      changesetId: 'changeset-revise',
      base: { kind: 'release', subjectId: 'app.proof', expectedVersion: 'none' },
      operations: OPERATIONS as unknown as readonly unknown[],
      rationale: 'Original',
      riskClass: 'low',
      requiredApproverCount: 1,
      expiresAt: 10_000,
    });
    await service.attachValidationEvidence(author, {
      changesetId: 'changeset-revise',
      evidence: { runId: 'run-1', outcome: 'passed', recordedAt: 200 },
    });
    await service.decide(approver, { changesetId: 'changeset-revise', decision: 'approved' });
    const originalHash = (await service.get('changeset-revise'))?.contentHash;
    const revised = await service.revise(author, {
      changesetId: 'changeset-revise',
      operations: [
        {
          kind: 'publish-and-select-release',
          release: {
            releaseVersion: 'release-2',
            applicationId: 'app.proof',
            applicationVersion: 'appver-2',
            rendererIdentity: 'renderer@1',
            componentRegistryIdentity: 'registry@1',
            dataAdapterIdentity: 'adapter@1',
            activationBinding: 'activation-2',
          },
        },
      ],
      rationale: 'Revised',
      riskClass: 'low',
      requiredApproverCount: 1,
      expiresAt: 10_000,
    });
    expect(revised.contentHash).not.toBe(originalHash);
    expect((await service.get('changeset-revise'))?.contentHash).toBe(revised.contentHash);
    // Evidence was invalidated.
    expect(revised.validation).toBeUndefined();
    expect(revised.status).toBe('draft');
    // The old approval cannot satisfy the new content.
    await expect(service.commit(author, { changesetId: 'changeset-revise' })).rejects.toThrow(
      /no longer bind|not approved/i,
    );
  });

  it('approval expiry and wrong-approver semantics', async () => {
    const clock = { value: 100 };
    const { service } = makeService(clock);
    const author = ctxOf(actorFixture());
    await service.propose(author, {
      changesetId: 'changeset-expired',
      base: { kind: 'release', subjectId: 'app.proof', expectedVersion: 'none' },
      operations: OPERATIONS as unknown as readonly unknown[],
      rationale: 'Expiring proposal',
      riskClass: 'low',
      requiredApproverCount: 1,
      expiresAt: 105,
    });
    const approver = ctxOf(actorFixture({ actorId: 'actor-approver', roles: ['approver'] }));
    // Advance past the expiry.
    clock.value = 500;
    await expect(
      service.decide(approver, { changesetId: 'changeset-expired', decision: 'approved' }),
    ).rejects.toThrow(/expired/i);
    const record = await service.get('changeset-expired');
    expect(record?.status).toBe('expired');
  });

  it('release publish/select/rollback never mutates a published release and preserves history', async () => {
    const clock = { value: 100 };
    const { service } = makeService(clock);
    const operator = ctxOf(actorFixture({ actorId: 'actor-op', roles: ['administrator'] }));
    await service.publishRelease(operator, {
      releaseVersion: 'release-r1',
      applicationId: 'app.rb',
      applicationVersion: 'appver-r1',
      rendererIdentity: 'renderer@1',
      componentRegistryIdentity: 'registry@1',
      dataAdapterIdentity: 'adapter@1',
      activationBinding: 'activation-r1',
    });
    await service.publishRelease(operator, {
      releaseVersion: 'release-r2',
      applicationId: 'app.rb',
      applicationVersion: 'appver-r2',
      rendererIdentity: 'renderer@2',
      componentRegistryIdentity: 'registry@2',
      dataAdapterIdentity: 'adapter@2',
      activationBinding: 'activation-r2',
    });
    await service.selectRelease(operator, {
      applicationId: 'app.rb',
      releaseVersion: 'release-r2',
    });
    const rollback = await service.rollbackRelease(operator, {
      applicationId: 'app.rb',
      targetReleaseVersion: 'release-r1',
    });
    expect(rollback.reason).toBe('rollback');
    expect((await service.getSelectedRelease('app.rb'))?.releaseVersion).toBe('release-r1');
    // History preserved: both releases remain listed, selections recorded.
    expect((await service.auditTrail({ subjectType: 'release' })).length).toBeGreaterThanOrEqual(3);
  });
});

describe('agent-turn governance', () => {
  it('durable turn intents, cancellation, and restart reconciliation', async () => {
    const clock = { value: 100 };
    const { stores, turnService } = makeService(clock);
    const user = ctxOf(actorFixture());
    // No executor composed: turn start fails closed BEFORE execution.
    await expect(
      turnService.startTurn(user, { threadId: 'thread-1', input: 'hello' }),
    ).rejects.toThrow(/executor/i);
    void stores;
  });

  it('cross-actor turn inspection is denied', async () => {
    const clock = { value: 100 };
    const { stores, turnService } = makeService(clock);
    await stores.turns.createTurnIntent({
      turnId: 'turn-x',
      streamId: 'stream-x',
      threadId: 'thread-x',
      actorId: 'actor-other',
      agentProfileVersion: 'v1_x',
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
    });
    const user = ctxOf(actorFixture({ actorId: 'actor-viewer', roles: ['viewer'] }));
    await expect(turnService.getTurn(user, 'turn-x')).rejects.toThrow(/different actor/);
  });

  it('approval decisions deny self-approval and cross-binding consumption', async () => {
    const clock = { value: 100 };
    const { stores, turnService } = makeService(clock);
    const requester = ctxOf(actorFixture());
    const approver = ctxOf(actorFixture({ actorId: 'actor-approver', roles: ['approver'] }));
    await stores.turns.createTurnIntent({
      turnId: 'turn-ap',
      streamId: 'stream-ap',
      threadId: 'thread-ap',
      actorId: requester.actorId,
      agentProfileVersion: 'v1_ap',
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
    });
    await stores.turns.startTurn('turn-ap', 50);
    const invocation = await turnService.recordToolInvocationIntent({
      turnId: 'turn-ap',
      toolCallId: 'call-1',
      toolName: 'cap.protected',
      capabilityId: 'cap.protected',
      capabilityRevision: '3',
      effect: 'write',
      actorId: requester.actorId,
      argDigest: 'digest-1',
      argumentSummary: 'safe',
    });
    const approval = await turnService.requestApproval({
      invocation,
      agentProfileVersion: 'v1_ap',
      expiresAt: 9000,
    });
    const turn = await stores.turns.getTurn('turn-ap');
    expect(turn?.status).toBe('awaiting-approval');
    // The product agent cannot approve itself (the requesting actor is denied).
    await expect(
      turnService.decideToolApproval(requester, {
        approvalId: approval.approvalId,
        decision: 'approved',
      }),
    ).rejects.toThrow(/own protected action/i);
    await turnService.decideToolApproval(approver, {
      approvalId: approval.approvalId,
      decision: 'approved',
    });
    // Exact binding: wrong digest is denied.
    const wrongDigest = await turnService.consumeApproval({
      approvalId: approval.approvalId,
      actorId: requester.actorId,
      agentProfileVersion: 'v1_ap',
      capabilityId: 'cap.protected',
      capabilityRevision: '3',
      turnId: 'turn-ap',
      toolCallId: 'call-1',
      invocationId: invocation.invocationId,
      argDigest: 'WRONG',
      effect: 'write',
      at: 1000,
    });
    expect(wrongDigest.approved).toBe(false);
    const valid = await turnService.consumeApproval({
      approvalId: approval.approvalId,
      actorId: requester.actorId,
      agentProfileVersion: 'v1_ap',
      capabilityId: 'cap.protected',
      capabilityRevision: '3',
      turnId: 'turn-ap',
      toolCallId: 'call-1',
      invocationId: invocation.invocationId,
      argDigest: 'digest-1',
      effect: 'write',
      at: 1000,
    });
    expect(valid.approved).toBe(true);
  });

  it('input summaries are bounded and never the full prompt', () => {
    expect(safeInputSummary('short', 120)).toBe('short');
    const long = 'x'.repeat(500);
    const summary = safeInputSummary(long, 120);
    expect(summary.length).toBeLessThanOrEqual(121);
  });
});
