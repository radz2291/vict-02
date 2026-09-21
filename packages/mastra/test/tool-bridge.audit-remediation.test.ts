import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { Agent } from '@mastra/core/agent';
import type { CapabilityDefinition, Contract } from '@victframework/sdk';
import { defineContract } from '@victframework/sdk';
import { createInMemoryAgentControlStores } from '@victframework/runtime';
import { AgentTurnService } from '@victframework/control';
import {
  bridgeCapabilityToolToMastra,
  runWithBridgeTurnScope,
  type CapabilityBridgeDeps,
} from '../src/tool-bridge.js';
import {
  PRESENTATION_BOUNDS,
  VictPresentationError,
  capturePresentationSchema,
} from '../src/presentation.js';
import {
  HOSTILE_RAW_ARGUMENT_KEYS,
  attachRawToolArgumentGuard,
  inspectRawToolArguments,
} from '../src/raw-argument-guard.js';
import { MASTRA_ADAPTER_COMPATIBILITY } from '../src/compatibility.js';

/**
 * AUDIT-REMEDIATION B-1..B-4 — permanent negative controls for the four
 * findings of the independent verification
 * (`docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-INDEPENDENT-VERIFICATION.md`),
 * frozen in
 * `docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-AUDIT-REMEDIATION-CONTRACT.md`
 * §2.
 *
 * Every control here FAILED (in the exact sense asserted below) against the
 * registry-installed `0.3.1-rc.1` candidate — the old-candidate
 * discriminator runs are recorded in the audit-remediation implementation
 * report — and must PASS on this repaired tree:
 *
 * - B-1: the §4 total bound is TRUE serialized UTF-8 bytes (boundary exact,
 *   boundary+1 fails, multibyte/escaped/keys-only fixtures measured);
 * - B-2: symbol-keyed fields (enumerable or not) are REJECTED, never
 *   silently dropped;
 * - B-3: proxies are rejected NATIVELY before any inspection, with EXACTLY
 *   ZERO trap executions, and non-enumerable own fields are rejected;
 * - B-4: own prototype-named raw arguments (any value shape, any depth) are
 *   rejected at the REAL tool surface BEFORE upstream normalization, with
 *   ZERO durable effect.
 */

// ---- Shared fixture machinery (the REAL bridge, REAL Mastra tool) ----------

const CLAIM_CONTENT_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string', maxLength: 200 },
    epistemicType: { type: 'string', enum: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7'] },
    honestyState: { type: 'string', enum: ['known', 'likely', 'uncertain', 'stale', 'conflicted'] },
    confidence: { type: 'string', enum: ['stated', 'qualified', 'uncertain'] },
    statement: { type: 'string', maxLength: 2000 },
  },
  required: ['subject', 'epistemicType', 'honestyState', 'confidence', 'statement'],
  additionalProperties: false,
} as const;

const COMMITMENT_CONTENT_SCHEMA = {
  type: 'object',
  properties: {
    commitmentKey: { type: 'string', maxLength: 200 },
    statement: { type: 'string', maxLength: 2000 },
  },
  required: ['commitmentKey', 'statement'],
  additionalProperties: false,
} as const;

const OPEN_LOOP_CONTENT_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string', maxLength: 200 },
    loopKind: { type: 'string', enum: ['pending_action', 'undecided_question', 'expected_event'] },
    detail: { type: 'string', maxLength: 2000 },
  },
  required: ['subject', 'loopKind', 'detail'],
  additionalProperties: false,
} as const;

