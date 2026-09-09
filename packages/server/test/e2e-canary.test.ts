import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CapabilityDefinition, Contract } from '@victframework/sdk';
import {
  AgentStreamHub,
  createInMemoryStores,
  InMemoryActorDirectory,
  type AgentApprovalRecord,
  type AgentToolInvocationRecord,
} from '@victframework/runtime';
import { AgentProfileRegistry } from '@victframework/runtime';
import { createSqliteAgentControlStores } from '@victframework/store-sqlite';
import { ControlPlaneService, createControlPlaneSandboxSimulator } from '@victframework/control';
import {
  MASTRA_ADAPTER_COMPATIBILITY,
  createDeterministicOfflineModel,
  createDedicatedMastraStore,
  MastraThreadCoordinator,
} from '@victframework/mastra';
import { composeMastraTurnExecutor } from '@victframework/mastra';
import {
  createLocalTestAuthenticator,
  createServerAuthenticator,
  createVictHttpServer,
  listenVictHttpServer,
  VictCommandService,
  type VictHttpServer,
} from '../src/index.js';

/**
 * Stage 06B — the TRUE end-to-end canary (corrective finalization, F9):
 *
 *   authenticated HTTP turn
 *   → deterministic offline Mastra model
 *   → real governed tool bridge
 *   → VICT capability
 *   → SQLite stores
 *   → SSE/reconnect
 *
 * Unique canaries are planted in: the prompt text, the model output, tool
 * argument KEYS and VALUES, the capability-thrown error AND its nested
 * cause, a credential name and value captured by the capability, and
 * approval metadata (the approver's own decision reason).
 *
 * Surfaces scanned: HTTP responses (including errors and unauthorized
 * reads), SSE frames and metadata, durable operational stream rows, turn
 * records, invocation records, audit events, and the RAW bytes of every
 * SQLite database plus WAL/SHM sidecars.
 *
 * EXPLICITLY AUTHORIZED CONTENT SURFACES (documented, intentional):
 * 1. The designated conversation/Mastra domain database holds the prompt
 *    and completed assistant content for the AUTHORIZED actor under its
 *    retention/deletion/export policy (a content REFERENCE crosses the
 *    operational ledger, never the content).
 * 2. The live SSE `text.delta` frames carry user-visible model output to
 *    the authorized subscriber.
 * 3. The approver's own decision reason persists in the approval record
 *    (authorized recipient), never in stream rows or cross-actor surfaces.
 */

const PROMPT_CANARY = 'PROMPT-CANARY-e7f2a91c4';
const MODEL_CANARY = 'MODEL-CANARY-b8d3e22f7';
const ARG_KEY_CANARY = 'argKeyCanaryA1c3d5';
const ARG_VALUE_CANARY = 'ARG-VALUE-CANARY-d4e5f6a7b';
const CAPABILITY_ERROR_CANARY = 'CAPABILITY-ERROR-CANARY-c9d8e7f6';
const CAUSE_CANARY = 'CAUSE-CANARY-7a6b5c4d';
const CREDENTIAL_NAME_CANARY = 'VICT_CREDENTIAL_CANARY_X9Y8';
const CREDENTIAL_VALUE_CANARY = 'CRED-VALUE-CANARY-1z2x3c4v';
const APPROVAL_META_CANARY = 'APPROVAL-META-CANARY-m5n6o7p';

const tempDirs: string[] = [];

let composed: VictHttpServer | undefined;
let port = 0;
let dir = '';
let controlStores: ReturnType<typeof createSqliteAgentControlStores> | undefined;
let conversationStore: Awaited<ReturnType<typeof createDedicatedMastraStore>> | undefined;

async function post(
  path: string,
  payload: unknown,
  token: string,
  idempotencyKey?: string,
): Promise<{ status: number; text: string }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(idempotencyKey !== undefined ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ payload }),
  });
  return { status: response.status, text: await response.text() };
}

async function get(path: string, token: string): Promise<{ status: number; text: string }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return { status: response.status, text: await response.text() };
}

/** Whole-store byte scan across every SQLite file in the composition. */
function controlDbBytes(): string {
  const parts: string[] = [];
  for (const suffix of ['', '-wal', '-shm']) {
    const p = join(dir, `canary-e2e.db${suffix}`);
    if (existsSync(p)) {
      parts.push(readFileSync(p).toString('latin1'));
    }
  }
  return parts.join('\n');
}

