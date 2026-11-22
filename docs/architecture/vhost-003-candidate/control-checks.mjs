import assert from 'node:assert/strict';
import { hash, keyBytes } from './values.mjs';

const release = (releaseVersion, applicationId = 'application') => ({
  releaseVersion, applicationId, applicationVersion: 'v1', rendererIdentity: 'renderer',
  componentRegistryIdentity: 'components', dataAdapterIdentity: 'data', activationBinding: 'activation',
  publishedByActorId: 'actor', publishedAt: 10, contentHash: 'release-content'
});
const receipt = (changesetId, operationIndex = 0, operationDigest = 'prepared-digest') => ({
  changesetId, operationIndex, operationKind: 'publish-release', operationDigest, effectRef: 'fixture-effect',
  actorId: 'actor', appliedAt: 1, state: 'prepared'
});
const selection = (record, operationId, expectedBaseVersion, reason = 'select') => ({
  applicationId: record.applicationId, releaseVersion: record.releaseVersion, actorId: 'actor',
  at: 20, reason, operationId, expectedBaseVersion
});
const apply = (record, intent, operationId, expectedBaseVersion) => ({
  release: record, selection: selection(record, operationId, expectedBaseVersion),
  receipt: { ...intent, appliedAt: 20, state: 'applied' }
});
const changeSet = (changesetId) => ({
  changesetId, schema: 'vict.changeset@1', authorActorId: 'actor', createdAt: 1,
  base: { kind: 'release', subjectId: 'application', expectedVersion: 'none' },
  operations: [], rationale: 'local fixture', riskClass: 'low', requiredApproverCount: 1,
  expiresAt: 50, validation: undefined, simulation: undefined, contentHash: 'hash-1', status: 'proposed'
});
const deletion = (intentId, conversationId = 'thread', actorId = 'actor') => ({
  intentId, conversationId, actorId, createdAt: 1, state: 'pending', receipts: []
});

function manifest({ kernel, runtime }, graphId, revision = '1') {
  const graph = { schema: 'vict.graph@1', id: graphId, entry: 'n1',
    nodes: [{ id: 'n1', capability: 'cap.a', input: null, output: null }], edges: [] };
  const bindings = [{ capability: 'cap.a', revision, effect: 'pure', input: null, output: null }];
  const graphVersion = kernel.computeGraphVersion(graph);
  const capabilitySetVersion = kernel.computeCapabilitySetVersion(bindings);
  const record = { manifestSchema: runtime.ACTIVATION_MANIFEST_SCHEMA, graphId,
    graph: kernel.canonicalSemanticForm(graph), graphVersion, capabilitySetVersion,
    activationVersion: kernel.computeActivationVersion(graphVersion, capabilitySetVersion), bindings, contracts: [] };
  return { manifest: record, canonicalManifest: runtime.toCanonicalJson(record) };
}

function agentActivation(runtime) {
  const registry = new runtime.AgentProfileRegistry();
  registry.registerArtifact({ kind: 'instructions', id: 'instructions.governance', revision: '1', text: 'Synthetic instructions.' });
  registry.registerArtifact({ kind: 'memory-policy', id: 'memory-policy.governance', revision: '1',
    config: { lastMessages: 5, workingMemory: { enabled: false }, semanticRecall: false } });
  registry.registerArtifact({ kind: 'guardrail', id: 'guardrail.governance', revision: '1', check: () => ({ ok: true }) });
  registry.registerProfile({ schema: 'vict.agent-profile@1', id: 'agent.governance', revision: '1',
    instructions: { id: 'instructions.governance', revision: '1' },
    modelProfile: { id: 'model.governance', revision: '1', routerModel: 'offline-fixture/deterministic-1', provider: 'offline-fixture' },
    generation: {}, turnPolicy: { maxSteps: 2, maxToolCalls: 0, onLimit: 'fail-closed' },
    memoryPolicy: { id: 'memory-policy.governance', revision: '1' },
    guardrails: [{ id: 'guardrail.governance', revision: '1' }], helperTools: [], capabilities: [],
    adapter: { id: '@victframework/mastra', revision: '1', runtimePackages: {
      '@mastra/core': '1.64.0', '@mastra/memory': '1.28.2', '@mastra/libsql': '1.22.3', '@mastra/observability': '1.17.5'
    } }
  });
  const activation = registry.activateAgentProfile({ id: 'agent.governance', revision: '1' });
  return { recordSchema: 'vict.agent-activation-record@1', activationVersion: activation.activationVersion,
    agentProfileVersion: activation.agentProfileVersion, agentId: 'agent.governance', agentRevision: '1',
    canonicalManifest: activation.canonicalManifestJson, createdAt: activation.createdAt,
    artifacts: activation.artifactList.map(({ kind, id, revision }) => ({ kind, id, revision })) };
}

