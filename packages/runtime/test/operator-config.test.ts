import { describe, expect, it } from 'vitest';
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  OPERATOR_CONFIG_SCHEMA,
  OperatorConfigError,
  OperatorCredentialUnavailableError,
  requireOperatorCredential,
  resolveOperatorConfiguration,
  serializeOperatorConfiguration,
} from '../src/operator-config.js';

/**
 * Stage 07A work item 6 — protected operator-configuration foundation
 * tests (offline, canary-based).
 *
 * Proven here:
 * - the configuration resolves provider-profile selection (one pinned
 *   profile), store locations, and retention bounds with closed field
 *   sets and bounded patterns;
 * - the provider credential VARIABLE NAME is carried; a credential VALUE
 *   has no field to live in — the serialized surface structurally cannot
 *   contain one;
 * - unique credential-value canaries planted in the environment NEVER
 *   appear in the resolved configuration, its serialization, error
 *   messages, error stacks, console-captured log output, or any persisted
 *   byte;
 * - a missing required credential fails closed with the stable
 *   non-echoing `VICT_OPERATOR_CREDENTIAL_UNAVAILABLE` code;
 * - unknown/value-shaped fields (`credential`, `apiKey`) are rejected
 *   with the stable `VICT_OPERATOR_CONFIG_INVALID` code and never echoed.
 */

/** Unique credential-value canaries (never committed anywhere else). */
const CANARY_VALUE = `sk-operator-canary-VALUE-${Math.random().toString(36).slice(2, 10)}`;
const CANARY_VALUE_2 = `sk-operator-canary-ALT-${Math.random().toString(36).slice(2, 10)}`;
const CREDENTIAL_VAR = 'VICT_TEST_PROVIDER_KEY';

const VALID_INPUT = {
  profile: {
    profileId: 'profile.quellight-primary',
    provider: 'offline-fixture',
    routerModel: 'offline-fixture/deterministic-1',
    credentialVar: CREDENTIAL_VAR,
  },
  stores: {
    operationalStorePath: 'data/vict-operational.db',
    applicationStorePath: 'data/quellight-appdata.db',
    mastraStorePath: 'data/quellight-mastra.db',
  },
  retention: {
    messagesMaxAgeMs: 3_600_000,
    threadsMaxAgeMs: 86_400_000,
    spansMaxAgeMs: 1_800_000,
  },
};

describe('operator configuration resolution (closed, bounded, typed)', () => {
  it('resolves a complete frozen configuration with the schema marker', () => {
    const config = resolveOperatorConfiguration(VALID_INPUT);
    expect(config.schema).toBe(OPERATOR_CONFIG_SCHEMA);
    expect(config.profile).toEqual({
      profileId: 'profile.quellight-primary',
      provider: 'offline-fixture',
      routerModel: 'offline-fixture/deterministic-1',
      credentialVar: CREDENTIAL_VAR,
    });
    expect(config.stores.operationalStorePath).toBe('data/vict-operational.db');
    expect(config.retention.threadsMaxAgeMs).toBe(86_400_000);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.profile)).toBe(true);
  });

  it('resolves with omitted stores/retention sections', () => {
    const config = resolveOperatorConfiguration({ profile: VALID_INPUT.profile });
    expect(config.stores).toEqual({});
    expect(config.retention).toEqual({});
  });

  it('rejects unknown top-level fields (fail closed, stable code)', () => {
    // A value-shaped smuggle attempt: the closed field set rejects it.
    const hostile = { ...VALID_INPUT, credential: CANARY_VALUE };
    try {
      resolveOperatorConfiguration(hostile as never);
      expect.unreachable('hostile input must be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(OperatorConfigError);
      expect((error as OperatorConfigError).code).toBe('VICT_OPERATOR_CONFIG_INVALID');
      expect((error as Error).message).not.toContain(CANARY_VALUE);
    }
  });

  it('rejects value-shaped profile fields and never echoes their content', () => {
    const hostileProfile = {
      profileId: 'profile.x',
      provider: 'offline-fixture',
      routerModel: 'offline-fixture/deterministic-1',
      credentialVar: CREDENTIAL_VAR,
      apiKey: CANARY_VALUE_2,
    };
    try {
      resolveOperatorConfiguration({ profile: hostileProfile });
      expect.unreachable('value-shaped profile must be rejected');
    } catch (error) {
      expect((error as OperatorConfigError).code).toBe('VICT_OPERATOR_CONFIG_INVALID');
      expect((error as Error).message).not.toContain(CANARY_VALUE_2);
    }
  });

  it('rejects non-name credentialVar values (separators, whitespace, objects)', () => {
    for (const bad of ['has space', 'a/b', 'a-b', '', 42, { v: 1 }, null]) {
      expect(() =>
        resolveOperatorConfiguration({
          profile: { ...VALID_INPUT.profile, credentialVar: bad },
        }),
      ).toThrow(OperatorConfigError);
    }
  });

  it('rejects traversal, URL schemes, and absolute paths in store locations', () => {
    for (const bad of [
      '../escape.db',
      'http://evil/x.db',
      'C:\\abs\\path.db',
      '/absolute/path.db',
      'a//b.db',
    ]) {
      expect(() =>
        resolveOperatorConfiguration({
          profile: VALID_INPUT.profile,
          stores: { operationalStorePath: bad },
        }),
      ).toThrow(OperatorConfigError);
    }
  });

  it('rejects non-positive or non-integer retention bounds', () => {
    for (const bad of [0, -5, 1.5, Number.NaN, '3600000']) {
      expect(() =>
        resolveOperatorConfiguration({
          profile: VALID_INPUT.profile,
          retention: { messagesMaxAgeMs: bad },
        }),
      ).toThrow(OperatorConfigError);
    }
  });

  it('rejects accessor-carried and exotic-prototype configuration documents', () => {
    const exotic = Object.create(new (class {})()) as Record<string, unknown>;
    exotic.profile = VALID_INPUT.profile;
    expect(() => resolveOperatorConfiguration(exotic as never)).toThrow(OperatorConfigError);

    const accessorDoc: Record<string, unknown> = {};
    Object.defineProperty(accessorDoc, 'profile', {
      enumerable: true,
      get() {
        return VALID_INPUT.profile;
      },
    });
    expect(() => resolveOperatorConfiguration(accessorDoc as never)).toThrow(OperatorConfigError);
  });
});