function conversationDbBytes(): string {
  const parts: string[] = [];
  const dataDir = join(dir, 'conversation');
  if (!existsSync(dataDir)) {
    return '';
  }
  const visit = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const p = join(current, entry);
      if (statSync(p).isDirectory()) {
        visit(p);
      } else if (/\.db(-wal|-shm)?$/.test(entry)) {
        parts.push(readFileSync(p).toString('latin1'));
      }
    }
  };
  visit(dataDir);
  return parts.join('\n');
}

afterAll(async () => {
  await composed?.close();
  controlStores?.close();
  await conversationStore?.close().catch(() => undefined);
  for (const d of tempDirs) {
    const attempt = (remaining: number): void => {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        if (remaining > 0) {
          setTimeout(() => attempt(remaining - 1), 500);
        }
      }
    };
    attempt(10);
  }
});

async function fixture(): Promise<number> {
  if (composed !== undefined) {
    return port;
  }
  dir = mkdtempSync(join(tmpdir(), 'vict-e2e-canary-'));
  tempDirs.push(dir);
  // ---- Durable operational stores (SQLite control plane) ----------------
  controlStores = createSqliteAgentControlStores({ path: join(dir, 'canary-e2e.db') });
  // ---- The designated conversation domain (authorized, separate DB) -----
  conversationStore = await createDedicatedMastraStore({
    dataDir: join(dir, 'conversation'),
    retention: {
      messagesMaxAgeMs: 3_600_000,
      threadsMaxAgeMs: 86_400_000,
      spansMaxAgeMs: 3_600_000,
    },
  });

  const directory = new InMemoryActorDirectory();
  await directory.upsert({
    actorId: 'actor-user',
    status: 'active',
    roles: ['developer', 'operator', 'approver', 'administrator'],
    createdAt: 0,
  });
  await directory.upsert({
    actorId: 'actor-approver',
    status: 'active',
    roles: ['approver'],
    createdAt: 0,
  });
  await directory.upsert({
    actorId: 'actor-outsider',
    status: 'active',
    roles: ['viewer'],
    createdAt: 0,
  });

  // ---- The VICT capability (throws with a nested cause + credential) ----
  const capability: CapabilityDefinition = {
    id: 'cap.notes.write',
    revision: '3',
    effect: 'write',
    input: {
      id: 'cap.notes.write.input',
      revision: '1',
      expected: 'bounded test contract',
      parse: (input: unknown) =>
        typeof input === 'object' && input !== null
          ? { ok: true, value: input }
          : { ok: false, issues: [{ code: 'INVALID', path: 'input', message: 'invalid' }] },
    } as Contract<unknown>,
    output: {
      id: 'cap.notes.write.output',
      revision: '1',
      expected: 'bounded test contract',
      parse: (input: unknown) =>
        typeof input === 'object' && input !== null
          ? { ok: true, value: input }
          : { ok: false, issues: [{ code: 'INVALID', path: 'input', message: 'invalid' }] },
    } as Contract<unknown>,
    invoke: async () => {
      // The capability holds a credential (name + value) and FAILS with a
      // nested cause: every layer of this error is canary-planted and must
      // never reach any operational surface.
      const credential = {
        name: CREDENTIAL_NAME_CANARY,
        value: CREDENTIAL_VALUE_CANARY,
      };
      void credential;
      const error = new Error(`capability failed: ${CAPABILITY_ERROR_CANARY}`);
      Object.assign(error, { cause: new Error(`nested driver said ${CAUSE_CANARY}`) });
      throw error;
    },
  } as unknown as CapabilityDefinition;

  // ---- The pinned profile + activation ----------------------------------
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
    {
      kind: 'guardrail',
      id: 'guardrail.length',
      revision: '1',
      check: (text: string) =>
        text.length <= 2000 ? { ok: true } : { ok: false, code: 'TOO_LONG' },
      failureCodes: ['TOO_LONG'],
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
    guardrails: [{ id: 'guardrail.length', revision: '1' }],
    helperTools: [],
    capabilities: [{ id: 'cap.notes.write', revision: '3' }],
    adapter: {
      id: MASTRA_ADAPTER_COMPATIBILITY.id,
      revision: MASTRA_ADAPTER_COMPATIBILITY.revision,
      runtimePackages: { ...MASTRA_ADAPTER_COMPATIBILITY.runtimePackages },
    },
  });
  const activation = registry.activateAgentProfile({ id: 'agent.ara.governed', revision: '1' });

  const hub = new AgentStreamHub({ ledger: controlStores.streamLedger, clock: () => Date.now() });
  const turnServiceRef: {
    current: ReturnType<typeof composeMastraTurnExecutor>['turnService'] | undefined;
  } = {
    current: undefined,
  };
  let n = 100;
  const composition = composeMastraTurnExecutor({
    stores: controlStores,
    activation,
    hub,
    clock: () => Date.now(),
    ids: {
      turnId: () => `turn-e2e-${(n += 1)}`,
      streamId: () => `stream-e2e-${n}`,
      invocationId: () => `inv-e2e-${n}`,
      approvalId: () => `approval-e2e-${n}`,
      idempotencyKey: () => `key-e2e-${n}`,
      cancelId: () => `cancel-e2e-${n}`,
    },
    agentConfig: {
      store: conversationStore.store,
      threadCoordinator: new MastraThreadCoordinator(),
      modelFactory: () =>
        createDeterministicOfflineModel({
          script: {
            // The prompt maps to a protected tool call whose arguments carry
            // canary keys AND values; the final model text carries the model
            // output canary (intentional, user-visible content).
            [`summarize ${PROMPT_CANARY}`]: {
              kind: 'tool-call',
              toolName: 'cap_notes_write',
              args: { [ARG_KEY_CANARY]: ARG_VALUE_CANARY, topic: 'daily notes' },
              thenText: `The notes action was attempted. ${MODEL_CANARY}`,
            },
          },
        }),
    },
    capabilityBridge: {
      resolveCapability: (id, revision) =>
        id === capability.id && revision === capability.revision ? capability : undefined,
      invoke: async (definition, input, context) => {
        void definition;
        void input;
        void context;
        return capability.invoke({}, {} as never);
      },
      recordInvocationIntent: (input) =>
        turnServiceRef.current?.recordToolInvocationIntent(
          input,
        ) as Promise<AgentToolInvocationRecord>,
      claimInvocationRun: (command) =>
        controlStores !== undefined
          ? controlStores.invocations.claimInvocationRun(command)
          : Promise.reject(new Error('stores unavailable')),
      settleInvocationRun: (command) =>
        controlStores !== undefined
          ? controlStores.invocations.settleInvocationRun(command)
          : Promise.reject(new Error('stores unavailable')),
      settleInvocationPending: (command) =>
        controlStores !== undefined
          ? controlStores.invocations.settleInvocationPending(command)
          : Promise.reject(new Error('stores unavailable')),
      reconcileAbandonedRun: (command) =>
        controlStores !== undefined
          ? controlStores.invocations.reconcileAbandonedRun(command)
          : Promise.reject(new Error('stores unavailable')),
      requestApproval: (input) =>
        turnServiceRef.current?.requestApproval(input) as Promise<AgentApprovalRecord>,
      consumeApproval: (binding) =>
        turnServiceRef.current?.consumeApproval(binding) as Promise<
          { approved: true } | { approved: false; reasonCode: string }
        >,
      updateInvocationStatus: (command) =>
        controlStores!.invocations.updateInvocationStatus(command),
      findExistingApproval: async (invocationId) =>
        (await controlStores?.approvals.listApprovalsForInvocation(invocationId))?.at(0)
          ?.approvalId,
      pollApprovalDecision: async (approvalId) => {
        const record = await controlStores?.approvals.getApproval(approvalId);
        return record === undefined ? undefined : { status: record.status };
      },
      pollIntervalMs: 5,
      approvalExpiryMs: 60_000,
    },
  });
  turnServiceRef.current = composition.turnService;

  let auditN = 0;
  const controlPlane = new ControlPlaneService({
    stores: controlStores,
    catalog: createInMemoryStores().catalog,
    clock: () => Date.now(),
    simulator: createControlPlaneSandboxSimulator({
      stores: controlStores,
      catalog: createInMemoryStores().catalog,
    }),
    ids: {
      changesetId: () => `cs-${(auditN += 1)}`,
      changesetApprovalId: () => `csa-${(auditN += 1)}`,
      auditId: () => `audit-${(auditN += 1)}`,
      controlRunId: () => `run-${(auditN += 1)}`,
    },
  });
  const commandService = new VictCommandService({
    stores: controlStores,
    controlPlane,
    turnService: composition.turnService,
    clock: () => Date.now(),
  });
  const auth = createServerAuthenticator({
    authenticator: createLocalTestAuthenticator({
      'vict-token-owner': 'actor-user',
      'vict-token-approver': 'actor-approver',
      'vict-token-outsider': 'actor-outsider',
    }),
    directory,
  });
  composed = createVictHttpServer({ commandService, auth, hub, stores: controlStores });
  port = await listenVictHttpServer(composed);
  return port;
}

