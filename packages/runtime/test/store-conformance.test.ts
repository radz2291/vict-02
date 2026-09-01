import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInMemoryStores } from '@vict/runtime';
import { runStoreConformanceSuite } from '@vict/runtime/testing';
import type { ConformanceStores } from '@vict/runtime/testing';
import { createSqliteStores } from '@vict/store-sqlite';
import type { SqliteStoresOptions } from '@vict/store-sqlite';

/**
 * One adapter-neutral behavioral source, executed against BOTH backends:
 * the in-memory store and the SQLite adapter (fresh temporary file DB).
 */

function inMemoryFactory() {
  return {
    name: 'in-memory',
    async create(): Promise<ConformanceStores> {
      const faults = {};
      const stores = createInMemoryStores({ faults });
      return {
        ...stores,
        faults,
        async dispose(): Promise<void> {
          /* nothing to release */
        },
      };
    },
  };
}

describe('store conformance (shared suite)', () => {
  runStoreConformanceSuite({ test: it, expect }, inMemoryFactory());

  runStoreConformanceSuite(
    { test: it, expect },
    {
      name: 'sqlite',
      async create(): Promise<ConformanceStores> {
        const dir = await mkdtemp(join(tmpdir(), 'vict-conf-'));
        const options: SqliteStoresOptions = { path: join(dir, 'conf.db') };
        const stores = createSqliteStores(options);
        return {
          ...stores,
          async dispose(): Promise<void> {
            await stores.dispose();
            await rm(dir, { recursive: true, force: true });
          },
        };
      },
    },
  );
});
