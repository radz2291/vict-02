#!/usr/bin/env node
/**
 * Stage 06B — SIGKILL fixture worker (real child process).
 *
 * Modes (one durable phase per process; every mode opens the SAME SQLite
 * database, so all durable records survive process death):
 *
 * - `setup-approval`: compose the full server over SQLite, then durably
 *   record a protected tool invocation intent + pending approval for a
 *   turn owned by `actor-user`, print a `PENDING` sentinel, and stay
 *   alive until the parent SIGKILLs it.
 * - `serve`: open the same database, run restart reconciliation, compose
 *   the server, print `READY <port>`, and serve HTTP until SIGKILLed.
 * - `resume`: reopen, reconcile, consume the approval with the EXACT
 *   binding, perform the "capability effect" (append an EFFECT line to the
 *   effects file), mark the invocation completed, then re-record the SAME
 *   logical invocation (deterministic idempotency key) and verify it does
 *   NOT execute twice. Prints `RESUMED` and exits.
 * - `verify`: reopen and print the durable state as one JSON line.
 *
 * All imports resolve through the installed workspace packages (dist), so
 * the child exercises the SAME shipped code paths as production wiring.
 */
import { appendFileSync, writeFileSync } from 'node:fs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}
const mode = args.get('--mode');
const dbPath = args.get('--db');
const readyFile = args.get('--ready-file');
const effectsFile = args.get('--effects');

const { createSqliteAgentControlStores } = await import('@vict/store-sqlite');
const { AgentStreamHub, createInMemoryStores, InMemoryActorDirectory } =
  await import('@vict/runtime');
const { ControlPlaneService, AgentTurnService, createControlPlaneSandboxSimulator } =
  await import('@vict/control');
const {
  createLocalTestAuthenticator,
  createServerAuthenticator,
  createVictHttpServer,
  listenVictHttpServer,
  VictCommandService,
} = await import('@vict/server');

const TOKENS = {
  'vict-test-token-user': 'actor-user',
  'vict-test-token-operator': 'actor-operator',
  'vict-test-token-approver': 'actor-approver',
};

const stores = createSqliteAgentControlStores({ path: dbPath });
const directory = new InMemoryActorDirectory();
for (const actorId of ['actor-user', 'actor-operator', 'actor-approver']) {
  await directory.upsert({
    actorId,
    status: 'active',
    roles:
      actorId === 'actor-user'
        ? ['developer', 'approver', 'operator', 'administrator']
        : actorId === 'actor-operator'
          ? ['operator']
          : ['approver'],
    createdAt: 0,
  });
}
const hub = new AgentStreamHub({ ledger: stores.streamLedger, clock: () => Date.now() });
const catalog = createInMemoryStores().catalog;
const controlPlane = new ControlPlaneService({
  stores,
  catalog,
  clock: () => Date.now(),
  simulator: createControlPlaneSandboxSimulator({ stores, catalog }),
});
const turnService = new AgentTurnService({
  stores,
  clock: () => Date.now(),
  ids: {
    turnId: () => 'turn-sk-1',
    streamId: () => 'stream-sk-1',
    invocationId: () => 'inv-sk-1',
    approvalId: () => 'appr-sk-1',
    idempotencyKey: () => 'idem-sk-1',
    cancelId: () => 'cancel-sk-1',
  },
});
const commandService = new VictCommandService({
  stores,
  controlPlane,
  turnService,
  clock: () => Date.now(),
});
const auth = createServerAuthenticator({
  authenticator: createLocalTestAuthenticator(TOKENS),
  directory,
});

/** Compose and listen; returns the bound port. */
async function serve() {
  await turnService.reconcileAfterRestart();
  const composed = createVictHttpServer({ commandService, auth, hub, stores });
  const port = await listenVictHttpServer(composed);
  return { composed, port };
}

// The logical protected invocation (stable across all phases).
const binding = {
  turnId: 'turn-sk-1',
  toolCallId: 'call-sk-1',
  toolName: 'cap_notes_write',
  capabilityId: 'cap.notes.write',
  capabilityRevision: 'rev-1',
  effect: 'write',
  actorId: 'actor-user',
  argDigest: 'digest-sk-1',
  argumentSummary: 'safe summary',
  agentProfileVersion: 'profile-sk-1',
};

