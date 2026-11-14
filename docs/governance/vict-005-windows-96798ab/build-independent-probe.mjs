import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';

const [source, output] = process.argv.slice(2);
let code = readFileSync(source,'utf8').replace(/\r\n/g, '\n');
function replace(before, after) {
  assert.ok(code.includes(before), 'Fixture anchor missing: ' + before);
  code = code.replace(before, after);
}

replace("import { mkdtemp }", "import { readFileSync, writeFileSync } from 'node:fs';\nimport { mkdtemp }");
replace("  authenticatedActorContext,", "  authenticatedActorContext,\n  validateAgentExchangeReceipt,");
replace("const question = 'What is the shared code?';", "const question = 'Which marker may cross the boundary?';");
replace("const approvedContext = 'The approved code is GREEN.';", "const approvedContext = 'GREEN public marker only.';");
replace("const secret = 'ANSWERER_PRIVATE_CANARY';", "const secret = 'INDEPENDENT_INSTRUCTIONS_CANARY';\nconst rootInput = 'begin-answerer-private-user-transcript';");
replace("      'begin-answerer': {", "      [rootInput]: {");
replace("      input: 'begin-answerer',", "      input: rootInput,");
replace("  const exchange = createMastraAgentExchange({ binding, receipts, stores, disclosure });",
  "  const storePort = mode !== 'settled-loss' ? receipts : {\n" +
  "    read: id => receipts.read(id), listPending: () => receipts.listPending(),\n" +
  "    claim: intent => receipts.claim(intent), reconcileAbandoned: (...args) => receipts.reconcileAbandoned(...args),\n" +
  "    settle(receipt) {\n" +
  "      const settled = receipts.settle(receipt);\n" +
  "      writeFileSync(join(directory, 'after-settle.json'), JSON.stringify({operationId: receipt.operationId, askerTurnId, askerStreamId, answererTurnId, calls}));\n" +
  "      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);\n" +
  "      return settled;\n" +
  "    },\n" +
  "  };\n" +
  "  const exchange = createMastraAgentExchange({ binding, receipts: storePort, stores, disclosure });\n" +
  "  if (mode === 'last-step') {\n" +
  "    for (const pins of [{...binding, asker: undefined}, {...binding, answerer: undefined},\n" +
  "      {...binding, answerer: {...answerer, activationVersion: asker.activationVersion}},\n" +
  "      {...binding, askCapability: {...ask, revision:'2'}},\n" +
  "      {...binding, holdingCapability: {...holding, revision:'2'}},\n" +
  "      {...binding, asker: answerer, answerer: asker}]) {\n" +
  "      assert.throws(() => createMastraAgentExchange({binding:pins, receipts, stores, disclosure}), /VICT_EXCHANGE_UNBOUND/);\n" +
  "    }\n" +
  "  }");
replace("  const capturedToolOutput = [];", "  const capturedToolOutput = [];\n  const answerPrompts = [];\n  const rootEvents = [];");
replace("        calls.answer += 1;", "        calls.answer += 1;\n        answerPrompts.push(options.prompt);\n        assert.ok(!prompt.includes(rootInput));\n        assert.match(prompt, /GREEN public marker only/);");
replace("  child = compose(", "  if (mode === 'last-step') {\n" +
  "    const changed = profiles(3).answerer;\n" +
  "    assert.notEqual(changed.activationVersion, answerer.activationVersion);\n" +
  "    assert.throws(() => compose(changed, holdingCapability, useAnswererModel, answererTurnId, answererStreamId, holdingCapability.invoke), /VICT_EXCHANGE_UNBOUND/);\n" +
  "  }\n  child = compose(");
replace("  try {\n    const started = await root.turnService.startTurn(actor, {",
  "  await hub.subscribe(answererStreamId, {subscriberId:'observe-answerer', deliver(event) {rootEvents.push(event); return true;}});\n" +
  "  try {\n    const started = await root.turnService.startTurn(actor, {");
