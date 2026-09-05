import { describe, expect, it } from 'vitest';
import { compileAgentProfile } from '@vict/kernel';
import { defineAgentProfile, VictAuthoringError } from '@vict/sdk';
import type { AgentProfileAuthoring } from '@vict/sdk';

/**
 * Stage 06A permanent regression: the strict agent-profile validation
 * boundary — closed schema, required members, canonical data only, stable
 * non-echoing diagnostics, fail-closed compilation.
 */

function base(): AgentProfileAuthoring {
  return {
    schema: 'vict.agent-profile@1',
    id: 'agent.validation',
    revision: '1',
    instructions: { id: 'instructions.a', revision: '1' },
    modelProfile: {
      id: 'model.a',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: {},
    turnPolicy: { maxSteps: 4, maxToolCalls: 4, onLimit: 'fail-closed' },
    memoryPolicy: { id: 'memory-policy.a', revision: '1' },
    adapter: { id: '@vict/mastra', revision: '1', runtimePackages: {} },
  };
}

function expectRejected(mutate: (profile: AgentProfileAuthoring) => unknown, code?: string): void {
  const result = compileAgentProfile(mutate(structuredClone(base())));
  expect(result.ok).toBe(false);
  if (!result.ok) {
    // Diagnostics are path-sorted and deterministic.
    const sorted = [...result.issues].map(
      (issue) => `${issue.path ?? ''}|${issue.code}|${issue.message}`,
    );
    expect([...sorted].sort()).toEqual(sorted);
    // No invalid value is echoed.
    for (const issue of result.issues) {
      expect(issue.message).not.toContain('SECRET');
    }
    if (code !== undefined) {
      expect(result.issues.map((issue) => issue.code)).toContain(code);
    }
  }
}

describe('agent-profile schema — closed marker and members', () => {
  it('accepts the minimal valid profile', () => {
    const result = compileAgentProfile(base());
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown schema marker', () => {
    expectRejected(
      (p) => ({ ...p, schema: 'vict.agent-profile@2' }),
      'AGENT_PROFILE_UNKNOWN_SCHEMA',
    );
  });

  it('rejects unknown top-level fields (misspelled members fail loudly)', () => {
    expectRejected((p) => ({ ...p, temperature: 5 }), 'AGENT_PROFILE_UNKNOWN_FIELD');
    expectRejected(
      (p) => ({ ...p, instructionsText: 'inline raw text' }),
      'AGENT_PROFILE_UNKNOWN_FIELD',
    );
  });

  it('rejects unknown nested fields', () => {
    expectRejected(
      (p) => ({ ...p, modelProfile: { ...p.modelProfile, unknownOption: true } }),
      'AGENT_PROFILE_UNKNOWN_FIELD',
    );
    expectRejected(
      (p) => ({ ...p, turnPolicy: { ...p.turnPolicy, loop: 'allowed' } }),
      'AGENT_PROFILE_UNKNOWN_FIELD',
    );
    expectRejected(
      (p) => ({ ...p, adapter: { ...p.adapter, extra: 1 } }),
      'AGENT_PROFILE_UNKNOWN_FIELD',
    );
    expectRejected(
      (p) => ({ ...p, instructions: { ...p.instructions, revisionBump: true } }),
      'AGENT_PROFILE_UNKNOWN_FIELD',
    );
  });

  it('rejects every missing required member (never silently defaulted)', () => {
    for (const key of [
      'schema',
      'id',
      'revision',
      'instructions',
      'modelProfile',
      'generation',
      'turnPolicy',
      'memoryPolicy',
      'adapter',
    ] as const) {
      const profile = structuredClone(base()) as unknown as Record<string, unknown>;
      delete profile[key];
      expectRejected(() => profile, 'AGENT_PROFILE_REQUIRED_MEMBER');
    }
    expectRejected(
      (p) => ({ ...p, modelProfile: { id: p.modelProfile.id, revision: p.modelProfile.revision } }),
      'AGENT_PROFILE_REQUIRED_MEMBER',
    );
    expectRejected(
      (p) => ({ ...p, turnPolicy: { maxSteps: 4, maxToolCalls: 4 } }),
      'AGENT_PROFILE_REQUIRED_MEMBER',
    );
    expectRejected(
      (p) => ({ ...p, adapter: { id: p.adapter.id, revision: p.adapter.revision } }),
      'AGENT_PROFILE_REQUIRED_MEMBER',
    );
  });

  it('rejects empty or invalid ids and revisions', () => {
    expectRejected((p) => ({ ...p, id: '' }), 'AGENT_PROFILE_EMPTY_ID');
    expectRejected((p) => ({ ...p, revision: '   ' }), 'AGENT_PROFILE_EMPTY_REVISION');
    expectRejected(
      (p) => ({ ...p, instructions: { id: '', revision: '1' } }),
      'AGENT_PROFILE_EMPTY_ID',
    );
    expectRejected(
      (p) => ({ ...p, memoryPolicy: { id: 'x', revision: '' } }),
      'AGENT_PROFILE_EMPTY_REVISION',
    );
  });

  it('rejects out-of-range generation and turn-policy bounds', () => {
    expectRejected(
      (p) => ({ ...p, generation: { temperature: 3 } }),
      'AGENT_PROFILE_INVALID_BOUND',
    );
    expectRejected((p) => ({ ...p, generation: { topP: 0 } }), 'AGENT_PROFILE_INVALID_BOUND');
    expectRejected(
      (p) => ({ ...p, generation: { maxOutputTokens: 0 } }),
      'AGENT_PROFILE_INVALID_BOUND',
    );
    expectRejected(
      (p) => ({ ...p, generation: { maxRetries: 1.5 } }),
      'AGENT_PROFILE_INVALID_BOUND',
    );
    expectRejected(
      (p) => ({ ...p, turnPolicy: { maxSteps: 0, maxToolCalls: 4, onLimit: 'fail-closed' } }),
      'AGENT_PROFILE_INVALID_BOUND',
    );
    expectRejected(
      (p) => ({ ...p, turnPolicy: { maxSteps: 4, maxToolCalls: -1, onLimit: 'fail-closed' } }),
      'AGENT_PROFILE_INVALID_BOUND',
    );
    expectRejected(
      (p) => ({ ...p, turnPolicy: { maxSteps: 100, maxToolCalls: 4, onLimit: 'fail-closed' } }),
      'AGENT_PROFILE_INVALID_BOUND',
    );
  });

  it('rejects any turn-policy loop value other than fail-closed', () => {
    expectRejected(
      (p) => ({ ...p, turnPolicy: { maxSteps: 4, maxToolCalls: 4, onLimit: 'continue' } }),
      'AGENT_PROFILE_INVALID_ENUM',
    );
    expectRejected(
      (p) => ({ ...p, turnPolicy: { maxSteps: 4, maxToolCalls: 4, onLimit: 'truncate' } }),
      'AGENT_PROFILE_INVALID_ENUM',
    );
  });

  it('rejects duplicate set entries (set-like collections are not multisets)', () => {
    expectRejected(
      (p) => ({
        ...p,
        helperTools: [
          { id: 'helper.a', revision: '1' },
          { id: 'helper.a', revision: '1' },
        ],
      }),
      'AGENT_PROFILE_DUPLICATE_REFERENCE',
    );
    expectRejected(
      (p) => ({
        ...p,
        capabilities: [
          { id: 'cap.a', revision: '1' },
          { id: 'cap.a', revision: '1' },
        ],
      }),
      'AGENT_PROFILE_DUPLICATE_REFERENCE',
    );
  });
});

describe('agent-profile schema — strict canonical data only', () => {
  it('rejects functions anywhere in the profile', () => {
    expectRejected((p) => {
      const hostile = p as unknown as Record<string, unknown>;
      hostile['execute'] = () => 'SECRET';
      return hostile;
    }, 'AGENT_PROFILE_NON_CANONICAL_VALUE');
  });

  it('rejects accessor members without invoking them', () => {
    let invoked = false;
    const profile: Record<string, unknown> = Object.create(Object.prototype, {
      ...Object.getOwnPropertyDescriptors(structuredClone(base())),
      secretGetter: {
        enumerable: true,
        get() {
          invoked = true;
          return 'SECRET-VALUE';
        },
      },
    });
    const result = compileAgentProfile(profile);
    expect(result.ok).toBe(false);
    expect(invoked).toBe(false); // rejected by descriptor inspection, never invoked
  });

  it('rejects inherited members (own enumerable data properties only)', () => {
    const parent = { inherited: 'from-parent' };
    const profile = structuredClone(base()) as unknown as Record<string, unknown>;
    Object.setPrototypeOf(profile, parent);
    expectRejected(() => profile, 'AGENT_PROFILE_NON_CANONICAL_VALUE');
  });

  it('rejects non-enumerable members', () => {
    const profile = structuredClone(base()) as unknown as Record<string, unknown>;
    Object.defineProperty(profile, 'hidden', { value: 'SECRET', enumerable: false });
    expectRejected(() => profile, 'AGENT_PROFILE_NON_CANONICAL_VALUE');
  });

  it('rejects symbol-keyed members', () => {
    const profile = structuredClone(base()) as unknown as Record<string, unknown>;
    Reflect.set(profile, Symbol('s'), 'SECRET');
    expectRejected(() => profile, 'AGENT_PROFILE_NON_CANONICAL_VALUE');
  });

  it('rejects sparse arrays and undefined array elements', () => {
    expectRejected((p) => {
      const mutated = p as unknown as Record<string, unknown>;
      const sparse: string[] = [];
      sparse[2] = 'x';
      mutated['processors'] = sparse;
      return mutated;
    }, 'AGENT_PROFILE_NON_CANONICAL_VALUE');
  });

  it('rejects arrays with additional properties and accessor array elements', () => {
    expectRejected((p) => {
      const array: unknown[] = [{ id: 'processor.trim', revision: '1' }];
      (array as unknown as Record<string, unknown>)['extra'] = 'x';
      const mutated = p as unknown as Record<string, unknown>;
      mutated['processors'] = array;
      return mutated;
    }, 'AGENT_PROFILE_NON_CANONICAL_VALUE');
  });

  it('rejects exotic values: Dates, class instances, Maps, BigInts, NaN, Infinity, negative zero', () => {
    expectRejected(
      (p) => ({ ...p, generatedAt: new Date(0) }) as unknown as AgentProfileAuthoring,
      'AGENT_PROFILE_NON_CANONICAL_VALUE',
    );
    expectRejected((p) => {
      class Rogue {}
      const mutated = p as unknown as Record<string, unknown>;
      mutated['rogue'] = new Rogue();
      return mutated;
    }, 'AGENT_PROFILE_NON_CANONICAL_VALUE');
    expectRejected((p) => {
      const mutated = p as unknown as Record<string, unknown>;
      mutated['tags'] = new Map();
      return mutated;
    }, 'AGENT_PROFILE_NON_CANONICAL_VALUE');
    // Non-finite numbers are outside the canonical domain (rejected before
    // bound checks run).
    expectRejected(
      (p) => ({ ...p, generation: { temperature: Number.NaN } }),
      'AGENT_PROFILE_NON_CANONICAL_VALUE',
    );
    expectRejected(
      (p) => ({ ...p, generation: { temperature: Number.POSITIVE_INFINITY } }),
      'AGENT_PROFILE_NON_CANONICAL_VALUE',
    );
    expectRejected(
      (p) => ({ ...p, generation: { maxOutputTokens: 1.5 } }),
      'AGENT_PROFILE_INVALID_BOUND',
    );
  });

  it('rejects cyclic structures', () => {
    const profile = structuredClone(base()) as unknown as Record<string, unknown>;
    const cyclic: Record<string, unknown> = { self: null };
    cyclic['self'] = cyclic;
    profile['cycle'] = cyclic;
    expectRejected(() => profile, 'AGENT_PROFILE_NON_CANONICAL_VALUE');
  });

  it('rejects hostile and revoked proxies without echoing their content', () => {
    const hostileProxy = new Proxy(structuredClone(base()), {
      getOwnPropertyDescriptor() {
        throw new Error('SECRET hostile descriptor message');
      },
    });
    const result = compileAgentProfile(hostileProxy);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(JSON.stringify(result.issues)).not.toContain('SECRET hostile');
    }
  });

  it('produces no partial compiled profile on failure', () => {
    const broken = structuredClone(base()) as unknown as Record<string, unknown>;
    broken['turnPolicy'] = { maxSteps: -1, maxToolCalls: 4, onLimit: 'nonsense' };
    const result = compileAgentProfile(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect('value' in result).toBe(false);
      expect('agentProfileVersion' in result).toBe(false);
    }
  });
});

