import {
  RESOURCE_BINDINGS,
  type StudioResourceId,
  type TargetRegistryEntry,
} from '../shared/contract.js';
import { getCredential } from './targets.js';

/**
 * SERVER-SIDE VICT TARGET CLIENT (D-2/D-7).
 *
 * GET-only, fail-closed path policy: the requested path must be EXACTLY a
 * binding `listPath`/`getPath` instance from `RESOURCE_BINDINGS`; path
 * parameters are validated against a bounded identifier grammar BEFORE any
 * fetch; query parameters are limited to the binding's `listQuery`. The
 * Bearer token is server-held and never appears in any result, error, or
 * log.
 */

/** Bounded identifier grammar (matches the VICT transport's id pattern). */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;

/** Client-side rejection: the path/params/query were invalid; NO fetch ran. */
export class StudioPathError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`Studio request rejected before fetch (${reason}).`);
    this.name = 'StudioPathError';
    this.reason = reason;
  }
}

export type TargetCallResult =
  | { readonly kind: 'ok'; readonly data: Record<string, unknown> }
  | { readonly kind: 'rejected'; readonly status: number }
  | { readonly kind: 'error'; readonly status: number }
  | { readonly kind: 'unreachable' };

interface ResolvedPath {
  readonly path: string;
  readonly allowedQuery: readonly string[];
}

/**
 * Resolve the path template against the closed binding table and validate
 * every substituted parameter. Throws StudioPathError (no fetch) on any
 * path that is not an exact binding instance or any hostile parameter.
 */
function resolveBindingPath(
  pathTemplate: string,
  params: Readonly<Record<string, string>>,
): ResolvedPath {
  let binding: { template: string; listQuery: readonly string[] } | undefined;
  for (const resource of Object.values(RESOURCE_BINDINGS) as readonly {
    listPath: string;
    getPath?: string;
    listQuery?: readonly string[];
    resourceId: StudioResourceId;
  }[]) {
    if (resource.listPath === pathTemplate) {
      binding = { template: resource.listPath, listQuery: resource.listQuery ?? [] };
      break;
    }
    if (resource.getPath === pathTemplate) {
      binding = { template: resource.getPath, listQuery: resource.listQuery ?? [] };
      break;
    }
  }
  if (binding === undefined) {
    throw new StudioPathError('path is not a declared binding');
  }
  const used = new Set<string>();
  const path = binding.template.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) => {
    const value = params[name];
    used.add(name);
    if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
      throw new StudioPathError(`invalid path parameter '${name}'`);
    }
    return value;
  });
  // Every declared template parameter must be supplied (no partial paths).
  for (const match of binding.template.matchAll(/:([A-Za-z0-9_]+)/g)) {
    if (!used.has(match[1] as string)) {
      throw new StudioPathError('missing path parameter');
    }
  }
  return { path, allowedQuery: binding.listQuery };
}

/**
 * Server-side GET to a target. Fail-closed, bounded (4s), non-echoing.
 */
export async function callTarget(
  entry: TargetRegistryEntry,
  pathTemplate: string,
  params: Readonly<Record<string, string>> = {},
  query: Readonly<Record<string, string>> = {},
): Promise<TargetCallResult> {
  const resolved = resolveBindingPath(pathTemplate, params);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (!resolved.allowedQuery.includes(key)) {
      continue; // fail-closed allowlist: unknown query params are dropped
    }
    if (!ID_PATTERN.test(value) && !/^\d{1,9}$/.test(value)) {
      continue; // hostile query value: dropped, never forwarded
    }
    search.set(key, value);
  }
  const credential = getCredential(entry.credentialRef);
  if (credential === undefined) {
    return { kind: 'unreachable' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  let response: Response;
  try {
    const suffix = search.toString();
    response = await fetch(
      `${entry.endpoint}${resolved.path}${suffix.length > 0 ? `?${suffix}` : ''}`,
      {
        method: 'GET',
        headers: { authorization: `Bearer ${credential.token}` },
        signal: controller.signal,
      },
    );
  } catch {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 401 || response.status === 403) {
    return { kind: 'rejected', status: response.status };
  }
  if (!response.ok) {
    return { kind: 'error', status: response.status };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: 'error', status: response.status };
  }
  if (typeof body !== 'object' || body === null) {
    return { kind: 'error', status: response.status };
  }
  const envelope = body as Record<string, unknown>;
  if (
    envelope['ok'] === true &&
    typeof envelope['data'] === 'object' &&
    envelope['data'] !== null
  ) {
    return { kind: 'ok', data: envelope['data'] as Record<string, unknown> };
  }
  // Non-echoing error envelope ({ ok:false, code }) or unexpected shape.
  if (envelope['ok'] === false) {
    const status = response.status;
    if (status === 401 || status === 403) {
      return { kind: 'rejected', status };
    }
    return { kind: 'error', status };
  }
  return { kind: 'error', status: response.status };
}
