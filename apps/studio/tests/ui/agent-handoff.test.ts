// @vitest-environment happy-dom
import { mount, tick, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import { EditorBridge } from '@victframework/ui-editor';
import AgentChat from '../../src/lib/designer/AgentChat.svelte';
import { designerCatalogs, newScreen } from '../../src/lib/designer/application.js';
import { screenStore } from '../../src/lib/designer/storage.js';
import { applyAgentProposal, documentCursor, prepareAgentEdit, type AgentProposal } from '../../src/lib/designer/agent-edits.js';

let instance: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (instance) await unmount(instance);
  instance = undefined;
  document.body.innerHTML = '';
  localStorage.clear();
  vi.unstubAllGlobals();
});

async function setup(options: { lateFrames?: boolean; delayedDelete?: boolean } = {}) {
  const source = newScreen('Mixed editing', 'mixed-screen');
  const bridge = new EditorBridge({ catalogs: designerCatalogs,
    store: screenStore(localStorage, source.id), initial: { document: source, storedRevision: 'r1' } });
  const epoch = crypto.randomUUID();
  let selection = `${source.id}|screen`;
  let draftBlocked = false;
  const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
  const requests: { document: typeof source; cursor: ReturnType<typeof documentCursor>; selection: string }[] = [];
  let finishDelete = () => {};
  const encoder = new TextEncoder();
  const emit = (index: number, event: unknown) => {
    streams[index].enqueue(encoder.encode(JSON.stringify(event) + '\n'));
    if ((event as { type?: string }).type === 'done') streams[index].close();
  };
  const fetcher = vi.fn(async (url: unknown, init?: RequestInit) => {
    if (init?.method === 'DELETE') {
      if (options.delayedDelete) await new Promise<void>((resolve) => { finishDelete = resolve; });
      return new Response('{}');
    }
    if (url === '/api/designer-agent/ack') return new Response('{}');
    if (init?.method === 'POST') {
      const index = requests.length;
      requests.push(JSON.parse(init.body as string));
      return new Response(new ReadableStream<Uint8Array>({ start(controller) {
        streams.push(controller);
        emit(index, { type: 'started', runId: crypto.randomUUID(), model: 'fixture/model' });
        // lateFrames deliberately models frames already in a transport queue.
        if (!options.lateFrames) init.signal?.addEventListener('abort', () => controller.error(new DOMException('Stopped', 'AbortError')), { once: true });
      }}));
    }
    return new Response(JSON.stringify({ csrf: 'fixture', ready: true, model: 'fixture/model' }));
  });
  vi.stubGlobal('fetch', fetcher);
  const apply = vi.fn((proposal: AgentProposal) => applyAgentProposal(bridge, proposal, epoch, draftBlocked));
  instance = mount(AgentChat, { target: document.body, props: {
    screenLabel: 'Mixed editing', selectionLabel: 'Screen', blocked: false,
    getContext: () => ({ document: bridge.document, cursor: documentCursor(bridge.document, bridge.getSnapshot().revision, epoch), selection }),
    applyProposal: apply,
  }});
  await vi.waitFor(() => expect(document.querySelector('.agent-status')?.textContent).toContain('Ready'));
  const send = async (text: string) => {
    const input = document.querySelector<HTMLTextAreaElement>('textarea[name="message"]')!;
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    document.querySelector<HTMLButtonElement>('[data-testid="conversation-send"]')!.click();
    await vi.waitFor(() => expect(requests.length).toBeGreaterThan(0));
    await tick();
  };
  const proposal = (index: number, nodeId: string): AgentProposal => {
    const request = requests[index];
    const edit = { expectedRevision: request.cursor.revision, reason: 'Add heading', operations: [{ op: 'add' as const, recipe: 'heading' as const, parentId: 'screen', nodeId, text: nodeId }] };
    const proposalId = crypto.randomUUID();
    const prepared = prepareAgentEdit(request.document, request.cursor, edit, proposalId);
    if (!prepared.ok) throw new Error(prepared.message);
    return { proposalId, cursor: request.cursor, edit, resultDigest: prepared.digest };
  };
  return { bridge, epoch, requests, fetcher, apply, emit, send, proposal,
    select: (value: string) => { selection = value; }, blockDraft: () => { draftBlocked = true; },
    finishDelete: () => finishDelete(),
  };
}

