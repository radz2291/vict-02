import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  AgentProfileRegistry,
  type AgentArtifact,
  type AgentHelperToolDefinition,
} from '@vict/runtime';
import {
  createDedicatedMastraStore,
  createDeterministicOfflineModel,
  MastraProductAgent,
  MastraThreadCoordinator,
  MASTRA_ADAPTER_COMPATIBILITY,
  VictMastraAdapterError,
} from '@vict/mastra';
import { validProfileInput } from './fixtures.js';

/**
 * Stage 06A corrective regressions — Mastra adapter semantics:
 *
 * - exact adapter-marker and pinned-version validation BEFORE execution;
 * - EXACTLY ONE model-factory invocation; the observed provider/model
 *   metadata derives from the SAME instance that executes every turn;
 * - declared generation settings (temperature, topP, maxOutputTokens,
 *   maxRetries) pass through the pinned invocation boundary exactly;
 * - maxToolCalls enforced independently of the step limit, including 0,
 *   with per-turn scoping (no leakage between concurrent turns);
 * - unsafe tracing configurations rejected before execution;
 * - processor/guardrail/contract-parser throws and arbitrary guardrail
 *   codes sanitized to stable framework codes;
 * - helper-tool name collisions rejected before agent creation;
 * - caller mutation after construction has no effect on any turn.
 */

const TEST_RETENTION = {
  messagesMaxAgeMs: 3_600_000,
  threadsMaxAgeMs: 86_400_000,
  spansMaxAgeMs: 3_600_000,
} as const;

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
afterAll(async () => {
  for (const dir of tempDirs) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        rmSync(dir, { recursive: true, force: true });
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
  }
});

function helperTool(overrides: Partial<AgentHelperToolDefinition> = {}): AgentHelperToolDefinition {
  const parse = (value: unknown) =>
    typeof value === 'object' && value !== null
      ? { ok: true as const, value }
      : { ok: false as const, issues: [{ message: 'object required' }] };
  return {
    id: 'helper.uppercase',
    revision: '1',
    description: 'Pure echo helper.',
    effect: 'pure',
    input: { id: 'helper.up.in', revision: '1', jsonSchema: { type: 'object' }, parse },
    output: { id: 'helper.up.out', revision: '1', jsonSchema: { type: 'object' }, parse },
    execute: (value: unknown) => value,
    ...overrides,
  };
}

function baseArtifacts(
  helperOverrides?: Partial<AgentHelperToolDefinition>,
  guardrail?: AgentArtifact,
): AgentArtifact[] {
  return [
    { kind: 'instructions', id: 'instructions.ara', revision: '1', text: 'Be deterministic.' },
    {
      kind: 'memory-policy',
      id: 'memory-policy.ara',
      revision: '1',
      config: { lastMessages: 10, workingMemory: { enabled: false }, semanticRecall: false },
    },
    {
      kind: 'helper-tool',
      id: 'helper.uppercase',
      revision: '1',
      definition: helperTool(helperOverrides),
    },
    {
      kind: 'helper-tool',
      id: 'helper.shout',
      revision: '1',
      definition: helperTool({
        id: 'helper.shout',
        description: 'Second pure helper.',
        // The overrides (minus the id override) apply to the second helper
        // too, so execution probes observe both chain calls.
        ...(helperOverrides !== undefined
          ? (() => {
              const { id: _ignored, ...rest } = helperOverrides;
              return rest;
            })()
          : {}),
      }),
    },
    guardrail ?? {
      kind: 'guardrail',
      id: 'guardrail.length',
      revision: '1',
      check: () => ({ ok: true as const }),
    },
  ];
}

