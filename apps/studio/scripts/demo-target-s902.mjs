/**
 * demo-target-s902.mjs — LOCAL DEMO TARGET for the S9-02 run-list→run-detail
 * drill-down journey (Stage 9 G3-B; COPY-ADAPT of integrator-owned
 * demo-target.mjs — READ-ONLY reuse of its composition/seeds, never an
 * edit of the original).
 *
 * LOCAL DEMO ONLY. This script boots a REAL, fully-composed VICT target on
 * loopback (default port 4310) with in-memory stores, provisions two
 * operator actors, publishes a small manifest, selects the activation, and
 * seeds three runs (completed, failed, blocked-with-durable-wait) so every
 * Studio read surface has truthful content — including real protected
 * detail bytes under 'full' retention (positive D-5 path).
 *
 * DEMO TOKEN CONSTANTS (loopback fixture ONLY — never use elsewhere):
 *   vict-studio-demo-operator  -> actor-studio-operator (run.read,
 *                                 activation.read, audit.read,
 *                                 agent.stream.read)
 *   vict-studio-demo-detail    -> actor-studio-detail   (same + run.detail)
 *   vict-studio-demo-mutator   -> actor-studio-mutator  (same as detail +
 *                                 changeset.read + run.cancel +
 *                                 run.resolve + run.signal) — S9-04
 *                                 confirmation journey fixture only
 *   vict-studio-demo-author    -> actor-studio-author   (same as detail +
 *                                 changeset.read + changeset.propose +
 *                                 changeset.revise; NO changeset.approve —
 *                                 the self-approval NEGATIVE is the target
 *                                 refusing decide on this actor) — S9-03
 *   vict-studio-demo-approver-a -> actor-studio-approver-a (changeset.read
 *                                 + changeset.approve + changeset.commit —
 *                                 the 'authorized operator commits'
 *                                 stand-in) — S9-03
 *   vict-studio-demo-approver-b -> actor-studio-approver-b (changeset.read
 *                                 + changeset.approve only) — S9-03
 *
 * The tokens are NEVER printed to stdout: the summary carries only the
 * port, target id, and endpoints. The Studio server injects them through
 * VICT_STUDIO_CREDENTIALS (see apps/studio/src/lib/server/targets.ts).
 *
 * S902 additions over the G2 fixture copy:
 *   - default port 4312 (DEMO_PORT to override; never 4310/4311)
 *   - a NO-READ actor (vict-studio-demo-noread -> actor-studio-noread,
 *     scopes []) for the actor-denial negative
 *   - 55 pagination seed runs (run-demo-page-NN) so the run list carries
 *     more than one page at the G1 default/limit values
 *   - DEMO_S902_VARIANT=empty boots the SAME composition with NO run
 *     seeds (the empty-list negative)
 *
 * Run: node apps/studio/scripts/demo-target-s902.mjs
 *      (DEMO_PORT to override; DEMO_S902_VARIANT=empty for the empty list)
 */

import {
  ACTIVATION_MANIFEST_SCHEMA,
  AgentStreamHub,
  InMemoryActorDirectory,
  createInMemoryAgentControlStores,
  createInMemoryStores,
  toCanonicalJson,
  VictControlError,
  VictStoreError,
} from '@victframework/runtime';
import {
  canonicalSemanticForm,
  computeActivationVersion,
  computeCapabilitySetVersion,
  computeGraphVersion,
} from '@victframework/kernel';
import { createHash } from 'node:crypto';
import { ControlPlaneService, createControlPlaneSandboxSimulator } from '@victframework/control';
import {
  createLocalTestAuthenticator,
  createServerAuthenticator,
  createVictHttpServer,
  listenVictHttpServer,
  VictCommandService,
} from '@victframework/server';

/** DEMO_S902_VARIANT: 'full' (default; the seeded demo target) or 'empty'
 * (the same composition with NO run seeds — the empty-list negative). */
const RUN_VARIANT = process.env.DEMO_S902_VARIANT ?? 'full';
const OPERATOR_TOKEN = 'vict-studio-demo-operator';
const DETAIL_TOKEN = 'vict-studio-demo-detail';
const OPERATOR_SCOPES = ['run.read', 'activation.read', 'audit.read', 'agent.stream.read'];
const DETAIL_SCOPES = [...OPERATOR_SCOPES, 'run.detail'];
const GRAPH_ID = 'g.studio-demo';

