import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { digest } from './oracle.mjs';
import { event, turn } from './checks.mjs';

const measurement = new AsyncLocalStorage();
const bytes = (value) => Buffer.isBuffer(value) ? value.length : Buffer.byteLength(JSON.stringify(value) ?? '');

export function monitorPool(pool) {
  const connect = pool.connect.bind(pool);
  const wrapped = new WeakSet();
  pool.connect = async () => {
    const started = performance.now();
    const row = measurement.getStore();
    const pending = connect();
    if (row) row.queuedBeforeCheckout = Math.max(row.queuedBeforeCheckout, pool.waitingCount);
    const client = await pending;
    if (row) row.poolMs += performance.now() - started;
    if (!wrapped.has(client)) {
      wrapped.add(client);
      const query = client.query.bind(client);
      client.query = async (sql, params) => {
        const row = measurement.getStore();
        if (!row) return query(sql, params);
        const begin = performance.now();
        const stream = client.connection.stream;
        const { bytesRead, bytesWritten } = stream;
        const type = sql.startsWith('SELECT snapshot FROM') ? 'snapshotRead' :
          sql.includes('SET snapshot=') ? 'snapshotWrite' : sql.split(/\s+/, 1)[0];
        const statement = row.statements[type] ??= { calls: 0, ms: 0, read: 0, write: 0, valueBytesRead: 0, bindBytes: 0 };
        statement.calls++;
        try {
          const result = await query(sql, params);
          for (const tuple of result.rows ?? []) {
            for (const value of Object.values(tuple)) statement.valueBytesRead += bytes(value);
          }
          for (const param of params ?? []) statement.bindBytes += bytes(param);
          return result;
        } finally {
          statement.ms += performance.now() - begin;
          statement.read += stream.bytesRead - bytesRead;
          statement.write += stream.bytesWritten - bytesWritten;
        }
      };
    }
    return client;
  };
  return pool;
}

const WAL = "SELECT pg_current_wal_insert_lsn()::text AS lsn, pg_database_size(current_database())::text AS size";
const sampleLocks = `SELECT coalesce(wait_event,'active') AS event, count(*)::int AS count
  FROM pg_stat_activity WHERE datname=current_database() AND application_name='vict-hosted-runtime'
  GROUP BY 1 ORDER BY 1`;
const pct = (rows, getter) => {
  const values = rows.map(getter).sort((a,b) => a-b);
  return Object.fromEntries([50,95,99].map((p) => ['p' + p, values[Math.ceil(values.length*p/100)-1] ?? null]));
};
function total(row, property) {
  return Object.values(row.statements).reduce((sum, item) => sum + item[property], 0);
}

export async function measure(observer, pool, run, samples, clients) {
  const cpu = process.cpuUsage();
  const before = (await observer.query(WAL)).rows[0];
  const begin = performance.now();
  const rows = [];
  let next = 0;
  let done = false;
  const waitSamples = [];
  const sampler = (async () => {
    while (!done) {
      const { rows: waits } = await observer.query(sampleLocks);
      waitSamples.push({ timeMs: performance.now() - begin, waits,
        poolWaiting: pool.waitingCount, poolTotal: pool.totalCount });
      await delay(10);
    }
  })();
  let operationMs;
  try {
    await Promise.all(Array.from({ length: clients }, async () => {
      while (next < samples) {
        const ordinal = next++;
        const row = { ordinal, poolMs: 0, queuedBeforeCheckout: 0, statements: {} };
        const start = performance.now();
        try {
          row.result = await measurement.run(row, () => run(ordinal));
        } catch (error) {
          row.failure = { code: error.code ?? 'UNCLASSIFIED', name: error.name, message: error.message };
        }
        row.elapsedMs = performance.now() - start;
        rows.push(row);
      }
    }));
    operationMs = performance.now() - begin;
  } finally {
    done = true;
    await sampler;
  }
  const cpuMicroseconds = process.cpuUsage(cpu);
  const after = (await observer.query(WAL)).rows[0];
  const { rows: [{ wal_bytes }] } = await observer.query(
    'SELECT pg_wal_lsn_diff($1::pg_lsn,$2::pg_lsn)::text AS wal_bytes', [after.lsn, before.lsn]
  );
  const passed = rows.filter((row) => !row.failure);
  return {
    operationMs, clientCPUUs: cpuMicroseconds, walBytes: Number(wal_bytes),
    databaseSizeChange: Number(after.size) - Number(before.size),
    goodputPerSecond: passed.length * 1000 / operationMs,
    latencyMs: pct(passed, (row) => row.elapsedMs),
    poolMs: pct(passed, (row) => row.poolMs),
    sqlMs: pct(passed, (row) => total(row, 'ms')),
    sqlCalls: pct(passed, (row) => total(row, 'calls')),
    wireReadBytes: pct(passed, (row) => total(row, 'read')),
    wireWriteBytes: pct(passed, (row) => total(row, 'write')),
    resultValueBytes: pct(passed, (row) => total(row, 'valueBytesRead')),
    bindValueBytes: pct(passed, (row) => total(row, 'bindBytes')),
    waitSamples, rows: rows.sort((a,b) => a.ordinal - b.ordinal)
  };
}

