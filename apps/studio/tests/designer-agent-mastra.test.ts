import { describe, it, expect } from 'vitest';
import { createDeterministicOfflineModel, OFFLINE_MODEL_IDENTITY, capturePresentationSchema } from '@victframework/mastra';
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
  editPresentation,
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
  it('fits the frozen provider presentation bounds without dropping expanded recipes', () => {
    expect(() => capturePresentationSchema(editPresentation, 'expanded Studio edit')).not.toThrow();
    const pattern = new RegExp(editPresentation.properties.operations.items.properties.recipe.pattern);
    for (const recipe of screenRecipes) expect(pattern.test(recipe.id), recipe.id).toBe(true);
    expect(pattern.test('unregistered')).toBe(false);
    expect(pattern.test('dropdown-menuXitem')).toBe(false);
  });
  it('does not mistake a successfully invoked but refused edit for recovery', async () => {
    const { bridge, start, input } = context();
    const events: StudioAgentEvent[] = [];
    const model = createDeterministicOfflineModel({
      script: {
        [input]: {
          kind: 'tool-chain',
          calls: [
            { toolName: 'studio_screen_edit', args: { operations: [] } },
            {
              toolName: 'studio_screen_edit',
              args: {
                expectedRevision: 'wrong-token',
                reason: 'Wrong argument',
                operations: [{ op: 'remove', nodeId: 'missing' }],
              },
            },
            { toolName: 'studio_screen_read', args: {} },
          ],
          thenText: 'Done.',
        },
      },
    });
    const opened = openAgentRun('false-recovery', start, (event) => events.push(event), {
      modelFactory: () => model,
      model: OFFLINE_MODEL_IDENTITY,
    });
    if (!opened.ok) throw new Error(opened.code);
    await opened.finished;
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      status: 'failed',
      code: 'STUDIO_AGENT_REVISION_MISMATCH',
      applied: 0,
    });
    expect(bridge.getSnapshot().canUndo).toBe(false);
  }, 120_000);
  it('gives GLM its full published output allowance without a thinking override (offline seam)', async () => {
    const { start, input } = context();
    const events: StudioAgentEvent[] = [];
    let settings: unknown;
    const model = createDeterministicOfflineModel({
      script: { [input]: { kind: 'text', text: 'Ready.' } },
    });
    const original = model.doStream.bind(model);
    model.doStream = async (options) => {
      settings = options;
      return original(options);
    };
    const opened = openAgentRun('glm-budget-policy', start, (event) => events.push(event), {
      modelFactory: () => model,
      model: 'zai/glm-5.3-flash',
    });
    if (!opened.ok) throw new Error(opened.code);
    await opened.finished;
    expect(settings).toMatchObject({ maxOutputTokens: 131_072 });
    expect(
      JSON.stringify((settings as { providerOptions?: unknown }).providerOptions ?? {}),
    ).not.toMatch(/reasoningEffort|reasoning_effort|thinking/);
    expect(events.at(-1)).toMatchObject({ type: 'done', status: 'completed', applied: 0 });
  }, 120_000);
  it.each([false, true])(
    'reports an unrecovered tool failure truthfully, with prior effects=%s',
    async (applyFirst) => {
      const { bridge, epoch, start, input } = context();
      const events: StudioAgentEvent[] = [];
      let runId = '';
      const model = createDeterministicOfflineModel({
        script: {
          [input]: {
            kind: 'tool-chain',
            calls: [
              ...(applyFirst
                ? [
                    {
                      toolName: 'studio_screen_edit',
                      args: {
                        expectedRevision: start.cursor.revision,
                        reason: 'Add title',
                        operations: [
                          {
                            op: 'add',
                            recipe: 'heading',
                            nodeId: 'title',
                            parentId: 'screen',
                            text: 'Quellight',
                          },
                        ],
                      },
                    },
                  ]
                : []),
              { toolName: 'studio_screen_edit', args: { operations: [] } },
              { toolName: 'studio_screen_read', args: {} },
            ],
            thenText: 'Finished.',
          },
        },
      });
      const opened = openAgentRun(
        `tool-failure-${applyFirst}`,
        start,
        (event) => {
          events.push(event);
          if (event.type === 'started') runId = event.runId;
          if (event.type === 'proposal')
            acknowledgeAgentEdit(
              `tool-failure-${applyFirst}`,
              runId,
              event.proposal.proposalId,
              applyAgentProposal(bridge, event.proposal, epoch, false),
            );
        },
        { modelFactory: () => model, model: OFFLINE_MODEL_IDENTITY },
      );
      if (!opened.ok) throw new Error(opened.code);
      await opened.finished;
      expect(events.at(-1)).toMatchObject({
        type: 'done',
        status: 'failed',
        code: 'STUDIO_AGENT_TOOL_FAILED',
        applied: applyFirst ? 1 : 0,
      });
      expect(bridge.getSnapshot().canUndo).toBe(applyFirst);
      if (applyFirst) {
        expect(bridge.undo().ok).toBe(true);
        expect(bridge.document.nodes.title).toBeUndefined();
      }
    },
    120_000,
  );

  it.each(['length', 'partial'])(
    'contains %s provider output with zero proposals and truthful terminal code',
    async (kind) => {
      const { bridge, start, input } = context();
      const events: StudioAgentEvent[] = [];
      const model = createDeterministicOfflineModel({
        script: { [input]: { kind: 'text', text: 'Working.' } },
      });
      const original = model.doStream.bind(model);
      model.doStream = async (options) => {
        const result = await original(options);
        return {
          ...result,
          stream: result.stream.pipeThrough(
            new TransformStream({
              transform(part, controller) {
                if (part.type === 'finish') {
                  if (kind === 'partial')
                    controller.enqueue({
                      type: 'tool-call',
                      toolCallId: 'cut-off',
                      toolName: 'studio_screen_edit',
                      input: '{"operations":[',
                    });
                  controller.enqueue({ ...part, finishReason: 'length' } as never);
                } else controller.enqueue(part);
              },
            }),
          ),
        };
      };
      const opened = openAgentRun(`incomplete-${kind}`, start, (event) => events.push(event), {
        modelFactory: () => model,
        model: OFFLINE_MODEL_IDENTITY,
      });
      if (!opened.ok) throw new Error(opened.code);
      await opened.finished;
      expect(events.at(-1)).toMatchObject({
        type: 'done',
        status: 'failed',
        code: kind === 'length' ? 'STUDIO_AGENT_OUTPUT_LIMIT' : 'STUDIO_AGENT_INCOMPLETE_TOOL',
        applied: 0,
      });
      expect(events.some((event) => event.type === 'proposal')).toBe(false);
      expect(bridge.getSnapshot().canUndo).toBe(false);
    },
    120_000,
  );

  it('allows a successful ordinary answer without edits', async () => {
    const { start, input } = context();
    const events: StudioAgentEvent[] = [];
    const opened = openAgentRun('ordinary-answer', start, (event) => events.push(event), {
      modelFactory: () =>
        createDeterministicOfflineModel({
          script: { [input]: { kind: 'text', text: 'Select a field to edit it.' } },
        }),
      model: OFFLINE_MODEL_IDENTITY,
    });
    if (!opened.ok) throw new Error(opened.code);
    await opened.finished;
    expect(events.at(-1)).toMatchObject({ type: 'done', status: 'completed', applied: 0 });
  }, 120_000);
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

