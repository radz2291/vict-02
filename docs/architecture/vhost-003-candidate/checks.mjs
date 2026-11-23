import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

export const turn = (turnId = 'hot-turn') => ({
  turnId, streamId: 'hot-stream', threadId: 'hot-thread', actorId: 'synthetic-actor',
  agentProfileVersion: 'profile', activationVersion: 'activation', applicationReleaseVersion: undefined,
  inputSummary: 'fixture', status: 'intent', createdAt: 1000, updatedAt: 1000,
  terminalAt: undefined, errorCode: undefined, traceId: undefined, victRunId: undefined, mastraRunId: undefined
});
export const event = (streamId, turnId, at, kind = 'response.started') => ({
  streamId, kind, at,
  payload: JSON.stringify({
    actorId: 'synthetic-actor', agentProfileVersion: 'profile',
    ...(kind === 'text.delta' ? { delta: 'partial' } : {}),
    kind, threadId: 'fixture-thread', turnId
  })
});
const cancel = (turnId, cancelId, at) => ({ turnId, cancelId, actorId: 'synthetic-actor', reasonCode: 'owner-stop', at });
const request = (scopeId, ownerId = 'worker', leaseMs = 60_000, actorId = 'synthetic-actor') =>
  ({ scopeId, actorId, ownerId, leaseMs });
const deferred = () => {
  let resolve;
  const promise = new Promise((settled) => { resolve = settled; });
  return { promise, resolve };
};

