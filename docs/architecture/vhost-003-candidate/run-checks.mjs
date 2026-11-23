import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { manifest } from './control-checks.mjs';
import { hash, keyBytes } from './values.mjs';

const shape = (error) => ({ name: error.name, code: error.code, message: error.message, details: error.details });
async function outcome(work) {
  try {
    return { value: await work() };
  } catch (error) {
    return { error: shape(error) };
  }
}

function trace(store, counts) {
  const pool = store.coordination.pool;
  const acquire = pool.connect.bind(pool);
  const seen = new WeakSet();
  pool.connect = async () => {
    const client = await acquire();
    if (!seen.has(client)) {
      seen.add(client);
      const query = client.query.bind(client);
      client.query = (sql, ...args) => {
        counts.statements++;
        if (/\boperational\b/i.test(sql)) counts.legacySnapshotStatements++;
        return query(sql, ...args);
      };
    }
    return client;
  };
  return store;
}

const ids = ({ graphId, graphVersion, capabilitySetVersion, activationVersion }) =>
  ({ graphId, graphVersion, capabilitySetVersion, activationVersion });
const sequentialEvent = (run, seq, type = 'run.started') =>
  ({ ...ids(run), runId: run.runId, seq, timestamp: 100 + seq, type });
const runStart = (manifest, runId, timestamp = 100) => {
  const command = { ...ids(manifest), runId, mode: 'normal', retention: 'summary', timestamp, currentNodeId: 'n1' };
  return { ...command, events: [sequentialEvent(command, 0)] };
};
const orchStart = (manifest, runId, now = 100) => {
  const command = { ...ids(manifest), runId, mode: 'normal', retention: 'summary', now, entryNodeId: 'n1',
    rootTokenId: 'token-' + runId, checkpoint: { prepared: 'private-checkpoint-' + runId } };
  return { ...command, events: [{ ...ids(command), runId, timestamp: now, type: 'run.started' }] };
};
const transition = (run, expectedRecordRevision = 1, expectedNextEventSeq = 1) => ({
  runId: run.runId, expectedRecordRevision, expectedNextEventSeq,
  next: { steps: 1, currentNodeId: 'n1' }, events: [sequentialEvent(run, expectedNextEventSeq, 'node.started')].map(
    (event) => ({ ...event, nodeId: 'n1', capabilityId: 'cap.a' })), timestamp: 101
});
const planner = {
  invocationIdFor: (token) => 'inv-' + token.tokenId,
  attemptIdFor: (token, count) => 'attempt-' + token.tokenId + '-' + count,
  planFor: () => ({ capabilityId: 'cap.a', effectClass: 'pure', deadlineAt: null, idempotencyKey: null })
};
const claim = (runId, ownerId = 'worker', now = 110, leaseExpiresAt = 150) =>
  ({ runId, ownerId, now, leaseExpiresAt, planner });
const completed = (runId, attempt, continuation, status = 'running') => ({
  runId, attemptId: attempt.attemptId, ownerId: attempt.ownerId, expectedAttemptFence: attempt.fence, now: 120,
  continuation, outcome: { kind: 'completed', outputSummary: { kind: 'null' } }, run: { status }, events: []
});
const wait = (waitId, options = {}) => ({
  kind: 'wait', wait: { waitId, nodeId: 'n1', kind: 'timer', signalName: null, contractId: null,
    contractRevision: null, dueAt: 200, timeoutAt: null, ...options }
});
const recovery = { timestamp: 200, code: 'INTERRUPTED', reason: 'synthetic interruption', remediation: 'retry' };

