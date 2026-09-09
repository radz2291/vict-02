import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { retryRm } from './helpers/retry-rm.js';
import { isReadyLine } from './fixtures/readiness.js';
import { createSqliteAgentControlStores } from '@victframework/store-sqlite';
import { VictControlError } from '@victframework/runtime';

/**
 * Stage 06B final boundary correction — SQLite attempt-fencing suites
 * (these FAIL at 8bc8da1 and pass after):
 *
 * - the durable claim/settlement commands bind the EXACT attempt fence: a
 *   stale owner can never settle a later claim generation, a second claim
 *   on a live attempt is refused, and terminal idempotency requires the
 *   exact requested state and binding;
 * - reconciliation of an abandoned `running` attempt is exact-binding and
 *   conservative (fenced, non-replayable outcome_unknown, never executed);
 * - close/reopen preserves every rule across a restart;
 * - a REAL process boundary: a child process claims the attempt and is
 *   SIGKILLed; the reopened store reconciles the genuinely abandoned
 *   attempt to fenced outcome_unknown, and a stale-fence settlement from
 *   the dead owner is refused.
 */

const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs) {
    void retryRm(dir);
  }
});

async function withPath(run: (path: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'vict-fence-'));
  tempDirs.push(dir);
  await run(join(dir, 'control.db'));
}

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const WORKER = 'packages/store-sqlite/test/fixtures/invocation-claim-worker.mts';

