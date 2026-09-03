import type {
  ApplicationDataAdapter,
  ApplicationDataQueryRequest,
  ApplicationDataRequestContext,
  ApplicationDataResult,
} from '@vict/application';
import type { Contract, ResourceDefinition } from '@vict/sdk';
import {
  openAppDatabase,
  safeDriver,
  VictApplicationDataError,
  type OpenAppDatabase,
} from './driver.js';
import {
  applyApplicationDataMigrations,
  migrationsFromResources,
  physicalTableName,
  type ApplicationDataMigration,
  type AppliedApplicationDataMigration,
} from './migrations.js';

export {
  VictApplicationDataError,
  readDurabilityPragmas,
  openAppDatabase,
  type ApplicationDataSqliteErrorCode,
} from './driver.js';
export {
  applyApplicationDataMigrations,
  migrationsFromResources,
  physicalTableName,
  type AppliedApplicationDataMigration,
  type ApplicationDataMigration,
} from './migrations.js';

/** Bounds shared with the in-memory reference adapter's search policy. */
const SEARCH_TEXT_MAX_LENGTH = 200;
const SEARCH_FIELDS_MAX_COUNT = 16;

/** Stable result-level codes used by this adapter. */
type ResultCode =
  | 'DATA_UNKNOWN_RESOURCE'
  | 'DATA_UNAUTHORIZED'
  | 'DATA_MUTATION_NOT_DECLARED'
  | 'DATA_UNKNOWN_IDENTITY'
  | 'DATA_INVALID_INPUT'
  | 'DATA_IDEMPOTENCY_CONFLICT'
  | 'DATA_UNSUPPORTED_QUERY'
  | 'DATA_INVALID_REQUEST'
  | 'DATA_CONTRACT_REJECTED'
  | 'DATA_UNSUPPORTED_VALUE'
  | 'DATA_STORAGE_FAILED';

/** Terminating structured result (never echoes request content). */
class ResultExit extends Error {
  readonly result: ApplicationDataResult;
  constructor(code: ResultCode, message: string) {
    super('result-exit');
    this.result = { ok: false as const, code, message };
  }
}

function fail(code: ResultCode, message: string): ApplicationDataResult {
  return { ok: false, code, message };
}

/** Throw a structured result through the hostile-input boundary. */
function refuse(code: ResultCode, message: string): never {
  throw new ResultExit(code, message);
}

/** Stable non-echoing diagnostic for any hostile container failure. */
const HOSTILE_REQUEST_MESSAGE =
  'The request could not be processed safely; hostile containers (throwing getters, revoked proxies, cyclic structures, or unsupported prototypes) are rejected with this stable diagnostic.';

/** True for a non-empty plain string. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** True inside the adapter's supported serializable domain. */
function isSerializableDomain(value: unknown): boolean {
  if (value === null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return true;
  if (type === 'number') return Number.isFinite(value);
  if (type !== 'object') return false;
  if (Array.isArray(value)) {
    return value.every((item) => item !== undefined && isSerializableDomain(item));
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  for (const item of Object.values(value as Record<string, unknown>)) {
    if (item === undefined || !isSerializableDomain(item)) return false;
  }
  return true;
}

/** Canonical JSON (sorted keys) for idempotency fingerprints and row storage. */
function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const item = (value as Record<string, unknown>)[key];
    if (item !== undefined) {
      out[key] = canonicalValue(item);
    }
  }
  return out;
}

function project(
  row: Record<string, unknown>,
  projection: readonly string[] | undefined,
): Record<string, unknown> {
  if (projection === undefined || projection.length === 0) {
    return row;
  }
  const out: Record<string, unknown> = {};
  for (const field of projection) {
    if (field in row) {
      out[field] = row[field];
    }
  }
  return out;
}

export interface SqliteApplicationDataOptions {
  /** Database file path or ':memory:' (default). */
  readonly path?: string;
  readonly id?: string;
  readonly revision?: string;
  readonly resources: readonly ResourceDefinition[];
  /** Explicit contract bindings (mutation input/output validation). */
  readonly contracts?: readonly Contract<unknown>[];
  /**
   * Deterministic seed rows per resource id, validated through the same
   * catalogue/type/serializable-domain rules as create before any insert.
   */
  readonly seeds?: Readonly<Record<string, readonly Record<string, unknown>[]>>;
  /**
   * Explicit application-domain migrations. When omitted, a bootstrap
   * migration derived from the resource definitions at version 1 is used.
   * Migration history is separate from Vict operational migrations.
   */
  readonly migrations?: readonly ApplicationDataMigration[];
  /** Deterministic clock for migration bookkeeping (tests). */
  readonly now?: () => string;
  readonly busyTimeoutMs?: number;
}

