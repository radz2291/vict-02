import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ delivered: 0, cancelled: false }));
vi.mock('../src/lib/server/designer-agent.js', () => ({
  agentConfiguration: () => ({ model: 'offline', ready: true }),
  validateAgentStart: (value: unknown) => ({ ok: true, value }),
  cancelAgentRun: () => {
    state.cancelled = true;
    return true;
  },
  openAgentRun: (_owner: string, _start: unknown, emit: (event: unknown) => Promise<void>) => ({
    ok: true,
    runId: 'fixture',
    finished: (async () => {
      await emit({ type: 'started', runId: 'fixture' });
      state.delivered++;
      await emit({ type: 'text', delta: 'x'.repeat(3_000_000) });
      state.delivered++;
      await emit({ type: 'done', status: 'completed', applied: 0 });
      state.delivered++;
    })(),
  }),
}));
import { POST } from '../src/routes/api/designer-agent/+server.js';

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
