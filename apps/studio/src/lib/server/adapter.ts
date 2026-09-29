import type {
  ApplicationDataAdapter,
  ApplicationDataMutationRequest,
  ApplicationDataQueryRequest,
  ApplicationDataRequestContext,
  ApplicationDataResult,
} from '@victframework/application';
import {
  RESOURCE_BINDINGS,
  type StudioResourceId,
  type TargetRegistryEntry,
} from '../shared/contract.js';
import { callTarget, StudioPathError } from './vict-client.js';
import type { TargetStatusRow } from '../shared/contract.js';

/**
 * HTTP-BACKED APPLICATION-DATA ADAPTER (G1 read-only).
 *
 * Maps the closed `ApplicationDataAdapter` port onto the pinned VICT
 * operator-read bindings. fetch-only: NO VictStores import — the target is
 * reached exclusively through `vict-client.ts`.
 *
 * Error-code mapping (the HONEST nearest codes of the closed
 * `ApplicationDataErrorCode` list — the target's richer codes are
 * deliberately collapsed, never echoed):
 * - credential rejected (401/403)     -> DATA_UNAUTHORIZED
 * - target unreachable / fetch fault  -> DATA_UNSUPPORTED_QUERY ('target unreachable')
 * - target 404                        -> DATA_UNKNOWN_IDENTITY
 * - unknown resource / hostile path   -> DATA_UNKNOWN_RESOURCE
 * - other target error statuses       -> DATA_UNSUPPORTED_QUERY ('target error')
 * - any mutate()                      -> DATA_MUTATION_NOT_DECLARED (G1 read-only)
 */

export const STUDIO_READ_PERMISSION = 'studio.operator.read';

export interface StudioAdapterOptions {
  /** Target registry lookup; `undefined` truthfully means absent. */
  readonly getTarget: (id: string) => TargetRegistryEntry | undefined;
  /**
   * Local provider for the Studio-owned `targetStatus` resource. Its rows
   * NEVER come from a target: they are probed locally by the Studio server.
   */
  readonly targetStatusProvider?: () => Promise<readonly TargetStatusRow[]>;
  /** Which provisioned target adapter queries address (default 'local'). */
  readonly targetId?: string;
}

const RESULT_KEYS: Readonly<Record<StudioResourceId, string>> = {
  runs: 'runs',
  runEvents: 'events',
  runWaits: 'waits',
  activations: 'activations',
  selectedActivations: 'selections',
  releases: 'releases',
  releaseSelections: 'selections',
  auditEntries: 'events',
  targetStatus: 'targets',
};

const NUMERIC_QUERY_PARAMS: ReadonlySet<string> = new Set(['limit', 'offset', 'afterSeq']);

function fail(code: string, message: string): ApplicationDataResult {
  return { ok: false, code, message };
}

/** Validate a bounded identifier for path/route substitution. */
function isValidId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/.test(value);
}

export class StudioHttpAdapter implements ApplicationDataAdapter {
  readonly id = 'vict.studio.http-adapter';
  readonly revision = '1';

  readonly #options: StudioAdapterOptions;

  constructor(options: StudioAdapterOptions) {
    this.#options = options;
  }

  async query(
    request: ApplicationDataQueryRequest,
    context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult> {
    // Fail closed: the Studio operator read permission is REQUIRED.
    if (!context.permissions.includes(STUDIO_READ_PERMISSION)) {
      return fail('DATA_UNAUTHORIZED', 'the studio read permission is required');
    }
    const binding = (
      RESOURCE_BINDINGS as Record<string, (typeof RESOURCE_BINDINGS)[StudioResourceId]>
    )[request.resourceId];
    if (binding === undefined) {
      return fail('DATA_UNKNOWN_RESOURCE', 'the requested resource is not declared.');
    }
    if (request.op === 'get') {
      return this.#get(binding, request);
    }
    if (request.op !== 'list') {
      return fail('DATA_INVALID_REQUEST', 'the query op must be "list" or "get".');
    }
    return this.#list(binding, request);
  }

  async mutate(
    _request: ApplicationDataMutationRequest,
    _context: ApplicationDataRequestContext,
  ): Promise<ApplicationDataResult> {
    // G1 is strictly read-only: no mutation is declared, ever.
    return fail('DATA_MUTATION_NOT_DECLARED', 'the studio adapter declares no mutations.');
  }

  #target(): TargetRegistryEntry | undefined {
    return this.#options.getTarget(this.#options.targetId ?? 'local');
  }

