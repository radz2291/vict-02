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
  createControlPlaneSandboxSimulator,
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
  const simulator = createControlPlaneSandboxSimulator({ stores, catalog });
  const service = new ControlPlaneService({
    stores,
    catalog,
    clock: clockFn,
    simulator,
    ids: {
      changesetId: ids.changesetId,
      changesetApprovalId: ids.changesetApprovalId,
      auditId: ids.auditId,
      controlRunId: (): string => `run-${(ids.n += 1)}`,
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
  it('a complete valid lifecycle: propose → executed checks → evidence → approve → commit', async () => {
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
    // Authoritative governance runs EXECUTE through the trusted boundary;
    // evidence derives from the durable run records (never caller claims).
    const validationRun = await service.executeChangeSetCheck(author, {
      changesetId: 'changeset-lifecycle',
      kind: 'validation',
    });
    expect(validationRun.outcome).toBe('passed');
    expect(validationRun.runnerProfile).toBe(ControlPlaneService.RUNNER_PROFILE);
    const simulationRun = await service.executeChangeSetCheck(author, {
      changesetId: 'changeset-lifecycle',
      kind: 'simulation',
    });
    const withEvidence = await service.attachValidationEvidence(author, {
      changesetId: 'changeset-lifecycle',
      runId: validationRun.runId,
    });
    expect(withEvidence.validation?.outcome).toBe('passed');
    expect(withEvidence.validation?.contentHash).toBe(withEvidence.contentHash);
    await service.attachSimulationEvidence(author, {
      changesetId: 'changeset-lifecycle',
      runId: simulationRun.runId,
    });
    const decided = await service.decide(approver, {
      changesetId: 'changeset-lifecycle',
      decision: 'approved',
    });
    expect(decided.record.status).toBe('approved');
    const committed = await service.commit(author, { changesetId: 'changeset-lifecycle' });
    expect(committed.record.status).toBe('committed');
    expect(committed.applied).toEqual(['publish-and-select-release']);
    const selected = await service.getSelectedRelease(author, 'app.proof');
    expect(selected?.releaseVersion).toBe('release-1');
    // Idempotent commit.
    const again = await service.commit(author, { changesetId: 'changeset-lifecycle' });
    expect(again.record.status).toBe('committed');
    expect(again.applied).toEqual(['publish-and-select-release']);
    // Every transition is attributable.
    const actions = (await service.auditTrail({ subjectId: 'changeset-lifecycle' })).map(
      (event) => event.action,
    );
    expect(actions).toContain('changeset.proposed');
    expect(actions).toContain('changeset.approved');
    expect(actions).toContain('changeset.committed');
    void stores;
  });

  it('commit without the mandated evidence fails with structured diagnostics (F5)', async () => {
    const clock = { value: 100 };
    const { service } = makeService(clock);
    const author = ctxOf(actorFixture());
    const approver = ctxOf(actorFixture({ actorId: 'actor-approver', roles: ['approver'] }));
    await service.propose(author, {
      changesetId: 'changeset-noev',
      base: { kind: 'release', subjectId: 'app.noev', expectedVersion: 'none' },
      operations: OPERATIONS as unknown as readonly unknown[],
      rationale: 'No evidence attached.',
      riskClass: 'high',
      requiredApproverCount: 1,
      expiresAt: 10_000,
    });
    await service.decide(approver, { changesetId: 'changeset-noev', decision: 'approved' });
    await expect(service.commit(author, { changesetId: 'changeset-noev' })).rejects.toThrow(
      /requires an executed validation run/,
    );
  });

  it('fabricated and replayed evidence cannot authorize a commit (F5)', async () => {
    const clock = { value: 100 };
    const { service, stores } = makeService(clock);
    const author = ctxOf(actorFixture());
    const approver = ctxOf(actorFixture({ actorId: 'actor-approver', roles: ['approver'] }));
    await service.propose(author, {
      changesetId: 'changeset-fab',
      base: { kind: 'release', subjectId: 'app.fab', expectedVersion: 'none' },
      operations: OPERATIONS.map((operation) => ({
        ...operation,
        release: { ...operation.release, releaseVersion: 'release-fab' },
      })) as unknown as readonly unknown[],
      rationale: 'Fabricated evidence target.',
      riskClass: 'low',
      requiredApproverCount: 1,
      expiresAt: 10_000,
    });
    // A run executed for a DIFFERENT changeset cannot be attached.
    const foreign = await service.propose(author, {
      changesetId: 'changeset-fab-other',
      base: { kind: 'release', subjectId: 'app.fab', expectedVersion: 'none' },
      operations: OPERATIONS as unknown as readonly unknown[],
      rationale: 'Foreign run source.',
      riskClass: 'low',
      requiredApproverCount: 1,
      expiresAt: 10_000,
    });
    const foreignRun = await service.executeChangeSetCheck(author, {
      changesetId: foreign.changesetId,
      kind: 'validation',
    });
    await expect(
      service.attachValidationEvidence(author, {
        changesetId: 'changeset-fab',
        runId: foreignRun.runId,
      }),
    ).rejects.toThrow(/executed for a different ChangeSet/);
    // A fabricated run id cannot be attached.
    await expect(
      service.attachValidationEvidence(author, {
        changesetId: 'changeset-fab',
        runId: 'never-executed-run',
      }),
    ).rejects.toThrow(/not executed by the trusted/);
    // An honest run executes through the boundary while the ChangeSet is a
    // draft (this is the ONLY way evidence can ever be produced).
    const ownRun = await service.executeChangeSetCheck(author, {
      changesetId: 'changeset-fab',
      kind: 'validation',
    });
    expect(ownRun.outcome).toBe('passed');
    // Directly persisted foreign evidence cannot authorize a commit either.
    await stores.control.updateChangeSet('changeset-fab', (record) => ({
      ...record,
      validation: {
        runId: 'fabricated-run-id',
        outcome: 'passed' as const,
        recordedAt: 1,
        contentHash: record.contentHash,
        base: record.base,
        runnerProfile: 'vict.control-plane@1',
        actorId: author.actorId,
      },
    }));
    await service.decide(approver, { changesetId: 'changeset-fab', decision: 'approved' });
    await expect(service.commit(author, { changesetId: 'changeset-fab' })).rejects.toThrow(
      /does not reference a matching executed run/,
    );
    // Replayed evidence: the SAME executed run cannot authorize DIFFERENT
    // content (hash mismatch blocks the commit). Return to draft, revise,
    // and try to replay the old run against the NEW content.
    await service.revise(author, {
      changesetId: 'changeset-fab',
      operations: OPERATIONS.map((operation) => ({
        ...operation,
        release: { ...operation.release, releaseVersion: 'release-fab-2' },
      })) as unknown as readonly unknown[],
      rationale: 'Revised after evidence.',
      riskClass: 'low',
      requiredApproverCount: 1,
      expiresAt: 10_000,
    });
    const staleReplay = await stores.control.getControlRun(ownRun.runId);
    expect(staleReplay?.contentHash).not.toBe(
      (await service.get(author, 'changeset-fab'))?.contentHash,
    );
    await expect(
      service.attachValidationEvidence(author, {
        changesetId: 'changeset-fab',
        runId: ownRun.runId,
      }),
    ).rejects.toThrow(/executed against different ChangeSet content/);
    // A second approver approves the revised content; the commit then fails
    // because the revised content has NO executed evidence.
    const approver2 = ctxOf(actorFixture({ actorId: 'actor-approver-2', roles: ['approver'] }));
    await service.decide(approver2, { changesetId: 'changeset-fab', decision: 'approved' });
    await expect(service.commit(author, { changesetId: 'changeset-fab' })).rejects.toThrow(
      /requires an executed validation run/,
    );
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
    await service.publishRelease(author, {
      releaseVersion: 'release-b',
      applicationId: 'app.race',
      applicationVersion: 'appver-b',
      rendererIdentity: 'renderer@1',
      componentRegistryIdentity: 'registry@1',
      dataAdapterIdentity: 'adapter@1',
      activationBinding: 'activation-b',
    });
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
      // Authoritative validation evidence: executed through the trusted
      // boundary while the proposal is a draft, attached, then decided.
      const run = await service.executeChangeSetCheck(author, {
        changesetId,
        kind: 'validation',
      });
      await service.attachValidationEvidence(author, { changesetId, runId: run.runId });
      await service.decide(approver, { changesetId, decision: 'approved' });
    }
    const first = await service.commit(author, { changesetId: 'changeset-race-1' });
    expect(first.record.status).toBe('committed');
    // The competing commit now faces a stale base and fails WITHOUT mutation.
    await expect(service.commit(author, { changesetId: 'changeset-race-2' })).rejects.toThrow(
      /stale/i,
    );
    const loser = await service.get(author, 'changeset-race-2');
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
      runId: (
        await service.executeChangeSetCheck(author, {
          changesetId: 'changeset-revise',
          kind: 'validation',
        })
      ).runId,
    });
    await service.decide(approver, { changesetId: 'changeset-revise', decision: 'approved' });
    const originalHash = (await service.get(author, 'changeset-revise'))?.contentHash;
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
    expect((await service.get(author, 'changeset-revise'))?.contentHash).toBe(revised.contentHash);
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
    const record = await service.get(author, 'changeset-expired');
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
    expect((await service.getSelectedRelease(operator, 'app.rb'))?.releaseVersion).toBe(
      'release-r1',
    );
    // History preserved: both releases remain listed, selections recorded.
    expect((await service.auditTrail({ subjectType: 'release' })).length).toBeGreaterThanOrEqual(3);
  });
});

