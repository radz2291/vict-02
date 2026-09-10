import { describe, expect, it } from 'vitest';
import {
  AgentStreamHub,
  authenticatedActorContext,
  createInMemoryAgentControlStores,
  createInMemoryStores,
  VictControlError,
  type ActivationCatalog,
  type ActorRecord,
  type CommandIdempotencyReceipt,
} from '@victframework/runtime';
import { ControlPlaneService } from '@victframework/control';
import { defineContract, type ContractResult } from '@victframework/contracts';
import {
  compileApplication,
  createInMemoryApplicationData,
  type ApplicationDataResult,
  type ApplicationPlan,
} from '@victframework/application';
import {
  APPLICATION_DEFINITION_SCHEMA_V2,
  defineApplication,
  defineResource,
  RESOURCE_DEFINITION_SCHEMA,
} from '@victframework/sdk';
import {
  MUTATION_INPUT_MAX_BYTES,
  MUTATION_INPUT_MAX_DEPTH,
  VictCommandService,
  createLocalTestAuthenticator,
  createServerAuthenticator,
  createVictHttpServer,
  listenVictHttpServer,
  remoteAction,
  remoteMutate,
  remoteQuery,
  type ApplicationDataPortLike,
  type RemoteApplicationDataOptions,
  type ServerActorContext,
} from '../src/index.js';

/**
 * Stage 07C Phase F — the governed mutation-input boundary (F-8 correction).
 *
 * These suites prove that the complete declared mutation request (op, target
 * identity, typed input, keyed domain idempotency key) survives the released
 * `app.data.mutate`/`app.data.action` command path — direct dispatch, the
 * remote boundary, and the real HTTP transport — into the conforming
 * `ApplicationDataMutationRequest` shape of the Application data adapter,
 * under the closed-envelope, compiled-plan, contract-fence, delivery-safe
 * value, prototype-safety, and idempotency disciplines of the Stage 07C
 * handoff §6, together with the negative-control matrix (VC-1..VC-12).
 *
 * The composed adapter in these suites is the REAL in-memory reference
 * adapter (`@victframework/application`) acting as the authoritative second
 * fence; the remote boundary is the first fence.
 */

// ---- Fixed test composition -------------------------------------------------

const CANARY = 'CREDENTIAL-CANARY-f8b41c-probe';

const noteCreateContract = defineContract<Record<string, unknown>>({
  id: 'test.notes.create.input',
  revision: '1',
  expected: '{ id: string, title: string, note?: plain }',
  parse: (input): ContractResult<Record<string, unknown>> => {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return {
        ok: false,
        issues: [{ code: 'invalid_type', path: '(root)', message: 'plain object required' }],
      };
    }
    const record = input as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!['id', 'title', 'note'].includes(key)) {
        return {
          ok: false,
          issues: [
            { code: 'unknown_field', path: key, message: 'field outside the closed input schema' },
          ],
        };
      }
    }
    if (typeof record['id'] !== 'string' || record['id'].length === 0) {
      return {
        ok: false,
        issues: [{ code: 'invalid_type', path: 'id', message: 'non-empty string required' }],
      };
    }
    if (typeof record['title'] !== 'string') {
      return {
        ok: false,
        issues: [{ code: 'invalid_type', path: 'title', message: 'string required' }],
      };
    }
    return { ok: true, value: record };
  },
});

const noteArchiveContract = defineContract<{ id: string }>({
  id: 'test.notes.archive.input',
  revision: '1',
  expected: '{ id: string }',
  parse: (input): ContractResult<{ id: string }> => {
    const id = (input as { id?: unknown } | null)?.id;
    if (typeof id !== 'string' || id.length === 0) {
      return {
        ok: false,
        issues: [{ code: 'invalid_type', path: 'id', message: 'non-empty string required' }],
      };
    }
    return { ok: true, value: { id } };
  },
});

const noteResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'res.notes',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'title', type: 'string', required: true },
    { name: 'note', type: 'json' },
  ],
  mutations: [
    {
      op: 'create',
      effect: 'write',
      idempotency: 'keyed',
      permissions: ['res.notes.write'],
      inputContractId: 'test.notes.create.input',
    },
    {
      op: 'rename',
      effect: 'write',
      permissions: ['res.notes.write'],
      inputContractId: 'test.notes.create.input',
    },
    {
      op: 'archive',
      effect: 'write',
      permissions: ['res.notes.write'],
      inputContractId: 'test.notes.archive.input',
    },
  ],
  authorization: { effect: 'read' },
});