it('reports a host deadline separately from explicit Stop without waiting for production wall time (offline deadline seam)',async()=>{
 const {start,input}=context();const events:StudioAgentEvent[]=[];
 const model=createDeterministicOfflineModel({script:{[input]:{kind:'text',text:'Would complete if not expired.'}}});
 const opened=openAgentRun('deadline-fixture',start,event=>events.push(event),{modelFactory:()=>model,model:OFFLINE_MODEL_IDENTITY,deadlineMs:1});
 if(!opened.ok)throw Error(opened.code);await opened.finished;
 expect(events.at(-1)).toMatchObject({type:'done',status:'failed',code:'STUDIO_AGENT_TIME_LIMIT',termination:{status:'timeout',code:'STUDIO_AGENT_TIME_LIMIT'},applied:0,confirmedRevision:start.cursor.revision});
},120000);

it('labels agent-declared subset coverage separately from the complete catalog inventory (offline fixture)',async()=>{
 const {bridge,epoch,start,input}=context();const events:StudioAgentEvent[]=[];let runId='';
 const model=createDeterministicOfflineModel({script:{[input]:{kind:'tool-chain',calls:[{toolName:'studio_screen_edit',args:{expectedRevision:start.cursor.revision,reason:'Native input',operations:[{op:'add',recipe:'input',nodeId:'field',parentId:'screen'}]}},{toolName:'studio_screen_read',args:{section:'coverage',requested:['input']}}],thenText:'One input exists; complete inventory is not demonstrated.'}}});
 const opened=openAgentRun('subset-manifest',start,event=>{events.push(event);if(event.type==='started')runId=event.runId;if(event.type==='proposal')acknowledgeAgentEdit('subset-manifest',runId,event.proposal.proposalId,applyAgentProposal(bridge,event.proposal,epoch,false));},{modelFactory:()=>model,model:OFFLINE_MODEL_IDENTITY});
 if(!opened.ok)throw Error(opened.code);await opened.finished;
 expect(events.at(-1)).toMatchObject({type:'done',status:'completed',coverage:{scope:'agent-declared-manifest',requested:1,authored:1,missing:[]}});
 const done=events.at(-1);expect(done?.type==='done'&&done.coverage!.authored<done.coverage!.available).toBe(true);
 expect(done).toMatchObject({metrics:{toolCalls:2,completedCalls:2,refusedCalls:0,modelSteps:null,cost:null},sourceEvidence:{confirmedEdits:1,appearanceObserved:false,interactionsVerified:false}});
 if(done?.type!=='done')throw Error('Missing terminal receipt');
 expect(done.metrics!.providerRequests).toBeGreaterThan(0);expect(done.metrics!.usage!.totalTokens).toBeGreaterThan(0);
 const proposal=events.find(event=>event.type==='proposal');expect(proposal?.type==='proposal'&&proposal.callId).toBeTruthy();
 const commit=events.find(event=>event.type==='tool-event'&&event.kind==='committed');expect(commit?.type==='tool-event'&&commit.details).toContain('coverage');
},120000);

