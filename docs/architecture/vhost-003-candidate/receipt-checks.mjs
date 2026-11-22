import assert from 'node:assert/strict';
import { monitorPool, measure } from './benchmark.mjs';
import { hash, keyBytes } from './values.mjs';

const INV = 'invocations';
const APP = 'approvals';
const CMD = 'commandIdempotency';
const CONF = 'commandConfirmationReceipts';

const invocation = (invocationId = 'invoke', idempotencyKey = 'tool-key', turnId = 'turn') => ({
  invocationId, idempotencyKey, turnId, actorId: 'actor', toolName: 'fixture',
  argDigest: 'args-v1', createdAt: 1, updatedAt: 1, status: 'intent'
});
const approval = (approvalId = 'approve', invocationId = 'invoke') => ({
  approvalId, invocationId, turnId: 'turn', actorId: 'actor', toolName: 'fixture',
  argDigest: 'args-v1', status: 'pending', createdAt: 1, expiresAt: 10
});
const command = (runtime, overrides = {}) => {
  const record = { actorId: 'actor', command: 'fixture', idempotencyKey: 'command-key',
    requestDigest: 'digest-v1', status: 'pending', owner: 'old', leaseUntil: 10,
    attempts: 1, createdAt: 1, ...overrides };
  return { ...record, fenceToken: runtime.commandIdempotencyFenceToken(record) };
};
const confirmation = (receiptId = 'confirm', overrides = {}) => ({
  receiptId, actorId: 'actor', command: 'fixture', payloadDigest: 'digest-v1',
  subjectId: 'subject', expectedRevision: null, expiryAt: 50, status: 'prepared',
  createdAt: 1, replacementAttemptNo: 1, prepareIdempotencyKey: 'prepare', attempts: 0, ...overrides
});

async function outcome(work) {
  try {
    return { result: await work() };
  } catch (error) {
    return { error: { name: error.name, code: error.code, message: error.message } };
  }
}