export async function checkPorts({ oracle, observer, provision, legacy, candidate, evidence, save }) {
  const record = async (name, details = {}) => { evidence.checks.push({ name, ...details }); await save(); };
  const namespace = 'parity';
  await provision(namespace);
  const old = await legacy(namespace, { migrate: true });
  const indexed = await candidate(namespace);
  const scenarios = new Map();
  const diff = async (family, method, args = []) => {
    async function outcome(store) {
      try {
        return { result: await store[family][method](...args) };
      } catch (error) {
        return { error: { name: error.name, code: error.code, message: error.message } };
      }
    }
    const expected = await outcome(old);
    const observed = await outcome(indexed);
    assert.deepEqual(observed, expected, family + '.' + method);
    const key = family + '.' + method;
    scenarios.set(key, (scenarios.get(key) ?? 0) + 1);
    return observed;
  };
  const failure = async (family, method, args, code) => {
    const result = await diff(family, method, args);
    assert.equal(result.error?.code, code);
  };
  try {
    assert.deepEqual(Object.keys(indexed).sort(),
      ['actors','close','coordination','dispose','forLease','streamLedger','turns',
        'approvals','invocations','commandIdempotency','commandConfirmationReceipts',
        'control','catalog','governance','execution','orchestration'].sort());
    const actor = { actorId: 'actor-z', status: 'active', roles: ['viewer'], createdAt: 42, scopes: undefined };
    await diff('actors', 'get', ['missing']);
    await diff('actors', 'list');
    await diff('actors', 'upsert', [actor]);
    const before = await diff('actors', 'get', [actor.actorId]);
    assert.equal(JSON.stringify(before.result), JSON.stringify(await indexed.actors.get(actor.actorId)));
    await failure('actors', 'upsert', [{ ...actor, note: 'embedded\u0000' }], 'HOSTED_DATABASE_UNAVAILABLE');
    await diff('actors', 'upsert', [{ ...actor, actorId: 'actor-A' }]);
    await diff('actors', 'upsert', [{ ...actor, status: 'disabled' }]);
    await diff('actors', 'list');
    await failure('actors', 'upsert', [{ ...actor, roles: ['other'] }], 'VICT_CONTROL_FIELD_INVALID');
    const accessor = { get actorId() { throw new Error('getter must not execute'); } };
    await failure('actors', 'upsert', [accessor], 'VICT_STORE_INVALID_COMMAND');

    await diff('turns', 'getTurn', ['missing']);
    await failure('turns', 'startTurn', ['missing', 1010], 'VICT_CONTROL_TURN_MISSING');
    await failure('turns', 'createTurnIntent', [{ ...turn(), status: 'running' }], 'VICT_CONTROL_TURN_INVALID_STATE');
    await diff('turns', 'createTurnIntent', [turn()]);
    await diff('turns', 'createTurnIntent', [turn()]);
    await failure('turns', 'createTurnIntent', [{ ...turn(), inputSummary: 'changed' }], 'VICT_CONTROL_TURN_COLLISION');
    await diff('turns', 'startTurn', ['hot-turn', 1010]);
    await failure('turns', 'startTurn', ['hot-turn', 1011], 'VICT_CONTROL_TURN_INVALID_TRANSITION');
    await diff('turns', 'awaitApproval', ['hot-turn', 1020, 'approval']);
    await diff('turns', 'recordTurnCorrelation', ['hot-turn', { traceId: 'trace', mastraRunId: 'm' }]);
    await diff('turns', 'resumeTurn', ['hot-turn', 1030]);
    await diff('turns', 'recordTurnCorrelation', ['hot-turn', { victRunId: 'r' }]);
    await diff('turns', 'hasCancelIntent', ['hot-turn']);
    await diff('turns', 'recordCancelIntent', [cancel('hot-turn', 'z', 1031)]);
    await diff('turns', 'recordCancelIntent', [cancel('hot-turn', 'z', 1032)]);
    await diff('turns', 'recordCancelIntent', [cancel('hot-turn', 'a', 1030)]);
    await diff('turns', 'hasCancelIntent', ['hot-turn']);
    await diff('turns', 'listCancelIntents', ['hot-turn']);
    await diff('turns', 'recordCancelIntent', [cancel('not-yet', 'pre', 1020)]);
    await diff('turns', 'hasCancelIntent', ['not-yet']);
    await diff('turns', 'getTurn', ['not-yet']);
    await diff('turns', 'createTurnIntent', [turn('not-yet')]);
    await diff('turns', 'completeTurn', [{ turnId: 'hot-turn', at: 1040, status: 'cancelled', errorCode: 'stop' }]);
    await diff('turns', 'reconcileTurn', [{ turnId: 'hot-turn', at: 1050, status: 'blocked', reasonCode: 'later' }]);
    await diff('turns', 'reconcileTurn', [{ turnId: 'not-yet', at: 1050, status: 'blocked', reasonCode: 'blocked' }]);
    await diff('turns', 'reconcileTurn', [{ turnId: 'missing', at: 1050, status: 'blocked' }]);
    for (const id of ['z', 'A', 'z\u0000a', '\ud800', '\ufffd', '??', '\ue000', 'q'.repeat(3500) + 'z', 'q'.repeat(3500) + 'a']) {
      await diff('turns', 'createTurnIntent', [turn(id)]);
      await diff('turns', 'getTurn', [id]);
    }
    await diff('turns', 'listTurns');
    await diff('turns', 'listOpenTurns');
    await diff('turns', 'listCancelIntents', ['missing']);

    await diff('streamLedger', 'latestSeq', ['empty']);
    await diff('streamLedger', 'listEventsFrom', ['empty', 0]);
    await diff('streamLedger', 'appendEvent', [event('hot-stream', 'hot-turn', 1)]);
    await diff('streamLedger', 'appendEvent', [event('hot-stream', 'hot-turn', 2, 'text.delta')]);
    await failure('streamLedger', 'appendEvent', [{ ...event('hot-stream','hot-turn',3), payload: '{}' }], 'VICT_STREAM_EVENT_INVALID');
    await failure('streamLedger', 'appendEvent', [{ ...event('never','hot-turn',3), payload: '{}' }], 'VICT_STREAM_EVENT_INVALID');
    await diff('streamLedger', 'appendEvent', [event('hot-stream', 'hot-turn', 4)]);
    await diff('streamLedger', 'appendEvent', [event('transient-only', 'hot-turn', 5, 'text.delta')]);
    await diff('streamLedger', 'latestSeq', ['hot-stream']);
    await diff('streamLedger', 'latestSeq', ['transient-only']);
    await diff('streamLedger', 'listStreamIds');
    for (const [after, limit] of [[0,undefined],[0,0],[0,-1],[0,1.9],[1,undefined],[2.9,1],[3,undefined],
      [NaN,1], [Infinity, 9], [-Infinity, Infinity], [0, NaN]]) {
      await diff('streamLedger', 'listEventsFrom', ['hot-stream', after, limit]);
    }
    await record('Public actor, turn, Stop and stream differential checks', {
      oracle: 'installed PostgreSQL 0.4.0-rc.1', calls: Object.fromEntries(scenarios)
    });
    await coordinationChecks(old, indexed, record);
    await d5(oracle, old, indexed, record);
  } finally {
    await Promise.all([old.close(), indexed.close()]);
  }

  await indexedFaults({ observer, candidate, provision, record });
  await installedC12({ oracle, observer, candidate, provision, record });
}

