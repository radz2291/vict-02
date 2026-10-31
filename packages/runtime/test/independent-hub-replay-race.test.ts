import {expect,it} from 'vitest';
import {AgentStreamHub,createInMemoryAgentControlStores} from '../src/index.js';

it('independent: live capture cannot precede older replay during subscription registration',async()=>{
  const stores=createInMemoryAgentControlStores();
  let entered!:()=>void,release!:()=>void;
  const ready=new Promise<void>(resolve=>{entered=resolve;});
  const gate=new Promise<void>(resolve=>{release=resolve;});
  let firstRead=true;
  const ledger={
    latestSeq:stores.streamLedger.latestSeq.bind(stores.streamLedger),
    listStreamIds:stores.streamLedger.listStreamIds.bind(stores.streamLedger),
    appendEvent:stores.streamLedger.appendEvent.bind(stores.streamLedger),
    listEventsFrom:async(...args:Parameters<typeof stores.streamLedger.listEventsFrom>)=>{
      if(firstRead){firstRead=false;entered();await gate;}
      return stores.streamLedger.listEventsFrom(...args);
    },
  };
  const hub=new AgentStreamHub({ledger});
  const base={streamId:'replay-race',turnId:'t',threadId:'thread',actorId:'actor',agentProfileVersion:'v1_race'};
  await hub.publish({...base,kind:'response.started'});
  const delivered:number[]=[];
  const subscribing=hub.subscribe(base.streamId,{subscriberId:'sub',deliver:event=>{delivered.push(event.seq);return true;}});
  await ready;
  try {
    await hub.publish({...base,kind:'response.completed'});
    expect(hub.pull(base.streamId,'sub')).toEqual([]);
  } finally {release();await subscribing;}
  expect(delivered).toEqual([1,2]);
});
