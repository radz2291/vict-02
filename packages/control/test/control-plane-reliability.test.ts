import { describe, expect, it } from 'vitest';
import {
  authenticatedActorContext,
  CHANGESET_BASE_NONE,
  createInMemoryAgentControlStores,
  createInMemoryStores,
  VictControlError,
  type ActivationCatalog,
  type ActivationManifest,
  type ActorRecord,
  type ControlRunRecord,
} from '@victframework/runtime';
import {
  canonicalJson,
  canonicalSemanticForm,
  computeActivationVersion,
  computeCapabilitySetVersion,
  computeGraphVersion,
} from '@victframework/kernel';
import { ControlPlaneService, createControlPlaneSandboxSimulator } from '../src/index.js';
import type { AuthenticatedActorContext } from '@victframework/runtime';

/**
 * Stage 06B final reliability correction — R4 + governance-run truthfulness.
 *
 * Proven here against the real in-memory composition (the SQLite adapter
 * shares the conformance and restart suites):
 * - activation ChangeSet bases are CAS-guarded at the SUBJECT level with an
 *   EXPLICIT absence representation (never an overloaded `undefined`); two
 *   concurrent commits based on an absent selection produce ONE winner;
 * - activation selection carries a stable operation identity; re-applying
 *   the same operation returns the original selection without adding a
 *   revision; a different operation identity with the stale base fails;
 * - recovery of a prepared activation operation verifies the EXACT
 *   operation identity (not merely that the target happens to be selected);
 * - validation and simulation compare the DECLARED base with the current
 *   subject selection (including explicit expected absence): a stale base
 *   is blocked, never passed; commit-time CAS remains mandatory.
 */

function actorFixture(overrides: Partial<ActorRecord> = {}): ActorRecord {
  return {
    actorId: 'actor-rel',
    status: 'active',
    roles: ['developer', 'operator', 'approver', 'administrator'],
    createdAt: 0,
    ...overrides,
  };
}

function ctxOf(record: ActorRecord): AuthenticatedActorContext {
  return authenticatedActorContext(record, record.actorId);
}

/**
 * GENUINE activation fixture (identities computed by the kernel's
 * canonical identity functions). The suffix participates in the capability
 * identity, so distinct fixtures compute DISTINCT activation versions for
 * the same graph.
 */
function activationManifest(
  graphId: string,
  suffix: string,
): {
  manifest: ActivationManifest;
  canonicalManifest: string;
  activationVersion: string;
} {
  const graph = {
    schema: 'vict.graph@1',
    id: graphId,
    entry: 'n1',
    nodes: [{ id: 'n1', capability: `cap.rel.${suffix}`, input: null, output: null }],
    edges: [] as never[],
  } as unknown as Parameters<typeof computeGraphVersion>[0];
  const bindings = [
    {
      capability: `cap.rel.${suffix}`,
      revision: '1',
      effect: 'pure' as const,
      input: null,
      output: null,
    },
  ];
  const graphVersion = computeGraphVersion(graph);
  const capabilitySetVersion = computeCapabilitySetVersion(bindings);
  const manifest: ActivationManifest = {
    manifestSchema: 'vict.activation-manifest@1',
    graphId,
    graph: canonicalSemanticForm(graph),
    graphVersion,
    capabilitySetVersion,
    activationVersion: computeActivationVersion(graphVersion, capabilitySetVersion),
    bindings,
    contracts: [],
  };
  return {
    manifest,
    canonicalManifest: canonicalJson(manifest),
    activationVersion: manifest.activationVersion,
  };
}

let clockValue = 1000;

function makeService() {
  clockValue = 1000;
  const stores = createInMemoryAgentControlStores();
  const catalog: ActivationCatalog = createInMemoryStores().catalog;
  let n = 0;
  const service = new ControlPlaneService({
    stores,
    catalog,
    clock: () => (clockValue += 1),
    simulator: createControlPlaneSandboxSimulator({ stores, catalog }),
    ids: {
      changesetId: () => `cs-${(n += 1)}`,
      changesetApprovalId: () => `csa-${(n += 1)}`,
      auditId: () => `audit-${(n += 1)}`,
      controlRunId: () => `run-${(n += 1)}`,
    },
  });
  return { stores, catalog, service, actor: ctxOf(actorFixture()) };
}

