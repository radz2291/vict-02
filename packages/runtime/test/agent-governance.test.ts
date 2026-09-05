import { describe, expect, it } from 'vitest';
import {
  AgentCredentialError,
  AgentProfileRegistry,
  ConversationDeletionCoordinator,
  ConversationExportService,
  InMemoryAgentGovernanceStore,
  assertDeletionStateTransition,
  assertDeletionStateTransitionWithReceipts,
  protectCredentialPort,
  requireCredential,
  type AgentActivationRecord,
  type AgentConversationDomainPort,
  type AgentGovernanceStore,
  type AgentMemoryDeletionPort,
} from '../src/index.js';

/**
 * Stage 06A permanent regression: the local data-protection governance
 * foundation (MSTR-011) — credential isolation, governed deletion with
 * durable intents/receipts and injected failure at every boundary,
 * truthful partial status, idempotent recovery, and export policy.
 */

/**
 * Build a REAL activation record through the registry (never fabricated):
 * the store boundary validates the record's canonical manifest, recomputes
 * its identity, and cross-checks its fields, so conformance records must be
 * produced by the actual activation pipeline.
 */
function realActivationRecord(agentId = 'agent.governance'): AgentActivationRecord {
  const registry = new AgentProfileRegistry();
  registry.registerArtifact({
    kind: 'instructions',
    id: 'instructions.governance',
    revision: '1',
    text: 'Governance conformance instructions.',
  });
  registry.registerArtifact({
    kind: 'memory-policy',
    id: 'memory-policy.governance',
    revision: '1',
    config: { lastMessages: 5, workingMemory: { enabled: false }, semanticRecall: false },
  });
  registry.registerArtifact({
    kind: 'guardrail',
    id: 'guardrail.governance',
    revision: '1',
    check: () => ({ ok: true as const }),
  });
  registry.registerProfile({
    schema: 'vict.agent-profile@1' as const,
    id: agentId,
    revision: '1',
    instructions: { id: 'instructions.governance', revision: '1' },
    modelProfile: {
      id: 'model.governance',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: {},
    turnPolicy: { maxSteps: 2, maxToolCalls: 0, onLimit: 'fail-closed' as const },
    memoryPolicy: { id: 'memory-policy.governance', revision: '1' },
    guardrails: [{ id: 'guardrail.governance', revision: '1' }],
    helperTools: [],
    capabilities: [],
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
  });
  const activation = registry.activateAgentProfile({ id: agentId, revision: '1' });
  return {
    recordSchema: 'vict.agent-activation-record@1',
    activationVersion: activation.activationVersion,
    agentProfileVersion: activation.agentProfileVersion,
    agentId,
    agentRevision: '1',
    canonicalManifest: activation.canonicalManifestJson,
    artifacts: activation.artifactList.map((entry) => ({
      kind: entry.kind,
      id: entry.id,
      revision: entry.revision,
    })),
    createdAt: activation.createdAt,
  };
}

/** A conformance runner: every governance-store implementation must pass. */
function governanceStoreConformance(
  name: string,
  makeStore: () => AgentGovernanceStore & { close?(): Promise<void> | void },
): void {
  describe(`agent governance store — ${name}`, () => {
    it('persists and reads activation identity records idempotently', async () => {
      const store = makeStore();
      try {
        const record = realActivationRecord();
        await store.saveAgentActivation(record);
        await store.saveAgentActivation(record); // idempotent republish
        const read = await store.getAgentActivation(record.activationVersion);
        expect(read?.agentId).toBe('agent.governance');
        expect(read?.artifacts).toEqual(record.artifacts);
        // Same version, different content: collision (fail closed).
        await expect(store.saveAgentActivation({ ...record, agentId: 'other' })).rejects.toThrow(
          /collision/i,
        );
        // A FABRICATED record (made-up version hash, made-up manifest) is
        // rejected BEFORE storage: identity is recomputed from the manifest
        // bytes and cross-checked.
        const fabricated = {
          ...record,
          activationVersion: 'v1_' + 'a'.repeat(64),
          canonicalManifest: '{"schema":"vict.agent-activation@3"}',
        };
        await expect(store.saveAgentActivation(fabricated)).rejects.toThrow();
        expect(await store.getAgentActivation('v1_' + 'a'.repeat(64))).toBeUndefined();
        expect(await store.getAgentActivation('v1_' + 'c'.repeat(64))).toBeUndefined();
      } finally {
        await store.close?.();
      }
    });

    it('records deletion intents idempotently and deduplicates receipts', async () => {
      const store = makeStore();
      try {
        const intent = {
          intentId: 'vict-del-conv-1',
          conversationId: 'conv-1',
          actorId: 'actor-1',
          createdAt: 100,
          state: 'pending' as const,
          receipts: [],
        };
        await store.recordDeletionIntent(intent);
        await store.recordDeletionIntent(intent); // idempotent
        await expect(store.recordDeletionIntent({ ...intent, actorId: 'other' })).rejects.toThrow(
          /different content/i,
        );
        await store.recordDeletionReceipt(intent.intentId, 'application-domain', 200);
        await store.recordDeletionReceipt(intent.intentId, 'application-domain', 999); // duplicate: no-op
        const read = await store.getDeletionIntent(intent.intentId);
        expect(read?.receipts).toEqual([{ step: 'application-domain', at: 200 }]);
        expect(await store.listOpenDeletionIntents()).toHaveLength(1);
      } finally {
        await store.close?.();
      }
    });

    it('rejects deletion-state regressions and skipped transitions', async () => {
      const store = makeStore();
      try {
        // A NEW intent must be pending with no receipts — arbitrary initial
        // states and fabricated receipts are rejected.
        await expect(
          store.recordDeletionIntent({
            intentId: 'vict-del-fabricated',
            conversationId: 'conv-fabricated',
            actorId: 'actor-1',
            createdAt: 100,
            state: 'completed',
            receipts: [],
          }),
        ).rejects.toThrow();
        await store.recordDeletionIntent({
          intentId: 'vict-del-conv-2',
          conversationId: 'conv-2',
          actorId: 'actor-1',
          createdAt: 100,
          state: 'pending',
          receipts: [],
        });
        // Same-state updates are idempotent no-ops.
        await store.updateDeletionIntentState('vict-del-conv-2', 'pending');
        // Entering the intermediate state WITHOUT its durable receipt is
        // rejected (receipt-free two-step bypass) and leaves the state
        // unchanged.
        await expect(
          store.updateDeletionIntentState('vict-del-conv-2', 'application-domain-deleted'),
        ).rejects.toThrow(/RECEIPT_REQUIRED/);
        expect((await store.getDeletionIntent('vict-del-conv-2'))?.state).toBe('pending');
        // With the durable receipt, the stepwise advance is legal.
        await store.recordDeletionReceipt('vict-del-conv-2', 'application-domain', 150);
        await store.updateDeletionIntentState('vict-del-conv-2', 'application-domain-deleted');
        // Regression from a recorded state is refused.
        await expect(
          store.updateDeletionIntentState('vict-del-conv-2', 'pending'),
        ).rejects.toThrow();
        // Entering `completed` without BOTH receipts is rejected.
        await expect(
          store.updateDeletionIntentState('vict-del-conv-2', 'completed'),
        ).rejects.toThrow(/RECEIPT_REQUIRED/);
        expect((await store.getDeletionIntent('vict-del-conv-2'))?.state).toBe(
          'application-domain-deleted',
        );
        // With both receipts, completion is legal and receipt-backed.
        await store.recordDeletionReceipt('vict-del-conv-2', 'mastra-memory', 200);
        await store.updateDeletionIntentState('vict-del-conv-2', 'completed');
        expect((await store.getDeletionIntent('vict-del-conv-2'))?.state).toBe('completed');
        // The stepwise helper refuses skips directly.
        expect(() => assertDeletionStateTransition('completed', 'pending')).toThrow();
        // Stepwise: pending → completed skips the required intermediate
        // state and is refused; the legal steps are accepted.
        expect(() => assertDeletionStateTransition('pending', 'completed')).toThrow();
        expect(
          assertDeletionStateTransition('pending', 'application-domain-deleted'),
        ).toBeUndefined();
        expect(
          assertDeletionStateTransition('application-domain-deleted', 'completed'),
        ).toBeUndefined();
        // The receipt-enforced helper refuses the two-step receipt-free
        // bypass at the FIRST transition.
        expect(() =>
          assertDeletionStateTransitionWithReceipts('pending', 'application-domain-deleted', []),
        ).toThrow(/RECEIPT_REQUIRED/);
        expect(() =>
          assertDeletionStateTransitionWithReceipts('application-domain-deleted', 'completed', []),
        ).toThrow(/RECEIPT_REQUIRED/);
        expect(() =>
          assertDeletionStateTransitionWithReceipts('application-domain-deleted', 'completed', [
            { step: 'application-domain' },
          ]),
        ).toThrow(/RECEIPT_REQUIRED/);
        expect(
          assertDeletionStateTransitionWithReceipts('application-domain-deleted', 'completed', [
            { step: 'application-domain' },
            { step: 'mastra-memory' },
          ]),
        ).toBeUndefined();
      } finally {
        await store.close?.();
      }
    });
  });
}

governanceStoreConformance('in-memory', () => new InMemoryAgentGovernanceStore());

describe('credential isolation (protected-only resolution, MSTR-011)', () => {
  it('resolves just in time with no cross-invocation caching (rotation observed)', async () => {
    let value: string | undefined = 'first-value';
    let reads = 0;
    const raw = {
      async get(_name: string) {
        reads += 1;
        return value;
      },
    };
    const port = protectCredentialPort(raw);
    expect(await port.get('PROVIDER_KEY')).toBe('first-value');
    value = 'rotated-value';
    expect(await port.get('PROVIDER_KEY')).toBe('rotated-value');
    expect(reads).toBe(2); // every read passes through; nothing cached
    value = undefined;
    expect(await port.get('PROVIDER_KEY')).toBeUndefined();
  });

  it('converts provider failures into stable non-echoing errors without poisoning later reads', async () => {
    let failing = true;
    const port = protectCredentialPort({
      // The canary only exists inside the provider; it must never escape.
      async get(_name) {
        if (failing) {
          throw new Error('vault timeout (canary-PROVIDER-SECRET-1)');
        }
        return 'recovered-value';
      },
    });
    await expect(port.get('PROVIDER_KEY')).rejects.toMatchObject({
      code: 'VICT_AGENT_CREDENTIAL_UNAVAILABLE',
    });
    try {
      await port.get('PROVIDER_KEY');
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain('canary-PROVIDER-SECRET-1');
      expect(JSON.stringify(error)).not.toContain('canary-PROVIDER-SECRET-1');
    }
    failing = false;
    // The failed read did not poison future invocations.
    expect(await port.get('PROVIDER_KEY')).toBe('recovered-value');
  });

  it('fails with a stable diagnostic when a required credential is missing', async () => {
    const port = protectCredentialPort({
      async get() {
        return undefined;
      },
    });
    // Optional resolution is truthful about absence.
    await expect(port.get('MISSING_KEY')).resolves.toBeUndefined();
    // Required resolution fails closed with a stable diagnostic.
    expect(() => requireCredential(undefined, 'MISSING_KEY')).toThrow(AgentCredentialError);
  });
});

/** A scriptable failing port for injected-failure tests. */
function failingDomainPort(
  script: Map<string, 'ok' | 'throw'>,
  calls: string[],
): AgentConversationDomainPort {
  return {
    async deleteConversation(conversationId) {
      calls.push(`domain:${conversationId}`);
      const mode = script.get(conversationId) ?? 'ok';
      if (mode === 'throw') {
        throw new Error('domain store unavailable (canary-DOMAIN-FAILURE)');
      }
      return { deleted: true };
    },
  };
}

function failingMemoryPort(
  script: Map<string, 'ok' | 'throw'>,
  calls: string[],
): AgentMemoryDeletionPort {
  return {
    async deleteConversationThread(conversationId) {
      calls.push(`memory:${conversationId}`);
      const mode = script.get(`memory:${conversationId}`) ?? 'ok';
      if (mode === 'throw') {
        throw new Error('mastra store unavailable (canary-MEMORY-FAILURE)');
      }
      return { deleted: true };
    },
  };
}

describe('conversation deletion reconciliation (MSTR-011, §8.1)', () => {
  it('completes deletion across both stores with durable receipts', async () => {
    const governance = new InMemoryAgentGovernanceStore();
    const calls: string[] = [];
    const coordinator = new ConversationDeletionCoordinator({
      governance,
      domain: failingDomainPort(new Map<string, 'ok' | 'throw'>([['conv-1', 'ok']]), calls),
      memory: failingMemoryPort(new Map<string, 'ok' | 'throw'>([['memory:conv-1', 'ok']]), calls),
      clock: (() => {
        let tick = 1000;
        return () => (tick += 10);
      })(),
    });
    const outcome = await coordinator.deleteConversation({
      conversationId: 'conv-1',
      actorId: 'actor-1',
    });
    expect(outcome.status).toBe('completed');
    expect(outcome.completedSteps).toEqual(['application-domain', 'mastra-memory']);
    expect(calls).toEqual(['domain:conv-1', 'memory:conv-1']);
    // Re-deleting the same conversation is idempotent: no new store calls.
    calls.length = 0;
    const again = await coordinator.deleteConversation({
      conversationId: 'conv-1',
      actorId: 'actor-1',
    });
    expect(again.status).toBe('completed');
    expect(calls).toEqual([]);
  });

  it('records truthful partial status when the memory step fails, and resumes idempotently', async () => {
    const governance = new InMemoryAgentGovernanceStore();
    const calls: string[] = [];
    const memoryScript = new Map<string, 'ok' | 'throw'>([['memory:conv-2', 'throw']]);
    const coordinator = new ConversationDeletionCoordinator({
      governance,
      domain: failingDomainPort(new Map(), calls),
      memory: failingMemoryPort(memoryScript, calls),
    });
    await expect(
      coordinator.deleteConversation({ conversationId: 'conv-2', actorId: 'actor-1' }),
    ).rejects.toThrow();
    // The domain receipt is durable; the intent is open.
    const intent = await governance.getDeletionIntent('vict-del-conv-2');
    expect(intent?.state).toBe('application-domain-deleted');
    expect(intent?.receipts.map((receipt) => receipt.step)).toEqual(['application-domain']);
    expect(await governance.listOpenDeletionIntents()).toHaveLength(1);

    // Recovery: the memory store is healthy again. The domain step is NOT
    // re-executed (its receipt is authoritative) and no duplicate receipts
    // appear.
    calls.length = 0;
    memoryScript.set('memory:conv-2', 'ok' as const);
    const report = await coordinator.recoverPending();
    expect(report).toEqual({ resumed: 1, completed: 1, pending: 0 });
    expect(calls).toEqual(['memory:conv-2']);
    const final = await governance.getDeletionIntent('vict-del-conv-2');
    expect(final?.state).toBe('completed');
    expect(final?.receipts.map((receipt) => receipt.step)).toEqual([
      'application-domain',
      'mastra-memory',
    ]);
    expect(await governance.listOpenDeletionIntents()).toHaveLength(0);
  });

  it('resumes a crash between the domain and memory steps after process restart', async () => {
    // "Process 1": intent + domain deletion recorded, then a crash before
    // the memory step (simulated by throwing there).
    const governance = new InMemoryAgentGovernanceStore();
    const calls: string[] = [];
    const coordinator1 = new ConversationDeletionCoordinator({
      governance,
      domain: failingDomainPort(new Map(), calls),
      memory: failingMemoryPort(new Map([['memory:conv-3', 'throw' as const]]), calls),
    });
    await expect(
      coordinator1.deleteConversation({ conversationId: 'conv-3', actorId: 'actor-1' }),
    ).rejects.toThrow();

    // "Process 2": a fresh coordinator over the SAME durable store resumes.
    const coordinator2 = new ConversationDeletionCoordinator({
      governance,
      domain: failingDomainPort(new Map(), calls),
      memory: failingMemoryPort(new Map(), calls),
    });
    const report = await coordinator2.recoverPending();
    expect(report).toEqual({ resumed: 1, completed: 1, pending: 0 });
    // The domain step was not repeated after restart.
    expect(calls.filter((call) => call === 'domain:conv-3')).toHaveLength(1);
    const intent = await governance.getDeletionIntent('vict-del-conv-3');
    expect(intent?.receipts).toHaveLength(2);
    // Recovery is itself idempotent.
    const report2 = await coordinator2.recoverPending();
    expect(report2).toEqual({ resumed: 0, completed: 0, pending: 0 });
  });

  it('refuses deletion under a mismatched actor', async () => {
    const governance = new InMemoryAgentGovernanceStore();
    const coordinator = new ConversationDeletionCoordinator({
      governance,
      domain: failingDomainPort(new Map(), []),
      memory: failingMemoryPort(new Map(), []),
    });
    await coordinator.deleteConversation({ conversationId: 'conv-4', actorId: 'actor-1' });
    await expect(
      coordinator.deleteConversation({ conversationId: 'conv-4', actorId: 'actor-2' }),
    ).rejects.toThrow(/different actor/);
  });

  it('deleted data never resurrects: recovered intents only move forward', async () => {
    const governance = new InMemoryAgentGovernanceStore();
    const calls: string[] = [];
    const coordinator = new ConversationDeletionCoordinator({
      governance,
      domain: failingDomainPort(new Map(), calls),
      memory: failingMemoryPort(new Map([['memory:conv-5', 'throw' as const]]), calls),
    });
    await expect(
      coordinator.deleteConversation({ conversationId: 'conv-5', actorId: 'actor-1' }),
    ).rejects.toThrow();
    // Even when recovery later fails again, prior receipts stay intact.
    await expect(coordinator.recoverPending()).rejects.toThrow();
    const intent = await governance.getDeletionIntent('vict-del-conv-5');
    expect(intent?.receipts.map((receipt) => receipt.step)).toEqual(['application-domain']);
    expect(intent?.state).toBe('application-domain-deleted');
  });
});

describe('conversation export policy (MSTR-011)', () => {
  it('returns a deterministic, retained=false export and denies cross-actor reads', async () => {
    const calls: string[] = [];
    const memory = {
      async exportConversationThread(conversationId: string) {
        calls.push(conversationId);
        return conversationId === 'conv-9'
          ? {
              conversationId,
              actorId: 'actor-1',
              threadCreatedAt: 5,
              messages: [
                { seq: 2, role: 'assistant' as const, createdAt: 20, text: 'second' },
                { seq: 1, role: 'user' as const, createdAt: 10, text: 'first' },
              ],
            }
          : undefined;
      },
    };
    const service = new ConversationExportService({ memory });
    const result = await service.export({ conversationId: 'conv-9', actorId: 'actor-1' });
    expect(result.retained).toBe(false);
    expect(result.export.messages.map((message) => message.seq)).toEqual([1, 2]); // deterministic ordering
    await expect(
      service.export({ conversationId: 'conv-9', actorId: 'actor-2' }),
    ).rejects.toMatchObject({
      code: 'VICT_AGENT_EXPORT_ACTOR_MISMATCH',
    });
    await expect(
      service.export({ conversationId: 'missing', actorId: 'actor-1' }),
    ).rejects.toMatchObject({
      code: 'VICT_AGENT_EXPORT_NOT_FOUND',
    });
  });
});
