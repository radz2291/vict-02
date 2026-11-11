import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { AgentTurnService } from '@victframework/control';
import { commitDraftEdit, createDraftAuthoring } from '@victframework/control/draft-authoring';
import {
  MASTRA_ADAPTER_COMPATIBILITY,
  buildCapabilityTools,
  runWithBridgeTurnScope,
  sanitizeCapabilityToolName,
} from '@victframework/mastra';
import {
  AgentProfileRegistry,
  authenticatedActorContext,
  createInMemoryAgentControlStores,
  gateCapabilityInvoke,
} from '@victframework/runtime';
import { GraphSessionV3 } from '@victframework/ui-flow-svelte/model';

const target = { draftId: 'open-research-draft-1', occurrenceId: 'research.instructions' };
const initialText = 'Summarize the findings.';
const agentText = 'Include a source link for every finding.';
const manualText = 'Only use peer-reviewed sources.';
const request = { ...target, expectedRevision: 7, edit: agentText };
const testOptions = { timeout: 10_000 };

function setInstructions(value) {
  return [{ type: 'setParameter', nodeId: 'research', key: 'instructions', value }];
}

function jsonContract(id, descriptiveJsonSchema, accepts) {
  return {
    id,
    revision: '1',
    expected: 'synthetic authoring data',
    descriptiveJsonSchema,
    parse: (value) =>
      accepts(value)
        ? { ok: true, value }
        : { ok: false, issues: [{ code: 'INVALID', path: 'input', message: 'Invalid data.' }] },
  };
}

