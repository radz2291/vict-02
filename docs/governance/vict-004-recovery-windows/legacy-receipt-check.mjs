import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const root=createRequire(pathToFileURL(join(process.cwd(),'package.json')));
const {createSqliteAgentControlStores,createSqliteAgentExchangeStore}=await import(pathToFileURL(root.resolve('@victframework/store-sqlite')));
const fixture=process.argv[2];
const data=JSON.parse(readFileSync(join(fixture,'after-settle.json')));
const controls=createSqliteAgentControlStores({path:join(fixture,'control.sqlite')});
const receipts=createSqliteAgentExchangeStore({path:join(fixture,'exchange.sqlite')});
try {
  const {receipt}=receipts.read(data.operationId);
  assert.equal(receipt.status,'answered');
  for(const id of [data.askerTurnId,data.answererTurnId]){
    const hits=receipts.listSettledForTurns(receipt.bindingId,[id]);
    assert.deepEqual(hits,[receipt]);
    assert.equal((await controls.turns.getTurn(id)).status,'running');
  }
  assert.deepEqual(receipts.listSettledForTurns(receipt.bindingId,[data.askerTurnId,data.answererTurnId]),[receipt]);
  assert.deepEqual(receipts.listSettledForTurns('f'.repeat(64),[data.askerTurnId]),[]);
  console.log(JSON.stringify({legacyReceiptIndex:true,matchedBothSides:true,duplicates:0,otherBindingMatches:0}));
} finally {
  receipts.close();
  controls.close();
}
