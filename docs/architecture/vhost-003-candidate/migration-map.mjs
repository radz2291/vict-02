import assert from 'node:assert/strict';
import { createValueCodec, hash, keyBytes } from './values.mjs';

export const digest = (bytes) => hash(bytes).toString('hex');
export const canonical = (value) => JSON.stringify(value, (_, item) => {
  if (item && !Array.isArray(item) && typeof item === 'object') {
    return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
  }
  return item;
});
export const assertMigration = (condition, code) => {
  if (!condition) throw Object.assign(new Error(code), { code });
};
const requireValid = (valid) => assertMigration(valid, 'VHOST_IMPORT_INVALID_STATE');
const same = (expected, actual) => requireValid(JSON.stringify(expected) === JSON.stringify(actual));
const keyOf = (...parts) => parts.join('\0');
const group = (...parts) => JSON.stringify(parts);
const requireString = (id) => { requireValid(typeof id === 'string'); return id; };
const safeInt = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const componentSpecs = {
  vict: ['vict-stores@1', ['activations','selections','runs','orchestrationSnapshots']],
  orchestration: ['orchestration@1', ['runs']],
  control: ['InMemoryControlPlaneStore@1', ['changesets','approvals','approvalsByChangeset','releases','selections','audit[]','controlRuns','operationReceipts']],
  turns: ['InMemoryAgentTurnStore@1', ['turns','cancels']],
  invocations: ['InMemoryAgentToolInvocationStore@1', ['invocations','byKey','turnSlots','turnSlotMax']],
  approvals: ['InMemoryAgentApprovalStore@1', ['approvals','byInvocation']],
  streamLedger: ['InMemoryAgentStreamLedgerStore@1', ['streams','events']],
  commandIdempotency: ['InMemoryCommandIdempotencyStore@1', ['receipts']],
  commandConfirmationReceipts: ['InMemoryCommandConfirmationReceiptStore@1', ['receipts']],
  governance: ['agent-governance@1', ['activations','intents']]
};

// Ordered by relational dependencies. Named fields are fixture SQL columns.
export const tables = {
  actors: '',
  turn_head: 'id', cancel_intents: 'ordinal', stream_clock: '', stream_events: '',
  tool_slot_head: 'id', tool_slot: 'id', tool_invocation: 'id', agent_approval: 'id',
  command_receipt: 'id', command_claim_fence: '', confirmation_receipt: 'id',
  control_changeset: 'id', control_approval: 'id', control_run: 'id', control_operation: 'id',
  control_release: 'id', control_selection: 'id', control_audit: 'id',
  catalog_activation: 'id', catalog_selection: 'id',
  governance_activation: 'id', governance_intent: 'id', governance_receipt: '',
  execution_run: 'id', execution_event: '', orchestration_run: 'id', orchestration_event: '',
  orchestration_component: '', orchestration_timer: '', orchestration_recoverable: '',
  coordination: '', effects: '', legacy_nested_archive: '', migration_hold: ''
};
export const references = {
  cancel_intents: { turn: 'turn_head' },
  control_selection: { target: 'control_release' },
  catalog_selection: { target: 'catalog_activation' },
  governance_receipt: { intent: 'governance_intent' },
  execution_run: { activation_row: 'catalog_activation' },
  execution_event: { run: 'execution_run' },
  orchestration_event: { run: 'orchestration_run' },
  orchestration_component: { run: 'orchestration_run' },
  orchestration_timer: { run: 'orchestration_run' },
  orchestration_recoverable: { run: 'orchestration_run' }
};
export const clockColumns = { coordination: ['expires_at'], effects: ['updated_at'] };
const entity = (key, prefix = false) => {
  const bytes = keyBytes(requireString(key));
  return { key_digest: hash(bytes), key_bytes: bytes, ...(prefix ? { key_prefix: bytes.subarray(0, 256) } : {}) };
};
const index = (name, key) => {
  const bytes = keyBytes(requireString(key));
  return { [name + '_digest']: hash(bytes), [name + '_key']: bytes };
};
const checkId = (key, expected) => requireValid(typeof key === 'string' && key === expected);
const terminalTurn = new Set(['completed', 'failed', 'cancelled', 'blocked']);
const stamp = (integer) => { requireValid(safeInt(integer)); return String(integer); };