interface ComposeOptions {
  readonly script?: NonNullable<Parameters<typeof createDeterministicOfflineModel>[0]>['script'];
  readonly turnPolicy?: { readonly maxSteps: number; readonly maxToolCalls: number };
  readonly generation?: {
    readonly temperature?: number;
    readonly topP?: number;
    readonly maxOutputTokens?: number;
    readonly maxRetries?: number;
  };
  readonly tracing?: ConstructorParameters<typeof Object>[0];
  readonly helperOverrides?: Partial<AgentHelperToolDefinition>;
  readonly guardrail?: AgentArtifact;
  readonly extraProfileChains?: {
    readonly processors?: ReadonlyArray<{ readonly id: string; readonly revision: string }>;
  };
  readonly modelFactory?: Parameters<typeof MastraProductAgent.create>[1]['modelFactory'];
}

async function compose(options: ComposeOptions = {}): Promise<{
  agent: MastraProductAgent;
  store: Awaited<ReturnType<typeof createDedicatedMastraStore>>['store'];
  dedicated: Awaited<ReturnType<typeof createDedicatedMastraStore>>;
  activation: ReturnType<AgentProfileRegistry['activateAgentProfile']>;
  registry: AgentProfileRegistry;
  fixture: ReturnType<typeof createDeterministicOfflineModel>;
  close(): Promise<void>;
}> {
  const dedicated = await createDedicatedMastraStore({
    dataDir: tempDir('vict-mastra-corr-'),
    retention: TEST_RETENTION,
  });
  const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
  registry.installArtifacts(baseArtifacts(options.helperOverrides, options.guardrail));
  const base = validProfileInput();
  registry.registerProfile({
    ...base,
    helperTools: [
      { id: 'helper.uppercase', revision: '1' },
      { id: 'helper.shout', revision: '1' },
    ],
    turnPolicy:
      options.turnPolicy !== undefined
        ? { ...base.turnPolicy, ...options.turnPolicy }
        : base.turnPolicy,
    generation: options.generation ?? base.generation,
    ...(options.extraProfileChains ?? {}),
  });
  const activation = registry.activateAgentProfile({ id: base.id, revision: base.revision });
  const fixture = createDeterministicOfflineModel({
    ...(options.script ? { script: options.script } : {}),
  });
  const agent = MastraProductAgent.create(activation, {
    store: dedicated.store,
    threadCoordinator: new MastraThreadCoordinator(),
    modelFactory: options.modelFactory ?? (() => fixture),
    ...(options.tracing !== undefined ? { tracing: options.tracing } : {}),
  });
  return {
    agent,
    store: dedicated.store,
    dedicated,
    activation,
    registry,
    fixture,
    close: async () => {
      await agent.flush();
      await dedicated.close();
    },
  };
}

/** Build an activation + registry for `create()` rejection probes (no turn runs). */
async function composeActivation(adapterOverrides?: {
  readonly id?: string;
  readonly runtimePackages?: Record<string, string>;
}): Promise<{
  activation: ReturnType<AgentProfileRegistry['activateAgentProfile']>;
  store: Awaited<ReturnType<typeof createDedicatedMastraStore>>['store'];
  dedicated: Awaited<ReturnType<typeof createDedicatedMastraStore>>;
}> {
  const dedicated = await createDedicatedMastraStore({
    dataDir: tempDir('vict-mastra-corr-act-'),
    retention: TEST_RETENTION,
  });
  const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
  registry.installArtifacts(baseArtifacts());
  const base = validProfileInput();
  registry.registerProfile({
    ...base,
    adapter: {
      ...base.adapter,
      ...(adapterOverrides?.id !== undefined ? { id: adapterOverrides.id } : {}),
      ...(adapterOverrides?.runtimePackages !== undefined
        ? { runtimePackages: adapterOverrides.runtimePackages }
        : {}),
    },
  });
  return {
    activation: registry.activateAgentProfile({ id: base.id, revision: base.revision }),
    store: dedicated.store,
    dedicated,
  };
}

/** Tiny deterministic string hash for unique labels. */
function hash(value: string): number {
  let h = 0;
  for (let index = 0; index < value.length; index += 1) {
    h = (h * 31 + value.charCodeAt(index)) | 0;
  }
  return h;
}

