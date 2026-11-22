import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { cpus, platform, release } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const [consumer, dataDir, portText, samplesText, output] = process.argv.slice(2);
const port = Number(portText);
const samples = Number(samplesText);
assert(Number.isSafeInteger(port) && port >= 1024 && port <= 65535);
assert(Number.isSafeInteger(samples) && samples >= 4 && samples <= 1000);
const consumerPath = await realpath(consumer);
const pinned = new Map([
  ['store-postgres', ['victframework-store-postgres-0.4.0-rc.1.tgz', '74f4681ee0d86d487f7fd304ae88cf181aa6e6dff92a0f3bb01ad6dbe84129cb']],
  ['hosted', ['victframework-hosted-0.4.0-rc.1.tgz', '4aa6581aa7d26f067ddb3ec28dc8f7fd67bb34467e08132132972ed25c880de4']],
  ['runtime', ['runtime-0.4.0-rc.1-memory-e94ee682d7f5.tgz', 'e94ee682d7f57efbbc9722818f2ab6059ad6a9bb3f9c8229e73c24197b0abb3f']],
  ['mastra', ['mastra-0.4.0-rc.1-memory-2d136123705f.tgz', '2d136123705f92e88a15e7e2b80e1732218ca00018c9cc55165a69a7774a84d3']]
]);
const lock = (await readFile(join(consumerPath, 'package-lock.json'), 'utf8')).replaceAll('\r\n', '\n');
const lockSha256 = digest(lock);
assert.equal(lockSha256, '8b821ffabf5d8f184f69862deb9cab7495a63a37a51641e6e074ba342de3d4dc');
for (const [name, [file, sha256]] of pinned) {
  const bytes = await readFile(join(consumerPath, 'packs', file));
  assert.equal(digest(bytes), sha256, name);
  const expected = JSON.parse(lock).packages['node_modules/@victframework/' + name];
  assert.equal(expected.integrity, 'sha512-' + createHash('sha512').update(bytes).digest('base64'));
}
const require = createRequire(join(consumerPath, 'package.json'));
async function load(name) {
  const path = await realpath(require.resolve(name));
  assert(path.toLowerCase().startsWith(join(consumerPath, 'node_modules').toLowerCase() + (platform() === 'win32' ? '\\' : '/')));
  return import(pathToFileURL(path));
}
const { createPostgresStores } = await load('@victframework/store-postgres');
const { InMemoryAgentStreamLedgerStore } = await load('@victframework/runtime');
const { default: { Client } } = await load('pg');
const connectionString = 'postgresql://vhostbench@127.0.0.1:' + port + '/postgres';
const observer = new Client({ connectionString, application_name: 'vhost002_observer', ssl: false });
await observer.connect();
const evidence = {
  schema: 'vict.legacy-postgres-baseline@1', when: new Date().toISOString(),
  provenance: { frameworkCommit: '1b11d4a5f4298310c7ab16e0808b8bfbed551ee5', consumerCommit: '8f8ec2d24180e4a9520be0689aa6afb711553fc9', lockSha256, archives: Object.fromEntries(pinned), node: process.version, pgDriver: require('pg/package.json').version },
  host: { platform: platform(), release: release(), logicalCpus: cpus().length, cpu: cpus()[0]?.model },
  samples, cells: [], correctness: []
};
const schema = 'vhost002_bench';
const scope = new AsyncLocalStorage();
try {
  const { rows: [server] } = await observer.query("SELECT current_setting('data_directory') AS data, current_setting('server_version') AS version, inet_server_addr()::text AS address, inet_server_port() AS port, current_setting('ssl') AS ssl, current_user AS role");
  assert.equal(resolve(await realpath(server.data)), resolve(await realpath(dataDir)));
  assert.equal(server.address, '127.0.0.1/32');
  assert.equal(server.port, port);
  assert.equal(server.role, 'vhostbench');
  assert.equal(server.ssl, 'off');
  evidence.provenance.postgres = server.version;
  for (const targetBytes of [100_000, 550_000, 1_560_000]) {
    const namespace = 'synthetic-' + targetBytes;
    const options = { connectionString, namespace, schema, tls: 'disable-loopback-only', maxConnections: 4 };
    const seed = await createPostgresStores({ ...options, migrate: true });
    let snapshotBytes;
    let historicStreams;
    try {
      await seed.turns.createTurnIntent({
        turnId: 'hot-turn', streamId: 'hot-stream', threadId: 'hot-thread', actorId: 'synthetic-actor',
        agentProfileVersion: 'profile', activationVersion: 'activation', applicationReleaseVersion: undefined,
        inputSummary: 'fixture', status: 'intent', createdAt: 1000, updatedAt: 1000,
        terminalAt: undefined, errorCode: undefined, traceId: undefined, victRunId: undefined, mastraRunId: undefined
      });
      await seed.turns.startTurn('hot-turn', 1001);
      const pg = seed.coordination.pool;
      const { rows: [{ snapshot }] } = await pg.query('SELECT snapshot FROM ' + schema + '.operational WHERE namespace=$1', [namespace]);
      const ledger = new InMemoryAgentStreamLedgerStore(snapshot.snapshots.streamLedger);
      await append(ledger, 'hot-stream', 'hot-turn', 1002);
      historicStreams = 0;
      while (true) {
        snapshot.snapshots.streamLedger = ledger.exportSnapshot();
        snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot));
        if (snapshotBytes >= targetBytes) break;
        for (let i = 0; i < 50; i++) {
          historicStreams++;
          const identity = digest('fixture:' + historicStreams).slice(0, 24);
          await append(ledger, 'history-' + identity, 'turn-' + identity, historicStreams + 1100);
        }
      }
      await pg.query('UPDATE ' + schema + '.operational SET snapshot=$2::jsonb WHERE namespace=$1', [namespace, JSON.stringify(snapshot)]);
      if (targetBytes === 1_560_000) {
        await assert.rejects(seed.turns.getTurn('hot-turn'), { code: 'HOSTED_STATE_LIMIT' });
        evidence.correctness.push({ namespace, snapshotBytes, check: 'default node budget rejects dense event history', code: 'HOSTED_STATE_LIMIT' });
      } else {
        assert.equal((await seed.turns.getTurn('hot-turn')).status, 'running');
        assert.equal((await seed.streamLedger.listEventsFrom('hot-stream', 0)).length, 1);
      }
    } finally {
      await seed.close();
    }
    const stateNodeLimit = targetBytes === 1_560_000 ? 300_000 : 100_000;
    for (const [connections, clients] of [[1,1], [1,8], [4,8]]) {
      const start = performance.now();
      const store = await createPostgresStores({ ...options, maxConnections: connections, maxStateNodes: stateNodeLimit, migrate: false });
      const openMs = performance.now() - start;
      try {
        const monitor = instrument(store.coordination.pool);
        const lease = await store.coordination.acquire({ scopeId: 'work', ownerId: 'worker', actorId: 'synthetic-actor', leaseMs: 300_000 });
        assert.equal(lease.status, 'acquired');
        const leased = store.forLease(lease.lease);
        const operations = {
          observe: async () => {
            assert.equal((await store.streamLedger.listEventsFrom('hot-stream', 0)).length, 1);
            assert.equal((await store.turns.getTurn('hot-turn')).status, 'running');
          },
          checkStop: async () => assert.equal(await leased.turns.hasCancelIntent('hot-turn'), false),
          appendMilestone: async i => {
            const result = await append(leased.streamLedger, 'write-stream', 'write-turn', 2000 + i);
            assert.equal(result.persisted, true);
            return result.seq;
          }
        };
        for (const [name, run] of Object.entries(operations)) {
          await run(-1);
          const cell = await measure({ name, run, clients, connections, targetBytes, snapshotBytes, historicStreams, stateNodeLimit, openMs, monitor });
          if (name === 'appendMilestone' && cell.failures.length === 0) {
            const unique = new Set(cell.samples.map(row => row.result));
            assert.equal(unique.size, samples);
            assert.equal(await store.streamLedger.latestSeq('write-stream'), Math.max(...unique));
          }
          evidence.cells.push(cell);
          await save();
        }
        if (connections === 4 && targetBytes === 100_000) {
          const shortWait = await createPostgresStores({ ...options, maxConnections: 1, lockTimeoutMs: 120, migrate: false });
          try {
            await validateLockFailure(shortWait, namespace);
          } finally {
            await shortWait.close();
          }
        }
        await store.coordination.release(lease.lease);
        await assert.rejects(leased.turns.hasCancelIntent('hot-turn'), { code: 'HOSTED_FENCED' });
        evidence.correctness.push({ namespace, clients, check: 'released generation rejected' });
      } finally {
        await store.close();
      }
    }
    if (targetBytes === 1_560_000) {
      const bounded = await createPostgresStores({ ...options, maxSnapshotBytes: 128 * 1024, maxStateNodes: stateNodeLimit, migrate: false });
      try {
        await assert.rejects(bounded.turns.getTurn('hot-turn'), { code: 'HOSTED_STATE_LIMIT' });
        evidence.correctness.push({ namespace, check: 'oversized state fails closed' });
      } finally {
        await bounded.close();
      }
    }
  }
} catch (error) {
  evidence.failure = { name: error.name, code: error.code, message: String(error.message).slice(0, 500) };
  throw error;
} finally {
  await save();
  await observer.end();
}