/* ------------------------------------------------------------------ */
/* Composition (mirrors packages/server/test/operator-reads.test.ts)   */
/* ------------------------------------------------------------------ */

const controlStores = createInMemoryAgentControlStores();
const vict = createInMemoryStores();
const directory = new InMemoryActorDirectory();
await directory.upsert({
  actorId: 'actor-studio-operator',
  status: 'active',
  roles: ['operator'],
  createdAt: 0,
  scopes: OPERATOR_SCOPES,
});
await directory.upsert({
  actorId: 'actor-studio-detail',
  status: 'active',
  roles: ['operator'],
  createdAt: 0,
  scopes: DETAIL_SCOPES,
});
// S9-04 ADDITION (Stage 9 G2, strictly additive journey fixture): a third
// demo actor holding the mutation scopes the two-step confirmation journey
// prepares with. The legacy `run.cancel` scope already exists at G1;
// `run.resolve`/`run.signal` become valid when the G2 command surface lands
// in the composed target (their absence only narrows this actor's real
// authority; nothing in the read surface changes).
const MUTATOR_TOKEN = 'vict-studio-demo-mutator';
const MUTATOR_SCOPES = [
  ...DETAIL_SCOPES,
  'changeset.read',
  'run.cancel',
  'run.resolve',
  'run.signal',
];
await directory.upsert({
  actorId: 'actor-studio-mutator',
  status: 'active',
  roles: ['operator'],
  createdAt: 0,
  scopes: MUTATOR_SCOPES,
});
// S9-03 ADDITION (Stage 9 G2, strictly additive journey fixture): the
// governance actors the changeset browser journey relays with. The author
// holds propose/revise/read but NOT changeset.approve (decide on it fails
// VICT_ACTOR_SCOPE_DENIED — the separate-approver boundary negative);
// approver-a approves AND commits; approver-b approves only (the two-
// approver quorum path demonstrates DISTINCT approvers). Roles use the
// same 'operator' fixture stand-in as every other demo actor.
const AUTHOR_TOKEN = 'vict-studio-demo-author';
const APPROVER_A_TOKEN = 'vict-studio-demo-approver-a';
const APPROVER_B_TOKEN = 'vict-studio-demo-approver-b';
const AUTHOR_SCOPES = [...DETAIL_SCOPES, 'changeset.read', 'changeset.propose', 'changeset.revise'];
const APPROVER_A_SCOPES = ['changeset.read', 'changeset.approve', 'changeset.commit'];
const APPROVER_B_SCOPES = ['changeset.read', 'changeset.approve'];
await directory.upsert({
  actorId: 'actor-studio-author',
  status: 'active',
  roles: ['operator'],
  createdAt: 0,
  scopes: AUTHOR_SCOPES,
});
await directory.upsert({
  actorId: 'actor-studio-approver-a',
  status: 'active',
  roles: ['operator'],
  createdAt: 0,
  scopes: APPROVER_A_SCOPES,
});
await directory.upsert({
  actorId: 'actor-studio-approver-b',
  status: 'active',
  roles: ['operator'],
  createdAt: 0,
  scopes: APPROVER_B_SCOPES,
});

// S9-02 ADDITION (Stage 9 G3-B, strictly additive journey fixture actor):
// the actor-denial negative. On the EXISTING tree every closed role derives
// run.read (packages/runtime/src/control-types.ts ROLE_SCOPES), so a
// bare scope [] actor is NOT a run-read denial. The honest target-side
// denial for this journey's credential is a DISABLED actor: the target's
// own authority derivation returns NO scopes and refuses its run reads
// truthfully (default denial; no simulated client-side refusal).
const NOREAD_TOKEN = 'vict-studio-demo-noread';
await directory.upsert({
  actorId: 'actor-studio-noread',
  status: 'disabled',
  roles: ['operator'],
  createdAt: 0,
  scopes: [],
});

