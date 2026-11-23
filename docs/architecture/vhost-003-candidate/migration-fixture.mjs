import { manifest, agentActivation } from './control-checks.mjs';
import { turn, event } from './checks.mjs';

const actorId = 'synthetic-actor';
export const request = (scopeId, ownerId = 'fixture-owner') =>
  ({ scopeId, actorId, ownerId, leaseMs: 60_000 });
export const commandName = { actorId, command: 'synthetic-command', idempotencyKey: 'command' };
export const runKeys = ['z-run', 'a-run'];
const activationFields = ({ graphId, graphVersion, capabilitySetVersion, activationVersion }) =>
  ({ graphId, graphVersion, capabilitySetVersion, activationVersion });

export async function seedLegacy(oracle, source, store) {
  const { runtime, snapshot } = oracle;
  const namespace = 'vhost011-full';
  const records = {};
  const a = await manifest(oracle, 'z-graph');
  const b = await manifest(oracle, 'a-graph');
  records.versions = [a.manifest.activationVersion, b.manifest.activationVersion];
  for (const activation of [a, b]) await store.catalog.publish(activation);
  await store.catalog.select({ graphId: a.manifest.graphId, activationVersion: records.versions[0], operationId: 'select' });
  for (const runId of runKeys) {
    const fields = { ...activationFields(a.manifest), runId };
    await store.execution.createRun({ ...fields, mode: 'normal', retention: 'summary', timestamp: 10,
      currentNodeId: 'n1', events: [{ ...fields, seq: 0, timestamp: 10, type: 'run.started' }] });
    if (runId === runKeys[0]) {
      await store.execution.commitTransition({ runId, expectedRecordRevision: 1, expectedNextEventSeq: 1,
        timestamp: 11, next: { status: 'completed' }, events: [{ ...fields, seq: 1, timestamp: 11, type: 'run.completed' }] });
    }
    await store.orchestration.createOrchestrationRun({ ...fields, mode: 'normal', retention: 'summary', now: 12,
      entryNodeId: 'n1', rootTokenId: 'token-' + runId, checkpoint: { syntheticPrivateCheckpoint: runId },
      events: [{ ...fields, timestamp: 12, type: 'run.started' }] });
    const { claim } = await store.orchestration.claimReadyToken({
      runId, ownerId: 'orchestration-owner', now: 13, leaseExpiresAt: 21, planner: {
        planFor: () => ({ capabilityId: 'cap.a', effectClass: 'pure', deadlineAt: null, idempotencyKey: null }),
        invocationIdFor: (token) => 'inv-' + token.tokenId,
        attemptIdFor: (token, attempt) => 'att-' + token.tokenId + '-' + attempt
      }
    });
    if (runId === runKeys[0]) {
      await store.orchestration.completeAttempt({ runId, ownerId: claim.attempt.ownerId,
        attemptId: claim.attempt.attemptId, expectedAttemptFence: claim.attempt.fence, now: 14,
        outcome: { kind: 'completed', outputSummary: { kind: 'null' } },
        continuation: { kind: 'wait', wait: { waitId: 'wait', nodeId: 'n1', kind: 'signal', signalName: 'go',
          contractId: 'fixture', contractRevision: '1', dueAt: null, timeoutAt: 30 } }, events: [],
        run: { status: 'waiting' }
      });
      await store.orchestration.signalWait({ runId, waitId: 'wait', signalId: 'id', signalName: 'go', payload: 'resume',
        expectedWaitRevision: 1, commandHash: 'hash', now: 15, events: [] });
    }
  }
  const fork = { ...activationFields(a.manifest), runId: 'fork-run' };
  await store.orchestration.createOrchestrationRun({ ...fork, now: 15, mode: 'normal', retention: 'summary',
    rootTokenId: 'root', entryNodeId: 'fork', events: [], checkpoint: 'private-root' });
  const claimNext = async () => (await store.orchestration.claimReadyToken({
    runId: fork.runId, ownerId: 'fork-owner', now: 16, leaseExpiresAt: 31, planner: {
      planFor: () => ({ capabilityId: 'cap.a', effectClass: 'pure', deadlineAt: null, idempotencyKey: null }),
      invocationIdFor: (token) => 'inv-' + token.tokenId,
      attemptIdFor: (token, number) => 'att-' + token.tokenId + '-' + number
    }
  })).claim;
  const complete = (claim, continuation, more = {}) => store.orchestration.completeAttempt({
    runId: fork.runId, ownerId: claim.attempt.ownerId, attemptId: claim.attempt.attemptId,
    expectedAttemptFence: claim.attempt.fence, now: 17, continuation,
    outcome: { kind: 'completed', outputSummary: { kind: 'null' } }, run: { status: 'running' }, events: [], ...more
  });
  await complete(await claimNext(), { kind: 'fork', joinId: 'join', children: ['a', 'z'].map((branchKey) => ({
    branchKey, toNodeId: 'branch-' + branchKey, forkId: 'root-fork', lineage: 'fork/' + branchKey,
    tokenId: 'branch-' + branchKey
  })) });
  for (const key of ['a','z']) {
    const branch = await claimNext();
    if (branch.token.branchKey !== key) throw new Error('Synthetic fork claim order changed');
    await complete(branch, { kind: 'branchArrival', forkId: 'root-fork', joinId: 'join', branchKey: key,
      joinContinuation: { tokenId: 'joined', toNodeId: 'join', lineage: 'fork' } },
    { declaredBranchKeys: ['z','a'], branchOutput: { syntheticOutput: key } });
  }
  const joined = await claimNext();
  await store.orchestration.recoverAttempt({ runId: fork.runId, attemptId: joined.attempt.attemptId,
    expectedAttemptFence: joined.attempt.fence, now: 34, action: { kind: 'block', code: 'LOST', reason: 'fixture' }, events: [] });
  const revision = (await store.orchestration.getOrchestrationRun(fork.runId)).recordRevision;
  await store.orchestration.resolveBlocked({ runId: fork.runId, resolutionId: 'retry', action: 'retry', reasonCode: 'RETRY',
    commandHash: 'retry-hash', expectedRunRevision: revision, now: 35, events: [] });
  await store.orchestration.requestCancellation({ runId: fork.runId, requestId: 'cancel', reasonCode: 'STOP',
    commandHash: 'cancel-hash', now: 36, events: [] });

  await store.actors.upsert({ actorId, status: 'active', roles: ['viewer'], createdAt: 1 });
  const oddKeys = ['turn-\ud800', 'turn-\ufffd', 'turn-\0'];
  for (const id of oddKeys) await store.turns.createTurnIntent(turn(id));
  await store.turns.recordCancelIntent({ turnId: 'cancel-only', cancelId: 'z', actorId, reasonCode: 'stop', at: 1 });
  await store.turns.recordCancelIntent({ turnId: 'cancel-only', cancelId: 'a', actorId, reasonCode: 'stop', at: 2 });
  for (const [i, kind] of ['response.started', 'text.delta', 'response.started', 'text.delta'].entries()) {
    await store.streamLedger.appendEvent(event('stream', 'valid-turn', i + 1, kind));
  }
  await store.streamLedger.appendEvent(event('transient', 'valid-turn', 1, 'text.delta'));
  await store.invocations.allocateTurnToolSlot({ turnId: oddKeys[0], toolName: 'fixture', argDigest: 'unlinked' });
  await store.invocations.allocateTurnToolSlot({ turnId: oddKeys[0], toolName: 'fixture', argDigest: 'linked' });
  const inv = { invocationId: 'invocation', turnId: oddKeys[0], actorId, toolName: 'fixture', argDigest: 'linked',
    idempotencyKey: 'request', status: 'intent', createdAt: 1, updatedAt: 1 };
  await store.invocations.recordInvocationIntent(inv);
  const approval = { approvalId: 'z-approval', invocationId: inv.invocationId, turnId: inv.turnId, actorId,
    toolName: inv.toolName, argDigest: inv.argDigest, status: 'pending', createdAt: 1, expiresAt: 10 };
  await store.approvals.createPendingApproval(approval);
  await store.approvals.decideApproval({ approvalId: approval.approvalId, approverActorId: 'reviewer',
    decision: 'approved', decidedAt: 3 });
  await store.approvals.createPendingApproval({ ...approval, approvalId: 'a-approval' });

  const cmd = { ...commandName, requestDigest: 'request', status: 'pending', owner: 'old', leaseUntil: 10,
    attempts: 1, createdAt: 1 };
  const lostFence = runtime.commandIdempotencyFenceToken({ ...cmd, idempotencyKey: 'released-before-capture' });
  const retired = { ...cmd, idempotencyKey: 'released-before-capture', fenceToken: lostFence };
  await store.commandIdempotency.claimReceipt(retired);
  await store.commandIdempotency.releaseReceipt({ ...retired, at: 2 });
  records.retiredFence = lostFence;
  const active = { ...cmd, fenceToken: runtime.commandIdempotencyFenceToken(cmd) };
  await store.commandIdempotency.claimReceipt(active);
  records.activeCommand = active.fenceToken;
  const confirmation = { receiptId: 'confirm', actorId, command: 'synthetic-command', payloadDigest: 'digest',
    subjectId: 'subject', expectedRevision: null, expiryAt: 100, status: 'prepared', createdAt: 1,
    replacementAttemptNo: 1, prepareIdempotencyKey: 'prepare', attempts: 0 };
  await store.commandConfirmationReceipts.createReceipt(confirmation);
  await store.commandConfirmationReceipts.startConsumption({ receiptId: 'confirm', owner: 'old', leaseUntil: 20, at: 2 });

  const change = { changesetId: 'change', schema: 'vict.changeset@1', authorActorId: actorId, createdAt: 1,
    base: { kind: 'release', subjectId: 'app', expectedVersion: 'none' }, operations: [], rationale: 'fixture',
    riskClass: 'low', requiredApproverCount: 1, expiresAt: 100, contentHash: 'content', status: 'proposed' };
  await store.control.saveChangeSet(change);
  for (const approverActorId of ['z', 'a']) {
    await store.control.recordChangeSetApproval({ approvalId: 'approval-' + approverActorId,
      changesetId: change.changesetId, approverActorId, decision: 'approved', contentHash: change.contentHash, decidedAt: 2 });
  }
  await store.control.recordControlRun({ runId: 'control-run', kind: 'validation', changesetId: 'change',
    contentHash: 'content', base: change.base, operations: [], runnerProfile: 'fixture', actorId, outcome: 'passed', createdAt: 3 });
  await store.control.recordOperationIntent({ changesetId: 'change', operationIndex: 0, operationKind: 'publish-release',
    operationDigest: 'digest', effectRef: 'effect', actorId, appliedAt: 0, state: 'prepared' });
  const release = { releaseVersion: 'release', applicationId: 'app', applicationVersion: '1', rendererIdentity: 'r',
    componentRegistryIdentity: 'c', dataAdapterIdentity: 'd', activationBinding: 'activation',
    publishedByActorId: actorId, publishedAt: 4, contentHash: 'release' };
  await store.control.publishRelease(release);
  await store.control.selectRelease({ applicationId: 'app', releaseVersion: 'release', actorId, at: 4,
    reason: 'select', operationId: 'select-release' });
  for (const auditId of ['z-audit', 'a-audit']) {
    await store.control.appendAuditEvent({ auditId, at: 5, actorId, action: 'release.selected', subjectType: 'release',
      subjectId: 'release', summary: 'fixture' });
  }

  const agent = agentActivation(runtime);
  await store.governance.saveAgentActivation(agent);
  records.agentActivation = agent.activationVersion;
  await store.governance.recordDeletionIntent({ intentId: 'deletion', conversationId: 'deleted', actorId, createdAt: 1,
    state: 'pending', receipts: [] });
  await store.governance.recordDeletionReceipt('deletion','application-domain', 3);
  await store.governance.updateDeletionIntentState('deletion','application-domain-deleted');
  const deletion = await store.coordination.tombstone(request('deleted'));
  await store.coordination.release(deletion);
  const work = (await store.coordination.acquire(request('held'))).lease;
  await store.coordination.beginEffect(work, 'uncertain-op', 'argument-digest');
  records.heldLease = work;

  // Legacy embeds a second orchestration collection that has no public
  // Postgres facade. Seed a distinct valid archival record by its pinned codec.
  const internal = runtime.createInMemoryOrchestrationStore();
  await internal.createOrchestrationRun({ ...activationFields(a.manifest), runId: 'archive-only', now: 6, mode: 'normal',
    retention: 'summary', rootTokenId: 'archive-token', entryNodeId: 'n1', events: [], checkpoint: { archival: true } });
  const { rows: [{ snapshot: outer }] } = await source.query(
    'SELECT snapshot FROM vhost003_indexed.operational WHERE namespace=$1', [namespace]
  );
  const vict = { activations: new Map(), selections: new Map(), runs: new Map(), orchestrationSnapshots: new Map() };
  snapshot.restoreRuntimeStoreSnapshot(outer.snapshots.vict, 'vict-stores@1', vict);
  vict.orchestrationSnapshots.set('orchestration', internal.exportSnapshot());
  outer.snapshots.vict = snapshot.captureRuntimeStoreSnapshot('vict-stores@1', vict);
  await source.query('UPDATE vhost003_indexed.operational SET snapshot=$2::jsonb,revision=revision+1 WHERE namespace=$1',
    [namespace, JSON.stringify(outer)]);
  return records;
}
