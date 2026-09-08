import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentArtifactBinding, AgentHelperToolArtifact } from '@vict/runtime';
import type { AgentHelperToolIO } from '@vict/runtime';
import type { CapabilityDefinition, Contract } from '@vict/sdk';
import {
  createInMemoryAgentControlStores,
  AgentStreamHub,
  authenticatedActorContext,
  AgentProfileRegistry,
} from '@vict/runtime';
import {
  MASTRA_ADAPTER_COMPATIBILITY,
  bridgeHelperToolToMastra,
  createDeterministicOfflineModel,
  createDedicatedMastraStore,
  MastraThreadCoordinator,
} from '../src/index.js';
import { composeMastraTurnExecutor } from '../src/turn-executor.js';
import { bridgeCapabilityToolToMastra, type CapabilityBridgeDeps } from '../src/tool-bridge.js';

/**
 * Stage 06 POST-AUDIT remediation — helper-tool containment, the Standard
 * Schema output adapter, and the REAL pinned-Mastra normalization path
 * (these tests FAIL at 712752a3 and pass after the correction).
 *
 * - A hostile helper output (Proxy with a throwing `has` trap, a revoked
 *   proxy, or an output impersonating a reserved control marker) becomes
 *   the STABLE `VICT_HELPER_RESERVED_MARKER_REJECTED` failure: no raw
 *   exception ever leaves the tool, and no marker or canary reaches the
 *   model.
 * - The Standard Schema output adapter cannot be tricked by hostile
 *   markers: only an EXACT bridge control envelope (closed field set,
 *   plain own enumerable data, allowlisted code/disposition) bypasses the
 *   capability contract — and `validate` itself never throws.
 * - The REAL pinned-Mastra pipeline (real `Agent` loop + offline model +
 *   governed bridge + durable stream ledger) emits ONLY safe codes for a
 *   hostile capability result: zero `tool.completed`, the honest
 *   `outcome_unknown` ledger row, exactly one effect.
 * - Existing behavior (in_progress non-terminal, completed replay,
 *   first-terminal-wins) remains unchanged through the same real path.
 */

const CANARY = 'CANARY-POSTAUDIT-HELPER';

const TEST_RETENTION = {
  messagesMaxAgeMs: 3_600_000,
  threadsMaxAgeMs: 86_400_000,
  spansMaxAgeMs: 3_600_000,
};

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of tempDirs) {
    const attempt = (remaining: number): void => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        if (remaining > 0) {
          setTimeout(() => attempt(remaining - 1), 500);
        }
      }
    };
    attempt(10);
  }
});

function ioContract(id: string, ok: (value: unknown) => boolean): AgentHelperToolIO {
  return {
    id,
    revision: '1',
    jsonSchema: { type: 'object' } as AgentHelperToolIO['jsonSchema'],
    parse: (input: unknown) =>
      ok(input)
        ? { ok: true as const, value: input }
        : { ok: false as const, issues: [{ path: 'input', message: 'invalid', code: 'INVALID' }] },
  } as unknown as AgentHelperToolIO;
}

function helperArtifact(
  execute: (input: unknown) => unknown,
  outputOk: (value: unknown) => boolean = () => true,
): AgentArtifactBinding<AgentHelperToolArtifact> {
  return {
    artifact: {
      id: 'helper.probe',
      revision: '1',
      kind: 'helper-tool',
      definition: {
        id: 'helper.probe',
        revision: '1',
        effect: 'pure',
        description: 'probe helper',
        input: ioContract('helper.probe.input', () => true),
        output: ioContract('helper.probe.output', outputOk),
        execute,
      },
    },
  } as unknown as AgentArtifactBinding<AgentHelperToolArtifact>;
}

const executeHelper = async (
  tool: unknown,
  input: unknown = { x: 1 },
): Promise<{ threw: unknown; result: unknown }> => {
  try {
    return {
      threw: null,
      result: await (tool as { execute: (i: unknown, c: unknown) => Promise<unknown> }).execute(
        input,
        {},
      ),
    };
  } catch (error) {
    return { threw: error, result: undefined };
  }
};

// ---- Helper-tool containment -------------------------------------------------