async function seed({ oracle, observer, provision, legacy, candidate }, targetBytes) {
  const namespace = 'synthetic-' + targetBytes;
  await provision(namespace);
  const old = await legacy(namespace, { migrate: true, maxConnections: 4 });
  const indexed = await candidate(namespace, { maxConnections: 4 });
  try {
    await Promise.all([old, indexed].map(async (store) => {
      await store.turns.createTurnIntent(turn());
      await store.turns.startTurn('hot-turn', 1001);
    }));
    const query = 'FROM vhost003_legacy.operational WHERE namespace=$1';
    const { rows: [{ snapshot }] } = await observer.query('SELECT snapshot ' + query, [namespace]);
    const ledger = new oracle.runtime.InMemoryAgentStreamLedgerStore(snapshot.snapshots.streamLedger);
    const hot = event('hot-stream','hot-turn',1002);
    await ledger.appendEvent(hot);
    await indexed.streamLedger.appendEvent(hot);
    let historicStreams = 0;
    let snapshotBytes;
    while (true) {
      snapshot.snapshots.streamLedger = ledger.exportSnapshot();
      snapshotBytes = bytes(snapshot);
      if (snapshotBytes >= targetBytes) break;
      const history = [];
      for (let index = 0; index < 50; index++) {
        historicStreams++;
        const identity = digest('fixture:' + historicStreams).slice(0, 24);
        const command = event('history-' + identity, 'turn-' + identity, historicStreams + 1100);
        await ledger.appendEvent(command);
        history.push(indexed.streamLedger.appendEvent(command));
      }
      await Promise.all(history);
    }
    await observer.query('UPDATE vhost003_legacy.operational SET snapshot=$2::jsonb WHERE namespace=$1',
      [namespace, JSON.stringify(snapshot)]);
    assert.equal((await indexed.streamLedger.listStreamIds()).length, historicStreams + 1);
    const storedJsonBytes = (await observer.query('SELECT octet_length(snapshot::text) AS size ' + query, [namespace])).rows[0].size;
    if (targetBytes === 1_560_000) {
      await assert.rejects(old.turns.getTurn('hot-turn'), { code: 'HOSTED_STATE_LIMIT' });
      assert.equal((await indexed.turns.getTurn('hot-turn')).status, 'running');
    }
    return { namespace, snapshotBytes, storedJsonBytes, historicStreams };
  } finally {
    await Promise.all([old.close(), indexed.close()]);
  }
}

async function plans(observer, namespace) {
  const stream = Buffer.from('hot-stream', 'utf16le').swap16();
  const turnKey = Buffer.from('hot-turn','utf16le').swap16();
  const turnDigest = Buffer.from(digest(turnKey), 'hex');
  const targets = {
    legacy: ['SELECT snapshot FROM vhost003_legacy.operational WHERE namespace=$1 FOR UPDATE', [namespace]],
    candidateObserveStream: ['SELECT payload FROM vhost003_indexed.stream_events WHERE namespace=$1 AND stream_key=$2 AND seq>$3 ORDER BY seq', [namespace, stream, 0]],
    candidateObserveTurn: ['SELECT payload FROM vhost003_indexed.turn_head WHERE namespace=$1 AND key_digest=$2 AND key_bytes=$3',
      [namespace, turnDigest, turnKey]],
    candidateStop: ['SELECT EXISTS (SELECT 1 FROM vhost003_indexed.cancel_intents AS cancel WHERE cancel.namespace=$1 AND cancel.turn IN (SELECT id FROM vhost003_indexed.turn_head WHERE namespace=$1 AND key_digest=$2 AND key_bytes=$3))',
      [namespace, turnDigest, turnKey]],
    candidateAppend: ['INSERT INTO vhost003_indexed.stream_clock AS clock VALUES ($1,$2,1) ON CONFLICT(namespace,stream_key) DO UPDATE SET seq=clock.seq+1 RETURNING seq',
      [namespace, stream]]
  };
  const report = {};
  await observer.query('ANALYZE');
  for (const [name, [sql, params]] of Object.entries(targets)) {
    await observer.query('BEGIN');
    try {
      const result = await observer.query('EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) ' + sql, params);
      report[name] = result.rows[0]['QUERY PLAN'][0];
    } finally {
      await observer.query('ROLLBACK');
    }
  }
  return report;
}

