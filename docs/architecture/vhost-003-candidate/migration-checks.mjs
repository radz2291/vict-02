import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedLegacy, request, commandName, runKeys } from './migration-fixture.mjs';
import { captureLegacy, prepareImport, stageImport, verifyStaged, captureRecovery, rehearseWriter } from './operator-migration.mjs';
import { canonical, digest } from './migration-map.mjs';
import { hash, keyBytes } from './values.mjs';

const indexed = 'vhost003_indexed';
const sourceDb = 'vhost011_source';
const restoreDb = 'vhost011_restore';
const full = 'vhost011-full';
const empty = 'vhost011-empty';
const clean = 'vhost011-null';
const missing = 'vhost011-missing';
const race = 'vhost011-capture-race';
const sql = (table) => indexed + '.' + table;
const archiveSchemas = ['vhost011_product', 'vhost011_memory'];

function connect(oracle, port, database, user = 'vhostbench') {
  return new oracle.Client({ connectionString: 'postgresql://' + user + '@127.0.0.1:' + port + '/' + database, ssl: false });
}

function tools(context) {
  const { pgBin, port, output } = context;
  assert(typeof pgBin === 'string');
  function run(program, database, args) {
    const start = performance.now();
    const connection = 'postgresql://vhostbench@127.0.0.1:' + port + '/' + database + '?sslmode=disable';
    const diagnostics = execFileSync(join(pgBin, program), ['--no-password', '--dbname=' + connection, ...args],
      { encoding: 'utf8', windowsHide: true, timeout: 45_000 });
    return { ms: Number((performance.now() - start).toFixed(2)), diagnostics };
  }
  return {
    async backup(name, database, schemas) {
      const file = join(output, name);
      const result = run('pg_dump.exe', database, ['--format=custom', '--no-owner', '--no-acl',
        '--file=' + file, ...schemas.map((schema) => '--schema=' + schema)]);
      const bytes = await readFile(file);
      return { ...result, file, bytes: bytes.length, sha256: digest(bytes) };
    },
    restore(backup, database) {
      return run('pg_restore.exe', database, ['--exit-on-error', '--single-transaction', '--no-owner', '--no-acl', backup.file]);
    }
  };
}

async function copyIdentity(observer, source, port) {
  await observer.query('CREATE ROLE vhost011_reader LOGIN');
  await observer.query('GRANT EXECUTE ON FUNCTION pg_control_system() TO vhost011_reader');
  await source.query('CREATE SCHEMA vhost011_identity');
  await source.query('CREATE TABLE vhost011_identity.source (singleton boolean PRIMARY KEY CHECK (singleton),' +
    'source_id text NOT NULL,epoch bigint NOT NULL,marker text NOT NULL)');
  await source.query("INSERT INTO vhost011_identity.source VALUES(true,'owned-synthetic-vhost011',7,'synthetic-backup-boundary-v1')");
  await source.query('GRANT USAGE ON SCHEMA vhost011_identity,vhost003_indexed TO vhost011_reader');
  await source.query('GRANT SELECT ON ALL TABLES IN SCHEMA vhost011_identity,vhost003_indexed TO vhost011_reader');
  const { rows: [host] } = await observer.query(
    "SELECT system_identifier::text AS cluster,current_setting('server_version') AS version,inet_server_port() AS port FROM pg_control_system()"
  );
  assert.equal(host.port, port);
  return { cluster: host.cluster, database: sourceDb, epoch: '7', marker: 'synthetic-backup-boundary-v1',
    serverVersion: host.version, sourceId: 'owned-synthetic-vhost011' };
}