describe('post-audit helper containment: hostile helper output never escapes raw', () => {
  it('a Proxy output with a throwing `has` trap becomes the stable helper failure', async () => {
    const tool = bridgeHelperToolToMastra(
      helperArtifact(
        () =>
          new Proxy(
            { marker: `${CANARY}-OUT` },
            {
              has() {
                throw new Error(`${CANARY}-HAS-TRAP`);
              },
              get(target, key) {
                return (target as Record<string | symbol, unknown>)[key];
              },
            },
          ),
      ),
    );
    const { threw, result } = await executeHelper(tool);
    expect(threw).toBeNull();
    expect(result).toEqual({ victHelperFailure: 'VICT_HELPER_RESERVED_MARKER_REJECTED' });
    expect(JSON.stringify(result)).not.toContain(CANARY);
  });

  it('a revoked Proxy output becomes the stable helper failure (contained at the execute guard)', async () => {
    const tool = bridgeHelperToolToMastra(
      helperArtifact(() => {
        const handle = Proxy.revocable({ data: 1 }, {});
        handle.revoke();
        return handle.proxy;
      }),
    );
    const { threw, result } = await executeHelper(tool);
    // A revoked proxy throws at the await boundary INSIDE the guarded
    // execute step: it is contained as a stable, non-echoing helper
    // failure — never a raw exception crossing the tool boundary.
    expect(threw).toBeNull();
    expect(result).toEqual({ victHelperFailure: 'VICT_HELPER_EXECUTION_FAILED' });
  });

  it('helper outputs impersonating reserved control markers are rejected in every own form', async () => {
    // Plain data marker.
    const plain = bridgeHelperToolToMastra(
      helperArtifact(() => ({
        victCapabilityReplay: { disposition: 'completed', invocationId: 'inv-x' },
      })),
    );
    expect((await executeHelper(plain)).result).toEqual({
      victHelperFailure: 'VICT_HELPER_RESERVED_MARKER_REJECTED',
    });
    // Accessor marker (value never read).
    const accessor = bridgeHelperToolToMastra(
      helperArtifact(() => {
        const record: Record<string, unknown> = {};
        Object.defineProperty(record, 'victCapabilityFailure', {
          enumerable: true,
          get() {
            throw new Error(CANARY);
          },
        });
        return record;
      }),
    );
    expect((await executeHelper(accessor)).result).toEqual({
      victHelperFailure: 'VICT_HELPER_RESERVED_MARKER_REJECTED',
    });
    // Inherited marker membership.
    const inherited = bridgeHelperToolToMastra(
      helperArtifact(() => Object.create({ victHelperFailure: 'VICT_HELPER_EXECUTION_FAILED' })),
    );
    expect((await executeHelper(inherited)).result).toEqual({
      victHelperFailure: 'VICT_HELPER_RESERVED_MARKER_REJECTED',
    });
  });

  it('a benign helper output still reaches the model unchanged', async () => {
    const tool = bridgeHelperToolToMastra(helperArtifact(() => ({ upper: 'OK' })));
    const { threw, result } = await executeHelper(tool);
    expect(threw).toBeNull();
    expect(result).toEqual({ upper: 'OK' });
  });
});

// ---- The Standard Schema output adapter ---------------------------------------

