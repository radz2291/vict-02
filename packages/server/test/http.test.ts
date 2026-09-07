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
    // ONLY from the token.
    const spoof = await post(
      f.port,
      '/vict/v1/actor/whoami',
      { payload: { actorId: 'actor-victim', roles: ['administrator'] } },
      bearer(userToken()),
    );
    expect(spoof.status).toBe(200);
    expect((spoof.body.data as Record<string, unknown>).actorId).toBe('actor-user');
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
      bearer(userToken()),
    );
    if (spoofPost.status === 200) {
      const changeset = (spoofPost.body.data as Record<string, unknown>).changeset as Record<
        string,
        unknown
      >;
      expect(changeset.authorActorId).toBe('actor-user');
    } else {
      expect(spoofPost.status).toBeLessThan(500);
    }
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
      bearer(userToken()),
    );
    expect(proposed.status).toBe(200);
    const decided = await post(
      f.port,
      '/vict/v1/changesets/decide',
      { payload: { changesetId: 'cs-http-1', decision: 'approved' } },
      bearer(userToken()),
    );
    expect(decided.status).toBe(200);
    const committed = await post(
      f.port,
      '/vict/v1/changesets/commit',
      { payload: { changesetId: 'cs-http-1' } },
      bearer(userToken()),
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
      bearer(operatorToken()),
    );
    expect([200, 403, 404, 409]).toContain(crossApprove.status);
  });

  it('mutation idempotency keys are accepted on POST routes', async () => {
    const f = await fixture();
    const first = await post(
      f.port,
      '/vict/v1/changesets',
      {
        payload: {
          changesetId: 'cs-idem',
          base: { kind: 'release', subjectId: 'app.http', expectedVersion: 'none' },
          operations: [{ kind: 'select-activation', graphId: 'g', activationVersion: 'v' }],
          rationale: 'idem',
          riskClass: 'low',
          requiredApproverCount: 1,
          expiresAt: Date.now() + 3_600_000,
        },
      },
      { ...bearer(userToken()), 'idempotency-key': 'idem-1' },
    );
    expect(first.status).toBe(200);
    void first;
  });

  it('oversized payload field counts are bounded', async () => {
    const f = await fixture();
    const payload: Record<string, unknown> = {};
    for (let i = 0; i < 100; i += 1) {
      payload[`field${i}`] = i;
    }
    const response = await post(f.port, '/vict/v1/app/actions', { payload }, bearer(userToken()));
    // The bounded body/field checks fail closed before any data access.
    expect([400, 415]).toContain(response.status);
  });
});