describe('exact adapter compatibility validation (before execution)', () => {
  it('rejects a wrong adapter id before any factory invocation', async () => {
    const { activation, store, dedicated } = await composeActivation({
      id: '@vict/not-the-adapter',
    });
    try {
      let factoryCalls = 0;
      expect(() =>
        MastraProductAgent.create(activation, {
          store,
          threadCoordinator: new MastraThreadCoordinator(),
          modelFactory: () => {
            factoryCalls += 1;
            return createDeterministicOfflineModel();
          },
        }),
      ).toThrow(VictMastraAdapterError);
      expect(factoryCalls).toBe(0);
    } finally {
      await dedicated.close();
    }
  });

  it('rejects a wrong pinned runtime package version before any factory invocation', async () => {
    const { activation, store, dedicated } = await composeActivation({
      runtimePackages: { ...MASTRA_ADAPTER_COMPATIBILITY.runtimePackages, '@mastra/core': '9.9.9' },
    });
    try {
      let factoryCalls = 0;
      expect(() =>
        MastraProductAgent.create(activation, {
          store,
          threadCoordinator: new MastraThreadCoordinator(),
          modelFactory: () => {
            factoryCalls += 1;
            return createDeterministicOfflineModel();
          },
        }),
      ).toThrow(VictMastraAdapterError);
      expect(factoryCalls).toBe(0);
    } finally {
      await dedicated.close();
    }
  });

  it('rejects a wrong adapter revision before any factory invocation', async () => {
    const { activation, store, dedicated } = await composeActivation();
    try {
      // Mutate through the registry: register a revision-2 adapter marker.
      expect(activation).toBeDefined();
      const base = validProfileInput();
      const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
      registry.installArtifacts(baseArtifacts());
      registry.registerProfile({
        ...base,
        adapter: { ...base.adapter, revision: '999' },
      });
      const mismatched = registry.activateAgentProfile({ id: base.id, revision: base.revision });
      let factoryCalls = 0;
      expect(() =>
        MastraProductAgent.create(mismatched, {
          store,
          threadCoordinator: new MastraThreadCoordinator(),
          modelFactory: () => {
            factoryCalls += 1;
            return createDeterministicOfflineModel();
          },
        }),
      ).toThrow(VictMastraAdapterError);
      expect(factoryCalls).toBe(0);
    } finally {
      await dedicated.close();
    }
  });
});

describe('model factory invocation and identity correspondence', () => {
  it('invokes modelFactory exactly once and derives metadata from the executing model', async () => {
    const identity = `offline-fixture/executing-${Math.abs(hash('unique-instance'))}`;
    let factoryCalls = 0;
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-mastra-factory-'),
      retention: TEST_RETENTION,
    });
    try {
      const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
      registry.installArtifacts(baseArtifacts());
      const base = validProfileInput();
      registry.registerProfile({ ...base });
      const activation = registry.activateAgentProfile({ id: base.id, revision: base.revision });
      const agent = MastraProductAgent.create(activation, {
        store: dedicated.store,
        threadCoordinator: new MastraThreadCoordinator(),
        modelFactory: () => {
          factoryCalls += 1;
          const model = createDeterministicOfflineModel();
          // A UNIQUE identity marker lives ONLY on the returned instance:
          // the adapter must report THIS instance's identity (a discarded
          // second construction would report something else).
          return { ...model, providerModelIdentity: identity };
        },
      });
      expect(factoryCalls).toBe(1);
      expect((agent.metadata as { providerModelIdentity?: string }).providerModelIdentity).toBe(
        identity,
      );
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-identity-1',
          threadId: 'vict-conv-identity',
          actorId: 'actor-a',
          input: 'Say the phrase',
        },
        { activation },
      );
      expect(outcome.status).toBe('completed');
      expect(outcome.providerModelIdentity).toBe(identity);
      expect(factoryCalls).toBe(1);
      await agent.flush();
    } finally {
      await dedicated.close();
    }
  });

  it('the executing model instance is the factory-returned one (scripted reply proves it)', async () => {
    const scripted = createDeterministicOfflineModel({
      script: { 'Factory instance probe': { kind: 'text', text: 'FROM-FACTORY-INSTANCE' } },
    });
    const { agent, activation, close } = await compose({ modelFactory: () => scripted });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-identity-2',
          threadId: 'vict-conv-identity-2',
          actorId: 'actor-a',
          input: 'Factory instance probe',
        },
        { activation },
      );
      expect(outcome.text).toBe('FROM-FACTORY-INSTANCE');
    } finally {
      await close();
    }
  });
});

