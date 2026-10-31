import { expect, it } from 'vitest';
import { agentJson } from '../src/lib/server/designer-agent-http.js';
const session = { sessionId: 'independent-http', actorLabel: 'operator', csrfToken: 'independent' };
const headers = { 'content-type': 'application/json', 'x-vict-csrf': 'independent' };

it('accepts complete valid UTF-8 JSON beyond the former aggregate byte cutoff', async () => {
  const text = '界'.repeat(500000),
    body = JSON.stringify({ text });
  expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(1200000);
  expect(
    await agentJson(
      new Request('http://independent.invalid', { method: 'POST', headers, body }),
      session,
    ),
  ).toEqual({ ok: true, value: { text } });
});

it('independent challenge: malformed UTF-8 fails request validation instead of becoming provider connectivity', async () => {
  const result = await agentJson(
    new Request('http://independent.invalid', {
      method: 'POST',
      headers,
      body: new Uint8Array([0xff]),
    }),
    session,
  );
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toMatchObject({ code: 'STUDIO_AGENT_REQUEST' });
  }
});

it('admits valid canonical source above former 500-node/200000-character quotas and longer prompts/history', async () => {
  const { newScreen } = await import('../src/lib/designer/application.js');
  const { documentCursor } = await import('../src/lib/designer/agent-edits.js');
  const { validateAgentStart } = await import('../src/lib/server/designer-agent.js');
  const source = newScreen('Large canonical source', 'large-source');
  const nodes = { ...source.nodes };
  const children = Array.from({ length: 510 }, (_, i) => 'node-' + i);
  for (const id of children)
    nodes[id] = {
      kind: 'text',
      id,
      content: { type: 'literal', value: 'Canonical source content '.repeat(20) },
    };
  const document = {
    ...source,
    nodes: {
      ...nodes,
      [source.root]: { kind: 'element' as const, id: source.root, tag: 'main', children },
    },
  };
  expect(JSON.stringify(document).length).toBeGreaterThan(200000);
  expect(Object.keys(document.nodes).length).toBeGreaterThan(500);
  const result = validateAgentStart({
    document,
    cursor: documentCursor(document, 'r1', crypto.randomUUID()),
    prompt: 'Build meaningful content '.repeat(400),
    history: Array.from({ length: 14 }, () => ({
      participant: 'user',
      text: 'Retained history '.repeat(500),
    })),
  });
  expect(result.ok).toBe(true);
}, 60000);