it('does not let delayed Stop cleanup replace the feedback for a newer turn', async () => {
  const app = await setup({ delayedDelete: true });
  await app.send('First request');
  document.querySelector<HTMLButtonElement>('[data-testid="conversation-stop"]')!.click();
  await vi.waitFor(() => expect(document.querySelector('[data-testid="conversation-send"]')).not.toBeNull());
  await app.send('Second request');
  await vi.waitFor(() => expect(app.requests).toHaveLength(2));
  app.emit(1, { type: 'progress', message: 'Continuing from the current manual state' });
  await tick();
  app.finishDelete();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(document.querySelector('.agent-status')?.getAttribute('title')).toBe('Continuing from the current manual state');
  expect(document.querySelector('[data-testid="conversation-stop"]')).not.toBeNull();
});

it.each(['stale', 'draft', 'invalid'])('settles a genuine %s refusal without waiting for the model and admits fresh context only in a new request', async (kind) => {
  const app = await setup();
  await app.send('Build a heading');
  const proposed = app.proposal(0, 'agent-heading');
  if (kind === 'stale') expect(app.bridge.apply({ requestId: 'manual', commands: [{ op: 'setAttribute', nodeId: 'screen', name: 'aria-label', value: 'My manual work' }] }).ok).toBe(true);
  else if (kind === 'draft') app.blockDraft();
  else proposed.resultDigest = 'invalid-result-digest';
  const manual = app.bridge.document;
  app.emit(0, { type: 'proposal', proposal: proposed });
  await vi.waitFor(() => expect(app.apply).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(document.querySelector('[data-testid="conversation-send"]')).not.toBeNull());
  expect(app.bridge.document).toBe(manual);
  expect(app.bridge.document.nodes['agent-heading']).toBeUndefined();
  expect(document.querySelector('.agent-status')?.textContent).toContain(kind === 'stale' ? 'screen changed' : kind === 'draft' ? 'pending' : 'did not match validation');
  expect(app.fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1);
  if (kind === 'stale') {
    app.select(`${manual.id}|screen`);
    await app.send('Continue from my manual work');
    await vi.waitFor(() => expect(app.requests).toHaveLength(2));
    expect(app.requests[1].document).toEqual(manual);
    expect(app.requests[1].cursor).toEqual(documentCursor(manual, app.bridge.getSnapshot().revision, app.epoch));
    expect(app.requests[1].selection).toBe(`${manual.id}|screen`);
    expect(app.requests[1].cursor).not.toEqual(app.requests[0].cursor);
  }
});

it('keeps an applied batch undoable and ignores late proposals/completion after Stop', async () => {
  const app = await setup({ lateFrames: true });
  await app.send('Build a heading');
  app.emit(0, { type: 'proposal', proposal: app.proposal(0, 'first-heading') });
  await vi.waitFor(() => expect(app.bridge.document.nodes['first-heading']).toBeDefined());
  document.querySelector<HTMLButtonElement>('[data-testid="conversation-stop"]')!.click();
  // A queued terminal must not convert the user's cancellation into success.
  app.emit(0, { type: 'proposal', proposal: app.proposal(0, 'late-heading') });
  app.emit(0, { type: 'done', status: 'completed', applied: 2 });
  await vi.waitFor(() => expect(document.querySelector('[data-testid="conversation-send"]')).not.toBeNull());
  expect(app.apply).toHaveBeenCalledTimes(1);
  expect(app.bridge.document.nodes['late-heading']).toBeUndefined();
  expect(document.querySelector('.agent-status')?.textContent).toContain('Stopped');
  document.querySelector<HTMLButtonElement>('[aria-label="Chat details"]')!.click();await tick();
  await vi.waitFor(()=>expect(document.body.textContent).toContain('1 applied edit remains undoable.'));
  expect(app.bridge.undo().ok).toBe(true);
  expect(app.bridge.document.nodes['first-heading']).toBeUndefined();
});
