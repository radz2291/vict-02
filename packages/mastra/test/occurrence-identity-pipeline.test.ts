import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CapabilityDefinition, Contract } from '@victframework/sdk';
import {
  authenticatedActorContext,
  createInMemoryAgentControlStores,
  AgentStreamHub,
  type AgentControlStores,
} from '@victframework/runtime';
import type { AuthenticatedActorContext } from '@victframework/runtime';
import { AgentProfileRegistry } from '@victframework/runtime';
import {
  MASTRA_ADAPTER_COMPATIBILITY,
  createDeterministicOfflineModel,
  createDedicatedMastraStore,
  MastraThreadCoordinator,
} from '../src/index.js';
import { composeMastraTurnExecutor } from '../src/turn-executor.js';
import { runWithBridgeTurnScope, type CapabilityBridgeDeps } from '../src/tool-bridge.js';

/**
 * Stage 06B final boundary correction — INVOCATION-2 and the completed
 * REPLAY envelope proven through the REAL pinned Mastra `Agent` execution
 * path (the deterministic offline model consumed by the actual agent loop;
 * these tests FAIL at 8bc8da1 and pass after):
 *
 * - two DISTINCT tool occurrences with IDENTICAL capability and arguments
 *   receive DISTINCT occurrence identities and execute TWICE (a digest-only
 *   identity would have aliased them into one replay);
 * - a retry of the SAME occurrence identity reuses one identity and
 *   executes at most once (the duplicate-identity recurrence returns the
 *   explicit terminal replay envelope through the REAL output-schema/tool
 *   pipeline — visibly a replay disposition, never raw capability output,
 *   never a second effect).
 */

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

const TEST_RETENTION = {
  messagesMaxAgeMs: 3_600_000,
  threadsMaxAgeMs: 86_400_000,
  spansMaxAgeMs: 3_600_000,
};

function contract(id: string, ok: (value: unknown) => boolean): Contract<unknown> {
  return {
    id,
    revision: '1',
    expected: 'bounded test contract',
    parse: (input: unknown) =>
      ok(input)
        ? { ok: true, value: input }
        : { ok: false, issues: [{ code: 'INVALID', path: 'input', message: 'invalid' }] },
  };
}

interface ModelVisibleToolResult {
  toolCallId: string;
  toolName: string;
  output: unknown;
}

interface Composition {
  stores: AgentControlStores;
  requester: AuthenticatedActorContext;
  turnService: ReturnType<typeof composeMastraTurnExecutor>['turnService'];
  /** The REAL model-facing capability tools of the composition (the pinned
   * Tool wrapper + the bridge's schema surface). */
  capabilityTools: Record<string, unknown>;
  capability: CapabilityDefinition;
  invokeLog: unknown[];
  toolResults: ModelVisibleToolResult[];
  close(): Promise<void>;
}

let idCounter = 0;

