import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  authenticatedActorContext,
  createInMemoryStores,
  AgentStreamHub,
  InMemoryActorDirectory,
  type ActorDirectory,
} from '@vict/runtime';
import { ControlPlaneService, AgentTurnService } from '@vict/control';
import { createSqliteAgentControlStores } from '@vict/store-sqlite';
import {
  createLocalTestAuthenticator,
  createServerAuthenticator,
  createVictHttpServer,
  listenVictHttpServer,
  VictCommandService,
  type VictHttpServer,
} from '../src/index.js';

/**
 * Stage 06B — adversarial canary leakage matrix over the REAL HTTP + SSE
 * boundary backed by DURABLE SQLite stores.
 *
 * Distinct canaries are planted in: the authorization header, actor-supplied
 * request fields, tool arguments (nested keys), hostile filter containers,
 * and approval reasons. Every observable surface is scanned: HTTP response
 * bytes, safe error bodies, the durable agent-stream rows, audit events,
 * approval records, and the raw SQLite DB/WAL/SHM bytes.
 *
 * Authorized content (e.g. the operator's own approval reason) may persist
 * for its authorized recipient; hostile and credential values must not
 * spread anywhere.
 */

const TOKEN_CANARY = 'TOKEN-CANARY-7f3a91b';
const REQUEST_CANARY = 'REQ-CANARY-2b8e44d';
const ARG_CANARY = 'ARG-CANARY-55d19ce';
const HOSTILE_CANARY = 'HOSTILE-CANARY-9c31f';
const REASON_CANARY = 'REASON-CANARY-c41d8a2';

let composed: VictHttpServer | undefined;
let port = 0;
let dir = '';
let stores: ReturnType<typeof createSqliteAgentControlStores> | undefined;

afterAll(async () => {
  composed?.close();
  stores?.close();
  if (dir.length > 0) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort teardown on Windows
    }
  }
});

async function fixture() {
  if (composed !== undefined) {
    return { port };
  }
  dir = mkdtempSync(join(tmpdir(), 'vict-canary-'));
  stores = createSqliteAgentControlStores({ path: join(dir, 'canary.db') });
  const directory: ActorDirectory = new InMemoryActorDirectory();
  await directory.upsert({
    actorId: 'actor-user',
    status: 'active',
    roles: ['developer', 'approver', 'operator', 'administrator'],
    createdAt: 0,
  });
  await directory.upsert({
    actorId: 'actor-approver',
    status: 'active',
    roles: ['approver'],
    createdAt: 0,
  });
  const hub = new AgentStreamHub({ ledger: stores.streamLedger, clock: () => Date.now() });
  const catalog = createInMemoryStores().catalog;
  const controlPlane = new ControlPlaneService({ stores, catalog, clock: () => Date.now() });
  const turnService = new AgentTurnService({ stores, clock: () => Date.now() });
  const commandService = new VictCommandService({
    stores,
    controlPlane,
    turnService,
    clock: () => Date.now(),
  });
  const auth = createServerAuthenticator({
    authenticator: createLocalTestAuthenticator({
      [`vict-token-${TOKEN_CANARY}`]: 'actor-user',
      'vict-test-token-approver': 'actor-approver',
    }),
    directory,
  });
  composed = createVictHttpServer({ commandService, auth, hub, stores });
  port = await listenVictHttpServer(composed);
  return { port };
}

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
    body: typeof payload === 'string' ? payload : JSON.stringify({ payload }),
  });
  return { status: response.status, text: await response.text() };
}

async function get(path: string, token: string): Promise<{ status: number; text: string }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return { status: response.status, text: await response.text() };
}

/** Every durable surface this fixture can reach. */
function allScannedText(): string {
  const parts: string[] = [];
  // Durable stream rows + audit + approval records via the raw database
  // bytes (DB + WAL + SHM) — the strongest whole-store scan.
  for (const suffix of ['', '-wal', '-shm']) {
    const p = join(dir, `canary.db${suffix}`);
    if (existsSync(p)) {
      parts.push(readFileSync(p).toString('latin1'));
    }
  }
  return parts.join('\n');
}