async function outcome(work) {
  try {
    return { result: await work() };
  } catch (error) {
    return { error: { name: error.name, code: error.code, message: error.message, details: error.details } };
  }
}

// Runtime assigns wall-clock timestamps to catalog records. Preserve raw
// values in evidence and compare shape and all other fields independently.
function catalogComparable(state, start, end) {
  return JSON.parse(JSON.stringify(state), (key, value) => {
    if (key !== 'selectedAt' && key !== 'createdAt') return value;
    assert(Number.isSafeInteger(value) && value >= start && value <= end, key);
    return 'valid wall-clock timestamp';
  });
}

async function differential(context, old, indexed) {
  const { oracle, evidence, save } = context;
  const start = Date.now();
  const compare = async (family, method, args = [], failure) => {
    const expected = await outcome(() => old[family][method](...args));
    const observed = await outcome(() => indexed[family][method](...args));
    const port = family + '.' + method;
    evidence.controlDifferential.push({ port, expected, observed });
    await save();
    const comparable = (result) => family === 'catalog' ? catalogComparable(result, start, Date.now()) : result;
    assert.deepEqual(comparable(observed), comparable(expected), port);
    if (failure instanceof RegExp) assert.match(observed.error?.message ?? '', failure);
    else if (failure) assert.equal(observed.error?.code, failure, port);
    else assert(!observed.error, port);
    return observed.result;
  };
  const control = (...args) => compare('control', ...args);
  const catalog = (...args) => compare('catalog', ...args);
  const governance = (...args) => compare('governance', ...args);
  const c = changeSet('z\ud800');
  await control('getChangeSet', ['missing']);
  await control('saveChangeSet', [c]);
  await control('saveChangeSet', [c], 'VICT_CONTROL_CHANGESET_EXISTS');
  for (const id of ['z\ufffd', 'z\0', 'a'.repeat(2000) + 'z', 'a'.repeat(2000) + 'a']) {
    await control('saveChangeSet', [changeSet(id)]);
  }
  assert.deepEqual((await control('listChangeSets')).map(({ changesetId }) => changesetId),
    ['a'.repeat(2000) + 'a', 'a'.repeat(2000) + 'z', 'z\0', 'z\ud800', 'z\ufffd']);
  await control('getChangeSet', [c.changesetId]);
  await control('updateChangeSet', ['missing', (record) => record], 'VICT_CONTROL_CHANGESET_MISSING');
  await control('updateChangeSet', [c.changesetId, (record) => ({ ...record, changesetId: 'other' })],
    'VICT_CONTROL_CHANGESET_IMMUTABLE_ID');
  await control('updateChangeSet', [c.changesetId, (record) => ({ ...record, contentHash: 'other' })],
    'VICT_CONTROL_CONTENT_HASH_MISMATCH');
  const evidenceAttached = (record) => ({ ...record, validation: { runId: 'validation' }, simulation: { runId: 'simulation' } });
  await control('updateChangeSet', [c.changesetId, evidenceAttached]);
  const approval = { approvalId: 'approval-first', changesetId: c.changesetId, contentHash: c.contentHash,
    approverActorId: 'z', decision: 'approved', decidedAt: 3 };
  await control('recordChangeSetApproval', [approval]);
  await control('recordChangeSetApproval', [{ ...approval, approverActorId: 'a', approvalId: 'approval-second', decidedAt: 2 }]);
  await control('recordChangeSetApproval', [{ ...approval, approvalId: 'replay', decidedAt: 50 }]);
  await control('reviseChangeSetContent', [c.changesetId, (record) => record], 'VICT_CONTROL_REVISION_NOT_CHANGED');
  await control('reviseChangeSetContent', [c.changesetId, (record) => ({ ...record, contentHash: 'hash-2' })],
    'VICT_CONTROL_EVIDENCE_NOT_INVALIDATED');
  const revised = await control('reviseChangeSetContent', [c.changesetId, (record) =>
    ({ ...record, contentHash: 'hash-2', validation: undefined, simulation: undefined })]);
  assert.equal(revised.contentHash, 'hash-2');
  assert.equal(revised.validation, undefined);
  await control('recordChangeSetApproval', [{ ...approval, contentHash: 'hash-2' }], 'VICT_CONTROL_APPROVAL_CONFLICT');
  assert.deepEqual((await control('listChangeSetApprovals', [c.changesetId])).map(({ approvalId }) => approvalId),
    ['approval-first', 'approval-second']);
  await control('listChangeSetApprovals', ['unrelated']);

  const run = { runId: 'validation-run', kind: 'validation', changesetId: c.changesetId, contentHash: revised.contentHash,
    base: c.base, operations: [], runnerProfile: 'fixture', actorId: 'actor', outcome: 'passed', createdAt: 15 };
  await control('getControlRun', [run.runId]);
  await control('recordControlRun', [run]);
  await control('recordControlRun', [run]);
  await control('recordControlRun', [{ ...run, outcome: 'failed' }], 'VICT_CONTROL_RUN_COLLISION');
  await control('getControlRun', [run.runId]);

  const intent = receipt(c.changesetId, 10);
  await control('markOperationApplied', [{ ...intent, at: 20 }], 'VICT_CONTROL_OPERATION_RECEIPT_MISSING');
  assert.equal(await control('recordOperationIntent', [intent]), 'recorded');
  assert.equal(await control('recordOperationIntent', [{ ...intent, effectRef: 'ignored' }]), 'exists');
  await control('recordOperationIntent', [{ ...intent, operationDigest: 'other' }], 'VICT_CONTROL_OPERATION_IDENTITY_CONFLICT');
  const nextIntent = receipt(c.changesetId, 2);
  await control('recordOperationReceipt', [nextIntent]);
  await control('recordOperationReceipt', [nextIntent]);
  await control('recordOperationReceipt', [{ ...nextIntent, effectRef: 'other' }], 'VICT_CONTROL_OPERATION_RECEIPT_COLLISION');
  const marked = await control('markOperationApplied', [{ ...nextIntent, at: 20 }]);
  assert.deepEqual(await control('markOperationApplied', [{ ...nextIntent, at: 21 }]), marked);
  assert.deepEqual((await control('listOperationReceipts', [c.changesetId])).map((row) => row.operationIndex), [2, 10]);
  const cas = { changesetId: c.changesetId, expectedStatus: 'proposed', nextStatus: 'approved' };
  await control('compareAndSetChangeSetStatus', [cas]);
  await control('compareAndSetChangeSetStatus', [cas], 'VICT_CONTROL_CHANGESET_STATUS_CONFLICT');

  const first = release('z\ud800');
  const next = release('a\0');
  const third = release('a\ufffd');
  await control('getRelease', [first.releaseVersion]);
  await control('publishRelease', [first]);
  await control('publishRelease', [first]);
  await control('publishRelease', [{ ...first, contentHash: 'different' }], 'VICT_CONTROL_RELEASE_COLLISION');
  await control('getSelectedRelease', [first.applicationId]);
  await control('selectRelease', [{ ...selection(first, 'wrong-subject', 'none'), applicationId: 'other' }], 'VICT_CONTROL_RELEASE_MISSING');
  await control('selectRelease', [selection(first, 'initial', 'none')]);
  await control('publishRelease', [next]);
  await control('selectRelease', [selection(next, 'initial', 'none')], 'VICT_CONTROL_OPERATION_IDENTITY_CONFLICT');
  await control('selectRelease', [selection(next, 'stale', 'none')], 'VICT_CONTROL_BASE_STALE');
  await control('applyReleaseOperation', [apply(third, intent, 'exact', first.releaseVersion)]);
  assert.deepEqual(await control('applyReleaseOperation', [apply(third, intent, 'exact', first.releaseVersion)]),
    { selectionRevision: 2 });
  await control('getRelease', [third.releaseVersion]);
  await control('getSelectedRelease', [third.applicationId]);
  await control('selectRelease', [selection(first, 'exact', third.releaseVersion, 'rollback')]);
  await control('selectRelease', [selection(first)]);
  assert.deepEqual(await control('selectRelease', [selection(third, 'exact', 'stale')]), { selectionRevision: 2 });
  assert.deepEqual((await control('listReleases', [first.applicationId])).map((record) => record.releaseVersion),
    [next.releaseVersion, third.releaseVersion, first.releaseVersion]);
  assert.deepEqual((await control('listReleaseSelections', [first.applicationId])).map((record) => record.selectionRevision),
    [1, 2, 3, 4]);

  const audit = { auditId: 'z', at: 10, actorId: 'actor', action: 'changeset.approved',
    subjectType: 'changeset', subjectId: c.changesetId, summary: 'first observed' };
  await control('appendAuditEvent', [audit]);
  await control('appendAuditEvent', [{ ...audit, auditId: 'a', at: 9, summary: 'second observed' }]);
  await control('appendAuditEvent', [{ ...audit, auditId: 'other', subjectType: 'release' }]);
  await control('appendAuditEvent', [{ ...audit, auditId: 'elsewhere', subjectId: 'unrelated' }]);
  await control('appendAuditEvent', [{ ...audit, summary: 'discarded replay' }]);
  assert.deepEqual((await control('listAuditEvents', [{}])).map((row) => row.auditId), ['z', 'a', 'other', 'elsewhere']);
  for (const filter of [{ subjectType: 'changeset' }, { subjectId: c.changesetId },
    { subjectType: 'changeset', subjectId: c.changesetId }, { subjectId: 'missing' }]) await control('listAuditEvents', [filter]);

  const one = manifest(oracle, 'graph-a');
  const two = manifest(oracle, 'graph-a', '2');
  const three = manifest(oracle, 'graph-a', '3');
  const foreign = manifest(oracle, 'graph-b');
  const graphId = one.manifest.graphId;
  const version = one.manifest.activationVersion;
  const choose = { graphId, activationVersion: version, expectedSelectionRevision: 'none', operationId: 'first' };
  await catalog('get', [version]);
  await catalog('getSelection', [graphId]);
  await catalog('getSelected', [graphId]);
  await catalog('publish', [one]);
  await catalog('publish', [one]);
  await catalog('publish', [{ ...one, canonicalManifest: 'different' }], 'VICT_STORE_ACTIVATION_COLLISION');
  await catalog('publish', [{ ...two, canonicalManifest: 'not canonical' }], 'VICT_STORE_ACTIVATION_MISMATCH');
  await catalog('select', [{ ...choose, graphId: 'other' }], 'VICT_STORE_ACTIVATION_MISMATCH');
  const selected = await catalog('select', [choose]);
  assert.deepEqual(await catalog('select', [choose]), selected);
  await catalog('select', [{ ...choose, expectedSelectionRevision: 0, operationId: 'stale' }], 'VICT_STORE_SELECTION_CONFLICT');
  await catalog('publishAndSelect', [{ publish: two, select: choose }], 'VICT_STORE_SELECTION_CONFLICT');
  assert.equal(await catalog('get', [two.manifest.activationVersion]), undefined);
  await catalog('publishAndSelect', [{ publish: foreign, select: { graphId } }], 'VICT_STORE_ACTIVATION_MISMATCH');
  assert.equal(await catalog('get', [foreign.manifest.activationVersion]), undefined);
  const combined = { publish: two, select: { graphId, expectedSelectionRevision: 1, operationId: 'second' } };
  const published = await catalog('publishAndSelect', [combined]);
  assert.equal(published.selection.selectionRevision, 2);
  await catalog('publishAndSelect', [combined], 'VICT_STORE_SELECTION_CONFLICT');
  const replay = await catalog('publishAndSelect', [{ publish: two, select: { graphId, operationId: 'second' } }]);
  assert.equal(replay.created, false);
  assert.deepEqual(replay.selection, published.selection);
  await catalog('publish', [three]);
  assert.deepEqual(await catalog('select', [{ graphId, activationVersion: three.manifest.activationVersion,
    operationId: 'second', expectedSelectionRevision: 'none' }]), published.selection);
  await catalog('get', [version]);
  await catalog('getSelection', [graphId]);
  await catalog('getSelected', [graphId]);
  assert.deepEqual((await catalog('list')).map((row) => row.activationVersion),
    [one, two, three].map((entry) => entry.manifest.activationVersion));

  const agent = agentActivation(oracle.runtime);
  await governance('getAgentActivation', [agent.activationVersion]);
  await governance('saveAgentActivation', [{ ...agent, canonicalManifest: '{}' }], 'HOSTED_DATABASE_UNAVAILABLE');
  await governance('saveAgentActivation', [agent]);
  await governance('saveAgentActivation', [agent]);
  await governance('saveAgentActivation', [{ ...agent, createdAt: agent.createdAt + 1 }], /VICT_AGENT_ACTIVATION_COLLISION/);
  await governance('getAgentActivation', [agent.activationVersion]);
  const del = deletion('z-delete');
  await governance('getDeletionIntent', [del.intentId]);
  await governance('recordDeletionIntent', [{ ...del, state: 'completed' }], 'HOSTED_DATABASE_UNAVAILABLE');
  await governance('recordDeletionIntent', [del]);
  await governance('recordDeletionIntent', [del]);
  await governance('recordDeletionIntent', [{ ...del, actorId: 'other' }], /VICT_AGENT_DELETION_INTENT_COLLISION/);
  await governance('recordDeletionIntent', [deletion('a-delete', 'other-thread')]);
  await governance('recordDeletionReceipt', [del.intentId, 'memory-store', 5], /VICT_AGENT_DELETION_RECEIPT_ORDER/);
  await governance('recordDeletionReceipt', [del.intentId, 'unrecognized', 5], /VICT_AGENT_DELETION/);
  await governance('updateDeletionIntentState', [del.intentId, 'completed'], /VICT_AGENT_DELETION/);
  await governance('recordDeletionReceipt', [del.intentId, 'application-domain', 6]);
  await governance('recordDeletionReceipt', [del.intentId, 'application-domain', 30]);
  await governance('updateDeletionIntentState', [del.intentId, 'application-domain-deleted']);
  await governance('recordDeletionReceipt', [del.intentId, 'memory-store', 2]);
  await governance('updateDeletionIntentState', [del.intentId, 'completed']);
  await governance('updateDeletionIntentState', [del.intentId, 'completed']);
  await governance('updateDeletionIntentState', [del.intentId, 'pending'], /VICT_AGENT_DELETION/);
  assert.deepEqual((await governance('getDeletionIntent', [del.intentId])).receipts,
    [{ step: 'application-domain', at: 6 }, { step: 'memory-store', at: 2 }]);
  assert.deepEqual((await governance('listOpenDeletionIntents')).map((row) => row.intentId), ['a-delete']);
  assert.deepEqual((await governance('listDeletionIntents')).map((row) => row.intentId), ['a-delete', 'z-delete']);
  const exercised = [...new Set(evidence.controlDifferential.map(({ port }) => port))].sort();
  const qualified = ['control', 'catalog', 'governance'].flatMap((family) =>
    Object.keys(indexed[family]).map((method) => family + '.' + method)).sort();
  assert.equal(qualified.length, 38);
  assert.deepEqual(exercised, qualified);
  evidence.controlPorts = { added: 38, total: 103, deferred: 23, exercised };
}

