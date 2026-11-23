import { assertMigration as check, canonical, clockColumns, digest, mapCapture, references, tables } from './migration-map.mjs';

const schema = 'vhost003_indexed.';
const namespacePattern = /^vhost011-[a-z0-9-]{1,40}$/u;
const identityKeys = ['cluster', 'database', 'epoch', 'marker', 'serverVersion', 'sourceId'];
const localVerification = async (client, role, allowedDatabase) => {
  const { rows: [server] } = await client.query(
    "SELECT current_database() AS database,current_user AS role,inet_server_addr()::text AS address," +
      "current_setting('ssl') AS ssl,current_setting('server_version') AS version"
  );
  check(server.role === role && server.address === '127.0.0.1/32' && server.ssl === 'off' &&
    allowedDatabase.includes(server.database), 'VHOST_IMPORT_FIXTURE_ONLY');
  return server;
};

async function transaction(client, begin, work) {
  await client.query(begin);
  try {
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    const result = await work();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

// The operator supplies a separately reviewed synthetic source identity.
export async function captureLegacy(client, expected, namespace, afterIdentity) {
  check(namespacePattern.test(namespace), 'VHOST_IMPORT_INVALID_NAMESPACE');
  return transaction(client, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', async () => {
    const server = await localVerification(client, 'vhost011_reader', ['vhost011_source']);
    const { rows: [identity] } = await client.query(
      'SELECT source_id AS "sourceId",epoch::text,marker,(SELECT system_identifier::text FROM pg_control_system()) AS cluster ' +
      'FROM vhost011_identity.source WHERE singleton'
    );
    const actual = { ...identity, database: server.database, serverVersion: server.version };
    check(canonical(actual) === canonical(expected) && Object.keys(actual).length === identityKeys.length &&
      /^[1-9]\d*$/u.test(actual.epoch), 'VHOST_IMPORT_SOURCE_IDENTITY');
    const { rows: [metadata] } = await client.query('SELECT version FROM ' + schema + 'metadata WHERE singleton');
    check(metadata?.version === 1, 'VHOST_IMPORT_SOURCE_VERSION');
    if (afterIdentity) await afterIdentity();
    const { rows: [row] } = await client.query(
      'SELECT revision::text,snapshot::text AS snapshot FROM ' + schema + 'operational WHERE namespace=$1', [namespace]
    );
    const { rows: coordination } = await client.query(
      'SELECT scope_id,actor_id,owner_id,fence::text,expires_at::text,purpose,deleted FROM ' +
      schema + 'coordination WHERE namespace=$1 ORDER BY scope_id COLLATE "C"', [namespace]
    );
    const { rows: effects } = await client.query(
      'SELECT scope_id,effect_id,argument_digest,status,fence::text,updated_at::text FROM ' +
      schema + 'effects WHERE namespace=$1 ORDER BY scope_id COLLATE "C",effect_id COLLATE "C"', [namespace]
    );
    return { format: 'vict.vhost011-capture@1', identity: actual, version: metadata.version,
      schema: 'vhost003_indexed', namespace, present: row !== undefined, revision: row?.revision ?? null,
      snapshotText: row?.snapshot ?? null, coordination, effects };
  });
}

function framed(rows) {
  return rows.map((row) => canonical(Object.fromEntries(Object.entries(row).map(([column, item]) =>
    [column, Buffer.isBuffer(item) ? { bytes: item.toString('hex') } : item])))).sort();
}

function summarize(rows) {
  return Object.fromEntries(Object.entries(rows).map(([table, records]) => {
    const exact = framed(records);
    return [table, { count: exact.length, sha256: digest(canonical(exact)) }];
  }));
}

function planned(rows) {
  return Object.fromEntries(Object.entries(rows).map(([table, entries]) =>
    [table, entries.map((entry, i) => {
      const row = { ...entry };
      if (tables[table]) row[tables[table]] = String(i + 1);
      for (const field of Object.keys(references[table] ?? {})) row[field] = String(row[field]);
      return row;
    })]));
}

export async function prepareImport(oracle, capture, expected, namespace) {
  check(namespacePattern.test(namespace) && capture.namespace === namespace && capture.schema === 'vhost003_indexed' &&
    capture.version === 1 && capture.format === 'vict.vhost011-capture@1' &&
    canonical(capture.identity) === canonical(expected) && /^[1-9]\d*$/u.test(expected.epoch),
  'VHOST_IMPORT_SOURCE_IDENTITY');
  check(typeof capture.present === 'boolean' && (capture.present ? /^\d+$/u.test(capture.revision) :
    capture.revision === null && capture.snapshotText === null) &&
    (capture.snapshotText === null || typeof capture.snapshotText === 'string' &&
      Buffer.byteLength(capture.snapshotText) <= 32 * 1024 * 1024) &&
    Array.isArray(capture.coordination) && Array.isArray(capture.effects), 'VHOST_IMPORT_INVALID_STATE');
  for (const [field, fields] of [
    ['coordination', ['scope_id','actor_id','owner_id','fence','expires_at','purpose','deleted']],
    ['effects', ['scope_id','effect_id','argument_digest','status','fence','updated_at']]
  ]) {
    for (const row of capture[field]) {
      check(canonical(Object.keys(row).sort()) === canonical(fields.sort()), 'VHOST_IMPORT_INVALID_STATE');
    }
  }
  let mapping;
  try {
    mapping = await mapCapture(oracle, capture);
  } catch (error) {
    if (error.code?.startsWith('VHOST_IMPORT_')) throw error;
    check(false, 'VHOST_IMPORT_INVALID_STATE');
  }
  const { frameworkCommit, c12Source, consumerCommit, lockSHA256, archives } = oracle.provenance;
  const manifest = {
    pins: { frameworkCommit, c12Source, consumerCommit, lockSHA256, legacyArchiveSHA256: archives['store-postgres'].sha256 },
    format: 'vict.vhost011-manifest@1', codec: 'vhost003-indexed-record@1',
    baseline: '01648f8af820aed5893d38ca99ae86527d62883d', namespace, sourceSchema: capture.schema,
    source: capture.identity, sourceVersion: capture.version, sourcePresent: capture.present,
    sourceRevision: capture.revision, sourceEnvelopeSHA256: capture.snapshotText === null ? null : digest(capture.snapshotText),
    captureSHA256: digest(canonical(capture)), components: mapping.componentDigests,
    counters: mapping.counters, compatibility: mapping.compatibility, unresolved: mapping.unresolved,
    tables: summarize(planned(mapping.rows))
  };
  const manifestText = canonical(manifest);
  return { manifest, manifestText, manifestDigest: digest(manifestText), plan: mapping.rows };
}

export async function readBack(client, namespace) {
  check(namespacePattern.test(namespace), 'VHOST_IMPORT_INVALID_NAMESPACE');
  const aliases = {};
  const normalized = {};
  for (const [table, ordinal] of Object.entries(tables)) {
    const clocks = (clockColumns[table] ?? []).map((column) => ',' + column + '::text AS ' + column + '_text').join('');
    const { rows } = await client.query('SELECT *' + clocks + ' FROM ' + schema + table + ' WHERE namespace=$1' +
      (ordinal ? ' ORDER BY ' + ordinal : ''), [namespace]);
    aliases[table] = new Map();
    normalized[table] = rows.map((row, i) => {
      delete row.namespace;
      if (ordinal) {
        aliases[table].set(row[ordinal], String(i + 1));
        row[ordinal] = String(i + 1);
      }
      for (const [column, relation] of Object.entries(references[table] ?? {})) {
        const ordinal = aliases[relation].get(row[column]);
        check(ordinal !== undefined, 'VHOST_IMPORT_BROKEN_TARGET_REFERENCE');
        row[column] = ordinal;
      }
      for (const column of clockColumns[table] ?? []) {
        row[column] = row[column + '_text'];
        delete row[column + '_text'];
      }
      return row;
    });
  }
  return summarize(normalized);
}

async function verifyRows(client, prepared) {
  const { manifest } = prepared;
  const actual = await readBack(client, manifest.namespace);
  for (const [table, expected] of Object.entries(manifest.tables)) {
    if (canonical(actual[table]) !== canonical(expected)) {
      const error = Object.assign(new Error('VHOST_IMPORT_READBACK_MISMATCH: ' + table), {
        code: 'VHOST_IMPORT_READBACK_MISMATCH', table, expected, actual: actual[table]
      });
      throw error;
    }
  }
  return actual;
}

async function checkTarget(client) {
  await localVerification(client, 'vhostbench', ['postgres', 'vhost011_restore']);
  const { rows: [row] } = await client.query('SELECT version,purpose FROM ' + schema + 'metadata WHERE singleton');
  check(row?.version === 4 && row.purpose === 'VHOST-007 disposable indexed governance fixture',
    'VHOST_IMPORT_TARGET_VERSION');
}

export async function stageImport(client, prepared, approvedDigest, interruptedAt) {
  check(approvedDigest === prepared.manifestDigest && digest(prepared.manifestText) === approvedDigest &&
    canonical(prepared.manifest) === prepared.manifestText, 'VHOST_IMPORT_MANIFEST_IDENTITY');
  check(canonical(Object.keys(prepared.plan)) === canonical(Object.keys(tables)) &&
    canonical(summarize(planned(prepared.plan))) === canonical(prepared.manifest.tables),
  'VHOST_IMPORT_PLAN_IDENTITY');
  const { namespace, source } = prepared.manifest;
  return transaction(client, 'BEGIN', async () => {
    await checkTarget(client);
    // This scope also serializes waiting retries after a failed or committed import.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['vhost011-import:' + namespace]);
    const { rows: [previous] } = await client.query('SELECT manifest_digest,manifest_text FROM ' +
      schema + 'migration_import WHERE namespace=$1', [namespace]);
    if (previous) {
      check(previous.manifest_digest === approvedDigest && previous.manifest_text === prepared.manifestText,
        'VHOST_IMPORT_CONFLICT');
      const { rows: [target] } = await client.query('SELECT writer_epoch::text AS epoch,(SELECT count(*)::int FROM ' +
        schema + 'callback_admission WHERE namespace=$1) AS active FROM ' + schema + 'namespaces WHERE namespace=$1', [namespace]);
      check(target?.epoch === source.epoch && target.active === 0, 'VHOST_IMPORT_TARGET_ADMITTED');
      return { status: 'verified-existing', tables: await verifyRows(client, prepared) };
    }

    const { rowCount } = await client.query('SELECT 1 FROM ' + schema + 'namespaces WHERE namespace=$1', [namespace]);
    check(rowCount === 0, 'VHOST_IMPORT_UNEXPECTED_TARGET');
    for (const table of ['coordination','effects']) {
      const { rowCount } = await client.query('SELECT 1 FROM ' + schema + table + ' WHERE namespace=$1', [namespace]);
      check(rowCount === 0, 'VHOST_IMPORT_UNEXPECTED_TARGET');
    }
    await client.query('INSERT INTO ' + schema + 'namespaces VALUES($1,$2)', [namespace, source.epoch]);
    const aliases = {};
    for (const [table, records] of Object.entries(prepared.plan)) {
      aliases[table] = [];
      const ordinal = tables[table];
      for (const record of records) {
        const columns = Object.keys(record);
        const values = columns.map((name) => {
          const dependent = references[table]?.[name];
          if (!dependent) return record[name];
          const resolved = aliases[dependent][record[name] - 1];
          check(resolved !== undefined, 'VHOST_IMPORT_BROKEN_PLAN_REFERENCE');
          return resolved;
        });
        const { rows } = await client.query('INSERT INTO ' + schema + table +
          ' (namespace,' + columns.join(',') + ') VALUES (' + [namespace, ...values].map((_, i) => '$' + (i + 1)).join(',') +
          ')' + (ordinal ? ' RETURNING ' + ordinal : ''), [namespace, ...values]);
        if (ordinal) aliases[table].push(rows[0][ordinal]);
      }
      if (table === interruptedAt) check(false, 'VHOST_IMPORT_INTERRUPTED');
    }
    const read = await verifyRows(client, prepared);
    await client.query('INSERT INTO ' + schema + 'migration_import VALUES ($1,$2,$3)',
      [namespace, approvedDigest, prepared.manifestText]);
    return { status: 'staged', tables: read };
  });
}

export async function verifyStaged(client, prepared) {
  return transaction(client, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', async () => {
    await checkTarget(client);
    const { manifest, manifestDigest, manifestText } = prepared;
    const { rows: [row] } = await client.query(
      'SELECT manifest_digest,manifest_text,writer_epoch::text AS epoch,(SELECT count(*)::int FROM ' +
      schema + 'callback_admission WHERE namespace=$1) AS active FROM ' + schema + 'migration_import JOIN ' +
      schema + 'namespaces USING(namespace) WHERE namespace=$1', [manifest.namespace]
    );
    check(row?.manifest_digest === manifestDigest && row.manifest_text === manifestText &&
      row.active === 0 && row.epoch === manifest.source.epoch, 'VHOST_IMPORT_UNVERIFIED_TARGET');
    return verifyRows(client, prepared);
  });
}