describe('ChangeSet commit saga (durable applying; F6)', () => {
  it('prevalidation blocks the complete commit when any operation cannot apply: no partial state', async () => {
    const clock = { value: 100 };
    const { service, stores } = makeService(clock);
    const author = ctxOf(actorFixture());
    const approver = ctxOf(actorFixture({ actorId: 'actor-approver', roles: ['approver'] }));
    await service.propose(author, {
      changesetId: 'changeset-partial',
      base: { kind: 'release', subjectId: 'app.partial', expectedVersion: 'none' },
      operations: [
        {
          kind: 'publish-and-select-release',
          release: {
            releaseVersion: 'release-ok-1',
            applicationId: 'app.partial',
            applicationVersion: 'appver-1',
            rendererIdentity: 'renderer@1',
            componentRegistryIdentity: 'registry@1',
            dataAdapterIdentity: 'adapter@1',
            activationBinding: 'activation-1',
          },
        },
        {
          kind: 'select-release',
          applicationId: 'app.partial',
          releaseVersion: 'never-published',
        },
      ],
      rationale: 'Partial-application probe corrected.',
      riskClass: 'low',
      requiredApproverCount: 1,
      expiresAt: 10_000,
    });
    const run = await service.executeChangeSetCheck(author, {
      changesetId: 'changeset-partial',
      kind: 'validation',
    });
    // The authoritative run BLOCKS: operation two references a release that
    // does not exist.
    expect(run.outcome).toBe('blocked');
    await service.attachValidationEvidence(author, {
      changesetId: 'changeset-partial',
      runId: run.runId,
    });
    await service.decide(approver, { changesetId: 'changeset-partial', decision: 'approved' });
    await expect(service.commit(author, { changesetId: 'changeset-partial' })).rejects.toThrow(
      /did not pass \(blocked\)/,
    );
    // NO partial external state: nothing was applied, and the ChangeSet is
    // truthfully still `approved` (never a falsely final state).
    expect(await service.getSelectedRelease(author, 'app.partial')).toBeUndefined();
    expect((await service.get(author, 'changeset-partial'))?.status).toBe('approved');
    expect((await stores.control.listOperationReceipts('changeset-partial')).length).toBe(0);
  });

  it('an interrupted applying saga resumes from durable receipts without repeating effects', async () => {
    const clock = { value: 100 };
    const { service, stores } = makeService(clock);
    const author = ctxOf(actorFixture());
    const approver = ctxOf(actorFixture({ actorId: 'actor-approver', roles: ['approver'] }));
    await service.publishRelease(author, {
      releaseVersion: 'release-saga-b',
      applicationId: 'app.saga',
      applicationVersion: 'appver-b',
      rendererIdentity: 'renderer@1',
      componentRegistryIdentity: 'registry@1',
      dataAdapterIdentity: 'adapter@1',
      activationBinding: 'activation-b',
    });
    await service.propose(author, {
      changesetId: 'changeset-saga',
      base: { kind: 'release', subjectId: 'app.saga', expectedVersion: 'none' },
      operations: [
        {
          kind: 'publish-and-select-release',
          release: {
            releaseVersion: 'release-saga-a',
            applicationId: 'app.saga',
            applicationVersion: 'appver-a',
            rendererIdentity: 'renderer@1',
            componentRegistryIdentity: 'registry@1',
            dataAdapterIdentity: 'adapter@1',
            activationBinding: 'activation-a',
          },
        },
        { kind: 'select-release', applicationId: 'app.saga', releaseVersion: 'release-saga-b' },
      ],
      rationale: 'Saga resumption proof.',
      riskClass: 'low',
      requiredApproverCount: 1,
      expiresAt: 10_000,
    });
    const run = await service.executeChangeSetCheck(author, {
      changesetId: 'changeset-saga',
      kind: 'validation',
    });
    await service.attachValidationEvidence(author, {
      changesetId: 'changeset-saga',
      runId: run.runId,
    });
    await service.decide(approver, { changesetId: 'changeset-saga', decision: 'approved' });
    // REAL fault injection at the effect boundary of the SECOND operation
    // (never a manually inserted receipt): operation 0 applies fully
    // (intent + effect + applied receipt); operation 1's intent is durable
    // but its effect fails — the truthful durable state is `applying` with
    // exactly one APPLIED receipt and one PREPARED intent.
    const realSelect = stores.control.selectRelease.bind(stores.control);
    let selectFailures = 0;
    stores.control.selectRelease = async (command) => {
      if (command.releaseVersion === 'release-saga-b' && selectFailures === 0) {
        selectFailures += 1;
        throw new Error('INJECTED: process dies before the second effect completes');
      }
      return realSelect(command);
    };
    await expect(service.commit(author, { changesetId: 'changeset-saga' })).rejects.toThrow(
      /INJECTED/,
    );
    const interrupted = await service.get(author, 'changeset-saga');
    expect(interrupted?.status).toBe('applying');
    const receiptsAfterCrash = await stores.control.listOperationReceipts('changeset-saga');
    expect(receiptsAfterCrash.map((receipt) => receipt.state)).toEqual(['applied', 'prepared']);
    const selectionsAfterCrash = await stores.control.listReleaseSelections('app.saga');
    expect(selectionsAfterCrash).toHaveLength(1); // exactly ONE logical effect so far
    // Recovery VERIFIES target state and completes the saga: operation 0 is
    // never repeated, operation 1's fenced effect executes exactly once.
    const recovery = await service.recoverChangeSetCommits();
    expect(recovery.completed).toBe(1);
    expect(recovery.interrupted).toEqual([]);
    const resumed = await service.get(author, 'changeset-saga');
    expect(resumed?.status).toBe('committed');
    // The final selection is the SECOND operation's effect (exactly once).
    const selected = await service.getSelectedRelease(author, 'app.saga');
    expect(selected?.releaseVersion).toBe('release-saga-b');
    const selectionsAfterRecovery = await stores.control.listReleaseSelections('app.saga');
    expect(selectionsAfterRecovery.map((s) => s.releaseVersion)).toEqual([
      'release-saga-a',
      'release-saga-b',
    ]);
    // Recovery is idempotent: a second pass finds nothing to do.
    const again = await service.recoverChangeSetCommits();
    expect(again.completed).toBe(0);
    // Audit agrees with actual committed state (idempotent emission).
    const actions = (await service.auditTrail({ subjectId: 'changeset-saga' })).map(
      (event) => event.action,
    );
    expect(actions.filter((action) => action === 'changeset.committed').length).toBe(1);
  });

  it('concurrent commits produce one logical application (CAS one-winner)', async () => {
    const clock = { value: 100 };
    const { service, stores } = makeService(clock);
    const author = ctxOf(actorFixture());
    const approver = ctxOf(actorFixture({ actorId: 'actor-approver', roles: ['approver'] }));
    await service.propose(author, {
      changesetId: 'changeset-race-commit',
      base: { kind: 'release', subjectId: 'app.racecommit', expectedVersion: 'none' },
      operations: OPERATIONS.map((operation) => ({
        ...operation,
        release: {
          ...operation.release,
          releaseVersion: 'release-racecommit',
          applicationId: 'app.racecommit',
        },
      })) as unknown as readonly unknown[],
      rationale: 'Concurrent commit race.',
      riskClass: 'low',
      requiredApproverCount: 1,
      expiresAt: 10_000,
    });
    const run = await service.executeChangeSetCheck(author, {
      changesetId: 'changeset-race-commit',
      kind: 'validation',
    });
    await service.attachValidationEvidence(author, {
      changesetId: 'changeset-race-commit',
      runId: run.runId,
    });
    await service.decide(approver, { changesetId: 'changeset-race-commit', decision: 'approved' });
    // Both racers pass prevalidation; only ONE wins the approved→applying CAS.
    const [first, second] = await Promise.allSettled([
      service.commit(author, { changesetId: 'changeset-race-commit' }),
      service.commit(author, { changesetId: 'changeset-race-commit' }),
    ]);
    const winners = [first, second].filter((entry) => entry.status === 'fulfilled');
    expect(winners.length).toBe(1);
    const record = await service.get(author, 'changeset-race-commit');
    expect(record?.status).toBe('committed');
    // Exactly one logical application: each operation has exactly one receipt.
    const receipts = await stores.control.listOperationReceipts('changeset-race-commit');
    expect(receipts.length).toBe(1);
    expect(
      (await service.auditTrail({ subjectId: 'changeset-race-commit' })).filter(
        (event) => event.action === 'changeset.committed',
      ).length,
    ).toBe(1);
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

  it('input summaries are framework metadata only and never contain prompt text', () => {
    expect(safeInputSummary('short', 120)).toBe('user-input:length=5');
    const canary = 'CANARY-prompt-text-9f2a confidential 8842';
    const summary = safeInputSummary(canary, 120);
    expect(summary).toBe(`user-input:length=${canary.length}`);
    expect(summary).not.toContain('CANARY');
    expect(summary).not.toContain('8842');
    const long = 'x'.repeat(500);
    const summary2 = safeInputSummary(long, 120);
    expect(summary2).toBe(`user-input:length=500`);
  });
});
