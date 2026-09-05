import { describe, expect, it } from 'vitest';
import {
  AgentProfileRegistry,
  InMemoryAgentGovernanceStore,
  type AgentActivationRecord,
  type AgentArtifact,
  type AgentProfileActivation,
} from '../src/index.js';

/**
 * Boundary-remediation regressions — resolved subagent identity in the
 * authoritative activation binding:
 *
 * - the activation manifest carries the RESOLVED `agentProfileVersion` of
 *   every referenced sub-agent profile (declarative identity only — never
 *   hashed executable bodies);
 * - exact restoration across registries and persisted reopen succeeds
 *   byte-for-byte and preserves the ORIGINAL activation `createdAt`
 *   (never the restoring process's clock);
 * - a child profile re-registered under the SAME id/revision with a
 *   different declared temperature changes the child's resolved identity —
 *   restoring the parent under that changed child is REJECTED instead of
 *   silently accepted;
 * - creation-time preservation: a stored createdAt=100 restores as 100
 *   even through a changed clock.
 */

function childArtifacts(): AgentArtifact[] {
  return [
    {
      kind: 'instructions',
      id: 'instructions.child',
      revision: '1',
      text: 'Child instructions.',
    },
    {
      kind: 'memory-policy',
      id: 'memory-policy.child',
      revision: '1',
      config: { lastMessages: 4, workingMemory: { enabled: false }, semanticRecall: false },
    },
  ];
}

