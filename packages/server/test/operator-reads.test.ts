import { afterAll, describe, expect, it } from 'vitest';
import {
  ACTIVATION_MANIFEST_SCHEMA,
  AgentStreamHub,
  createInMemoryAgentControlStores,
  createInMemoryStores,
  InMemoryActorDirectory,
  toCanonicalJson,
  type ActivationManifest,
  type ActorDirectory,
  type ActorRecord as ActorRecordType,
  type AgentControlStores,
  type CreateRunCommand,
  type KernelEvent,
  type VictStores,
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
} from '../src/index.js';

/**
 * Stage 9 G1 — the operator read surface (WP-1) over REAL HTTP:
 *
 * - every new read command is scope-checked below the transport (default
 *   denial; the DISTINCT `run.detail` scope is held by nobody by default
 *   and reached only through an explicit deployment grant);
 * - `run.list` pagination is bounded and deterministic (limit/offset,
 *   truthful totals and `hasMore`);
 * - generic run reads NEVER disclose stored `output`, even under 'full'
 *   retention — the protected `run.detail` command is the only path, it
 *   performs a RETENTION CHECK, and every authorized retrieval appends a
 *   PER-ACCESS audit event;
 * - activation/release/audit reads expose identity-level safe views with
 *   TRUTHFUL absence (null / empty), never silent fallbacks;
 * - a deployment without the execution/catalog/orchestration ports fails
 *   closed with a stable unavailable code.
 */

const DEVELOPER = 'vict-test-token-user'; // developer+approver+operator+administrator
const OPERATOR = 'vict-test-token-operator';
const VIEWER = 'vict-test-token-viewer';
const EMPTY = 'vict-test-token-empty';
const DETAIL = 'vict-test-token-detail'; // operator + explicit run.detail grant

/** Operator actor with an EXPLICIT protected-detail grant (D-5). */
const DETAIL_OPERATOR_ACTOR: ActorRecordType = {
  actorId: 'actor-detail-operator',
  status: 'active',
  roles: ['operator'],
  createdAt: 0,
  scopes: ['run.detail'],
};

const TOKENS: Readonly<Record<string, string>> = {
  [DEVELOPER]: 'actor-user',
  [OPERATOR]: 'actor-operator',
  [VIEWER]: 'actor-viewer',
  [EMPTY]: 'actor-empty',
  [DETAIL]: 'actor-detail-operator',
};

/** A REAL fixture manifest (identities computed by the kernel's functions). */
function fixtureManifest(graphId: string, capabilityRevision = '1'): ActivationManifest {
  const graph = {
    schema: 'vict.graph@1',
    id: graphId,
    entry: 'n1',
    nodes: [
      { id: 'n1', capability: 'cap.a', input: null, output: null },
      { id: 'n2', capability: 'cap.a', input: null, output: null },
    ],
    edges: [] as never[],
  } as unknown as Parameters<typeof computeGraphVersion>[0];
  const bindings = [
    {
      capability: 'cap.a',
      revision: capabilityRevision,
      effect: 'pure' as const,
      input: null,
      output: null,
    },
  ];
  const graphVersion = computeGraphVersion(graph);
  const capabilitySetVersion = computeCapabilitySetVersion(bindings);
  const activationVersion = computeActivationVersion(graphVersion, capabilitySetVersion);
  return {
    manifestSchema: ACTIVATION_MANIFEST_SCHEMA,
    graphId,
    graph: canonicalSemanticForm(graph as unknown as Parameters<typeof canonicalSemanticForm>[0]),
    graphVersion,
    capabilitySetVersion,
    activationVersion,
    bindings,
    contracts: [],
  };
}

interface ReadFixture {
  readonly port: number;
  readonly stores: AgentControlStores;
  readonly vict: VictStores;
  readonly directory: ActorDirectory;
  close(): Promise<void>;
}