const RELEASE_OP = {
  kind: 'select-release',
  applicationId: 'app.rel',
  releaseVersion: 'release-2',
} as const;

const ACTIVATION_SELECT_OP = (graphId: string, activationVersion: string) =>
  ({
    kind: 'select-activation',
    graphId,
    activationVersion,
  }) as const;

async function publishActivation(
  catalog: ActivationCatalog,
  graphId: string,
  suffix: string,
): Promise<string> {
  const fixture = activationManifest(graphId, suffix);
  await catalog.publish(fixture);
  return fixture.activationVersion;
}

/**
 * Propose, execute the authoritative validation run, attach its evidence,
 * and approve — governance runs execute against DRAFT ChangeSets, so the
 * run happens BEFORE the approval promotes the record to `approved`.
 */
async function proposeValidateApprove(
  service: ControlPlaneService,
  actor: AuthenticatedActorContext,
  input: {
    changesetId: string;
    base: { kind: 'activation' | 'release'; subjectId: string; expectedVersion: string };
    operations: readonly unknown[];
  },
): Promise<ControlRunRecord> {
  await service.propose(actor, {
    changesetId: input.changesetId,
    base: input.base,
    operations: input.operations,
    rationale: 'reliability correction',
    riskClass: 'low',
    requiredApproverCount: 1,
    expiresAt: 9_000_000,
  });
  const run = await service.executeChangeSetCheck(actor, {
    changesetId: input.changesetId,
    kind: 'validation',
  });
  await service.attachValidationEvidence(actor, {
    changesetId: input.changesetId,
    runId: run.runId,
  });
  await service.decide(actor, { changesetId: input.changesetId, decision: 'approved' });
  return run;
}

