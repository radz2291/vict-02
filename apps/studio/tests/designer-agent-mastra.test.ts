import { describe, it, expect } from 'vitest';
import { createDeterministicOfflineModel, OFFLINE_MODEL_IDENTITY } from '@victframework/mastra';
import { EditorBridge } from '@victframework/ui-editor';
import { newScreen, designerCatalogs } from '../src/lib/designer/application.js';
import { screenStore } from '../src/lib/designer/storage.js';
import {
  agentContext,
  applyAgentProposal,
  documentCursor,
} from '../src/lib/designer/agent-edits.js';
import {
  openAgentRun,
  acknowledgeAgentEdit,
  cancelAgentRun,
  validateAgentStart,
  type StudioAgentEvent,
} from '../src/lib/server/designer-agent.js';

function context() {
  const storage = { getItem: () => null, setItem: () => {} };
  const document = newScreen('Live loop fixture', 'loop-test');
  const bridge = new EditorBridge({
    catalogs: designerCatalogs,
    store: screenStore(storage, document.id),
    initial: { document, storedRevision: 'r1' },
  });
  const epoch = crypto.randomUUID();
  const cursor = documentCursor(document, bridge.getSnapshot().revision, epoch);
  const parsed = validateAgentStart({ document, cursor, prompt: 'Build a heading', history: [] });
  if (!parsed.ok) throw new Error(parsed.message);
  const input = JSON.stringify({
    request: parsed.value.prompt,
    untrusted_history: [],
    untrusted_screen: agentContext(document, cursor),
  });
  return { bridge, epoch, start: parsed.value, input };
}
describe('Studio composes existing real pinned Mastra executor (offline model; not live provider acceptance)', () => {
  it('runs governed read and edit tools; acknowledges only after EditorBridge commit; streams completion', async () => {
    const { bridge, epoch, start, input } = context();
    const events: StudioAgentEvent[] = [];
    let runId = '';
    let observedResult: unknown;
    const model = createDeterministicOfflineModel({
      script: {
        [input]: {
          kind: 'tool-chain',
          calls: [
            { toolName: 'studio_screen_read', args: {} },
            {
              toolName: 'studio_screen_edit',
              args: {
                expectedRevision: start.cursor.revision,
                reason: 'Add a heading',
                operations: [
                  {
                    op: 'add',
                    recipe: 'heading',
                    nodeId: 'title',
                    parentId: 'screen',
                    text: 'Registration',
                  },
                ],
              },
            },
          ],
          thenText: 'Your heading is on the canvas.',
        },
      },
      onToolResult: (event) => {
        if (event.toolName === 'studio_screen_edit') {
          observedResult = event.output;
          expect(bridge.document.nodes.title).toBeDefined();
        }
      },
    });
    const opened = openAgentRun(
      'test-owner',
      start,
      (event) => {
        events.push(event);
        if (event.type === 'started') runId = event.runId;
        if (event.type === 'proposal') {
          expect(
            acknowledgeAgentEdit('another-owner', runId, event.proposal.proposalId, {
              ok: false,
              code: 'STUDIO_AGENT_CANCELLED',
              message: 'Spoof',
            }),
          ).toBe(false);
          const receipt = applyAgentProposal(bridge, event.proposal, epoch, false);
          expect(receipt.ok).toBe(true);
          expect(
            acknowledgeAgentEdit('test-owner', runId, event.proposal.proposalId, receipt),
          ).toBe(true);
          expect(
            acknowledgeAgentEdit('test-owner', runId, event.proposal.proposalId, receipt),
          ).toBe(false);
        }
      },
      { modelFactory: () => model, model: OFFLINE_MODEL_IDENTITY },
    );
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    await opened.finished;
    expect(events.at(-1)).toMatchObject({ type: 'done', status: 'completed', applied: 1 });
    expect(observedResult).toBeDefined();
    expect(
      events
        .filter((event) => event.type === 'text')
        .map((event) => (event.type === 'text' ? event.delta : ''))
        .join(''),
    ).toContain('Your heading');
    expect(bridge.undo().ok).toBe(true);
    expect(bridge.document.nodes.title).toBeUndefined();
  }, 120_000);
  it('sanitizes a genuine Mastra model failure after an acknowledged edit and preserves Undo', async () => {
    const { bridge, epoch, start, input } = context();
    const events: StudioAgentEvent[] = [];
    let runId = '';
    let calls = 0;
    const model = createDeterministicOfflineModel({
      script: {
        [input]: {
          kind: 'tool-call',
          toolName: 'studio_screen_edit',
          args: {
            expectedRevision: start.cursor.revision,
            reason: 'Add a heading',
            operations: [{ op: 'add', recipe: 'heading', nodeId: 'title', parentId: 'screen' }],
          },
          thenText: 'Done',
        },
      },
    });
    const original = model.doStream.bind(model);
    model.doStream = async (options) => {
      calls++;
      if (calls > 1) throw new Error('SECRET_PROVIDER_CANARY_NEVER_RETURN');
      return original(options);
    };
    const opened = openAgentRun(
      'failure-owner',
      start,
      (event) => {
        events.push(event);
        if (event.type === 'started') runId = event.runId;
        if (event.type === 'proposal')
          acknowledgeAgentEdit(
            'failure-owner',
            runId,
            event.proposal.proposalId,
            applyAgentProposal(bridge, event.proposal, epoch, false),
          );
      },
      { modelFactory: () => model, model: OFFLINE_MODEL_IDENTITY },
    );
    if (!opened.ok) throw new Error(opened.code);
    await opened.finished;
    expect(events.at(-1)).toMatchObject({ type: 'done', status: 'failed', applied: 1 });
    expect(JSON.stringify(events)).not.toContain('SECRET_PROVIDER_CANARY');
    expect(bridge.document.nodes.title).toBeDefined();
    expect(bridge.undo().ok).toBe(true);
    expect(bridge.document.nodes.title).toBeUndefined();
  }, 120_000);
  it('cancels a proposal before acknowledgement with zero edits and no cross-session cancellation', async () => {
    const { bridge, start, input } = context();
    let runId = '';
    let replacement: ReturnType<typeof openAgentRun> | undefined;
    const events: StudioAgentEvent[] = [];
    const model = createDeterministicOfflineModel({
      script: {
        [input]: {
          kind: 'tool-call',
          toolName: 'studio_screen_edit',
          args: {
            expectedRevision: start.cursor.revision,
            reason: 'Add a heading',
            operations: [{ op: 'add', recipe: 'heading', nodeId: 'title', parentId: 'screen' }],
          },
          thenText: 'Stopped',
        },
      },
    });
    const opened = openAgentRun(
      'cancel-owner',
      start,
      (event) => {
        events.push(event);
        if (event.type === 'started') runId = event.runId;
        if (event.type === 'proposal') {
          expect(cancelAgentRun('other-owner', runId)).toBe(false);
          expect(cancelAgentRun('cancel-owner', runId)).toBe(true);
          replacement = openAgentRun('cancel-owner', start, () => {}, {
            modelFactory: () =>
              createDeterministicOfflineModel({
                script: { [input]: { kind: 'text', text: 'Replacement ready.' } },
              }),
            model: OFFLINE_MODEL_IDENTITY,
          });
        }
      },
      { modelFactory: () => model, model: OFFLINE_MODEL_IDENTITY },
    );
    if (!opened.ok) throw new Error(opened.code);
    await opened.finished;
    expect(events.at(-1)).toMatchObject({ type: 'done', status: 'cancelled', applied: 0 });
    expect(bridge.document.nodes.title).toBeUndefined();
    expect(bridge.getSnapshot().canUndo).toBe(false);
    expect(replacement?.ok).toBe(true);
    if (replacement?.ok) await replacement.finished;
  }, 120_000);
  it('admits the next turn at terminal delivery while private cleanup is still pending', async () => {
    const { start, input } = context();
    let replacement: ReturnType<typeof openAgentRun> | undefined;
    const options = {
      modelFactory: () =>
        createDeterministicOfflineModel({
          script: { [input]: { kind: 'text' as const, text: 'Done.' } },
        }),
      model: OFFLINE_MODEL_IDENTITY,
    };
    const opened = openAgentRun(
      'terminal-owner',
      start,
      (event) => {
        if (event.type === 'done')
          replacement = openAgentRun('terminal-owner', start, () => {}, options);
      },
      options,
    );
    expect(opened.ok).toBe(true);
    expect(openAgentRun('terminal-owner', start, () => {}, options)).toMatchObject({
      ok: false,
      code: 'STUDIO_AGENT_BUSY',
    });
    if (opened.ok) await opened.finished;
    expect(replacement?.ok).toBe(true);
    if (replacement?.ok) await replacement.finished;
  }, 120_000);
});
