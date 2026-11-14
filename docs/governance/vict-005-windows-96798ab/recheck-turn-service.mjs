import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {AgentTurnService} from '@victframework/control';
import {createSqliteAgentControlStores,createSqliteAgentExchangeStore} from '@victframework/store-sqlite';
const directory=process.argv[2];
const evidence=JSON.parse(readFileSync(join(directory,'after-settle.json')));
const stores=createSqliteAgentControlStores({path:join(directory,'control.sqlite')});
const receipts=createSqliteAgentExchangeStore({path:join(directory,'exchange.sqlite')});
try {
  const readTurns=()=>Promise.all([evidence.askerTurnId,evidence.answererTurnId].map(id=>stores.turns.getTurn(id)));
  const seq=await stores.streamLedger.latestSeq(evidence.askerStreamId);
  const receipt=receipts.read(evidence.operationId);
  const before=(await readTurns()).map(turn=>turn.status);
  assert.deepEqual(before,['running','running']);
  const recovery=await new AgentTurnService({stores}).reconcileAfterRestart();
  const after=(await readTurns()).map(turn=>({status:turn.status,errorCode:turn.errorCode}));
  assert.deepEqual(after,Array(2).fill({status:'failed',errorCode:'VICT_TURN_INTERRUPTED'}));
  assert.deepEqual(recovery,{failed:2,cancelled:0,pendingApprovals:0});
  assert.deepEqual(receipts.read(evidence.operationId),receipt);
  assert.equal(await stores.streamLedger.latestSeq(evidence.askerStreamId),seq);
  console.log(JSON.stringify({before,after,receiptUnchanged:true,seq,recovery}));
} finally {
  receipts.close();
  stores.close();
}
