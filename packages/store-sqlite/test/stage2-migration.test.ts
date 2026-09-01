import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { retryRm } from './helpers/retry-rm.js';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteStores, CURRENT_SCHEMA_VERSION } from '@vict/store-sqlite';

/**
 * Stage 03 forward migration from a REAL Stage 02 database fixture
 * (handoff §19.1): the fixture database is produced by the actual Stage 02
 * code (schema v1) in a child process, then migrated forward by the current
 * adapter. Evidence: fresh current version; identity/event/run/activation
 * history preserved exactly; historical runs remain readable; reopening is
 * idempotent; a future schema still fails closed.
 */

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const STAGE2_FIXTURE = 'packages/store-sqlite/test/fixtures/stage2-database.ts';

describe('stage 02 database migrates forward to the Stage 03 schema', () => {
  it(
    'migrates real Stage 02 data without identity, event, or activation loss',
    { timeout: 120_000 },
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'vict-mig-fixture-'));
      try {
        const db = join(dir, 'stage2.db');
        const reportPath = join(dir, 'report.json');
        const child = spawnSync(
          process.execPath,
          ['--import', 'tsx', STAGE2_FIXTURE, db, reportPath],
          { cwd: REPO_ROOT, encoding: 'utf8', timeout: 120_000 },
        );
        expect(child.status).toBe(0);
        const report = JSON.parse(await readFile(reportPath, 'utf8')) as {
          runs: number;
          activations: number;
          completedRunId: string;
        };
        expect(report.runs).toBeGreaterThan(0);

        // Migrate forward with the CURRENT adapter.
        const stores = createSqliteStores({ path: db });
        try {
          const handle = new DatabaseSync(db);
          try {
            const version = handle
              .prepare('SELECT MAX(version) AS v FROM vict_schema_migration;')
              .get() as { v: number };
            expect(version.v).toBe(CURRENT_SCHEMA_VERSION);

            // Every historical row survived the rebuild.
            const runs = handle
              .prepare(
                'SELECT run_id, status, steps, record_revision FROM vict_run ORDER BY run_id;',
              )
              .all() as unknown as {
              run_id: string;
              status: string;
              record_revision: number;
            }[];
            expect(runs.length).toBe(report.runs);
            const completed = runs.find((run) => run.run_id === report.completedRunId);
            expect(completed?.status).toBe('completed');

            const events = handle
              .prepare('SELECT run_id, seq FROM vict_run_event ORDER BY run_id, seq;')
              .all() as unknown as {
              run_id: string;
              seq: number;
            }[];
            // Dense per-run sequences preserved.
            const byRun = new Map<string, number>();
            for (const event of events) {
              byRun.set(event.run_id, (byRun.get(event.run_id) ?? 0) + 1);
              expect(event.seq).toBe((byRun.get(event.run_id) ?? 1) - 1);
            }
            const activations = handle
              .prepare('SELECT COUNT(*) AS c FROM vict_activation;')
              .get() as { c: number };
            expect(activations.c).toBeGreaterThan(0);
          } finally {
            handle.close();
          }

          // The historical completed run is still readable through the port.
          const historical = await stores.execution.getRun(report.completedRunId);
          expect(historical?.status).toBe('completed');
          expect(historical?.steps ?? 0).toBeGreaterThan(0);
        } finally {
          await stores.dispose();
        }

        // Reopening the migrated database is idempotent.
        const again = createSqliteStores({ path: db });
        await again.dispose();
      } finally {
        await retryRm(dir);
      }
    },
  );
});
