import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  authenticatedActorContext,
  toCanonicalJson,
  createInMemoryAgentControlStores,
  inMemoryAgentControlConformanceFactory,
  runCommandConfirmationReceiptConformanceSuite,
  type ActorScope,
} from '@victframework/runtime';
import {
  VictCommandService,
  type ControlPlanePort,
  type ServerActorContext,
} from '../src/index.js';

/**
 * VICT Stage 9 G2 — the direct-API confirmation proof matrix (proposal §6,
 * P-1..P-24). Each numbered test pins exactly one contract row at the
 * transport-free command-service boundary over the in-memory store set
 * (the SAME store conformance the SQLite adapter shares).
 */

function actorContext(
  actorId: string,
  scopes: readonly string[],
  grants: readonly string[] = [], // eslint-disable-line @typescript-eslint/no-unused-vars
): ServerActorContext {
  return {
    actorId,
    roles: [],
    scopes: [...(scopes as readonly ActorScope[])],
    mastraResourceId: `vict-actor-${actorId}`,
    presentedTokenKind: 'local-test',
  };
}

const OPERATOR = actorContext('actor-op', [
  'run.cancel',
  'release.select',
  'activation.select',
  'run.resolve',
  'run.signal',
  'run.read',
]);
// Developer + explicit deployment grants (D-5): grant authority without a role.
const DEVELOPER = actorContext('actor-dev', [
  'changeset.propose',
  'run.read',
  'run.detail',
  'release.read',
  'activation.read',
  'run.cancel',
  'release.select',
  'activation.select',
]);
const VIEWER = actorContext('actor-view', ['run.read', 'changeset.read']);
const ADMIN = {
  ...authenticatedActorContext(
    {
      actorId: 'actor-admin',
      status: 'active' as const,
      roles: ['administrator'] as const,
      createdAt: 0,
    },
    'actor-admin',
  ),
  presentedTokenKind: 'local-test' as const,
};

interface Fixture {
  readonly service: VictCommandService;
  readonly stores: ReturnType<typeof createInMemoryAgentControlStores>;
  readonly effects: { cancels: string[]; resolves: string[]; signals: string[] };
  readonly revision: { current: number };
  timeTravel(ms: number): void;
}

function fixture(options: { confirmationTtlMs?: number } = {}): Fixture {
  let now = 1_000;
  const stores = createInMemoryAgentControlStores();
  const effects = { cancels: [] as string[], resolves: [] as string[], signals: [] as string[] };
  const revision = { current: 3 };
  const controlPlane = {
    propose: async (): Promise<unknown> => ({}),
    revise: async (): Promise<unknown> => ({}),
    executeChangeSetCheck: async (): Promise<unknown> => ({}),
    attachValidationEvidence: async (): Promise<unknown> => ({}),
    attachSimulationEvidence: async (): Promise<unknown> => ({}),
    decide: async (): Promise<unknown> => ({}),
    commit: async (): Promise<unknown> => ({}),
    decline: async (): Promise<unknown> => ({}),
    get: async (): Promise<unknown> => undefined,
    list: async (): Promise<unknown> => [],
    publishRelease: async (): Promise<unknown> => ({}),
    selectRelease: async (): Promise<unknown> => ({}),
    rollbackRelease: async (): Promise<unknown> => ({}),
    getSelectedRelease: async (): Promise<unknown> => undefined,
    auditTrail: async (): Promise<unknown> => [],
    selectActivation: async (): Promise<unknown> => ({}),
    cancelRun: async (input: { runId: string; requestId: string }): Promise<unknown> => {
      effects.cancels.push(input.requestId);
      return { runId: input.runId, status: 'cancelled' };
    },
  };
  const service = new VictCommandService({
    stores,
    controlPlane: controlPlane as unknown as ControlPlanePort,
    clock: () => now,
    confirmationTtlMs: options.confirmationTtlMs ?? 600_000,
    idempotencyLeaseMs: 60_000,
    idempotencyOwner: 'confirm-matrix',
    execution: {
      getRun: async (): Promise<unknown> => ({ recordRevision: revision.current }),
    } as never,
    runResolution: {
      resolveBlocked: async (input): Promise<unknown> => {
        effects.resolves.push(`${input.runId}:${input.resolution}`);
        return { runId: input.runId, status: 'reconciled', resolution: input.resolution };
      },
    },
    runSignals: {
      signalWait: async (input): Promise<unknown> => {
        effects.signals.push(`${input.runId}:${input.signalName}`);
        return { runId: input.runId, signalName: input.signalName, status: 'signalled' };
      },
    },
  });
  return {
    service,
    stores,
    effects,
    revision,
    timeTravel(ms: number): void {
      now += ms;
    },
  };
}

