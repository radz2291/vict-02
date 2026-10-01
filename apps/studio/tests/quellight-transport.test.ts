import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
/**
 * QUIELLIGHT NARROW TRANSPORT — unit negatives over fetch SPIES (Stage 9
 * G3-C required-direct-API negatives; the live journey runs separately).
 *
 * The spies assert the exact fetch behavior (which endpoint/path, which
 * credential) and return the target's OWN envelope shapes, so every pinned
 * expectation below is the honest 0.3.1 envelope, not an invention.
 */

const QL_ENDPOINT = 'http://127.0.0.1:4610';

// Provisioning is supplied BEFORE the server modules are imported (the
// targets.ts module reads VICT_STUDIO_TARGETS / VICT_STUDIO_CREDENTIALS
// once at module load; the deployment provides the real journey tokens).
process.env['VICT_STUDIO_TARGETS'] = JSON.stringify([
  {
    id: 'quellight',
    label: 'Quellight (existing target, declared 0.3.1)',
    endpoint: QL_ENDPOINT,
    credentialRef: 'quellight-operator',
  },
]);
process.env['VICT_STUDIO_CREDENTIALS'] = JSON.stringify({
  'quellight-operator': {
    token: 'ql-op-token',
    actorLabel: 'quellight-operator',
    scopes: ['run.read', 'app.data.read'],
  },
  'quellight-agent': {
    token: 'ql-agent-token',
    actorLabel: 'quellight-agent',
    scopes: ['run.read'],
  },
});

const { connectQuellightIdentityPin, readQuellightTurnPair, attemptRefusalDemonstration } =
  await import('../src/lib/server/quellight-transport.js');
void attemptRefusalDemonstration;

const PINNED_HEALTH = {
  healthy: true,
  commandSchema: 'vict.command@1',
  streamSchema: 'vict.agent-stream@1',
};
const PINNED_COMPATIBILITY = {
  commandSchema: 'vict.command@1',
  streamSchema: 'vict.agent-stream@1',
  changesetSchema: 'vict.changeset@1',
  turnSchema: 'vict.agent-turn@1',
};

interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly auth: string | null;
}
let calls: RecordedCall[] = [];

function spyHandler(
  behavior: (
    url: string,
    method: string,
    auth: string | null,
  ) => { status: number; body: unknown } | { throw: true },
) {
  return (async (url: string, init?: { method?: string; headers?: Record<string, string> }) => {
    const auth = init?.headers?.['authorization'] ?? null;
    calls.push({ url, method: init?.method ?? 'GET', auth });
    const outcome = behavior(url, init?.method ?? 'GET', auth);
    if ('throw' in outcome) {
      throw new Error('bounded timeout');
    }
    return {
      status: outcome.status,
      json: async () => outcome.body,
    };
  }) as unknown as Parameters<typeof connectQuellightIdentityPin>[0]['fetchImpl'];
}