const noteApplication = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.notes',
  revision: '1',
  routes: [{ id: 'home', path: '/', screenId: 's.home', nav: { label: 'Notes', order: 1 } }],
  screens: [
    {
      id: 's.home',
      title: 'Notes',
      layout: [
        { name: 'main', surfaces: [{ role: 'text', id: 't.main', content: 'Notes workspace' }] },
      ],
      states: {
        empty: { role: 'text', id: 't.empty', content: 'No notes yet.' },
        denied: { role: 'text', id: 't.denied', content: 'Denied.' },
        failure: { role: 'text', id: 't.failure', content: 'Failed safely.' },
      },
    },
  ],
  actions: [
    {
      kind: 'mutation',
      id: 'act.createNote',
      revision: '1',
      resourceId: 'res.notes',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'test.notes.create.input',
    },
    {
      kind: 'mutation',
      id: 'act.renameNote',
      revision: '1',
      resourceId: 'res.notes',
      resourceRevision: '1',
      op: 'rename',
      inputContractId: 'test.notes.create.input',
    },
    {
      kind: 'mutation',
      id: 'act.archiveNote',
      revision: '1',
      resourceId: 'res.notes',
      resourceRevision: '1',
      op: 'archive',
      inputContractId: 'test.notes.archive.input',
    },
    {
      kind: 'query',
      id: 'act.queryNotes',
      revision: '1',
      resourceId: 'res.notes',
      resourceRevision: '1',
    },
  ],
  resources: [{ resourceId: 'res.notes', revision: '1' }],
});