async function coordinationChecks(legacy, candidate, record) {
  const actual = [];
  for (const store of [legacy, candidate]) {
    const coord = store.coordination;
    const owner = (await coord.acquire(request('thread'))).lease;
    assert(owner);
    const outcomes = [owner.fence];
    outcomes.push((await coord.acquire(request('thread','second'))).status);
    await assert.rejects(coord.acquire(request('thread','owner',1000,'another')), { code: 'HOSTED_ACTOR_MISMATCH' });
    const capture = { ...owner };
    await coord.runWithLease(capture, async () => {
      capture.fence++;
      assert.equal(coord.currentLease().fence, owner.fence);
      assert.equal(await store.turns.hasCancelIntent('hot-turn'), true);
    });
    assert.equal(coord.currentLease(), undefined);
    const renewed = await coord.renew(owner, 60_000);
    assert(renewed.expiresAt >= owner.expiresAt);
    const s1 = await coord.beginEffect(owner, 'e1', 'digest');
    outcomes.push(s1.status, s1.receipt.status);
    outcomes.push((await coord.beginEffect(owner, 'e1', 'digest')).status);
    await assert.rejects(coord.beginEffect(owner, 'e1', 'other'), { code: 'HOSTED_EFFECT_CONFLICT' });
    outcomes.push((await coord.settleEffect(owner, 'e1', 'digest', 'applied')).status);
    outcomes.push((await coord.settleEffect(owner, 'e1', 'digest', 'applied')).status);
    await assert.rejects(coord.settleEffect(owner, 'e1', 'digest', 'not-applied'), { code: 'HOSTED_EFFECT_CONFLICT' });
    outcomes.push((await coord.beginEffect(owner, 'e1', 'digest')).status);
    await assert.rejects(coord.getEffect('thread','another','e1'), { code: 'HOSTED_ACTOR_MISMATCH' });
    outcomes.push((await coord.getEffect('thread','synthetic-actor','e1')).status);
    assert.equal(await coord.getEffect('missing','synthetic-actor','e1'), undefined);
    await coord.release({ ...owner, fence: owner.fence + 1 });
    assert.equal(await store.forLease(owner).turns.hasCancelIntent('hot-turn'), true);
    const deletion = await coord.tombstone(request('thread','deleter'));
    assert.equal(deletion.purpose, 'deletion');
    assert.equal((await coord.acquire(request('thread','worker'))).status, 'deleted');
    await assert.rejects(store.forLease(owner).turns.hasCancelIntent('hot-turn'), { code: 'HOSTED_FENCED' });
    await coord.release(deletion);
    assert.equal((await coord.acquire(request('thread','worker'))).status, 'deleted');
    const reacquired = await coord.tombstone(request('thread','deleter'));
    outcomes.push(deletion.fence, reacquired.fence);
    actual.push(outcomes);
  }
  assert.deepEqual(actual[0], actual[1]);
  const legacyUnicode = (await legacy.coordination.acquire(request('scope-\ud800'))).lease;
  assert(legacyUnicode);
  assert.equal((await legacy.coordination.acquire(request('scope-\ufffd'))).status, 'busy');
  await assert.rejects(candidate.coordination.acquire(request('scope-\ud800')), { code: 'HOSTED_INVALID_INPUT' });
  const valid = (await candidate.coordination.acquire(request('scope-\ufffd'))).lease;
  assert(valid);
  await assert.rejects(candidate.coordination.beginEffect(valid, '\ud800', 'digest'), { code: 'HOSTED_INVALID_INPUT' });
  await record('Coordination rejects a proven legacy text-key alias', {
    legacyLoneSurrogateAndReplacementShareScope: true, candidateCode: 'HOSTED_INVALID_INPUT'
  });
  await record('Coordination differential and scope ownership', { outcomes: actual[0] });
}

