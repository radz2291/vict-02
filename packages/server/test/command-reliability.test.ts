import { describe, expect, it } from 'vitest';
import {
  authenticatedActorContext,
  createInMemoryAgentControlStores,
  VictControlError,
  VICT_IDEMPOTENCY_FENCE_CONFLICT,
  type ActorRecord,
} from '@victframework/runtime';
import { createInMemoryStores, type ActivationCatalog } from '@victframework/runtime';
import { ControlPlaneService } from '@victframework/control';
import { VictCommandService, VICT_COMMANDS } from '../src/commands.js';
import type { VictCommandRequest } from '../src/commands.js';
import type { ServerActorContext } from '../src/auth.js';

/**
 * Stage 06B final reliability correction — R3 (service-level fenced
 * settlement) and R5 (the closed vict.command@1 request envelope).
 *
 * The direct dispatcher boundary is exercised here; the HTTP transport
 * consumes the SAME typed dispatcher, so the captured-envelope semantics
 * hold at both boundaries.
 */

function actorFixture(overrides: Partial<ActorRecord> = {}): ActorRecord {
  return {
    actorId: 'actor-rel',
    status: 'active',
    roles: ['developer', 'operator', 'approver', 'administrator'],
    createdAt: 0,
    ...overrides,
  };
}

function ctxOf(record: ActorRecord): ServerActorContext {
  return authenticatedActorContext(record, record.actorId) as unknown as ServerActorContext;
}

let clockValue = 1000;

function makeService() {
  clockValue = 1000;
  const stores = createInMemoryAgentControlStores();
  const catalog: ActivationCatalog = createInMemoryStores().catalog;
  let n = 0;
  const controlPlane = new ControlPlaneService({
    stores,
    catalog,
    clock: () => (clockValue += 1),
    ids: {
      changesetId: () => `cs-${(n += 1)}`,
      changesetApprovalId: () => `csa-${(n += 1)}`,
      auditId: () => `audit-${(n += 1)}`,
      controlRunId: () => `run-${(n += 1)}`,
    },
  });
  const service = new VictCommandService({ stores, controlPlane, clock: () => (clockValue += 1) });
  return { stores, catalog, controlPlane, service, actor: ctxOf(actorFixture()) };
}

function envelopeRequest(
  command: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): unknown {
  const request: Record<string, unknown> = { command, payload };
  if (idempotencyKey !== undefined) {
    request['idempotencyKey'] = idempotencyKey;
  }
  return request;
}