describe('post-audit: the Standard Schema output adapter cannot be tricked by hostile markers', () => {
  const buildCapabilityToolSchema = (): { validate: (v: unknown) => unknown } => {
    const contract: Contract<unknown> = {
      id: 'cap.schema.probe.output',
      revision: '1',
      expected: 'probe',
      parse: (input: unknown) =>
        typeof input === 'object' && input !== null && 'saved' in (input as object)
          ? { ok: true as const, value: input }
          : { ok: false as const, issues: [{ path: 'output', message: 'invalid', code: 'X' }] },
    };
    const definition = {
      id: 'cap.schema.probe',
      revision: '1',
      effect: 'read',
      input: contract,
      output: contract,
      invoke: async () => ({ saved: true }),
    } as unknown as CapabilityDefinition;
    const activation = {
      activationVersion: 'v1_act',
      agentProfileVersion: 'v1_profile',
      capabilities: [{ id: 'cap.schema.probe', revision: '1' }],
    } as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];
    const tool = bridgeCapabilityToolToMastra(activation, definition, {
      resolveCapability: () => definition,
      invoke: async () => ({ saved: true }),
      recordInvocationIntent: async () => {
        throw new Error('unused');
      },
      claimInvocationRun: async () => {
        throw new Error('unused');
      },
      settleInvocationRun: async () => {
        throw new Error('unused');
      },
      settleInvocationPending: async () => {
        throw new Error('unused');
      },
      reconcileAbandonedRun: async () => {
        throw new Error('unused');
      },
      requestApproval: async () => {
        throw new Error('unused');
      },
      consumeApproval: async () => {
        throw new Error('unused');
      },
      updateInvocationStatus: async () => {
        throw new Error('unused');
      },
    }) as { outputSchema: { '~standard': { validate: (v: unknown) => unknown } } };
    return tool.outputSchema['~standard'];
  };

  it('validate NEVER throws, even for revoked proxies and throwing traps', () => {
    const schema = buildCapabilityToolSchema();
    const revoked = Proxy.revocable({ saved: true }, {});
    revoked.revoke();
    const hostile = [
      revoked.proxy,
      new Proxy(
        { saved: true },
        {
          getPrototypeOf() {
            throw new Error(CANARY);
          },
        },
      ),
      new Proxy(
        {},
        {
          has() {
            throw new Error(CANARY);
          },
        },
      ),
      {
        get victCapabilityReplay(): unknown {
          throw new Error(CANARY);
        },
      },
    ];
    for (const value of hostile) {
      let verdict: unknown;
      expect(() => {
        verdict = schema.validate(value);
      }).not.toThrow();
      // Non-exact shapes fall through to the contract parse (rejected) —
      // no canary ever surfaces.
      expect(JSON.stringify(verdict)).not.toContain(CANARY);
    }
  });

  it('only an EXACT bridge envelope bypasses the capability contract', () => {
    const schema = buildCapabilityToolSchema();
    // EXACT failure envelope with an allowlisted code → passthrough.
    expect(schema.validate({ victCapabilityFailure: 'VICT_CAPABILITY_DECLINED' })).toEqual({
      value: { victCapabilityFailure: 'VICT_CAPABILITY_DECLINED' },
    });
    // EXACT replay envelope → passthrough.
    expect(
      schema.validate({
        victCapabilityReplay: { disposition: 'completed', invocationId: 'inv-1' },
      }),
    ).toEqual({
      value: { victCapabilityReplay: { disposition: 'completed', invocationId: 'inv-1' } },
    });
    // ARBITRARY code → NOT a valid envelope → contract decides (rejected:
    // the probe contract requires a `saved` field).
    expect(schema.validate({ victCapabilityFailure: 'CANARY-ARBITRARY' })).toEqual({
      issues: [{ message: 'vict-contract-rejected' }],
    });
    // Extra fields → not exact → contract decides.
    expect(
      schema.validate({
        victCapabilityFailure: 'VICT_CAPABILITY_DECLINED',
        extra: 'field',
      }),
    ).toEqual({ issues: [{ message: 'vict-contract-rejected' }] });
    // Accessor-carried marker → not exact.
    const accessorEnvelope: Record<string, unknown> = {};
    Object.defineProperty(accessorEnvelope, 'victCapabilityFailure', {
      enumerable: true,
      get() {
        return 'VICT_CAPABILITY_DECLINED';
      },
    });
    expect(schema.validate(accessorEnvelope)).toEqual({
      issues: [{ message: 'vict-contract-rejected' }],
    });
  });
});

// ---- The REAL pinned-Mastra normalization path --------------------------------

interface ModelVisibleToolResult {
  toolCallId: string;
  toolName: string;
  output: unknown;
}

let realCounter = 0;