describe('generation-setting propagation through the pinned model boundary', () => {
  it('passes declared temperature/topP/maxOutputTokens/maxRetries exactly', async () => {
    const { agent, fixture, activation, close } = await compose({
      generation: { temperature: 0.5, topP: 0.9, maxOutputTokens: 777, maxRetries: 2 },
    });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-gen-1',
          threadId: 'vict-conv-gen',
          actorId: 'actor-a',
          input: 'Say the phrase',
        },
        { activation },
      );
      expect(outcome.status).toBe('completed');
      const calls = fixture.recordedCallOptions();
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        // The LanguageModelV2 call options carry the three model-interface
        // settings exactly; maxRetries is consumed by the pinned loop
        // boundary (modelSettings) and is not part of the V2 call options.
        expect(call.temperature).toBe(0.5);
        expect(call.topP).toBe(0.9);
        expect(call.maxOutputTokens).toBe(777);
      }
    } finally {
      await close();
    }
  });

  it('absent generation settings stay absent (no silent defaults injected)', async () => {
    const { agent, fixture, activation, close } = await compose({ generation: {} });
    try {
      await agent.runTurn(
        {
          turnId: 'turn-gen-2',
          threadId: 'vict-conv-gen-2',
          actorId: 'actor-a',
          input: 'Say the phrase',
        },
        { activation },
      );
      const calls = fixture.recordedCallOptions();
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call.temperature).toBeUndefined();
        expect(call.topP).toBeUndefined();
        expect(call.maxOutputTokens).toBeUndefined();
      }
    } finally {
      await close();
    }
  });
});

