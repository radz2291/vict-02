//
// S9-02 run-detail READ CONTRACT tests (node environment; the G3-B builder
// lane's own test file — tests the new route's server read modules against a
// canned G1-shaped target over a real loopback socket). The frozen G1 paths
// and envelope shapes are pinned BY NAME: { ok: true, data } / { ok: false,
// code }; stable codes VICT_RUN_MISSING / VICT_ACTOR_SCOPE_DENIED / VICT_RUN_ID_INVALID.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createServer, type RequestListener } from 'node:http';
import {
  boundedId,
  readProtectedDetail,
  readRunAudit,
  readRunEvents,
  readRunRecord,
  readRunWaits,
  readRunsListPage,
  compareRunRecords,
} from '../src/routes/runs/[runId]/run-detail-reads.js';
import { reloadTargetConfigFromEnv } from '../src/lib/server/targets.js';

/* ------------------------------------------------------------------ */
/* Canned G1-shaped target (real socket; records every request verbatim) */
/* ------------------------------------------------------------------ */

const REQUESTS: { method: string; path: string; token: string | undefined }[] = [];

const REDACTED_RUN = {
  runId: 'run-demo-blocked',
  graphId: 'g.studio-demo',
  status: 'blocked',
  retention: 'full',
  currentNodeId: 'n1',
  recordRevision: 3,
  createdAt: 1,
  updatedAt: 2,
  // NOTE: no `output` member — the generic projection never carries it.
};

const handler: RequestListener = (req, res) => {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '') || undefined;
  REQUESTS.push({ method: req.method ?? 'GET', path: req.url ?? '', token });
  const send = (status: number, body: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const url = req.url ?? '';
  if (url === '/vict/v1/runs/run-demo-blocked') {
    send(200, { ok: true, data: { run: REDACTED_RUN } });
    return;
  }
  if (url === '/vict/v1/runs/run-demo-missing') {
    send(404, { ok: false, code: 'VICT_RUN_MISSING' });
    return;
  }
  if (url === '/vict/v1/runs/run-demo-blocked/events?afterSeq=-1&limit=100') {
    send(200, {
      ok: true,
      data: {
        runId: 'run-demo-blocked',
        events: [{ seq: 1, type: 'run.waiting' }],
        hasMore: false,
      },
    });
    return;
  }
  if (url === '/vict/v1/runs/run-demo-blocked/waits') {
    send(200, {
      ok: true,
      data: {
        runId: 'run-demo-blocked',
        waits: [
          { waitId: 'wait-demo-signal', kind: 'signal', signalName: 'demo.resume', status: 'open' },
        ],
      },
    });
    return;
  }
  if (url.startsWith('/vict/v1/audit?')) {
    send(200, {
      ok: true,
      data: {
        events: [
          {
            auditId: 'a1',
            actorId: 'operator-detail',
            action: 'run.detail.accessed',
            subjectType: 'run',
            subjectId: 'run-demo-blocked',
          },
        ],
      },
    });
    return;
  }
  if (url === '/vict/v1/runs/run-demo-blocked/detail') {
    // Distinct-scope enforcement: only the run.detail-grant token passes.
    if (token === 'token-detail-grant') {
      send(200, {
        ok: true,
        data: {
          run: REDACTED_RUN,
          protectedOutput: { canary: 'S902-PROTECTED-BYTES-demo.resume' },
          protectedAvailable: true,
          retention: 'full',
        },
      });
      return;
    }
    send(403, { ok: false, code: 'VICT_ACTOR_SCOPE_DENIED' });
    return;
  }
  if (url === '/vict/v1/runs?limit=2&offset=2') {
    send(200, { ok: true, data: { runs: [REDACTED_RUN, REDACTED_RUN], total: 5, hasMore: true } });
    return;
  }
  send(404, { ok: false, code: 'VICT_HTTP_PATH_UNKNOWN' });
};

const PORT = await new Promise<number>((resolve) => {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1', () => {
    resolve((server.address() as AddressInfo).port);
    afterAll(() => server.close());
  });
});

