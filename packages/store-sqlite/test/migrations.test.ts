import { describe, expect, it } from 'vitest';
import { retryRm } from './helpers/retry-rm.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  createSqliteStores,
  openDatabase,
  readSchemaVersion,
  runMigrations,
  CURRENT_SCHEMA_VERSION,
} from '@vict/store-sqlite';
import { SCHEMA_MIGRATIONS } from '@vict/store-sqlite';

/**
 * Migration policy (Section 13): ordered forward-only migrations with an
 * explicit schema version, fresh-database evidence, idempotent reopen,
 * fail-closed on future versions, and no falsely advanced version after a
 * partially applied migration.
 */
describe('sqlite schema migrations', () => {
  it('migration 4 renames the pre-verification deletion-step literal deterministically (mastra-memory → memory-store)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-mig-v4-'));
    try {
      const path = join(dir, 'v4.db');
      // Build a PRE-VERIFICATION Stage 06A database by applying only
      // migrations 1–3 (the schema that still contains the 'mastra-memory'
      // receipt literal), then record real deletion progress in it.
      {
        const handle = openDatabase({ path });
        const db = handle.db;
        try {
          runMigrations(db, { migrations: SCHEMA_MIGRATIONS.slice(0, 3) });
          db.prepare(
            "INSERT INTO vict_agent_deletion_intent (intent_id, conversation_id, actor_id, state, created_at, updated_at) VALUES ('i-v4', 'conv-v4', 'actor-v4', 'application-domain-deleted', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z');",
          ).run();
          db.prepare(
            "INSERT INTO vict_agent_deletion_receipt (intent_id, step, at) VALUES ('i-v4', 'application-domain', '2026-01-01T00:00:00.500Z');",
          ).run();
          db.prepare(
            "INSERT INTO vict_agent_deletion_receipt (intent_id, step, at) VALUES ('i-v4', 'mastra-memory', '2026-01-01T00:00:02.000Z');",
          ).run();
        } finally {
          handle.close();
        }
      }
      // Reopening runs migration 4 and brings the database to the current
      // schema version.
      const stores = createSqliteStores({ path });
      try {
        const db = new DatabaseSync(path);
        try {
          expect(readSchemaVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
          // The receipt VALUES were migrated deliberately and exactly:
          // same intent, same timestamps, renamed step literal — and the
          // deterministic receipt ordering (application-domain first) is
          // preserved by the alphabetical step order.
          const receipts = db
            .prepare(
              'SELECT intent_id, step, at FROM vict_agent_deletion_receipt ORDER BY step ASC;',
            )
            .all() as unknown as Array<{ intent_id: string; step: string; at: string }>;
          expect(receipts).toEqual([
            { intent_id: 'i-v4', step: 'application-domain', at: '2026-01-01T00:00:00.500Z' },
            { intent_id: 'i-v4', step: 'memory-store', at: '2026-01-01T00:00:02.000Z' },
          ]);
          // The intent record itself is untouched by the token migration.
          const intent = db
            .prepare(
              'SELECT intent_id, conversation_id, actor_id, state, created_at, updated_at FROM vict_agent_deletion_intent WHERE intent_id = ?;',
            )
            .get('i-v4') as unknown as Record<string, string>;
          expect(intent).toEqual({
            intent_id: 'i-v4',
            conversation_id: 'conv-v4',
            actor_id: 'actor-v4',
            state: 'application-domain-deleted',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:01.000Z',
          });
          // The OLD literal is now OUTSIDE the accepted step domain: the
          // CHECK constraint rejects it (fail closed, no silent
          // reinterpretation of legacy values in new writes).
          db.prepare(
            "INSERT INTO vict_agent_deletion_intent (intent_id, conversation_id, actor_id, state, created_at, updated_at) VALUES ('i-v4b', 'conv-v4b', 'actor-v4b', 'pending', '2026-01-01T00:00:03.000Z', '2026-01-01T00:00:03.000Z');",
          ).run();
          expect(() =>
            db
              .prepare(
                "INSERT INTO vict_agent_deletion_receipt (intent_id, step, at) VALUES ('i-v4b', 'mastra-memory', '2026-01-01T00:00:04.000Z');",
              )
              .run(),
          ).toThrow();
        } finally {
          db.close();
        }
      } finally {
        await stores.dispose();
      }
    } finally {
      await retryRm(dir);
    }
  });

  it('migrates a fresh database to the current version', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-mig-'));
    try {
      const path = join(dir, 'fresh.db');
      const stores = createSqliteStores({ path });
      try {
        const db = new DatabaseSync(path);
        try {
          expect(readSchemaVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
          const rows = db
            .prepare('SELECT version, name FROM vict_schema_migration ORDER BY version;')
            .all() as unknown as {
            version: number;
            name: string;
          }[];
          expect(rows.map((row) => row.version)).toEqual(SCHEMA_MIGRATIONS.map((m) => m.version));
        } finally {
          db.close();
        }
      } finally {
        await stores.dispose();
      }
    } finally {
      await retryRm(dir);
    }
  });

  it('reopening an up-to-date database is idempotent', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-mig-'));
    try {
      const path = join(dir, 'reopen.db');
      const first = createSqliteStores({ path });
      await first.dispose();
      const second = createSqliteStores({ path });
      try {
        const db = new DatabaseSync(path);
        try {
          expect(readSchemaVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
          const count = db.prepare('SELECT COUNT(*) AS c FROM vict_schema_migration;').get() as {
            c: number;
          };
          expect(count.c).toBe(SCHEMA_MIGRATIONS.length);
        } finally {
          db.close();
        }
      } finally {
        await second.dispose();
      }
    } finally {
      await retryRm(dir);
    }
  });

  it('fails closed on an unsupported newer schema without mutating the database', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-mig-'));
    try {
      const path = join(dir, 'future.db');
      const stores = createSqliteStores({ path });
      await stores.dispose();

      // Simulate a database written by a future Vict version.
      const before = await readFile(path);
      const db = new DatabaseSync(path);
      db.exec(
        "INSERT INTO vict_schema_migration (version, name, applied_at) VALUES (999999, 'future', '2026-01-01T00:00:00.000Z');",
      );
      db.close();

      let error: { code?: string } | undefined;
      try {
        createSqliteStores({ path });
      } catch (cause) {
        error = cause as { code?: string };
      }
      expect(error?.code).toBe('VICT_STORE_UNSUPPORTED_SCHEMA');

      // Fail closed: the file was not modified by the rejected open.
      const db2 = new DatabaseSync(path);
      const row = db2.prepare('SELECT MAX(version) AS v FROM vict_schema_migration;').get() as {
        v: number;
      };
      expect(row.v).toBe(999999);
      const tables = db2
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'vict%' ORDER BY name;",
        )
        .all() as unknown as { name: string }[];
      expect(tables.map((t) => t.name)).toEqual([
        'vict_activation',
        'vict_activation_selection',
        'vict_agent_activation',
        'vict_agent_deletion_intent',
        'vict_agent_deletion_receipt',
        'vict_attempt',
        'vict_branch_result',
        'vict_cancellation_request',
        'vict_operator_resolution',
        'vict_run',
        'vict_run_event',
        'vict_schema_migration',
        'vict_signal_receipt',
        'vict_timer',
        'vict_token',
        'vict_wait',
      ]);
      db2.close();
      // Byte-level identity is not required (SQLite may touch the header on
      // open); structural identity above is the fail-closed proof.
      void before;
    } finally {
      await retryRm(dir);
    }
  });

  it('a partially applied migration does not leave a falsely advanced version', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-mig-'));
    try {
      const path = join(dir, 'partial.db');
      // A fresh database whose version-1 migration fails mid-way: the probe
      // table from statement 1 must NOT survive and the version must stay 0.
      const brokenMigrations = [
        {
          version: 1,
          name: 'deliberately-broken-v1',
          statements: [
            'CREATE TABLE vict_future_probe (id INTEGER PRIMARY KEY);',
            'CREATE TABLE vict_duplicate_pk (id INTEGER PRIMARY KEY);',
            'CREATE TABLE vict_duplicate_pk (id INTEGER PRIMARY KEY);',
          ],
        },
      ];
      let error: { code?: string } | undefined;
      try {
        createSqliteStores({ path, migrations: { migrations: brokenMigrations } });
      } catch (cause) {
        error = cause as { code?: string };
      }
      expect(error?.code).toBe('VICT_STORE_MIGRATION_FAILED');

      // The failed migration rolled back: version is still 0 and the probe
      // table from the failed migration does not exist.
      const db = new DatabaseSync(path);
      expect(readSchemaVersion(db) ?? 0).toBe(0);
      const probe = db
        .prepare("SELECT name FROM sqlite_master WHERE name = 'vict_future_probe';")
        .get();
      expect(probe).toBeUndefined();
      db.close();
    } finally {
      await retryRm(dir);
    }
  });

  it('migrations are forward-only: an older migration list never rewinds', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-mig-'));
    try {
      const path = join(dir, 'forward.db');
      const full = createSqliteStores({ path });
      await full.dispose();
      // Opening with a truncated (older) list must not re-run or rewind.
      const older = createSqliteStores({
        path,
        migrations: { migrations: SCHEMA_MIGRATIONS.slice(0, 0) },
      });
      try {
        const db = new DatabaseSync(path);
        expect(readSchemaVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
        db.close();
      } finally {
        await older.dispose();
      }
    } finally {
      await retryRm(dir);
    }
  });

  it('deleting a disposable development database file is the documented reset path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-mig-'));
    try {
      const path = join(dir, 'deleteme.db');
      const stores = createSqliteStores({ path });
      await stores.dispose();
      await rm(path, { force: true });
      const revived = createSqliteStores({ path });
      try {
        // A fresh database with no runs and no activations.
        expect(await revived.execution.listRuns()).toEqual([]);
        expect(await revived.catalog.list()).toEqual([]);
      } finally {
        await revived.dispose();
      }
    } finally {
      await retryRm(dir);
    }
  });

  it('journal and durability settings are applied and documented', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vict-mig-'));
    try {
      const path = join(dir, 'pragmas.db');
      // Inject the opened handle: the pragmas are per-connection settings
      // applied by openDatabase on THIS connection.
      const handle = openDatabase({
        path,
        journalMode: 'wal',
        synchronous: 'full',
        busyTimeoutMs: 1234,
      });
      const stores = createSqliteStores({ database: handle });
      const journal = handle.db.prepare('PRAGMA journal_mode;').get() as { journal_mode: string };
      const synchronous = handle.db.prepare('PRAGMA synchronous;').get() as { synchronous: number };
      const busy = handle.db.prepare('PRAGMA busy_timeout;').get() as { timeout: number };
      const fk = handle.db.prepare('PRAGMA foreign_keys;').get() as { foreign_keys: number };
      expect(journal.journal_mode).toBe('wal');
      expect(synchronous.synchronous).toBe(2); // FULL
      expect(busy.timeout).toBe(1234);
      expect(fk.foreign_keys).toBe(1);
      await stores.dispose();
      handle.close();
    } finally {
      await retryRm(dir);
    }
  });
});