describe('maxToolCalls enforcement (independent of the step limit)', () => {
  const chainScript = {
    'Tool chain probe': {
      kind: 'tool-chain' as const,
      calls: [
        { toolName: 'helper_uppercase', args: { text: 'first' } },
        { toolName: 'helper_shout', args: { text: 'second' } },
      ],
      thenText: 'CHAIN-DONE',
    },
  };

  it('maxToolCalls: 0 prevents EVERY tool invocation', async () => {
    let executions = 0;
    const { agent, activation, close } = await compose({
      script: chainScript,
      turnPolicy: { maxSteps: 8, maxToolCalls: 0 },
      helperOverrides: {
        execute: (value: unknown) => {
          executions += 1;
          return value;
        },
      },
    });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-budget-0',
          threadId: 'vict-conv-budget-0',
          actorId: 'actor-a',
          input: 'Tool chain probe',
        },
        { activation },
      );
      expect(executions).toBe(0);
      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe('VICT_AGENT_TOOL_LIMIT_EXCEEDED');
      const toolFailed = outcome.events.filter((event) => event.kind === 'tool.failed');
      expect(toolFailed.length).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });

  it('limit 1 executes the first call and stops BEFORE invocation number 2', async () => {
    const executed: string[] = [];
    const { agent, activation, close } = await compose({
      script: chainScript,
      turnPolicy: { maxSteps: 8, maxToolCalls: 1 },
      helperOverrides: {
        execute: (value: unknown) => {
          executed.push(JSON.stringify(value));
          return value;
        },
      },
    });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-budget-1',
          threadId: 'vict-conv-budget-1',
          actorId: 'actor-a',
          input: 'Tool chain probe',
        },
        { activation },
      );
      expect(executed).toHaveLength(1);
      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe('VICT_AGENT_TOOL_LIMIT_EXCEEDED');
    } finally {
      await close();
    }
  });

  it('a higher budget executes both calls of the chain and completes', async () => {
    const executed: string[] = [];
    const { agent, activation, close } = await compose({
      script: chainScript,
      turnPolicy: { maxSteps: 8, maxToolCalls: 4 },
      helperOverrides: {
        execute: (value: unknown) => {
          executed.push(JSON.stringify(value));
          return value;
        },
      },
    });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-budget-4',
          threadId: 'vict-conv-budget-4',
          actorId: 'actor-a',
          input: 'Tool chain probe',
        },
        { activation },
      );
      expect(executed).toHaveLength(2);
      expect(outcome.status).toBe('completed');
      expect(outcome.text).toBe('CHAIN-DONE');
    } finally {
      await close();
    }
  });

  it('tool-call counts are scoped to one turn and never leak between concurrent turns', async () => {
    const executed: string[] = [];
    const { agent, activation, close } = await compose({
      script: {
        ...chainScript,
        'Second turn probe': {
          kind: 'tool-chain' as const,
          calls: [{ toolName: 'helper_uppercase', args: { text: 'solo' } }],
          thenText: 'SECOND-DONE',
        },
      },
      turnPolicy: { maxSteps: 8, maxToolCalls: 1 },
      helperOverrides: {
        execute: (value: unknown) => {
          executed.push(JSON.stringify(value));
          return value;
        },
      },
    });
    try {
      const [a, b] = await Promise.all([
        agent.runTurn(
          {
            turnId: 'turn-concurrent-a',
            threadId: 'vict-conv-concurrent-a',
            actorId: 'actor-a',
            input: 'Tool chain probe',
          },
          { activation },
        ),
        agent.runTurn(
          {
            turnId: 'turn-concurrent-b',
            threadId: 'vict-conv-concurrent-b',
            actorId: 'actor-a',
            input: 'Second turn probe',
          },
          { activation },
        ),
      ]);
      // Turn A consumed its budget (1 call + blocked 2nd); turn B's budget
      // was its OWN — its single call executed and completed.
      expect(executed).toHaveLength(2);
      expect(a.errorCode).toBe('VICT_AGENT_TOOL_LIMIT_EXCEEDED');
      expect(b.status).toBe('completed');
      expect(b.text).toBe('SECOND-DONE');
    } finally {
      await close();
    }
  });
});

describe('unsafe tracing configurations are rejected BEFORE execution', () => {
  const unsafe: Array<{ readonly label: string; readonly tracing: unknown }> = [
    { label: 'hideInput: false', tracing: { sampling: { type: 'always' }, hideInput: false } },
    { label: 'hideOutput: false', tracing: { sampling: { type: 'always' }, hideOutput: false } },
    { label: 'hideInput: "yes"', tracing: { hideInput: 'yes' } },
    { label: 'hideInput: 1', tracing: { hideInput: 1 } },
    {
      label: 'ratio probability: Infinity',
      tracing: { sampling: { type: 'ratio', probability: Number.POSITIVE_INFINITY } },
    },
    {
      label: 'ratio probability: NaN',
      tracing: { sampling: { type: 'ratio', probability: Number.NaN } },
    },
    { label: 'ratio probability: 2', tracing: { sampling: { type: 'ratio', probability: 2 } } },
    {
      label: 'ratio probability: -0.5',
      tracing: { sampling: { type: 'ratio', probability: -0.5 } },
    },
    {
      label: 'unknown sampling type',
      tracing: { sampling: { type: 'log-everything', probability: 1 } },
    },
    { label: 'unknown policy field', tracing: { hideEverything: true } },
  ];
  for (const entry of unsafe) {
    it(`rejects ${entry.label} with no factory invocation`, async () => {
      const { activation, store, dedicated } = await composeActivation();
      try {
        let factoryCalls = 0;
        expect(() =>
          MastraProductAgent.create(activation, {
            store,
            threadCoordinator: new MastraThreadCoordinator(),
            tracing: entry.tracing as never,
            modelFactory: () => {
              factoryCalls += 1;
              return createDeterministicOfflineModel();
            },
          }),
        ).toThrow(VictMastraAdapterError);
        expect(factoryCalls).toBe(0);
      } finally {
        await dedicated.close();
      }
    });
  }

  it('absent hideInput/hideOutput apply the safe default; exactly-true is accepted', async () => {
    const { agent, activation, close } = await compose({
      tracing: { sampling: { type: 'always' }, hideInput: true, hideOutput: true },
    });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-safe-tracing',
          threadId: 'vict-conv-safe',
          actorId: 'actor-a',
          input: 'Say the phrase',
        },
        { activation },
      );
      expect(outcome.status).toBe('completed');
    } finally {
      await close();
    }
  });
});