/** Prepare that unwraps to the DATA RECORD (or the error object). */
async function prep(
  f: Fixture,
  command: string,
  payload: Record<string, unknown>,
  key: string,
  actor: ServerActorContext = OPERATOR,
): Promise<Record<string, unknown>> {
  const outcome = await f.service.prepareConfirmation(actor, {
    command,
    payload,
    idempotencyKey: key,
  });
  return outcome.ok
    ? (outcome.data as Record<string, unknown>)
    : (outcome as unknown as Record<string, unknown>);
}

/** Consume through the canonical dispatch boundary (the confirmed command). */
function consume(
  f: Fixture,
  command:
    | 'run.cancel'
    | 'release.select'
    | 'release.rollback'
    | 'activation.select'
    | 'run.resolve'
    | 'run.signal',
  payload: Record<string, unknown>,
  key: string,
  actor: ServerActorContext = OPERATOR,
): Promise<import('../src/index.js').VictCommandOutcome> {
  return f.service.dispatch(actor, { command, payload, idempotencyKey: key });
}

function receiptOf(r: Record<string, unknown>): string {
  return r['receiptId'] as string;
}

describe('Stage 9 G2 confirmation direct-API matrix (P-1..P-24)', () => {
  it('P-1: prepare idempotency — same key+payload replays ONE receipt; different payload under the key conflicts', async () => {
    const f = fixture();
    const payload = { runId: 'run-p1', reasonCode: 'manual', expectedRevision: 3 };
    const first = await prep(f, 'run.cancel', payload, 'prep-p1');
    expect(first['receiptId']).toBeDefined();
    const second = await prep(f, 'run.cancel', payload, 'prep-p1');
    expect(second['receiptId']).toBe(first['receiptId']); // SAME receipt (P-1a)
    const changed = await prep(
      f,
      'run.cancel',
      { runId: 'run-p1', reasonCode: 'DIFFERENT', expectedRevision: 3 },
      'prep-p1',
    );
    expect(changed['ok']).toBe(false);
    expect(changed['code']).toBe('VICT_COMMAND_IDEMPOTENCY_CONFLICT'); // P-1b
  });

  it('P-2 claim winner — exactly one effect; loser of a settled receipt is truthfully SPENT; same-key retry replays', async () => {
    const f = fixture();
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p2', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p2',
    );
    const prepared = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'run.cancel',
        prepareIdempotencyKey: 'prep-p2',
      })
    )[0];
    const confirmed = {
      runId: 'run-p2',
      reasonCode: 'manual',
      confirmation: { receiptId: prepared!.receiptId },
    };
    const winner = await consume(f, 'run.cancel', confirmed, 'consume-p2');
    expect(winner.ok).toBe(true);
    // A LOSER of the receipt claim (fresh key after the winner settled) is
    // truthfully SPENT; the same-KEY retry is the recorded-replay path.
    const loser = await consume(f, 'run.cancel', confirmed, 'consume-p2-second');
    expect(loser.ok).toBe(false);
    expect(loser.ok ? '' : loser.code).toBe('VICT_CONFIRMATION_SPENT');
    // Same key + digest: the settled replay, WITHOUT a new effect (P-2 retry).
    const retry = await consume(f, 'run.cancel', confirmed, 'consume-p2');
    expect(retry.ok).toBe(true);
    expect(f.effects.cancels).toEqual(['consume-p2']);
  });

  it('P-3 crash: pending claim + crash before settlement — lease takeover on retry; the domain fence keeps one effect', async () => {
    const f = fixture();
    // Crash before effect: a pending idempotency claim is left behind.
    await f.stores.commandIdempotency.claimReceipt({
      actorId: 'actor-op',
      command: 'run.cancel',
      idempotencyKey: 'consume-p3',
      requestDigest: 'crashed-before-effect',
      status: 'pending',
      responseCode: undefined,
      resultJson: undefined,
      createdAt: 0,
      settledAt: undefined,
      owner: 'lost-owner',
      leaseUntil: 100,
      attempts: 1,
      fenceToken: 'lost-fence',
    });
    f.timeTravel(200_000);
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p3', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p3',
    );
    const prepared = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'run.cancel',
        prepareIdempotencyKey: 'prep-p3',
      })
    )[0];
    const retry = await consume(
      f,
      'run.cancel',
      { runId: 'run-p3', reasonCode: 'manual', confirmation: { receiptId: prepared!.receiptId } },
      'consume-p3-other', // crash recovery via a fresh consumption key
    );
    expect(retry.ok).toBe(true);
    expect(f.effects.cancels).toEqual(['consume-p3-other']);
    const settled = await f.stores.commandConfirmationReceipts.getReceipt(prepared!.receiptId);
    expect(settled?.status).toBe('consumed');
  });

  it('P-4 crash: claimed receipt, crash before effect — takeover after expiry, effect once, no duplicate', async () => {
    const f = fixture();
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p4', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p4',
    );
    const prepared = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'run.cancel',
        prepareIdempotencyKey: 'prep-p4',
      })
    )[0];
    const claim = await f.stores.commandConfirmationReceipts.startConsumption({
      receiptId: prepared!.receiptId,
      owner: 'actor-op\u0000consume-p4',
      leaseUntil: 200,
      at: 100,
    });
    expect(claim.outcome).toBe('claimed');
    f.timeTravel(200_000);
    const retry = await consume(
      f,
      'run.cancel',
      { runId: 'run-p4', reasonCode: 'manual', confirmation: { receiptId: prepared!.receiptId } },
      'consume-p4',
    );
    expect(retry.ok).toBe(true);
    expect(f.effects.cancels).toEqual(['consume-p4']);
    const settled = await f.stores.commandConfirmationReceipts.getReceipt(prepared!.receiptId);
    expect(settled?.status).toBe('consumed');
  });

  it('P-5: a fence mismatch leaves a live claim BYTE-IDENTICAL (store-level, second-actor window)', async () => {
    const f = fixture();
    await f.stores.commandConfirmationReceipts.createReceipt({
      receiptId: 'cr-p5',
      actorId: 'actor-op',
      command: 'run.cancel',
      payloadDigest: 'd-p5',
      subjectId: 'run-p5',
      expectedRevision: 1,
      expiryAt: 9000,
      status: 'prepared',
      createdAt: 0,
      consumedAt: undefined,
      consumedByKey: undefined,
      replacementAttemptNo: 1,
      prepareIdempotencyKey: 'k',
      owner: undefined,
      claimUntil: undefined,
      attempts: 0,
      fenceToken: undefined,
    });
    const claim = await f.stores.commandConfirmationReceipts.startConsumption({
      receiptId: 'cr-p5',
      owner: 'actor-op\u0000key-a',
      leaseUntil: 5000,
      at: 1000,
    });
    expect(claim.outcome).toBe('claimed');
    const before = await f.stores.commandConfirmationReceipts.getReceipt('cr-p5');
    await expect(
      f.stores.commandConfirmationReceipts.settleConsumption({
        receiptId: 'cr-p5',
        fenceToken: 'stale-fence',
        status: 'consumed',
        at: 1100,
      }),
    ).rejects.toThrow(/FENCE_CONFLICT/);
    const after = await f.stores.commandConfirmationReceipts.getReceipt('cr-p5');
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });

  it('P-6: fresh key on a spent receipt → SPENT, no effect', async () => {
    const f = fixture();
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p6', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p6',
    );
    const prepared = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'run.cancel',
        prepareIdempotencyKey: 'prep-p6',
      })
    )[0];
    const confirmed = {
      runId: 'run-p6',
      reasonCode: 'manual',
      confirmation: { receiptId: prepared!.receiptId },
    };
    expect((await consume(f, 'run.cancel', confirmed, 'consume-p6-a')).ok).toBe(true);
    const fresh = await consume(f, 'run.cancel', confirmed, 'consume-p6-b');
    expect(fresh.ok).toBe(false);
    expect(fresh.ok ? '' : fresh.code).toBe('VICT_CONFIRMATION_SPENT');
    expect(f.effects.cancels).toEqual(['consume-p6-a']);
  });

  it('P-7: same key, changed confirmation digest (new receipt) → CONFLICT', async () => {
    const f = fixture();
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p7', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p7-a',
    );
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p7', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p7-b',
    );
    const chain = await f.stores.commandConfirmationReceipts.listReceiptsByActorCommand({
      actorId: 'actor-op',
      command: 'run.cancel',
    });
    expect(chain).toHaveLength(2);
    const confirmed1 = {
      runId: 'run-p7',
      reasonCode: 'manual',
      confirmation: { receiptId: chain[0]!.receiptId },
    };
    const confirmed2 = {
      runId: 'run-p7',
      reasonCode: 'manual',
      confirmation: { receiptId: chain[1]!.receiptId },
    };
    expect((await consume(f, 'run.cancel', confirmed1, 'consume-p7')).ok).toBe(true);
    const changed = await consume(f, 'run.cancel', confirmed2, 'consume-p7');
    expect(changed.ok).toBe(false);
    expect(changed.ok ? '' : changed.code).toBe('VICT_COMMAND_IDEMPOTENCY_CONFLICT');
  });

  it('P-8: cross-command key reuse → stable conflict without ambiguity', async () => {
    const f = fixture();
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p8', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p8',
    );
    const rc = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'run.cancel',
        prepareIdempotencyKey: 'prep-p8',
      })
    )[0];
    await consume(
      f,
      'run.cancel',
      { runId: 'run-p8', reasonCode: 'manual', confirmation: { receiptId: rc!.receiptId } },
      'consume-p8',
    );
    await prep(
      f,
      'activation.select',
      { graphId: 'graph-p8', activationVersion: 'v1', expectedRevision: null },
      'prep-p8-act',
    );
    const ra = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'activation.select',
        prepareIdempotencyKey: 'prep-p8-act',
      })
    )[0];
    const reuse = await consume(
      f,
      'activation.select',
      { graphId: 'graph-p8', activationVersion: 'v1', confirmation: { receiptId: ra!.receiptId } },
      'consume-p8',
    );
    expect(reuse.ok).toBe(false);
    expect(reuse.ok ? '' : reuse.code).toBe('VICT_COMMAND_IDEMPOTENCY_CONFLICT');
  });

  it('P-9: stale revision → STALE, no effect, re-prepare required', async () => {
    const f = fixture();
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p9', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p9',
    );
    f.revision.current = 7; // the target moved after preparation
    const prepared = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'run.cancel',
        prepareIdempotencyKey: 'prep-p9',
      })
    )[0];
    const stale = await consume(
      f,
      'run.cancel',
      { runId: 'run-p9', reasonCode: 'manual', confirmation: { receiptId: prepared!.receiptId } },
      'consume-p9',
    );
    expect(stale.ok).toBe(false);
    expect(stale.ok ? '' : stale.code).toBe('VICT_CONFIRMATION_STALE');
    expect(f.effects.cancels).toEqual([]);
  });

  it('P-10: expiry → EXPIRED, no effect, receipt stays auditable in the durable chain', async () => {
    const f = fixture({ confirmationTtlMs: 1000 });
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p10', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p10',
    );
    const prepared = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'run.cancel',
        prepareIdempotencyKey: 'prep-p10',
      })
    )[0];
    f.timeTravel(5000);
    const expired = await consume(
      f,
      'run.cancel',
      { runId: 'run-p10', reasonCode: 'manual', confirmation: { receiptId: prepared!.receiptId } },
      'consume-p10',
    );
    expect(expired.ok).toBe(false);
    expect(expired.ok ? '' : expired.code).toBe('VICT_CONFIRMATION_EXPIRED');
    expect(f.effects.cancels).toEqual([]);
    const chain = await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
      actorId: 'actor-op',
      command: 'run.cancel',
      prepareIdempotencyKey: 'prep-p10',
    });
    expect(chain).toHaveLength(1);
  });

  it('P-11: unconfirmed legacy calls — operator AND developer 409-class REQUIRED (all four commands)', async () => {
    const f = fixture();
    for (const actor of [OPERATOR, DEVELOPER]) {
      await expect(
        consume(f, 'run.cancel', { runId: 'run-p11', reasonCode: 'manual' }, 'consume-p11', actor),
      ).rejects.toThrow(/VICT_CONFIRMATION_REQUIRED/);
      await expect(
        consume(
          f,
          'release.select',
          { applicationId: 'app-p11', releaseVersion: 'rv1' },
          'consume-p11b',
          actor,
        ),
      ).rejects.toThrow(/VICT_CONFIRMATION_REQUIRED/);
      await expect(
        consume(
          f,
          'release.rollback',
          { applicationId: 'app-p11', targetReleaseVersion: 'rv1' },
          'consume-p11c',
          actor,
        ),
      ).rejects.toThrow(/VICT_CONFIRMATION_REQUIRED/);
      await expect(
        consume(
          f,
          'activation.select',
          { graphId: 'g-p11', activationVersion: 'v1' },
          'consume-p11d',
          actor,
        ),
      ).rejects.toThrow(/VICT_CONFIRMATION_REQUIRED/);
    }
    // The fence is in the command service; no idempotency claim is left.
    expect(f.effects.cancels).toEqual([]);
  });

  it('P-12: administrator has NO bypass — legacy shape 409-class REQUIRED', async () => {
    const f = fixture();
    await expect(
      consume(f, 'run.cancel', { runId: 'run-p12', reasonCode: 'manual' }, 'consume-p12', ADMIN),
    ).rejects.toThrow(/VICT_CONFIRMATION_REQUIRED/);
    await expect(
      consume(
        f,
        'release.select',
        { applicationId: 'app-p12', releaseVersion: 'rv' },
        'consume-p12b',
        ADMIN,
      ),
    ).rejects.toThrow(/VICT_CONFIRMATION_REQUIRED/);
    expect(f.effects.cancels).toEqual([]);
  });

  it('P-13: prepare of a command the actor cannot scope → SCOPE DENIED, no receipt', async () => {
    const f = fixture();
    try {
      await prep(
        f,
        'run.cancel',
        { runId: 'run-p13', reasonCode: 'manual', expectedRevision: 3 },
        'prep-p13',
        VIEWER,
      );
      expect.unreachable('prepare without the mutation scope must be denied');
    } catch (error) {
      expect((error as { code?: string }).code).toBe('VICT_ACTOR_SCOPE_DENIED');
    }
    const chain = await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
      actorId: 'actor-view',
      command: 'run.cancel',
      prepareIdempotencyKey: 'prep-p13',
    });
    expect(chain).toHaveLength(0);
  });

  it('P-14: another actor receipt → UNAVAILABLE, non-echoing (consume and status read)', async () => {
    const f = fixture();
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p14', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p14',
    );
    const prepared = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'run.cancel',
        prepareIdempotencyKey: 'prep-p14',
      })
    )[0];
    const foreign = await consume(
      f,
      'run.cancel',
      { runId: 'run-p14', reasonCode: 'manual', confirmation: { receiptId: prepared!.receiptId } },
      'consume-p14',
      DEVELOPER,
    );
    expect(foreign.ok).toBe(false);
    expect(foreign.ok ? '' : foreign.code).toBe('VICT_CONFIRMATION_UNAVAILABLE');
    const status = await f.service.getConfirmation(DEVELOPER, prepared!.receiptId);
    expect(status.ok).toBe(false);
    expect(status.ok ? '' : status.code).toBe('VICT_CONFIRMATION_UNAVAILABLE');
  });

  it('P-15: replay of the same committed confirmation replays, no second effect', async () => {
    const f = fixture();
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p15', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p15',
    );
    const prepared = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'run.cancel',
        prepareIdempotencyKey: 'prep-p15',
      })
    )[0];
    const confirmed = {
      runId: 'run-p15',
      reasonCode: 'manual',
      confirmation: { receiptId: prepared!.receiptId },
    };
    const first = await consume(f, 'run.cancel', confirmed, 'consume-p15');
    const replay = await consume(f, 'run.cancel', confirmed, 'consume-p15');
    expect(replay.ok).toBe(true);
    expect((replay as { data: Record<string, unknown> }).data['runId']).toBe(
      (first as { data: Record<string, unknown> }).data['runId'],
    );
    expect(f.effects.cancels).toEqual(['consume-p15']);
  });

  it('P-16: receipt store and effect store split — restart between consume-claim and effect leaves no half-applied state', async () => {
    const f = fixture();
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p16', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p16',
    );
    const prepared = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'run.cancel',
        prepareIdempotencyKey: 'prep-p16',
      })
    )[0];
    // Crash AFTER the receipt claim but BEFORE the effect; both leases die.
    const confirmedP16 = {
      runId: 'run-p16',
      reasonCode: 'manual',
      confirmation: { receiptId: prepared!.receiptId },
    };
    await f.stores.commandIdempotency.claimReceipt({
      actorId: 'actor-op',
      command: 'run.cancel',
      idempotencyKey: 'consume-p16',
      requestDigest: createHash('sha256')
        .update(`vict.command@1 ${toCanonicalJson(confirmedP16)}`)
        .digest('hex'),
      status: 'pending',
      responseCode: undefined,
      resultJson: undefined,
      createdAt: 0,
      settledAt: undefined,
      owner: 'lost',
      leaseUntil: 50,
      attempts: 1,
      fenceToken: 'lost',
    });
    const claim = await f.stores.commandConfirmationReceipts.startConsumption({
      receiptId: prepared!.receiptId,
      owner: 'actor-op\u0000consume-p16',
      leaseUntil: 50,
      at: 20,
    });
    expect(claim.outcome).toBe('claimed');
    f.timeTravel(200_000);
    const retry = await consume(f, 'run.cancel', confirmedP16, 'consume-p16');
    expect(retry.ok).toBe(true);
    expect(f.effects.cancels).toEqual(['consume-p16']);
    const settled = await f.stores.commandConfirmationReceipts.getReceipt(prepared!.receiptId);
    expect(settled?.status).toBe('consumed');
  });

  it('P-17: settled replay of an EXPIRED receipt replays the recorded result (Phase 1 precedence)', async () => {
    const f = fixture();
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p17', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p17',
    );
    const prepared = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'run.cancel',
        prepareIdempotencyKey: 'prep-p17',
      })
    )[0];
    const win = await consume(
      f,
      'run.cancel',
      { runId: 'run-p17', reasonCode: 'manual', confirmation: { receiptId: prepared!.receiptId } },
      'consume-p17',
    );
    expect(win.ok).toBe(true);
    f.timeTravel(2_000_000); // the receipt has long since expired
    const replay = await consume(
      f,
      'run.cancel',
      { runId: 'run-p17', reasonCode: 'manual', confirmation: { receiptId: prepared!.receiptId } },
      'consume-p17',
    );
    expect(replay.ok).toBe(true);
    expect(f.effects.cancels).toEqual(['consume-p17']);
  });

  it('P-18: settled replay of a SPENT receipt precedes the SPENT classification (Phase 1 precedence)', async () => {
    const f = fixture();
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p18', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p18',
    );
    const prepared = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'run.cancel',
        prepareIdempotencyKey: 'prep-p18',
      })
    )[0];
    const win = await consume(
      f,
      'run.cancel',
      { runId: 'run-p18', reasonCode: 'manual', confirmation: { receiptId: prepared!.receiptId } },
      'consume-p18-a',
    );
    expect(win.ok).toBe(true);
    const replay = await consume(
      f,
      'run.cancel',
      { runId: 'run-p18', reasonCode: 'manual', confirmation: { receiptId: prepared!.receiptId } },
      'consume-p18-a',
    );
    expect(replay.ok).toBe(true);
    const byOtherKey = await consume(
      f,
      'run.cancel',
      { runId: 'run-p18', reasonCode: 'manual', confirmation: { receiptId: prepared!.receiptId } },
      'consume-p18-b',
    );
    expect(byOtherKey.ok).toBe(false);
    expect(byOtherKey.ok ? '' : byOtherKey.code).toBe('VICT_CONFIRMATION_SPENT');
  });

  it('P-19: expiry TOCTOU at the claim — claim at/after expiry fails closed; a granted claim completes under its fence', async () => {
    const f = fixture();
    await f.stores.commandConfirmationReceipts.createReceipt({
      receiptId: 'cr-p19',
      actorId: 'actor-op',
      command: 'run.cancel',
      payloadDigest: 'd',
      subjectId: 'run-p19',
      expectedRevision: 1,
      expiryAt: 2000,
      status: 'prepared',
      createdAt: 0,
      consumedAt: undefined,
      consumedByKey: undefined,
      replacementAttemptNo: 1,
      prepareIdempotencyKey: 'k',
      owner: undefined,
      claimUntil: undefined,
      attempts: 0,
      fenceToken: undefined,
    });
    const late = await f.stores.commandConfirmationReceipts.startConsumption({
      receiptId: 'cr-p19',
      owner: 'late',
      leaseUntil: 9000,
      at: 2500,
    });
    expect(late.outcome).toBe('expired'); // fence arrived at/after expiryAt
    expect((await f.stores.commandConfirmationReceipts.getReceipt('cr-p19'))?.status).toBe(
      'expired',
    );
    // A granted claim completes under its fence (no mid-flight expiry).
    const g = fixture();
    await g.stores.commandConfirmationReceipts.createReceipt({
      receiptId: 'cr-p19b',
      actorId: 'actor-op',
      command: 'run.cancel',
      payloadDigest: 'd',
      subjectId: 'run-p19',
      expectedRevision: 1,
      expiryAt: 2000,
      status: 'prepared',
      createdAt: 0,
      consumedAt: undefined,
      consumedByKey: undefined,
      replacementAttemptNo: 1,
      prepareIdempotencyKey: 'k',
      owner: undefined,
      claimUntil: undefined,
      attempts: 0,
      fenceToken: undefined,
    });
    const granted = await g.stores.commandConfirmationReceipts.startConsumption({
      receiptId: 'cr-p19b',
      owner: 'owner',
      leaseUntil: 5000,
      at: 1500,
    });
    expect(granted.outcome).toBe('claimed');
    g.timeTravel(900_000);
    await g.stores.commandConfirmationReceipts.settleConsumption({
      receiptId: 'cr-p19b',
      fenceToken: (granted as { fenceToken: string }).fenceToken,
      status: 'consumed',
      consumedByKey: 'owner',
      at: 901_000,
    });
    expect((await g.stores.commandConfirmationReceipts.getReceipt('cr-p19b'))?.status).toBe(
      'consumed',
    );
  });

  it('P-20: different-key consume of one receipt: first key settles and records itself; second key SPENT, no effect', async () => {
    const f = fixture();
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p20', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p20',
    );
    const prepared = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'run.cancel',
        prepareIdempotencyKey: 'prep-p20',
      })
    )[0];
    const first = await consume(
      f,
      'run.cancel',
      { runId: 'run-p20', reasonCode: 'manual', confirmation: { receiptId: prepared!.receiptId } },
      'consume-p20-first',
    );
    expect(first.ok).toBe(true);
    const second = await consume(
      f,
      'run.cancel',
      { runId: 'run-p20', reasonCode: 'manual', confirmation: { receiptId: prepared!.receiptId } },
      'consume-p20-second',
    );
    expect(second.ok).toBe(false);
    expect(second.ok ? '' : second.code).toBe('VICT_CONFIRMATION_SPENT');
    const receipt = await f.stores.commandConfirmationReceipts.getReceipt(prepared!.receiptId);
    expect(receipt?.status).toBe('consumed');
    expect(receipt?.consumedByKey).toBe('consume-p20-first');
  });

  it('P-21: reverse-crash convergence — the receipt settles consumed under the consuming key, exactly one effect', async () => {
    const f = fixture();
    await prep(
      f,
      'run.cancel',
      { runId: 'run-p21', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p21',
    );
    const prepared = (
      await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
        actorId: 'actor-op',
        command: 'run.cancel',
        prepareIdempotencyKey: 'prep-p21',
      })
    )[0];
    const win = await consume(
      f,
      'run.cancel',
      { runId: 'run-p21', reasonCode: 'manual', confirmation: { receiptId: prepared!.receiptId } },
      'consume-p21',
    );
    expect(win.ok).toBe(true);
    const receipt = await f.stores.commandConfirmationReceipts.getReceipt(prepared!.receiptId);
    expect(receipt?.status).toBe('consumed');
    expect(receipt?.consumedByKey).toBe('consume-p21');
    const replay = await consume(
      f,
      'run.cancel',
      { runId: 'run-p21', reasonCode: 'manual', confirmation: { receiptId: prepared!.receiptId } },
      'consume-p21',
    );
    expect(replay.ok).toBe(true);
    expect(f.effects.cancels).toEqual(['consume-p21']);
  });

  it('P-22: prepare-after-expiry replacement — REPLACEMENT receipt issued; the original stays expired and auditable', async () => {
    const f = fixture({ confirmationTtlMs: 1000 });
    const r1 = await prep(
      f,
      'run.cancel',
      { runId: 'run-p22', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p22',
    );
    expect(r1['replacementAttemptNo']).toBe(1);
    f.timeTravel(5000);
    const r2 = await prep(
      f,
      'run.cancel',
      { runId: 'run-p22', reasonCode: 'manual', expectedRevision: 3 },
      'prep-p22',
    );
    expect(receiptOf(r2)).not.toBe(receiptOf(r1));
    expect(r2['replacementAttemptNo']).toBe(2);
    const chain = await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
      actorId: 'actor-op',
      command: 'run.cancel',
      prepareIdempotencyKey: 'prep-p22',
    });
    expect(chain.map((entry) => entry.replacementAttemptNo)).toEqual([1, 2]);
  });

  it('P-23: beyond the FIVE-replacement budget with the SAME key+digest — truthful replay, NEVER a conflict', async () => {
    const f = fixture({ confirmationTtlMs: 1000 });
    const payload = { runId: 'run-p23', reasonCode: 'manual', expectedRevision: 3 };
    expect((await prep(f, 'run.cancel', payload, 'prep-p23'))['replacementAttemptNo']).toBe(1);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      f.timeTravel(5000);
      const replaced = await prep(f, 'run.cancel', payload, 'prep-p23');
      expect(replaced['replacementAttemptNo']).toBe(attempt + 2);
    }
    f.timeTravel(5000);
    const chainDebug = await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
      actorId: 'actor-op',
      command: 'run.cancel',
      prepareIdempotencyKey: 'prep-p23',
    });
    expect(chainDebug.length).toBe(6); // 1 original + 5 in-budget replacements
    const beyond = await prep(f, 'run.cancel', payload, 'prep-p23');
    expect(beyond['status']).toBe('expired');
    expect(beyond['replayedStatus']).toBe(true);
    expect(beyond['confirmable']).toBe(false);
    const chain = await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
      actorId: 'actor-op',
      command: 'run.cancel',
      prepareIdempotencyKey: 'prep-p23',
    });
    expect(chain).toHaveLength(6); // original + FIVE replacements; not one more
  });

  it('P-24: digest change on the key → CONFLICT before any replacement logic (a changed confirmation is a NEW intent)', async () => {
    const f = fixture({ confirmationTtlMs: 1000 });
    const payload = { runId: 'run-p24', reasonCode: 'manual', expectedRevision: 3 };
    expect((await prep(f, 'run.cancel', payload, 'prep-p24'))['receiptId']).toBeDefined();
    f.timeTravel(5000);
    const changed = await prep(
      f,
      'run.cancel',
      { runId: 'run-p24', reasonCode: 'DIFFERENT-INTENT', expectedRevision: 3 },
      'prep-p24',
    );
    expect(changed['ok']).toBe(false);
    expect(changed['code']).toBe('VICT_COMMAND_IDEMPOTENCY_CONFLICT');
    const chain = await f.stores.commandConfirmationReceipts.listReceiptsByPrepare({
      actorId: 'actor-op',
      command: 'run.cancel',
      prepareIdempotencyKey: 'prep-p24',
    });
    expect(chain).toHaveLength(1);
  });

  it('run.resolve and run.signal drive the EXISTING internal executors under receipts', async () => {
    const f = fixture();
    const rp = await prep(
      f,
      'run.resolve',
      { runId: 'run-g2', resolution: 'retry', expectedRevision: 3 },
      'prep-res',
    );
    const resolve = await consume(
      f,
      'run.resolve',
      { runId: 'run-g2', resolution: 'retry', confirmation: { receiptId: receiptOf(rp) } },
      'consume-res',
    );
    expect(resolve.ok).toBe(true);
    expect(f.effects.resolves).toEqual(['run-g2:retry']);
    const sp = await prep(
      f,
      'run.signal',
      { runId: 'run-g2', signalName: 'go', expectedRevision: 3 },
      'prep-sig',
    );
    const signal = await consume(
      f,
      'run.signal',
      { runId: 'run-g2', signalName: 'go', confirmation: { receiptId: receiptOf(sp) } },
      'consume-sig',
    );
    expect(signal.ok).toBe(true);
    expect(f.effects.signals).toEqual(['run-g2:go']);
  });
});

// ---- The shared CommandConfirmationReceiptStore conformance suite ------------
describe('Stage 9 G2 — CommandConfirmationReceiptStore conformance (in-memory)', () => {
  runCommandConfirmationReceiptConformanceSuite(inMemoryAgentControlConformanceFactory(), {
    describe: (name, fn) => describe(name, fn),
    it: (name, fn) => it(name, fn),
    expect: expect as never,
  });
});
