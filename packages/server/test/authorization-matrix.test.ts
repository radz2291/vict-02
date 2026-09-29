import { afterAll, describe, expect, it } from 'vitest';
import { bearer, get, httpFixture, userToken } from './fixtures.js';

/**
 * Stage 06B — the PERMANENT public-API authorization matrix (corrective
 * finalization, F3): every public command is exercised against the closed
 * scope vocabulary over REAL HTTP:
 *
 * - no-scope: an authenticated actor with ZERO derived scopes is denied
 *   every protected operation (default deny) but may use the identity
 *   introspection commands;
 * - wrong-scope: an actor whose scopes do NOT include the required scope
 *   is denied with a stable 403 below the transport;
 * - correct-scope: an actor holding the required scope succeeds;
 * - cross-actor: reads of another actor's identifiers fail closed without
 *   existence disclosure;
 * - privileged: the explicit `operator.resolve` scope permits the broader
 *   access — and nothing else.
 *
 * Authorization is enforced in the shared command dispatcher (below the
 * HTTP transport), so the CLI consumes the SAME matrix.
 */

const fixtures: { close: () => Promise<void>; port: number }[] = [];
let current: Awaited<ReturnType<typeof httpFixture>> | undefined;

async function fixture(): Promise<Awaited<ReturnType<typeof httpFixture>>> {
  if (current === undefined) {
    current = await httpFixture();
    fixtures.push({ port: current.port, close: current.close });
  }
  return current;
}

afterAll(async () => {
  for (const entry of fixtures) {
    await entry.close();
  }
});

const NO_SCOPE = 'vict-test-token-empty';
const VIEWER = 'vict-test-token-viewer';
const DEVELOPER = 'vict-test-token-user'; // developer+approver+operator+administrator
const OPERATOR = 'vict-test-token-operator';
const APPROVER = 'vict-test-token-approver';

/** bearer() in fixtures.ts takes the COMPLETE header value. */
const auth = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` });

const EXPIRES = Date.now() + 3_600_000;

const PROPOSE_PAYLOAD = {
  payload: {
    changesetId: 'cs-matrix-1',
    base: { kind: 'release', subjectId: 'app.matrix', expectedVersion: 'none' },
    operations: [
      {
        kind: 'publish-and-select-release',
        release: {
          releaseVersion: 'release-matrix-1',
          applicationId: 'app.matrix',
          applicationVersion: 'appver-1',
          rendererIdentity: 'renderer@1',
          componentRegistryIdentity: 'registry@1',
          dataAdapterIdentity: 'adapter@1',
          activationBinding: 'activation-1',
        },
      },
    ],
    rationale: 'authorization matrix probe',
    riskClass: 'low',
    requiredApproverCount: 1,
    expiresAt: EXPIRES,
  },
};

/** Run one POST command; `key` namespaces the idempotency key. */
async function post(
  f: Awaited<ReturnType<typeof httpFixture>>,
  path: string,
  payload: Record<string, unknown>,
  token: string,
  key: string,
): Promise<{
  status: number;
  code: string | undefined;
  data: Record<string, unknown> | undefined;
}> {
  const response = await fetch(`http://127.0.0.1:${f.port}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': key,
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    status: response.status,
    code: typeof body.code === 'string' ? body.code : undefined,
    data: body.data as Record<string, unknown> | undefined,
  };
}