const schema = 'vhost003_indexed';

function traceCandidate(store) {
  const pool = store.coordination.pool;
  const connect = pool.connect.bind(pool);
  const counts = { statements: 0, legacySnapshotReads: 0, legacySnapshotWrites: 0, operationTables: {} };
  const seen = new WeakSet();
  pool.connect = async (...args) => {
    const client = await connect(...args);
    if (seen.has(client)) return client;
    seen.add(client);
    const query = client.query.bind(client);
    client.query = (sql, ...params) => {
      counts.statements++;
      if (/\boperational\b/i.test(sql)) {
        if (/^\s*(SELECT|DECLARE)/i.test(sql)) counts.legacySnapshotReads++;
        else counts.legacySnapshotWrites++;
      }
      for (const name of new Set(sql.match(/\b(?:control|catalog|governance)_[a-z]+\b/g))) {
        counts.operationTables[name] = (counts.operationTables[name] ?? 0) + 1;
      }
      return query(sql, ...params);
    };
    return client;
  };
  return counts;
}

async function durableReleaseState(observer, namespace) {
  const result = {};
  for (const table of ['control_release', 'control_selection', 'control_operation']) {
    const { rows } = await observer.query(
      'SELECT id,encode(key_bytes,\'hex\') AS key,encode(payload,\'hex\') AS payload FROM ' +
        schema + '.' + table + ' WHERE namespace=$1 ORDER BY id', [namespace]
    );
    result[table] = rows;
  }
  return result;
}

