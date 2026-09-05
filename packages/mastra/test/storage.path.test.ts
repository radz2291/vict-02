import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  assertPlainStoreFileName,
  createDedicatedMastraStore,
  MAX_RETENTION_AGE_MS,
  resolveProtectedStoreDir,
  VictMastraStorageError,
} from '../src/storage.js';
import { executeMemoryPrune } from '../src/memory.js';

/**
 * Stage 06A corrective regressions — dedicated-store path containment:
 *
 * - `fileName` must be a plain basename: separators, drive prefixes, dot
 *   segments, NULs, and traversal are rejected on every platform;
 * - the resolved database path is proven (real path) to remain inside the
 *   dedicated store directory — symlink and junction escapes fail closed
 *   without creating anything outside the directory;
 * - retention bounds are REQUIRED and validated as positive finite
 *   integers within the documented limit (unbounded persistence is
 *   forbidden) and pruning inputs are validated identically.
 */

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
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        rmSync(dir, { recursive: true, force: true });
        break;
      } catch {
        // Windows can hold a just-closed store file briefly.
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
  }
});

describe('store file name must be a plain basename', () => {
  const rejected = [
    '../../escape.db',
    '../../../deep/escape.db',
    'sub/escape.db',
    'sub\\escape.db',
    '\\escape.db',
    '/absolute/escape.db',
    'C:\\evil.db',
    'C:/evil.db',
    '.',
    '..',
    './hidden.db',
    '.hidden.db',
    'with\\0nul.db'.replace('\\0', '\0'),
    'trailing.',
    'trailing ',
    '',
  ];
  for (const name of rejected) {
    it(`rejects ${JSON.stringify(name)}`, () => {
      expect(() => assertPlainStoreFileName(name)).toThrow(VictMastraStorageError);
    });
  }

  it('accepts ordinary single-segment names', () => {
    expect(assertPlainStoreFileName('mastra-store.db')).toBe('mastra-store.db');
    expect(assertPlainStoreFileName('store-01.db')).toBe('store-01.db');
  });
});

describe('dedicated store files cannot escape the store directory', () => {
  it('rejects traversal file names before anything is created', async () => {
    const dataDir = tempDir('vict-store-trav-');
    // A unique target name keeps the containment proof deterministic even
    // if debris from earlier (defective) runs exists in the temp root.
    const target = `escape-${dataDir.length}-${dataDir.charCodeAt(
      dataDir.length - 1,
    )}-${dataDir.charCodeAt(dataDir.length - 5)}.db`;
    await expect(
      createDedicatedMastraStore({
        dataDir,
        fileName: `../../${target}`,
        retention: TEST_RETENTION,
      }),
    ).rejects.toThrow(VictMastraStorageError);
    // Nothing appeared outside the intended directory.
    expect(existsSync(resolve(tmpdir(), target))).toBe(false);
  });

  it('rejects absolute file names', async () => {
    const dataDir = tempDir('vict-store-abs-');
    await expect(
      createDedicatedMastraStore({
        dataDir,
        fileName: join(tmpdir(), 'absolute-escape.db'),
        retention: TEST_RETENTION,
      }),
    ).rejects.toThrow(VictMastraStorageError);
    expect(existsSync(join(tmpdir(), 'absolute-escape.db'))).toBe(false);
  });

  it('places the database inside <dataDir>/mastra and nowhere else', async () => {
    const dataDir = tempDir('vict-store-ok-');
    const dedicated = await createDedicatedMastraStore({
      dataDir,
      fileName: 'store.db',
      retention: TEST_RETENTION,
    });
    try {
      const expectedDir = resolve(dataDir, 'mastra');
      expect(resolve(dedicated.databasePath).startsWith(expectedDir)).toBe(true);
      expect(existsSync(dedicated.databasePath)).toBe(true);
      // The parent of the data dir holds no new files.
      expect(existsSync(resolve(dataDir, '..', 'store.db'))).toBe(false);
    } finally {
      await dedicated.close();
    }
  });

  it('a symlink planted at the database path cannot redirect creation outside (POSIX)', async () => {
    if (process.platform === 'win32') {
      // On Windows, directory junctions are covered by the dedicated test below.
      return;
    }
    const dataDir = tempDir('vict-store-symlink-');
    const outside = tempDir('vict-store-outside-');
    const outsideTarget = join(outside, 'captured.db');
    writeFileSync(outsideTarget, 'sentinel');
    mkdirSync(join(dataDir, 'mastra'), { recursive: true });
    symlinkSync(outsideTarget, join(dataDir, 'mastra', 'store.db'));
    await expect(
      createDedicatedMastraStore({
        dataDir,
        fileName: 'store.db',
        retention: TEST_RETENTION,
      }),
    ).rejects.toThrow(/escape|contained/i);
    // The outside target was never taken over as a Mastra store.
    expect(readFileSync(outsideTarget, 'utf8')).toBe('sentinel');
  });

  it('a directory junction planted at the store dir is refused (Windows)', async () => {
    if (process.platform !== 'win32') {
      return;
    }
    const parent = tempDir('vict-store-junction-');
    const outside = tempDir('vict-store-junction-out-');
    const dataDir = join(parent, 'data');
    mkdirSync(dataDir, { recursive: true });
    // data/mastra is a JUNCTION to a directory OUTSIDE the composition
    // data dir: the real-path containment proof must refuse the store —
    // the naive resolved path looks contained, the REAL path does not.
    symlinkSync(outside, join(dataDir, 'mastra'), 'junction');
    await expect(
      createDedicatedMastraStore({
        dataDir,
        fileName: 'store.db',
        retention: TEST_RETENTION,
      }),
    ).rejects.toThrow(
      /resolves outside the composition-owned data directory \(symlink or junction redirection\)/,
    );
    // The rejection happened BEFORE any database was created in the outside
    // target (pre-open containment): the outside directory holds no store.
    expect(existsSync(join(outside, 'mastra-store.db'))).toBe(false);
  });
});