function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function save() { return writeFile(output, JSON.stringify(evidence, null, 2) + '\n'); }
function append(ledger, streamId, turnId, at) {
  return ledger.appendEvent({
    streamId, kind: 'response.started', at,
    payload: JSON.stringify({ actorId: 'synthetic-actor', agentProfileVersion: 'profile', kind: 'response.started', threadId: 'fixture-thread', turnId })
  });
}
function instrument(pool) {
  const connect = pool.connect.bind(pool);
  const clients = new Set();
  pool.connect = async () => {
    const start = performance.now();
    const client = await connect();
    const row = scope.getStore();
    if (row) {
      row.poolAcquireMs += performance.now() - start;
      row.peakWaiting = Math.max(row.peakWaiting, pool.waitingCount);
    }
    if (!clients.has(client)) {
      clients.add(client);
      const query = client.query.bind(client);
      client.query = async (...args) => {
        const current = scope.getStore();
        const begin = performance.now();
        const readBefore = client.connection.stream.bytesRead;
        try {
          const result = await query(...args);
          if (current && typeof args[0] === 'string') {
            if (args[0].startsWith('SELECT snapshot FROM')) {
              current.snapshotReads++;
              current.snapshotQueryMs += performance.now() - begin;
              current.snapshotQueryReadBytes += client.connection.stream.bytesRead - readBefore;
            }
            if (args[0].includes('SET snapshot=')) {
              current.snapshotWrites++;
              current.snapshotBindBytes += Buffer.byteLength(args[1][1]);
            }
          }
          return result;
        } finally {
          if (current) { current.sqlCalls++; current.sqlMs += performance.now() - begin; }
        }
      };
    }
    return client;
  };
  return {
    pool,
    wire() {
      let read = 0, written = 0;
      for (const client of clients) {
        read += client.connection.stream.bytesRead;
        written += client.connection.stream.bytesWritten;
      }
      return { read, written };
    }
  };
}
async function measure({ name, run, clients, connections, targetBytes, snapshotBytes, historicStreams, stateNodeLimit, openMs, monitor }) {
  const rows = [];
  let next = 0;
  const before = monitor.wire();
  const start = performance.now();
  let done = false;
  const wait = { samples: 0, backendSamples: 0, lockedBackendSamples: 0, peakLocked: 0, peakPoolTotal: 0, peakPoolWaiters: 0 };
  const sampler = (async () => {
    while (!done) {
      const { rows: [state] } = await observer.query("SELECT count(*)::int AS backends, count(*) FILTER (WHERE wait_event_type='Lock')::int AS locks FROM pg_stat_activity WHERE datname=current_database() AND application_name='vict-hosted-runtime'");
      wait.samples++;
      wait.backendSamples += state.backends;
      wait.lockedBackendSamples += state.locks;
      wait.peakLocked = Math.max(wait.peakLocked, state.locks);
      wait.peakPoolTotal = Math.max(wait.peakPoolTotal, monitor.pool.totalCount);
      wait.peakPoolWaiters = Math.max(wait.peakPoolWaiters, monitor.pool.waitingCount);
      await delay(10);
    }
  })();
  try {
    await Promise.all(Array.from({ length: clients }, async () => {
      while (true) {
        const i = next++;
        if (i >= samples) break;
        const row = { i, poolAcquireMs: 0, peakWaiting: 0, sqlCalls: 0, sqlMs: 0, snapshotReads: 0, snapshotWrites: 0, snapshotQueryMs: 0, snapshotQueryReadBytes: 0, snapshotBindBytes: 0 };
        const begin = performance.now();
        try {
          row.result = await scope.run(row, () => run(i));
        } catch (error) {
          row.failure = { name: error.name, code: error.code ?? 'UNCLASSIFIED' };
        }
        row.totalMs = performance.now() - begin;
        rows.push(row);
      }
    }));
  } finally {
    done = true;
    await sampler;
  }
  const elapsedMs = performance.now() - start;
  const after = monitor.wire();
  const good = rows.filter(row => !row.failure);
  const pct = key => {
    const values = good.map(row => row[key]).sort((a,b) => a-b);
    return Object.fromEntries([50,95,99].map(p => ['p' + p, values[Math.ceil(values.length * p / 100) - 1] ?? null]));
  };
  return {
    name, clients, connections, targetBytes, snapshotBytes, historicStreams, stateNodeLimit, openMs, elapsedMs,
    goodputPerSecond: good.length * 1000 / elapsedMs, wait,
    wire: { readBytes: after.read - before.read, writtenBytes: after.written - before.written },
    latencyMs: pct('totalMs'), poolAcquireMs: pct('poolAcquireMs'), snapshotQueryMs: pct('snapshotQueryMs'),
    failures: rows.filter(row => row.failure).map(({i,failure}) => ({i,...failure})),
    samples: rows.sort((a,b) => a.i-b.i)
  };
}
async function validateLockFailure(store, namespace) {
  await observer.query('BEGIN');
  try {
    await observer.query('SELECT snapshot FROM ' + schema + '.operational WHERE namespace=$1 FOR UPDATE', [namespace]);
    const start = performance.now();
    let refusal;
    try { await store.turns.getTurn('hot-turn'); } catch (error) { refusal = error.code; }
    assert.equal(refusal, 'HOSTED_DATABASE_UNAVAILABLE');
    evidence.correctness.push({ namespace, check: 'held row lock timeout', code: refusal, elapsedMs: performance.now() - start });
  } finally {
    await observer.query('ROLLBACK');
  }
  assert.equal((await store.turns.getTurn('hot-turn')).status, 'running');
}