const PROPOSAL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    proposalKind: { type: 'string', enum: ['claim', 'commitment', 'open_loop'] },
    content: { type: 'object' },
  },
  required: ['proposalKind', 'content'],
  additionalProperties: false,
  oneOf: [
    {
      type: 'object',
      properties: { proposalKind: { const: 'claim' }, content: CLAIM_CONTENT_SCHEMA },
      required: ['proposalKind', 'content'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { proposalKind: { const: 'commitment' }, content: COMMITMENT_CONTENT_SCHEMA },
      required: ['proposalKind', 'content'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: { proposalKind: { const: 'open_loop' }, content: OPEN_LOOP_CONTENT_SCHEMA },
      required: ['proposalKind', 'content'],
      additionalProperties: false,
    },
  ],
} as const;

const VALID_CLAIM = {
  proposalKind: 'claim',
  content: {
    subject: 'Explanation preference',
    epistemicType: 'E5',
    honestyState: 'likely',
    confidence: 'qualified',
    statement: 'Plain language first.',
  },
};

/**
 * A QUELLIGHT-EXACT authoritative parser: the real consumer's parse accepts
 * plain objects whose prototype is `Object.prototype` OR `null` (its
 * `isPlainObjectCandidate`), which is exactly why the audit's B-4 finding
 * mattered — a normalized input whose prototype was silently REWRITTEN to
 * null (or silently stripped) sailed through this parse and EXECUTED.
 */
function makeQuellightExactProposalContract(): Contract<unknown> {
  const isPlainObjectCandidate = (value: unknown): boolean => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  };
  return defineContract<unknown>({
    id: 'cap.proposal.input',
    revision: '3',
    expected: 'closed proposal shape (Quellight-exact plain-prototype check)',
    descriptiveJsonSchema: PROPOSAL_INPUT_SCHEMA,
    parse(input: unknown) {
      // The EXACT root check the consumer performs.
      if (!isPlainObjectCandidate(input)) {
        return {
          ok: false as const,
          issues: [{ code: 'invalid_type', path: '(root)', message: 'plain object required' }],
        };
      }
      const record = input as Record<string, unknown>;
      const allowed = ['proposalKind', 'content'];
      for (const key of Object.keys(record)) {
        if (!allowed.includes(key)) {
          return {
            ok: false as const,
            issues: [{ code: 'unknown_field', path: key, message: 'unknown field' }],
          };
        }
      }
      const kind = record['proposalKind'];
      if (typeof kind !== 'string' || !['claim', 'commitment', 'open_loop'].includes(kind)) {
        return {
          ok: false as const,
          issues: [{ code: 'invalid_enum', path: 'proposalKind', message: 'kind required' }],
        };
      }
      const content = record['content'];
      if (!isPlainObjectCandidate(content)) {
        return {
          ok: false as const,
          issues: [{ code: 'invalid_type', path: 'content', message: 'plain object required' }],
        };
      }
      const shapes: Record<string, readonly string[]> = {
        claim: ['subject', 'epistemicType', 'honestyState', 'confidence', 'statement'],
        commitment: ['commitmentKey', 'statement'],
        open_loop: ['subject', 'loopKind', 'detail'],
      };
      const requiredFields = shapes[kind] ?? [];
      const contentRecord = content as Record<string, unknown>;
      for (const key of Object.keys(contentRecord)) {
        if (!requiredFields.includes(key)) {
          return {
            ok: false as const,
            issues: [{ code: 'unknown_field', path: `content.${key}`, message: 'unknown field' }],
          };
        }
      }
      for (const field of requiredFields) {
        if (typeof contentRecord[field] !== 'string' || (contentRecord[field] as string).length === 0) {
          return {
            ok: false as const,
            issues: [{ code: 'missing_field', path: `content.${field}`, message: 'string required' }],
          };
        }
      }
      return { ok: true as const, value: input };
    },
  });
}

const proposalOutputContract: Contract<unknown> = defineContract<unknown>({
  id: 'cap.proposal.output',
  revision: '1',
  expected: 'closed union',
  descriptiveJsonSchema: {
    type: 'object',
    oneOf: [
      {
        type: 'object',
        properties: { accepted: { const: true }, proposalId: { type: 'string' } },
        required: ['accepted', 'proposalId'],
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: { accepted: { const: false }, code: { type: 'string' } },
        required: ['accepted', 'code'],
        additionalProperties: false,
      },
    ],
  },
  parse: (input) => ({ ok: true as const, value: input }),
});

/** A deliberately PERMISSIVE parser: only the guard can reject hostile keys. */
const permissiveContract: Contract<unknown> = defineContract<unknown>({
  id: 'cap.permissive.input',
  revision: '1',
  expected: 'accepts everything (guard isolation)',
  descriptiveJsonSchema: PROPOSAL_INPUT_SCHEMA,
  parse: (input) => ({ ok: true as const, value: input }),
});

function makeCapability(inputContract: Contract<unknown>): CapabilityDefinition {
  return {
    id: 'cap.proposal.draft',
    revision: '3',
    effect: 'write',
    description: 'Draft an inert pending proposal for the user to review later.',
    input: inputContract,
    output: proposalOutputContract,
    invoke: async (input: unknown) => ({ accepted: true, echo: input }),
  } as CapabilityDefinition;
}

interface Fixture {
  deps: CapabilityBridgeDeps;
  effectCount: () => number;
}

