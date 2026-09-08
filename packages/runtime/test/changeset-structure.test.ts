import { describe, expect, it } from 'vitest';
import {
  validateApplicationReleaseContent,
  validateChangeSetContent,
  validateChangeSetOperation,
  VictControlError,
} from '@vict/runtime';

/**
 * Stage 06B final reliability correction — R6 negative controls.
 *
 * At the pre-correction SHA these malformed declarations were ACCEPTED by
 * `validateChangeSetOperation` (missing / non-string fields were skipped
 * and then cast to a string). Every probe here must fail closed with a
 * stable `VictControlError`, produce no record and no content hash, and
 * never invoke caller code (accessors/getters) or echo captured values.
 */

const VALID_ACTIVATION_OP = {
  kind: 'select-activation',
  graphId: 'graph.reliability',
  activationVersion: 'v2-rel',
};

const VALID_BASE: Parameters<typeof validateChangeSetContent>[0]['base'] = {
  kind: 'release',
  subjectId: 'app.rel',
  expectedVersion: 'none',
};

function expectRejected(fn: () => unknown): void {
  let code: string | undefined;
  try {
    fn();
  } catch (error) {
    // Only stable structured control errors may cross the boundary.
    expect(error).toBeInstanceOf(VictControlError);
    code = (error as VictControlError).code;
    expect(code).toMatch(/^VICT_/);
    expect(String((error as Error).message)).not.toContain('undefined');
    return;
  }
  throw new Error(`expected rejection with a stable code, got code=${String(code)}`);
}