async function d5(oracle, legacy, indexed, record) {
  const sqlite = oracle.createSqliteAgentControlStores({ path: ':memory:' });
  const receipt = {
    changesetId: 'd5-change', operationIndex: 0, operationKind: 'publish-release',
    operationDigest: 'prepared-digest', effectRef: 'd5-effect', actorId: 'actor-d5', appliedAt: 1, state: 'prepared'
  };
  const release = {
    releaseVersion: 'd5-release', applicationId: 'd5-app', applicationVersion: 'v1',
    rendererIdentity: 'renderer', componentRegistryIdentity: 'components', dataAdapterIdentity: 'data',
    activationBinding: 'activation', publishedByActorId: 'actor-d5', publishedAt: 2, contentHash: 'd5-content'
  };
  const input = { release, selection: {
    applicationId: release.applicationId, releaseVersion: release.releaseVersion, actorId: 'actor-d5',
    at: 2, reason: 'select', operationId: 'd5-operation'
  }, receipt: { ...receipt, operationDigest: 'different-digest', appliedAt: 2, state: 'applied' } };
  try {
    await legacy.control.recordOperationIntent(receipt);
    await sqlite.control.recordOperationIntent(receipt);
    const pg = await legacy.control.applyReleaseOperation(input);
    assert.equal(pg.selectionRevision, 1);
    const pgReceipts = await legacy.control.listOperationReceipts(receipt.changesetId);
    assert.equal(pgReceipts[0].operationDigest, receipt.operationDigest);
    assert.equal(pgReceipts[0].state, 'applied');
    assert.equal((await legacy.control.getSelectedRelease(release.applicationId)).releaseVersion, release.releaseVersion);
    const guard = async (control) => {
      const before = {
        release: await control.getRelease(release.releaseVersion),
        selected: await control.getSelectedRelease(release.applicationId),
        selections: await control.listReleaseSelections(release.applicationId),
        receipts: await control.listOperationReceipts(receipt.changesetId)
      };
      assert.equal(before.receipts[0].state, 'prepared');
      await assert.rejects(control.applyReleaseOperation(input), { code: 'VICT_CONTROL_OPERATION_IDENTITY_CONFLICT' });
      assert.deepEqual(await control.getRelease(release.releaseVersion), before.release);
      assert.deepEqual(await control.getSelectedRelease(release.applicationId), before.selected);
      assert.deepEqual(await control.listReleaseSelections(release.applicationId), before.selections);
      assert.deepEqual(await control.listOperationReceipts(receipt.changesetId), before.receipts);
      return before.receipts;
    };
    const sqliteReceipts = await guard(sqlite.control);
    if (indexed.control === undefined) {
      await record('D5 strict digest guard pending authorized control slice', { indexed: 'control port absent', oracleGuardPassed: true });
    } else {
      await indexed.control.recordOperationIntent(receipt);
      await guard(indexed.control);
      await record('D5 strict digest guard executed against indexed control');
    }
    await record('D5 actual port mismatch', { postgres: { revision: pg.selectionRevision, receipt: pgReceipts[0] },
      sqlite: { code: 'VICT_CONTROL_OPERATION_IDENTITY_CONFLICT', receipt: sqliteReceipts[0], releasePublished: false } });
  } finally {
    sqlite.close();
  }
}

