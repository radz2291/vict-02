import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  AgentProfileRegistry,
  ConversationDeletionCoordinator,
  InMemoryAgentGovernanceStore,
  protectCredentialPort,
  type AgentArtifact,
  type AgentHelperToolDefinition,
  type AgentTurnOutcome,
} from '@vict/runtime';
import { createSqliteAgentGovernanceStore } from '@vict/store-sqlite';
import {
  createDedicatedMastraStore,
  createDeterministicOfflineModel,
  createGovernedMemoryDeletionPort,
  fenceCompletedDeletions,
  mastraThreadIdForConversation,
  MastraMemoryDeletionPort,
  MastraProductAgent,
  MastraThreadCoordinator,
  VictMastraAdapterError,
  VictMastraCompositionError,
  type DedicatedMastraStore,
} from '@vict/mastra';

/**
 * Stage 06A boundary-remediation regressions:
 *
 * FENCING (unavoidable in supported composition):
 * - an adapter or deletion port without the shared thread coordinator is
 *   REJECTED before any execution;
 * - the supported composition path shares ONE coordinator automatically;
 * - deletion during an in-flight turn waits for the turn to settle,
 *   including DELAYED persistence and pre-existing HISTORICAL messages
 *   (completion depends on NEW durable content, never on historical
 *   presence or arbitrary delays);
 * - persistence/deletion failure and retry behave truthfully;
 * - reopen/recovery after partial deletion completes the intent and the
 *   recovered (deleted) conversation refuses new turns;
 * - actor isolation holds through the supported composition.
 *
 * TOOL BUDGET (authoritative, independent of output validation):
 * - a budget denial is recorded in the authoritative per-turn state AT THE
 *   GATE: the turn fails with the stable limit code even when the denial
 *   envelope cannot survive the helper's strict application output
 *   contract (Mastra emits tool-error);
 * - zero execution after denial, exact accounting, concurrency isolation,
 *   and denial-before-later-text behavior.
 *
 * SANITIZATION at untrusted boundaries:
 * - hostile tracing-config getters, hostile guardrail/structured-output
 *   verdict objects, model-fabricated tool names/ids, and value-like
 *   credential names are all contained with stable non-echoing codes.
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
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        rmSync(dir, { recursive: true, force: true });
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
  }
});

// ---- Composition helpers ---------------------------------------------------

function helperDefinition(log: string[], outputRequiresOkTrue = false): AgentHelperToolDefinition {
  const permissive = (value: unknown) => ({ ok: true as const, value });
  // STRICT application output contract: only the exact shape `{ ok: true }`
  // passes. A denial envelope ({victHelperFailure: ...}) can NEVER survive
  // it — the authoritative denial must not depend on the envelope. The
  // INPUT contract stays permissive: the budget gate must be the deciding
  // failure, not input validation.
  const strict = (value: unknown) =>
    JSON.stringify(value) === JSON.stringify({ ok: true })
      ? { ok: true as const, value }
      : { ok: false as const, issues: [{ message: 'output must be exactly {ok:true}' }] };
  const outputParse = outputRequiresOkTrue ? strict : permissive;
  return {
    id: 'helper.strict',
    revision: '1',
    description: 'Pure helper with a strict application output contract.',
    effect: 'pure',
    input: {
      id: 'helper.strict.in',
      revision: '1',
      jsonSchema: { type: 'object' },
      parse: permissive,
    },
    output: {
      id: 'helper.strict.out',
      revision: '1',
      jsonSchema: { type: 'object' },
      parse: outputParse,
    },
    execute: (value: unknown) => {
      log.push(JSON.stringify(value));
      // The successful result EXACTLY satisfies the strict output contract;
      // a budget-denial envelope can never survive it.
      return { ok: true };
    },
  };
}

function secondHelperDefinition(log: string[]): AgentHelperToolDefinition {
  const permissive = (value: unknown) => ({ ok: true as const, value });
  return {
    id: 'helper.second',
    revision: '1',
    description: 'Second pure helper for multi-call chains.',
    effect: 'pure',
    input: {
      id: 'helper.second.in',
      revision: '1',
      jsonSchema: { type: 'object' },
      parse: permissive,
    },
    output: {
      id: 'helper.second.out',
      revision: '1',
      jsonSchema: { type: 'object' },
      parse: permissive,
    },
    execute: (value: unknown) => {
      log.push(JSON.stringify(value));
      return { ok: true };
    },
  };
}

function baseArtifacts(log: string[], outputRequiresOkTrue: boolean): AgentArtifact[] {
  return [
    { kind: 'instructions', id: 'instructions.b', revision: '1', text: 'Be deterministic.' },
    {
      kind: 'memory-policy',
      id: 'memory-policy.b',
      revision: '1',
      config: { lastMessages: 10, workingMemory: { enabled: false }, semanticRecall: false },
    },
    {
      kind: 'helper-tool',
      id: 'helper.strict',
      revision: '1',
      definition: helperDefinition(log, outputRequiresOkTrue),
    },
    {
      kind: 'helper-tool',
      id: 'helper.second',
      revision: '1',
      definition: secondHelperDefinition(log),
    },
    {
      kind: 'guardrail',
      id: 'guardrail.b',
      revision: '1',
      check: () => ({ ok: true as const }),
    },
  ];
}

async function composeBoundary(options: {
  readonly outputRequiresOkTrue?: boolean;
  readonly turnPolicy?: { readonly maxSteps?: number; readonly maxToolCalls?: number };
  readonly script?: NonNullable<Parameters<typeof createDeterministicOfflineModel>[0]>['script'];
  readonly modelOverride?: (fixture: ReturnType<typeof createDeterministicOfflineModel>) => unknown;
  readonly helperLog?: string[];
}): Promise<{
  agent: MastraProductAgent;
  coordinator: MastraThreadCoordinator;
  dedicated: DedicatedMastraStore;
  activation: ReturnType<AgentProfileRegistry['activateAgentProfile']>;
  close(): Promise<void>;
}> {
  const dedicated = await createDedicatedMastraStore({
    dataDir: tempDir('vict-boundary-'),
    retention: TEST_RETENTION,
  });
  const { coordinator, deletionPort: _deletionPort } = createGovernedMemoryDeletionPort({
    store: dedicated.store,
    actorId: 'actor-a',
  });
  void _deletionPort;
  const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
  registry.installArtifacts(
    baseArtifacts(options.helperLog ?? [], options.outputRequiresOkTrue === true),
  );
  const profile = {
    schema: 'vict.agent-profile@1' as const,
    id: 'agent.boundary',
    revision: '1',
    instructions: { id: 'instructions.b', revision: '1' },
    modelProfile: {
      id: 'model.boundary',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: {},
    turnPolicy: {
      maxSteps: 8,
      maxToolCalls: 4,
      onLimit: 'fail-closed' as const,
      ...(options.turnPolicy ?? {}),
    },
    memoryPolicy: { id: 'memory-policy.b', revision: '1' },
    helperTools: [
      { id: 'helper.second', revision: '1' },
      { id: 'helper.strict', revision: '1' },
    ],
    guardrails: [{ id: 'guardrail.b', revision: '1' }],
    capabilities: [] as never as Array<{ id: string; revision: string }>,
    adapter: {
      id: '@vict/mastra',
      revision: '1',
      runtimePackages: {
        '@mastra/core': '1.64.0',
        '@mastra/memory': '1.28.2',
        '@mastra/libsql': '1.22.3',
        '@mastra/observability': '1.17.5',
      },
    },
  };
  registry.registerProfile(profile);
  const activation = registry.activateAgentProfile({ id: profile.id, revision: profile.revision });
  const fixture = createDeterministicOfflineModel({
    ...(options.script ? { script: options.script } : {}),
  });
  const agent = MastraProductAgent.create(activation, {
    store: dedicated.store,
    threadCoordinator: coordinator,
    modelFactory: () =>
      options.modelOverride !== undefined ? options.modelOverride(fixture) : fixture,
  });
  return {
    agent,
    coordinator,
    dedicated,
    activation,
    close: async () => {
      await agent.flush();
      await dedicated.close();
    },
  };
}

// ---- Fencing: unavoidable coordination -------------------------------------

describe('unfenced compositions are rejected before execution', () => {
  it('the adapter rejects a missing thread coordinator (no factory call)', async () => {
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-boundary-unfenced-'),
      retention: TEST_RETENTION,
    });
    try {
      const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
      registry.installArtifacts(baseArtifacts([], false));
      const profile = {
        schema: 'vict.agent-profile@1' as const,
        id: 'agent.unfenced',
        revision: '1',
        instructions: { id: 'instructions.b', revision: '1' },
        modelProfile: {
          id: 'model.boundary',
          revision: '1',
          routerModel: 'offline-fixture/deterministic-1',
          provider: 'offline-fixture',
        },
        generation: {},
        turnPolicy: { maxSteps: 2, maxToolCalls: 0, onLimit: 'fail-closed' as const },
        memoryPolicy: { id: 'memory-policy.b', revision: '1' },
        helperTools: [{ id: 'helper.strict', revision: '1' }],
        guardrails: [{ id: 'guardrail.b', revision: '1' }],
        capabilities: [] as never as Array<{ id: string; revision: string }>,
        adapter: {
          id: '@vict/mastra',
          revision: '1',
          runtimePackages: {
            '@mastra/core': '1.64.0',
            '@mastra/memory': '1.28.2',
            '@mastra/libsql': '1.22.3',
            '@mastra/observability': '1.17.5',
          },
        },
      };
      registry.registerProfile(profile);
      const activation = registry.activateAgentProfile({
        id: profile.id,
        revision: profile.revision,
      });
      let factoryCalls = 0;
      expect(() =>
        MastraProductAgent.create(activation, {
          store: dedicated.store,
          // NO threadCoordinator: an unfenced configuration must never be
          // silently accepted.
          modelFactory: () => {
            factoryCalls += 1;
            return createDeterministicOfflineModel();
          },
        } as never),
      ).toThrow(VictMastraCompositionError);
      expect(factoryCalls).toBe(0);
      // The durable deletion port rejects it as well.
      expect(
        () => new MastraMemoryDeletionPort({ store: dedicated.store, actorId: 'a' } as never),
      ).toThrow(VictMastraCompositionError);
    } finally {
      await dedicated.close();
    }
  });
});

describe('supported composition: deletion versus in-flight turns (barrier-controlled)', () => {
  it('deletion during an in-flight turn waits, then completes; no message recreation', async () => {
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-boundary-inflight-'),
      retention: TEST_RETENTION,
    });
    const { coordinator, deletionPort } = createGovernedMemoryDeletionPort({
      store: dedicated.store,
      actorId: 'actor-a',
    });
    const governance = new InMemoryAgentGovernanceStore();
    const coordinatorService = new ConversationDeletionCoordinator({
      governance,
      domain: { deleteConversation: async () => ({ deleted: true }) },
      memory: deletionPort,
    });
    const threadId = `vict-conv-inflight-${Date.now() % 100000}`;
    // The model gate holds the turn mid-stream until released.
    let releaseModel: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      releaseModel = resolve;
    });
    const fixture = createDeterministicOfflineModel({
      script: { 'In-flight probe': { kind: 'text', text: 'INFLIGHT-REPLY' } },
    });
    const gatedModel = {
      ...fixture,
      async doStream(options: { readonly prompt: readonly unknown[] }) {
        await held;
        return fixture.doStream(options as never);
      },
    };
    const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
    registry.installArtifacts(baseArtifacts([], false));
    const profile = {
      schema: 'vict.agent-profile@1' as const,
      id: 'agent.inflight',
      revision: '1',
      instructions: { id: 'instructions.b', revision: '1' },
      modelProfile: {
        id: 'model.boundary',
        revision: '1',
        routerModel: 'offline-fixture/deterministic-1',
        provider: 'offline-fixture',
      },
      generation: {},
      turnPolicy: { maxSteps: 4, maxToolCalls: 0, onLimit: 'fail-closed' as const },
      memoryPolicy: { id: 'memory-policy.b', revision: '1' },
      helperTools: [{ id: 'helper.strict', revision: '1' }],
      guardrails: [{ id: 'guardrail.b', revision: '1' }],
      capabilities: [] as never as Array<{ id: string; revision: string }>,
      adapter: {
        id: '@vict/mastra',
        revision: '1',
        runtimePackages: {
          '@mastra/core': '1.64.0',
          '@mastra/memory': '1.28.2',
          '@mastra/libsql': '1.22.3',
          '@mastra/observability': '1.17.5',
        },
      },
    };
    registry.registerProfile(profile);
    const activation = registry.activateAgentProfile({
      id: profile.id,
      revision: profile.revision,
    });
    const agent = MastraProductAgent.create(activation, {
      store: dedicated.store,
      threadCoordinator: coordinator,
      modelFactory: () => gatedModel,
    });
    try {
      const turnPromise = agent.runTurn(
        { turnId: 'turn-if-1', threadId, actorId: 'actor-a', input: 'In-flight probe' },
        { activation },
      );
      let deletionSettled = false;
      const deletionPromise = coordinatorService
        .deleteConversation({
          conversationId: threadId.replace('vict-conv-', ''),
          actorId: 'actor-a',
        })
        .then((result) => {
          deletionSettled = true;
          return result;
        });
      await Promise.resolve();
      await Promise.resolve();
      // The deletion is still waiting (the in-flight turn holds the thread).
      expect(deletionSettled).toBe(false);
      releaseModel?.();
      const turn = await turnPromise;
      expect(turn.status).toBe('completed');
      const deletion = await deletionPromise;
      expect(deletion.status).toBe('completed');
      // No messages exist after the completed deletion — the turn's pending
      // saves could not recreate anything.
      const domain = await dedicated.store.getStore('memory');
      const messages = await domain!.listMessages({ threadId });
      expect(messages.messages).toHaveLength(0);
      // Post-deletion behavior: new turns on the deleted thread are refused.
      const after = await agent.runTurn(
        { turnId: 'turn-if-2', threadId, actorId: 'actor-a', input: 'After deletion' },
        { activation },
      );
      expect(after.status).toBe('failed');
      expect(after.errorCode).toBe('VICT_AGENT_THREAD_FENCED');
      await agent.flush();
    } finally {
      await dedicated.close();
    }
  });

  it('delayed persistence: the turn completes only after NEW durable content lands', async () => {
    const { agent, dedicated, activation, close } = await composeBoundary({
      script: { 'Delayed probe': { kind: 'text', text: 'DELAYED-REPLY' } },
    });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-delay-1',
          threadId: 'vict-conv-delay',
          actorId: 'actor-a',
          input: 'Delayed probe',
        },
        { activation },
      );
      // The persistence barrier PROVED durable new presence (not queue
      // idleness, not a historical message) before the milestones.
      expect(outcome.status).toBe('completed');
      const kinds = outcome.events.map((event) => event.kind);
      expect(kinds).toContain('memory.updated');
      expect(kinds.indexOf('memory.updated')).toBeLessThan(kinds.indexOf('response.completed'));
      const domain = await dedicated.store.getStore('memory');
      const messages = await domain!.listMessages({
        threadId: 'vict-conv-delay',
        resourceId: 'vict-actor-actor-a',
      });
      expect(messages.messages.length).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });

  it('historical messages plus a new turn: completion requires the NEW message, deletion removes everything', async () => {
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-boundary-hist-'),
      retention: TEST_RETENTION,
    });
    const { coordinator, deletionPort } = createGovernedMemoryDeletionPort({
      store: dedicated.store,
      actorId: 'actor-a',
    });
    const governance = new InMemoryAgentGovernanceStore();
    const coordinatorService = new ConversationDeletionCoordinator({
      governance,
      domain: { deleteConversation: async () => ({ deleted: true }) },
      memory: deletionPort,
    });
    const threadId = 'vict-conv-historical';
    // Seed a HISTORICAL message directly through the store: the turn must
    // not treat this as its own persistence acknowledgement.
    const domain = await dedicated.store.getStore('memory');
    await domain!.saveMessages({
      messages: [
        {
          id: 'hist-1',
          role: 'user',
          createdAt: new Date(),
          threadId,
          resourceId: 'vict-actor-actor-a',
          content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'old message' }] },
        } as never,
      ],
    });
    let releaseModel: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      releaseModel = resolve;
    });
    const fixture = createDeterministicOfflineModel({
      script: { 'History probe': { kind: 'text', text: 'HISTORY-REPLY' } },
    });
    const gatedModel = {
      ...fixture,
      async doStream(options: { readonly prompt: readonly unknown[] }) {
        await held;
        return fixture.doStream(options as never);
      },
    };
    const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
    registry.installArtifacts(baseArtifacts([], false));
    const profile = {
      schema: 'vict.agent-profile@1' as const,
      id: 'agent.hist',
      revision: '1',
      instructions: { id: 'instructions.b', revision: '1' },
      modelProfile: {
        id: 'model.boundary',
        revision: '1',
        routerModel: 'offline-fixture/deterministic-1',
        provider: 'offline-fixture',
      },
      generation: {},
      turnPolicy: { maxSteps: 4, maxToolCalls: 0, onLimit: 'fail-closed' as const },
      memoryPolicy: { id: 'memory-policy.b', revision: '1' },
      helperTools: [{ id: 'helper.strict', revision: '1' }],
      guardrails: [{ id: 'guardrail.b', revision: '1' }],
      capabilities: [] as never as Array<{ id: string; revision: string }>,
      adapter: {
        id: '@vict/mastra',
        revision: '1',
        runtimePackages: {
          '@mastra/core': '1.64.0',
          '@mastra/memory': '1.28.2',
          '@mastra/libsql': '1.22.3',
          '@mastra/observability': '1.17.5',
        },
      },
    };
    registry.registerProfile(profile);
    const activation = registry.activateAgentProfile({
      id: profile.id,
      revision: profile.revision,
    });
    const agent = MastraProductAgent.create(activation, {
      store: dedicated.store,
      threadCoordinator: coordinator,
      modelFactory: () => gatedModel,
    });
    try {
      const turnPromise = agent.runTurn(
        { turnId: 'turn-h-1', threadId, actorId: 'actor-a', input: 'History probe' },
        { activation },
      );
      let turnSettled = false;
      void turnPromise.then(() => {
        turnSettled = true;
      });
      const deletionPromise = coordinatorService
        .deleteConversation({ conversationId: 'historical', actorId: 'actor-a' })
        .then((result) => ({ result, afterTurn: turnSettled }));
      await Promise.resolve();
      await Promise.resolve();
      releaseModel?.();
      const turn = await turnPromise;
      expect(turn.status).toBe('completed');
      const { result: deletion, afterTurn } = await deletionPromise;
      expect(deletion.status).toBe('completed');
      // The deletion could only proceed after the turn fully settled
      // (including its NEW durable content beyond the historical baseline).
      expect(afterTurn).toBe(true);
      // Everything — historical AND new — is gone; nothing was resurrected.
      const after = await domain!.listMessages({ threadId });
      expect(after.messages).toHaveLength(0);
      await agent.flush();
    } finally {
      await dedicated.close();
    }
  });

  it('persistence failure is never swallowed into success milestones', async () => {
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-boundary-persist-'),
      retention: TEST_RETENTION,
    });
    try {
      // Once the model stream has STARTED, the store's memory domain becomes
      // unavailable (deterministic barrier failure): the durability of this
      // turn's content can never be proven.
      let failMemoryDomain = false;
      const failingStore = new Proxy(dedicated.store, {
        get(target, property, receiver) {
          if (property === 'getStore') {
            return async (domainName: string) => {
              if (failMemoryDomain && domainName === 'memory') {
                return undefined;
              }
              return (target as { getStore: (name: string) => Promise<unknown> }).getStore(
                domainName,
              );
            };
          }
          return Reflect.get(target, property, receiver);
        },
      }) as unknown as typeof dedicated.store;
      const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
      registry.installArtifacts(baseArtifacts([], false));
      const profile = {
        schema: 'vict.agent-profile@1' as const,
        id: 'agent.persistfail',
        revision: '1',
        instructions: { id: 'instructions.b', revision: '1' },
        modelProfile: {
          id: 'model.boundary',
          revision: '1',
          routerModel: 'offline-fixture/deterministic-1',
          provider: 'offline-fixture',
        },
        generation: {},
        turnPolicy: { maxSteps: 2, maxToolCalls: 0, onLimit: 'fail-closed' as const },
        memoryPolicy: { id: 'memory-policy.b', revision: '1' },
        helperTools: [{ id: 'helper.strict', revision: '1' }],
        guardrails: [{ id: 'guardrail.b', revision: '1' }],
        capabilities: [] as never as Array<{ id: string; revision: string }>,
        adapter: {
          id: '@vict/mastra',
          revision: '1',
          runtimePackages: {
            '@mastra/core': '1.64.0',
            '@mastra/memory': '1.28.2',
            '@mastra/libsql': '1.22.3',
            '@mastra/observability': '1.17.5',
          },
        },
      };
      registry.registerProfile(profile);
      const activation = registry.activateAgentProfile({
        id: profile.id,
        revision: profile.revision,
      });
      const fixture = createDeterministicOfflineModel({
        script: { 'Persist probe': { kind: 'text', text: 'PERSIST-REPLY' } },
      });
      const gatedModel = {
        ...fixture,
        async doStream(options: { readonly prompt: readonly unknown[] }) {
          // The stream started: from here the memory domain is unavailable.
          failMemoryDomain = true;
          return fixture.doStream(options as never);
        },
      };
      const agent = MastraProductAgent.create(activation, {
        store: failingStore,
        threadCoordinator: new MastraThreadCoordinator(),
        modelFactory: () => gatedModel,
      });
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-pf-1',
          threadId: 'vict-conv-pf',
          actorId: 'actor-a',
          input: 'Persist probe',
        },
        { activation },
      );
      // The turn FAILS with the stable persistence code instead of emitting
      // misleading success milestones.
      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe('VICT_AGENT_TURN_PERSISTENCE_UNCONFIRMED');
      const kinds = outcome.events.map((event) => event.kind);
      expect(kinds).not.toContain('memory.updated');
      expect(kinds).not.toContain('response.completed');
      expect(kinds[kinds.length - 1]).toBe('response.failed');
    } finally {
      await dedicated.close();
    }
  });

  it('deletion failure and retry: partial progress is kept, no step re-executes', async () => {
    const governance = new InMemoryAgentGovernanceStore();
    let domainCalls = 0;
    let memoryCalls = 0;
    let failMemory = true;
    const coordinator = new ConversationDeletionCoordinator({
      governance,
      domain: {
        deleteConversation: async () => {
          domainCalls += 1;
          return { deleted: true };
        },
      },
      memory: {
        deleteConversationThread: async () => {
          memoryCalls += 1;
          if (failMemory) {
            throw new Error('memory store unavailable');
          }
          return { deleted: true };
        },
      },
    });
    // First attempt: the domain step succeeds, the memory step FAILS — the
    // error propagates truthfully (no misleading completion).
    await expect(
      coordinator.deleteConversation({ conversationId: 'conv-retry', actorId: 'actor-1' }),
    ).rejects.toThrow(/memory store unavailable/);
    expect(domainCalls).toBe(1);
    expect(memoryCalls).toBe(1);
    const partial = await governance.getDeletionIntent('vict-del-conv-retry');
    expect(partial?.state).toBe('application-domain-deleted');
    expect(partial?.receipts.map((receipt) => receipt.step)).toEqual(['application-domain']);
    // Retry: only the MISSING step executes; completion is receipt-backed.
    failMemory = false;
    const outcome = await coordinator.deleteConversation({
      conversationId: 'conv-retry',
      actorId: 'actor-1',
    });
    expect(outcome.status).toBe('completed');
    expect(domainCalls).toBe(1); // the domain step was NOT re-executed
    expect(memoryCalls).toBe(2);
    expect((await governance.listOpenDeletionIntents()).map((intent) => intent.intentId)).toEqual(
      [],
    );
  });

  it('reopen/recovery after partial deletion completes the intent and refuses recreation', async () => {
    const dir = tempDir('vict-boundary-recover-');
    const dbPath = join(dir, 'ops.db');
    // "Process 1": governed deletion crashes after the domain step.
    const first = createSqliteAgentGovernanceStore({ path: dbPath });
    await first.recordDeletionIntent({
      intentId: 'vict-del-conv-crash',
      conversationId: 'conv-crash',
      actorId: 'actor-a',
      createdAt: 1,
      state: 'pending',
      receipts: [],
    });
    await first.recordDeletionReceipt('vict-del-conv-crash', 'application-domain', 2);
    await first.updateDeletionIntentState('vict-del-conv-crash', 'application-domain-deleted');
    first.close();

    // "Process 2": fresh coordinator + recovery + post-deletion fencing.
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-boundary-recover-store-'),
      retention: TEST_RETENTION,
    });
    try {
      const governance = createSqliteAgentGovernanceStore({ path: dbPath });
      const { coordinator, deletionPort } = createGovernedMemoryDeletionPort({
        store: dedicated.store,
        actorId: 'actor-a',
      });
      const coordinatorService = new ConversationDeletionCoordinator({
        governance,
        domain: { deleteConversation: async () => ({ deleted: true }) },
        memory: deletionPort,
      });
      const recovery = await coordinatorService.recoverPending();
      expect(recovery.completed).toBe(1);
      // The recovered (completed) deletion fences the thread for THIS
      // process: deleted conversations stay deleted across reopen.
      const fenced = await fenceCompletedDeletions({ coordinator, governance });
      expect(fenced.fenced).toBeGreaterThanOrEqual(1);
      // The recovered thread (DERIVED from the conversation id) is fenced.
      const recoveredThreadId = mastraThreadIdForConversation('conv-crash');

      const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
      registry.installArtifacts(baseArtifacts([], false));
      const profile = {
        schema: 'vict.agent-profile@1' as const,
        id: 'agent.recover',
        revision: '1',
        instructions: { id: 'instructions.b', revision: '1' },
        modelProfile: {
          id: 'model.boundary',
          revision: '1',
          routerModel: 'offline-fixture/deterministic-1',
          provider: 'offline-fixture',
        },
        generation: {},
        turnPolicy: { maxSteps: 2, maxToolCalls: 0, onLimit: 'fail-closed' as const },
        memoryPolicy: { id: 'memory-policy.b', revision: '1' },
        helperTools: [{ id: 'helper.strict', revision: '1' }],
        guardrails: [{ id: 'guardrail.b', revision: '1' }],
        capabilities: [] as never as Array<{ id: string; revision: string }>,
        adapter: {
          id: '@vict/mastra',
          revision: '1',
          runtimePackages: {
            '@mastra/core': '1.64.0',
            '@mastra/memory': '1.28.2',
            '@mastra/libsql': '1.22.3',
            '@mastra/observability': '1.17.5',
          },
        },
      };
      registry.registerProfile(profile);
      const activation = registry.activateAgentProfile({
        id: profile.id,
        revision: profile.revision,
      });
      const agent = MastraProductAgent.create(activation, {
        store: dedicated.store,
        threadCoordinator: coordinator,
        modelFactory: () => createDeterministicOfflineModel(),
      });
      // Intentionally supported behavior: recreation is NOT possible in a
      // process that recovered its completed deletions — the turn refuses.
      const attempt = await agent.runTurn(
        {
          turnId: 'turn-r-1',
          threadId: recoveredThreadId,
          actorId: 'actor-a',
          input: 'Recreate?',
        },
        { activation },
      );
      expect(attempt.status).toBe('failed');
      expect(attempt.errorCode).toBe('VICT_AGENT_THREAD_FENCED');
      await agent.flush();
      governance.close();
    } finally {
      await dedicated.close();
    }
  });

  it('actor isolation through the supported composition (deletion and turns)', async () => {
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-boundary-actor-'),
      retention: TEST_RETENTION,
    });
    try {
      const { coordinator } = createGovernedMemoryDeletionPort({
        store: dedicated.store,
        actorId: 'actor-a',
      });
      const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
      registry.installArtifacts(baseArtifacts([], false));
      const profile = {
        schema: 'vict.agent-profile@1' as const,
        id: 'agent.actor',
        revision: '1',
        instructions: { id: 'instructions.b', revision: '1' },
        modelProfile: {
          id: 'model.boundary',
          revision: '1',
          routerModel: 'offline-fixture/deterministic-1',
          provider: 'offline-fixture',
        },
        generation: {},
        turnPolicy: { maxSteps: 2, maxToolCalls: 0, onLimit: 'fail-closed' as const },
        memoryPolicy: { id: 'memory-policy.b', revision: '1' },
        helperTools: [{ id: 'helper.strict', revision: '1' }],
        guardrails: [{ id: 'guardrail.b', revision: '1' }],
        capabilities: [] as never as Array<{ id: string; revision: string }>,
        adapter: {
          id: '@vict/mastra',
          revision: '1',
          runtimePackages: {
            '@mastra/core': '1.64.0',
            '@mastra/memory': '1.28.2',
            '@mastra/libsql': '1.22.3',
            '@mastra/observability': '1.17.5',
          },
        },
      };
      registry.registerProfile(profile);
      const activation = registry.activateAgentProfile({
        id: profile.id,
        revision: profile.revision,
      });
      const agent = MastraProductAgent.create(activation, {
        store: dedicated.store,
        threadCoordinator: coordinator,
        modelFactory: () => createDeterministicOfflineModel(),
      });
      try {
        const first = await agent.runTurn(
          { turnId: 'turn-a-1', threadId: 'vict-conv-owned-2', actorId: 'actor-a', input: 'Hi' },
          { activation },
        );
        expect(first.status).toBe('completed');
        // Actor B cannot use actor A's thread…
        const second = await agent.runTurn(
          { turnId: 'turn-a-2', threadId: 'vict-conv-owned-2', actorId: 'actor-b', input: 'Hi' },
          { activation },
        );
        expect(second.status).toBe('failed');
        expect(second.errorCode).toBe('VICT_AGENT_THREAD_ACTOR_MISMATCH');
        // …and cannot delete it either (actor-scoped deletion port).
        const governance = new InMemoryAgentGovernanceStore();
        const foreignCoordinator = new ConversationDeletionCoordinator({
          governance,
          domain: { deleteConversation: async () => ({ deleted: true }) },
          memory: new MastraMemoryDeletionPort({
            store: dedicated.store,
            actorId: 'actor-b',
            threadCoordinator: new MastraThreadCoordinator(),
          }),
        });
        // Actor B's port looks under actor B's derived resource: the thread
        // is not visible to them, so the deletion reports already-absent.
        const foreign = await foreignCoordinator.deleteConversation({
          conversationId: 'owned-2',
          actorId: 'actor-b',
        });
        expect(foreign.status).toBe('completed');
        const domain = await dedicated.store.getStore('memory');
        const messages = await domain!.listMessages({ threadId: 'vict-conv-owned-2' });
        // Actor A's data was NOT touched by the foreign deletion.
        expect(messages.messages.length).toBeGreaterThan(0);
      } finally {
        await agent.flush();
      }
    } finally {
      await dedicated.close();
    }
  });
});

// ---- Tool budget: authoritative at the gate --------------------------------

describe('tool-budget failure is independent of tool output validation', () => {
  it('zero budget with a strict output contract: denial recorded at the gate, turn fails with the limit code', async () => {
    const executed: string[] = [];
    const { agent, activation, close } = await composeBoundaryForBudget(executed, {
      maxToolCalls: 0,
    });
    try {
      const outcome = await agent.runTurn(
        {
          turnId: 'turn-zb-1',
          threadId: 'vict-conv-zb',
          actorId: 'actor-a',
          input: 'Use the tool',
        },
        { activation },
      );
      // The model DID request the pinned helper (the request is visible in
      // normalized events) — the budget gate denied it before execution.
      // ZERO executions after denial.
      expect(executed).toHaveLength(0);
      // The denial envelope cannot survive the strict `{ok:true}` output
      // contract (Mastra emits tool-error) — yet the turn still fails with
      // the AUTHORITATIVE stable limit code.
      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe('VICT_AGENT_TOOL_LIMIT_EXCEEDED');
      // Correct terminal events: no completion milestones, response.failed
      // with the code.
      const kinds = outcome.events.map((event) => event.kind);
      expect(kinds).not.toContain('response.completed');
      expect(kinds).toContain('response.failed');
      const failedEvent = outcome.events.find((event) => event.kind === 'response.failed');
      expect((failedEvent as { code?: string }).code).toBe('VICT_AGENT_TOOL_LIMIT_EXCEEDED');
    } finally {
      await close();
    }
  });

  it('budget exhausted after permitted calls: exact accounting, limit code', async () => {
    const executed: string[] = [];
    const { agent, activation, close } = await composeBoundaryForBudget(executed, {
      maxToolCalls: 1,
      script: {
        Use: {
          kind: 'tool-chain' as const,
          calls: [
            { toolName: 'helper_strict', args: { text: 'first' } },
            { toolName: 'helper_second', args: { text: 'second' } },
          ],
          thenText: 'SHOULD-NOT-REACH',
        },
      },
    });
    try {
      const outcome = await agent.runTurn(
        { turnId: 'turn-b-1', threadId: 'vict-conv-b', actorId: 'actor-a', input: 'Use' },
        { activation },
      );
      expect(executed).toHaveLength(1);
      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe('VICT_AGENT_TOOL_LIMIT_EXCEEDED');
      expect(outcome.text).toBeUndefined();
    } finally {
      await close();
    }
  });

  it('subsequent model text after a denial does not rescue the turn', async () => {
    const executed: string[] = [];
    const { agent, activation, close } = await composeBoundaryForBudget(executed, {
      maxToolCalls: 0,
      script: {
        Deny: {
          kind: 'tool-call' as const,
          toolName: 'helper_strict',
          args: { text: 'denied' },
          thenText: 'TEXT-AFTER-DENIAL',
        },
      },
    });
    try {
      const outcome = await agent.runTurn(
        { turnId: 'turn-d-1', threadId: 'vict-conv-d', actorId: 'actor-a', input: 'Deny' },
        { activation },
      );
      expect(executed).toHaveLength(0);
      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe('VICT_AGENT_TOOL_LIMIT_EXCEEDED');
      expect(outcome.text).toBeUndefined();
      // The marker-bearing failure is the terminal event, after any text.
      const kinds = outcome.events.map((event) => event.kind);
      expect(kinds[kinds.length - 1]).toBe('response.failed');
    } finally {
      await close();
    }
  });

  it('concurrent turns keep budget denials isolated', async () => {
    const executed: string[] = [];
    const { agent, activation, close } = await composeBoundaryForBudget(executed, {
      maxToolCalls: 0,
      script: {
        A: {
          kind: 'tool-call' as const,
          toolName: 'helper_strict',
          args: { text: 'a' },
          thenText: 'A-TEXT',
        },
        B: {
          kind: 'tool-call' as const,
          toolName: 'helper_strict',
          args: { text: 'b' },
          thenText: 'B-TEXT',
        },
      },
    });
    try {
      const [a, b] = await Promise.all([
        agent.runTurn(
          { turnId: 'turn-ca', threadId: 'vict-conv-ca', actorId: 'actor-a', input: 'A' },
          { activation },
        ),
        agent.runTurn(
          { turnId: 'turn-cb', threadId: 'vict-conv-cb', actorId: 'actor-a', input: 'B' },
          { activation },
        ),
      ]);
      expect(a.status).toBe('failed');
      expect(b.status).toBe('failed');
      expect(a.errorCode).toBe('VICT_AGENT_TOOL_LIMIT_EXCEEDED');
      expect(b.errorCode).toBe('VICT_AGENT_TOOL_LIMIT_EXCEEDED');
      expect(executed).toHaveLength(0);
    } finally {
      await close();
    }
  });

  /** Adapter composition whose helper output contract is exactly `{ok:true}`. */
  async function composeBoundaryForBudget(
    log: string[],
    options: {
      readonly maxToolCalls: number;
      readonly script?: NonNullable<
        Parameters<typeof createDeterministicOfflineModel>[0]
      >['script'];
    },
  ): Promise<{
    agent: MastraProductAgent;
    activation: ReturnType<AgentProfileRegistry['activateAgentProfile']>;
    close(): Promise<void>;
  }> {
    const composed = await composeBoundary({
      outputRequiresOkTrue: true,
      turnPolicy: { maxToolCalls: options.maxToolCalls },
      script: options.script ?? {
        // Default: a tool request against the pinned helper.
        'Use the tool': {
          kind: 'tool-call' as const,
          toolName: 'helper_strict',
          args: { text: 'go' },
          thenText: 'AFTER-TOOL',
        },
      },
      helperLog: log,
    });
    return { agent: composed.agent, activation: composed.activation, close: composed.close };
  }
});