async function makeFixture(
  inputContract: Contract<unknown>,
  overrides: Partial<CapabilityBridgeDeps> = {},
): Promise<Fixture> {
  let clockValue = 1000;
  const clock = (): number => (clockValue += 1);
  const stores = createInMemoryAgentControlStores();
  await stores.actors.upsert({
    actorId: 'actor-requester',
    status: 'active',
    roles: ['developer'],
    createdAt: 0,
  });
  // The governed bridge records durable intents bound to the turn — the
  // turn record must exist in the control stores (same fixture discipline
  // as the other bridge suites).
  await stores.turns.createTurnIntent({
    turnId: SCOPE.turnId,
    streamId: SCOPE.streamId,
    threadId: SCOPE.threadId,
    actorId: SCOPE.actorId,
    agentProfileVersion: SCOPE.agentProfileVersion,
    activationVersion: undefined,
    applicationReleaseVersion: undefined,
    inputSummary: 'user-input:length=6',
    status: 'intent',
    createdAt: 1,
    updatedAt: 1,
    terminalAt: undefined,
    errorCode: undefined,
    traceId: undefined,
    victRunId: undefined,
    mastraRunId: undefined,
  });
  await stores.turns.startTurn(SCOPE.turnId, 2);
  let effectCount = 0;
  const turnService = new AgentTurnService({
    stores,
    clock,
    ids: {
      turnId: () => 'turn-audit-remediation',
      streamId: () => 'stream-audit-remediation',
      invocationId: () => `inv-${clock()}`,
      approvalId: () => 'approval-1',
      idempotencyKey: () => `key-${clock()}`,
      cancelId: () => 'cancel-1',
    },
  });
  const capability = makeCapability(inputContract);
  const deps: CapabilityBridgeDeps = {
    resolveCapability: (id, revision): CapabilityDefinition | undefined =>
      id === capability.id && revision === capability.revision ? capability : undefined,
    // The Quellight-style quiet-write host policy: exactly one entry for the
    // proposal capability at revision 3 (write proceeds without a separate
    // approval round-trip — the real consumer composition's shape).
    quietWriteApprovals: {
      policyIdentity: 'qlt.host-policy.quiet-write@1',
      entries: [{ capabilityId: 'cap.proposal.draft', capabilityRevision: '3' }],
    } as unknown as CapabilityBridgeDeps['quietWriteApprovals'],
    invoke: async (resolved, input) => {
      effectCount += 1;
      return (await resolved.invoke(input, {} as never)) as unknown;
    },
    recordInvocationIntent: (input) => turnService.recordToolInvocationIntent(input),
    claimInvocationRun: (command) => stores.invocations.claimInvocationRun(command),
    settleInvocationRun: (command) => stores.invocations.settleInvocationRun(command),
    settleInvocationPending: (command) => stores.invocations.settleInvocationPending(command),
    reconcileAbandonedRun: (command) => stores.invocations.reconcileAbandonedRun(command),
    requestApproval: (input) => turnService.requestApproval(input),
    consumeApproval: (binding) => turnService.consumeApproval(binding),
    updateInvocationStatus: (command) => stores.invocations.updateInvocationStatus(command),
    clock,
    pollIntervalMs: 5,
    approvalExpiryMs: 5000,
    ...overrides,
  };
  return { deps, effectCount: () => effectCount };
}

const ACTIVATION = {
  activationVersion: 'v1_act',
  agentProfileVersion: 'v1_profile',
  capabilities: [{ id: 'cap.proposal.draft', revision: '3' }],
} as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];

const SCOPE = {
  turnId: 'turn-audit-remediation',
  streamId: 'stream-audit-remediation',
  actorId: 'actor-requester',
  agentProfileVersion: 'v1_profile',
  threadId: 'thread-audit-remediation',
};

async function executeTool(tool: unknown, input: unknown): Promise<unknown> {
  const exec = (tool as { execute: unknown }).execute as (
    i: unknown,
    c: unknown,
  ) => Promise<unknown>;
  return runWithBridgeTurnScope(SCOPE, () => exec(input, { toolCallId: 'call-1' }));
}

/** Build the guarded REAL tool for one input contract. */
function buildTool(inputContract: Contract<unknown>, deps: CapabilityBridgeDeps): unknown {
  return bridgeCapabilityToolToMastra(ACTIVATION, makeCapability(inputContract), deps);
}

// ---- Counted hostile proxies (B-3) ------------------------------------------

const TRAP_NAMES = [
  'getPrototypeOf',
  'setPrototypeOf',
  'isExtensible',
  'preventExtensions',
  'getOwnPropertyDescriptor',
  'defineProperty',
  'has',
  'get',
  'set',
  'deleteProperty',
  'ownKeys',
  'apply',
  'construct',
] as const;

function countedProxy(target: unknown): { proxy: unknown; totalTraps: () => number; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  const handler: Record<string, unknown> = {};
  for (const trap of TRAP_NAMES) {
    counts[trap] = 0;
    handler[trap] = function (...args: unknown[]) {
      counts[trap] = (counts[trap] ?? 0) + 1;
      return (Reflect as unknown as Record<string, (...a: unknown[]) => unknown>)[trap](...args);
    };
  }
  return {
    proxy: new Proxy(target, handler as never),
    totalTraps: () => Object.values(counts).reduce((a, b) => a + b, 0),
    counts,
  };
}

// ---- B-1: the total bound is TRUE serialized UTF-8 bytes --------------------

/** Deterministically build a schema whose serialized UTF-8 size is exactly
 * `targetBytes` (ASCII padding distributed round-robin over 16 fields,
 * every per-string value within the 2048-char bound). */
function schemaOfExactSize(targetBytes: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (let index = 0; index < 16; index += 1) {
    out[`f${String(index).padStart(2, '0')}`] = '';
  }
  let size = Buffer.byteLength(JSON.stringify(out), 'utf8');
  if (size > targetBytes) {
    throw new Error(`fixture floor ${size} exceeds target ${targetBytes}`);
  }
  const maxCharsPerField = PRESENTATION_BOUNDS.maxStringLength;
  let field = 0;
  while (size < targetBytes) {
    const key = `f${String(field % 16).padStart(2, '0')}`;
    if (out[key].length >= maxCharsPerField) {
      field += 1;
      if (field >= 16) {
        throw new Error(`cannot reach target ${targetBytes} within per-string bound`);
      }
      continue;
    }
    out[key] += 'x';
    size += 1;
  }
  if (size !== targetBytes) {
    throw new Error(`overshot target ${targetBytes}`);
  }
  return out;
}

