import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { defineResource } from '@vict/sdk';
import { createSqliteApplicationData, physicalTableName } from '@vict/appdata-sqlite';

/**
 * SQL-injection resistance and safe physical mapping (Stage 05).
 *
 * Hostile author or caller strings must never become SQL: physical table
 * names derive only from validated resource ids; the only interpolated
 * fragments are `json_extract` paths built from VALIDATED catalogue field
 * names; every value is bound. Failed injection attempts leave clean
 * structured diagnostics and a usable store.
 */

const resource = defineResource({
  schema: 'vict.resource@1',
  id: 'notes',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'title', type: 'string', required: true },
  ],
  mutations: [{ op: 'create', effect: 'write', permissions: [] }],
  authorization: { effect: 'read' },
}) as ReturnType<typeof defineResource>;

const write = { permissions: [], effect: 'write' as const };
const read = { permissions: [], effect: 'read' as const };

function makeAdapter(): { adapter: ReturnType<typeof createSqliteApplicationData>; path: string } {
  const path = join(mkdtempSync(join(tmpdir(), 'vict-appdata-sqli-')), 'appdata.db');
  return { adapter: createSqliteApplicationData({ path, resources: [resource] }), path };
}

describe('SQL-injection resistance', () => {
  it('parameterizes filter, search, and identity values', async () => {
    const { adapter } = makeAdapter();
    await adapter.mutate(
      {
        resourceId: 'notes',
        op: 'create',
        input: { id: "n'; DROP TABLE appdata_notes;--", title: "x' OR '1'='1" },
      },
      write,
    );
    const injectionFilters = await adapter.query(
      { op: 'list', resourceId: 'notes', filters: { title: "' OR '1'='1" } },
      read,
    );
    expect(injectionFilters.ok).toBe(true);
    if (injectionFilters.ok) expect(injectionFilters.total).toBe(0); // literal comparison, never SQL semantics
    const literalFilters = await adapter.query(
      { op: 'list', resourceId: 'notes', filters: { title: "x' OR '1'='1" } },
      read,
    );
    expect(literalFilters.ok).toBe(true);
    if (literalFilters.ok) expect(literalFilters.total).toBe(1); // the exact stored string matches

    const injectionSearch = await adapter.query(
      {
        op: 'list',
        resourceId: 'notes',
        search: { text: "%'; DROP TABLE appdata_notes;--", fields: ['title'] },
      },
      read,
    );
    expect(injectionSearch.ok).toBe(true);
    if (injectionSearch.ok) expect(injectionSearch.total).toBe(0); // wildcards escaped: literal text

    const injectionIdentity = await adapter.query(
      { op: 'get', resourceId: 'notes', id: "n' OR '1'='1" },
      read,
    );
    expect(injectionIdentity.ok).toBe(false);
    if (!injectionIdentity.ok) expect(injectionIdentity.code).toBe('DATA_UNKNOWN_IDENTITY');
    adapter.close();
  });

  it('rejects unknown filter/sort/search fields instead of interpolating them', async () => {
    const { adapter } = makeAdapter();
    for (const request of [
      {
        op: 'list' as const,
        resourceId: 'notes',
        filters: { "x'); DROP TABLE appdata_notes;--": 'v' },
      },
      {
        op: 'list' as const,
        resourceId: 'notes',
        sort: [{ field: "x'); DROP TABLE appdata_notes;--", direction: 'asc' as const }],
      },
      {
        op: 'list' as const,
        resourceId: 'notes',
        search: { text: 'x', fields: ["x'); DROP TABLE appdata_notes;--"] },
      },
      {
        op: 'list' as const,
        resourceId: 'notes',
        projection: ["x'); DROP TABLE appdata_notes;--"],
      },
    ]) {
      const out = await adapter.query(request, read);
      expect(out.ok).toBe(false);
      if (!out.ok) {
        expect(out.code === 'DATA_UNSUPPORTED_QUERY' || out.code === 'DATA_INVALID_REQUEST').toBe(
          true,
        );
      }
    }
    // The physical table is untouched and serving traffic.
    const still = await adapter.query({ op: 'list', resourceId: 'notes' }, read);
    expect(still.ok).toBe(true);
    adapter.close();
  });

  it('never creates attacker-named tables; only validated physical tables exist', async () => {
    const { adapter, path } = makeAdapter();
    await adapter.mutate(
      {
        resourceId: 'notes',
        op: 'create',
        input: { id: "x'; CREATE TABLE appdata_pwned (a TEXT);--", title: 'y' },
      },
      write,
    );
    const row = await adapter.query(
      { op: 'get', resourceId: 'notes', id: "x'; CREATE TABLE appdata_pwned (a TEXT);--" },
      read,
    );
    expect(row.ok).toBe(true); // stored literally as data
    adapter.close();

    const { DatabaseSync } = await import('node:sqlite');
    const raw = new DatabaseSync(path);
    const tables = (
      raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;").all() as {
        name: string;
      }[]
    ).map((entry) => entry.name);
    raw.close();
    expect(tables).toContain(physicalTableName('notes'));
    expect(tables).not.toContain('appdata_pwned');
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
