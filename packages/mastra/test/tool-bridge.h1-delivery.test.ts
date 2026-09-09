import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CapabilityDefinition, Contract } from '@victframework/sdk';
import {
  authenticatedActorContext,
  createInMemoryAgentControlStores,
  AgentProfileRegistry,
  AgentStreamHub,
  type AgentControlStores,
} from '@victframework/runtime';
import { createSqliteAgentControlStores } from '@victframework/store-sqlite';
import { AgentTurnService } from '@victframework/control';
import {
  MASTRA_ADAPTER_COMPATIBILITY,
  composeMastraTurnExecutor,
  createDeterministicOfflineModel,
  createDedicatedMastraStore,
  MastraThreadCoordinator,
  normalizeCapabilityToolResultEvent,
  runWithBridgeTurnScope,
  bridgeCapabilityToolToMastra,
  type CapabilityBridgeDeps,
} from '../src/index.js';

/**
 * Stage 06 H-1 permanent regression tests — durable completion before safe
 * Mastra result delivery.
 *
 * H-1 (High, post-audit independent closure re-audit): a contract-valid
 * capability output containing a delivery-hostile nested value was settled
 * durably `completed` and THEN delivered by reference — downstream Mastra
 * serialization threw and the occurrence normalized as
 * `tool.failed(VICT_TOOL_FAILED)` with ZERO `tool.completed` while the
 * durable record stayed `completed`. For an approved write capability this
 * made an effectful result contradictory (durable success, model-visible
 * failure).
 *
 * Corrected contract, pinned here FOREVER:
 * - the nested hostile Proxy executes the capability EXACTLY once;
 * - the durable status is `outcome_unknown` (VICT_CAPABILITY_UNSAFE_OUTPUT_
 *   STRUCTURE), NEVER `completed`;
 * - the returned result is the stable safe failure envelope;
 * - zero `tool.completed`; exactly one safe `tool.failed` mapping;
 * - a retry performs NO second effect;
 * - the canary is absent from events, durable rows, and raw DB/WAL/SHM
 *   bytes;
 * - over the REAL pinned Mastra path (real Agent loop + deterministic
 *   offline model): safe nested results → durable `completed` + exactly one
 *   `tool.completed`; hostile nested results → durable outcome_unknown +
 *   exactly one safe `tool.failed`; no post-completion tool error; no raw
 *   provider/framework chunk exposed.
 *
 * Proven over IN-MEMORY and SQLITE control stores, for a READ capability
 * AND an approved WRITE capability.
 */

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
afterAll(() => {
  // Windows file-lock races on teardown must not fail the suite; the temp
  // directories are disposable, so removal retries in the background.
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

const SCOPE = {
  turnId: 'turn-h1-delivery',
  streamId: 'stream-h1-delivery',
  actorId: 'actor-h1',
  agentProfileVersion: 'v1_profile',
} as const;

function permissiveContract(id: string): Contract<unknown> {
  return {
    id,
    revision: '1',
    expected: 'bounded test contract',
    parse: (input: unknown): ReturnType<Contract<unknown>['parse']> => ({
      ok: true,
      value: input,
    }),
  };
}

/**
 * The H-1 hostile nested value: a Proxy whose reflection/property traps
 * each throw a UNIQUE canary. The bridge's delivery capture must reject it
 * BEFORE durable completion without ever reading a value through it.
 */
function hostileNestedProxy(): unknown {
  const target = { marker: `${CANARY}-TARGET` };
  return new Proxy(target, {
    get() {
      throw new Error(`${CANARY}-GET-TRAP`);
    },
    has() {
      throw new Error(`${CANARY}-HAS-TRAP`);
    },
    getOwnPropertyDescriptor() {
      throw new Error(`${CANARY}-DESCRIPTOR-TRAP`);
    },
    ownKeys() {
      throw new Error(`${CANARY}-OWNKEYS-TRAP`);
    },
    getPrototypeOf() {
      throw new Error(`${CANARY}-PROTO-TRAP`);
    },
  });
}

const CANARY = `CANARY-H1-${Math.random().toString(36).slice(2, 8)}`;

// ---- Bridge-level H-1 scenarios (read + approved write; memory + SQLite) ----

interface H1Fixture {
  stores: AgentControlStores;
  effectCount: () => number;
  execute: () => Promise<unknown>;
  executeRetry: () => Promise<unknown>;
  turnId: string;
  close: () => void;
}

async function makeH1Fixture(
  effect: 'read' | 'write',
  stores: AgentControlStores,
  outputProvider: () => unknown,
  dir: string | undefined,
): Promise<H1Fixture> {
  const clockValue = { v: 9000 };
  const clock = (): number => (clockValue.v += 1);
  const counters = { effects: 0, ids: 0 };
  const capabilityId = effect === 'read' ? 'cap.h1.read' : 'cap.h1.write';
  const capability = {
    id: capabilityId,
    revision: '1',
    effect,
    input: permissiveContract(`${capabilityId}.input`),
    output: permissiveContract(`${capabilityId}.output`),
    invoke: async () => {
      counters.effects += 1;
      return outputProvider();
    },
  } as unknown as CapabilityDefinition;
  await stores.actors.upsert({
    actorId: 'actor-h1',
    status: 'active',
    roles: ['developer', 'approver'],
    createdAt: 0,
  });
  await stores.actors.upsert({
    actorId: 'actor-h1-approver',
    status: 'active',
    roles: ['approver'],
    createdAt: 0,
  });
  const turnService = new AgentTurnService({
    stores,
    clock,
    ids: {
      turnId: (): string => `${SCOPE.turnId}-${(counters.ids += 1)}`,
      streamId: (): string => `stream-h1-${counters.ids}`,
      invocationId: (): string => `inv-h1-${counters.ids}`,
      approvalId: (): string => `approval-h1-${counters.ids}`,
      idempotencyKey: (): string => `key-h1-${counters.ids}`,
      cancelId: (): string => `cancel-h1-${counters.ids}`,
    },
  });
  const deps: CapabilityBridgeDeps = {
    resolveCapability: (id, revision): CapabilityDefinition | undefined =>
      id === capability.id && revision === capability.revision ? capability : undefined,
    invoke: async (resolved, input) => resolved.invoke(input, {} as never),
    recordInvocationIntent: (input) => turnService.recordToolInvocationIntent(input),
    claimInvocationRun: (command) => stores.invocations.claimInvocationRun(command),
    settleInvocationRun: (command) => stores.invocations.settleInvocationRun(command),
    settleInvocationPending: (command) => stores.invocations.settleInvocationPending(command),
    reconcileAbandonedRun: (command) => stores.invocations.reconcileAbandonedRun(command),
    requestApproval: (input) => turnService.requestApproval(input),
    consumeApproval: (binding) => turnService.consumeApproval(binding),
    updateInvocationStatus: (command) => stores.invocations.updateInvocationStatus(command),
    findExistingApproval: async (invocationId) => {
      const approvals = await stores.approvals.listApprovalsForInvocation(invocationId);
      return approvals.at(0)?.approvalId;
    },
    pollApprovalDecision: async (approvalId) => {
      const record = await stores.approvals.getApproval(approvalId);
      return record === undefined ? undefined : { status: record.status };
    },
    clock,
    pollIntervalMs: 5,
    approvalExpiryMs: 30_000,
  };
  const activation = {
    activationVersion: 'v1_act',
    agentProfileVersion: 'v1_profile',
    capabilities: [{ id: capabilityId, revision: '1' }],
  } as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];
  const tool = bridgeCapabilityToolToMastra(activation, capability, deps) as {
    execute: (i: unknown, c: unknown) => Promise<unknown>;
  };
  const turnId = `${SCOPE.turnId}-${(counters.ids += 1)}`;
  await stores.turns.createTurnIntent({
    turnId,
    streamId: `stream-${turnId}`,
    threadId: 'thread-h1',
    actorId: 'actor-h1',
    agentProfileVersion: 'v1_profile',
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
  await stores.turns.startTurn(turnId, 2);
  const exec = (): Promise<unknown> =>
    runWithBridgeTurnScope(
      { ...SCOPE, turnId, streamId: `stream-${turnId}`, threadId: 'thread-h1' },
      () => tool.execute({ k: 'v' }, { toolCallId: `call-${turnId}` }),
    );
  return {
    stores,
    effectCount: () => counters.effects,
    execute: async () => {
      if (effect === 'write') {
        // Approved write capability: approve the pending decision while the
        // tool call waits inside the approval gate.
        const pending = exec();
        let approvalId = '';
        for (let i = 0; i < 400 && approvalId === ''; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 5));
          approvalId = (await stores.approvals.listOpenApprovals()).at(0)?.approvalId ?? '';
        }
        expect(approvalId).not.toBe('');
        const approver = authenticatedActorContext(
          await stores.actors.get('actor-h1-approver'),
          'actor-h1-approver',
        );
        const decided = await turnService.decideToolApproval(approver, {
          approvalId,
          decision: 'approved',
        });
        expect(decided.status).toBe('approved');
        return pending;
      }
      return exec();
    },
    turnId,
    // A RETRY of a TERMINAL occurrence: the bridge replays the stable
    // disposition WITHOUT invoking (no approval dance is ever involved).
    executeRetry: exec,
    close: () => {
      const maybeClose = (stores as { close?: () => void }).close;
      if (typeof maybeClose === 'function') {
        maybeClose.call(stores);
      }
      void dir;
    },
  };
}

function sqliteStores(dir: string): AgentControlStores {
  return createSqliteAgentControlStores({ path: join(dir, 'h1-control.db') });
}

/** Scan every raw control-store byte (DB + WAL + SHM) for the canary. */
function assertCanaryAbsentFromRawStoreBytes(dir: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    const path = join(dir, `h1-control.db${suffix}`);
    if (existsSync(path)) {
      const bytes = readFileSync(path);
      expect(bytes.includes(CANARY)).toBe(false);
    }
  }
}

