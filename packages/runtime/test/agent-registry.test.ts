import { describe, expect, it } from 'vitest';
import { AgentProfileRegistry, pinAgentTurnRunner, type AgentArtifact } from '../src/index.js';
import { compileAgentProfile } from '@vict/kernel';
import type { AgentProfileAuthoring } from '@vict/sdk';

/**
 * Stage 06A permanent regression: registration atomicity, immutable
 * activation snapshots, in-flight pinning, exact-revision resolution,
 * fail-closed restoration, and registry immutability (AI-004, VER-005..010
 * discipline applied to the AI subsystem).
 */

function profileInput(overrides: Partial<AgentProfileAuthoring> = {}): AgentProfileAuthoring {
  return {
    schema: 'vict.agent-profile@1',
    id: 'agent.registry',
    revision: '1',
    instructions: { id: 'instructions.r', revision: '1' },
    modelProfile: {
      id: 'model.r',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: {},
    turnPolicy: { maxSteps: 4, maxToolCalls: 4, onLimit: 'fail-closed' },
    memoryPolicy: { id: 'memory-policy.r', revision: '1' },
    helperTools: [{ id: 'helper.r', revision: '1' }],
    capabilities: [{ id: 'cap.r', revision: '1' }],
    adapter: { id: '@vict/mastra', revision: '1', runtimePackages: {} },
    ...overrides,
  };
}

function artifacts(): AgentArtifact[] {
  return [
    { kind: 'instructions', id: 'instructions.r', revision: '1', text: 'Be deterministic.' },
    {
      kind: 'memory-policy',
      id: 'memory-policy.r',
      revision: '1',
      config: { lastMessages: 10, workingMemory: { enabled: false }, semanticRecall: false },
    },
    {
      kind: 'helper-tool',
      id: 'helper.r',
      revision: '1',
      definition: {
        id: 'helper.r',
        revision: '1',
        description: 'Pure identity helper.',
        effect: 'pure',
        input: {
          id: 'helper.r.in',
          revision: '1',
          jsonSchema: { type: 'object' },
          parse: (value: unknown) => ({ ok: true as const, value }),
        },
        output: {
          id: 'helper.r.out',
          revision: '1',
          jsonSchema: { type: 'object' },
          parse: (value: unknown) => ({ ok: true as const, value }),
        },
        execute: (value: unknown) => value,
      },
    },
  ];
}

function registryWith(overrides: Partial<AgentProfileAuthoring> = {}): AgentProfileRegistry {
  const registry = new AgentProfileRegistry();
  registry.installArtifacts(artifacts());
  registry.registerProfile(profileInput(overrides));
  return registry;
}

describe('agent profile registration', () => {
  it('registers atomically: a failed batch leaves the registry unchanged', () => {
    const registry = new AgentProfileRegistry();
    const good = artifacts();
    const bad: AgentArtifact[] = [
      ...good,
      // Invalid helper tool (non-pure effect) — must abort the whole batch.
      {
        kind: 'helper-tool',
        id: 'helper.bad',
        revision: '1',
        definition: {
          id: 'helper.bad',
          revision: '1',
          description: 'Effectful tool.',
          effect: 'write' as never,
          input: {
            id: 'i',
            revision: '1',
            jsonSchema: { type: 'object' },
            parse: (v: unknown) => ({ ok: true as const, value: v }),
          },
          output: {
            id: 'o',
            revision: '1',
            jsonSchema: { type: 'object' },
            parse: (v: unknown) => ({ ok: true as const, value: v }),
          },
          execute: (v: unknown) => v,
        },
      },
    ];
    expect(() => registry.installArtifacts(bad)).toThrow();
    expect(() => registry.installArtifacts(good)).not.toThrow();
    // After the failed batch, nothing from it was registered...
    expect(registry.resolveArtifact('helper-tool', 'helper.bad', '1')).toBeUndefined();
    // ...and a subsequent valid install succeeds atomically.
  });

  it('rejects duplicate artifacts and duplicate profiles without an explicit replace', () => {
    const registry = registryWith();
    expect(() => registry.installArtifacts(artifacts())).toThrow(/already registered/);
    expect(() => registry.registerProfile(profileInput())).toThrow(/already registered/);
  });

  it('supports explicit replaceProfile with expected-previous-revision pinning', () => {
    const registry = registryWith();
    expect(() =>
      registry.replaceProfile({
        profile: profileInput({ revision: '2' }),
        expectedPreviousRevision: '9',
      }),
    ).toThrow(/refusing the replace/);
    expect(() =>
      registry.replaceProfile({
        profile: profileInput({ revision: '2' }),
        expectedPreviousRevision: '1',
      }),
    ).not.toThrow();
    const resolved = registry.resolveProfile('agent.registry');
    expect(resolved?.profile.revision).toBe('2');
  });

  it('rejects effectful helper tools BEFORE activation', () => {
    const registry = new AgentProfileRegistry();
    expect(() =>
      registry.registerArtifact({
        kind: 'helper-tool',
        id: 'helper.effectful',
        revision: '1',
        definition: {
          id: 'helper.effectful',
          revision: '1',
          description: 'A write.',
          effect: 'irreversible' as never,
          input: {
            id: 'i',
            revision: '1',
            jsonSchema: { type: 'object' },
            parse: (v: unknown) => ({ ok: true as const, value: v }),
          },
          output: {
            id: 'o',
            revision: '1',
            jsonSchema: { type: 'object' },
            parse: (v: unknown) => ({ ok: true as const, value: v }),
          },
          execute: (v: unknown) => v,
        },
      }),
    ).toThrow(/must be exactly 'pure'/);
  });

  it('rejects unknown helper-tool fields (authority metadata cannot be smuggled in)', () => {
    const registry = new AgentProfileRegistry();
    const definition = {
      id: 'helper.wide',
      revision: '1',
      description: 'Tries to widen authority.',
      effect: 'pure' as const,
      input: {
        id: 'i',
        revision: '1',
        jsonSchema: { type: 'object' },
        parse: (v: unknown) => ({ ok: true as const, value: v }),
      },
      output: {
        id: 'o',
        revision: '1',
        jsonSchema: { type: 'object' },
        parse: (v: unknown) => ({ ok: true as const, value: v }),
      },
      execute: (v: unknown) => v,
    };
    const widened = { ...definition, permissions: ['admin:*'], secrets: ['provider-key'] };
    expect(() =>
      registry.registerArtifact({
        kind: 'helper-tool',
        id: 'helper.wide',
        revision: '1',
        definition: widened as never,
      }),
    ).toThrow(/closed/);
  });

  it('rejects invalid memory policies (unknown fields, non-explicit flags)', () => {
    const registry = new AgentProfileRegistry();
    expect(() =>
      registry.registerArtifact({
        kind: 'memory-policy',
        id: 'mp.bad',
        revision: '1',
        config: {
          lastMessages: 10,
          workingMemory: { enabled: false },
          semanticRecall: true,
        } as never,
      }),
    ).toThrow(/semanticRecall: false/);
    expect(() =>
      registry.registerArtifact({
        kind: 'memory-policy',
        id: 'mp.bad2',
        revision: '1',
        config: { lastMessages: 10, workingMemory: { enabled: false } } as never,
      }),
    ).toThrow(/explicitly/);
  });
});

describe('activation snapshots', () => {
  it('deep-captures an immutable snapshot; caller mutation after registration has no effect', () => {
    const registry = new AgentProfileRegistry();
    const rawArtifacts = artifacts();
    registry.installArtifacts(rawArtifacts);
    registry.registerProfile(profileInput());
    // Caller mutates the raw definition after registration.
    (rawArtifacts[2] as { definition: { description: string } }).definition.description = 'MUTATED';
    (rawArtifacts[0] as { text: string }).text = 'MUTATED';
    const activation = registry.activateAgentProfile({ id: 'agent.registry', revision: '1' });
    expect(activation.instructions.artifact.text).toBe('Be deterministic.');
    expect(activation.helperTools[0]?.artifact.definition.description).toBe(
      'Pure identity helper.',
    );
    expect(Object.isFrozen(activation)).toBe(true);
  });

  it('post-activation registry replacement has no effect on the active snapshot', () => {
    const registry = registryWith();
    const activation = registry.activateAgentProfile({ id: 'agent.registry', revision: '1' });
    // Register a NEW instructions revision and a NEW profile revision that pins it.
    registry.registerArtifact({
      kind: 'instructions',
      id: 'instructions.r',
      revision: '2',
      text: 'Changed instructions.',
    });
    registry.replaceProfile({
      profile: profileInput({
        revision: '2',
        instructions: { id: 'instructions.r', revision: '2' },
      }),
      expectedPreviousRevision: '1',
    });
    // The old activation is untouched.
    expect(activation.instructions.artifact.text).toBe('Be deterministic.');
    expect(activation.profile.profile.revision).toBe('1');
    // An explicit NEW activation captures the replacement.
    const reactivated = registry.activateAgentProfile({ id: 'agent.registry' });
    expect(reactivated.instructions.artifact.text).toBe('Changed instructions.');
    expect(reactivated.agentProfileVersion).not.toBe(activation.agentProfileVersion);
    expect(reactivated.activationVersion).not.toBe(activation.activationVersion);
  });

  it('mid-run mutation cannot affect an in-flight turn (barrier-controlled)', async () => {
    const registry = registryWith();
    const activation = registry.activateAgentProfile({ id: 'agent.registry', revision: '1' });
    const runner = pinAgentTurnRunner(
      {
        agentProfileVersion: activation.agentProfileVersion,
        async runTurn(request, context) {
          // The turn reads the snapshot twice, with a registry mutation
          // barrier between the reads.
          const before = context.activation.instructions.artifact.text;
          await barrier;
          const after = context.activation.instructions.artifact.text;
          return {
            status: 'completed' as const,
            text: `${before}|${after}`,
            events: [],
          };
        },
      },
      activation,
    );
    let releaseBarrier: (() => void) | undefined;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const turnPromise = runner.runTurn({
      turnId: 't1',
      threadId: 'th1',
      actorId: 'actor',
      input: 'x',
    });
    // Mutate the registry MID-TURN: new revision + re-activation.
    registry.registerArtifact({
      kind: 'instructions',
      id: 'instructions.r',
      revision: '2',
      text: 'RACE-MUTATION',
    });
    registry.replaceProfile({
      profile: profileInput({
        revision: '2',
        instructions: { id: 'instructions.r', revision: '2' },
      }),
      expectedPreviousRevision: '1',
    });
    void registry.activateAgentProfile({ id: 'agent.registry', revision: '2' });
    releaseBarrier?.();
    const outcome = await turnPromise;
    expect(outcome.status).toBe('completed');
    expect(outcome.text).toBe('Be deterministic.|Be deterministic.');
  });

  it('resolves every revisioned component exactly; missing or mismatched artifacts fail closed', () => {
    const registry = registryWith({ helperTools: [{ id: 'helper.missing', revision: '1' }] });
    expect(() => registry.activateAgentProfile({ id: 'agent.registry', revision: '1' })).toThrow(
      /not registered/,
    );

    const registry2 = registryWith({ instructions: { id: 'instructions.r', revision: '7' } });
    // Revision 7 was never registered; revision 1 EXISTS but must not substitute.
    expect(() => registry2.activateAgentProfile({ id: 'agent.registry', revision: '1' })).toThrow(
      /never substitutes|not registered/,
    );

    const registry3 = registryWith();
    // Register the artifact only AFTER activation succeeds normally; then
    // remove access by pinning a revision that exists nowhere.
    registry3.registerArtifact({
      kind: 'instructions',
      id: 'instructions.r',
      revision: '2',
      text: 'v2',
    });
    const ok = registry3.activateAgentProfile({ id: 'agent.registry', revision: '1' });
    expect(ok.instructions.artifact.text).toBe('Be deterministic.');
  });

  it('capability-envelope references fail closed when unresolved', () => {
    const registry = new AgentProfileRegistry({
      resolveCapabilityRevision: (id, revision) => id === 'cap.r' && revision === '1',
    });
    registry.installArtifacts(artifacts());
    registry.registerProfile(profileInput({ capabilities: [{ id: 'cap.other', revision: '1' }] }));
    expect(() => registry.activateAgentProfile({ id: 'agent.registry', revision: '1' })).toThrow(
      /authority envelope/,
    );
  });

  it('registry maps are not externally mutable', () => {
    const registry = registryWith();
    // The public surface exposes no maps: resolve* returns copies/undefined.
    const compiled = registry.resolveProfile('agent.registry', '1');
    expect(compiled).toBeDefined();
    expect(registry.resolveArtifact('instructions', 'instructions.r', '1')).toBeDefined();
    // Direct mutation attempts have no public target; compile identity is
    // immutable.
    const activation = registry.activateAgentProfile({ id: 'agent.registry', revision: '1' });
    expect(() => {
      (activation as { instructions: { artifact: { text: string } } }).instructions.artifact.text =
        'HACK';
    }).toThrow();
    expect(activation.instructions.artifact.text).toBe('Be deterministic.');
  });
});

describe('restart restoration (Stage 02 model)', () => {
  it('restores the exact activation from its persisted identity record', () => {
    const registry = registryWith();
    const activation = registry.activateAgentProfile({ id: 'agent.registry', revision: '1' });
    const record = {
      recordSchema: 'vict.agent-activation-record@1' as const,
      activationVersion: activation.activationVersion,
      agentProfileVersion: activation.agentProfileVersion,
      agentId: 'agent.registry',
      agentRevision: '1',
      canonicalManifest: activation.profile.manifestJson,
      artifacts: [
        { kind: 'instructions' as const, id: 'instructions.r', revision: '1' },
        { kind: 'memory-policy' as const, id: 'memory-policy.r', revision: '1' },
        { kind: 'helper-tool' as const, id: 'helper.r', revision: '1' },
        { kind: 'capability' as const, id: 'cap.r', revision: '1' },
      ],
      createdAt: activation.createdAt,
    };
    const restored = registry.restoreActivation(
      record as unknown as Parameters<AgentProfileRegistry['restoreActivation']>[0],
    );
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.activation.activationVersion).toBe(activation.activationVersion);
      expect(restored.activation.agentProfileVersion).toBe(activation.agentProfileVersion);
      expect(restored.activation.instructions.artifact.text).toBe('Be deterministic.');
    }
  });

  it('fails closed when the pinned profile is missing (no substitution by a newer revision)', () => {
    // Only revision 2 is registered in this "fresh process".
    const fresh = new AgentProfileRegistry();
    fresh.installArtifacts(artifacts());
    fresh.registerProfile(profileInput({ revision: '2' }));
    // Simulate a record whose profile is genuinely the OLD revision.
    const old = compileAgentProfile(profileInput({ revision: '1' }));
    if (!old.ok) {
      throw new Error('expected ok');
    }
    const record2 = {
      recordSchema: 'vict.agent-activation-record@1' as const,
      activationVersion: activationVersionOf(old.value.agentProfileVersion),
      agentProfileVersion: old.value.agentProfileVersion,
      agentId: 'agent.registry',
      agentRevision: '1',
      canonicalManifest: old.value.manifestJson,
      artifacts: [
        { kind: 'instructions' as const, id: 'instructions.r', revision: '1' },
        { kind: 'memory-policy' as const, id: 'memory-policy.r', revision: '1' },
        { kind: 'helper-tool' as const, id: 'helper.r', revision: '1' },
        { kind: 'capability' as const, id: 'cap.r', revision: '1' },
      ],
      createdAt: 0,
    };
    const result = fresh.restoreActivation(
      record2 as unknown as Parameters<AgentProfileRegistry['restoreActivation']>[0],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('AGENT_ACTIVATION_PROFILE_MISMATCH');
      expect(result.message).toContain('refusing to substitute');
    }
  });

  it('fails closed when a pinned artifact revision is missing after restart', () => {
    const registry = registryWith();
    const activation = registry.activateAgentProfile({ id: 'agent.registry', revision: '1' });
    // A fresh process that registered a NEWER instructions revision only.
    const fresh = new AgentProfileRegistry();
    fresh.registerArtifact({
      kind: 'instructions',
      id: 'instructions.r',
      revision: '2',
      text: 'Newer',
    });
    fresh.registerArtifact(artifacts()[1]!);
    fresh.registerArtifact(artifacts()[2]!);
    fresh.registerProfile(profileInput());
    const record = {
      recordSchema: 'vict.agent-activation-record@1' as const,
      activationVersion: activation.activationVersion,
      agentProfileVersion: activation.agentProfileVersion,
      agentId: 'agent.registry',
      agentRevision: '1',
      canonicalManifest: activation.profile.manifestJson,
      artifacts: [{ kind: 'instructions' as const, id: 'instructions.r', revision: '1' }],
      createdAt: 0,
    };
    const result = fresh.restoreActivation(
      record as unknown as Parameters<AgentProfileRegistry['restoreActivation']>[0],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect([
        'AGENT_ACTIVATION_ARTIFACT_MISSING',
        'AGENT_ACTIVATION_ARTIFACT_REVISION_MISMATCH',
      ]).toContain(result.code);
    }
  });

  it('rejects corrupt records', () => {
    const result = new AgentProfileRegistry().restoreActivation({} as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('AGENT_ACTIVATION_CORRUPT_RECORD');
    }
  });
});

function activationVersionOf(agentProfileVersion: string): string {
  // Any deterministic string; the registry compares its own computed
  // activation identity against this and fails closed on mismatch.
  return `record-for-${agentProfileVersion}`;
}