const controlPlane = new ControlPlaneService({
  stores: controlStores,
  catalog: vict.catalog,
  clock: () => Date.now(),
  simulator: createControlPlaneSandboxSimulator({ stores: controlStores, catalog: vict.catalog }),
  ids: {
    changesetId: () => `cs-${Math.random().toString(36).slice(2, 10)}`,
    changesetApprovalId: () => `csa-${Math.random().toString(36).slice(2, 10)}`,
    auditId: () => `audit-${Math.random().toString(36).slice(2, 10)}`,
    controlRunId: () => `crun-${Math.random().toString(36).slice(2, 10)}`,
  },
});

/* ------------------------------------------------------------------ */
/* S9-04 REAL-EFFECT EXECUTOR COMPOSITION (fixture scope ONLY)          */
/* ------------------------------------------------------------------ */
/**
 * The receipt-gated `run.cancel` / `run.resolve` / `run.signal` commands
 * require their EXISTING runtime executors to be composed; with no executor
 * the command service fails closed (VICT_RUN_STORE_UNAVAILABLE). This
 * fixture composes those ports over the SAME in-memory stores this demo
 * seeds — driving the store-level orchestration mechanics the runtime's own
 * operator commands drive (requestCancellation/applyCancellation,
 * resolveBlocked, signalWait). NO execution semantics are invented; the
 * command shapes, idempotency hashes, and safe events mirror
 * packages/runtime/src/orchestration-commands.ts.
 *
 * MIRROR NOTE (fixture scope, same discipline as the run seeds above): the
 * demo mirrors an applied effect into the execution-store read surface ONLY
 * where the transition is legal for that store's own closed vocabulary
 * (ALL_RUN_STATUSES = running/completed/failed/blocked; source must be
 * 'running'). A cancelled run truthfully CANNOT be re-projected onto that
 * generic surface — its before→after evidence is read through the bounded
 * wait surface (/vict/v1/runs/:runId/waits: the open wait's status moves
 * open → cancelled with resolvedBy = requestId) and the executor's own
 * result. Read backs are always the target's own truth.
 */

const orchestration = vict.orchestration;
/** The execution read surface's closed run-status vocabulary
 * (in-memory-stores.ts ALL_RUN_STATUSES). */
const EXECUTION_RUN_STATUSES = ['running', 'completed', 'failed', 'blocked'];

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

/** Fixture-safe payload hashing (identity-only; mirrors safeJson in
 * orchestration-activation.ts: content canonicalized, else type identity). */
function safePayloadHash(value) {
  try {
    return sha256Hex(toCanonicalJson(value));
  } catch {
    return sha256Hex(`unserializable:${typeof value}`);
  }
}

/** Canonical command hashes — the EXACT shapes of
 * orchestration-activation.ts (signalCommandHash / cancellationCommandHash /
 * resolutionCommandHash); identical inputs yield identical hashes, so the
 * store's own idempotency dedupe works on replays with the same request id. */
function signalCommandHash(command) {
  return `sig_${sha256Hex(
    toCanonicalJson({
      payloadHash: safePayloadHash(command.payload),
      runId: command.runId,
      schema: 'vict.signal-command@1',
      signalId: command.signalId,
      signalName: command.signalName ?? null,
      waitId: command.waitId,
    }),
  ).slice(0, 32)}`;
}

function cancellationCommandHash(command) {
  return `cancel_${sha256Hex(
    toCanonicalJson({
      reasonCode: command.reasonCode,
      runId: command.runId,
      schema: 'vict.cancellation-command@1',
    }),
  ).slice(0, 24)}`;
}

function resolutionCommandHash(command) {
  return `res_${sha256Hex(
    toCanonicalJson({
      action: command.action,
      expectedRunRevision: command.expectedRunRevision ?? null,
      hasOutput: command.hasOutput,
      reasonCode: command.reasonCode,
      runId: command.runId,
      schema: 'vict.resolution-command@1',
    }),
  ).slice(0, 24)}`;
}

/** The safe cancellation-reason vocabulary of the runtime driver
 * (orchestration-driver-types.ts CANCELLATION_REASON_CODES). */
const FIXTURE_CANCELLATION_REASON_CODES = ['operator_request', 'shutdown', 'policy', 'superseded'];

async function executionNextSeq(runId) {
  const events = await vict.execution.listEvents(runId, -1);
  return events.reduce((max, event) => Math.max(max, event.seq), -1) + 1;
}