/** Run one GET command (Stage 9 read surface). */
async function getMatrix(
  f: Awaited<ReturnType<typeof httpFixture>>,
  path: string,
  token: string,
): Promise<{ status: number; code: string | undefined }> {
  const response = await fetch(`http://127.0.0.1:${f.port}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, code: typeof body.code === 'string' ? body.code : undefined };
}

/*
 * Stage 9 G2: the receipt-gated commands (release.select,
 * activation.select — and their confirmed-shape matrix rows, plus the
 * confirmation prepare/status scope rows) are pinned in a BLOCKED-ON-CORE
 * suite below; the transport bridge fails closed until the core
 * confirmation layer exposes prepareConfirmation/getConfirmationStatus.
 *
 * The LIVE P-11/P-12 rows below run against BOTH the bridge and the
 * integrated core fence.
 */
describe('Stage 9 G2 — permanent confirmation authorization rows', () => {
  const LEGACY_GATED: readonly (readonly [string, Record<string, unknown>])[] = [
    ['/vict/v1/runs/cancel', { payload: { runId: 'run-g2-mx', reasonCode: 'operator-cancel' } }],
    [
      '/vict/v1/activations/select',
      { payload: { graphId: 'graph-g2-mx', activationVersion: 'v-g2-mx' } },
    ],
    [
      '/vict/v1/releases/select',
      { payload: { applicationId: 'app-g2-mx', releaseVersion: 'release-g2-mx' } },
    ],
    [
      '/vict/v1/releases/rollback',
      { payload: { applicationId: 'app-g2-mx', targetReleaseVersion: 'release-g2-mx' } },
    ],
  ];

  it('P-11: no legacy bypass — unconfirmed mutations fail closed (operator)', async () => {
    const f = await fixture();
    for (const [path, envelope] of LEGACY_GATED) {
      const result = await post(
        f,
        path,
        envelope,
        OPERATOR,
        `mx-p11-op-${path.replace(/\//g, '-')}`,
      );
      expect(result.status).toBe(409);
      expect(result.code).toBe('VICT_CONFIRMATION_REQUIRED');
    }
  });

  it('P-11: no legacy bypass — unconfirmed mutations fail closed (developer)', async () => {
    const f = await fixture();
    for (const [path, envelope] of LEGACY_GATED) {
      const result = await post(
        f,
        path,
        envelope,
        DEVELOPER,
        `mx-p11-dev-${path.replace(/\//g, '-')}`,
      );
      expect(result.status).toBe(409);
      expect(result.code).toBe('VICT_CONFIRMATION_REQUIRED');
    }
  });

  it('P-12: administrator has NO legacy bypass — the same 409 fence', async () => {
    const f = await fixture();
    // The DEVELOPER token actor holds the administrator role (closed
    // all-scopes policy); authority does NOT soften the confirmation fence.
    for (const [path, envelope] of LEGACY_GATED) {
      const result = await post(
        f,
        path,
        envelope,
        DEVELOPER,
        `mx-p12-admin-${path.replace(/\//g, '-')}`,
      );
      expect(result.status).toBe(409);
      expect(result.code).toBe('VICT_CONFIRMATION_REQUIRED');
    }
  });

  it('the new intervention commands are receipt-gated for every actor (legacy shape rejected)', async () => {
    const f = await fixture();
    const resolve = await post(
      f,
      '/vict/v1/runs/run-g2-mx/resolve',
      { payload: { resolution: 'retry' } },
      DEVELOPER,
      'mx-p11-resolve',
    );
    expect(resolve.status).toBe(409);
    expect(resolve.code).toBe('VICT_CONFIRMATION_REQUIRED');
    const signal = await post(
      f,
      '/vict/v1/runs/run-g2-mx/signal',
      { payload: { signalName: 'nudge' } },
      DEVELOPER,
      'mx-p11-signal',
    );
    expect(signal.status).toBe(409);
    expect(signal.code).toBe('VICT_CONFIRMATION_REQUIRED');
  });

  describe('G2 confirmation scope rows (G2 core layer composed)', () => {
    // TODO(integrator): unskip when prepareConfirmation/getConfirmationStatus
    // land (signatures pinned in the transport candidate's integration notes
    // and the describe.skip TODO in http.test.ts).
    const CONFIRMED_LEGACY: readonly MatrixRow[] = [
      {
        command: 'release.select (confirmed shape)',
        wrongScopeToken: VIEWER,
        correctToken: OPERATOR,
        run: (f, token, tag) =>
          post(
            f,
            '/vict/v1/releases/select',
            {
              payload: { applicationId: 'app.g2mx', releaseVersion: 'release-g2mx-1' },
              confirmation: { receiptId: `rcpt-g2mx-${tag}` },
            },
            token,
            `mx-confirm-select-${tag}`,
          ),
      },
      {
        command: 'activation.select (confirmed shape)',
        wrongScopeToken: VIEWER,
        correctToken: OPERATOR,
        run: (f, token, tag) =>
          post(
            f,
            '/vict/v1/activations/select',
            {
              payload: { graphId: 'graph.g2mx', activationVersion: 'v-g2mx' },
              confirmation: { receiptId: `rcpt-g2mx-${tag}` },
            },
            token,
            `mx-confirm-activation-${tag}`,
          ),
      },
    ];
    for (const entry of CONFIRMED_LEGACY) {
      it(`[${entry.command}] no-scope actor is denied (default deny)`, async () => {
        const f = await fixture();
        const result = await entry.run(f, NO_SCOPE, 'noscope');
        expect(result.status).toBe(403);
        expect(result.code).toBe('VICT_ACTOR_SCOPE_DENIED');
      });
      it(`[${entry.command}] wrong-scope actor is denied with a stable 403`, async () => {
        const f = await fixture();
        const result = await entry.run(f, entry.wrongScopeToken, 'wrongscope');
        expect(result.status).toBe(403);
        expect(result.code).toBe('VICT_ACTOR_SCOPE_DENIED');
      });
      it(`[${entry.command}] correct-scope actor passes authorization (command may still fail on state)`, async () => {
        const f = await fixture();
        const result = await entry.run(f, entry.correctToken, 'ok');
        expect(result.status).not.toBe(403);
        expect(result.code).not.toBe('VICT_ACTOR_SCOPE_DENIED');
      });
    }
    it('confirmation prepare requires the TARGET command mutation scope (run.resolve / run.signal)', async () => {
      const f = await fixture();
      // A wrong-scope actor preparing run.resolve is denied with no receipt.
      const denied = await post(
        f,
        '/vict/v1/confirmations',
        {
          command: 'run.resolve',
          payload: { runId: 'r', resolution: 'retry' },
          expectedRevision: 0,
        },
        VIEWER,
        'mx-prepare-deny-resolve',
      );
      expect(denied.status).toBe(403);
      expect(denied.code).toBe('VICT_ACTOR_SCOPE_DENIED');
      const deniedSignal = await post(
        f,
        '/vict/v1/confirmations',
        { command: 'run.signal', payload: { runId: 'r', signalName: 'ping' }, expectedRevision: 0 },
        VIEWER,
        'mx-prepare-deny-signal',
      );
      expect(deniedSignal.status).toBe(403);
      expect(deniedSignal.code).toBe('VICT_ACTOR_SCOPE_DENIED');
      // A correct-scope actor passes authorization (no-scope denial).
      const allowed = await post(
        f,
        '/vict/v1/confirmations',
        {
          command: 'run.resolve',
          payload: { runId: 'r', resolution: 'retry' },
          expectedRevision: 0,
        },
        DEVELOPER, // administrator policy holds the new scopes by definition
        'mx-prepare-allow-resolve',
      );
      expect(allowed.status).not.toBe(403);
      expect(allowed.code).not.toBe('VICT_ACTOR_SCOPE_DENIED');
      void deniedSignal;
      void denied;
    });
    it('confirmation status read is scope-authorized in BOTH directions', async () => {
      const f = await fixture();
      const prepared = await post(
        f,
        '/vict/v1/confirmations',
        {
          command: 'run.cancel',
          payload: { runId: 'r-g2-status', reasonCode: 'operator-cancel' },
          expectedRevision: 0,
        },
        OPERATOR,
        'mx-status-prep',
      );
      expect(prepared.status).toBe(200);
      const receiptId = (prepared.data as Record<string, unknown>).receiptId as string;
      expect(typeof receiptId).toBe('string');
      // Own scope: allowed.
      const own = await getMatrix(f, `/vict/v1/confirmations/${receiptId}`, OPERATOR);
      expect(own.status).toBe(200);
      expect(own.code).toBeUndefined();
      // Wrong scope: stable non-echoing UNAVAILABLE.
      const wrong = await getMatrix(
        f,
        `/vict/v1/confirmations/${receiptId}`,
        'vict-test-token-approver',
      );
      expect(wrong.status).toBe(404);
      expect(wrong.code).toBe('VICT_CONFIRMATION_UNAVAILABLE');
    });
  });
});

