import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CapabilityDefinition, Contract } from '@vict/sdk';
import { createInMemoryAgentControlStores, type AgentControlStores } from '@vict/runtime';
import { createSqliteAgentControlStores } from '@vict/store-sqlite';
import { AgentTurnService } from '@vict/control';
import {
  bridgeCapabilityToolToMastra,
  normalizeCapabilityToolResultEvent,
  runWithBridgeTurnScope,
  type CapabilityBridgeDeps,
} from '../src/tool-bridge.js';

/**
 * Stage 06 POST-AUDIT remediation — the governed capability bridge under
 * hostile post-invocation output (these tests FAIL at 712752a3 and pass
 * after the correction).
 *
 * The post-audit probe reproduced a HIGH boundary defect at the audited
 * implementation: a capability whose (accepted-by-contract) result was a
 * Proxy with a throwing `has` trap made the bridge's unguarded
 * `'victCapabilityReplay' in outputRecord` reserved-marker check THROW
 * AFTER the capability had already run. The raw exception crossed the tool
 * boundary, the fenced settlement path was bypassed, and the durable
 * invocation stayed incorrectly `running` (bypassing `outcome_unknown`).
 *
 * Corrected contract, proven over IN-MEMORY and SQLITE control stores:
 * - the capability executes EXACTLY ONCE;
 * - the raw trap exception never escapes the bridge;
 * - the record settles to the fenced, non-replayable `outcome_unknown`;
 * - the returned result is the stable non-echoing failure envelope;
 * - the canary never appears in the result or any durable row;
 * - a later retry performs NO second effect;
 * - fenced-owner (duplicate sees `in_progress`) and stale-owner (fence
 *   mismatch refuses settlement) behavior remain intact;
 * - when the settlement store itself is unavailable, the model still
 *   receives the safe outcome-unknown failure and the original exception
 *   never leaks.
 */

const CANARY = 'CANARY-POSTAUDIT-BRIDGE';
const SCOPE = {
  turnId: 'turn-hostile-output',
  streamId: 'stream-hostile-output',
  actorId: 'actor-hostile',
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

function makeCapability(invoke: CapabilityDefinition['invoke']): CapabilityDefinition {
  return {
    id: 'cap.hostile.read',
    revision: '1',
    effect: 'read',
    input: permissiveContract('cap.hostile.read.input'),
    output: permissiveContract('cap.hostile.read.output'),
    invoke,
  } as CapabilityDefinition;
}

const ACTIVATION = {
  activationVersion: 'v1_act',
  agentProfileVersion: 'v1_profile',
  capabilities: [{ id: 'cap.hostile.read', revision: '1' }],
} as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];

let idCounter = 0;

interface Fixture {
  stores: AgentControlStores;
  deps: CapabilityBridgeDeps;
  effectCount: () => number;
  execute: () => Promise<unknown>;
  close: () => void;
}

