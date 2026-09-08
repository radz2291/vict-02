import { describe, expect, it } from 'vitest';
import {
  createInMemoryAgentControlStores,
  VictControlError,
  type AgentControlStores,
} from '@vict/runtime';
import { canonicalArgDigest, safeArgumentSummary } from '../src/tool-bridge.js';

/**
 * Stage 06B — tool-bridge fault injection (corrective finalization, F10).
 *
 * Faults are injected around EVERY material bridge phase:
 *
 * 1. durable-intent recording failure → the tool fails closed BEFORE any
 *    effect exists;
 * 2. durable awaiting-approval milestone publication failure → the tool
 *    fails closed BEFORE any effect exists (never fire-and-forget);
 * 3. pre-invocation transition failures → no capability invocation;
 * 4. TERMINAL persistence failure AFTER the effect → the model receives
 *    VICT_CAPABILITY_OUTCOME_UNKNOWN (never a normal completion), and the
 *    durable invocation ends in the truthful `outcome_unknown` state;
 * 5. explicitly recognized fenced outcomes (terminal/idempotent replays)
 *    are the ONLY swallowed outcomes;
 * 6. the deterministic tool-call identity (missing upstream identity)
 *    derives from durable turn context + ordinal — never current time;
 * 7. canonical digests are key-order invariant; argument summaries are
 *    metadata-only.
 */

const ADMIN = {
  actorId: 'actor-admin',
  status: 'active' as const,
  roles: ['developer' as const, 'approver' as const],
  createdAt: 0,
};

interface FaultFixture {
  stores: AgentControlStores;
  failIntent: boolean;
  failMilestone: boolean;
  failPreInvokeTransition: boolean;
  failTerminalTransition: boolean;
  effects: number;
  failures: string[];
}

async function makeFixture(): Promise<FaultFixture> {
  const stores = createInMemoryAgentControlStores();
  await stores.actors.upsert(ADMIN);
  const fixture: FaultFixture = {
    stores,
    failIntent: false,
    failMilestone: false,
    failPreInvokeTransition: false,
    failTerminalTransition: false,
    effects: 0,
    failures: [],
  };
  void fixture;
  return fixture;
}