async function differential(context, old, indexed) {
  const { oracle, evidence, save } = context;
  const coverage = new Set();
  const compare = async (family, method, args = [], expectedCode) => {
    const port = family + '.' + method;
    const expected = await outcome(() => old[family][method](...args));
    const observed = await outcome(() => indexed[family][method](...args));
    evidence.runDifferential.push({ port, expected, observed });
    coverage.add(port);
    await save();
    assert.deepEqual(observed, expected, port);
    if (expectedCode) assert.equal(observed.error?.code, expectedCode, port);
    else assert(!observed.error, JSON.stringify({ port, ...observed }));
    return observed.value;
  };
  const seq = (...args) => compare('execution', ...args);
  const orch = (...args) => compare('orchestration', ...args);
  const { manifest: activation, canonicalManifest } = manifest(oracle, 'execution-graph');
  const publish = { manifest: activation, canonicalManifest };
  await old.catalog.publish(publish);
  await indexed.catalog.publish(publish);
  evidence.catalogReadFreeze = {
    legacy: Object.isFrozen(await old.catalog.get(activation.activationVersion)),
    candidate: Object.isFrozen(await indexed.catalog.get(activation.activationVersion))
  };
  const first = runStart(activation, 'same-run-id');
  const second = runStart(activation, 'a-tie');
  const older = runStart(activation, 'older', 99);
  await seq('getRun', ['missing']);
  await seq('listEvents', ['missing'], 'VICT_STORE_RUN_NOT_FOUND');
  await seq('createRun', [first]);
  await seq('createRun', [first], 'VICT_STORE_RUN_CONFLICT');
  await seq('createRun', [second]);
  await seq('createRun', [older]);
  await seq('createRun', [{ ...runStart(activation, 'bad-identity'), graphId: 'wrong-graph' }],
    'VICT_STORE_ACTIVATION_MISMATCH');
  assert.deepEqual((await seq('listRuns', [{ graphId: activation.graphId, limit: 3 }])).map((row) => row.runId),
    ['older', 'same-run-id', 'a-tie']);
  await seq('listRuns', [{ activationVersion: activation.activationVersion, status: 'running', limit: 1.9 }]);
  await seq('listRuns', [{ limit: Infinity }], 'HOSTED_INVALID_INPUT');
  await seq('commitTransition', [transition(first, 1, 0)], 'VICT_STORE_EVENT_SEQUENCE_CONFLICT');
  await seq('commitTransition', [transition(first)]);
  await seq('commitTransition', [transition(first)], 'VICT_STORE_RUN_CONFLICT');
  await seq('commitTransition', [{ ...transition(first, 2, 2), next: { status: 'completed' },
    events: [sequentialEvent(first, 2, 'run.completed')] }]);
  await seq('getRun', [first.runId]);
  assert.deepEqual((await seq('listEvents', [first.runId, 0.1])).map((row) => row.seq), [1, 2]);
  const recovered = await seq('recoverInterruptedRuns', [recovery]);
  assert.deepEqual(recovered.blocked.map((row) => row.runId), [second.runId, older.runId]);
  await seq('recoverInterruptedRuns', [recovery]);
  await seq('listEvents', [second.runId]);

  const shared = orchStart(activation, first.runId);
  await orch('getOrchestrationRun', ['unknown']);
  await orch('getOrchestrationSnapshot', ['unknown']);
  await orch('listWaits', ['unknown'], 'VICT_STORE_RUN_NOT_FOUND');
  await orch('createOrchestrationRun', [shared]);
  await orch('createOrchestrationRun', [shared], 'VICT_STORE_RUN_CONFLICT');
  await orch('createOrchestrationRun', [orchStart(activation, 'a-orch-tie')]);
  await orch('createOrchestrationRun', [orchStart(activation, 'b-orch-tie')]);
  assert.deepEqual((await orch('listOrchestrationRuns', [{ status: 'running', limit: 3 }])).map((row) => row.runId),
    [shared.runId, 'a-orch-tie', 'b-orch-tie']);
  await orch('getOrchestrationRun', [shared.runId]);
  const view = await orch('getOrchestrationSnapshot', [shared.runId]);
  assert(!JSON.stringify(view).includes('private-checkpoint'));
  const claimed = await orch('claimReadyToken', [claim(shared.runId)]);
  assert.deepEqual(claimed.claim.checkpoint, shared.checkpoint);
  await orch('claimReadyToken', [claim(shared.runId, 'another')]);
  const attempt = claimed.claim.attempt;
  assert.equal((await orch('findRecoverableClaims', [{ now: 0 }])).length, 1);
  const park = completed(shared.runId, attempt, wait('signal', {
    kind: 'signal', signalName: 'go', contractId: 'signal.contract', contractRevision: '1', dueAt: null, timeoutAt: 300
  }), 'waiting');
  await orch('completeAttempt', [{ ...park, expectedAttemptFence: attempt.fence + 1 }], 'VICT_STORE_ATTEMPT_FENCE_CONFLICT');
  await orch('completeAttempt', [park]);
  await orch('listWaits', [shared.runId]);
  const signal = { runId: shared.runId, waitId: 'signal', signalId: 'signal-one', signalName: 'go',
    payload: 'private-signal', expectedWaitRevision: 1, commandHash: 'exact', now: 130, events: [] };
  assert.equal((await orch('signalWait', [signal])).status, 'accepted');
  assert.equal((await orch('signalWait', [signal])).status, 'duplicate');
  assert.equal((await orch('signalWait', [{ ...signal, commandHash: 'different' }])).status, 'conflict');
  await orch('listSignalReceipts', [shared.runId]);
  await orch('listOrchestrationEvents', [shared.runId]);

  const orderedRuns = ['a-orch-tie', 'b-orch-tie'];
  for (const id of orderedRuns) {
    const { claim: active } = await orch('claimReadyToken', [claim(id)]);
    await orch('completeAttempt', [completed(id, active.attempt, wait('same-timer'), 'waiting')]);
  }
  const pump = { now: 200, limit: 1.1, ownerId: 'pump', leaseExpiresAt: 250 };
  const batch = await orch('claimDueTimers', [pump]);
  assert.deepEqual(batch.timers.map((item) => item.runId), orderedRuns);
  assert.deepEqual((await orch('claimDueTimers', [{ ...pump, now: 249 }])).timers, []);
  const reacquired = await orch('claimDueTimers', [{ ...pump, now: 250, ownerId: 'next-pump', leaseExpiresAt: 300 }]);
  assert.deepEqual(reacquired.timers.map((item) => item.revision), batch.timers.map((item) => item.revision + 1));
  const timer = reacquired.timers[0];
  const resolve = { runId: timer.runId, timerId: timer.timerId, ownerId: 'next-pump', expectedTimerFence: timer.revision,
    now: 251, resolution: { kind: 'wake' }, run: { status: 'running' }, events: [] };
  assert.equal((await orch('resolveDueTimer', [{ ...resolve, expectedTimerFence: timer.revision - 1 }])).applied, false);
  assert.equal((await orch('resolveDueTimer', [resolve])).applied, true);
  assert.equal((await orch('resolveDueTimer', [resolve])).applied, false);

  const active = (await orch('claimReadyToken', [claim(shared.runId, 'recovery')])).claim;
  const recover = { runId: shared.runId, attemptId: active.attempt.attemptId, expectedAttemptFence: active.attempt.fence,
    now: 300, action: { kind: 'block', code: 'LOST', reason: 'abandoned owner' }, events: [] };
  await orch('recoverAttempt', [{ ...recover, expectedAttemptFence: 0 }], 'VICT_STORE_ATTEMPT_FENCE_CONFLICT');
  await orch('recoverAttempt', [recover]);
  const resolveBlocked = { runId: shared.runId, resolutionId: 'repair', action: 'retry', reasonCode: 'RETRY',
    commandHash: 'repair-hash', expectedRunRevision: (await orch('getOrchestrationRun', [shared.runId])).recordRevision,
    now: 400, events: [] };
  assert.equal((await orch('resolveBlocked', [resolveBlocked])).status, 'accepted');
  assert.equal((await orch('resolveBlocked', [resolveBlocked])).status, 'duplicate');
  assert.equal((await orch('resolveBlocked', [{ ...resolveBlocked, commandHash: 'conflict' }])).status, 'conflict');

  await orch('claimReadyToken', [claim(shared.runId)]);
  const cancel = { runId: shared.runId, requestId: 'cancel', reasonCode: 'STOP', commandHash: 'cancel-hash', now: 500, events: [] };
  await orch('requestCancellation', [cancel]);
  await orch('requestCancellation', [cancel]);
  await orch('requestCancellation', [{ ...cancel, commandHash: 'different' }]);
  const apply = { ...cancel, steps: 3, removeCheckpoints: [shared.rootTokenId] };
  await orch('applyCancellation', [apply]);
  await orch('applyCancellation', [apply]);
  await orch('getOrchestrationSnapshot', [shared.runId]);
  await orch('listOrchestrationEvents', [shared.runId]);
  assert.equal((await seq('getRun', [shared.runId])).status, 'completed');
  const expectedPorts = ['execution', 'orchestration'].flatMap((family) =>
    Object.keys(indexed[family]).map((method) => family + '.' + method)).sort();
  assert.equal(expectedPorts.length, 23);
  assert.deepEqual([...coverage].sort(), expectedPorts);
  const facade = indexed.forLease({});
  const families = Object.fromEntries(Object.entries(facade).map(([name, methods]) => [name, Object.keys(methods).length]));
  const coordination = ['acquire', 'tombstone', 'renew', 'release', 'beginEffect', 'settleEffect', 'getEffect',
    'withFence', 'assertInTransaction', 'runWithLease', 'currentLease'];
  const lifecycle = ['forLease', 'close', 'dispose'];
  for (const method of coordination) assert.equal(typeof indexed.coordination[method], 'function');
  for (const method of lifecycle) assert.equal(typeof indexed[method], 'function');
  const total = Object.values(families).reduce((sum, count) => sum + count, coordination.length + lifecycle.length);
  assert.equal(total, 126);
  evidence.runCoverage = { total, families, coordination: coordination.length, lifecycle: lifecycle.length,
    added: expectedPorts.length, compared: expectedPorts };
}