async function differential(old, indexed, runtime, evidence, save) {
  const diff = async (label, family, method, args = [], code) => {
    const expected = await outcome(() => old[family][method](...args));
    const observed = await outcome(() => indexed[family][method](...args));
    evidence.receiptDifferential.push({ label, port: family + '.' + method, expected, observed });
    await save();
    assert.deepEqual(observed, expected, label);
    if (code) assert.equal(observed.error?.code, code, label);
    else assert(!observed.error, label);
    return observed.result;
  };
  const tool = invocation();
  const slot = { turnId: 'turn', toolName: 'a', argDigest: 'args' };
  const initial = await diff('first slot persists without linked invocation', INV, 'allocateTurnToolSlot', [slot]);
  assert.equal(initial.slot, 1);
  assert.deepEqual(await diff('exact slot replay', INV, 'allocateTurnToolSlot', [slot]), initial);
  assert.equal((await diff('monotonic next slot', INV, 'allocateTurnToolSlot', [{ ...slot, argDigest: 'next' }])).slot, 2);
  await diff('missing invocation identity', INV, 'getInvocation', ['missing']);
  await diff('missing invocation request key', INV, 'getInvocationByIdempotencyKey', ['missing']);
  await diff('new intent must start as intent', INV, 'recordInvocationIntent', [{ ...tool, status: 'running' }],
    'VICT_CONTROL_INVOCATION_INVALID_STATE');
  await diff('durable invocation intent', INV, 'recordInvocationIntent', [tool]);
  await diff('an identical request digest returns existing invocation ID', INV, 'recordInvocationIntent',
    [{ ...tool, invocationId: 'ignored-replay-id' }]);
  await diff('same request key with different digest', INV, 'recordInvocationIntent', [{ ...tool, argDigest: 'different' }],
    'VICT_CONTROL_INVOCATION_KEY_COLLISION');
  await diff('same invocation ID and new key requires exact content', INV, 'recordInvocationIntent',
    [{ ...tool, idempotencyKey: 'new-key' }], 'VICT_CONTROL_INVOCATION_COLLISION');
  await diff('conflict creates no alternate request key', INV, 'getInvocationByIdempotencyKey', ['new-key']);
  await diff('exact request lookup', INV, 'getInvocationByIdempotencyKey', [tool.idempotencyKey]);
  const ids = ['z\0', 'z\ud800', 'z\ufffd', 'z\u{10000}', 'a'.repeat(2200) + 'z', 'a'.repeat(2200) + 'a'];
  for (const [index, id] of ids.entries()) {
    await diff('byte-preserving invocation key #' + index, INV, 'recordInvocationIntent', [invocation(id, id)]);
    await diff('exact binary point lookup #' + index, INV, 'getInvocation', [id]);
  }
  await diff('same turn lexical UTF-16 order including shared long prefixes', INV, 'listInvocationsForTurn', ['turn']);
  await diff('unrelated turn omitted', INV, 'listInvocationsForTurn', ['other']);
  await diff('missing status change', INV, 'updateInvocationStatus', [{ invocationId: 'missing', status: 'approved', at: 2 }],
    'VICT_CONTROL_INVOCATION_MISSING');
  await diff('approved transition', INV, 'updateInvocationStatus', [{ invocationId: 'invoke', status: 'approved', at: 2 }]);
  const run = { invocationId: 'invoke', fenceToken: 'run-one', ownerIdentity: 'old', at: 3 };
  await diff('first invocation claim', INV, 'claimInvocationRun', [run]);
  await diff('duplicate invocation claim refuses even same owner', INV, 'claimInvocationRun', [run],
    'VICT_CONTROL_INVOCATION_OWNER_ACTIVE');
  await diff('late pending cancellation cannot touch live owner', INV, 'settleInvocationPending',
    [{ invocationId: 'invoke', status: 'cancelled', at: 4 }], 'VICT_CONTROL_INVOCATION_OWNER_ACTIVE');
  await diff('reject backward status', INV, 'updateInvocationStatus', [{ invocationId: 'invoke', status: 'approved', at: 4 }],
    'VICT_CONTROL_INVOCATION_REGRESSION');
  await diff('abandonment requires observed fence', INV, 'reconcileAbandonedRun',
    [{ invocationId: 'invoke', observedFenceToken: 'wrong', reconciledFenceToken: 'run-two', at: 4 }],
    'VICT_CONTROL_INVOCATION_FENCE_MISMATCH');
  await diff('abandoned run retains outcome_unknown and advances generation', INV, 'reconcileAbandonedRun',
    [{ invocationId: 'invoke', observedFenceToken: 'run-one', reconciledFenceToken: 'run-two', at: 4 }]);
  await diff('stale run owner cannot settle abandoned attempt', INV, 'settleInvocationRun',
    [{ invocationId: 'invoke', fenceToken: 'run-one', status: 'completed', at: 5 }], 'VICT_CONTROL_INVOCATION_FENCE_MISMATCH');
  await diff('unknown invocation cannot dispatch again', INV, 'claimInvocationRun', [run], 'VICT_CONTROL_INVOCATION_TERMINAL');
  const done = { invocationId: ids[0], fenceToken: 'second-invocation', status: 'completed', resultSummary: 'done', at: 7 };
  await diff('another intent can be claimed', INV, 'claimInvocationRun', [{ ...run, invocationId: ids[0], fenceToken: done.fenceToken }]);
  const settled = await diff('exact generation settles', INV, 'settleInvocationRun', [done]);
  assert.deepEqual(await diff('identical terminal settlement replays original timestamp', INV, 'settleInvocationRun',
    [{ ...done, at: 9 }]), settled);
  await diff('different terminal result rejected', INV, 'settleInvocationRun', [{ ...done, resultSummary: 'different' }],
    'VICT_CONTROL_INVOCATION_TERMINAL');
  const cancel = { invocationId: ids[1], status: 'cancelled', at: 8, errorCode: 'owner-stop' };
  await diff('cancel a pending invocation', INV, 'settleInvocationPending', [cancel]);
  await diff('identical cancellation replays', INV, 'settleInvocationPending', [{ ...cancel, at: 9 }]);
  await diff('other pending disposition refused', INV, 'settleInvocationPending', [{ ...cancel, status: 'failed' }],
    'VICT_CONTROL_INVOCATION_TERMINAL');

  const request = approval();
  const decide = { approvalId: request.approvalId, approverActorId: 'approver', decision: 'approved', decidedAt: 10 };
  await diff('missing approval point', APP, 'getApproval', ['missing']);
  await diff('missing approval invocation list', APP, 'listApprovalsForInvocation', ['missing']);
  await diff('approval must be pending on first insert', APP, 'createPendingApproval', [{ ...request, status: 'declined' }],
    'VICT_CONTROL_APPROVAL_INVALID_STATE');
  await diff('approval first insert', APP, 'createPendingApproval', [request]);
  await diff('approve ID collision precedes invocation replay', APP, 'createPendingApproval', [{ ...request, argDigest: 'changed' }],
    'VICT_CONTROL_APPROVAL_COLLISION');
  await diff('same invocation pending replay returns original', APP, 'createPendingApproval', [{ ...request, approvalId: 'alias' }]);
  await diff('insert pending approval in another invocation', APP, 'createPendingApproval', [approval('A\ud800', 'other')]);
  await diff('open approvals sorted, no implicit TTL', APP, 'listOpenApprovals');
  await diff('decision at expiry is valid while still pending at this port', APP, 'decideApproval', [decide]);
  await diff('same approved disposition replays first approver', APP, 'decideApproval', [{ ...decide, approverActorId: 'other' }]);
  await diff('opposite approval decision fails closed', APP, 'decideApproval', [{ ...decide, decision: 'declined' }],
    'VICT_CONTROL_APPROVAL_CONFLICT');
  await diff('terminal approval cannot expire', APP, 'expireApproval', [{ approvalId: request.approvalId, at: 11 }],
    'VICT_CONTROL_APPROVAL_INVALID_STATE');
  const second = approval('replace');
  await diff('terminal predecessor allows a new pending approval', APP, 'createPendingApproval', [second]);
  await diff('historical approval still accessible by ID', APP, 'getApproval', [request.approvalId]);
  await diff('invocation lists newest approval only', APP, 'listApprovalsForInvocation', ['invoke']);
  await diff('explicit pending expiry records timestamp', APP, 'expireApproval', [{ approvalId: second.approvalId, at: 10 }]);
  await diff('approval expiry replay', APP, 'expireApproval', [{ approvalId: second.approvalId, at: 12 }]);
  await diff('decision after recorded expiry denied', APP, 'decideApproval', [{ ...decide, approvalId: second.approvalId }],
    'VICT_CONTROL_APPROVAL_EXPIRED');
  await diff('only other pending approval remains open', APP, 'listOpenApprovals');

  const receipt = command(runtime);
  const later = command(runtime, { command: 'alphabetically-before', requestDigest: 'digest-v2' });
  await diff('idempotency lookup before claim', CMD, 'getReceipt', [receipt]);
  await diff('first exclusive receipt claim', CMD, 'claimReceipt', [receipt]);
  await diff('receipt duplicate port returns exists even on different digest', CMD, 'claimReceipt',
    [{ ...receipt, requestDigest: 'different' }]);
  assert.deepEqual(await diff('original digest and fence untouched', CMD, 'getReceipt', [receipt]), receipt);
  await diff('separate command tuple accepted by store', CMD, 'claimReceipt', [later]);
  assert.deepEqual(await diff('actor/key uses insertion order, not command order', CMD, 'findReceiptByActorKey', [later]), receipt);
  await diff('takeover before lease deadline', CMD, 'takeOverExpiredLease', [{ ...receipt, owner: 'new', at: 9, leaseUntil: 20 }]);
  const takeover = await diff('takeover at exact lease equality', CMD, 'takeOverExpiredLease',
    [{ ...receipt, owner: 'new', at: 10, leaseUntil: 20 }]);
  await diff('stale owner cannot complete', CMD, 'completeReceipt', [{ ...receipt, resultJson: '{}', at: 11 }],
    'VICT_IDEMPOTENCY_FENCE_CONFLICT');
  await diff('stale owner cannot fail', CMD, 'failReceipt', [{ ...receipt, responseCode: 'failed', at: 11 }],
    'VICT_IDEMPOTENCY_FENCE_CONFLICT');
  await diff('stale owner cannot release', CMD, 'releaseReceipt', [{ ...receipt, at: 11 }],
    'VICT_IDEMPOTENCY_FENCE_CONFLICT');
  await diff('winning fence completes', CMD, 'completeReceipt',
    [{ ...receipt, fenceToken: takeover.fenceToken, resultJson: '{"ok":true}', at: 11 }]);
  await diff('terminal content returned for service replay', CMD, 'getReceipt', [receipt]);
  await diff('settlement replay is refused at port', CMD, 'completeReceipt',
    [{ ...receipt, fenceToken: takeover.fenceToken, resultJson: '{"ok":true}', at: 12 }],
    'VICT_IDEMPOTENCY_FENCE_CONFLICT');
  await diff('current owner may release retryable failure', CMD, 'releaseReceipt', [{ ...later, at: 11 }]);
  await diff('released receipt missing', CMD, 'getReceipt', [later]);
  await diff('same tuple can be freshly claimed', CMD, 'claimReceipt', [later]);
  await diff('deterministic failure persisted as terminal', CMD, 'failReceipt', [{ ...later, at: 11, responseCode: 'denied' }]);
  await diff('terminal failure survives read', CMD, 'getReceipt', [later]);
  await diff('unrelated actor/key lookup misses', CMD, 'findReceiptByActorKey', [{ ...receipt, actorId: 'other' }]);
  await diff('no takeover of a missing tuple', CMD, 'takeOverExpiredLease', [{ ...receipt, command: 'missing', at: 11 }]);
  await diff('settle missing command receipt', CMD, 'failReceipt', [{ ...receipt, command: 'missing', at: 11 }],
    'VICT_IDEMPOTENCY_RECEIPT_MISSING');
  const ordering = command(runtime, { idempotencyKey: 'reinsert' });
  const alternate = command(runtime, { idempotencyKey: 'reinsert', command: 'alternate' });
  await diff('first row in fresh actor key group', CMD, 'claimReceipt', [ordering]);
  await diff('second row in fresh actor key group', CMD, 'claimReceipt', [alternate]);
  await diff('release the former first row', CMD, 'releaseReceipt', [{ ...ordering, at: 2 }]);
  await diff('reclaim with a distinct owner', CMD, 'claimReceipt', [command(runtime, { idempotencyKey: 'reinsert', owner: 'new' })]);
  assert.deepEqual(await diff('reinsert follows surviving row', CMD, 'findReceiptByActorKey', [ordering]), alternate);

  const confirm = confirmation();
  await diff('missing confirmation lookup', CONF, 'getReceipt', ['missing']);
  await diff('create issued confirmation', CONF, 'createReceipt', [confirm]);
  await diff('duplicate confirmation ID is exists and does not mutate digest', CONF, 'createReceipt',
    [{ ...confirm, payloadDigest: 'different' }]);
  await diff('original confirmation payload binding', CONF, 'getReceipt', [confirm.receiptId]);
  for (const [id, ordinal, key] of [['Z', 2, 'prepare'], ['\ud800', 2, 'prepare'], ['a', 1, 'elsewhere']]) {
    await diff('insert confirmation replacement ' + id, CONF, 'createReceipt',
      [confirmation(id, { replacementAttemptNo: ordinal, prepareIdempotencyKey: key })]);
  }
  await diff('replacement order then binary ID ties', CONF, 'listReceiptsByPrepare', [confirm]);
  await diff('actor/command spans prepare keys and honors fractional limit', CONF, 'listReceiptsByActorCommand', [{ ...confirm, limit: 2.9 }]);
  await diff('zero limit short circuit', CONF, 'listReceiptsByActorCommand', [{ ...confirm, limit: 0 }]);
  await diff('no leakage to other actor', CONF, 'listReceiptsByActorCommand', [{ ...confirm, actorId: 'other' }]);
  const consuming = { receiptId: confirm.receiptId, owner: 'old', leaseUntil: 10, at: 2 };
  const first = await diff('initial confirmation consumption fence', CONF, 'startConsumption', [consuming]);
  await diff('unexpired confirmation lease excludes duplicates', CONF, 'takeOverExpiredConsumptionLease', [{ ...consuming, at: 9 }]);
  const next = await diff('confirmation takeover at claim expiry', CONF, 'takeOverExpiredConsumptionLease',
    [{ ...consuming, owner: 'new', at: 10, leaseUntil: 20 }]);
  await diff('old confirmation settlement refused', CONF, 'settleConsumption', [{ ...consuming, ...first, status: 'spent' }],
    'VICT_CONFIRMATION_FENCE_CONFLICT');
  await diff('old confirmation release refused', CONF, 'releaseConsumption', [{ ...consuming, ...first }], 'VICT_CONFIRMATION_FENCE_CONFLICT');
  await diff('current confirmation release is retryable', CONF, 'releaseConsumption', [{ ...consuming, ...next }]);
  const final = await diff('released confirmation advances counter on re-claim', CONF, 'startConsumption', [{ ...consuming, at: 12 }]);
  await diff('settle spent, durable non-replayable effect authority', CONF, 'settleConsumption',
    [{ ...consuming, ...final, status: 'spent', consumedByKey: 'consume', at: 13 }]);
  await diff('spent confirmation is settled for any new claim', CONF, 'startConsumption', [consuming]);
  await diff('expiry equality lazily records terminal state', CONF, 'startConsumption', [{ ...consuming, receiptId: 'Z', at: 50 }]);
  await diff('expired receipt remains visible', CONF, 'getReceipt', ['Z']);
  await diff('missing consumption claim', CONF, 'startConsumption', [{ ...consuming, receiptId: 'missing' }]);
  await diff('missing settlement fails with distinct error', CONF, 'releaseConsumption',
    [{ ...consuming, receiptId: 'missing', fenceToken: 'missing' }], 'VICT_CONFIRMATION_RECEIPT_MISSING');

  assert.equal(new Set(evidence.receiptDifferential.map(({ port }) => port)).size, 31);
}