describe('credential-value canary isolation (SEC-003 / MSTR-011 discipline)', () => {
  it('the resolved configuration and its serialization contain the NAME, never a VALUE', () => {
    const config = resolveOperatorConfiguration(VALID_INPUT);
    const serialized = serializeOperatorConfiguration(config);
    expect(serialized).toContain(CREDENTIAL_VAR);
    expect(serialized).not.toContain(CANARY_VALUE);
    expect(serialized).not.toContain(CANARY_VALUE_2);
    // Deterministic serialization (sorted keys).
    expect(serializeOperatorConfiguration(config)).toBe(serialized);
  });

  it('requireOperatorCredential resolves the value just in time (never into config)', async () => {
    const config = resolveOperatorConfiguration(VALID_INPUT);
    const environment: Record<string, string | undefined> = {
      [CREDENTIAL_VAR]: CANARY_VALUE,
      UNRELATED: CANARY_VALUE_2,
    };
    const value = await requireOperatorCredential(config, environment);
    expect(value).toBe(CANARY_VALUE);
    // The value is not cached into the configuration surface.
    expect(serializeOperatorConfiguration(config)).not.toContain(CANARY_VALUE);
  });

  it('a missing required credential fails closed with the stable non-echoing code', async () => {
    const config = resolveOperatorConfiguration(VALID_INPUT);
    try {
      await requireOperatorCredential(config, { UNRELATED: CANARY_VALUE_2 });
      expect.unreachable('missing credential must fail closed');
    } catch (error) {
      expect(error).toBeInstanceOf(OperatorCredentialUnavailableError);
      const err = error as OperatorCredentialUnavailableError;
      expect(err.code).toBe('VICT_OPERATOR_CREDENTIAL_UNAVAILABLE');
      expect(err.credentialName).toBe(CREDENTIAL_VAR);
      // Name is carried; no environment content is echoed.
      expect(err.message).not.toContain(CANARY_VALUE);
      expect(err.message).not.toContain(CANARY_VALUE_2);
      expect(String(err.stack)).not.toContain(CANARY_VALUE);
    }
  });

  it('a throwing credential provider fails closed without echoing provider content', async () => {
    const config = resolveOperatorConfiguration(VALID_INPUT);
    const hostileProvider = {
      async get(name: string): Promise<string | undefined> {
        throw new Error(`provider exploded reading ${name}: ${CANARY_VALUE}`);
      },
    };
    try {
      await requireOperatorCredential(config, hostileProvider);
      expect.unreachable('throwing provider must fail closed');
    } catch (error) {
      expect((error as OperatorConfigError).code).toBe('VICT_OPERATOR_CREDENTIAL_UNAVAILABLE');
      expect((error as Error).message).not.toContain(CANARY_VALUE);
      expect((error as Error).message).not.toContain('provider exploded');
    }
  });

  it('canaries are absent from logs, serialized config, and every persisted byte', async () => {
    const config = resolveOperatorConfiguration(VALID_INPUT);
    const dir = mkdtempSync(join(tmpdir(), 'vict-operator-config-'));
    try {
      // Capture "log output" (console surface a composition might use).
      const logged: string[] = [];
      const originalLog = console.log;
      console.log = (...parts: unknown[]): void => {
        logged.push(parts.map((p) => String(p)).join(' '));
      };
      let credential: string | undefined;
      try {
        console.log('resolved operator configuration:', serializeOperatorConfiguration(config));
        credential = await requireOperatorCredential(config, { [CREDENTIAL_VAR]: CANARY_VALUE });
        // A realistic (disciplined) composition logs the name, never the value.
        console.log('using credential variable:', config.profile.credentialVar);
      } finally {
        console.log = originalLog;
      }
      expect(credential).toBe(CANARY_VALUE);
      const logText = logged.join('\n');
      expect(logText).toContain(CREDENTIAL_VAR);
      expect(logText).not.toContain(CANARY_VALUE);
      expect(logText).not.toContain(CANARY_VALUE_2);

      // Persisted surface: the serialized configuration to disk; scan bytes.
      const persisted = join(dir, 'operator-config.json');
      writeFileSync(persisted, serializeOperatorConfiguration(config), 'utf8');
      const bytes = readFileSync(persisted, 'utf8');
      expect(bytes).toContain(CREDENTIAL_VAR);
      expect(bytes).not.toContain(CANARY_VALUE);
      expect(bytes).not.toContain(CANARY_VALUE_2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