type OfflineOptions = NonNullable<Parameters<typeof createDeterministicOfflineModel>[0]>;
type OfflineScript = NonNullable<OfflineOptions['script']>;
async function compose(script: OfflineScript): Promise<Composition> {
  const dir = tempDir('vict-occurrence-pipeline-');
  const dedicated = await createDedicatedMastraStore({ dataDir: dir, retention: TEST_RETENTION });
  const capability: CapabilityDefinition = {
    id: 'cap.notes.write',
    revision: '3',
    effect: 'read',
    input: contract(
      'cap.notes.write.input',
      (value) => typeof value === 'object' && value !== null,
    ),
    output: contract(
      'cap.notes.write.output',
      (value) => typeof value === 'object' && value !== null && 'saved' in (value as object),
    ),
    invoke: async (input: unknown) => ({ saved: true, echo: input }),
  } as CapabilityDefinition;
  const registry = new AgentProfileRegistry({
    resolveCapabilityRevision: () => true,
  });
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
    capabilities: [{ id: 'cap.notes.write', revision: '3' }],
    adapter: {
      id: MASTRA_ADAPTER_COMPATIBILITY.id,
      revision: MASTRA_ADAPTER_COMPATIBILITY.revision,
      runtimePackages: { ...MASTRA_ADAPTER_COMPATIBILITY.runtimePackages },
    },
  });
  const activation = registry.activateAgentProfile({ id: 'agent.ara.governed', revision: '1' });

  const stores = createInMemoryAgentControlStores();
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
  const turnServiceRef: { current: Composition['turnService'] | undefined } = {
    current: undefined,
  };
  const composition = composeMastraTurnExecutor({
    stores,
    activation,
    hub,
    clock: () => Date.now(),
    ids: {
      turnId: () => `turn-x${(idCounter += 1)}`,
      streamId: () => `stream-x${idCounter}`,
      invocationId: () => `inv-x${(idCounter += 1)}`,
      approvalId: () => `approval-${idCounter}`,
      idempotencyKey: () => `key-${idCounter}`,
      cancelId: () => `cancel-${idCounter}`,
    },
    agentConfig: {
      store: dedicated.store,
      threadCoordinator: new MastraThreadCoordinator(),
      modelFactory: () =>
        createDeterministicOfflineModel({
          script,
          onToolResult: (event) => {
            toolResults.push(event);
          },
        }),
    },
    capabilityBridge: {
      resolveCapability: (id: string, revision: string) =>
        id === capability.id && revision === capability.revision ? capability : undefined,
      invoke: async (definition: CapabilityDefinition, input: unknown) => {
        void definition;
        invokeLog.push(input);
        return capability.invoke(input, {} as never);
      },
      recordInvocationIntent: (
        input: Parameters<CapabilityBridgeDeps['recordInvocationIntent']>[0],
      ) => turnServiceRef.current?.recordToolInvocationIntent(input) as never,
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
    capabilityTools: composition.capabilityTools as Record<string, unknown>,
    capability,
    invokeLog,
    toolResults,
    close: async () => {
      await composition.productAgent.flush();
      await dedicated.close();
    },
  };
}

const LONG = 120_000;

describe('INVOCATION-2 through the REAL pinned Mastra path', () => {
  it(
    'two DISTINCT identical occurrences get distinct identities and execute twice',
    { timeout: LONG },
    async () => {
      const identicalArgs = { text: 'identical-body' };
      const composition = await compose({
        'call twice': {
          kind: 'tool-chain',
          calls: [
            { toolName: 'cap_notes_write', args: identicalArgs },
            { toolName: 'cap_notes_write', args: identicalArgs },
          ],
          thenText: 'BOTH-DONE',
        },
      });
      const { stores, requester, turnService, invokeLog } = composition;
      try {
        const started = await turnService.startTurn(requester, {
          threadId: 'vict-conv-occurrence-1',
          input: 'call twice',
        });
        const outcome = await started.outcomePromise;
        expect(outcome.status).toBe('completed');
        // TWO REAL executions of the IDENTICAL arguments.
        expect(invokeLog).toHaveLength(2);
        // TWO durable invocation records with DISTINCT occurrence identities.
        const invocations = await stores.invocations.listInvocationsForTurn(started.turn.turnId);
        expect(invocations).toHaveLength(2);
        expect(invocations[0]?.toolCallId).not.toBe(invocations[1]?.toolCallId);
        expect(invocations[0]?.argDigest).toBe(invocations[1]?.argDigest);
        expect(invocations.map((record) => record.status)).toEqual(['completed', 'completed']);
        // The model received BOTH real outputs (neither was a replay).
        // The pinned message list wraps model-visible tool output as
        // `{ type: 'json', value }` — unwrap it.
        expect(composition.toolResults).toHaveLength(2);
        for (const result of composition.toolResults) {
          const wrapped = result.output as { type: string; value: unknown };
          expect(wrapped.type).toBe('json');
          expect(wrapped.value).toEqual({ saved: true, echo: identicalArgs });
        }
        // Downstream normalized events are truthful: two completions.
        const ledgerRows = await stores.streamLedger.listEventsFrom(started.turn.streamId, 0);
        const completed = ledgerRows.filter((row) => row.kind === 'tool.completed');
        expect(completed).toHaveLength(2);
        const failed = ledgerRows.filter((row) => row.kind === 'tool.failed');
        expect(failed).toHaveLength(0);
      } finally {
        await composition.close();
      }
    },
  );
});

describe('completed replay through the REAL pinned Mastra pipeline', () => {
  it(
    'a retry of the completed occurrence identity replays the explicit disposition through the real output-schema tool pipeline without a second effect or a leak',
    { timeout: LONG },
    async () => {
      const identicalArgs = { text: 'retry-body' };
      const composition = await compose({
        'retry the same call': {
          kind: 'tool-call',
          toolName: 'cap_notes_write',
          args: identicalArgs,
          thenText: 'RETRY-DONE',
        },
      });
      const { stores, requester, turnService, invokeLog } = composition;
      try {
        // The REAL turn executes the capability once (turn completes).
        const started = await turnService.startTurn(requester, {
          threadId: 'vict-conv-occurrence-2',
          input: 'retry the same call',
        });
        const outcome = await started.outcomePromise;
        expect(outcome.status).toBe('completed');
        expect(invokeLog).toHaveLength(1);
        const invocations = await stores.invocations.listInvocationsForTurn(started.turn.turnId);
        expect(invocations).toHaveLength(1);
        expect(invocations[0]?.status).toBe('completed');
        const occurrenceId = invocations[0]?.toolCallId as string;

        // A RETRY of the SAME occurrence identity (crash recovery / client
        // resubmission) enters through the REAL composed tool: the pinned
        // Tool wrapper, the bridge's real input/output Standard-Schema
        // surface, and the bridge itself — never a bypass.
        const tool = composition.capabilityTools['cap_notes_write'] as {
          execute: (input: unknown, context: unknown) => Promise<unknown>;
        };
        const retryResult = (await runWithBridgeTurnScope(
          {
            turnId: started.turn.turnId,
            streamId: started.turn.streamId,
            actorId: 'actor-user',
            agentProfileVersion: 'v1_profile',
            threadId: 'vict-conv-occurrence-2',
          },
          () => tool.execute(identicalArgs, { agent: { toolCallId: occurrenceId } }),
        )) as Record<string, unknown>;

        // Accepted by the REAL output-schema/tool pipeline as the EXPLICIT
        // replay disposition — never the capability output, never a second
        // execution, never raw payload content.
        const replay = retryResult.victCapabilityReplay as {
          disposition: string;
          invocationId: string;
          resultSummary?: string;
        };
        expect(replay).toBeDefined();
        expect(replay.disposition).toBe('completed');
        expect(replay.invocationId).toBe(invocations[0]?.invocationId);
        expect(replay.resultSummary).toMatch(/^object\(\d+ fields\)$/);
        expect(JSON.stringify(retryResult)).not.toContain('retry-body');
        // Exactly ONE effect — the replay produced no second execution.
        expect(invokeLog).toHaveLength(1);
        // The strict capability output contract REJECTS the replay envelope:
        // it can never satisfy the capability's output contract as a new
        // execution result (it passes the pipeline ONLY through the explicit
        // marker surface).
        const strictContract = composition.capability.output as Contract<unknown>;
        const verdict = strictContract.parse(retryResult);
        expect(verdict.ok).toBe(false);
        // Downstream normalized events remain truthful: one completion, zero
        // failures, one invocation row, durable state completed.
        const ledgerRows = await stores.streamLedger.listEventsFrom(started.turn.streamId, 0);
        expect(ledgerRows.filter((row) => row.kind === 'tool.completed')).toHaveLength(1);
        expect(ledgerRows.filter((row) => row.kind === 'tool.failed')).toHaveLength(0);
        expect(
          (await stores.invocations.getInvocation(invocations[0]?.invocationId as string))?.status,
        ).toBe('completed');
      } finally {
        await composition.close();
      }
    },
  );
});
