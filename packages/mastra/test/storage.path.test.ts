import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
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
    const target = `escape-${dataDir.length}-${
      dataDir.charCodeAt(dataDir.length - 1)
    }-${dataDir.charCodeAt(dataDir.length - 5)}.db`;
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
    ).rejects.toThrow(/escape/i);
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