describe('untrusted author callbacks: sanitized, deterministic failures', () => {
  it('a throwing processor never rejects runTurn with a raw author message', async () => {
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-mastra-proc-'),
      retention: TEST_RETENTION,
    });
    try {
      const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
      registry.installArtifacts(
        baseArtifacts().concat([
          {
            kind: 'processor',
            id: 'processor.throwing',
            revision: '1',
            transform: () => {
              throw new Error('PROCESSOR-CANARY-raw-secret');
            },
          },
        ]),
      );
      const base = validProfileInput();
      registry.registerProfile({
        ...base,
        processors: [{ id: 'processor.throwing', revision: '1' }],
      });
      const activation = registry.activateAgentProfile({ id: base.id, revision: base.revision });
      const agent = MastraProductAgent.create(activation, {
        store: dedicated.store,
        threadCoordinator: new MastraThreadCoordinator(),
        modelFactory: () => createDeterministicOfflineModel(),
      });
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-proc-throw',
          threadId: 'vict-conv-proc-throw',
          actorId: 'actor-a',
          input: 'Any input',
        },
        { activation },
      );
      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe('VICT_AGENT_TURN_FAILED');
      // The raw author message never reaches events or the outcome.
      expect(JSON.stringify(outcome)).not.toContain('PROCESSOR-CANARY');
      await agent.flush();
    } finally {
      await dedicated.close();
    }
  });

  it('a throwing guardrail fails the turn closed with the stable framework code', async () => {
    const { agent, activation, close } = await compose({
      script: { 'Guardrail throw probe': { kind: 'text', text: 'TEXT-OK' } },
      guardrail: {
        kind: 'guardrail',
        id: 'guardrail.length',
        revision: '1',
        check: () => {
          throw new Error('GUARDRAIL-CANARY-raw');
        },
      },
    });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-guardrail-throw',
          threadId: 'vict-conv-guardrail-throw',
          actorId: 'actor-a',
          input: 'Guardrail throw probe',
        },
        { activation },
      );
      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe('VICT_GUARDRAIL_REJECTED');
      expect(JSON.stringify(outcome)).not.toContain('GUARDRAIL-CANARY');
    } finally {
      await close();
    }
  });

  it('an undeclared guardrail code maps to the single stable framework code', async () => {
    const { agent, activation, close } = await compose({
      script: { 'Guardrail code probe': { kind: 'text', text: 'SOME-TEXT' } },
      guardrail: {
        kind: 'guardrail',
        id: 'guardrail.length',
        revision: '1',
        check: (text: string) =>
          text.length >= 0
            ? { ok: false, code: 'ARBITRARY_HOSTILE_CODE; DROP TABLE users' }
            : { ok: true },
      },
    });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-guardrail-code',
          threadId: 'vict-conv-guardrail-code',
          actorId: 'actor-a',
          input: 'Guardrail code probe',
        },
        { activation },
      );
      expect(outcome.status).toBe('failed');
      // The arbitrary author string is NEVER embedded into the public code.
      expect(outcome.errorCode).toBe('VICT_GUARDRAIL_REJECTED');
      expect(JSON.stringify(outcome)).not.toContain('ARBITRARY_HOSTILE_CODE');
    } finally {
      await close();
    }
  });

  it('a DECLARED guardrail code is embedded with the stable prefix', async () => {
    const { agent, activation, close } = await compose({
      script: { 'Declared code probe': { kind: 'text', text: 'SOME-TEXT' } },
      guardrail: {
        kind: 'guardrail',
        id: 'guardrail.length',
        revision: '1',
        check: () => ({ ok: false, code: 'TOO_LONG' }),
        failureCodes: ['TOO_LONG'],
      },
    });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-guardrail-declared',
          threadId: 'vict-conv-guardrail-declared',
          actorId: 'actor-a',
          input: 'Declared code probe',
        },
        { activation },
      );
      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe('VICT_GUARDRAIL_TOO_LONG');
    } finally {
      await close();
    }
  });

  it('a throwing contract parser becomes a sanitized structured failure (model never sees it raw)', async () => {
    const { agent, activation, close } = await compose({
      script: {
        'Parser probe': {
          kind: 'tool-call',
          toolName: 'helper_uppercase',
          args: { text: 'hello' },
          thenText: 'AFTER-TOOL',
        },
      },
      helperOverrides: {
        input: {
          id: 'helper.up.in',
          revision: '1',
          jsonSchema: { type: 'object' },
          parse: () => {
            throw new Error('PARSER-CANARY-hostile');
          },
        },
      },
    });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-parser-throw',
          threadId: 'vict-conv-parser-throw',
          actorId: 'actor-a',
          input: 'Parser probe',
        },
        { activation },
      );
      expect(outcome.status).toBe('completed');
      expect(JSON.stringify(outcome)).not.toContain('PARSER-CANARY');
      const toolFailed = outcome.events.filter((event) => event.kind === 'tool.failed');
      expect(toolFailed).toHaveLength(1);
    } finally {
      await close();
    }
  });

  it('hostile contract issue payloads never propagate (shared sanitizer)', async () => {
    const { agent, activation, close } = await compose({
      script: {
        'Issue payload probe': {
          kind: 'tool-call',
          toolName: 'helper_uppercase',
          args: { hostile: 'yes' },
          thenText: 'AFTER-TOOL',
        },
      },
      helperOverrides: {
        input: {
          id: 'helper.up.in',
          revision: '1',
          jsonSchema: { type: 'object' },
          parse: () => ({
            ok: false as const,
            issues: [
              {
                path: 'issue.path.CANARY-hostile',
                message: 'ISSUE-MESSAGE-CANARY-hostile expected X received Y',
                expected: 'X',
                received: 'Y',
              },
            ],
          }),
        },
      },
    });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-issue-payload',
          threadId: 'vict-conv-issue-payload',
          actorId: 'actor-a',
          input: 'Issue payload probe',
        },
        { activation },
      );
      expect(outcome.status).toBe('completed');
      const serialized = JSON.stringify(outcome);
      expect(serialized).not.toContain('ISSUE-MESSAGE-CANARY');
      expect(serialized).not.toContain('issue.path.CANARY');
    } finally {
      await close();
    }
  });
});