/** The SQLite application-domain adapter plus its explicit lifecycle surface. */
export type SqliteApplicationDataAdapter = ApplicationDataAdapter & {
  /** Close the underlying database handle. Idempotent. */
  close(): void;
  /** The inspectable applied application-domain migration history. */
  appliedMigrations(): readonly AppliedApplicationDataMigration[];
};

/**
 * The production SQLite application-domain data adapter (Stage 05).
 *
 * - Application-domain tables are `appdata_<resource>`; bookkeeping lives in
 *   `vict_appdata_migrations` and `vict_appdata_idempotency`. These are
 *   structurally disjoint from Vict operational tables.
 * - Every operation crosses the explicit authorization/effect boundary.
 * - All values reach SQL as bound parameters; the only interpolated SQL
 *   fragments are `json_extract` paths built from VALIDATED catalogue field
 *   names (`[A-Za-z0-9_]+`) and table names derived through
 *   `physicalTableName` — hostile author or caller strings never become SQL.
 * - Hostile containers (throwing getters, revoked proxies, enumeration
 *   traps, cyclic structures, exotic prototypes) anywhere in a request
 *   produce the SAME stable, non-echoing structured diagnostics as the
 *   in-memory reference adapter (LOW-C-1 closure).
 * - Keyed idempotency is recorded in the SAME transaction as the row it
 *   reconciles: a failed transaction never consumes a key.
 */
