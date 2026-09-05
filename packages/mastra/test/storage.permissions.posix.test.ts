import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  createDedicatedMastraStore,
  restrictStorePathPermissions,
  VictMastraStorageError,
} from '../src/storage.js';

/**
 * Stage 06A Linux-closure regression — structured failure behavior when a
 * REQUIRED POSIX permission operation fails.
 *
 * On POSIX a failed `chmod` is a REAL protection failure and must surface
 * as the structured `VictMastraStorageError` with the stable
 * `VICT_MASTRA_STORAGE_PERMISSION` code — never as a raw driver exception
 * and never silently tolerated (the silent-tolerance path is the
 * documented WINDOWS-only best-effort behavior).
 *
 * The failure is injected safely at the module boundary: `node:fs` is
 * mocked so `chmodSync` fails ONLY for paths carrying the EPIPE-free
 * canary marker; every other path takes the REAL implementation, so the
 * tests touch no real permission state and nothing outside disposable
 * temp directories.
 */
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    chmodSync: (
      path: Parameters<typeof actual.chmodSync>[0],
      mode: Parameters<typeof actual.chmodSync>[1],
    ) => {
      if (String(path).includes('PERM-FAIL-CANARY')) {
        const error = new Error(
          `EPERM: operation not permitted, chmod '${String(path)}'`,
        ) as NodeJS.ErrnoException;
        error.code = 'EPERM';
        error.errno = -1;
        error.syscall = 'chmod';
        throw error;
      }
      return actual.chmodSync(path, mode);
    },
  };
});

const TEST_RETENTION = {
  messagesMaxAgeMs: 3_600_000,
  threadsMaxAgeMs: 86_400_000,
  spansMaxAgeMs: 3_600_000,
} as const;

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
afterAll(async () => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe.skipIf(process.platform === 'win32')(
  'failed POSIX permission operations surface as structured storage errors',
  () => {
    it('a chmod failure during composition rejects with VICT_MASTRA_STORAGE_PERMISSION (structured, non-echoing)', async () => {
      // The temp path itself carries the canary, so EVERY chmod inside the
      // composed store (directory and database) fails.
      const dataDir = tempDir('vict-perm-FAIL-PERM-FAIL-CANARY-');
      let rejection: unknown;
      try {
        await createDedicatedMastraStore({
          dataDir,
          fileName: 'store.db',
          retention: TEST_RETENTION,
        });
        expect.unreachable();
      } catch (error) {
        rejection = error;
      }
      expect(rejection).toBeInstanceOf(VictMastraStorageError);
      expect((rejection as VictMastraStorageError).code).toBe('VICT_MASTRA_STORAGE_PERMISSION');
      // The structured diagnostic never echoes the raw driver error or the
      // filesystem path.
      const message = (rejection as Error).message;
      expect(message).not.toContain('EPERM');
      expect(message).not.toContain(dataDir);
      expect(message).not.toContain('store.db');
    });

    it('restrictStorePathPermissions surfaces the same structured failure directly (non-echoing)', () => {
      const canaryFile = join(tempDir('vict-perm-direct-FAIL-PERM-FAIL-CANARY-'), 'probe.db');
      writeFileSync(canaryFile, 'probe');
      let rejection: unknown;
      try {
        restrictStorePathPermissions(canaryFile);
        expect.unreachable();
      } catch (error) {
        rejection = error;
      }
      expect(rejection).toBeInstanceOf(VictMastraStorageError);
      expect((rejection as VictMastraStorageError).code).toBe('VICT_MASTRA_STORAGE_PERMISSION');
      const message = (rejection as Error).message;
      expect(message).not.toContain('EPERM');
      expect(message).not.toContain('PERM-FAIL-CANARY');
    });

    it('paths without the injected failure still take the REAL chmod path (composition succeeds)', async () => {
      // Guard against an over-broad mock: a normal composition in this
      // same mocked module graph must still succeed end to end.
      const dataDir = tempDir('vict-perm-real-ok-');
      const dedicated = await createDedicatedMastraStore({
        dataDir,
        fileName: 'store.db',
        retention: TEST_RETENTION,
      });
      try {
        // The real chmod applied the policy (no injection on this path).
        expect(dedicated.databasePath).toContain('store.db');
      } finally {
        await dedicated.close();
      }
    });
  },
);
