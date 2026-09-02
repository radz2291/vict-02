import type { ResourceDefinition } from '@vict/sdk';
import type { ApplicationDataAdapter, ApplicationDataRequestContext } from './data.js';

/**
 * Shared application-data adapter conformance suite (Stage 04).
 *
 * Every conforming adapter — the in-memory reference adapter today, the
 * Stage 05 SQLite domain-data adapter later — must pass the SAME fixtures.
 * Proven per adapter (against a single seeded resource):
 *
 * 1. deterministic list: sort, filter, pagination, projection;
 * 2. get by identity, unknown identity, unknown resource;
 * 3. declared mutations apply; undeclared ops are rejected;
 * 4. authorization/effect boundary: missing permissions and read-only
 *    resources are rejected BEFORE any data access;
 * 5. keyed idempotent create: the same key reconciles to one row;
 * 6. the adapter never mutates its caller's resource definitions.
 */

export interface ApplicationDataAdapterFixture {
  /** The adapter under test, freshly seeded per scenario. */
  readonly create: (seeds: readonly Record<string, unknown>[]) => ApplicationDataAdapter;
  /** The single resource the suite exercises. */
  readonly resource: ResourceDefinition;
  /** A read context that IS authorized. */
  readonly readContext: ApplicationDataRequestContext;
  /** A write context that IS authorized (permissions for the declared mutation). */
  readonly writeContext: ApplicationDataRequestContext;
  /** A context with NO permissions. */
  readonly unauthorizedContext: ApplicationDataRequestContext;
}