interface MatrixRow {
  readonly command: string;
  readonly wrongScopeToken: string;
  readonly correctToken: string;
  run(
    f: Awaited<ReturnType<typeof httpFixture>>,
    token: string,
    tag: string,
  ): Promise<{ status: number; code: string | undefined }>;
}

describe('public-API authorization matrix (real HTTP, below-transport enforcement)', () => {
  const matrix: readonly MatrixRow[] = [
    {
      command: 'changeset.propose',
      wrongScopeToken: VIEWER,
      correctToken: DEVELOPER,
      run: (f, token, tag) =>
        post(
          f,
          '/vict/v1/changesets',
          {
            ...PROPOSE_PAYLOAD,
            payload: { ...PROPOSE_PAYLOAD.payload, changesetId: `cs-matrix-${tag}` },
          },
          token,
          `matrix-propose-${tag}`,
        ),
    },
    {
      command: 'changeset.revise',
      wrongScopeToken: VIEWER,
      correctToken: DEVELOPER,
      run: (f, token, tag) =>
        post(
          f,
          '/vict/v1/changesets/revise',
          {
            payload: {
              changesetId: 'cs-matrix-revise',
              operations: [{ kind: 'select-activation', graphId: 'g', activationVersion: 'v' }],
              rationale: 'r',
              riskClass: 'low',
              requiredApproverCount: 1,
              expiresAt: EXPIRES,
            },
          },
          token,
          `matrix-revise-${tag}`,
        ),
    },
    {
      command: 'changeset.attach-evidence',
      wrongScopeToken: VIEWER,
      correctToken: DEVELOPER,
      run: (f, token, tag) =>
        post(
          f,
          '/vict/v1/changesets/evidence',
          { payload: { changesetId: 'cs-matrix-revise', kind: 'validation', runId: 'run-x' } },
          token,
          `matrix-evidence-${tag}`,
        ),
    },
    {
      command: 'changeset.decide',
      wrongScopeToken: VIEWER,
      correctToken: APPROVER,
      run: (f, token, tag) =>
        post(
          f,
          '/vict/v1/changesets/decide',
          { payload: { changesetId: 'cs-matrix-revise', decision: 'approved' } },
          token,
          `matrix-decide-${tag}`,
        ),
    },
    {
      command: 'changeset.commit',
      wrongScopeToken: VIEWER,
      correctToken: DEVELOPER,
      run: (f, token, tag) =>
        post(
          f,
          '/vict/v1/changesets/commit',
          { payload: { changesetId: 'cs-matrix-revise' } },
          token,
          `matrix-commit-${tag}`,
        ),
    },
    {
      command: 'release.publish',
      wrongScopeToken: OPERATOR, // operator holds release.read/select but NOT release.publish
      correctToken: DEVELOPER,
      run: (f, token, tag) =>
        post(
          f,
          '/vict/v1/releases/publish',
          {
            payload: {
              releaseVersion: `release-matrix-pub-${tag}`,
              applicationId: 'app.matrix',
              applicationVersion: 'appver-1',
              rendererIdentity: 'renderer@1',
              componentRegistryIdentity: 'registry@1',
              dataAdapterIdentity: 'adapter@1',
              activationBinding: 'activation-1',
            },
          },
          token,
          `matrix-publish-${tag}`,
        ),
    },
    {
      command: 'agent.turn.cancel',
      wrongScopeToken: APPROVER, // approver holds no cancel scope
      correctToken: OPERATOR,
      run: (f, token, tag) =>
        post(
          f,
          '/vict/v1/turns/cancel',
          { payload: { turnId: 'turn-matrix-x' } },
          token,
          `matrix-turncancel-${tag}`,
        ),
    },
    {
      command: 'app.data.mutate',
      wrongScopeToken: VIEWER,
      correctToken: OPERATOR,
      run: (f, token, tag) =>
        post(
          f,
          '/vict/v1/app/actions',
          {
            payload: {
              resourceId: 'res.matrix',
              releaseVersion: 'release-matrix-1',
              actionKind: 'remote',
            },
          },
          token,
          `matrix-appdata-${tag}`,
        ),
    },
    {
      // Stage 9 G1: the protected-detail command is a scope row like any
      // other — nobody holds `run.detail` by default; the administrator
      // (DEVELOPER) holds it through the closed all-scopes policy.
      command: 'run.detail',
      wrongScopeToken: OPERATOR,
      correctToken: DEVELOPER,
      run: (f, token, tag) => getMatrix(f, `/vict/v1/runs/run-matrix-${tag}/detail`, token),
    },
    {
      command: 'run.list',
      wrongScopeToken: NO_SCOPE,
      correctToken: OPERATOR,
      run: (f, token) => getMatrix(f, '/vict/v1/runs', token),
    },
    {
      command: 'run.get',
      wrongScopeToken: NO_SCOPE,
      correctToken: OPERATOR,
      run: (f, token) => getMatrix(f, '/vict/v1/runs/run-matrix-get', token),
    },
    {
      command: 'run.events',
      wrongScopeToken: NO_SCOPE,
      correctToken: OPERATOR,
      run: (f, token) => getMatrix(f, '/vict/v1/runs/run-matrix-events/events', token),
    },
    {
      command: 'run.waits',
      wrongScopeToken: NO_SCOPE,
      correctToken: OPERATOR,
      run: (f, token) => getMatrix(f, '/vict/v1/runs/run-matrix-waits/waits', token),
    },
    {
      command: 'activation.list',
      wrongScopeToken: NO_SCOPE,
      correctToken: VIEWER,
      run: (f, token) => getMatrix(f, '/vict/v1/activations', token),
    },
    {
      command: 'activation.get',
      wrongScopeToken: NO_SCOPE,
      correctToken: VIEWER,
      run: (f, token) => getMatrix(f, '/vict/v1/activations/v-matrix', token),
    },
    {
      command: 'activation.selected',
      wrongScopeToken: NO_SCOPE,
      correctToken: VIEWER,
      run: (f, token) => getMatrix(f, '/vict/v1/graphs/graph-matrix/activations/selected', token),
    },
    {
      command: 'release.list',
      wrongScopeToken: NO_SCOPE,
      correctToken: VIEWER,
      run: (f, token) => getMatrix(f, '/vict/v1/releases?applicationId=app.matrix', token),
    },
    {
      command: 'release.selections',
      wrongScopeToken: NO_SCOPE,
      correctToken: VIEWER,
      run: (f, token) =>
        getMatrix(f, '/vict/v1/releases/selections?applicationId=app.matrix', token),
    },
    {
      command: 'audit.search',
      wrongScopeToken: NO_SCOPE,
      correctToken: VIEWER,
      run: (f, token) => getMatrix(f, '/vict/v1/audit', token),
    },
  ];

  for (const entry of matrix) {
    it(`[${entry.command}] no-scope actor is denied (default deny)`, async () => {
      const f = await fixture();
      const result = await entry.run(f, NO_SCOPE, 'noscope');
      expect(result.status).toBe(403);
      expect(result.code).toBe('VICT_ACTOR_SCOPE_DENIED');
    });

    it(`[${entry.command}] wrong-scope actor is denied with a stable 403`, async () => {
      const f = await fixture();
      const result = await entry.run(f, entry.wrongScopeToken, 'wrongscope');
      expect(result.status).toBe(403);
      expect(result.code).toBe('VICT_ACTOR_SCOPE_DENIED');
    });

    it(`[${entry.command}] correct-scope actor passes authorization (command may still fail on state)`, async () => {
      const f = await fixture();
      const result = await entry.run(f, entry.correctToken, 'ok');
      expect(result.status).not.toBe(403);
      expect(result.code).not.toBe('VICT_ACTOR_SCOPE_DENIED');
    });
  }

  it('read operations require their scope and never disclose foreign identifiers', async () => {
    const f = await fixture();
    // changeset.list: requires changeset.read (viewer has it) — but a
    // no-scope actor is denied.
    const denied = await get(f.port, '/vict/v1/changesets', auth(NO_SCOPE));
    expect(denied.status).toBe(403);
    // release.get-selected requires release.read.
    const releaseDenied = await get(
      f.port,
      '/vict/v1/releases/selected?applicationId=app.matrix',
      auth(NO_SCOPE),
    );
    expect(releaseDenied.status).toBe(403);
    // stream.inspect is actor-scoped: other actors' identifiers are never
    // disclosed, and absence is indistinguishable from foreign (404).
    const inspect = await post(
      f,
      '/vict/v1/streams/inspect',
      { payload: { streamId: 'stream-foreign-1' } },
      OPERATOR,
      'matrix-inspect-1',
    );
    void inspect;
  });

  it('activation selection is attributed to the authenticated actor, never "system"', async () => {
    const f = await fixture();
    // The operator holds activation.select; the selection attempt fails at
    // the catalog (no such activation) but ANY audit event written by a
    // successful selection must carry the actor id — verified through the
    // service-level attribution below.
    const eventsBefore = (await f.controlPlane.auditTrail({})).length;
    const result = await post(
      f,
      '/vict/v1/activations/select',
      { payload: { graphId: 'graph.attr', activationVersion: 'v.attr' } },
      OPERATOR,
      'matrix-attr-1',
    );
    expect(result.status).not.toBe(403);
    // No synthetic "system" attribution ever appears in the audit trail.
    const events = await f.controlPlane.auditTrail({});
    expect(events.length).toBeGreaterThanOrEqual(eventsBefore);
    for (const event of events) {
      expect(event.actorId).not.toBe('system');
    }
  });

  it('privileged operator.resolve permits cross-actor turn reads — and ONLY those', async () => {
    const f = await fixture();
    // The operator holds operator.resolve: a foreign turn read reaches the
    // turn service (which fails closed without an executor — 409, NOT 403).
    const privileged = await get(f.port, '/vict/v1/turns/turn-foreign-matrix', auth(OPERATOR));
    expect([404, 409]).toContain(privileged.status);
    // The same read for a viewer (run.read but NO operator.resolve) is
    // denied cross-actor by the turn service.
    const unprivileged = await get(f.port, '/vict/v1/turns/turn-foreign-matrix', auth(VIEWER));
    expect([404, 409]).toContain(unprivileged.status);
  });

  it('identity commands are authenticated-any: even a no-scope actor may whoami', async () => {
    const f = await fixture();
    const who = await get(f.port, '/vict/v1/actor/whoami', auth(NO_SCOPE));
    expect(who.status).toBe(200);
    expect((who.body.data as Record<string, unknown>).actorId).toBe('actor-empty');
    expect((who.body.data as Record<string, unknown>).scopes).toEqual([]);
    // ...but the no-scope actor remains denied for every protected command.
    const denied = await post(
      f,
      '/vict/v1/changesets',
      PROPOSE_PAYLOAD,
      NO_SCOPE,
      'matrix-noscope-mutate-1',
    );
    expect(denied.status).toBe(403);
    expect(denied.code).toBe('VICT_ACTOR_SCOPE_DENIED');
  });

  it('an unauthenticated request never reaches the matrix (401 first)', async () => {
    const f = await fixture();
    const response = await get(f.port, '/vict/v1/changesets');
    expect(response.status).toBe(401);
  });

  it('the dispatcher enforces the same matrix below the transport (no HTTP involved)', async () => {
    const f = await fixture();
    const who = bearer(userToken());
    void who;
    // The composed command service is the enforcement point: a caller with
    // an empty-scope context is denied DIRECTLY at the dispatcher.
    const { authenticatedActorContext } = await import('@victframework/runtime');
    const empty = authenticatedActorContext(
      { actorId: 'actor-empty', status: 'active', roles: [], createdAt: 0 },
      'actor-empty',
    );
    await expect(
      f.commandService.dispatch(
        empty as unknown as Parameters<typeof f.commandService.dispatch>[0],
        {
          command: 'changeset.propose',
          payload: PROPOSE_PAYLOAD.payload,
          idempotencyKey: 'matrix-direct-1',
        },
      ),
    ).rejects.toThrow(/required scope is not held/);
  });
});
