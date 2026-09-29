/**
 * VICT Studio shared interface contract (Stage 09, G1).
 *
 * THIS is the agreed interface between the two builder tracks:
 * - studio-server (session, target registry, HTTP adapter, boundary)
 * - studio-app    (Application Definition/Plan, components, routes)
 *
 * It is pinned to the ACTUAL G1 command surface of
 * `packages/server/src/commands.ts` at checkpoint `801ecee` (success
 * envelope `{ ok: true, data: … }`, non-echoing error envelope
 * `{ ok: false, code }`). Field names below are the exact server
 * projection names — the adapter maps them verbatim and invents nothing.
 *
 * G1 is read-only: every binding below is a READ. No mutation, no
 * receipt, no FT-1 navigation, no S9-02 claim.
 */

/* ------------------------------------------------------------------ */
/* Target connection model (D-2/D-7)                                   */
/* ------------------------------------------------------------------ */

/** The four TRUTHFUL connection states; nothing else may be shown. */
export type TargetConnectionState = 'connected' | 'rejected' | 'unreachable' | 'absent';

/**
 * One deployment-provisioned target registry entry (server-held).
 * `endpoint` is an EXACT `http://127.0.0.1:<port>` address from the
 * deployment registry — never user input, never discovered. `credentialRef`
 * names the server-held operator credential; it NEVER crosses to the client.
 */
export interface TargetRegistryEntry {
  readonly id: string;
  readonly label: string;
  readonly endpoint: string;
  readonly credentialRef: string;
}

/** The safe, client-visible projection of one target's status. */
export interface TargetStatusRow {
  readonly id: string;
  readonly label: string;
  readonly endpoint: string;
  readonly state: TargetConnectionState;
  /** Actor identity the Studio operator maps to on the target (connected only). */
  readonly actorId: string | null;
  /** The actor's granted scopes, shown only when connected. */
  readonly scopes: readonly string[];
  /** Selected-version identity reported by the target (connected only). */
  readonly selected: Readonly<Record<string, string>> | null;
  /** Human-truthful detail (safe string; no error bodies, no credentials). */
  readonly detail: string;
}

/* ------------------------------------------------------------------ */
/* VICT HTTP envelope (as implemented by packages/server/src/http.ts)  */
/* ------------------------------------------------------------------ */

export type VictOk<T> = { readonly ok: true; readonly data: T };
export type VictErr = { readonly ok: false; readonly code: string };
export type VictEnvelope<T> = VictOk<T> | VictErr;

/* ------------------------------------------------------------------ */
/* Resource ↔ command bindings (adapter mapping table)                 */
/* ------------------------------------------------------------------ */

export const STUDIO_RESOURCES = [
  'runs',
  'runEvents',
  'runWaits',
  'activations',
  'selectedActivations',
  'releases',
  'releaseSelections',
  'auditEntries',
  'targetStatus',
] as const;

export type StudioResourceId = (typeof STUDIO_RESOURCES)[number];

/**
 * Route-parameter convention: a detail route's parameter name MUST equal
 * the resource's `identityField` (e.g. `/runs/:runId` for `runs`).
 * `listQuery` lists the query parameters the adapter forwards (fail-closed:
 * anything else is dropped or rejected, never passed through blindly).
 */
export interface ResourceBinding {
  readonly resourceId: StudioResourceId;
  readonly identityField: string;
  readonly fields: readonly string[];
  /** HTTP path used for list queries. */
  readonly listPath: string;
  /** HTTP path template for single-record reads; `:param` segments match route params. */
  readonly getPath?: string;
  /** Query parameters allowed on the list path. */
  readonly listQuery?: readonly string[];
}

/**
 * Pinned to the G1 read routes in `packages/server/src/http.ts` and the
 * projections in `packages/server/src/commands.ts`.
 *
 * Response shapes (verbatim server field names):
 * - runs.list            → { runs: RunRow[], total, hasMore }
 * - runs.get             → { run: RunRow }
 * - runEvents.list       → { events: EventRow[], nextSeq, hasMore }  (params: runId, afterSeq, limit)
 * - runWaits.list        → { runId, waits: WaitRow[] }                (param: runId)
 * - activations.list     → { activations: ActivationRow[], total }    (params: graphId?, limit)
 * - selectedActivations  → { activation: ActivationRow | null, selection: SelectionRow | null }
 * - releases.list        → { releases: Record<string, unknown>[] }  (REQUIRES applicationId query param — the target 400s without it)
 * - releaseSelections    → { selections: Record<string, unknown>[] } (REQUIRES applicationId query param)
 * - auditEntries.list    → { events: AuditRow[], total }              (params: subjectType?, subjectId?, limit)
 * - targetStatus         → Studio-LOCAL: produced by the Studio server from
 *   its own connection registry. It is never proxied to a VICT target.
 */