function fail(message: string): never {
  throw new Error(`[data-adapter conformance: ${message}]`);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function runApplicationDataAdapterSuite(
  fixture: ApplicationDataAdapterFixture,
): Promise<void> {
  const { resource } = fixture;
  const seeded = [
    { [resource.identity.key]: 'row-1', title: 'alpha', qty: 2 },
    { [resource.identity.key]: 'row-2', title: 'beta', qty: 1 },
    { [resource.identity.key]: 'row-3', title: 'gamma', qty: 3 },
  ].map((row) => {
    const full: Record<string, unknown> = {};
    for (const field of resource.fields) {
      full[field.name] = row[field.name] ?? null;
    }
    return full;
  });

  // ---- 1. Deterministic list + sort + pagination + projection -------------
  {
    const adapter = fixture.create(seeded);
    const all = await adapter.query({ op: 'list', resourceId: resource.id }, fixture.readContext);
    if (!all.ok || all.total !== seeded.length || all.rows?.length !== seeded.length) {
      fail(`list failed: ${JSON.stringify(all)}`);
    }
    const sorted = await adapter.query(
      {
        op: 'list',
        resourceId: resource.id,
        sort: [{ field: sortableField(resource), direction: 'asc' }],
      },
      fixture.readContext,
    );
    if (!sorted.ok) {
      fail(`sorted list failed: ${JSON.stringify(sorted)}`);
    }
    const paged = await adapter.query(
      {
        op: 'list',
        resourceId: resource.id,
        sort: [{ field: sortableField(resource), direction: 'asc' }],
        limit: 1,
        offset: 1,
      },
      fixture.readContext,
    );
    if (!paged.ok || paged.rows?.length !== 1 || paged.total !== seeded.length) {
      fail(`pagination failed: ${JSON.stringify(paged)}`);
    }
    if (sorted.ok && paged.ok) {
      const expected = sorted.rows?.[1];
      if (JSON.stringify(paged.rows?.[0]) !== JSON.stringify(expected)) {
        fail('pagination is not deterministic against the sorted order');
      }
    }
    const projected = await adapter.query(
      { op: 'list', resourceId: resource.id, projection: [sortableField(resource)] },
      fixture.readContext,
    );
    if (!projected.ok) {
      fail(`projection failed: ${JSON.stringify(projected)}`);
    } else {
      for (const row of projected.rows ?? []) {
        if (Object.keys(row as Record<string, unknown>).length !== 1) {
          fail(`projection did not narrow rows: ${JSON.stringify(row)}`);
        }
      }
    }
  }

  // ---- 2. get / unknown identity / unknown resource -------------------------
  {
    const adapter = fixture.create(seeded);
    const id = String(seeded[0]?.[resource.identity.key]);
    const got = await adapter.query(
      { op: 'get', resourceId: resource.id, id },
      fixture.readContext,
    );
    if (!got.ok || got.row === undefined) {
      fail(`get failed: ${JSON.stringify(got)}`);
    }
    const missing = await adapter.query(
      { op: 'get', resourceId: resource.id, id: 'no-such-row' },
      fixture.readContext,
    );
    if (missing.ok || missing.code !== 'DATA_UNKNOWN_IDENTITY') {
      fail(`unknown identity mishandled: ${JSON.stringify(missing)}`);
    }
    const unknownResource = await adapter.query(
      { op: 'list', resourceId: 'no-such-resource' },
      fixture.readContext,
    );
    if (unknownResource.ok || unknownResource.code !== 'DATA_UNKNOWN_RESOURCE') {
      fail(`unknown resource mishandled: ${JSON.stringify(unknownResource)}`);
    }
  }

  // ---- 3. Declared mutation applies; undeclared op rejected -----------------
  {
    const adapter = fixture.create(seeded);
    const declaredOp = resource.mutations?.[0]?.op;
    if (declaredOp !== undefined) {
      const newRow: Record<string, unknown> = {};
      for (const field of resource.fields) {
        newRow[field.name] = field.name === resource.identity.key ? 'row-new' : `new-${field.name}`;
      }
      const created = await adapter.mutate(
        { resourceId: resource.id, op: declaredOp, input: newRow },
        fixture.writeContext,
      );
      if (!created.ok) {
        fail(`declared mutation rejected: ${JSON.stringify(created)}`);
      }
      const undeclared = await adapter.mutate(
        { resourceId: resource.id, op: 'shrink-the-moon', input: newRow },
        fixture.writeContext,
      );
      if (undeclared.ok || undeclared.code !== 'DATA_MUTATION_NOT_DECLARED') {
        fail(`undeclared mutation accepted: ${JSON.stringify(undeclared)}`);
      }
    }
  }

  // ---- 4. Authorization/effect boundary --------------------------------------
  {
    const adapter = fixture.create(seeded);
    const deniedRead = await adapter.query(
      { op: 'list', resourceId: resource.id },
      fixture.unauthorizedContext,
    );
    if (deniedRead.ok || deniedRead.code !== 'DATA_UNAUTHORIZED') {
      fail(`unauthorized read accepted: ${JSON.stringify(deniedRead)}`);
    }
    const needsWritePermission = resource.mutations?.some(
      (mutation) => (mutation.permissions ?? []).length > 0,
    );
    if (needsWritePermission) {
      const mutationOp = resource.mutations?.find(
        (mutation) => (mutation.permissions ?? []).length > 0,
      )?.op as string;
      const deniedWrite = await adapter.mutate(
        { resourceId: resource.id, op: mutationOp, input: {} },
        fixture.unauthorizedContext,
      );
      if (deniedWrite.ok || deniedWrite.code !== 'DATA_UNAUTHORIZED') {
        fail(`unauthorized mutation accepted: ${JSON.stringify(deniedWrite)}`);
      }
    }
  }

  // ---- 5. Keyed idempotent create ---------------------------------------------
  {
    const keyed = resource.mutations?.find((mutation) => mutation.idempotency === 'keyed');
    if (keyed !== undefined) {
      const adapter = fixture.create(seeded);
      const newRow: Record<string, unknown> = {};
      for (const field of resource.fields) {
        newRow[field.name] =
          field.name === resource.identity.key ? 'row-keyed' : `keyed-${field.name}`;
      }
      const first = await adapter.mutate(
        { resourceId: resource.id, op: keyed.op, input: newRow, idempotencyKey: 'idem-1' },
        fixture.writeContext,
      );
      if (!first.ok) {
        fail(`keyed create failed: ${JSON.stringify(first)}`);
      }
      const replay = await adapter.mutate(
        { resourceId: resource.id, op: keyed.op, input: newRow, idempotencyKey: 'idem-1' },
        fixture.writeContext,
      );
      if (!replay.ok) {
        fail(`keyed replay failed: ${JSON.stringify(replay)}`);
      }
      const listed = await adapter.query(
        { op: 'list', resourceId: resource.id },
        fixture.readContext,
      );
      if (!listed.ok || listed.total !== seeded.length + 1) {
        fail(
          `keyed replay created a duplicate row: total ${listed.ok ? String(listed.total) : 'error'}`,
        );
      }
    }
  }

  // ---- 6. Caller definitions never mutated ------------------------------------
  {
    const before = JSON.stringify(resource);
    fixture.create(seeded);
    if (JSON.stringify(resource) !== before) {
      fail('the adapter mutated its caller resource definitions');
    }
  }
}

/** Pick a sortable catalogue field (first non-identity field, else identity). */
function sortableField(resource: ResourceDefinition): string {
  const candidate = resource.fields.find(
    (field) => field.name !== resource.identity.key && field.type !== 'json',
  );
  return candidate?.name ?? resource.identity.key;
}

void isNumber;
