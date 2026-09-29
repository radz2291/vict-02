import { afterAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';

/**
 * Adapter tests over a REAL local node:http mock target. The mock counts
 * requests so client-side rejections (path not in bindings, hostile ids)
 * can be proven to issue NO fetch at all.
 */

const mockState = { requests: 0 };

const mock = createServer((req, res) => {
  mockState.requests += 1;
  const url = req.url ?? '/';
  const send = (status: number, body: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (url.startsWith('/vict/v1/runs/run-1')) {
    send(200, {
      ok: true,
      data: {
        run: { runId: 'run-1', graphId: 'g.demo', status: 'completed', recordRevision: 1 },
      },
    });
    return;
  }
  if (url.startsWith('/vict/v1/runs')) {
    send(200, {
      ok: true,
      data: {
        runs: [
          { runId: 'run-1', graphId: 'g.demo', status: 'completed', recordRevision: 1 },
          { runId: 'run-2', graphId: 'g.demo', status: 'failed', recordRevision: 2 },
        ],
        total: 2,
        hasMore: false,
      },
    });
    return;
  }
  if (url.startsWith('/vict/v1/audit')) {
    send(401, { ok: false, code: 'VICT_AUTH_TOKEN_MISSING' });
    return;
  }
  send(404, { ok: false, code: 'VICT_HTTP_ROUTE_UNKNOWN' });
});

let port = 0;
const deadPort = 49990;

await new Promise<void>((resolveListen) => {
  mock.listen(0, '127.0.0.1', () => {
    port = (mock.address() as AddressInfo).port;
    resolveListen();
  });
});

// Provisioning env must be set BEFORE the server modules initialize.
process.env['VICT_STUDIO_TARGETS'] = JSON.stringify([
  {
    id: 'mock',
    label: 'Mock target',
    endpoint: `http://127.0.0.1:${port}`,
    credentialRef: 'mock-cred',
  },
  {
    id: 'dead',
    label: 'Dead target',
    endpoint: `http://127.0.0.1:${deadPort}`,
    credentialRef: 'mock-cred',
  },
]);
process.env['VICT_STUDIO_CREDENTIALS'] = JSON.stringify({
  'mock-cred': { token: 'adapter-test-token-xyz', actorLabel: 'tester', scopes: ['run.read'] },
});

const { StudioHttpAdapter } = await import('../src/lib/server/adapter.js');
const { callTarget, StudioPathError } = await import('../src/lib/server/vict-client.js');
const { getTarget } = await import('../src/lib/server/targets.js');

afterAll(async () => {
  await new Promise<void>((resolveClose) => mock.close(() => resolveClose()));
});

const READ = { permissions: ['studio.operator.read'], effect: 'read' as const };
const NO_PERM = { permissions: [], effect: 'read' as const };

function adapterFor(targetId: string) {
  return new StudioHttpAdapter({ getTarget, targetId });
}

describe('Studio HTTP adapter over a real local mock target', () => {
  it('list runs maps rows VERBATIM from the server envelope', async () => {
    const result = await adapterFor('mock').query(
      { op: 'list', resourceId: 'runs', limit: 10 },
      READ,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows).toEqual([
      { runId: 'run-1', graphId: 'g.demo', status: 'completed', recordRevision: 1 },
      { runId: 'run-2', graphId: 'g.demo', status: 'failed', recordRevision: 2 },
    ]);
    expect(result.total).toBe(2);
  });

  it('get run returns the record row through the binding getPath', async () => {
    const result = await adapterFor('mock').query(
      { op: 'get', resourceId: 'runs', id: 'run-1' },
      READ,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.row).toEqual({
      runId: 'run-1',
      graphId: 'g.demo',
      status: 'completed',
      recordRevision: 1,
    });
  });

  it('401 from the target maps to DATA_UNAUTHORIZED (non-echoing)', async () => {
    const result = await adapterFor('mock').query({ op: 'list', resourceId: 'auditEntries' }, READ);
    expect(result).toMatchObject({ ok: false, code: 'DATA_UNAUTHORIZED' });
  });

  it('connection refused maps to DATA_UNSUPPORTED_QUERY with a truthful message', async () => {
    const result = await adapterFor('dead').query({ op: 'list', resourceId: 'runs' }, READ);
    expect(result).toMatchObject({ ok: false, code: 'DATA_UNSUPPORTED_QUERY' });
    if (!result.ok) {
      expect(result.message).toContain('target unreachable');
    }
  });

  it('a path not in the bindings is rejected CLIENT-SIDE with NO fetch issued', async () => {
    const entry = getTarget('mock');
    expect(entry).toBeDefined();
    if (entry === undefined) {
      return;
    }
    const before = mockState.requests;
    await expect(callTarget(entry, '/vict/v1/secret-admin-panel')).rejects.toBeInstanceOf(
      StudioPathError,
    );
    expect(mockState.requests).toBe(before);
  });

  it("a hostile path param such as '../etc' is rejected CLIENT-SIDE without a fetch", async () => {
    const entry = getTarget('mock');
    expect(entry).toBeDefined();
    if (entry === undefined) {
      return;
    }
    const before = mockState.requests;
    await expect(
      callTarget(entry, '/vict/v1/runs/:runId', { runId: '../etc' }),
    ).rejects.toBeInstanceOf(StudioPathError);
    expect(mockState.requests).toBe(before);
  });

  it('mutate is ALWAYS DATA_MUTATION_NOT_DECLARED (G1 read-only)', async () => {
    const result = await adapterFor('mock').mutate(
      { resourceId: 'runs', op: 'create', input: {} },
      { permissions: ['studio.operator.read'], effect: 'write' },
    );
    expect(result).toMatchObject({ ok: false, code: 'DATA_MUTATION_NOT_DECLARED' });
  });

  it('missing studio read permission fails closed with DATA_UNAUTHORIZED', async () => {
    const result = await adapterFor('mock').query({ op: 'list', resourceId: 'runs' }, NO_PERM);
    expect(result).toMatchObject({ ok: false, code: 'DATA_UNAUTHORIZED' });
  });

  it('an unknown resource id is DATA_UNKNOWN_RESOURCE without any fetch', async () => {
    const before = mockState.requests;
    const result = await adapterFor('mock').query(
      { op: 'list', resourceId: 'not-a-resource' },
      READ,
    );
    expect(result).toMatchObject({ ok: false, code: 'DATA_UNKNOWN_RESOURCE' });
    expect(mockState.requests).toBe(before);
  });
});
