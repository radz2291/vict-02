/**
 * Stage 06B final boundary correction — invocation attempt-fence crash
 * fixture (real process boundary).
 *
 * Usage (child process, under tsx):
 *   node --import tsx invocation-claim-worker.mts claim <db> <reportOut>
 *
 * `claim` seeds one durable turn + tool-invocation intent, CLAIMS the
 * attempt for a live owner (durable `running` under the attempt fence),
 * fsyncs the report file, and ONLY THEN emits the readiness sentinel
 * (`emitReady('claimed')`). The parent SIGKILLs the child right after the
 * sentinel — a genuine owner loss across a process life, with the durable
 * record left `running` under a fence whose owner no longer exists.
 */
import { closeSync, openSync, writeFileSync } from 'node:fs';
import { emitReady } from './readiness.js';
import { createSqliteAgentControlStores } from '../../src/index.js';

const [, , mode, dbPath, reportOut] = process.argv;

if (mode === 'claim') {
  const stores = createSqliteAgentControlStores({ path: dbPath });
  await stores.actors.upsert({
    actorId: 'actor-worker',
    status: 'active',
    roles: ['developer'],
    createdAt: 0,
  });
  const turnId = 'turn-crash-worker';
  await stores.turns.createTurnIntent({
    turnId,
    streamId: 'stream-crash-worker',
    threadId: 'thread-crash-worker',
    actorId: 'actor-worker',
    agentProfileVersion: 'v1_profile',
    activationVersion: undefined,
    applicationReleaseVersion: undefined,
    inputSummary: 'user-input:length=4',
    status: 'intent',
    createdAt: 1,
    updatedAt: 1,
    terminalAt: undefined,
    errorCode: undefined,
    traceId: undefined,
    victRunId: undefined,
    mastraRunId: undefined,
  });
  await stores.turns.startTurn(turnId, 2);
  const invocation = await stores.invocations.recordInvocationIntent({
    invocationId: 'inv-crash-worker',
    turnId,
    toolCallId: 'call-crash-worker',
    toolName: 'cap.notes.write',
    capabilityId: 'cap.notes.write',
    capabilityRevision: '3',
    effect: 'read',
    idempotencyKey: `${turnId}:call-crash-worker:cap.notes.write:3:digest-worker`,
    actorId: 'actor-worker',
    argDigest: 'digest-worker',
    argumentSummary: 'object(1 fields)',
    status: 'intent',
    createdAt: 3,
    updatedAt: 3,
    completedAt: undefined,
    resultSummary: undefined,
    errorCode: undefined,
  });
  const claimed = await stores.invocations.claimInvocationRun({
    invocationId: invocation.invocationId,
    fenceToken: 'fence-crashed-child',
    ownerIdentity: 'vict-tool-bridge:crashed-child',
    at: 10,
  });
  // Fsync the report BEFORE the readiness sentinel: the parent can only
  // kill after the durable claim and the report both exist.
  const fd = openSync(reportOut, 'w');
  writeFileSync(
    fd,
    JSON.stringify({
      invocationId: claimed.invocationId,
      fenceToken: claimed.runFenceToken,
      generation: claimed.runGeneration,
      status: claimed.status,
    }),
  );
  closeSync(fd);
  stores.close();
  emitReady('claimed');
  // Stay alive until the parent SIGKILLs this process (the owner loss): an
  // active interval keeps the event loop occupied — an unsettled top-level
  // await would make Node self-exit with code 13.
  const heartbeat = setInterval(() => undefined, 60_000);
  void heartbeat;
} else {
  console.error(`unknown mode: ${String(mode)}`);
  process.exit(1);
}
