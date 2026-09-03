import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { createSqliteApplicationData, physicalTableName } from '@vict/appdata-sqlite';

/**
 * Restart and operational/application-schema separation (Stage 05).
 *
 * Application-domain data survives REAL process boundaries: a child
 * process writes rows and closes; a DIFFERENT fresh process reopens the
 * same SQLite file, finds every row, and reconciles keyed idempotency
 * without duplicates. The application-domain migration history never
 * enters Vict's operational migration table, and operational tables are
 * absent from an application-domain-only database.
 */

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const WORKER = 'packages/appdata-sqlite/test/fixtures/appdata-worker.mts';

const tempDirs: string[] = [];

afterAll(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true });
  }
});

function runChild(args: string[], timeoutMs = 60_000): { status: number | null; stderr: string } {
  const result = spawnSync(process.execPath, ['--import', 'tsx', WORKER, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
  });
  return { status: result.status, stderr: result.stderr };
}

describe('application-domain restart across real process boundaries', () => {
  it('rows and keyed idempotency survive a fresh process', { timeout: 90_000 }, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-appdata-restart-'));
    tempDirs.push(dir);
    const db = join(dir, 'appdata.db');

    const writer = runChild(['write', db]);
    expect(writer.status).toBe(0);

    const reader = runChild(['read', db]);
    expect(reader.status, `reader stderr: ${reader.stderr}`).toBe(0);
  });

  it('application-domain history never enters operational migration tables', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-appdata-sep-'));
    tempDirs.push(dir);
    const db = join(dir, 'appdata.db');
    const adapter = createSqliteApplicationData({
      path: db,
      resources: [
        {
          schema: 'vict.resource@1',
          id: 'notes',
          revision: '1',
          identity: { key: 'id' },
          fields: [{ name: 'id', type: 'string', required: true }],
        },
      ],
    });
    await adapter.mutate(
      { resourceId: 'notes', op: 'create', input: { id: 'n-1' } },
      { permissions: [], effect: 'write' },
    );
    adapter.close();

    const { DatabaseSync } = await import('node:sqlite');
    const raw = new DatabaseSync(db);
    const tables = (
      raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;").all() as {
        name: string;
      }[]
    ).map((row) => row.name);
    raw.close();

    // Application-domain namespace only: appdata table + appdata
    // bookkeeping. NO operational tables (vict_activation, vict_run,
    // vict_event, vict_schema_migration, ...).
    expect(tables).toContain(physicalTableName('notes'));
    expect(tables).toContain('vict_appdata_migrations');
    expect(tables).toContain('vict_appdata_idempotency');
    for (const table of tables) {
      expect(
        table.startsWith('appdata_') ||
          table === 'vict_appdata_migrations' ||
          table === 'vict_appdata_idempotency' ||
          table.startsWith('sqlite_'),
      ).toBe(true);
    }
  });
});