async function seedIntent(
  stores: ReturnType<typeof createSqliteAgentControlStores>,
  invocationId: string,
): Promise<void> {
  await stores.actors.upsert({
    actorId: 'actor-fence',
    status: 'active',
    roles: ['developer'],
    createdAt: 0,
  });
  await stores.turns.createTurnIntent({
    turnId: 'turn-fence',
    streamId: 'stream-fence',
    threadId: 'thread-fence',
    actorId: 'actor-fence',
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
  await stores.turns.startTurn('turn-fence', 2);
  await stores.invocations.recordInvocationIntent({
    invocationId,
    turnId: 'turn-fence',
    toolCallId: `call-${invocationId}`,
    toolName: 'cap.notes.write',
    capabilityId: 'cap.notes.write',
    capabilityRevision: '3',
    effect: 'read',
    idempotencyKey: `turn-fence:call-${invocationId}:cap.notes.write:3:digest`,
    actorId: 'actor-fence',
    argDigest: 'digest',
    argumentSummary: 'object(1 fields)',
    status: 'intent',
    createdAt: 3,
    updatedAt: 3,
    completedAt: undefined,
    resultSummary: undefined,
    errorCode: undefined,
  });
}

describe('SQLite attempt fencing: exact binding, stale owners, generations', () => {
  it('claim/settle bind the exact fence; a stale owner can never settle a later generation', async () => {
    await withPath(async (path) => {
      const stores = createSqliteAgentControlStores({ path });
      try {
        await seedIntent(stores, 'inv-gen-1');
        // Generation 1 owner claims.
        const claimed = await stores.invocations.claimInvocationRun({
          invocationId: 'inv-gen-1',
          fenceToken: 'fence-g1',
          ownerIdentity: 'owner-A',
          at: 10,
        });
        expect(claimed.status).toBe('running');
        expect(claimed.runGeneration).toBe(1);
        expect(claimed.runFenceToken).toBe('fence-g1');
        // A SECOND claim on the live attempt is refused; the row is untouched.
        await expect(
          stores.invocations.claimInvocationRun({
            invocationId: 'inv-gen-1',
            fenceToken: 'fence-g1-impostor',
            ownerIdentity: 'owner-B',
            at: 11,
          }),
        ).rejects.toThrow(/live owner/);
        // Reconciliation re-fences the record to a LATER generation.
        const reconciled = await stores.invocations.reconcileAbandonedRun({
          invocationId: 'inv-gen-1',
          observedFenceToken: 'fence-g1',
          reconciledFenceToken: 'fence-g2',
          at: 12,
        });
        expect(reconciled.status).toBe('outcome_unknown');
        expect(reconciled.runGeneration).toBe(2);
        expect(reconciled.errorCode).toBe('VICT_CONTROL_INVOCATION_RUN_RECONCILED');
        // THE STALE OWNER (generation 1) can never settle the later
        // generation — not even idempotently.
        await expect(
          stores.invocations.settleInvocationRun({
            invocationId: 'inv-gen-1',
            fenceToken: 'fence-g1',
            status: 'completed',
            at: 13,
            resultSummary: 'stale-owner-lies',
          }),
        ).rejects.toThrow(VictControlError);
        // The CURRENT fence settles truthfully.
        const settled = await stores.invocations.settleInvocationRun({
          invocationId: 'inv-gen-1',
          fenceToken: 'fence-g2',
          status: 'outcome_unknown',
          at: 14,
          errorCode: 'VICT_CONTROL_INVOCATION_RUN_RECONCILED',
        });
        expect(settled.status).toBe('outcome_unknown');
      } finally {
        stores.close();
      }
    });
  });

  it('terminal idempotency requires the EXACT state and binding under the SAME fence', async () => {
    await withPath(async (path) => {
      const stores = createSqliteAgentControlStores({ path });
      try {
        await seedIntent(stores, 'inv-idem-1');
        await stores.invocations.claimInvocationRun({
          invocationId: 'inv-idem-1',
          fenceToken: 'fence-idem',
          ownerIdentity: 'owner-A',
          at: 10,
        });
        // First settlement lands.
        await stores.invocations.settleInvocationRun({
          invocationId: 'inv-idem-1',
          fenceToken: 'fence-idem',
          status: 'completed',
          at: 11,
          resultSummary: 'object(1 fields)',
        });
        // An EXACT rematch (same status + same binding) is idempotent.
        const again = await stores.invocations.settleInvocationRun({
          invocationId: 'inv-idem-1',
          fenceToken: 'fence-idem',
          status: 'completed',
          at: 12,
          resultSummary: 'object(1 fields)',
        });
        expect(again.status).toBe('completed');
        // A DIFFERENT settlement under the same fence is a conflict.
        await expect(
          stores.invocations.settleInvocationRun({
            invocationId: 'inv-idem-1',
            fenceToken: 'fence-idem',
            status: 'failed',
            at: 13,
            errorCode: 'CONFLICTING',
          }),
        ).rejects.toThrow(/terminal/i);
        // A DIFFERENT fence is a mismatch even for the same state.
        await expect(
          stores.invocations.settleInvocationRun({
            invocationId: 'inv-idem-1',
            fenceToken: 'fence-other',
            status: 'completed',
            at: 14,
            resultSummary: 'object(1 fields)',
          }),
        ).rejects.toThrow(/fence/i);
      } finally {
        stores.close();
      }
    });
  });

  it('legacy unfenced running rows reconcile under the empty observed fence', async () => {
    await withPath(async (path) => {
      const stores = createSqliteAgentControlStores({ path });
      try {
        await seedIntent(stores, 'inv-legacy-1');
        // A pre-migration-9 style running row: claimed through the legacy
        // order-based update (no fence members at all).
        await stores.invocations.updateInvocationStatus({
          invocationId: 'inv-legacy-1',
          status: 'running',
          at: 10,
        });
        const record = await stores.invocations.getInvocation('inv-legacy-1');
        expect(record?.runFenceToken).toBeUndefined();
        // Reconciliation accepts the ABSENT fence binding (empty string)
        // and fences the attempt conservatively.
        const reconciled = await stores.invocations.reconcileAbandonedRun({
          invocationId: 'inv-legacy-1',
          observedFenceToken: '',
          reconciledFenceToken: 'fence-reconciled-legacy',
          at: 11,
        });
        expect(reconciled.status).toBe('outcome_unknown');
        expect(reconciled.runGeneration).toBe(1);
      } finally {
        stores.close();
      }
    });
  });

  it('close/reopen preserves fence rules across a restart', async () => {
    await withPath(async (path) => {
      const first = createSqliteAgentControlStores({ path });
      await seedIntent(first, 'inv-restart-1');
      const claimed = await first.invocations.claimInvocationRun({
        invocationId: 'inv-restart-1',
        fenceToken: 'fence-before-restart',
        ownerIdentity: 'owner-A',
        at: 10,
      });
      expect(claimed.status).toBe('running');
      first.close();

      // RESTART: a fresh adapter over the SAME file.
      const second = createSqliteAgentControlStores({ path });
      try {
        // STORE-LEVEL truth: the durable attempt fence is unchanged by the
        // restart, so the EXACT binding still settles. Owner LIVENESS is a
        // composition/bridge policy (see the reconciliation suites): the
        // store itself never guesses about live owners.
        const settled = await second.invocations.settleInvocationRun({
          invocationId: 'inv-restart-1',
          fenceToken: 'fence-before-restart',
          status: 'completed',
          at: 21,
          resultSummary: 'object(1 fields)',
        });
        expect(settled.status).toBe('completed');
      } finally {
        second.close();
      }
    });
  });

  it('reconciliation across close/reopen: a claimed attempt left by a closed process is fenced', async () => {
    await withPath(async (path) => {
      const first = createSqliteAgentControlStores({ path });
      await seedIntent(first, 'inv-restart-2');
      await first.invocations.claimInvocationRun({
        invocationId: 'inv-restart-2',
        fenceToken: 'fence-died-at-close',
        ownerIdentity: 'owner-A',
        at: 10,
      });
      first.close();

      const second = createSqliteAgentControlStores({ path });
      try {
        const observed = await second.invocations.getInvocation('inv-restart-2');
        expect(observed?.status).toBe('running');
        expect(observed?.runFenceToken).toBe('fence-died-at-close');
        // The composition policy (no live owner in this process) reconciles
        // the abandoned attempt through the exact observed binding.
        const reconciled = await second.invocations.reconcileAbandonedRun({
          invocationId: 'inv-restart-2',
          observedFenceToken: observed?.runFenceToken ?? '',
          reconciledFenceToken: 'fence-reconciled-after-restart',
          at: 20,
        });
        expect(reconciled.status).toBe('outcome_unknown');
        expect(reconciled.errorCode).toBe('VICT_CONTROL_INVOCATION_RUN_RECONCILED');
        // The dead owner's later settlement is refused (stale fence).
        await expect(
          second.invocations.settleInvocationRun({
            invocationId: 'inv-restart-2',
            fenceToken: 'fence-died-at-close',
            status: 'completed',
            at: 21,
            resultSummary: 'dead-owner-lies',
          }),
        ).rejects.toThrow(VictControlError);
      } finally {
        second.close();
      }
    });
  });
});

describe('real-process interruption: SIGKILL between claim and settlement', () => {
  it(
    'a SIGKILLed owner leaves a claim that the reopened process fences conservatively',
    { timeout: 120_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-fence-sigkill-'));
      tempDirs.push(dir);
      const db = join(dir, 'control.db');
      const report = join(dir, 'report.json');
      const child = spawn(process.execPath, ['--import', 'tsx', WORKER, 'claim', db, report], {
        cwd: REPO_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      let stderr = '';
      child.stderr?.on('data', (chunk: string) => {
        stderr += chunk;
      });
      // Observe the readiness sentinel (emitted strictly AFTER the durable
      // claim and the fsynced report), then SIGKILL the owner.
      const ready = await new Promise<boolean>((resolveReady) => {
        const guard = setTimeout(() => {
          child.kill('SIGKILL');
          resolveReady(false);
        }, 60_000);
        child.stdout?.on('data', (line: string) => {
          if (line.split('\n').some((entry) => isReadyLine(entry, 'claimed'))) {
            clearTimeout(guard);
            resolveReady(true);
          }
        });
        child.on('exit', () => {
          clearTimeout(guard);
          resolveReady(false);
        });
      });
      expect(ready).toBe(true);
      const claimReport = JSON.parse(await readFile(report, 'utf8')) as {
        invocationId: string;
        fenceToken: string | undefined;
        generation: number | undefined;
        status: string;
      };
      expect(claimReport.status).toBe('running');
      child.kill('SIGKILL');
      const exit = await new Promise<string | null>((resolve) => {
        child.on('exit', (_code, signal) => resolve(signal));
      });
      expect(exit).toBe('SIGKILL');

      // The reopened store: the record is running under the dead owner's fence.
      const stores = createSqliteAgentControlStores({ path: db });
      try {
        const observed = await stores.invocations.getInvocation(claimReport.invocationId);
        expect(observed?.status).toBe('running');
        expect(observed?.runFenceToken).toBe(claimReport.fenceToken);
        // The composition policy reconciles the genuinely abandoned attempt
        // (no live owner in this process) to fenced outcome_unknown.
        const reconciled = await stores.invocations.reconcileAbandonedRun({
          invocationId: claimReport.invocationId,
          observedFenceToken: observed?.runFenceToken ?? '',
          reconciledFenceToken: 'fence-post-sigkill-reconciled',
          at: 100,
        });
        expect(reconciled.status).toBe('outcome_unknown');
        expect(reconciled.errorCode).toBe('VICT_CONTROL_INVOCATION_RUN_RECONCILED');
        // The dead owner's settlement is refused — never a posthumous lie.
        await expect(
          stores.invocations.settleInvocationRun({
            invocationId: claimReport.invocationId,
            fenceToken: claimReport.fenceToken as string,
            status: 'completed',
            at: 101,
            resultSummary: 'posthumous',
          }),
        ).rejects.toThrow(VictControlError);
        // A SECOND reconciliation is refused: the exact observed binding no
        // longer matches (idempotent truthfulness, no state-changing guess).
        await expect(
          stores.invocations.reconcileAbandonedRun({
            invocationId: claimReport.invocationId,
            observedFenceToken: observed?.runFenceToken ?? '',
            reconciledFenceToken: 'fence-again',
            at: 102,
          }),
        ).rejects.toThrow(VictControlError);
      } finally {
        stores.close();
        void stderr;
      }
    },
  );
});
