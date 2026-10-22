import { describe, it, expect } from 'vitest';
import { createDeterministicOfflineModel, OFFLINE_MODEL_IDENTITY } from '@victframework/mastra';
import { EditorBridge, insertSubtree } from '@victframework/ui-editor';
import { screenRecipes } from '../src/lib/designer/recipes.js';
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

function context(existing = false) {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  let document = newScreen('Live loop fixture', 'loop-test');
  const bridge = new EditorBridge({
    catalogs: designerCatalogs,
    store: screenStore(storage, document.id),
    initial: { document, storedRevision: 'r1' },
  });
  if (existing) {
    expect(
      bridge.apply(
        insertSubtree(
          'seed-existing-heading',
          screenRecipes.find((recipe) => recipe.id === 'heading')!.create('placeholder'),
          { nodeId: 'screen' },
        ),
      ).ok,
    ).toBe(true);
    expect(bridge.save().ok).toBe(true);
    expect(bridge.save().ok).toBe(true);
    expect(bridge.reopen().ok).toBe(true);
    document = bridge.document;
  }
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
  it('recovers a wrong source-version argument on an existing saved screen in the same governed turn', async () => {
    const { bridge, epoch, start, input } = context(true);
    const before = bridge.document;
    const results: string[] = [];
    const events: StudioAgentEvent[] = [];
    let runId = '';
    const model = createDeterministicOfflineModel({
      script: {
        [input]: {
          kind: 'tool-chain',
          calls: [
            { toolName: 'studio_screen_read', args: {} },
            {
              toolName: 'studio_screen_edit',
              args: {
                expectedRevision: start.document.revision,
                reason: 'Remove placeholder',
                operations: [{ op: 'remove', nodeId: 'placeholder' }],
              },
            },
            { toolName: 'studio_screen_read', args: {} },
            {
              toolName: 'studio_screen_edit',
              args: {
                expectedRevision: start.cursor.revision,
                reason: 'Build a Quellight hero on the open screen',
                operations: [
                  { op: 'remove', nodeId: 'placeholder' },
                  {
                    op: 'add',
                    recipe: 'heading',
                    nodeId: 'quellight',
                    parentId: 'screen',
                    text: 'Quellight — your AI workspace',
                  },
                ],
              },
            },
          ],
          thenText: 'Quellight is on the existing canvas.',
        },
      },
      onToolResult: (event) => {
        results.push(JSON.stringify(event.output));
      },
    });
    const opened = openAgentRun(
      'existing-screen-revision-owner',
      start,
      (event) => {
        events.push(event);
        if (event.type === 'started') runId = event.runId;
        if (event.type === 'proposal')
          acknowledgeAgentEdit(
            'existing-screen-revision-owner',
            runId,
            event.proposal.proposalId,
            applyAgentProposal(bridge, event.proposal, epoch, false),
          );
      },
      { modelFactory: () => model, model: OFFLINE_MODEL_IDENTITY },
    );
    if (!opened.ok) throw new Error(opened.code);
    await opened.finished;
    expect(events.filter((event) => event.type === 'proposal')).toHaveLength(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'edit-result',
        result: expect.objectContaining({ code: 'STUDIO_AGENT_REVISION_MISMATCH' }),
      }),
    );
    expect(events.at(-1)).toMatchObject({ type: 'done', status: 'completed', applied: 1 });
    expect(results.join('\n')).toContain('expectedRevision');
    expect(results.join('\n')).not.toContain('UI_DOC_STALE_REVISION');
    expect(bridge.document.nodes.placeholder).toBeUndefined();
    expect(bridge.document.nodes.quellight).toBeDefined();
    expect(bridge.undo().ok).toBe(true);
    expect(bridge.document).toEqual(before);
  }, 120_000);

  it('keeps a genuine browser revision refusal fenced even after a model re-read and retry', async () => {
    const { bridge, epoch, start, input } = context(true);
    const events: StudioAgentEvent[] = [];
    let runId = '';
    const args = {
      expectedRevision: start.cursor.revision,
      reason: 'Remove placeholder',
      operations: [{ op: 'remove', nodeId: 'placeholder' }],
    };
    const model = createDeterministicOfflineModel({
      script: {
        [input]: {
          kind: 'tool-chain',
          calls: [
            { toolName: 'studio_screen_read', args: {} },
            { toolName: 'studio_screen_edit', args },
            { toolName: 'studio_screen_read', args: {} },
            { toolName: 'studio_screen_edit', args },
          ],
          thenText: 'Stopped after the screen changed.',
        },
      },
    });
    const opened = openAgentRun(
      'real-stale-revision-owner',
      start,
      (event) => {
        events.push(event);
        if (event.type === 'started') runId = event.runId;
        if (event.type === 'proposal') {
          expect(
            bridge.apply({
              requestId: 'manual-intervention',
              commands: [
                {
                  op: 'setAttribute',
                  nodeId: 'screen',
                  name: 'aria-label',
                  value: 'Manual change',
                },
              ],
            }).ok,
          ).toBe(true);
          const receipt = applyAgentProposal(bridge, event.proposal, epoch, false);
          expect(receipt).toMatchObject({ ok: false, code: 'UI_DOC_STALE_REVISION' });
          acknowledgeAgentEdit(
            'real-stale-revision-owner',
            runId,
            event.proposal.proposalId,
            receipt,
          );
        }
      },
      { modelFactory: () => model, model: OFFLINE_MODEL_IDENTITY },
    );
    if (!opened.ok) throw new Error(opened.code);
    await opened.finished;
    expect(events.filter((event) => event.type === 'proposal')).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: 'done', applied: 0 });
    expect(bridge.document.nodes.placeholder).toBeDefined();
    expect(bridge.document.nodes.screen).toMatchObject({
      attributes: { 'aria-label': 'Manual change' },
    });
  }, 120_000);
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