describe('B-1: the total presentation bound measures TRUE serialized UTF-8 bytes', () => {
  it('a serialization of EXACTLY 32768 UTF-8 bytes PASSES the capture', () => {
    const schema = schemaOfExactSize(PRESENTATION_BOUNDS.maxTotalBytes);
    expect(
      Buffer.byteLength(JSON.stringify(schema), 'utf8'),
    ).toBe(PRESENTATION_BOUNDS.maxTotalBytes);
    const captured = capturePresentationSchema(schema, 'probe') as Record<string, unknown>;
    expect(Object.keys(captured)).toHaveLength(16);
  });

  it('a serialization of 32769 UTF-8 bytes FAILS closed', () => {
    const schema = schemaOfExactSize(PRESENTATION_BOUNDS.maxTotalBytes + 1);
    expect(() => capturePresentationSchema(schema, 'probe')).toThrowError(VictPresentationError);
    try {
      capturePresentationSchema(schema, 'probe');
    } catch (error) {
      expect((error as VictPresentationError).code).toBe('VICT_PRESENTATION_INVALID');
      expect((error as VictPresentationError).detail).toContain('UTF-8');
      // Non-echoing: the received values never appear in the error.
      expect((error as VictPresentationError).detail).not.toContain('xxxxxxxxxx');
    }
  });

  it('the audit discriminator: 16x2000 CJK characters (~96KB serialized) FAILS construction', () => {
    // Structurally valid under EVERY per-string/field/depth bound — only the
    // TRUE byte total rejects it (rc.1 accepted this exact shape).
    const schema: Record<string, string> = {};
    for (let index = 0; index < 16; index += 1) {
      schema[`f${String(index).padStart(2, '0')}`] = 'あ'.repeat(2000);
    }
    const serializedBytes = Buffer.byteLength(JSON.stringify(schema), 'utf8');
    expect(serializedBytes).toBeGreaterThan(PRESENTATION_BOUNDS.maxTotalBytes);
    expect(serializedBytes).toBeGreaterThan(90_000);
    expect(() => capturePresentationSchema(schema, 'probe')).toThrowError(VictPresentationError);
    try {
      capturePresentationSchema(schema, 'probe');
    } catch (error) {
      // The rejection reason is the BYTE bound, not any per-string bound.
      expect((error as VictPresentationError).detail).toContain('UTF-8');
    }
  });

  it('escaped-string bytes are counted: 16x2048 quote characters (~65KB serialized) FAILS', () => {
    // rc.1's unit accounting measured EXACTLY 32,768 `.length` units here —
    // the old boundary value — while the true serialized size is ~65KB.
    const schema: Record<string, string> = {};
    for (let index = 0; index < 16; index += 1) {
      schema[`f${String(index).padStart(2, '0')}`] = '"'.repeat(PRESENTATION_BOUNDS.maxStringLength);
    }
    const serializedBytes = Buffer.byteLength(JSON.stringify(schema), 'utf8');
    expect(serializedBytes).toBeGreaterThan(PRESENTATION_BOUNDS.maxTotalBytes);
    expect(() => capturePresentationSchema(schema, 'probe')).toThrowError(VictPresentationError);
  });

  it('keys, punctuation, and containers are counted: a keys-only ~274KB schema FAILS', () => {
    // Zero-length string values: rc.1's value-only accounting measured ~0
    // units while the serialized form is ~274KB of key bytes and structure.
    const field: Record<string, string> = {};
    for (let index = 0; index < 64; index += 1) {
      field['k'.repeat(64) + String(index).padStart(2, '0').slice(0, 0)] = '';
    }
    // exactly-64-char keys (within the key vocabulary bound):
    const wideField: Record<string, string> = {};
    for (let index = 0; index < 64; index += 1) {
      wideField[`${'k'.repeat(62)}${String(index).padStart(2, '0')}`] = '';
    }
    const schema = { items: Array.from({ length: 64 }, () => ({ ...wideField })) };
    const serializedBytes = Buffer.byteLength(JSON.stringify(schema), 'utf8');
    expect(serializedBytes).toBeGreaterThan(PRESENTATION_BOUNDS.maxTotalBytes);
    expect(() => capturePresentationSchema(schema, 'probe')).toThrowError(VictPresentationError);
  });

  it('a ~32KB presentation within every bound still constructs and presents (compatibility)', async () => {
    const schema = schemaOfExactSize(PRESENTATION_BOUNDS.maxTotalBytes - 128) as unknown as Record<
      string,
      unknown
    >;
    const contract = defineContract<unknown>({
      id: 'cap.big.input',
      revision: '1',
      expected: 'large but bounded presentation',
      descriptiveJsonSchema: schema,
      parse: (input) => ({ ok: true as const, value: input }),
    });
    const { deps } = await makeFixture(contract);
    const tool = buildTool(contract, deps);
    const presented = (tool as {
      inputSchema: { '~standard': { jsonSchema: { input: () => unknown } } };
    }).inputSchema['~standard'].jsonSchema.input();
    expect(presented).toEqual(schema);
  });
});

