import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { manifest, traceCandidate } from './control-checks.mjs';

export const orderingBaselineCommit = '06b3d36c0f570a859a0dd8be344717f615858011';
const cases = [
  {
    name: 'approval', table: 'control_approval',
    append: (store, id, subject = 'change') => store.control.recordChangeSetApproval({
      approvalId: id, approverActorId: id, changesetId: subject,
      decision: 'approved', contentHash: 'exact-content', decidedAt: 1
    }),
    read: async (store, subject = 'change') => ({
      approvals: (await store.control.listChangeSetApprovals(subject)).map((entry) => entry.approvalId)
    }),
    ordered: (ids) => ({ approvals: ids })
  },
  {
    name: 'audit', table: 'control_audit',
    append: (store, id, subject = 'change') => store.control.appendAuditEvent({
      auditId: id, subjectType: 'changeset', subjectId: subject,
      actorId: 'actor', action: 'changeset.approved', at: 1, summary: 'synthetic append ordering'
    }),
    read: async (store) => {
      const all = await store.control.listAuditEvents({});
      const filtered = await store.control.listAuditEvents({ subjectType: 'changeset', subjectId: 'change' });
      const subject = await store.control.listAuditEvents({ subjectId: 'change' });
      return { all: all.map((entry) => entry.auditId), filtered: filtered.map((entry) => entry.auditId),
        subject: subject.map((entry) => entry.auditId) };
    },
    ordered: (ids, { other = [] } = {}) => ({
      all: [...ids, ...other], filtered: ids, subject: ids
    })
  },
  {
    name: 'catalog', table: 'catalog_activation',
    append: (store, id, fixture, combined) => {
      const publish = fixture(id);
      return combined ? store.catalog.publishAndSelect({
        publish, select: { graphId: publish.manifest.graphId, operationId: 'select-' + id }
      }) : store.catalog.publish(publish);
    },
    read: async (store) => ({
      activations: (await store.catalog.list()).map((entry) => entry.graphId.split('-').at(-1)),
      firstSelection: (await store.catalog.getSelection('ordering-first'))?.selectionRevision ?? null,
      secondSelection: (await store.catalog.getSelection('ordering-second'))?.selectionRevision ?? null
    }),
    ordered: (ids, { first = false, second = true } = {}) => ({
      activations: ids, firstSelection: first && ids.includes('first') ? 1 : null,
      secondSelection: second && ids.includes('second') ? 1 : null
    })
  }
];

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

function start(work) {
  const call = { state: 'pending' };
  call.done = Promise.resolve().then(work).then(
    (value) => Object.assign(call, { state: 'succeeded', value }),
    (error) => Object.assign(call, { state: 'failed', error: { code: error.code, message: error.message } })
  );
  return call;
}

async function observeUntil(check, label) {
  for (let i = 0; i < 180; i++) {
    const seen = await check();
    if (seen !== undefined) return seen;
    await delay(15);
  }
  throw new Error('Timed out observing ' + label);
}

function result(call) {
  assert.equal(call.state, 'succeeded', JSON.stringify(call.error));
  return call.value;
}

async function commitGate(store) {
  const pool = store.coordination.pool;
  const client = await pool.connect();
  const original = client.query;
  const query = original.bind(client);
  const { rows: [{ pid }] } = await query('SELECT pg_backend_pid() AS pid');
  const decision = deferred();
  const gate = { pid, phase: 'idle', writes: [] };
  client.query = async (sql, ...params) => {
    if (sql === 'COMMIT' && gate.phase === 'idle') {
      gate.phase = 'pre-commit';
      const action = await decision.promise;
      if (action === 'rollback') throw new Error('synthetic refusal before commit');
    }
    const response = await query(sql, ...params);
    if (/^\s*(INSERT INTO|UPDATE)\s/i.test(sql)) {
      gate.writes.push({ sql, rows: response.rowCount, assignedId: response.rows[0]?.id });
    }
    return response;
  };
  client.release();
  gate.release = (action = 'commit') => decision.resolve(action);
  gate.restore = () => { client.query = original; };
  return gate;
}