function activate(capabilities) {
  const refs = capabilities.map(({ id, revision }) => ({ id, revision }));
  const registry = new AgentProfileRegistry({
    resolveCapabilityRevision: (id, revision) =>
      refs.some((entry) => entry.id === id && entry.revision === revision),
  });
  registry.installArtifacts([
    { kind: 'instructions', id: 'authoring.instructions', revision: '1', text: 'Edit the draft.' },
    {
      kind: 'memory-policy',
      id: 'authoring.memory',
      revision: '1',
      config: { lastMessages: false, workingMemory: { enabled: false }, semanticRecall: false },
    },
  ]);
  registry.registerProfile({
    schema: 'vict.agent-profile@1',
    id: 'agent.authoring',
    revision: '1',
    instructions: { id: 'authoring.instructions', revision: '1' },
    modelProfile: {
      id: 'model.authoring',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: {},
    turnPolicy: { maxSteps: 4, maxToolCalls: 2, onLimit: 'fail-closed' },
    memoryPolicy: { id: 'authoring.memory', revision: '1' },
    guardrails: [],
    helperTools: [],
    capabilities: refs,
    adapter: {
      id: MASTRA_ADAPTER_COMPATIBILITY.id,
      revision: MASTRA_ADAPTER_COMPATIBILITY.revision,
      runtimePackages: { ...MASTRA_ADAPTER_COMPATIBILITY.runtimePackages },
    },
  });
  return registry.activateAgentProfile({ id: 'agent.authoring', revision: '1' });
}

async function harness({ beforeCommit, afterCommit, authorizeEdit = true } = {}) {
  const graph = new GraphSessionV3(
    {
      schema: 'vict.flow-graph@3',
      revision: 7,
      nodeTypes: [
        {
          id: 'agent',
          label: 'Agent',
          parameters: { instructions: { type: 'string', default: initialText } },
          ports: [],
        },
      ],
      nodes: [
        { id: 'research', type: 'agent', label: 'Research', position: { x: 0, y: 0 }, values: {} },
      ],
      edges: [],
    },
    {
      validate: (next) =>
        next.nodes[0].values.instructions === ''
          ? [{ code: 'GRAPH_DOMAIN_VALIDATION', path: 'instructions', message: 'Supply text.' }]
          : [],
    },
  );
  const stores = createInMemoryAgentControlStores();
  const owner = { actorId: 'draft-owner', roles: ['developer'], status: 'active', createdAt: 1 };
  await stores.actors.upsert(owner);
  const actor = authenticatedActorContext(await stores.actors.get(owner.actorId), owner.actorId);
  const receipts = new Map();
  const keyOf = ({ actorId, turnId, operationId }) =>
    JSON.stringify([actorId, turnId, operationId]);
  const counters = { deliveries: 0, journalApplies: 0 };
  let pinnedTurnId;
  let draftOpen = true;
  let proposedRequest;
  let invocation;
  let result;
  let discovery;

  const journal = {
    resolveDraft: ({ actorId, turnId }) =>
      draftOpen && actorId === actor.actorId && turnId === pinnedTurnId
        ? { ...target, revision: graph.graph.revision }
        : undefined,
    readReceipt: (key) => receipts.get(keyOf(key)),
    apply(proposal) {
      counters.journalApplies += 1;
      const applied = graph.apply(setInstructions(proposal.edit), proposal.expectedRevision);
      return applied.ok
        ? { status: 'applied', revision: applied.graph.revision }
        : { status: 'invalid' };
    },
    recordReceipt: (receipt) => receipts.set(keyOf(receipt), receipt),
  };
  const host = {
    resolveDraft: journal.resolveDraft,
    readReceipt: journal.readReceipt,
    async commit(proposal, signal) {
      counters.deliveries += 1;
      await beforeCommit?.();
      // One synchronous owner section serializes manual edits, abort, apply and receipt.
      commitDraftEdit(proposal, signal, journal);
      await afterCommit?.(host);
    },
  };
  const authoring = createDraftAuthoring(host);

  const emptyInput = jsonContract(
    'draft.discover.input',
    { type: 'object', additionalProperties: false },
    (value) => typeof value === 'object' && value !== null && Object.keys(value).length === 0,
  );
  const editInput = jsonContract(
    'draft.edit.input',
    {
      type: 'object',
      properties: {
        draftId: { type: 'string' },
        occurrenceId: { type: 'string' },
        expectedRevision: { type: 'integer' },
        edit: { type: 'string' },
      },
      required: ['draftId', 'occurrenceId', 'expectedRevision', 'edit'],
      additionalProperties: false,
    },
    (value) =>
      typeof value === 'object' &&
      value !== null &&
      Object.keys(value).length === 4 &&
      typeof value.draftId === 'string' &&
      typeof value.occurrenceId === 'string' &&
      Number.isSafeInteger(value.expectedRevision) &&
      typeof value.edit === 'string',
  );
  const output = jsonContract(
    'draft.output',
    { type: 'object' },
    (value) => typeof value === 'object' && value !== null,
  );
  const discover = {
    id: 'cap.draft.discover',
    revision: '1',
    effect: 'read',
    input: emptyInput,
    output,
    invoke: async (_input, context) =>
      (await authoring.discover({ actorId: context.victActorId, turnId: context.victTurnId })) ?? {
        status: 'denied',
      },
  };
  const edit = {
    id: 'cap.draft.edit',
    revision: '1',
    effect: 'write',
    permissions: ['draft.instructions.edit'],
    input: editInput,
    output,
    invoke: async (input, context) => {
      invocation = {
        actorId: context.victActorId,
        turnId: context.victTurnId,
        operationId: context.victIdempotencyKey,
        signal: context.signal,
      };
      return authoring.apply(invocation, input);
    },
  };
  const capabilities = [discover, edit];
  const activation = activate(capabilities);
  const grants = authorizeEdit ? edit.permissions : [];
  const handlers = new Map(
    capabilities.map((capability) => [capability, gateCapabilityInvoke(capability, { grants })]),
  );
  const toolName = (capability) => sanitizeCapabilityToolName(capability.id);
  const turnService = new AgentTurnService({
    stores,
    ids: {
      turnId: randomUUID,
      streamId: randomUUID,
      invocationId: randomUUID,
      cancelId: randomUUID,
    },
    executor: {
      agentProfileVersion: activation.agentProfileVersion,
      executeTurn: (turn, handle) =>
        runWithBridgeTurnScope(
          {
            ...turn,
            agentProfileVersion: activation.agentProfileVersion,
            abortSignal: handle.abortSignal,
          },
          async () => {
            pinnedTurnId = turn.turnId;
            discovery = await tools[toolName(discover)].execute({}, { toolCallId: 'discover' });
            result = await tools[toolName(edit)].execute(proposedRequest, { toolCallId: 'edit' });
            return { status: handle.abortSignal.aborted ? 'cancelled' : 'completed' };
          },
        ),
    },
  });
  const tools = buildCapabilityTools(activation, {
    resolveCapability: (id, revision) =>
      capabilities.find((item) => item.id === id && item.revision === revision),
    invoke: (definition, input, context) => handlers.get(definition)(input, context),
    recordInvocationIntent: (input) => turnService.recordToolInvocationIntent(input),
    claimInvocationRun: (input) => stores.invocations.claimInvocationRun(input),
    settleInvocationRun: (input) => stores.invocations.settleInvocationRun(input),
    settleInvocationPending: (input) => stores.invocations.settleInvocationPending(input),
    reconcileAbandonedRun: (input) => stores.invocations.reconcileAbandonedRun(input),
    updateInvocationStatus: (input) => stores.invocations.updateInvocationStatus(input),
    // Exact synthetic write grant through the existing host policy.
    quietWriteApprovals: {
      policyIdentity: 'fixture-authoring',
      entries: [{ capabilityId: edit.id, capabilityRevision: edit.revision }],
    },
  });

  return {
    graph,
    counters,
    stores,
    receipts,
    authoring,
    host,
    closeDraft: () => (draftOpen = false),
    start: (input = request) => {
      proposedRequest = input;
      return turnService.startTurn(actor, { threadId: 'authoring-session', input: 'Edit draft.' });
    },
    stop: (turnId) => turnService.cancelTurn(actor, { turnId }),
    get discovery() {
      return discovery;
    },
    get invocation() {
      return invocation;
    },
    get result() {
      return result;
    },
  };
}

function expectReceipt(h, turnId, status) {
  const { result } = h;
  assert.equal(result?.status, 'confirmed', JSON.stringify(result));
  const { receipt } = result;
  assert.equal(receipt.status, status);
  assert.equal(receipt.actorId, 'draft-owner');
  assert.equal(receipt.turnId, turnId);
  assert.equal(receipt.operationId, h.invocation.operationId);
  assert.equal(receipt.draftId, target.draftId);
  assert.equal(receipt.occurrenceId, target.occurrenceId);
  assert.equal(receipt.expectedRevision, 7);
  assert.match(receipt.editDigest, /^[a-f0-9]{64}$/);
  assert.equal(Object.hasOwn(receipt, 'edit'), false);
  return receipt;
}

test(
  'a governed turn discovers and edits the exact occurrence through Flow',
  testOptions,
  async () => {
    const h = await harness();
    const { turn, outcomePromise } = await h.start();
    assert.equal((await outcomePromise).status, 'completed');
    assert.deepEqual(h.discovery, { ...target, revision: 7 });
    const receipt = expectReceipt(h, turn.turnId, 'applied');
    assert.equal(receipt.revision, 8);
    assert.equal(h.graph.graph.nodes[0].values.instructions, agentText);
    assert.equal(h.graph.graph.revision, 8);
    assert.deepEqual(await h.authoring.observe(h.invocation), receipt);
    assert.equal(await h.authoring.observe({ ...h.invocation, actorId: 'other-actor' }), undefined);
    assert.equal(await h.authoring.observe({ ...h.invocation, turnId: 'other-turn' }), undefined);
    const calls = await h.stores.invocations.listInvocationsForTurn(turn.turnId);
    const editCall = calls.find(({ capabilityId }) => capabilityId === 'cap.draft.edit');
    assert.equal(editCall.status, 'completed');
    assert.equal(editCall.idempotencyKey, receipt.operationId);
  },
);

test('an intervening manual edit wins the revision check', testOptions, async () => {
  const staged = Promise.withResolvers();
  const release = Promise.withResolvers();
  const h = await harness({
    beforeCommit: () => {
      staged.resolve();
      return release.promise;
    },
  });
  const run = await h.start();
  await staged.promise;
  assert.equal(h.graph.apply(setInstructions(manualText), 7).ok, true);
  release.resolve();
  await run.outcomePromise;
  assert.equal(expectReceipt(h, run.turn.turnId, 'stale').revision, 8);
  assert.equal(h.graph.graph.nodes[0].values.instructions, manualText);
  assert.equal(h.counters.journalApplies, 0);
});

for (const outside of [{ draftId: 'another-draft' }, { occurrenceId: 'research.name' }]) {
  test(
    `a request for ${Object.keys(outside)[0]} outside the turn writes nothing`,
    testOptions,
    async () => {
      const h = await harness();
      await (
        await h.start({ ...request, ...outside })
      ).outcomePromise;
      assert.deepEqual(h.result, { status: 'denied' });
      assert.deepEqual(h.counters, { deliveries: 0, journalApplies: 0 });
      assert.equal(h.receipts.size, 0);
      assert.equal(h.graph.graph.revision, 7);
      assert.equal(h.graph.canUndo, false);
    },
  );
}

test('the commit rechecks that the authorized draft is still open', testOptions, async () => {
  let h;
  h = await harness({ beforeCommit: () => h.closeDraft() });
  const run = await h.start();
  await run.outcomePromise;
  expectReceipt(h, run.turn.turnId, 'denied');
  assert.equal(h.counters.journalApplies, 0);
  assert.equal(h.graph.graph.revision, 7);
});

test('the real capability gate refuses a missing write grant', testOptions, async () => {
  const h = await harness({ authorizeEdit: false });
  await (
    await h.start()
  ).outcomePromise;
  assert.ok(h.result.victCapabilityFailure);
  assert.equal(h.invocation, undefined);
  assert.deepEqual(h.counters, { deliveries: 0, journalApplies: 0 });
});

test('an invalid edit leaves the canonical graph and history intact', testOptions, async () => {
  const h = await harness();
  const run = await h.start({ ...request, edit: '' });
  await run.outcomePromise;
  expectReceipt(h, run.turn.turnId, 'invalid');
  assert.equal(h.graph.graph.revision, 7);
  assert.equal(h.graph.canUndo, false);
});

test('Stop before commit fences the write at the journal', testOptions, async () => {
  const staged = Promise.withResolvers();
  const release = Promise.withResolvers();
  const h = await harness({
    beforeCommit: () => {
      staged.resolve();
      return release.promise;
    },
  });
  const run = await h.start();
  await staged.promise;
  assert.equal((await h.stop(run.turn.turnId)).accepted, true);
  assert.equal(h.invocation.signal.aborted, true);
  release.resolve();
  assert.equal((await run.outcomePromise).status, 'cancelled');
  expectReceipt(h, run.turn.turnId, 'cancelled');
  assert.equal(h.counters.journalApplies, 0);
  assert.equal(h.graph.graph.revision, 7);
  assert.equal(h.graph.canUndo, false);
});

test(
  'commit before Stop keeps the applied receipt and ordinary undo/redo',
  testOptions,
  async () => {
    const committed = Promise.withResolvers();
    const ack = Promise.withResolvers();
    const h = await harness({
      afterCommit: () => {
        committed.resolve();
        return ack.promise;
      },
    });
    const run = await h.start();
    await committed.promise;
    assert.equal(h.graph.graph.nodes[0].values.instructions, agentText);
    assert.equal((await h.stop(run.turn.turnId)).accepted, true);
    ack.resolve();
    assert.equal((await run.outcomePromise).status, 'cancelled');
    const receipt = expectReceipt(h, run.turn.turnId, 'applied');
    assert.equal(h.graph.undo().ok, true);
    assert.equal(h.graph.graph.nodes[0].values.instructions ?? initialText, initialText);
    assert.equal(h.graph.redo().ok, true);
    assert.equal(h.graph.graph.nodes[0].values.instructions, agentText);
    assert.deepEqual(await h.authoring.observe(h.invocation), receipt);
    assert.equal(h.counters.journalApplies, 1);
  },
);

test('lost acknowledgement reconciles from the exact journal receipt', testOptions, async () => {
  const h = await harness({
    afterCommit: () => {
      throw Error('Synthetic dropped acknowledgement');
    },
  });
  const run = await h.start();
  await run.outcomePromise;
  const receipt = expectReceipt(h, run.turn.turnId, 'applied');
  assert.deepEqual(await h.authoring.apply(h.invocation, request), {
    status: 'confirmed',
    receipt,
  });
  assert.deepEqual(h.counters, { deliveries: 1, journalApplies: 1 });
});

test('a journal receipt for another operation cannot confirm the edit', testOptions, async () => {
  const h = await harness({
    afterCommit: (host) => {
      const read = host.readReceipt;
      host.readReceipt = (key) => ({ ...read(key), operationId: 'different-operation' });
    },
  });
  await (
    await h.start()
  ).outcomePromise;
  assert.deepEqual(h.result, { status: 'unconfirmed' });
  await assert.rejects(h.authoring.observe(h.invocation), /another operation/);
  assert.equal(h.counters.journalApplies, 1);
});

test(
  'unavailable acknowledgement and read stay uncertain, then a retry returns the original edit',
  testOptions,
  async () => {
    const h = await harness({
      afterCommit: (host) => {
        host.readReceipt = () => {
          throw Error('Synthetic journal read unavailable');
        };
        throw Error('Synthetic dropped acknowledgement');
      },
    });
    const run = await h.start();
    await run.outcomePromise;
    assert.deepEqual(h.result, { status: 'unconfirmed' });
    assert.equal(h.graph.graph.revision, 8);
    h.closeDraft();
    const reopened = createDraftAuthoring({
      ...h.host,
      readReceipt: ({ actorId, turnId, operationId }) =>
        h.receipts.get(JSON.stringify([actorId, turnId, operationId])),
    });
    const retry = await reopened.apply(h.invocation, request);
    assert.equal(retry.status, 'confirmed');
    assert.equal(retry.receipt.status, 'applied');
    assert.equal(retry.receipt.revision, 8);
    assert.deepEqual(await reopened.apply(h.invocation, { ...request, edit: manualText }), {
      status: 'operation-conflict',
    });
    assert.deepEqual(h.counters, { deliveries: 1, journalApplies: 1 });
  },
);

test('overlapping deliveries of one invocation create one history entry', testOptions, async () => {
  const first = Promise.withResolvers();
  const second = Promise.withResolvers();
  const release = Promise.withResolvers();
  let arrivals = 0;
  const h = await harness({
    beforeCommit: () => {
      arrivals += 1;
      if (arrivals === 1) first.resolve();
      if (arrivals === 2) second.resolve();
      return release.promise;
    },
  });
  const run = await h.start();
  await first.promise;
  const replay = h.authoring.apply(h.invocation, request);
  await second.promise;
  release.resolve();
  await run.outcomePromise;
  assert.deepEqual(await replay, h.result);
  assert.equal(expectReceipt(h, run.turn.turnId, 'applied').revision, 8);
  assert.deepEqual(h.counters, { deliveries: 2, journalApplies: 1 });
  assert.equal(h.graph.undo().ok, true);
  assert.equal(h.graph.canUndo, false);
});