describe('protected store directory rules', () => {
  it('rejects relative, traversal, and public-root directories', () => {
    expect(() => resolveProtectedStoreDir({ dataDir: 'relative/path' })).toThrow(/absolute path/);
    expect(() => resolveProtectedStoreDir({ dataDir: '/tmp/a/../b' })).toThrow();
    expect(() =>
      resolveProtectedStoreDir({ dataDir: resolve(tempDir('vict-pub-'), 'public') }),
    ).toThrow(/publicly served/);
    expect(() =>
      resolveProtectedStoreDir({ dataDir: resolve(tempDir('vict-www-'), 'WWW') }),
    ).toThrow(/publicly served/);
  });
});

describe('retention is explicit, bounded, and validated', () => {
  it('uses the documented TEN-YEAR limit (no century arithmetic)', () => {
    // 10 × 365 days, in milliseconds — previously 100 years by mistake.
    expect(MAX_RETENTION_AGE_MS).toBe(315_360_000_000);
    expect(MAX_RETENTION_AGE_MS).toBe(10 * 365 * 24 * 60 * 60 * 1000);
  });

  it('accepts the EXACT ten-year boundary and rejects just over it', async () => {
    const boundaryDir = tempDir('vict-store-boundary-ok-');
    const atBoundary = await createDedicatedMastraStore({
      dataDir: boundaryDir,
      retention: {
        messagesMaxAgeMs: MAX_RETENTION_AGE_MS,
        threadsMaxAgeMs: MAX_RETENTION_AGE_MS,
        spansMaxAgeMs: MAX_RETENTION_AGE_MS,
      },
    });
    try {
      expect(existsSync(atBoundary.databasePath)).toBe(true);
    } finally {
      await atBoundary.close();
    }
    const overDir = tempDir('vict-store-boundary-over-');
    await expect(
      createDedicatedMastraStore({
        dataDir: overDir,
        retention: {
          messagesMaxAgeMs: MAX_RETENTION_AGE_MS + 1,
          threadsMaxAgeMs: TEST_RETENTION.threadsMaxAgeMs,
          spansMaxAgeMs: TEST_RETENTION.spansMaxAgeMs,
        },
      }),
    ).rejects.toThrow(/retention bound/);
  });

  it('rejects a composition without explicit retention bounds', async () => {
    const dataDir = tempDir('vict-store-noret-');
    await expect(
      createDedicatedMastraStore({
        dataDir,
        retention: undefined as unknown as typeof TEST_RETENTION,
      }),
    ).rejects.toThrow(VictMastraStorageError);
  });

  const badValues = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_RETENTION_AGE_MS + 1];
  for (const value of badValues) {
    it(`rejects retention bound ${String(value)}`, async () => {
      const dataDir = tempDir('vict-store-badret-');
      await expect(
        createDedicatedMastraStore({
          dataDir,
          retention: {
            messagesMaxAgeMs: value,
            threadsMaxAgeMs: TEST_RETENTION.threadsMaxAgeMs,
            spansMaxAgeMs: TEST_RETENTION.spansMaxAgeMs,
          },
        }),
      ).rejects.toThrow(/retention bound/);
    });
  }

  it('prune inputs are validated as positive finite integers within the limit', async () => {
    const dataDir = tempDir('vict-store-prune-in-');
    const dedicated = await createDedicatedMastraStore({
      dataDir,
      retention: TEST_RETENTION,
    });
    try {
      await expect(
        executeMemoryPrune({
          store: dedicated.store,
          retention: { messagesMaxAgeMs: -5 },
          now: () => Date.now(),
        }),
      ).rejects.toThrow(/VICT_MASTRA_PRUNE_INPUT_INVALID/);
      await expect(
        executeMemoryPrune({
          store: dedicated.store,
          retention: { messagesMaxAgeMs: 1.5 },
          now: () => Date.now(),
        }),
      ).rejects.toThrow(/VICT_MASTRA_PRUNE_INPUT_INVALID/);
      await expect(
        executeMemoryPrune({
          store: dedicated.store,
          retention: { messagesMaxAgeMs: MAX_RETENTION_AGE_MS + 1 },
          now: () => Date.now(),
        }),
      ).rejects.toThrow(/VICT_MASTRA_PRUNE_INPUT_INVALID/);
      // A future as-of is still rejected (fail closed).
      await expect(
        executeMemoryPrune({
          store: dedicated.store,
          retention: TEST_RETENTION,
          now: () => Date.now() + 10 * 60_000,
        }),
      ).rejects.toThrow(/VICT_MASTRA_PRUNE_ASOF_INVALID/);
    } finally {
      await dedicated.close();
    }
  });
});