async function makeFixture(
  stores: AgentControlStores,
  capability: CapabilityDefinition,
  overrides: {
    settleInvocationRun?: CapabilityBridgeDeps['settleInvocationRun'];
    claimInvocationRun?: CapabilityBridgeDeps['claimInvocationRun'];
  } = {},
): Promise<Fixture> {
  let clockValue = 1000;
  const clock = (): number => (clockValue += 1);
  await stores.actors.upsert({
    actorId: SCOPE.actorId,
    status: 'active',
    roles: ['developer'],
    createdAt: 0,
  });
  let effectCount = 0;
  let localCounter = 0;
  const turnService = new AgentTurnService({
    stores,
    clock,
    ids: {
      turnId: (): string => `${SCOPE.turnId}-${(localCounter += 1)}`,
      streamId: (): string => `stream-${localCounter}`,
      invocationId: (): string => `inv-${(idCounter += 1)}`,
      approvalId: (): string => `approval-${idCounter}`,
      idempotencyKey: (): string => `key-${idCounter}`,
      cancelId: (): string => `cancel-${idCounter}`,
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
    claimInvocationRun:
      overrides.claimInvocationRun ?? ((command) => stores.invocations.claimInvocationRun(command)),
    settleInvocationRun:
      overrides.settleInvocationRun ??
      ((command) => stores.invocations.settleInvocationRun(command)),
    settleInvocationPending: (command) => stores.invocations.settleInvocationPending(command),
    reconcileAbandonedRun: (command) => stores.invocations.reconcileAbandonedRun(command),
    requestApproval: (input) => turnService.requestApproval(input),
    consumeApproval: (binding) => turnService.consumeApproval(binding),
    updateInvocationStatus: (command) => stores.invocations.updateInvocationStatus(command),
    clock,
    pollIntervalMs: 5,
    approvalExpiryMs: 5000,
  };
  const tool = bridgeCapabilityToolToMastra(ACTIVATION, capability, deps) as {
    execute: (i: unknown, c: unknown) => Promise<unknown>;
  };
  await stores.turns.createTurnIntent({
    turnId: SCOPE.turnId,
    streamId: SCOPE.streamId,
    threadId: 'thread-hostile',
    actorId: SCOPE.actorId,
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
  await stores.turns.startTurn(SCOPE.turnId, 2);
  return {
    stores,
    deps,
    effectCount: () => effectCount,
    execute: () =>
      runWithBridgeTurnScope({ ...SCOPE, threadId: 'thread-hostile' }, () =>
        tool.execute({ k: 'v' }, { toolCallId: 'call-hostile' }),
      ),
    close: () => {
      const maybeClose = (stores as { close?: () => void }).close;
      if (typeof maybeClose === 'function') {
        maybeClose.call(stores);
      }
    },
  };
}

/** The reproduced hostile result: an accepted-by-contract Proxy whose `has` trap throws. */
function hostileHasTrapProxy(): object {
  const target = { marker: `${CANARY}-OUTPUT` };
  return new Proxy(target, {
    has() {
      throw new Error(`${CANARY}-HAS-TRAP`);
    },
    get(target, key) {
      return (target as Record<string | symbol, unknown>)[key];
    },
  });
}

async function assertHostileOutputSettlesOutcomeUnknown(stores: AgentControlStores): Promise<void> {
  const fixture = await makeFixture(
    stores,
    makeCapability(() => hostileHasTrapProxy()),
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
    // EXACTLY ONE durable invocation, settled to the fenced non-replayable
    // outcome_unknown — never incorrectly running, never completed.
    const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.status).toBe('outcome_unknown');
    expect(fixture.effectCount()).toBe(1);
    // The mapping turns it into a safe failure — never completion.
    expect(normalizeCapabilityToolResultEvent(result)).toEqual({
      kind: 'failed',
      code: 'VICT_CAPABILITY_OUTCOME_UNKNOWN',
    });
    // A retry performs NO second effect (the record is terminal, so the
    // retry replays the stable disposition instead of re-executing).
    const retry = (await fixture.execute()) as Record<string, unknown>;
    expect(fixture.effectCount()).toBe(1);
    expect(retry.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
    expect(await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId)).toHaveLength(1);
    // No canary anywhere in the durable rows.
    expect(JSON.stringify(invocations)).not.toContain(CANARY);
  } finally {
    fixture.close();
  }
}

describe('post-audit settlement guarantee: hostile capability output can never bypass the fence', () => {
  it('an accepted-by-contract hostile Proxy result settles outcome_unknown over IN-MEMORY stores', async () => {
    await assertHostileOutputSettlesOutcomeUnknown(await createInMemoryAgentControlStores());
  });

  it('an accepted-by-contract hostile Proxy result settles outcome_unknown over SQLITE stores', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vict-hostile-sqlite-'));
    try {
      await assertHostileOutputSettlesOutcomeUnknown(
        createSqliteAgentControlStores({ path: join(dir, 'hostile.db') }),
      );
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Windows may hold the database files briefly; the directory is
        // disposable.
      }
    }
  });

  it('a REVOKED Proxy result settles outcome_unknown and never escapes raw', async () => {
    const fixture = await makeFixture(
      await createInMemoryAgentControlStores(),
      makeCapability(() => {
        const handle = Proxy.revocable(
          { victCapabilityReplay: { disposition: 'completed', invocationId: 'inv-fake' } },
          {},
        );
        handle.revoke();
        return handle.proxy;
      }),
    );
    try {
      let result: unknown;
      try {
        result = await fixture.execute();
      } catch (error) {
        throw new Error(`the bridge leaked a raw exception: ${String(error)}`, { cause: error });
      }
      expect(result).toEqual({ victCapabilityFailure: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' });
      const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
      expect(invocations[0]?.status).toBe('outcome_unknown');
      // A fully revoked proxy already throws at the invoke-await boundary
      // (its implicit thenable read throws), so the invocation guard is
      // the containment point; the forged envelope it carried can never
      // surface either way.
      expect(invocations[0]?.errorCode).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
      expect(fixture.effectCount()).toBe(1);
    } finally {
      fixture.close();
    }
  });

  it('a hostile output with an inherited control marker is rejected as reserved-marker', async () => {
    const fixture = await makeFixture(
      await createInMemoryAgentControlStores(),
      makeCapability(() => Object.create({ victCapabilityFailure: 'VICT_CAPABILITY_DECLINED' })),
    );
    try {
      const result = (await fixture.execute()) as Record<string, unknown>;
      expect(result.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
      const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
      expect(invocations[0]?.status).toBe('outcome_unknown');
      expect(invocations[0]?.errorCode).toBe('VICT_CAPABILITY_RESERVED_MARKER_REJECTED');
    } finally {
      fixture.close();
    }
  });

  it('an output carrying an own `then` field is rejected before delivery (thenable smuggle)', async () => {
    const fixture = await makeFixture(
      await createInMemoryAgentControlStores(),
      makeCapability(() => ({
        saved: true,
        // A NON-callable `then` is not a thenable, so it survives the
        // invoke-await boundary unchanged — and must still be refused
        // before the result can ever be delivered downstream (Mastra and
        // the adapter would otherwise await it again).
        then: 'CANARY-THEN-DATA',
      })),
    );
    try {
      const result = (await fixture.execute()) as Record<string, unknown>;
      expect(result.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
      expect(JSON.stringify(result)).not.toContain('CANARY-THEN-DATA');
      const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
      expect(invocations[0]?.status).toBe('outcome_unknown');
      expect(invocations[0]?.errorCode).toBe('VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE');
    } finally {
      fixture.close();
    }
  });

  it('a benign plain output still completes normally (the correction preserves liveness)', async () => {
    const fixture = await makeFixture(
      await createInMemoryAgentControlStores(),
      makeCapability(() => ({ saved: true, echo: 'ok' })),
    );
    try {
      const result = (await fixture.execute()) as Record<string, unknown>;
      expect(result).toEqual({ saved: true, echo: 'ok' });
      const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
      expect(invocations).toHaveLength(1);
      expect(invocations[0]?.status).toBe('completed');
      expect(fixture.effectCount()).toBe(1);
    } finally {
      fixture.close();
    }
  });

  it('when the settlement store itself is unavailable the model receives the safe failure and the original exception never leaks', async () => {
    const fixture = await makeFixture(
      await createInMemoryAgentControlStores(),
      makeCapability(() => ({ saved: true })),
      {
        settleInvocationRun: () => {
          throw new Error(`${CANARY}-STORE-DOWN`);
        },
      },
    );
    try {
      let result: unknown;
      try {
        result = await fixture.execute();
      } catch (error) {
        throw new Error(`the bridge leaked a raw exception: ${String(error)}`, { cause: error });
      }
      expect(result).toEqual({ victCapabilityFailure: 'VICT_CAPABILITY_OUTCOME_UNKNOWN' });
      expect(JSON.stringify(result)).not.toContain(CANARY);
      // Persistence did NOT succeed and the result never claims it did:
      // no normal completion, no raw store error text anywhere.
      const invocations = await fixture.stores.invocations.listInvocationsForTurn(SCOPE.turnId);
      expect(invocations.map((record) => record.status)).not.toContain('completed');
      expect(JSON.stringify(invocations)).not.toContain(CANARY);
    } finally {
      fixture.close();
    }
  });

  it(
    'fenced-owner and stale-owner behavior remains intact alongside the correction',
    { timeout: 60_000 },
    async () => {
      // Stale-owner: a settlement under a WRONG fence is refused by the
      // store, and the bridge's fenced fallback still reports truthfully.
      const stores = await createInMemoryAgentControlStores();
      let settleCalls = 0;
      const fenceProbe = await makeFixture(
        stores,
        makeCapability(() => ({ saved: true })),
        {
          settleInvocationRun: (command) => {
            settleCalls += 1;
            if (command.status === 'completed') {
              // Simulate a stale owner: the durable store refuses the fence.
              return stores.invocations.settleInvocationRun({
                ...command,
                fenceToken: `${command.fenceToken}-stale`,
              });
            }
            return stores.invocations.settleInvocationRun(command);
          },
        },
      );
      try {
        const result = (await fenceProbe.execute()) as Record<string, unknown>;
        // The completed settlement was fenced out; the truthful fallback is
        // the non-replayable outcome_unknown — never a normal success.
        expect(settleCalls).toBeGreaterThanOrEqual(1);
        expect(result.victCapabilityFailure).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
        const invocations = await fenceProbe.stores.invocations.listInvocationsForTurn(
          SCOPE.turnId,
        );
        expect(invocations.map((record) => record.status)).not.toContain('completed');
        expect(fenceProbe.effectCount()).toBe(1);
      } finally {
        fenceProbe.close();
      }

      // Live-owner: a duplicate that observes the running record waits for
      // the SAME composition owner and replays truthfully (non-terminal
      // in_progress while waiting; the owner is never mutated).
      const liveStores = await createInMemoryAgentControlStores();
      let localCounter = 0;
      const turnService = new AgentTurnService({
        stores: liveStores,
        clock: (): number => Date.now(),
        ids: {
          turnId: (): string => `turn-live-${(localCounter += 1)}`,
          streamId: (): string => `stream-live-${localCounter}`,
          invocationId: (): string => `inv-live-${(idCounter += 1)}`,
          approvalId: (): string => `approval-${idCounter}`,
          idempotencyKey: (): string => `key-${idCounter}`,
          cancelId: (): string => `cancel-${idCounter}`,
        },
      });
      await liveStores.actors.upsert({
        actorId: SCOPE.actorId,
        status: 'active',
        roles: ['developer'],
        createdAt: 0,
      });
      // A gate holds the owner inside the capability so the duplicate can
      // observe the LIVE running attempt (the plain capability settles too
      // fast to observe).
      let releaseOwner!: () => void;
      const ownerGate = new Promise<void>((resolve) => {
        releaseOwner = resolve;
      });
      let ownerInvoked = 0;
      const capability = makeCapability(async () => {
        ownerInvoked += 1;
        await ownerGate;
        return { saved: true };
      });
      const deps: CapabilityBridgeDeps = {
        resolveCapability: (id, revision): CapabilityDefinition | undefined =>
          id === capability.id && revision === capability.revision ? capability : undefined,
        invoke: async (resolved, input) => resolved.invoke(input, {} as never),
        recordInvocationIntent: (input) => turnService.recordToolInvocationIntent(input),
        claimInvocationRun: (command) => liveStores.invocations.claimInvocationRun(command),
        settleInvocationRun: (command) => liveStores.invocations.settleInvocationRun(command),
        settleInvocationPending: (command) =>
          liveStores.invocations.settleInvocationPending(command),
        reconcileAbandonedRun: (command) => liveStores.invocations.reconcileAbandonedRun(command),
        requestApproval: (input) => turnService.requestApproval(input),
        consumeApproval: (binding) => turnService.consumeApproval(binding),
        updateInvocationStatus: (command) => liveStores.invocations.updateInvocationStatus(command),
        clock: (): number => Date.now(),
        pollIntervalMs: 5,
        approvalExpiryMs: 5000,
      };
      const liveActivation = {
        activationVersion: 'v1_act',
        agentProfileVersion: 'v1_profile',
        capabilities: [{ id: 'cap.hostile.read', revision: '1' }],
      } as unknown as Parameters<typeof bridgeCapabilityToolToMastra>[0];
      const liveTool = bridgeCapabilityToolToMastra(liveActivation, capability, deps) as {
        execute: (i: unknown, c: unknown) => Promise<unknown>;
      };
      const exec = (): Promise<unknown> =>
        runWithBridgeTurnScope({ ...SCOPE, threadId: 'thread-live' }, () =>
          liveTool.execute({ k: 'v' }, { toolCallId: 'call-live' }),
        );
      try {
        await liveStores.turns.createTurnIntent({
          turnId: SCOPE.turnId,
          streamId: SCOPE.streamId,
          threadId: 'thread-live',
          actorId: SCOPE.actorId,
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
        await liveStores.turns.startTurn(SCOPE.turnId, 2);
        const owner = exec();
        let invocationId: string | undefined;
        for (let i = 0; i < 400; i += 1) {
          const invocations = await liveStores.invocations.listInvocationsForTurn(SCOPE.turnId);
          const running = invocations.find((record) => record.status === 'running');
          if (running !== undefined) {
            invocationId = running.invocationId;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        expect(invocationId).toBeDefined();
        // The live owner is inside the gated capability: EXACTLY one effect.
        expect(ownerInvoked).toBe(1);
        const duplicate = exec();
        await new Promise((resolve) => setTimeout(resolve, 80));
        // While the owner is LIVE, the record is untouched and the effect
        // count stays at exactly one.
        const mid = await liveStores.invocations.getInvocation(invocationId as string);
        expect(mid?.status).toBe('running');
        expect(ownerInvoked).toBe(1);
        // Release the owner: it settles completed, and the waiting duplicate
        // replays the truthful terminal disposition (one effect total).
        releaseOwner();
        expect(await owner).toEqual({ saved: true });
        const duplicateResult = (await duplicate) as Record<string, unknown>;
        const replay = (duplicateResult.victCapabilityReplay ?? {}) as Record<string, unknown>;
        expect(replay.disposition).toBe('completed');
        const invocations = await liveStores.invocations.listInvocationsForTurn(SCOPE.turnId);
        expect(invocations).toHaveLength(1);
        expect(invocations[0]?.status).toBe('completed');
      } finally {
        const maybeClose = (liveStores as { close?: () => void }).close;
        if (typeof maybeClose === 'function') {
          maybeClose.call(liveStores);
        }
      }
    },
  );
});