// ---- B-2/B-3: capture hardening ---------------------------------------------

describe('B-3: proxies are rejected NATIVELY with EXACTLY ZERO trap executions', () => {
  it('plain-target proxy rejected; every trap executes exactly zero times', () => {
    const { proxy, totalTraps, counts } = countedProxy({ type: 'object', a: 1 });
    expect(() => capturePresentationSchema(proxy as never, 'probe')).toThrowError(
      VictPresentationError,
    );
    expect(totalTraps()).toBe(0);
    void counts;
  });

  it('array-target proxy rejected before any array read; traps exactly zero', () => {
    const { proxy, totalTraps } = countedProxy(['element']);
    expect(() => capturePresentationSchema(proxy as never, 'probe')).toThrowError(
      VictPresentationError,
    );
    expect(totalTraps()).toBe(0);
  });

  it('nested proxy rejected when the capture reaches it; its traps exactly zero', () => {
    const inner = countedProxy({ deep: 'payload' });
    const outer = { type: 'object', nested: inner.proxy };
    expect(() => capturePresentationSchema(outer, 'probe')).toThrowError(VictPresentationError);
    expect(inner.totalTraps()).toBe(0);
  });

  it('lying-descriptor proxy rejected; the attacker data never enters any schema', () => {
    const { proxy, totalTraps } = countedProxy({ a: 'honest' });
    expect(() => capturePresentationSchema(proxy as never, 'probe')).toThrowError(
      VictPresentationError,
    );
    expect(totalTraps()).toBe(0);
  });

  it('revoked proxy rejected without throwing a raw TypeError', () => {
    const { revoke } = Proxy.revocable({ a: 1 }, {});
    revoke();
    expect(() => capturePresentationSchema(new Proxy({ b: 2 }, {}) as never, 'probe')).toThrowError(
      VictPresentationError,
    );
    expect(() => capturePresentationSchema({} as never, 'probe')).not.toThrowError();
    void revoke;
  });

  it('proxy rejection happens at CONSTRUCTION too (fail closed, zero traps)', async () => {
    const inner = countedProxy({ sneaky: true });
    const hostileSchema = { type: 'object', nested: inner.proxy };
    const contract = defineContract<unknown>({
      id: 'cap.hostile.input',
      revision: '1',
      expected: 'hostile presentation',
      descriptiveJsonSchema: hostileSchema,
      parse: (input) => ({ ok: true as const, value: input }),
    });
    const { deps } = await makeFixture(contract);
    expect(() => buildTool(contract, deps)).toThrowError(VictPresentationError);
    expect(inner.totalTraps()).toBe(0);
  });
});

