// @vitest-environment happy-dom
import {afterEach, describe, expect, it, vi} from 'vitest';
import {flushSync, mount, tick, unmount} from 'svelte';
import AgentChat from '../src/lib/designer/AgentChat.svelte';
import {newScreen} from '../src/lib/designer/application.js';
import {documentCursor} from '../src/lib/designer/agent-edits.js';

let instance: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (instance) await unmount(instance);
  instance = undefined;
  vi.unstubAllGlobals(); document.body.replaceChildren();
});
const settle = async () => {flushSync(); await tick(); await new Promise(resolve => setTimeout(resolve, 20)); flushSync();};
async function run(frames: unknown[]) {
  const source = newScreen('Independent boundary', 'independent-response-boundary');
  const cursor = documentCursor(source, 'r1', crypto.randomUUID());
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === 'POST'
    ? new Response([{type: 'started', runId: crypto.randomUUID(), model: 'offline-test'}, ...frames].map(frame => JSON.stringify(frame)).join('\n') + '\n', {headers: {'content-type': 'application/x-ndjson'}})
    : Response.json({csrf: 'offline-csrf', model: 'offline-test', ready: true}));
  vi.stubGlobal('fetch', fetchMock);
  const host = document.createElement('div'); document.body.append(host);
  instance = mount(AgentChat, {target: host, props: {screenLabel: 'Independent boundary', selectionLabel: 'None', blocked: false, getContext: () => ({document: source, cursor}), applyProposal: () => ({ok: false, code: 'UNEXPECTED', message: 'No edits authorized in this offline probe'})}});
  await settle();
  const input = host.querySelector('textarea')!;
  input.value = 'Inspect public evidence'; input.dispatchEvent(new Event('input', {bubbles: true})); await settle();
  host.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
  await settle(); await settle();
  const assistant = host.querySelector<HTMLElement>('[data-participant="assistant"]')!;
  expect(assistant).not.toBeNull();
  return {host, assistant, fetchMock};
}
describe('independent actual host response branch challenge', () => {
  it('does not promote provisional text followed by another real invocation, even for an in-place call identity', async () => {
    const {assistant, fetchMock} = await run([
      {type: 'tool-event', kind: 'tool-start', tool: 'studio_screen_read', callId: 'same', id: 'one', summary: 'Started'},
      {type: 'text', delta: 'Public provisional note; not a terminal answer.'},
      {type: 'tool-event', kind: 'tool-start', tool: 'studio_screen_read', callId: 'same', id: 'two', summary: 'Started again'},
      {type: 'tool-event', kind: 'observation', tool: 'studio_screen_read', callId: 'same', id: 'receipt', summary: 'Read settled'},
      {type: 'done', status: 'completed', applied: 0, confirmedRevision: 'r1'},
    ]);
    expect(assistant.querySelector('[aria-label="Terminal response"]')).toBeNull();
    expect(assistant.textContent).toContain('No final response received');
    expect(assistant.querySelector('[data-event-kind="text"]')?.textContent).toBe('Public provisional note; not a terminal answer.');
    expect(assistant.querySelector('[data-slot="trace-collapsible-content"]')?.hasAttribute('hidden')).toBe(true);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });
  it.each(['cancelled', 'failed'])('does not project success for actual %s stream termination', async status => {
    const {assistant, fetchMock} = await run([
      {type: 'text', delta: 'Supplied public progress, not proven completion.'},
      {type: 'done', status, code: status === 'failed' ? 'STUDIO_AGENT_PROVIDER_FAILED' : undefined, applied: 0},
    ]);
    expect(assistant.querySelector('[aria-label="Terminal response"]')).toBeNull();
    expect(assistant.textContent).toContain('No successful final response');
    expect(assistant.querySelector('[data-event-kind="text"]')?.textContent).toBe('Supplied public progress, not proven completion.');
    expect(assistant.querySelector('[role="status"]')?.textContent).not.toContain('Working');
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });
  it('turns premature EOF into interrupted disclosure while retaining public text and no invented final', async () => {
    const {assistant, fetchMock} = await run([{type: 'text', delta: 'Partial public text retained exactly.'}]);
    expect(assistant.querySelector('[aria-label="Terminal response"]')).toBeNull();
    expect(assistant.textContent).toContain('No successful final response');
    expect(assistant.querySelector('[role="status"]')?.textContent).toContain('Connection interrupted');
    expect(assistant.querySelector('[data-event-kind="text"]')?.textContent).toBe('Partial public text retained exactly.');
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });
});