describe('R4: activation selection CAS, absence semantics, and operation identity', () => {
  it('an explicit absent-selection base produces exactly ONE winner under concurrency', async () => {
    const { catalog, service, actor } = makeService();
    // Publish two activations for one graph; NOTHING is selected yet.
    const versionA = await publishActivation(catalog, 'graph-race', 'a');
    const versionB = await publishActivation(catalog, 'graph-race', 'b');
    expect(await catalog.getSelection('graph-race')).toBeUndefined();

    // Two ChangeSets prepared with the SAME absent-selection base; both
    // attach authoritative validation evidence while the base still holds.
    for (const [id, version] of [
      ['cs-race-a', versionA],
      ['cs-race-b', versionB],
    ] as const) {
      const run = await proposeValidateApprove(service, actor, {
        changesetId: id,
        base: { kind: 'activation', subjectId: 'graph-race', expectedVersion: CHANGESET_BASE_NONE },
        operations: [ACTIVATION_SELECT_OP('graph-race', version)],
      });
      expect(run.outcome).toBe('passed');
    }

    // DETERMINISTIC RACE: the subject-level guard is captured BEFORE the
    // status CAS and evaluated inside the selection mutation; the second
    // commit cannot also fulfill an absent selection that the first commit
    // just replaced.
    const results = await Promise.allSettled([
      service.commit(actor, { changesetId: 'cs-race-a' }),
      service.commit(actor, { changesetId: 'cs-race-b' }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(1);
    const selection = await catalog.getSelection('graph-race');
    expect(selection).toBeDefined();
    expect(selection?.selectionRevision).toBe(1);
    expect([versionA, versionB]).toContain(selection?.activationVersion);
    // The loser reports the structured stale-base conflict with no effects
    // of its own.
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(VictControlError);
    expect((rejected.reason as VictControlError).code).toBe('VICT_CONTROL_BASE_STALE');
  });

  it('re-application under the SAME operation identity returns the original selection without a new revision', async () => {
    const { catalog, service, actor } = makeService();
    const versionA = await publishActivation(catalog, 'graph-ident', 'a');
    await proposeValidateApprove(service, actor, {
      changesetId: 'cs-ident-1',
      base: { kind: 'activation', subjectId: 'graph-ident', expectedVersion: CHANGESET_BASE_NONE },
      operations: [ACTIVATION_SELECT_OP('graph-ident', versionA)],
    });
    const commit = await service.commit(actor, { changesetId: 'cs-ident-1' });
    expect(commit.applied).toEqual(['select-activation']);
    const first = await catalog.getSelection('graph-ident');
    expect(first?.selectionRevision).toBe(1);
    // Recovery/resume is idempotent: committing again adds NO revision.
    await service.commit(actor, { changesetId: 'cs-ident-1' });
    const second = await catalog.getSelection('graph-ident');
    expect(second?.selectionRevision).toBe(1);
    expect(second?.operationId).toBe(first?.operationId);
    expect(second?.operationId).toBeTruthy();
  });

  it('a different operation identity using the stale base fails with no second effect', async () => {
    const { catalog, service, actor } = makeService();
    const versionA = await publishActivation(catalog, 'graph-stale', 'a');
    const versionB = await publishActivation(catalog, 'graph-stale', 'b');
    await proposeValidateApprove(service, actor, {
      changesetId: 'cs-stale-1',
      base: { kind: 'activation', subjectId: 'graph-stale', expectedVersion: CHANGESET_BASE_NONE },
      operations: [ACTIVATION_SELECT_OP('graph-stale', versionA)],
    });
    await service.commit(actor, { changesetId: 'cs-stale-1' });
    const afterFirst = await catalog.getSelection('graph-stale');
    expect(afterFirst?.selectionRevision).toBe(1);
    // A SECOND ChangeSet with the same (now stale) absent base must lose.
    await proposeValidateApprove(service, actor, {
      changesetId: 'cs-stale-2',
      base: { kind: 'activation', subjectId: 'graph-stale', expectedVersion: CHANGESET_BASE_NONE },
      operations: [ACTIVATION_SELECT_OP('graph-stale', versionB)],
    });
    await expect(service.commit(actor, { changesetId: 'cs-stale-2' })).rejects.toThrow(
      VictControlError,
    );
    const afterSecond = await catalog.getSelection('graph-stale');
    expect(afterSecond?.selectionRevision).toBe(1);
    expect(afterSecond?.activationVersion).toBe(versionA);
  });

  it('recovery of a prepared activation operation verifies the EXACT operation identity', async () => {
    const { catalog, service, actor, stores } = makeService();
    const versionA = await publishActivation(catalog, 'graph-recov', 'a');
    await proposeValidateApprove(service, actor, {
      changesetId: 'cs-recov-1',
      base: { kind: 'activation', subjectId: 'graph-recov', expectedVersion: CHANGESET_BASE_NONE },
      operations: [ACTIVATION_SELECT_OP('graph-recov', versionA)],
    });
    await service.commit(actor, { changesetId: 'cs-recov-1' });
    const receipts = await stores.control.listOperationReceipts('cs-recov-1');
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.state).toBe('applied');
    const selection = await catalog.getSelection('graph-recov');
    // The applied receipt binds the EXACT operation identity on the
    // selection — recovery verifies this identity, never merely that the
    // target activation happens to be currently selected.
    expect(selection?.operationId).toBe(receipts[0]?.operationDigest);
    // An operator-path selection of the SAME target (no operation id) is
    // NOT proof that the operation completed.
    await catalog.select({ graphId: 'graph-recov', activationVersion: versionA });
    const overwritten = await catalog.getSelection('graph-recov');
    expect(overwritten?.operationId).toBeUndefined();
  });
});

describe('Governance-run truthfulness: the declared base is verified against the observed selection', () => {
  it('validation is BLOCKED when the declared release base is stale (never passed)', async () => {
    const { service, actor, stores } = makeService();
    for (const version of ['release-1', 'release-2']) {
      await stores.control.publishRelease({
        releaseVersion: version,
        applicationId: 'app.rel',
        applicationVersion: 'appver-1',
        rendererIdentity: 'renderer@1',
        componentRegistryIdentity: 'registry@1',
        dataAdapterIdentity: 'adapter@1',
        activationBinding: 'activation-1',
        publishedByActorId: 'actor-rel',
        publishedAt: 1000,
        contentHash: `hash-${version}`,
      });
    }
    await stores.control.selectRelease({
      applicationId: 'app.rel',
      releaseVersion: 'release-2',
      actorId: 'actor-rel',
      at: 1001,
      reason: 'select',
    });
    await service.propose(actor, {
      changesetId: 'cs-truth-1',
      base: { kind: 'release', subjectId: 'app.rel', expectedVersion: 'release-1' },
      operations: [RELEASE_OP],
      rationale: 'reliability correction',
      riskClass: 'low',
      requiredApproverCount: 1,
      expiresAt: 9_000_000,
    });
    const run = await service.executeChangeSetCheck(actor, {
      changesetId: 'cs-truth-1',
      kind: 'validation',
    });
    // actual selected release: release-2; declared base: release-1 → BLOCKED.
    expect(run.outcome).toBe('blocked');
    expect(run.observedBase?.expectedVersion).toBe('release-2');
  });

  it('validation passes only when the declared base IS the current selection (including explicit absence)', async () => {
    const { service, actor, catalog } = makeService();
    const versionA = await publishActivation(catalog, 'graph-truth', 'a');
    await service.propose(actor, {
      changesetId: 'cs-truth-2',
      base: { kind: 'activation', subjectId: 'graph-truth', expectedVersion: CHANGESET_BASE_NONE },
      operations: [ACTIVATION_SELECT_OP('graph-truth', versionA)],
      rationale: 'reliability correction',
      riskClass: 'low',
      requiredApproverCount: 1,
      expiresAt: 9_000_000,
    });
    const run = await service.executeChangeSetCheck(actor, {
      changesetId: 'cs-truth-2',
      kind: 'validation',
    });
    expect(run.outcome).toBe('passed');
    expect(run.observedBase?.expectedVersion).toBe(CHANGESET_BASE_NONE);

    // After a selection exists, the same absent base is stale.
    await catalog.select({ graphId: 'graph-truth', activationVersion: versionA });
    const stale = await service.executeChangeSetCheck(actor, {
      changesetId: 'cs-truth-2',
      kind: 'validation',
    });
    expect(stale.outcome).toBe('blocked');
    expect(stale.observedBase?.expectedVersion).toBe(versionA);
  });

  it('simulation starts from and verifies the same exact base (stale base blocks the sandbox run)', async () => {
    const { service, actor, stores } = makeService();
    for (const version of ['release-1', 'release-2']) {
      await stores.control.publishRelease({
        releaseVersion: version,
        applicationId: 'app.rel',
        applicationVersion: 'appver-1',
        rendererIdentity: 'renderer@1',
        componentRegistryIdentity: 'registry@1',
        dataAdapterIdentity: 'adapter@1',
        activationBinding: 'activation-1',
        publishedByActorId: 'actor-rel',
        publishedAt: 1000,
        contentHash: `hash-${version}`,
      });
    }
    await stores.control.selectRelease({
      applicationId: 'app.rel',
      releaseVersion: 'release-2',
      actorId: 'actor-rel',
      at: 1001,
      reason: 'select',
    });
    await service.propose(actor, {
      changesetId: 'cs-truth-3',
      base: { kind: 'release', subjectId: 'app.rel', expectedVersion: 'release-1' },
      operations: [RELEASE_OP],
      rationale: 'reliability correction',
      riskClass: 'low',
      requiredApproverCount: 1,
      expiresAt: 9_000_000,
    });
    const run = await service.executeChangeSetCheck(actor, {
      changesetId: 'cs-truth-3',
      kind: 'simulation',
    });
    expect(run.outcome).toBe('blocked');
    expect(run.detail?.operations ?? []).toHaveLength(0);
    expect(run.observedBase?.expectedVersion).toBe('release-2');
  });

  it('commit-time CAS stays mandatory: a base that goes stale between evidence and commit is blocked', async () => {
    const { service, actor, catalog } = makeService();
    const versionA = await publishActivation(catalog, 'graph-cas', 'a');
    const versionB = await publishActivation(catalog, 'graph-cas', 'b');
    const run = await proposeValidateApprove(service, actor, {
      changesetId: 'cs-cas-1',
      base: { kind: 'activation', subjectId: 'graph-cas', expectedVersion: CHANGESET_BASE_NONE },
      operations: [ACTIVATION_SELECT_OP('graph-cas', versionA)],
    });
    expect(run.outcome).toBe('passed');
    // STATE CHANGE between evidence creation and commit: someone else
    // selects a DIFFERENT activation for the graph.
    await catalog.select({ graphId: 'graph-cas', activationVersion: versionB });
    await expect(service.commit(actor, { changesetId: 'cs-cas-1' })).rejects.toThrow(
      VictControlError,
    );
    const selection = await catalog.getSelection('graph-cas');
    expect(selection?.activationVersion).toBe(versionB);
  });
});