describe('B-2: symbol-keyed and non-enumerable fields are REJECTED, never dropped', () => {
  it('an ENUMERABLE own symbol-keyed field rejects construction (rc.1 silently dropped it)', () => {
    const schema: Record<string, unknown> = { type: 'object', visible: true };
    const symbolKey = Symbol('audit-symbol');
    (schema as Record<PropertySymbol, unknown>)[symbolKey] = 'symbol-payload';
    expect(() => capturePresentationSchema(schema, 'probe')).toThrowError(VictPresentationError);
    try {
      capturePresentationSchema(schema, 'probe');
    } catch (error) {
      expect((error as VictPresentationError).detail).toContain('symbol');
    }
  });

  it('a NON-ENUMERABLE own symbol-keyed field is also rejected', () => {
    const schema: Record<string, unknown> = { type: 'object' };
    Object.defineProperty(schema, Symbol('hidden-symbol'), {
      value: 'hidden-payload',
      enumerable: false,
      configurable: true,
      writable: true,
    });
    expect(() => capturePresentationSchema(schema, 'probe')).toThrowError(VictPresentationError);
  });

  it('a symbol VALUE continues to be rejected', () => {
    expect(() =>
      capturePresentationSchema({ type: 'object', payload: Symbol('x') }, 'probe'),
    ).toThrowError(VictPresentationError);
  });

  it('a NON-ENUMERABLE own string-keyed field is rejected explicitly (never silently skipped)', () => {
    const schema: Record<string, unknown> = { type: 'object' };
    Object.defineProperty(schema, 'hidden', {
      value: 'hidden-data',
      enumerable: false,
      configurable: true,
      writable: true,
    });
    expect(() => capturePresentationSchema(schema, 'probe')).toThrowError(VictPresentationError);
    try {
      capturePresentationSchema(schema, 'probe');
    } catch (error) {
      expect((error as VictPresentationError).detail).toContain('non-enumerable');
    }
  });

  it('hostile canaries never appear in any capture error', () => {
    const CANARY = 'AUDIT-CANARY-HOSTILE-VALUE';
    const hostileInputs: unknown[] = [
      (() => {
        const s: Record<string | symbol, unknown> = { type: 'object' };
        s[Symbol('s')] = CANARY;
        return s;
      })(),
      (() => {
        const s: Record<string, unknown> = { type: 'object' };
        Object.defineProperty(s, 'hidden', { value: CANARY, enumerable: false, configurable: true });
        return s;
      })(),
      (() => {
        const s: Record<string, unknown> = { type: 'object', sneaky: CANARY };
        Object.defineProperty(s, 'sneaky', { get() { return CANARY; }, enumerable: true, configurable: true });
        return s;
      })(),
    ];
    for (const hostile of hostileInputs) {
      try {
        capturePresentationSchema(hostile, 'probe');
        throw new Error('expected rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(VictPresentationError);
        expect((error as Error).message).not.toContain(CANARY);
      }
    }
  });
});

describe('B-3 compatibility: ordinary containers remain supported', () => {
  it('plain objects, arrays, and null-prototype containers capture as before', () => {
    const nullProto = Object.assign(Object.create(null), { type: 'object', ok: true });
    const schema = {
      type: 'object',
      list: ['a', 2, true, null, { nested: 'value' }],
      plain: { inner: 'data' },
      nullProtoContainer: JSON.parse(JSON.stringify(nullProto)),
    };
    const captured = capturePresentationSchema(schema, 'probe') as Record<string, unknown>;
    expect(captured).toEqual(schema);
    expect(Object.isFrozen(captured)).toBe(true);
    void nullProto;
  });
});

// ---- B-4: the raw-argument guard at the REAL tool surface -------------------

const GUARD_ENVELOPE = { victCapabilityFailure: 'VICT_CAPABILITY_INPUT_CONTRACT_REJECTED' };

/** Every mandated hostile shape: own prototype-named keys, every value
 * shape, arrays, defineProperty-created own data properties. */
function hostileArgumentShapes(): Array<{ readonly name: string; readonly args: unknown }> {
  const validRemainder = { proposalKind: 'claim', content: VALID_CLAIM['content'] };
  const shapes: Array<{ name: string; args: unknown }> = [
    { name: 'object-valued __proto__ (JSON.parse)', args: JSON.parse('{"__proto__": {"injected": true}, "proposalKind": "claim"}') },
    { name: 'number-valued __proto__ (JSON.parse)', args: JSON.parse('{"__proto__": 5, "proposalKind": "claim"}') },
    { name: 'string-valued __proto__ (JSON.parse)', args: JSON.parse('{"__proto__": "hostile", "proposalKind": "claim"}') },
    { name: 'boolean-valued __proto__ (JSON.parse)', args: JSON.parse('{"__proto__": true, "proposalKind": "claim"}') },
    { name: 'null-valued __proto__ (JSON.parse)', args: JSON.parse('{"__proto__": null, "proposalKind": "claim"}') },
    { name: 'own __proto__ data property via computed key (undefined value)', args: { ['__proto__']: undefined, proposalKind: 'claim' } },
    { name: 'own constructor key', args: JSON.parse('{"constructor": {"prototype": true}, "proposalKind": "claim"}') },
    { name: 'own prototype key', args: JSON.parse('{"prototype": [], "proposalKind": "claim"}') },
    {
      name: 'nested hostile key inside an array of objects',
      args: { outer: [{ inner: [{ deeper: JSON.parse('{"__proto__": {"deep": true}}') }] }] },
    },
    {
      name: 'non-enumerable own __proto__ data property (defineProperty)',
      args: (() => {
        const args: Record<string, unknown> = { proposalKind: 'claim' };
        Object.defineProperty(args, '__proto__', {
          value: { injected: true },
          enumerable: false,
          configurable: true,
          writable: true,
        });
        return args;
      })(),
    },
    {
      name: 'non-enumerable own constructor data property (defineProperty)',
      args: (() => {
        const args: Record<string, unknown> = { proposalKind: 'claim' };
        Object.defineProperty(args, 'constructor', {
          value: 'CANARY-HOSTILE-CONSTRUCTOR',
          enumerable: false,
          configurable: true,
          writable: true,
        });
        return args;
      })(),
    },
  ];
  // Every shape also carries a VALID remainder where the shape allows it —
  // proving the rejection is caused by the hostile KEY, not the remainder.
  return shapes.map((shape) => {
    if (
      typeof shape.args === 'object' &&
      shape.args !== null &&
      !Array.isArray(shape.args) &&
      (shape.args as Record<string, unknown>)['proposalKind'] === undefined &&
      (shape.args as Record<string, unknown>)['outer'] === undefined
    ) {
      return { name: shape.name, args: { ...shape.args, ...validRemainder } };
    }
    return shape;
  });
}

describe('B-4: hostile prototype-named raw arguments are rejected with ZERO effect', () => {
  it('EVERY value shape is rejected at the REAL tool surface (permissive parse isolates the guard)', async () => {
    const { deps, effectCount } = await makeFixture(permissiveContract);
    const tool = buildTool(permissiveContract, deps);
    for (const { name, args } of hostileArgumentShapes()) {
      const outcome = (await executeTool(tool, args)) as Record<string, unknown>;
      expect(outcome, name).toEqual(GUARD_ENVELOPE);
    }
    // ZERO durable intent, ZERO invocation, ZERO capability effect.
    expect(effectCount()).toBe(0);
  });

  it('the primitive/null __proto__ remainder can no longer EXECUTE (the exact rc.1 bypass, Quellight-exact parse)', async () => {
    const { deps, effectCount } = await makeFixture(makeQuellightExactProposalContract());
    const tool = buildTool(makeQuellightExactProposalContract(), deps);
    // This argument REACHED AN EFFECT under rc.1: the primitive-valued
    // __proto__ key vanished during upstream normalization and the valid
    // remainder was approved by the authoritative (Quellight-exact) parse.
    const bypassArgs = JSON.parse(
      '{"__proto__": 5, "proposalKind": "claim", "content": {"subject":"s","epistemicType":"E5","honestyState":"likely","confidence":"stated","statement":"x"}}',
    );
    const outcome = (await executeTool(tool, bypassArgs)) as Record<string, unknown>;
    expect(outcome).toEqual(GUARD_ENVELOPE);
    expect(effectCount()).toBe(0);
    // The null-valued variant (whose poisoned normalized copy would be
    // ACCEPTED by the Quellight-exact null-prototype-tolerant parse):
    const nullBypass = JSON.parse(
      '{"__proto__": null, "proposalKind": "commitment", "content": {"commitmentKey":"k","statement":"s"}}',
    );
    const outcome2 = (await executeTool(tool, nullBypass)) as Record<string, unknown>;
    expect(outcome2).toEqual(GUARD_ENVELOPE);
    expect(effectCount()).toBe(0);
  });

  it('no prototype pollution and no raw value echo from any rejection', async () => {
    const { deps } = await makeFixture(permissiveContract);
    const tool = buildTool(permissiveContract, deps);
    const CANARY = 'AUDIT-CANARY-HOSTILE-ARG';
    const hostile = JSON.parse(
      `{"__proto__": {"${CANARY}": true}, "constructor": "${CANARY}", "proposalKind": "claim"}`,
    );
    const outcome = (await executeTool(tool, hostile)) as Record<string, unknown>;
    expect(outcome).toEqual(GUARD_ENVELOPE);
    // NO prototype pollution of any reachable object:
    expect(Object.hasOwn(Object.prototype, 'injected')).toBe(false);
    const fresh = JSON.parse('{"check": true}') as Record<string, unknown>;
    expect(fresh['CANARY']).toBeUndefined();
    expect(JSON.stringify(Object.getOwnPropertyNames(Object.prototype))).not.toContain(CANARY);
    // Non-echo: the structured failure carries no received content.
    expect(JSON.stringify(outcome)).not.toContain(CANARY);
  });

  it('hostile PROXY arguments are rejected with exactly zero trap executions', async () => {
    const { deps, effectCount } = await makeFixture(permissiveContract);
    const tool = buildTool(permissiveContract, deps);
    const inner = countedProxy(JSON.parse('{"__proto__": {"injected": true}}'));
    const hostile = { proposalKind: 'claim', nested: inner.proxy };
    const outcome = (await executeTool(tool, hostile)) as Record<string, unknown>;
    expect(outcome).toEqual(GUARD_ENVELOPE);
    expect(inner.totalTraps()).toBe(0);
    expect(effectCount()).toBe(0);
  });

  it('valid arguments STILL cross the real bridge exactly once (compatibility)', async () => {
    const { deps, effectCount } = await makeFixture(makeQuellightExactProposalContract());
    const tool = buildTool(makeQuellightExactProposalContract(), deps);
    const outcome = (await executeTool(tool, VALID_CLAIM)) as { accepted?: boolean };
    expect(outcome['accepted']).toBe(true);
    expect(effectCount()).toBe(1);
  });

  it('a null-prototype argument container WITHOUT prohibited keys remains compatible', async () => {
    const { deps, effectCount } = await makeFixture(makeQuellightExactProposalContract());
    const tool = buildTool(makeQuellightExactProposalContract(), deps);
    const args = Object.assign(Object.create(null), JSON.parse(JSON.stringify(VALID_CLAIM)));
    const outcome = (await executeTool(tool, args)) as { accepted?: boolean };
    expect(outcome['accepted']).toBe(true);
    expect(effectCount()).toBe(1);
  });

  it('the guard helpers expose the closed hostile-key vocabulary', () => {
    expect([...HOSTILE_RAW_ARGUMENT_KEYS].sort()).toEqual([
      '__proto__',
      'constructor',
      'prototype',
    ]);
    // Unit-level: the raw inspector rejects every hostile shape directly.
    for (const { args } of hostileArgumentShapes()) {
      expect(() => inspectRawToolArguments(args)).toThrowError();
    }
    expect(() => inspectRawToolArguments(VALID_CLAIM)).not.toThrowError();
    expect(() => inspectRawToolArguments(undefined)).not.toThrowError();
    expect(() => inspectRawToolArguments('a string')).not.toThrowError();
    expect(() => inspectRawToolArguments(null)).not.toThrowError();
  });

  it('the guard wrapping is idempotent-safe and preserves the Mastra tool identity', async () => {
    const { deps } = await makeFixture(permissiveContract);
    const tool = buildTool(permissiveContract, deps) as Record<string, unknown>;
    // The REAL tool object is the Mastra Tool instance (marker present) and
    // only `execute` was wrapped.
    expect(tool[Symbol.for('mastra.core.tool.Tool')]).toBe(true);
    expect(typeof tool['execute']).toBe('function');
    // The provider-facing declaration surface is UNCHANGED by the wrap.
    const standard = (tool['inputSchema'] as { '~standard': { jsonSchema: { input: () => unknown } } })[
      '~standard'
    ];
    expect(standard.jsonSchema.input()).toEqual(PROPOSAL_INPUT_SCHEMA);
  });
});

// ---- B-4 through the REAL provider-tool conversion path ---------------------

describe('B-4: the real provider-tool conversion path still carries the full captured schema', () => {
  it('a REAL Mastra Agent hands the model layer the FULL schema of the GUARDED tool', async () => {
    const { deps } = await makeFixture(makeQuellightExactProposalContract());
    const tool = buildTool(makeQuellightExactProposalContract(), deps);
    const captured: Array<Record<string, unknown>> = [];
    const model = {
      specificationVersion: 'v2' as const,
      provider: 'audit-remediation-recording',
      modelId: 'audit-remediation-stub',
      supportedUrls: {},
      providerModelIdentity: 'audit-remediation-stub',
      async doStream(options: Record<string, unknown>) {
        captured.push(options);
        let controller: ReadableStreamDefaultController<Record<string, unknown>> | undefined;
        const stream = new ReadableStream<Record<string, unknown>>({
          start(c) {
            controller = c;
          },
        });
        queueMicrotask(() => {
          try {
            controller!.enqueue({
              type: 'finish',
              finishReason: 'stop',
              totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller!.close();
          } catch {
            // already closed
          }
        });
        return { stream };
      },
    };
    const agent = new Agent({
      id: 'audit-remediation-agent',
      name: 'audit-remediation-agent',
      instructions: 'audit remediation provider-path proof',
      model: model as never,
      tools: { qlt_proposal_draft: tool as never },
    });
    try {
      const streamResult = await agent.stream('hello audit remediation', {
        maxSteps: 5,
      } as never);
      for await (const chunk of streamResult.fullStream) {
        void chunk;
      }
    } catch {
      // The stub's response is intentionally minimal; the model request is
      // already captured when this surfaces.
    }
    expect(captured.length).toBeGreaterThan(0);
    const call = captured[captured.length - 1];
    const tools = (call['tools'] as Array<Record<string, unknown>>) ?? [];
    expect(tools.length).toBeGreaterThan(0);
    const bound = tools.find((candidate) =>
      String(candidate['name'] ?? '').includes('proposal'),
    ) as Record<string, unknown>;
    expect(bound).toBeDefined();
    const parameters = JSON.stringify(bound['inputSchema'] ?? bound['parameters']);
    for (const token of [
      'proposalKind',
      'content',
      'required',
      'additionalProperties',
      'claim',
      'commitment',
      'open_loop',
      'commitmentKey',
      'loopKind',
    ]) {
      expect(parameters, token).toContain(token);
    }
    expect(parameters).not.toBe('{"type":"object"}');
    // The bounded description rides the same provider-bound declaration.
    const description = String(bound['description'] ?? '');
    expect(description).toContain("VICT governed capability 'cap.proposal.draft'");
  });
});

// ---- Adjacent truthful cleanup: the output-schema surface -------------------

describe('adjacent cleanup: the captured output schema rides the REAL outputSchema wrapper', () => {
  it('tool.outputSchema[~standard].jsonSchema.output() returns the captured output schema', async () => {
    const { deps } = await makeFixture(makeQuellightExactProposalContract());
    const tool = buildTool(makeQuellightExactProposalContract(), deps) as {
      outputSchema: { '~standard': { jsonSchema: { input: () => unknown; output: () => unknown } } };
    };
    const output = tool.outputSchema['~standard'].jsonSchema.output() as Record<string, unknown>;
    expect(output).toBeDefined();
    expect(JSON.stringify(output)).toContain('accepted');
    expect(JSON.stringify(output)).toContain('proposalId');
    expect(output).not.toEqual({ type: 'object' });
    // The neutral input() surface of the output wrapper is unchanged.
    expect(tool.outputSchema['~standard'].jsonSchema.input()).toEqual({ type: 'object' });
  });

  it('the adapter compatibility marker is revision 3 (model-visible surface change recorded)', () => {
    expect(MASTRA_ADAPTER_COMPATIBILITY.revision).toBe('3');
  });
});
