import { afterAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CapabilityDefinition, Contract } from '@victframework/sdk';
import {
  authenticatedActorContext,
  createInMemoryAgentControlStores,
  AgentStreamHub,
  type AgentControlStores,
} from '@victframework/runtime';
import type { AuthenticatedActorContext } from '@victframework/runtime';
import { AgentProfileRegistry } from '@victframework/runtime';
import {
  MASTRA_ADAPTER_COMPATIBILITY,
  createDeterministicOfflineModel,
  createDedicatedMastraStore,
  MastraThreadCoordinator,
} from '../src/index.js';
import { composeMastraTurnExecutor } from '../src/turn-executor.js';
import { type CapabilityBridgeDeps } from '../src/tool-bridge.js';

/** Offline actual-agent boundary probe. No provider connection or product-quality claim. */

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of tempDirs) {
    const attempt = (remaining: number): void => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        if (remaining > 0) {
          setTimeout(() => attempt(remaining - 1), 500);
        }
      }
    };
    attempt(10);
  }
});

const TEST_RETENTION = {
  messagesMaxAgeMs: 3_600_000,
  threadsMaxAgeMs: 86_400_000,
  spansMaxAgeMs: 3_600_000,
};

function contract(id: string, ok: (value: unknown) => boolean): Contract<unknown> {
  return {
    id,
    revision: '1',
    expected: 'bounded test contract',
    descriptiveJsonSchema: { type: 'object' },
    parse: (input: unknown) =>
      ok(input)
        ? { ok: true, value: input }
        : { ok: false, issues: [{ code: 'INVALID', path: 'input', message: 'invalid' }] },
  };
}

interface ModelVisibleToolResult {
  toolCallId: string;
  toolName: string;
  output: unknown;
}

interface Composition {
  stores: AgentControlStores;
  requester: AuthenticatedActorContext;
  turnService: ReturnType<typeof composeMastraTurnExecutor>['turnService'];
  /** The REAL model-facing capability tools of the composition (the pinned
   * Tool wrapper + the bridge's schema surface). */
  capabilityTools: Record<string, unknown>;
  capability: CapabilityDefinition;
  invokeLog: unknown[];
  toolResults: ModelVisibleToolResult[];
  close(): Promise<void>;
}

let idCounter = 0;

