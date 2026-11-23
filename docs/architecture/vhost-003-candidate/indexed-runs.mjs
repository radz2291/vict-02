import { hash, keyBytes } from './values.mjs';

const componentKinds = [
  'tokens', 'attempts', 'waits', 'branchResults', 'branchOutputs',
  'signalReceipts', 'cancellationRequests', 'resolutionRequests'
];
const identity = (value) => {
  const bytes = keyBytes(value);
  return [hash(bytes), bytes];
};

export function createRunPorts({ runtime, snapshot, serialization, codec, namespace, q, call, readPages, options }) {
  const { encode, decode } = codec;
  const { immutableSnapshot } = serialization;
  const { captureRuntimeStoreSnapshot: capture, restoreRuntimeStoreSnapshot: restore } = snapshot;
  const executionKind = 'vict-stores@1';
  const orchestrationKind = 'orchestration@1';

  // A family-wide batch excludes its point mutations. Creation also takes
  // exclusive admission so same-timestamp ties use durable publication order.
  // A point acquires shared admission before its exact run-key bucket lock.
  async function admission(client, family, mode, runId) {
    const batch = hash(keyBytes(JSON.stringify([namespace, 'run-batch', family]))).readBigInt64BE(0);
    const lock = mode === 'batch' ? 'pg_advisory_xact_lock' : 'pg_advisory_xact_lock_shared';
    await client.query('SELECT ' + lock + '($1::bigint)', [batch.toString()]);
    if (mode === 'batch' || typeof runId !== 'string') return;
    const point = hash(keyBytes(JSON.stringify([namespace, family, runId])));
    await client.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)',
      [point.readInt32BE(0), point.readInt32BE(4)]);
  }

  async function point(client, table, key) {
    if (typeof key !== 'string') return undefined;
    const { rows: [row] } = await client.query(
      ('SELECT id,payload' + (table === 'catalog_activation' ? '' : ',next_seq') + ' FROM ') + q(table) + ' WHERE namespace=$1 AND key_digest=$2 AND key_bytes=$3',
      [namespace, ...identity(key)]
    );
    return row;
  }

  const getRun = (family) => call(async (client, key) => {
    const row = await point(client, family + '_run', key);
    return row && immutableSnapshot(decode(row.payload));
  });

  function listRuns(family) {
    return call((client, query = {}) => {
      const { limit, graphId, activationVersion, status } = query;
      if (family === 'execution' && limit !== undefined && !Number.isFinite(limit)) {
        throw new runtime.HostedCoordinationError('HOSTED_INVALID_INPUT');
      }
      const size = limit === undefined ? Infinity : Math.max(0, Math.floor(limit)) || 0;
      const bindings = [namespace];
      let where = ' WHERE namespace=$1';
      for (const [column, value] of [['graph', graphId], ['activation', activationVersion]]) {
        if (value === undefined) continue;
        if (typeof value !== 'string') return [];
        const parameter = bindings.length + 1;
        where += ' AND ' + column + '_digest=$' + parameter + ' AND ' + column + '_key=$' + (parameter + 1);
        bindings.push(...identity(value));
      }
      if (status !== undefined) {
        const common = ['running', 'completed', 'failed', 'blocked'];
        const statuses = family === 'execution' ? common : [...common, 'waiting', 'cancelled'];
        if (!statuses.includes(status)) return [];
        bindings.push(status);
        where += ' AND status=$' + bindings.length;
      }
      return readPages(client, 'SELECT payload FROM ' + q(family + '_run') + where + ' ORDER BY created_at,id',
        bindings, ({ payload }) => immutableSnapshot(decode(payload)), size);
    });
  }

  async function putRun(client, family, before, next, nextSeq, catalogId) {
    const table = q(family + '_run');
    const payload = encode(next);
    if (before) {
      if (!before.payload.equals(payload) || Number(before.next_seq) !== nextSeq) {
        await client.query('UPDATE ' + table + ' SET payload=$3,next_seq=$4,status=$5 WHERE namespace=$1 AND id=$2',
          [namespace, before.id, payload, nextSeq, next.status]);
      }
      return before.id;
    }
    const execution = family === 'execution';
    const { rows: [{ id }] } = await client.query(
      'INSERT INTO ' + table + ' (namespace,key_digest,key_bytes,graph_digest,graph_key,activation_digest,' +
        'activation_key,created_at,status,next_seq,payload' + (execution ? ',activation_row' : '') + ') ' +
        'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11' + (execution ? ',$12' : '') + ') RETURNING id',
      [namespace, ...identity(next.runId), ...identity(next.graphId), ...identity(next.activationVersion),
        next.createdAt, next.status, nextSeq, payload, ...(execution ? [catalogId] : [])]
    );
    return id;
  }

  async function putEvents(client, family, run, events) {
    for (const event of events) {
      await client.query('INSERT INTO ' + q(family + '_event') + ' (namespace,run,seq,payload) VALUES($1,$2,$3,$4)',
        [namespace, run, event.seq, encode(event)]);
    }
  }

  function listEvents(family, operation) {
    return call(async (client, runId, after = -1) => {
      await admission(client, family, 'point', runId);
      const head = await point(client, family + '_run', runId);
      if (!head) throw new runtime.VictStoreError('VICT_STORE_RUN_NOT_FOUND', 'Run not found.', { operation, runId });
      const cutoff = family === 'execution' ? Number(after) : -1;
      if (Number.isNaN(cutoff) || cutoff >= Number.MAX_SAFE_INTEGER) return [];
      return readPages(client, 'SELECT payload FROM ' + q(family + '_event') +
        ' WHERE namespace=$1 AND run=$2 AND seq>$3 ORDER BY seq',
      [namespace, head.id, Math.max(-1, Math.floor(cutoff))], ({ payload }) => immutableSnapshot(decode(payload)));
    });
  }

  function executionStore(runs, activation) {
    return runtime.createInMemoryStores({ snapshot: capture(executionKind, {
      activations: new Map(activation ? [[activation.activationVersion, activation]] : []),
      selections: new Map(), runs, orchestrationSnapshots: new Map()
    }), faults: options.faults });
  }

  async function executionState(client, head) {
    const { rows } = await client.query(
      'SELECT seq FROM ' + q('execution_event') + ' WHERE namespace=$1 AND run=$2 ORDER BY seq', [namespace, head.id]
    );
    // The pinned validator consumes only historical sequence numbers. Keep
    // historical payloads in SQL and send only new events to the writer.
    return { run: decode(head.payload), events: rows.map(({ seq }) => ({ seq: Number(seq) })) };
  }

  function executionChange(method) {
    return call(async (client, command) => {
      const creating = method === 'createRun';
      await admission(client, 'execution', creating ? 'batch' : 'point', command.runId);
      const head = await point(client, 'execution_run', command.runId);
      const catalog = creating ? await point(client, 'catalog_activation', command.activationVersion) : undefined;
      const previous = head ? await executionState(client, head) : undefined;
      const runs = new Map(previous ? [[command.runId, previous]] : []);
      const engine = executionStore(runs, catalog && decode(catalog.payload));
      const result = await engine.execution[method](command);
      restore(engine.exportSnapshot(), executionKind, {
        activations: new Map(), selections: new Map(), runs, orchestrationSnapshots: new Map()
      });
      const next = runs.get(command.runId);
      const row = await putRun(client, 'execution', head, next.run, next.events.length, catalog?.id);
      await putEvents(client, 'execution', row, next.events.slice(previous?.events.length ?? 0));
      return result;
    });
  }

  const execution = Object.freeze({
    createRun: executionChange('createRun'),
    commitTransition: executionChange('commitTransition'),
    getRun: getRun('execution'),
    listRuns: listRuns('execution'),
    listEvents: listEvents('execution', 'execution.listEvents'),
    recoverInterruptedRuns: call(async (client, command) => {
      await admission(client, 'execution', 'batch');
      const { rows } = await client.query(
        "SELECT id,payload,next_seq FROM " + q('execution_run') + " WHERE namespace=$1 AND status='running' ORDER BY id",
        [namespace]
      );
      const states = [];
      for (const head of rows) states.push(await executionState(client, head));
      const runs = new Map(states.map((state) => [state.run.runId, state]));
      const engine = executionStore(runs);
      const result = await engine.execution.recoverInterruptedRuns(command);
      restore(engine.exportSnapshot(), executionKind, {
        activations: new Map(), selections: new Map(), runs, orchestrationSnapshots: new Map()
      });
      for (let i = 0; i < rows.length; i++) {
        const head = rows[i];
        const next = runs.get(states[i].run.runId);
        await putRun(client, 'execution', head, next.run, next.events.length);
        await putEvents(client, 'execution', head.id, next.events.slice(states[i].events.length));
      }
      return result;
    })
  });

  function orchestrationStore(runs) {
    return runtime.createInMemoryOrchestrationStore({
      snapshot: capture(orchestrationKind, { runs }), faults: options.orchestrationFaults
    });
  }

  function partition(head) {
    return {
      run: decode(head.payload), tokens: new Map(), attempts: new Map(), waits: new Map(), timers: new Map(),
      branchResults: [], branchOutputs: new Map(), signalReceipts: new Map(), cancellationRequests: new Map(),
      resolutionRequests: new Map(),
      // Pinned orchestration transitions use only the tail sequence. The
      // public event port always reads the exact persisted event rows.
      events: Number(head.next_seq) ? [{ seq: Number(head.next_seq) - 1 }] : []
    };
  }

  async function byRun(client, table, run) {
    const { rows } = await client.query('SELECT * FROM ' + q(table) + ' WHERE namespace=$1 AND run=$2 ORDER BY ordinal',
      [namespace, run]);
    return rows;
  }

  async function orchestrationState(client, head) {
    const state = partition(head);
    const components = await byRun(client, 'orchestration_component', head.id);
    const timers = await byRun(client, 'orchestration_timer', head.id);
    const recovery = await byRun(client, 'orchestration_recoverable', head.id);
    for (const { kind, payload } of components) {
      const entry = decode(payload);
      if (kind === 'branchResults') state.branchResults.push(entry);
      else state[kind].set(...entry);
    }
    for (const { payload } of timers) state.timers.set(...decode(payload));
    return { state, components, timers, recovery };
  }

  // A transition operates on its complete subject, with independent rows
  // for each Runtime collection. Persist only changed ordinal slots.
  async function syncRows(client, table, run, before, entries, kind) {
    const sameKind = kind === undefined ? before : before.filter((row) => row.kind === kind);
    const old = new Map(sameKind.map((row) => [Number(row.ordinal), row.payload]));
    const key = ['namespace', 'run', 'ordinal', ...(kind === undefined ? [] : ['kind'])];
    for (const [ordinal, entry] of entries.entries()) {
      const { value, columns = {} } = entry;
      const payload = encode(value);
      if (!old.get(ordinal)?.equals(payload)) {
        const values = [namespace, run, ordinal, ...(kind === undefined ? [] : [kind]), payload, ...Object.values(columns)];
        const fields = [...key, 'payload', ...Object.keys(columns)];
        await client.query('INSERT INTO ' + q(table) + ' (' + fields.join(',') + ') VALUES (' +
          values.map((_, index) => '$' + (index + 1)).join(',') + ') ON CONFLICT (' + key.join(',') +
          ') DO UPDATE SET ' + fields.slice(key.length).map((column) => column + '=excluded.' + column).join(','), values);
      }
      old.delete(ordinal);
    }
    for (const ordinal of old.keys()) {
      const args = [namespace, run, ordinal, ...(kind === undefined ? [] : [kind])];
      await client.query('DELETE FROM ' + q(table) + ' WHERE ' +
        key.map((column, i) => column + '=$' + (i + 1)).join(' AND '), args);
    }
  }

  const timerColumns = (entry) => ({
    timer_key: keyBytes(entry[0]), status: entry[1].status, due_at: entry[1].dueAt, lease_expires_at: entry[1].leaseExpiresAt
  });

  async function persistOrchestration(client, head, before, next, recoverable) {
    const nextSeq = (next.events.at(-1)?.seq ?? -1) + 1;
    const id = await putRun(client, 'orchestration', head, next.run, nextSeq);
    for (const kind of componentKinds) {
      await syncRows(client, 'orchestration_component', id, before?.components ?? [],
        Array.from(next[kind], (value) => ({ value })), kind);
    }
    await syncRows(client, 'orchestration_timer', id, before?.timers ?? [],
      Array.from(next.timers, (value) => ({ value, columns: timerColumns(value) })));
    await syncRows(client, 'orchestration_recoverable', id, before?.recovery ?? [],
      recoverable.map((value) => ({ value, columns: { expires_at: value.leaseExpiresAt } })));
    await putEvents(client, 'orchestration', id, next.events.slice(before?.state.events.length ?? 0));
  }

  function updateOrchestration(method, mode = 'point') {
    return call(async (client, command, planner) => {
      await admission(client, 'orchestration', mode, command.runId);
      const head = await point(client, 'orchestration_run', command.runId);
      const prior = head ? await orchestrationState(client, head) : undefined;
      const runs = new Map(prior ? [[command.runId, prior.state]] : []);
      const engine = orchestrationStore(runs);
      const result = await engine[method](planner ? { ...command, planner: planner() } : command);
      restore(engine.exportSnapshot(), orchestrationKind, { runs });
      const next = runs.get(command.runId);
      if (next) await persistOrchestration(client, head, prior, next, await engine.findRecoverableClaims({}));
      return result;
    });
  }

  const claim = updateOrchestration('claimReadyToken');

  function readOrchestration(method, kind) {
    return call(async (client, runId) => {
      await admission(client, 'orchestration', 'point', runId);
      const head = await point(client, 'orchestration_run', runId);
      const runs = new Map();
      if (head) {
        if (!kind) {
          runs.set(runId, (await orchestrationState(client, head)).state);
        } else {
          const state = partition(head);
          const { rows } = await client.query('SELECT payload FROM ' + q('orchestration_component') +
            ' WHERE namespace=$1 AND run=$2 AND kind=$3 ORDER BY ordinal', [namespace, head.id, kind]);
          for (const { payload } of rows) state[kind].set(...decode(payload));
          runs.set(runId, state);
        }
      }
      return orchestrationStore(runs)[method](runId);
    });
  }

  const claimDueTimers = call(async (client, command) => {
    const { runId, now, limit, ownerId, leaseExpiresAt } = command;
    await admission(client, 'orchestration', runId === undefined ? 'batch' : 'point', runId);
    const head = runId === undefined ? undefined : await point(client, 'orchestration_run', runId);
    if (runId !== undefined && !head) return orchestrationStore(new Map()).claimDueTimers(command);
    if (Number.isNaN(now)) return { timers: [] };
    const values = [namespace, now];
    let sql = 'SELECT run,ordinal,payload FROM ' + q('orchestration_timer') + ' WHERE namespace=$1 ' +
      "AND ((status='scheduled' AND due_at <= $2) OR (status='firing' AND lease_expires_at <= $2))";
    if (head) {
      values.push(head.id);
      sql += ' AND run=$' + values.length;
    }
    sql += ' ORDER BY due_at,timer_key,run,ordinal';
    const count = Math.ceil(Math.max(1, limit));
    if (Number.isSafeInteger(count)) {
      values.push(count);
      sql += ' LIMIT $' + values.length;
    }
    const { rows } = await client.query(sql, values);
    const timers = [];
    for (const row of rows) {
      const [id, current] = decode(row.payload);
      const timer = { ...current, status: 'firing', ownerId, leaseExpiresAt, revision: current.revision + 1 };
      await client.query('UPDATE ' + q('orchestration_timer') +
        " SET status='firing',lease_expires_at=$4,payload=$5 WHERE namespace=$1 AND run=$2 AND ordinal=$3",
      [namespace, row.run, row.ordinal, leaseExpiresAt, encode([id, timer])]);
      const { timerId, runId, kind, waitId, attemptId, tokenId, dueAt, revision } = timer;
      timers.push(immutableSnapshot({ timerId, runId, kind, waitId, attemptId, tokenId, dueAt, revision }));
    }
    return { timers };
  });

  const orchestration = Object.freeze({
    createOrchestrationRun: updateOrchestration('createOrchestrationRun', 'batch'),
    getOrchestrationRun: getRun('orchestration'),
    listOrchestrationRuns: listRuns('orchestration'),
    getOrchestrationSnapshot: readOrchestration('getOrchestrationSnapshot'),
    async claimReadyToken(command) {
      let data;
      let planner;
      try {
        const { planner: supplied, ...rest } = command;
        data = codec.captureArguments([rest])[0];
        planner = Object.freeze({
          invocationIdFor: supplied.invocationIdFor.bind(supplied),
          attemptIdFor: supplied.attemptIdFor.bind(supplied),
          planFor: supplied.planFor.bind(supplied)
        });
      } catch {
        throw new runtime.HostedCoordinationError('HOSTED_INVALID_INPUT');
      }
      return claim(data, () => planner);
    },
    completeAttempt: updateOrchestration('completeAttempt'),
    signalWait: updateOrchestration('signalWait'),
    claimDueTimers,
    resolveDueTimer: updateOrchestration('resolveDueTimer'),
    requestCancellation: updateOrchestration('requestCancellation'),
    applyCancellation: updateOrchestration('applyCancellation'),
    findRecoverableClaims: call((client) => readPages(client,
      'SELECT payload FROM ' + q('orchestration_recoverable') + ' WHERE namespace=$1 ORDER BY expires_at,run,ordinal',
      [namespace], ({ payload }) => {
        const claim = decode(payload);
        // The reference freezes the projections, leaving the detached claim mutable.
        return { ...claim, token: immutableSnapshot(claim.token), attempt: immutableSnapshot(claim.attempt) };
      })),
    recoverAttempt: updateOrchestration('recoverAttempt'),
    resolveBlocked: updateOrchestration('resolveBlocked'),
    listWaits: readOrchestration('listWaits', 'waits'),
    listSignalReceipts: readOrchestration('listSignalReceipts', 'signalReceipts'),
    listOrchestrationEvents: listEvents('orchestration', 'orchestration.listEvents')
  });

  return { execution, orchestration };
}
