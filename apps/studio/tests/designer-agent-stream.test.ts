import { afterEach, expect, it, vi } from 'vitest';
const cleanup = vi.hoisted(() => {
  let complete!: () => void;
  const finished = new Promise<void>((resolve) => {
    complete = resolve;
  });
  return { finished, complete };
});
vi.mock('$lib/server/designer-agent.js', () => ({
  agentConfiguration: () => ({ model: 'test/model', ready: true }),
  validateAgentStart: () => ({ ok: true, value: {} }),
  cancelAgentRun: vi.fn(() => true),
  openAgentRun: (_owner: unknown, _start: unknown, emit: (event: unknown) => void) => {
    emit({
      type: 'started',
      runId: 'a00bf557-cea9-43d7-bae6-7c08ce83e9b4',
      model: 'test/model',
      engine: 'VICT / Mastra',
    });
    emit({ type: 'done', status: 'completed', applied: 0 });
    return { ok: true, runId: 'a00bf557-cea9-43d7-bae6-7c08ce83e9b4', finished: cleanup.finished };
  },
}));
import { POST } from '../src/routes/api/designer-agent/+server.js';
afterEach(() => cleanup.complete());
it('ends NDJSON at terminal delivery without waiting for private cleanup', async () => {
  const request = new Request('http://localhost/api/designer-agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-vict-csrf': 'nonce' },
    body: '{}',
  });
  const response = await POST({
    request,
    locals: { session: { sessionId: 'test', actorLabel: 'operator', csrfToken: 'nonce' } },
  } as never);
  expect(response.headers.get('content-type')).toContain('application/x-ndjson');
  const reader = response.body!.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  void cleanup.finished.then(() => {
    finished = true;
  });
  try {
    const read = async () => {
      const events = [];
      while (true) {
        const next = await reader.read();
        if (next.done) return events;
        events.push(JSON.parse(new TextDecoder().decode(next.value)));
      }
    };
    const events = await Promise.race([
      read(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Terminal response waited for cleanup')), 500);
      }),
    ]);
    expect(events.map((event) => event.type)).toEqual(['started', 'done']);
    expect(finished).toBe(false);
  } finally {
    if (timer) clearTimeout(timer);
    reader.releaseLock();
  }
});
