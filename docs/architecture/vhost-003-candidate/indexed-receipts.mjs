import { hash, keyBytes } from './values.mjs';

// Keep the exact legacy composite Map key for the two ports that use it.
// The secondary indexes below instead group by separate fields, just as
// the corresponding legacy filters compare those fields independently.
const slotKey = ({ turnId, toolName, argDigest }) => [turnId, toolName, argDigest].map(String).join('\0');
const commandKey = ({ actorId, command, idempotencyKey }) => [actorId, command, idempotencyKey].map(String).join('\0');
const groupKey = (...parts) => JSON.stringify(parts);
const prefix = (key) => key.subarray(0, 256);
const orderById = 'key_prefix,key_bytes';

export function createReceiptPorts({ runtime, codec, namespace, q, call, readPages }) {
  const { encode, decode, captureRuntimeStoreSnapshot } = codec;

  function keyParts(key) {
    const bytes = keyBytes(key);
    return [hash(bytes), bytes];
  }

  // Lock orders use the actual advisory lock IDs, including on collisions.
  // Distinct keys sharing a lock can wait but still compare complete bytes.
  async function lock(client, ...keys) {
    const ids = keys.map(([domain, key]) =>
      hash(Buffer.concat([Buffer.from(namespace + '\0' + domain + '\0'), keyBytes(key)]))
        .subarray(0, 8).toString('hex')
    );
    for (const id of [...new Set(ids)].sort()) {
      const bytes = Buffer.from(id, 'hex');
      await client.query('SELECT pg_advisory_xact_lock($1::integer,$2::integer)',
        [bytes.readInt32BE(0), bytes.readInt32BE(4)]);
    }
  }

  async function find(client, table, key, options = {}) {
    const { column = 'key', order = '', columns = 'id,payload', forUpdate = false } = options;
    if (typeof key !== 'string') return undefined;
    // Column and table names are fixed by this module.
    const bytesColumn = column === 'key' ? 'key_bytes' : `${column}_key`;
    const { rows: [row] } = await client.query(
      `SELECT ${columns} FROM ${q(table)} WHERE namespace=$1 AND ${column}_digest=$2
       AND ${bytesColumn}=$3 ${order} LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`, [namespace, ...keyParts(key)]);
    return row;
  }

  async function insert(client, table, key, columns, values) {
    const bindings = [namespace, ...keyParts(key), ...values];
    await client.query(
      `INSERT INTO ${q(table)} (namespace,key_digest,key_bytes,${columns})
       VALUES (${bindings.map((_, index) => '$' + (index + 1)).join(',')})`, bindings
    );
  }

  function value(row) {
    return row && decode(row.payload);
  }

  function point(table, key, options) {
    return call(async (client, input) => value(await find(client, table, key(input), options)));
  }

  function list(table, where, order, getKeys, getLimit = () => Infinity) {
    return call(async (client, input) => {
      const keys = getKeys(input);
      if (keys.some((key) => typeof key !== 'string')) return [];
      return readPages(client, `SELECT payload FROM ${q(table)} WHERE namespace=$1 ${where} ORDER BY ${order}`,
        [namespace, ...keys.flatMap(keyParts)], value, getLimit(input));
    });
  }

  function engine(name, collections) {
    return new runtime[name](captureRuntimeStoreSnapshot(name + '@1', collections));
  }

  async function replace(client, table, row, next) {
    if (next === undefined) {
      if (row) await client.query(`DELETE FROM ${q(table)} WHERE namespace=$1 AND id=$2`, [namespace, row.id]);
      return;
    }
    const payload = encode(next);
    if (row.payload.equals(payload)) return;
    const pending = table === 'agent_approval' ? ',pending=$4' : '';
    await client.query(`UPDATE ${q(table)} SET payload=$3${pending} WHERE namespace=$1 AND id=$2`,
      pending ? [namespace, row.id, payload, next.status === 'pending'] : [namespace, row.id, payload]);
  }

  function invocationEngine(records, turnSlots = new Map(), turnSlotMax = new Map()) {
    return engine('InMemoryAgentToolInvocationStore', {
      invocations: new Map(records.map((record) => [record.invocationId, record])),
      byKey: new Map(records.map((record) => [record.idempotencyKey, record.invocationId])),
      turnSlots, turnSlotMax
    });
  }

  function changeInvocation(method) {
    return call(async (client, input) => {
      const { invocationId } = input;
      if (typeof invocationId === 'string') await lock(client, ['invocation', invocationId]);
      const prior = await find(client, 'tool_invocation', invocationId, { forUpdate: true });
      const store = invocationEngine(prior ? [value(prior)] : []);
      const result = await store[method](input);
      await replace(client, 'tool_invocation', prior, await store.getInvocation(invocationId));
      return result;
    });
  }

  const invocations = Object.freeze({
    allocateTurnToolSlot: call(async (client, input) => {
      const { turnId } = input;
      const key = slotKey(input);
      await lock(client, ['slot', key], ['slot-head', turnId]);
      const prior = await find(client, 'tool_slot', key);
      if (prior) return value(prior);
      const head = await find(client, 'tool_slot_head', turnId, { columns: 'id,last_slot', forUpdate: true });
      const store = invocationEngine([], new Map(), new Map(head ? [[turnId, head.last_slot]] : []));
      const allocation = await store.allocateTurnToolSlot(input);
      if (head) {
        await client.query(`UPDATE ${q('tool_slot_head')} SET last_slot=$3 WHERE namespace=$1 AND id=$2`,
          [namespace, head.id, allocation.slot]);
      } else {
        await insert(client, 'tool_slot_head', turnId, 'last_slot', [allocation.slot]);
      }
      await insert(client, 'tool_slot', key, 'payload', [encode(allocation)]);
      return allocation;
    }),
    recordInvocationIntent: call(async (client, input) => {
      const { invocationId, idempotencyKey } = input;
      await lock(client, ['invocation', invocationId], ['invocation-request', idempotencyKey]);
      const byKey = await find(client, 'tool_invocation', idempotencyKey, { column: 'request' });
      const byId = await find(client, 'tool_invocation', invocationId);
      const records = [byKey, byId].filter(Boolean).map(value);
      const result = await invocationEngine(records).recordInvocationIntent(input);
      if (!records.length) {
        await insert(client, 'tool_invocation', invocationId,
          'key_prefix,request_digest,request_key,turn_digest,turn_key,payload',
          [prefix(keyBytes(invocationId)), ...keyParts(idempotencyKey), ...keyParts(input.turnId), encode(result)]);
      }
      return result;
    }),
    getInvocation: point('tool_invocation', (id) => id),
    getInvocationByIdempotencyKey: point('tool_invocation', (key) => key, { column: 'request' }),
    updateInvocationStatus: changeInvocation('updateInvocationStatus'),
    listInvocationsForTurn: list('tool_invocation', 'AND turn_digest=$2 AND turn_key=$3', orderById, (id) => [id]),
    claimInvocationRun: changeInvocation('claimInvocationRun'),
    settleInvocationRun: changeInvocation('settleInvocationRun'),
    settleInvocationPending: changeInvocation('settleInvocationPending'),
    reconcileAbandonedRun: changeInvocation('reconcileAbandonedRun')
  });

  function approvalEngine(rows, current) {
    return engine('InMemoryAgentApprovalStore', {
      approvals: new Map(rows.map((record) => [record.approvalId, record])),
      byInvocation: new Map(current ? [[current.invocationId, current.approvalId]] : [])
    });
  }

  function changeApproval(method) {
    return call(async (client, input) => {
      const { approvalId } = input;
      if (typeof approvalId === 'string') await lock(client, ['approval', approvalId]);
      const prior = await find(client, 'agent_approval', approvalId, { forUpdate: true });
      const store = approvalEngine(prior ? [value(prior)] : []);
      const result = await store[method](input);
      await replace(client, 'agent_approval', prior, await store.getApproval(approvalId));
      return result;
    });
  }

  const approvals = Object.freeze({
    createPendingApproval: call(async (client, input) => {
      const { approvalId, invocationId } = input;
      await lock(client, ['approval', approvalId], ['approval-invocation', invocationId]);
      const byId = await find(client, 'agent_approval', approvalId);
      const current = value(await find(client, 'agent_approval', invocationId, { column: 'invocation', order: 'ORDER BY id DESC' }));
      const result = await approvalEngine([value(byId), current].filter(Boolean), current).createPendingApproval(input);
      if (!byId && current?.status !== 'pending') {
        await insert(client, 'agent_approval', approvalId, 'key_prefix,invocation_digest,invocation_key,pending,payload',
          [prefix(keyBytes(approvalId)), ...keyParts(invocationId), true, encode(result)]);
      }
      return result;
    }),
    getApproval: point('agent_approval', (id) => id),
    listOpenApprovals: list('agent_approval', 'AND pending', orderById, () => []),
    listApprovalsForInvocation: list('agent_approval', 'AND invocation_digest=$2 AND invocation_key=$3', 'id DESC',
      (id) => [id], () => 1),
    decideApproval: changeApproval('decideApproval'),
    expireApproval: changeApproval('expireApproval')
  });

  const actorRequest = ({ actorId, idempotencyKey }) => groupKey(actorId, idempotencyKey);

  function changeReceipt(table, name, keyFor, readInput, creation) {
    return (method) => call(async (client, input) => {
      const key = keyFor(input);
      if (typeof key === 'string') {
        const locks = [[table, key]];
        // The cross-command query returns the first committed insertion
        // within this actor/key group, including after a release/reinsert.
        if (method === 'claimReceipt') locks.push(['command-actor-request', actorRequest(input)]);
        await lock(client, ...locks);
      }
      const prior = await find(client, table, key, { forUpdate: true });
      const store = engine(name, { receipts: new Map(prior ? [[key, value(prior)]] : []) });
      const result = await store[method](input);
      const next = await store.getReceipt(readInput(input));
      if (prior) await replace(client, table, prior, next);
      else if (next !== undefined) await creation(client, key, next);
      return result;
    });
  }

  const changeCommand = changeReceipt('command_receipt', 'InMemoryCommandIdempotencyStore', commandKey,
    (input) => input, (client, key, next) => insert(client, 'command_receipt', key,
      'actor_request_digest,actor_request_key,payload', [...keyParts(actorRequest(next)), encode(next)]));

  const commandIdempotency = Object.freeze({
    claimReceipt: changeCommand('claimReceipt'),
    getReceipt: point('command_receipt', commandKey),
    findReceiptByActorKey: point('command_receipt', actorRequest, { column: 'actor_request', order: 'ORDER BY id' }),
    completeReceipt: changeCommand('completeReceipt'),
    failReceipt: changeCommand('failReceipt'),
    releaseReceipt: changeCommand('releaseReceipt'),
    takeOverExpiredLease: changeCommand('takeOverExpiredLease')
  });

  const prepare = ({ actorId, command, prepareIdempotencyKey }) => groupKey(actorId, command, prepareIdempotencyKey);
  const actorCommand = ({ actorId, command }) => groupKey(actorId, command);
  const receiptOrder = 'replacement_no,' + orderById;
  const changeConfirmation = changeReceipt('confirmation_receipt', 'InMemoryCommandConfirmationReceiptStore',
    (input) => input.receiptId, (input) => input.receiptId,
    (client, key, next) => insert(client, 'confirmation_receipt', key,
      'key_prefix,prepare_digest,prepare_key,actor_command_digest,actor_command_key,replacement_no,payload',
      [prefix(keyBytes(key)), ...keyParts(prepare(next)), ...keyParts(actorCommand(next)),
        Number(next.replacementAttemptNo), encode(next)]));

  const commandConfirmationReceipts = Object.freeze({
    createReceipt: changeConfirmation('createReceipt'),
    getReceipt: point('confirmation_receipt', (id) => id),
    listReceiptsByPrepare: list('confirmation_receipt', 'AND prepare_digest=$2 AND prepare_key=$3',
      receiptOrder, (input) => [prepare(input)]),
    listReceiptsByActorCommand: list('confirmation_receipt', 'AND actor_command_digest=$2 AND actor_command_key=$3',
      receiptOrder, (input) => [actorCommand(input)],
      ({ limit }) => limit === undefined ? Infinity : Math.floor(Math.max(0, Number(limit))) || 0),
    startConsumption: changeConfirmation('startConsumption'),
    takeOverExpiredConsumptionLease: changeConfirmation('takeOverExpiredConsumptionLease'),
    settleConsumption: changeConfirmation('settleConsumption'),
    releaseConsumption: changeConfirmation('releaseConsumption')
  });

  return { invocations, approvals, commandIdempotency, commandConfirmationReceipts };
}
