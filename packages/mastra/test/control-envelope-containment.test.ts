import { describe, expect, it } from 'vitest';
import {
  CONTROL_MARKER_KEYS,
  captureControlRecord,
  capturedHasAnyControlMarker,
  inspectControlField,
  rebuildPlainCapturedObject,
} from '../src/control-envelope.js';
import {
  CAPABILITY_TOOL_FAILURE_CODES,
  isCapabilityToolFailureCode,
  normalizeCapabilityToolResultEvent,
  parseCapabilityReplayEnvelope,
  safeArgumentSummary,
} from '../src/tool-bridge.js';

/**
 * Stage 06 POST-AUDIT remediation — the pure emitted control-envelope
 * boundary (these tests FAIL at 712752a3 and pass after the correction).
 *
 * The post-audit probes demonstrated that the previous parsers/readers let
 * raw exceptions escape the boundary and accepted hostile values as event
 * codes. This suite pins the corrected contract:
 *
 * - TOTALITY: `parseCapabilityReplayEnvelope`,
 *   `normalizeCapabilityToolResultEvent`, `safeArgumentSummary`, and the
 *   shared capture primitives return a STABLE classification for every
 *   hostile shape — outer/inner throwing getters, revoked proxies,
 *   throwing `getPrototypeOf`/`ownKeys`/`getOwnPropertyDescriptor`/`has`/
 *   `get` traps, accessor, inherited, non-enumerable, and symbol fields,
 *   arrays, and exotic prototypes. NOTHING ever throws.
 * - CLOSED VOCABULARIES: an arbitrary failure-code string can never become
 *   an event code — everything outside `CAPABILITY_TOOL_FAILURE_CODES`
 *   normalizes to `VICT_CAPABILITY_OUTCOME_UNKNOWN`.
 * - NO ECHO: rejected keys, values, trap errors, and canaries never appear
 *   in any verdict.
 * - GETTER COUNTERS: where a hostile field is rejected by descriptor
 *   inspection alone, the hostile getter/trap is invoked EXACTLY ZERO
 *   times.
 */

const CANARY = 'CANARY-POSTAUDIT-THREW';

const throwingGetter = (canary: string): PropertyDescriptor => ({
  enumerable: true,
  get() {
    throw new Error(canary);
  },
});

const defineGetter = (target: object, key: string, descriptor: PropertyDescriptor): object => {
  Object.defineProperty(target, key, descriptor);
  return target;
};

const outerReplayThrowingGetter = (): object =>
  defineGetter({}, 'victCapabilityReplay', throwingGetter(`${CANARY}-OUTER-REPLAY`));

const replayEnvelope = (envelope: unknown): unknown => ({ victCapabilityReplay: envelope });

const validEnvelope = (): Record<string, unknown> => ({
  disposition: 'completed',
  invocationId: 'inv-1',
});

type Trap = (target: unknown, key: unknown) => unknown;

const proxyWithTraps = (target: unknown, traps: Record<string, Trap>): object =>
  new Proxy(target as object, traps as never);

const mustFailClosed = (result: unknown): void => {
  expect(normalizeCapabilityToolResultEvent(result)).toEqual({
    kind: 'failed',
    code: 'VICT_CAPABILITY_OUTCOME_UNKNOWN',
  });
};

const mustBeInvalidReplay = (result: unknown): void => {
  mustFailClosed(result);
  expect(parseCapabilityReplayEnvelope(result).kind).toBe('invalid');
};

const mustBeNotACapability = (result: unknown): void => {
  expect(normalizeCapabilityToolResultEvent(result)).toEqual({ kind: 'not-capability' });
  expect(parseCapabilityReplayEnvelope(result).kind).toBe('not-a-replay');
};

// ---- Throwing getters (outer and inner) ------------------------------------

