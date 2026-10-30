import { expect, it } from 'vitest';
import { agentJson } from '../src/lib/server/designer-agent-http.js';
import { AGENT_REQUEST_BYTES } from '../src/lib/designer/agent-transport.js';
const session = { sessionId: 'independent-http', actorLabel: 'operator', csrfToken: 'independent' };
const headers = { 'content-type': 'application/json', 'x-vict-csrf': 'independent' };

it('independent challenge: admits exactly the aggregate UTF-8 byte boundary and refuses the next bytes', async () => {
  const overhead = new TextEncoder().encode(JSON.stringify({ text: '' })).byteLength;
  const room = AGENT_REQUEST_BYTES - overhead;
  const text = '界'.repeat(Math.floor(room / 3)) + 'a'.repeat(room % 3);
  const body = JSON.stringify({ text });
  expect(new TextEncoder().encode(body).byteLength).toBe(AGENT_REQUEST_BYTES);
  expect(await agentJson(new Request('http://independent.invalid', { method: 'POST', headers, body }), session)).toMatchObject({ ok: true, value: { text } });
  const refused = await agentJson(new Request('http://independent.invalid', { method: 'POST', headers, body: JSON.stringify({ text: text + '界' }) }), session);
  expect(refused.ok).toBe(false);
  if (!refused.ok) {
    expect(refused.response.status).toBe(413);
    expect(await refused.response.json()).toMatchObject({ code: 'STUDIO_AGENT_REQUEST_LIMIT', limitBytes: AGENT_REQUEST_BYTES });
  }
});

it('independent challenge: malformed UTF-8 fails request validation instead of becoming provider connectivity', async () => {
  const result = await agentJson(new Request('http://independent.invalid', { method: 'POST', headers, body: new Uint8Array([0xff]) }), session);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toMatchObject({ code: 'STUDIO_AGENT_REQUEST' });
  }
});