function childProfile(temperature: number) {
  return {
    schema: 'vict.agent-profile@1' as const,
    id: 'agent.child',
    revision: '7',
    instructions: { id: 'instructions.child', revision: '1' },
    modelProfile: {
      id: 'model.child',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: { temperature },
    turnPolicy: { maxSteps: 2, maxToolCalls: 0, onLimit: 'fail-closed' as const },
    memoryPolicy: { id: 'memory-policy.child', revision: '1' },
    guardrails: [],
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
  };
}

function parentProfile() {
  return {
    schema: 'vict.agent-profile@1' as const,
    id: 'agent.parent',
    revision: '1',
    instructions: { id: 'instructions.child', revision: '1' },
    modelProfile: {
      id: 'model.parent',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: { temperature: 0 },
    turnPolicy: { maxSteps: 4, maxToolCalls: 0, onLimit: 'fail-closed' as const },
    memoryPolicy: { id: 'memory-policy.child', revision: '1' },
    guardrails: [],
    helperTools: [],
    subagents: [{ id: 'agent.child', revision: '7' }],
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
  };
}

/** A registry holding the child (temperature 0.5) and the parent. */
function originRegistry(clock?: () => number): {
  registry: AgentProfileRegistry;
  childVersion: string;
} {
  const registry = new AgentProfileRegistry({ ...(clock !== undefined ? { clock } : {}) });
  registry.installArtifacts(childArtifacts());
  const child = registry.registerProfile(childProfile(0.5));
  registry.registerProfile(parentProfile());
  return { registry, childVersion: child.agentProfileVersion };
}

function recordOf(activation: AgentProfileActivation): AgentActivationRecord {
  return {
    recordSchema: 'vict.agent-activation-record@1',
    activationVersion: activation.activationVersion,
    agentProfileVersion: activation.agentProfileVersion,
    agentId: activation.profile.profile.id,
    agentRevision: activation.profile.profile.revision,
    canonicalManifest: activation.canonicalManifestJson,
    artifacts: activation.artifactList.map((entry) => ({
      kind: entry.kind,
      id: entry.id,
      revision: entry.revision,
    })),
    createdAt: activation.createdAt,
  };
}

describe('resolved subagent identity in activation restoration', () => {
  it('the manifest carries the resolved child profile identity', () => {
    const { registry, childVersion } = originRegistry();
    const activation = registry.activateAgentProfile({ id: 'agent.parent', revision: '1' });
    const manifest = JSON.parse(activation.canonicalManifestJson) as {
      subagents: Array<{ id: string; revision: string; agentProfileVersion: string }>;
    };
    expect(manifest.subagents).toEqual([
      { id: 'agent.child', revision: '7', agentProfileVersion: childVersion },
    ]);
    // The snapshot and the manifest agree on the resolved child identity.
    expect(activation.subagents[0]?.agentProfileVersion).toBe(childVersion);
  });

  it('exact restoration across registries succeeds and preserves createdAt', () => {
    const { registry } = originRegistry(() => 100); // activation clock pinned to 100
    const activation = registry.activateAgentProfile({ id: 'agent.parent', revision: '1' });
    expect(activation.createdAt).toBe(100);
    const record = recordOf(activation);
    // Persist + read back through a governance store.
    const store = new InMemoryAgentGovernanceStore();
    void store.saveAgentActivation(record).then(async () => {
      const persisted = await store.getAgentActivation(record.activationVersion);
      expect(persisted).toBeDefined();
    });

    // A FRESH registry (same registrations) restores the exact activation —
    // even though the fresh process's clock reads 999.
    const fresh = originRegistry(() => 999).registry;
    const result = fresh.restoreActivation(record);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.activation.activationVersion).toBe(activation.activationVersion);
      expect(result.activation.agentProfileVersion).toBe(activation.agentProfileVersion);
      expect(result.activation.subagents[0]?.agentProfileVersion).toBe(
        activation.subagents[0]?.agentProfileVersion,
      );
      // The ORIGINAL creation time is preserved (never the fresh clock).
      expect(result.activation.createdAt).toBe(100);
    }
  });

  it('a changed resolved child profile identity is rejected (same id/revision)', () => {
    const { registry } = originRegistry(() => 100);
    const activation = registry.activateAgentProfile({ id: 'agent.parent', revision: '1' });
    const record = recordOf(activation);

    // A "fresh process" re-registers the SAME child id/revision with a
    // CHANGED declared temperature: the child's computed
    // agentProfileVersion differs.
    const fresh = new AgentProfileRegistry();
    fresh.installArtifacts(childArtifacts());
    const changedChild = fresh.registerProfile(childProfile(0.9));
    expect(changedChild.agentProfileVersion).not.toBe(activation.subagents[0]?.agentProfileVersion);
    fresh.registerProfile(parentProfile());

    // Restoring the parent against the changed child FAILS CLOSED — the
    // original parent activationVersion is never silently retained over a
    // different resolved executable activation.
    const result = fresh.restoreActivation(record);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The recomputed activation identity (which now binds the CHANGED
      // resolved child identity) no longer matches the persisted record.
      expect(result.code).toBe('AGENT_ACTIVATION_ARTIFACT_REVISION_MISMATCH');
      expect(result.message).toContain('refusing to substitute');
    }
  });

  it('persisted reopen: the stored record round-trips and restores exactly', async () => {
    const { registry } = originRegistry(() => 100);
    const activation = registry.activateAgentProfile({ id: 'agent.parent', revision: '1' });
    const record = recordOf(activation);
    const store = new InMemoryAgentGovernanceStore();
    await store.saveAgentActivation(record);
    await store.saveAgentActivation(record); // idempotent republish
    const persisted = await store.getAgentActivation(record.activationVersion);
    expect(persisted).toEqual(record);
    // Restore from the PERSISTED copy in a fresh registry.
    const fresh = originRegistry(() => 1234).registry;
    const result = fresh.restoreActivation(persisted!);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.activation.createdAt).toBe(100);
      expect(result.activation.activationVersion).toBe(activation.activationVersion);
    }
  });

  it('the parent identity vector covers the resolved child identity (sensitivity)', () => {
    const first = originRegistry().registry;
    const a = first.activateAgentProfile({ id: 'agent.parent', revision: '1' });
    // A second registry whose child (same id/revision) declares a different
    // temperature produces a DIFFERENT activation identity for the parent.
    const second = new AgentProfileRegistry();
    second.installArtifacts(childArtifacts());
    second.registerProfile(childProfile(1.5));
    second.registerProfile(parentProfile());
    const b = second.activateAgentProfile({ id: 'agent.parent', revision: '1' });
    expect(a.activationVersion).not.toBe(b.activationVersion);
    // Profile identity vectors of the PARENT stay equal (the parent's own
    // declared components are identical); the ACTIVATION identity is what
    // binds the resolved child.
    expect(a.agentProfileVersion).toBe(b.agentProfileVersion);
  });
});