export const RESOURCE_BINDINGS: Readonly<Record<StudioResourceId, ResourceBinding>> = {
  runs: {
    resourceId: 'runs',
    identityField: 'runId',
    fields: [
      'runId',
      'graphId',
      'graphVersion',
      'capabilitySetVersion',
      'activationVersion',
      'status',
      'mode',
      'retention',
      'steps',
      'currentNodeId',
      'outputSummary',
      'error',
      'recordRevision',
      'createdAt',
      'updatedAt',
    ],
    listPath: '/vict/v1/runs',
    getPath: '/vict/v1/runs/:runId',
    listQuery: ['limit', 'offset'],
  },
  runEvents: {
    resourceId: 'runEvents',
    identityField: 'seq',
    fields: [
      'runId',
      'seq',
      'eventSchema',
      'type',
      'graphId',
      'graphVersion',
      'capabilitySetVersion',
      'activationVersion',
      'nodeId',
      'capabilityId',
      'timestamp',
    ],
    listPath: '/vict/v1/runs/:runId/events',
    listQuery: ['afterSeq', 'limit'],
  },
  runWaits: {
    resourceId: 'runWaits',
    identityField: 'waitId',
    fields: [
      'waitId',
      'runId',
      'tokenId',
      'nodeId',
      'activationVersion',
      'kind',
      'signalName',
      'dueAt',
      'timeoutAt',
      'status',
      'createdAt',
      'resolvedAt',
      'resolvedBy',
    ],
    listPath: '/vict/v1/runs/:runId/waits',
    listQuery: [],
  },
  activations: {
    resourceId: 'activations',
    identityField: 'activationVersion',
    fields: [
      'graphId',
      'activationVersion',
      'nodeCount',
      'bindingCount',
      'contractCount',
      'nodeIds',
      'createdAt',
    ],
    listPath: '/vict/v1/activations',
    getPath: '/vict/v1/activations/:activationVersion',
    listQuery: ['graphId', 'limit'],
  },
  selectedActivations: {
    resourceId: 'selectedActivations',
    identityField: 'graphId',
    fields: ['graphId', 'activationVersion', 'selectionRevision', 'selectedAt'],
    listPath: '/vict/v1/activations/selected',
    getPath: '/vict/v1/graphs/:graphId/activations/selected',
    listQuery: ['graphId', 'limit'],
  },
  releases: {
    resourceId: 'releases',
    identityField: 'releaseId',
    fields: ['releaseId', 'version', 'state', 'createdAt'],
    listPath: '/vict/v1/releases',
    listQuery: ['applicationId'],
  },
  releaseSelections: {
    resourceId: 'releaseSelections',
    identityField: 'releaseId',
    fields: ['releaseId', 'selectionRevision', 'selectedAt', 'selectedBy'],
    listPath: '/vict/v1/releases/selections',
    listQuery: ['applicationId'],
  },
  auditEntries: {
    resourceId: 'auditEntries',
    identityField: 'auditId',
    fields: ['auditId', 'at', 'actorId', 'action', 'subjectType', 'subjectId', 'summary'],
    listPath: '/vict/v1/audit',
    listQuery: ['subjectType', 'subjectId', 'limit'],
  },
  targetStatus: {
    resourceId: 'targetStatus',
    identityField: 'id',
    fields: ['id', 'label', 'endpoint', 'state', 'actorId', 'scopes', 'selected', 'detail'],
    listPath: 'studio-local://targets', // never proxied; studio-server answers directly
  },
};

/* ------------------------------------------------------------------ */
/* loadRoute conventions (studio-server ↔ studio-app)                  */
/* ------------------------------------------------------------------ */

/**
 * `loadRoute(path, searchParams)` returns the generic VitApp props:
 * - `plan`: the compiled plan's JSON view (VictPlanView);
 * - `viewData`: for EVERY surface-bound `viewId` on the resolved screen:
 *   `{ rows, loading: false, stale?, partial? }`;
 * - `record`: the single record for detail routes, read through the
 *   binding's `getPath` with the route parameter substituted, `null` when
 *   the route has no parameter or the record is truthfully absent.
 *
 * Adapter queries use ONLY the binding table above; the adapter NEVER
 * forwards arbitrary paths or query parameters.
 */