process.env['VICT_STUDIO_TARGETS'] = JSON.stringify([
  {
    id: 's902-test',
    label: 'Canned S9-02 target',
    endpoint: `http://127.0.0.1:${PORT}`,
    credentialRef: 's902-test-operator',
  },
]);
process.env['VICT_STUDIO_CREDENTIALS'] = JSON.stringify({
  's902-test-operator': {
    token: 'token-plain-operator',
    actorLabel: 'studio-operator',
    scopes: ['run.read', 'audit.read'],
  },
  // The run-detail page resolves `${credentialRef}-detail` for run.detail;
  // provisioned FIRST with a token the target maps to a scopeless actor (the
  // redaction/denial prong), swapped to the grant below for the positive prong.
  's902-test-operator-detail': {
    token: 'token-scopeless',
    actorLabel: 'operator-detail',
    scopes: ['run.read'],
  },
});
reloadTargetConfigFromEnv();

beforeEach(() => {
  REQUESTS.length = 0;
});

describe('S9-02 run-detail reads (G1-shaped canned target)', () => {
  it('reads the REDACTED generic record verbatim (no protected bytes by construction)', async () => {
    const record = await readRunRecord('run-demo-blocked', 's902-test');
    expect(record.kind).toBe('ok');
    const data = record.kind === 'ok' ? record.data : null;
    expect(data).toEqual(REDACTED_RUN);
    expect(data?.['status']).toBe('blocked');
    expect(data?.['recordRevision']).toBe(3);
    expect(data && 'output' in data).toBe(false);
    expect(REQUESTS).toEqual([
      { method: 'GET', path: '/vict/v1/runs/run-demo-blocked', token: 'token-plain-operator' },
    ]);
  });

  it('maps the target envelope error (VICT_RUN_MISSING) truthfully', async () => {
    const record = await readRunRecord('run-demo-missing', 's902-test');
    expect(record).toEqual({ kind: 'envelope-error', status: 404, code: 'VICT_RUN_MISSING' });
  });

  it('reads ordered events and durable waits with the configured queries', async () => {
    const events = await readRunEvents('run-demo-blocked', 's902-test');
    expect(events.kind).toBe('ok');
    if (events.kind === 'ok') {
      expect(events.data.events).toEqual([{ seq: 1, type: 'run.waiting' }]);
      expect(events.data.hasMore).toBe(false);
    }
    const waits = await readRunWaits('run-demo-blocked', 's902-test');
    expect(waits.kind).toBe('ok');
    if (waits.kind === 'ok') {
      expect(waits.data.waits[0]?.['waitId']).toBe('wait-demo-signal');
    }
  });

  it('run.detail: the DISTINCT detail credential is used; scope denial surfaces the target code; no state change', async () => {
    // Ungranted actor (the detail credential's token has no run.detail grant
    // on the target): the target itself refuses (VICT_ACTOR_SCOPE_DENIED);
    // only a GET was ever issued (no state change is possible through reads).
    const denied = await readProtectedDetail('run-demo-blocked', 's902-test');
    expect(denied).toEqual({
      kind: 'envelope-error',
      status: 403,
      code: 'VICT_ACTOR_SCOPE_DENIED',
    });
    const detailRequest = REQUESTS.find(
      (request) => request.path === '/vict/v1/runs/run-demo-blocked/detail',
    );
    expect(detailRequest?.method).toBe('GET');
    expect(detailRequest?.token).toBe('token-scopeless');
    expect(REQUESTS.filter((request) => request.method !== 'GET').length).toBe(0);
    REQUESTS.length = 0;

    // The grant-holder credential receives the protected bytes.
    process.env['VICT_STUDIO_CREDENTIALS'] = JSON.stringify({
      's902-test-operator': {
        token: 'token-plain-operator',
        actorLabel: 'studio-operator',
        scopes: ['run.read', 'audit.read'],
      },
      's902-test-operator-detail': {
        token: 'token-detail-grant',
        actorLabel: 'operator-detail',
        scopes: ['run.read', 'run.detail'],
      },
    });
    reloadTargetConfigFromEnv();
    const allowed = await readProtectedDetail('run-demo-blocked', 's902-test');
    expect(allowed.kind).toBe('ok');
    if (allowed.kind === 'ok') {
      expect(allowed.data.protectedAvailable).toBe(true);
      expect(allowed.data.retention).toBe('full');
      expect(allowed.data.protectedOutput).toEqual({ canary: 'S902-PROTECTED-BYTES-demo.resume' });
    }
    expect(REQUESTS[0]?.token).toBe('token-detail-grant');
  });

  it('without a provisioned run.detail grant the protected read is truthfully unavailable (no silent downgrade)', async () => {
    process.env['VICT_STUDIO_CREDENTIALS'] = JSON.stringify({
      's902-test-operator': {
        token: 'token-plain-operator',
        actorLabel: 'studio-operator',
        scopes: ['run.read', 'audit.read'],
      },
    });
    reloadTargetConfigFromEnv();
    const result = await readProtectedDetail('run-demo-blocked', 's902-test');
    expect(result).toEqual({ kind: 'http-error', status: 501 });
    // NO fetch was made at all.
    expect(REQUESTS.filter((request) => request.path.endsWith('/detail')).length).toBe(0);
  });

  it('audit read uses the composed subject filter', async () => {
    const audit = await readRunAudit('run-demo-blocked', 's902-test');
    expect(audit.kind).toBe('ok');
    if (audit.kind === 'ok') {
      expect(audit.data.events[0]?.['action']).toBe('run.detail.accessed');
    }
    expect(REQUESTS[0]?.path).toBe(
      '/vict/v1/audit?subjectType=run&subjectId=run-demo-blocked&limit=100',
    );
  });

  it('invalid identifiers fail closed BEFORE any fetch', async () => {
    expect(await readRunRecord('../etc-passwd', 's902-test')).toEqual({
      kind: 'http-error',
      status: 400,
    });
    expect(await readRunRecord('run-demo-blocked', 'unknown-target')).toEqual({
      kind: 'unreachable',
    });
    expect(boundedId('run ok')).toBeNull();
    expect(boundedId('run-demo-blocked')).toBe('run-demo-blocked');
    expect(REQUESTS.length).toBe(0);
  });

  it('pagination read surfaces total/hasMore verbatim (S9-02 negative-set reader)', async () => {
    const page = await readRunsListPage('s902-test', 2, 2);
    expect(page.kind).toBe('ok');
    if (page.kind === 'ok') {
      expect(page.data.total).toBe(5);
      expect(page.data.hasMore).toBe(true);
      expect(page.data.runs.length).toBe(2);
    }
    expect(REQUESTS[0]?.path).toBe('/vict/v1/runs?limit=2&offset=2');
  });

  it('unreachable target yields a truthful unreachable outcome', async () => {
    process.env['VICT_STUDIO_TARGETS'] = JSON.stringify([
      {
        id: 'dead',
        label: 'Dead',
        endpoint: 'http://127.0.0.1:49991',
        credentialRef: 's902-test-operator',
      },
    ]);
    reloadTargetConfigFromEnv();
    const record = await readRunRecord('run-demo-blocked', 'dead');
    expect(record.kind).toBe('unreachable');
  });
});