describe('post-audit containment: throwing getters never escape the boundary', () => {
  it('an outer victCapabilityReplay getter throwing a canary fails closed without echoing', () => {
    mustBeInvalidReplay(outerReplayThrowingGetter());
    expect(
      JSON.stringify(normalizeCapabilityToolResultEvent(outerReplayThrowingGetter())),
    ).not.toContain(CANARY);
  });

  it('an outer victCapabilityFailure getter throwing a canary fails closed without echoing', () => {
    mustFailClosed(
      defineGetter({}, 'victCapabilityFailure', throwingGetter(`${CANARY}-FAILURE-MARKER`)),
    );
    expect(
      JSON.stringify(
        parseCapabilityReplayEnvelope(
          defineGetter({}, 'victCapabilityFailure', throwingGetter(`${CANARY}-FAILURE-MARKER`)),
        ),
      ),
    ).not.toContain(CANARY);
  });

  it('inner disposition / invocationId / resultSummary getters fail closed unread', () => {
    const dispositionEnvelope = {};
    Object.defineProperty(
      dispositionEnvelope,
      'disposition',
      throwingGetter(`${CANARY}-DISPOSITION`),
    );
    Object.defineProperty(dispositionEnvelope, 'invocationId', {
      value: 'inv-1',
      enumerable: true,
    });
    mustBeInvalidReplay(replayEnvelope(dispositionEnvelope));

    const invocationEnvelope = { disposition: 'completed' };
    Object.defineProperty(
      invocationEnvelope,
      'invocationId',
      throwingGetter(`${CANARY}-INVOCATION`),
    );
    mustBeInvalidReplay(replayEnvelope(invocationEnvelope));

    const summaryEnvelope = { ...validEnvelope() };
    Object.defineProperty(summaryEnvelope, 'resultSummary', throwingGetter(`${CANARY}-SUMMARY`));
    mustBeInvalidReplay(replayEnvelope(summaryEnvelope));
  });

  it('getter counters remain EXACTLY ZERO where descriptor rejection is possible', () => {
    let getterCalls = 0;
    const countedEnvelope = {};
    Object.defineProperty(countedEnvelope, 'disposition', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'completed';
      },
    });
    Object.defineProperty(countedEnvelope, 'invocationId', { value: 'inv-1', enumerable: true });
    // The accessor disposition rejects the envelope WITHOUT reading it.
    mustBeInvalidReplay(replayEnvelope(countedEnvelope));
    expect(getterCalls).toBe(0);

    let failureGetterCalls = 0;
    const countedFailure = {};
    Object.defineProperty(countedFailure, 'victCapabilityFailure', {
      enumerable: true,
      get() {
        failureGetterCalls += 1;
        return 'VICT_CAPABILITY_DECLINED';
      },
    });
    mustFailClosed(countedFailure);
    expect(failureGetterCalls).toBe(0);
  });
});

// ---- Revoked proxies and throwing traps -------------------------------------

describe('post-audit containment: revoked proxies and throwing traps classify, never throw', () => {
  it('a revoked proxy as the outer result fails closed (never a raw TypeError)', () => {
    const handle = Proxy.revocable(replayEnvelope(validEnvelope()) as object, {});
    handle.revoke();
    mustBeInvalidReplay(handle.proxy);
  });

  it('a revoked proxy as the INNER envelope fails closed', () => {
    const handle = Proxy.revocable(validEnvelope() as object, {});
    handle.revoke();
    mustBeInvalidReplay(replayEnvelope(handle.proxy));
  });

  it('throwing getPrototypeOf / ownKeys / getOwnPropertyDescriptor traps fail closed', () => {
    const throwCanary = (): never => {
      throw new Error(`${CANARY}-TRAP`);
    };
    mustBeInvalidReplay(
      replayEnvelope(proxyWithTraps(validEnvelope(), { getPrototypeOf: throwCanary })),
    );
    mustBeInvalidReplay(replayEnvelope(proxyWithTraps(validEnvelope(), { ownKeys: throwCanary })));
    mustBeInvalidReplay(
      replayEnvelope(proxyWithTraps(validEnvelope(), { getOwnPropertyDescriptor: throwCanary })),
    );
    // Hostile OUTER containers with the same traps:
    mustBeInvalidReplay(
      proxyWithTraps(replayEnvelope(validEnvelope()), {
        getPrototypeOf: throwCanary,
        get: (target: unknown, key: unknown) => Reflect.get(target as object, key as string),
      }),
    );
    mustBeInvalidReplay(proxyWithTraps({}, { getPrototypeOf: throwCanary }));
  });

  it('a throwing `has` trap is HOSTILE: stable outcome-unknown, never not-capability', () => {
    mustFailClosed(
      proxyWithTraps(
        {},
        {
          has: (): never => {
            throw new Error(`${CANARY}-HAS`);
          },
        },
      ),
    );
    mustBeInvalidReplay(
      proxyWithTraps(
        {},
        {
          has: (): never => {
            throw new Error(`${CANARY}-HAS`);
          },
        },
      ),
    );
  });

  it('a `get` trap is NEVER invoked: verdicts derive from descriptors only', () => {
    let getTrapCalls = 0;
    const result = proxyWithTraps(
      { victCapabilityReplay: validEnvelope() },
      {
        get(_target: unknown, _key: unknown) {
          getTrapCalls += 1;
          throw new Error(`${CANARY}-GET`);
        },
      },
    );
    const verdict = normalizeCapabilityToolResultEvent(result);
    // The descriptor value is the truthful stored value; the get trap was
    // never invoked and its canary can never be echoed.
    expect(verdict).toEqual({ kind: 'completed' });
    expect(getTrapCalls).toBe(0);
    expect(JSON.stringify(verdict)).not.toContain(CANARY);
  });

  it('inherited or descriptor-invisible marker membership can never impersonate', () => {
    // Inherited failure marker (visible to `in`, invisible to descriptors).
    const inheritedFailure = Object.create({
      victCapabilityFailure: 'CANARY-INHERITED-CODE',
    });
    mustFailClosed(inheritedFailure);
    // Inherited replay marker.
    const inheritedReplay = Object.create(replayEnvelope(validEnvelope()) as object);
    mustFailClosed(inheritedReplay);
    // A `has` lie invisible to the descriptor capture.
    mustFailClosed(
      proxyWithTraps(
        {},
        {
          has(target: unknown, key: unknown) {
            if (key === 'victCapabilityFailure') {
              return true;
            }
            return Reflect.has(target as object, key as string);
          },
        },
      ),
    );
  });
});

