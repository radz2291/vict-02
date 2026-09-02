import type { ResourceDefinition } from '@vict/sdk';

/**
 * Framework-neutral application-data adapter contract (Stage 04).
 *
 * Application-domain data is strictly separate from Vict operational
 * stores: application adapters MUST NOT import, expose, or mutate
 * `VictStores`, and every non-local operation crosses an explicit
 * authorization/effect boundary (`ApplicationDataRequestContext`).
 * Resource definitions describe what MAY be queried/mutated; they do not
 * grant storage authority — the adapter implements it.
 */

/** Explicit authorization/effect boundary crossed by every adapter call. */
export interface ApplicationDataRequestContext {
  /** Granted permissions verified against the resource's declared authorization. */
  readonly permissions: readonly string[];
  /** The declared effect of this access. */
  readonly effect: 'read' | 'write';
  /** Stable actor/correlation identifier (safe identifier; never payload content). */
  readonly actor?: string;
}

export interface DataSort {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

export interface ApplicationDataQueryRequest {
  readonly op: 'list' | 'get';
  readonly resourceId: string;
  readonly filters?: Readonly<Record<string, string | number | boolean>>;
  readonly sort?: readonly DataSort[];
  readonly limit?: number;
  readonly offset?: number;
  readonly projection?: readonly string[];
  /** Identity for `get`. */
  readonly id?: string;
}

export interface ApplicationDataMutationRequest {
  readonly resourceId: string;
  /** Declared mutation op (`create`, `update`, `delete`, or a declared domain verb). */
  readonly op: string;
  /** Input for create/update; must cross the resource's declared contract upstream. */
  readonly input?: unknown;
  /** Identity for update/delete. */
  readonly id?: string;
  /** Caller idempotency key for keyed creates (same key reconciles to one row). */
  readonly idempotencyKey?: string;
}

export type ApplicationDataResult =
  | {
      readonly ok: true;
      readonly rows?: readonly unknown[];
      readonly row?: unknown;
      readonly total?: number;
    }
  | { readonly ok: false; readonly code: string; readonly message: string };

/**
 * A conforming application-data adapter. Implementations must pass the
 * shared conformance suite (`runApplicationDataAdapterSuite`).
 */
export interface ApplicationDataAdapter {
  readonly id: string;
  readonly revision: string;
  query(
    request: ApplicationDataQueryRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult>;
  mutate(
    request: ApplicationDataMutationRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult>;
}

/** Stable adapter diagnostics. */
export type ApplicationDataErrorCode =
  | 'DATA_UNKNOWN_RESOURCE'
  | 'DATA_UNAUTHORIZED'
  | 'DATA_MUTATION_NOT_DECLARED'
  | 'DATA_UNKNOWN_IDENTITY'
  | 'DATA_INVALID_INPUT'
  | 'DATA_IDEMPOTENT_REPLAY'
  | 'DATA_UNSUPPORTED_QUERY'
  | 'DATA_INVALID_REQUEST';

/** Stable safe comparison of primitive field values for filters/sort. */
function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? 1 : -1;
  const as = String(a);
  const bs = String(b);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/**
 * The in-memory reference adapter used for Stage 04 testing. Enforces:
 * unknown resources, declared mutations only, authorization/effect
 * boundaries, idempotency keys for keyed creates, and deterministic
 * filter/sort/pagination/projection semantics.
 */
export function createInMemoryApplicationData(
  resources: readonly ResourceDefinition[],
  options: {
    readonly id?: string;
    readonly revision?: string;
    readonly seeds?: Readonly<Record<string, readonly Record<string, unknown>[]>>;
  } = {},
): ApplicationDataAdapter {
  const rows = new Map<string, Map<string, Record<string, unknown>>>();
  const seenIdempotencyKeys = new Map<string, string>();
  for (const resource of resources) {
    rows.set(
      resource.id,
      new Map(
        (options.seeds?.[resource.id] ?? []).map((row) => {
          const key = String(row[resource.identity.key]);
          return [key, row];
        }),
      ),
    );
  }

  const authorize = (
    resource: ResourceDefinition,
    effect: 'read' | 'write',
    context: ApplicationDataRequestContext,
  ): ApplicationDataResult | undefined => {
    // The request context must declare its effect honestly.
    if (context.effect !== effect) {
      return {
        ok: false,
        code: 'DATA_UNAUTHORIZED',
        message: `Access to resource '${resource.id}' was requested with effect '${String(context.effect)}' but is used as '${effect}'.`,
      };
    }
    const required = new Set(resource.authorization?.permissions ?? []);
    for (const permissionId of required) {
      if (!context.permissions.includes(permissionId)) {
        return {
          ok: false,
          code: 'DATA_UNAUTHORIZED',
          message: `Access to resource '${resource.id}' requires permission '${permissionId}'.`,
        };
      }
    }
    // Reads are always legal for declared resources; writes are gated per
    // declared mutation below (a read-only resource declares no mutations).
    return undefined;
  };

  return {
    id: options.id ?? 'vict.in-memory-data',
    revision: options.revision ?? '1',

    async query(request, context) {
      const resource = resources.find((candidate) => candidate.id === request.resourceId);
      if (resource === undefined) {
        return {
          ok: false,
          code: 'DATA_UNKNOWN_RESOURCE',
          message: `Unknown resource '${request.resourceId}'.`,
        };
      }
      const denied = authorize(resource, 'read', context);
      if (denied !== undefined) {
        return denied;
      }
      const table = rows.get(resource.id) ?? new Map();
      if (request.op === 'get') {
        if (typeof request.id !== 'string') {
          return { ok: false, code: 'DATA_INVALID_REQUEST', message: 'get requires an id.' };
        }
        const row = table.get(request.id);
        if (row === undefined) {
          return {
            ok: false,
            code: 'DATA_UNKNOWN_IDENTITY',
            message: `No '${resource.id}' row with id '${request.id}'.`,
          };
        }
        return { ok: true, row: project(row, request.projection) };
      }
      // list
      let list = [...table.values()];
      for (const [field, expected] of Object.entries(request.filters ?? {})) {
        if (!resource.fields.some((candidate) => candidate.name === field)) {
          return {
            ok: false,
            code: 'DATA_UNSUPPORTED_QUERY',
            message: `Filter field '${field}' is not in the catalogue of '${resource.id}'.`,
          };
        }
        list = list.filter((row) => compareValues(row[field], expected) === 0);
      }
      for (const sort of [...(request.sort ?? [])].reverse()) {
        if (!resource.fields.some((candidate) => candidate.name === sort.field)) {
          return {
            ok: false,
            code: 'DATA_UNSUPPORTED_QUERY',
            message: `Sort field '${sort.field}' is not in the catalogue of '${resource.id}'.`,
          };
        }
        list = [...list].sort((a, b) => {
          const cmp = compareValues(a[sort.field], b[sort.field]);
          return sort.direction === 'desc' ? -cmp : cmp;
        });
      }
      const total = list.length;
      const offset = request.offset ?? 0;
      const limit = request.limit ?? list.length;
      list = list.slice(offset, offset + limit);
      return { ok: true, rows: list.map((row) => project(row, request.projection)), total };
    },

    async mutate(request, context) {
      const resource = resources.find((candidate) => candidate.id === request.resourceId);
      if (resource === undefined) {
        return {
          ok: false,
          code: 'DATA_UNKNOWN_RESOURCE',
          message: `Unknown resource '${request.resourceId}'.`,
        };
      }
      const denied = authorize(resource, 'write', context);
      if (denied !== undefined) {
        return denied;
      }
      const mutation = resource.mutations?.find((candidate) => candidate.op === request.op);
      if (mutation === undefined) {
        return {
          ok: false,
          code: 'DATA_MUTATION_NOT_DECLARED',
          message: `Resource '${resource.id}' does not declare mutation '${request.op}'.`,
        };
      }
      for (const permissionId of mutation.permissions ?? []) {
        if (!context.permissions.includes(permissionId)) {
          return {
            ok: false,
            code: 'DATA_UNAUTHORIZED',
            message: `Mutation '${request.op}' on '${resource.id}' requires permission '${permissionId}'.`,
          };
        }
      }
      const table = rows.get(resource.id) ?? new Map();
      if (request.op === 'create') {
        const input = request.input;
        if (input === undefined || typeof input !== 'object') {
          return {
            ok: false,
            code: 'DATA_INVALID_INPUT',
            message: 'create requires an object input.',
          };
        }
        const record = input as Record<string, unknown>;
        for (const field of resource.fields) {
          if (field.required === true && record[field.name] === undefined) {
            return {
              ok: false,
              code: 'DATA_INVALID_INPUT',
              message: `Field '${field.name}' is required by resource '${resource.id}'.`,
            };
          }
        }
        const identity = String(record[resource.identity.key]);
        if (identity.length === 0 || identity === 'undefined') {
          return {
            ok: false,
            code: 'DATA_INVALID_INPUT',
            message: `create requires the identity field '${resource.identity.key}'.`,
          };
        }
        if (mutation.idempotency === 'keyed' && request.idempotencyKey !== undefined) {
          const prior = seenIdempotencyKeys.get(request.idempotencyKey);
          if (prior !== undefined) {
            const existing = table.get(prior);
            return { ok: true, row: project(existing ?? {}, undefined) };
          }
          seenIdempotencyKeys.set(request.idempotencyKey, identity);
        }
        if (table.has(identity)) {
          return {
            ok: false,
            code: 'DATA_INVALID_INPUT',
            message: `A '${resource.id}' row with id '${identity}' already exists.`,
          };
        }
        table.set(identity, { ...record });
        return { ok: true, row: { ...record } };
      }
      if (request.op === 'update') {
        if (typeof request.id !== 'string' || !table.has(request.id)) {
          return {
            ok: false,
            code: 'DATA_UNKNOWN_IDENTITY',
            message: `No '${resource.id}' row with id '${String(request.id)}'.`,
          };
        }
        const input = request.input;
        if (input === undefined || typeof input !== 'object') {
          return {
            ok: false,
            code: 'DATA_INVALID_INPUT',
            message: 'update requires an object input.',
          };
        }
        const existing = table.get(request.id) as Record<string, unknown>;
        const updated: Record<string, unknown> = { ...existing };
        for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
          if (resource.fields.some((field) => field.name === key)) {
            updated[key] = value;
          }
        }
        table.set(request.id, updated);
        return { ok: true, row: { ...updated } };
      }
      if (request.op === 'delete') {
        if (typeof request.id !== 'string' || !table.has(request.id)) {
          return {
            ok: false,
            code: 'DATA_UNKNOWN_IDENTITY',
            message: `No '${resource.id}' row with id '${String(request.id)}'.`,
          };
        }
        table.delete(request.id);
        return { ok: true };
      }
      return {
        ok: false,
        code: 'DATA_MUTATION_NOT_DECLARED',
        message: `Resource '${resource.id}' does not declare mutation '${request.op}'.`,
      };
    },
  };
}

function project(
  row: Record<string, unknown>,
  projection: readonly string[] | undefined,
): Record<string, unknown> {
  if (projection === undefined || projection.length === 0) {
    return { ...row };
  }
  const out: Record<string, unknown> = {};
  for (const field of projection) {
    if (field in row) {
      out[field] = row[field];
    }
  }
  return out;
}