function validateEnvelope(oracle, kind, columns, envelope) {
  const { captureRuntimeStoreSnapshot: capture, restoreRuntimeStoreSnapshot: restore } = oracle.snapshot;
  const entries = Object.fromEntries(columns.map((name) => name.endsWith('[]') ?
    [name.slice(0, -2), []] : [name, new Map()]));
  if (envelope) {
    const reconstructed = () => capture(kind, entries);
    try {
      same(Object.keys(envelope).sort(), ['sha256', 'kind', 'payload', 'schema'].sort());
      restore(envelope, kind, entries);
      requireValid(reconstructed().payload === envelope.payload);
    } catch {
      assertMigration(false, 'VHOST_IMPORT_INVALID_ENVELOPE');
    }
  }
  return entries;
}

export async function mapCapture(oracle, capture) {
  const { runtime } = oracle;
  const { encode, decode } = createValueCodec(oracle, { maxSnapshotBytes: 32 * 1024 * 1024, maxStateNodes: 1_000_000 });
  const source = capture.snapshotText === null ? undefined : JSON.parse(capture.snapshotText);
  const rows = Object.fromEntries(Object.keys(tables).map((table) => [table, []]));
  const componentDigests = {};
  if (source) {
    same(Object.keys(source).sort(), ['actors','schema','snapshots']);
    requireValid(source.schema === 'vict.postgres-operational@1' && Array.isArray(source.actors));
    same(Object.keys(source.snapshots).sort(), Object.keys(componentSpecs).sort());
  } else requireValid(capture.snapshotText === null);
  const decoded = Object.fromEntries(Object.entries(componentSpecs).map(([name,[kind, fields]]) => {
    const envelope = source?.snapshots[name];
    if (source) requireValid(envelope && typeof envelope === 'object');
    const entries = validateEnvelope(oracle, kind, fields, envelope);
    const collections = Object.fromEntries(Object.entries(entries).map(([field, values]) =>
      [field, values instanceof Map ? values.size : values.length]));
    componentDigests[name] = { kind, sha256: envelope ? digest(canonical(envelope)) : null, collections };
    return [name, entries];
  }));
  const counters = { sourceRevision: capture.revision, streamClockMax: 0, toolSlotMax: 0, scopeFenceMax: '0',
    recordedCommandFences: 0, executionNextEventMax: 0, orchestrationNextEventMax: 0, timerFenceMax: 0 };
  const add = (table, fields) => {
    rows[table].push(fields);
    return rows[table].length;
  };
  const addRecord = (table, key, record, more = {}, lexical = false) =>
    add(table, { ...entity(key, lexical), ...more, payload: encode(record) });
  const holds = new Map();
  const hold = (kind, ...subject) => {
    const name = group(...subject);
    holds.set(group(kind, name), { kind, subject });
  };

  const actorKeys = new Set();
  const directory = new runtime.InMemoryActorDirectory();
  for (const actor of source?.actors ?? []) {
    requireValid(!actorKeys.has(actor.actorId));
    actorKeys.add(requireString(actor.actorId));
    await directory.upsert(actor);
    add('actors', { actor_key: keyBytes(actor.actorId), status: actor.status, payload: encode(actor) });
  }

  const { turns, cancels } = decoded.turns;
  for (const key of new Set([...turns.keys(), ...cancels.keys()])) {
    const turn = turns.get(key);
    if (turn) checkId(key, turn.turnId);
    const ref = add('turn_head', { ...entity(key, true), payload: turn ? encode(turn) : null,
      is_open: turn ? !terminalTurn.has(turn.status) : null });
    const ids = new Set();
    for (const cancel of cancels.get(key) ?? []) {
      requireValid(!ids.has(cancel.cancelId));
      ids.add(cancel.cancelId);
      add('cancel_intents', { turn: ref, ...entity(cancel.cancelId), payload: encode(cancel) });
    }
  }
  const { streams, events: streamsEvents } = decoded.streamLedger;
  for (const [id, seq] of streams) {
    add('stream_clock', { stream_key: keyBytes(requireString(id)), seq: stamp(seq) });
    counters.streamClockMax = Math.max(counters.streamClockMax, seq);
  }
  for (const [id, ledger] of streamsEvents) {
    requireValid(streams.has(id));
    let last = 0;
    for (const event of ledger) {
      checkId(id, event.streamId);
      requireValid(safeInt(event.seq, last + 1) && event.seq <= streams.get(id) && runtime.isDurableStreamKind(event.kind));
      runtime.validateStreamLedgerAppend({ streamId: id, kind: event.kind, payload: event.payload, assignedSeq: event.seq });
      last = event.seq;
      add('stream_events', { stream_key: keyBytes(id), seq: stamp(last), payload: encode(event) });
    }
  }

  const { invocations, byKey, turnSlots, turnSlotMax } = decoded.invocations;
  const expectedRequests = new Map();
  const slots = new Map();
  for (const [key, row] of turnSlots) {
    checkId(key, keyOf(row.turnId, row.toolName, row.argDigest));
    requireValid(safeInt(row.slot, 1));
    const numbers = slots.get(row.turnId) ?? new Set();
    requireValid(!numbers.has(row.slot));
    numbers.add(row.slot);
    slots.set(row.turnId, numbers);
    addRecord('tool_slot', key, row);
  }
  requireValid(slots.size === turnSlotMax.size);
  for (const [turnId, max] of turnSlotMax) {
    const numbers = slots.get(turnId);
    requireValid(safeInt(max, 1) && numbers?.size === max && [...numbers].every((number) => number <= max));
    add('tool_slot_head', { ...entity(turnId), last_slot: max });
    counters.toolSlotMax = Math.max(counters.toolSlotMax, max);
  }
  for (const [id, row] of invocations) {
    checkId(id, row.invocationId);
    requireValid(!expectedRequests.has(row.idempotencyKey));
    expectedRequests.set(row.idempotencyKey, id);
    addRecord('tool_invocation', id, row, { ...index('request', row.idempotencyKey), ...index('turn', row.turnId) }, true);
    if (['running','outcome_unknown'].includes(row.status)) hold('invocation', id, row.status);
  }
  same([...byKey], [...expectedRequests]);

  const expectedApprovals = new Map();
  for (const [id, row] of decoded.approvals.approvals) {
    checkId(id, row.approvalId);
    requireValid(expectedApprovals.get(row.invocationId)?.status !== 'pending');
    expectedApprovals.set(row.invocationId, row);
    addRecord('agent_approval', id, row, { ...index('invocation', row.invocationId), pending: row.status === 'pending' }, true);
  }
  same([...decoded.approvals.byInvocation], [...expectedApprovals].map(([id, row]) => [id, row.approvalId]));

  const commandFences = new Set();
  for (const [id, row] of decoded.commandIdempotency.receipts) {
    checkId(id, keyOf(row.actorId, row.command, row.idempotencyKey));
    addRecord('command_receipt', id, row, index('actor_request', group(row.actorId, row.idempotencyKey)));
    if (row.fenceToken !== undefined) {
      const bytes = hash(keyBytes(requireString(row.fenceToken)));
      requireValid(!commandFences.has(bytes.toString('hex')));
      commandFences.add(bytes.toString('hex'));
      add('command_claim_fence', { fence_digest: bytes });
    }
    if (row.status === 'pending') hold('command', id, row.status);
  }
  counters.recordedCommandFences = commandFences.size;
  for (const [id, row] of decoded.commandConfirmationReceipts.receipts) {
    checkId(id, row.receiptId);
    requireValid(safeInt(row.replacementAttemptNo, 1));
    addRecord('confirmation_receipt', id, row, {
      ...index('prepare', group(row.actorId, row.command, row.prepareIdempotencyKey)),
      ...index('actor_command', group(row.actorId, row.command)), replacement_no: row.replacementAttemptNo
    }, true);
    if (row.status === 'prepared' && row.owner !== undefined) hold('confirmation', id, row.status);
  }

  const control = decoded.control;
  for (const [id, item] of control.changesets) {
    checkId(id, item.record.changesetId);
    addRecord('control_changeset', id, item.record, {}, true);
  }
  const expectedByChange = new Map();
  for (const [id, row] of control.approvals) {
    checkId(id, keyOf(row.changesetId, row.approverActorId));
    const items = expectedByChange.get(row.changesetId) ?? [];
    items.push(id);
    expectedByChange.set(row.changesetId, items);
    addRecord('control_approval', id, row, index('subject', row.changesetId));
  }
  same([...control.approvalsByChangeset], [...expectedByChange]);
  for (const [id, row] of control.controlRuns) {
    checkId(id, row.runId);
    addRecord('control_run', id, row);
  }
  for (const [id, row] of control.operationReceipts) {
    checkId(id, keyOf(row.changesetId, row.operationIndex));
    requireValid(safeInt(row.operationIndex));
    addRecord('control_operation', id, row, { ...index('subject', row.changesetId), operation_index: row.operationIndex });
    if (row.state === 'prepared') hold('control-operation', id, row.state);
  }
  const releases = new Map();
  for (const [id, row] of control.releases) {
    checkId(id, row.releaseVersion);
    releases.set(id, addRecord('control_release', id, row, index('subject', row.applicationId), true));
  }
  const selectedKeys = new Set();
  for (const [application, selections] of control.selections) {
    for (const [pos, row] of selections.entries()) {
      checkId(application, row.applicationId);
      requireValid(row.selectionRevision === pos + 1 && control.releases.get(row.releaseVersion)?.applicationId === application);
      const id = row.operationId === undefined ? group(application, row.selectionRevision) :
        group(application, row.operationId, row.reason);
      requireValid(!selectedKeys.has(id));
      selectedKeys.add(id);
      addRecord('control_selection', id, row, { ...index('subject', application), revision: stamp(pos + 1),
        target: releases.get(row.releaseVersion), target_key: keyBytes(row.releaseVersion) });
    }
  }
  const auditIds = new Set();
  for (const row of control.audit) {
    requireValid(!auditIds.has(row.auditId));
    auditIds.add(row.auditId);
    addRecord('control_audit', row.auditId, row, { ...index('subject', row.subjectId), ...index('kind', row.subjectType) });
  }

  const activationIds = new Map();
  for (const [id, row] of decoded.vict.activations) {
    checkId(id, row.activationVersion);
    const manifest = JSON.parse(row.canonicalManifest);
    for (const field of ['activationVersion','graphId','graphVersion','capabilitySetVersion','manifestSchema']) {
      same(manifest[field], row[field]);
    }
    await runtime.createInMemoryStores().catalog.publish({ canonicalManifest: row.canonicalManifest, manifest });
    activationIds.set(id, addRecord('catalog_activation', id, row));
  }
  for (const [id, row] of decoded.vict.selections) {
    checkId(id, row.graphId);
    requireValid(decoded.vict.activations.get(row.activationVersion)?.graphId === id && safeInt(row.selectionRevision, 1));
    addRecord('catalog_selection', id, row, { target: activationIds.get(row.activationVersion) });
  }
  for (const [id, row] of decoded.governance.activations) {
    checkId(id, row.activationVersion);
    await new runtime.InMemoryAgentGovernanceStore().saveAgentActivation(row);
    addRecord('governance_activation', id, row);
  }
  for (const [id, row] of decoded.governance.intents) {
    checkId(id, row.intentId);
    const base = { ...row, receipts: [] };
    const engine = new runtime.InMemoryAgentGovernanceStore();
    await engine.recordDeletionIntent({ ...base, state: 'pending' });
    const ref = addRecord('governance_intent', id, base, { open: row.state !== 'completed' }, true);
    for (const receipt of row.receipts) {
      await engine.recordDeletionReceipt(id, receipt.step, receipt.at);
      add('governance_receipt', { intent: ref, step: receipt.step, payload: encode(receipt) });
    }
    if (row.state !== 'pending') {
      await engine.updateDeletionIntentState(id, 'application-domain-deleted');
      await engine.updateDeletionIntentState(id, row.state);
    }
    assert.deepEqual(await engine.getDeletionIntent(id), row);
    if (row.state !== 'completed') hold('deletion', id, row.state);
  }

  const families = [['execution', decoded.vict.runs], ['orchestration', decoded.orchestration.runs]];
  const orchKinds = ['tokens','attempts','waits','branchResults','branchOutputs','signalReceipts','cancellationRequests','resolutionRequests'];
  for (const [kind, runs] of families) {
    for (const [id, state] of runs) {
      const run = state.run;
      checkId(id, run.runId);
      requireValid(safeInt(run.recordRevision, 1) && Number.isFinite(run.createdAt));
      for (const [seq, event] of state.events.entries()) {
        requireValid(event.seq === seq);
        for (const field of ['runId','graphId','graphVersion','capabilitySetVersion','activationVersion']) same(event[field], run[field]);
      }
      const extra = {};
      if (kind === 'execution') {
        const stored = decoded.vict.activations.get(run.activationVersion);
        requireValid(stored !== undefined);
        for (const field of ['graphId','graphVersion','capabilitySetVersion']) same(stored[field], run[field]);
        extra.activation_row = activationIds.get(run.activationVersion);
      }
      const ref = addRecord(kind + '_run', id, run, { ...index('graph', run.graphId), ...index('activation', run.activationVersion),
        created_at: run.createdAt, status: run.status, next_seq: stamp(state.events.length), ...extra });
      for (const event of state.events) add(kind + '_event', { run: ref, seq: stamp(event.seq), payload: encode(event) });
      const field = kind + 'NextEventMax';
      counters[field] = Math.max(counters[field], state.events.length);
      if (kind === 'execution') {
        if (run.status === 'running') hold('execution-run', id, run.status);
        continue;
      }

      const refFields = { tokens: 'tokenId', attempts: 'attemptId', waits: 'waitId',
        signalReceipts: 'signalId', cancellationRequests: 'requestId', resolutionRequests: 'resolutionId' };
      for (const name of orchKinds) {
        let ordinal = 0;
        for (const entry of state[name]) {
          if (refFields[name]) {
            checkId(entry[0], entry[1][refFields[name]]);
            if (entry[1].runId !== undefined) checkId(id, entry[1].runId);
          }
          if (name === 'attempts' || name === 'waits') requireValid(state.tokens.has(entry[1].tokenId));
          if (name === 'signalReceipts') requireValid(state.waits.has(entry[1].waitId));
          if (name === 'branchResults') requireValid(entry.runId === id && state.tokens.has(entry.tokenId));
          if (name === 'branchOutputs') requireValid(entry[1] instanceof Map);
          add('orchestration_component', { run: ref, kind: name, ordinal: stamp(ordinal++), payload: encode(entry) });
        }
      }
      let ordinal = 0;
      for (const entry of state.timers) {
        const [timerId, timer] = entry;
        checkId(timerId, timer.timerId);
        checkId(id, timer.runId);
        requireValid(safeInt(timer.revision, 1) && Number.isFinite(timer.dueAt));
        requireValid(timer.tokenId === null || state.tokens.has(timer.tokenId));
        requireValid(timer.waitId === null || state.waits.has(timer.waitId));
        requireValid(timer.attemptId === null || state.attempts.has(timer.attemptId));
        add('orchestration_timer', { run: ref, ordinal: stamp(ordinal++), timer_key: keyBytes(timerId),
          status: timer.status, due_at: timer.dueAt, lease_expires_at: timer.leaseExpiresAt, payload: encode(entry) });
        counters.timerFenceMax = Math.max(counters.timerFenceMax, timer.revision);
        if (timer.status === 'firing') hold('timer', id, timerId);
      }
      const snapshot = oracle.snapshot.captureRuntimeStoreSnapshot('orchestration@1', { runs: new Map([[id, state]]) });
      const engine = runtime.createInMemoryOrchestrationStore({ snapshot });
      for (const [n, claim] of (await engine.findRecoverableClaims({ now: 0 })).entries()) {
        add('orchestration_recoverable', { run: ref, ordinal: stamp(n), expires_at: claim.leaseExpiresAt, payload: encode(claim) });
        hold('orchestration-attempt', id, claim.attempt.attemptId);
      }
    }
  }

  const nested = decoded.vict.orchestrationSnapshots;
  requireValid(nested.size <= 1);
  if (nested.size) {
    requireValid(nested.has('orchestration'));
    const envelope = nested.get('orchestration');
    const archived = validateEnvelope(oracle, 'orchestration@1', ['runs'], envelope);
    const bytes = Buffer.from(canonical(envelope), 'utf8');
    add('legacy_nested_archive', { envelope: bytes });
    componentDigests.nestedOrchestration = { kind: 'orchestration@1', sha256: digest(bytes), collections: { runs: archived.runs.size } };
  }

  const scopeIds = new Map();
  for (const scope of capture.coordination) {
    const { scope_id, actor_id, owner_id, fence, deleted, expires_at, purpose } = scope;
    requireValid(typeof scope_id === 'string' && typeof actor_id === 'string' && !scopeIds.has(scope_id));
    requireValid(/^\d+$/.test(fence) && BigInt(fence) < 9223372036854775807n);
    requireValid((owner_id === null) === (expires_at === null) && (!deleted || purpose === 'deletion'));
    scopeIds.set(scope_id, fence);
    add('coordination', scope);
    if (BigInt(fence) > BigInt(counters.scopeFenceMax)) counters.scopeFenceMax = fence;
  }
  for (const effect of capture.effects) {
    const { scope_id, effect_id, fence, status } = effect;
    requireValid(scopeIds.has(scope_id) && /^\d+$/.test(fence) && BigInt(fence) <= BigInt(scopeIds.get(scope_id)));
    add('effects', effect);
    if (status === 'uncertain') hold('effect', scope_id, effect_id);
  }
  for (const { kind, subject } of holds.values()) add('migration_hold', { kind, subject_key: keyBytes(group(...subject)) });
  const ranges = {
    streamSeq: rows.stream_clock.map((row) => row.seq),
    toolSlot: rows.tool_slot_head.map((row) => row.last_slot),
    scopeFence: rows.coordination.map((row) => row.fence),
    executionNextSeq: rows.execution_run.map((row) => row.next_seq),
    orchestrationNextSeq: rows.orchestration_run.map((row) => row.next_seq),
    timerFence: rows.orchestration_timer.map((row) => decode(row.payload)[1].revision)
  };
  counters.ranges = Object.fromEntries(Object.entries(ranges).map(([name, values]) => {
    const exact = values.map((value) => BigInt(value)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    return [name, { min: exact[0]?.toString() ?? null, max: exact.at(-1)?.toString() ?? null }];
  }));

  const compatibility = ['legacy-postgresql-text-pre-wire-identities-unavailable'];
  if (capture.revision !== null && capture.revision !== '0') {
    compatibility.push('retired-command-fences-not-reconstructible');
  }
  return { rows, componentDigests, counters, compatibility, unresolved: [...holds.keys()].sort().map((key) => holds.get(key)) };
}
