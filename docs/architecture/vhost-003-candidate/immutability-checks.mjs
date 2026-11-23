import assert from 'node:assert/strict';
import { manifest, traceCandidate } from './control-checks.mjs';

export const immutabilityBaselineCommit = 'e6714c20a8628b7dfe2f1b5a65b255da2187412d';

const hasMutableList = (list) => {
  const length = list.length;
  const mutable = Reflect.set(list, length, undefined);
  if (mutable) list.pop();
  return mutable;
};
const freezeTree = (value) => value !== null && typeof value === 'object' ?
  { frozen: Object.isFrozen(value), children: Object.fromEntries(Object.entries(value)
    .filter(([, nested]) => nested !== null && typeof nested === 'object')
    .map(([key, nested]) => [key, freezeTree(nested)])) } : undefined;
const comparable = (record) => JSON.parse(JSON.stringify(record), (key, value) =>
  ['createdAt', 'selectedAt'].includes(key) ? '<assigned timestamp>' : value);

async function observe(context, store) {
  const { oracle } = context;
  const { catalog, orchestration } = store;
  const later = manifest(oracle, 'immutability-z');
  const earlier = manifest(oracle, 'immutability-a');
  const version = later.manifest.activationVersion;
  const graph = later.manifest.graphId;
  const missing = {
    activation: (await catalog.get(version)) === undefined,
    selection: (await catalog.getSelection(graph)) === undefined,
    selected: (await catalog.getSelected(graph)) === undefined,
    catalogList: (await catalog.list()).length,
    recoveryList: (await orchestration.findRecoverableClaims({ now: 0 })).length
  };
  await catalog.publish(later);
  await catalog.publish(earlier);
  await catalog.select({ graphId: graph, activationVersion: version, expectedSelectionRevision: 'none', operationId: 'choose' });

  const readCatalog = async () => ({
    get: await catalog.get(version),
    list: await catalog.list(),
    getSelection: await catalog.getSelection(graph),
    getSelected: await catalog.getSelected(graph)
  });
  const before = await readCatalog();
  const observedValues = { missing, catalog: structuredClone(before) };
  const observations = {
    catalog: {
      get: freezeTree(before.get),
      getSelection: freezeTree(before.getSelection),
      getSelected: freezeTree(before.getSelected),
      listFrozen: Object.isFrozen(before.list),
      listEntries: before.list.map(freezeTree)
    }
  };
  for (const [key, field] of [['get', 'graphId'], ['getSelection', 'selectionRevision'], ['getSelected', 'graphId']]) {
    observations.catalog[key].allowsWrite = Reflect.set(before[key], field, 'fixture mutation');
  }
  observations.catalog.listEntryAllowsWrite = Reflect.set(before.list[0], 'graphId', 'fixture mutation');
  observations.catalog.listAllowsAppend = hasMutableList(before.list);
  assert.deepEqual(await readCatalog(), observedValues.catalog);

  const { graphId, graphVersion, capabilitySetVersion, activationVersion } = later.manifest;
  for (const [runId, leaseExpiresAt] of [['recover-first', 80], ['recover-second', 70]]) {
    await orchestration.createOrchestrationRun({ runId, graphId, graphVersion, capabilitySetVersion,
      activationVersion, mode: 'normal', retention: 'summary', rootTokenId: 'token-' + runId, entryNodeId: 'n1',
      checkpoint: { privateCanary: 'private-checkpoint-' + runId }, events: [], now: 20 });
    const result = await orchestration.claimReadyToken({
      runId, ownerId: 'owner', now: 30, leaseExpiresAt,
      planner: {
        invocationIdFor: (token) => 'inv-' + token.tokenId,
        attemptIdFor: (token, ordinal) => 'att-' + token.tokenId + '-' + ordinal,
        planFor: () => ({ capabilityId: 'cap.a', effectClass: 'pure', deadlineAt: null, idempotencyKey: null })
      }
    });
    assert.equal(result.claim.checkpoint.privateCanary, 'private-checkpoint-' + runId);
  }
  const readRecoverable = () => orchestration.findRecoverableClaims({ now: 100 });
  const claims = await readRecoverable();
  assert.deepEqual(claims.map(({ runId }) => runId), ['recover-second', 'recover-first']);
  assert(!JSON.stringify(claims).includes('private-checkpoint'));
  assert(claims.every((claim) => !('checkpoint' in claim) && !('checkpoint' in claim.token)));
  observedValues.recovery = structuredClone(claims);
  observations.recovery = {
    listFrozen: Object.isFrozen(claims),
    claims: claims.map((claim) => ({
      shape: freezeTree(claim),
      tokenAllowsWrite: Reflect.set(claim.token, 'nodeId', 'fixture mutation'),
      attemptAllowsWrite: Reflect.set(claim.attempt, 'ownerId', 'fixture mutation'),
      outerAllowsWrite: Reflect.set(claim, 'runId', 'fixture mutation'),
      checkpointExposed: 'checkpoint' in claim || 'checkpoint' in claim.token
    })),
    listAllowsAppend: hasMutableList(claims)
  };
  assert.deepEqual(await readRecoverable(), observedValues.recovery);
  return { values: observedValues, observations };
}

