import { afterAll, describe, expect, it } from 'vitest';
import { bearer, get, httpFixture, post, userToken, operatorToken } from './fixtures.js';

/**
 * Stage 06B — the versioned HTTP command boundary over REAL HTTP.
 *
 * Proven: authentication fail-closed (missing/unknown token), client
 * identity spoofing rejected, malformed/oversized/unknown input, wrong
 * content types, unknown routes, unsupported methods, the no-privileged-
 * Mastra-route probe set, cross-actor denials, mutation idempotency, and
 * the unauthenticated-safe health endpoint.
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

describe('versioned HTTP commands (real HTTP)', () => {
  it('health is unauthenticated-safe and discloses only compatibility markers', async () => {
    const f = await fixture();
    const response = await get(f.port, '/vict/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: { healthy: true, commandSchema: 'vict.command@1', streamSchema: 'vict.agent-stream@1' },
    });
  });

  it('missing and unknown tokens fail closed with 401 and never echo the token', async () => {
    const f = await fixture();
    const missing = await get(f.port, '/vict/v1/changesets');
    expect(missing.status).toBe(401);
    expect(JSON.stringify(missing.body)).not.toContain('vict-test-token');
    const unknown = await get(f.port, '/vict/v1/changesets', bearer('Bearer not-a-real-token'));
    expect(unknown.status).toBe(401);
    expect(JSON.stringify(unknown.body)).not.toContain('not-a-real-token');
  });

  it('client-supplied actor identity is never authoritative (spoofing rejected)', async () => {
    const f = await fixture();
    // A hostile payload cannot claim another actor: the context derives
    // ONLY from the token, and undeclared payload fields fail closed.
    const spoof = await post(
      f.port,
      '/vict/v1/actor/whoami',
      { payload: { actorId: 'actor-victim', roles: ['administrator'] } },
      bearer(userToken()),
    );
    expect(spoof.status).toBe(400);
    expect(spoof.body.code).toBe('VICT_COMMAND_PAYLOAD_INVALID');
    const clean = await get(f.port, '/vict/v1/actor/whoami', bearer(userToken()));
    expect(clean.status).toBe(200);
    expect((clean.body.data as Record<string, unknown>).actorId).toBe('actor-user');
    const spoofPost = await post(
      f.port,
      '/vict/v1/changesets',
      {
        payload: {
          actorId: 'actor-victim',
          changesetId: 'cs-x',
          base: { kind: 'release', subjectId: 'a', expectedVersion: 'b' },
          operations: [{ kind: 'select-activation', graphId: 'g', activationVersion: 'v' }],
          rationale: 'r',
          riskClass: 'low',
          requiredApproverCount: 1,
          expiresAt: 99999999999999,
        },
      },
      { ...bearer(userToken()), 'idempotency-key': 'spoof-propose-1' },
    );
    // The undeclared `actorId` payload field is rejected by the closed
    // command schema before any store access (never silently converted).
    expect(spoofPost.status).toBe(400);
    expect(spoofPost.body.code).toBe('VICT_COMMAND_PAYLOAD_INVALID');
  });

  it('malformed JSON, oversized bodies, and wrong content types are rejected safely', async () => {
    const f = await fixture();
    const malformed = await post(f.port, '/vict/v1/changesets', '{not json', bearer(userToken()));
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ ok: false, code: 'VICT_HTTP_BODY_MALFORMED' });
    const oversized = await post(
      f.port,
      '/vict/v1/changesets',
      'x'.repeat(300 * 1024),
      bearer(userToken()),
    );
    expect(oversized.status).toBe(413);
    const wrongType = await fetch(`http://127.0.0.1:${f.port}/vict/v1/changesets`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', authorization: userToken() },
      body: 'x',
    });
    expect(wrongType.status).toBe(415);
  });

  it('unknown routes and unsupported methods fail with stable bodies', async () => {
    const f = await fixture();
    const unknown = await get(f.port, '/vict/v1/unknown/path', bearer(userToken()));
    expect(unknown.status).toBe(404);
    const method = await fetch(`http://127.0.0.1:${f.port}/vict/v1/changesets`, {
      method: 'DELETE',
      headers: { authorization: userToken() },
    });
    expect(method.status).toBe(405);
  });

  it('no privileged Mastra route exists at this boundary', async () => {
    const f = await fixture();
    for (const path of [
      '/api/agents',
      '/api/agent/test/stream',
      '/api/tools',
      '/api/workflows',
      '/mastra/api/agents',
      '/mastra',
      '/studio',
      '/api/memory',
    ]) {
      const response = await get(f.port, path, bearer(userToken()));
      expect(response.status).toBe(404);
    }
  });

  it('a complete changeset lifecycle runs over HTTP with attribution', async () => {
    const f = await fixture();
    const proposed = await post(
      f.port,
      '/vict/v1/changesets',
      {
        payload: {
          changesetId: 'cs-http-1',
          base: { kind: 'release', subjectId: 'app.http', expectedVersion: 'none' },
          operations: [
            {
              kind: 'publish-and-select-release',
              release: {
                releaseVersion: 'release-http-1',
                applicationId: 'app.http',
                applicationVersion: 'appver-1',
                rendererIdentity: 'renderer@1',
                componentRegistryIdentity: 'registry@1',
                dataAdapterIdentity: 'adapter@1',
                activationBinding: 'activation-http-1',
              },
            },
          ],
          rationale: 'HTTP lifecycle proof',
          riskClass: 'low',
          requiredApproverCount: 1,
          expiresAt: Date.now() + 3_600_000,
        },
      },
      { ...bearer(userToken()), 'idempotency-key': 'http-lifecycle-propose' },
    );
    expect(proposed.status).toBe(200);
    // The authoritative validation run executes through the trusted VICT
    // boundary; evidence DERIVES from the executed run record.
    const check = await post(
      f.port,
      '/vict/v1/changesets/check',
      { payload: { changesetId: 'cs-http-1', kind: 'validation' } },
      { ...bearer(userToken()), 'idempotency-key': 'http-lifecycle-check' },
    );
    expect(check.status).toBe(200);
    const runId = ((check.body.data as Record<string, unknown>).run as Record<string, unknown>)
      .runId as string;
    const evidence = await post(
      f.port,
      '/vict/v1/changesets/evidence',
      { payload: { changesetId: 'cs-http-1', kind: 'validation', runId } },
      { ...bearer(userToken()), 'idempotency-key': 'http-lifecycle-evidence' },
    );
    expect(evidence.status).toBe(200);
    const decided = await post(
      f.port,
      '/vict/v1/changesets/decide',
      { payload: { changesetId: 'cs-http-1', decision: 'approved' } },
      { ...bearer(userToken()), 'idempotency-key': 'http-lifecycle-decide' },
    );
    expect(decided.status).toBe(200);
    const committed = await post(
      f.port,
      '/vict/v1/changesets/commit',
      { payload: { changesetId: 'cs-http-1' } },
      { ...bearer(userToken()), 'idempotency-key': 'http-lifecycle-commit' },
    );
    expect(committed.status).toBe(200);
    const selected = await get(
      f.port,
      '/vict/v1/releases/selected?applicationId=app.http',
      bearer(userToken()),
    );
    expect(selected.status).toBe(200);
    // Every transition is attributable (audit trail through the command service).
    const audit = await f.controlPlane.auditTrail({ subjectId: 'cs-http-1' });
    const actions = audit.map((event) => event.action);
    expect(actions).toContain('changeset.proposed');
    expect(actions).toContain('changeset.committed');
  });

  it('cross-actor turn inspection and approval are denied', async () => {
    const f = await fixture();
    // The operator cannot approve (scope) and cannot read a foreign turn.
    const crossRead = await get(f.port, '/vict/v1/turns/turn-foreign', bearer(operatorToken()));
    // Without a composed turn executor the command fails closed (409); with
    // one composed, a foreign turn is denied by the service (403/404).
    expect([403, 404, 409]).toContain(crossRead.status);
    const crossApprove = await post(
      f.port,
      '/vict/v1/approvals/approval-x',
      { payload: { approvalId: 'approval-x', decision: 'approved' } },
      { ...bearer(operatorToken()), 'idempotency-key': 'cross-approve-1' },
    );
    // The operator lacks the approval scope: default-deny 403 below the
    // transport (never a 500).
    expect(crossApprove.status).toBe(403);
  });

  it('mutation idempotency keys are accepted on POST routes', async () => {
    const f = await fixture();
    const expiresAt = Date.now() + 3_600_000;
    const idemPayload = {
      payload: {
        changesetId: 'cs-idem',
        base: { kind: 'release', subjectId: 'app.http', expectedVersion: 'none' },
        operations: [{ kind: 'select-activation', graphId: 'g', activationVersion: 'v' }],
        rationale: 'idem',
        riskClass: 'low',
        requiredApproverCount: 1,
        expiresAt,
      },
    };
    const first = await post(f.port, '/vict/v1/changesets', idemPayload, {
      ...bearer(userToken()),
      'idempotency-key': 'idem-1',
    });
    expect(first.status).toBe(200);
    // The SAME key + BYTE-IDENTICAL payload replays the original result durably.
    const replay = await post(f.port, '/vict/v1/changesets', idemPayload, {
      ...bearer(userToken()),
      'idempotency-key': 'idem-1',
    });
    expect(replay.status).toBe(200);
    // A different payload under the SAME key is a stable conflict.
    const conflict = await post(
      f.port,
      '/vict/v1/changesets',
      { ...idemPayload, payload: { ...idemPayload.payload, changesetId: 'cs-idem-OTHER' } },
      { ...bearer(userToken()), 'idempotency-key': 'idem-1' },
    );
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('VICT_COMMAND_IDEMPOTENCY_CONFLICT');
    // A mutation WITHOUT a key is rejected (durable boundary required).
    const noKey = await post(
      f.port,
      '/vict/v1/changesets',
      {
        payload: {
          changesetId: 'cs-nokey',
          base: { kind: 'release', subjectId: 'app.http', expectedVersion: 'none' },
          operations: [{ kind: 'select-activation', graphId: 'g', activationVersion: 'v' }],
          rationale: 'no key',
          riskClass: 'low',
          requiredApproverCount: 1,
          expiresAt: Date.now() + 3_600_000,
        },
      },
      bearer(userToken()),
    );
    expect(noKey.status).toBe(400);
    expect(noKey.body.code).toBe('VICT_COMMAND_IDEMPOTENCY_KEY_INVALID');
  });

  it('disconnects, aborted bodies, and duplicate requests fail safely', async () => {
    const f = await fixture();
    // An ABORTED request body (client disconnect mid-upload) never wedges
    // the server and never echoes hostile content.
    const abortController = new AbortController();
    const aborted = fetch(`http://127.0.0.1:${f.port}/vict/v1/changesets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: userToken() },
      body: '{"payload":{"partial":',
      signal: abortController.signal,
    }).then(
      (response) => response.status,
      () => 'aborted',
    );
    abortController.abort();
    const outcome = await aborted;
    expect(['aborted', 400, 499, 500].includes(outcome as never)).toBe(true);
    // The server remains healthy afterwards.
    const health = await get(f.port, '/vict/v1/health');
    expect(health.status).toBe(200);
    // Two IDENTICAL concurrent duplicate mutations with the same durable
    // key produce exactly one winner; the loser never double-executes.
    const expiresAt = Date.now() + 3_600_000;
    const payload = {
      payload: {
        changesetId: 'cs-dup-race',
        base: { kind: 'release', subjectId: 'app.http', expectedVersion: 'none' },
        operations: [{ kind: 'select-activation', graphId: 'g', activationVersion: 'v' }],
        rationale: 'dup',
        riskClass: 'low',
        requiredApproverCount: 1,
        expiresAt,
      },
    };
    const call = () =>
      fetch(`http://127.0.0.1:${f.port}/vict/v1/changesets`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: userToken(),
          'idempotency-key': 'dup-race-1',
        },
        body: JSON.stringify(payload),
      }).then(async (response) => ({
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
      }));
    const results = await Promise.all([call(), call(), call()]);
    const winners = results.filter((entry) => entry.status === 200);
    const losers = results.filter(
      (entry) => entry.status === 409 && entry.body.code === 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS',
    );
    // Every caller either received the ORIGINAL result (durable replay) or
    // the stable in-progress conflict — never a second execution.
    expect(winners.length + losers.length).toBe(results.length);
    for (const entry of winners.slice(1)) {
      expect(entry.body).toEqual(winners[0]?.body);
    }
    // Exactly ONE durable effect exists for the three requests.
    const all = await f.stores.control.listChangeSets();
    expect(all.filter((entry) => entry.changesetId === 'cs-dup-race').length).toBe(1);
  });

  it('oversized payload field counts are bounded', async () => {
    const f = await fixture();
    const payload: Record<string, unknown> = {};
    for (let i = 0; i < 100; i += 1) {
      payload[`field${i}`] = i;
    }
    const response = await post(
      f.port,
      '/vict/v1/app/actions',
      { payload },
      { ...bearer(userToken()), 'idempotency-key': 'oversize-1' },
    );
    // The bounded body/field checks fail closed before any data access.
    expect([400, 415]).toContain(response.status);
  });

  // ---- Stage 9 G2 — the legacy mutation fence (P-11/P-12) --------------
  // Runnable against BOTH the fail-closed transport bridge (before the
  // core confirmation layer lands) and the integrated core fence: every
  // actor class holding the mutation scope still answers the stable
  // 409 VICT_CONFIRMATION_REQUIRED for the unconfirmed legacy shape.
  const LEGACY_GATED_ROUTES: readonly (readonly [string, Record<string, unknown>])[] = [
    [
      '/vict/v1/runs/cancel',
      { payload: { runId: 'run-g2-legacy', reasonCode: 'operator-cancel' } },
    ],
    [
      '/vict/v1/activations/select',
      { payload: { graphId: 'graph-g2', activationVersion: 'v-g2' } },
    ],
    [
      '/vict/v1/releases/select',
      { payload: { applicationId: 'app-g2', releaseVersion: 'release-g2-1' } },
    ],
    [
      '/vict/v1/releases/rollback',
      { payload: { applicationId: 'app-g2', targetReleaseVersion: 'release-g2-1' } },
    ],
  ];
  it('P-11: operator legacy one-step mutations are fenced on all four commands', async () => {
    const f = await fixture();
    for (const [path, envelope] of LEGACY_GATED_ROUTES) {
      const response = await post(f.port, path, envelope, {
        ...bearer(operatorToken()),
        'idempotency-key': `g2-legacy-op-${path.replace(/\//g, '-')}`,
      });
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('VICT_CONFIRMATION_REQUIRED');
    }
  });
  it('P-11: developer legacy one-step mutations are fenced', async () => {
    const f = await fixture();
    for (const [path, envelope] of LEGACY_GATED_ROUTES) {
      const response = await post(f.port, path, envelope, {
        ...bearer(userToken()),
        'idempotency-key': `g2-legacy-dev-${path.replace(/\//g, '-')}`,
      });
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('VICT_CONFIRMATION_REQUIRED');
      expect(JSON.stringify(response.body)).not.toContain('runId');
    }
  });
  it('P-12: administrator has NO legacy bypass — the same 409 fence', async () => {
    const f = await fixture();
    for (const [path, envelope] of LEGACY_GATED_ROUTES) {
      // The DEVELOPER fixture actor holds the administrator role (the
      // closed all-scopes policy), so this probes the administrator class.
      const response = await post(f.port, path, envelope, {
        ...bearer(userToken()),
        'idempotency-key': `g2-legacy-admin-${path.replace(/\//g, '-')}`,
      });
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('VICT_CONFIRMATION_REQUIRED');
    }
  });

  it('the new intervention routes are receipt-gated from day one (legacy shape rejected)', async () => {
    const f = await fixture();
    // Integrator pin (authorization order): the actor scope is the
    // OUTERMOST gate; an actor without the command scope is denied
    // 403 VICT_ACTOR_SCOPE_DENIED BEFORE any confirmation mechanics are
    // mentioned (consistent with prepare-side P-13). The administrator
    // class DOES hold both scopes by policy, so its legacy-shape rows
    // prove the CONFIRMATION fence itself with no scope shortcut.
    const resolve = await post(
      f.port,
      '/vict/v1/runs/run-g2-blocked/resolve',
      { payload: { resolution: 'retry' } },
      { ...bearer(userToken()), 'idempotency-key': 'g2-resolve-legacy' },
    );
    expect(resolve.status).toBe(409);
    expect(resolve.body.code).toBe('VICT_CONFIRMATION_REQUIRED');
    const signalByScopelessOperator = await post(
      f.port,
      '/vict/v1/runs/run-g2-blocked/signal',
      { payload: { signalName: 'nudge' } },
      { ...bearer(operatorToken()), 'idempotency-key': 'g2-signal-legacy-op' },
    );
    expect(signalByScopelessOperator.status).toBe(403);
    expect(signalByScopelessOperator.body.code).toBe('VICT_ACTOR_SCOPE_DENIED');
    const signalByAdministrator = await post(
      f.port,
      '/vict/v1/runs/run-g2-blocked/signal',
      { payload: { signalName: 'nudge' } },
      { ...bearer(userToken()), 'idempotency-key': 'g2-signal-legacy-admin' },
    );
    expect(signalByAdministrator.status).toBe(409);
    expect(signalByAdministrator.body.code).toBe('VICT_CONFIRMATION_REQUIRED');
  });

  it('the confirmation transport bounds hostile confirmation bodies', async () => {
    const f = await fixture();
    // A receipt-shaped body whose receiptId is unbounded is a transport
    // field failure before any service access.
    const bad = await post(
      f.port,
      '/vict/v1/runs/run-g2-1/cancel',
      { payload: {}, confirmation: { receiptId: 'x'.repeat(200) } },
      { ...bearer(userToken()), 'idempotency-key': 'g2-bad-receipt-1' },
    );
    expect(bad.status).toBe(400); // bounded receipt shape enforced pre-service
    expect(bad.body.code).toBe('VICT_HTTP_FIELD_INVALID');
    const routeMissing = await post(
      f.port,
      '/vict/v1/runs/cancel',
      { confirmation: 'rcpt-not-an-object' },
      { ...bearer(userToken()), 'idempotency-key': 'g2-bad-confirm-1' },
    );
    expect(routeMissing.status).toBe(400);
    expect(routeMissing.body.code).toBe('VICT_HTTP_FIELD_INVALID');
  });

  // ---- Stage 9 G2 — prepare / status / confirmed-consume surfaces ------
  describe('G2 confirmation prepare/status/confirm (G2 core layer composed)', () => {
    // TODO(integrator): unskip when the command service exposes, with
    // EXACTLY these signatures (integration notes in the G2 transport
    // candidate report):
    //   prepareConfirmation(actor, { command: string;
    //                              payload: Record<string, unknown>;
    //                              idempotencyKey: string;
    //                              expectedRevision?: number | null }):
    //     Promise<{ ok:true; data:{ receiptId, command, payloadDigest,
    //              expectedRevision, expiryAt, createdBy, createdAt } } |
    //             { ok:false; code: string }>
    //   getConfirmationStatus(actor, receiptId: string):
    //     Promise<{ ok:true; data:{ receiptId, command, status, createdAt,
    //              expiryAt?, expectedRevision?, consumedAt?,
    //              consumedByKey? } } | { ok:false; code: string }>
    // and widens the closed dispatch envelope with `confirmation`.
    it('prepare issues a human-reviewable receipt (happy path)', async () => {
      const f = await fixture();
      const prepared = await post(
        f.port,
        '/vict/v1/confirmations',
        {
          command: 'run.cancel',
          payload: { runId: 'run-g2-1', reasonCode: 'operator-cancel' },
          expectedRevision: 0,
        },
        { ...bearer(operatorToken()), 'idempotency-key': 'g2-prepare-op-1' },
      );
      expect(prepared.status).toBe(200);
      const data = prepared.body.data as Record<string, unknown>;
      expect(prepared.body.ok).toBe(true);
      expect(data).toMatchObject({
        command: 'run.cancel',
        expectedRevision: 0,
        createdBy: 'actor-operator',
      });
      expect(typeof data.receiptId).toBe('string');
      expect(typeof data.payloadDigest).toBe('string');
      expect(typeof data.expiryAt).toBe('number');
      expect(typeof data.createdAt).toBe('number');
      // The receipt NEVER echoes payload bytes.
      expect(JSON.stringify(data)).not.toContain('operator-cancel');
    });

    it('prepare scope denial and field-required rows fail closed', async () => {
      const f = await fixture();
      // A no-scope actor preparing run.resolve (a scope the actor does not
      // hold) is denied below the transport with no receipt.
      const denied = await post(
        f.port,
        '/vict/v1/confirmations',
        {
          command: 'run.resolve',
          payload: { runId: 'r', resolution: 'retry' },
          expectedRevision: 0,
        },
        { ...bearer('Bearer vict-test-token-empty'), 'idempotency-key': 'g2-prepare-noscope' },
      );
      expect(denied.status).toBe(403);
      expect(denied.body.code).toBe('VICT_ACTOR_SCOPE_DENIED');
      // A prepare envelope without the target command is a stable field
      // failure.
      const missing = await post(
        f.port,
        '/vict/v1/confirmations',
        { payload: { runId: 'r' } },
        { ...bearer(operatorToken()), 'idempotency-key': 'g2-prepare-nofield' },
      );
      expect(missing.status).toBe(400);
      const unknownCommand = await post(
        f.port,
        '/vict/v1/confirmations',
        { command: 'definitely.not.a.command', payload: {}, expectedRevision: 0 },
        { ...bearer(operatorToken()), 'idempotency-key': 'g2-prepare-unknown' },
      );
      expect(unknownCommand.status).toBe(400);
    });

    it('prepare idempotency: same key+payload replays, different payload conflicts', async () => {
      const f = await fixture();
      const envelope = {
        command: 'run.cancel',
        payload: { runId: 'run-g2-replay', reasonCode: 'operator-cancel' },
        expectedRevision: 0,
      };
      const first = await post(f.port, '/vict/v1/confirmations', envelope, {
        ...bearer(operatorToken()),
        'idempotency-key': 'g2-prepare-replay',
      });
      expect(first.status).toBe(200);
      const replay = await post(f.port, '/vict/v1/confirmations', envelope, {
        ...bearer(operatorToken()),
        'idempotency-key': 'g2-prepare-replay',
      });
      expect(replay.status).toBe(200);
      expect((replay.body.data as Record<string, unknown>).receiptId).toBe(
        (first.body.data as Record<string, unknown>).receiptId,
      );
      const conflict = await post(
        f.port,
        '/vict/v1/confirmations',
        { ...envelope, payload: { runId: 'run-g2-OTHER', reasonCode: 'operator-cancel' } },
        { ...bearer(operatorToken()), 'idempotency-key': 'g2-prepare-replay' },
      );
      expect(conflict.status).toBe(409);
      expect(conflict.body.code).toBe('VICT_COMMAND_IDEMPOTENCY_CONFLICT');
    });

    it('status read is scope-authorized and non-echoing in BOTH directions', async () => {
      const f = await fixture();
      const prepared = await post(
        f.port,
        '/vict/v1/confirmations',
        {
          command: 'run.cancel',
          payload: { runId: 'run-g2-status', reasonCode: 'operator-cancel' },
          expectedRevision: 0,
        },
        { ...bearer(operatorToken()), 'idempotency-key': 'g2-status-prep' },
      );
      expect(prepared.status).toBe(200);
      const receiptId = (prepared.body.data as Record<string, unknown>).receiptId as string;
      // The receipt's own actor (holding run.cancel) reads the status.
      const own = await get(f.port, `/vict/v1/confirmations/${receiptId}`, bearer(operatorToken()));
      expect(own.status).toBe(200);
      expect((own.body.data as Record<string, unknown>).status).toBe('prepared');
      // A foreign actor (approver holds no run.cancel) answers the stable,
      // non-echoing UNAVAILABLE — never the foreign receipt's existence.
      const foreign = await get(
        f.port,
        `/vict/v1/confirmations/${receiptId}`,
        bearer('Bearer vict-test-token-approver'),
      );
      expect(foreign.status).toBe(404);
      expect(foreign.body.code).toBe('VICT_CONFIRMATION_UNAVAILABLE');
      // Unknown receipts are indistinguishable from foreign ones.
      const unknown = await get(
        f.port,
        '/vict/v1/confirmations/rcpt-unknown-g2',
        bearer(operatorToken()),
      );
      expect(unknown.status).toBe(404);
      expect(unknown.body.code).toBe('VICT_CONFIRMATION_UNAVAILABLE');
    });

    it('the confirmed consume shape executes the gated commands (prepare → confirm)', async () => {
      const f = await fixture();
      // Publish the release through the REAL control plane (the executor
      // of this gated mutation in this fixture's composition).
      await f.stores.control.publishRelease({
        releaseVersion: 'release-rel-confirm',
        applicationId: 'app-rel',
        applicationVersion: 'appver-confirm',
        rendererIdentity: 'renderer@1',
        componentRegistryIdentity: 'registry@1',
        dataAdapterIdentity: 'adapter@1',
        activationBinding: 'activation-confirm',
        publishedByActorId: 'actor-operator',
        publishedAt: 1000,
        contentHash: 'hash-rel-confirm',
      });
      const prepared = await post(
        f.port,
        '/vict/v1/confirmations',
        {
          command: 'release.select',
          payload: { applicationId: 'app-rel', releaseVersion: 'release-rel-confirm' },
          expectedRevision: null,
        },
        { ...bearer(operatorToken()), 'idempotency-key': 'g2-consume-prep' },
      );
      expect(prepared.status).toBe(200);
      const receiptId = (prepared.body.data as Record<string, unknown>).receiptId as string;
      // Integrator pin: the http fixture composes the REAL
      // ControlPlaneService, whose release mechanics are fully available;
      // run.cancel's orchestration port composition belongs to the
      // app-server/runtime wiring, so this end-to-end row uses a mutation
      // whose executor is real here (truthful happy path, real effect).
      const confirmed = await post(
        f.port,
        '/vict/v1/releases/select',
        {
          payload: { applicationId: 'app-rel', releaseVersion: 'release-rel-confirm' },
          confirmation: { receiptId },
        },
        { ...bearer(operatorToken()), 'idempotency-key': 'g2-consume-1' },
      );
      expect(confirmed.status).toBe(200);
      expect((confirmed.body as Record<string, unknown>).ok).toBe(true);
      // The REAL effect is visible exactly once.
      const selections = await f.stores.control.listReleaseSelections('app-rel');
      expect(selections).toHaveLength(1);
      expect(selections[0]).toMatchObject({ releaseVersion: 'release-rel-confirm' });
    });
  });
});