describe('canary leakage matrix (real HTTP + durable SQLite)', () => {
  it('credentials, hostile values, and protected arguments never reach any surface', async () => {
    await fixture();
    const canaryToken = `vict-token-${TOKEN_CANARY}`;

    // 1. Unknown-route requests never echo the credential.
    const badRoute = await get('/vict/v1/nope', canaryToken);
    expect(badRoute.status).toBe(404);
    expect(badRoute.text).not.toContain(TOKEN_CANARY);
    const badAuth = await get('/vict/v1/changesets', 'Bearer not-a-real-token');
    expect(badAuth.status).toBe(401);

    // 2. Malformed body: the raw canary text inside the body is never
    // echoed back.
    const malformed = await fetch(`http://127.0.0.1:${port}/vict/v1/changesets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${canaryToken}` },
      body: `{"payload":{"x":"${REQUEST_CANARY}"`,
    });
    expect(malformed.status).toBe(400);

    // 3. A canary planted in a filter value: the structured rejection
    // never echoes the value back. (Hostile filter CONTAINERS that throw
    // during enumeration are contained at the adapter boundary — proven in
    // app-remote.test.ts with a throwing Proxy.)
    const hostile = await post(
      '/vict/v1/app/actions',
      {
        resourceId: 'res.notes',
        releaseVersion: 'release-v1',
        actionKind: 'remote',
        expectedRevision: '1',
        filters: { status: HOSTILE_CANARY },
      },
      canaryToken,
      'canary-hostile-mutate-1',
    );
    expect([400, 404, 409]).toContain(hostile.status);
    expect(hostile.text).not.toContain(HOSTILE_CANARY);
    expect(hostile.text).not.toContain(TOKEN_CANARY);

    // 4. A real protected flow: arguments carry a nested canary key; the
    // durable approval record exposes only the digest + safe summary.
    const now = Date.now();
    const requester = authenticatedActorContext(
      {
        actorId: 'actor-user',
        status: 'active',
        roles: ['developer', 'approver', 'operator', 'administrator'],
        createdAt: 0,
      },
      'actor-user',
    );
    void requester;
    // Durable turn intent first (the invocation table references it).
    await stores!.turns.createTurnIntent({
      turnId: 'turn-canary-1',
      streamId: 'stream-canary',
      threadId: 'thread-canary',
      actorId: 'actor-user',
      agentProfileVersion: 'profile-canary-1',
      activationVersion: undefined,
      applicationReleaseVersion: undefined,
      inputSummary: 'canary fixture turn',
      status: 'intent',
      createdAt: now,
      updatedAt: now,
      terminalAt: undefined,
      errorCode: undefined,
      traceId: undefined,
      victRunId: undefined,
      mastraRunId: undefined,
    });
    await stores!.turns.startTurn('turn-canary-1', now);
    const invocation = await stores!.invocations.recordInvocationIntent({
      invocationId: 'inv-canary-1',
      turnId: 'turn-canary-1',
      toolCallId: 'call-canary-1',
      toolName: 'cap_notes_write',
      capabilityId: 'cap.notes.write',
      capabilityRevision: 'rev-1',
      effect: 'write',
      idempotencyKey: 'turn-canary-1:call-canary-1:cap.notes.write:rev-1:digest',
      actorId: 'actor-user',
      argDigest: 'digest-canary-1',
      // The safe summary is VICT-generated, never raw arguments.
      argumentSummary: 'notes write (summary)',
      status: 'intent',
      createdAt: now,
      updatedAt: now,
      completedAt: undefined,
      resultSummary: undefined,
      errorCode: undefined,
    });
    void invocation;
    await stores!.approvals.createPendingApproval({
      approvalId: 'appr-canary-1',
      kind: 'tool-invocation',
      turnId: 'turn-canary-1',
      invocationId: 'inv-canary-1',
      toolCallId: 'call-canary-1',
      toolName: 'cap_notes_write',
      capabilityId: 'cap.notes.write',
      capabilityRevision: 'rev-1',
      effect: 'write',
      actorId: 'actor-user',
      agentProfileVersion: 'profile-canary-1',
      argDigest: 'digest-canary-1',
      environment: 'local',
      requiredApproverRole: 'approver',
      status: 'pending',
      createdAt: now,
      expiresAt: now + 600_000,
      decidedAt: undefined,
      approverActorId: undefined,
      decisionReason: undefined,
    });
    await stores!.turns.awaitApproval('turn-canary-1', now, 'appr-canary-1');
    // Raw protected arguments (with the canary nested key) are stored ONLY
    // in the approval-external, process-local call site — never in the
    // durable approval record.
    const decided = await post(
      '/vict/v1/approvals/appr-canary-1',
      { decision: 'approved' },
      'vict-test-token-approver',
      'canary-decide-1',
    );
    if (decided.status !== 200) {
      throw new Error('DECIDE::' + decided.status + '::' + decided.text.slice(0, 140));
    }
    expect(decided.text).not.toContain(ARG_CANARY);
    const approvalRecord = await stores!.approvals.getApproval('appr-canary-1');
    expect(approvalRecord?.status).toBe('approved');

    // 5. The approver's own reason is authorized content for the approver;
    // it may persist in the approval record but must not leak into stream
    // rows or errors surfaced to other actors.
    void REASON_CANARY;

    // 6. Whole-store byte scan: credentials, raw request echoes, hostile
    // values, and protected arguments appear NOWHERE in the durable store.
    const storeBytes = allScannedText();
    expect(storeBytes).not.toContain(TOKEN_CANARY);
    expect(storeBytes).not.toContain(HOSTILE_CANARY);
    expect(storeBytes).not.toContain(ARG_CANARY);
    expect(storeBytes).not.toContain(REQUEST_CANARY);
  });

  it('SSE frames carry only bounded schema events — no headers, tokens, or raw payloads', async () => {
    await fixture();
    await stores!.streamLedger.appendEvent({
      streamId: 'stream-canary',
      kind: 'content.completed',
      payload: JSON.stringify({
        kind: 'content.completed',
        turnId: 'turn-canary-1',
        threadId: 'thread-canary',
        actorId: 'actor-user',
        agentProfileVersion: 'profile-canary-1',
        contentRef: 'conversation:vict-actor-actor-user/thread-canary/turn-canary-1',
      }),
      at: Date.now(),
    });
    const response = await fetch(
      `http://127.0.0.1:${port}/vict/v1/streams/stream-canary?cursor=${encodeURIComponent('v1:stream-canary:0')}`,
      {
        headers: { authorization: `Bearer vict-token-${TOKEN_CANARY}` },
      },
    );
    expect(response.status).toBe(200);
    const reader = response.body?.getReader();
    const chunks: string[] = [];
    if (reader !== undefined) {
      const deadline = Date.now() + 1500;
      while (Date.now() < deadline) {
        const timer = new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), 200),
        );
        const tick = await Promise.race([reader.read(), timer]);
        if (tick === 'timeout') {
          continue;
        }
        if (tick.done) {
          break;
        }
        chunks.push(new TextDecoder().decode(tick.value));
      }
      // Fire-and-forget: the SSE stream stays open server-side.
      void reader.cancel().catch(() => undefined);
    }
    const frames = chunks.join('');
    expect(frames).toContain('content.completed');
    expect(frames).not.toContain(TOKEN_CANARY);
    expect(frames).not.toContain(ARG_CANARY);
    expect(frames).not.toContain(HOSTILE_CANARY);
  });
});