export async function checkReadImmutability(context, baseline) {
  const { legacy, candidate, provision, evidence, save } = context;
  const traces = {};
  const observations = {};
  evidence.readImmutability = { baselineCommit: immutabilityBaselineCommit, observations, traces };
  for (const [mode, open] of [['legacy', legacy], ['baseline', baseline], ['repaired', candidate]]) {
    const namespace = 'vhost010-' + mode;
    await provision(namespace);
    const store = await open(namespace, mode === 'legacy' ? { migrate: true } : {});
    if (mode !== 'legacy') traces[mode] = traceCandidate(store);
    try {
      observations[mode] = await observe(context, store);
      await save();
    } finally {
      await store.close();
    }
  }
  const before = observations.baseline.observations;
  const legacyObserved = observations.legacy.observations;
  const repaired = observations.repaired.observations;
  assert.deepEqual(observations.legacy.values.missing,
    { activation: true, selection: true, selected: true, catalogList: 0, recoveryList: 0 });
  for (const mode of ['baseline', 'repaired']) {
    assert.deepEqual(comparable(observations[mode].values), comparable(observations.legacy.values));
  }
  for (const port of ['get', 'getSelection', 'getSelected']) {
    assert.equal(legacyObserved.catalog[port].frozen, true, port);
    assert.equal(legacyObserved.catalog[port].allowsWrite, false, port);
    assert.equal(before.catalog[port].frozen, false, port);
    assert.equal(before.catalog[port].allowsWrite, true, port);
  }
  assert(legacyObserved.catalog.listEntries.every(({ frozen }) => frozen));
  assert(before.catalog.listEntries.every(({ frozen }) => !frozen));
  assert(legacyObserved.catalog.listAllowsAppend && before.catalog.listAllowsAppend);
  for (const claim of before.recovery.claims) {
    assert.equal(claim.shape.frozen, true);
    assert.equal(claim.outerAllowsWrite, false);
  }
  for (const claim of legacyObserved.recovery.claims) {
    assert.equal(claim.shape.frozen, false);
    assert.equal(claim.outerAllowsWrite, true);
    assert.equal(claim.shape.children.token.frozen, true);
    assert.equal(claim.shape.children.attempt.frozen, true);
    assert.equal(claim.checkpointExposed, false);
  }
  assert.deepEqual(repaired, legacyObserved, 'repaired read-result freeze and mutation behavior');
  for (const trace of Object.values(traces)) {
    assert(trace.statements > 0);
    assert.equal(trace.legacySnapshotReads, 0);
    assert.equal(trace.legacySnapshotWrites, 0);
  }
}
