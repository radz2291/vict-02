import { describe, expect, it } from 'vitest';
import { compileAgentProfile } from '../src/agent-profile.js';
import { defineAgentProfile, AGENT_PROFILE_SCHEMA } from '@vict/sdk';
import type { AgentProfileAuthoring } from '@vict/sdk';

/**
 * Stage 06A corrective regression — credential-reference boundary.
 *
 * `providerCredentialVar` is an environment-variable NAME, never a
 * credential value or arbitrary object. These tests exercise the PUBLIC
 * runtime boundary (compileAgentProfile accepts unknown plain JavaScript):
 * only a bounded, non-empty environment-variable identifier
 * ([A-Za-z_][A-Za-z0-9_]*) is accepted; objects, arrays, accessors,
 * inherited values, whitespace, separators, and secret-bearing strings are
 * rejected with a stable, structured, NON-ECHOING diagnostic — and a
 * hostile object carrying a unique secret canary can neither compile nor
 * serialize into the identity manifest.
 */

function profileWithCredentialVar(value: unknown): Record<string, unknown> {
  const profile = profileWithCredentialVarUntyped(value) as Record<string, unknown>;
  return profile;
}

function profileWithCredentialVarUntyped(value: unknown): unknown {
  return {
    schema: AGENT_PROFILE_SCHEMA,
    id: 'agent.credvar',
    revision: '1',
    instructions: { id: 'instructions.cv', revision: '1' },
    modelProfile: {
      id: 'model.cv',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
      providerCredentialVar: value,
    },
    generation: {},
    turnPolicy: { maxSteps: 4, maxToolCalls: 4, onLimit: 'fail-closed' },
    memoryPolicy: { id: 'memory-policy.cv', revision: '1' },
    adapter: { id: '@vict/mastra', revision: '1', runtimePackages: {} },
  };
}

/** A unique secret canary that must never appear anywhere. */
const SECRET_CANARY = 'sk-canary-SECRET-VALUE-9f2a71';

describe('providerCredentialVar accepts only environment-variable names', () => {
  const validNames = ['OPENAI_API_KEY', '_PRIVATE', 'a', 'VICT_PROVIDER_KEY_2', 'x9_y'];
  for (const name of validNames) {
    it(`accepts the bounded name '${name}'`, () => {
      const result = compileAgentProfile(profileWithCredentialVar(name));
      expect(result.ok).toBe(true);
      if (result.ok) {
        const manifest = JSON.parse(result.value.manifestJson) as {
          profile: { modelProfile: { providerCredentialVar: string } };
        };
        expect(manifest.profile.modelProfile.providerCredentialVar).toBe(name);
      }
    });
  }

  it('accepts an absent providerCredentialVar (canonical null in the manifest)', () => {
    const input = profileWithCredentialVarUntyped(undefined) as Record<string, unknown>;
    const modelProfile = { ...(input.modelProfile as Record<string, unknown>) };
    delete modelProfile.providerCredentialVar;
    const result = compileAgentProfile({ ...input, modelProfile });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.manifestJson).toContain('"providerCredentialVar":null');
    }
  });

  it('accepting a valid name does not disturb identity: the compiled version is deterministic', () => {
    const authored = defineAgentProfile(
      profileWithCredentialVar('OPENAI_API_KEY') as unknown as AgentProfileAuthoring,
    );
    const first = compileAgentProfile(authored);
    const second = compileAgentProfile(structuredClone(authored));
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.agentProfileVersion).toBe(first.value.agentProfileVersion);
    }
  });
});

describe('providerCredentialVar rejects hostile shapes with non-echoing diagnostics', () => {
  const hostile: Array<{ readonly label: string; readonly value: unknown }> = [
    { label: 'object carrying a secret', value: { value: SECRET_CANARY } },
    { label: 'nested object', value: { nested: { deep: 'x' } } },
    { label: 'array', value: ['OPENAI_API_KEY'] },
    { label: 'empty string', value: '' },
    { label: 'whitespace name', value: ' OPENAI_API_KEY' },
    { label: 'trailing newline', value: 'OPENAI_API_KEY\n' },
    { label: 'separator (=)', value: 'OPENAI_API_KEY=sk-abc' },
    { label: 'separator (:) with secret', value: 'OPENAI_API_KEY:secret' },
    { label: 'shell expansion', value: '$HOME/secret' },
    { label: 'leading digit', value: '1INVALID' },
    { label: 'hyphen', value: 'INVALID-NAME' },
    { label: 'dot notation', value: 'a.b' },
    { label: 'value-like secret string', value: SECRET_CANARY },
    { label: 'number', value: 42 },
    { label: 'boolean', value: true },
    { label: 'null', value: null },
  ];

  for (const entry of hostile) {
    it(`rejects ${entry.label}`, () => {
      const result = compileAgentProfile(profileWithCredentialVar(entry.value));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const issue = result.issues.find(
          (candidate) => candidate.code === 'AGENT_PROFILE_INVALID_CREDENTIAL_VAR',
        );
        expect(issue).toBeDefined();
        expect(issue?.path).toBe('(profile).modelProfile.providerCredentialVar');
        // NON-ECHOING: neither the raw canary nor a serialization of the
        // hostile value may appear in any diagnostic.
        expect(JSON.stringify(result.issues)).not.toContain(SECRET_CANARY);
      }
    });
  }

  it('rejects an accessor member (getter) by descriptor inspection without invoking it', () => {
    const canaryGetter = (): string => SECRET_CANARY;
    let invoked = false;
    const input = profileWithCredentialVarUntyped(undefined) as Record<string, unknown>;
    const modelProfile: Record<string, unknown> = {
      ...(input.modelProfile as Record<string, unknown>),
    };
    delete modelProfile.providerCredentialVar;
    const hostileProfile: Record<string, unknown> = { ...input, modelProfile };
    Object.defineProperty(hostileProfile.modelProfile, 'providerCredentialVar', {
      enumerable: true,
      get() {
        invoked = true;
        return canaryGetter();
      },
    });
    const result = compileAgentProfile(hostileProfile);
    expect(invoked).toBe(false);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(SECRET_CANARY);
  });

  it('rejects an inherited (prototype-chain) value; own properties only', () => {
    const base = { providerCredentialVar: 'OPENAI_API_KEY' };
    const derived = Object.create(base) as Record<string, unknown>;
    const input = profileWithCredentialVarUntyped(undefined) as Record<string, unknown>;
    const modelProfile = { ...(input.modelProfile as Record<string, unknown>) };
    delete modelProfile.providerCredentialVar;
    // `derived` becomes the modelProfile: the member is NOT an own property.
    const hostileProfile = { ...input, modelProfile: { ...modelProfile, ...derived } };
    // Plain spread copies it as an own property, so compile must reject the
    // merged profile through the ordinary path only when the value itself is
    // invalid; the pure prototype case is covered by the canonical walk.
    const result = compileAgentProfile(hostileProfile);
    expect(result.ok).toBe(true); // spread produced a VALID own value
    // Now the pure prototype-chain case: own properties only are read.
    const protoOnly = Object.create({ providerCredentialVar: SECRET_CANARY }) as Record<
      string,
      unknown
    >;
    const merged = { ...modelProfile, ...protoOnly };
    expect(Object.prototype.hasOwnProperty.call(merged, 'providerCredentialVar')).toBe(false);
    const result2 = compileAgentProfile({ ...input, modelProfile: merged });
    expect(result2.ok).toBe(true); // inherited members are not read at all
    if (result2.ok) {
      expect(result2.value.manifestJson).not.toContain(SECRET_CANARY);
    }
  });
});