describe('agent-profile authoring factory', () => {
  it('captures a frozen copy and leaves the caller object unfrozen', () => {
    const caller = structuredClone(base());
    const captured = defineAgentProfile(caller);
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(caller)).toBe(false);
    // Caller mutation does not reach the capture.
    const mutableCaller = caller as { revision: string };
    mutableCaller.revision = 'mutated';
    expect(captured.revision).toBe('1');
  });

  it('rejects accessor members without invoking them at authoring time', () => {
    let invoked = false;
    const caller: Record<string, unknown> = Object.create(Object.prototype, {
      ...Object.getOwnPropertyDescriptors(structuredClone(base())),
      rogue: {
        enumerable: true,
        get() {
          invoked = true;
          return 'SECRET';
        },
      },
    });
    expect(() => defineAgentProfile(caller as unknown as AgentProfileAuthoring)).toThrow(
      VictAuthoringError,
    );
    expect(invoked).toBe(false);
  });

  it('rejects functions, BigInts, and exotic prototypes at authoring time', () => {
    const withFunction = structuredClone(base()) as unknown as Record<string, unknown>;
    withFunction['execute'] = () => 'x';
    expect(() => defineAgentProfile(withFunction as unknown as AgentProfileAuthoring)).toThrow(
      VictAuthoringError,
    );

    const withBigInt = structuredClone(base()) as unknown as Record<string, unknown>;
    withBigInt['size'] = 1n;
    expect(() => defineAgentProfile(withBigInt as unknown as AgentProfileAuthoring)).toThrow(
      VictAuthoringError,
    );

    const withDate = structuredClone(base()) as unknown as Record<string, unknown>;
    withDate['at'] = new Date(0);
    expect(() => defineAgentProfile(withDate as unknown as AgentProfileAuthoring)).toThrow(
      VictAuthoringError,
    );
  });
});
