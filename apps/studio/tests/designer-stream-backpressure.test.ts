import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  delivered: 0,
  cancelled: false,
  controller: new AbortController(),
  finished: Promise.resolve(),
}));
const runId = 'f57d4334-cd49-42e9-b101-586a1cd3b3f4';
vi.mock('../src/lib/server/designer-agent.js', () => ({
  agentConfiguration: () => ({ model: 'offline', ready: true }),
  validateAgentStart: (value: unknown) => ({ ok: true, value }),
  cancelAgentRun: () => {
    state.cancelled = true;
    state.controller.abort();
    return true;
  },
  openAgentRun: (_owner: string, _start: unknown, emit: (event: unknown) => Promise<void>) => {
    state.controller = new AbortController();
    state.finished = (async () => {
      await emit({ type: 'started', runId: 'f57d4334-cd49-42e9-b101-586a1cd3b3f4' });
      if (state.controller.signal.aborted) return;
      state.delivered++;
      await emit({ type: 'text', delta: 'x'.repeat(3_000_000) });
      if (state.controller.signal.aborted) return;
      state.delivered++;
      await emit({ type: 'done', status: 'completed', applied: 0 });
      state.delivered++;
    })();
    return {
      ok: true,
      runId: 'f57d4334-cd49-42e9-b101-586a1cd3b3f4',
      signal: state.controller.signal,
      finished: state.finished,
    };
  },
}));
import { POST, DELETE } from '../src/routes/api/designer-agent/+server.js';

it('awaits actual NDJSON consumer demand without a cumulative byte cutoff or eager frame queue', async () => {
  state.delivered = 0;
  const request = new Request('http://localhost/api/designer-agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-vict-csrf': 'nonce' },
    body: '{}',
  });
  const response = await POST({
    request,
    locals: { session: { sessionId: 'owner', csrfToken: 'nonce' } },
  } as never);
  expect(state.delivered).toBe(0);
  const reader = response.body!.getReader();
  expect(new TextDecoder().decode((await reader.read()).value)).toContain('started');
  await vi.waitFor(() => expect(state.delivered).toBe(1));
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(state.delivered).toBe(1);
  const frame = new TextDecoder().decode((await reader.read()).value);
  expect(JSON.parse(frame).delta).toHaveLength(3_000_000);
  expect(new TextDecoder().decode((await reader.read()).value)).toContain('completed');
  expect((await reader.read()).done).toBe(true);
});

it.each([false, true])(
  'DELETE aborts the run-owned writer while %s initial/later demand is blocked without closing the reader',
  async (readInitial) => {
    state.delivered = 0;
    state.cancelled = false;
    const headers = { 'content-type': 'application/json', 'x-vict-csrf': 'nonce' },
      locals = { session: { sessionId: 'owner', csrfToken: 'nonce' } };
    const response = await POST({
      request: new Request('http://localhost/api/designer-agent', {
        method: 'POST',
        headers,
        body: '{}',
      }),
      locals,
    } as never);
    const reader = response.body!.getReader();
    if (readInitial) {
      await reader.read();
      await vi.waitFor(() => expect(state.delivered).toBe(1));
    }
    const deletion = await DELETE({
      request: new Request('http://localhost/api/designer-agent', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ runId }),
      }),
      locals,
    } as never);
    expect(deletion.status).toBe(200);
    await Promise.race([
      state.finished,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(Error('DELETE remained blocked on writer')), 500),
      ),
    ]);
    expect(state.cancelled).toBe(true);
    expect(state.delivered).toBe(readInitial ? 1 : 0);
    await expect(reader.read()).rejects.toBeDefined();
  },
);