  async #list(
    binding: (typeof RESOURCE_BINDINGS)[StudioResourceId],
    request: ApplicationDataQueryRequest,
  ): Promise<ApplicationDataResult> {
    if (binding.resourceId === 'targetStatus') {
      // Studio-LOCAL: produced by the injected local provider, never proxied.
      const rows = (await this.#options.targetStatusProvider?.()) ?? [];
      return { ok: true, rows: rows as unknown as Record<string, unknown>[] };
    }
    const filters: Record<string, string | number | boolean> = { ...(request.filters ?? {}) };
    // Route parameters substitute into the list path (e.g. runId).
    const params: Record<string, string> = {};
    const templateParams = [...binding.listPath.matchAll(/:([A-Za-z0-9_]+)/g)].map(
      (match) => match[1] as string,
    );
    for (const name of templateParams) {
      const value = filters[name];
      const raw = typeof value === 'string' ? value : String(value ?? '');
      if (raw.length === 0 || !isValidId(raw)) {
        return fail('DATA_INVALID_REQUEST', `a valid '${name}' is required for this resource.`);
      }
      params[name] = raw;
      delete filters[name];
    }
    // Allowlisted query params only; bounded limit (default 50, max 200).
    const query: Record<string, string> = {};
    for (const key of binding.listQuery ?? []) {
      const value = filters[key];
      if (value === undefined) {
        continue;
      }
      delete filters[key];
      if (NUMERIC_QUERY_PARAMS.has(key)) {
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < 0) {
          continue;
        }
        query[key] = String(key === 'limit' ? Math.min(parsed, 200) : parsed);
      } else if (typeof value === 'string' && isValidId(value)) {
        query[key] = value;
      }
    }
    if (binding.listQuery?.includes('limit')) {
      query['limit'] = String(Math.min(request.limit ?? 50, 200));
    }
    if (binding.listQuery?.includes('offset') && request.offset !== undefined) {
      query['offset'] = String(request.offset);
    }
    const target = this.#target();
    if (target === undefined) {
      return fail('DATA_UNKNOWN_RESOURCE', 'no target is provisioned for this adapter.');
    }
    let result;
    try {
      result = await callTarget(target, binding.listPath, params, query);
    } catch (error) {
      if (error instanceof StudioPathError) {
        return fail('DATA_UNKNOWN_RESOURCE', 'the request path is not a declared binding.');
      }
      return fail('DATA_UNSUPPORTED_QUERY', 'target unreachable');
    }
    switch (result.kind) {
      case 'ok': {
        if (binding.resourceId === 'selectedActivations') {
          // Truthful absence: an unselected graph is an EMPTY result, never an error.
          const selection = result.data['selection'] as Record<string, unknown> | null | undefined;
          const activation = result.data['activation'] as
            Record<string, unknown> | null | undefined;
          if (selection === null || selection === undefined) {
            return { ok: true, rows: [] };
          }
          const row = {
            graphId: selection['graphId'] ?? null,
            activationVersion:
              activation?.['activationVersion'] ?? selection['activationVersion'] ?? null,
            selectionRevision: selection['selectionRevision'] ?? null,
            selectedAt: selection['selectedAt'] ?? null,
          };
          return { ok: true, rows: [row] };
        }
        const key = RESULT_KEYS[binding.resourceId];
        const value = result.data[key];
        const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
        const total = result.data['total'];
        return {
          ok: true,
          rows,
          ...(typeof total === 'number' ? { total } : {}),
        };
      }
      case 'rejected':
        return fail('DATA_UNAUTHORIZED', 'the target rejected the studio credential.');
      case 'unreachable':
        return fail('DATA_UNSUPPORTED_QUERY', 'target unreachable');
      case 'error':
        if (result.status === 404) {
          return fail('DATA_UNKNOWN_IDENTITY', 'no such record on the target.');
        }
        return fail('DATA_UNSUPPORTED_QUERY', 'target error');
    }
  }

  async #get(
    binding: (typeof RESOURCE_BINDINGS)[StudioResourceId],
    request: ApplicationDataQueryRequest,
  ): Promise<ApplicationDataResult> {
    if (binding.getPath === undefined) {
      return fail('DATA_UNSUPPORTED_QUERY', 'this resource declares no single-record read.');
    }
    if (binding.resourceId === 'targetStatus') {
      const rows = (await this.#options.targetStatusProvider?.()) ?? [];
      const row = rows.find((entry) => entry.id === request.id);
      if (row === undefined) {
        return fail('DATA_UNKNOWN_IDENTITY', 'no such record.');
      }
      return { ok: true, row: row as unknown as Record<string, unknown> };
    }
    const id =
      request.id ??
      (typeof request.filters?.[binding.identityField] === 'string'
        ? (request.filters?.[binding.identityField] as string)
        : undefined);
    if (id === undefined || !isValidId(id)) {
      return fail('DATA_INVALID_REQUEST', `a valid '${binding.identityField}' is required.`);
    }
    const target = this.#target();
    if (target === undefined) {
      return fail('DATA_UNKNOWN_RESOURCE', 'no target is provisioned for this adapter.');
    }
    const templateParams = [...binding.getPath.matchAll(/:([A-Za-z0-9_]+)/g)].map(
      (match) => match[1] as string,
    );
    if (templateParams.length !== 1) {
      return fail('DATA_UNKNOWN_RESOURCE', 'the record path is not a declared binding.');
    }
    let result;
    try {
      result = await callTarget(target, binding.getPath, { [templateParams[0] as string]: id });
    } catch (error) {
      if (error instanceof StudioPathError) {
        return fail('DATA_UNKNOWN_RESOURCE', 'the request path is not a declared binding.');
      }
      return fail('DATA_UNSUPPORTED_QUERY', 'target unreachable');
    }
    switch (result.kind) {
      case 'ok': {
        let row: Record<string, unknown> | null | undefined;
        if (binding.resourceId === 'selectedActivations') {
          const selection = result.data['selection'] as Record<string, unknown> | null | undefined;
          if (selection === null || selection === undefined) {
            return fail('DATA_UNKNOWN_IDENTITY', 'no such record on the target.');
          }
          const activation = result.data['activation'] as
            Record<string, unknown> | null | undefined;
          row = {
            graphId: selection['graphId'] ?? null,
            activationVersion:
              activation?.['activationVersion'] ?? selection['activationVersion'] ?? null,
            selectionRevision: selection['selectionRevision'] ?? null,
            selectedAt: selection['selectedAt'] ?? null,
          };
        } else {
          const runOrActivation =
            (result.data['run'] as Record<string, unknown> | undefined) ??
            (result.data['activation'] as Record<string, unknown> | undefined);
          row = runOrActivation;
        }
        if (row === null || row === undefined) {
          return fail('DATA_UNKNOWN_IDENTITY', 'no such record on the target.');
        }
        return { ok: true, row };
      }
      case 'rejected':
        return fail('DATA_UNAUTHORIZED', 'the target rejected the studio credential.');
      case 'unreachable':
        return fail('DATA_UNSUPPORTED_QUERY', 'target unreachable');
      case 'error':
        if (result.status === 404) {
          return fail('DATA_UNKNOWN_IDENTITY', 'no such record on the target.');
        }
        return fail('DATA_UNSUPPORTED_QUERY', 'target error');
    }
  }
}