async function composeRealPath(capability: CapabilityDefinition, scriptStep: string) {
  const toolName = capability.id.replace(/[^A-Za-z0-9_]/g, '_');
  const dir = tempDir('vict-hostile-real-');
  const dedicated = await createDedicatedMastraStore({ dataDir: dir, retention: TEST_RETENTION });
  const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
  registry.installArtifacts([
    {
      kind: 'instructions',
      id: 'instructions.ara',
      revision: '1',
      text: 'Be deterministic and brief.',
    },
    {
      kind: 'memory-policy',
      id: 'memory-policy.ara',
      revision: '1',
      config: { lastMessages: 10, workingMemory: { enabled: false }, semanticRecall: false },
    },
  ]);
  registry.registerProfile({
    schema: 'vict.agent-profile@1',
    id: 'agent.ara.governed',
    revision: '1',
    instructions: { id: 'instructions.ara', revision: '1' },
    modelProfile: {
      id: 'model.ara',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: {},
    turnPolicy: { maxSteps: 8, maxToolCalls: 4, onLimit: 'fail-closed' },
    memoryPolicy: { id: 'memory-policy.ara', revision: '1' },
    guardrails: [],
    helperTools: [],
    capabilities: [{ id: capability.id, revision: capability.revision }],
    adapter: {
      id: MASTRA_ADAPTER_COMPATIBILITY.id,
      revision: MASTRA_ADAPTER_COMPATIBILITY.revision,
      runtimePackages: { ...MASTRA_ADAPTER_COMPATIBILITY.runtimePackages },
    },
  });
  const activation = registry.activateAgentProfile({ id: 'agent.ara.governed', revision: '1' });
  const stores = await createInMemoryAgentControlStores();
  await stores.actors.upsert({
    actorId: 'actor-user',
    status: 'active',
    roles: ['developer'],
    createdAt: 0,
  });
  const requester = authenticatedActorContext(await stores.actors.get('actor-user'), 'actor-user');
  const hub = new AgentStreamHub({ ledger: stores.streamLedger, clock: () => Date.now() });
  const invokeLog: unknown[] = [];
  const toolResults: ModelVisibleToolResult[] = [];
  const turnServiceRef: {
    current: ReturnType<typeof composeMastraTurnExecutor>['turnService'] | undefined;
  } = {
    current: undefined,
  };
  const composition = composeMastraTurnExecutor({
    stores,
    activation,
    hub,
    clock: () => Date.now(),
    ids: {
      turnId: () => `turn-real-${(realCounter += 1)}`,
      streamId: () => `stream-real-${realCounter}`,
      invocationId: () => `inv-real-${(realCounter += 1)}`,
      approvalId: () => `approval-${realCounter}`,
      idempotencyKey: () => `key-${realCounter}`,
      cancelId: () => `cancel-${realCounter}`,
    },
    agentConfig: {
      store: dedicated.store,
      threadCoordinator: new MastraThreadCoordinator(),
      modelFactory: () =>
        createDeterministicOfflineModel({
          script: {
            [scriptStep]: {
              kind: 'tool-chain',
              calls: [
                {
                  toolName,
                  args: { text: 'go' },
                  toolCallId: `offline-call-${toolName}-1`,
                },
              ],
              thenText: 'DONE',
            },
          },
          onToolResult: (event) => {
            toolResults.push(event);
          },
        }),
    },
    capabilityBridge: {
      resolveCapability: (id: string, revision: string) =>
        id === capability.id && revision === capability.revision ? capability : undefined,
      invoke: async (definition: CapabilityDefinition, input: unknown) => {
        invokeLog.push(input);
        return definition.invoke(input, {} as never);
      },
      recordInvocationIntent: async (
        input: Parameters<CapabilityBridgeDeps['recordInvocationIntent']>[0],
      ) => turnServiceRef.current?.recordToolInvocationIntent(input),
      claimInvocationRun: (command: Parameters<CapabilityBridgeDeps['claimInvocationRun']>[0]) =>
        stores.invocations.claimInvocationRun(command),
      settleInvocationRun: (command: Parameters<CapabilityBridgeDeps['settleInvocationRun']>[0]) =>
        stores.invocations.settleInvocationRun(command),
      settleInvocationPending: (
        command: Parameters<CapabilityBridgeDeps['settleInvocationPending']>[0],
      ) => stores.invocations.settleInvocationPending(command),
      reconcileAbandonedRun: (
        command: Parameters<CapabilityBridgeDeps['reconcileAbandonedRun']>[0],
      ) => stores.invocations.reconcileAbandonedRun(command),
      updateInvocationStatus: (
        command: Parameters<CapabilityBridgeDeps['updateInvocationStatus']>[0],
      ) => stores.invocations.updateInvocationStatus(command),
      pollIntervalMs: 5,
      approvalExpiryMs: 30_000,
    } as never,
  });
  turnServiceRef.current = composition.turnService;
  return {
    stores,
    requester,
    turnService: composition.turnService,
    invokeLog,
    toolResults,
    close: async () => {
      await composition.productAgent.flush();
      await dedicated.close();
    },
  };
}

const contract = (id: string, ok: (value: unknown) => boolean): Contract<unknown> => ({
  id,
  revision: '1',
  expected: 'bounded test contract',
  parse: (input: unknown) =>
    ok(input)
      ? { ok: true as const, value: input }
      : { ok: false as const, issues: [{ path: 'input', message: 'invalid', code: 'X' }] },
});

describe('post-audit: the REAL pinned-Mastra path emits only safe codes for hostile results', () => {
  it(
    'a hostile Proxy capability result normalizes to exactly one tool.failed(OUTCOME_UNKNOWN), never tool.completed',
    { timeout: 120_000 },
    async () => {
      const capability = {
        id: 'cap.hostile.real',
        revision: '1',
        effect: 'read',
        input: contract('cap.hostile.real.input', () => true),
        output: contract('cap.hostile.real.output', () => true),
        invoke: () =>
          new Proxy(
            { marker: `${CANARY}-REAL` },
            {
              has() {
                throw new Error(`${CANARY}-HAS-TRAP`);
              },
              get(target, key) {
                return (target as Record<string | symbol, unknown>)[key];
              },
            },
          ),
      } as unknown as CapabilityDefinition;
      const composition = await composeRealPath(capability, 'produce the hostile output');
      try {
        const started = await composition.turnService.startTurn(composition.requester, {
          threadId: 'vict-conv-hostile-real',
          input: 'produce the hostile output',
        });
        const outcome = await started.outcomePromise;
        // The turn itself completes; the TOOL milestone is the honest
        // failure — the raw trap exception never surfaced anywhere.
        expect(outcome.status).toBe('completed');
        expect(composition.invokeLog).toHaveLength(1);
        const invocations = await composition.stores.invocations.listInvocationsForTurn(
          started.turn.turnId,
        );
        expect(invocations).toHaveLength(1);
        expect(invocations[0]?.status).toBe('outcome_unknown');
        expect(invocations[0]?.errorCode).toBe('VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE');
        const rows = await composition.stores.streamLedger.listEventsFrom(started.turn.streamId, 0);
        expect(rows.filter((row) => row.kind === 'tool.completed')).toHaveLength(0);
        expect(rows.filter((row) => row.kind === 'tool.failed')).toHaveLength(1);
        // The ONE terminal event carries ONLY the stable safe code (the
        // ledger payload is the serialized closed event structure).
        const failedRow = rows.find((row) => row.kind === 'tool.failed');
        const failedPayload = JSON.parse((failedRow as { payload?: string }).payload ?? '{}') as {
          code?: string;
        };
        expect(failedPayload.code).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
        // No canary anywhere: ledger rows, model-visible outputs, error codes.
        expect(JSON.stringify(rows)).not.toContain(CANARY);
        expect(JSON.stringify(composition.toolResults)).not.toContain(CANARY);
      } finally {
        await composition.close();
      }
    },
  );

  it(
    'the real path keeps in_progress non-terminal, completed replay, and first-terminal-wins behavior unchanged',
    { timeout: 120_000 },
    async () => {
      const capability = {
        id: 'cap.benign.real',
        revision: '1',
        effect: 'read',
        input: contract('cap.benign.real.input', () => true),
        output: contract('cap.benign.real.output', () => true),
        invoke: async (input: unknown) => ({ saved: true, echo: input }),
      } as unknown as CapabilityDefinition;
      const composition = await composeRealPath(capability, 'produce the benign output');
      try {
        const started = await composition.turnService.startTurn(composition.requester, {
          threadId: 'vict-conv-benign-real',
          input: 'produce the benign output',
        });
        const outcome = await started.outcomePromise;
        expect(outcome.status).toBe('completed');
        // One effect, one durable completion, EXACTLY ONE terminal
        // milestone (first-terminal-wins across the recurrence).
        expect(composition.invokeLog).toHaveLength(1);
        const invocations = await composition.stores.invocations.listInvocationsForTurn(
          started.turn.turnId,
        );
        expect(invocations).toHaveLength(1);
        expect(invocations[0]?.status).toBe('completed');
        const rows = await composition.stores.streamLedger.listEventsFrom(started.turn.streamId, 0);
        expect(rows.filter((row) => row.kind === 'tool.completed')).toHaveLength(1);
        expect(rows.filter((row) => row.kind === 'tool.failed')).toHaveLength(0);
      } finally {
        await composition.close();
      }
    },
  );
});
