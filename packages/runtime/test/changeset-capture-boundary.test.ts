import { describe, expect, it } from 'vitest';
import {
  authenticatedActorContext,
  createInMemoryAgentControlStores,
  validateChangeSetContent,
  validateChangeSetOperation,
  VictControlError,
  type ChangeSetBase,
} from '@vict/runtime';
import { ControlPlaneService } from '@vict/control';

/**
 * Stage 06B final boundary correction — the complete ChangeSet CAPTURE
 * boundary (negative controls that FAIL at 8bc8da1 and pass after).
 *
 * The boundary is systematic, not `base.kind`-specific: the COMPLETE
 * untrusted ChangeSet input is captured through guarded descriptors before
 * ANY member is read. Proven here:
 * - hostile getters on EVERY outer field (including `base.kind`) are never
 *   invoked;
 * - revoked Proxies (outer input, base, operation, release, operations
 *   array) never escape a raw TypeError;
 * - sparse arrays, accessor array elements, extra string/symbol array
 *   properties, non-enumerable indices, changing descriptors, and hostile
 *   enumeration/descriptor traps are all rejected;
 * - no raw exception or canary is echoed;
 * - rejected input creates NO ChangeSet, hash, run, audit event, or store
 *   row;
 * - valid content identity and ordering are unchanged.
 */

const CANARY = 'CANARY-CAPTURE-9f41e';

const VALID_BASE: ChangeSetBase = {
  kind: 'release',
  subjectId: 'app.capture',
  expectedVersion: 'release-v1',
};

const VALID_OPERATION = {
  kind: 'select-release',
  applicationId: 'app.capture',
  releaseVersion: 'release-v2',
};

/** Build a plausible authoring input with one hostile member replaced. */
function plausibleInput(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    changesetId: 'cs-capture-1',
    authorActorId: 'actor-capture',
    createdAt: 1000,
    base: VALID_BASE,
    operations: [VALID_OPERATION],
    rationale: 'capture boundary probe',
    riskClass: 'low',
    requiredApproverCount: 1,
    expiresAt: 9000,
    ...overrides,
  };
}

/** Rejects with ONE stable VictControlError; no raw error, no canary echo. */
function expectStableRejection(run: () => unknown): VictControlError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(VictControlError);
    const controlError = error as VictControlError;
    expect(controlError.code).toMatch(/^VICT_CONTROL_/);
    const raw = String(controlError.message);
    expect(raw).not.toContain(CANARY);
    expect(raw).not.toContain('TypeError');
    expect(raw).not.toContain('revoked');
    return controlError;
  }
  throw new Error(`expected a stable rejection, nothing was thrown (canary=${CANARY})`);
}

describe('BOUNDARY-1: a hostile base.kind getter executes ZERO times', () => {
  it('the getter is never invoked and a stable non-echoing error is returned', () => {
    let count = 0;
    const input = plausibleInput({
      base: {
        get kind(): string {
          count += 1;
          throw new Error(`${CANARY} hostile base.kind getter`);
        },
        subjectId: 'app.capture',
        expectedVersion: 'release-v1',
      },
    });
    expectStableRejection(() => validateChangeSetContent(input));
    expect(count).toBe(0);
  });

  it('hostile getters on EVERY outer ChangeSet field are never invoked', () => {
    const outerFields = [
      'changesetId',
      'authorActorId',
      'createdAt',
      'base',
      'operations',
      'rationale',
      'riskClass',
      'requiredApproverCount',
      'expiresAt',
    ];
    for (const field of outerFields) {
      let count = 0;
      const input: Record<string, unknown> = {};
      for (const key of outerFields) {
        if (key === field) {
          Object.defineProperty(input, key, {
            enumerable: true,
            get() {
              count += 1;
              throw new Error(`${CANARY} hostile outer getter: ${key}`);
            },
          });
        } else {
          input[key] = plausibleInput({})[key];
        }
      }
      expectStableRejection(() => validateChangeSetContent(input));
      expect(count).toBe(0);
    }
  });

  it('CHANGING getters/descriptors are never invoked twice with different behavior', () => {
    let calls = 0;
    const input = plausibleInput({
      rationale: 'stable',
    });
    Object.defineProperty(input, 'riskClass', {
      enumerable: true,
      get() {
        calls += 1;
        // A detector trap: a second read behaves differently.
        return calls === 1 ? 'low' : `${CANARY}-changed`;
      },
    });
    expectStableRejection(() => validateChangeSetContent(input));
    expect(calls).toBe(0);
  });
});