async function indexedFaults({ observer, candidate, provision, record }) {
  const namespace = 'faults';
  await provision(namespace);
  await provision('isolated');
  const store = await candidate(namespace, { maxConnections: 4 });
  const other = await candidate('isolated');
  const short = await candidate(namespace, { maxConnections: 1, lockTimeoutMs: 120, connectionTimeoutMs: 120 });
  try {
    await assert.rejects(candidate('missing-namespace'), { code: 'HOSTED_SCHEMA_MISMATCH' });
    await assert.rejects(candidate(namespace, { writerEpoch: 2 }), { code: 'HOSTED_FENCED' });
    await store.turns.createTurnIntent(turn());
    await store.turns.recordCancelIntent(cancel('hot-turn', 'initial', 1));
    assert.equal(await other.turns.hasCancelIntent('hot-turn'), false);
    const attempts = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      store.turns.recordCancelIntent(cancel('hot-turn', 'same', index))));
    assert.equal(attempts.filter((item) => item.accepted).length, 1);
    assert.equal((await store.turns.listCancelIntents('hot-turn')).length, 2);
    const starts = await Promise.allSettled(Array.from({ length: 12 }, () => store.turns.startTurn('hot-turn', 42)));
    assert.equal(starts.filter((item) => item.status === 'fulfilled').length, 1);
    assert(starts.filter((item) => item.status === 'rejected')
      .every((item) => item.reason.code === 'VICT_CONTROL_TURN_INVALID_TRANSITION'));

    const appends = await Promise.all(Array.from({ length: 140 }, (_, index) =>
      store.streamLedger.appendEvent(event('bulk', 'hot-turn', index, index % 4 === 0 ? 'text.delta' : 'response.started'))));
    const ascending = appends.map(({ seq }) => seq).sort((a,b) => a-b);
    assert.deepEqual(ascending, Array.from({ length: 140 }, (_, index) => index + 1));
    await Promise.all(Array.from({ length: 40 }, (_, index) =>
      store.streamLedger.appendEvent(event('bulk','hot-turn', 200 + index))));
    const replay = await store.streamLedger.listEventsFrom('bulk', 0);
    assert.equal(replay.length, 145);
    assert(replay.every((entry, index) => index === 0 || entry.seq > replay[index-1].seq));
    assert.deepEqual(await store.streamLedger.listEventsFrom('bulk', 0, 130), replay.slice(0, 130));
    assert.equal(await other.streamLedger.latestSeq('bulk'), 0);
    await consistentPages(store, candidate, namespace, replay);

    // Synthetic trusted product SQL in a separate schema. C12's exact
    // thread -> resource -> scoped SQL -> resource -> thread sequence.
    await observer.query('CREATE SCHEMA vhost003_product');
    await observer.query('CREATE TABLE vhost003_product.callback_probe (id text PRIMARY KEY, backend integer NOT NULL)');
    const scope = store.coordination;
    const thread = (await scope.acquire(request('c12-thread'))).lease;
    const resource = (await scope.acquire(request('c12-resource'))).lease;
    const clientIds = [];
    const trusted = (id, workLease, resourceLease) => scope.withFence(workLease, async (client) => {
      await scope.assertInTransaction(client, resourceLease);
      const { rows: [inserted] } = await client.query(
        'INSERT INTO vhost003_product.callback_probe VALUES($1,pg_backend_pid()) RETURNING backend', [id]
      );
      await scope.assertInTransaction(client, resourceLease);
      clientIds.push(inserted.backend);
    });
    await trusted('committed', thread, resource);
    await assert.rejects(scope.withFence(thread, async (client) => {
      await scope.assertInTransaction(client, resource);
      await client.query("INSERT INTO vhost003_product.callback_probe VALUES('rollback', pg_backend_pid())");
      throw new Error('synthetic fault with private text');
    }), { code: 'HOSTED_DATABASE_UNAVAILABLE', message: 'HOSTED_DATABASE_UNAVAILABLE' });
    const forged = { ...resource, fence: resource.fence + 1 };
    await assert.rejects(trusted('forged', thread, forged), { code: 'HOSTED_FENCED' });
    await assert.rejects(scope.withFence(thread, (client) => other.coordination.assertInTransaction(client, resource)),
      { code: 'HOSTED_FENCED' });
    const poolClient = await scope.pool.connect();
    try {
      await assert.rejects(scope.assertInTransaction(poolClient, thread), { code: 'HOSTED_FENCED' });
    } finally {
      poolClient.release();
    }
    const expiring = (await scope.acquire(request('expires','worker',180))).lease;
    await assert.rejects(scope.withFence(thread, async (client) => {
      await scope.assertInTransaction(client, expiring);
      await client.query("INSERT INTO vhost003_product.callback_probe VALUES('expiry', pg_backend_pid())");
      await delay(210);
      await scope.assertInTransaction(client, expiring);
    }), { code: 'HOSTED_FENCED' });
    assert.deepEqual((await observer.query('SELECT id FROM vhost003_product.callback_probe ORDER BY id')).rows,
      [{ id: 'committed' }]);

    const held = deferred();
    const unlock = deferred();
    const hold = short.coordination.withFence(thread, async () => { held.resolve(); await unlock.promise; });
    await held.promise;
    const poolStart = performance.now();
    let poolTimeoutMs;
    try {
      await assert.rejects(short.turns.getTurn('hot-turn'), { code: 'HOSTED_DATABASE_UNAVAILABLE' });
      poolTimeoutMs = performance.now() - poolStart;
    } finally {
      unlock.resolve();
      await hold;
    }
    assert.equal((await short.turns.getTurn('hot-turn')).status, 'running');
    assert.equal((await scope.beginEffect(thread, 'across-epoch','digest')).status, 'started');

    await observer.query('BEGIN');
    let lockTimeoutMs;
    try {
      await observer.query("SELECT 1 FROM vhost003_indexed.coordination WHERE namespace='faults' AND scope_id='c12-thread' FOR UPDATE");
      const started = performance.now();
      await assert.rejects(short.forLease(thread).turns.hasCancelIntent('hot-turn'), { code: 'HOSTED_DATABASE_UNAVAILABLE' });
      lockTimeoutMs = performance.now() - started;
    } finally {
      await observer.query('ROLLBACK');
    }
    assert.equal(await store.forLease(thread).turns.hasCancelIntent('hot-turn'), true);

    const epochHeld = deferred();
    const epochUnlock = deferred();
    const inFlight = scope.withFence(thread, async () => { epochHeld.resolve(); await epochUnlock.promise; });
    await epochHeld.promise;
    const pendingEpoch = observer.query("UPDATE vhost003_indexed.namespaces SET writer_epoch=2 WHERE namespace='faults'");
    let epochChanged = false;
    pendingEpoch.then(() => { epochChanged = true; });
    await delay(30);
    try {
      assert.equal(epochChanged, false);
    } finally {
      epochUnlock.resolve();
      await inFlight;
      await pendingEpoch;
    }
    await assert.rejects(store.forLease(thread).turns.hasCancelIntent('hot-turn'), { code: 'HOSTED_FENCED' });
    const next = await candidate(namespace, { writerEpoch: 2 });
    try {
      assert.equal(await next.turns.hasCancelIntent('hot-turn'), true);
      await assert.rejects(next.forLease(thread).turns.hasCancelIntent('hot-turn'), { code: 'HOSTED_FENCED' });
      const active = (await next.coordination.acquire(request('c12-thread'))).lease;
      assert(active.fence > thread.fence);
      assert.equal((await next.coordination.getEffect('c12-thread','synthetic-actor','across-epoch')).status, 'uncertain');
      assert.equal(await next.forLease(active).turns.hasCancelIntent('hot-turn'), true);
      const ports = next.forLease(thread);
      await Promise.all([next.close(), next.dispose()]);
      await assert.rejects(ports.turns.getTurn('hot-turn'), { code: 'HOSTED_CLOSED' });
      await assert.rejects(next.coordination.acquire(request('closed')), { code: 'HOSTED_CLOSED' });
    } finally {
      await next.close();
    }
    await record('Concurrent cancel, CAS turn, stream sequence and durable pagination',
      { concurrentCancelAttempts: attempts.length, startAttempts: starts.length, streamEvents: replay.length, repeatableCursorUnderAppend: true });
    await record('Candidate same-client C12 sequence, rollback, bounded pool and lock acquisition, writer epoch and disposal', {
      committedBackendCount: clientIds.length, poolTimeoutMs, lockTimeoutMs, epochChangeWaited: true
    });
  } finally {
    await Promise.all([store.close(), other.close(), short.close()]);
  }
}