function poolOf(store) {
  return store.coordination.pool;
}

async function concurrency({ oracle, observer, provision, candidate, evidence, save }) {
  const namespace = 'vhost004-races';
  await provision(namespace);
  await provision('vhost004-other');
  const [left, right, outsider] = await Promise.all([
    candidate(namespace, { maxConnections: 4 }), candidate(namespace, { maxConnections: 4 }), candidate('vhost004-other')
  ]);
  const results = {};
  const race = (run, count = 12) => Promise.all(Array.from({ length: count }, (_, i) =>
    outcome(() => run(i % 2 ? left : right, i))));
  const onlyOne = (observed, winning, losingCode) => {
    assert.equal(observed.filter(winning).length, 1);
    if (losingCode) assert.equal(observed.filter((item) => item.error?.code === losingCode).length, observed.length - 1);
  };
  try {
    results.slots = await race((store) =>
      store.invocations.allocateTurnToolSlot({ turnId: 'racing-turn', toolName: 'test', argDigest: 'same' }));
    assert(results.slots.every(({ result }) => result?.slot === 1));
    results.distinctSlots = await race((store, n) =>
      store.invocations.allocateTurnToolSlot({ turnId: 'racing-turn', toolName: 'test', argDigest: 'key-' + n }));
    assert.deepEqual(results.distinctSlots.map(({ result }) => result.slot).sort((a, b) => a - b),
      Array.from({ length: 12 }, (_, i) => i + 2));
    results.intents = await race((store, i) =>
      store.invocations.recordInvocationIntent(invocation('race-' + i, 'same-invocation-key')));
    const winner = results.intents[0].result;
    assert(results.intents.every(({ result }) => result?.invocationId === winner.invocationId));
    assert.equal((await left.invocations.listInvocationsForTurn('turn')).length, 1);
    await assert.rejects(right.invocations.recordInvocationIntent({
      ...invocation('never-written', 'same-invocation-key'), argDigest: 'conflicting-digest'
    }), { code: 'VICT_CONTROL_INVOCATION_KEY_COLLISION' });
    assert.equal(await left.invocations.getInvocation('never-written'), undefined);
    assert.deepEqual(await right.invocations.getInvocation(winner.invocationId), winner);
    assert.equal(await outsider.invocations.getInvocation(winner.invocationId), undefined);

    results.invocationClaims = await race((store, i) => store.invocations.claimInvocationRun({
      invocationId: winner.invocationId, ownerIdentity: 'owner-' + i, fenceToken: 'fence-' + i, at: 10
    }));
    onlyOne(results.invocationClaims, ({ result }) => result?.status === 'running', 'VICT_CONTROL_INVOCATION_OWNER_ACTIVE');
    const running = await left.invocations.getInvocation(winner.invocationId);
    const unknown = await right.invocations.reconcileAbandonedRun({
      invocationId: winner.invocationId, observedFenceToken: running.runFenceToken, reconciledFenceToken: 'reconciled', at: 11
    });
    assert.equal(unknown.runGeneration, 2);
    assert.equal(unknown.status, 'outcome_unknown');
    await assert.rejects(left.invocations.settleInvocationRun({
      invocationId: winner.invocationId, fenceToken: running.runFenceToken, status: 'completed', at: 12
    }), { code: 'VICT_CONTROL_INVOCATION_FENCE_MISMATCH' });

    results.approvalCreates = await race((store, i) => store.approvals.createPendingApproval(approval('race-approval-' + i)));
    const approvalId = results.approvalCreates[0].result.approvalId;
    assert(results.approvalCreates.every(({ result }) => result?.approvalId === approvalId));
    assert.equal((await left.approvals.listOpenApprovals()).length, 1);
    results.approvalDecideExpire = await race((store, i) => i % 2
      ? store.approvals.expireApproval({ approvalId, at: 10 })
      : store.approvals.decideApproval({ approvalId, approverActorId: 'approver', decision: 'declined', decidedAt: 10 }));
    const decided = await right.approvals.getApproval(approvalId);
    assert(['declined', 'expired'].includes(decided.status));
    for (const [i, item] of results.approvalDecideExpire.entries()) {
      if ((i % 2 && decided.status === 'expired') || (!(i % 2) && decided.status === 'declined')) {
        assert.deepEqual(item.result, decided);
      } else {
        assert.equal(item.error.code, i % 2 ? 'VICT_CONTROL_APPROVAL_INVALID_STATE' : 'VICT_CONTROL_APPROVAL_EXPIRED');
      }
    }

    const cmd = command(oracle.runtime);
    results.commandClaims = await race((store, i) => store.commandIdempotency.claimReceipt({ ...cmd, requestDigest: 'digest-' + i }));
    onlyOne(results.commandClaims, ({ result }) => result === 'claimed');
    const durable = await left.commandIdempotency.getReceipt(cmd);
    assert.equal(durable.requestDigest, 'digest-' + results.commandClaims.findIndex(({ result }) => result === 'claimed'));
    results.commandTakeovers = await race((store, i) => store.commandIdempotency.takeOverExpiredLease({
      ...cmd, owner: 'takeover-' + i, leaseUntil: 20, at: 10
    }));
    onlyOne(results.commandTakeovers, ({ result }) => result?.outcome === 'taken');
    const claimed = await right.commandIdempotency.getReceipt(cmd);
    assert.equal(claimed.attempts, 2);
    await assert.rejects(left.commandIdempotency.completeReceipt({ ...cmd, resultJson: '{}', at: 11 }),
      { code: 'VICT_IDEMPOTENCY_FENCE_CONFLICT' });
    assert.deepEqual(await left.commandIdempotency.getReceipt(cmd), claimed);

    const confirm = confirmation();
    results.confirmationCreates = await race((store) => store.commandConfirmationReceipts.createReceipt(confirm));
    onlyOne(results.confirmationCreates, ({ result }) => result === 'created');
    const take = (store, owner, at, leaseUntil) =>
      store.commandConfirmationReceipts.startConsumption({ receiptId: confirm.receiptId, owner, at, leaseUntil });
    results.confirmationClaims = await race((store, i) => take(store, 'first-' + i, 1, 10));
    onlyOne(results.confirmationClaims, ({ result }) => result?.outcome === 'claimed');
    assert.equal(results.confirmationClaims.filter(({ result }) => result?.outcome === 'in-progress').length, 11);
    const first = await left.commandConfirmationReceipts.getReceipt(confirm.receiptId);
    results.confirmationTakeovers = await race((store, i) => take(store, 'new-' + i, 10, 20));
    onlyOne(results.confirmationTakeovers, ({ result }) => result?.outcome === 'claimed');
    const current = await right.commandConfirmationReceipts.getReceipt(confirm.receiptId);
    assert.equal(current.attempts, 2);
    const settlement = { receiptId: confirm.receiptId, at: 11, status: 'consumed', consumedByKey: 'consume' };
    await assert.rejects(left.commandConfirmationReceipts.settleConsumption({ ...settlement, fenceToken: first.fenceToken }),
      { code: 'VICT_CONFIRMATION_FENCE_CONFLICT' });
    await right.commandConfirmationReceipts.settleConsumption({ ...settlement, fenceToken: current.fenceToken });
    assert.deepEqual(await take(left, 'other', 12, 22), { outcome: 'settled' });

    const lease = await left.coordination.acquire({ scopeId: 'slice', actorId: 'actor', ownerId: 'worker', leaseMs: 60_000 });
    assert.equal(lease.status, 'acquired');
    const scoped = left.forLease(lease.lease);
    assert.deepEqual(await scoped.invocations.getInvocation(winner.invocationId), unknown);
    await observer.query('UPDATE vhost003_indexed.namespaces SET writer_epoch=2 WHERE namespace=$1', [namespace]);
    const stale = [
      scoped.invocations.recordInvocationIntent(invocation('epoch', 'epoch')),
      scoped.approvals.createPendingApproval(approval('epoch', 'epoch')),
      scoped.commandIdempotency.claimReceipt(command(oracle.runtime, { idempotencyKey: 'epoch' })),
      scoped.commandConfirmationReceipts.createReceipt(confirmation('epoch'))
    ];
    const fences = await Promise.allSettled(stale);
    assert(fences.every(({ status, reason }) => status === 'rejected' && reason.code === 'HOSTED_FENCED'));
    const reopened = await candidate(namespace, { writerEpoch: 2 });
    try {
      await assert.rejects(reopened.forLease(lease.lease).invocations.getInvocation(winner.invocationId), { code: 'HOSTED_FENCED' });
      assert.deepEqual(await reopened.invocations.getInvocation(winner.invocationId), unknown);
      assert.equal(await reopened.invocations.getInvocation('epoch'), undefined);
      assert.equal(await reopened.approvals.getApproval('epoch'), undefined);
      assert.equal(await reopened.commandIdempotency.getReceipt({ ...cmd, idempotencyKey: 'epoch' }), undefined);
      assert.equal(await reopened.commandConfirmationReceipts.getReceipt('epoch'), undefined);
    } finally {
      await reopened.close();
    }
    evidence.receiptConcurrency = { peers: 2, namespaceIsolation: true, epochFencedPorts: 4, results };
    await save();
  } finally {
    await Promise.all([left.close(), right.close(), outsider.close()]);
  }
}

