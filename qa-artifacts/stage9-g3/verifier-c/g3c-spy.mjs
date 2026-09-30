// G3-C verifier fetch-spy: REAL local HTTP servers emulating the two capability
// worlds; the production transport decides honestly on each.
// (1) declared-0.3.1-shaped surface: run.get refused -> pin presents.
// (2) newer-schemad surface: run.get succeeds -> pin FAILS CLOSED.
import http from 'node:http';

const PINNED_HEALTH = { healthy: true, commandSchema: 'vict.command@1', streamSchema: 'vict.agent-stream@1' };
const PINNED_COMPAT = { commandSchema: 'vict.command@1', streamSchema: 'vict.agent-stream@1', changesetSchema: 'vict.changeset@1', turnSchema: 'vict.agent-turn@1' };

function server(oldStyle) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const json = (o, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.url.endsWith('/vict/v1/health')) return json({ ok: true, data: PINNED_HEALTH });
      if (req.url.endsWith('/vict/v1/compatibility')) return json({ ok: true, data: PINNED_COMPAT });
      if (req.url.endsWith('/vict/v1/actor/whoami')) return json({ ok: true, data: { actorId: 'actor-spy', roles: [], scopes: [] } });
      if (req.url.includes('/vict/v1/runs/')) {
        if (req.method !== 'GET') return json({ ok: false, code: 'VICT_HTTP_METHOD_UNSUPPORTED' }, 405);
        return oldStyle ? json({ ok: false, code: 'VICT_HTTP_ROUTE_UNKNOWN' }, 404) : json({ ok: true, data: { run: { runId: 'x', status: 'completed' } } });
      }
      return json({ ok: false, code: 'VICT_HTTP_ROUTE_UNKNOWN' }, 404);
    });
    s.listen(0, '127.0.0.1', () => resolve({ s, port: s.address().port }));
  });
}

process.env['VICT_STUDIO_TARGETS'] = JSON.stringify([{ id: 'quellight', label: 'spy', endpoint: 'http://127.0.0.1:0', credentialRef: 'quellight-operator' }]);
process.env['VICT_STUDIO_CREDENTIALS'] = JSON.stringify({
  'quellight-operator': { token: 'tok-a', actorLabel: 'op', scopes: ['run.read'] },
  'quellight-agent': { token: 'tok-b', actorLabel: 'agent', scopes: ['run.read'] },
});

const mod = await import('file:///C:/Users/RZ1/Desktop/RZ/vict-02-g3-c-verify/apps/studio/src/lib/server/quellight-transport.ts');
const a = await server(true);
const b = await server(false);

const r1 = await mod.connectQuellightIdentityPin({ endpoint: `http://127.0.0.1:${a.port}`, provenance: { quellightRef: 'spy-world-old', declaredReleaseIdentity: '0.3.1', recordedAtLabel: 'provenance' } });
console.log('WORLD-0.3.1-shaped pin ok =', r1.ok, r1.ok ? JSON.stringify(r1.refusalProbe) : JSON.stringify({ code: r1.code }));

const r2 = await mod.connectQuellightIdentityPin({ endpoint: `http://127.0.0.1:${b.port}` });
console.log('WORLD-newer-schemad (identical inspect records, run.get served) pin ok =', r2.ok, !r2.ok ? JSON.stringify({ code: r2.code, detail: r2.detail }) : JSON.stringify(r2.refusalProbe));

a.s.close(); b.s.close();