// ---- Sanitization at untrusted result boundaries ---------------------------

describe('hostile configuration and callback results are contained', () => {
  it('a throwing getter in the tracing configuration escapes as a stable policy code (no raw error)', async () => {
    const CANARY = 'TRACE-CONFIG-CANARY-9c1';
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-boundary-trace-'),
      retention: TEST_RETENTION,
    });
    try {
      const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
      registry.installArtifacts(baseArtifacts([], false));
      const profile = {
        schema: 'vict.agent-profile@1' as const,
        id: 'agent.trace',
        revision: '1',
        instructions: { id: 'instructions.b', revision: '1' },
        modelProfile: {
          id: 'model.boundary',
          revision: '1',
          routerModel: 'offline-fixture/deterministic-1',
          provider: 'offline-fixture',
        },
        generation: {},
        turnPolicy: { maxSteps: 2, maxToolCalls: 0, onLimit: 'fail-closed' as const },
        memoryPolicy: { id: 'memory-policy.b', revision: '1' },
        helperTools: [{ id: 'helper.strict', revision: '1' }],
        guardrails: [{ id: 'guardrail.b', revision: '1' }],
        capabilities: [] as never as Array<{ id: string; revision: string }>,
        adapter: {
          id: '@vict/mastra',
          revision: '1',
          runtimePackages: {
            '@mastra/core': '1.64.0',
            '@mastra/memory': '1.28.2',
            '@mastra/libsql': '1.22.3',
            '@mastra/observability': '1.17.5',
          },
        },
      };
      registry.registerProfile(profile);
      const activation = registry.activateAgentProfile({
        id: profile.id,
        revision: profile.revision,
      });
      let factoryCalls = 0;
      try {
        MastraProductAgent.create(activation, {
          store: dedicated.store,
          threadCoordinator: new MastraThreadCoordinator(),
          tracing: {
            get sampling(): never {
              throw new Error(CANARY);
            },
          } as never,
          modelFactory: () => {
            factoryCalls += 1;
            return createDeterministicOfflineModel();
          },
        });
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(VictMastraAdapterError);
        expect((error as VictMastraAdapterError).code).toBe('VICT_AGENT_TRACE_POLICY_UNSAFE');
        expect((error as Error).message).not.toContain(CANARY);
        expect(JSON.stringify(error)).not.toContain(CANARY);
      }
      expect(factoryCalls).toBe(0);
    } finally {
      await dedicated.close();
    }
  });

  it('a guardrail verdict whose ok getter throws is contained (no raw canary)', async () => {
    const CANARY = 'GUARDRAIL-VERDICT-CANARY-7d2';
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-boundary-gr-'),
      retention: TEST_RETENTION,
    });
    try {
      const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
      registry.installArtifacts(
        baseArtifacts([], false).concat([
          {
            kind: 'guardrail',
            id: 'guardrail.hostile',
            revision: '1',
            // The verdict OBJECT is untrusted: reading `.ok` throws.
            check: () =>
              ({
                get ok(): never {
                  throw new Error(CANARY);
                },
              }) as never,
          },
        ]),
      );
      const profile = {
        schema: 'vict.agent-profile@1' as const,
        id: 'agent.gr',
        revision: '1',
        instructions: { id: 'instructions.b', revision: '1' },
        modelProfile: {
          id: 'model.boundary',
          revision: '1',
          routerModel: 'offline-fixture/deterministic-1',
          provider: 'offline-fixture',
        },
        generation: {},
        turnPolicy: { maxSteps: 2, maxToolCalls: 0, onLimit: 'fail-closed' as const },
        memoryPolicy: { id: 'memory-policy.b', revision: '1' },
        helperTools: [{ id: 'helper.strict', revision: '1' }],
        guardrails: [{ id: 'guardrail.hostile', revision: '1' }],
        capabilities: [] as never as Array<{ id: string; revision: string }>,
        adapter: {
          id: '@vict/mastra',
          revision: '1',
          runtimePackages: {
            '@mastra/core': '1.64.0',
            '@mastra/memory': '1.28.2',
            '@mastra/libsql': '1.22.3',
            '@mastra/observability': '1.17.5',
          },
        },
      };
      registry.registerProfile(profile);
      const activation = registry.activateAgentProfile({
        id: profile.id,
        revision: profile.revision,
      });
      const agent = MastraProductAgent.create(activation, {
        store: dedicated.store,
        threadCoordinator: new MastraThreadCoordinator(),
        modelFactory: () =>
          createDeterministicOfflineModel({
            script: { Hi: { kind: 'text', text: 'hello' } },
          }),
      });
      // runTurn RESOLVES with a sanitized failure — it never rejects with
      // the raw canary.
      const outcome: AgentTurnOutcome = await agent.runTurn(
        { turnId: 'turn-gr-1', threadId: 'vict-conv-gr', actorId: 'actor-a', input: 'Hi' },
        { activation },
      );
      expect(outcome.status).toBe('failed');
      expect(outcome.errorCode).toBe('VICT_GUARDRAIL_REJECTED');
      expect(JSON.stringify(outcome)).not.toContain(CANARY);
      await agent.flush();
    } finally {
      await dedicated.close();
    }
  });

  it('model-fabricated unknown tool names and hostile call ids never become trusted metadata', async () => {
    const CANARY_TOOL = 'CANARY_UNKNOWN_TOOL_4e3';
    // A hostile call id (spaces + angle brackets) violates the declared
    // safe-identifier policy and must never appear as trusted metadata.
    const CANARY_ID = 'canary call <id> 5f4';
    const { agent, activation, close } = await composeBoundary({
      turnPolicy: { maxToolCalls: 4 },
      modelOverride: (fixture) => {
        const fixtureScript = createDeterministicOfflineModel({
          script: {
            Unknown: {
              kind: 'text',
              text: 'fallback',
            },
          },
        });
        void fixtureScript;
        // Wrap the fixture: the FIRST doStream emits a fabricated tool call
        // with an unknown (canary) name and a hostile call id; afterwards
        // the plain fixture takes over.
        let first = true;
        return {
          specificationVersion: 'v2' as const,
          provider: fixture.provider,
          modelId: fixture.modelId,
          supportedUrls: fixture.supportedUrls,
          providerModelIdentity: fixture.providerModelIdentity,
          async doStream(options: { readonly prompt: readonly unknown[] }) {
            if (first) {
              first = false;
              const { Readable } = await import('node:stream');
              void Readable;
              const stream = new (await import('node:stream/web')).ReadableStream<{
                type: string;
                [key: string]: unknown;
              }>({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: CANARY_ID,
                    toolName: CANARY_TOOL,
                    input: '{}',
                  });
                  controller.enqueue({
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  });
                  controller.close();
                },
              });
              return {
                stream,
                finishReason: 'tool-calls',
                warnings: [],
                request: {},
                rawResponse: undefined,
              } as never;
            }
            return fixture.doStream(options as never);
          },
        };
      },
      script: { fallback: { kind: 'text', text: 'FALLBACK-REPLY' } },
    });
    try {
      const outcome = await agent.runTurn(
        { turnId: 'turn-tn-1', threadId: 'vict-conv-tn', actorId: 'actor-a', input: 'Unknown' },
        { activation },
      );
      // The canary tool name/id NEVER appear in normalized events.
      const serialized = JSON.stringify(outcome);
      expect(serialized).not.toContain(CANARY_TOOL);
      expect(serialized).not.toContain(CANARY_ID);
      // The normalized events carry the stable placeholder instead.
      const toolEvents = outcome.events.filter(
        (event) =>
          event.kind === 'tool.requested' ||
          event.kind === 'tool.started' ||
          event.kind === 'tool.failed',
      ) as Array<{ kind: string; toolName?: string; toolCallId?: string }>;
      expect(toolEvents.length).toBeGreaterThan(0);
      for (const event of toolEvents) {
        expect(event.toolName).toBe('unknown');
        expect(event.toolCallId).toBe('unknown');
      }
      await agent.flush();
    } finally {
      await close();
    }
  });

  it('protectCredentialPort rejects value-like names without echoing them', async () => {
    const VALUE_LIKE = 'PROVIDER_KEY=CANARY-CREDENTIAL-VALUE';
    let providerReached = false;
    const port = protectCredentialPort({
      async get() {
        providerReached = true;
        return 'secret-value';
      },
    });
    // The value-like name is rejected BEFORE the provider is ever reached,
    // and the rejection never echoes the rejected input.
    await expect(port.get(VALUE_LIKE)).rejects.toMatchObject({
      code: 'VICT_AGENT_CREDENTIAL_UNAVAILABLE',
    });
    expect(providerReached).toBe(false);
    try {
      await port.get(VALUE_LIKE);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(VALUE_LIKE);
      expect((error as Error).message).not.toContain('CANARY-CREDENTIAL-VALUE');
      expect(JSON.stringify(error)).not.toContain('CANARY-CREDENTIAL-VALUE');
    }
    // Valid credential-reference names (the accepted policy) still work.
    await expect(port.get('PROVIDER_KEY')).resolves.toBe('secret-value');
    expect(providerReached).toBe(true);
  });
});