async function interposeCommit(store, interceptor, work) {
  const pool = poolOf(store);
  const originalConnect = pool.connect;
  const queries = new Map();
  let injected = false;
  pool.connect = async function () {
    const client = await originalConnect.call(this);
    if (queries.has(client)) return client;
    const originalQuery = client.query;
    queries.set(client, originalQuery);
    client.query = function (sql, ...args) {
      const run = () => originalQuery.call(this, sql, ...args);
      if (sql !== 'COMMIT' || injected) return run();
      injected = true;
      return interceptor(this, run);
    };
    return client;
  };
  try {
    await assert.rejects(work(), { code: 'HOSTED_DATABASE_UNAVAILABLE' });
    assert(injected);
  } finally {
    pool.connect = originalConnect;
    for (const [client, query] of queries) client.query = query;
  }
}

async function faults({ oracle, observer, provision, candidate, evidence, save }) {
  const namespace = 'vhost004-commit';
  await provision(namespace);
  const writer = await candidate(namespace, { maxConnections: 1 });
  const reader = await candidate(namespace);
  const cmd = command(oracle.runtime);
  const claim = { invocationId: 'invoke', fenceToken: 'before-loss', ownerIdentity: 'worker', at: 2 };
  const loss = async (_client, commit) => {
    await commit(); // actual server COMMIT; hide its successful response at the driver seam
    throw Object.assign(new Error('synthetic acknowledgement loss'), { code: 'ECONNRESET' });
  };
  try {
    await writer.invocations.recordInvocationIntent(invocation());
    await writer.commandIdempotency.claimReceipt(cmd);
    await writer.commandConfirmationReceipts.createReceipt(confirmation());
    await interposeCommit(writer, loss, () => writer.invocations.claimInvocationRun(claim));
    await assert.rejects(reader.invocations.claimInvocationRun(claim), { code: 'VICT_CONTROL_INVOCATION_OWNER_ACTIVE' });
    const running = await reader.invocations.getInvocation(claim.invocationId);
    assert.equal(running.runFenceToken, claim.fenceToken);
    await interposeCommit(writer, loss, () => writer.commandIdempotency.completeReceipt({
      ...cmd, resultJson: '{"effect":"once"}', at: 3
    }));
    const consumption = { receiptId: 'confirm', owner: 'worker', at: 4, leaseUntil: 20 };
    const { fenceToken } = await writer.commandConfirmationReceipts.startConsumption(consumption);
    await interposeCommit(writer, loss, () => writer.commandConfirmationReceipts.settleConsumption({
      receiptId: 'confirm', fenceToken, at: 5, status: 'spent', consumedByKey: 'synthetic-consume'
    }));
    const killed = [];
    await interposeCommit(writer, async (client, commit) => {
      const { rows: [row] } = await observer.query('SELECT pg_terminate_backend($1, 1000) AS gone', [client.processID]);
      assert(row.gone);
      killed.push(client.processID);
      return commit();
    }, () => writer.invocations.allocateTurnToolSlot({ turnId: 'lost', toolName: 'test', argDigest: 'killed' }));
    assert.equal(killed.length, 1);
    // If the counter committed even though the slot disappeared, this new
    // allocation would be 2. The interrupted transaction loses both writes.
    const nextSlot = await writer.invocations.allocateTurnToolSlot({ turnId: 'lost', toolName: 'test', argDigest: 'after' });
    assert.equal(nextSlot.slot, 1);
    const backend = await writer.coordination.pool.query('SELECT pg_backend_pid() AS pid');
    assert.notEqual(backend.rows[0].pid, killed[0]);
    await writer.close();
    const reconnected = await candidate(namespace);
    try {
      const commandRecord = await reconnected.commandIdempotency.getReceipt(cmd);
      const confirmationRecord = await reconnected.commandConfirmationReceipts.getReceipt('confirm');
      assert.equal(commandRecord.resultJson, '{"effect":"once"}');
      assert.equal(commandRecord.status, 'completed');
      assert.equal(await reconnected.commandIdempotency.claimReceipt(cmd), 'exists');
      assert.equal(confirmationRecord.status, 'spent');
      assert.deepEqual(await reconnected.commandConfirmationReceipts.startConsumption(consumption), { outcome: 'settled' });
      const unknown = await reconnected.invocations.reconcileAbandonedRun({
        invocationId: claim.invocationId, observedFenceToken: claim.fenceToken, reconciledFenceToken: 'recovery', at: 30
      });
      assert.equal(unknown.status, 'outcome_unknown');
      await assert.rejects(reconnected.invocations.claimInvocationRun(claim), { code: 'VICT_CONTROL_INVOCATION_TERMINAL' });
      evidence.receiptFaults = {
        acknowledgementLoss: { injectedAfterRealCommit: 3, commandRecord, confirmationRecord, unknown },
        databaseTerminationBeforeCommit: { killed, newBackend: backend.rows[0].pid, nextSlot: nextSlot.slot }
      };
      await save();
    } finally {
      await reconnected.close();
    }
  } finally {
    await Promise.all([writer.close(), reader.close()]);
  }
}

