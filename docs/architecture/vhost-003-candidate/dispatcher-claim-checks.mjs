import assert from 'node:assert/strict';
import { digest } from './oracle.mjs';

const scopeActor = { actorId: 'retry-operator', scopes: ['app.data.write', 'run.cancel'] };
const runCommand = 'run.cancel';
const resourceCommand = 'app.data.mutate';
const conflict = { code: 'VICT_IDEMPOTENCY_FENCE_CONFLICT' };
const inProgress = { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_IN_PROGRESS' };
const digestConflict = { ok: false, code: 'VICT_COMMAND_IDEMPOTENCY_CONFLICT' };

function barrier() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function checkPath(context, path, repaired) {
  const { oracle, candidate, provision } = context;
  const namespace = ['vhost006', path, repaired ? 'fixed' : 'original'].join('-');
  await provision(namespace);
  const store = await candidate(namespace, { maxConnections: 4 });
  try {
    const port = store.commandIdempotency;
    const confirmations = store.commandConfirmationReceipts;
    const control = new oracle.runtime.InMemoryControlPlaneStore();
    const actor = scopeActor;
    const key = {
      actorId: actor.actorId, idempotencyKey: 'retry-key',
      command: path === 'ordinary' ? resourceCommand :
        path === 'confirmed' ? runCommand : 'confirmation.prepare:' + runCommand
    };
    const acquisitions = [];
    const releases = [];
    const settlements = [];
    const entered = barrier();
    const unblock = barrier();
    const injected = 'Synthetic retryable interruption before ' + path + ' effect';
    let boundaryCalls = 0;
    let effects = 0;
    let issued = 0;

    // The first call reaches a real acquired PostgreSQL claim before this
    // synthetic failure. Hold the replacement claim for competing requests.
    async function reachBoundary() {
      boundaryCalls++;
      if (boundaryCalls === 1) throw new Error(injected);
      if (boundaryCalls === 2) {
        entered.resolve();
        await unblock.promise;
      }
    }

    const Service = repaired ? oracle.RepairedCommandService : oracle.VictCommandService;
    const service = new Service({
      stores: { ...store, control, commandIdempotency: {
        ...port,
        async claimReceipt(record) {
          if (record.idempotencyKey !== key.idempotencyKey) return port.claimReceipt(record);
          const entry = { owner: record.owner, token: record.fenceToken, digest: record.requestDigest, attempts: record.attempts };
          acquisitions.push(entry);
          try {
            entry.outcome = await port.claimReceipt(record);
            return entry.outcome;
          } catch (error) {
            entry.code = error.code;
            throw error;
          }
        },
        async releaseReceipt(input) {
          await port.releaseReceipt(input);
          if (input.idempotencyKey === key.idempotencyKey) releases.push(input.fenceToken);
        },
        async completeReceipt(input) {
          await port.completeReceipt(input);
          if (input.idempotencyKey === key.idempotencyKey) settlements.push(input.fenceToken);
        }
      }, commandConfirmationReceipts: {
        ...confirmations,
        async createReceipt(record) {
          if (path === 'prepare') await reachBoundary();
          const result = await confirmations.createReceipt(record);
          if (result === 'created') issued++;
          return result;
        }
      } },
      execution: { getRun: async () => ({ recordRevision: 7 }) },
      controlPlane: { async cancelRun({ runId }) {
        await reachBoundary();
        effects++;
        return { runId, status: 'cancelled' };
      } },
      appData: { async mutate() {
        await reachBoundary();
        effects++;
        return { resourceId: 'fixture-resource' };
      } },
      idempotencyOwner: 'same-dispatcher-instance',
      idempotencyLeaseMs: 1000,
      clock: () => 1000
    });

    const prepare = {
      command: runCommand, idempotencyKey: path === 'prepare' ? key.idempotencyKey : 'setup-prepare',
      payload: { runId: 'synthetic-run', reasonCode: 'fixture', expectedRevision: 7 }
    };
    let receiptId;
    let call;
    if (path === 'prepare') {
      call = (changed = false) => service.prepareConfirmation(actor, {
        ...prepare, payload: { ...prepare.payload, ...(changed ? { reasonCode: 'changed' } : {}) }
      });
    } else if (path === 'confirmed') {
      const prepared = await service.prepareConfirmation(actor, prepare);
      assert(prepared.ok);
      receiptId = prepared.data.receiptId;
      call = (changed = false) => service.dispatch(actor, {
        command: runCommand, idempotencyKey: key.idempotencyKey,
        payload: { runId: 'synthetic-run', reasonCode: changed ? 'changed' : 'fixture', confirmation: { receiptId } }
      });
    } else {
      call = (changed = false) => service.dispatch(actor, {
        command: resourceCommand, idempotencyKey: key.idempotencyKey,
        payload: { resourceId: changed ? 'changed-resource' : 'fixture-resource', releaseVersion: 'fixture-version' }
      });
    }

    const chain = () => confirmations.listReceiptsByPrepare({
      actorId: actor.actorId, command: runCommand, prepareIdempotencyKey: prepare.idempotencyKey
    });

    await assert.rejects(call(), { message: injected });
    assert.equal(await port.getReceipt(key), undefined);
    assert.equal(acquisitions.length, 1);
    assert.deepEqual(releases, [acquisitions[0].token]);
    assert.equal(boundaryCalls, 1);
    assert.equal(effects, 0);
    if (path === 'prepare') assert.deepEqual(await chain(), []);
    if (path === 'confirmed') {
      const confirmation = await confirmations.getReceipt(receiptId);
      assert.equal(confirmation.status, 'prepared');
      assert.equal(confirmation.owner, undefined);
      assert.equal(confirmation.attempts, 1);
    }

    const evidence = { firstRefusal: injected, firstClaimReleased: true, sameOwner: true };
    if (repaired) {
      const inFlight = call();
      let completed;
      try {
        await Promise.race([entered.promise, inFlight.then((result) => {
          throw new Error('Second acquisition did not reach the held boundary: ' + JSON.stringify(result));
        })]);
        const current = await port.getReceipt(key);
        assert.equal(current.status, 'pending');
        assert.equal(current.owner, acquisitions[0].owner);
        assert.equal(current.requestDigest, acquisitions[0].digest);
        assert.notEqual(current.fenceToken, acquisitions[0].token);
        assert.equal(current.attempts, 1);
        const duplicates = await Promise.all(Array.from({ length: 6 }, () => call()));
        assert(duplicates.every((item) => item.ok === false && item.code === inProgress.code));
        evidence.duplicates = duplicates;
        assert.deepEqual(await call(true), digestConflict);
        for (const method of ['completeReceipt', 'failReceipt', 'releaseReceipt']) {
          await assert.rejects(port[method]({
            ...key, fenceToken: acquisitions[0].token, resultJson: '{}', responseCode: 'synthetic-failure', at: 1000
          }), conflict);
          assert.deepEqual(await port.getReceipt(key), current);
        }
        assert.equal(boundaryCalls, 2);
      } finally {
        unblock.resolve();
        completed = await inFlight;
      }
      assert(completed.ok);
      assert.deepEqual(settlements, [acquisitions[1].token]);
      assert.match(acquisitions[1].token, /^vict-fence-[a-f0-9]{64}$/u);
      const durable = await port.getReceipt(key);
      assert.equal(durable.status, 'completed');
      assert.equal(durable.fenceToken, undefined);
      const replay = await call();
      assert(replay.ok);
      assert.deepEqual(await call(true), digestConflict);
      assert.equal(boundaryCalls, 2);
      assert.equal(effects, path === 'prepare' ? 0 : 1);
      if (path === 'prepare') {
        assert.equal(issued, 1);
        assert.equal((await chain()).length, 1);
        assert.equal(completed.data.receiptId, replay.data.receiptId);
      }
      if (path === 'confirmed') {
        const consumed = await confirmations.getReceipt(receiptId);
        assert.equal(consumed.status, 'consumed');
        assert.equal(consumed.attempts, 2);
        assert.equal(consumed.consumedByKey, key.idempotencyKey);
        evidence.confirmation = { status: consumed.status, attempts: consumed.attempts };
      }
      evidence.retry = { completed, replay, durableStatus: durable.status, retiredMutationRefusals: 3 };
    } else {
      await assert.rejects(call(), conflict);
      assert.equal(await port.getReceipt(key), undefined);
      assert.equal(boundaryCalls, 1);
      assert.equal(effects, 0);
      evidence.retry = { code: conflict.code, durableReceiptExists: false };
    }
    assert.equal(acquisitions.length, 2);
    assert.equal(acquisitions[0].owner, acquisitions[1].owner);
    assert.equal(acquisitions[0].digest, acquisitions[1].digest);
    assert.equal(acquisitions[0].token !== acquisitions[1].token, repaired);
    return { path, implementation: repaired ? 'repaired' : 'original', ...evidence,
      acquisitionTokenDigests: acquisitions.map(({ token, ...rest }) => ({ ...rest, sha256: digest(token) })),
      boundaryCalls, effects, issued };
  } finally {
    await store.close();
  }
}

async function checkExpiredDispatcherClaim(context) {
  const { oracle, candidate, provision } = context;
  const namespace = 'vhost006-expired-claim';
  await provision(namespace);
  const store = await candidate(namespace);
  try {
    const port = store.commandIdempotency;
    const key = { actorId: scopeActor.actorId, command: resourceCommand, idempotencyKey: 'expiry' };
    const request = { command: key.command, idempotencyKey: key.idempotencyKey,
      payload: { resourceId: 'fixture-resource', releaseVersion: 'fixture-version' } };
    const takeovers = [];
    const completions = [];
    let now = 1000;
    let calls = 0;
    let effects = 0;
    const service = new oracle.RepairedCommandService({
      stores: { ...store, commandIdempotency: {
        ...port,
        async releaseReceipt() { throw new Error('Synthetic process stopped before cleanup'); },
        async takeOverExpiredLease(input) {
          const outcome = await port.takeOverExpiredLease(input);
          takeovers.push(outcome);
          return outcome;
        },
        async completeReceipt(input) {
          await port.completeReceipt(input);
          completions.push(input.fenceToken);
        }
      } },
      controlPlane: {},
      appData: { async mutate() {
        calls++;
        if (calls === 1) throw new Error('Synthetic interruption before the effect');
        effects++;
        return { resourceId: 'fixture-resource' };
      } },
      clock: () => now,
      idempotencyOwner: 'same-expiring-dispatcher',
      idempotencyLeaseMs: 1000
    });
    await assert.rejects(service.dispatch(scopeActor, request), /Synthetic interruption before the effect/);
    const abandoned = await port.getReceipt(key);
    assert.equal(abandoned.status, 'pending');
    assert.equal(abandoned.attempts, 1);
    now = abandoned.leaseUntil - 1;
    assert.deepEqual(await service.dispatch(scopeActor, request), inProgress);
    now = abandoned.leaseUntil;
    assert((await service.dispatch(scopeActor, request)).ok);
    assert.equal(takeovers.length, 2);
    assert.equal(takeovers[0].outcome, 'not-expired');
    assert.equal(takeovers[1].outcome, 'taken');
    assert.notEqual(takeovers[1].fenceToken, abandoned.fenceToken);
    assert.deepEqual(completions, [takeovers[1].fenceToken]);
    const terminal = await port.getReceipt(key);
    assert.equal(terminal.attempts, 2);
    assert.equal(terminal.status, 'completed');
    assert((await service.dispatch(scopeActor, request)).ok);
    assert.equal(calls, 2);
    assert.equal(effects, 1);
    return { beforeExpiry: takeovers[0].outcome, atExpiry: takeovers[1].outcome,
      generation: terminal.attempts, completedWithTakeoverFence: true, boundaryCalls: calls, effects };
  } finally {
    await store.close();
  }
}

export async function checkDispatcherClaims(context) {
  context.evidence.dispatcherClaimRetry = [];
  for (const path of ['ordinary', 'confirmed', 'prepare']) {
    for (const repaired of [false, true]) {
      const result = await checkPath(context, path, repaired);
      context.evidence.dispatcherClaimRetry.push(result);
      await context.save();
    }
  }
  context.evidence.dispatcherExpiredClaim = await checkExpiredDispatcherClaim(context);
  await context.save();
}