// ---- Boundary remediation: containment BEFORE mutation, permissions --------

describe('containment is proven BEFORE the database is opened or initialized', () => {
  it('a directory symlink redirection is rejected and the absent external target remains absent (POSIX)', async () => {
    if (process.platform === 'win32') {
      return; // Windows coverage: junction tests below
    }
    const dataDir = tempDir('vict-store-dirsym-');
    const outside = tempDir('vict-store-dirsym-out-');
    mkdirSync(join(dataDir, 'mastra'), { recursive: true });
    // data/mastra → outside: the database would be created OUTSIDE.
    symlinkSync(outside, join(dataDir, 'mastra'));
    await expect(
      createDedicatedMastraStore({
        dataDir,
        fileName: 'never-created.db',
        retention: TEST_RETENTION,
      }),
    ).rejects.toThrow(VictMastraStorageError);
    // The absent external target was never created.
    expect(existsSync(join(outside, 'never-created.db'))).toBe(false);
    expect(existsSync(join(outside, 'mastra-store.db'))).toBe(false);
  });

  it('a symlink planted at the database path is rejected before opening; an existing external SQLite database gains NO changes', async () => {
    if (process.platform === 'win32') {
      return; // Windows coverage: junction tests below
    }
    const { DatabaseSync } = await import('node:sqlite');
    const dataDir = tempDir('vict-store-sqlout-');
    const outside = tempDir('vict-store-sqlout-out-');
    const externalDbPath = join(outside, 'external.db');
    // A REAL, valid SQLite database with a sentinel table.
    {
      const db = new DatabaseSync(externalDbPath);
      db.exec('CREATE TABLE sentinel (value TEXT);');
      db.prepare('INSERT INTO sentinel (value) VALUES (?)').run('before');
      db.close();
    }
    const bytesBefore = readFileSync(externalDbPath);
    mkdirSync(join(dataDir, 'mastra'), { recursive: true });
    symlinkSync(externalDbPath, join(dataDir, 'mastra', 'store.db'));
    await expect(
      createDedicatedMastraStore({ dataDir, fileName: 'store.db', retention: TEST_RETENTION }),
    ).rejects.toThrow(VictMastraStorageError);
    // The external database was NOT opened, initialized, or modified:
    // byte-identical file, no mastra_* schema, sentinel data intact.
    expect(readFileSync(externalDbPath).equals(bytesBefore)).toBe(true);
    const db = new DatabaseSync(externalDbPath);
    try {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>;
      expect(tables.map((entry) => entry.name)).toEqual(['sentinel']);
      const rows = db.prepare('SELECT value FROM sentinel').all() as Array<{ value: string }>;
      expect(rows.map((row) => row.value)).toEqual(['before']);
    } finally {
      db.close();
    }
  });

  it('a directory junction planted at the store dir is refused and creates nothing outside (Windows)', async () => {
    if (process.platform !== 'win32') {
      return;
    }
    const parent = tempDir('vict-store-junction-');
    const outside = tempDir('vict-store-junction-out-');
    const dataDir = join(parent, 'data');
    mkdirSync(dataDir, { recursive: true });
    symlinkSync(outside, join(dataDir, 'mastra'), 'junction');
    await expect(
      createDedicatedMastraStore({ dataDir, fileName: 'store.db', retention: TEST_RETENTION }),
    ).rejects.toThrow(
      /resolves outside the composition-owned data directory \(symlink or junction redirection\)/,
    );
    expect(existsSync(join(outside, 'store.db'))).toBe(false);
    expect(existsSync(join(outside, 'mastra-store.db'))).toBe(false);
  });

  it('an existing external sentinel file remains byte-identical through a rejected file redirection (Windows junction dir variant)', async () => {
    if (process.platform !== 'win32') {
      return;
    }
    const parent = tempDir('vict-store-junction-file-');
    const outside = tempDir('vict-store-junction-file-out-');
    const sentinel = join(outside, 'sentinel.db');
    writeFileSync(sentinel, 'SENTINEL-BYTES');
    const dataDir = join(parent, 'data');
    mkdirSync(dataDir, { recursive: true });
    symlinkSync(outside, join(dataDir, 'mastra'), 'junction');
    await expect(
      createDedicatedMastraStore({ dataDir, fileName: 'sentinel.db', retention: TEST_RETENTION }),
    ).rejects.toThrow(VictMastraStorageError);
    expect(readFileSync(sentinel, 'utf8')).toBe('SENTINEL-BYTES');
  });

  it('valid contained paths still create, REOPEN, and persist correctly', async () => {
    const dataDir = tempDir('vict-store-reopen-');
    const first = await createDedicatedMastraStore({
      dataDir,
      fileName: 'store.db',
      retention: TEST_RETENTION,
    });
    // Persist a real message through the memory domain.
    const domain = await first.store.getStore('memory');
    await domain!.saveMessages({
      messages: [
        {
          id: 'reopen-1',
          role: 'user',
          createdAt: new Date(),
          threadId: 'vict-conv-reopen-proof',
          resourceId: 'vict-actor-actor-1',
          content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'persisted' }] },
        } as never,
      ],
    });
    const beforeClose = await domain!.listMessages({
      threadId: 'vict-conv-reopen-proof',
      resourceId: 'vict-actor-actor-1',
    });
    expect(beforeClose.messages).toHaveLength(1);
    await first.close();

    // Reopen: the same contained path re-initializes and the data persists.
    const second = await createDedicatedMastraStore({
      dataDir,
      fileName: 'store.db',
      retention: TEST_RETENTION,
    });
    try {
      const reopened = await second.store.getStore('memory');
      const after = await reopened!.listMessages({
        threadId: 'vict-conv-reopen-proof',
        resourceId: 'vict-actor-actor-1',
      });
      expect(after.messages).toHaveLength(1);
    } finally {
      await second.close();
    }
  });

  it('containment errors are stable and non-echoing (no target paths or payload text)', async () => {
    if (process.platform === 'win32') {
      return;
    }
    const dataDir = tempDir('vict-store-echo-');
    const outside = tempDir('vict-store-echo-OUTSIDE-MARKER-');
    const outsideTarget = join(outside, 'SECRET-NAME.db');
    writeFileSync(outsideTarget, 'SECRET-SENTINEL');
    mkdirSync(join(dataDir, 'mastra'), { recursive: true });
    symlinkSync(outsideTarget, join(dataDir, 'mastra', 'store.db'));
    try {
      await createDedicatedMastraStore({
        dataDir,
        fileName: 'store.db',
        retention: TEST_RETENTION,
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(VictMastraStorageError);
      const message = (error as Error).message;
      expect((error as VictMastraStorageError).code).toBe('VICT_MASTRA_STORAGE_PATH_ESCAPE');
      // The diagnostic is stable — and never echoes payload-derived text.
      expect(message).not.toContain('SECRET-NAME.db');
      expect(message).not.toContain('SECRET-SENTINEL');
      expect(message).not.toContain('OUTSIDE-MARKER');
      expect(message).not.toContain(dataDir);
    }
  });
});

describe('protected-store permission policy (documented platform guarantees)', () => {
  it('applies owner-only modes automatically during composition (POSIX)', async () => {
    if (process.platform === 'win32') {
      return; // Windows: POSIX bits are not honored (documented ACL limitation)
    }
    const dataDir = tempDir('vict-store-perm-');
    const dedicated = await createDedicatedMastraStore({
      dataDir,
      fileName: 'store.db',
      retention: TEST_RETENTION,
    });
    try {
      const dirMode = statSync(resolve(dataDir, 'mastra')).mode & 0o777;
      const fileMode = statSync(dedicated.databasePath).mode & 0o777;
      // Directory: owner-only, but TRAVERSABLE by the owner (0700).
      expect(dirMode).toBe(0o700);
      // Database file: owner-only (0600).
      expect(fileMode).toBe(0o600);
      // restrictPermissions() re-applies the same policy idempotently.
      dedicated.restrictPermissions();
      expect(statSync(resolve(dataDir, 'mastra')).mode & 0o777).toBe(0o700);
      expect(statSync(dedicated.databasePath).mode & 0o777).toBe(0o600);
    } finally {
      await dedicated.close();
    }
  });
});