function compileNotesPlan(): ApplicationPlan {
  const result = compileApplication({
    application: noteApplication,
    resources: [noteResource],
    contracts: [
      { id: 'test.notes.create.input', revision: '1' },
      { id: 'test.notes.archive.input', revision: '1' },
    ],
    capabilities: [],
    components: [],
  });
  if (!result.ok) {
    throw new Error(`test plan compilation failed: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}

/** The composed compiled-plan action resolver (closed shape). */
function planActionResolver(plan: ApplicationPlan) {
  return (actionId: string) => {
    const action = plan.actions[actionId];
    if (action === undefined || action.kind !== 'mutation') {
      return undefined;
    }
    return {
      actionId,
      revision: action.revision,
      kind: 'mutation' as const,
      resourceId: action.resourceId,
      op: action.op,
      inputContractId: action.inputContractId,
    };
  };
}

const contractImplementations: Record<string, typeof noteCreateContract> = {
  'test.notes.create.input': noteCreateContract,
  'test.notes.archive.input': noteArchiveContract,
};

function planContractResolver(plan: ApplicationPlan) {
  return (actionId: string) => {
    const action = plan.actions[actionId];
    if (
      action === undefined ||
      action.kind !== 'mutation' ||
      action.inputContractId === undefined
    ) {
      return undefined;
    }
    return contractImplementations[action.inputContractId];
  };
}

interface PortProbe {
  readonly port: ApplicationDataPortLike;
  calls(): unknown[];
  reset(): void;
}

/**
 * The composed Application data port: forwards the conforming
 * ApplicationDataMutationRequest to the REAL in-memory reference adapter
 * (authoritative second fence) and records every adapter request. The legacy
 * identity-only request shape stays fail-closed exactly as in the recorded
 * Stage 07B consumer behavior (a conforming adapter cannot execute an
 * op-less request).
 */
function probePort(): PortProbe {
  const adapter = createInMemoryApplicationData([noteResource], {
    contracts: [noteCreateContract, noteArchiveContract],
    seeds: {
      'res.notes': [{ id: 'note-1', title: 'Existing', note: 'seeded' }],
    },
  });
  const calls: unknown[] = [];
  const writeContext = {
    permissions: ['res.notes.read', 'res.notes.write'],
    effect: 'write' as const,
    actor: 'actor-env',
  };
  const readContext = {
    permissions: ['res.notes.read'],
    effect: 'read' as const,
    actor: 'actor-env',
  };
  return {
    calls: () => calls,
    reset: () => {
      calls.length = 0;
    },
    port: {
      async query(request: Record<string, unknown>) {
        calls.push(request);
        return adapter.query(
          { op: 'list', resourceId: String(request['resourceId']) },
          readContext,
        );
      },
      async mutate(request: Record<string, unknown>) {
        calls.push(request);
        if (typeof request['op'] !== 'string') {
          return {
            ok: false,
            code: 'DATA_MUTATION_NOT_DECLARED',
            message: 'The released identity-only request carries no declared op.',
          } satisfies ApplicationDataResult;
        }
        return adapter.mutate(
          {
            resourceId: String(request['resourceId']),
            op: String(request['op']),
            ...(request['input'] !== undefined ? { input: request['input'] } : {}),
            ...(typeof request['id'] === 'string' ? { id: request['id'] } : {}),
            ...(typeof request['idempotencyKey'] === 'string'
              ? { idempotencyKey: request['idempotencyKey'] }
              : {}),
          },
          writeContext,
        );
      },
    },
  };
}

function actorContext(actorId: string, roles: ActorRecord['roles']): ServerActorContext {
  const record: ActorRecord = { actorId, status: 'active', roles, createdAt: 0 };
  return {
    ...authenticatedActorContext(record, actorId),
    presentedTokenKind: 'local-test' as const,
  };
}

interface Env {
  readonly service: VictCommandService;
  readonly actor: ServerActorContext;
  readonly viewer: ServerActorContext;
  readonly probe: PortProbe;
  readonly options: () => RemoteApplicationDataOptions;
  readonly receipt: (idempotencyKey: string) => Promise<CommandIdempotencyReceipt | undefined>;
}

function makeEnv(): Env {
  const plan = compileNotesPlan();
  const probe = probePort();
  const options: RemoteApplicationDataOptions = {
    data: probe.port,
    expectedReleaseVersion: 'release-1',
    resolveAction: planActionResolver(plan),
    resolveInputContract: planContractResolver(plan),
  };
  const stores = createInMemoryAgentControlStores();
  const catalog: ActivationCatalog = createInMemoryStores().catalog;
  const controlPlane = new ControlPlaneService({ stores, catalog, clock: () => 1000 });
  const service = new VictCommandService({
    stores,
    controlPlane,
    clock: () => 1000,
    appData: {
      query: (actor, input) => remoteQuery(actor, options, input),
      mutate: (actor, input) => remoteMutate(actor, options, input),
    },
  });
  return {
    service,
    actor: actorContext('actor-env', ['operator']),
    viewer: actorContext('actor-viewer', ['viewer']),
    probe,
    options: () => options,
    receipt: (idempotencyKey) =>
      stores.commandIdempotency.getReceipt({
        actorId: 'actor-env',
        command: 'app.data.mutate',
        idempotencyKey,
      }),
  };
}

function envelopePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    resourceId: 'res.notes',
    releaseVersion: 'release-1',
    expectedRevision: '0',
    actionKind: 'mutation',
    actionId: 'act.createNote',
    expectedActionRevision: '1',
    mutation: {
      op: 'create',
      idempotencyKey: 'domain-key-1',
      input: { id: 'note-2', title: 'From envelope', note: { tag: 'a', tags: ['x', 'y'] } },
    },
    ...overrides,
  };
}

function dispatchEnvelope(
  env: Env,
  idempotencyKey: string,
  overrides: Record<string, unknown> = {},
): Promise<unknown> {
  return env.service.dispatch(env.actor, {
    command: 'app.data.mutate',
    payload: envelopePayload(overrides),
    idempotencyKey,
  });
}

/** Assert a stable rejection by code and that the adapter was never called. */
async function expectRejected(
  run: () => Promise<unknown>,
  code: string,
  probe?: PortProbe,
): Promise<void> {
  const error = await run().then(
    () => {
      throw new Error(`expected rejection with code ${code}, but the call succeeded`);
    },
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(VictControlError);
  expect((error as VictControlError).code).toBe(code);
  if (probe !== undefined) {
    expect(probe.calls().length).toBe(0);
  }
}

interface HttpEnv {
  readonly server: ReturnType<typeof createVictHttpServer>;
  readonly probe: PortProbe;
  close(): Promise<void>;
}

async function makeHttpEnv(
  optionsOverride?: Partial<RemoteApplicationDataOptions>,
): Promise<HttpEnv> {
  const plan = compileNotesPlan();
  const probe = probePort();
  const options: RemoteApplicationDataOptions = {
    data: probe.port,
    expectedReleaseVersion: 'release-1',
    resolveAction: planActionResolver(plan),
    resolveInputContract: planContractResolver(plan),
    ...optionsOverride,
  };
  const stores = createInMemoryAgentControlStores();
  const catalog: ActivationCatalog = createInMemoryStores().catalog;
  const directory = {
    async get(actorId: string) {
      return actorId === 'actor-env'
        ? {
            actorId: 'actor-env',
            status: 'active' as const,
            roles: ['operator' as const],
            createdAt: 0,
          }
        : undefined;
    },
    async list() {
      return [];
    },
    async upsert() {
      return undefined;
    },
  };
  const auth = createServerAuthenticator({
    authenticator: createLocalTestAuthenticator({ token: 'actor-env' }),
    directory,
  });
  const controlPlane = new ControlPlaneService({ stores, catalog, clock: () => Date.now() });
  const commandService = new VictCommandService({
    stores,
    controlPlane,
    clock: () => Date.now(),
    appData: {
      query: (actor, input) => remoteQuery(actor, options, input),
      mutate: (actor, input) => remoteMutate(actor, options, input),
    },
  });
  const hub = new AgentStreamHub({ ledger: stores.streamLedger, clock: () => Date.now() });
  const server = createVictHttpServer({ commandService, auth, hub, stores });
  await listenVictHttpServer(server);
  return { server, probe, close: () => server.close() };
}

// ---- Positive path ----------------------------------------------------------

describe('Stage 07C Phase F — governed mutation envelope (positive path)', () => {
  it('carries every declared mutation field value-for-value into the adapter (VC-2)', async () => {
    const env = makeEnv();
    env.probe.reset();
    const outcome = await env.service.dispatch(env.actor, {
      command: 'app.data.mutate',
      payload: envelopePayload(),
      idempotencyKey: 'cmd-key-positive-1',
    });
    expect(outcome.ok).toBe(true);
    const forwarded = env.probe.calls()[0] as Record<string, unknown>;
    // EXACTLY the conforming ApplicationDataMutationRequest shape — no
    // envelope scaffolding, no ambient fields.
    expect(Object.keys(forwarded).sort()).toEqual(['idempotencyKey', 'input', 'op', 'resourceId']);
    expect(forwarded['resourceId']).toBe('res.notes');
    expect(forwarded['op']).toBe('create');
    expect(forwarded['idempotencyKey']).toBe('domain-key-1');
    expect(forwarded['input']).toEqual({
      id: 'note-2',
      title: 'From envelope',
      note: { tag: 'a', tags: ['x', 'y'] },
    });
  });

  it('valid nested delivery-safe input survives the boundary value-for-value', async () => {
    const env = makeEnv();
    env.probe.reset();
    const nested = {
      id: 'note-3',
      title: 'Nested',
      note: { level1: { level2: { level3: { items: ['two', true, null, { deep: 'value' }] } } } },
    };
    const outcome = await env.service.dispatch(env.actor, {
      command: 'app.data.mutate',
      payload: envelopePayload({
        mutation: { op: 'create', idempotencyKey: 'domain-key-nested', input: nested },
      }),
      idempotencyKey: 'cmd-key-nested-1',
    });
    expect(outcome.ok).toBe(true);
    expect((env.probe.calls()[0] as Record<string, unknown>)['input']).toEqual(nested);
  });

  it('remoteAction(mutation) has the same governed behavior as remoteMutate (VC-2)', async () => {
    const env = makeEnv();
    env.probe.reset();
    const outcome = await env.service.dispatch(env.actor, {
      command: 'app.data.action',
      payload: envelopePayload(),
      idempotencyKey: 'cmd-key-action-1',
    });
    expect(outcome.ok).toBe(true);
    const forwarded = env.probe.calls()[0] as Record<string, unknown>;
    expect(Object.keys(forwarded).sort()).toEqual(['idempotencyKey', 'input', 'op', 'resourceId']);
    expect(forwarded['op']).toBe('create');
    expect(forwarded['input']).toEqual(
      (envelopePayload()['mutation'] as Record<string, unknown>)['input'],
    );
  });

  it('direct remoteMutate and remoteAction forwarding agree with the command path', async () => {
    const env = makeEnv();
    env.probe.reset();
    const actor = env.actor;
    await remoteMutate(actor, env.options(), envelopePayload());
    expect(env.probe.calls()[0]).toMatchObject({
      resourceId: 'res.notes',
      op: 'create',
      idempotencyKey: 'domain-key-1',
    });
    env.probe.reset();
    await remoteAction(
      actor,
      env.options(),
      envelopePayload({
        actionId: 'act.renameNote',
        mutation: { op: 'rename', id: 'note-1', input: { id: 'note-1', title: 'Renamed' } },
      }),
    );
    const forwarded = env.probe.calls()[0] as Record<string, unknown>;
    expect(forwarded).toMatchObject({
      resourceId: 'res.notes',
      op: 'rename',
      id: 'note-1',
    });
    expect((forwarded['input'] as Record<string, unknown>)['title']).toBe('Renamed');
  });

  it('identity remains server-derived: an actor without app.data.write is denied below the transport (VC-11)', async () => {
    const env = makeEnv();
    env.probe.reset();
    await expect(
      env.service.dispatch(env.viewer, {
        command: 'app.data.mutate',
        payload: envelopePayload(),
        idempotencyKey: 'cmd-key-denied-1',
      }),
    ).rejects.toMatchObject({ code: 'VICT_ACTOR_SCOPE_DENIED' });
    expect(env.probe.calls().length).toBe(0);
  });

  it('repeated use of the same command idempotency key settles once and replays (VC-8)', async () => {
    const env = makeEnv();
    env.probe.reset();
    const dispatch = () =>
      env.service.dispatch(env.actor, {
        command: 'app.data.mutate',
        payload: envelopePayload({
          mutation: {
            op: 'create',
            idempotencyKey: 'domain-key-replay',
            input: { id: 'note-r1', title: 'Replay' },
          },
        }),
        idempotencyKey: 'cmd-key-replay-1',
      });
    const first = await dispatch();
    expect(first.ok).toBe(true);
    const replay = await dispatch();
    expect(replay.ok).toBe(true);
    // Exactly ONE adapter mutate across both dispatches.
    expect(env.probe.calls().length).toBe(1);
    // VC-9: a different payload under the SAME durable key is a stable conflict.
    const conflict = await env.service.dispatch(env.actor, {
      command: 'app.data.mutate',
      payload: envelopePayload({
        mutation: {
          op: 'create',
          idempotencyKey: 'domain-key-replay',
          input: { id: 'note-r2', title: 'Different' },
        },
      }),
      idempotencyKey: 'cmd-key-replay-1',
    });
    expect(conflict).toMatchObject({ ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' });
    expect(env.probe.calls().length).toBe(1);
  });

  it('the keyed domain idempotency key reaches the adapter reconciliation boundary', async () => {
    const plan = compileNotesPlan();
    const probe = probePort();
    const options: RemoteApplicationDataOptions = {
      data: probe.port,
      expectedReleaseVersion: 'release-1',
      resolveAction: planActionResolver(plan),
      resolveInputContract: planContractResolver(plan),
    };
    const actor = actorContext('actor-env', ['operator']);
    const payload = envelopePayload({
      mutation: {
        op: 'create',
        idempotencyKey: 'domain-key-dedupe',
        input: { id: 'note-d1', title: 'Dedupe' },
      },
    });
    const first = (await remoteMutate(actor, options, payload)) as ApplicationDataResult;
    expect(first).toMatchObject({ ok: true });
    // Same domain key + same canonical request reconciles to one committed row.
    const replay = (await remoteMutate(actor, options, payload)) as ApplicationDataResult;
    expect(replay).toMatchObject({ ok: true });
    // The same domain key with DIFFERENT canonical input is a stable conflict.
    const conflict = (await remoteMutate(
      actor,
      options,
      envelopePayload({
        mutation: {
          op: 'create',
          idempotencyKey: 'domain-key-dedupe',
          input: { id: 'note-d2', title: 'Different' },
        },
      }),
    )) as ApplicationDataResult;
    expect(conflict).toMatchObject({ ok: false, code: 'DATA_IDEMPOTENCY_CONFLICT' });
  });

  it('definitions and calls without mutation input retain the previous behavior byte-for-byte (VC-2/VC-12)', async () => {
    const probe = probePort();
    const options: RemoteApplicationDataOptions = {
      data: probe.port,
      expectedReleaseVersion: 'release-1',
    };
    const actor = actorContext('actor-env', ['operator']);
    const result = await remoteMutate(actor, options, {
      resourceId: 'res.notes',
      releaseVersion: 'release-1',
      expectedRevision: '0',
      actionKind: 'mutation',
    });
    // The legacy identity-only adapter request shape is unchanged exactly.
    expect(probe.calls()[0]).toEqual({
      kind: 'mutate',
      resourceId: 'res.notes',
      releaseVersion: 'release-1',
      actorId: 'actor-env',
      expectedRevision: '0',
      actionKind: 'mutation',
    });
    // A conforming adapter cannot execute the op-less legacy request; the
    // composed fail-closed result flows back exactly as recorded in Stage 07B.
    expect(result).toMatchObject({ ok: false, code: 'DATA_MUTATION_NOT_DECLARED' });
  });

  it('HTTP and direct server invocation agree through the corrected boundary', async () => {
    const env = await makeHttpEnv();
    try {
      env.probe.reset();
      const response = await fetch(`http://127.0.0.1:${env.server.port()}/vict/v1/app/actions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer token',
          'idempotency-key': 'http-key-agree-1',
        },
        body: JSON.stringify({ schema: 'vict.command@1', payload: envelopePayload() }),
      });
      expect(response.status).toBe(200);
      const forwarded = env.probe.calls()[0] as Record<string, unknown>;
      expect(Object.keys(forwarded).sort()).toEqual([
        'idempotencyKey',
        'input',
        'op',
        'resourceId',
      ]);
      expect(forwarded['op']).toBe('create');
      // The same mutation route carries an identical direct-invocation request.
      env.probe.reset();
      const actionsResponse = await fetch(
        `http://127.0.0.1:${env.server.port()}/vict/v1/app/actions`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer token',
            'idempotency-key': 'http-key-agree-2',
          },
          body: JSON.stringify({ payload: envelopePayload() }),
        },
      );
      expect(actionsResponse.status).toBe(200);
      expect((env.probe.calls()[0] as Record<string, unknown>)['op']).toBe('create');
    } finally {
      await env.close();
    }
  });
});