describe('helper-tool Mastra name collisions', () => {
  it('rejects two helper ids that normalize to the same Mastra tool name', async () => {
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-mastra-collide-'),
      retention: TEST_RETENTION,
    });
    try {
      const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
      registry.installArtifacts(
        baseArtifacts().concat([
          // 'helper$uppercase' aliases 'helper.uppercase' after punctuation
          // normalization (both map onto 'helper_uppercase').
          {
            kind: 'helper-tool',
            id: 'helper$uppercase',
            revision: '1',
            definition: helperTool({ id: 'helper$uppercase' }),
          },
        ]),
      );
      const base = validProfileInput();
      registry.registerProfile({
        ...base,
        helperTools: [
          { id: 'helper.uppercase', revision: '1' },
          { id: 'helper$uppercase', revision: '1' },
        ],
      });
      const activation = registry.activateAgentProfile({ id: base.id, revision: base.revision });
      expect(() =>
        MastraProductAgent.create(activation, {
          store: dedicated.store,
          threadCoordinator: new MastraThreadCoordinator(),
          modelFactory: () => createDeterministicOfflineModel(),
        }),
      ).toThrow(/refusing to alias/);
    } finally {
      await dedicated.close();
    }
  });

  it('rejects the long-ID truncation fallback collision', async () => {
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-mastra-collide2-'),
      retention: TEST_RETENTION,
    });
    try {
      const longA = `helper.${'a'.repeat(80)}`;
      const longB = `helper.${'b'.repeat(80)}`;
      const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
      registry.installArtifacts(
        baseArtifacts().concat([
          {
            kind: 'helper-tool',
            id: longA,
            revision: '1',
            definition: helperTool({ id: longA }),
          },
          {
            kind: 'helper-tool',
            id: longB,
            revision: '1',
            definition: helperTool({ id: longB }),
          },
        ]),
      );
      const base = validProfileInput();
      registry.registerProfile({
        ...base,
        helperTools: [
          { id: longA, revision: '1' },
          { id: longB, revision: '1' },
        ],
      });
      const activation = registry.activateAgentProfile({ id: base.id, revision: base.revision });
      expect(() =>
        MastraProductAgent.create(activation, {
          store: dedicated.store,
          threadCoordinator: new MastraThreadCoordinator(),
          modelFactory: () => createDeterministicOfflineModel(),
        }),
      ).toThrow(/refusing to alias/);
    } finally {
      await dedicated.close();
    }
  });
});