function urlEndingIn(url: string, suffix: string): boolean {
  return url.startsWith(QL_ENDPOINT) && url.endsWith(suffix);
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('quellight identity-pin oracle (unit, fetch spies)', () => {
  it('happy path: the pin presents, records the inspect answers + whoami evidence, and requires the anti-newer refusal', async () => {
    const fetchImpl = spyHandler((url, method, _auth) => {
      if (urlEndingIn(url, '/vict/v1/health')) {
        return { status: 200, body: { ok: true, data: PINNED_HEALTH } };
      }
      if (urlEndingIn(url, '/vict/v1/compatibility')) {
        return { status: 200, body: { ok: true, data: PINNED_COMPATIBILITY } };
      }
      if (urlEndingIn(url, '/vict/v1/actor/whoami')) {
        return {
          status: 200,
          body: {
            ok: true,
            data: {
              actorId: 'actor-quellight-local',
              roles: ['developer', 'operator'],
              scopes: [],
            },
          },
        };
      }
      if (urlEndingIn(url, '/vict/v1/runs/qlt-probe-nonexistent')) {
        // The REAL 0.3.1 surface: no run.* route exists -> refused.
        if (method !== 'GET') {
          return { status: 405, body: { ok: false, code: 'VICT_HTTP_METHOD_UNSUPPORTED' } };
        }
        return { status: 404, body: { ok: false, code: 'VICT_HTTP_ROUTE_UNKNOWN' } };
      }
      return { status: 404, body: { ok: false, code: 'VICT_HTTP_ROUTE_UNKNOWN' } };
    });
    const result = await connectQuellightIdentityPin({
      endpoint: QL_ENDPOINT,
      fetchImpl,
      provenance: {
        quellightRef: 'main 5f709a536ab1f4d5fea0407db1b9537e0aa7c0f6',
        declaredReleaseIdentity: 'vict-release-set@1/0.3.1',
        recordedAtLabel: 'provenance',
      },
    });
    if (!result.ok) {
      throw new Error(`expected pin to present, got ${JSON.stringify(result)}`);
    }
    expect(result.healthRecord).toEqual(PINNED_HEALTH);
    expect(result.compatibilityRecord).toEqual(PINNED_COMPATIBILITY);
    expect(result.refusalProbe).toEqual({
      command: 'run.get',
      refused: true,
      code: 'VICT_HTTP_ROUTE_UNKNOWN',
    });
    expect(result.provenance).toEqual({
      recordedAtLabel: 'provenance',
      quellightRef: 'main 5f709a536ab1f4d5fea0407db1b9537e0aa7c0f6',
      declaredReleaseIdentity: 'vict-release-set@1/0.3.1',
    });
    // The two credentials authenticate AS themselves; every authed call
    // carried its own token (never a proxy of a local Studio actor).
    const whoamiCalls = calls.filter((call) => call.url.endsWith('/vict/v1/actor/whoami'));
    expect(whoamiCalls.map((call) => call.auth)).toEqual([
      'Bearer ql-op-token',
      'Bearer ql-agent-token',
    ]);
    // Provenance is labeled provenance, never claimed as a runtime oracle.
    expect((result.provenance as { recordedAtLabel?: string }).recordedAtLabel).toBe('provenance');
  });

  it('FALSIFIER — mismatched version pin: a successful anti-newer probe FAILS CLOSED', async () => {
    const fetchImpl = spyHandler((url, method) => {
      if (urlEndingIn(url, '/vict/v1/health')) {
        return { status: 200, body: { ok: true, data: PINNED_HEALTH } };
      }
      if (urlEndingIn(url, '/vict/v1/compatibility')) {
        return { status: 200, body: { ok: true, data: PINNED_COMPATIBILITY } };
      }
      if (urlEndingIn(url, '/vict/v1/actor/whoami')) {
        return {
          status: 200,
          body: { ok: true, data: { actorId: 'actor-x', roles: [], scopes: [] } },
        };
      }
      // A newer-schemad target WOULD answer the G1 read positively:
      // simulate the standing demo-target surface for the probe only.
      if (urlEndingIn(url, '/vict/v1/runs/qlt-probe-nonexistent')) {
        if (method !== 'GET') {
          return { status: 405, body: { ok: false, code: 'VICT_HTTP_METHOD_UNSUPPORTED' } };
        }
        return {
          status: 200,
          body: {
            ok: true,
            data: { run: { runId: 'qlt-probe-nonexistent', status: 'completed' } },
          },
        };
      }
      return { status: 404, body: { ok: false, code: 'VICT_HTTP_ROUTE_UNKNOWN' } };
    });
    const result = await connectQuellightIdentityPin({ endpoint: QL_ENDPOINT, fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VICT_QUELLIGHT_VERSION_PIN_REFUSED');
      expect(result.detail).toContain('newer-schemad');
      // Fail closed: no positive pin record is produced.
      expect('healthRecord' in result).toBe(false);
    }
  });

  it('FALSIFIER — a tampered/absent inspect answer-record fails closed', async () => {
    const fetchImpl = spyHandler((url) => {
      if (urlEndingIn(url, '/vict/v1/health')) {
        return {
          status: 200,
          body: { ok: true, data: { ...PINNED_HEALTH, turnSchema: 'tampered@9' } },
        };
      }
      return { status: 404, body: { ok: false, code: 'VICT_HTTP_ROUTE_UNKNOWN' } };
    });
    const result = await connectQuellightIdentityPin({ endpoint: QL_ENDPOINT, fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VICT_QUELLIGHT_IDENTITY_PIN_FAILED');
    }
  });
});

describe('quellight cross-target isolation (unit, fail closed before fetch)', () => {
  it('a cross-target subject cannot resolve through this transport in either direction', async () => {
    const fetchImpl = spyHandler((url) => {
      if (urlEndingIn(url, '/vict/v1/health')) {
        return { status: 200, body: { ok: true, data: PINNED_HEALTH } };
      }
      return { status: 404, body: { ok: false, code: 'VICT_HTTP_ROUTE_UNKNOWN' } };
    });
    const { resolveQuellightCredential } = await import('../src/lib/server/quellight-transport.js');
    // Demo target id + demo credential ref through the Quellight transport:
    // refused BEFORE any fetch.
    expect(resolveQuellightCredential('local', 'studio-operator')).toEqual({
      ok: false,
      code: 'VICT_STUDIO_CROSS_TARGET_REFUSED',
    });
    // The quellight target id with SOMEONE ELSE'S credential ref: refused.
    expect(resolveQuellightCredential('quellight', 'studio-operator')).toEqual({
      ok: false,
      code: 'VICT_STUDIO_CROSS_TARGET_REFUSED',
    });
    expect(calls).toEqual([]);
    void fetchImpl;
  });

  it('the no-credential case: an absent deployment credential refuses before any fetch', async () => {
    // Re-provision WITHOUT the quellight credentials (fresh module load),
    // then prove the transport resolves the absence and fails closed.
    vi.resetModules();
    process.env['VICT_STUDIO_TARGETS'] = JSON.stringify([
      {
        id: 'quellight',
        label: 'Quellight (existing target, declared 0.3.1)',
        endpoint: QL_ENDPOINT,
        credentialRef: 'quellight-operator',
      },
    ]);
    process.env['VICT_STUDIO_CREDENTIALS'] = JSON.stringify({
      'some-other-ref': { token: 'other-token', actorLabel: 'other', scopes: ['run.read'] },
    });
    const fresh = await import('../src/lib/server/quellight-transport.js');
    const fetchImpl = spyHandler((url, method) => {
      if (urlEndingIn(url, '/vict/v1/health')) {
        return { status: 200, body: { ok: true, data: PINNED_HEALTH } };
      }
      if (urlEndingIn(url, '/vict/v1/compatibility')) {
        return { status: 200, body: { ok: true, data: PINNED_COMPATIBILITY } };
      }
      void method;
      return { status: 404, body: { ok: false, code: 'VICT_HTTP_ROUTE_UNKNOWN' } };
    });
    const result = await fresh.connectQuellightIdentityPin({ endpoint: QL_ENDPOINT, fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VICT_STUDIO_CREDENTIAL_ABSENT');
    }
    // No authed read ever left the server; only the two inspect surfaces.
    expect(calls.every((call) => call.auth === null)).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('same-turn proof reads (unit, fetch spies)', () => {
  const TURN_ID = 'turn-ql-fixture-1';
  const THREAD_ID = 'thread-ql-fixture-1';

  it('both reads execute and the turnId correlation identity is extracted', async () => {
    const fetchImpl = spyHandler((url, method, auth) => {
      if (urlEndingIn(url, `/vict/v1/turns/${TURN_ID}`) && method === 'GET') {
        expect(auth).toBe('Bearer ql-op-token');
        return {
          status: 200,
          body: {
            ok: true,
            data: {
              turn: { turnId: TURN_ID, status: 'completed', actorId: 'actor-quellight-local' },
            },
          },
        };
      }
      if (urlEndingIn(url, '/api/act') && method === 'POST') {
        expect(auth).toBe('Bearer ql-op-token');
        return {
          status: 200,
          body: {
            ok: true,
            value: {
              ok: true,
              row: {
                usage: 'used',
                usedCount: 0,
                details: { turnId: TURN_ID, threadId: THREAD_ID },
              },
            },
          },
        };
      }
      return { status: 404, body: { ok: false, code: 'VICT_HTTP_ROUTE_UNKNOWN' } };
    });
    const pair = await readQuellightTurnPair({
      endpoint: QL_ENDPOINT,
      threadId: THREAD_ID,
      turnId: TURN_ID,
      fetchImpl,
    });
    expect(pair.turnRecord).toEqual({
      turnId: TURN_ID,
      status: 'completed',
      actorId: 'actor-quellight-local',
    });
    expect(pair.correlationTurnId).toBe(TURN_ID);
    expect(pair.correlations).toEqual({ turnRead: true, inspection: true });
  });

  it('M-1 REPAIR — every POST carries content-type application/json (production CSRF survival)', async () => {
    const seen: Array<{ url: string; method: string; contentType: string | undefined }> = [];
    const fetchImpl = (async (
      url: string,
      init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      },
    ) => {
      seen.push({
        url,
        method: init?.method ?? 'GET',
        contentType: init?.headers?.['content-type'],
      });
      if (url.endsWith('/vict/v1/turns/' + TURN_ID)) {
        return {
          status: 200,
          json: async () => ({
            ok: true,
            data: {
              turn: { turnId: TURN_ID, status: 'completed', actorId: 'actor-quellight-local' },
            },
          }),
        } as unknown as Response;
      }
      if (url.endsWith('/api/act')) {
        expect(init?.method).toBe('POST');
        expect(init?.headers?.['content-type']).toBe('application/json');
        return {
          status: 200,
          json: async () => ({
            ok: true,
            value: {
              ok: true,
              row: {
                usage: 'used',
                usedCount: 0,
                details: { turnId: TURN_ID, threadId: THREAD_ID },
              },
            },
          }),
        } as unknown as Response;
      }
      return {
        status: 404,
        json: async () => ({ ok: false, code: 'VICT_HTTP_ROUTE_UNKNOWN' }),
      } as unknown as Response;
    }) as unknown as Parameters<typeof readQuellightTurnPair>[0]['fetchImpl'];
    const pair = await readQuellightTurnPair({
      endpoint: QL_ENDPOINT,
      threadId: THREAD_ID,
      turnId: TURN_ID,
      fetchImpl,
    });
    expect(pair.correlations).toEqual({ turnRead: true, inspection: true });
    const posts = seen.filter((call) => call.method === 'POST');
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) {
      expect(post.contentType).toBe('application/json');
    }
  });

  it('FALSIFIER — an inspection projection WITHOUT a turn correlation renders the truthful NOT-DEMONSTRATED state', async () => {
    const fetchImpl = spyHandler((url, method) => {
      if (urlEndingIn(url, `/vict/v1/turns/${TURN_ID}`) && method === 'GET') {
        return {
          status: 200,
          body: { ok: true, data: { turn: { turnId: TURN_ID, status: 'completed' } } },
        };
      }
      if (urlEndingIn(url, '/api/act') && method === 'POST') {
        return {
          status: 200,
          body: { ok: true, value: { ok: true, row: { usage: 'unrecorded', details: {} } } },
        };
      }
      return { status: 404, body: { ok: false, code: 'VICT_HTTP_ROUTE_UNKNOWN' } };
    });
    const pair = await readQuellightTurnPair({
      endpoint: QL_ENDPOINT,
      threadId: THREAD_ID,
      turnId: TURN_ID,
      fetchImpl,
    });
    expect(pair.correlationTurnId).toBeNull();
    // CorrelationTurnId is null exactly when this banner state must render.
    const bannerState = pair.correlationTurnId === null ? 'not_demonstrated' : 'aligned';
    expect(bannerState).toBe('not_demonstrated');
  });

  it('an unknown turn id answers the target refusal verbatim as a failure code', async () => {
    const fetchImpl = spyHandler((url, method) => {
      if (urlEndingIn(url, `/vict/v1/turns/${TURN_ID}`) && method === 'GET') {
        return { status: 500, body: { ok: false, code: 'VICT_TURN_NOT_FOUND' } };
      }
      if (urlEndingIn(url, '/api/act') && method === 'POST') {
        return { status: 200, body: { ok: false, code: 'QLT_INSPECTION_TURN_MISSING' } };
      }
      return { status: 404, body: { ok: false, code: 'VICT_HTTP_ROUTE_UNKNOWN' } };
    });
    const pair = await readQuellightTurnPair({
      endpoint: QL_ENDPOINT,
      threadId: THREAD_ID,
      turnId: TURN_ID,
      fetchImpl,
    });
    expect(pair.turnRecord).toBeNull();
    expect(pair.inspection).toBeNull();
    expect(pair.failureCodes).toEqual({
      turnRecord: 'VICT_TURN_NOT_FOUND',
      inspection: 'QLT_INSPECTION_TURN_MISSING',
    });
  });

  it('the refusal attempt with a DISTINCT actor (demo tree) is reported with the target refusal code', async () => {
    const fetchImpl = spyHandler((url, method, auth) => {
      if (urlEndingIn(url, `/vict/v1/turns/${TURN_ID}`) && method === 'GET') {
        expect(auth).toBe('Bearer ql-agent-token');
        return { status: 403, body: { ok: false, code: 'VICT_ACTOR_SCOPE_DENIED' } };
      }
      return { status: 404, body: { ok: false, code: 'VICT_HTTP_ROUTE_UNKNOWN' } };
    });
    const attempt = await attemptRefusalDemonstration({
      endpoint: QL_ENDPOINT,
      turnId: TURN_ID,
      fetchImpl,
    });
    expect(attempt).toEqual({
      command: 'agent.turn.get',
      succeeded: false,
      refusalCode: 'VICT_ACTOR_SCOPE_DENIED',
    });
  });
});