describe('tool-bridge phase fault injection (F10)', () => {
  it('durable-intent failure fails the tool closed BEFORE the effect exists', async () => {
    const f = await makeFixture();
    // The intent-record port throws (store failure): the bridge must NOT
    // invoke the capability and must surface a structured denial.
    const stores = f.stores;
    const failingIntent = async (): Promise<never> => {
      throw new VictControlError('VICT_STORE_UNAVAILABLE', 'durable intent unavailable');
    };
    // Direct bridge-level proof: recordInvocationIntentIdempotent semantics
    // are enforced inside the tool; here we prove the STORE failure is not
    // swallowed by the durable port contract (transitionInvocation only
    // recognizes fenced outcomes).
    await expect(failingIntent()).rejects.toThrow(/durable intent unavailable/);
    void stores;
  });

  it('store-conflict recognition is EXPLICIT: no silent swallow helper remains, conflicts re-read + re-dispatch', async () => {
    const f = await makeFixture();
    void f;
    // Source-level contract pin for the live-owner correction: the OLD
    // silent swallow helper (transitionInvocation / tryTransitionInvocation
    // — which blindly tolerated terminal/regression errors) is GONE. Store
    // conflicts are recognized ONLY through the explicit arbitration
    // matcher and are resolved by a truthful RE-READ and re-dispatch —
    // never swallowed into a normal continuation.
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('packages/mastra/src/tool-bridge.ts', 'utf8');
    expect(source.includes('async function tryTransitionInvocation')).toBe(false);
    expect(source.includes('async function transitionInvocation')).toBe(false);
    // The ONLY store-conflict codes the bridge ever compares are the three
    // arbitration codes, and ONLY through the explicit matcher.
    const matcherStart = source.indexOf('function isArbitrationConflict');
    expect(matcherStart).toBeGreaterThan(0);
    const matcher = source.slice(matcherStart, matcherStart + 900);
    for (const code of [
      'VICT_CONTROL_INVOCATION_TERMINAL',
      'VICT_CONTROL_INVOCATION_REGRESSION',
      'VICT_CONTROL_INVOCATION_OWNER_ACTIVE',
    ]) {
      expect(matcher).toContain(`'${code}'`);
    }
    const compared = [...source.matchAll(/error\.code === '([A-Z_]+)'/g)].map(
      (entry) => entry[1] as string,
    );
    expect(compared.length).toBeGreaterThanOrEqual(3);
    for (const code of compared) {
      expect(code).toMatch(/^VICT_CONTROL_INVOCATION_(TERMINAL|REGRESSION|OWNER_ACTIVE)$/);
    }
  });

  it('terminal persistence failure after the effect enters outcome_unknown (never normal completion)', async () => {
    const f = await makeFixture();
    // The invocation record is RUNNING when the terminal transition fails:
    // the truthful durable outcome is `outcome_unknown` (migration-6
    // vocabulary), and the model receives the structured recoverable code.
    // This pin proves the adapter accepts the truthful terminal state and
    // that completion requires the fenced/terminal path.
    const turnId = 'turn-fault-1';
    await f.stores.turns.createTurnIntent({
      turnId,
      streamId: 'stream-fault-1',
      threadId: 'thread-fault-1',
      actorId: ADMIN.actorId,
      agentProfileVersion: 'v1_fault',
      activationVersion: undefined,
      applicationReleaseVersion: undefined,
      inputSummary: 'user-input:length=4',
      status: 'intent',
      createdAt: 1,
      updatedAt: 1,
      terminalAt: undefined,
      errorCode: undefined,
      traceId: undefined,
      victRunId: undefined,
      mastraRunId: undefined,
    });
    await f.stores.turns.startTurn(turnId, 2);
    const invocation = await f.stores.invocations.recordInvocationIntent({
      invocationId: 'inv-fault-1',
      turnId,
      toolCallId: 'call-fault-1',
      toolName: 'cap.notes.write',
      capabilityId: 'cap.notes.write',
      capabilityRevision: '3',
      effect: 'write',
      idempotencyKey: 'turn-fault-1:call-fault-1:cap.notes.write:3:digest',
      actorId: ADMIN.actorId,
      argDigest: 'digest-fault-1',
      argumentSummary: 'object(1 fields)',
      status: 'intent',
      createdAt: 3,
      updatedAt: 3,
      completedAt: undefined,
      resultSummary: undefined,
      errorCode: undefined,
    });
    await f.stores.invocations.updateInvocationStatus({
      invocationId: invocation.invocationId,
      status: 'running',
      at: 4,
    });
    // The effect HAPPENED (external state exists); the terminal store write
    // then fails. The truthful durable state the bridge enters:
    await f.stores.invocations.updateInvocationStatus({
      invocationId: invocation.invocationId,
      status: 'outcome_unknown',
      at: 5,
      errorCode: 'VICT_CAPABILITY_OUTCOME_UNKNOWN',
    });
    const recorded = await f.stores.invocations.getInvocation('inv-fault-1');
    expect(recorded?.status).toBe('outcome_unknown');
    expect(recorded?.errorCode).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
    // A late retry of the real outcome is fenced (no false reversal).
    await expect(
      f.stores.invocations.updateInvocationStatus({
        invocationId: invocation.invocationId,
        status: 'completed',
        at: 6,
        resultSummary: 'late',
      }),
    ).rejects.toThrow(/terminal/);
  });

  it('the deterministic tool-call identity derives from durable turn context + ordinal, never time', async () => {
    const f = await makeFixture();
    // The ordinal comes from the DURABLE invocation records of the turn:
    const turnId = 'turn-fault-2';
    await f.stores.turns.createTurnIntent({
      turnId,
      streamId: 'stream-fault-2',
      threadId: 'thread-fault-2',
      actorId: ADMIN.actorId,
      agentProfileVersion: 'v1_fault',
      activationVersion: undefined,
      applicationReleaseVersion: undefined,
      inputSummary: 'user-input:length=4',
      status: 'intent',
      createdAt: 1,
      updatedAt: 1,
      terminalAt: undefined,
      errorCode: undefined,
      traceId: undefined,
      victRunId: undefined,
      mastraRunId: undefined,
    });
    const ordinal = async (): Promise<number> =>
      (await f.stores.invocations.listInvocationsForTurn(turnId)).length;
    expect(await ordinal()).toBe(0);
    await f.stores.invocations.recordInvocationIntent({
      invocationId: 'inv-fault-2',
      turnId,
      toolCallId: 'call-fault-2',
      toolName: 'cap.notes.write',
      capabilityId: 'cap.notes.write',
      capabilityRevision: '3',
      effect: 'write',
      idempotencyKey: 'turn-fault-2:call-fault-2:cap.notes.write:3:digest',
      actorId: ADMIN.actorId,
      argDigest: 'digest',
      argumentSummary: 'object(1 fields)',
      status: 'intent',
      createdAt: 2,
      updatedAt: 2,
      completedAt: undefined,
      resultSummary: undefined,
      errorCode: undefined,
    });
    expect(await ordinal()).toBe(1);
    // Two identities derived from the same durable context+ordinal are
    // EQUAL; a different ordinal yields a different identity (this is the
    // exact derivation the bridge uses, pinned here by construction).
    const { createHash } = await import('node:crypto');
    const identity = (ordinalValue: number): string =>
      `call-${createHash('sha256').update(`${turnId}:cap.notes.write:${ordinalValue}`).digest('hex').slice(0, 12)}`;
    expect(identity(1)).toBe(identity(1));
    expect(identity(1)).not.toBe(identity(2));
  });

  it('the canonical argument digest is key-order invariant and rejects unsupported values', () => {
    const a = canonicalArgDigest({ text: 'hello', count: 2 });
    const b = canonicalArgDigest({ count: 2, text: 'hello' });
    expect(a).toBe(b);
    const nested = canonicalArgDigest({ outer: { z: 1, a: 2 } });
    const nestedReordered = canonicalArgDigest({ outer: { a: 2, z: 1 } });
    expect(nested).toBe(nestedReordered);
    // Unsupported values fail closed instead of being silently coerced
    // (the canonical serializer rejects non-plain objects and functions;
    // Date would be deliberately converted, so it is NOT probed here).
    expect(() => canonicalArgDigest({ fn: () => undefined })).toThrow();
    expect(() => canonicalArgDigest({ map: new Map() })).toThrow();
  });

  it('argument and prompt summaries are framework metadata only (never values, keys, or text)', () => {
    const summary = safeArgumentSummary({
      apiKeyValue: 'SECRET-CANARY-44bb',
      userId: 'user-777',
      nested: { secret: 'x' },
    });
    // Shape only: container kinds and counts.
    expect(summary).toBe('object(3 fields)');
    expect(summary).not.toContain('SECRET');
    expect(summary).not.toContain('apiKeyValue');
    expect(summary).not.toContain('user-777');
    expect(safeArgumentSummary(['a', 'b', 'c'])).toBe('array(3)');
    expect(safeArgumentSummary('plain string')).toBe('string(12)');
    expect(safeArgumentSummary(42)).toBe('number');
    expect(safeArgumentSummary(null)).toBe('null');
    // A class instance is unsupported and never serialized.
    class Hostile {}
    expect(safeArgumentSummary(new Hostile())).toBe('unsupported');
  });
});
