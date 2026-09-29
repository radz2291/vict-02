import { afterAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';

/**
 * Target registry: four TRUTHFUL states (absent / unreachable / rejected /
 * connected) over real sockets, plus the credential-never-leaks invariant.
 */

const rejectServer = createServer((_req, res) => {
  res.writeHead(401, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: false, code: 'VICT_AUTH_TOKEN_MISSING' }));
});
const liveServer = createServer((req, res) => {
  const send = (body: unknown): void => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if ((req.url ?? '').startsWith('/vict/v1/activations/selected')) {
    send({
      ok: true,
      data: {
        activation: { activationVersion: 'av-demo-1' },
        selection: { graphId: 'g.demo', selectionRevision: 1, selectedAt: 123 },
      },
    });
    return;
  }
  send({ ok: true, data: { releases: [] } });
});

const rejectPort = await new Promise<number>((resolve) => {
  rejectServer.listen(0, '127.0.0.1', () => resolve((rejectServer.address() as AddressInfo).port));
});
const livePort = await new Promise<number>((resolve) => {
  liveServer.listen(0, '127.0.0.1', () => resolve((liveServer.address() as AddressInfo).port));
});
const DEAD_PORT = 49991;

process.env['VICT_STUDIO_TARGETS'] = JSON.stringify([
  {
    id: 'dead',
    label: 'Dead target',
    endpoint: `http://127.0.0.1:${DEAD_PORT}`,
    credentialRef: 'cred-a',
  },
  {
    id: 'reject',
    label: 'Rejecting target',
    endpoint: `http://127.0.0.1:${rejectPort}`,
    credentialRef: 'cred-a',
  },
  {
    id: 'live',
    label: 'Live target',
    endpoint: `http://127.0.0.1:${livePort}`,
    credentialRef: 'cred-b',
  },
]);
process.env['VICT_STUDIO_CREDENTIALS'] = JSON.stringify({
  'cred-a': { token: 'targets-test-token-a', actorLabel: 'probe-a', scopes: ['run.read'] },
  'cred-b': {
    token: 'targets-test-token-b',
    actorLabel: 'probe-b',
    scopes: ['run.read', 'activation.read'],
  },
});

const { getTarget, listTargets, probeTarget, reloadTargetConfigFromEnv } =
  await import('../src/lib/server/targets.js');
reloadTargetConfigFromEnv();

afterAll(async () => {
  await new Promise<void>((resolve) => rejectServer.close(() => resolve()));
  await new Promise<void>((resolve) => liveServer.close(() => resolve()));
});

describe('target registry probes (truthful states)', () => {
  it('an unknown id is truthfully ABSENT (undefined, never a guess)', () => {
    expect(getTarget('nope')).toBeUndefined();
    expect(
      listTargets()
        .map((entry) => entry.id)
        .sort(),
    ).toEqual(['dead', 'live', 'reject']);
  });

  it('a closed port is UNREACHABLE within the probe window', async () => {
    const entry = getTarget('dead');
    expect(entry).toBeDefined();
    const row = await probeTarget(entry!);
    expect(row.state).toBe('unreachable');
    expect(row.actorId).toBeNull();
    expect(row.scopes).toEqual([]);
  });

  it('a 401 target is REJECTED; no actor identity is disclosed', async () => {
    const entry = getTarget('reject');
    const row = await probeTarget(entry!);
    expect(row.state).toBe('rejected');
    expect(row.actorId).toBeNull();
    expect(row.selected).toBeNull();
  });

  it('a 200 target is CONNECTED with the CONFIGURED scopes and selected version', async () => {
    const entry = getTarget('live');
    const row = await probeTarget(entry!);
    expect(row.state).toBe('connected');
    expect(row.actorId).toBe('probe-b');
    expect(row.scopes).toEqual(['run.read', 'activation.read']);
    expect(row.selected).toEqual({ 'g.demo': 'av-demo-1' });
    expect(row.detail).toContain(`http://127.0.0.1:${livePort}`);
  });

  it('TargetStatusRow NEVER carries credential material', async () => {
    for (const id of ['dead', 'reject', 'live']) {
      const row = await probeTarget(getTarget(id)!);
      const keys = Object.keys(row);
      expect(keys).not.toContain('token');
      expect(keys).not.toContain('credential');
      expect(keys).not.toContain('credentialRef');
      const serialized = JSON.stringify(row);
      expect(serialized).not.toContain('targets-test-token-a');
      expect(serialized).not.toContain('targets-test-token-b');
    }
  });
});