export async function checkReceipts(context) {
  const { oracle, provision, candidate, legacy, evidence, save } = context;
  const namespace = 'vhost004-differential';
  await provision(namespace);
  const [old, indexed] = await Promise.all([legacy(namespace, { migrate: true }), candidate(namespace)]);
  evidence.receiptDifferential = [];
  try {
    await differential(old, indexed, oracle.runtime, evidence, save);
  } finally {
    await Promise.all([old.close(), indexed.close()]);
  }
  await concurrency(context);
  await faults(context);
  await servicePolicy(context);
  await observeLegacyReleaseFence(context);
}

async function servicePolicy({ oracle, provision, candidate, legacy, evidence, save }) {
  const namespace = 'vhost004-dispatch';
  await provision(namespace);
  const old = await legacy(namespace, { migrate: true });
  const indexed = await candidate(namespace);
  const { runtime, VictCommandService } = oracle;
  const actor = { actorId: 'operator', scopes: ['run.cancel', 'app.data.write'] };
  const denied = { actorId: 'unprivileged', scopes: [] };

  async function run(store) {
    const control = new runtime.InMemoryControlPlaneStore();
    let now = 1000;
    let suppressSettlement = false;
    const storePorts = {
      ...store, control,
      commandConfirmationReceipts: {
        ...store.commandConfirmationReceipts,
        settleConsumption: async (input) => {
          if (suppressSettlement) throw new Error('Synthetic interruption before confirmation settlement');
          return store.commandConfirmationReceipts.settleConsumption(input);
        }
      }
    };
    const execution = { getRun: async () => ({ recordRevision: 7 }) };
    const transcript = {};
    let effects = 0;
    let signalEntered;
    let releaseEffect;
    const entered = new Promise((resolve) => { signalEntered = resolve; });
    const hold = new Promise((resolve) => { releaseEffect = resolve; });
    const opts = {
      stores: storePorts, execution, clock: () => now, idempotencyLeaseMs: 1000,
      controlPlane: { cancelRun: async ({ runId }) => {
        effects++;
        signalEntered();
        await hold;
        return { runId, status: 'cancelled' };
      } }
    };
    const service = new VictCommandService({ ...opts, idempotencyOwner: 'one' });
    const peer = new VictCommandService({ ...opts, idempotencyOwner: 'two' });
    const prepare = {
      command: 'run.cancel', payload: { runId: 'synthetic-run', reasonCode: 'fixture', expectedRevision: 7 },
      idempotencyKey: 'prepare-key'
    };
    const prepared = await service.prepareConfirmation(actor, prepare);
    assert(prepared.ok, JSON.stringify(prepared));
    const receiptId = prepared.data.receiptId;
    transcript.prepare = await service.prepareConfirmation(actor, prepare);
    assert.equal(transcript.prepare.data.receiptId, receiptId);
    transcript.conflictingPrepare = await peer.prepareConfirmation(actor, {
      ...prepare, payload: { ...prepare.payload, reasonCode: 'different' }
    });
    assert.deepEqual(transcript.conflictingPrepare, { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' });
    const request = {
      command: 'run.cancel',
      payload: { runId: 'synthetic-run', reasonCode: 'fixture', confirmation: { receiptId } },
      idempotencyKey: 'consume-key'
    };
    transcript.scopeDenied = await outcome(() => service.dispatch(denied, request));
    assert.equal(transcript.scopeDenied.error.code, 'VICT_ACTOR_SCOPE_DENIED');
    transcript.notOwned = await service.getConfirmationStatus({ ...actor, actorId: 'other-operator' }, receiptId);
    assert.deepEqual(transcript.notOwned, { ok: false, code: 'VICT_CONFIRMATION_UNAVAILABLE' });

    const original = await store.commandConfirmationReceipts.getReceipt(receiptId);
    transcript.confirmationMismatch = await service.dispatch(actor, {
      ...request, payload: { ...request.payload, reasonCode: 'different' }
    });
    assert.deepEqual(transcript.confirmationMismatch, { ok: false, code: 'VICT_CONFIRMATION_MISMATCH' });
    assert.deepEqual(await store.commandConfirmationReceipts.getReceipt(receiptId), original);
    assert.equal(await store.commandIdempotency.getReceipt({ actorId: actor.actorId,
      command: request.command, idempotencyKey: request.idempotencyKey }), undefined);

    const completing = service.dispatch(actor, request);
    try {
      // Fail immediately on an earlier dispatcher error, before waiting for
      // the synthetic callback barrier, so failed trials always retain evidence.
      await Promise.race([entered, completing.then((result) => {
        throw new Error('Effect callback was not entered: ' + JSON.stringify(result));
      })]);
      transcript.duplicateWhilePending = await peer.dispatch(actor, request);
      assert.deepEqual(transcript.duplicateWhilePending, { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS' });
    } finally {
      releaseEffect();
      transcript.first = await completing;
    }
    transcript.replay = await peer.dispatch(actor, request);
    assert(transcript.replay.ok);
    assert.equal(effects, 1);
    transcript.changedAfterSettle = await peer.dispatch(actor, { ...request,
      payload: { ...request.payload, reasonCode: 'different' } });
    assert.deepEqual(transcript.changedAfterSettle, { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' });
    transcript.anotherConsumeKey = await peer.dispatch(actor, { ...request, idempotencyKey: 'different-consume' });
    assert.deepEqual(transcript.anotherConsumeKey, { ok: false, code: 'VICT_CONFIRMATION_SPENT' });
    transcript.recorded = await store.commandConfirmationReceipts.getReceipt(receiptId);
    assert.equal(transcript.recorded.status, 'consumed');
    transcript.crossCommandReuse = await peer.dispatch(actor, {
      command: 'app.data.mutate', payload: { resourceId: 'resource', releaseVersion: 'version' },
      idempotencyKey: request.idempotencyKey
    });
    assert.deepEqual(transcript.crossCommandReuse, { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' });

    // The authoritative result commits before the separate confirmation
    // settlement. Skip that second database call once, then replay after
    // the consumption lease expires. The replay must converge without
    // another domain effect.
    const nextPrepared = await service.prepareConfirmation(actor, { ...prepare, idempotencyKey: 'gap-prepare' });
    assert(nextPrepared.ok);
    const nextId = nextPrepared.data.receiptId;
    const nextRequest = { ...request, payload: { ...request.payload, confirmation: { receiptId: nextId } },
      idempotencyKey: 'gap-consume' };
    suppressSettlement = true;
    try {
      transcript.gapFirst = await service.dispatch(actor, nextRequest);
      assert(transcript.gapFirst.ok);
    } finally {
      suppressSettlement = false;
    }
    const intermediate = await store.commandConfirmationReceipts.getReceipt(nextId);
    assert.equal(intermediate.status, 'prepared');
    const storedResult = await store.commandIdempotency.getReceipt({
      actorId: actor.actorId, command: nextRequest.command, idempotencyKey: nextRequest.idempotencyKey
    });
    assert.equal(storedResult.status, 'completed');
    now = intermediate.claimUntil;
    transcript.gapReplay = await peer.dispatch(actor, nextRequest);
    assert(transcript.gapReplay.ok);
    const converged = await store.commandConfirmationReceipts.getReceipt(nextId);
    assert.equal(converged.status, 'consumed');
    assert.equal(converged.attempts, 2);
    assert.equal(effects, 2);
    transcript.gap = { resultStatus: storedResult.status, intermediate, converged };
    return { ...transcript, effects };
  }
  try {
    const expected = await run(old);
    const observed = await run(indexed);
    evidence.dispatcherPolicy = { expected, observed };
    await save();
    assert.deepEqual(observed, expected);
  } finally {
    await Promise.all([old.close(), indexed.close()]);
  }
}

async function observeLegacyReleaseFence({ oracle, provision, candidate, legacy, evidence, save }) {
  const namespace = 'vhost004-release-reclaim';
  await provision(namespace);
  const old = await legacy(namespace, { migrate: true });
  const indexed = await candidate(namespace);
  const receipt = command(oracle.runtime);
  async function observe(store) {
    assert.equal(await store.commandIdempotency.claimReceipt(receipt), 'claimed');
    await store.commandIdempotency.releaseReceipt({ ...receipt, at: 2 });
    assert.equal(await store.commandIdempotency.claimReceipt(receipt), 'claimed');
    const fresh = await store.commandIdempotency.getReceipt(receipt);
    return { legacyReissuedSameFence: fresh.fenceToken === receipt.fenceToken, attempts: fresh.attempts };
  }
  try {
    const expected = await observe(old);
    const observed = await observe(indexed);
    assert.deepEqual(observed, expected);
    assert(expected.legacyReissuedSameFence);
    evidence.releaseReclaimCompatibility = { expected, observed };
    await save();
  } finally {
    await Promise.all([old.close(), indexed.close()]);
  }
}

export async function compareReceiptTraffic(context) {
  const { oracle, observer, legacy, candidate, evidence, samples, save } = context;
  evidence.receiptTraffic = [];
  for (const targetBytes of [100_000, 1_560_000]) {
    const namespace = 'synthetic-' + targetBytes;
    for (const [arm, open] of Object.entries({ legacy, candidate })) {
      const store = await open(namespace, {
        maxConnections: 4,
        maxStateNodes: arm === 'legacy' && targetBytes === 1_560_000 ? 300_000 : 100_000
      });
      try {
        const pool = monitorPool(poolOf(store));
        const key = 'traffic-invocation-key';
        await store.invocations.recordInvocationIntent(invocation('traffic-invoke', key));
        const commandReceipts = [];
        for (let i = 0; i < samples; i++) {
          const receipt = command(oracle.runtime, { idempotencyKey: 'traffic-command-' + i });
          commandReceipts.push(receipt);
          await store.commandIdempotency.claimReceipt(receipt);
          await store.commandConfirmationReceipts.createReceipt(confirmation('traffic-confirm-' + i));
        }
        const operations = {
          getInvocationByIdempotencyKey: async () => assert.equal(
            (await store.invocations.getInvocationByIdempotencyKey(key)).invocationId, 'traffic-invoke'),
          createPendingApproval: async (i) => assert.equal((await store.approvals.createPendingApproval(
            approval('traffic-approval-' + i, 'traffic-approval-invoke-' + i))).status, 'pending'),
          completeReceipt: async (i) => store.commandIdempotency.completeReceipt({
            ...commandReceipts[i], resultJson: '{"ok":true}', at: 5
          }),
          startConsumption: async (i) => assert.equal((await store.commandConfirmationReceipts.startConsumption({
            receiptId: 'traffic-confirm-' + i, owner: 'traffic', leaseUntil: 20, at: 5
          })).outcome, 'claimed')
        };
        for (const [method, run] of Object.entries(operations)) {
          const observed = await measure(observer, pool, run, samples, 8);
          evidence.receiptTraffic.push({ arm, targetBytes, method, ...observed });
          await save();
          assert(observed.rows.every(({ failure }) => !failure), arm + ' ' + method);
          assert(observed.rows.every(({ statements }) => arm === 'candidate'
            ? !statements.snapshotRead && !statements.snapshotWrite
            : statements.snapshotRead?.calls === 1));
        }
      } finally {
        await store.close();
      }
    }
  }
  await receiptPlans(context);
}

async function receiptPlans({ oracle, observer, provision, candidate, evidence, save }) {
  const namespace = 'vhost004-plan';
  await provision(namespace);
  const store = await candidate(namespace, { maxConnections: 4 });
  try {
    const expected = [];
    for (let i = 0; i < 160; i++) {
      const group = i < 144 ? 'paged' : 'unrelated';
      const id = 'record-' + String(i).padStart(4, '0');
      if (group === 'paged') expected.push(id);
      await store.commandConfirmationReceipts.createReceipt(confirmation(id, { prepareIdempotencyKey: group }));
      await store.invocations.recordInvocationIntent(invocation(id, id, 'turn-' + i));
      await store.approvals.createPendingApproval(approval(id, 'approval-invoke-' + i));
      await store.commandIdempotency.claimReceipt(command(oracle.runtime, { idempotencyKey: id }));
    }
    const results = await store.commandConfirmationReceipts.listReceiptsByPrepare({
      actorId: 'actor', command: 'fixture', prepareIdempotencyKey: 'paged'
    });
    assert.deepEqual(results.map(({ receiptId }) => receiptId), expected);
    await observer.query('ANALYZE vhost003_indexed.tool_invocation; ANALYZE vhost003_indexed.agent_approval; ANALYZE vhost003_indexed.confirmation_receipt; ANALYZE vhost003_indexed.command_receipt');
    const entries = [
      ['invocation-key', 'tool_invocation', 'request_digest', 'request_key', 'record-0128', ''],
      ['invocation-turn', 'tool_invocation', 'turn_digest', 'turn_key', 'turn-128', 'ORDER BY key_prefix,key_bytes'],
      ['latest-approval', 'agent_approval', 'invocation_digest', 'invocation_key',
        'approval-invoke-128', 'ORDER BY id DESC LIMIT 1'],
      ['command-key', 'command_receipt', 'key_digest', 'key_bytes', ['actor', 'fixture', 'record-0128'].join('\0'), 'LIMIT 1'],
      ['command-actor-key', 'command_receipt', 'actor_request_digest', 'actor_request_key',
        JSON.stringify(['actor', 'record-0128']), 'ORDER BY id LIMIT 1'],
      ['confirmation-prepare', 'confirmation_receipt', 'prepare_digest', 'prepare_key',
        JSON.stringify(['actor', 'fixture', 'unrelated']), 'ORDER BY replacement_no,key_prefix,key_bytes']
    ];
    const plans = {};
    for (const [label, table, digestColumn, keyColumn, key, order] of entries) {
      const bytes = keyBytes(key);
      const { rows: [row] } = await observer.query(
        `EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) SELECT payload FROM vhost003_indexed.${table}
         WHERE namespace=$1 AND ${digestColumn}=$2 AND ${keyColumn}=$3 ${order}`, [namespace, hash(bytes), bytes]
      );
      plans[label] = row['QUERY PLAN'][0];
    }
    evidence.receiptPlans = { matchingCursorRows: results.length, otherPrepareRows: 16, plans };
    await save();
  } finally {
    await store.close();
  }
}
