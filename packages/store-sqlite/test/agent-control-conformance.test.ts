import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runAgentControlConformanceSuite } from '@vict/runtime';
import { createSqliteAgentControlStores } from '../src/index.js';

/**
 * The SHARED Stage 06B conformance suite executed against the DURABLE
 * SQLite adapters (migration 5) — the same behavioral source the in-memory
 * adapters pass in `@vict/runtime`'s own suite. Includes close/reopen
 * equivalence, so every durable state machine survives a process restart.
 */

const tempDirs: string[] = [];
const tempDir = (prefix: string): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

describe('agent-control stores (SQLite, migration 5)', () => {
  runAgentControlConformanceSuite(
    {
      name: 'sqlite',
      async create(options) {
        const stores = createSqliteAgentControlStores({ path: options?.path ?? ':memory:' });
        return {
          ...stores,
          dispose: (): void => {
            stores.close();
          },
        };
      },
      freshPath() {
        return join(tempDir('vict-control-reopen-'), 'ops.db');
      },
      async reopen({ path }) {
        const stores = createSqliteAgentControlStores({ path });
        return {
          ...stores,
          dispose: (): void => {
            stores.close();
          },
        };
      },
    },
    { describe, it, expect },
  );
});
