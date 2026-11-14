/** Run against a built or freshly installed public VICT package set. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateAgentStreamEvent } from '@victframework/contracts';
import {
  AgentProfileRegistry,
  AgentStreamHub,
  authenticatedActorContext,
} from '@victframework/runtime';
import {
  createSqliteAgentControlStores,
  createSqliteAgentExchangeStore,
} from '@victframework/store-sqlite';
import {
  AGENT_EXCHANGE_ASK_CAPABILITY,
  composeMastraTurnExecutor,
  createDedicatedMastraStore,
  createDeterministicOfflineModel,
  createMastraAgentExchange,
  MASTRA_EXCHANGE_ADAPTER_COMPATIBILITY,
  MastraThreadCoordinator,
  sanitizeCapabilityToolName,
} from '@victframework/mastra';

const modes = [
  'last-step',
  'zero-step',
  'duplicate',
  'changed-duplicate',
  'stop-asker',
  'stop-answerer',
  'expire-asker',
  'expire-answerer',
  'denied-answer',
  'revoked-answer',
  'denied-question',
];
const question = 'What is the shared code?';
const approvedContext = 'The approved code is GREEN.';
const ordinaryAnswer = 'Original asker continued.';
const secret = 'ANSWERER_PRIVATE_CANARY';
const ask = { id: AGENT_EXCHANGE_ASK_CAPABILITY, revision: '1' };
const holding = { id: 'fixture.exchange.hold', revision: '1' };
const childRef = { id: 'fixture.asker', revision: '1' };
const ownerRef = { id: 'fixture.answerer', revision: '1' };
const instructions = { id: 'fixture.instructions', revision: '1' };
const memoryPolicy = { id: 'fixture.memory', revision: '1' };
const askToolName = sanitizeCapabilityToolName(ask.id);
const holdingToolName = sanitizeCapabilityToolName(holding.id);
const contract = (id, parse) => ({
  id,
  revision: '1',
  expected: 'Exchange fixture contract',
  descriptiveJsonSchema: { type: 'object' },
  parse: (input) => (parse(input) ? { ok: true, value: input } : { ok: false, issues: [] }),
});
const askCapability = {
  ...ask,
  effect: 'read',
  description: 'Ask the wired agent.',
  input: contract(
    'fixture.ask.input',
    (value) =>
      value !== null &&
      typeof value === 'object' &&
      Object.keys(value).length === 1 &&
      typeof value.question === 'string',
  ),
  output: contract(
    'fixture.ask.output',
    (value) => value?.status === 'answered' || value?.status === 'refused',
  ),
  invoke: async () => assert.fail('Generic host handler cannot execute an exchange ask'),
};
const holdingCapability = {
  ...holding,
  effect: 'read',
  description: 'Run the pinned fixture specialist.',
  input: contract('fixture.hold.input', (value) => value && Object.keys(value).length === 0),
  output: contract('fixture.hold.output', (value) => typeof value?.status === 'string'),
  invoke: async () => assert.fail('Use the exact governed invocation'),
};

function profiles(steps) {
  const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
  registry.installArtifacts([
    { kind: 'instructions', ...instructions, text: secret },
    {
      kind: 'memory-policy',
      ...memoryPolicy,
      config: { lastMessages: 10, workingMemory: { enabled: false }, semanticRecall: false },
    },
  ]);
  function profile(ref, capability, steps, subagents = []) {
    registry.registerProfile({
      ...ref,
      schema: 'vict.agent-profile@1',
      instructions,
      memoryPolicy,
      subagents,
      modelProfile: {
        id: 'fixture.model',
        revision: '1',
        routerModel: 'offline-fixture/deterministic-1',
        provider: 'offline-fixture',
      },
      generation: { maxRetries: 0 },
      turnPolicy: { maxSteps: steps, maxToolCalls: 1, onLimit: 'fail-closed' },
      capabilities: [capability],
      adapter: MASTRA_EXCHANGE_ADAPTER_COMPATIBILITY,
    });
    return registry.activateAgentProfile(ref);
  }
  const asker = profile(childRef, ask, 2);
  const answerer = profile(ownerRef, holding, steps, [childRef]);
  const binding = { asker, answerer, askCapability: ask, holdingCapability: holding };
  return binding;
}

async function scenario(mode, directory = undefined) {
  directory ??= await mkdtemp(join(tmpdir(), 'vict-exchange-public-'));
  const receiptPath = join(directory, 'exchange.sqlite');
  const receipts = createSqliteAgentExchangeStore({ path: receiptPath });
  const stores = createSqliteAgentControlStores({ path: join(directory, 'control.sqlite') });
  const memory = await createDedicatedMastraStore({
    dataDir: directory,
    retention: { messagesMaxAgeMs: 3600000, threadsMaxAgeMs: 3600000, spansMaxAgeMs: 3600000 },
  });
  const actorId = 'exchange-fixture-actor';
  await stores.actors.upsert({ actorId, status: 'active', roles: ['developer'], createdAt: 0 });
  const actor = authenticatedActorContext(await stores.actors.get(actorId), actorId);
  const binding = profiles(mode === 'zero-step' ? 1 : 2);
  const { asker, answerer } = binding;
  const disclosure = {
    allowQuestion: ({ question: value }) =>
      mode !== 'denied-question' && value === question ? { context: approvedContext } : undefined,
    allowAnswer: ({ answer }) => mode !== 'denied-answer' && answer === approvedContext,
  };
  assert.throws(
    () =>
      createMastraAgentExchange({
        binding: { ...binding, asker: { ...asker } },
        receipts,
        stores,
        disclosure,
      }),
    /VICT_EXCHANGE_UNBOUND/,
  );
  const exchange = createMastraAgentExchange({ binding, receipts, stores, disclosure });
  await assert.rejects(
    exchange.withAsker(async () => assert.fail('Unwired call')),
    /VICT_EXCHANGE_UNBOUND/,
  );
  const hub = new AgentStreamHub({ ledger: stores.streamLedger });
  const coordinator = new MastraThreadCoordinator();
  const askerTurnId = randomUUID(),
    answererTurnId = randomUUID();
  const askerStreamId = randomUUID(),
    answererStreamId = randomUUID();
  const now = Date.now();
  const askerDeadline = now + (mode === 'expire-asker' ? 2000 : 20000);
  const answererDeadline = now + (mode === 'expire-answerer' ? 2000 : 20000);
  const calls = { asker: 0, ordinary: 0, answer: 0 };
  let child, root, operation, pendingDuplicate;
  const capturedToolOutput = [];
  const duplicate = mode === 'duplicate' || mode === 'changed-duplicate';
  const stops = mode.startsWith('stop-') || mode.startsWith('expire-');
  const answerInput = JSON.stringify({ question, context: approvedContext });
  const askerModel = createDeterministicOfflineModel({
    script: {
      'begin-asker': {
        kind: 'tool-call',
        toolName: askToolName,
        args: { question },
        thenText: ordinaryAnswer,
      },
    },
    onToolResult: (event) => {
      capturedToolOutput.push(event.output);
    },
  });
  const answererModel = createDeterministicOfflineModel({
    script: {
      'begin-answerer': {
        kind: 'tool-call',
        toolName: holdingToolName,
        args: {},
        thenText: 'Unexpected extra dispatch.',
      },
      [answerInput]: { kind: 'text', text: approvedContext },
    },
  });
  const useAskerModel = () => ({
    ...askerModel,
    async doStream(options) {
      calls.asker += 1;
      if (calls.asker === 2 && duplicate) {
        const [original] = await stores.invocations.listInvocationsForTurn(askerTurnId);
        assert.ok(original);
        const tool = child.capabilityTools[askToolName];
        const call = await tool.execute(
          {
            question: mode === 'changed-duplicate' ? 'Altered question.' : question,
          },
          { agent: { toolCallId: original.toolCallId } },
        );
        if (mode === 'duplicate') {
          const expected = {
            status: 'answered',
            answer: approvedContext,
            receiptId: original.idempotencyKey,
          };
          assert.deepEqual(call, expected);
          assert.deepEqual(await pendingDuplicate, expected);
        } else {
          assert.deepEqual(call, { status: 'refused', code: 'VICT_EXCHANGE_OPERATION_CONFLICT' });
        }
      }
      return askerModel.doStream(options);
    },
  });
  const useAnswererModel = () => ({
    ...answererModel,
    async doStream(options) {
      const prompt = JSON.stringify(options.prompt);
      if (prompt.includes(question)) {
        calls.answer += 1;
        assert.doesNotMatch(prompt, new RegExp(secret));
        assert.equal(options.tools?.length ?? 0, 0);
        if (mode === 'process-loss') {
          const [original] = receipts.listPending();
          assert.ok(original && original.answererModelSteps === 1);
          process.send({ operationId: original.operationId, askerTurnId, answererTurnId, calls });
          await new Promise(() => {
            setInterval(() => undefined, 1000);
          });
        }
        if (mode === 'duplicate') {
          const [original] = await stores.invocations.listInvocationsForTurn(askerTurnId);
          assert.ok(original);
          pendingDuplicate = child.capabilityTools[askToolName].execute(
            { question },
            { agent: { toolCallId: original.toolCallId } },
          );
        }
        if (mode === 'revoked-answer') {
          await stores.actors.upsert({
            actorId,
            status: 'disabled',
            roles: ['developer'],
            createdAt: 0,
          });
        }
        if (mode.startsWith('expire-')) {
          const deadline = mode === 'expire-asker' ? askerDeadline : answererDeadline;
          await new Promise((resolve) =>
            setTimeout(resolve, Math.max(0, deadline - Date.now() + 25)),
          );
        }
        if (mode.startsWith('stop-')) {
          const target = mode === 'stop-asker' ? child : root;
          await target.turnService.cancelTurn(actor, {
            turnId: mode === 'stop-asker' ? askerTurnId : answererTurnId,
            reasonCode: 'FIXTURE_STOP',
          });
        }
      } else {
        calls.ordinary += 1;
      }
      return answererModel.doStream(options);
    },
  });
  function compose(activation, capability, modelFactory, turnId, streamId, invoke, wire = true) {
    let composition;
    composition = composeMastraTurnExecutor({
      stores,
      activation,
      hub,
      ...(wire
        ? {
            exchange: {
              binding: exchange,
              deadlineAt: () => (activation === asker ? askerDeadline : answererDeadline),
            },
          }
        : {}),
      ids: {
        turnId: () => turnId,
        streamId: () => streamId,
        invocationId: randomUUID,
        approvalId: randomUUID,
        idempotencyKey: randomUUID,
        cancelId: randomUUID,
      },
      agentConfig: { store: memory.store, threadCoordinator: coordinator, modelFactory },
      capabilityBridge: {
        resolveCapability: (id, revision) =>
          id === capability.id && revision === capability.revision ? capability : undefined,
        invoke,
        recordInvocationIntent: (command) =>
          composition.turnService.recordToolInvocationIntent(command),
        requestApproval: (command) => composition.turnService.requestApproval(command),
        consumeApproval: (command) => composition.turnService.consumeApproval(command),
        updateInvocationStatus: (command) => stores.invocations.updateInvocationStatus(command),
      },
    });
    return composition;
  }
  assert.throws(
    () =>
      compose(
        asker,
        askCapability,
        useAskerModel,
        askerTurnId,
        askerStreamId,
        askCapability.invoke,
        false,
      ),
    /VICT_EXCHANGE_UNBOUND/,
  );
  child = compose(
    asker,
    askCapability,
    useAskerModel,
    askerTurnId,
    askerStreamId,
    askCapability.invoke,
  );
  root = compose(
    answerer,
    holdingCapability,
    useAnswererModel,
    answererTurnId,
    answererStreamId,
    async () =>
      exchange.withAsker(async () => {
        const started = await child.turnService.startTurn(actor, {
          threadId: 'vict-conv-' + randomUUID(),
          input: 'begin-asker',
        });
        const result = await started.outcomePromise;
        const invocations = await stores.invocations.listInvocationsForTurn(askerTurnId);
        assert.equal(invocations.length, mode === 'changed-duplicate' ? 2 : 1);
        operation = invocations.find((item) => receipts.read(item.idempotencyKey))?.idempotencyKey;
        return { status: result.status };
      }),
  );
  const captured = [];
  await hub.subscribe(askerStreamId, {
    subscriberId: 'observe-asker',
    deliver(event) {
      captured.push(event);
      return true;
    },
  });
  try {
    const started = await root.turnService.startTurn(actor, {
      threadId: 'vict-conv-' + randomUUID(),
      input: 'begin-answerer',
    });
    const result = await started.outcomePromise;
    const childResult = await stores.turns.getTurn(askerTurnId);
    if (mode === 'denied-question') {
      const denied = receipts.read(operation);
      assert.equal(denied.state, 'settled');
      assert.equal(denied.receipt.question, null);
      assert.equal(denied.receipt.code, 'VICT_EXCHANGE_AUTHORITY_DENIED');
      assert.equal(denied.receipt.askerToolCalls, 0);
      assert.equal(denied.receipt.answererModelSteps, 0);
      assert.deepEqual(await exchange.readReceipt(operation, actorId), denied.receipt);
      assert.equal(calls.answer, 0);
      assert.equal(childResult.status, 'completed');
      assert.equal(result.status, 'completed');
      assert.match(JSON.stringify(capturedToolOutput), /VICT_EXCHANGE_AUTHORITY_DENIED/);
      assert.doesNotMatch(JSON.stringify(capturedToolOutput), /GREEN/);
      console.log(
        JSON.stringify({
          mode,
          disclosure: 'refused',
          answerCalls: 0,
          deniedQuestionNotStored: true,
        }),
      );
      return;
    }
    assert.ok(operation);
    const stored = receipts.read(operation);
    assert.equal(stored?.state, 'settled');
    const receipt = stored.receipt;
    assert.equal(receipt.asker.turnId, askerTurnId);
    assert.equal(receipt.answerer.turnId, answererTurnId);
    assert.equal(receipt.asker.activationVersion, asker.activationVersion);
    assert.equal(receipt.answerer.activationVersion, answerer.activationVersion);
    assert.equal(receipt.asker.deadlineAt, askerDeadline);
    assert.equal(receipt.answerer.deadlineAt, answererDeadline);
    assert.equal(receipt.question, question);
    assert.equal(receipt.askerToolCalls, 1);
    assert.equal(receipt.answererModelSteps, mode === 'zero-step' ? 0 : 1);
    assert.equal(receipt.answererProviderAttempts, calls.answer);
    assert.equal(calls.ordinary, 1);
    assert.equal(calls.answer, mode === 'zero-step' ? 0 : 1);
    if (stops) {
      assert.equal(result.status, 'cancelled');
      assert.equal(childResult.status, 'cancelled');
      assert.equal(calls.asker, 1);
      assert.equal(
        receipt.code,
        mode.startsWith('expire-') ? 'VICT_EXCHANGE_DEADLINE' : 'VICT_EXCHANGE_CANCELLED',
      );
    } else {
      assert.equal(childResult.status, 'completed');
      assert.equal(calls.asker, 2);
      if (mode === 'last-step' || duplicate) {
        assert.equal(result.errorCode, 'VICT_EXCHANGE_STEP_LIMIT');
        assert.equal(receipt.status, 'answered');
        assert.equal(receipt.answer, approvedContext);
        assert.match(JSON.stringify(capturedToolOutput[0]), /GREEN/);
      } else {
        assert.equal(receipt.status, 'refused');
        assert.equal(
          receipt.code,
          mode === 'zero-step' ? 'VICT_EXCHANGE_STEP_LIMIT' : 'VICT_EXCHANGE_AUTHORITY_DENIED',
        );
        assert.doesNotMatch(JSON.stringify(capturedToolOutput), /GREEN/);
      }
    }
    assert.ok(captured.length > 1);
    assert.ok(
      captured.every(
        (event, index) =>
          validateAgentStreamEvent(event).ok &&
          event.turnId === askerTurnId &&
          event.streamId === askerStreamId &&
          event.seq === index + 1,
      ),
    );
    const reopened = createSqliteAgentExchangeStore({ path: receiptPath });
    try {
      const replay = createMastraAgentExchange({ binding, receipts: reopened, stores, disclosure });
      const before = { ...calls };
      assert.deepEqual(
        await replay.readReceipt(operation, actorId),
        mode === 'revoked-answer' ? undefined : receipt,
      );
      assert.equal(await replay.readReceipt(operation, 'other-actor'), undefined);
      assert.deepEqual(calls, before);
      assert.throws(() => reopened.settle({ ...receipt, answer: 'altered', status: 'answered' }));
      assert.deepEqual(reopened.read(operation), { state: 'settled', receipt });
    } finally {
      reopened.close();
    }
    console.log(
      JSON.stringify({
        mode,
        node: process.version,
        askerStatus: childResult.status,
        answererStatus: result.status,
        disposition: receipt.status,
        calls,
        monotonicEvents: captured.length,
        durableReplay: mode === 'revoked-answer' ? 'denied by current actor scope' : true,
      }),
    );
  } finally {
    hub.unsubscribe(askerStreamId, 'observe-asker');
    await root.productAgent.flush();
    await child.productAgent.flush();
    await memory.close();
    receipts.close();
    stores.close();
  }
}

async function processLoss() {
  const directory = await mkdtemp(join(tmpdir(), 'vict-exchange-lost-owner-'));
  const worker = fork(fileURLToPath(import.meta.url), ['--loss-worker', directory], {
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  const exited = once(worker, 'exit');
  let data;
  try {
    data = await Promise.race([
      once(worker, 'message').then(([record]) => record),
      exited.then(([code]) => assert.fail('Owner exited before exchange intent: ' + code)),
      delay(25000, undefined, { ref: false }).then(() =>
        assert.fail('Exchange intent did not reach the model'),
      ),
    ]);
  } finally {
    worker.kill('SIGKILL');
    await exited;
  }
  const stores = createSqliteAgentControlStores({ path: join(directory, 'control.sqlite') });
  const receipts = createSqliteAgentExchangeStore({ path: join(directory, 'exchange.sqlite') });
  try {
    assert.equal(receipts.read(data.operationId)?.state, 'pending');
    const exchange = createMastraAgentExchange({
      binding: profiles(2),
      stores,
      receipts,
      disclosure: { allowQuestion: () => ({ context: approvedContext }), allowAnswer: () => true },
    });
    const [receipt] = await exchange.reconcileAfterRestart();
    assert.equal(receipt.code, 'VICT_EXCHANGE_OUTCOME_UNKNOWN');
    assert.equal(receipt.answererProviderAttempts, null);
    assert.equal(receipt.answererModelSteps, 1);
    assert.equal(receipt.askerToolCalls, 1);
    assert.deepEqual(await exchange.reconcileAfterRestart(), []);
    for (const turnId of [data.askerTurnId, data.answererTurnId]) {
      const turn = await stores.turns.getTurn(turnId);
      assert.equal(turn.status, 'failed');
      assert.equal(turn.errorCode, 'VICT_TURN_INTERRUPTED');
    }
    // The baseline SQLite control adapter uses a process-local actor directory.
    // Restore the authenticated actor from the fixture's server-side source.
    await stores.actors.upsert({
      actorId: 'exchange-fixture-actor',
      status: 'active',
      roles: ['developer'],
      createdAt: 0,
    });
    assert.deepEqual(
      await exchange.readReceipt(data.operationId, 'exchange-fixture-actor'),
      receipt,
    );
    console.log(
      JSON.stringify({
        mode: 'process-loss',
        originalTurns: 'Interrupted',
        exchange: 'Uncertain',
        callsBeforeLoss: data.calls,
        dispatchAfterReopen: 0,
      }),
    );
  } finally {
    receipts.close();
    stores.close();
  }
}
if (process.argv[2] === '--loss-worker') {
  await scenario('process-loss', process.argv[3]);
} else {
  for (const mode of modes) await scenario(mode);
  await processLoss();
}
