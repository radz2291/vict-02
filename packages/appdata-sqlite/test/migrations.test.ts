import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { defineResource, RESOURCE_DEFINITION_SCHEMA } from '@vict/sdk';
import {
  createSqliteApplicationData,
  migrationsFromResources,
  VictApplicationDataError,
} from '@vict/appdata-sqlite';

/**
 * Application-domain migration semantics (OPEN-014 decision, Stage 05):
 * forward ordering, transactional application with rollback on injected
 * failure, duplicate-identity conflicts, future-schema fail-closed
 * behavior, inspectable history, and separation from Vict operational
 * migrations.
 */

const resourceA = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'widgets',
  revision: '1',
  identity: { key: 'id' },
  fields: [{ name: 'id', type: 'string', required: true }],
});

const resourceB = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'gadgets',
  revision: '1',
  identity: { key: 'id' },
  fields: [{ name: 'id', type: 'string', required: true }],
});

function tempDb(): string {
  return join(mkdtempSync(join(tmpdir(), 'vict-appdata-mig-')), 'appdata.db');
}

describe('application-domain migrations', () => {
  it('applies pending migrations in forward order and records inspectable history', () => {
    const adapter = createSqliteApplicationData({
      path: tempDb(),
      resources: [resourceA],
      migrations: [
        migrationsFromResources([resourceA], 1),
        {
          id: 'appdata-add-gadgets',
          version: 2,
          name: 'add-gadgets',
          statements: [
            'CREATE TABLE appdata_gadgets (identity TEXT PRIMARY KEY, data TEXT NOT NULL);',
          ],
        },
      ],
      now: () => '2026-09-04T00:00:00.000Z',
    });
    const history = adapter.appliedMigrations();
    expect(history.map((m) => m.version)).toEqual([1, 2]);
    expect(history[0]?.appliedAt).toBe('2026-09-04T00:00:00.000Z');
    adapter.close();
  });

  it('is idempotent on safe reopen; only pending migrations run', () => {
    const path = tempDb();
    const first = createSqliteApplicationData({
      path,
      resources: [resourceA],
      migrations: [migrationsFromResources([resourceA], 1)],
      now: () => 'T1',
    });
    first.close();
    const second = createSqliteApplicationData({
      path,
      resources: [resourceA],
      migrations: [
        migrationsFromResources([resourceA], 1),
        {
          id: 'appdata-second',
          version: 2,
          name: 'second',
          statements: ['CREATE TABLE IF NOT EXISTS appdata_extra (id TEXT);'],
        },
      ],
      now: () => 'T2',
    });
    const history = second.appliedMigrations();
    expect(history.map((m) => m.version)).toEqual([1, 2]);
    expect(history[0]?.appliedAt).toBe('T1'); // original bookkeeping preserved
    expect(history[1]?.appliedAt).toBe('T2');
    second.close();
  });

  it('rolls back an injected migration failure; history and data stay at the prior version', () => {
    const path = tempDb();
    expect(() =>
      createSqliteApplicationData({
        path,
        resources: [resourceA],
        migrations: [
          migrationsFromResources([resourceA], 1),
          {
            id: 'appdata-broken',
            version: 2,
            name: 'broken',
            statements: ['CREATE TABLE appdata_ok (id TEXT);', 'THIS IS NOT VALID SQL;'],
          },
        ],
      }),
    ).toThrowError(VictApplicationDataError);
    const adapter = createSqliteApplicationData({
      path,
      resources: [resourceA],
      migrations: [migrationsFromResources([resourceA], 1)],
    });
    expect(adapter.appliedMigrations().map((m) => m.version)).toEqual([1]);
    // Data written at version 1 is untouched.
    const out = adapter.query(
      { op: 'list', resourceId: 'widgets' },
      { permissions: [], effect: 'read' },
    );
    void out;
    adapter.close();

    // Reopening WITHOUT the broken migration succeeds; the database is
    // still at version 1 and usable.
    const reopened = createSqliteApplicationData({
      path,
      resources: [resourceA],
      migrations: [migrationsFromResources([resourceA], 1)],
    });
    expect(reopened.appliedMigrations().map((m) => m.version)).toEqual([1]);
    reopened.close();
  });

  it('fails closed on a future, unsupported application-domain schema version', async () => {
    const path = tempDb();
    const advanced = createSqliteApplicationData({
      path,
      resources: [resourceA],
      migrations: [migrationsFromResources([resourceA], 1)],
    });
    advanced.close();
    // Simulate a future deployment that applied version 7.
    const { DatabaseSync } = await import('node:sqlite');
    const raw = new DatabaseSync(path);
    raw.exec(
      `INSERT INTO vict_appdata_migrations (version, id, name, applied_at) VALUES (7, 'future-migration', 'future', 'T9');`,
    );
    raw.close();
    expect(() =>
      createSqliteApplicationData({
        path,
        resources: [resourceA],
        migrations: [migrationsFromResources([resourceA], 1)],
      }),
    ).toThrowError(VictApplicationDataError);
    expect(() =>
      createSqliteApplicationData({
        path,
        resources: [resourceA],
        migrations: [migrationsFromResources([resourceA], 1)],
      }),
    ).toThrowError(/newer, unsupported/);
  });

  it('rejects duplicate migration identities and versions, and out-of-order declarations', () => {
    const path = tempDb();
    expect(() =>
      createSqliteApplicationData({
        path,
        resources: [resourceA],
        migrations: [
          migrationsFromResources([resourceA], 1),
          { id: 'appdata-x', version: 3, name: 'x', statements: [] },
          { id: 'appdata-x', version: 4, name: 'dup-id', statements: [] },
        ],
      }),
    ).toThrowError(/unique/);
    expect(() =>
      createSqliteApplicationData({
        path: tempDb(),
        resources: [resourceA],
        migrations: [
          { id: 'b', version: 3, name: 'b', statements: [] },
          { id: 'a', version: 2, name: 'a', statements: [] },
        ],
      }),
    ).toThrowError(/ascending/);
    expect(() =>
      createSqliteApplicationData({
        path: tempDb(),
        resources: [resourceA],
        migrations: [
          { id: 'a', version: 2, name: 'a', statements: [] },
          { id: 'b', version: 2, name: 'b', statements: [] },
        ],
      }),
    ).toThrowError(/unique|ascending/);
  });

  it('keeps a reused version with a different identity a conflict on reopen', () => {
    const path = tempDb();
    const first = createSqliteApplicationData({
      path,
      resources: [resourceA],
      migrations: [
        {
          id: 'appdata-original',
          version: 1,
          name: 'original',
          statements: [
            'CREATE TABLE appdata_widgets (identity TEXT PRIMARY KEY, data TEXT NOT NULL);',
          ],
        },
      ],
    });
    first.close();
    expect(() =>
      createSqliteApplicationData({
        path,
        resources: [resourceA],
        migrations: [
          {
            id: 'appdata-hijacked',
            version: 1,
            name: 'hijacked',
            statements: [
              'CREATE TABLE IF NOT EXISTS appdata_widgets (identity TEXT PRIMARY KEY, data TEXT NOT NULL);',
            ],
          },
        ],
      }),
    ).toThrowError(/different migration identity/);
  });

  it('bootstrap helper derives safe DDL from resource definitions', () => {
    const migration = migrationsFromResources([resourceA, resourceB], 1);
    expect(migration.statements.length).toBe(2);
    expect(migration.statements[0]).toContain('CREATE TABLE IF NOT EXISTS appdata_widgets');
    expect(migration.statements[1]).toContain('CREATE TABLE IF NOT EXISTS appdata_gadgets');
  });
});
