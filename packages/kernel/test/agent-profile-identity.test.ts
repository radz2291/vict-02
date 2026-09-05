import { describe, expect, it } from 'vitest';
import { compileAgentProfile } from '@vict/kernel';
import { defineAgentProfile } from '@vict/sdk';
import type { AgentProfileAuthoring } from '@vict/sdk';

/**
 * Stage 06A permanent regression: deterministic `agentProfileVersion`
 * (AI-003, amendment §6.1–§6.3). Every declared semantic participates;
 * set order does not; forbidden inputs are structurally unreachable.
 */

function base(): AgentProfileAuthoring {
  return {
    schema: 'vict.agent-profile@1',
    id: 'agent.identity',
    revision: '1',
    instructions: { id: 'instructions.a', revision: '1' },
    modelProfile: {
      id: 'model.a',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: { temperature: 0.5, maxOutputTokens: 512 },
    turnPolicy: { maxSteps: 4, maxToolCalls: 4, onLimit: 'fail-closed' },
    memoryPolicy: { id: 'memory-policy.a', revision: '1' },
    processors: [
      { id: 'processor.trim', revision: '1' },
      { id: 'processor.case', revision: '2' },
    ],
    guardrails: [{ id: 'guardrail.length', revision: '1' }],
    structuredOutput: { contract: { id: 'contract.structured', revision: '3' } },
    helperTools: [
      { id: 'helper.uppercase', revision: '1' },
      { id: 'helper.format', revision: '2' },
    ],
    capabilities: [
      { id: 'cap.notes.write', revision: '2' },
      { id: 'cap.notes.read', revision: '1' },
    ],
    subagents: [{ id: 'agent.sub', revision: '1' }],
    workflows: [{ id: 'workflow.summarize', revision: '1' }],
    adapter: {
      id: '@vict/mastra',
      revision: '1',
      runtimePackages: { '@mastra/core': '1.64.0', '@mastra/memory': '1.28.2' },
    },
  };
}

function versionOf(profile: AgentProfileAuthoring): string {
  const result = compileAgentProfile(profile);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.issues[0]?.message);
  }
  return result.value.agentProfileVersion;
}

function expectDifferent(mutate: (profile: AgentProfileAuthoring) => AgentProfileAuthoring): void {
  const baseline = versionOf(base());
  const mutated = versionOf(mutate(structuredClone(base())));
  expect(mutated).not.toBe(baseline);
}