// ---- Negative controls (VC matrix) ------------------------------------------

describe('Stage 07C Phase F — negative controls (VC matrix)', () => {
  it('VC-1 regression fixture: the pre-correction F-8 attempt shape is STILL rejected (closed set not widened)', async () => {
    const env = makeEnv();
    env.probe.reset();
    await expect(
      env.service.dispatch(env.actor, {
        command: 'app.data.mutate',
        payload: {
          resourceId: 'res.notes',
          releaseVersion: 'release-1',
          expectedRevision: '0',
          actionKind: 'mutation',
          op: 'create',
          input: { id: 'note-x', title: 'x' },
        },
        idempotencyKey: 'cmd-key-vc1',
      }),
    ).rejects.toMatchObject({ code: 'VICT_COMMAND_PAYLOAD_INVALID' });
    expect(env.probe.calls().length).toBe(0);
  });

  it('VC-3: unknown envelope field and unknown top-level field fail closed without echo', async () => {
    const env = makeEnv();
    await expectRejected(
      () =>
        dispatchEnvelope(env, 'cmd-key-vc3a', {
          mutation: { op: 'create', ambient: CANARY, input: { id: 'n', title: 't' } },
        }),
      'VICT_COMMAND_PAYLOAD_INVALID',
      env.probe,
    );
    await expectRejected(
      () => dispatchEnvelope(env, 'cmd-key-vc3b', { undeclaredTopLevel: CANARY }),
      'VICT_COMMAND_PAYLOAD_INVALID',
      env.probe,
    );
  });

  it('a missing required envelope op fails closed', async () => {
    const env = makeEnv();
    await expectRejected(
      () =>
        dispatchEnvelope(env, 'cmd-key-vc3c', {
          mutation: { input: { id: 'n', title: 't' } },
        }),
      'VICT_APPDATA_FIELD_INVALID',
      env.probe,
    );
  });

  it('missing required input for the declared action contract fails closed and replays safely (VC-5)', async () => {
    const env = makeEnv();
    env.probe.reset();
    const payload = envelopePayload({
      mutation: { op: 'create', idempotencyKey: 'domain-key-missing' },
    });
    await expect(
      env.service.dispatch(env.actor, {
        command: 'app.data.mutate',
        payload,
        idempotencyKey: 'cmd-key-missing-input',
      }),
    ).rejects.toMatchObject({ code: 'VICT_APPDATA_INPUT_CONTRACT_REJECTED' });
    expect(env.probe.calls().length).toBe(0);
    // The deterministic failure settled durably; a replay of the same key
    // does NOT re-execute — it replays the durable failed disposition.
    const replay = await env.service.dispatch(env.actor, {
      command: 'app.data.mutate',
      payload,
      idempotencyKey: 'cmd-key-missing-input',
    });
    expect(replay).toMatchObject({ ok: false, code: 'VICT_APPDATA_INPUT_CONTRACT_REJECTED' });
    expect(env.probe.calls().length).toBe(0);
  });

  it('an invalid input type fails at the declared contract fence (VC-5)', async () => {
    const env = makeEnv();
    await expectRejected(
      () =>
        dispatchEnvelope(env, 'cmd-key-vc5', {
          mutation: { op: 'create', input: 'not-an-object' },
        }),
      'VICT_APPDATA_INPUT_CONTRACT_REJECTED',
      env.probe,
    );
  });

  it('an unknown action-input field under the closed input schema is rejected (no silent acceptance)', async () => {
    const env = makeEnv();
    await expectRejected(
      () =>
        dispatchEnvelope(env, 'cmd-key-vc5b', {
          mutation: { op: 'create', input: { id: 'n', title: 't', injectedField: CANARY } },
        }),
      'VICT_APPDATA_INPUT_CONTRACT_REJECTED',
      env.probe,
    );
  });

  it('VC-4: oversized input fails closed at the declared bound', async () => {
    const env = makeEnv();
    const big = { id: 'n', title: 't', note: { blob: 'x'.repeat(MUTATION_INPUT_MAX_BYTES) } };
    await expectRejected(
      () => dispatchEnvelope(env, 'cmd-key-vc4a', { mutation: { op: 'create', input: big } }),
      'VICT_APPDATA_MUTATION_INPUT_INVALID',
      env.probe,
    );
  });

  it('VC-4: excessive nesting fails closed (direct input bound and whole-payload command bound)', async () => {
    const env = makeEnv();
    let deep: Record<string, unknown> = { leaf: true };
    for (let i = 0; i <= MUTATION_INPUT_MAX_DEPTH + 2; i += 1) {
      deep = { nested: deep };
    }
    // Direct boundary: the declared input depth bound fires.
    await expectRejected(
      () =>
        remoteMutate(
          env.actor,
          env.options(),
          envelopePayload({
            mutation: { op: 'create', input: { id: 'n', title: 't', note: deep } },
          }),
        ),
      'VICT_APPDATA_MUTATION_INPUT_INVALID',
      env.probe,
    );
    // Command path: the whole-payload canonical depth bound fires first.
    await expect(
      env.service.dispatch(env.actor, {
        command: 'app.data.mutate',
        payload: envelopePayload({
          mutation: { op: 'create', input: { id: 'n', title: 't', note: deep } },
        }),
        idempotencyKey: 'cmd-key-vc4b2',
      }),
    ).rejects.toMatchObject({ code: 'VICT_COMMAND_PAYLOAD_INVALID' });
    expect(env.probe.calls().length).toBe(0);
  });

  it('arrays and keys beyond the declared bounds fail closed', async () => {
    const env = makeEnv();
    const longArray = {
      id: 'n',
      title: 't',
      note: { items: Array.from({ length: 1001 }, (_, i) => i) },
    };
    await expectRejected(
      () => dispatchEnvelope(env, 'cmd-key-vc4c', { mutation: { op: 'create', input: longArray } }),
      'VICT_APPDATA_MUTATION_INPUT_INVALID',
      env.probe,
    );
    const longKey = { id: 'n', title: 't', note: { [`${'k'.repeat(129)}`]: 'v' } };
    await expectRejected(
      () => dispatchEnvelope(env, 'cmd-key-vc4d', { mutation: { op: 'create', input: longKey } }),
      'VICT_APPDATA_MUTATION_INPUT_INVALID',
      env.probe,
    );
  });

  it('own __proto__ keys in any own form at any depth are REJECTED, never dropped or promoted (VC-4, handoff §6.8)', async () => {
    const env = makeEnv();
    // Scalar-valued own __proto__ (the silently-dropped pre-hardening form).
    await expectRejected(
      () =>
        dispatchEnvelope(env, 'cmd-key-proto1', {
          mutation: {
            op: 'create',
            input: JSON.parse('{"id":"n","title":"t","note":{"__proto__":5}}') as Record<
              string,
              unknown
            >,
          },
        }),
      'VICT_COMMAND_PAYLOAD_INVALID',
      env.probe,
    );
    // Object-valued own __proto__ (the prototype-promoting pre-hardening form).
    await expectRejected(
      () =>
        dispatchEnvelope(env, 'cmd-key-proto2', {
          mutation: {
            op: 'create',
            input: JSON.parse(
              '{"id":"n","title":"t","note":{"__proto__":{"polluted":true}}}',
            ) as Record<string, unknown>,
          },
        }),
      'VICT_COMMAND_PAYLOAD_INVALID',
      env.probe,
    );
    // Deeply nested form on the direct boundary (bypassing command JSON
    // canonicalization): a null-prototype container with an own __proto__ key.
    const nested = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(nested, '__proto__', { value: 'scalar', enumerable: true });
    await expectRejected(
      () =>
        remoteMutate(
          env.actor,
          env.options(),
          envelopePayload({
            mutation: { op: 'create', input: { id: 'n', title: 't', note: nested } },
          }),
        ),
      'VICT_APPDATA_MUTATION_INPUT_INVALID',
      env.probe,
    );
  });

  it('constructor and prototype string keys remain plain own data (handoff §6.8 positive control)', async () => {
    const env = makeEnv();
    env.probe.reset();
    const outcome = await env.service.dispatch(env.actor, {
      command: 'app.data.mutate',
      payload: envelopePayload({
        mutation: {
          op: 'create',
          idempotencyKey: 'domain-key-ctor',
          input: {
            id: 'note-ctor',
            title: 't',
            note: { constructor: 'plain', prototype: 'plain' },
          },
        },
      }),
      idempotencyKey: 'cmd-key-ctor',
    });
    expect(outcome.ok).toBe(true);
    const forwarded = env.probe.calls()[0] as Record<string, unknown>;
    expect((forwarded['input'] as Record<string, unknown>)['note']).toEqual({
      constructor: 'plain',
      prototype: 'plain',
    });
  });

  it('non-delivery-safe and non-serializable values fail closed without echo (VC-4)', async () => {
    const env = makeEnv();
    class Hostile {}
    const badValues: unknown[] = [
      () => 'fn',
      new Date(0),
      1n,
      Number.NaN,
      Infinity,
      Symbol('s'),
      new Hostile(),
    ];
    let index = 0;
    for (const bad of badValues) {
      await expectRejected(
        () =>
          remoteMutate(
            env.actor,
            env.options(),
            envelopePayload({
              mutation: { op: 'create', input: { id: 'n', title: 't', note: { wrapped: bad } } },
            }),
          ),
        'VICT_APPDATA_MUTATION_INPUT_INVALID',
        env.probe,
      );
      index += 1;
    }
    expect(index).toBe(badValues.length);
  });

  it('hostile containers (throwing proxies, hostile getters) produce stable non-echoing rejections', async () => {
    const env = makeEnv();
    const hostileProxy = new Proxy(
      {},
      {
        ownKeys(): string[] {
          throw new Error(`HOSTILE-CANARY-${CANARY}`);
        },
        getOwnPropertyDescriptor() {
          return { configurable: true, enumerable: true, value: 1 };
        },
      },
    );
    await expectRejected(
      () =>
        remoteMutate(env.actor, env.options(), {
          ...envelopePayload(),
          mutation: hostileProxy,
        }),
      'VICT_COMMAND_PAYLOAD_INVALID',
      env.probe,
    );
    const hostileGetter: Record<string, unknown> = { id: 'n', title: 't' };
    Object.defineProperty(hostileGetter, 'note', {
      get() {
        throw new Error(`HOSTILE-CANARY-${CANARY}`);
      },
      enumerable: true,
    });
    await expectRejected(
      () =>
        remoteMutate(env.actor, env.options(), {
          ...envelopePayload(),
          mutation: { op: 'create', input: hostileGetter },
        }),
      'VICT_APPDATA_MUTATION_INPUT_INVALID',
      env.probe,
    );
  });

  it('VC-6: an envelope op differing from the plan-declared op fails closed (action-schema mismatch)', async () => {
    const env = makeEnv();
    await expectRejected(
      () =>
        dispatchEnvelope(env, 'cmd-key-vc6a', {
          actionId: 'act.createNote',
          mutation: { op: 'rename', input: { id: 'n', title: 't' } },
        }),
      'VICT_APPDATA_ACTION_UNRESOLVED',
      env.probe,
    );
  });

  it('VC-6: tampered compiled-plan guards — stale expectedActionRevision and resource mismatch', async () => {
    const env = makeEnv();
    await expectRejected(
      () =>
        dispatchEnvelope(env, 'cmd-key-vc6b', {
          expectedActionRevision: '999',
        }),
      'VICT_APPDATA_ACTION_UNRESOLVED',
      env.probe,
    );
    await expectRejected(
      () =>
        dispatchEnvelope(env, 'cmd-key-vc6c', {
          resourceId: 'res.other',
        }),
      'VICT_APPDATA_ACTION_UNRESOLVED',
      env.probe,
    );
  });

  it('VC-6/VC-10: unknown actionId, missing actionId, uncomposed plan resolver, and unresolvable declared contract fail closed', async () => {
    const env = makeEnv();
    await expectRejected(
      () => dispatchEnvelope(env, 'cmd-key-vc10a', { actionId: 'act.doesNotExist' }),
      'VICT_APPDATA_ACTION_UNRESOLVED',
      env.probe,
    );
    // A payload whose actionId member is entirely absent (no undefined-value
    // key) also fails closed at the action-identity resolution.
    const missingActionId = envelopePayload();
    delete missingActionId['actionId'];
    await expectRejected(
      () =>
        env.service.dispatch(env.actor, {
          command: 'app.data.mutate',
          payload: missingActionId,
          idempotencyKey: 'cmd-key-vc10b',
        }),
      'VICT_APPDATA_ACTION_UNRESOLVED',
      env.probe,
    );
    const plan = compileNotesPlan();
    const probe = probePort();
    const noResolver: RemoteApplicationDataOptions = {
      data: probe.port,
      expectedReleaseVersion: 'release-1',
    };
    await expectRejected(
      () => remoteMutate(actorContext('actor-env', ['operator']), noResolver, envelopePayload()),
      'VICT_APPDATA_ACTION_UNRESOLVED',
      probe,
    );
    // Resolver composed but the declared input contract is not bound: fail
    // closed, never forward unvalidated input.
    const brokenContract: RemoteApplicationDataOptions = {
      data: probe.port,
      expectedReleaseVersion: 'release-1',
      resolveAction: planActionResolver(plan),
      resolveInputContract: () => undefined,
    };
    await expectRejected(
      () =>
        remoteMutate(actorContext('actor-env', ['operator']), brokenContract, envelopePayload()),
      'VICT_APPDATA_CONTRACT_RESOLVER_UNAVAILABLE',
      probe,
    );
  });

  it('VC-7: an unregistered capability kind on the data boundary is unchanged', async () => {
    const env = makeEnv();
    await expectRejected(
      () =>
        remoteAction(env.actor, env.options(), {
          actionKind: 'capability',
          resourceId: 'res.notes',
          releaseVersion: 'release-1',
          mutation: { op: 'create', input: { id: 'n', title: 't' } },
        }),
      'VICT_APPDATA_ACTION_UNAVAILABLE',
      env.probe,
    );
  });

  it('undeclared mutation fields cannot be injected after compilation at either level', async () => {
    const env = makeEnv();
    env.probe.reset();
    await expectRejected(
      () => dispatchEnvelope(env, 'cmd-key-inject-1', { ambientAfterCompile: CANARY }),
      'VICT_COMMAND_PAYLOAD_INVALID',
      env.probe,
    );
    await expectRejected(
      () =>
        dispatchEnvelope(env, 'cmd-key-inject-2', {
          mutation: {
            ...(envelopePayload()['mutation'] as Record<string, unknown>),
            ambient: CANARY,
          },
        }),
      'VICT_COMMAND_PAYLOAD_INVALID',
      env.probe,
    );
  });

  it('credential canaries never reach the durable receipt or any error surface (N-C1 discipline)', async () => {
    const env = makeEnv();
    env.probe.reset();
    await env.service.dispatch(env.actor, {
      command: 'app.data.mutate',
      payload: envelopePayload({
        mutation: {
          op: 'create',
          idempotencyKey: 'domain-key-canary',
          input: { id: 'note-c', title: CANARY },
        },
      }),
      idempotencyKey: 'cmd-key-canary',
    });
    // The durable command receipt retains identifiers only — never content.
    const receipt = await env.receipt('cmd-key-canary');
    expect(receipt).toBeDefined();
    expect(JSON.stringify(receipt)).not.toContain(CANARY);
    // A contract rejection does not echo the received value.
    const error = await dispatchEnvelope(env, 'cmd-key-canary-2', {
      mutation: { op: 'create', input: { id: 'n', title: 't', injected: CANARY } },
    }).then(
      () => {
        throw new Error('expected rejection');
      },
      (e: unknown) => e,
    );
    expect((error as VictControlError).code).toBe('VICT_APPDATA_INPUT_CONTRACT_REJECTED');
    expect(String((error as VictControlError).message)).not.toContain(CANARY);
  });

  it('a malformed HTTP body fails closed at the transport (unchanged discipline)', async () => {
    const env = await makeHttpEnv();
    try {
      const response = await fetch(`http://127.0.0.1:${env.server.port()}/vict/v1/app/mutate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: '{"payload": {"mutation": ',
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ ok: false, code: 'VICT_HTTP_BODY_MALFORMED' });
      expect(env.probe.calls().length).toBe(0);
    } finally {
      await env.close();
    }
  });
});