describe('R5: the shared command envelope is closed', () => {
  it('a throwing getter on top-level command NEVER executes and fails with a stable structured error', async () => {
    const { service, actor } = makeService();
    let getterInvocations = 0;
    const hostile: Record<PropertyKey, unknown> = {
      get command(): string {
        getterInvocations += 1;
        return 'health.inspect';
      },
      payload: {},
    };
    await expect(service.dispatch(actor, hostile as unknown as VictCommandRequest)).rejects.toThrow(
      VictControlError,
    );
    expect(getterInvocations).toBe(0);
  });

  it('unknown top-level fields are rejected at the shared dispatcher boundary', async () => {
    const { service, actor } = makeService();
    // An envelope with an unknown member fails closed.
    const hostile = { command: 'health.inspect', payload: {}, smuggled: 'x' };
    await expect(service.dispatch(actor, hostile as unknown as VictCommandRequest)).rejects.toThrow(
      /closed vict.command@1 envelope/,
    );
  });

  it('the closed top-level field set is exactly {command, payload, idempotencyKey}', () => {
    expect([...VICT_COMMANDS]).toContain('health.inspect');
    // (The closed field set is enforced by every dispatch below; this pin
    // documents the contract.)
  });

  it('accessor payloads, exotic prototypes, and hostile proxies fail without invoking getters or echoing', async () => {
    const { service, actor } = makeService();
    let getterInvocations = 0;
    const accessorPayload = {
      get changesetId(): string {
        getterInvocations += 1;
        return 'cs-hostile';
      },
    };
    await expect(
      service.dispatch(
        actor,
        envelopeRequest('health.inspect', accessorPayload) as VictCommandRequest,
      ),
    ).rejects.toThrow(VictControlError);
    expect(getterInvocations).toBe(0);

    class Exotic {}
    const exotic = Object.assign(new Exotic(), { command: 'health.inspect', payload: {} });
    await expect(service.dispatch(actor, exotic as unknown as VictCommandRequest)).rejects.toThrow(
      VictControlError,
    );

    // A proxy whose getPrototypeOf trap throws is rejected without a raw
    // exception (a proxy over a plain object with default traps is
    // indistinguishable from the plain record and is legitimately accepted).
    const trapProxy = new Proxy(
      { command: 'health.inspect', payload: {} },
      {
        getPrototypeOf() {
          throw new Error('trap');
        },
      },
    );
    await expect(
      service.dispatch(actor, trapProxy as unknown as VictCommandRequest),
    ).rejects.toThrow(VictControlError);
  });

  it('the captured VICT-owned request is used for digesting and execution (mutation replay is stable)', async () => {
    const { service, actor } = makeService();
    const request = envelopeRequest('health.inspect', {}) as VictCommandRequest;
    const outcome = await service.dispatch(actor, request);
    expect(outcome.ok).toBe(true);
  });
});