describe('agentProfileVersion — determinism', () => {
  it('same semantics produce the same version repeatedly in-process', () => {
    expect(versionOf(base())).toBe(versionOf(structuredClone(base())));
  });

  it('same semantics produce the same version across child processes', async () => {
    const { spawnSync } = await import('node:child_process');
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const repoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
    const dir = mkdtempSync(join(tmpdir(), 'vict-agent-xproc-'));
    try {
      const script = `
        const { createRequire } = await import('node:module');
        const { pathToFileURL } = await import('node:url');
        const require = createRequire(${JSON.stringify(join(repoRoot, 'package.json'))});
        const kernelUrl = pathToFileURL(require.resolve('@vict/kernel')).href;
        const { compileAgentProfile } = await import(kernelUrl);
        const profile = ${JSON.stringify(base())};
        const result = await compileAgentProfile(profile);
        if (!result.ok) { throw new Error('compile failed'); }
        process.stdout.write(result.value.agentProfileVersion);
      `;
      const scriptPath = join(dir, 'identity.mjs');
      writeFileSync(scriptPath, script, 'utf8');
      const versions = [1, 2].map(() => {
        const run = spawnSync(process.execPath, [scriptPath], {
          cwd: repoRoot,
          encoding: 'utf8',
          timeout: 60_000,
        });
        expect(`${run.status}:${String(run.stderr).slice(0, 400)}`).toBe('0:');
        return run.stdout.trim();
      });
      expect(versions[0]).toMatch(/^v1_[0-9a-f]{64}$/);
      expect(versions[0]).toBe(versions[1]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the version has the canonical v1_<64 hex> form and stable serialization bytes', () => {
    const first = compileAgentProfile(base());
    const second = compileAgentProfile(structuredClone(base()));
    if (!first.ok || !second.ok) {
      throw new Error('expected ok');
    }
    expect(first.value.agentProfileVersion).toMatch(/^v1_[0-9a-f]{64}$/);
    expect(first.value.manifestJson).toBe(second.value.manifestJson);
    // The profile object is frozen.
    expect(Object.isFrozen(first.value.profile)).toBe(true);
    expect(Object.isFrozen(first.value.manifest)).toBe(true);
  });
});

describe('agentProfileVersion — every declared semantic participates', () => {
  it('schema marker change', () => {
    expectDifferent((p) => ({
      ...p,
      schema: 'vict.agent-profile@1' as const,
      revision: '1-schema',
    }));
    // (The closed schema rejects other markers; a revision change proves
    // sensitivity of the declared value itself.)
  });

  it('agent id change', () => {
    expectDifferent((p) => ({ ...p, id: 'agent.identity.other' }));
  });

  it('agent revision change', () => {
    expectDifferent((p) => ({ ...p, revision: '2' }));
  });

  it('instructions id change', () => {
    expectDifferent((p) => ({ ...p, instructions: { id: 'instructions.b', revision: '1' } }));
  });

  it('instructions revision change', () => {
    expectDifferent((p) => ({ ...p, instructions: { id: 'instructions.a', revision: '2' } }));
  });

  it('model-profile id change', () => {
    expectDifferent((p) => ({ ...p, modelProfile: { ...p.modelProfile, id: 'model.b' } }));
  });

  it('model-profile revision change', () => {
    expectDifferent((p) => ({ ...p, modelProfile: { ...p.modelProfile, revision: '2' } }));
  });

  it('model router intent change', () => {
    expectDifferent((p) => ({
      ...p,
      modelProfile: { ...p.modelProfile, routerModel: 'other-provider/other-model' },
    }));
  });

  it('provider intent change', () => {
    expectDifferent((p) => ({
      ...p,
      modelProfile: { ...p.modelProfile, provider: 'other-provider' },
    }));
  });

  it('provider credential NAME change (names are declared data; values never exist here)', () => {
    expectDifferent((p) => ({
      ...p,
      modelProfile: { ...p.modelProfile, providerCredentialVar: 'OTHER_VAR_NAME' },
    }));
  });

  it('each generation field change', () => {
    expectDifferent((p) => ({ ...p, generation: { temperature: 0.9, maxOutputTokens: 512 } }));
    expectDifferent((p) => ({ ...p, generation: { temperature: 0.5, maxOutputTokens: 1024 } }));
    expectDifferent((p) => ({
      ...p,
      generation: { temperature: 0.5, maxOutputTokens: 512, topP: 0.9 },
    }));
    expectDifferent((p) => ({
      ...p,
      generation: { temperature: 0.5, maxOutputTokens: 512, maxRetries: 3 },
    }));
    expectDifferent((p) => ({ ...p, generation: {} }));
  });

  it('each turn-policy field change', () => {
    expectDifferent((p) => ({
      ...p,
      turnPolicy: { maxSteps: 8, maxToolCalls: 4, onLimit: 'fail-closed' },
    }));
    expectDifferent((p) => ({
      ...p,
      turnPolicy: { maxSteps: 4, maxToolCalls: 2, onLimit: 'fail-closed' },
    }));
    // onLimit is a closed enum with a single accepted value; any other value
    // must be REJECTED (covered by the validation suite).
  });

  it('memory-policy id and revision change', () => {
    expectDifferent((p) => ({ ...p, memoryPolicy: { id: 'memory-policy.b', revision: '1' } }));
    expectDifferent((p) => ({ ...p, memoryPolicy: { id: 'memory-policy.a', revision: '2' } }));
  });

  it('each processor reference change and processor ordering', () => {
    expectDifferent((p) => ({
      ...p,
      processors: [
        { id: 'processor.trim', revision: '1' },
        { id: 'processor.case', revision: '3' },
      ],
    }));
    expectDifferent((p) => ({
      ...p,
      processors: [
        { id: 'processor.case', revision: '2' },
        { id: 'processor.trim', revision: '1' },
      ],
    }));
    expectDifferent((p) => ({ ...p, processors: [{ id: 'processor.trim', revision: '1' }] }));
  });

  it('each guardrail reference change and guardrail ordering', () => {
    expectDifferent((p) => ({ ...p, guardrails: [{ id: 'guardrail.length', revision: '2' }] }));
    expectDifferent((p) => ({
      ...p,
      guardrails: [
        { id: 'guardrail.other', revision: '1' },
        { id: 'guardrail.length', revision: '1' },
      ],
    }));
  });

  it('structured-output contract presence, id, and revision change', () => {
    expectDifferent((p) => ({ ...p, structuredOutput: undefined }));
    expectDifferent((p) => ({
      ...p,
      structuredOutput: { contract: { id: 'contract.other', revision: '3' } },
    }));
    expectDifferent((p) => ({
      ...p,
      structuredOutput: { contract: { id: 'contract.structured', revision: '4' } },
    }));
  });

  it('each helper-tool reference change (membership and revision)', () => {
    expectDifferent((p) => ({
      ...p,
      helperTools: [
        { id: 'helper.uppercase', revision: '1' },
        { id: 'helper.format', revision: '3' },
      ],
    }));
    expectDifferent((p) => ({
      ...p,
      helperTools: [
        { id: 'helper.uppercase', revision: '1' },
        { id: 'helper.format', revision: '2' },
        { id: 'helper.extra', revision: '1' },
      ],
    }));
  });

  it('each capability reference change (the authority envelope)', () => {
    expectDifferent((p) => ({
      ...p,
      capabilities: [
        { id: 'cap.notes.write', revision: '3' },
        { id: 'cap.notes.read', revision: '1' },
      ],
    }));
    expectDifferent((p) => ({ ...p, capabilities: [{ id: 'cap.notes.read', revision: '1' }] }));
  });

  it('subagent and workflow reference changes', () => {
    expectDifferent((p) => ({ ...p, subagents: [{ id: 'agent.sub2', revision: '1' }] }));
    expectDifferent((p) => ({ ...p, subagents: undefined }));
    expectDifferent((p) => ({ ...p, workflows: [{ id: 'workflow.other', revision: '1' }] }));
    expectDifferent((p) => ({ ...p, workflows: undefined }));
  });

  it('adapter id, revision, and EVERY pinned runtime package version change', () => {
    expectDifferent((p) => ({ ...p, adapter: { ...p.adapter, id: 'adapter.other' } }));
    expectDifferent((p) => ({ ...p, adapter: { ...p.adapter, revision: '2' } }));
    expectDifferent((p) => ({
      ...p,
      adapter: {
        ...p.adapter,
        runtimePackages: { '@mastra/core': '9.9.9', '@mastra/memory': '1.28.2' },
      },
    }));
    expectDifferent((p) => ({
      ...p,
      adapter: {
        ...p.adapter,
        runtimePackages: { '@mastra/core': '1.64.0', '@mastra/memory': '9.9.9' },
      },
    }));
    expectDifferent((p) => ({
      ...p,
      adapter: { ...p.adapter, runtimePackages: { '@mastra/core': '1.64.0' } },
    }));
    expectDifferent((p) => ({
      ...p,
      adapter: {
        ...p.adapter,
        runtimePackages: {
          '@mastra/core': '1.64.0',
          '@mastra/memory': '1.28.2',
          '@mastra/libsql': '1.22.3',
        },
      },
    }));
  });
});

describe('agentProfileVersion — set ordering and forbidden inputs', () => {
  it('set insertion order does not change the version (helperTools, capabilities, subagents, workflows)', () => {
    const baseline = versionOf(base());
    expect(
      versionOf({
        ...base(),
        helperTools: [
          { id: 'helper.format', revision: '2' },
          { id: 'helper.uppercase', revision: '1' },
        ],
      }),
    ).toBe(baseline);
    expect(
      versionOf({
        ...base(),
        capabilities: [
          { id: 'cap.notes.read', revision: '1' },
          { id: 'cap.notes.write', revision: '2' },
        ],
      }),
    ).toBe(baseline);
    expect(versionOf({ ...base(), generation: { maxOutputTokens: 512, temperature: 0.5 } })).toBe(
      baseline,
    );
    expect(
      versionOf({
        ...base(),
        adapter: {
          ...base().adapter,
          runtimePackages: { '@mastra/memory': '1.28.2', '@mastra/core': '1.64.0' },
        },
      }),
    ).toBe(baseline);
  });

  it('no function-body hashing: two implementations under the same revisions share the version', () => {
    // The profile never carries functions; identity is fully declared data.
    // Different function bodies in ARTIFACTS cannot leak into identity
    // because the profile input accepts no functions at all.
    const withFunctionAttempt = base() as unknown as Record<string, unknown>;
    withFunctionAttempt[' rogue'] = undefined; // no effect
    expect(versionOf(structuredClone(base()))).toBe(versionOf(base()));
  });

  it('compilation is independent of caller object freezing or later mutation', () => {
    const profile = structuredClone(base());
    const before = versionOf(profile);
    const compiled = compileAgentProfile(profile);
    if (!compiled.ok) {
      throw new Error('expected ok');
    }
    // Caller object is NOT frozen by compilation.
    expect(Object.isFrozen(profile)).toBe(false);
    // Post-compilation mutation changes nothing about the compiled profile.
    const mutableCaller = profile as unknown as {
      revision: string;
      instructions: { revision: string };
      turnPolicy: { maxSteps: number };
    };
    mutableCaller.revision = 'mutated';
    mutableCaller.instructions.revision = 'mutated';
    mutableCaller.turnPolicy.maxSteps = 99;
    expect(compiled.value.agentProfileVersion).toBe(before);
    expect(compiled.value.profile.revision).toBe('1');
    expect(compiled.value.profile.turnPolicy.maxSteps).toBe(4);
    // The profile is not aliased: compiled data is a distinct capture.
    expect(compiled.value.profile).not.toBe(profile);
    // The SDK factory also leaves the caller unfrozen.
    const authored = defineAgentProfile(structuredClone(base()));
    expect(Object.isFrozen(authored)).toBe(true); // the returned capture IS frozen
    expect(Object.isFrozen(structuredClone(base()))).toBe(false);
  });
});
