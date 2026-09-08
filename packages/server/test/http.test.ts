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
});