function expect(actual) {
  return {
    toBe: (expected) => assert.strictEqual(actual, expected),
    toEqual: (expected) => assert.deepStrictEqual(actual, expected),
    toBeDefined: () => assert.notStrictEqual(actual, undefined),
    toBeUndefined: () => assert.equal(actual, undefined),
    toBeTruthy: () => assert(actual),
    toHaveLength: (length) => assert.equal(actual.length, length),
    toBeGreaterThan: (expected) => assert(actual > expected),
    toMatchObject: (expected) => assert.partialDeepStrictEqual(actual instanceof Error ? shape(actual) : actual, expected),
    rejects: { toMatchObject: (expected) => assert.rejects(actual, (error) => {
      assert.partialDeepStrictEqual(shape(error), expected);
      return true;
    }) }
  };
}

async function pinnedSuites(context, counts) {
  const { oracle, provision, candidate, evidence, save } = context;
  const tests = [];
  const runner = (suite) => ({ expect, test: (name, body) => tests.push({ suite, name, body }) });
  let ordinal = 0;
  const factory = {
    name: 'indexed PostgreSQL',
    async create(clock) {
      const namespace = 'vhost009-suite-' + ordinal++;
      await provision(namespace);
      const faults = {};
      const store = trace(await candidate(namespace, { faults, maxConnections: 4 }), counts);
      const options = { stores: store, ...(clock ? { clock, orchestration: { time: clock } } : {}) };
      const runtime = oracle.runtime.createRuntime(options);
      return { ...store, faults, runtime, createOperatorRuntime: () => oracle.runtime.createRuntime(options) };
    }
  };
  oracle.testing.runStoreConformanceSuite(runner('store'), factory);
  oracle.testing.runOrchestrationConformanceSuite(runner('orchestration'), expect, factory);
  oracle.testing.runOrchestrationJoinSuite(runner('join'), expect, factory);
  evidence.pinnedSuiteCounts = Object.fromEntries(['store', 'orchestration', 'join'].map((suite) =>
    [suite, tests.filter((test) => test.suite === suite).length]));
  evidence.pinnedRunSuites = [];
  for (const { suite, name, body } of tests) {
    try {
      await body();
      evidence.pinnedRunSuites.push({ suite, name, passed: true });
    } catch (error) {
      evidence.pinnedRunSuites.push({ suite, name, error: shape(error), stack: error.stack });
      await save();
      throw error;
    }
  }
}

