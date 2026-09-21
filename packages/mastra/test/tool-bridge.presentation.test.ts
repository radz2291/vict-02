import { describe, expect, it } from 'vitest';
import type { CapabilityDefinition, Contract } from '@victframework/sdk';
import { defineContract } from '@victframework/sdk';
import { createInMemoryAgentControlStores } from '@victframework/runtime';
import { AgentTurnService } from '@victframework/control';
import {
  bridgeCapabilityToolToMastra,
  buildCapabilityTools,
  runWithBridgeTurnScope,
  type CapabilityBridgeDeps,
} from '../src/tool-bridge.js';
import {
  PRESENTATION_BOUNDS,
  VictPresentationError,
  captureCapabilityDescription,
  capturePresentationSchema,
} from '../src/presentation.js';

/**
 * B-1 REMEDIATION — the model-facing capability-schema presentation
 * (frozen contract:
 * docs/report/VICT-MODEL-FACING-CAPABILITY-SCHEMA-CONTRACT.md).
 *
 * These tests inspect the REAL tool object returned by the bridge — the
 * exact object handed to Mastra and the provider — and prove that the
 * provider-facing declaration carries the captured descriptive schema and
 * the bounded description. They FAIL against released VICT 0.3.0, whose
 * bridge fabricated the generic `{ type: 'object' }` schema for every
 * contract and a generic description for every tool.
 *
 * Authority separation is proven adversarially: the presentation is never
 * executed, never validates, and a hostile or inaccurate descriptive
 * schema cannot bypass the authoritative `Contract.parse`.
 */

// ---- The exact nested proposal-shaped presentation (framework-level fixture;
// the same structure Quellight declares for its proposal capability) --------

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

const BOUNDED_DESCRIPTION =
  'Draft an inert pending proposal for the user to review later. ' +
  'It never confirms, saves, or changes canonical memory. ' +
  "Accepts only proposalKind 'claim', 'commitment', or 'open_loop', each with its exact content shape.";

// ---- Contracts -------------------------------------------------------------

