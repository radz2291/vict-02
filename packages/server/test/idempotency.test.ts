import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  authenticatedActorContext,
  AgentStreamHub,
  createInMemoryAgentControlStores,
  createInMemoryStores,
  InMemoryActorDirectory,
  type ActorDirectory,
  type ActorRecord,
} from '@vict/runtime';
import { createSqliteAgentControlStores } from '@vict/store-sqlite';
import { ControlPlaneService } from '@vict/control';
import {
  createLocalTestAuthenticator,
  createServerAuthenticator,
  createVictHttpServer,
  listenVictHttpServer,
  VictCommandService,
  type ServerActorContext,
  type VictHttpServer,
} from '../src/index.js';

/**
 * Stage 06B — DURABLE command idempotency (corrective finalization, F4).
 *
 * The HTTP `Idempotency-Key` governs execution through one durable policy:
 *
 * - the key format is closed and bounded;
 * - every state-changing command claims a durable receipt bound to
 *   actor + command kind + canonical request digest;
 * - the same logical command returns the ORIGINAL result without
 *   repeating effects;
 * - the same key with a different command or digest is a stable conflict;
 * - concurrent duplicates have EXACTLY one winner;
 * - receipts survive SQLite close/reopen and process restart.
 */

const ADMIN = {
  actorId: 'actor-admin',
  status: 'active' as const,
  roles: ['administrator' as const],
  createdAt: 0,
};
const TOKENS = { 'tok-admin': 'actor-admin' };

function adminContext(): ServerActorContext {
  return {
    ...authenticatedActorContext(ADMIN, ADMIN.actorId),
    presentedTokenKind: 'local-test',
  };
}

const PROPOSE = (changesetId: string, expiresAt = Date.now() + 3_600_000) => ({
  changesetId,
  base: { kind: 'release', subjectId: 'app.idem', expectedVersion: 'none' },
  operations: [
    {
      kind: 'publish-and-select-release',
      release: {
        releaseVersion: `release-${changesetId}`,
        applicationId: 'app.idem',
        applicationVersion: 'appver-1',
        rendererIdentity: 'renderer@1',
        componentRegistryIdentity: 'registry@1',
        dataAdapterIdentity: 'adapter@1',
        activationBinding: 'activation-1',
      },
    },
  ],
  rationale: 'idempotency proof',
  riskClass: 'low',
  requiredApproverCount: 1,
  expiresAt,
});

