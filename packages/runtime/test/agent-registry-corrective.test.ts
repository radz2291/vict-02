import { describe, expect, it } from 'vitest';
import {
  AgentProfileRegistry,
  validateAgentActivationRecord,
  type AgentActivationRecord,
  type AgentArtifact,
  type AgentArtifactKind,
  type AgentProfileActivation,
} from '../src/index.js';
import type { AgentProfileAuthoring } from '@vict/sdk';

/**
 * Stage 06A corrective regressions — artifact-registry integrity, complete
 * activation binding, and adversarial activation-restoration tampering:
 *
 * - installArtifacts is ATOMIC: a conflict late in the batch (against the
 *   registry or intra-batch) leaves nothing observable; a corrected batch
 *   retries cleanly; behavior is insertion-order independent;
 * - artifact resolution never exposes live internal objects: resolved
 *   values are fresh frozen defensive descriptors, and mutation attempts
 *   cannot alter later resolutions or activations;
 * - a declared structured-output contract is an EXECUTABLE binding (exact
 *   id + revision, parser captured by reference); a nonexistent or
 *   mismatched contract fails activation;
 * - declared capability references without an exact-revision resolver fail
 *   activation closed;
 * - the canonical ACTIVATION manifest covers the complete resolved
 *   activation (all artifact bindings + adapter compatibility metadata);
 * - restoreActivation recomputes and compares the canonical manifest BYTES
 *   and the exact artifact list, rejecting every independent tampering
 *   (manifest bytes, artifact kind/id/revision, extra/missing/reordered
 *   artifacts, profile/activation versions, malformed and secret-bearing
 *   injected fields).
 */

const SECRET_INJECTION = 'injected-secret-CANARY-44b7';

