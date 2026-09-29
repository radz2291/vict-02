/**
 * demo-target.mjs — LOCAL DEMO TARGET for the Studio browser journey.
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
 *
 * The tokens are NEVER printed to stdout: the summary carries only the
 * port, target id, and endpoints. The Studio server injects them through
 * VICT_STUDIO_CREDENTIALS (see apps/studio/src/lib/server/targets.ts).
 *
 * Run: node apps/studio/scripts/demo-target.mjs   (DEMO_PORT to override)
 */

import {
  ACTIVATION_MANIFEST_SCHEMA,
  AgentStreamHub,
  InMemoryActorDirectory,
  createInMemoryAgentControlStores,
  createInMemoryStores,
  toCanonicalJson,
} from '@victframework/runtime';
import {
  canonicalSemanticForm,
  computeActivationVersion,
  computeCapabilitySetVersion,
  computeGraphVersion,
} from '@victframework/kernel';
import { ControlPlaneService, createControlPlaneSandboxSimulator } from '@victframework/control';
import {
  createLocalTestAuthenticator,
  createServerAuthenticator,
  createVictHttpServer,
  listenVictHttpServer,
  VictCommandService,
} from '@victframework/server';

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

const commandService = new VictCommandService({
  stores: controlStores,
  controlPlane,
  clock: () => Date.now(),
  execution: vict.execution,
  orchestration: vict.orchestration,
  catalog: vict.catalog,
});

const auth = createServerAuthenticator({
  authenticator: createLocalTestAuthenticator({
    [OPERATOR_TOKEN]: 'actor-studio-operator',
    [DETAIL_TOKEN]: 'actor-studio-detail',
    [MUTATOR_TOKEN]: 'actor-studio-mutator',
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
/* Listen + safe summary + clean shutdown                              */
/* ------------------------------------------------------------------ */

const port = await listenVictHttpServer(composed, {
  port: Number(process.env.DEMO_PORT ?? 4310),
  host: '127.0.0.1',
});

// SAFE summary only: no tokens, no secrets, no actor tokens on stdout.
console.log(
  JSON.stringify(
    {
      port,
      targetId: 'local',
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