it('makes bounded precise pre-invocation refusal guidance available to the model on the next overview read',async()=>{
 const {start,input}=context();const events:StudioAgentEvent[]=[];
 const model=createDeterministicOfflineModel({script:{[input]:{kind:'tool-chain',calls:[{toolName:'studio_screen_edit',args:{expectedRevision:start.cursor.revision,reason:'Malformed expression probe',operations:[{op:'bind',nodeId:'control',prop:'checked',expression:true}]}},{toolName:'studio_screen_read',args:{}}],thenText:'The malformed expression was refused; no edit was applied.'}}});
 const opened=openAgentRun('precise-refusal-read',start,event=>events.push(event),{modelFactory:()=>model,model:OFFLINE_MODEL_IDENTITY});if(!opened.ok)throw Error(opened.code);await opened.finished;
 const observation=events.find(event=>event.type==='tool-event'&&event.kind==='observation'&&event.tool==='studio_screen_read');expect(observation?.type).toBe('tool-event');if(observation?.type!=='tool-event')throw Error('No read');expect(observation.callId).toBeTruthy();
 // The model receives the full bounded overview; the owner trace explicitly marks any display clipping.
 const all=JSON.stringify(events);expect(all).toContain('literal');expect(all).toContain('ref');expect(all).toContain('operations.0.expression');
 const refused=events.find(event=>event.type==='tool-event'&&event.kind==='validation-refused');expect(refused?.type==='tool-event'&&refused.details).toContain('Expected exactly');
},120000);