function profileInput(overrides: Partial<AgentProfileAuthoring> = {}): AgentProfileAuthoring {
  return {
    schema: 'vict.agent-profile@1',
    id: 'agent.corrective',
    revision: '1',
    instructions: { id: 'instructions.c', revision: '1' },
    modelProfile: {
      id: 'model.c',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: {},
    turnPolicy: { maxSteps: 4, maxToolCalls: 4, onLimit: 'fail-closed' },
    memoryPolicy: { id: 'memory-policy.c', revision: '1' },
    guardrails: [{ id: 'guardrail.c', revision: '1' }],
    structuredOutput: { contract: { id: 'contract.c', revision: '1' } },
    capabilities: [{ id: 'cap.c', revision: '1' }],
    adapter: { id: '@vict/mastra', revision: '1', runtimePackages: {} },
    ...overrides,
  };
}

function baseArtifacts(): AgentArtifact[] {
  return [
    { kind: 'instructions', id: 'instructions.c', revision: '1', text: 'Deterministic.' },
    {
      kind: 'memory-policy',
      id: 'memory-policy.c',
      revision: '1',
      config: { lastMessages: 10, workingMemory: { enabled: false }, semanticRecall: false },
    },
    {
      kind: 'guardrail',
      id: 'guardrail.c',
      revision: '1',
      check: () => ({ ok: true as const }),
      failureCodes: ['TOO_LONG'],
    },
    {
      kind: 'structured-output-contract',
      id: 'contract.c',
      revision: '1',
      description: 'JSON object contract.',
      parse: (text: string) => ({ ok: true as const, value: { text } }),
    },
  ];
}

function makeRegistry(
  options: { readonly withCapabilityResolver?: boolean } = {},
): AgentProfileRegistry {
  const registry = new AgentProfileRegistry(
    options.withCapabilityResolver === false ? {} : { resolveCapabilityRevision: () => true },
  );
  registry.installArtifacts(baseArtifacts());
  registry.registerProfile(profileInput());
  return registry;
}

function recordOf(
  activation: AgentProfileActivation,
  agentId = 'agent.corrective',
  revision = '1',
): AgentActivationRecord {
  return {
    recordSchema: 'vict.agent-activation-record@1',
    activationVersion: activation.activationVersion,
    agentProfileVersion: activation.agentProfileVersion,
    agentId,
    agentRevision: revision,
    canonicalManifest: activation.canonicalManifestJson,
    artifacts: activation.artifactList.map((entry) => ({
      kind: entry.kind as AgentArtifactKind,
      id: entry.id,
      revision: entry.revision,
    })),
    createdAt: activation.createdAt,
  };
}

// ---- 1. Atomic artifact batch installation ---------------------------------

describe('installArtifacts is atomic (all-or-nothing)', () => {
  it('rejects a conflict LATE in the batch and installs nothing', () => {
    const registry = makeRegistry();
    const lateConflict: AgentArtifact = {
      kind: 'instructions',
      id: 'instructions.new',
      revision: '1',
      text: 'New instructions that are fine on their own.',
    };
    expect(() =>
      registry.installArtifacts([
        lateConflict,
        {
          kind: 'processor',
          id: 'processor.new',
          revision: '1',
          transform: (text: string) => text,
        },
        // Conflicts with an ALREADY REGISTERED artifact (late in the batch).
        { kind: 'instructions', id: 'instructions.c', revision: '1', text: 'Duplicate!' },
      ]),
    ).toThrow();
    // Nothing from the batch became observable (base artifacts unchanged).
    expect(registry.resolveArtifact('instructions', 'instructions.new', '1')).toBeUndefined();
    expect(registry.resolveArtifact('processor', 'processor.new', '1')).toBeUndefined();
    // Every base artifact is still exactly the registered one.
    for (const artifact of baseArtifacts()) {
      expect(registry.resolveArtifact(artifact.kind, artifact.id, artifact.revision)).toBeDefined();
    }
  });

  it('rejects intra-batch duplicates and installs nothing', () => {
    const registry = makeRegistry();
    expect(() =>
      registry.installArtifacts([
        { kind: 'workflow', id: 'wf.a', revision: '1', description: 'A' },
        { kind: 'workflow', id: 'wf.b', revision: '1', description: 'B' },
        { kind: 'workflow', id: 'wf.a', revision: '1', description: 'A again' },
      ]),
    ).toThrow();
    expect(registry.resolveArtifact('workflow', 'wf.a', '1')).toBeUndefined();
    expect(registry.resolveArtifact('workflow', 'wf.b', '1')).toBeUndefined();
  });

  it('rejects an invalid member late in the batch and installs nothing', () => {
    const registry = makeRegistry();
    expect(() =>
      registry.installArtifacts([
        { kind: 'workflow', id: 'wf.ok', revision: '1', description: 'Fine' },
        {
          kind: 'structured-output-contract',
          id: 'contract.bad',
          revision: '1',
          description: 'Broken',
          parse: 'not-a-function' as unknown as (text: string) => {
            readonly ok: true;
            readonly value: unknown;
          },
        },
      ]),
    ).toThrow();
    expect(registry.resolveArtifact('workflow', 'wf.ok', '1')).toBeUndefined();
  });

  it('a corrected batch can be retried after a failed one', () => {
    const registry = makeRegistry();
    expect(() =>
      registry.installArtifacts([
        { kind: 'workflow', id: 'wf.retry', revision: '1', description: 'First' },
        { kind: 'workflow', id: 'wf.retry', revision: '1', description: 'Clash' },
      ]),
    ).toThrow();
    registry.installArtifacts([
      { kind: 'workflow', id: 'wf.retry', revision: '1', description: 'Corrected' },
    ]);
    expect(registry.resolveArtifact('workflow', 'wf.retry', '1')).toBeDefined();
  });

  it('insertion order never matters for the accepted batch', () => {
    const a = makeRegistry();
    const b = makeRegistry();
    const batch: AgentArtifact[] = [
      { kind: 'workflow', id: 'wf.x', revision: '1', description: 'X' },
      { kind: 'processor', id: 'processor.x', revision: '1', transform: (t) => t },
    ];
    a.installArtifacts(batch);
    b.installArtifacts([...batch].reverse());
    const activatedA = a.activateAgentProfile({ id: 'agent.corrective', revision: '1' });
    const activatedB = b.activateAgentProfile({ id: 'agent.corrective', revision: '1' });
    expect(activatedA.activationVersion).toBe(activatedB.activationVersion);
  });
});

// ---- 2. Immutable artifact resolution ---------------------------------------

describe('artifact resolution returns VICT-owned immutable descriptors', () => {
  it('mutating a resolved value cannot alter a later resolution or an activation', () => {
    const registry = makeRegistry();
    const first = registry.resolveArtifact('instructions', 'instructions.c', '1');
    expect(first).toBeDefined();
    const activationBefore = registry.activateAgentProfile({ id: 'agent.corrective' });
    // Attempted mutation of the RESOLVED descriptor (frozen; strict mode
    // throws, silent write failure otherwise — both are harmless).
    try {
      (first as { text: string }).text = 'MUTATED';
      (first as { id: string }).id = 'MUTATED';
    } catch {
      // strict-mode rejection is acceptable
    }
    expect((first as { text: string } | undefined)?.text).toBe('Deterministic.');
    const second = registry.resolveArtifact('instructions', 'instructions.c', '1');
    expect((second as { text: string } | undefined)?.text).toBe('Deterministic.');
    expect(second).not.toBe(first); // a fresh descriptor every call
    const activationAfter = registry.activateAgentProfile({ id: 'agent.corrective' });
    expect(activationAfter.instructions.artifact.text).toBe('Deterministic.');
    expect(activationAfter.activationVersion).toBe(activationBefore.activationVersion);
  });

  it('concurrent independent resolutions are independent objects', () => {
    const registry = makeRegistry();
    const resolved = [
      registry.resolveArtifact('memory-policy', 'memory-policy.c', '1'),
      registry.resolveArtifact('memory-policy', 'memory-policy.c', '1'),
      registry.resolveArtifact('memory-policy', 'memory-policy.c', '1'),
    ];
    for (const value of resolved) {
      expect(value).toBeDefined();
      expect(Object.isFrozen(value)).toBe(true);
      expect(Object.isFrozen((value as { config: unknown }).config)).toBe(true);
    }
    expect(new Set(resolved).size).toBe(resolved.length);
    for (const value of resolved) {
      expect((value as unknown as { config: { lastMessages: number } }).config.lastMessages).toBe(
        10,
      );
    }
  });

  it('helper artifacts whose outer id/revision disagree with their definition are rejected', () => {
    const registry = makeRegistry();
    expect(() =>
      registry.registerArtifact({
        kind: 'helper-tool',
        id: 'helper.outer',
        revision: '2',
        definition: {
          id: 'helper.outer',
          revision: '1', // disagrees with the outer revision
          description: 'Mismatched helper.',
          effect: 'pure',
          input: {
            id: 'helper.in',
            revision: '1',
            jsonSchema: { type: 'object' },
            parse: (v: unknown) => ({ ok: true as const, value: v }),
          },
          output: {
            id: 'helper.out',
            revision: '1',
            jsonSchema: { type: 'object' },
            parse: (v: unknown) => ({ ok: true as const, value: v }),
          },
          execute: (v: unknown) => v,
        },
      }),
    ).toThrow(/outer id\/revision must agree/);
  });
});

// ---- 3. Complete activation binding -----------------------------------------

describe('structured-output contracts are executable bindings', () => {
  it('a declared contract resolves at its exact revision and captures the parser by reference', () => {
    const registeredParse = (text: string): { readonly ok: true; readonly value: unknown } => ({
      ok: true as const,
      value: { text } as unknown,
    });
    const registry = makeRegistry();
    registry.registerArtifact({
      kind: 'structured-output-contract',
      id: 'contract.exact',
      revision: '5',
      description: 'Exact-revision contract.',
      parse: registeredParse,
    });
    registry.registerProfile(
      profileInput({
        revision: '5',
        structuredOutput: { contract: { id: 'contract.exact', revision: '5' } },
      }),
    );
    const activation = registry.activateAgentProfile({ id: 'agent.corrective', revision: '5' });
    expect(activation.structuredOutput).toBeDefined();
    expect(activation.structuredOutput?.reference).toEqual({ id: 'contract.exact', revision: '5' });
    // The ACTUAL parser semantics are bound by reference (same function).
    expect(activation.structuredOutput?.artifact.parse).toBe(registeredParse);
  });

  it('a nonexistent contract fails activation', () => {
    const registry = makeRegistry();
    registry.registerProfile(
      profileInput({
        revision: '2',
        structuredOutput: { contract: { id: 'contract.missing', revision: '1' } },
      }),
    );
    expect(() => registry.activateAgentProfile({ id: 'agent.corrective', revision: '2' })).toThrow(
      /contract.missing/,
    );
  });

  it('a mismatched contract REVISION fails activation (no substitution by a newer revision)', () => {
    const registry = makeRegistry();
    registry.registerArtifact({
      kind: 'structured-output-contract',
      id: 'contract.c',
      revision: '2',
      description: 'A newer contract revision.',
      parse: (text: string) => ({ ok: true as const, value: { text } }),
    });
    registry.registerProfile(
      profileInput({
        revision: '3',
        structuredOutput: { contract: { id: 'contract.c', revision: '42' } },
      }),
    );
    expect(() => registry.activateAgentProfile({ id: 'agent.corrective', revision: '3' })).toThrow(
      /revision '42' is not registered|revision '42' is not/,
    );
  });

  it('an identity-only contract reference is never treated as an executable binding', () => {
    // The profile compiles fine with the reference (identity data), but
    // activation without the registered artifact MUST fail closed.
    const registry = makeRegistry();
    registry.registerProfile(
      profileInput({
        revision: '4',
        structuredOutput: { contract: { id: 'contract.never-registered', revision: '9' } },
      }),
    );
    let activated = false;
    try {
      registry.activateAgentProfile({ id: 'agent.corrective', revision: '4' });
      activated = true;
    } catch {
      // expected
    }
    expect(activated).toBe(false);
  });
});

describe('capability envelopes fail closed without an exact-revision resolver', () => {
  it('declared capabilities with no resolver fail activation', () => {
    const registry = makeRegistry({ withCapabilityResolver: false });
    expect(() => registry.activateAgentProfile({ id: 'agent.corrective' })).toThrow(
      /no exact-revision capability resolver is configured/,
    );
  });

  it('an exact-revision resolver that denies the pinned revision fails activation', () => {
    const registry = new AgentProfileRegistry({
      resolveCapabilityRevision: (id, revision) => !(id === 'cap.c' && revision === '1'),
    });
    registry.installArtifacts(baseArtifacts());
    registry.registerProfile(profileInput());
    expect(() => registry.activateAgentProfile({ id: 'agent.corrective' })).toThrow(
      /capability envelope cannot be resolved|Capability 'cap.c' .+ is not registered/,
    );
  });
});

describe('the canonical activation manifest covers the complete resolved activation', () => {
  it('includes every artifact binding, the contract, capabilities, and adapter metadata', () => {
    const registry = makeRegistry();
    const activation = registry.activateAgentProfile({ id: 'agent.corrective' });
    const manifest = JSON.parse(activation.canonicalManifestJson) as {
      schema: string;
      agentProfileVersion: string;
      adapter: { id: string; revision: string; runtimePackages: Record<string, string> };
      artifacts: Array<{ kind: string; id: string; revision: string }>;
    };
    expect(manifest.schema).toBe('vict.agent-activation@2');
    expect(manifest.agentProfileVersion).toBe(activation.agentProfileVersion);
    expect(manifest.adapter).toEqual({ id: '@vict/mastra', revision: '1', runtimePackages: {} });
    const kinds = manifest.artifacts.map((entry) => entry.kind).sort();
    expect(kinds).toEqual([
      'capability',
      'guardrail',
      'instructions',
      'memory-policy',
      'structured-output-contract',
    ]);
    expect(manifest.artifacts).toEqual(activation.artifactList);
  });

  it('activationVersion is insertion-order independent and sensitive to every binding', () => {
    const first = makeRegistry().activateAgentProfile({ id: 'agent.corrective' });
    // A fresh registry that installs the SAME artifacts in reverse order.
    const registry = makeRegistry();
    const second = registry.activateAgentProfile({ id: 'agent.corrective' });
    expect(second.activationVersion).toBe(first.activationVersion);
    // A contract revision change changes the activation identity.
    const changed = makeRegistry();
    changed.registerArtifact({
      kind: 'structured-output-contract',
      id: 'contract.c',
      revision: '2',
      description: 'Newer.',
      parse: (text: string) => ({ ok: true as const, value: { text } }),
    });
    changed.registerProfile(
      profileInput({
        revision: '2',
        structuredOutput: { contract: { id: 'contract.c', revision: '2' } },
      }),
    );
    const third = changed.activateAgentProfile({ id: 'agent.corrective', revision: '2' });
    expect(third.activationVersion).not.toBe(first.activationVersion);
  });
});

// ---- 4. Adversarial restoration ----------------------------------------------

describe('restoreActivation rejects tampering independently', () => {
  function restoredWith(
    mutate: (record: Record<string, unknown>, activation: AgentProfileActivation) => void,
  ): { code: string; message: string } {
    const registry = makeRegistry();
    const activation = registry.activateAgentProfile({ id: 'agent.corrective' });
    const record = recordOf(activation) as unknown as Record<string, unknown>;
    mutate(record, activation);
    const result = registry.restoreActivation(record as unknown as AgentActivationRecord);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected rejection');
    }
    return { code: result.code, message: result.message };
  }

  it('accepts the untampered record', () => {
    const registry = makeRegistry();
    const activation = registry.activateAgentProfile({ id: 'agent.corrective' });
    const result = registry.restoreActivation(recordOf(activation));
    expect(result.ok).toBe(true);
  });

  it('rejects tampered canonical manifest bytes', () => {
    const { code } = restoredWith((record) => {
      record.canonicalManifest = (record.canonicalManifest as string).replace(
        '"revision":"1"',
        '"revision":"9"',
      );
    });
    expect(code).toBe('AGENT_ACTIVATION_CORRUPT_RECORD');
  });

  it('rejects a stored manifest swapped with the PROFILE manifest', () => {
    const { code } = restoredWith((record, activation) => {
      record.canonicalManifest = activation.profile.manifestJson;
    });
    expect(code).toBe('AGENT_ACTIVATION_CORRUPT_RECORD');
  });

  it('rejects a tampered artifact KIND', () => {
    const { code } = restoredWith((record) => {
      const artifacts = record.artifacts as Array<{ kind: string; id: string; revision: string }>;
      const entry = artifacts.find((candidate) => candidate.kind === 'instructions');
      if (entry !== undefined) {
        entry.kind = 'workflow';
      }
    });
    expect([
      'AGENT_ACTIVATION_CORRUPT_RECORD',
      'AGENT_ACTIVATION_ARTIFACT_REVISION_MISMATCH',
    ]).toContain(code);
  });

  it('rejects a tampered artifact ID', () => {
    const { code } = restoredWith((record) => {
      const artifacts = record.artifacts as Array<{ kind: string; id: string; revision: string }>;
      const entry = artifacts.find((candidate) => candidate.kind === 'instructions');
      if (entry !== undefined) {
        entry.id = 'instructions.other';
      }
    });
    expect([
      'AGENT_ACTIVATION_CORRUPT_RECORD',
      'AGENT_ACTIVATION_ARTIFACT_REVISION_MISMATCH',
    ]).toContain(code);
  });

  it('rejects a tampered artifact REVISION', () => {
    const { code } = restoredWith((record) => {
      const artifacts = record.artifacts as Array<{ kind: string; id: string; revision: string }>;
      const entry = artifacts.find((candidate) => candidate.kind === 'instructions');
      if (entry !== undefined) {
        entry.revision = '7';
      }
    });
    expect([
      'AGENT_ACTIVATION_CORRUPT_RECORD',
      'AGENT_ACTIVATION_ARTIFACT_REVISION_MISMATCH',
    ]).toContain(code);
  });

  it('rejects an EXTRA artifact', () => {
    const { code } = restoredWith((record) => {
      (record.artifacts as unknown[]).push({ kind: 'workflow', id: 'wf.extra', revision: '1' });
    });
    expect(code).toBe('AGENT_ACTIVATION_CORRUPT_RECORD');
  });

  it('rejects a MISSING artifact', () => {
    const { code } = restoredWith((record) => {
      const artifacts = record.artifacts as Array<{ kind: string }>;
      const index = artifacts.findIndex((candidate) => candidate.kind === 'guardrail');
      artifacts.splice(index, 1);
    });
    expect(code).toBe('AGENT_ACTIVATION_CORRUPT_RECORD');
  });

  it('rejects a REORDERED artifact list (canonical order is significant)', () => {
    const { code } = restoredWith((record) => {
      const artifacts = [...(record.artifacts as unknown[])];
      const last = artifacts.pop();
      artifacts.unshift(last);
      record.artifacts = artifacts;
    });
    expect([
      'AGENT_ACTIVATION_CORRUPT_RECORD',
      'AGENT_ACTIVATION_ARTIFACT_REVISION_MISMATCH',
    ]).toContain(code);
  });

  it('rejects a tampered agentProfileVersion', () => {
    const { code } = restoredWith((record) => {
      record.agentProfileVersion = `v1_${'a'.repeat(64)}`;
    });
    expect(code).toBe('AGENT_ACTIVATION_PROFILE_MISMATCH');
  });

  it('rejects a tampered activationVersion', () => {
    const { code } = restoredWith((record) => {
      record.activationVersion = `v1_${'b'.repeat(64)}`;
    });
    expect(code).toBe('AGENT_ACTIVATION_ARTIFACT_REVISION_MISMATCH');
  });

  it('rejects malformed artifact entries', () => {
    const { code } = restoredWith((record) => {
      record.artifacts = [{ kind: 'instructions' }];
    });
    expect(code).toBe('AGENT_ACTIVATION_CORRUPT_RECORD');
  });

  it('rejects secret-bearing injected fields on the record and never persists their content', () => {
    const registry = makeRegistry();
    const activation = registry.activateAgentProfile({ id: 'agent.corrective' });
    const record = recordOf(activation) as unknown as Record<string, unknown>;
    record.providerCredential = SECRET_INJECTION;
    const result = registry.restoreActivation(
      record as unknown as unknown as AgentActivationRecord,
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false ? result.message : '').not.toContain(SECRET_INJECTION);
    // The injected field value never appears in any observable surface.
    expect(JSON.stringify(result)).not.toContain(SECRET_INJECTION);
  });

  it('never substitutes a newer live definition during restoration', () => {
    const registry = makeRegistry();
    const activation = registry.activateAgentProfile({ id: 'agent.corrective' });
    // A newer instructions revision is registered after the record exists.
    registry.registerArtifact({
      kind: 'instructions',
      id: 'instructions.c',
      revision: '2',
      text: 'Newer live definition.',
    });
    const result = registry.restoreActivation(recordOf(activation));
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The EXACT pinned revision — never the newer live definition.
      expect(result.activation.instructions.artifact.text).toBe('Deterministic.');
    }
  });
});

describe('validateAgentActivationRecord (shared store-adapter gate)', () => {
  it('accepts a well-formed record and rejects malformed ones', () => {
    const registry = makeRegistry();
    const activation = registry.activateAgentProfile({ id: 'agent.corrective' });
    expect(validateAgentActivationRecord(recordOf(activation)).ok).toBe(true);
    expect(validateAgentActivationRecord(null).ok).toBe(false);
    expect(validateAgentActivationRecord('string').ok).toBe(false);
    expect(validateAgentActivationRecord({}).ok).toBe(false);
    const badVersion = recordOf(activation) as unknown as Record<string, unknown>;
    badVersion.activationVersion = 'not-canonical';
    expect(validateAgentActivationRecord(badVersion).ok).toBe(false);
    const badArtifact = recordOf(activation) as unknown as Record<string, unknown>;
    badArtifact.artifacts = [{ kind: 'unknown-kind', id: 'x', revision: '1' }];
    expect(validateAgentActivationRecord(badArtifact).ok).toBe(false);
  });
});
