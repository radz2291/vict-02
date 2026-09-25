<script lang="ts">
  /**
   * The GENERIC Vict application host (Stage 05 canonical renderer).
   *
   * Resolves routes, data, actions, and safe states from the immutable
   * Application Plan. Shared shell presentation belongs to ui-svelte.
   *
   * Reactivity contract (closes the Stage 04 `state_referenced_locally`
   * carry-forward): every value derived from a prop (plan, path, rows,
   * registry) is computed through `$derived`, so route, plan, data, and
   * registry updates propagate WITHOUT remounting and never go stale.
   */
  import { RendererDiagnostic, type ComponentRegistry } from '@victframework/application/renderer';
  import { deriveUiPlan } from '@victframework/ui';
  import { AppShell, Feedback } from '@victframework/ui-svelte';
  import {
    resolveRoute,
    themeVariables,
    validatePlanForRenderer,
    BUILT_IN_ROLES,
    type VictPlanView,
  } from './logic.js';
  import Surface from './Surface.svelte';

  interface Props {
    plan: VictPlanView;
    registry: ComponentRegistry;
    dispatch: (actionId: string, input?: unknown) => Promise<ActionResult>;
    path?: string;
    /** Route data per view id (rows and/or the route's detail record). */
    viewData?: Readonly<Record<string, ViewDatum>>;
    /** Invoked after a successful non-local action so the host refetches. */
    onInvalidate?: () => void;
    /** Detail record of the current route (convenience alias for viewData). */
    record?: Record<string, unknown> | null;
    /** Client-side navigation hook (e.g. SvelteKit's goto). */
    navigate?: (path: string) => void;
  }

  let {
    plan,
    registry,
    dispatch,
    path = '/',
    viewData = {},
    onInvalidate,
    record = null,
    navigate,
  }: Props = $props();

  // Structural validation: unknown roles and unresolvable components fail
  // with structured diagnostics. It re-runs whenever the plan or registry
  // changes; an INVALID update renders an explicit structured failure panel
  // (never stale content, never silent omission).
  const validated = $derived.by(() => {
    try {
      validatePlanForRenderer(plan, registry, BUILT_IN_ROLES);
      return { ok: true as const, message: '' };
    } catch (error) {
      if (error instanceof RendererDiagnostic) {
        return { ok: false as const, message: error.message };
      }
      throw error;
    }
  });

  // ALL prop-derived values are reactive derivations, never init-time
  // snapshots (no stale route/component resolution, no Svelte warnings).
  const current = $derived.by(() => resolveRoute(plan, path));
  const screen = $derived(current?.screen ?? null);
  const params = $derived(current?.params ?? {});
  const themeVars = $derived(themeVariables((plan.manifest ?? {}) as { theme?: unknown }));
  const uiPlan = $derived(deriveUiPlan(plan));

  const navRoutes = $derived(
    plan.routes.filter(
      (entry) =>
        entry.route.nav !== undefined &&
        (entry.screen !== null || typeof entry.route.redirect === 'string'),
    ),
  );
  const navGroups = $derived.by(() => {
    // Navigation groups appear in the order of their FIRST OCCURRENCE in
    // the ordered route list (the route contract is ordered navigation
    // semantics; a Map preserves that first-occurrence anchoring, and a
    // repeated or interleaved group always collects ALL of its routes
    // together). Routes inside a group sort by the declared `order` hint,
    // then by path (deterministic presentation), never by route-array
    // position over an explicit hint.
    const groups = new Map<string, typeof navRoutes>();
    for (const entry of navRoutes) {
      const group = entry.route.nav?.group ?? '';
      const list = groups.get(group) ?? [];
      list.push(entry);
      groups.set(group, list);
    }
    return [...groups.entries()].map(([name, entries]) => [
      name,
      [...entries].sort((a, b) => {
        const oa = a.route.nav?.order ?? 0;
        const ob = b.route.nav?.order ?? 0;
        return oa - ob || (a.route.path < b.route.path ? -1 : 1);
      }),
    ] as const);
  });

  const isActive = $derived.by(() => {
    const active = new Set<string>();
    const here = current?.route.id;
    if (here !== undefined) {
      active.add(here);
    }
    // A detail path keeps its section highlighted.
    for (const entry of plan.routes) {
      if (entry.route.path.split(':').length > 1) {
        const base = entry.route.path.split(':')[0] ?? '';
        if (base.length > 1 && path.startsWith(base)) {
          active.add(entry.route.id);
        }
      }
    }
    return active;
  });

  // ---- Action state ------------------------------------------------------
  let lastResult = $state<ActionResult | null>(null);
  let lastAction = $state<string | null>(null);

  export async function runAction(actionId: string, input?: unknown): Promise<void> {
    const action = plan.actions?.[actionId];
    // Browser-local actions NEVER cross the dispatcher (APP-011): the
    // declared local transition is executed entirely inside the renderer.
    if (action?.kind === 'local') {
      lastAction = actionId;
      lastResult = { ok: true, value: { local: 'reset-transient' } };
      return;
    }
    // Navigation actions change the route context client-side; they never
    // become server dispatches either.
    if (action?.kind === 'navigation') {
      const target = plan.routes.find((entry) => entry.route.id === action.routeId);
      const targetPath = target?.route.path;
      if (typeof targetPath === 'string') {
        lastAction = actionId;
        lastResult = { ok: true, value: { navigated: targetPath } };
        if (navigate !== undefined) {
          navigate(targetPath);
        } else if (typeof window !== 'undefined') {
          window.history.pushState({}, '', targetPath);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }
      return;
    }
    await dispatchAction(actionId, input);
  }

  /** Action authority and safe failure state shared with the conversation adapter. */
  async function dispatchAction(actionId: string, input?: unknown): Promise<ActionResult> {
    lastAction = actionId;
    try {
      const result = await dispatch(actionId, input);
      lastResult = result;
      if (result.ok && onInvalidate !== undefined) {
        onInvalidate();
      }
      return result;
    } catch {
      // A dispatcher rejection is caught and mapped to a SAFE
      // renderer-generated failure; no unhandled rejection can exist and no
      // raw error content ever reaches the DOM.
      lastResult = {
        ok: false,
        code: 'RENDERER_ACTION_FAILED',
        message: 'The action could not be completed; this safe failure state is renderer-generated.',
      };
      return lastResult;
    }
  }

  function sendConversation(actionId: string, text: string): Promise<boolean> {
    return dispatchAction(actionId, { text, author: 'You', participant: 'user' })
      .then((result) => result.ok);
  }

  const validationFailed = $derived(
    lastResult !== null && !lastResult.ok && lastResult.code === 'CONTRACT_REJECTED',
  );
  const denied = $derived(
    lastResult !== null && !lastResult.ok && lastResult.code === 'DATA_UNAUTHORIZED',
  );
  const failed = $derived(
    lastResult !== null &&
      !lastResult.ok &&
      !validationFailed &&
      !denied,
  );

  const screenState = $derived(
    (screen?.states ?? {}) as Record<string, { content?: unknown } | undefined>,
  );

  function stateText(stateName: string, fallback: string): string {
    const surface = screenState?.[stateName];
    if (surface !== undefined && surface !== null && typeof surface.content === 'string') {
      return surface.content;
    }
    return fallback;
  }

  const anyStale = $derived(
    Object.values(viewData).some((datum) => datum?.stale === true),
  );
  const anyPartial = $derived(
    Object.values(viewData).some((datum) => datum?.partial === true),
  );

  const viewRowCount = (viewId: string): number => {
    const datum = viewData[viewId];
    if (datum === undefined || datum === null) {
      return 0;
    }
    if (Array.isArray(datum.rows)) {
      return datum.rows.length;
    }
    return datum.record !== undefined && datum.record !== null ? 1 : 0;
  };

  const context = $derived({ params, viewRowCount });

  function hrefForRouteId(routeId: string | undefined): string | undefined {
    if (routeId === undefined) {
      return undefined;
    }
    const entry = plan.routes.find((candidate) => candidate.route.id === routeId);
    return entry?.route.path;
  }
  const shellGroups = $derived(navGroups.map(([label, entries]) => ({
    label,
    links: entries.map((entry) => ({
      label: entry.route.nav?.label ?? '',
      href: entry.route.path,
      current: isActive.has(entry.route.id),
    })),
  })));
  const shellBreadcrumbs = $derived((screen?.breadcrumbs ?? []).map((crumb) => ({
    label: crumb.label,
    href: hrefForRouteId(crumb.routeId),
  })));
</script>

<div
  class="vict-app"
  data-testid="vict-host"
  data-application-version={plan.applicationVersion}
  style={Object.entries(themeVars)
    .map(([name, value]) => `${name}:${value};`)
    .join('')}
>
  {#if !validated.ok}
    <AppShell {path}>
      <Feedback kind="error" message={validated.message} testId="structural-failure" />
    </AppShell>
  {:else if screen !== null}
    <AppShell
      title={screen.title}
      screenId={screen.id}
      {path}
      groups={shellGroups}
      breadcrumbs={shellBreadcrumbs}
    >
      {#if anyStale}
        <Feedback message={stateText('stale', 'Showing saved data that may be out of date.')} testId="stale-state" />
      {/if}
      {#if anyPartial}
        <Feedback message={stateText('partial', 'Some data is unavailable right now.')} testId="partial-state" />
      {/if}

      {#each screen.layout as region (screen.id + '.' + region.name)}
        <section class="vict-region" data-region={region.name}>
          {#each region.surfaces as surface (surface.id)}
            <Surface
              {surface}
              {plan}
              {uiPlan}
              {registry}
              {context}
              {params}
              {viewData}
              {record}
              run={runAction}
              {dispatch}
              {sendConversation}
            />
          {/each}
        </section>
      {/each}

      {#if validationFailed}
        <Feedback kind="error" message={stateText('validation', 'Validation failed; check the highlighted fields.')} testId="validation-state" />
      {:else if denied}
        <Feedback kind="denied" message={stateText('denied', 'This action was denied by the authorization boundary.')} testId="denied-state" />
      {:else if failed}
        <Feedback kind="error" message={stateText('failure', 'Something failed safely.')} testId="failure-state" />
      {:else if lastResult !== null && lastResult.ok}
        <Feedback message="Done." testId="result-state" {lastAction} />
      {/if}
    </AppShell>
  {:else}
    <AppShell {path}>
      <Feedback message="This path is not part of the application." testId="route-not-found" />
    </AppShell>
  {/if}
</div>