replace("    const childResult = await stores.turns.getTurn(askerTurnId);",
  "    const childResult = await stores.turns.getTurn(askerTurnId);\n" +
  "    for (const [events, turnId, streamId] of [[captured, askerTurnId, askerStreamId], [rootEvents, answererTurnId, answererStreamId]]) {\n" +
  "      assert.ok(events.length > 1);\n" +
  "      assert.equal(events[0].kind, 'response.started');\n" +
  "      assert.ok(events.every((event, i) => validateAgentStreamEvent(event).ok && event.turnId === turnId && event.streamId === streamId && event.seq === i + 1));\n" +
  "      assert.deepEqual((await hub.replay({streamId, lastSeq: 0})).events, events);\n" +
  "      assert.equal(events.filter(event => /^response\\.(completed|failed|cancelled)$/.test(event.kind)).length, 1);\n" +
  "      if (stops) {\n" +
  "        assert.equal(events.at(-1).kind, 'response.cancelled');\n" +
  "        assert.doesNotMatch(JSON.stringify(events), /GREEN|Original asker continued/);\n" +
  "      }\n" +
  "    }\n" +
  "    if(stops) assert.deepEqual(capturedToolOutput, []);");
replace("    assert.equal(receipt.asker.turnId, askerTurnId);",
  "    assert.equal(validateAgentExchangeReceipt(receipt), true);\n" +
  "    assert.equal(receipt.asker.streamId, askerStreamId);\n" +
  "    assert.equal(receipt.answerer.streamId, answererStreamId);\n" +
  "    assert.equal(answerPrompts.length, calls.answer);\n" +
  "    assert.equal(receipt.asker.turnId, askerTurnId);");
replace("      assert.deepEqual(calls, before);",
  "      const revokedProjection = createMastraAgentExchange({binding, receipts:reopened, stores,\n" +
  "        disclosure: {...disclosure, allowQuestion: () => undefined}});\n" +
  "      const revokedAnswer = createMastraAgentExchange({binding, receipts:reopened, stores,\n" +
  "        disclosure: {...disclosure, allowAnswer: () => false}});\n" +
  "      assert.equal(await revokedProjection.readReceipt(operation, actorId), undefined);\n" +
  "      if(receipt.status === 'answered') assert.equal(await revokedAnswer.readReceipt(operation, actorId), undefined);\n" +
  "      assert.deepEqual(calls, before);\n" +
  "      assert.equal(await stores.streamLedger.latestSeq(askerStreamId), captured.at(-1).seq);\n" +
  "      assert.equal(await stores.streamLedger.latestSeq(answererStreamId), rootEvents.at(-1).seq);");
replace("    hub.unsubscribe(askerStreamId, 'observe-asker');", "    hub.unsubscribe(askerStreamId, 'observe-asker');\n    hub.unsubscribe(answererStreamId, 'observe-answerer');");
replace("          process.send({ operationId: original.operationId, askerTurnId, answererTurnId, calls });",
  "          process.send({ operationId: original.operationId, askerTurnId, askerStreamId, answererTurnId, calls });");
replace("    assert.equal(receipt.code, 'VICT_EXCHANGE_OUTCOME_UNKNOWN');",
  "    assert.equal(validateAgentExchangeReceipt(receipt), true);\n" +
  "    assert.equal(receipt.asker.streamId, data.askerStreamId);\n" +
  "    assert.equal(receipt.code, 'VICT_EXCHANGE_OUTCOME_UNKNOWN');");
replace("    console.log(\n      JSON.stringify({\n        mode: 'process-loss',",
  "    const replayHub = new AgentStreamHub({ledger:stores.streamLedger});\n" +
  "    const first = await replayHub.replay({streamId:data.askerStreamId,lastSeq:0});\n" +
  "    assert.ok(first.events.length > 0);\n" +
  "    assert.ok(first.events.every((e,i) => validateAgentStreamEvent(e).ok && e.turnId === data.askerTurnId && e.streamId === data.askerStreamId && (!i || e.seq > first.events[i-1].seq)));\n" +
  "    assert.deepEqual(await replayHub.replay({streamId:data.askerStreamId,lastSeq:0}), first);\n" +
  "    assert.equal(await exchange.readReceipt(data.operationId,'other-actor'), undefined);\n" +
  "    await stores.actors.upsert({actorId:'exchange-fixture-actor',status:'disabled',roles:['developer'],createdAt:0});\n" +
  "    assert.equal(await exchange.readReceipt(data.operationId,'exchange-fixture-actor'), undefined);\n" +
  "    console.log(\n      JSON.stringify({\n        mode: 'process-loss',");
writeFileSync(output, code.slice(0, code.indexOf("if (process.argv[2] === '--loss-worker')")));