async function exerciseRaces(context, namespace, left, right) {
  const { observer, candidate, evidence, save } = context;
  const peers = await Promise.all([left, right].map(async (store) => {
    const client = await store.coordination.pool.connect();
    try {
      return (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    } finally {
      client.release();
    }
  }));
  assert.notEqual(peers[0], peers[1]);
  const results = { peers, d5: {} };
  evidence.controlRace = results;

  const prepared = receipt('race-d5');
  const first = release('race-release', 'race-app');
  const exact = apply(first, prepared, 'race-apply', 'none');
  const conflicting = apply(release('digest-conflict-release', first.applicationId),
    { ...prepared, operationDigest: 'conflict-digest' }, 'race-apply', 'none');
  await left.control.recordOperationIntent(prepared);
  results.d5.before = await durableReleaseState(observer, namespace);
  results.d5.refused = await outcome(() => right.control.applyReleaseOperation(conflicting));
  assert.equal(results.d5.refused.error?.code, 'VICT_CONTROL_OPERATION_IDENTITY_CONFLICT');
  results.d5.afterRefusal = await durableReleaseState(observer, namespace);
  assert.deepEqual(results.d5.afterRefusal, results.d5.before);
  await save();

  results.d5.competition = await Promise.all([left, right, right, left].map((store, i) =>
    outcome(() => store.control.applyReleaseOperation(i % 2 ? exact : conflicting))));
  assert.deepEqual(results.d5.competition.map((entry) => entry.error?.code ?? entry.result.selectionRevision),
    ['VICT_CONTROL_OPERATION_IDENTITY_CONFLICT', 1, 'VICT_CONTROL_OPERATION_IDENTITY_CONFLICT', 1]);
  assert.equal(await right.control.getRelease(conflicting.release.releaseVersion), undefined);
  assert.equal((await right.control.getSelectedRelease(first.applicationId)).releaseVersion, first.releaseVersion);
  assert.deepEqual(await right.control.listOperationReceipts(prepared.changesetId), [exact.receipt]);
  assert.equal((await right.control.listReleaseSelections(first.applicationId)).length, 1);
  results.d5.afterRace = await durableReleaseState(observer, namespace);
  assert.deepEqual(await left.control.applyReleaseOperation({ ...exact, receipt: { ...exact.receipt, appliedAt: 30 } }),
    { selectionRevision: 1 });
  await assert.rejects(right.control.applyReleaseOperation(conflicting), { code: 'VICT_CONTROL_OPERATION_IDENTITY_CONFLICT' });
  results.d5.afterReplayAndConflict = await durableReleaseState(observer, namespace);
  assert.deepEqual(results.d5.afterReplayAndConflict, results.d5.afterRace);
  await save();

  const change = changeSet('race-changeset');
  await left.control.saveChangeSet(change);
  const revise = (digest) => (current) => {
    if (current.contentHash !== change.contentHash) {
      throw new context.oracle.runtime.VictControlError('VICT_CONTROL_CONTENT_HASH_MISMATCH', 'The revision base changed.');
    }
    return { ...current, contentHash: digest };
  };
  results.changeSetRevision = await Promise.all([left, right].map((store, i) =>
    outcome(() => store.control.reviseChangeSetContent(change.changesetId, revise('revision-' + i)))));
  assert.equal(results.changeSetRevision.filter((row) => row.result).length, 1);
  assert.equal(results.changeSetRevision.find((row) => row.error).error.code, 'VICT_CONTROL_CONTENT_HASH_MISMATCH');
  assert.deepEqual(await right.control.getChangeSet(change.changesetId), results.changeSetRevision.find((row) => row.result).result);
  const status = { changesetId: change.changesetId, expectedStatus: 'proposed' };
  results.changeSetStatus = await Promise.all([left, right].map((store, i) =>
    outcome(() => store.control.compareAndSetChangeSetStatus({ ...status, nextStatus: i ? 'declined' : 'approved' }))));
  assert.equal(results.changeSetStatus.filter((row) => row.result).length, 1);
  assert.equal(results.changeSetStatus.find((row) => row.error).error.code, 'VICT_CONTROL_CHANGESET_STATUS_CONFLICT');

  const applyCommands = [0, 1].map((i) => apply(release('base-race-' + i, first.applicationId),
    receipt('base-race-intent-' + i), 'base-race-' + i, first.releaseVersion));
  for (const command of applyCommands) await left.control.recordOperationIntent({ ...command.receipt, state: 'prepared', appliedAt: 1 });
  results.subjectBase = await Promise.all([left, right].map((store, i) =>
    outcome(() => store.control.applyReleaseOperation(applyCommands[i]))));
  const lostBase = results.subjectBase.findIndex((value) => value.error);
  assert.notEqual(lostBase, -1);
  assert.equal(results.subjectBase[lostBase].error.code, 'VICT_CONTROL_BASE_STALE');
  assert.equal(results.subjectBase[1 - lostBase].result.selectionRevision, 2);
  assert.equal(await right.control.getRelease(applyCommands[lostBase].release.releaseVersion), undefined);
  assert.equal((await right.control.listOperationReceipts(applyCommands[lostBase].receipt.changesetId))[0].state, 'prepared');

  const graphId = 'race-graph';
  const versions = [manifest(context.oracle, graphId), manifest(context.oracle, graphId, '2')];
  results.catalog = await Promise.all([left, right].map((store, i) =>
    outcome(() => store.catalog.publishAndSelect({ publish: versions[i],
      select: { graphId, expectedSelectionRevision: 'none', operationId: 'catalog-race-' + i } }))));
  const lostCatalog = results.catalog.findIndex((value) => value.error);
  assert.notEqual(lostCatalog, -1);
  assert.equal(results.catalog[lostCatalog].error.code, 'VICT_STORE_SELECTION_CONFLICT');
  assert.equal(await right.catalog.get(versions[lostCatalog].manifest.activationVersion), undefined);
  assert.equal((await right.catalog.getSelected(graphId)).activationVersion, versions[1 - lostCatalog].manifest.activationVersion);

  const intent = deletion('race-deletion', 'race-thread');
  const request = { scopeId: intent.conversationId, actorId: intent.actorId, ownerId: 'worker', leaseMs: 60_000 };
  const lease = (await left.coordination.acquire(request)).lease;
  assert(lease);
  const tombstone = await right.coordination.tombstone({ ...request, ownerId: 'deleter' });
  const port = right.forLease(tombstone).governance;
  await port.recordDeletionIntent(intent);
  await assert.rejects(left.forLease(lease).governance.recordDeletionReceipt(intent.intentId, 'application-domain', 1),
    { code: 'HOSTED_FENCED' });
  assert.deepEqual(await right.governance.getDeletionIntent(intent.intentId), intent);
  results.deletionReceiptRace = await Promise.all([port, left.governance].map((store, i) =>
    outcome(() => store.recordDeletionReceipt(intent.intentId, 'application-domain', 10 + i))));
  assert(results.deletionReceiptRace.every((value) => !value.error));
  const firstReceipt = (await port.getDeletionIntent(intent.intentId)).receipts;
  assert.equal(firstReceipt.length, 1);
  assert([10, 11].includes(firstReceipt[0].at));
  await port.updateDeletionIntentState(intent.intentId, 'application-domain-deleted');
  results.deletionCompletionRace = await Promise.all([
    outcome(() => left.governance.updateDeletionIntentState(intent.intentId, 'completed')),
    outcome(() => port.recordDeletionReceipt(intent.intentId, 'memory-store', 20))
  ]);
  assert(!results.deletionCompletionRace[1].error);
  if (results.deletionCompletionRace[0].error) {
    assert.match(results.deletionCompletionRace[0].error.message, /VICT_AGENT_DELETION/);
  }
  await port.updateDeletionIntentState(intent.intentId, 'completed');
  await right.coordination.release(tombstone);
  assert.equal((await left.coordination.acquire(request)).status, 'deleted');

  const reopened = await candidate(namespace);
  try {
    results.completedDeletion = await reopened.governance.getDeletionIntent(intent.intentId);
    assert.equal(results.completedDeletion.state, 'completed');
    assert.deepEqual(results.completedDeletion.receipts, [...firstReceipt, { step: 'memory-store', at: 20 }]);
    assert.deepEqual(await reopened.governance.listOpenDeletionIntents(), []);
    results.tombstoneAfterReopen = await reopened.coordination.acquire(request);
    assert.equal(results.tombstoneAfterReopen.status, 'deleted');
  } finally {
    await reopened.close();
  }
  await save();

  const rollback = apply(release('rollback-unpublished', 'rollback-app'), receipt('rollback-intent'), 'rollback', 'none');
  await left.control.recordOperationIntent({ ...rollback.receipt, state: 'prepared', appliedAt: 1 });
  const rollbackCatalog = manifest(context.oracle, 'rollback-graph');
  const rollbackSelection = { publish: rollbackCatalog, select: {
    graphId: rollbackCatalog.manifest.graphId, expectedSelectionRevision: 'none'
  } };
  results.rollback = { before: await durableReleaseState(observer, namespace) };
  await observer.query("CREATE FUNCTION " + schema +
    ".refuse_final_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic final write refusal'; END $$");
  await observer.query('CREATE TRIGGER refuse_completion BEFORE UPDATE ON ' + schema +
    '.control_operation FOR EACH ROW EXECUTE FUNCTION ' + schema + '.refuse_final_write()');
  await observer.query('CREATE TRIGGER refuse_selection BEFORE INSERT ON ' + schema +
    '.catalog_selection FOR EACH ROW EXECUTE FUNCTION ' + schema + '.refuse_final_write()');
  try {
    results.rollback.release = await outcome(() => left.control.applyReleaseOperation(rollback));
    results.rollback.catalog = await outcome(() => right.catalog.publishAndSelect(rollbackSelection));
    assert(results.rollback.release.error);
    assert(results.rollback.catalog.error);
    results.rollback.after = await durableReleaseState(observer, namespace);
    assert.deepEqual(results.rollback.after, results.rollback.before);
    assert.equal(await left.catalog.get(rollbackCatalog.manifest.activationVersion), undefined);
    assert.equal(await left.catalog.getSelection(rollbackCatalog.manifest.graphId), undefined);
  } finally {
    await observer.query('DROP TRIGGER refuse_completion ON ' + schema + '.control_operation');
    await observer.query('DROP TRIGGER refuse_selection ON ' + schema + '.catalog_selection');
    await observer.query('DROP FUNCTION ' + schema + '.refuse_final_write()');
  }
  results.rollback.releaseRetry = await right.control.applyReleaseOperation(rollback);
  results.rollback.catalogRetry = await left.catalog.publishAndSelect(rollbackSelection);
  assert.equal(results.rollback.releaseRetry.selectionRevision, 1);
  assert.equal(results.rollback.catalogRetry.selection.selectionRevision, 1);
  await save();
}

async function indexedPlans(context, namespace, store) {
  const { observer, evidence, save } = context;
  const audit = { at: 10, actorId: 'actor', action: 'changeset.approved',
    subjectType: 'changeset', summary: 'synthetic indexed plan' };
  // Unrelated namespace-history rows make the selectivity visible to the
  // planner. The exact digest predicates also verify full key bytes.
  for (let i = 0; i < 160; i++) {
    const id = 'plan-' + i;
    await store.control.saveChangeSet(changeSet(id));
    await store.control.recordOperationIntent(receipt(id, 2));
    await store.control.appendAuditEvent({ ...audit, auditId: id, subjectId: id });
    await store.governance.recordDeletionIntent(deletion(id, id));
  }
  const page = await store.governance.listDeletionIntents();
  assert.equal(page.filter((value) => value.intentId.startsWith('plan-')).length, 160);
  assert.deepEqual(page.map((value) => value.intentId), page.map((value) => value.intentId).sort());
  const entries = [
    ['changeset', 'control_changeset', 'key_digest', 'key_bytes', 'plan-131', ''],
    ['receipt-range', 'control_operation', 'subject_digest', 'subject_key', 'plan-131', 'ORDER BY operation_index,id'],
    ['selection-replay', 'control_selection', 'key_digest', 'key_bytes', JSON.stringify(['race-app', 'race-apply', 'select']), ''],
    ['selection-head', 'control_selection', 'subject_digest', 'subject_key', 'race-app', 'ORDER BY revision DESC LIMIT 1'],
    ['audit-subject', 'control_audit', 'subject_digest', 'subject_key', 'plan-131', 'ORDER BY id'],
    ['activation', 'catalog_activation', 'key_digest', 'key_bytes', manifest(context.oracle, 'rollback-graph').manifest.activationVersion, ''],
    ['deletion-intent', 'governance_intent', 'key_digest', 'key_bytes', 'plan-131', '']
  ];
  const plans = {};
  for (const [label, table, digestColumn, keyColumn, key, order] of entries) {
    await observer.query('ANALYZE ' + schema + '.' + table);
    const bytes = keyBytes(key);
    const sql = 'EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) SELECT payload FROM ' + schema + '.' + table +
      ' WHERE namespace=$1 AND ' + digestColumn + '=$2 AND ' + keyColumn + '=$3 ' + order;
    const { rows: [row] } = await observer.query(sql, [namespace, hash(bytes), bytes]);
    plans[label] = { plannerDefault: row['QUERY PLAN'][0] };
    // Check eligibility as well as the default plan for tiny relations.
    await observer.query('BEGIN');
    try {
      await observer.query('SET LOCAL enable_seqscan=off');
      const { rows: [indexed] } = await observer.query(sql, [namespace, hash(bytes), bytes]);
      plans[label].withSeqscanDisabled = indexed['QUERY PLAN'][0];
      assert(JSON.stringify(indexed).includes(table + '_'));
      assert.equal(indexed['QUERY PLAN'][0].Plan['Actual Rows'], 1);
    } finally {
      await observer.query('ROLLBACK');
    }
  }
  evidence.controlPlans = { multiFetchDeletionRows: page.length, plans };
  await save();
}

export async function checkControlPorts(context) {
  const { observer, provision, legacy, candidate, evidence, save } = context;
  const namespace = 'vhost007-differential';
  await provision(namespace);
  const [old, indexed] = await Promise.all([legacy(namespace, { migrate: true }), candidate(namespace)]);
  evidence.controlDifferential = [];
  const traces = { differential: traceCandidate(indexed) };
  evidence.controlSQL = traces;
  try {
    await differential(context, old, indexed);
  } finally {
    await Promise.all([old.close(), indexed.close()]);
  }

  const race = 'vhost007-race';
  await provision(race);
  const [left, right] = await Promise.all([
    candidate(race, { maxConnections: 1 }), candidate(race, { maxConnections: 1 })
  ]);
  traces.left = traceCandidate(left);
  traces.right = traceCandidate(right);
  try {
    await exerciseRaces(context, race, left, right);
    await indexedPlans(context, race, right);
    const { rows: [relation] } = await observer.query("SELECT to_regclass('vhost003_indexed.operational') AS name");
    assert.equal(relation.name, null);
    for (const trace of Object.values(traces)) {
      assert(trace.statements > 0);
      assert.equal(trace.legacySnapshotReads, 0);
      assert.equal(trace.legacySnapshotWrites, 0);
    }
    await save();
  } finally {
    await Promise.all([left.close(), right.close()]);
  }
}
