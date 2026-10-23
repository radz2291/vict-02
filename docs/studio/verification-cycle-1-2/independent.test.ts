// @vitest-environment happy-dom
import { mount, tick, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import { EditorBridge } from '@victframework/ui-editor';
import AgentChat from '../../../apps/studio/src/lib/designer/AgentChat.svelte';
import { designerCatalogs, newScreen } from '../../../apps/studio/src/lib/designer/application.js';
import { screenStore } from '../../../apps/studio/src/lib/designer/storage.js';
import { applyAgentProposal, documentCursor, prepareAgentEdit, type AgentProposal } from '../../../apps/studio/src/lib/designer/agent-edits.js';

let instance: ReturnType<typeof mount> | undefined;
afterEach(async () => {
  if (instance) await unmount(instance);
  instance = undefined;
  document.body.innerHTML = '';
  localStorage.clear();
  vi.unstubAllGlobals();
});

async function setup(options: { lateFrames?: boolean; delayedDelete?: boolean; failAck?: boolean } = {}) {
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
    if (url === '/api/designer-agent/ack') { if(options.failAck) throw new Error('Independent deterministic acknowledgement disconnect'); return new Response('{}'); }
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

// Independent negatives. The helper reuses candidate mount/bridge boilerplate;
// transports below are deterministic fixtures, never live-provider evidence.
it('retains one actual canonical effect and Undo after acknowledgement transport failure', async () => {
  const app=await setup({failAck:true});
  await app.send('Apply one heading');
  app.emit(0,{type:'proposal',proposal:app.proposal(0,'retained-after-disconnect')});
  await vi.waitFor(()=>expect(document.querySelector('[data-testid="conversation-send"]')).not.toBeNull());
  expect(app.bridge.document.nodes['retained-after-disconnect']).toBeDefined();
  expect(document.querySelector('.agent-status')?.textContent).toContain('1 edits applied locally');
  expect(document.querySelector('.agent-status')?.textContent).toContain('Inspect the canvas');
  expect(app.bridge.undo().ok).toBe(true);
  expect(app.bridge.document.nodes['retained-after-disconnect']).toBeUndefined();
});

it('cannot revive a browser-refused turn with buffered proposal, progress or dishonest terminal count', async () => {
  const app=await setup({lateFrames:true});
  await app.send('First turn');
  const refused=app.proposal(0,'refused-heading');
  expect(app.bridge.apply({requestId:'independent-manual',commands:[{op:'setAttribute',nodeId:'screen',name:'aria-label',value:'Independent manual state'}]}).ok).toBe(true);
  const manual=app.bridge.document;
  app.emit(0,{type:'proposal',proposal:refused});
  await vi.waitFor(()=>expect(document.querySelector('[data-testid="conversation-send"]')).not.toBeNull());
  await app.send('Second turn from current manual work');
  await vi.waitFor(()=>expect(app.requests).toHaveLength(2));
  app.emit(1,{type:'progress',message:'Fresh turn owns this feedback'});
  await tick();
  app.emit(0,{type:'proposal',proposal:app.proposal(0,'buffered-heading')});
  app.emit(0,{type:'progress',message:'Obsolete turn must not own feedback'});
  app.emit(0,{type:'done',status:'completed',applied:999});
  await tick();
  expect(app.requests[1].document).toEqual(manual);
  expect(app.bridge.document).toBe(manual);
  expect(app.apply).toHaveBeenCalledTimes(1);
  expect(document.querySelector('.agent-status')?.getAttribute('title')).toBe('Fresh turn owns this feedback');
  expect(document.querySelector('[data-testid="conversation-stop"]')).not.toBeNull();
});

it('refuses an invalid multi-operation proposal atomically and leaves no history or automatic replay', async () => {
  const app=await setup();
  await app.send('Invalid batch probe');
  const initial=app.bridge.document;
  const proposed=app.proposal(0,'must-not-partially-apply');
  proposed.edit.operations.push({op:'remove',nodeId:'nonexistent-node'});
  app.emit(0,{type:'proposal',proposal:proposed});
  await vi.waitFor(()=>expect(document.querySelector('[data-testid="conversation-send"]')).not.toBeNull());
  expect(app.bridge.document).toBe(initial);
  expect(app.bridge.document.nodes['must-not-partially-apply']).toBeUndefined();
  const acknowledgement=app.fetcher.mock.calls.find(([url])=>url==='/api/designer-agent/ack');
  expect(JSON.parse(acknowledgement![1]!.body as string).receipt.ok).toBe(false);
  expect(app.bridge.getSnapshot().canUndo).toBe(false);
  expect(app.requests).toHaveLength(1);
  expect(document.querySelector('.agent-status')?.textContent).toContain('Send a new request');
});