async function callbackContention({ observer, candidate, evidence }, namespace) {
  const store = await candidate(namespace, { maxConnections: 4 });
  const scope = store.coordination;
  try {
    const pool = monitorPool(scope.pool);
    const getLease = async (scopeId) => {
      const got = await scope.acquire({ scopeId, actorId: 'synthetic-actor', ownerId: 'worker', leaseMs: 60_000 });
      assert.equal(got.status, 'acquired');
      return got.lease;
    };
    const first = await getLease('callback-first');
    const second = await getLease('callback-second');
    const independent = await getLease('callback-unrelated');
    const callback = (left, right) => scope.withFence(left, async (client) => {
      await scope.assertInTransaction(client, right);
      await client.query('SELECT pg_sleep(0.035)');
      await scope.assertInTransaction(client, right);
    });
    const contended = await measure(observer, pool,
      (i) => i % 2 ? callback(second, first) : callback(first, second), 8, 4);
    assert(contended.rows.every((row) => !row.failure));
    assert(contended.waitSamples.some((sample) => sample.waits.some(({ event }) =>
      ['transactionid', 'tuple'].includes(event))));
    let release;
    let admit;
    const hold = new Promise((done) => { release = done; });
    const inside = new Promise((done) => { admit = done; });
    const running = scope.withFence(first, async (client) => {
      await scope.assertInTransaction(client, second);
      admit();
      await hold;
      await scope.assertInTransaction(client, second);
    });
    await inside;
    try {
      const start = performance.now();
      assert.equal(await store.forLease(independent).turns.hasCancelIntent('hot-turn'), false);
      evidence.callbackContention = { contended, unrelatedLeasedStopMs: performance.now() - start };
    } finally {
      release();
      await running;
    }
  } finally {
    await store.close();
  }
}

export async function compareBenchmarks(context) {
  const { evidence, observer, samples, legacy, candidate, save } = context;
  evidence.fixtures = [];
  for (const targetBytes of [100_000, 550_000, 1_560_000]) {
    const fixture = await seed(context, targetBytes);
    evidence.fixtures.push(fixture);
    const { namespace } = fixture;
    for (const [connections, clients] of [[1,1], [1,8], [4,8]]) {
      for (const [implementation, create] of Object.entries({ legacy, candidate })) {
        const stateNodeLimit = implementation === 'legacy' && targetBytes === 1_560_000 ? 300_000 : 100_000;
        const store = await create(namespace, { maxConnections: connections, maxStateNodes: stateNodeLimit });
        try {
          const pool = monitorPool(store.coordination.pool);
          const acquired = await store.coordination.acquire({
            scopeId: 'work', actorId: 'synthetic-actor', ownerId: 'worker', leaseMs: 300_000
          });
          assert.equal(acquired.status, 'acquired');
          const leased = store.forLease(acquired.lease);
          const operations = {
            observe: async () => {
              assert.equal((await store.streamLedger.listEventsFrom('hot-stream', 0)).length, 1);
              assert.equal((await store.turns.getTurn('hot-turn')).status, 'running');
            },
            checkStop: async () => assert.equal(await leased.turns.hasCancelIntent('hot-turn'), false),
            appendMilestone: async (index) => {
              const result = await leased.streamLedger.appendEvent(event('write-stream','write-turn',2000 + index));
              assert.equal(result.persisted, true);
              return result.seq;
            }
          };
          for (const [name, run] of Object.entries(operations)) {
            await run(-1);
            const observed = await measure(observer, pool, run, samples, clients);
            evidence.cells.push({ implementation, targetBytes, name, connections, clients, stateNodeLimit, ...observed });
            await save();
            assert(observed.rows.every((row) => !row.failure), implementation + ' ' + name);
            if (name === 'appendMilestone') {
              const sequences = observed.rows.map(({ result }) => result);
              assert.equal(new Set(sequences).size, samples);
              assert.equal(await store.streamLedger.latestSeq('write-stream'), Math.max(...sequences));
            }
            if (implementation === 'candidate') {
              assert(observed.rows.every(({ statements }) => !statements.snapshotRead && !statements.snapshotWrite));
            }
          }
          await store.coordination.release(acquired.lease);
          await assert.rejects(leased.turns.hasCancelIntent('hot-turn'), { code: 'HOSTED_FENCED' });
        } finally {
          await store.close();
        }
      }
    }
    evidence.plans ??= {};
    evidence.plans[targetBytes] = await plans(observer, namespace);
    await save();
  }
  await callbackContention(context, 'synthetic-100000');
}