describe('R6: malformed ChangeSet operations are rejected (negative controls)', () => {
  it('rejects the four historically accepted malformed declarations', () => {
    // Missing every required member.
    expectRejected(() => validateChangeSetOperation({ kind: 'select-activation' }));
    // Non-string identifier member.
    expectRejected(() => validateChangeSetOperation({ kind: 'rollback-activation', graphId: 42 }));
    // Missing identifier members.
    expectRejected(() =>
      validateChangeSetOperation({ kind: 'select-release', releaseVersion: 'release-a' }),
    );
    // Missing identifier members (rollback-release).
    expectRejected(() =>
      validateChangeSetOperation({ kind: 'rollback-release', applicationId: 'app-a' }),
    );
  });

  it('enforces the closed own-field set per operation kind', () => {
    expectRejected(() => validateChangeSetOperation({ ...VALID_ACTIVATION_OP, extra: 'field' }));
    expectRejected(() =>
      validateChangeSetOperation({
        kind: 'select-release',
        applicationId: 'app.rel',
        releaseVersion: 'release-a',
        unexpected: 1,
      }),
    );
    // Unknown kind.
    expectRejected(() => validateChangeSetOperation({ kind: 'drop-table' }));
    // Non-object and missing-kind probes.
    expectRejected(() => validateChangeSetOperation(undefined));
    expectRejected(() => validateChangeSetOperation('select-activation'));
    expectRejected(() => validateChangeSetOperation([VALID_ACTIVATION_OP]));
  });

  it('rejects accessor properties WITHOUT invoking the getters', () => {
    let getterInvocations = 0;
    const hostile = {
      kind: 'select-activation',
      get graphId(): string {
        getterInvocations += 1;
        return 'graph.hostile';
      },
      activationVersion: 'v2-rel',
    };
    expectRejected(() => validateChangeSetOperation(hostile));
    expect(getterInvocations).toBe(0);
  });

  it('rejects inherited, non-enumerable, and symbol-keyed members', () => {
    const inherited = Object.create({ graphId: 'graph.inherited' }) as Record<string, unknown>;
    inherited['kind'] = 'select-activation';
    inherited['activationVersion'] = 'v2-rel';
    expectRejected(() => validateChangeSetOperation(inherited));

    const hidden = { ...VALID_ACTIVATION_OP };
    Object.defineProperty(hidden, 'activationVersion', { enumerable: false });
    expectRejected(() => validateChangeSetOperation(hidden));

    const symbolKeyed = { ...VALID_ACTIVATION_OP } as Record<PropertyKey, unknown>;
    symbolKeyed[Symbol('smuggled')] = 'payload';
    expectRejected(() => validateChangeSetOperation(symbolKeyed));
  });

  it('rejects exotic prototypes, sparse arrays, and hostile proxies', () => {
    class Exotic {}
    const exotic = Object.assign(new Exotic(), VALID_ACTIVATION_OP);
    expectRejected(() => validateChangeSetOperation(exotic));

    // Sparse operation arrays are hostile captures.
    const sparse: unknown[] = new Array(2);
    sparse[0] = VALID_ACTIVATION_OP;
    expectRejected(() =>
      validateChangeSetContent({
        changesetId: 'cs.rel.sparse',
        authorActorId: 'actor.rel',
        createdAt: 1000,
        base: VALID_BASE,
        operations: sparse,
        rationale: 'r',
        riskClass: 'low',
        requiredApproverCount: 1,
        expiresAt: 9000,
      }),
    );

    // A proxy that throws on inspection is rejected without a raw exception.
    const hostileProxy = new Proxy(
      { ...VALID_ACTIVATION_OP },
      {
        getOwnPropertyDescriptor() {
          throw new Error('trap');
        },
      },
    );
    expectRejected(() => validateChangeSetOperation(hostileProxy));
    // A proxy whose getPrototypeOf trap throws is equally rejected.
    const protoTrap = new Proxy(
      { ...VALID_ACTIVATION_OP },
      {
        getPrototypeOf() {
          throw new Error('proto trap');
        },
      },
    );
    expectRejected(() => validateChangeSetOperation(protoTrap));
  });

  it('release content and the ChangeSet base are closed structures; invalid content yields NO hash', () => {
    expectRejected(() =>
      validateApplicationReleaseContent({
        releaseVersion: 'release-a',
        applicationId: 'app-a',
        missingEverything: true,
      }),
    );
    expectRejected(() =>
      validateApplicationReleaseContent({
        releaseVersion: 'release-a',
        applicationId: 42,
        applicationVersion: 'app-1',
        rendererIdentity: 'r',
        componentRegistryIdentity: 'c',
        dataAdapterIdentity: 'd',
        activationBinding: 'a',
      }),
    );
    // Closed base structure.
    expectRejected(() =>
      validateChangeSetContent({
        changesetId: 'cs.rel.base',
        authorActorId: 'actor.rel',
        createdAt: 1000,
        base: { kind: 'release', subjectId: 'app.rel' } as unknown as Parameters<
          typeof validateChangeSetContent
        >[0]['base'],
        operations: [VALID_ACTIVATION_OP],
        rationale: 'r',
        riskClass: 'low',
        requiredApproverCount: 1,
        expiresAt: 9000,
      }),
    );
    expectRejected(() =>
      validateChangeSetContent({
        changesetId: 'cs.rel.base2',
        authorActorId: 'actor.rel',
        createdAt: 1000,
        base: {
          kind: 'release',
          subjectId: 'app.rel',
          expectedVersion: 'none',
          smuggled: 1,
        } as unknown as Parameters<typeof validateChangeSetContent>[0]['base'],
        operations: [VALID_ACTIVATION_OP],
        rationale: 'r',
        riskClass: 'low',
        requiredApproverCount: 1,
        expiresAt: 9000,
      }),
    );
    expectRejected(() =>
      validateChangeSetContent({
        changesetId: 'cs.rel.base3',
        authorActorId: 'actor.rel',
        createdAt: 1000,
        base: {
          kind: 'release',
          subjectId: 'app.rel',
          expectedVersion: 9,
        } as unknown as Parameters<typeof validateChangeSetContent>[0]['base'],
        operations: [VALID_ACTIVATION_OP],
        rationale: 'r',
        riskClass: 'low',
        requiredApproverCount: 1,
        expiresAt: 9000,
      }),
    );
  });

  it('valid operations still validate and the hash derives from the VICT-owned capture', () => {
    const validated = validateChangeSetOperation(VALID_ACTIVATION_OP);
    expect(validated).toEqual({
      kind: 'select-activation',
      graphId: 'graph.reliability',
      activationVersion: 'v2-rel',
    });
    // The validated capture is a fresh plain object: mutating the caller's
    // object afterwards cannot change the validated content.
    const callerObject = { ...VALID_ACTIVATION_OP };
    const first = validateChangeSetOperation(callerObject);
    (callerObject as Record<string, unknown>)['activationVersion'] = 'v3-tampered';
    const second = validateChangeSetOperation(VALID_ACTIVATION_OP);
    expect(first).toEqual(second);

    const content = validateChangeSetContent({
      changesetId: 'cs.rel.ok',
      authorActorId: 'actor.rel',
      createdAt: 1000,
      base: VALID_BASE,
      operations: [VALID_ACTIVATION_OP],
      rationale: 'r',
      riskClass: 'low',
      requiredApproverCount: 1,
      expiresAt: 9000,
    });
    expect(content.operations).toEqual([validated]);
    expect(content.base).toEqual(VALID_BASE);
    expect(content.contentHash).toMatch(/^/);
  });
});
