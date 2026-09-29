import type { ApplicationDataAdapter } from '@victframework/application';
import { collectSurfaces, resolveRoute } from '@victframework/ui-svelte';
import type { ViewDatum, VictPlanView } from '@victframework/ui-svelte';
import { compileStudioPlan } from '$lib/application/index.js';
import { RESOURCE_BINDINGS } from '../shared/contract.js';
import { StudioHttpAdapter } from './adapter.js';
import { probeAllTargets, getTarget } from './targets.js';

/**
 * STUDIO APP SERVER — the server composition.
 *
 * Compiles the Studio plan once and loads every surface-bound view through
 * the HTTP-backed adapter over the pinned `RESOURCE_BINDINGS` (never
 * VictStores). Per contract: viewData is `{ rows, loading: false }` per
 * view id; the detail `record` comes from the binding's `getPath` and is
 * `null` when truthfully absent. Adapter failures surface TRUTHFULLY per
 * view as `{ rows: [], loading: false, failure: <safe code> }` — raw fetch
 * errors never reach the page.
 */
export interface StudioAppServer {
  loadRoute(
    path: string,
    searchParams?: URLSearchParams,
  ): Promise<{
    readonly plan: VictPlanView;
    readonly viewData: Record<string, ViewDatum>;
    readonly record: Record<string, unknown> | null;
  } | null>;
}