async function assertH1HostileOutputContained(
  effect: 'read' | 'write',
  storeKind: 'memory' | 'sqlite',
): Promise<void> {
  const dir = storeKind === 'sqlite' ? tempDir('vict-h1-bridge-') : undefined;
  const stores =
    storeKind === 'sqlite' ? sqliteStores(dir as string) : createInMemoryAgentControlStores();
  const fixture = await makeH1Fixture(
    effect,
    stores,
    () => ({
      saved: true,
      detail: hostileNestedProxy(),
    }),
    dir,
  );
  try {
    let threw: unknown = null;
    let result: unknown;
    try {
      result = await fixture.execute();
    } catch (error) {
      threw = error;
    }
    // The raw trap exception NEVER escapes the bridge.
    expect(threw).toBeNull();
    // The returned result is the stable non-echoing failure envelope.
    expect(result).toEqual({ victCapabilityFailure: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' });
    expect(JSON.stringify(result)).not.toContain(CANARY);
    // EXACTLY one effect.
    expect(fixture.effectCount()).toBe(1);
    // The durable status is outcome_unknown — NEVER completed, never running.
    const invocations = await fixture.stores.invocations.listInvocationsForTurn(fixture.turnId);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.status).toBe('outcome_unknown');
    expect(invocations[0]?.errorCode).toBe('VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE');
    // The single milestone mapping yields a SAFE failure — never completion.
    expect(normalizeCapabilityToolResultEvent(result)).toEqual({
      kind: 'failed',
      code: 'VICT_CAPABILITY_OUTCOME_UNKNOWN',
    });
    // The canary is absent from durable rows and raw store bytes.
    expect(JSON.stringify(invocations)).not.toContain(CANARY);
    if (storeKind === 'sqlite') {
      assertCanaryAbsentFromRawStoreBytes(dir as string);
    }
    // A retry performs NO second effect (terminal replay only).
    const retry = (await fixture.executeRetry()) as Record<string, unknown>;
    expect(fixture.effectCount()).toBe(1);
    expect(retry.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
    expect(await fixture.stores.invocations.listInvocationsForTurn(fixture.turnId)).toHaveLength(1);
  } finally {
    fixture.close();
  }
}

describe('H-1: a delivery-hostile nested value is rejected BEFORE durable completion', () => {
  it('read capability, IN-MEMORY stores', async () => {
    await assertH1HostileOutputContained('read', 'memory');
  });

  it('read capability, SQLITE stores (rows + raw DB/WAL/SHM bytes)', async () => {
    await assertH1HostileOutputContained('read', 'sqlite');
  });

  it('approved WRITE capability, IN-MEMORY stores', { timeout: 60_000 }, async () => {
    await assertH1HostileOutputContained('write', 'memory');
  });

  it(
    'approved WRITE capability, SQLITE stores (rows + raw DB/WAL/SHM bytes)',
    { timeout: 60_000 },
    async () => {
      await assertH1HostileOutputContained('write', 'sqlite');
    },
  );
});

// ---- REAL pinned Mastra path -------------------------------------------------

const RETENTION = {
  messagesMaxAgeMs: 3_600_000,
  threadsMaxAgeMs: 86_400_000,
  spansMaxAgeMs: 3_600_000,
};

interface RealPathComposition {
  stores: AgentControlStores;
  requester: ReturnType<typeof authenticatedActorContext>;
  approver: ReturnType<typeof authenticatedActorContext>;
  turnService: ReturnType<typeof composeMastraTurnExecutor>['turnService'];
  effectCount: () => number;
  /** The SQLite control-store directory (undefined for in-memory). */
  controlDir: string | undefined;
  close: () => Promise<void>;
}

let realPathCounter = 0;

async function composeRealPath(
  script: NonNullable<NonNullable<Parameters<typeof createDeterministicOfflineModel>[0]>['script']>,
  capabilityOutput: () => unknown,
  effect: 'read' | 'write',
  storeKind: 'memory' | 'sqlite',
): Promise<RealPathComposition> {
  const dir = tempDir(`vict-h1-real-${effect}-${storeKind}-`);
  const dedicated = await createDedicatedMastraStore({ dataDir: dir, retention: RETENTION });
  const controlDir = storeKind === 'sqlite' ? tempDir('vict-h1-real-sqlite-control-') : undefined;
  const stores: AgentControlStores =
    storeKind === 'sqlite'
      ? createSqliteAgentControlStores({ path: join(controlDir as string, 'h1-real-control.db') })
      : createInMemoryAgentControlStores();
  const counters = { effects: 0 };
  const capabilityId = effect === 'read' ? 'cap.h1.real.read' : 'cap.h1.real.write';
  const capability = {
    id: capabilityId,
    revision: '1',
    effect,
    input: permissiveContract(`${capabilityId}.input`),
    output: permissiveContract(`${capabilityId}.output`),
    invoke: async () => {
      counters.effects += 1;
      return capabilityOutput();
    },
  } as unknown as CapabilityDefinition;

  const registry = new AgentProfileRegistry({ resolveCapabilityRevision: () => true });
  registry.installArtifacts([
    { kind: 'instructions', id: 'instructions.h1', revision: '1', text: 'Be brief.' },
    {
      kind: 'memory-policy',
      id: 'memory-policy.h1',
      revision: '1',
      config: { lastMessages: 10, workingMemory: { enabled: false }, semanticRecall: false },
    },
    {
      kind: 'guardrail',
      id: 'guardrail.h1',
      revision: '1',
      check: () => ({ ok: true as const }),
      failureCodes: ['NEVER'],
    },
  ]);
  registry.registerProfile({
    schema: 'vict.agent-profile@1',
    id: 'agent.h1.real',
    revision: '1',
    instructions: { id: 'instructions.h1', revision: '1' },
    modelProfile: {
      id: 'model.h1',
      revision: '1',
      routerModel: 'offline-fixture/deterministic-1',
      provider: 'offline-fixture',
    },
    generation: {},
    turnPolicy: { maxSteps: 8, maxToolCalls: 4, onLimit: 'fail-closed' },
    memoryPolicy: { id: 'memory-policy.h1', revision: '1' },
    guardrails: [{ id: 'guardrail.h1', revision: '1' }],
    helperTools: [],
    capabilities: [{ id: capabilityId, revision: '1' }],
    adapter: {
      id: MASTRA_ADAPTER_COMPATIBILITY.id,
      revision: MASTRA_ADAPTER_COMPATIBILITY.revision,
      runtimePackages: { ...MASTRA_ADAPTER_COMPATIBILITY.runtimePackages },
    },
  });
  const activation = registry.activateAgentProfile({ id: 'agent.h1.real', revision: '1' });

  await stores.actors.upsert({
    actorId: 'actor-h1',
    status: 'active',
    roles: ['developer', 'approver'],
    createdAt: 0,
  });
  await stores.actors.upsert({
    actorId: 'actor-h1-approver',
    status: 'active',
    roles: ['approver'],
    createdAt: 0,
  });
  const requester = authenticatedActorContext(await stores.actors.get('actor-h1'), 'actor-h1');
  const approver = authenticatedActorContext(
    await stores.actors.get('actor-h1-approver'),
    'actor-h1-approver',
  );

  const hub = new AgentStreamHub({ ledger: stores.streamLedger, clock: () => Date.now() });
  const turnServiceRef: {
    current: ReturnType<typeof composeMastraTurnExecutor>['turnService'] | undefined;
  } = { current: undefined };
  const composition = composeMastraTurnExecutor({
    stores,
    activation,
    hub,
    clock: () => Date.now(),
    ids: {
      turnId: () => `turn-h1r-${(realPathCounter += 1)}`,
      streamId: () => `stream-h1r-${realPathCounter}`,
      invocationId: () => `inv-h1r-${realPathCounter}`,
      approvalId: () => `approval-h1r-${realPathCounter}`,
      idempotencyKey: () => `key-h1r-${realPathCounter}`,
      cancelId: () => `cancel-h1r-${realPathCounter}`,
    },
    agentConfig: {
      store: dedicated.store,
      threadCoordinator: new MastraThreadCoordinator(),
      modelFactory: () => createDeterministicOfflineModel({ script }),
    },
    capabilityBridge: {
      resolveCapability: (id, revision) =>
        id === capability.id && revision === capability.revision ? capability : undefined,
      invoke: async (definition, input) => definition.invoke(input, {} as never),
      recordInvocationIntent: (input) =>
        turnServiceRef.current?.recordToolInvocationIntent(input) as never,
      claimInvocationRun: (command) => stores.invocations.claimInvocationRun(command),
      settleInvocationRun: (command) => stores.invocations.settleInvocationRun(command),
      settleInvocationPending: (command) => stores.invocations.settleInvocationPending(command),
      reconcileAbandonedRun: (command) => stores.invocations.reconcileAbandonedRun(command),
      requestApproval: (input) => turnServiceRef.current?.requestApproval(input) as never,
      consumeApproval: (binding) => turnServiceRef.current?.consumeApproval(binding) as never,
      updateInvocationStatus: (command) => stores.invocations.updateInvocationStatus(command),
      findExistingApproval: async (invocationId) => {
        const approvals = await stores.approvals.listApprovalsForInvocation(invocationId);
        return approvals.at(0)?.approvalId;
      },
      pollApprovalDecision: async (approvalId) => {
        const record = await stores.approvals.getApproval(approvalId);
        return record === undefined ? undefined : { status: record.status };
      },
      pollIntervalMs: 5,
      approvalExpiryMs: 30_000,
    },
  });
  turnServiceRef.current = composition.turnService;
  return {
    stores,
    requester,
    approver,
    turnService: composition.turnService,
    effectCount: () => counters.effects,
    controlDir,
    close: async () => {
      await composition.productAgent.flush();
      await dedicated.close();
      const maybeClose = (stores as { close?: () => void }).close;
      if (typeof maybeClose === 'function') {
        maybeClose.call(stores);
      }
    },
  };
}

async function runRealTurn(
  composition: RealPathComposition,
  effect: 'read' | 'write',
  input: string,
): Promise<{
  turnId: string;
  streamId: string;
  status: string;
  eventKinds: string[];
  toolCompletedRows: number;
  toolFailedRows: Array<{ code?: string }>;
  durableRows: Array<{ status: string; errorCode?: string; resultSummary?: string }>;
}> {
  const { stores, requester, approver, turnService } = composition;
  const started = await turnService.startTurn(requester, {
    threadId: 'vict-conv-h1-real',
    input,
  });
  if (effect === 'write') {
    let approvalId = '';
    for (let i = 0; i < 400 && approvalId === ''; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      approvalId = (await stores.approvals.listOpenApprovals()).at(0)?.approvalId ?? '';
    }
    expect(approvalId).not.toBe('');
    await turnService.decideToolApproval(approver, {
      approvalId,
      decision: 'approved',
    });
  }
  const outcome = await started.outcomePromise;
  const ledgerRows = await stores.streamLedger.listEventsFrom(started.turn.streamId, 0);
  const invocations = await stores.invocations.listInvocationsForTurn(started.turn.turnId);
  return {
    turnId: started.turn.turnId,
    streamId: started.turn.streamId,
    status: outcome.status,
    eventKinds: ledgerRows.map((row) => row.kind),
    toolCompletedRows: ledgerRows.filter((row) => row.kind === 'tool.completed').length,
    toolFailedRows: ledgerRows
      .filter((row) => row.kind === 'tool.failed')
      .map((row) => JSON.parse(row.payload) as { code?: string }),
    durableRows: invocations.map((row) => ({
      status: row.status,
      errorCode: row.errorCode,
      resultSummary: row.resultSummary,
    })),
  };
}

describe('H-1 over the REAL pinned Mastra path (real Agent loop, offline model)', () => {
  const LONG = 180_000;

  it(
    'safe nested result → durable completed + exactly one tool.completed',
    { timeout: LONG },
    async () => {
      for (const storeKind of ['memory', 'sqlite'] as const) {
        const composition = await composeRealPath(
          {
            'Read the note': {
              kind: 'tool-call',
              toolName: 'cap_h1_real_read',
              args: { k: 'v' },
              thenText: 'SAFE-DONE',
            },
          },
          () => ({ saved: true, nested: { items: ['a', 'b'], meta: { count: 2 } } }),
          'read',
          storeKind,
        );
        try {
          const observed = await runRealTurn(composition, 'read', 'Read the note');
          expect(observed.status).toBe('completed');
          expect(observed.toolCompletedRows).toBe(1);
          expect(observed.toolFailedRows).toEqual([]);
          expect(observed.durableRows).toEqual([
            { status: 'completed', errorCode: undefined, resultSummary: 'object(2 fields)' },
          ]);
          // No post-completion tool error: the delivered snapshot survives
          // framework serialization, so no failure contradicts completion.
          const ledgerRows = await composition.stores.streamLedger.listEventsFrom(
            observed.streamId,
            0,
          );
          expect(ledgerRows.some((row) => JSON.stringify(row).includes('VICT_TOOL_FAILED'))).toBe(
            false,
          );
        } finally {
          await composition.close();
        }
      }
    },
  );

  it(
    'hostile nested result → durable outcome_unknown + exactly one safe tool.failed, zero tool.completed',
    { timeout: LONG },
    async () => {
      for (const storeKind of ['memory', 'sqlite'] as const) {
        const composition = await composeRealPath(
          {
            'Read the note': {
              kind: 'tool-call',
              toolName: 'cap_h1_real_read',
              args: { k: 'v' },
              thenText: 'AFTER-HOSTILE',
            },
          },
          () => ({ saved: true, detail: hostileNestedProxy() }),
          'read',
          storeKind,
        );
        try {
          const observed = await runRealTurn(composition, 'read', 'Read the note');
          expect(observed.status).toBe('completed'); // the model got the SAFE failure
          // Exactly one SAFE failure — no VICT_TOOL_FAILED downstream chunk.
          expect(observed.toolCompletedRows).toBe(0);
          expect(observed.toolFailedRows).toHaveLength(1);
          expect(observed.toolFailedRows[0]?.code).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
          // Durable status outcome_unknown, never completed.
          expect(observed.durableRows).toEqual([
            {
              status: 'outcome_unknown',
              errorCode: 'VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE',
              resultSummary: undefined,
            },
          ]);
          expect(composition.effectCount()).toBe(1);
          // No canary in any durable row or ledger payload.
          const ledgerRows = await composition.stores.streamLedger.listEventsFrom(
            observed.streamId,
            0,
          );
          expect(JSON.stringify(ledgerRows)).not.toContain(CANARY);
          // Raw SQLite control bytes carry no canary (DB + WAL + SHM).
          if (storeKind === 'sqlite') {
            for (const suffix of ['', '-wal', '-shm']) {
              const p = join(composition.controlDir as string, `h1-real-control.db${suffix}`);
              if (existsSync(p)) {
                expect(readFileSync(p).includes(CANARY)).toBe(false);
              }
            }
          }
        } finally {
          await composition.close();
        }
      }
    },
  );

  it(
    'approved WRITE: hostile nested result executes the effect exactly once and never contradicts it',
    { timeout: LONG },
    async () => {
      for (const storeKind of ['memory', 'sqlite'] as const) {
        const composition = await composeRealPath(
          {
            'Save the note': {
              kind: 'tool-call',
              toolName: 'cap_h1_real_write',
              args: { k: 'v' },
              thenText: 'WRITE-HOSTILE-DONE',
            },
          },
          () => ({ saved: true, detail: hostileNestedProxy() }),
          'write',
          storeKind,
        );
        try {
          const observed = await runRealTurn(composition, 'write', 'Save the note');
          expect(observed.status).toBe('completed');
          expect(composition.effectCount()).toBe(1);
          expect(observed.toolCompletedRows).toBe(0);
          expect(observed.toolFailedRows).toHaveLength(1);
          expect(observed.toolFailedRows[0]?.code).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
          expect(observed.durableRows).toEqual([
            {
              status: 'outcome_unknown',
              errorCode: 'VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE',
              resultSummary: undefined,
            },
          ]);
        } finally {
          await composition.close();
        }
      }
    },
  );

  it(
    'approved WRITE: safe nested result → durable completed + exactly one tool.completed',
    { timeout: LONG },
    async () => {
      for (const storeKind of ['memory', 'sqlite'] as const) {
        const composition = await composeRealPath(
          {
            'Save the note': {
              kind: 'tool-call',
              toolName: 'cap_h1_real_write',
              args: { k: 'v' },
              thenText: 'WRITE-SAFE-DONE',
            },
          },
          () => ({ saved: true, nested: { id: 'note-1', tags: ['a', 'b'] } }),
          'write',
          storeKind,
        );
        try {
          const observed = await runRealTurn(composition, 'write', 'Save the note');
          expect(observed.status).toBe('completed');
          expect(composition.effectCount()).toBe(1);
          expect(observed.toolCompletedRows).toBe(1);
          expect(observed.toolFailedRows).toEqual([]);
          expect(observed.durableRows).toEqual([
            { status: 'completed', errorCode: undefined, resultSummary: 'object(2 fields)' },
          ]);
        } finally {
          await composition.close();
        }
      }
    },
  );

  it(
    'no raw provider/framework chunk is exposed anywhere in the durable stream',
    { timeout: LONG },
    async () => {
      const composition = await composeRealPath(
        {
          'Read the note': {
            kind: 'tool-call',
            toolName: 'cap_h1_real_read',
            args: { k: 'v' },
            thenText: 'PROBE-DONE',
          },
        },
        () => ({ saved: true, detail: hostileNestedProxy() }),
        'read',
        'memory',
      );
      try {
        const observed = await runRealTurn(composition, 'read', 'Read the note');
        const ledgerRows = await composition.stores.streamLedger.listEventsFrom(
          observed.streamId,
          0,
        );
        const serialized = JSON.stringify(ledgerRows);
        // No canary, no raw trap text, no provider/framework error chunk.
        expect(serialized).not.toContain(CANARY);
        expect(serialized).not.toContain('GET-TRAP');
        expect(serialized).not.toContain('DESCRIPTOR-TRAP');
        expect(serialized).not.toContain('offline-fixture');
        // Events carry stable kinds and bounded identity fields only.
        for (const row of ledgerRows) {
          expect(row.kind).toMatch(/^[a-z_.]+$/);
        }
      } finally {
        await composition.close();
      }
    },
  );
});