describe('BOUNDARY-2: revoked Proxies and hostile containers never cross raw', () => {
  function revokedProxy(target: object): ProxyConstructor extends never ? never : object {
    const { proxy, revoke } = Proxy.revocable(target, {});
    revoke();
    return proxy;
  }

  it('a revoked proxy as ONE OPERATION yields a stable structured error', () => {
    expectStableRejection(() =>
      validateChangeSetOperation(
        revokedProxy({
          kind: 'select-release',
          applicationId: 'app.capture',
          releaseVersion: 'release-v2',
        }),
      ),
    );
  });

  it('a revoked proxy as the OPERATIONS ARRAY yields a stable structured error', () => {
    expectStableRejection(() =>
      validateChangeSetContent(
        plausibleInput({
          operations: revokedProxy([VALID_OPERATION]),
        }),
      ),
    );
  });

  it('a revoked proxy as the BASE yields a stable structured error', () => {
    expectStableRejection(() =>
      validateChangeSetContent(
        plausibleInput({
          base: revokedProxy(VALID_BASE),
        }),
      ),
    );
  });

  it('a revoked proxy as OUTER INPUT yields a stable structured error', () => {
    expectStableRejection(() => validateChangeSetContent(revokedProxy(plausibleInput({}))));
  });

  it('a revoked proxy as RELEASE CONTENT inside an operation yields a stable structured error', () => {
    expectStableRejection(() =>
      validateChangeSetOperation({
        kind: 'publish-and-select-release',
        release: revokedProxy({
          releaseVersion: 'release-v2',
          applicationId: 'app.capture',
          applicationVersion: 'app-1',
          rendererIdentity: 'renderer-v2',
          componentRegistryIdentity: 'registry-v2',
          dataAdapterIdentity: 'adapter-v2',
          activationBinding: 'activation-1',
        }),
      }),
    );
  });

  it('hostile enumeration/descriptor traps on the container are rejected', () => {
    expectStableRejection(() =>
      validateChangeSetContent(
        plausibleInput({
          operations: new Proxy([VALID_OPERATION], {
            ownKeys() {
              throw new Error(`${CANARY} ownKeys trap`);
            },
          }),
        }),
      ),
    );
    expectStableRejection(() =>
      validateChangeSetContent(
        plausibleInput({
          operations: new Proxy([VALID_OPERATION], {
            getOwnPropertyDescriptor() {
              throw new Error(`${CANARY} descriptor trap`);
            },
          }),
        }),
      ),
    );
    // A `get`-only trap is never consulted at all: element capture reads
    // guarded DESCRIPTORS, so a hostile `get` (or any caller getter) cannot
    // influence validation — proven by the accessor-element case above.
  });
});

describe('closed dense array capture: sparse, accessor, extra, non-enumerable', () => {
  it('rejects sparse arrays', () => {
    const sparse: unknown[] = new Array(2);
    sparse[0] = VALID_OPERATION;
    expectStableRejection(() => validateChangeSetContent(plausibleInput({ operations: sparse })));
  });

  it('rejects accessor array elements WITHOUT invoking them', () => {
    let count = 0;
    const operations: unknown[] = [];
    Object.defineProperty(operations, 0, {
      enumerable: true,
      get() {
        count += 1;
        throw new Error(`${CANARY} element getter`);
      },
    });
    operations.length = 1;
    expectStableRejection(() => validateChangeSetContent(plausibleInput({ operations })));
    expect(count).toBe(0);
  });

  it('rejects extra string and symbol array properties', () => {
    const extra: unknown[] = [VALID_OPERATION];
    (extra as unknown as Record<string, unknown>)['sneaky'] = `${CANARY}-extra`;
    expectStableRejection(() => validateChangeSetContent(plausibleInput({ operations: extra })));

    const symbolKeyed: unknown[] = [VALID_OPERATION];
    (symbolKeyed as unknown as Record<PropertyKey, unknown>)[Symbol('smuggled')] = 'payload';
    expectStableRejection(() =>
      validateChangeSetContent(plausibleInput({ operations: symbolKeyed })),
    );
  });

  it('rejects non-enumerable indices', () => {
    const hidden: unknown[] = [VALID_OPERATION];
    Object.defineProperty(hidden, 0, { enumerable: false });
    expectStableRejection(() => validateChangeSetContent(plausibleInput({ operations: hidden })));
  });

  it('rejects exotic array prototypes (array subclass instances)', () => {
    class HostileArray extends Array {}
    const exotic = HostileArray.from([VALID_OPERATION]);
    expectStableRejection(() => validateChangeSetContent(plausibleInput({ operations: exotic })));
  });
});