function comparePorts(store, rec) {
  return Promise.all([
    store.actors.list(), store.turns.listTurns(), store.turns.listCancelIntents('cancel-only'),
    store.streamLedger.latestSeq('stream'), store.streamLedger.latestSeq('transient'), store.streamLedger.listEventsFrom('stream', 0),
    store.invocations.getInvocationByIdempotencyKey('request'), store.approvals.listApprovalsForInvocation('invocation'),
    store.commandIdempotency.getReceipt(commandName), store.commandConfirmationReceipts.getReceipt('confirm'),
    store.control.listChangeSets(), store.control.listChangeSetApprovals('change'), store.control.getControlRun('control-run'),
    store.control.listOperationReceipts('change'), store.control.listReleaseSelections('app'), store.control.listAuditEvents({}),
    store.catalog.list(), store.catalog.getSelected('z-graph'), store.execution.listRuns(), store.execution.listEvents(runKeys[0]),
    store.orchestration.listOrchestrationRuns(), store.orchestration.getOrchestrationSnapshot(runKeys[0]),
    store.orchestration.listSignalReceipts(runKeys[0]), store.orchestration.findRecoverableClaims({ now: 22 }),
    store.orchestration.getOrchestrationRun('archive-only'), store.orchestration.listOrchestrationEvents(runKeys[0]),
    store.governance.getAgentActivation(rec.agentActivation), store.governance.listOpenDeletionIntents(),
    store.orchestration.getOrchestrationSnapshot('fork-run')
  ]);
}

async function operationalProof(context, prepared, store, records, target) {
  const { oracle, observer, candidate } = context;
  await assert.rejects(candidate(full, { writerEpoch: 7 }), { code: 'HOSTED_SCHEMA_MISMATCH' });
  const inspection = await candidate(full, { writerEpoch: 7, stageInspection: true, maxConnections: 2 });
  try {
    const expected = await comparePorts(store, records);
    const observed = await comparePorts(inspection, records);
    assert.deepEqual(observed, expected);
    assert.equal(observed[3], 4);
    assert.equal(observed[4], 1);
    assert.deepEqual(observed[5].map(({ seq }) => seq), [1, 3]);
    assert.equal(observed[24], undefined);
    target.publicComparisons = { count: observed.length, expected, observed };
    const upstreamEffect = await store.coordination.getEffect('held', 'synthetic-actor', 'uncertain-op');
    const { rows: [stagedEffect] } = await observer.query(
      'SELECT effect_id AS "effectId",argument_digest AS "argumentDigest",' +
      'status,fence::int,(extract(epoch FROM updated_at)*1000)::bigint::text AS "updatedAt" FROM ' +
      sql('effects') + " WHERE namespace=$1 AND scope_id='held' AND effect_id='uncertain-op'", [full]
    );
    assert.deepEqual({ ...stagedEffect, updatedAt: Number(stagedEffect.updatedAt) }, upstreamEffect);
    await assert.rejects(inspection.coordination.getEffect('held', 'synthetic-actor', 'uncertain-op'),
      { code: 'HOSTED_DATABASE_UNAVAILABLE' });
    target.uncertainEffect = { expected: upstreamEffect, staged: stagedEffect, lockTakingReadRefused: true };
    const commandFences = await observer.query('SELECT encode(fence_digest,\'hex\') AS digest FROM ' +
      sql('command_claim_fence') + ' WHERE namespace=$1', [full]);
    const exists = (value) => commandFences.rows.some(({ digest }) => digest === hash(keyBytes(value)).toString('hex'));
    assert(exists(records.activeCommand));
    assert(!exists(records.retiredFence));
    target.commandFenceEvidence = { activeCaptured: true, retiredAbsent: true, stagedCanServe: false };

    await assert.rejects(inspection.actors.upsert({ actorId: 'refused', status: 'active', roles: [], createdAt: 1 }),
      { code: 'HOSTED_DATABASE_UNAVAILABLE' });
    await assert.rejects(inspection.coordination.acquire(request('held')), { code: 'HOSTED_DATABASE_UNAVAILABLE' });
    await assert.rejects(rehearseWriter(observer, prepared), { code: 'VHOST_IMPORT_RECONCILIATION_HOLD' });
    target.hold = { readOnlyWriteRefused: true, acquisitionRefused: true, admissionRefused: true };

    const memory = await oracle.createPostgresMastraStore({
      schemaName: 'vhost011_memory', memoryProfile: 'native-thread-recoverable',
      migration: 'verify', coordination: inspection.coordination, leaseMs: 4000
    });
    await memory.close();
    const { rows: [marker] } = await observer.query(
      'SELECT operational_schema,operational_namespace FROM vhost011_memory.vict_mastra_schema'
    );
    assert.deepEqual(marker, { operational_schema: indexed, operational_namespace: full });
    target.c12Binding = marker;
  } finally {
    await inspection.close();
  }
}