export function createSqliteApplicationData(
  options: SqliteApplicationDataOptions,
): SqliteApplicationDataAdapter {
  const resources = options.resources;
  const open: OpenAppDatabase = openAppDatabase(options.path ?? ':memory:', options.busyTimeoutMs);
  let closed = false;

  const contractsById = new Map<string, Contract<unknown>>();
  for (const contract of options.contracts ?? []) {
    contractsById.set(contract.id, contract);
  }
  for (const resource of resources) {
    // Safe physical mapping is validated up front (fail closed at open).
    physicalTableName(resource.id);
  }

  const migrations = options.migrations ?? [migrationsFromResources(resources, 1)];
  let history: readonly AppliedApplicationDataMigration[] = [];
  try {
    history = applyApplicationDataMigrations(open, migrations, options.now ?? (() => '0'));
  } catch (error) {
    open.close();
    throw error;
  }

  const authorize = (
    resource: ResourceDefinition,
    effect: 'read' | 'write',
    context: ApplicationDataRequestContext,
  ): ApplicationDataResult | undefined => {
    if (context.effect !== effect) {
      return fail(
        'DATA_UNAUTHORIZED',
        'Access was requested with an effect that does not match the operation.',
      );
    }
    const required = new Set(resource.authorization?.permissions ?? []);
    for (const permissionId of required) {
      if (!context.permissions.includes(permissionId)) {
        return fail(
          'DATA_UNAUTHORIZED',
          `Access to resource '${resource.id}' requires permission '${permissionId}'.`,
        );
      }
    }
    return undefined;
  };

  const checkBound = (
    value: number | undefined,
    name: string,
  ): ApplicationDataResult | undefined => {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      return fail(
        'DATA_INVALID_REQUEST',
        `${name} must be a non-negative safe integer when present.`,
      );
    }
    return undefined;
  };

  const parseDeclaredInput = (
    resource: ResourceDefinition,
    mutationOp: string,
    input: unknown,
  ): { readonly result?: ApplicationDataResult; readonly value?: unknown } => {
    const mutation = resource.mutations?.find((candidate) => candidate.op === mutationOp);
    const contractId = mutation?.inputContractId ?? resource.inputContract;
    if (contractId === undefined) {
      return { value: input };
    }
    const contract = contractsById.get(contractId);
    if (contract === undefined) {
      return {
        result: fail(
          'DATA_CONTRACT_REJECTED',
          `The declared input contract '${contractId}' is not bound to this adapter; the mutation cannot be validated.`,
        ),
      };
    }
    let parsed;
    try {
      parsed = contract.parse(input);
    } catch {
      return {
        result: fail(
          'DATA_CONTRACT_REJECTED',
          `The mutation input could not be validated by contract '${contractId}': the contract parser threw.`,
        ),
      };
    }
    if (!parsed.ok) {
      return {
        result: fail(
          'DATA_CONTRACT_REJECTED',
          `The mutation input was rejected by contract '${contractId}'.`,
        ),
      };
    }
    return { value: parsed.value };
  };

  const validateDeclaredOutput = (
    resource: ResourceDefinition,
    mutationOp: string,
    output: unknown,
  ): ApplicationDataResult | undefined => {
    const mutation = resource.mutations?.find((candidate) => candidate.op === mutationOp);
    const contractId = mutation?.outputContractId ?? resource.outputContract;
    if (contractId === undefined) {
      return undefined;
    }
    const contract = contractsById.get(contractId);
    if (contract === undefined) {
      return fail(
        'DATA_CONTRACT_REJECTED',
        `The declared output contract '${contractId}' is not bound to this adapter; the result cannot be validated.`,
      );
    }
    let parsed;
    try {
      parsed = contract.parse(output);
    } catch {
      return fail(
        'DATA_CONTRACT_REJECTED',
        `The mutation result could not be validated by contract '${contractId}': the contract parser threw.`,
      );
    }
    if (!parsed.ok) {
      return fail(
        'DATA_CONTRACT_REJECTED',
        `The mutation result was rejected by contract '${contractId}'.`,
      );
    }
    return undefined;
  };

  const checkCatalogue = (
    resource: ResourceDefinition,
    record: Record<string, unknown>,
  ): ApplicationDataResult | undefined => {
    for (const key of Object.keys(record)) {
      if (!resource.fields.some((field) => field.name === key)) {
        return fail(
          'DATA_INVALID_INPUT',
          'The mutation input contains a field outside the declared field catalogue; unknown fields are rejected.',
        );
      }
    }
    return undefined;
  };

  const checkFieldType = (
    field: { readonly name: string; readonly type: string },
    value: unknown,
  ): ApplicationDataResult | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }
    switch (field.type) {
      case 'string':
        if (typeof value !== 'string') {
          return fail('DATA_INVALID_INPUT', `Field '${field.name}' must be a string.`);
        }
        return undefined;
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          return fail('DATA_INVALID_INPUT', `Field '${field.name}' must be a finite number.`);
        }
        return undefined;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return fail('DATA_INVALID_INPUT', `Field '${field.name}' must be a boolean.`);
        }
        return undefined;
      case 'date':
        if (typeof value !== 'string') {
          return fail('DATA_INVALID_INPUT', `Field '${field.name}' must be an ISO date string.`);
        }
        return undefined;
      case 'json':
        if (!isSerializableDomain(value)) {
          return fail(
            'DATA_INVALID_INPUT',
            `Field '${field.name}' must be inside the supported serializable domain.`,
          );
        }
        return undefined;
      default:
        return fail('DATA_INVALID_REQUEST', 'The resource declares an unsupported field type.');
    }
  };

  /** Build the WHERE clause + bound parameters for validated filters and search. */
  const buildWhere = (
    resource: ResourceDefinition,
    request: ApplicationDataQueryRequest,
  ): { where: string; params: (string | number)[] } => {
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    for (const [field, expected] of Object.entries(request.filters ?? {})) {
      const path = fieldPath(resource, field);
      // The declared public filter type is runtime-enforced: exactly string,
      // finite canonical number, or boolean. Anything else (objects, arrays,
      // null, non-finite numbers, functions, BigInt, symbols) is refused.
      const valid =
        typeof expected === 'string' ||
        typeof expected === 'boolean' ||
        (typeof expected === 'number' && Number.isFinite(expected) && !Object.is(expected, -0));
      if (!valid) {
        refuse(
          'DATA_INVALID_REQUEST',
          'Filter values must be exactly string, finite number, or boolean, matching the declared public filter type.',
        );
      }
      if (typeof expected === 'boolean') {
        clauses.push(`${path} = ?`);
        params.push(expected ? 1 : 0);
      } else {
        clauses.push(`${path} = ?`);
        params.push(expected);
      }
    }
    const search = request.search;
    if (search !== undefined) {
      if (typeof search !== 'object' || search === null || Array.isArray(search)) {
        refuse('DATA_INVALID_REQUEST', 'search must be a { text, fields } object when present.');
      }
      if (
        typeof search.text !== 'string' ||
        search.text.length === 0 ||
        search.text.length > SEARCH_TEXT_MAX_LENGTH
      ) {
        refuse(
          'DATA_INVALID_REQUEST',
          `search.text must be a non-empty string of at most ${SEARCH_TEXT_MAX_LENGTH} characters.`,
        );
      }
      if (
        !Array.isArray(search.fields) ||
        search.fields.length === 0 ||
        search.fields.length > SEARCH_FIELDS_MAX_COUNT ||
        search.fields.some((field) => typeof field !== 'string')
      ) {
        refuse(
          'DATA_INVALID_REQUEST',
          `search.fields must be a non-empty array of at most ${SEARCH_FIELDS_MAX_COUNT} field names.`,
        );
      }
      const likeClauses: string[] = [];
      for (const field of search.fields) {
        const path = fieldPath(resource, field);
        likeClauses.push(`LOWER(CAST(${path} AS TEXT)) LIKE ? ESCAPE '\\'`);
      }
      // Escape LIKE wildcards so caller text is literal; wrap for contains.
      const needle = `%${search.text
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .toLowerCase()}%`;
      clauses.push(`(${likeClauses.join(' OR ')})`);
      params.push(...search.fields.map(() => needle));
    }
    return { where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '', params };
  };

  const runQuery = (
    request: ApplicationDataQueryRequest,
    context: ApplicationDataRequestContext,
  ): ApplicationDataResult => {
    ensureOpen();
    if (request === undefined || request === null || typeof request !== 'object') {
      return fail('DATA_INVALID_REQUEST', 'The query request must be an object.');
    }
    const resource = resources.find((candidate) => candidate.id === request.resourceId);
    if (resource === undefined) {
      return fail('DATA_UNKNOWN_RESOURCE', 'The requested resource is not declared.');
    }
    const denied = authorize(resource, 'read', context);
    if (denied !== undefined) {
      return denied;
    }
    const QUERY_REQUEST_FIELDS: ReadonlySet<string> = new Set([
      'op',
      'resourceId',
      'filters',
      'search',
      'sort',
      'limit',
      'offset',
      'projection',
      'id',
    ]);
    for (const key of Object.keys(request)) {
      if (!QUERY_REQUEST_FIELDS.has(key)) {
        return fail(
          'DATA_INVALID_REQUEST',
          'The query request contains a field outside the closed query-request schema; unknown fields are rejected.',
        );
      }
    }
    const invalidLimit = checkBound(request.limit, 'limit');
    if (invalidLimit !== undefined) return invalidLimit;
    const invalidOffset = checkBound(request.offset, 'offset');
    if (invalidOffset !== undefined) return invalidOffset;

    // Validate filters/search/sort/projection BEFORE reading data. Invalid
    // requests never touch the database.
    if (request.filters !== undefined) {
      if (
        typeof request.filters !== 'object' ||
        request.filters === null ||
        Array.isArray(request.filters)
      ) {
        return fail(
          'DATA_INVALID_REQUEST',
          'filters must be a plain object of primitive values when present.',
        );
      }
      const proto = Object.getPrototypeOf(request.filters);
      if (proto !== Object.prototype && proto !== null) {
        return fail(
          'DATA_INVALID_REQUEST',
          'filters must be a plain object of primitive values when present.',
        );
      }
    }
    if (request.sort !== undefined) {
      if (!Array.isArray(request.sort)) {
        return fail('DATA_INVALID_REQUEST', 'sort must be an array when present.');
      }
      for (const sort of request.sort) {
        if (
          typeof sort !== 'object' ||
          sort === null ||
          !isNonEmptyString(sort.field) ||
          (sort.direction !== 'asc' && sort.direction !== 'desc')
        ) {
          return fail('DATA_INVALID_REQUEST', 'sort entries must be { field, direction }.');
        }
      }
    }
    if (
      request.projection !== undefined &&
      (!Array.isArray(request.projection) || request.projection.some((f) => typeof f !== 'string'))
    ) {
      return fail('DATA_INVALID_REQUEST', 'projection must be an array of field names.');
    }
    for (const field of request.projection ?? []) {
      if (!resource.fields.some((candidate) => candidate.name === field)) {
        return fail(
          'DATA_UNSUPPORTED_QUERY',
          'Projection field is not in the catalogue of the requested resource.',
        );
      }
    }

    const name = table(resource);
    if (request.op === 'get') {
      const rowId = request.id;
      if (!isNonEmptyString(rowId)) {
        return fail('DATA_INVALID_REQUEST', 'get requires a non-empty id.');
      }
      const row = safeDriver('query.get', () =>
        open.db.prepare(`SELECT data FROM ${name} WHERE identity = ?;`).get(rowId),
      ) as { data: string } | undefined;
      if (row === undefined) {
        return fail('DATA_UNKNOWN_IDENTITY', 'No row with the requested identity exists.');
      }
      const record = JSON.parse(row.data) as Record<string, unknown>;
      return { ok: true, row: project(record, request.projection) };
    }
    if (request.op !== 'list') {
      return fail('DATA_INVALID_REQUEST', 'The query op must be "list" or "get".');
    }

    const { where, params } = buildWhere(resource, request);
    let orderSql = '';
    const orderParams: (string | number)[] = [];
    for (const sort of request.sort ?? []) {
      const path = fieldPath(resource, sort.field);
      orderSql += `${orderSql === '' ? 'ORDER BY ' : ', '}${path} ${sort.direction === 'desc' ? 'DESC' : 'ASC'}`;
    }
    const totalRow = safeDriver('query.count', () =>
      open.db.prepare(`SELECT COUNT(*) AS total FROM ${name} ${where};`).get(...params),
    ) as { total: number | bigint };
    const total = Number(totalRow.total);
    const offset = request.offset ?? 0;
    const limit = request.limit ?? -1;
    const rows = safeDriver('query.list', () =>
      open.db
        .prepare(`SELECT data FROM ${name} ${where} ${orderSql} LIMIT ? OFFSET ?;`)
        .all(...params, ...orderParams, limit, offset),
    ) as { data: string }[];
    return {
      ok: true,
      rows: rows.map((row) =>
        project(JSON.parse(row.data) as Record<string, unknown>, request.projection),
      ),
      total,
    };
  };

  const runMutation = (
    request: {
      readonly resourceId: string;
      readonly op: string;
      readonly input?: unknown;
      readonly id?: string;
      readonly idempotencyKey?: string;
    },
    context: ApplicationDataRequestContext,
  ): ApplicationDataResult => {
    ensureOpen();
    if (request === undefined || request === null || typeof request !== 'object') {
      return fail('DATA_INVALID_REQUEST', 'The mutation request must be an object.');
    }
    const resource = resources.find((candidate) => candidate.id === request.resourceId);
    if (resource === undefined) {
      return fail('DATA_UNKNOWN_RESOURCE', 'The requested resource is not declared.');
    }
    const denied = authorize(resource, 'write', context);
    if (denied !== undefined) {
      return denied;
    }
    const mutation = resource.mutations?.find((candidate) => candidate.op === request.op);
    if (mutation === undefined) {
      return fail(
        'DATA_MUTATION_NOT_DECLARED',
        'The requested mutation is not declared by the resource.',
      );
    }
    for (const permissionId of mutation.permissions ?? []) {
      if (!context.permissions.includes(permissionId)) {
        return fail('DATA_UNAUTHORIZED', `The mutation requires permission '${permissionId}'.`);
      }
    }
    if (request.idempotencyKey !== undefined && mutation.idempotency !== 'keyed') {
      return fail(
        'DATA_INVALID_REQUEST',
        `Mutation '${request.op}' does not accept idempotency keys; remove the key or declare keyed idempotency for the mutation.`,
      );
    }
    const name = table(resource);

    if (request.op === 'create') {
      const input = request.input;
      if (
        input === undefined ||
        input === null ||
        Array.isArray(input) ||
        typeof input !== 'object'
      ) {
        return fail('DATA_INVALID_INPUT', 'create requires a plain-object input.');
      }
      if (!isSerializableDomain(input)) {
        return fail(
          'DATA_INVALID_INPUT',
          'Mutation input contains values outside the supported serializable domain (functions, symbols, BigInt, Date, non-finite numbers, sparse arrays, and exotic prototypes are not storable).',
        );
      }
      const parsed = parseDeclaredInput(resource, request.op, input);
      if (parsed.result !== undefined) return parsed.result;
      const record = parsed.value as Record<string, unknown>;
      const unknownField = checkCatalogue(resource, record);
      if (unknownField !== undefined) return unknownField;
      for (const field of resource.fields) {
        if (field.required === true && record[field.name] === undefined) {
          return fail('DATA_INVALID_INPUT', `Field '${field.name}' is required by the resource.`);
        }
        const typeMismatch = checkFieldType(field, record[field.name]);
        if (typeMismatch !== undefined) return typeMismatch;
      }
      if (!isNonEmptyString(record[resource.identity.key])) {
        return fail(
          'DATA_INVALID_INPUT',
          `create requires the identity field '${resource.identity.key}' as a non-empty string.`,
        );
      }
      const identity = record[resource.identity.key] as string;
      // Output-contract validation happens BEFORE the transaction (pure
      // validation of the record that would be stored): a rejected output
      // leaves no row and consumes no idempotency key — identical observable
      // behavior to the reference adapter's store-then-rollback.
      const outputFailure = validateDeclaredOutput(resource, request.op, record);
      if (outputFailure !== undefined) return outputFailure;
      const serialized = JSON.stringify(canonicalValue(record));

      if (request.idempotencyKey !== undefined && mutation.idempotency === 'keyed') {
        const scopeKey = `${resource.id}::${request.op}::${request.idempotencyKey}`;
        const fingerprint = JSON.stringify({
          resourceId: request.resourceId,
          op: request.op,
          identity: request.id ?? null,
          input: canonicalValue(record),
        });
        return safeDriver('mutation.create', () => {
          open.db.exec('BEGIN IMMEDIATE;');
          try {
            const prior = open.db
              .prepare(
                'SELECT identity, fingerprint FROM vict_appdata_idempotency WHERE scope_key = ?;',
              )
              .get(scopeKey) as { identity: string; fingerprint: string } | undefined;
            if (prior !== undefined) {
              open.db.exec('ROLLBACK;');
              if (prior.fingerprint !== fingerprint) {
                return fail(
                  'DATA_IDEMPOTENCY_CONFLICT',
                  'The idempotency key was already used with a different request; a key reconciles only its original canonical request.',
                );
              }
              const existing = open.db
                .prepare(`SELECT data FROM ${name} WHERE identity = ?;`)
                .get(prior.identity) as { data: string } | undefined;
              return {
                ok: true as const,
                row:
                  existing === undefined
                    ? {}
                    : (JSON.parse(existing.data) as Record<string, unknown>),
              };
            }
            const existingRow = open.db
              .prepare(`SELECT identity FROM ${name} WHERE identity = ?;`)
              .get(identity);
            if (existingRow !== undefined) {
              open.db.exec('ROLLBACK;');
              return fail(
                'DATA_INVALID_INPUT',
                'A row with the requested identity already exists.',
              );
            }
            open.db
              .prepare(`INSERT INTO ${name} (identity, data) VALUES (?, ?);`)
              .run(identity, serialized);
            open.db
              .prepare(
                'INSERT INTO vict_appdata_idempotency (scope_key, identity, fingerprint, applied_at) VALUES (?, ?, ?, ?);',
              )
              .run(scopeKey, identity, fingerprint, (options.now ?? (() => '0'))());
            open.db.exec('COMMIT;');
            return { ok: true as const, row: JSON.parse(serialized) as Record<string, unknown> };
          } catch (cause) {
            try {
              open.db.exec('ROLLBACK;');
            } catch {
              /* nothing to roll back */
            }
            throw cause;
          }
        });
      }

      return safeDriver('mutation.create', () => {
        open.db.exec('BEGIN IMMEDIATE;');
        try {
          const existingRow = open.db
            .prepare(`SELECT identity FROM ${name} WHERE identity = ?;`)
            .get(identity);
          if (existingRow !== undefined) {
            open.db.exec('ROLLBACK;');
            return fail('DATA_INVALID_INPUT', 'A row with the requested identity already exists.');
          }
          open.db
            .prepare(`INSERT INTO ${name} (identity, data) VALUES (?, ?);`)
            .run(identity, serialized);
          open.db.exec('COMMIT;');
          return { ok: true as const, row: JSON.parse(serialized) as Record<string, unknown> };
        } catch (cause) {
          try {
            open.db.exec('ROLLBACK;');
          } catch {
            /* nothing to roll back */
          }
          throw cause;
        }
      });
    }

    if (request.op === 'update') {
      const rowId = request.id;
      if (!isNonEmptyString(rowId)) {
        return fail('DATA_INVALID_REQUEST', 'update requires a non-empty id.');
      }
      if (request.idempotencyKey !== undefined) {
        return fail(
          'DATA_INVALID_REQUEST',
          `Mutation '${request.op}' does not accept idempotency keys.`,
        );
      }
      const input = request.input;
      if (
        input === undefined ||
        input === null ||
        Array.isArray(input) ||
        typeof input !== 'object'
      ) {
        return fail('DATA_INVALID_INPUT', 'update requires a plain-object input.');
      }
      if (!isSerializableDomain(input)) {
        return fail(
          'DATA_INVALID_INPUT',
          'Mutation input contains values outside the supported serializable domain.',
        );
      }
      const parsed = parseDeclaredInput(resource, request.op, input);
      if (parsed.result !== undefined) return parsed.result;
      const record = parsed.value as Record<string, unknown>;
      const unknownField = checkCatalogue(resource, record);
      if (unknownField !== undefined) return unknownField;
      for (const field of resource.fields) {
        if (record[field.name] !== undefined) {
          const typeMismatch = checkFieldType(field, record[field.name]);
          if (typeMismatch !== undefined) return typeMismatch;
        }
      }
      return safeDriver('mutation.update', () => {
        open.db.exec('BEGIN IMMEDIATE;');
        try {
          const existing = open.db
            .prepare(`SELECT data FROM ${name} WHERE identity = ?;`)
            .get(rowId) as { data: string } | undefined;
          if (existing === undefined) {
            open.db.exec('ROLLBACK;');
            return fail('DATA_UNKNOWN_IDENTITY', 'No row with the requested identity exists.');
          }
          const merged = JSON.parse(existing.data) as Record<string, unknown>;
          for (const [key, value] of Object.entries(record)) {
            if (resource.fields.some((field) => field.name === key)) {
              merged[key] = canonicalValue(value);
            }
          }
          const outputFailure = validateDeclaredOutput(resource, request.op, merged);
          if (outputFailure !== undefined) {
            open.db.exec('ROLLBACK;');
            return outputFailure;
          }
          open.db
            .prepare(`UPDATE ${name} SET data = ? WHERE identity = ?;`)
            .run(JSON.stringify(canonicalValue(merged)), rowId);
          open.db.exec('COMMIT;');
          return { ok: true as const, row: merged };
        } catch (cause) {
          try {
            open.db.exec('ROLLBACK;');
          } catch {
            /* nothing to roll back */
          }
          throw cause;
        }
      });
    }

    if (request.op === 'delete') {
      const rowId = request.id;
      if (!isNonEmptyString(rowId)) {
        return fail('DATA_INVALID_REQUEST', 'delete requires a non-empty id.');
      }
      if (request.idempotencyKey !== undefined) {
        return fail(
          'DATA_INVALID_REQUEST',
          `Mutation '${request.op}' does not accept idempotency keys.`,
        );
      }
      return safeDriver('mutation.delete', () => {
        open.db.exec('BEGIN IMMEDIATE;');
        try {
          const existing = open.db
            .prepare(`SELECT identity FROM ${name} WHERE identity = ?;`)
            .get(rowId);
          if (existing === undefined) {
            open.db.exec('ROLLBACK;');
            return fail('DATA_UNKNOWN_IDENTITY', 'No row with the requested identity exists.');
          }
          open.db.prepare(`DELETE FROM ${name} WHERE identity = ?;`).run(rowId);
          open.db.exec('COMMIT;');
          return { ok: true as const };
        } catch (cause) {
          try {
            open.db.exec('ROLLBACK;');
          } catch {
            /* nothing to roll back */
          }
          throw cause;
        }
      });
    }

    return fail(
      'DATA_MUTATION_NOT_DECLARED',
      'The requested mutation is not declared by the resource.',
    );
  };

  /** Insert one validated seed row (same rules as the create mutation). */
  const insertSeed = (resource: ResourceDefinition, row: Record<string, unknown>): void => {
    if (!isSerializableDomain(row)) {
      throw new VictApplicationDataError(
        'APPDATA_INVALID_RESOURCE',
        `Seed data for resource '${resource.id}' contains values outside the supported serializable domain.`,
        'seed',
      );
    }
    for (const key of Object.keys(row)) {
      if (!resource.fields.some((field) => field.name === key)) {
        throw new VictApplicationDataError(
          'APPDATA_INVALID_RESOURCE',
          `Seed data for resource '${resource.id}' contains a field outside the declared catalogue.`,
          'seed',
        );
      }
    }
    for (const field of resource.fields) {
      if (field.required === true && row[field.name] === undefined) {
        throw new VictApplicationDataError(
          'APPDATA_INVALID_RESOURCE',
          `Seed data for resource '${resource.id}' is missing required field '${field.name}'.`,
          'seed',
        );
      }
      const mismatch = checkFieldType(field, row[field.name]);
      if (mismatch !== undefined && mismatch.ok === false) {
        throw new VictApplicationDataError(
          'APPDATA_INVALID_RESOURCE',
          `Seed data for resource '${resource.id}' rejected: ${mismatch.message}`,
          'seed',
        );
      }
    }
    const identity = row[resource.identity.key];
    if (!isNonEmptyString(identity)) {
      throw new VictApplicationDataError(
        'APPDATA_INVALID_RESOURCE',
        `Seed data for resource '${resource.id}' requires the identity field '${resource.identity.key}' as a non-empty string.`,
        'seed',
      );
    }
    const seedTable = physicalTableName(resource.id);
    safeDriver('seed.insert', () =>
      open.db
        .prepare(`INSERT INTO ${seedTable} (identity, data) VALUES (?, ?);`)
        .run(identity, JSON.stringify(canonicalValue(row))),
    );
  };
  try {
    for (const resource of resources) {
      for (const row of options.seeds?.[resource.id] ?? []) {
        insertSeed(resource, row);
      }
    }
  } catch (error) {
    open.close();
    throw error;
  }

  const table = (resource: ResourceDefinition): string => physicalTableName(resource.id);

  /** json_extract path for a VALIDATED catalogue field name. */
  const fieldPath = (resource: ResourceDefinition, field: string): string => {
    if (!isNonEmptyString(field) || !/^[A-Za-z0-9_]+$/.test(field)) {
      refuse('DATA_UNSUPPORTED_QUERY', 'A requested field is outside the safe physical mapping.');
    }
    if (!resource.fields.some((candidate) => candidate.name === field)) {
      refuse(
        'DATA_UNSUPPORTED_QUERY',
        'A requested field is not in the catalogue of the resource.',
      );
    }
    return `json_extract(data, '$.${field}')`;
  };

  const ensureOpen = (): void => {
    if (closed) {
      refuse('DATA_STORAGE_FAILED', 'The application-domain store is closed.');
    }
  };

  return {
    id: options.id ?? 'vict.appdata-sqlite',
    revision: options.revision ?? '1',

    async query(rawRequest, context) {
      try {
        return await Promise.resolve(runQuery(rawRequest, context));
      } catch (error) {
        if (error instanceof ResultExit) {
          return error.result;
        }
        return fail('DATA_INVALID_REQUEST', HOSTILE_REQUEST_MESSAGE);
      }
    },

    async mutate(rawRequest, context) {
      try {
        return await Promise.resolve(runMutation(rawRequest, context));
      } catch (error) {
        if (error instanceof ResultExit) {
          return error.result;
        }
        return fail('DATA_INVALID_REQUEST', HOSTILE_REQUEST_MESSAGE);
      }
    },

    close(): void {
      closed = true;
      open.close();
    },

    appliedMigrations(): readonly AppliedApplicationDataMigration[] {
      return history;
    },
  };
}