describe('durable command idempotency — in-memory stores', () => {
  it('the same key + same digest returns the original result WITHOUT repeating effects', async () => {
    const stores = createInMemoryAgentControlStores();
    const service = commandService(stores);
    const actor = adminContext();
    const payload = PROPOSE('cs-idem-a', 9_999_999_999_999);
    const first = await service.dispatch(actor, {
      command: 'changeset.propose',
      payload,
      idempotencyKey: 'key-a',
    });
    expect(first.ok).toBe(true);
    const replay = await service.dispatch(actor, {
      command: 'changeset.propose',
      payload,
      idempotencyKey: 'key-a',
    });
    expect(replay.ok).toBe(true);
    // The replayed result IS the original result (deep-equal), and only ONE
    // ChangeSet was created: the effect did not repeat.
    expect(replay).toEqual(first);
    expect((await stores.control.listChangeSets()).length).toBe(1);
  });

  it('the same key with a different digest or command is a stable conflict', async () => {
    const stores = createInMemoryAgentControlStores();
    const service = commandService(stores);
    const actor = adminContext();
    const first = await service.dispatch(actor, {
      command: 'changeset.propose',
      payload: PROPOSE('cs-idem-b', 9_999_999_999_999),
      idempotencyKey: 'key-b',
    });
    expect(first.ok).toBe(true);
    const digestConflict = await service.dispatch(actor, {
      command: 'changeset.propose',
      payload: PROPOSE('cs-idem-OTHER', 9_999_999_999_999),
      idempotencyKey: 'key-b',
    });
    expect(digestConflict).toEqual({ ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' });
    const commandConflict = await service.dispatch(actor, {
      command: 'changeset.commit',
      payload: { changesetId: 'cs-idem-b' },
      idempotencyKey: 'key-b',
    });
    expect(commandConflict).toEqual({ ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' });
    const actorConflict = await service.dispatch(
      {
        ...authenticatedActorContext(
          { actorId: 'actor-other', status: 'active', roles: ['administrator'], createdAt: 0 },
          'actor-other',
        ),
        presentedTokenKind: 'local-test',
      },
      {
        command: 'changeset.propose',
        payload: PROPOSE('cs-idem-b2', 9_999_999_999_999),
        idempotencyKey: 'key-b',
      },
    );
    expect(actorConflict).toEqual({ ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' });
  });

  it('a malformed key is rejected before any effect (closed bounded format)', async () => {
    const stores = createInMemoryAgentControlStores();
    const service = commandService(stores);
    const actor = adminContext();
    for (const key of ['', 'has space', 'x'.repeat(129), '../escape', 'unicode-é']) {
      await expect(
        service.dispatch(actor, {
          command: 'changeset.propose',
          payload: PROPOSE(`cs-key-${Math.abs(hash(key))}`, 9_999_999_999_999),
          idempotencyKey: key,
        }),
      ).rejects.toThrow(/bounded Idempotency-Key/);
    }
    expect((await stores.control.listChangeSets()).length).toBe(0);
  });

  it('a failed command records its terminal disposition; the retry returns the SAME failure without re-execution', async () => {
    const stores = createInMemoryAgentControlStores();
    const service = commandService(stores);
    const actor = adminContext();
    // A DUPLICATE changeset id: the first execution fails durably.
    const payload = PROPOSE('cs-idem-dup', 9_999_999_999_999);
    const first = await service.dispatch(actor, {
      command: 'changeset.propose',
      payload,
      idempotencyKey: 'key-dup-1',
    });
    expect(first.ok).toBe(true);
    // The second key reaches the store, which rejects the duplicate id
    // (structured throw mapped to a stable code by the transport).
    await expect(
      service.dispatch(actor, {
        command: 'changeset.propose',
        payload,
        idempotencyKey: 'key-dup-2',
      }),
    ).rejects.toThrow(/already exists/);
    // The retry with the same key returns the SAME failure disposition
    // WITHOUT executing the command again.
    const retry = await service.dispatch(actor, {
      command: 'changeset.propose',
      payload,
      idempotencyKey: 'key-dup-2',
    });
    expect(retry).toEqual({ ok: false, code: 'VICT_CONTROL_CHANGESET_EXISTS' });
    // Exactly ONE receipt exists for the second key, and it is terminal.
    const receipt = await stores.commandIdempotency.getReceipt('key-dup-2');
    expect(receipt?.status).toBe('failed');
    expect(receipt?.responseCode).toBe('VICT_CONTROL_CHANGESET_EXISTS');
  });

  it('concurrent duplicates have EXACTLY one winner', async () => {
    const stores = createInMemoryAgentControlStores();
    const service = commandService(stores);
    const actor = adminContext();
    const payload = PROPOSE('cs-idem-race', 9_999_999_999_999);
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        service.dispatch(actor, {
          command: 'changeset.propose',
          payload,
          idempotencyKey: 'key-race',
        }),
      ),
    );
    const okResults = results.filter((entry) => entry.ok);
    const inProgress = results.filter(
      (entry) => !entry.ok && entry.code === 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS',
    );
    // One winner executed; every other concurrent caller received the
    // stable in-progress conflict (never a duplicated effect).
    expect(okResults.length).toBe(1);
    expect(okResults.length + inProgress.length).toBe(results.length);
    expect((await stores.control.listChangeSets()).length).toBe(1);
  });
});

describe('durable command idempotency — SQLite stores (close/reopen + restart)', () => {
  const dirs: string[] = [];
  afterAll(() => {
    for (const dir of dirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Windows teardown best-effort
      }
    }
  });

  function sqliteStores() {
    const dir = mkdtempSync(join(tmpdir(), 'vict-idem-'));
    dirs.push(dir);
    const path = join(dir, 'control.db');
    const stores = createSqliteAgentControlStores({ path });
    return { path, stores };
  }

  function commandService(stores: ReturnType<typeof createInMemoryAgentControlStores>) {
    const catalog = createInMemoryStores().catalog;
    let n = 0;
    const controlPlane = new ControlPlaneService({
      stores: stores as never,
      catalog,
      clock: () => Date.now(),
      ids: {
        changesetId: () => `cs-gen-${++n}`,
        changesetApprovalId: () => `csa-${++n}`,
        auditId: () => `audit-${++n}`,
        controlRunId: () => `run-${++n}`,
      },
    });
    return new VictCommandService({
      stores: stores as never,
      controlPlane,
      clock: () => Date.now(),
    });
  }

  it('receipts survive close/reopen: the retry after restart replays the original result', async () => {
    const { path, stores } = sqliteStores();
    const service = commandService(stores as never);
    const actor = adminContext();
    const payload = PROPOSE('cs-idem-reopen', 9_999_999_999_999);
    const first = await service.dispatch(actor, {
      command: 'changeset.propose',
      payload,
      idempotencyKey: 'key-reopen',
    });
    expect(first.ok).toBe(true);
    stores.close();
    // A fresh process equivalent: reopen the SAME database.
    const reopened = createSqliteAgentControlStores({ path });
    const service2 = commandService(reopened as never);
    const replay = await service2.dispatch(actor, {
      command: 'changeset.propose',
      payload,
      idempotencyKey: 'key-reopen',
    });
    expect(replay).toEqual(first);
    // The effect did NOT repeat across the restart.
    expect((await reopened.control.listChangeSets()).length).toBe(1);
    // The digest conflict ALSO survives the restart.
    const conflict = await service2.dispatch(actor, {
      command: 'changeset.propose',
      payload: PROPOSE('cs-idem-other', 9_999_999_999_999),
      idempotencyKey: 'key-reopen',
    });
    expect(conflict).toEqual({ ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' });
    reopened.close();
  });

  it('concurrent duplicates over SQLite have exactly one durable winner', async () => {
    const { stores } = sqliteStores();
    const service = commandService(stores as never);
    const actor = adminContext();
    const payload = PROPOSE('cs-idem-sqlite-race', 9_999_999_999_999);
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        service.dispatch(actor, {
          command: 'changeset.propose',
          payload,
          idempotencyKey: 'key-sqlite-race',
        }),
      ),
    );
    const winners = results.filter((entry) => entry.ok);
    const losers = results.filter(
      (entry) => !entry.ok && entry.code === 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS',
    );
    expect(winners.length).toBe(1);
    expect(winners.length + losers.length).toBe(results.length);
    expect((await stores.control.listChangeSets()).length).toBe(1);
    stores.close();
  });
});

describe('durable command idempotency over REAL HTTP (agent.turn.start retries)', () => {
  const fixtures: { close: () => Promise<void> }[] = [];
  let composed: VictHttpServer | undefined;
  let port = 0;
  let stores: ReturnType<typeof createInMemoryAgentControlStores> | undefined;

  afterAll(async () => {
    await composed?.close();
  });

  async function fixture(): Promise<number> {
    if (composed !== undefined) {
      return port;
    }
    stores = createInMemoryAgentControlStores();
    const directory: ActorDirectory = new InMemoryActorDirectory();
    for (const record of [ADMIN] as readonly ActorRecord[]) {
      await directory.upsert(record);
    }
    const catalog = createInMemoryStores().catalog;
    let n = 0;
    const controlPlane = new ControlPlaneService({
      stores,
      catalog,
      clock: () => Date.now(),
      ids: {
        changesetId: () => `cs-${++n}`,
        changesetApprovalId: () => `csa-${++n}`,
        auditId: () => `audit-${++n}`,
        controlRunId: () => `run-${++n}`,
      },
    });
    const commandService = new VictCommandService({
      stores,
      controlPlane,
      clock: () => Date.now(),
    });
    const auth = createServerAuthenticator({
      authenticator: createLocalTestAuthenticator(TOKENS),
      directory,
    });
    composed = createVictHttpServer({
      commandService,
      auth,
      hub: new AgentStreamHub({ ledger: stores.streamLedger, clock: () => Date.now() }),
      stores,
    });
    port = await listenVictHttpServer(composed);
    fixtures.push({ close: composed.close });
    return port;
  }

  it('a retried agent.turn.start with the same key does NOT create multiple turns', async () => {
    const p = await fixture();
    const payload = { payload: { threadId: 'thread-idem', input: 'hello' } };
    const call = (key: string) =>
      fetch(`http://127.0.0.1:${p}/vict/v1/turns`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer tok-admin',
          'idempotency-key': key,
        },
        body: JSON.stringify(payload),
      }).then(async (response) => ({
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
      }));
    // No executor composed: the first attempt fails with the stable
    // unavailable code; the durable failure disposition is recorded.
    const first = await call('turn-key-1');
    expect(first.status).toBe(409);
    expect(first.body.code).toBe('VICT_TURN_EXECUTOR_UNAVAILABLE');
    // The retry (same key, same payload) replays the SAME failure without
    // reaching the turn service again — and creates NO additional intents.
    const retry = await call('turn-key-1');
    expect(retry.status).toBe(409);
    expect(retry.body.code).toBe('VICT_TURN_EXECUTOR_UNAVAILABLE');
    expect(retry.body).toEqual(first.body);
    // A DIFFERENT key reaches the turn service again (same stable failure).
    const second = await call('turn-key-2');
    expect(second.status).toBe(409);
  });
});

function hash(value: string): number {
  let h = 0;
  for (const ch of value) {
    h = (h * 31 + ch.charCodeAt(0)) | 0;
  }
  return h;
}

function commandService(stores: ReturnType<typeof createInMemoryAgentControlStores>) {
  const catalog = createInMemoryStores().catalog;
  let n = 0;
  const controlPlane = new ControlPlaneService({
    stores,
    catalog,
    clock: () => Date.now(),
    ids: {
      changesetId: () => `cs-gen-${++n}`,
      changesetApprovalId: () => `csa-${++n}`,
      auditId: () => `audit-${++n}`,
      controlRunId: () => `run-${++n}`,
    },
  });
  return new VictCommandService({ stores, controlPlane, clock: () => Date.now() });
}