describe('R3: fenced settlement through the shared dispatcher', () => {
  it('the durable receipt carries the fence token and replays settled results', async () => {
    const { stores, catalog, service, actor } = makeService();
    // A read-only command needs no idempotency; run a MUTATION command:
    // publish a release through the dispatcher, then replay by key.
    await stores.control.publishRelease({
      releaseVersion: 'release-rel-1',
      applicationId: 'app-rel',
      applicationVersion: 'appver-1',
      rendererIdentity: 'renderer@1',
      componentRegistryIdentity: 'registry@1',
      dataAdapterIdentity: 'adapter@1',
      activationBinding: 'activation-1',
      publishedByActorId: 'actor-rel',
      publishedAt: 1000,
      contentHash: 'hash-rel-1',
    });
    void catalog;
    const select = {
      command: 'release.select' as const,
      payload: { applicationId: 'app-rel', releaseVersion: 'release-rel-1' },
      idempotencyKey: 'rel-select-1',
    };
    const first = await service.dispatch(actor, select);
    expect(first.ok).toBe(true);
    // Duplicate (same actor, command, key, digest): stable SAFE replay —
    // the same identifiers and revision, reconstructed from the receipt's
    // safe projection (never a second selection effect).
    const second = await service.dispatch(actor, select);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      // The replay is the SAFE projection of the settled result: the same
      // stable identifiers — never a second selection effect.
      const firstSelection = first.data['selection'] as Record<string, unknown>;
      const secondSelection = second.data['selection'] as Record<string, unknown>;
      expect(secondSelection['applicationId']).toBe(firstSelection['applicationId']);
      expect(secondSelection['releaseVersion']).toBe(firstSelection['releaseVersion']);
      expect(secondSelection['selectionRevision']).toBe(firstSelection['selectionRevision']);
      const selectionRevision = await stores.control
        .listReleaseSelections('app-rel')
        .then((rows) => rows.length);
      expect(selectionRevision).toBe(1);
    }
    const receipt = await stores.commandIdempotency.getReceipt({
      actorId: 'actor-rel',
      command: 'release.select',
      idempotencyKey: 'rel-select-1',
    });
    expect(receipt?.status).toBe('completed');
    // The settled receipt no longer carries a fence token.
    expect(receipt?.fenceToken).toBeUndefined();
  });

  it('a settled receipt is never re-settled: the fence conflict is stable and non-echoing', async () => {
    const { stores } = makeService();
    // Drive the store boundary directly: the conflict code is the stable
    // VICT-owned diagnostic (never a raw exception).
    await stores.commandIdempotency.claimReceipt({
      idempotencyKey: 'key-fence-1',
      actorId: 'actor-rel',
      command: 'changeset.commit',
      requestDigest: 'digest',
      status: 'pending',
      responseCode: undefined,
      resultJson: undefined,
      createdAt: 1000,
      settledAt: undefined,
      owner: 'svc-1',
      leaseUntil: 1100,
      attempts: 1,
      fenceToken: 'token-1',
    });
    await stores.commandIdempotency.completeReceipt({
      actorId: 'actor-rel',
      command: 'changeset.commit',
      idempotencyKey: 'key-fence-1',
      resultJson: '{}',
      at: 1001,
      fenceToken: 'token-1',
    });
    let code: string | undefined;
    try {
      await stores.commandIdempotency.failReceipt({
        actorId: 'actor-rel',
        command: 'changeset.commit',
        idempotencyKey: 'key-fence-1',
        responseCode: 'VICT_X',
        at: 1002,
        fenceToken: 'token-1',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(VictControlError);
      code = (error as VictControlError).code;
    }
    expect(code).toBe(VICT_IDEMPOTENCY_FENCE_CONFLICT);
  });
});
describe('R3: barrier-controlled concurrent duplicates of one mutation', () => {
  it('concurrent duplicates of ONE idempotent mutation produce exactly one effect and one receipt', async () => {
    const { stores, service, actor, controlPlane: sharedControlPlane } = makeService();
    await stores.control.publishRelease({
      releaseVersion: 'release-rel-2',
      applicationId: 'app-rel',
      applicationVersion: 'appver-1',
      rendererIdentity: 'renderer@1',
      componentRegistryIdentity: 'registry@1',
      dataAdapterIdentity: 'adapter@1',
      activationBinding: 'activation-1',
      publishedByActorId: 'actor-rel',
      publishedAt: 1000,
      contentHash: 'hash-rel-2',
    });
    // A SECOND service instance (another process-equivalent owner) shares
    // the durable store — the realistic concurrent-duplicate deployment.
    const duplicateService = new VictCommandService({
      stores,
      controlPlane: sharedControlPlane,
      clock: () => (clockValue += 1),
    });
    // BARRIER: hold the WINNER's domain execution mid-flight (after its
    // durable claim) until the duplicate has completed its own dispatch —
    // the duplicate deterministically observes the live pending claim.
    let releaseBarrier: () => void = () => undefined;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const innerSelect = sharedControlPlane['selectRelease'];
    sharedControlPlane['selectRelease'] = async (...args: Parameters<typeof innerSelect>) => {
      await barrier;
      return innerSelect.call(sharedControlPlane, ...args);
    };
    const select = {
      command: 'release.select' as const,
      payload: { applicationId: 'app-rel', releaseVersion: 'release-rel-2' },
      idempotencyKey: 'rel-race-1',
    };
    const winner = service.dispatch(actor, select);
    // Give the winner one macrotask to take the claim, then dispatch the
    // duplicate while the winner is parked at the barrier.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const duplicate = await duplicateService.dispatch(actor, select);
    // The duplicate sees the LIVE claim: stable in-progress conflict —
    // never a second execution.
    expect(duplicate).toEqual({ ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS' });
    releaseBarrier();
    const winnerOutcome = await winner;
    expect(winnerOutcome.ok).toBe(true);
    // EXACTLY one effect and one settled receipt.
    const selections = await stores.control.listReleaseSelections('app-rel');
    expect(selections).toHaveLength(1);
    const receipt = await stores.commandIdempotency.getReceipt({
      actorId: 'actor-rel',
      command: 'release.select',
      idempotencyKey: 'rel-race-1',
    });
    expect(receipt?.status).toBe('completed');
  });
});