async function backend(store) {
  const client = await store.coordination.pool.connect();
  try {
    return (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  } finally {
    client.release();
  }
}

async function blockers(observer, pid) {
  const { rows: [{ blocking }] } = await observer.query('SELECT pg_blocking_pids($1::integer) AS blocking', [pid]);
  return blocking;
}

async function blockedOrSettled(observer, call, pid, ...gates) {
  return observeUntil(async () => {
    if (call.state !== 'pending') return { state: call.state, value: call.value, error: call.error };
    const blocked = await blockers(observer, pid);
    if (gates.some(({ pid: gatePid }) => blocked.includes(gatePid))) {
      const { rows: waits } = await observer.query(
        'SELECT locktype,mode FROM pg_locks WHERE pid=$1 AND NOT granted ORDER BY locktype,mode', [pid]
      );
      return { state: 'blocked', blockers: blocked, waits };
    }
  }, 'a commit or its PostgreSQL blocker');
}

async function waitForGate(gate, call, table) {
  await observeUntil(() => {
    assert.equal(call.state, 'pending', JSON.stringify(call.error));
    if (gate.phase === 'pre-commit') return true;
  }, 'pre-commit gate for ' + table);
  assert(gate.writes.some(({ sql, rows }) => sql.includes(table) && rows === 1), JSON.stringify(gate.writes));
}

async function primary(context, open, mode, test) {
  const { observer, provision, oracle } = context;
  const namespace = 'vhost008-' + mode + '-' + test.name;
  await provision(namespace);
  const settings = { maxConnections: 1, statementTimeoutMs: 20_000, lockTimeoutMs: 15_000 };
  const left = await open(namespace, { ...settings, ...(mode === 'legacy' ? { migrate: true } : {}) });
  const right = await open(namespace, settings);
  const reader = await open(namespace, settings);
  const fixture = (id) => manifest(oracle, 'ordering-' + id);
  const submit = (store, id, combined) => test.name === 'catalog' ?
    test.append(store, id, fixture, combined) : test.append(store, id);
  const expected = (ids) => test.ordered(ids, { first: true, second: true });
  const legacy = mode === 'legacy';
  const baseline = mode === 'baseline';
  const table = legacy ? '.operational' : '.' + test.table;
  let a;
  let b;
  let read;
  let holdA;
  let holdB;
  try {
    await submit(left, 'seed');
    holdA = await commitGate(left);
    holdB = await commitGate(right);
    const readerPid = await backend(reader);
    assert.equal(new Set([holdA.pid, holdB.pid, readerPid]).size, 3);
    const record = { namespace, pids: [holdA.pid, holdB.pid, readerPid], seeded: await test.read(reader) };
    context.evidence.ordering[mode][test.name] = record;
    assert.deepEqual(record.seeded, expected(['seed']));
    a = start(() => submit(left, 'first', true));
    await waitForGate(holdA, a, table);
    record.firstUncommitted = holdA.writes;
    b = start(() => submit(right, 'second', true));
    if (baseline) {
      await waitForGate(holdB, b, table);
      record.secondUncommitted = holdB.writes;
      const allocated = (gate) => gate.writes.find(({ sql }) => sql.includes(table)).assignedId;
      assert(BigInt(allocated(holdA)) < BigInt(allocated(holdB)));
      record.beforeEitherCommit = await test.read(reader);
      assert.deepEqual(record.beforeEitherCommit, expected(['seed']));
      holdB.release();
      await b.done;
      record.secondResult = result(b);
      record.afterSecondCommit = await test.read(reader);
      assert.deepEqual(record.afterSecondCommit, expected(['seed', 'second']));
      holdA.release();
      await a.done;
    } else {
      record.secondBeforeFirstCommit = await blockedOrSettled(observer, b, holdB.pid, holdA);
      assert.equal(record.secondBeforeFirstCommit.state, 'blocked');
      record.secondWritesWhileFirstHeld = [...holdB.writes];
      assert.deepEqual(record.secondWritesWhileFirstHeld, []);
      read = start(() => test.read(reader));
      record.readerBeforeFirstCommit = await blockedOrSettled(observer, read, readerPid, holdA, holdB);
      if (legacy) assert.equal(record.readerBeforeFirstCommit.state, 'blocked');
      else {
        assert.equal(record.readerBeforeFirstCommit.state, 'succeeded');
        assert.deepEqual(record.readerBeforeFirstCommit.value, expected(['seed']));
      }
      holdA.release();
      result(await a.done);
      await waitForGate(holdB, b, table);
      record.secondUncommitted = holdB.writes;
      if (!legacy) {
        record.afterFirstCommit = await test.read(reader);
        assert.deepEqual(record.afterFirstCommit, expected(['seed', 'first']));
      }
      holdB.release();
      await b.done;
      record.secondResult = result(b);
      record.firstReaderResult = result(await read.done);
    }
    record.firstResult = result(a);
    record.afterBothCommit = await test.read(reader);
    assert.deepEqual(record.afterBothCommit, expected(['seed', 'first', 'second']));
    await context.save();
  } finally {
    holdA?.release();
    holdB?.release();
    await Promise.all([a?.done, b?.done, read?.done]);
    holdA?.restore();
    holdB?.restore();
    await Promise.all([left.close(), right.close(), reader.close()]);
  }
}

async function rollbackAndIndependence(context, open, test) {
  const { observer, provision, oracle } = context;
  const namespace = 'vhost008-rollback-' + test.name;
  const unrelated = namespace + '-other';
  await provision(namespace);
  await provision(unrelated);
  const settings = { maxConnections: 1, statementTimeoutMs: 20_000, lockTimeoutMs: 15_000 };
  const [left, right, reader, outsider] = await Promise.all([
    open(namespace, settings), open(namespace, settings), open(namespace, settings), open(unrelated, settings)
  ]);
  const fixture = (id) => manifest(oracle, 'ordering-' + id);
  const submit = (store, id, combined) => test.name === 'catalog' ?
    test.append(store, id, fixture, combined) : test.append(store, id);
  const record = {};
  context.evidence.ordering.rollback[test.name] = record;
  let hold;
  let a;
  let b;
  let independent;
  let replay;
  let elsewhere;
  try {
    await submit(left, 'seed');
    hold = await commitGate(left);
    a = start(() => submit(left, 'first', true));
    await waitForGate(hold, a, '.' + test.table);
    record.firstUncommitted = hold.writes;
    const rightPid = await backend(right);
    // Audit has one global list, so the second append must wait even when
    // filtered readers consider these subjects unrelated.
    b = start(() => test.name === 'audit' ? test.append(right, 'second', 'other') : submit(right, 'second', false));
    record.secondWhileHeld = await blockedOrSettled(observer, b, rightPid, hold);
    assert.equal(record.secondWhileHeld.state, 'blocked');

    const outsiderPid = await backend(outsider);
    elsewhere = start(() => submit(outsider, 'outside', false));
    record.otherNamespaceWhileHeld = await blockedOrSettled(observer, elsewhere, outsiderPid, hold);
    assert.equal(record.otherNamespaceWhileHeld.state, 'succeeded');

    const readerPid = await backend(reader);
    // Seed already exists, so a duplicate never waits for append order.
    replay = start(() => submit(reader, 'seed'));
    record.duplicateWhileHeld = await blockedOrSettled(observer, replay, readerPid, hold);
    assert.equal(record.duplicateWhileHeld.state, 'succeeded');
    if (test.name === 'catalog') assert.equal(record.duplicateWhileHeld.value.created, false);

    if (test.name === 'approval') {
      independent = start(() => test.append(reader, 'other', 'other-change'));
    } else if (test.name === 'catalog') {
      independent = start(() => reader.catalog.select({
        graphId: 'ordering-seed', activationVersion: fixture('seed').manifest.activationVersion,
        operationId: 'select-existing'
      }));
    } else {
      independent = start(() => reader.control.saveChangeSet({
        changesetId: 'unrelated-control', contentHash: 'fixture'
      }));
    }
    record.unrelatedKeyWhileHeld = await blockedOrSettled(observer, independent, readerPid, hold);
    assert.equal(record.unrelatedKeyWhileHeld.state, 'succeeded');
    record.beforeRollback = await test.read(reader);
    assert.deepEqual(record.beforeRollback, test.ordered(['seed']));
    hold.release('rollback');
    record.refusal = (await a.done).error;
    assert.equal(record.refusal?.code, 'HOSTED_DATABASE_UNAVAILABLE');
    result(await b.done);
    record.afterRollback = await test.read(reader);
    const after = test.name === 'audit' ? test.ordered(['seed'], { other: ['second'] }) :
      test.ordered(['seed', 'second'], { second: false });
    assert.deepEqual(record.afterRollback, after);
    if (test.name === 'catalog') {
      assert.equal(await reader.catalog.get(fixture('first').manifest.activationVersion), undefined);
      assert.equal(await reader.catalog.getSelection('ordering-first'), undefined);
    }
    hold.restore();
    record.retry = await submit(left, 'first', true);
    record.replay = await submit(right, 'first', true);
    record.afterRetryAndDuplicate = await test.read(reader);
    const afterRetry = test.name === 'audit' ?
      { all: ['seed', 'second', 'first'], filtered: ['seed', 'first'], subject: ['seed', 'first'] } :
      test.ordered(['seed', 'second', 'first'], { first: true, second: false });
    assert.deepEqual(record.afterRetryAndDuplicate, afterRetry);
    if (test.name === 'catalog') {
      assert.equal(record.retry.created, true);
      assert.equal(record.replay.created, false);
      assert.deepEqual(record.retry.selection, record.replay.selection);
    }
    await context.save();
  } finally {
    hold?.release();
    await Promise.all([a?.done, b?.done, independent?.done, replay?.done, elsewhere?.done]);
    hold?.restore();
    await Promise.all([left.close(), right.close(), reader.close(), outsider.close()]);
  }
}

export async function checkOrdering(context, baseline, candidate) {
  const { observer, evidence } = context;
  const { rows: sequences } = await observer.query(
    'SELECT sequencename, cache_size::int AS cache, increment_by::int AS increment, cycle ' +
      'FROM pg_sequences WHERE schemaname=$1 AND sequencename=ANY($2::text[]) ORDER BY sequencename',
    ['vhost003_indexed', cases.map(({ table }) => table + '_id_seq')]
  );
  assert.equal(sequences.length, cases.length);
  for (const { cache, increment, cycle } of sequences) {
    assert.equal(cache, 1);
    assert.equal(increment, 1);
    assert.equal(cycle, false);
  }

  const traces = [];
  const repaired = async (...args) => {
    const store = await candidate(...args);
    traces.push({ namespace: args[0], counts: traceCandidate(store) });
    return store;
  };
  evidence.ordering = { baselineCommit: orderingBaselineCommit, sequences, baseline: {}, legacy: {}, repaired: {}, rollback: {}, traces };
  for (const [mode, open] of [['baseline', baseline], ['legacy', context.legacy], ['repaired', repaired]]) {
    for (const test of cases) await primary(context, open, mode, test);
  }
  for (const test of cases) await rollbackAndIndependence(context, repaired, test);
  for (const { counts } of traces) {
    assert(counts.statements > 0);
    assert.equal(counts.legacySnapshotReads, 0);
    assert.equal(counts.legacySnapshotWrites, 0);
  }
  await context.save();
}