async function externalFingerprint(client) {
  const { rows } = await client.query("SELECT table_schema,table_name FROM information_schema.tables " +
    "WHERE table_schema=ANY($1::text[]) AND table_type='BASE TABLE' ORDER BY table_schema,table_name", [archiveSchemas]);
  const checks = {};
  for (const { table_schema, table_name } of rows) {
    assert(archiveSchemas.includes(table_schema) && /^[a-z0-9_]+$/u.test(table_name));
    const { rows: values } = await client.query('SELECT to_jsonb(record)::text AS record FROM ' +
      table_schema + '.' + table_name + ' AS record');
    const name = table_schema + '.' + table_name;
    checks[name] = { count: values.length, sha256: digest(canonical(values.map(({ record }) => record).sort())) };
  }
  return checks;
}

async function runOperatorCLI(context, identity, prepared) {
  const { dataDir, port, consumer, sourceRepo, output } = context;
  const paths = { consumer, sourceRepo, capture: join(output, 'cli.capture.json'), manifest: join(output, 'cli.manifest.json') };
  const config = join(output, 'cli.config.json');
  await writeFile(config, canonical({ connectionPort: port, dataDirectory: dataDir, namespace: missing,
    identity, approvedManifestSHA256: prepared.manifestDigest, paths }));
  const script = new URL('./migrate-local.mjs', import.meta.url);
  const invoke = (action) => execFileSync(process.execPath, [fileURLToPath(script), action, config],
    { encoding: 'utf8', windowsHide: true, timeout: 45_000, env: { ...process.env, NODE_NO_WARNINGS: '1' } }).trim();
  invoke('capture');
  assert.equal(invoke('plan'), prepared.manifestDigest);
  assert.equal(JSON.parse(invoke('stage')).status, 'verified-existing');
  assert.deepEqual(JSON.parse(invoke('verify')), prepared.manifest.tables);
  return { phases: ['capture', 'plan', 'stage', 'verify'], matchedManifest: prepared.manifestDigest, status: 'verified-existing' };
}