async function installedC12({ oracle, observer, candidate, provision, record }) {
  await provision('mastra-c12');
  await provision('mastra-other');
  const indexed = await candidate('mastra-c12');
  const wrong = await candidate('mastra-other');
  let memory;
  let reopened;
  try {
    const mastraOptions = {
      schemaName: 'vhost003_memory', memoryProfile: 'native-thread-recoverable', leaseMs: 4000
    };
    const assertions = [];
    const scope = indexed.coordination;
    const originalAssert = scope.assertInTransaction.bind(scope);
    scope.assertInTransaction = async (client, lease) => {
      await originalAssert(client, lease);
      assertions.push({ backend: client.processID, scope: lease.scopeId });
    };
    memory = await oracle.createPostgresMastraStore({
      ...mastraOptions, coordination: scope, migration: 'apply'
    });
    await memory.store.withNativeMemory('c12-test-thread', 'c12-synthetic-actor', async () => {
      const running = await memory.store.nativeMemoryJournal({
        operation: 'claim', operationId: 'c12-operation', requestDigest: 'request', sourceDigest: 'source'
      });
      assert.equal(running.status, 'running');
      const finished = await memory.store.nativeMemoryJournal({
        operation: 'complete', operationId: 'c12-operation', result: { synthetic: true }
      });
      assert.equal(finished.status, 'completed');
    });
    const paired = [];
    for (let i = 0; i + 3 < assertions.length; i++) {
      const [thread, resource, resourceAgain, threadAgain] = assertions.slice(i, i + 4);
      if (thread.scope.startsWith('mastra:') && resource.scope.startsWith('mastra-resource:') &&
          resourceAgain.scope === resource.scope && threadAgain.scope === thread.scope) {
        assert.equal(new Set([thread,resource,resourceAgain,threadAgain].map((item) => item.backend)).size, 1);
        paired.push(thread.backend);
      }
    }
    assert(paired.length >= 4);
    const { rows: [marker] } = await observer.query(
      'SELECT operational_schema,operational_namespace FROM vhost003_memory.vict_mastra_schema'
    );
    assert.deepEqual(marker, { operational_schema: 'vhost003_indexed', operational_namespace: 'mastra-c12' });
    await memory.close();
    memory = undefined;
    reopened = await oracle.createPostgresMastraStore({
      ...mastraOptions, coordination: scope, migration: 'verify'
    });
    await assert.rejects(oracle.createPostgresMastraStore({
      ...mastraOptions, coordination: wrong.coordination, migration: 'verify'
    }), { code: 'VICT_MASTRA_POSTGRES_SCHEMA_MISMATCH' });
    await record('Installed C12 native-thread-recoverable journal uses actual two-scope callbacks', {
      pairedTransactions: paired.length, marker, wrongNamespaceRefused: true
    });
  } finally {
    await reopened?.close();
    await memory?.close();
    await Promise.all([indexed.close(), wrong.close()]);
  }
}

