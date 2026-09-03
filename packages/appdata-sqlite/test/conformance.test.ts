import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import { defineContract, defineResource, RESOURCE_DEFINITION_SCHEMA } from '@vict/sdk';
import { createInMemoryApplicationData } from '@vict/application';
import { runApplicationDataAdapterSuite } from '@vict/application/testing';
import {
  createSqliteApplicationData,
  physicalTableName,
  readDurabilityPragmas,
  openAppDatabase,
  type SqliteApplicationDataAdapter,
} from '@vict/appdata-sqlite';

/**
 * Shared application-data conformance (Stage 05).
 *
 * The SQLite application-domain adapter MUST pass the SAME shared suite as
 * the in-memory reference adapter — including the Stage 05 additions:
 * declared search and the LOW-C-1 hostile-container diagnostics. The
 * in-memory adapter runs through the identical fixture in this file too,
 * proving both adapters stay aligned at their public boundary.
 */

const noteInput = defineContract<{ id: string; title: string; qty: number }>({
  id: 'appdata.note.input',
  revision: '1',
  expected: '{ id, title, qty }',
  parse: (input) => {
    const candidate = input as { id?: unknown; title?: unknown; qty?: unknown } | null;
    if (
      candidate !== null &&
      typeof candidate === 'object' &&
      typeof candidate.id === 'string' &&
      candidate.id.length > 0 &&
      typeof candidate.title === 'string' &&
      typeof candidate.qty === 'number' &&
      Number.isFinite(candidate.qty)
    ) {
      const known = Object.keys(candidate).every((key) => ['id', 'title', 'qty'].includes(key));
      if (known) {
        return {
          ok: true as const,
          value: { id: candidate.id, title: candidate.title, qty: candidate.qty },
        };
      }
      return {
        ok: false as const,
        issues: [{ code: 'unknown_field', path: '(root)', message: 'unknown fields are rejected' }],
      };
    }
    return {
      ok: false as const,
      issues: [{ code: 'invalid_type', path: '(root)', message: 'a note record is required' }],
    };
  },
});

const resource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'notes',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'title', type: 'string', required: true, label: 'Title' },
    { name: 'qty', type: 'number', label: 'Qty' },
  ],
  queries: { list: { sort: ['title'], pagination: true } },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'appdata.note.input',
      idempotency: 'keyed',
      permissions: ['notes.create'],
    },
    { op: 'update', effect: 'write', permissions: ['notes.create'] },
    { op: 'delete', effect: 'write', permissions: ['notes.create'] },
  ],
  authorization: { effect: 'read', permissions: ['notes.read'] },
});

const opened: SqliteApplicationDataAdapter[] = [];

afterAll(() => {
  for (const adapter of opened) {
    adapter.close();
  }
});

/** A fresh file-backed SQLite adapter seeded through the validated seed path. */
function seededSqlite(seeds: readonly Record<string, unknown>[]): SqliteApplicationDataAdapter {
  const dir = mkdtempSync(join(tmpdir(), 'vict-appdata-suite-'));
  const adapter = createSqliteApplicationData({
    path: join(dir, 'appdata.db'),
    resources: [resource],
    contracts: [noteInput],
    seeds: { notes: seeds },
  });
  opened.push(adapter);
  return adapter;
}

describe('shared application-data conformance suite (Stage 05, both adapters)', () => {
  it('SQLite application-domain adapter passes every shared invariant', async () => {
    await expect(
      runApplicationDataAdapterSuite({
        create: (seeds) => seededSqlite(seeds),
        resource,
        readContext: { permissions: ['notes.read'], effect: 'read' },
        writeContext: { permissions: ['notes.read', 'notes.create'], effect: 'write' },
        unauthorizedContext: { permissions: [], effect: 'read' },
      }),
    ).resolves.toBeUndefined();
  });

  it('in-memory reference adapter passes the identical suite (alignment)', async () => {
    await expect(
      runApplicationDataAdapterSuite({
        create: (seeds) =>
          createInMemoryApplicationData([resource], {
            contracts: [noteInput],
            seeds: { notes: seeds },
          }),
        resource,
        readContext: { permissions: ['notes.read'], effect: 'read' },
        writeContext: { permissions: ['notes.read', 'notes.create'], effect: 'write' },
        unauthorizedContext: { permissions: [], effect: 'read' },
      }),
    ).resolves.toBeUndefined();
  });
});

describe('SQLite application-domain adapter durability and separation', () => {
  it('maps resources to validated appdata_ physical tables', () => {
    expect(physicalTableName('notes')).toBe('appdata_notes');
    expect(() => physicalTableName('Notes')).toThrow();
    expect(() => physicalTableName('notes; DROP TABLE x')).toThrow();
    expect(() => physicalTableName('')).toThrow();
  });

  it('rejects resources without a safe physical mapping at open', () => {
    const bad = defineResource({
      schema: RESOURCE_DEFINITION_SCHEMA,
      id: 'Bad Resource',
      revision: '1',
      identity: { key: 'id' },
      fields: [{ name: 'id', type: 'string', required: true }],
    });
    expect(() => createSqliteApplicationData({ resources: [bad] })).toThrowError(/snake_case/);
  });

  it('reads durability pragmas (WAL, synchronous=FULL, foreign keys)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vict-appdata-pragma-'));
    const handle = openAppDatabase(join(dir, 'p.db'));
    const pragmas = readDurabilityPragmas(handle.db);
    expect(pragmas.journalMode).toBe('wal');
    expect(pragmas.synchronous).toBe('2'); // FULL = 2
    expect(pragmas.foreignKeys).toBe('1');
    handle.close();
  });
});