/** The closed proposal contract (authoritative; mirrors the presentation). */
const proposalInputContract: Contract<unknown> = defineContract<unknown>({
  id: 'cap.proposal.input',
  revision: '1',
  expected: 'closed proposal shape',
  descriptiveJsonSchema: PROPOSAL_INPUT_SCHEMA,
  parse(input: unknown) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return {
        ok: false as const,
        issues: [{ code: 'invalid_type', path: '(root)', message: 'object required' }],
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
    if (typeof content !== 'object' || content === null || Array.isArray(content)) {
      return {
        ok: false as const,
        issues: [{ code: 'invalid_type', path: 'content', message: 'object required' }],
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

function makeProposalCapability(overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
  return {
    id: 'cap.proposal.draft',
    revision: '3',
    effect: 'read',
    description: BOUNDED_DESCRIPTION,
    input: proposalInputContract,
    output: proposalOutputContract,
    invoke: async (input: unknown) => ({ accepted: true, echo: input }),
    ...overrides,
  } as CapabilityDefinition;
}

/** The provider-facing declaration path: exactly what Mastra's
 * `standardSchemaToJSONSchema(schema, { io: 'input' })` reads. */
function providerFacingInputSchema(tool: unknown): unknown {
  const inputSchema = (tool as { inputSchema?: { '~standard'?: unknown } }).inputSchema;
  expect(inputSchema).toBeDefined();
  const standard = inputSchema?.['~standard'] as {
    version: number;
    vendor: string;
    validate: unknown;
    jsonSchema: { input: () => unknown; output: () => unknown };
  };
  // The Standard-Schema-WithJSON surface Mastra requires:
  expect(standard.version).toBe(1);
  expect(standard.vendor).toBe('vict.contract');
  expect(typeof standard.validate).toBe('function');
  expect(typeof standard.jsonSchema.input).toBe('function');
  expect(typeof standard.jsonSchema.output).toBe('function');
  return standard.jsonSchema.input({ target: 'draft-07' });
}

interface Fixture {
  deps: CapabilityBridgeDeps;
  effectCount: () => number;
}

async function makeFixture(capability: CapabilityDefinition): Promise<Fixture> {
  let clockValue = 1000;
  const clock = (): number => (clockValue += 1);
  const stores = createInMemoryAgentControlStores();
  await stores.actors.upsert({
    actorId: 'actor-requester',
    status: 'active',
    roles: ['developer'],
    createdAt: 0,
  });
  let effectCount = 0;
  const turnService = new AgentTurnService({
    stores,
    clock,
    ids: {
      turnId: () => 'turn-presentation',
      streamId: () => 'stream-presentation',
      invocationId: () => `inv-${clock()}`,
      approvalId: () => 'approval-1',
      idempotencyKey: () => `key-${clock()}`,
      cancelId: () => 'cancel-1',
    },
  });
  const deps: CapabilityBridgeDeps = {
    resolveCapability: (id, revision): CapabilityDefinition | undefined =>
      id === capability.id && revision === capability.revision ? capability : undefined,
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
  };
  return { deps, effectCount: () => effectCount };
}

const ACTIVATION = {
  activationVersion: 'v1_act',
  agentProfileVersion: 'v1_profile',
  capabilities: [{ id: 'cap.proposal.draft', revision: '3' }],
} as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];

const SCOPE = {
  turnId: 'turn-presentation',
  streamId: 'stream-presentation',
  actorId: 'actor-requester',
  agentProfileVersion: 'v1_profile',
  threadId: 'thread-presentation',
};

async function executeTool(
  tool: unknown,
  input: unknown,
): Promise<unknown> {
  const exec = (tool as { execute: unknown }).execute as (
    i: unknown,
    c: unknown,
  ) => Promise<unknown>;
  return runWithBridgeTurnScope(SCOPE, () => exec(input, { toolCallId: 'call-1' }));
}

// ---- The permanent provider-facing schema proof ----------------------------

describe('B-1: the real tool object exposes the captured model-facing schema', () => {
  it('the provider-facing declaration contains the exact nested proposal schema', async () => {
    const { deps } = await makeFixture(makeProposalCapability());
    const tool = bridgeCapabilityToolToMastra(ACTIVATION, makeProposalCapability(), deps);
    const schema = providerFacingInputSchema(tool) as Record<string, unknown>;
    // The exact structure the model must receive (this assertion fails
    // against released VICT 0.3.0, which exposed only `{type:'object"}`):
    expect(schema).toEqual(PROPOSAL_INPUT_SCHEMA);
    const serialized = JSON.stringify(schema);
    for (const token of [
      'proposalKind',
      'content',
      'required',
      'claim',
      'commitment',
      'open_loop',
    ]) {
      expect(serialized).toContain(token);
    }
    expect(schema['additionalProperties']).toBe(false);
    // The nested branches carry closed additional-property rules too.
    for (const branch of schema['oneOf'] as Record<string, unknown>[]) {
      expect(branch['additionalProperties']).toBe(false);
      expect(Array.isArray(branch['required'])).toBe(true);
    }
  });

  it('the tool description carries the bounded capability description', async () => {
    const { deps } = await makeFixture(makeProposalCapability());
    const tool = bridgeCapabilityToolToMastra(ACTIVATION, makeProposalCapability(), deps);
    const description = (tool as { description?: string }).description ?? '';
    expect(description).toContain(
      "VICT governed capability 'cap.proposal.draft' (revision 3, effect 'read').",
    );
    expect(description).toContain('never confirms, saves, or changes canonical memory');
    expect(description).toContain('claim');
    expect(description.length).toBeLessThanOrEqual(
      120 + PRESENTATION_BOUNDS.maxDescriptionChars,
    );
  });

  it('buildCapabilityTools exposes the same captured declaration to the agent', async () => {
    const { deps } = await makeFixture(makeProposalCapability());
    const tools = buildCapabilityTools(ACTIVATION, deps) as Record<string, unknown>;
    expect(Object.keys(tools)).toEqual(['cap_proposal_draft']);
    const tool = tools['cap_proposal_draft'];
    expect(tool).toBeDefined();
    const schema = providerFacingInputSchema(tool) as Record<string, unknown>;
    expect(schema).toEqual(PROPOSAL_INPUT_SCHEMA);
  });

  it('the captured output schema is presented; capture is deterministic', async () => {
    const { deps } = await makeFixture(makeProposalCapability());
    const toolA = bridgeCapabilityToolToMastra(ACTIVATION, makeProposalCapability(), deps);
    const toolB = bridgeCapabilityToolToMastra(ACTIVATION, makeProposalCapability(), deps);
    const outputA = (toolA as { inputSchema: { '~standard': { jsonSchema: { output: () => unknown } } } })
      .inputSchema['~standard'].jsonSchema.output();
    const outputB = (toolB as { inputSchema: { '~standard': { jsonSchema: { output: () => unknown } } } })
      .inputSchema['~standard'].jsonSchema.output();
    expect(JSON.stringify(outputA)).toBe(JSON.stringify(outputB));
    expect(JSON.stringify(providerFacingInputSchema(toolA))).toBe(
      JSON.stringify(providerFacingInputSchema(toolB)),
    );
  });
});

// ---- Fail-closed construction ----------------------------------------------

describe('B-1: invalid presentation metadata fails closed at tool construction', () => {
  it('a model-facing capability without a usable descriptive input schema REFUSES construction', async () => {
    const { deps } = await makeFixture(makeProposalCapability());
    const undescribed = makeProposalCapability({
      input: defineContract<unknown>({
        id: 'cap.proposal.input',
        revision: '1',
        expected: 'no presentation declared',
        parse: (input) => ({ ok: true as const, value: input }),
      }),
    });
    expect(() => bridgeCapabilityToolToMastra(ACTIVATION, undescribed, deps)).toThrowError(
      VictPresentationError,
    );
    try {
      bridgeCapabilityToolToMastra(ACTIVATION, undescribed, deps);
    } catch (error) {
      expect((error as VictPresentationError).code).toBe(
        'VICT_PRESENTATION_INPUT_SCHEMA_REQUIRED',
      );
    }
    // The same refusal applies when NO input contract is declared at all.
    const noContract = makeProposalCapability({ input: undefined });
    expect(() => bridgeCapabilityToolToMastra(ACTIVATION, noContract, deps)).toThrowError(
      VictPresentationError,
    );
  });

  it('hostile presentation shapes are rejected unread (getters, functions, cycles, prototypes, prototype keys, overbound)', () => {
    const label = 'probe';
    // Accessor field.
    expect(() =>
      capturePresentationSchema(
        Object.defineProperties(
          {},
          {
            type: { value: 'object', enumerable: true },
            sneaky: { get() {
              return 'payload';
            }, enumerable: true },
          },
        ),
        label,
      ),
    ).toThrowError(VictPresentationError);
    // Function value.
    expect(() => capturePresentationSchema({ type: 'object', fn: () => 1 }, label)).toThrowError(
      VictPresentationError,
    );
    // Cycle.
    const cyclic: Record<string, unknown> = { type: 'object' };
    cyclic['self'] = cyclic;
    expect(() => capturePresentationSchema(cyclic, label)).toThrowError(VictPresentationError);
    // Exotic prototype (class instance).
    class Hostile {
      readonly field = 'value';
    }
    expect(() => capturePresentationSchema(new Hostile(), label)).toThrowError(
      VictPresentationError,
    );
    // Prototype-named key.
    expect(() =>
      capturePresentationSchema(JSON.parse('{"__proto__": {"injected": true}}'), label),
    ).toThrowError(VictPresentationError);
    // Hostile key outside the bounded vocabulary.
    expect(() => capturePresentationSchema({ 'bad key!': true }, label)).toThrowError(
      VictPresentationError,
    );
    // Overbound string.
    expect(() =>
      capturePresentationSchema({ text: 'x'.repeat(PRESENTATION_BOUNDS.maxStringLength + 1) }, label),
    ).toThrowError(VictPresentationError);
    // Overbound depth.
    let deep: unknown = 'leaf';
    for (let i = 0; i <= PRESENTATION_BOUNDS.maxDepth + 1; i += 1) {
      deep = { wrapper: deep };
    }
    expect(() => capturePresentationSchema(deep, label)).toThrowError(VictPresentationError);
    // Symbol-keyed data is invisible to the capture (own enumerable string
    // keys only) and a bare symbol fails closed.
    expect(() => capturePresentationSchema(Symbol('x'), label)).toThrowError(
      VictPresentationError,
    );
    // Non-object schema root.
    expect(() => capturePresentationSchema('type: object', label)).toThrowError(
      VictPresentationError,
    );
    // Invalid description.
    expect(() => captureCapabilityDescription(42)).toThrowError(VictPresentationError);
    expect(() => captureCapabilityDescription('x'.repeat(PRESENTATION_BOUNDS.maxDescriptionChars + 1)))
      .toThrowError(VictPresentationError);
  });

  it('descriptive-schema mutation after construction cannot alter the built tool', async () => {
    const { deps } = await makeFixture(makeProposalCapability());
    // A HAND-BUILT (not defineCapability-captured) definition whose schema
    // payload is deliberately mutable.
    const mutableSchema: Record<string, unknown> = JSON.parse(JSON.stringify(PROPOSAL_INPUT_SCHEMA));
    (mutableSchema as { properties: Record<string, unknown> }).properties['injected'] = {
      type: 'string',
    };
    const mutableInput = defineContract<unknown>({
      id: 'cap.proposal.input',
      revision: '1',
      expected: 'mutable presentation',
      descriptiveJsonSchema: mutableSchema,
      parse: proposalInputContract.parse,
    });
    const definition = makeProposalCapability({ input: mutableInput });
    const tool = bridgeCapabilityToolToMastra(ACTIVATION, definition, deps);
    // The built tool presents the captured snapshot WITH the injected field
    // (it was present at build time)...
    const before = providerFacingInputSchema(tool) as Record<string, unknown>;
    expect('injected' in (before['properties'] as Record<string, unknown>)).toBe(true);
    // ...but MUTATING the author object afterwards changes nothing.
    delete (mutableSchema as { properties: Record<string, unknown> }).properties['injected'];
    (mutableSchema as Record<string, unknown>)['type'] = 'string';
    const after = providerFacingInputSchema(tool) as Record<string, unknown>;
    expect(after).toEqual(before);
    expect('injected' in (after['properties'] as Record<string, unknown>)).toBe(true);
    expect(after['type']).toBe('object');
  });
});

// ---- Authority separation + adversarial argument controls ------------------

describe('B-1: the presentation can never bypass the authoritative contract', () => {
  it('valid claim, commitment, and open_loop arguments each cross the real bridge', async () => {
    const { deps, effectCount } = await makeFixture(makeProposalCapability());
    const tool = bridgeCapabilityToolToMastra(ACTIVATION, makeProposalCapability(), deps);
    for (const args of [
      {
        proposalKind: 'claim',
        content: {
          subject: 'Explanation preference',
          epistemicType: 'E5',
          honestyState: 'likely',
          confidence: 'qualified',
          statement: 'Plain language first.',
        },
      },
      {
        proposalKind: 'commitment',
        content: { commitmentKey: 'career-base', statement: 'Not leaving without a pathway.' },
      },
      {
        proposalKind: 'open_loop',
        content: { subject: 'Transition', loopKind: 'undecided_question', detail: 'Fast or gradual?' },
      },
    ]) {
      const outcome = (await executeTool(tool, args)) as { accepted?: boolean };
      expect(outcome.accepted).toBe(true);
    }
    expect(effectCount()).toBe(3);
  });

  it('empty, single-field, wrong-kind, wrong-content, unknown-field, and prototype-key arguments are rejected with ZERO effect', async () => {
    const { deps, effectCount } = await makeFixture(makeProposalCapability());
    const tool = bridgeCapabilityToolToMastra(ACTIVATION, makeProposalCapability(), deps);
    const hostileArgs: unknown[] = [
      // empty arguments
      {},
      // single-field arguments
      { proposalKind: 'claim' },
      { content: {} },
      // wrong kind
      { proposalKind: 'correction', content: { statement: 'x' } },
      // wrong content shape for the kind
      {
        proposalKind: 'commitment',
        content: { subject: 'x', epistemicType: 'E5', honestyState: 'likely', confidence: 'stated', statement: 'x' },
      },
      // unknown field
      {
        proposalKind: 'claim',
        content: {
          subject: 's',
          epistemicType: 'E5',
          honestyState: 'likely',
          confidence: 'stated',
          statement: 'x',
          extra: 'injected',
        },
      },
      // prototype-named key
      JSON.parse('{"proposalKind": "claim", "__proto__": {"injected": true}, "content": {"subject":"s","epistemicType":"E5","honestyState":"likely","confidence":"stated","statement":"x"}}'),
      // non-object
      'draft a proposal',
    ];
    for (const args of hostileArgs) {
      const outcome = (await executeTool(tool, args)) as Record<string, unknown>;
      // Every hostile shape is REJECTED by the authoritative contract
      // before any capability invocation — either at Mastra's pre-execute
      // standard-schema validation (which delegates to `contract.parse`;
      // the Execution-3 mechanism: `vict-contract-rejected`) or at the
      // bridge's own governed parse. Never a fabricated success.
      const rejectedAtValidation = outcome['error'] === true;
      const rejectedAtBridge =
        outcome['victCapabilityFailure'] === 'VICT_CAPABILITY_INPUT_CONTRACT_REJECTED';
      expect(rejectedAtValidation || rejectedAtBridge).toBe(true);
      if (rejectedAtValidation) {
        expect(String(outcome['message'])).toContain('vict-contract-rejected');
      }
    }
    // ZERO durable effects: the presentation never authorized anything.
    expect(effectCount()).toBe(0);
  });

  it('a hostile/inaccurate descriptive schema changes guidance only, never validation', async () => {
    // The presentation claims the input is a bare string; the contract
    // still demands the closed proposal object.
    const lyingInput = defineContract<unknown>({
      id: 'cap.proposal.input',
      revision: '1',
      expected: 'lying presentation',
      descriptiveJsonSchema: { type: 'string', description: 'send any string' },
      parse: proposalInputContract.parse,
    });
    const { deps, effectCount } = await makeFixture(makeProposalCapability({ input: lyingInput }));
    const tool = bridgeCapabilityToolToMastra(ACTIVATION, makeProposalCapability({ input: lyingInput }), deps);
    // The tool DOES present the lying schema (presentation is inert)...
    expect(providerFacingInputSchema(tool)).toEqual({
      type: 'string',
      description: 'send any string',
    });
    // ...but the hostile arguments STILL fail the authoritative parse and
    // the well-formed arguments STILL succeed — unchanged by the schema.
    const rejected = (await executeTool(tool, 'a string as the lying schema suggests')) as Record<string, unknown>;
    expect(
      rejected['error'] === true ||
        rejected['victCapabilityFailure'] === 'VICT_CAPABILITY_INPUT_CONTRACT_REJECTED',
    ).toBe(true);
    const accepted = (await executeTool(tool, {
      proposalKind: 'commitment',
      content: { commitmentKey: 'k', statement: 's' },
    })) as { accepted?: boolean };
    expect(accepted.accepted).toBe(true);
    expect(effectCount()).toBe(1);
  });
});