// ---- Hostile field shapes ----------------------------------------------------

describe('post-audit containment: accessor, non-enumerable, and symbol fields are rejected unread', () => {
  it('an enumerable accessor failure marker fails closed with the safe code', () => {
    mustFailClosed(defineGetter({}, 'victCapabilityFailure', throwingGetter(`${CANARY}-ACCESSOR`)));
  });

  it('an accessor returning an ALLOWLISTED code is still rejected (value never read)', () => {
    mustFailClosed(
      defineGetter({}, 'victCapabilityFailure', {
        enumerable: true,
        get() {
          return 'VICT_CAPABILITY_DECLINED';
        },
      }),
    );
  });

  it('a non-enumerable failure marker can never become an event code', () => {
    const hidden = { plain: 'field' };
    Object.defineProperty(hidden, 'victCapabilityFailure', {
      value: 'CANARY-NONENUMERABLE-CODE',
      enumerable: false,
      writable: true,
      configurable: true,
    });
    mustFailClosed(hidden);
  });

  it('an accessor replay marker fails closed', () => {
    mustBeInvalidReplay(
      defineGetter({}, 'victCapabilityReplay', {
        enumerable: true,
        get() {
          return validEnvelope();
        },
      }),
    );
  });

  it('a non-enumerable envelope member fails closed', () => {
    const envelope = { ...validEnvelope() };
    Object.defineProperty(envelope, 'resultSummary', {
      value: 'object(1 fields)',
      enumerable: false,
      writable: true,
      configurable: true,
    });
    mustBeInvalidReplay(replayEnvelope(envelope));
  });

  it('symbol-keyed envelope members fail closed; symbol-keyed ordinary fields stay ordinary', () => {
    const envelope = { ...validEnvelope(), [Symbol.for('extra')]: 'x' };
    mustBeInvalidReplay(replayEnvelope(envelope));
    // A plain result with an unrelated symbol field carries no string
    // marker: it is not a capability result (legacy handling intact).
    mustBeNotACapability({ saved: true, [Symbol.for('tag')]: 'x' });
  });
});

// ---- Closed vocabularies -----------------------------------------------------