async function readFixture(withPorts: boolean): Promise<ReadFixture> {
  const controlStores = createInMemoryAgentControlStores();
  const vict = createInMemoryStores();
  const directory = new InMemoryActorDirectory();
  for (const record of [
    {
      actorId: 'actor-user',
      status: 'active',
      roles: ['developer', 'approver', 'operator', 'administrator'],
      createdAt: 0,
    },
    { actorId: 'actor-operator', status: 'active', roles: ['operator'], createdAt: 0 },
    { actorId: 'actor-viewer', status: 'active', roles: ['viewer'], createdAt: 0 },
    { actorId: 'actor-empty', status: 'active', roles: [], createdAt: 0 },
    DETAIL_OPERATOR_ACTOR,
  ] as ActorRecordType[]) {
    await directory.upsert(record);
  }
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
    ...(withPorts
      ? { execution: vict.execution, orchestration: vict.orchestration, catalog: vict.catalog }
      : {}),
  });
  const auth = createServerAuthenticator({
    authenticator: createLocalTestAuthenticator(TOKENS),
    directory,
  });
  const hub = new AgentStreamHub({ ledger: controlStores.streamLedger, clock: () => Date.now() });
  const composed = createVictHttpServer({ commandService, auth, hub, stores: controlStores });
  const port = await listenVictHttpServer(composed);
  return { port, stores: controlStores, vict, directory, close: composed.close };
}

const fixtures: ReadFixture[] = [];
let current: ReadFixture | undefined;
let portlessCurrent: ReadFixture | undefined;

async function fixture(): Promise<ReadFixture> {
  if (current === undefined) {
    current = await readFixture(true);
    fixtures.push(current);
  }
  return current;
}

async function portlessFixture(): Promise<ReadFixture> {
  if (portlessCurrent === undefined) {
    portlessCurrent = await readFixture(false);
    fixtures.push(portlessCurrent);
  }
  return portlessCurrent;
}

afterAll(async () => {
  for (const entry of fixtures) {
    await entry.close();
  }
});

async function get(
  port: number,
  path: string,
  token: string,
): Promise<{ status: number; body: Record<string, unknown>; data: Record<string, unknown> }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  const body = text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {};
  const data = (body.ok === true ? body.data : body) as Record<string, unknown>;
  return { status: response.status, body, data };
}

function makeEvent(
  manifest: ActivationManifest,
  runId: string,
  seq: number,
  type: KernelEvent['type'],
  extra: Record<string, unknown> = {},
): KernelEvent {
  return {
    seq,
    runId,
    graphId: manifest.graphId,
    graphVersion: manifest.graphVersion,
    capabilitySetVersion: manifest.capabilitySetVersion,
    activationVersion: manifest.activationVersion,
    timestamp: 1_000 + seq,
    type,
    ...extra,
  } as KernelEvent;
}

function createRunCommand(
  manifest: ActivationManifest,
  overrides: Partial<CreateRunCommand> = {},
): CreateRunCommand {
  const runId = `run-${Math.random().toString(36).slice(2, 10)}`;
  return {
    runId,
    graphId: manifest.graphId,
    graphVersion: manifest.graphVersion,
    capabilitySetVersion: manifest.capabilitySetVersion,
    activationVersion: manifest.activationVersion,
    mode: 'normal',
    retention: 'summary',
    steps: 1,
    events: [makeEvent(manifest, runId, 0, 'run.started')],
    timestamp: Date.now(),
    ...overrides,
  };
}

/** Seed N runs with strictly increasing createdAt values. */
async function seedRuns(
  vict: VictStores,
  manifest: ActivationManifest,
  count: number,
  overrides: Partial<CreateRunCommand> = {},
): Promise<string[]> {
  // The execution store requires the pinned activation to exist.
  await vict.catalog.publish({ manifest, canonicalManifest: toCanonicalJson(manifest) });
  const runIds: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const command = createRunCommand(manifest, {
      timestamp: 1_700_000_000_000 + index,
      ...overrides,
    });
    await vict.execution.createRun(command);
    runIds.push(command.runId);
  }
  return runIds;
}

