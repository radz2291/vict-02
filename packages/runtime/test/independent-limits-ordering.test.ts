import { expect, it } from 'vitest';
import { AgentStreamHub, createInMemoryAgentControlStores } from '../src/index.js';

it('does not overtake an unresolved asynchronous subscriber delivery on concurrent publication', async () => {
  const stores = createInMemoryAgentControlStores();
  const hub = new AgentStreamHub({ ledger: stores.streamLedger });
  const base = { streamId:'independent-order',turnId:'t',threadId:'thread',actorId:'actor',agentProfileVersion:'v1_order' };
  let enter!:()=>void, release!:()=>void;
  const entered = new Promise<void>(resolve=>{enter=resolve;});
  const gate = new Promise<void>(resolve=>{release=resolve;});
  const received:number[]=[], finished:number[]=[];
  await hub.subscribe(base.streamId,{subscriberId:'async',deliver:async event=>{
    received.push(event.seq);
    if(event.seq===1){enter();await gate;}
    finished.push(event.seq);
    return true;
  }});
  const first = hub.publish({...base,kind:'response.started'});
  await entered;
  const second = hub.publish({...base,kind:'response.cancelled'});
  try {
    await new Promise(resolve=>setTimeout(resolve,25));
    expect(received).toEqual([1]);
    expect(finished).toEqual([]);
  } finally {
    release();
    await Promise.all([first,second]);
    hub.unsubscribe(base.streamId,'async');
  }
  expect(finished).toEqual([1,2]);
});