async function holdAfterEvent(store, family) {
  const pool = store.coordination.pool;
  const client = await pool.connect();
  const query = client.query;
  const { rows: [{ pid }] } = await query.call(client, 'SELECT pg_backend_pid() AS pid');
  let unblock;
  let entered;
  const waiting = new Promise((resolve) => { entered = resolve; });
  const released = new Promise((resolve) => { unblock = resolve; });
  client.query = async function (sql, ...args) {
    const result = await query.call(this, sql, ...args);
    if (sql.startsWith('INSERT INTO') && sql.includes(family + '_event')) {
      entered();
      await released;
    }
    return result;
  };
  client.release();
  return { pid, waiting, release: () => unblock(), restore: () => { client.query = query; } };
}

async function backend(store) {
  const client = await store.coordination.pool.connect();
  try {
    return (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  } finally {
    client.release();
  }
}

async function waitForBlock(observer, pid, holder) {
  assert.notEqual(pid, holder);
  for (let i = 0; i < 160; i++) {
    const { rows: [{ pids }] } = await observer.query('SELECT pg_blocking_pids($1::int) AS pids', [pid]);
    if (pids.includes(holder)) return pids;
    await delay(15);
  }
  throw new Error('Expected PostgreSQL blocker not observed');
}

async function raceHeld(observer, writer, peer, reader, family, first, second, inspect) {
  const peerPid = await backend(peer);
  const gate = await holdAfterEvent(writer, family);
  let competing;
  const leading = outcome(first);
  try {
    const leaderState = await Promise.race([gate.waiting.then(() => 'held'), leading.then((result) => result)]);
    assert.equal(leaderState, 'held', JSON.stringify(leaderState));
    competing = outcome(second);
    const blockers = await waitForBlock(observer, peerPid, gate.pid);
    const whileHeld = await inspect(reader);
    gate.release();
    return { writer: gate.pid, peer: peerPid, blockers, whileHeld, leading: await leading, competing: await competing };
  } finally {
    gate.release();
    await Promise.all([leading, competing]);
    gate.restore();
  }
}

async function atomicRuns(context, counts) {
  const { candidate, observer, provision, oracle, evidence, save } = context;
  const namespace = 'vhost009-atomic';
  const schema = 'vhost003_indexed.';
  await provision(namespace);
  const [writer, peer, reader] = await Promise.all(Array.from({ length: 3 }, async () =>
    trace(await candidate(namespace, { maxConnections: 1 }), counts)));
  const { manifest: activation, canonicalManifest } = manifest(oracle, 'atomic-run');
  const result = {};
  evidence.runAtomic = result;
  try {
    await writer.catalog.publish({ manifest: activation, canonicalManifest });
    const sequential = runStart(activation, 'run');
    await writer.execution.createRun(sequential);
    result.transition = await raceHeld(observer, writer, peer, reader, 'execution',
      () => writer.execution.commitTransition(transition(sequential)),
      () => peer.execution.commitTransition(transition(sequential)),
      (store) => store.execution.getRun(sequential.runId));
    assert.equal(result.transition.whileHeld.recordRevision, 1);
    assert.equal(result.transition.leading.value.recordRevision, 2);
    assert.equal(result.transition.competing.error.code, 'VICT_STORE_RUN_CONFLICT');
    assert.deepEqual((await reader.execution.listEvents(sequential.runId)).map((event) => event.seq), [0, 1]);

    const orchestrated = orchStart(activation, sequential.runId);
    await writer.orchestration.createOrchestrationRun(orchestrated);
    result.claim = await raceHeld(observer, writer, peer, reader, 'orchestration',
      () => writer.orchestration.claimReadyToken(claim(orchestrated.runId, 'first')),
      () => peer.orchestration.claimReadyToken(claim(orchestrated.runId, 'second')),
      (store) => store.orchestration.getOrchestrationRun(orchestrated.runId));
    assert.equal(result.claim.whileHeld.recordRevision, 1);
    assert.equal(result.claim.leading.value.claimed, true);
    assert.equal(result.claim.competing.value.claimed, false);
    assert.deepEqual((await reader.orchestration.listOrchestrationEvents(orchestrated.runId)).map((event) => event.seq), [0, 1]);


    const fork = orchStart(activation, 'join-race');
    await writer.orchestration.createOrchestrationRun(fork);
    const root = (await writer.orchestration.claimReadyToken(claim(fork.runId, 'root'))).claim;
    const children = ['a', 'z'].map((branchKey) => ({
      branchKey, toNodeId: 'branch-' + branchKey, forkId: 'fork', lineage: 'fork/' + branchKey,
      tokenId: 'branch-' + branchKey
    }));
    await writer.orchestration.completeAttempt(completed(fork.runId, root.attempt, { kind: 'fork', joinId: 'join', children }));
    const arrivals = [];
    for (const [i, store] of [writer, peer].entries()) {
      const { claim: branch } = await store.orchestration.claimReadyToken(claim(fork.runId, 'branch-owner-' + i));
      const branchKey = branch.token.branchKey;
      arrivals.push({
        ...completed(fork.runId, branch.attempt, { kind: 'branchArrival', forkId: 'fork', joinId: 'join', branchKey,
          joinContinuation: { tokenId: 'joined', toNodeId: 'join', lineage: 'fork' } }),
        branchOutput: branchKey.toUpperCase(), declaredBranchKeys: ['z', 'a'],
        events: [{ ...ids(fork), runId: fork.runId, timestamp: 122, type: 'node.completed',
          nodeId: branch.token.nodeId, capabilityId: 'cap.a' }]
      });
    }
    result.join = await raceHeld(observer, writer, peer, reader, 'orchestration',
      () => writer.orchestration.completeAttempt(arrivals[0]),
      () => peer.orchestration.completeAttempt(arrivals[1]),
      (store) => store.orchestration.getOrchestrationRun(fork.runId));
    assert.equal(result.join.leading.value.joinFired, false);
    assert.equal(result.join.competing.value.joinFired, true);
    const joinedState = await reader.orchestration.getOrchestrationSnapshot(fork.runId);
    const joined = joinedState.tokens.filter(({ tokenId }) => tokenId === 'joined');
    assert.equal(joined.length, 1);
    assert.equal('checkpoint' in joined[0], false);
    const joinClaim = (await reader.orchestration.claimReadyToken(claim(fork.runId, 'join-owner'))).claim;
    assert.deepEqual(joinClaim.checkpoint, { a: 'A', z: 'Z' });
    assert.deepEqual(Object.keys(joinClaim.checkpoint), ['a', 'z']);
    result.joinPublished = { token: joined[0], checkpointKeys: Object.keys(joinClaim.checkpoint),
      events: (await reader.orchestration.listOrchestrationEvents(fork.runId)).map(({ seq }) => seq) };
    // Complete this independent run before the sequential recovery probe.
    await reader.orchestration.completeAttempt(completed(fork.runId, joinClaim.attempt, { kind: 'none' }, 'completed'));
    const defs = [
      ['execution_event', 'BEFORE INSERT', "NEW.seq=2"],
      ['orchestration_event', 'BEFORE INSERT', "NEW.seq=2"],
      ['orchestration_timer', 'BEFORE UPDATE', "NEW.status='firing' AND NEW.timer_key=decode('00740069006d00650072005f007a','hex')"]
    ];
    await observer.query('CREATE FUNCTION ' + schema + 'reject_run_write() RETURNS trigger LANGUAGE plpgsql ' +
      "AS $$ BEGIN RAISE EXCEPTION 'synthetic execution rollback'; END $$");
    for (const [table, action, when] of defs) {
      await observer.query('CREATE TRIGGER reject_run_write ' + action + ' ON ' + schema + table +
        ' FOR EACH ROW WHEN (' + when + ') EXECUTE FUNCTION ' + schema + 'reject_run_write()');
    }
    try {
      result.executionBefore = { run: await reader.execution.getRun(sequential.runId),
        events: await reader.execution.listEvents(sequential.runId) };
      const next = transition(sequential, 2, 2);
      result.executionRefused = await outcome(() => writer.execution.commitTransition(next));
      assert.equal(result.executionRefused.error?.code, 'HOSTED_DATABASE_UNAVAILABLE');
      result.executionAfter = { run: await reader.execution.getRun(sequential.runId),
        events: await reader.execution.listEvents(sequential.runId) };
      assert.deepEqual(result.executionAfter, result.executionBefore);

      const active = result.claim.leading.value.claim.attempt;
      const complete = { ...completed(orchestrated.runId, active, { kind: 'none' }, 'completed'),
        events: [{ ...ids(orchestrated), runId: orchestrated.runId, timestamp: 120, type: 'run.completed' }] };
      result.orchestrationBefore = { state: await reader.orchestration.getOrchestrationSnapshot(orchestrated.runId),
        events: await reader.orchestration.listOrchestrationEvents(orchestrated.runId) };
      result.orchestrationRefused = await outcome(() => writer.orchestration.completeAttempt(complete));
      assert.equal(result.orchestrationRefused.error?.code, 'HOSTED_DATABASE_UNAVAILABLE');
      result.orchestrationAfter = { state: await reader.orchestration.getOrchestrationSnapshot(orchestrated.runId),
        events: await reader.orchestration.listOrchestrationEvents(orchestrated.runId) };
      assert.deepEqual(result.orchestrationAfter, result.orchestrationBefore);

      for (const waitId of ['z', 'a']) {
        const command = orchStart(activation, 'timer-' + waitId);
        await writer.orchestration.createOrchestrationRun(command);
        const { claim: taken } = await writer.orchestration.claimReadyToken(claim(command.runId));
        await writer.orchestration.completeAttempt(completed(command.runId, taken.attempt, wait(waitId), 'waiting'));
      }
      const table = schema + 'orchestration_timer';
      const timerRows = () => observer.query('SELECT run,ordinal,status,encode(payload,\'hex\') AS bytes FROM ' + table +
        ' WHERE namespace=$1 ORDER BY run,ordinal', [namespace]).then(({ rows }) => rows);
      const pump = { now: 200, limit: 3, ownerId: 'pump', leaseExpiresAt: 250 };
      result.timersBefore = await timerRows();
      result.timersRefused = await outcome(() => writer.orchestration.claimDueTimers(pump));
      assert.equal(result.timersRefused.error?.code, 'HOSTED_DATABASE_UNAVAILABLE');
      result.timersAfter = await timerRows();
      assert.deepEqual(result.timersAfter, result.timersBefore);

      for (const [table] of defs) await observer.query('DROP TRIGGER reject_run_write ON ' + schema + table);
      defs.length = 0;
      result.executionRetry = await peer.execution.commitTransition(next);
      result.orchestrationRetry = await peer.orchestration.completeAttempt(complete);
      const [a, b] = await Promise.all([writer.orchestration.claimDueTimers(pump), peer.orchestration.claimDueTimers(pump)]);
      result.timerCompetition = [a, b];
      assert.deepEqual([...a.timers, ...b.timers].map(({ timerId }) => timerId), ['timer_a', 'timer_z']);
      assert.equal(Math.min(a.timers.length, b.timers.length), 0);
    } finally {
      for (const [table] of defs) await observer.query('DROP TRIGGER IF EXISTS reject_run_write ON ' + schema + table);
      await observer.query('DROP FUNCTION ' + schema + 'reject_run_write()');
    }
    const key = keyBytes(sequential.runId);
    const { rows: [row] } = await observer.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT payload FROM ' + schema +
      'execution_run WHERE namespace=$1 AND key_digest=$2 AND key_bytes=$3', [namespace, hash(key), key]);
    result.pointPlan = row['QUERY PLAN'][0];
    await writer.close();
    const reopened = trace(await candidate(namespace), counts);
    try {
      result.recovered = await reopened.execution.recoverInterruptedRuns(recovery);
      assert.equal(result.recovered.scanned, 1);
      assert.equal((await reopened.execution.getRun(sequential.runId)).status, 'blocked');
      assert.equal((await reopened.orchestration.getOrchestrationRun(orchestrated.runId)).status, 'completed');
      result.reopenEvents = {
        execution: (await reopened.execution.listEvents(sequential.runId)).map(({ seq }) => seq),
        orchestration: (await reopened.orchestration.listOrchestrationEvents(orchestrated.runId)).map(({ seq }) => seq)
      };
      assert.deepEqual(result.reopenEvents, { execution: [0, 1, 2, 3], orchestration: [0, 1, 2] });
    } finally {
      await reopened.close();
    }
    await save();
  } finally {
    await Promise.all([writer.close(), peer.close(), reader.close()]);
  }
}

export async function checkRuns(context) {
  const { candidate, legacy, provision, observer, evidence, save } = context;
  const namespace = 'vhost009-differential';
  const counts = { statements: 0, legacySnapshotStatements: 0 };
  evidence.runSQL = counts;
  evidence.runDifferential = [];
  await provision(namespace);
  const [old, indexed] = await Promise.all([legacy(namespace, { migrate: true }), candidate(namespace)]);
  try {
    await differential(context, old, trace(indexed, counts));
  } finally {
    await Promise.all([old.close(), indexed.close()]);
  }
  await save();
  await atomicRuns(context, counts);
  await pinnedSuites(context, counts);
  assert(counts.statements > 0);
  assert.equal(counts.legacySnapshotStatements, 0);
  const { rows: [row] } = await observer.query("SELECT to_regclass('vhost003_indexed.operational') AS name");
  assert.equal(row.name, null);
  await save();
}