describe('Stage 9 G1 operator reads (real HTTP)', () => {
  it('run.list: bounded, deterministic pagination with truthful totals and hasMore', async () => {
    const f = await fixture();
    const manifest = fixtureManifest('g1-graph-list');
    const runIds = await seedRuns(f.vict, manifest, 5);
    expect(runIds.length).toBe(5);
    const page1 = await get(f.port, '/vict/v1/runs?limit=2&offset=0', OPERATOR);
    expect(page1.status).toBe(200);
    expect(page1.body.ok).toBe(true);
    const runs1 = page1.data.runs as Record<string, unknown>[];
    expect(runs1.length).toBe(2);
    expect(page1.data.total).toBe(5);
    expect(page1.data.hasMore).toBe(true);
    const page3 = await get(f.port, '/vict/v1/runs?limit=2&offset=4', OPERATOR);
    const runs3 = page3.data.runs as Record<string, unknown>[];
    expect(runs3.length).toBe(1);
    expect(page3.data.hasMore).toBe(false);
    // Deterministic ordering: createdAt ascending, stable across pages.
    const all = await get(f.port, '/vict/v1/runs?limit=100', OPERATOR);
    const allRuns = all.data.runs as Array<{ runId: string; createdAt: number }>;
    const created = allRuns.map((run) => run.createdAt);
    expect([...created].sort((a, b) => a - b)).toEqual(created);
    // A safe projection: identity columns only — no `output` key anywhere.
    for (const run of allRuns) {
      expect(run).not.toHaveProperty('output');
    }
  });

  it('run.list: closed filter vocabulary and bounded page params fail closed', async () => {
    const f = await fixture();
    const badStatus = await get(f.port, '/vict/v1/runs?status=not-a-status', OPERATOR);
    expect(badStatus.status).toBe(400);
    expect(badStatus.body.code).toBe('VICT_COMMAND_FIELD_INVALID');
    const badLimit = await get(f.port, '/vict/v1/runs?limit=100000', OPERATOR);
    expect(badLimit.status).toBe(400);
    expect(badLimit.body.code).toBe('VICT_COMMAND_FIELD_INVALID');
    const badOffset = await get(f.port, '/vict/v1/runs?offset=-1', OPERATOR);
    expect(badOffset.status).toBe(400);
  });

  it('run.get: safe summary; unknown run is a stable 404 that echoes nothing', async () => {
    const f = await fixture();
    const manifest = fixtureManifest('g1-graph-get');
    const [runId] = await seedRuns(f.vict, manifest, 1, { retention: 'full' });
    const response = await get(f.port, `/vict/v1/runs/${runId}`, OPERATOR);
    expect(response.status).toBe(200);
    const run = response.data.run as Record<string, unknown>;
    expect(run.runId).toBe(runId);
    expect(run).not.toHaveProperty('output');
    const missing = await get(f.port, '/vict/v1/runs/run-does-not-exist', OPERATOR);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('VICT_RUN_MISSING');
  });

  it('run.events: ordered identity timeline with afterSeq/limit paging; no payload strings', async () => {
    const f = await fixture();
    const manifest = fixtureManifest('g1-graph-events');
    const [runId] = (await seedRuns(f.vict, manifest, 1)) as [string, ...string[]];
    await f.vict.execution.commitTransition({
      runId,
      expectedRecordRevision: 1,
      expectedNextEventSeq: 1,
      next: { status: 'blocked', currentNodeId: 'n1', steps: 2 },
      events: [
        makeEvent(manifest, runId, 1, 'run.waiting', {
          nodeId: 'n1',
          waitId: 'w1',
          waitKind: 'signal',
        }),
        makeEvent(manifest, runId, 2, 'run.started'),
      ],
      timestamp: Date.now(),
    });
    const page1 = await get(f.port, `/vict/v1/runs/${runId}/events?limit=2`, OPERATOR);
    expect(page1.status).toBe(200);
    const events1 = page1.data.events as Array<Record<string, unknown>>;
    expect(events1.length).toBe(2);
    expect(events1[0]?.seq).toBe(0);
    expect(events1[1]?.seq).toBe(1);
    expect(page1.data.hasMore).toBe(true);
    for (const event of events1) {
      expect(event).not.toHaveProperty('payload');
    }
    const page2 = await get(f.port, `/vict/v1/runs/${runId}/events?afterSeq=1`, OPERATOR);
    const events2 = page2.data.events as Array<Record<string, unknown>>;
    expect(events2.length).toBe(1);
    expect(events2[0]?.seq).toBe(2);
    expect(page2.data.nextSeq).toBe(2);
  });

  it('run.waits: safe descriptors through the composed orchestration port', async () => {
    const f = await fixture();
    const manifest = fixtureManifest('g1-graph-waits');
    const [runId] = (await seedRuns(f.vict, manifest, 1)) as [string, ...string[]];
    const response = await get(f.port, `/vict/v1/runs/${runId}/waits`, OPERATOR);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.waits)).toBe(true);
    const missing = await get(f.port, '/vict/v1/runs/run-nope/waits', OPERATOR);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('VICT_RUN_MISSING');
  });

  it('run.detail (D-5): distinct scope default-denied; explicit grant + full retention reads; per-access audit', async () => {
    const f = await fixture();
    const manifest = fixtureManifest('g1-graph-detail');
    const [protectedRun] = (await seedRuns(f.vict, manifest, 1, {
      retention: 'full',
    })) as [string, ...string[]];
    // Seed the protected output through the store's transition path? The
    // create command has no output; run.detail under 'full' retention with
    // no committed output returns protectedOutput: null truthfully.
    // Default denial for every ordinary actor. DEVELOPER is excluded: its
    // administrator role holds ALL scopes by the closed role policy, so it
    // is a positive control for the administrator path, not a denial probe.
    for (const token of [OPERATOR, VIEWER, EMPTY]) {
      const denied = await get(f.port, `/vict/v1/runs/${protectedRun}/detail`, token);
      expect(denied.status).toBe(403);
      expect(denied.body.code).toBe('VICT_ACTOR_SCOPE_DENIED');
    }
    // Positive: the explicitly granted operator.
    const allowed = await get(f.port, `/vict/v1/runs/${protectedRun}/detail`, DETAIL);
    expect(allowed.status).toBe(200);
    expect(allowed.data.protectedAvailable).toBe(true);
    expect(allowed.data.retention).toBe('full');
    // Per-access audit: one attributable event for the authorized retrieval.
    const audit = await get(f.port, '/vict/v1/audit?subjectType=run', DETAIL);
    expect(audit.status).toBe(200);
    const events = audit.data.events as Array<Record<string, unknown>>;
    const accessEvents = events.filter((event) => event.action === 'run.detail.accessed');
    expect(accessEvents.length).toBe(1);
    expect(accessEvents[0]?.actorId).toBe('actor-detail-operator');
    expect(accessEvents[0]?.subjectId).toBe(protectedRun);
  });

  it('run.detail (D-5): summary retention truthfully reports unavailability', async () => {
    const f = await fixture();
    const manifest = fixtureManifest('g1-graph-detail-summary');
    const [summaryRun] = (await seedRuns(f.vict, manifest, 1, { retention: 'summary' })) as [string, ...string[]];
    const response = await get(f.port, `/vict/v1/runs/${summaryRun}/detail`, DETAIL);
    expect(response.status).toBe(200);
    expect(response.data.protectedAvailable).toBe(false);
    expect(response.data.protectedOutput).toBeNull();
    expect(response.data.retention).toBe('summary');
  });

  it('activation reads: identity views with truthful absence', async () => {
    const f = await fixture();
    const manifest = fixtureManifest('g1-graph-act');
    await f.vict.catalog.publish({
      manifest,
      canonicalManifest: toCanonicalJson(manifest),
    });
    const list = await get(f.port, '/vict/v1/activations?graphId=g1-graph-act', OPERATOR);
    expect(list.status).toBe(200);
    const activations = list.data.activations as Array<Record<string, unknown>>;
    expect(activations.length).toBe(1);
    expect(activations[0]?.graphId).toBe('g1-graph-act');
    expect(Array.isArray(activations[0]?.nodeIds)).toBe(true);
    expect(activations[0]?.nodeCount).toBe(2);
    const one = await get(
      f.port,
      `/vict/v1/activations/${manifest.activationVersion}`,
      OPERATOR,
    );
    expect(one.status).toBe(200);
    const missing = await get(f.port, '/vict/v1/activations/v-never-published', OPERATOR);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('VICT_STORE_ACTIVATION_NOT_FOUND');
    // Truthful absence for an unselected graph (NOT an error):
    const unselected = await get(
      f.port,
      '/vict/v1/graphs/g1-graph-act/activations/selected',
      OPERATOR,
    );
    expect(unselected.status).toBe(200);
    expect(unselected.data.selection).toBeNull();
  });

  it('release reads: identity lists; truthful empty history', async () => {
    const f = await fixture();
    const releases = await get(f.port, '/vict/v1/releases?applicationId=app.none', OPERATOR);
    expect(releases.status).toBe(200);
    expect(releases.data.releases).toEqual([]);
    const selections = await get(
      f.port,
      '/vict/v1/releases/selections?applicationId=app.none',
      OPERATOR,
    );
    expect(selections.status).toBe(200);
    expect(selections.data.selections).toEqual([]);
  });

  it('scope matrix: every new read command denies the no-scope actor with 403', async () => {
    const f = await fixture();
    const manifest = fixtureManifest('g1-graph-scope');
    const [runId] = (await seedRuns(f.vict, manifest, 1)) as [string, ...string[]];
    const paths = [
      '/vict/v1/runs',
      `/vict/v1/runs/${runId}`,
      `/vict/v1/runs/${runId}/events`,
      `/vict/v1/runs/${runId}/waits`,
      `/vict/v1/runs/${runId}/detail`,
      '/vict/v1/activations',
      `/vict/v1/activations/${manifest.activationVersion}`,
      '/vict/v1/graphs/g1-graph-scope/activations/selected',
      '/vict/v1/releases?applicationId=app.scope',
      '/vict/v1/releases/selections?applicationId=app.scope',
      '/vict/v1/audit',
    ];
    for (const path of paths) {
      const denied = await get(f.port, path, EMPTY);
      expect(denied.status).toBe(403);
      expect(denied.body.code).toBe('VICT_ACTOR_SCOPE_DENIED');
    }
    // run.detail also denies actors that hold run.read but not run.detail.
    const detailDenied = await get(f.port, `/vict/v1/runs/${runId}/detail`, OPERATOR);
    expect(detailDenied.status).toBe(403);
  });

  it('viewer can read runs/activations/releases/audit but NOT run.detail', async () => {
    const f = await fixture();
    const manifest = fixtureManifest('g1-graph-viewer');
    const [runId] = (await seedRuns(f.vict, manifest, 1)) as [string, ...string[]];
    for (const path of [
      '/vict/v1/runs',
      `/vict/v1/runs/${runId}`,
      `/vict/v1/runs/${runId}/events`,
      `/vict/v1/runs/${runId}/waits`,
      '/vict/v1/activations',
      '/vict/v1/releases?applicationId=app.viewer',
      '/vict/v1/audit',
    ]) {
      const response = await get(f.port, path, VIEWER);
      expect(response.status).toBe(200);
    }
    const detail = await get(f.port, `/vict/v1/runs/${runId}/detail`, VIEWER);
    expect(detail.status).toBe(403);
  });

  it('deployment without the read ports fails closed with a stable unavailable code', async () => {
    const f = await portlessFixture();
    for (const path of [
      '/vict/v1/runs',
      '/vict/v1/runs/run-x',
      '/vict/v1/runs/run-x/events',
      '/vict/v1/runs/run-x/waits',
    ]) {
      const response = await get(f.port, path, OPERATOR);
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('VICT_OPERATOR_READ_UNAVAILABLE');
    }
    // Scope denial PRECEDES port availability: an actor without the
    // protected-detail scope gets the same 403 it would get on a fully
    // composed deployment — absence of capability discloses nothing.
    {
      const response = await get(f.port, '/vict/v1/runs/run-x/detail', OPERATOR);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('VICT_ACTOR_SCOPE_DENIED');
    }
    for (const path of ['/vict/v1/activations', '/vict/v1/activations/v1']) {
      const response = await get(f.port, path, OPERATOR);
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('VICT_OPERATOR_READ_UNAVAILABLE');
    }
  });
});
