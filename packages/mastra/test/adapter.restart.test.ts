import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { spawnUntilReady } from './helpers/readiness-child.js';

/**
 * Stage 06A fresh-process restart and crash evidence (§13 of the handoff).
 *
 * Every scenario crosses a REAL process boundary with readiness-barrier
 * coordination: the child emits its sentinel strictly after its durable
 * checkpoint (fsynced state file / committed store rows), the parent
 * SIGKILLs, and a fresh process reopens the stores and proves:
 *
 * - the exact pinned agent-profile identity restores;
 * - a newer definition cannot substitute for the selected revision;
 * - Mastra memory survives the restart;
 * - a partially completed governed deletion resumes idempotently (no
 *   duplicate receipts, no lost completion);
 * - no credential material appears in any reopened store.
 */

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const WORKER = 'packages/mastra/test/fixtures/agent-worker.mts';

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows may hold a briefly-locked file; cleanup is best-effort.
    }
  }
});

describe('fresh-process restart evidence (real subprocess boundaries)', () => {
  it(
    'activation identity, memory, and deletion reconciliation survive real SIGKILL restarts',
    { timeout: 240_000 },
    async () => {
      const dir = tempDir('vict-agent-restart-');
      const dataDir = join(dir, 'data');
      const governanceDbPath = join(dir, 'governance', 'ops.db');
      const statePath = join(dir, 'state.json');

      // ---- Process 1: compose, activate, persist identity, durable turn,
      // sentinel, SIGKILL.
      const setup = spawnUntilReady(
        [WORKER, 'setup', dataDir, governanceDbPath, statePath],
        'setup-complete',
        { cwd: REPO_ROOT },
      );
      await setup.ready;
      setup.child.kill('SIGKILL');
      const setupResult = await setup.result;
      expect(setupResult.signal).toBe('SIGKILL');
      expect(existsSync(statePath)).toBe(true);
      const state = JSON.parse(readFileSync(statePath, 'utf8')) as {
        activationVersion: string;
        agentProfileVersion: string;
      };
      expect(state.activationVersion).toMatch(/^v1_[0-9a-f]{64}$/);

      // ---- Process 2 (fresh): Mastra memory survived the SIGKILL; the
      // credential canary from process 1 is in no reopened store.
      const verify = spawnUntilReady(
        [WORKER, 'verify-memory', dataDir, governanceDbPath, statePath],
        'memory-verified',
        { cwd: REPO_ROOT },
      );
      await verify.ready;
      const verifyResult = await verify.result;
      expect(verifyResult.status).toBe(0);
      const memoryResult = JSON.parse(
        readFileSync(join(dir, 'verify-memory-result.json'), 'utf8'),
      ) as {
        messageCount: number;
        roles: string[];
        containsReply: boolean;
        credentialCanaryPresent: boolean;
      };
      expect(memoryResult.messageCount).toBe(2);
      expect(memoryResult.roles).toEqual(['user', 'assistant']);
      expect(memoryResult.containsReply).toBe(true);
      expect(memoryResult.credentialCanaryPresent).toBe(false);

      // ---- Process 3 (fresh): the EXACT pinned activation restores.
      const restore = spawnUntilReady(
        [WORKER, 'restore', dataDir, governanceDbPath, statePath],
        'restore-complete',
        { cwd: REPO_ROOT },
      );
      await restore.ready;
      const restoreRun = await restore.result;
      expect(restoreRun.status).toBe(0);
      const restoreResult = JSON.parse(readFileSync(join(dir, 'restore-result.json'), 'utf8')) as {
        ok: boolean;
        activationVersion?: string;
        agentProfileVersion?: string;
      };
      expect(restoreResult.ok).toBe(true);
      expect(restoreResult.activationVersion).toBe(state.activationVersion);
      expect(restoreResult.agentProfileVersion).toBe(state.agentProfileVersion);

      // ---- Process 4 (fresh): a registry holding ONLY a newer revision
      // must fail the restore closed — never substitute.
      const restoreMiss = spawnUntilReady(
        [WORKER, 'restore-miss', dataDir, governanceDbPath, statePath],
        'restore-miss-complete',
        { cwd: REPO_ROOT },
      );
      await restoreMiss.ready;
      const restoreMissRun = await restoreMiss.result;
      expect(restoreMissRun.status).toBe(0);
      const restoreMissResult = JSON.parse(
        readFileSync(join(dir, 'restore-miss-result.json'), 'utf8'),
      ) as {
        ok: boolean;
        failureCode?: string;
      };
      expect(restoreMissResult.ok).toBe(false);
      expect([
        'AGENT_ACTIVATION_PROFILE_MISMATCH',
        'AGENT_ACTIVATION_ARTIFACT_MISSING',
        'AGENT_ACTIVATION_ARTIFACT_REVISION_MISMATCH',
      ]).toContain(restoreMissResult.failureCode);

      // ---- Process 5: governed deletion records the durable intent and
      // the application-domain receipt, then is SIGKILLed before the
      // memory step.
      const partial = spawnUntilReady(
        [WORKER, 'delete-partial', dataDir, governanceDbPath, statePath],
        'deletion-partial',
        { cwd: REPO_ROOT },
      );
      await partial.ready;
      partial.child.kill('SIGKILL');
      await partial.result;

      // ---- Process 6 (fresh): recovery completes the deletion exactly
      // once; a second recovery is a no-op; the Mastra thread is gone.
      const resume = spawnUntilReady(
        [WORKER, 'delete-resume', dataDir, governanceDbPath, statePath],
        'deletion-resumed',
        { cwd: REPO_ROOT },
      );
      await resume.ready;
      const resumeRun = await resume.result;
      expect(resumeRun.status).toBe(0);
      const resumeResult = JSON.parse(
        readFileSync(join(dir, 'delete-resume-result.json'), 'utf8'),
      ) as {
        first: { resumed: number; completed: number; pending: number };
        second: { resumed: number; completed: number; pending: number };
        intentState?: string;
        receipts?: string[];
        remainingMessages: number;
      };
      expect(resumeResult.first).toEqual({ resumed: 1, completed: 1, pending: 0 });
      expect(resumeResult.second).toEqual({ resumed: 0, completed: 0, pending: 0 });
      expect(resumeResult.intentState).toBe('completed');
      // Exactly one receipt per step: the domain receipt from before the
      // crash was NOT duplicated by the recovery.
      expect(resumeResult.receipts).toEqual(['application-domain', 'mastra-memory']);
      expect(resumeResult.remainingMessages).toBe(0);
    },
  );
});
