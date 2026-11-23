import { fromKey, hash, keyBytes } from './values.mjs';

const prefix = (bytes) => bytes.subarray(0, 256);
const bytesOrder = 'key_prefix,key_bytes';
const approvalKey = (record) => record.changesetId + '\0' + record.approverActorId;
const receiptKey = (record) => record.changesetId + '\0' + record.operationIndex;

export function createControlPorts({ runtime, serialization, codec, namespace, q, call, readPages }) {
  const { encode, decode, captureRuntimeStoreSnapshot: snapshot } = codec;
  const { InMemoryControlPlaneStore, InMemoryAgentGovernanceStore, VictControlError } = runtime;
  const value = (row) => row && decode(row.payload);
  const immutableValue = (row) => row && serialization.immutableSnapshot(value(row));

  function keyParts(key) {
    const bytes = keyBytes(key);
    return [hash(bytes), bytes];
  }

  // Lock before reading to serialize first insert and replay. Combined
  // mutations acquire the union in actual advisory ID order, including
  // collisions. Append serialization follows the entity lock phase.
  async function lock(client, ...keys) {
    const ids = keys.map(([table, key]) => hash(Buffer.concat([
      Buffer.from(namespace + '\0' + table + '\0'), keyBytes(key)
    ])).subarray(0, 8).toString('hex'));
    for (const id of [...new Set(ids)].sort()) {
      const bytes = Buffer.from(id, 'hex');
      await client.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)',
        [bytes.readInt32BE(0), bytes.readInt32BE(4)]);
    }
  }

  // Take at most one append lock, after the entity locks and before the
  // identity sequence is used. The bigint advisory keyspace is disjoint from
  // the two-integer entity keyspace, even if their hashes collide.
  async function lockAppend(client, table, subject = null) {
    const key = hash(keyBytes(JSON.stringify([namespace, table, subject]))).readBigInt64BE(0);
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [key.toString()]);
  }

  async function find(client, table, key) {
    if (typeof key !== 'string') return undefined;
    const { rows: [row] } = await client.query(
      'SELECT id,payload FROM ' + q(table) + ' WHERE namespace=$1 AND key_digest=$2 AND key_bytes=$3',
      [namespace, ...keyParts(key)]
    );
    return row;
  }

  async function persist(client, table, key, row, record, indexed = {}) {
    const payload = encode(record);
    if (row) {
      if (payload.equals(row.payload)) return row.id;
      const assignments = Object.keys(indexed).map((column, i) => column + '=$' + (i + 4));
      await client.query(
        'UPDATE ' + q(table) + ' SET ' + ['payload=$3', ...assignments].join(',') + ' WHERE namespace=$1 AND id=$2',
        [namespace, row.id, payload, ...Object.values(indexed)]
      );
      return row.id;
    }
    // Approval lists are ChangeSet-scoped. The unfiltered audit and
    // catalog lists need one order across their whole namespace.
    if (table === 'control_approval') {
      await lockAppend(client, table, record.changesetId);
    } else if (table === 'control_audit' || table === 'catalog_activation') {
      await lockAppend(client, table);
    }
    const columns = ['namespace', 'key_digest', 'key_bytes', 'payload', ...Object.keys(indexed)];
    const bindings = [namespace, ...keyParts(key), payload, ...Object.values(indexed)];
    const { rows: [inserted] } = await client.query(
      'INSERT INTO ' + q(table) + ' (' + columns.join(',') + ') VALUES (' +
        bindings.map((_, i) => '$' + (i + 1)).join(',') + ') RETURNING id', bindings
    );
    return inserted.id;
  }

  function identityColumns(column, key) {
    const [digest, bytes] = keyParts(key);
    return { [column + '_digest']: digest, [column + '_key']: bytes };
  }

  function point(table, project = value) {
    return call(async (client, key) => project(await find(client, table, key)));
  }

  function list(table, order, { predicate = '', bindings = () => [], project = value } = {}) {
    return call((client, input) => {
      const keys = bindings(input);
      if (keys.some((key) => typeof key !== 'string')) return [];
      return readPages(client, 'SELECT payload FROM ' + q(table) + ' WHERE namespace=$1 ' +
        predicate + ' ORDER BY ' + order, [namespace, ...keys.flatMap(keyParts)], project);
    });
  }

  function controlEngine(collection, entries) {
    const collections = {
      changesets: new Map(), approvals: new Map(), approvalsByChangeset: new Map(),
      releases: new Map(), selections: new Map(), audit: [], controlRuns: new Map(),
      operationReceipts: new Map()
    };
    collections[collection] = entries;
    return new InMemoryControlPlaneStore(snapshot('InMemoryControlPlaneStore@1', collections));
  }

  // Runtime applies the public transition to the one indexed subject row.
  // Read the resulting snapshot entry for methods whose public result is void
  // or whose return differs from the stored record.
  function controlChange({ table, collection, method, keyOf, columns = () => ({}), wrapped = false }) {
    return call(async (client, ...args) => {
      const key = keyOf(args[0]);
      if (typeof key === 'string') await lock(client, [table, key]);
      const row = await find(client, table, key);
      const prior = value(row);
      const store = controlEngine(collection, new Map(row ? [[key, wrapped ? { record: prior } : prior]] : []));
      const result = await store[method](...args);
      // These mutations already expose their resulting record through the
      // read methods. Approval/intent/run writers preserve first evidence.
      let next;
      if (collection === 'changesets') next = await store.getChangeSet(key);
      else if (collection === 'controlRuns') next = await store.getControlRun(key);
      else if (collection === 'approvals') next = prior ?? (await store.listChangeSetApprovals(args[0].changesetId))[0];
      else if (method === 'markOperationApplied') next = result;
      else next = prior ?? args[0];

      // The control engine's canonical records use JSON cloning. For the
      // receipt writers with no returned record apply that same normalization.
      if (next !== undefined) {
        const stored = JSON.parse(JSON.stringify(next));
        await persist(client, table, key, row, stored, columns(stored));
      }
      return result;
    });
  }

  const changeSet = (method, keyOf) => controlChange({
    table: 'control_changeset', collection: 'changesets', method, keyOf,
    columns: (record) => ({ key_prefix: prefix(keyBytes(record.changesetId)) }), wrapped: true
  });
  const operationColumns = (record) => ({
    ...identityColumns('subject', record.changesetId), operation_index: record.operationIndex ?? 0
  });
  const changeOperation = (method) => controlChange({
    table: 'control_operation', collection: 'operationReceipts', method, keyOf: receiptKey,
    columns: operationColumns
  });

  async function publishRelease(client, release) {
    const key = release.releaseVersion;
    const row = await find(client, 'control_release', key);
    const engine = controlEngine('releases', new Map(row ? [[key, value(row)]] : []));
    await engine.publishRelease(release);
    if (!row) await persist(client, 'control_release', key, row, await engine.getRelease(key), {
      ...identityColumns('subject', release.applicationId), key_prefix: prefix(keyBytes(key))
    });
  }

  const subjectPredicate = 'subject_digest=$2 AND subject_key=$3';

  async function selectRelease(client, command) {
    const { applicationId, releaseVersion, operationId, reason, expectedBaseVersion } = command;
    const target = await find(client, 'control_release', releaseVersion);
    const release = value(target);
    if (release === undefined || release.applicationId !== applicationId) {
      throw new VictControlError('VICT_CONTROL_RELEASE_MISSING', 'The release version does not exist for this application.');
    }
    if (operationId !== undefined) {
      const prior = value(await find(client, 'control_selection', JSON.stringify([applicationId, operationId, reason])));
      if (prior) {
        if (prior.releaseVersion !== releaseVersion) {
          throw new VictControlError('VICT_CONTROL_OPERATION_IDENTITY_CONFLICT',
            'The operation identity already applied a different release; conflicting content fails closed.');
        }
        return { selectionRevision: prior.selectionRevision };
      }
    }
    const { rows: [head] } = await client.query(
      'SELECT revision,target_key FROM ' + q('control_selection') + ' WHERE namespace=$1 AND ' +
        subjectPredicate + ' ORDER BY revision DESC LIMIT 1', [namespace, ...keyParts(applicationId)]
    );
    if (expectedBaseVersion !== undefined) {
      const expected = expectedBaseVersion === runtime.CHANGESET_BASE_NONE ? undefined : expectedBaseVersion;
      const current = head ? fromKey(head.target_key) : undefined;
      if (current !== expected) {
        throw new VictControlError('VICT_CONTROL_BASE_STALE',
          'The subject base changed before the selection was applied; exactly one concurrent ChangeSet may win the base.');
      }
    }
    const selectionRevision = Number(head?.revision ?? 0) + 1;
    const key = operationId === undefined ?
      JSON.stringify([applicationId, selectionRevision]) : JSON.stringify([applicationId, operationId, reason]);
    const record = { ...JSON.parse(JSON.stringify(command)), selectionRevision };
    await persist(client, 'control_selection', key, undefined, record, {
      ...identityColumns('subject', applicationId), target: target.id,
      target_key: keyBytes(releaseVersion), revision: selectionRevision
    });
    return { selectionRevision };
  }

  function selected(headTable, targetTable, lookup, { order = '', project = value } = {}) {
    return call(async (client, id) => {
      if (typeof id !== 'string') return undefined;
      const { rows: [row] } = await client.query(
        'SELECT target.payload FROM (SELECT namespace,target FROM ' + q(headTable) +
          ' WHERE namespace=$1 AND ' + lookup + ' ' + order + ' LIMIT 1) AS head JOIN ' + q(targetTable) +
          ' AS target ON target.namespace=head.namespace AND target.id=head.target',
        [namespace, ...keyParts(id)]
      );
      return project(row);
    });
  }

  const control = Object.freeze({
    saveChangeSet: changeSet('saveChangeSet', (record) => record.changesetId),
    getChangeSet: point('control_changeset'),
    listChangeSets: list('control_changeset', bytesOrder),
    updateChangeSet: changeSet('updateChangeSet', (id) => id),
    reviseChangeSetContent: changeSet('reviseChangeSetContent', (id) => id),
    recordChangeSetApproval: controlChange({
      table: 'control_approval', collection: 'approvals', method: 'recordChangeSetApproval',
      keyOf: approvalKey, columns: (record) => identityColumns('subject', record.changesetId)
    }),
    listChangeSetApprovals: list('control_approval', 'id', { predicate: 'AND ' + subjectPredicate, bindings: (id) => [id] }),
    recordControlRun: controlChange({
      table: 'control_run', collection: 'controlRuns', method: 'recordControlRun', keyOf: (record) => record.runId
    }),
    getControlRun: point('control_run'),
    recordOperationIntent: changeOperation('recordOperationIntent'),
    markOperationApplied: changeOperation('markOperationApplied'),
    recordOperationReceipt: changeOperation('recordOperationReceipt'),
    listOperationReceipts: list('control_operation', 'operation_index,id', { predicate: 'AND ' + subjectPredicate, bindings: (id) => [id] }),
    compareAndSetChangeSetStatus: changeSet('compareAndSetChangeSetStatus', (command) => command.changesetId),
    publishRelease: call(async (client, release) => {
      await lock(client, ['control_release', release.releaseVersion]);
      await publishRelease(client, release);
    }),
    applyReleaseOperation: call(async (client, { release, selection, receipt }) => {
      const key = receiptKey(receipt);
      await lock(client, ['control_operation', key], ['control_release', release.releaseVersion],
        ['control_selection', selection.applicationId]);
      const row = await find(client, 'control_operation', key);
      const intent = value(row);
      if (intent && intent.operationDigest !== receipt.operationDigest) {
        throw new VictControlError('VICT_CONTROL_OPERATION_IDENTITY_CONFLICT',
          'The prepared operation intent carries different content; conflicting content fails closed.');
      }
      await publishRelease(client, release);
      const result = await selectRelease(client, selection);
      const store = controlEngine('operationReceipts', new Map(row ? [[key, intent]] : []));
      const next = await store.markOperationApplied({
        changesetId: receipt.changesetId, operationIndex: receipt.operationIndex, at: receipt.appliedAt
      });
      await persist(client, 'control_operation', key, row, next, operationColumns(next));
      return result;
    }),
    getRelease: point('control_release'),
    listReleases: list('control_release', bytesOrder, { predicate: 'AND ' + subjectPredicate, bindings: (id) => [id] }),
    selectRelease: call(async (client, command) => {
      await lock(client, ['control_selection', command.applicationId]);
      return selectRelease(client, command);
    }),
    getSelectedRelease: selected('control_selection', 'control_release', subjectPredicate, { order: 'ORDER BY revision DESC' }),
    listReleaseSelections: list('control_selection', 'revision', { predicate: 'AND ' + subjectPredicate, bindings: (id) => [id] }),
    appendAuditEvent: call(async (client, event) => {
      await lock(client, ['control_audit', event.auditId]);
      if (await find(client, 'control_audit', event.auditId)) return;
      const record = JSON.parse(JSON.stringify(event));
      await persist(client, 'control_audit', event.auditId, undefined, record, {
        ...identityColumns('subject', record.subjectId), ...identityColumns('kind', record.subjectType)
      });
    }),
    listAuditEvents: call((client, subject) => {
      const params = [namespace];
      const filters = [];
      for (const [column, field] of [['kind', 'subjectType'], ['subject', 'subjectId']]) {
        if (subject[field] === undefined) continue;
        if (typeof subject[field] !== 'string') return [];
        const first = params.length + 1;
        params.push(...keyParts(subject[field]));
        filters.push(' AND ' + column + '_digest=$' + first + ' AND ' + column + '_key=$' + (first + 1));
      }
      return readPages(client, 'SELECT payload FROM ' + q('control_audit') + ' WHERE namespace=$1' +
        filters.join('') + ' ORDER BY id', params, value);
    })
  });

  function changeCatalog(method, keysOf) {
    return call(async (client, command) => {
      const { version, graph } = keysOf(command);
      const keys = [['catalog_activation', version]];
      if (graph !== undefined) keys.push(['catalog_selection', graph]);
      // Invalid manifest/command validation stays with Runtime.
      await lock(client, ...keys.filter(([, key]) => typeof key === 'string'));
      const activation = await find(client, 'catalog_activation', version);
      const selection = await find(client, 'catalog_selection', graph);
      const current = value(selection);
      const store = runtime.createInMemoryStores({ snapshot: snapshot('vict-stores@1', {
        activations: new Map(activation ? [[version, value(activation)]] : []),
        selections: new Map(selection ? [[graph, current]] : []),
        runs: new Map(), orchestrationSnapshots: new Map()
      }) }).catalog;
      const result = await store[method](command);
      const nextActivation = await store.get(version);
      const target = activation?.id ?? (nextActivation && await persist(client, 'catalog_activation', version, activation, nextActivation));
      const next = await store.getSelection(graph);
      if (next && next.selectionRevision !== current?.selectionRevision) {
        await persist(client, 'catalog_selection', graph, selection, next, { target });
      }
      return result;
    });
  }

  const catalog = Object.freeze({
    publish: changeCatalog('publish', (command) => ({ version: command?.manifest?.activationVersion })),
    get: point('catalog_activation', immutableValue),
    list: list('catalog_activation', 'id', { project: immutableValue }),
    select: changeCatalog('select', (command) => ({ version: command.activationVersion, graph: command.graphId })),
    getSelection: point('catalog_selection', immutableValue),
    getSelected: selected('catalog_selection', 'catalog_activation', 'key_digest=$2 AND key_bytes=$3',
      { project: immutableValue }),
    publishAndSelect: changeCatalog('publishAndSelect', (command) => ({
      version: command.publish?.manifest?.activationVersion, graph: command.select?.graphId
    }))
  });

  // This single statement supplies an MVCC-consistent intent and receipt
  // view, including on reads concurrent with a receipt/state transition.
  const intentProjection = 'SELECT intent.id,intent.payload,ARRAY(SELECT receipt.payload FROM ' +
    q('governance_receipt') + ' AS receipt WHERE receipt.namespace=intent.namespace ' +
    'AND receipt.intent=intent.id ORDER BY receipt.step) AS receipts FROM ' + q('governance_intent') +
    ' AS intent WHERE intent.namespace=$1';
  const deletionValue = (row) => row && { ...value(row), receipts: row.receipts.map(decode) };

  async function findIntent(client, id) {
    if (typeof id !== 'string') return undefined;
    const { rows: [row] } = await client.query(
      intentProjection + ' AND intent.key_digest=$2 AND intent.key_bytes=$3', [namespace, ...keyParts(id)]
    );
    return row;
  }

  function changeDeletion(method, keyOf) {
    return call(async (client, ...args) => {
      const id = keyOf(args[0]);
      if (typeof id === 'string') await lock(client, ['governance_intent', id]);
      const row = await findIntent(client, id);
      const prior = deletionValue(row);
      const store = new InMemoryAgentGovernanceStore(snapshot('agent-governance@1', {
        activations: new Map(), intents: new Map(row ? [[id, prior]] : [])
      }));
      await store[method](...args);
      const next = await store.getDeletionIntent(id);
      const intent = await persist(client, 'governance_intent', id, row, { ...next, receipts: [] }, {
        key_prefix: prefix(keyBytes(id)), open: next.state !== 'completed'
      });
      // Closed step domain bounds the number of rows by two per intent.
      for (const receipt of next.receipts) {
        if (prior?.receipts.some((entry) => entry.step === receipt.step)) continue;
        await client.query('INSERT INTO ' + q('governance_receipt') + ' VALUES($1,$2,$3,$4)',
          [namespace, intent, receipt.step, encode(receipt)]);
      }
    });
  }

  const governance = Object.freeze({
    saveAgentActivation: call(async (client, record) => {
      const id = record?.activationVersion;
      if (typeof id === 'string') await lock(client, ['governance_activation', id]);
      const row = await find(client, 'governance_activation', id);
      const store = new InMemoryAgentGovernanceStore(snapshot('agent-governance@1', {
        activations: new Map(row ? [[id, value(row)]] : []), intents: new Map()
      }));
      await store.saveAgentActivation(record);
      if (!row) await persist(client, 'governance_activation', id, row, await store.getAgentActivation(id));
    }),
    getAgentActivation: point('governance_activation'),
    recordDeletionIntent: changeDeletion('recordDeletionIntent', (record) => record.intentId),
    getDeletionIntent: call(async (client, id) => deletionValue(await findIntent(client, id))),
    listOpenDeletionIntents: call((client) =>
      readPages(client, intentProjection + ' AND open ORDER BY ' + bytesOrder, [namespace], deletionValue)),
    listDeletionIntents: call((client) =>
      readPages(client, intentProjection + ' ORDER BY ' + bytesOrder, [namespace], deletionValue)),
    recordDeletionReceipt: changeDeletion('recordDeletionReceipt', (id) => id),
    updateDeletionIntentState: changeDeletion('updateDeletionIntentState', (id) => id)
  });

  return { control, catalog, governance };
}