describe('end-to-end canary: HTTP turn → offline model → governed bridge → capability → SQLite → SSE', () => {
  it(
    'operational surfaces retain zero content; authorized surfaces are exactly the documented ones',
    { timeout: 180_000 },
    async () => {
      await fixture();

      // ---- 1. The authenticated turn starts over REAL HTTP ----------------
      const started = await post(
        '/vict/v1/turns',
        { threadId: 'thread-e2e-canary-1', input: `summarize ${PROMPT_CANARY}` },
        'vict-token-owner',
        'e2e-canary-turn-1',
      );
      expect(started.status).toBe(200);
      const startBody = JSON.parse(started.text) as { data: { turnId: string; streamId: string } };
      const { turnId, streamId } = startBody.data;
      expect(turnId).toBeTruthy();
      // The start result carries IDENTITIES only — never the prompt.
      expect(started.text).not.toContain(PROMPT_CANARY);

      // ---- 2. The protected tool request suspends; approve over HTTP ------
      let approvalId = '';
      for (let i = 0; i < 2000 && approvalId === ''; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        approvalId = (await controlStores!.approvals.listOpenApprovals()).at(0)?.approvalId ?? '';
      }
      expect(approvalId).not.toBe('');
      // The approval metadata (the approver's own reason) carries a canary.
      const decided = await post(
        `/vict/v1/approvals/${approvalId}`,
        { decision: 'approved', reason: `operator sign-off ${APPROVAL_META_CANARY}` },
        'vict-token-approver',
        'e2e-canary-decide-1',
      );
      expect(decided.status).toBe(200);

      // ---- 3. The turn runs to an honest terminal state -------------------
      let turnStatus = '';
      for (let i = 0; i < 2000 && turnStatus === ''; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        const record = await controlStores!.turns.getTurn(turnId);
        if (record !== undefined && ['completed', 'failed', 'cancelled'].includes(record.status)) {
          turnStatus = record.status;
        }
      }
      expect(turnStatus).toBe('completed');

      // ---- 4. Unauthorized reads fail closed and echo nothing -------------
      const outsiderTurn = await get(`/vict/v1/turns/${turnId}`, 'vict-token-outsider');
      expect([403, 404]).toContain(outsiderTurn.status);
      expect(outsiderTurn.text).not.toContain(PROMPT_CANARY);
      expect(outsiderTurn.text).not.toContain(MODEL_CANARY);
      const outsiderStream = await fetch(`http://127.0.0.1:${port}/vict/v1/streams/${streamId}`, {
        headers: { authorization: 'Bearer vict-token-outsider' },
      });
      expect([403, 404]).toContain(outsiderStream.status);
      await outsiderStream.text();
      const malformed = await post('/vict/v1/changesets', '{broken json', 'vict-token-owner');
      expect(malformed.status).toBe(400);
      expect(malformed.text).not.toContain(PROMPT_CANARY);

      // ---- 5. SSE reconnect for the OWNER: durable replay -----------------
      const sse = await fetch(
        `http://127.0.0.1:${port}/vict/v1/streams/${streamId}?cursor=${encodeURIComponent(`v1:${streamId}:0`)}`,
        { headers: { authorization: 'Bearer vict-token-owner' } },
      );
      expect(sse.status).toBe(200);
      const frames = await sse.text();
      // The live text deltas are the INTENTIONAL user-visible surface.
      expect(frames).toContain('text.delta');
      // The tool failure crosses ONLY as its stable sanitized code (the
      // capability threw after possibly performing its effect: the
      // truthful, fenced outcome_unknown code is disclosed).
      expect(frames).toContain('VICT_CAPABILITY_OUTCOME_UNKNOWN');
      expect(frames).not.toContain('VICT_CAPABILITY_INVOCATION_FAILED');
      // The completed-content milestone carries a REFERENCE, not the text.
      expect(frames).toContain('content.completed');
      expect(frames).toContain('conversation:vict-actor-actor-user/');
      // NO operational canary may appear in any frame. The MODEL output
      // canary IS expected here: live-streamed deltas are the intentional,
      // authorized user-visible content surface (documented above).
      for (const canary of [
        PROMPT_CANARY,
        ARG_VALUE_CANARY,
        ARG_KEY_CANARY,
        CAPABILITY_ERROR_CANARY,
        CAUSE_CANARY,
        CREDENTIAL_VALUE_CANARY,
        CREDENTIAL_NAME_CANARY,
        APPROVAL_META_CANARY,
      ]) {
        expect(frames).not.toContain(canary);
      }
      expect(frames).toContain(MODEL_CANARY); // text.delta: user-visible output

      // ---- 6. Whole-control-store scan: operational rows hold no content --
      const bytes = controlDbBytes();
      for (const canary of [
        PROMPT_CANARY,
        MODEL_CANARY,
        ARG_KEY_CANARY,
        ARG_VALUE_CANARY,
        CAPABILITY_ERROR_CANARY,
        CAUSE_CANARY,
        CREDENTIAL_NAME_CANARY,
        CREDENTIAL_VALUE_CANARY,
      ]) {
        expect(bytes).not.toContain(canary);
      }
      // The approver's own decision reason is AUTHORIZED content for the
      // approval record (documented surface); nothing else leaks.
      const approval = await controlStores!.approvals.getApproval(approvalId);
      expect(approval?.decisionReason).toContain(APPROVAL_META_CANARY);
      // The tool arguments themselves are nowhere in the control store.
      expect(bytes).not.toContain(ARG_KEY_CANARY);
      expect(bytes).not.toContain(ARG_VALUE_CANARY);

      // ---- 7. The designated conversation domain holds the content --------
      const conversationBytes = conversationDbBytes();
      // The prompt and completed assistant content are INTENTIONALLY stored
      // in the actor-authorized conversation store (documented surface).
      expect(conversationBytes).toContain(PROMPT_CANARY);
      expect(conversationBytes).toContain(MODEL_CANARY);
      // Even the conversation domain must not retain capability errors,
      // causes, credentials, or approval metadata.
      for (const canary of [
        CAPABILITY_ERROR_CANARY,
        CAUSE_CANARY,
        CREDENTIAL_NAME_CANARY,
        CREDENTIAL_VALUE_CANARY,
        APPROVAL_META_CANARY,
      ]) {
        expect(conversationBytes).not.toContain(canary);
      }

      // ---- 8. Durable operational records: identities and digests only ----
      const invocations = await controlStores!.invocations.listInvocationsForTurn(turnId);
      expect(invocations.length).toBe(1);
      // The capability threw (its effect is unverifiable): the truthful
      // durable disposition is the fenced, non-replayable outcome_unknown.
      expect(invocations[0]?.status).toBe('outcome_unknown');
      expect(invocations[0]?.errorCode).toBe('VICT_CAPABILITY_OUTCOME_UNKNOWN');
      expect(invocations[0]?.argumentSummary).not.toContain(ARG_VALUE_CANARY);
      expect(invocations[0]?.argumentSummary).not.toContain(ARG_KEY_CANARY);
      const turnRecord = await controlStores!.turns.getTurn(turnId);
      expect(turnRecord?.inputSummary).toBe(
        'user-input:length=' + `summarize ${PROMPT_CANARY}`.length,
      );
      expect(turnRecord?.inputSummary).not.toContain(PROMPT_CANARY);
      const streamRows = await controlStores!.streamLedger.listEventsFrom(streamId, 0);
      for (const row of streamRows) {
        expect(row.payload).not.toContain(PROMPT_CANARY);
        expect(row.payload).not.toContain(MODEL_CANARY);
      }
    },
  );
});
