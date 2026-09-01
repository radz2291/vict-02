import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRuntime } from '@vict/runtime';
import { createSqliteStores } from '@vict/store-sqlite';
import { runOrchestrationConformanceSuite } from '@vict/runtime/testing';
import type { OrchestrationConformanceFixture } from '@vict/runtime/testing';

/** The shared Stage 03 orchestration conformance suite — SQLite backend. */
describe('orchestration conformance (shared suite, sqlite)', () => {
  runOrchestrationConformanceSuite(
    { test: it },
    expect,
    {
      name: 'sqlite',
      async create() {
        const dir = await mkdtemp(join(tmpdir(), 'vict-orch-conf-'));
        const stores = createSqliteStores({ path: join(dir, 'orch.db') });
        const runtime = createRuntime({ stores });
        return {
          runtime,
          orchestration: stores.orchestration as never,
          async dispose() {
            await stores.dispose();
            await rm(dir, { recursive: true, force: true });
          },
        };
      },
    },
  );
});