type OfflineOptions = NonNullable<Parameters<typeof createDeterministicOfflineModel>[0]>;
type OfflineScript = NonNullable<OfflineOptions['script']>;
async function compose(script: OfflineScript): Promise<Composition> {
  const dir = tempDir('vict-occurrence-pipeline-');
  const dedicated = await createDedicatedMastraStore({ dataDir: dir, retention: TEST_RETENTION });
  const capability: CapabilityDefinition = {
    id: 'studio.screen.read',
    revision: '1',
    effect: 'read',
    input: {id:'test.read.input',revision:'1',expected:'typed read',descriptiveJsonSchema:{type:'object',properties:{section:{type:'string'},components:{type:'array',items:{type:'object',properties:{id:{type:'string'}}}},includeExamples:{type:'boolean'},offset:{type:'integer'}},required:['section'],additionalProperties:false},parse:(value:unknown)=>{
      const input=value as {components?:unknown;includeExamples?:unknown;offset?:unknown};const issues=[];
      if(!Array.isArray(input.components))issues.push({code:'invalid_type',path:'components',message:'not retained'});
      if(typeof input.includeExamples!=='boolean')issues.push({code:'invalid_type',path:'includeExamples',message:'not retained'});
      if(typeof input.offset!=='number')issues.push({code:'invalid_type',path:'offset',message:'not retained'});
      return issues.length?{ok:false as const,issues}:{ok:true as const,value};
    }},
    output: contract(
      'cap.notes.write.output',
      (value) => typeof value === 'object' && value !== null && 'saved' in (value as object),
    ),
    invoke: async (input: unknown) => ({ saved: true, echo: input }),
  } as CapabilityDefinition;
  const registry = new AgentProfileRegistry({
    resolveCapabilityRevision: () => true,
  });
  registry.installArtifacts([
    {
      kind: 'instructions',
      id: 'instructions.ara',
      revision: '1',
      text: 'Be deterministic and brief.',
    },
    {
      kind: 'memory-policy',
      id: 'memory-policy.ara',
      revision: '1',
      config: { lastMessages: 10, workingMemory: { enabled: false }, semanticRecall: false },
    },
  ]);
  registry.registerProfile({
    schema: 'vict.agent-profile@1',
    id: 'agent.ara.governed',
    revision: '1',
    instructions: { id: 'instructions.ara', revision: '1' },
    modelProfile: {
      id: 'model.ara',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: {},
    turnPolicy: { maxSteps: 8, maxToolCalls: 4, onLimit: 'fail-closed' },
    memoryPolicy: { id: 'memory-policy.ara', revision: '1' },
    guardrails: [],
    helperTools: [],
    capabilities: [{ id: 'studio.screen.read', revision: '1' }],
    adapter: {
      id: MASTRA_ADAPTER_COMPATIBILITY.id,
      revision: MASTRA_ADAPTER_COMPATIBILITY.revision,
      runtimePackages: { ...MASTRA_ADAPTER_COMPATIBILITY.runtimePackages },
    },
  });
  const activation = registry.activateAgentProfile({ id: 'agent.ara.governed', revision: '1' });

  const stores = createInMemoryAgentControlStores();
  await stores.actors.upsert({
    actorId: 'actor-user',
    status: 'active',
    roles: ['developer'],
    createdAt: 0,
  });
  const requester = authenticatedActorContext(await stores.actors.get('actor-user'), 'actor-user');

  const hub = new AgentStreamHub({ ledger: stores.streamLedger, clock: () => Date.now() });
  const invokeLog: unknown[] = [];
  const toolResults: ModelVisibleToolResult[] = [];
  const turnServiceRef: { current: Composition['turnService'] | undefined } = {
    current: undefined,
  };
  const composition = composeMastraTurnExecutor({
    stores,
    activation,
    hub,
    clock: () => Date.now(),
    ids: {
      turnId: () => `turn-x${(idCounter += 1)}`,
      streamId: () => `stream-x${(idCounter += 1)}`,
      invocationId: () => `inv-x${(idCounter += 1)}`,
      approvalId: () => `approval-${idCounter}`,
      idempotencyKey: () => `key-${idCounter}`,
      cancelId: () => `cancel-${idCounter}`,
    },
    agentConfig: {
      store: dedicated.store,
      threadCoordinator: new MastraThreadCoordinator(),
      modelFactory: () => {
        const model=createDeterministicOfflineModel({script});
        // The shared fixture callback has a single append-count cursor and
        // cannot observe two simultaneous message lists. Inspect only tool
        // result outputs per explicit occurrence, never request arguments.
        return {...model,doStream:(options:Parameters<typeof model.doStream>[0])=>{
          for(const message of options.prompt)if(message.role==='tool')for(const part of message.content)if(part.type==='tool-result'&&!toolResults.some(previous=>previous.toolCallId===part.toolCallId))toolResults.push({toolCallId:part.toolCallId,toolName:part.toolName,output:part.output});
          return model.doStream(options);
        }};
      },
    },
    capabilityBridge: {
      inputValidationFeedback:()=>({fields:['components','includeExamples','offset'],expectedHints:['Use the field type declared in this tool input schema.'],format:(issues:unknown)=>({code:'VICT_TOOL_INPUT_INVALID',issues:(issues as {path:readonly(string|number)[];rule:string}[]).map(issue=>({...issue,expected:'Use the field type declared in this tool input schema.'}))})}),
      resolveCapability: (id: string, revision: string) =>
        id === capability.id && revision === capability.revision ? capability : undefined,
      invoke: async (definition: CapabilityDefinition, input: unknown) => {
        void definition;
        invokeLog.push(input);
        return capability.invoke(input, {} as never);
      },
      recordInvocationIntent: (
        input: Parameters<CapabilityBridgeDeps['recordInvocationIntent']>[0],
      ) => turnServiceRef.current?.recordToolInvocationIntent(input) as never,
      claimInvocationRun: (command: Parameters<CapabilityBridgeDeps['claimInvocationRun']>[0]) =>
        stores.invocations.claimInvocationRun(command),
      settleInvocationRun: (command: Parameters<CapabilityBridgeDeps['settleInvocationRun']>[0]) =>
        stores.invocations.settleInvocationRun(command),
      settleInvocationPending: (
        command: Parameters<CapabilityBridgeDeps['settleInvocationPending']>[0],
      ) => stores.invocations.settleInvocationPending(command),
      reconcileAbandonedRun: (
        command: Parameters<CapabilityBridgeDeps['reconcileAbandonedRun']>[0],
      ) => stores.invocations.reconcileAbandonedRun(command),
      updateInvocationStatus: (
        command: Parameters<CapabilityBridgeDeps['updateInvocationStatus']>[0],
      ) => stores.invocations.updateInvocationStatus(command),
      pollIntervalMs: 5,
      approvalExpiryMs: 30_000,
    } as never,
  });
  turnServiceRef.current = composition.turnService;
  return {
    stores,
    requester,
    turnService: composition.turnService,
    capabilityTools: composition.capabilityTools as Record<string, unknown>,
    capability,
    invokeLog,
    toolResults,
    close: async () => {
      await composition.productAgent.flush();
      await dedicated.close();
    },
  };
}


describe('actual executor validation feedback arrival',()=>{
 it('delivers safe schema repair feedback to the model, then admits a correctly typed read without invoking the rejected one',async()=>{
  const secret='private-invalid-argument-canary';
  const valid={section:'contracts',components:[{id:'vict.flow.workspace'}],includeExamples:false,offset:0};
  const warnings:unknown[][]=[];const loggers=(['warn','error','log','info','debug'] as const).map(method=>vi.spyOn(console,method).mockImplementation((...args)=>warnings.push(args)));
  const composition=await compose({'read and repair':{kind:'tool-chain',calls:[{toolName:'studio_screen_read',args:{section:'contracts',components:secret,includeExamples:'false',offset:'0'}},{toolName:'studio_screen_read',args:valid}],thenText:'Offline repair sequence finished.'}});
  try{
   const started=await composition.turnService.startTurn(composition.requester,{threadId:'feedback-arrival',input:'read and repair'});const outcome=await started.outcomePromise;
   const modelOutputs=composition.toolResults.map(result=>JSON.stringify(result.output));
   const report={status:outcome.status,modelResultCount:modelOutputs.length,feedbackArrived:modelOutputs.some(text=>text.includes('VICT_TOOL_INPUT_INVALID')),rawArgumentEcho:modelOutputs.some(text=>text.includes(secret)||text.includes('Provided arguments:')),validInvocations:composition.invokeLog.length,results:modelOutputs.map(text=>({feedback:text.includes('VICT_TOOL_INPUT_INVALID'),error:text.includes('error'),saved:text.includes('saved'),length:text.length}))};
   expect(report.feedbackArrived,JSON.stringify(report)).toBe(true);expect(report.rawArgumentEcho,JSON.stringify(report)).toBe(false);expect(JSON.stringify(warnings).includes(secret)||JSON.stringify(warnings).includes('Provided arguments:'),'Upstream log contained raw validation arguments').toBe(false);
   expect(composition.invokeLog,JSON.stringify(report)).toEqual([valid]);
   const invocations=await composition.stores.invocations.listInvocationsForTurn(started.turn.turnId);expect(invocations).toHaveLength(1);expect(invocations[0]?.status).toBe('completed');
   const ledger=await composition.stores.streamLedger.listEventsFrom(started.turn.streamId,0);expect(ledger.filter(row=>row.kind==='tool.failed')).toHaveLength(1);expect(ledger.filter(row=>row.kind==='tool.completed')).toHaveLength(1);
  }finally{await composition.close();loggers.forEach(logger=>logger.mockRestore());}
 },120000);
 it('keeps simultaneous invalid reads and their correctly typed retries correlated in separate turns',async()=>{
  const secret='parallel-private-argument-canary';
  const a={section:'contracts',components:[],includeExamples:false,offset:1},b={...a,offset:2};
  const logs:unknown[][]=[];const loggers=(['warn','error','log','info','debug'] as const).map(method=>vi.spyOn(console,method).mockImplementation((...args)=>logs.push(args)));
  const composition=await compose({'read A':{kind:'tool-chain',calls:[{toolName:'studio_screen_read',toolCallId:'a-invalid',args:{...a,components:secret}},{toolName:'studio_screen_read',toolCallId:'a-valid',args:a}],thenText:'A checked.'},'read B':{kind:'tool-chain',calls:[{toolName:'studio_screen_read',toolCallId:'b-invalid',args:{...b,offset:secret}},{toolName:'studio_screen_read',toolCallId:'b-valid',args:b}],thenText:'B checked.'}});
  try{
   const started=await Promise.all(['A','B'].map(name=>composition.turnService.startTurn(composition.requester,{threadId:`feedback-parallel-${name}`,input:`read ${name}`})));const outcomes=await Promise.all(started.map(turn=>turn.outcomePromise));
   const outputs=new Map(composition.toolResults.map(result=>[result.toolCallId,JSON.stringify(result.output)]));
   const summary=JSON.stringify({outcomes:outcomes.map(outcome=>({status:outcome.status,errorCode:'errorCode'in outcome?outcome.errorCode:undefined})),ids:[...outputs.keys()],invocations:composition.invokeLog.length});
   expect(outputs.has('a-invalid'),summary).toBe(true);expect(outputs.has('b-invalid'),summary).toBe(true);
   expect(outputs.get('a-invalid')).toContain('components');expect(outputs.get('a-invalid')).not.toContain('offset');expect(outputs.get('b-invalid')).toContain('offset');expect(outputs.get('b-invalid')).not.toContain('components');
   expect([...outputs.values()].some(text=>text.includes(secret)||text.includes('Provided arguments:'))).toBe(false);expect(JSON.stringify(logs).includes(secret)||JSON.stringify(logs).includes('Provided arguments:')).toBe(false);
   expect(composition.invokeLog).toHaveLength(2);expect(composition.invokeLog).toContainEqual(a);expect(composition.invokeLog).toContainEqual(b);
   for(const turn of started){expect(await composition.stores.invocations.listInvocationsForTurn(turn.turn.turnId)).toHaveLength(1);const rows=await composition.stores.streamLedger.listEventsFrom(turn.turn.streamId,0);expect(rows.filter(row=>row.kind==='tool.failed')).toHaveLength(1);expect(rows.filter(row=>row.kind==='tool.completed')).toHaveLength(1);}
  }finally{await composition.close();loggers.forEach(logger=>logger.mockRestore());}
 },120000);

});