async function consistentPages(store, candidate, namespace, before) {
  const writer = await candidate(namespace);
  const pool = store.coordination.pool;
  const originalConnect = pool.connect;
  const firstPage = deferred();
  const continueReading = deferred();
  let blocked = false;
  let restoreClient;
  pool.connect = async function () {
    const client = await originalConnect.call(this);
    const originalQuery = client.query;
    restoreClient = () => { client.query = originalQuery; };
    client.query = async function (sql, ...args) {
      const result = await originalQuery.call(this, sql, ...args);
      if (!blocked && sql.startsWith('FETCH FORWARD')) {
        blocked = true;
        firstPage.resolve();
        await continueReading.promise;
      }
      return result;
    };
    return client;
  };
  const reading = store.streamLedger.listEventsFrom('bulk', 0);
  try {
    await Promise.race([reading.then(() => {
      if (!blocked) throw new Error('Expected multiple cursor pages');
    }), firstPage.promise]);
    assert.equal((await writer.streamLedger.appendEvent(event('bulk','hot-turn',999))).seq, 181);
    continueReading.resolve();
    assert.deepEqual(await reading, before);
    assert.equal(await writer.streamLedger.latestSeq('bulk'), 181);
  } finally {
    continueReading.resolve();
    await reading.catch(() => undefined);
    restoreClient?.();
    pool.connect = originalConnect;
    await writer.close();
  }
}
