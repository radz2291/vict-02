import { VictControlError } from '@vict/runtime';
import type { ServerActorContext } from './auth.js';

/**
 * Stage 06B — the remote Application data/action adapter.
 *
 * Wraps the Stage 05 verified Application data port with the SAME server
 * authorization boundary (APP-010, API-006):
 *
 * - resource queries and mutations preserve the declared resource ID,
 *   revision, and release binding — never re-derived or widened;
 * - VICT actions use the same authorization boundary (scopes below the UI);
 * - LOCAL actions are client-local by definition and are REFUSED remotely;
 * - cross-actor and stale-release access fails;
 * - hostile query/filter containers produce structured non-echoing errors.
 */

export interface RemoteApplicationDataOptions {
  /** The verified Stage 05 application-data port (composed). */
  readonly data: ApplicationDataPortLike;
  /** The actor→resource ownership policy: resource records carry actorId. */
  readonly ownsResource?: (
    actor: ServerActorContext,
    resource: { readonly actorId?: unknown },
  ) => boolean;
  /** The expected release binding (stale-release denial). */
  readonly expectedReleaseVersion?: string;
}

/** The neutral application-data port surface used by the server. */
export interface ApplicationDataPortLike {
  query(request: Record<string, unknown>): Promise<unknown>;
  mutate(request: Record<string, unknown>): Promise<unknown>;
}

/** Bounded string fields on the remote boundary (closed schemas). */
function bounded(value: unknown, field: string, max = 128): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new VictControlError('VICT_APPDATA_FIELD_INVALID', `${field} must be a bounded string.`);
  }
  return value;
}

/** Hostile-container containment: any throw from a filter object is a stable error. */

/** The remote resource query boundary. */
export async function remoteQuery(
  actor: ServerActorContext,
  options: RemoteApplicationDataOptions,
  input: Record<string, unknown>,
): Promise<unknown> {
  const resourceId = bounded(input.resourceId, 'resourceId');
  const releaseVersion = bounded(input.releaseVersion, 'releaseVersion');
  if (
    options.expectedReleaseVersion !== undefined &&
    releaseVersion !== options.expectedReleaseVersion
  ) {
    throw new VictControlError(
      'VICT_APPDATA_RELEASE_STALE',
      'The declared release binding does not match the currently selected release.',
    );
  }
  // The authenticated actor owns the read; hostile filter containers are
  // contained BEFORE they reach the adapter.
  let filters: Record<string, unknown> | undefined;
  if (input.filters !== undefined) {
    if (
      typeof input.filters !== 'object' ||
      input.filters === null ||
      Array.isArray(input.filters)
    ) {
      throw new VictControlError(
        'VICT_APPDATA_FILTER_INVALID',
        'The filter container must be a plain object.',
      );
    }
    filters = input.filters as Record<string, unknown>;
    // Hostile getters/proxies are contained: enumeration failures collapse
    // to the stable structured error without echoing the hostile value.
    try {
      for (const key of Object.keys(filters)) {
        bounded(key, 'filterKey');
      }
    } catch (error) {
      if (error instanceof VictControlError) {
        throw error;
      }
      throw new VictControlError(
        'VICT_APPDATA_FILTER_INVALID',
        'The filter container could not be read safely.',
      );
    }
  }
  // Hostile containers (throwing getters/proxies) are contained at this
  // boundary: any downstream throw collapses to the stable structured
  // error — raw hostile content never echoes.
  try {
    return await options.data.query({
      kind: 'query',
      resourceId,
      releaseVersion,
      actorId: actor.actorId,
      ...(filters !== undefined ? { filters } : {}),
    });
  } catch (error) {
    if (error instanceof VictControlError) {
      throw error;
    }
    throw new VictControlError(
      'VICT_APPDATA_FILTER_INVALID',
      'The query could not be processed safely.',
    );
  }
}

/** The remote resource mutation boundary. */
export async function remoteMutate(
  actor: ServerActorContext,
  options: RemoteApplicationDataOptions,
  input: Record<string, unknown>,
): Promise<unknown> {
  const resourceId = bounded(input.resourceId, 'resourceId');
  const releaseVersion = bounded(input.releaseVersion, 'releaseVersion');
  const expectedRevision = bounded(input.expectedRevision ?? '0', 'expectedRevision');
  if (
    options.expectedReleaseVersion !== undefined &&
    releaseVersion !== options.expectedReleaseVersion
  ) {
    throw new VictControlError(
      'VICT_APPDATA_RELEASE_STALE',
      'The declared release binding does not match the currently selected release.',
    );
  }
  const actionKind = bounded(input.actionKind ?? 'mutation', 'actionKind', 32);
  if (actionKind === 'local') {
    // Local/view actions are CLIENT-LOCAL by definition and can never be
    // dispatched through the server boundary.
    throw new VictControlError(
      'VICT_APPDATA_LOCAL_ACTION_DENIED',
      'Local view actions are client-local and cannot be dispatched remotely.',
    );
  }
  try {
    return await options.data.mutate({
      kind: 'mutate',
      resourceId,
      releaseVersion,
      actorId: actor.actorId,
      expectedRevision,
      actionKind,
    });
  } catch (error) {
    if (error instanceof VictControlError) {
      throw error;
    }
    throw new VictControlError(
      'VICT_APPDATA_FILTER_INVALID',
      'The mutation could not be processed safely.',
    );
  }
}

/** The VICT-action boundary (governed Vict actions through the same server authorization). */
export async function remoteAction(
  actor: ServerActorContext,
  options: RemoteApplicationDataOptions,
  input: Record<string, unknown>,
): Promise<unknown> {
  const actionKind = bounded(input.actionKind, 'actionKind', 32);
  if (actionKind === 'local') {
    throw new VictControlError(
      'VICT_APPDATA_LOCAL_ACTION_DENIED',
      'Local view actions are client-local and cannot be dispatched remotely.',
    );
  }
  if (actionKind === 'query' || actionKind === 'mutation') {
    return actionKind === 'query'
      ? remoteQuery(actor, options, input)
      : remoteMutate(actor, options, input);
  }
  // capability / signal / navigation actions must reference their exact
  // declared identities; the composition supplies the authorized handler.
  throw new VictControlError(
    'VICT_APPDATA_ACTION_UNAVAILABLE',
    'The declared action kind is not composed in this deployment.',
  );
}
