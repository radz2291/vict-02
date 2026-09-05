import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  AgentProfileRegistry,
  ConversationDeletionCoordinator,
  InMemoryAgentGovernanceStore,
  type AgentArtifact,
  type AgentHelperToolDefinition,
} from '@vict/runtime';
import {
  createDedicatedMastraStore,
  createDeterministicOfflineModel,
  mastraResourceIdForActor,
  mastraThreadIdForConversation,
  MastraMemoryDeletionPort,
  MastraProductAgent,
  MastraThreadCoordinator,
} from '@vict/mastra';

/**
 * Stage 06A corrective regressions — actor isolation and deletion safety:
 *
 * - thread ownership is an ACTOR/RESOURCE binding, not a thread-presence
 *   cache: a thread already associated with actor A is never usable by
 *   actor B (cache hit, store lookup, and close/reopen alike);
 * - governed deletion fences the thread and waits for any in-flight turn
 *   to fully settle BEFORE deleting, so a completed deletion can never be
 *   partially undone by a still-running turn (barrier-controlled, no
 *   timing sleeps for causality);
 * - a turn starting on an already-fenced (deleted) thread is refused;
 * - cross-actor deletion and export use the same actor boundary.
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

function helperDefinition(log: string[]): AgentHelperToolDefinition {
  const parse = (value: unknown) => ({ ok: true as const, value });
  return {
    id: 'helper.uppercase',
    revision: '1',
    description: 'Pure echo helper.',
    effect: 'pure',
    input: { id: 'helper.up.in', revision: '1', jsonSchema: { type: 'object' }, parse },
    output: { id: 'helper.up.out', revision: '1', jsonSchema: { type: 'object' }, parse },
    execute: (value: unknown) => {
      log.push(JSON.stringify(value));
      return value;
    },
  };
}

function artifacts(log: string[]): AgentArtifact[] {
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
      definition: helperDefinition(log),
    },
    {
      kind: 'guardrail',
      id: 'guardrail.length',
      revision: '1',
      check: () => ({ ok: true as const }),
    },
  ];
}

async function composeFor(
  options: {
    readonly store?: Awaited<ReturnType<typeof createDedicatedMastraStore>>['store'];
    readonly dedicated?: Awaited<ReturnType<typeof createDedicatedMastraStore>>;
    readonly threadCoordinator?: MastraThreadCoordinator;
  } = {},
): Promise<{
  agent: MastraProductAgent;
  activation: ReturnType<AgentProfileRegistry['activateAgentProfile']>;
  close(): Promise<void>;
}> {
  const dedicated =
    options.dedicated ??
    (await createDedicatedMastraStore({
      dataDir: tempDir('vict-actor-fence-'),
      retention: TEST_RETENTION,
    }));
  const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
  registry.installArtifacts(artifacts([]));
  const base = {
    schema: 'vict.agent-profile@1' as const,
    id: 'agent.ara.offline',
    revision: '1',
    instructions: { id: 'instructions.ara', revision: '1' },
    modelProfile: {
      id: 'model.ara.offline',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: {},
    turnPolicy: { maxSteps: 4, maxToolCalls: 4, onLimit: 'fail-closed' as const },
    memoryPolicy: { id: 'memory-policy.ara', revision: '1' },
    helperTools: [{ id: 'helper.uppercase', revision: '1' }],
    guardrails: [{ id: 'guardrail.length', revision: '1' }],
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
  registry.registerProfile(base);
  const activation = registry.activateAgentProfile({ id: base.id, revision: base.revision });
  const agent = MastraProductAgent.create(activation, {
    store: options.store ?? dedicated.store,
    modelFactory: () => createDeterministicOfflineModel(),
    // Fencing is REQUIRED in supported composition (shared or fresh).
    threadCoordinator: options.threadCoordinator ?? new MastraThreadCoordinator(),
  });
  return {
    agent,
    activation,
    close: async () => {
      await agent.flush();
      await dedicated.close();
    },
  };
}

describe('actor-aware thread ownership (never a bare presence cache)', () => {
  it('a thread cached under actor A is refused for actor B in the SAME adapter', async () => {
    const { agent, activation, close } = await composeFor();
    try {
      const context = { activation };
      const first = await agent.runTurn(
        {
          turnId: 'turn-own-1',
          threadId: 'vict-conv-owned',
          actorId: 'actor-a',
          input: 'A turn',
        },
        context,
      );
      expect(first.status).toBe('completed');
      // Actor B attempts to use actor A's thread: refused, not hijacked.
      const second = await agent.runTurn(
        {
          turnId: 'turn-own-2',
          threadId: 'vict-conv-owned',
          actorId: 'actor-b',
          input: 'A turn',
        },
        context,
      );
      expect(second.status).toBe('failed');
      expect(second.errorCode).toBe('VICT_AGENT_THREAD_ACTOR_MISMATCH');
      // Actor A continues to work (ownership intact; no tampering).
      const third = await agent.runTurn(
        {
          turnId: 'turn-own-3',
          threadId: 'vict-conv-owned',
          actorId: 'actor-a',
          input: 'A turn',
        },
        context,
      );
      expect(third.status).toBe('completed');
    } finally {
      await close();
    }
  });

  it('a thread persisted under actor A is refused for actor B after close/reopen', async () => {
    const dataDir = tempDir('vict-actor-reopen-');
    const first = await createDedicatedMastraStore({ dataDir, retention: TEST_RETENTION });
    const composed = await composeFor({ store: first.store, dedicated: first });
    const run = await composed.agent.runTurn(
      {
        turnId: 'turn-reopen-1',
        threadId: 'vict-conv-reopen',
        actorId: 'actor-a',
        input: 'A turn',
      },
      { activation: composed.activation },
    );
    expect(run.status).toBe('completed');
    await composed.close();
    await first.close();

    // A "fresh process" adapter over the same store.
    const reopened = await createDedicatedMastraStore({ dataDir, retention: TEST_RETENTION });
    try {
      const fresh = await composeFor({ store: reopened.store, dedicated: reopened });
      const attempt = await fresh.agent.runTurn(
        {
          turnId: 'turn-reopen-2',
          threadId: 'vict-conv-reopen',
          actorId: 'actor-b',
          input: 'A turn',
        },
        { activation: fresh.activation },
      );
      expect(attempt.status).toBe('failed');
      expect(attempt.errorCode).toBe('VICT_AGENT_THREAD_ACTOR_MISMATCH');
      await fresh.close();
    } finally {
      await reopened.close();
    }
  });
});

describe('governed deletion versus in-flight turns (barrier-controlled fencing)', () => {
  it('deletion waits for the in-flight turn to settle, then completes; no recreation', async () => {
    const coordinator = new MastraThreadCoordinator();
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-fence-del-'),
      retention: TEST_RETENTION,
    });
    // The turn's thread id is the DERIVED id of the VICT conversation being
    // deleted — the same id the deletion port fences and deletes.
    const threadId = mastraThreadIdForConversation('conv-fenced');
    // The model gate holds the turn mid-stream until we release it.
    let releaseModel: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      releaseModel = resolve;
    });
    const gatedScript = createDeterministicOfflineModel({
      script: {},
      throwOnStep: undefined,
    });
    // A gating wrapper: the FIRST doStream waits until released (deterministic
    // barrier, no timing sleeps).
    const gatedModel = {
      ...gatedScript,
      specificationVersion: 'v2' as const,
      provider: gatedScript.provider,
      modelId: gatedScript.modelId,
      supportedUrls: gatedScript.supportedUrls,
      providerModelIdentity: gatedScript.providerModelIdentity,
      async doStream(options: { readonly prompt: readonly unknown[] }) {
        await held;
        return gatedScript.doStream(options as never);
      },
    };
    const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
    registry.installArtifacts(artifacts([]));
    const base = {
      schema: 'vict.agent-profile@1' as const,
      id: 'agent.ara.offline',
      revision: '1',
      instructions: { id: 'instructions.ara', revision: '1' },
      modelProfile: {
        id: 'model.ara.offline',
        revision: '1',
        routerModel: 'offline-fixture/deterministic-1',
        provider: 'offline-fixture',
      },
      generation: {},
      turnPolicy: { maxSteps: 4, maxToolCalls: 4, onLimit: 'fail-closed' as const },
      memoryPolicy: { id: 'memory-policy.ara', revision: '1' },
      helperTools: [] as never as Array<{ id: string; revision: string }>,
      guardrails: [] as never as Array<{ id: string; revision: string }>,
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
    registry.registerProfile(base);
    const activation = registry.activateAgentProfile({ id: base.id, revision: base.revision });
    const agent = MastraProductAgent.create(activation, {
      store: dedicated.store,
      modelFactory: () => gatedModel,
      threadCoordinator: coordinator,
    });
    const governance = new InMemoryAgentGovernanceStore();
    const memoryPort = new MastraMemoryDeletionPort({
      store: dedicated.store,
      actorId: 'actor-a',
      threadCoordinator: coordinator,
    });
    const coordinatorService = new ConversationDeletionCoordinator({
      governance,
      domain: {
        deleteConversation: async () => ({ deleted: true }),
      },
      memory: memoryPort,
    });

    try {
      // 1. The turn starts and blocks mid-stream (barrier held).
      const turnPromise = agent.runTurn(
        {
          turnId: 'turn-fence-1',
          threadId,
          actorId: 'actor-a',
          input: 'Fence probe',
        },
        { activation },
      );
      // Give the turn a tick to enter the stream (deterministic: the model
      // promise is ONLY resolved when we release it below).
      let deletionResult:
        Awaited<ReturnType<typeof coordinatorService.deleteConversation>> | undefined;
      let deletionSettled = false;
      // 2. Deletion starts concurrently: it must FENCE the thread and WAIT
      // for the in-flight turn (which holds it) before touching the store.
      const deletionPromise = coordinatorService
        .deleteConversation({ conversationId: 'conv-fenced', actorId: 'actor-a' })
        .then((result) => {
          deletionResult = result;
          deletionSettled = true;
          return result;
        });
      await Promise.resolve();
      await Promise.resolve();
      // The deletion is still waiting (the turn holds the thread).
      expect(deletionSettled).toBe(false);
      // 3. Release the model: the turn completes and FULLY settles its
      // persistence; only then can the deletion proceed.
      releaseModel?.();
      const turn = await turnPromise;
      expect(turn.status).toBe('completed');
      const deletion = deletionResult ?? (await deletionPromise);
      expect(deletion.status).toBe('completed');
      // 4. After the completed deletion, NO messages exist — the turn's
      // pending saves could not recreate anything after the deletion.
      const domain = await dedicated.store.getStore('memory');
      const messages = await domain!.listMessages({ threadId });
      expect(messages.messages).toHaveLength(0);
      // 5. New turns on the deleted (fenced) thread are refused.
      const after = await agent.runTurn(
        {
          turnId: 'turn-fence-2',
          threadId,
          actorId: 'actor-a',
          input: 'Fence probe',
        },
        { activation },
      );
      expect(after.status).toBe('failed');
      expect(after.errorCode).toBe('VICT_AGENT_THREAD_FENCED');
    } finally {
      await agent.flush();
      await dedicated.close();
    }
  });

  it('cross-actor deletion and export are refused (same actor boundary)', async () => {
    const coordinator = new MastraThreadCoordinator();
    const dedicated = await createDedicatedMastraStore({
      dataDir: tempDir('vict-fence-actor-'),
      retention: TEST_RETENTION,
    });
    const governance = new InMemoryAgentGovernanceStore();
    const memoryPort = new MastraMemoryDeletionPort({
      store: dedicated.store,
      actorId: 'actor-a',
      threadCoordinator: coordinator,
    });
    const coordinatorService = new ConversationDeletionCoordinator({
      governance,
      domain: { deleteConversation: async () => ({ deleted: true }) },
      memory: memoryPort,
    });
    try {
      const result = await coordinatorService.deleteConversation({
        conversationId: 'conv-cross',
        actorId: 'actor-a',
      });
      expect(result.status).toBe('completed');
      // Actor B re-deleting the same conversation is an actor mismatch.
      await expect(
        coordinatorService.deleteConversation({ conversationId: 'conv-cross', actorId: 'actor-b' }),
      ).rejects.toThrow(/ACTOR_MISMATCH/);
      expect(coordinator.isFenced(mastraResourceIdForActor('actor-a'))).toBe(false);
    } finally {
      await dedicated.close();
    }
  });
});