export async function captureRecovery(client, namespace) {
  return transaction(client, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', async () => {
    await checkTarget(client);
    const { rows: [admission] } = await client.query(
      'SELECT writer_epoch::text AS epoch,(SELECT count(*)::int FROM ' + schema +
      'callback_admission WHERE namespace=$1) AS active FROM ' + schema + 'namespaces WHERE namespace=$1', [namespace]
    );
    const { rows: [imported] } = await client.query('SELECT manifest_digest FROM ' + schema +
      'migration_import WHERE namespace=$1', [namespace]);
    return { admission, importDigest: imported?.manifest_digest, tables: await readBack(client, namespace) };
  });
}

// Rehearsal only: a hold-free empty synthetic source can test a new writer.
// A populated namespace remains staged, including one whose retired fences
// cannot be traced by the legacy format.
export async function rehearseWriter(client, prepared) {
  return transaction(client, 'BEGIN', async () => {
    await checkTarget(client);
    const { manifest, manifestDigest } = prepared;
    check(manifest.sourcePresent && manifest.sourceRevision === '0' && manifest.sourceEnvelopeSHA256 === null &&
      manifest.unresolved.length === 0 &&
      !manifest.compatibility.includes('retired-command-fences-not-reconstructible'),
    'VHOST_IMPORT_RECONCILIATION_HOLD');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['vhost011-import:' + manifest.namespace]);
    const { rows: [row] } = await client.query(
      'SELECT writer_epoch::text AS epoch,manifest_digest FROM ' + schema + 'namespaces JOIN ' +
      schema + 'migration_import USING(namespace) WHERE namespace=$1 FOR UPDATE OF namespaces', [manifest.namespace]
    );
    check(row?.epoch === manifest.source.epoch && row.manifest_digest === manifestDigest, 'VHOST_IMPORT_TARGET_ADMITTED');
    await verifyRows(client, prepared);
    const { rows: [retired] } = await client.query('UPDATE ' + schema +
      'namespaces SET writer_epoch=writer_epoch+1 WHERE namespace=$1 RETURNING writer_epoch::text AS epoch',
    [manifest.namespace]);
    await client.query('INSERT INTO ' + schema + 'callback_admission VALUES($1)', [manifest.namespace]);
    return retired.epoch;
  });
}