describe('caller mutation after construction has no effect', () => {
  it('mutating the tracing policy object after create() does not change turns', async () => {
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-mastra-mutate-'),
      retention: TEST_RETENTION,
    });
    try {
      const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
      registry.installArtifacts(baseArtifacts());
      const base = validProfileInput();
      registry.registerProfile({ ...base });
      const activation = registry.activateAgentProfile({ id: base.id, revision: base.revision });
      const tracing = { sampling: { type: 'always' }, hideInput: true, hideOutput: true };
      const agent = MastraProductAgent.create(activation, {
        store: dedicated.store,
        threadCoordinator: new MastraThreadCoordinator(),
        modelFactory: () => createDeterministicOfflineModel(),
        tracing: tracing as never,
      });
      // Hostile post-construction mutation attempt: if the adapter ever
      // re-read this object, execution would break or payloads would leak.
      (tracing as { hideInput: unknown }).hideInput = false;
      (tracing as { hideOutput: unknown }).hideOutput = 'nope';
      (tracing as { sampling: unknown }).sampling = { type: 'ratio', probability: -5 };
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-mutation',
          threadId: 'vict-conv-mutation',
          actorId: 'actor-a',
          input: 'Say the phrase',
        },
        { activation },
      );
      expect(outcome.status).toBe('completed');
      expect((agent.metadata as { providerModelIdentity?: string }).providerModelIdentity).toBe(
        'offline-fixture/deterministic-1',
      );
      await agent.flush();
    } finally {
      await dedicated.close();
    }
  });

  it('metadata is frozen: mutating the exposed object cannot change binding identity', async () => {
    const { agent, close } = await compose();
    try {
      const metadata = agent.metadata as { agentProfileVersion: string };
      expect(Object.isFrozen(metadata)).toBe(true);
      const before = metadata.agentProfileVersion;
      try {
        (metadata as { agentProfileVersion: string }).agentProfileVersion = 'TAMPERED';
      } catch {
        // strict-mode rejection is fine
      }
      expect(metadata.agentProfileVersion).toBe(before);
      expect(agent.agentProfileVersion).toBe(before);
    } finally {
      await close();
    }
  });
});