if (mode === 'setup-approval') {
  const { port } = await serve();
  // Durable turn intent FIRST (VICT-authoritative), then the protected
  // invocation intent (deterministic idempotency key) and the durable
  // pending approval.
  const now = Date.now();
  await stores.turns.createTurnIntent({
    turnId: binding.turnId,
    streamId: 'stream-sk-1',
    threadId: 'thread-sk-1',
    actorId: binding.actorId,
    agentProfileVersion: binding.agentProfileVersion,
    activationVersion: undefined,
    applicationReleaseVersion: undefined,
    inputSummary: 'sigkill fixture turn',
    status: 'intent',
    createdAt: now,
    updatedAt: now,
    terminalAt: undefined,
    errorCode: undefined,
    traceId: undefined,
    victRunId: undefined,
    mastraRunId: undefined,
  });
  // Durable stream milestones (survive SIGKILL) plus one transient delta
  // (must NOT survive a restart).
  await hub.publish({
    streamId: 'stream-sk-1',
    turnId: binding.turnId,
    threadId: 'thread-sk-1',
    actorId: binding.actorId,
    agentProfileVersion: binding.agentProfileVersion,
    kind: 'response.started',
  });
  await hub.publish({
    streamId: 'stream-sk-1',
    turnId: binding.turnId,
    threadId: 'thread-sk-1',
    actorId: binding.actorId,
    agentProfileVersion: binding.agentProfileVersion,
    kind: 'text.delta',
    delta: 'transient',
  });
  await hub.publish({
    streamId: 'stream-sk-1',
    turnId: binding.turnId,
    threadId: 'thread-sk-1',
    actorId: binding.actorId,
    agentProfileVersion: binding.agentProfileVersion,
    kind: 'tool.started',
    toolCallId: 'call-sk-1',
    toolName: 'cap.notes.write',
  });
  // The turn moves intent → running (the model is 'executing') before the
  // protected tool request suspends it awaiting approval.
  await stores.turns.startTurn(binding.turnId, Date.now());
  const invocation = await turnService.recordToolInvocationIntent({ ...binding });
  const approval = await turnService.requestApproval({
    invocation,
    agentProfileVersion: binding.agentProfileVersion,
    expiresAt: Date.now() + 600_000,
  });
  writeFileSync(
    readyFile,
    `READY ${port}\nPENDING ${approval.approvalId} ${invocation.invocationId}\n`,
  );
  // Stay alive until SIGKILLed.
  setInterval(() => undefined, 10_000);
} else if (mode === 'serve') {
  const { port } = await serve();
  writeFileSync(readyFile, `READY ${port}\n`);
  setInterval(() => undefined, 10_000);
} else if (mode === 'resume') {
  const { port } = await serve();
  writeFileSync(readyFile, `READY ${port}\n`);
  const record = await stores.approvals.getApproval('appr-sk-1');
  if (record === undefined) {
    console.log('RESUMED-ERROR approval-missing');
    process.exit(4);
  }
  const decision = await turnService.consumeApproval({
    approvalId: 'appr-sk-1',
    actorId: binding.actorId,
    agentProfileVersion: binding.agentProfileVersion,
    capabilityId: binding.capabilityId,
    capabilityRevision: binding.capabilityRevision,
    turnId: binding.turnId,
    toolCallId: binding.toolCallId,
    invocationId: 'inv-sk-1',
    argDigest: binding.argDigest,
    effect: binding.effect,
    at: Date.now(),
  });
  if (decision.approved) {
    // The protected effect happens EXACTLY here.
    appendFileSync(effectsFile, `EFFECT ${binding.capabilityId}\n`);
    await stores.invocations.updateInvocationStatus({
      invocationId: 'inv-sk-1',
      status: 'completed',
      at: Date.now(),
      resultSummary: 'effect applied',
    });
  } else {
    appendFileSync(effectsFile, `DENIED ${decision.reasonCode}\n`);
  }
  // Retry the SAME logical invocation after the effect: the deterministic
  // idempotency key must NOT execute the capability twice.
  const replayed = await turnService.recordToolInvocationIntent({ ...binding });
  if (replayed.status === 'completed') {
    appendFileSync(effectsFile, 'REPLAY-SKIPPED completed\n');
  }
  console.log('RESUMED');
  process.exit(0);
} else if (mode === 'verify') {
  const approval = await stores.approvals.getApproval('appr-sk-1');
  const invocations = await stores.invocations.listInvocationsForTurn('turn-sk-1');
  const turn = await stores.turns.getTurn('turn-sk-1');
  console.log(
    'STATE ' +
      JSON.stringify({
        approvalStatus: approval?.status,
        approverActorId: approval?.approverActorId ?? undefined,
        invocationCount: invocations.length,
        invocationStatus: invocations[0]?.status,
        turnStatus: turn?.status,
      }),
  );
  process.exit(0);
} else {
  console.log('UNKNOWN-MODE ' + String(mode));
  process.exit(2);
}