export async function checkMigration(context) {
  const { oracle, observer, candidate, evidence, save, port, output } = context;
  const migration = {};
  evidence.migration = migration;
  await observer.query('CREATE DATABASE ' + sourceDb);
  await observer.query('CREATE DATABASE ' + restoreDb);
  const source = connect(oracle, port, sourceDb);
  const sourceReader = connect(oracle, port, sourceDb, 'vhost011_reader');
  const recovered = connect(oracle, port, restoreDb);
  const sourceStores = [];
  const backup = tools(context);
  await source.connect();
  let sourceReaderConnected = false;
  let recoveredConnected = false;
  const open = async (namespace) => {
    const store = await oracle.createPostgresStores({
      connectionString: 'postgresql://vhostbench@127.0.0.1:' + port + '/' + sourceDb,
      schema: indexed, namespace, migrate: true, tls: 'disable-loopback-only'
    });
    sourceStores.push(store);
    return store;
  };
  try {
    const fixture = await open(full);
    const records = await seedLegacy(oracle, source, fixture);
    const cleanStore = await open(clean);
    const oldLease = (await cleanStore.coordination.acquire(request('epoch-scope'))).lease;
    await cleanStore.coordination.beginEffect(oldLease, 'known', 'digest');
    await cleanStore.coordination.settleEffect(oldLease, 'known', 'digest', 'applied');
    const tombstone = await cleanStore.coordination.tombstone(request('sticky'));
    await cleanStore.coordination.release(tombstone);
    await open(empty);
    await open(race);
    const { rows: [fullSource] } = await source.query('SELECT snapshot FROM ' + sql('operational') + ' WHERE namespace=$1', [full]);
    const emptyOuter = { ...fullSource.snapshot, actors: [] };
    // Preserve the Runtime component grammar when constructing a truly
    // empty envelope. The separate null case retains SQL NULL and rev 0.
    emptyOuter.snapshots = Object.fromEntries(Object.entries(emptyOuter.snapshots).map(([name, envelope]) => {
      const [tag, pairs] = JSON.parse(envelope.payload);
      assert.equal(tag, 'object');
      const collections = Object.fromEntries(pairs.map(([key, value]) => [key, value[0] === 'map' ? new Map() : []]));
      return [name, oracle.snapshot.captureRuntimeStoreSnapshot(envelope.kind, collections)];
    }));
    await source.query('UPDATE ' + sql('operational') + ' SET snapshot=$2::jsonb WHERE namespace=$1',
      [empty, JSON.stringify(emptyOuter)]);

    const memory = await oracle.createPostgresMastraStore({ schemaName: 'vhost011_memory',
      memoryProfile: 'native-thread-recoverable', leaseMs: 4000, coordination: fixture.coordination, migration: 'apply' });
    try {
      await memory.store.withNativeMemory('fixture-thread', 'synthetic-actor', async () => {
        await memory.store.nativeMemoryJournal({ operation: 'claim', operationId: 'known-memory',
          requestDigest: 'request', sourceDigest: 'source' });
        const complete = await memory.store.nativeMemoryJournal({ operation: 'complete', operationId: 'known-memory',
          result: { synthetic: true } });
        assert.equal(complete.status, 'completed');
      });
    } finally {
      await memory.close();
    }
    await source.query("CREATE SCHEMA vhost011_product; CREATE TABLE vhost011_product.watermark (marker text PRIMARY KEY); " +
      "INSERT INTO vhost011_product.watermark VALUES('synthetic-before-import')");

    const identity = await copyIdentity(observer, source, port);
    migration.identity = identity;
    await sourceReader.connect();
    sourceReaderConnected = true;
    await assert.rejects(sourceReader.query('UPDATE ' + sql('operational') + ' SET revision=revision+1 WHERE false'), { code: '42501' });
    await assert.rejects(captureLegacy(source, identity, full), { code: 'VHOST_IMPORT_FIXTURE_ONLY' });
    await assert.rejects(captureLegacy(sourceReader, { ...identity, epoch: '8' }, full), { code: 'VHOST_IMPORT_SOURCE_IDENTITY' });
    const beforeRace = await captureLegacy(sourceReader, identity, race, async () => {
      await source.query('BEGIN');
      try {
        await source.query('UPDATE ' + sql('operational') + ' SET revision=revision+1 WHERE namespace=$1', [race]);
        await source.query('INSERT INTO ' + sql('coordination') +
          " (namespace,scope_id,actor_id,purpose) VALUES($1,'after','synthetic-actor','work')", [race]);
        await source.query('COMMIT');
      } catch (error) {
        await source.query('ROLLBACK');
        throw error;
      }
    });
    const afterRace = await captureLegacy(sourceReader, identity, race);
    assert.deepEqual([beforeRace.revision, beforeRace.coordination.length, afterRace.revision, afterRace.coordination.length],
      ['0', 0, '1', 1]);
    migration.consistentCapture = { before: beforeRace, after: afterRace, sourceRoleUpdateRefused: true };
    await save();

    const captures = {};
    const prepared = {};
    for (const namespace of [full, empty, clean, missing]) {
      captures[namespace] = await captureLegacy(sourceReader, identity, namespace);
      prepared[namespace] = await prepareImport(oracle, captures[namespace], identity, namespace);
      const repeat = await prepareImport(oracle, await captureLegacy(sourceReader, identity, namespace), identity, namespace);
      assert.equal(repeat.manifestDigest, prepared[namespace].manifestDigest);
      await writeFile(join(output, namespace + '.capture.json'), canonical(captures[namespace]) + '\n');
      await writeFile(join(output, namespace + '.manifest.json'), prepared[namespace].manifestText + '\n');
    }
    assert.notEqual(captures[empty].snapshotText, null);
    assert.equal(captures[clean].snapshotText, null);
    assert.equal(captures[missing].present, false);
    migration.manifests = Object.fromEntries(Object.entries(prepared).map(([ns, p]) => [ns, p.manifestDigest]));
    await save();
    const populated = prepared[full];
    const bad = JSON.parse(captures[full].snapshotText);
    bad.snapshots.vict.sha256 = '0'.repeat(64);
    await assert.rejects(prepareImport(oracle, { ...captures[full], snapshotText: JSON.stringify(bad) }, identity, full),
      { code: 'VHOST_IMPORT_INVALID_ENVELOPE' });
    const inconsistent = JSON.parse(captures[full].snapshotText);
    const slots = { invocations: new Map(), byKey: new Map(), turnSlots: new Map(), turnSlotMax: new Map() };
    oracle.snapshot.restoreRuntimeStoreSnapshot(inconsistent.snapshots.invocations, 'InMemoryAgentToolInvocationStore@1', slots);
    slots.byKey.clear();
    inconsistent.snapshots.invocations = oracle.snapshot.captureRuntimeStoreSnapshot('InMemoryAgentToolInvocationStore@1', slots);
    await assert.rejects(prepareImport(oracle, { ...captures[full], snapshotText: JSON.stringify(inconsistent) }, identity, full),
      { code: 'VHOST_IMPORT_INVALID_STATE' });
    await assert.rejects(prepareImport(oracle, { ...captures[full], namespace: 'vhost011-wrong' }, identity, full),
      { code: 'VHOST_IMPORT_SOURCE_IDENTITY' });
    await assert.rejects(stageImport(observer, populated, '0'.repeat(64)), { code: 'VHOST_IMPORT_MANIFEST_IDENTITY' });
    await assert.rejects(stageImport(observer, populated, populated.manifestDigest, 'control_release'), { code: 'VHOST_IMPORT_INTERRUPTED' });
    const interrupted = await captureRecovery(observer, full);
    assert.equal(interrupted.admission, undefined);
    assert(Object.values(interrupted.tables).every(({ count }) => count === 0));
    migration.refusals = { invalidDigest: true, contradictoryIndex: true, identityMismatch: true,
      manifestMismatch: true, interrupted, stageRetry: {} };
    for (const [ns, p] of Object.entries(prepared)) {
      const first = await stageImport(observer, p, p.manifestDigest);
      const retry = await stageImport(observer, p, p.manifestDigest);
      assert.equal(first.status, 'staged');
      assert.equal(retry.status, 'verified-existing');
      assert.deepEqual(first.tables, retry.tables);
      migration.refusals.stageRetry[ns] = { first: first.status, retry: retry.status, tables: first.tables };
    }
    const next = await prepareImport(oracle, { ...captures[full], revision: String(Number(captures[full].revision) + 1) }, identity, full);
    await assert.rejects(stageImport(observer, next, next.manifestDigest), { code: 'VHOST_IMPORT_CONFLICT' });
    await observer.query('UPDATE ' + sql('stream_clock') + ' SET seq=seq+1 WHERE namespace=$1', [full]);
    try {
      await assert.rejects(stageImport(observer, populated, populated.manifestDigest), { code: 'VHOST_IMPORT_READBACK_MISMATCH' });
    } finally {
      await observer.query('UPDATE ' + sql('stream_clock') + ' SET seq=seq-1 WHERE namespace=$1', [full]);
    }
    assert.deepEqual(await verifyStaged(observer, populated), populated.manifest.tables);
    migration.refusals.conflictingManifest = true;
    migration.refusals.tamperedRetry = true;
    await save();

    migration.cli = await runOperatorCLI(context, identity, prepared[missing]);
    const external = await backup.backup('source-product-memory.dump', sourceDb, archiveSchemas);
    migration.sourceBackup = { sha256: external.sha256, bytes: external.bytes, ms: external.ms,
      restore: backup.restore(external, 'postgres') };
    migration.externalParity = await externalFingerprint(source);
    assert.deepEqual(await externalFingerprint(observer), migration.externalParity);
    await operationalProof(context, populated, fixture, records, migration);

    // Pre-write rollback comparison: target has no writer and the frozen
    // source and its holds still match the import manifest.
    const frozen = await captureLegacy(sourceReader, identity, full);
    assert.equal(digest(canonical(frozen)), populated.manifest.captureSHA256);
    const preWrite = await captureRecovery(observer, full);
    assert.deepEqual(preWrite.admission, { epoch: '7', active: 0 });
    migration.preWriteRollback = { sourceDigest: digest(canonical(frozen)), admission: preWrite.admission,
      heldRecords: populated.manifest.unresolved, legacyWriteReactivation: 'not rehearsed' };

    const newEpoch = await rehearseWriter(observer, prepared[clean]);
    assert.equal(newEpoch, '8');
    await assert.rejects(candidate(clean, { writerEpoch: 7 }), { code: 'HOSTED_FENCED' });
    await assert.rejects(stageImport(observer, prepared[clean], prepared[clean].manifestDigest), { code: 'VHOST_IMPORT_TARGET_ADMITTED' });
    const writer = await candidate(clean, { writerEpoch: 8 });
    try {
      await assert.rejects(writer.forLease(oldLease).actors.get('synthetic-actor'), { code: 'HOSTED_FENCED' });
      const current = (await writer.coordination.acquire(request('epoch-scope', 'new-synthetic-owner'))).lease;
      assert(current.fence > oldLease.fence);
      assert.equal((await writer.coordination.acquire(request('sticky'))).status, 'deleted');
      assert.equal((await writer.coordination.getEffect('epoch-scope','synthetic-actor','known')).fence, oldLease.fence);
      await writer.forLease(current).actors.upsert({ actorId: 'post-import', roles: ['viewer'], status: 'active', createdAt: 2 });
      migration.authority = { previousEpoch: '7', newEpoch, oldFence: oldLease.fence, newFence: current.fence, sticky: true,
        admittedClaim: current.scopeId, indexedOnlyActor: await writer.actors.get('post-import') };
    } finally {
      await writer.close();
    }
    assert.equal(await cleanStore.actors.get('post-import'), undefined);
    const postWrite = await captureRecovery(observer, clean);
    assert.notDeepEqual(postWrite.tables.actors, prepared[clean].manifest.tables.actors);
    await save();

    const point = await backup.backup('indexed-recovery-point.dump', 'postgres', [indexed, ...archiveSchemas]);
    const restore = backup.restore(point, restoreDb);
    await recovered.connect();
    recoveredConnected = true;
    const actual = await captureRecovery(recovered, clean);
    assert.deepEqual(actual, postWrite);
    assert.deepEqual(await verifyStaged(recovered, populated), populated.manifest.tables);
    assert.deepEqual(await captureRecovery(recovered, full), preWrite);
    for (const namespace of [empty, missing]) {
      assert.deepEqual(await verifyStaged(recovered, prepared[namespace]), prepared[namespace].manifest.tables);
    }
    assert.deepEqual(await externalFingerprint(recovered), migration.externalParity);
    const { rows: targetMarkers } = await observer.query('SELECT * FROM vhost011_memory.vict_mastra_schema');
    const { rows: restoredMarkers } = await recovered.query('SELECT * FROM vhost011_memory.vict_mastra_schema');
    assert.deepEqual(restoredMarkers, targetMarkers);
    const { rows: products } = await recovered.query('SELECT * FROM vhost011_product.watermark');
    assert.deepEqual(products, [{ marker: 'synthetic-before-import' }]);
    const { rows: fences } = await recovered.query('SELECT scope_id,fence::text,deleted,owner_id FROM ' +
      sql('coordination') + ' WHERE namespace=$1 ORDER BY scope_id', [clean]);
    assert.deepEqual(fences.map(({ fence }) => fence), [String(migration.authority.newFence), String(tombstone.fence + 1)]);
    migration.postWriteRecovery = { point: { bytes: point.bytes, sha256: point.sha256, ms: point.ms }, restore,
      recovered: actual, heldTarget: preWrite, fences, restoredMarkers, products,
      legacyReactivation: 'refused: indexed-only commit verified' };
    await save();
  } finally {
    await Promise.all([...sourceStores.map((store) => store.close()), source.end(),
      ...(sourceReaderConnected ? [sourceReader.end()] : []), ...(recoveredConnected ? [recovered.end()] : [])]);
  }
}