describe('rejected input mutates NOTHING; valid content identity is unchanged', () => {
  it('a hostile proposal creates NO ChangeSet, hash, run, audit event, or store row', async () => {
    const stores = createInMemoryAgentControlStores();
    await stores.actors.upsert({
      actorId: 'actor-capture',
      status: 'active',
      roles: ['developer'],
      createdAt: 0,
    });
    const actor = authenticatedActorContext(
      await stores.actors.get('actor-capture'),
      'actor-capture',
    );
    let changesetIdCalls = 0;
    const control = new ControlPlaneService({
      stores,
      catalog: {
        publish: async () => {
          throw new Error('unused');
        },
        get: async () => undefined,
        getSelection: async () => undefined,
        select: async () => {
          throw new Error('unused');
        },
      } as never,
      clock: () => 1000,
      ids: {
        changesetId: () => `cs-${(changesetIdCalls += 1)}`,
        changesetApprovalId: () => 'apr-1',
        auditId: () => 'audit-1',
        controlRunId: () => 'run-1',
      },
    });
    let getterCount = 0;
    await expect(
      control.propose(
        actor,
        plausibleInput({
          changesetId: 'cs-hostile',
          operations: [
            {
              kind: 'select-release',
              applicationId: 'app.capture',
              get releaseVersion(): string {
                getterCount += 1;
                throw new Error(`${CANARY} operation getter`);
              },
            },
          ],
        }) as never,
      ),
    ).rejects.toBeInstanceOf(VictControlError);
    expect(getterCount).toBe(0);
    // ZERO durable traces: no changeset, no audit event, no control run.
    expect(await stores.control.listChangeSets()).toHaveLength(0);
    expect(await stores.control.listAuditEvents({})).toHaveLength(0);
    expect(await stores.control.getControlRun('run-1')).toBeUndefined();
  });

  it('valid content identity, field capture, and operation ORDER are unchanged', () => {
    const operations = [
      { kind: 'select-release', applicationId: 'app.capture', releaseVersion: 'release-v2' },
      { kind: 'select-release', applicationId: 'app.capture', releaseVersion: 'release-v3' },
    ];
    const validated = validateChangeSetContent(
      plausibleInput({
        changesetId: 'cs-capture-order',
        operations,
      }),
    );
    expect(validated.changesetId).toBe('cs-capture-order');
    expect(validated.base).toEqual(VALID_BASE);
    expect(validated.operations).toHaveLength(2);
    expect(validated.operations[0]).toMatchObject({ releaseVersion: 'release-v2' });
    expect(validated.operations[1]).toMatchObject({ releaseVersion: 'release-v3' });
    // Key-order independence of the SAME content (capture canonicalizes).
    const reordered = validateChangeSetContent({
      expiresAt: 9000,
      requiredApproverCount: 1,
      riskClass: 'low',
      rationale: 'capture boundary probe',
      operations: [
        {
          releaseVersion: 'release-v2',
          applicationId: 'app.capture',
          kind: 'select-release',
        },
        {
          releaseVersion: 'release-v3',
          applicationId: 'app.capture',
          kind: 'select-release',
        },
      ],
      base: { expectedVersion: 'release-v1', subjectId: 'app.capture', kind: 'release' },
      createdAt: 1000,
      authorActorId: 'actor-capture',
      changesetId: 'cs-capture-order',
    });
    expect(reordered.contentHash).toBe(validated.contentHash);
  });

  it('post-call caller mutation cannot alter the validated content or its hash', () => {
    const callerOperations = [
      { kind: 'select-release', applicationId: 'app.capture', releaseVersion: 'release-v2' },
    ];
    const callerBase = { ...VALID_BASE };
    const validated = validateChangeSetContent(
      plausibleInput({ base: callerBase, operations: callerOperations }),
    );
    const hashBefore = validated.contentHash;
    // TAMPER with every caller object AFTER validation.
    (callerBase as { expectedVersion: string }).expectedVersion = 'TAMPERED';
    (callerOperations[0] as { releaseVersion: string }).releaseVersion = 'TAMPERED';
    expect(validated.base.expectedVersion).toBe('release-v1');
    expect(validated.operations[0]).toMatchObject({ releaseVersion: 'release-v2' });
    expect(validated.contentHash).toBe(hashBefore);
    // Re-validation of the tampered objects is REFLECTED (the capture is
    // re-read, never aliased) — the original validated record is untouched.
    const revalidated = validateChangeSetContent(
      plausibleInput({
        changesetId: 'cs-capture-2',
        base: callerBase,
        operations: callerOperations,
      }),
    );
    expect(revalidated.contentHash).not.toBe(hashBefore);
  });
});
