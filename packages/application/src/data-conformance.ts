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
        newRow[field.name] = sampleValue(field, 'new');
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
        newRow[field.name] = sampleValue(field, 'keyed');
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

  // ---- 7. Failed mutations never consume idempotency keys (MED-04-C) --------
  {
    const keyed = resource.mutations?.find((mutation) => mutation.idempotency === 'keyed');
    if (keyed !== undefined) {
      const adapter = fixture.create(seeded);
      // 1) a create that FAILS (duplicate identity) with key 'K1';
      const duplicate: Record<string, unknown> = {};
      for (const field of resource.fields) {
        duplicate[field.name] =
          field.name === resource.identity.key
            ? String(seeded[0]?.[resource.identity.key])
            : sampleValue(field, 'dup');
      }
      const failed = await adapter.mutate(
        { resourceId: resource.id, op: keyed.op, input: duplicate, idempotencyKey: 'K1' },
        fixture.writeContext,
      );
      if (failed.ok) {
        fail(`the duplicate create should have failed: ${JSON.stringify(failed)}`);
      }
      // 2) a RETRY with the same key but a DIFFERENT identity must be a
      //    stable conflict — never a silent reconcile to an unrelated row.
      const retry: Record<string, unknown> = {};
      for (const field of resource.fields) {
        retry[field.name] =
          field.name === resource.identity.key ? 'brand-new' : sampleValue(field, 'retry');
      }
      const retried = await adapter.mutate(
        { resourceId: resource.id, op: keyed.op, input: retry, idempotencyKey: 'K1' },
        fixture.writeContext,
      );
      // Because the failed attempt never consumed the key, the retry is a
      // FRESH attempt: it must actually create the retried identity — never
      // reconcile to the unrelated earlier row ('existing').
      if (!retried.ok) {
        fail(`the failed-key retry did not proceed as a fresh create: ${JSON.stringify(retried)}`);
      }
      const retriedRow = retried.row as Record<string, unknown> | undefined;
      if (retriedRow?.[resource.identity.key] !== 'brand-new') {
        fail(
          `the retry reconciled to an unrelated row instead of creating its own: ${JSON.stringify(retriedRow)}`,
        );
      }
      const listedAfterRetry = await adapter.query(
        { op: 'list', resourceId: resource.id },
        fixture.readContext,
      );
      if (listedAfterRetry.ok && listedAfterRetry.total !== seeded.length + 1) {
        fail('the retried row was never created');
      }
    }
  }

  // ---- 8. Keys are scoped per resource AND per mutation operation -----------
  {
    const adapter = fixture.create(seeded);
    // The same textual key on a DIFFERENT resource cannot collide: the
    // unknown-resource request is rejected, never silently reconciled.
    const wrongResource = await adapter.mutate(
      {
        resourceId: 'no-such-resource',
        op: 'create',
        input: {},
        idempotencyKey: 'K1',
      },
      fixture.writeContext,
    );
    if (wrongResource.ok) {
      fail('a key used on another resource silently reconciled');
    }
  }

  // ---- 9. Same key, different canonical request: stable conflict ------------
  {
    const keyed = resource.mutations?.find((candidate) => candidate.idempotency === 'keyed');
    if (keyed !== undefined) {
      const adapter = fixture.create(seeded);
      const first: Record<string, unknown> = {};
      for (const field of resource.fields) {
        first[field.name] =
          field.name === resource.identity.key ? 'row-conflict' : sampleValue(field, 'one');
      }
      const committed = await adapter.mutate(
        { resourceId: resource.id, op: keyed.op, input: first, idempotencyKey: 'conflict-1' },
        fixture.writeContext,
      );
      if (!committed.ok) {
        fail(`the keyed create failed: ${JSON.stringify(committed)}`);
      }
      const conflicting: Record<string, unknown> = { ...first };
      const titleField = resource.fields.find(
        (field) => field.name !== resource.identity.key && field.type === 'string',
      );
      if (titleField !== undefined) {
        conflicting[titleField.name] = 'DIFFERENT';
        const conflict = await adapter.mutate(
          {
            resourceId: resource.id,
            op: keyed.op,
            input: conflicting,
            idempotencyKey: 'conflict-1',
          },
          fixture.writeContext,
        );
        if (conflict.ok || conflict.code !== 'DATA_IDEMPOTENCY_CONFLICT') {
          fail(
            `same key with different input must be a stable conflict: ${JSON.stringify(conflict)}`,
          );
        }
        // The same key with the SAME canonical request still reconciles.
        const reconciled = await adapter.mutate(
          { resourceId: resource.id, op: keyed.op, input: first, idempotencyKey: 'conflict-1' },
          fixture.writeContext,
        );
        if (!reconciled.ok) {
          fail(`same-key same-request reconciliation broke: ${JSON.stringify(reconciled)}`);
        }
      }
    }
  }

  // ---- 10. Concurrent same-key mutations commit ONE logical mutation --------
  {
    const keyed = resource.mutations?.find((candidate) => candidate.idempotency === 'keyed');
    if (keyed !== undefined) {
      const adapter = fixture.create(seeded);
      const row: Record<string, unknown> = {};
      for (const field of resource.fields) {
        row[field.name] =
          field.name === resource.identity.key ? 'row-concurrent' : sampleValue(field, 'conc');
      }
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          adapter.mutate(
            { resourceId: resource.id, op: keyed.op, input: row, idempotencyKey: 'concurrent-1' },
            fixture.writeContext,
          ),
        ),
      );
      const listed = await adapter.query(
        { op: 'list', resourceId: resource.id },
        fixture.readContext,
      );
      if (!listed.ok || listed.total !== seeded.length + 1) {
        fail(
          `concurrent same-key mutations created ${listed.ok ? String(listed.total) : 'error'} rows (expected ${seeded.length + 1})`,
        );
      }
      if (!results.some((result) => result.ok)) {
        fail('every concurrent same-key mutation failed');
      }
    }
  }

  // ---- 11. Contract/type enforcement and hostile-field rejection -------------
  {
    const adapter = fixture.create(seeded);
    const wrongType: Record<string, unknown> = {};
    for (const field of resource.fields) {
      wrongType[field.name] =
        field.type === 'number'
          ? 'not-a-number'
          : field.type === 'string'
            ? 12345
            : sampleValue(field, 'typed');
    }
    const hasTypedField = resource.fields.some(
      (field) => field.type === 'number' || field.type === 'string',
    );
    if (hasTypedField) {
      const wrongTyped = await adapter.mutate(
        { resourceId: resource.id, op: 'create', input: wrongType },
        fixture.writeContext,
      );
      if (wrongTyped.ok) {
        fail(`wrong-typed mutation input was accepted: ${JSON.stringify(wrongTyped)}`);
      }
    }
    // Unknown/attacker fields are REJECTED (strict create policy).
    const hostile: Record<string, unknown> = {};
    for (const field of resource.fields) {
      hostile[field.name] = sampleValue(field, 'host');
    }
    hostile['is_admin'] = true;
    hostile['password'] = 'hunter2';
    const hostileResult = await adapter.mutate(
      { resourceId: resource.id, op: 'create', input: hostile },
      fixture.writeContext,
    );
    if (hostileResult.ok) {
      fail('an undeclared hostile field was persisted');
    }
    // Update follows the SAME strict policy.
    const hostileUpdate = await adapter.mutate(
      {
        resourceId: resource.id,
        op: 'update',
        id: String(seeded[0]?.[resource.identity.key]),
        input: { is_admin: true },
      },
      fixture.writeContext,
    );
    if (hostileUpdate.ok) {
      fail('an undeclared field was accepted by update');
    }
  }

  // ---- 12. Nested defensive-copy probes (MED-04-D) ---------------------------
  {
    // Mutating a seed object after adapter creation cannot reach stored state.
    const adapter = fixture.create(seeded);
    const seedRow = seedsForIsolation(seeded);
    const sorted = sortableField(resource);
    seedRow[sorted] = 'MUTATED';
    const got = await adapter.query(
      { op: 'get', resourceId: resource.id, id: String(seeded[0]?.[resource.identity.key]) },
      fixture.readContext,
    );
    if (!got.ok) {
      fail(`seed-isolation get failed: ${JSON.stringify(got)}`);
    } else {
      const row = got.row as Record<string, unknown>;
      if (row[sorted] === 'MUTATED') {
        fail('mutating a seed object mutated stored state');
      }
    }
    // Mutating a returned row cannot mutate stored state.
    const returned = await adapter.query(
      { op: 'get', resourceId: resource.id, id: String(seeded[0]?.[resource.identity.key]) },
      fixture.readContext,
    );
    if (returned.ok) {
      const rowCopy = returned.row as Record<string, unknown>;
      rowCopy[sorted] = 'CALLER-MUTATED';
      const reread = await adapter.query(
        { op: 'get', resourceId: resource.id, id: String(seeded[0]?.[resource.identity.key]) },
        fixture.readContext,
      );
      if (reread.ok && (reread.row as Record<string, unknown>)[sorted] === 'CALLER-MUTATED') {
        fail('mutating a returned row mutated stored canonical state');
      }
    }
  }

  // ---- 13. Invalid query bounds and projections fail structurally ------------
  {
    const adapter = fixture.create(seeded);
    for (const bad of [-5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const badLimit = await adapter.query(
        { op: 'list', resourceId: resource.id, limit: bad },
        fixture.readContext,
      );
      if (badLimit.ok) {
        fail(`limit ${String(bad)} was accepted silently`);
      }
      const badOffset = await adapter.query(
        { op: 'list', resourceId: resource.id, offset: bad },
        fixture.readContext,
      );
      if (badOffset.ok) {
        fail(`offset ${String(bad)} was accepted silently`);
      }
    }
    const badProjection = await adapter.query(
      { op: 'list', resourceId: resource.id, projection: ['not_a_field'] },
      fixture.readContext,
    );
    if (badProjection.ok) {
      fail('an unknown projection field was silently ignored');
    }
    if (badProjection.ok === false && badProjection.code !== 'DATA_UNSUPPORTED_QUERY') {
      fail(`unknown projection produced the wrong code: ${String(badProjection.code)}`);
    }
  }
  // ---- 14. Closed query-request schema (LOW-RE-4) -------------------------
  {
    const adapter = fixture.create(seeded);
    // Unknown top-level field is rejected (never silently ignored).
    const hostile: Record<string, unknown> = { op: 'list', resourceId: resource.id };
    hostile['$where'] = 'CANARY-HOSTILE-KEY';
    const rejected = await adapter.query(hostile as never, fixture.readContext);
    if (rejected.ok) {
      fail('an unknown top-level query-request field was silently ignored');
    }
    if (rejected.code !== 'DATA_INVALID_REQUEST') {
      fail(`unknown query field produced the wrong code: ${String(rejected.code)}`);
    }
    if (JSON.stringify(rejected).includes('CANARY-HOSTILE-KEY')) {
      fail('the query diagnostic echoed the hostile key');
    }
    // Every other exotic top-level field is rejected the same way.
    const exotic: Record<string, unknown> = { op: 'list', resourceId: resource.id };
    exotic['__proto__-probe'] = { malicious: true };
    const exoticResult = await adapter.query(exotic as never, fixture.readContext);
    if (exoticResult.ok || exoticResult.code !== 'DATA_INVALID_REQUEST') {
      fail(`an exotic top-level query field was not rejected: ${JSON.stringify(exoticResult)}`);
    }
    // Legitimate requests still succeed (strictness did not overclose).
    const legit = await adapter.query({ op: 'list', resourceId: resource.id }, fixture.readContext);
    if (!legit.ok) {
      fail(`the closed request schema rejected a legitimate request: ${JSON.stringify(legit)}`);
    }
  }

  // ---- 15. Declared filter-value type is runtime-enforced (LOW-RE-4) -------
  {
    const adapter = fixture.create(seeded);
    const filterField = sortableField(resource);
    const hostileValues: unknown[] = [
      { $ne: null },
      { nested: { deep: 'CANARY-HOSTILE-VALUE' } },
      ['array'],
      null,
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -0,
      () => 'fn',
      10n,
      Symbol('sym'),
    ];
    for (const hostileValue of hostileValues) {
      const request: Record<string, unknown> = {
        op: 'list',
        resourceId: resource.id,
        filters: { [filterField]: hostileValue },
      };
      const rejected = await adapter.query(request as never, fixture.readContext);
      if (rejected.ok) {
        fail(`a non-primitive filter value was accepted: ${String(typeof hostileValue)}`);
      }
      if (rejected.code !== 'DATA_INVALID_REQUEST') {
        fail(`non-primitive filter value produced the wrong code: ${String(rejected.code)}`);
      }
      const serialized = JSON.stringify(rejected, () => '');
      if (serialized.includes('$ne') || serialized.includes('CANARY-HOSTILE-VALUE')) {
        fail('the filter diagnostic echoed the hostile value');
      }
    }
    // A malformed filters container (array/string) is rejected.
    for (const malformed of [['x'], 'x', 42, null] as unknown[]) {
      const request: Record<string, unknown> = {
        op: 'list',
        resourceId: resource.id,
        filters: malformed,
      };
      const rejected = await adapter.query(request as never, fixture.readContext);
      if (rejected.ok || rejected.code !== 'DATA_INVALID_REQUEST') {
        fail('a malformed filters object was not rejected');
      }
    }
    // Primitive-equality query semantics are preserved: an exact primitive
    // filter still returns exactly the matching rows.
    const firstIdentity = String(seeded[0]?.[resource.identity.key]);
    const filtered = await adapter.query(
      { op: 'list', resourceId: resource.id, filters: { [resource.identity.key]: firstIdentity } },
      fixture.readContext,
    );
    if (!filtered.ok || filtered.rows?.length !== 1) {
      fail(`primitive-equality filtering broke: ${JSON.stringify(filtered)}`);
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

/**
 * Type-respecting sample value for one catalogue field.
 */
function sampleValue(
  field: { readonly name: string; readonly type: string },
  prefix: string,
): unknown {
  switch (field.type) {
    case 'number':
      return prefix.length;
    case 'boolean':
      return true;
    default:
      return `${prefix}-${field.name}`;
  }
}

/** An isolated shallow copy of the first seed for defensive-copy probes. */
function seedsForIsolation(seeds: readonly Record<string, unknown>[]): Record<string, unknown> {
  return { ...seeds[0] };
}

/** Pick a sortable catalogue field (first non-identity field, else identity). */
function sortableField(resource: ResourceDefinition): string {
  const candidate = resource.fields.find(
    (field) => field.name !== resource.identity.key && field.type !== 'json',
  );
  return candidate?.name ?? resource.identity.key;
}
