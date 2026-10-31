import {expect,it} from 'vitest';
import {AgentStreamHub,createInMemoryAgentControlStores} from '../src/index.js';
it('independent: a fast subscriber can resume a durable backlog beyond the default pending bound',async()=>{
  const stores=createInMemoryAgentControlStores(),hub=new AgentStreamHub({ledger:stores.streamLedger});
  const base={streamId:'long-backlog',turnId:'t',threadId:'thread',actorId:'actor',agentProfileVersion:'v1_backlog'};
  for(let i=0;i<4097;i++)await hub.publish({...base,kind:'response.started'});
  const received:number[]=[];let overflows=0;
  await hub.subscribe(base.streamId,{subscriberId:'fast',deliver:event=>{received.push(event.seq);return true;},onOverflow:()=>{overflows++;}});
  expect(overflows).toBe(0);
  expect(received).toHaveLength(4097);
  expect(received[0]).toBe(1);expect(received.at(-1)).toBe(4097);
},30000);