/** Mirror an applied durable effect into the generic execution read surface
 * (only where the transition is legal for that store's closed vocabulary:
 * a 'running' source AND a status it carries; a cancelled run has no
 * execution-store projection and is evidenced through the wait surface). */
async function mirrorAppliedEffect(runId, nextStatus) {
  if (!EXECUTION_RUN_STATUSES.includes(nextStatus)) {
    return false;
  }
  const mirrored = await vict.execution.getRun(runId);
  if (mirrored === undefined || mirrored.status !== 'running') {
    // Fixture mirror note (integrator-verified): the execution store
    // accepts transitions only FROM a 'running' run, so a run parked
    // blocked there can never legally transition again — the resumed
    // truth is evidenced by the executor's verbatim answer + the wait
    // surface, never by a synthetic execution-store projection.
    return false;
  }
  await vict.execution.commitTransition({
    runId,
    expectedRecordRevision: mirrored.recordRevision,
    expectedNextEventSeq: await executionNextSeq(runId),
    next: {
      status: nextStatus,
      ...(nextStatus === 'running' ? {} : { completedAt: Date.now() }),
    },
    events: [],
    timestamp: Date.now(),
  });
  return true;
}

async function orchestrationIdentity(run) {
  return {
    runId: run.runId,
    graphId: run.graphId,
    graphVersion: run.graphVersion,
    capabilitySetVersion: run.capabilitySetVersion,
    activationVersion: run.activationVersion,
  };
}

/** run.cancel executor: the EXISTING durable orchestration cancellation
 * (requestCancellation → applyCancellation when in-flight work deferred),
 * recorded with the runtime's own hash/event shapes. */
async function cancelRunEffect({ runId, requestId, reasonCode }) {
  if (!FIXTURE_CANCELLATION_REASON_CODES.includes(reasonCode)) {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      'reasonCode must use the safe cancellation vocabulary (operator_request, shutdown, policy, superseded).',
    );
  }
  const run = await orchestration.getOrchestrationRun(runId);
  if (run === undefined) {
    return { runId, requestId, status: 'unknown_run' };
  }
  const at = Date.now();
  const identity = await orchestrationIdentity(run);
  const result = await orchestration.requestCancellation({
    runId,
    requestId,
    reasonCode,
    commandHash: cancellationCommandHash({ runId, requestId, reasonCode }),
    now: at,
    events: [{ type: 'run.cancel_requested', requestId, reasonCode, ...identity, timestamp: at }],
    terminalCancelEvent: {
      type: 'run.cancelled',
      requestId,
      reasonCode,
      steps: run.steps,
      ...identity,
      timestamp: at,
    },
  });
  if (result.status === 'conflict') {
    throw new VictControlError(
      'VICT_COMMAND_IDEMPOTENCY_CONFLICT',
      'The cancellation requestId was already used with different content.',
    );
  }
  if (result.status === 'duplicate' || result.status === 'already_terminal') {
    return { runId, requestId, status: result.status, cancelled: false };
  }
  if (!result.runCancelledNow) {
    // In-flight work defers the terminal transition; the runtime applies it
    // cooperatively — the same store mechanics.
    const appliedAt = Date.now();
    await orchestration.applyCancellation({
      runId,
      now: appliedAt,
      requestId,
      reasonCode,
      steps: run.steps,
      removeCheckpoints: [],
      events: [
        {
          type: 'run.cancelled',
          requestId,
          reasonCode,
          steps: run.steps,
          ...identity,
          timestamp: appliedAt,
        },
      ],
    });
  }
  const settled = await orchestration.getOrchestrationRun(runId);
  // 'cancelled' is outside the generic execution surface's status
  // vocabulary: no mirror attempted (see MIRROR NOTE above).
  await mirrorAppliedEffect(runId, settled.status);
  return {
    runId,
    requestId,
    status: 'accepted',
    cancelled: true,
    runStatus: settled.status,
    runRecordRevision: settled.recordRevision,
  };
}

/** run.resolve executor: the EXISTING blocked-run resolution path over the
 * durable orchestration store (idempotent through the caller's resolution
 * id; revision-guarded) with the runtime's own operator.intervened event. */