describe('S9-02 dual-read compare (stale-revision design)', () => {
  it('detects the record moving between the two generic reads', () => {
    const first = { ...REDACTED_RUN, recordRevision: 3, status: 'blocked' };
    const second = { ...REDACTED_RUN, recordRevision: 4, status: 'cancelled', currentNodeId: null };
    const result = compareRunRecords(first, second);
    expect(result.moved).toBe(true);
    const changed = result.fields.filter((field) => field.changed).map((field) => field.key);
    expect(changed.sort()).toEqual(['currentNodeId', 'recordRevision', 'status'].sort());
  });

  it('reports no movement when both reads agree and never invents a merged state', () => {
    const result = compareRunRecords(REDACTED_RUN, REDACTED_RUN);
    expect(result.moved).toBe(false);
    expect(result.fields.every((field) => !field.changed)).toBe(true);
  });

  it('version compare carries the identity/version fields of both reads', () => {
    const first = { ...REDACTED_RUN, activationVersion: 'av-1' };
    const second = { ...REDACTED_RUN, graphVersion: 'v-2' };
    const result = compareRunRecords(first, second);
    const activationRow = result.fields.find((field) => field.key === 'activationVersion');
    const graphRow = result.fields.find((field) => field.key === 'graphVersion');
    expect(activationRow?.first).toBe('av-1');
    expect(activationRow?.second).toBe('(absent)');
    expect(graphRow?.first).toBe('(absent)');
    expect(graphRow?.second).toBe('v-2');
  });
});