describe('post-audit containment: the failure-code vocabulary is CLOSED', () => {
  it('the allowlist contains exactly the declared bridge codes', () => {
    expect([...CAPABILITY_TOOL_FAILURE_CODES].sort()).toEqual(
      [
        'VICT_CAPABILITY_INPUT_CONTRACT_REJECTED',
        'VICT_CAPABILITY_OUTPUT_CONTRACT_REJECTED',
        'VICT_CAPABILITY_INVOCATION_FAILED',
        'VICT_CAPABILITY_OUTCOME_UNKNOWN',
        'VICT_CAPABILITY_AUTHORITY_DENIED',
        'VICT_CAPABILITY_DECLINED',
        'VICT_CAPABILITY_AWAITING_APPROVAL_TIMED_OUT',
        'VICT_CAPABILITY_CANCELLED',
        'VICT_CAPABILITY_TOOL_IDENTITY_REQUIRED',
        'VICT_CAPABILITY_TOOL_LIMIT_EXCEEDED',
      ].sort(),
    );
    expect(isCapabilityToolFailureCode('VICT_CAPABILITY_DECLINED')).toBe(true);
    expect(isCapabilityToolFailureCode('CANARY-ARBITRARY-CODE')).toBe(false);
    expect(isCapabilityToolFailureCode(42)).toBe(false);
    expect(isCapabilityToolFailureCode(undefined)).toBe(false);
  });

  it('an arbitrary failure-code string normalizes to the safe outcome-unknown code', () => {
    expect(
      normalizeCapabilityToolResultEvent({ victCapabilityFailure: 'CANARY-ARBITRARY-CODE' }),
    ).toEqual({ kind: 'failed', code: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' });
    expect(
      JSON.stringify(
        normalizeCapabilityToolResultEvent({ victCapabilityFailure: 'CANARY-ARBITRARY-CODE' }),
      ),
    ).not.toContain('CANARY-ARBITRARY-CODE');
  });

  it('every allowlisted code round-trips as its own event code', () => {
    for (const code of CAPABILITY_TOOL_FAILURE_CODES) {
      expect(normalizeCapabilityToolResultEvent({ victCapabilityFailure: code })).toEqual({
        kind: 'failed',
        code,
      });
    }
  });

  it('a non-string failure marker fails closed', () => {
    mustFailClosed({ victCapabilityFailure: 42 });
    mustFailClosed({ victCapabilityFailure: { nested: 'canary' } });
    mustFailClosed({ victCapabilityFailure: null });
  });

  it('contradictory and oversized envelopes fail closed', () => {
    mustBeInvalidReplay({
      victCapabilityReplay: validEnvelope(),
      victCapabilityFailure: 'VICT_CAPABILITY_DECLINED',
    });
    mustBeInvalidReplay({
      victCapabilityReplay: validEnvelope(),
      victCapabilityFailure: 42,
    });
    mustBeInvalidReplay(replayEnvelope({ ...validEnvelope(), resultSummary: 'x'.repeat(513) }));
  });

  it('arrays and exotic prototypes keep their legacy classification', () => {
    mustBeNotACapability(['completed']);
    mustBeNotACapability('completed');
    mustBeNotACapability(null);
    mustBeNotACapability(undefined);
    mustBeNotACapability({ saved: true });
    class Plain {
      saved = true;
    }
    mustBeNotACapability(new Plain());
  });
});

// ---- Totality sweep ----------------------------------------------------------

describe('post-audit containment: every public parser/normalizer is total', () => {
  const hostileShapes = (): unknown[] => {
    const throwCanary = (): never => {
      throw new Error(CANARY);
    };
    const revoked = Proxy.revocable(replayEnvelope(validEnvelope()) as object, {});
    revoked.revoke();
    return [
      outerReplayThrowingGetter(),
      defineGetter({}, 'victCapabilityFailure', throwingGetter(CANARY)),
      replayEnvelope(defineGetter({}, 'disposition', throwingGetter(CANARY))),
      revoked.proxy,
      proxyWithTraps(validEnvelope(), { getPrototypeOf: throwCanary }),
      proxyWithTraps(validEnvelope(), { ownKeys: throwCanary }),
      proxyWithTraps(validEnvelope(), { getOwnPropertyDescriptor: throwCanary }),
      proxyWithTraps({}, { has: throwCanary }),
      proxyWithTraps(replayEnvelope(validEnvelope()), { getPrototypeOf: throwCanary }),
      replayEnvelope(proxyWithTraps(validEnvelope(), { has: throwCanary })),
      { victCapabilityReplay: new Map([['disposition', 'completed']]) },
      { victCapabilityFailure: 'CANARY-X' },
    ];
  };

  it('normalizeCapabilityToolResultEvent returns a stable verdict for every hostile shape', () => {
    for (const shape of hostileShapes()) {
      const verdict = normalizeCapabilityToolResultEvent(shape);
      expect(
        ['not-capability', 'completed', 'nonterminal'].includes(verdict.kind) ||
          verdict.kind === 'failed',
      ).toBe(true);
      if (verdict.kind === 'failed') {
        expect(verdict.code).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
      }
      expect(JSON.stringify(verdict)).not.toContain(CANARY);
    }
  });

  it('parseCapabilityReplayEnvelope returns a stable verdict for every hostile shape', () => {
    for (const shape of hostileShapes()) {
      const verdict = parseCapabilityReplayEnvelope(shape);
      expect(['not-a-replay', 'valid', 'invalid'].includes(verdict.kind)).toBe(true);
      if (verdict.kind === 'valid') {
        expect(verdict.invocationId).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
      }
    }
  });

  it('safeArgumentSummary never throws on hostile containers and never echoes them', () => {
    for (const shape of hostileShapes()) {
      const summary = safeArgumentSummary(shape);
      expect(typeof summary).toBe('string');
      expect(summary).not.toContain(CANARY);
      expect(summary.length).toBeLessThanOrEqual(120);
    }
    expect(safeArgumentSummary({ a: 1, b: 2 })).toBe('object(2 fields)');
    expect(safeArgumentSummary([1, 2, 3])).toBe('array(3)');
  });
});

// ---- The shared capture primitives -------------------------------------------

describe('the shared control-envelope capture primitives are total and non-invoking', () => {
  it('captureControlRecord classifies every hostile shape without throwing', () => {
    expect(captureControlRecord('x').kind).toBe('not-object');
    expect(captureControlRecord(null).kind).toBe('not-object');
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(captureControlRecord(revoked.proxy).kind).toBe('unusable');
    const captured = captureControlRecord({ a: 1 });
    expect(captured.kind).toBe('captured');
    if (captured.kind === 'captured') {
      expect(captured.prototype).toBe('object-prototype');
      expect(capturedHasAnyControlMarker(captured)).toBe(false);
    }
  });

  it('inspectControlField never reads accessors and never throws', () => {
    const accessorMarker = defineGetter({}, 'victHelperFailure', {
      enumerable: true,
      get() {
        throw new Error(CANARY);
      },
    });
    const inspected = inspectControlField(accessorMarker, 'victHelperFailure');
    expect(inspected.kind).toBe('present-unreadable');
    expect(
      inspectControlField(
        { victHelperFailure: 'VICT_HELPER_EXECUTION_FAILED' },
        'victHelperFailure',
      ),
    ).toEqual({
      kind: 'data',
      value: 'VICT_HELPER_EXECUTION_FAILED',
    });
    expect(inspectControlField({ other: 1 }, 'victHelperFailure').kind).toBe('absent');
    expect(inspectControlField(undefined, 'victHelperFailure').kind).toBe('absent');
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(inspectControlField(revoked.proxy, 'victHelperFailure').kind).toBe('unusable');
  });

  it('rebuildPlainCapturedObject produces a trap-free plain copy or refuses', () => {
    const original = { a: 1, b: 'two' };
    const captured = captureControlRecord(original);
    expect(captured.kind).toBe('captured');
    if (captured.kind === 'captured') {
      const rebuilt = rebuildPlainCapturedObject(captured);
      expect(rebuilt).toEqual(original);
      expect(rebuilt).not.toBe(original);
      expect(Object.getPrototypeOf(rebuilt as object)).toBe(Object.prototype);
    }
    // Exotic prototypes and accessor carriers are refused (caller policy
    // decides delivery for those).
    class Exotic {
      a = 1;
    }
    const exoticCapture = captureControlRecord(new Exotic());
    expect(exoticCapture.kind).toBe('captured');
    if (exoticCapture.kind === 'captured') {
      expect(rebuildPlainCapturedObject(exoticCapture)).toBeUndefined();
    }
    const accessorCapture = captureControlRecord(
      defineGetter({}, 'x', { enumerable: true, get: () => 1 }),
    );
    expect(accessorCapture.kind).toBe('captured');
    if (accessorCapture.kind === 'captured') {
      expect(rebuildPlainCapturedObject(accessorCapture)).toBeUndefined();
    }
  });

  it('the reserved marker vocabulary is exactly the three bridge markers', () => {
    expect([...CONTROL_MARKER_KEYS].sort()).toEqual(
      ['victCapabilityFailure', 'victCapabilityReplay', 'victHelperFailure'].sort(),
    );
  });
});