async function resolveBlockedEffect({ runId, resolution, actorId, requestId }) {
  const run = await orchestration.getOrchestrationRun(runId);
  if (run === undefined) {
    return { runId, status: 'unknown_run' };
  }
  if (run.status !== 'blocked') {
    return { runId, status: 'not_blocked', runStatus: run.status };
  }
  const at = Date.now();
  const identity = await orchestrationIdentity(run);
  const resolutionId = requestId;
  // Integrator amendment (fixture scope, integrator): a run blocked on a
  // DURABLE WAIT (signal) has no blocked token, so the store's blocked-token
  // resolution path throws a raw store error for it. The executor answers
  // TRUTHFULLY instead of throwing an illegible 500: the stable result
  // carries the store's own error code and the run state; NO fake success,
  // no invented effect, and the audit view is where the reviewer verifies
  // the nothing-happened truth.
  let result;
  try {
    result = await orchestration.resolveBlocked({
      runId,
      resolutionId,
      action: resolution,
      reasonCode: 'operator_request',
      commandHash: resolutionCommandHash({
        runId,
        resolutionId,
        action: resolution,
        reasonCode: 'operator_request',
        expectedRunRevision: run.recordRevision,
        hasOutput: false,
      }),
      expectedRunRevision: run.recordRevision,
      now: at,
      events: [
        {
          type: 'operator.intervened',
          resolutionId,
          action: resolution,
          actorId,
          ...identity,
          timestamp: at,
        },
      ],
    });
  } catch (error) {
    const code = error instanceof VictStoreError ? error.code : 'VICT_STORE_UNAVAILABLE';
    return {
      runId,
      requestId,
      resolutionId,
      status: 'failed_to_apply',
      errorCode: code,
      runStatus: run.status,
      runRecordRevision: run.recordRevision,
    };
  }
  const settled = await orchestration.getOrchestrationRun(runId);
  if (result.status === 'accepted') {
    await mirrorAppliedEffect(runId, settled.status);
  }
  return {
    runId,
    status: result.status,
    runStatus: settled.status,
    runRecordRevision: settled.recordRevision,
  };
}

/** run.signal executor: the EXISTING durable-signal delivery path. The
 * target wait is resolved by the store's own signalWait mechanics (open
 * wait match by signal name; revision-fenced; idempotent by signalId). */
async function signalWaitEffect({ runId, signalName, signalId }) {
  const run = await orchestration.getOrchestrationRun(runId);
  if (run === undefined) {
    return { runId, signalId, signalName, status: 'unknown_run' };
  }
  const waits = await orchestration.listWaits(runId);
  // Prefer the OPEN wait matching the signal name; when none is open, the
  // store's own signalWait still answers truthfully for the named wait
  // (already_resolved) — never an invented outcome here.
  const matching = waits.filter(
    (candidate) => candidate.signalName === null || candidate.signalName === signalName,
  );
  const wait = matching.find((candidate) => candidate.status === 'open') ?? matching[0];
  if (wait === undefined) {
    throw new VictControlError(
      'VICT_COMMAND_FIELD_INVALID',
      'No wait on that run accepts that signal name.',
    );
  }
  const at = Date.now();
  const identity = await orchestrationIdentity(run);
  const command = { runId, waitId: wait.waitId, signalId, signalName, payload: {} };
  const result = await orchestration.signalWait({
    ...command,
    commandHash: signalCommandHash(command),
    expectedWaitRevision: wait.revision,
    now: at,
    events: [
      {
        type: 'signal.received',
        waitId: wait.waitId,
        signalId,
        signalName: wait.signalName ?? signalName,
        ...identity,
        timestamp: at,
      },
      {
        type: 'run.resumed',
        by: 'signal',
        waitId: wait.waitId,
        signalId,
        ...identity,
        timestamp: at,
      },
    ],
  });
  const settled = await orchestration.getOrchestrationRun(runId);
  // Signal effects are evidenced by the verbatim executor answer + the
  // wait surface (resolvedBy) — the fixture does NOT synthesize an
  // execution-store mirror for a resumed wait (the store forbids a
  // blocked->running transition; see mirrorAppliedEffect's note).
  return {
    runId,
    signalId,
    signalName,
    status: result.status,
    waitId: wait.waitId,
    runStatus: settled.status,
    runRecordRevision: settled.recordRevision,
  };
}