it('delivers an actual canonical style-reference cause to the model and subsequent overview without proposing an edit (offline)',async()=>{
 const {bridge,start,input}=context();const before=bridge.getSnapshot();const events:StudioAgentEvent[]=[];const prompts:unknown[]=[];
 const offline=createDeterministicOfflineModel({script:{[input]:{kind:'tool-chain',calls:[
  {toolName:'studio_screen_edit',args:{expectedRevision:start.cursor.revision,reason:'Missing state reference probe',operations:[{op:'style',nodeId:'screen',property:'color',value:{type:'binding',expression:{type:'ref',path:'state.__probeMissing'}}}]}},
  {toolName:'studio_screen_read',args:{}},
 ],thenText:'The source was refused; no edit was applied.'}}});
 const opened=openAgentRun('canonical-style-cause',start,event=>events.push(event),{model:OFFLINE_MODEL_IDENTITY,modelFactory:()=>({...offline,doStream:async(options:Parameters<typeof offline.doStream>[0])=>{prompts.push(options.prompt);return offline.doStream(options);}})});
 if(!opened.ok)throw Error(opened.code);await opened.finished;
 expect(events.some(event=>event.type==='proposal')).toBe(false);expect(bridge.getSnapshot()).toEqual(before);
 const refusal=events.find(event=>event.type==='edit-result');
 expect(refusal).toMatchObject({type:'edit-result',result:{ok:false,code:'STUDIO_AGENT_VALIDATION',diagnostics:[{code:'UI_EXPR_UNKNOWN_REFERENCE',envelopeCode:'UI_EDIT_VALIDATION_FAILED',operation:0,commandIndex:0,nodeId:'screen',sourcePath:'nodes.screen',property:'color',path:'state.__probeMissing'}]}});
 const overview=events.find(event=>event.type==='tool-event'&&event.kind==='observation'&&event.tool==='studio_screen_read');
 expect(overview?.type).toBe('tool-event');
 // Owner trace is intentionally clipped. Inspect the real model result rather
 // than requiring a larger trace budget for the later lastValidation field.
 const deliveredValidations:unknown[]=[];
 function visit(value:unknown,depth=0):void{
  if(depth>14)return;
  if(typeof value==='string'&&/^(?:\{|\[)/.test(value)){try{visit(JSON.parse(value),depth+1);}catch{}return;}
  if(Array.isArray(value)){value.forEach(item=>visit(item,depth+1));return;}
  if(value&&typeof value==='object'){if('lastValidation' in value)deliveredValidations.push(value.lastValidation);Object.values(value).forEach(item=>visit(item,depth+1));}
 }
 visit(prompts);
 expect(deliveredValidations).toContainEqual(expect.objectContaining({ok:false,code:'STUDIO_AGENT_VALIDATION',diagnostics:[expect.objectContaining({code:'UI_EXPR_UNKNOWN_REFERENCE',nodeId:'screen',sourcePath:'nodes.screen',property:'color',path:'state.__probeMissing'})]}));
 expect(events.at(-1)).toMatchObject({type:'done',status:'failed',code:'STUDIO_AGENT_VALIDATION',applied:0});
});

it('delivers capture-comparison scope, complete-body digest reuse and Studio host rules to the actual pinned executor model prompt (offline)',async()=>{
 const {start,input}=context();const events:StudioAgentEvent[]=[];const prompts:unknown[]=[];
 const offline=createDeterministicOfflineModel({script:{[input]:{kind:'text',text:'No edit or visual completion claimed.'}}});
 const opened=openAgentRun('observation-scope-contract',start,event=>events.push(event),{model:OFFLINE_MODEL_IDENTITY,modelFactory:()=>({...offline,doStream:async(options:Parameters<typeof offline.doStream>[0])=>{prompts.push(options.prompt);return offline.doStream(options);}})});
 if(!opened.ok)throw Error(opened.code);await opened.finished;
 expect(events.at(-1)).toMatchObject({type:'done',status:'completed',applied:0});
 const delivered=JSON.stringify(prompts);
 expect(delivered).toContain('WITHIN ONE observation, before and after inference');
 expect(delivered).toContain('identical image bytes with a different source revision or preview fingerprint do NOT prove a stale raster');
 expect(delivered).toContain('Only an actual STUDIO_CAPTURE_STALE tool refusal invokes');
 expect(delivered).toContain('complete contract body was previously received (all body pages) and remains available in your context');
 expect(delivered).toContain('A catalog/index digest alone is not cached contract knowledge');
 expect(delivered).toContain('ancestor inline-size container named studio-screen');
 expect(delivered).toContain('canonical root has no container declaration');
 expect(delivered).toContain('Media conditions use the outer browser viewport and do not follow preview presets');
 expect(delivered).toContain('other consumers must explicitly establish a compatible host');
 expect(delivered).toContain('never replay committed edits to retry verification');
});
