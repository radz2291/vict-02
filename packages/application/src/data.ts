import type { Contract, ResourceDefinition } from '@vict/sdk';

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
  /** Input for create/update; validated against the mutation's declared contract. */
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
  | 'DATA_IDEMPOTENCY_CONFLICT'
  | 'DATA_UNSUPPORTED_QUERY'
  | 'DATA_INVALID_REQUEST'
  | 'DATA_CONTRACT_REJECTED'
  | 'DATA_UNSUPPORTED_VALUE';

/** Explicit contract bindings handed to the adapter (Stage 04 remediation). */
export interface ApplicationDataContractBinding {
  readonly contract: Contract<unknown>;
}

/**
 * Deep-copy plain serializable data. Functions, symbols, BigInt, Date,
 * non-finite numbers, sparse arrays, and exotic prototypes are OUTSIDE the
 * adapter's supported serializable domain and are rejected by the caller.
 */
function deepCopy<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => deepCopy(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = deepCopy(item);
    }
    return out as unknown as T;
  }
  return value;
}

/** True when a value is inside the adapter's supported serializable domain. */
function isSerializableDomain(value: unknown): boolean {
  if (value === null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return true;
  if (type === 'number') return Number.isFinite(value);
  if (type !== 'object') return false; // functions, symbols, bigint, undefined: outside
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
 * boundaries, contract-validated mutation input/output, one strict
 * unknown-field policy, per-resource/per-operation idempotency keys that
 * are consumed only on successful commit, defensive deep-copy isolation of
 * seeds/inputs/outputs, invalid query-bound rejection, and deterministic
 * filter/sort/pagination/projection semantics.
 *
 * Unknown-field policy (documented, strict, identical for create and
 * update): a mutation input whose fields are not in the resource's explicit
 * field catalogue is REJECTED with `DATA_INVALID_INPUT`. Undeclared
 * hostile fields are never stored.
 *
 * Idempotency policy (documented): keys are scoped by
 * `resourceId + op + idempotencyKey`; a key is recorded ONLY after the
 * mutation commits successfully; the same key with the same canonical
 * request reconciles to the committed result; the same key with different
 * input fails with the stable `DATA_IDEMPOTENCY_CONFLICT`; ops whose
 * declaration does not accept keys reject supplied keys.
 */
export function createInMemoryApplicationData(
  resources: readonly ResourceDefinition[],
  options: {
    readonly id?: string;
    readonly revision?: string;
    readonly seeds?: Readonly<Record<string, readonly Record<string, unknown>[]>>;
    /**
     * Explicit contract bindings (id/revision -> executable contract). The
     * adapter parses mutation input through the resource's or mutation's
     * declared contract — it does not rely on any upstream layer to have
     * pre-validated the payload, and it validates declared outputs.
     */
    readonly contracts?: readonly Contract<unknown>[];
  } = {},
): ApplicationDataAdapter {
  const rows = new Map<string, Map<string, Record<string, unknown>>>();
  const contractsById = new Map<string, Contract<unknown>>();
  for (const contract of options.contracts ?? []) {
    contractsById.set(contract.id, contract);
  }
  // Idempotency identity: `${resourceId}::${op}::${key}` -> committed record
  // (identity + canonical request fingerprint). Keys are recorded only
  // AFTER a mutation commits successfully.
  const idempotency = new Map<
    string,
    { readonly identity: string; readonly fingerprint: string }
  >();
  for (const resource of resources) {
    rows.set(
      resource.id,
      new Map(
        (options.seeds?.[resource.id] ?? []).map((row) => {
          // Defensive seed isolation: deep-copy and validate every seed; a
          // later mutation of the caller's seed object cannot reach stored
          // state.
          if (!isSerializableDomain(row)) {
            throw new Error(
              `Seed data for resource '${resource.id}' contains values outside the supported serializable domain.`,
            );
          }
          const key = String(row[resource.identity.key]);
          return [key, deepCopy(row)];
        }),
      ),
    );
  }

  const fail = (code: ApplicationDataErrorCode, message: string): ApplicationDataResult => ({
    ok: false,
    code,
    message,
  });

  const authorize = (
    resource: ResourceDefinition,
    effect: 'read' | 'write',
    context: ApplicationDataRequestContext,
  ): ApplicationDataResult | undefined => {
    // The request context must declare its effect honestly.
    if (context.effect !== effect) {
      return fail(
        'DATA_UNAUTHORIZED',
        `Access to resource '${resource.id}' was requested with an effect that does not match the operation.`,
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
    // Reads are always legal for declared resources; writes are gated per
    // declared mutation below (a read-only resource declares no mutations).
    return undefined;
  };

  /** Validate request-bound numbers: present values must be safe non-negative integers. */
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

  /** Validate the canonical serializable domain of retained input. */
  const checkInputDomain = (input: unknown): ApplicationDataResult | undefined => {
    if (!isSerializableDomain(input)) {
      return fail(
        'DATA_INVALID_INPUT',
        'Mutation input contains values outside the supported serializable domain (functions, symbols, BigInt, Date, non-finite numbers, sparse arrays, and exotic prototypes are not storable).',
      );
    }
    return undefined;
  };

  /** Parse mutation input through the declared exact contract when bound. */
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

  /** Validate declared output through the mutation's output contract when bound. */
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

  /** Canonical fingerprint of the mutation request (for idempotent reconciliation). */
  const fingerprint = (
    request: ApplicationDataMutationRequest,
    validatedInput: unknown,
  ): string => {
    return JSON.stringify({
      resourceId: request.resourceId,
      op: request.op,
      identity: request.id ?? null,
      input: canonicalValue(validatedInput),
    });
  };

  return {
    id: options.id ?? 'vict.in-memory-data',
    revision: options.revision ?? '1',

    async query(request, context) {
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
      const invalidLimit = checkBound(request.limit, 'limit');
      if (invalidLimit !== undefined) {
        return invalidLimit;
      }
      const invalidOffset = checkBound(request.offset, 'offset');
      if (invalidOffset !== undefined) {
        return invalidOffset;
      }
      const table = rows.get(resource.id) ?? new Map();
      if (request.op === 'get') {
        if (typeof request.id !== 'string' || request.id.length === 0) {
          return fail('DATA_INVALID_REQUEST', 'get requires a non-empty id.');
        }
        const row = table.get(request.id);
        if (row === undefined) {
          return fail('DATA_UNKNOWN_IDENTITY', 'No row with the requested identity exists.');
        }
        const projection = checkProjection(resource, request.projection);
        if (projection !== undefined) {
          return projection;
        }
        return { ok: true, row: project(deepCopy(row), request.projection) };
      }
      if (request.op !== 'list') {
        return fail('DATA_INVALID_REQUEST', 'The query op must be "list" or "get".');
      }
      let list = [...table.values()];
      for (const [field, expected] of Object.entries(request.filters ?? {})) {
        if (!resource.fields.some((candidate) => candidate.name === field)) {
          return fail(
            'DATA_UNSUPPORTED_QUERY',
            `Filter field '${field}' is not in the catalogue of the requested resource.`,
          );
        }
        if (!isSerializableDomain(expected)) {
          return fail('DATA_INVALID_REQUEST', 'Filter values must be serializable primitives.');
        }
        list = list.filter((row) => compareValues(row[field], expected) === 0);
      }
      for (const sort of [...(request.sort ?? [])].reverse()) {
        if (!resource.fields.some((candidate) => candidate.name === sort.field)) {
          return fail(
            'DATA_UNSUPPORTED_QUERY',
            'Sort field is not in the catalogue of the requested resource.',
          );
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
      const projection = checkProjection(resource, request.projection);
      if (projection !== undefined) {
        return projection;
      }
      return {
        ok: true,
        rows: list.map((row) => project(deepCopy(row), request.projection)),
        total,
      };
    },

    async mutate(request, context) {
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
      // Idempotency-key semantics: only mutations whose declaration accepts
      // keys (`idempotency: 'keyed'`) may receive one; anything else is a
      // stable rejection, never a silent ignore.
      if (request.idempotencyKey !== undefined && mutation.idempotency !== 'keyed') {
        return fail(
          'DATA_INVALID_REQUEST',
          `Mutation '${request.op}' does not accept idempotency keys; remove the key or declare keyed idempotency for the mutation.`,
        );
      }
      const table = rows.get(resource.id) ?? new Map();
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
        const domain = checkInputDomain(input);
        if (domain !== undefined) {
          return domain;
        }
        // Declared contract boundary: the adapter itself parses the input
        // through the declared exact contract — direct adapter calls
        // preserve their own typed boundary.
        const parsed = parseDeclaredInput(resource, request.op, input);
        if (parsed.result !== undefined) {
          return parsed.result;
        }
        const record = parsed.value as Record<string, unknown>;
        // One strict unknown-field policy for create AND update.
        const unknownField = checkCatalogue(resource, record);
        if (unknownField !== undefined) {
          return unknownField;
        }
        for (const field of resource.fields) {
          if (field.required === true && record[field.name] === undefined) {
            return fail('DATA_INVALID_INPUT', `Field '${field.name}' is required by the resource.`);
          }
          // Declared field types are enforced (no silent wrong-type rows).
          const typeMismatch = checkFieldType(field, record[field.name]);
          if (typeMismatch !== undefined) {
            return typeMismatch;
          }
        }
        if (
          typeof record[resource.identity.key] !== 'string' ||
          (record[resource.identity.key] as string).length === 0
        ) {
          return fail(
            'DATA_INVALID_INPUT',
            `create requires the identity field '${resource.identity.key}' as a non-empty string.`,
          );
        }
        const identity = record[resource.identity.key] as string;
        // Idempotency reconciliation (scoped by resource + op + key):
        // failed mutations never consumed the key, so a retry with the SAME
        // canonical request reconciles; the same key with DIFFERENT input
        // is a stable conflict.
        if (request.idempotencyKey !== undefined && mutation.idempotency === 'keyed') {
          const scopeKey = `${resource.id}::${request.op}::${request.idempotencyKey}`;
          const prior = idempotency.get(scopeKey);
          if (prior !== undefined) {
            const fingerprintNow = fingerprint(request, record);
            if (prior.fingerprint !== fingerprintNow) {
              return fail(
                'DATA_IDEMPOTENCY_CONFLICT',
                'The idempotency key was already used with a different request; a key reconciles only its original canonical request.',
              );
            }
            const existing = table.get(prior.identity);
            return { ok: true, row: existing === undefined ? {} : deepCopy(existing) };
          }
        }
        if (table.has(identity)) {
          return fail('DATA_INVALID_INPUT', 'A row with the requested identity already exists.');
        }
        // Retain a defensive deep copy of the VALIDATED input; unknown or
        // hostile fields were rejected above and are never persisted.
        const stored = deepCopy(record);
        table.set(identity, stored);
        if (request.idempotencyKey !== undefined && mutation.idempotency === 'keyed') {
          const scopeKey = `${resource.id}::${request.op}::${request.idempotencyKey}`;
          idempotency.set(scopeKey, {
            identity,
            fingerprint: fingerprint(request, record),
          });
        }
        const outputFailure = validateDeclaredOutput(resource, request.op, stored);
        if (outputFailure !== undefined) {
          // The committed row failed its declared output contract: roll the
          // mutation back rather than return an unvalidated result.
          table.delete(identity);
          return outputFailure;
        }
        return { ok: true, row: deepCopy(stored) };
      }
      if (request.op === 'update') {
        if (typeof request.id !== 'string' || request.id.length === 0) {
          return fail('DATA_INVALID_REQUEST', 'update requires a non-empty id.');
        }
        if (!table.has(request.id)) {
          return fail('DATA_UNKNOWN_IDENTITY', 'No row with the requested identity exists.');
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
        const domain = checkInputDomain(input);
        if (domain !== undefined) {
          return domain;
        }
        const parsed = parseDeclaredInput(resource, request.op, input);
        if (parsed.result !== undefined) {
          return parsed.result;
        }
        const record = parsed.value as Record<string, unknown>;
        const unknownField = checkCatalogue(resource, record);
        if (unknownField !== undefined) {
          return unknownField;
        }
        for (const field of resource.fields) {
          if (record[field.name] !== undefined) {
            const typeMismatch = checkFieldType(field, record[field.name]);
            if (typeMismatch !== undefined) {
              return typeMismatch;
            }
          }
        }
        if (request.idempotencyKey !== undefined) {
          return fail(
            'DATA_INVALID_REQUEST',
            `Mutation '${request.op}' does not accept idempotency keys.`,
          );
        }
        const existing = table.get(request.id) as Record<string, unknown>;
        const updated: Record<string, unknown> = deepCopy({ ...existing });
        for (const [key, value] of Object.entries(record)) {
          if (resource.fields.some((field) => field.name === key)) {
            updated[key] = deepCopy(value);
          }
        }
        table.set(request.id, updated);
        const outputFailure = validateDeclaredOutput(resource, request.op, updated);
        if (outputFailure !== undefined) {
          table.set(request.id, existing);
          return outputFailure;
        }
        return { ok: true, row: deepCopy(updated) };
      }
      if (request.op === 'delete') {
        if (typeof request.id !== 'string' || request.id.length === 0) {
          return fail('DATA_INVALID_REQUEST', 'delete requires a non-empty id.');
        }
        if (request.idempotencyKey !== undefined) {
          return fail(
            'DATA_INVALID_REQUEST',
            `Mutation '${request.op}' does not accept idempotency keys.`,
          );
        }
        if (!table.has(request.id)) {
          return fail('DATA_UNKNOWN_IDENTITY', 'No row with the requested identity exists.');
        }
        table.delete(request.id);
        return { ok: true };
      }
      return fail(
        'DATA_MUTATION_NOT_DECLARED',
        'The requested mutation is not declared by the resource.',
      );
    },
  };

  /** Strict unknown-field policy shared by create and update. */
  function checkCatalogue(
    resource: ResourceDefinition,
    record: Record<string, unknown>,
  ): ApplicationDataResult | undefined {
    for (const key of Object.keys(record)) {
      if (!resource.fields.some((field) => field.name === key)) {
        return fail(
          'DATA_INVALID_INPUT',
          'The mutation input contains a field outside the declared field catalogue; unknown fields are rejected.',
        );
      }
    }
    return undefined;
  }

  /** Declared field types are enforced (no silent wrong-typed storage). */
  function checkFieldType(
    field: { readonly name: string; readonly type: string },
    value: unknown,
  ): ApplicationDataResult | undefined {
    if (value === undefined || value === null) {
      return undefined; // absence is governed by `required`
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
  }

  /** Unknown projection fields are REJECTED (never silently ignored). */
  function checkProjection(
    resource: ResourceDefinition,
    projection: readonly string[] | undefined,
  ): ApplicationDataResult | undefined {
    if (projection === undefined) {
      return undefined;
    }
    if (!Array.isArray(projection) || projection.some((field) => typeof field !== 'string')) {
      return fail('DATA_INVALID_REQUEST', 'projection must be an array of field names.');
    }
    for (const field of projection) {
      if (!resource.fields.some((candidate) => candidate.name === field)) {
        return fail(
          'DATA_UNSUPPORTED_QUERY',
          'Projection field is not in the catalogue of the requested resource.',
        );
      }
    }
    return undefined;
  }
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

/** Deterministic canonical form for idempotency request fingerprints. */
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