export function getStudioServer(): StudioAppServer {
  const planView = compileStudioPlan().toJSON() as unknown as VictPlanView;
  const adapter: ApplicationDataAdapter = new StudioHttpAdapter({
    getTarget,
    targetStatusProvider: probeAllTargets,
  });

  function resourceIdFor(viewId: string): string | undefined {
    const view = planView.views[viewId];
    if (typeof view !== 'object' || view === null) {
      return undefined;
    }
    const resourceId = (view as Record<string, unknown>)['resourceId'];
    return typeof resourceId === 'string' ? resourceId : undefined;
  }

  /** Find the binding whose identity field matches a route parameter. */
  function bindingForParam(
    paramName: string,
  ): (typeof RESOURCE_BINDINGS)[keyof typeof RESOURCE_BINDINGS] | undefined {
    return Object.values(RESOURCE_BINDINGS).find(
      (binding) => binding.identityField === paramName && binding.getPath !== undefined,
    );
  }

  async function loadRoute(
    path: string,
    searchParams?: URLSearchParams,
  ): Promise<{
    readonly plan: VictPlanView;
    readonly viewData: Record<string, ViewDatum>;
    readonly record: Record<string, unknown> | null;
  } | null> {
    const resolved = resolveRoute(planView, path === '' ? '/' : path);
    if (resolved === null || resolved.screen === null) {
      return null;
    }

    // Nested surfaces (tabs/dialogs/drawers) declare view bindings too.
    const viewIds = new Set<string>();
    for (const { surface } of collectSurfaces(resolved.screen)) {
      const viewId = (surface as { viewId?: unknown }).viewId;
      if (typeof viewId === 'string') {
        viewIds.add(viewId);
      }
    }

    const viewData: Record<string, ViewDatum> = {};
    await Promise.all(
      [...viewIds].map(async (viewId) => {
        const resourceId = resourceIdFor(viewId);
        if (resourceId === undefined) {
          return;
        }
        try {
          if (resourceId === 'targetStatus') {
            // Studio-local probe of the provisioned targets (never proxied).
            const result = await adapter.query(
              { op: 'list', resourceId, limit: 50 },
              { permissions: ['studio.operator.read'], effect: 'read' },
            );
            viewData[viewId] = result.ok
              ? { rows: (result.rows ?? []) as Record<string, unknown>[], loading: false }
              : failureDatum(result.code);
            return;
          }
          // Route params are filters; allowlisted extras come from searchParams.
          const filters: Record<string, string> = { ...resolved.params };
          for (const [key, value] of searchParams ?? []) {
            if (!(key in filters)) {
              filters[key] = value;
            }
          }
          // INTEGRATOR COMPOSITION (agreed interface note): the target API
          // serves selected activations PER GRAPH (`/vict/v1/activations/selected`
          // requires graphId), so an unfiltered selectedActivations view is
          // composed from discoverable graphs — all reads, never a proxy of a
          // fabricated row. With an explicit graphId filter it queries directly.
          if (resourceId === 'selectedActivations' && filters['graphId'] === undefined) {
            viewData[viewId] = await loadSelectedActivationsComposed();
            return;
          }
          const limitParam = Number(searchParams?.get('limit') ?? '');
          const result = await adapter.query(
            {
              op: 'list',
              resourceId,
              filters,
              limit:
                Number.isSafeInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50,
              ...(searchParams?.get('offset') !== null && searchParams?.get('offset') !== undefined
                ? { offset: Number(searchParams.get('offset')) }
                : {}),
            },
            { permissions: ['studio.operator.read'], effect: 'read' },
          );
          viewData[viewId] = result.ok
            ? { rows: (result.rows ?? []) as Record<string, unknown>[], loading: false }
            : failureDatum(result.code);
        } catch {
          // Never throw raw fetch errors into the page.
          viewData[viewId] = failureDatum('DATA_UNSUPPORTED_QUERY');
        }
      }),
    );

    // Detail record: a route parameter whose name is a binding identity
    // field reads the single record through the binding's getPath.
    let record: Record<string, unknown> | null = null;
    let recordBindingResourceId: string | undefined;
    for (const [paramName, value] of Object.entries(resolved.params)) {
      const binding = bindingForParam(paramName);
      if (binding === undefined) {
        continue;
      }
      const result = await adapter.query(
        { op: 'get', resourceId: binding.resourceId, id: value },
        { permissions: ['studio.operator.read'], effect: 'read' },
      );
      record = result.ok ? ((result.row ?? null) as Record<string, unknown> | null) : null;
      recordBindingResourceId = binding.resourceId;
      break;
    }

    // Reference-app detail convention: views bound to the record's own
    // resource on a detail route show THE RECORD as their single row (the
    // generic list for that resource has no identity filter). Views bound
    // to other resources keep their filtered list rows.
    if (recordBindingResourceId !== undefined) {
      for (const viewId of viewIds) {
        if (resourceIdFor(viewId) === recordBindingResourceId) {
          viewData[viewId] = {
            rows: record === null ? [] : [record],
            loading: false,
          } as ViewDatum;
        }
      }
    }

    return { plan: planView, viewData, record };
  }

  /**
   * selectedActivations composed from discoverable graphs: activations list
   * (first page) -> unique graphIds (capped) -> per-graph selected query.
   * Graphs without a selection are truthfully skipped.
   */
  async function loadSelectedActivationsComposed(): Promise<ViewDatum> {
    try {
      const ctx = { permissions: ['studio.operator.read'], effect: 'read' as const };
      const activations = await adapter.query(
        { op: 'list', resourceId: 'activations', limit: 50 },
        ctx,
      );
      if (!activations.ok) {
        return failureDatum(activations.code);
      }
      const graphIds = [
        ...new Set(
          ((activations.rows ?? []) as Record<string, unknown>[])
            .map((row) => row['graphId'])
            .filter((id): id is string => typeof id === 'string'),
        ),
      ].slice(0, 10);
      const rows: Record<string, unknown>[] = [];
      for (const graphId of graphIds) {
        const selected = await adapter.query(
          { op: 'get', resourceId: 'selectedActivations', id: graphId },
          ctx,
        );
        if (selected.ok && selected.row !== undefined && selected.row !== null) {
          rows.push(selected.row as Record<string, unknown>);
        }
      }
      return { rows, loading: false } as ViewDatum;
    } catch {
      return failureDatum('DATA_UNSUPPORTED_QUERY');
    }
  }

  return { loadRoute };
}

/** Truthful per-view failure datum: safe code only, never a raw error. */
function failureDatum(code: string): ViewDatum & { readonly failure: string } {
  return { rows: [], loading: false, failure: code };
}
