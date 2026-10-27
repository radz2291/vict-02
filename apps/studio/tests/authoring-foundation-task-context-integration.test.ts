import { describe, expect, it } from 'vitest';
import { createDeterministicOfflineModel, OFFLINE_MODEL_IDENTITY } from '@victframework/mastra';
import { newScreen } from '../src/lib/designer/application.js';
import { agentContext, documentCursor } from '../src/lib/designer/agent-edits.js';
import { installedAuthoringRegistry } from '../src/lib/designer/authoring.js';
import { agentTaskContexts } from '../src/lib/server/agent-task-context.js';
import { openAgentRun, validateAgentStart, type StudioAgentEvent } from '../src/lib/server/designer-agent.js';

describe('actual offline two-turn context delivery',()=>{
  it('delivers prior exact source facts to a corrected request, then drops them after revision changes',async()=>{
    const document=newScreen('Task continuity','context-integration');const owner=`context-${crypto.randomUUID()}`;
    const cursor=documentCursor(document,'r1#0',crypto.randomUUID());
    const checked=validateAgentStart({prompt:'Inspect footer gap',document,cursor,history:[]});if(!checked.ok)throw Error(checked.message);
    const initialInput=JSON.stringify({request:checked.value.prompt,untrusted_history:[],untrusted_screen:agentContext(document,cursor)});
    const firstModel=createDeterministicOfflineModel({script:{[initialInput]:{kind:'tool-chain',calls:[{toolName:'studio_screen_read',args:{section:'source',nodeId:'screen'}}],thenText:'Source inspected; appearance unresolved.'}}});
    const firstEvents:StudioAgentEvent[]=[];const first=openAgentRun(owner,checked.value,event=>firstEvents.push(event),{model:OFFLINE_MODEL_IDENTITY,modelFactory:()=>firstModel});if(!first.ok)throw Error(first.code);await first.finished;
    expect(firstEvents.at(-1)).toMatchObject({type:'done',status:'completed',applied:0});
    const facts=agentTaskContexts.snapshot(owner,cursor,installedAuthoringRegistry.digest);expect(facts?.facts[0]?.query).toMatchObject({section:'source',nodeId:'screen'});
    const correction=validateAgentStart({prompt:'I mean header; use the current source facts',document,cursor,history:[]});if(!correction.ok)throw Error(correction.message);
    const correctedInput=JSON.stringify({request:correction.value.prompt,untrusted_history:[],untrusted_screen:agentContext(document,cursor),untrusted_task_facts:facts});
    const correctedModel=createDeterministicOfflineModel({script:{[correctedInput]:{kind:'text',text:'Corrected target using retained source facts; visual cause remains unresolved.'}}});
    const correctedEvents:StudioAgentEvent[]=[];const second=openAgentRun(owner,correction.value,event=>correctedEvents.push(event),{model:OFFLINE_MODEL_IDENTITY,modelFactory:()=>correctedModel});if(!second.ok)throw Error(second.code);await second.finished;
    expect(correctedEvents.filter(event=>event.type==='text').map(event=>event.delta).join('')).toContain('Corrected target using retained source facts');expect(correctedEvents.some(event=>event.type==='proposal')).toBe(false);
    const changedCursor=documentCursor(document,'r1#1',cursor.epoch);expect(agentTaskContexts.snapshot(owner,changedCursor,installedAuthoringRegistry.digest)).toBeUndefined();
  },120_000);
});