/** The command service plane: the composed ControlPlaneService with the
 * receipt-gated run-cancel executor attached (the `controlPlane.cancelRun`
 * optional port; everything else delegates to the composed service). */
const commandServiceControlPlane = new Proxy(controlPlane, {
  get(target, property, _receiver) {
    if (property === 'cancelRun') {
      return cancelRunEffect;
    }
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

const commandService = new VictCommandService({
  stores: controlStores,
  controlPlane: commandServiceControlPlane,
  clock: () => Date.now(),
  idempotencyOwner: 'studio-demo-fixture',
  execution: vict.execution,
  orchestration: vict.orchestration,
  catalog: vict.catalog,
  // Stage 9 G2 executors (fixture scope; documented above).
  runResolution: { resolveBlocked: resolveBlockedEffect },
  runSignals: { signalWait: signalWaitEffect },
});

const auth = createServerAuthenticator({
  authenticator: createLocalTestAuthenticator({
    [OPERATOR_TOKEN]: 'actor-studio-operator',
    [DETAIL_TOKEN]: 'actor-studio-detail',
    [MUTATOR_TOKEN]: 'actor-studio-mutator',
    // S9-03 governance journey actors.
    [AUTHOR_TOKEN]: 'actor-studio-author',
    [APPROVER_A_TOKEN]: 'actor-studio-approver-a',
    [APPROVER_B_TOKEN]: 'actor-studio-approver-b',
    // S9-02 actor-denial negative: no scopes, no run.read.
    [NOREAD_TOKEN]: 'actor-studio-noread',
  }),
  directory,
});

const hub = new AgentStreamHub({ ledger: controlStores.streamLedger, clock: () => Date.now() });
const composed = createVictHttpServer({ commandService, auth, hub, stores: controlStores });

/* ------------------------------------------------------------------ */
/* Catalog: publish a small manifest and select it                     */
/* ------------------------------------------------------------------ */

function demoManifest() {
  const graph = {
    schema: 'vict.graph@1',
    id: GRAPH_ID,
    entry: 'n1',
    nodes: [
      { id: 'n1', capability: 'cap.demo', input: null, output: null },
      { id: 'n2', capability: 'cap.demo', input: null, output: null },
    ],
    edges: [],
  };
  const bindings = [
    { capability: 'cap.demo', revision: '1', effect: 'pure', input: null, output: null },
  ];
  const graphVersion = computeGraphVersion(graph);
  const capabilitySetVersion = computeCapabilitySetVersion(bindings);
  const activationVersion = computeActivationVersion(graphVersion, capabilitySetVersion);
  return {
    manifestSchema: ACTIVATION_MANIFEST_SCHEMA,
    graphId: GRAPH_ID,
    graph: canonicalSemanticForm(graph),
    graphVersion,
    capabilitySetVersion,
    activationVersion,
    bindings,
    contracts: [],
  };
}

const manifest = demoManifest();
await vict.catalog.publishAndSelect({
  publish: { manifest, canonicalManifest: toCanonicalJson(manifest) },
  select: { graphId: GRAPH_ID, expectedSelectionRevision: 'none' },
});

/* ------------------------------------------------------------------ */
/* Run seeds                                                           */
/* ------------------------------------------------------------------ */

function demoEvent(runId, seq, type, extra = {}) {
  return {
    seq,
    runId,
    graphId: manifest.graphId,
    graphVersion: manifest.graphVersion,
    capabilitySetVersion: manifest.capabilitySetVersion,
    activationVersion: manifest.activationVersion,
    timestamp: 1_700_000_000_000 + seq,
    type,
    ...extra,
  };
}

if (RUN_VARIANT !== 'empty') {
  // 1) COMPLETED run with stored protected output (retention 'full').
  const completedRunId = 'run-demo-completed';
  await vict.execution.createRun({
    runId: completedRunId,
    graphId: manifest.graphId,
    graphVersion: manifest.graphVersion,
    capabilitySetVersion: manifest.capabilitySetVersion,
    activationVersion: manifest.activationVersion,
    mode: 'normal',
    retention: 'full',
    steps: 1,
    events: [demoEvent(completedRunId, 0, 'run.started')],
    timestamp: Date.now(),
  });
  await vict.execution.commitTransition({
    runId: completedRunId,
    expectedRecordRevision: 1,
    expectedNextEventSeq: 1,
    next: {
      status: 'completed',
      currentNodeId: null,
      steps: 2,
      completedAt: Date.now(),
      outputSummary: { shape: 'object', keys: ['summary', 'items'] },
      output: {
        summary: 'demo capability output committed under full retention',
        items: ['alpha', 'beta', 'gamma'],
      },
    },
    events: [
      demoEvent(completedRunId, 1, 'node.completed', { nodeId: 'n1', capabilityId: 'cap.demo' }),
      demoEvent(completedRunId, 2, 'run.completed', {
        steps: 2,
        output: { shape: 'object', keys: ['summary', 'items'] },
      }),
    ],
    timestamp: Date.now(),
  });

  // 2) FAILED run with 3+ ordered events.
  const failedRunId = 'run-demo-failed';
  await vict.execution.createRun({
    runId: failedRunId,
    graphId: manifest.graphId,
    graphVersion: manifest.graphVersion,
    capabilitySetVersion: manifest.capabilitySetVersion,
    activationVersion: manifest.activationVersion,
    mode: 'normal',
    retention: 'summary',
    steps: 1,
    events: [demoEvent(failedRunId, 0, 'run.started')],
    timestamp: Date.now(),
  });
  await vict.execution.commitTransition({
    runId: failedRunId,
    expectedRecordRevision: 1,
    expectedNextEventSeq: 1,
    next: {
      status: 'failed',
      currentNodeId: 'n1',
      completedAt: Date.now(),
      error: { code: 'DEMO_CAPABILITY_FAILED', message: 'demo failure', details: null },
    },
    events: [
      demoEvent(failedRunId, 1, 'node.started', { nodeId: 'n1', capabilityId: 'cap.demo' }),
      demoEvent(failedRunId, 2, 'node.failed', {
        nodeId: 'n1',
        capabilityId: 'cap.demo',
        error: { code: 'DEMO_CAPABILITY_FAILED', message: 'demo failure', details: null },
      }),
      demoEvent(failedRunId, 3, 'run.failed', {
        error: { code: 'DEMO_CAPABILITY_FAILED', message: 'demo failure', details: null },
      }),
    ],
    timestamp: Date.now(),
  });

  // 3) BLOCKED run with a DURABLE WAIT (signal), retention 'full' + stored
  //    output so the protected detail has real bytes for the positive path.
  const blockedRunId = 'run-demo-blocked';
  await vict.execution.createRun({
    runId: blockedRunId,
    graphId: manifest.graphId,
    graphVersion: manifest.graphVersion,
    capabilitySetVersion: manifest.capabilitySetVersion,
    activationVersion: manifest.activationVersion,
    mode: 'normal',
    retention: 'full',
    steps: 1,
    events: [demoEvent(blockedRunId, 0, 'run.started')],
    timestamp: Date.now(),
  });
  await vict.orchestration.createOrchestrationRun({
    runId: blockedRunId,
    graphId: manifest.graphId,
    graphVersion: manifest.graphVersion,
    capabilitySetVersion: manifest.capabilitySetVersion,
    activationVersion: manifest.activationVersion,
    mode: 'normal',
    retention: 'full',
    rootTokenId: 'tok-root',
    entryNodeId: 'n1',
    checkpoint: { demo: 'blocked-run-input' },
    events: [],
    now: Date.now(),
  });
  const claim = await vict.orchestration.claimReadyToken({
    runId: blockedRunId,
    ownerId: 'demo-worker',
    leaseExpiresAt: Date.now() + 60_000,
    now: Date.now(),
    planner: {
      invocationIdFor: (token) => `inv-${token.tokenId}`,
      attemptIdFor: (token, attemptNumber) => `att-${token.tokenId}-${attemptNumber}`,
      planFor: () => ({
        capabilityId: 'cap.demo',
        effectClass: 'pure',
        deadlineAt: null,
        idempotencyKey: null,
      }),
    },
  });
  if (!claim.claimed) {
    throw new Error(`demo fixture failed: root token not claimable (${String(claim.reason)})`);
  }
  await vict.orchestration.completeAttempt({
    runId: blockedRunId,
    attemptId: claim.claim.attempt.attemptId,
    ownerId: 'demo-worker',
    expectedAttemptFence: claim.claim.attempt.fence,
    now: Date.now(),
    outcome: { kind: 'completed', outputSummary: { shape: 'object', keys: ['partial'] } },
    continuation: {
      kind: 'wait',
      wait: {
        waitId: 'wait-demo-signal',
        nodeId: 'n1',
        kind: 'signal',
        signalName: 'demo.resume',
        contractId: null,
        contractRevision: null,
        dueAt: null,
        timeoutAt: null,
      },
    },
    events: [],
    run: { status: 'blocked', currentNodeId: 'n1', output: { partial: 'awaiting demo.resume' } },
  });
  // Mirror the blocked state into the execution store so the generic run
  // reads report the run truthfully as blocked.
  await vict.execution.commitTransition({
    runId: blockedRunId,
    expectedRecordRevision: 1,
    expectedNextEventSeq: 1,
    next: { status: 'blocked', currentNodeId: 'n1' },
    events: [
      demoEvent(blockedRunId, 1, 'run.waiting', {
        nodeId: 'n1',
        waitId: 'wait-demo-signal',
        waitKind: 'signal',
        signalName: 'demo.resume',
      }),
    ],
    timestamp: Date.now(),
  });

  /* ------------------------------------------------------------------ */
  /* S9-04 EFFECT SUBJECT (fixture scope) — a RUNNING, cancellable run    */
  /* ------------------------------------------------------------------ */
  /**
   * The confirmation journey's before→after effect subject: a run that is
   * 'running' in BOTH stores so every G1 read (run record, waits, events)
   * mirrors the real effect truthfully after a confirmed consumption,
   * including the run record's own status/revision before→after.
   */
  const confirmRunId = 'run-demo-confirm';
  await vict.orchestration.createOrchestrationRun({
    runId: confirmRunId,
    graphId: manifest.graphId,
    graphVersion: manifest.graphVersion,
    capabilitySetVersion: manifest.capabilitySetVersion,
    activationVersion: manifest.activationVersion,
    mode: 'normal',
    retention: 'summary',
    rootTokenId: 'tok-confirm-root',
    entryNodeId: 'n1',
    checkpoint: { demo: 'confirm-run-active' },
    events: [],
    now: Date.now(),
  });
  await vict.execution.createRun({
    runId: confirmRunId,
    graphId: manifest.graphId,
    graphVersion: manifest.graphVersion,
    capabilitySetVersion: manifest.capabilitySetVersion,
    activationVersion: manifest.activationVersion,
    mode: 'normal',
    retention: 'summary',
    steps: 1,
    events: [demoEvent(confirmRunId, 0, 'run.started')],
    timestamp: Date.now(),
  });

  // S9-02 pagination seeds: 55 summary-retention runs so the run list has
  // more than one page at the G1 default limit (50) AND at limit=10 direct
  // reads — the paginated hasMore/total behavior is read-verbatim.
  for (let pageSeed = 1; pageSeed <= 55; pageSeed += 1) {
    const pagedRunId = `run-demo-page-${String(pageSeed).padStart(2, '0')}`;
    await vict.execution.createRun({
      runId: pagedRunId,
      graphId: manifest.graphId,
      graphVersion: manifest.graphVersion,
      capabilitySetVersion: manifest.capabilitySetVersion,
      activationVersion: manifest.activationVersion,
      mode: 'normal',
      retention: 'summary',
      steps: 1,
      events: [demoEvent(pagedRunId, 0, 'run.started')],
      timestamp: Date.now(),
    });
  }
} // RUN_VARIANT !== 'empty'

/* ------------------------------------------------------------------ */
/* Listen + safe summary + clean shutdown                              */
/* ------------------------------------------------------------------ */

const port = await listenVictHttpServer(composed, {
  port: Number(process.env.DEMO_PORT ?? 4312),
  host: '127.0.0.1',
});

// SAFE summary only: no tokens, no secrets, no actor tokens on stdout.
console.log(
  JSON.stringify(
    {
      port,
      targetId: 'local',
      variant: RUN_VARIANT,
      endpoints: { http: `http://127.0.0.1:${port}`, api: '/vict/v1' },
    },
    null,
    2,
  ),
);

let closing = false;
async function shutdown() {
  if (closing) {
    return;
  }
  closing = true;
  await composed.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
