<script lang="ts">
  /**
   * The GENERIC Vict application host (Stage 05 canonical renderer).
   *
   * Renders whatever an immutable Application Plan declares: responsive
   * navigation, header, breadcrumbs, screen regions, surfaces, and safe
   * states. There is NO application-specific markup here — every route and
   * page shell is derived from the plan.
   *
   * Reactivity contract (closes the Stage 04 `state_referenced_locally`
   * carry-forward): every value derived from a prop (plan, path, rows,
   * registry) is computed through `$derived`, so route, plan, data, and
   * registry updates propagate WITHOUT remounting and never go stale.
   */
  import { RendererDiagnostic, type ComponentRegistry } from '@vict/application/renderer';
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

  // ALL prop-derived values are reactive derivations — never init-time
  // snapshots (no stale route/component resolution, no Svelte warnings).
  const current = $derived.by(() => resolveRoute(plan, path));
  const screen = $derived(current?.screen ?? null);
  const params = $derived(current?.params ?? {});
  const themeVars = $derived(themeVariables((plan.manifest ?? {}) as { theme?: unknown }));

  const navRoutes = $derived(
    plan.routes.filter(
      (entry) =>
        entry.route.nav !== undefined &&
        (entry.screen !== null || typeof entry.route.redirect === 'string'),
    ),
  );
  const navGroups = $derived.by(() => {
    const groups = new Map<string, typeof navRoutes>();
    for (const entry of navRoutes) {
      const group = entry.route.nav?.group ?? '';
      const list = groups.get(group) ?? [];
      list.push(entry);
      groups.set(group, list);
    }
    // Navigation groups sort by name; routes inside a group sort by the
    // declared `order` hint, then by path (deterministic presentation).
    return [...groups.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([name, entries]) => [
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

  let mobileNavOpen = $state(false);
  let navToggle = $state<HTMLButtonElement | null>(null);

  // Mobile navigation policy (MED-05-A remediation): the menu CLOSES when
  // the application navigates to another screen, so the in-flow nav panel
  // never surprises the user on the new screen; it stays open while the
  // user interacts within the current screen. The layout policy itself is
  // declared in theme.css (the nav is an explicit mobile grid row — never
  // an implicitly placed column).

  $effect(() => {
    void path;
    mobileNavOpen = false;
  });

  function closeMobileNav(): void {
    mobileNavOpen = false;
    // Keyboard users return to the menu control after closing.
    navToggle?.focus();
  }

  // Keyboard policy: Escape closes the open mobile navigation and returns
  // focus to the menu control. Only Escape raised INSIDE the open nav (or
  // on the menu control itself) reacts, so overlays keep their own Escape
  // semantics.
  function windowKeydown(event: KeyboardEvent): void {
    if (!mobileNavOpen || event.key !== 'Escape') {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const insideNav = target.closest('#vict-nav') !== null;
    const onToggle = target.classList.contains('vict-nav-toggle');
    if (insideNav || onToggle) {
      event.preventDefault();
      closeMobileNav();
    }
  }

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
    lastAction = actionId;
    try {
      const result = await dispatch(actionId, input);
      lastResult = result;
      if (result.ok && onInvalidate !== undefined) {
        onInvalidate();
      }
    } catch {
      // A dispatcher rejection is caught and mapped to a SAFE
      // renderer-generated failure; no unhandled rejection can exist and no
      // raw error content ever reaches the DOM.
      lastResult = {
        ok: false,
        code: 'RENDERER_ACTION_FAILED',
        message: 'The action could not be completed; this safe failure state is renderer-generated.',
      };
    }
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
    <main class="vict-main">
      <p class="vict-alert" role="alert" data-testid="structural-failure">{validated.message}</p>
    </main>
  {:else}
  <div class="vict-shell">
    {#if screen !== null}
      <header class="vict-header">
        {#if navRoutes.length > 0}
          <button
            type="button"
            class="vict-btn vict-btn--secondary vict-nav-toggle"
            aria-expanded={mobileNavOpen}
            aria-controls="vict-nav"
            bind:this={navToggle}
            onclick={() => (mobileNavOpen = !mobileNavOpen)}
          >
            ☰ Menu
          </button>
        {/if}
        <h1>{screen.title}</h1>
      </header>
      {#if navRoutes.length > 0}
        <nav
          id="vict-nav"
          class="vict-nav"
          class:vict-nav-open={mobileNavOpen}
          aria-label="Application"
        >
          {#each navGroups as [group, entries] (group)}
            {#if group !== ''}
              <p class="vict-nav-group-label">{group}</p>
            {/if}
            {#each entries as entry (entry.route.id)}
              <a
                class="vict-nav-link"
                href={entry.route.path}
                aria-current={isActive.has(entry.route.id) ? 'page' : undefined}
              >
                {entry.route.nav?.label}
              </a>
            {/each}
          {/each}
        </nav>
      {/if}
      <main class="vict-main" data-screen={screen.id}>
        {#if screen.breadcrumbs !== undefined && screen.breadcrumbs.length > 0}
          <nav aria-label="Breadcrumb" data-testid="breadcrumbs">
            <ol class="vict-breadcrumbs">
              {#each screen.breadcrumbs as crumb, index (index)}
                <li>
                  {#if crumb.routeId !== undefined && hrefForRouteId(crumb.routeId) !== undefined}
                    <a href={hrefForRouteId(crumb.routeId)}>{crumb.label}</a>
                  {:else}
                    <span aria-current="page">{crumb.label}</span>
                  {/if}
                </li>
              {/each}
            </ol>
          </nav>
        {/if}

        {#if anyStale}
          <p class="vict-state" role="status" data-testid="stale-state">
            {stateText('stale', 'Showing saved data that may be out of date.')}
          </p>
        {/if}
        {#if anyPartial}
          <p class="vict-state" role="status" data-testid="partial-state">
            {stateText('partial', 'Some data is unavailable right now.')}
          </p>
        {/if}

        {#each screen.layout as region (screen.id + '.' + region.name)}
          <section class="vict-region" data-region={region.name}>
            {#each region.surfaces as surface (surface.id)}
              <Surface
                {surface}
                {plan}
                {registry}
                {context}
                {params}
                {viewData}
                {record}
                run={runAction}
                {dispatch}
                {onInvalidate}
              />
            {/each}
          </section>
        {/each}

        {#if validationFailed}
          <p class="vict-alert" role="alert" data-testid="validation-state">
            {stateText('validation', 'Validation failed; check the highlighted fields.')}
          </p>
        {:else if denied}
          <p class="vict-alert vict-alert--denied" role="alert" data-testid="denied-state">
            {stateText('denied', 'This action was denied by the authorization boundary.')}
          </p>
        {:else if failed}
          <p class="vict-alert" role="alert" data-testid="failure-state">
            {stateText('failure', 'Something failed safely.')}
          </p>
        {:else if lastResult !== null && lastResult.ok}
          <p class="vict-state" role="status" data-testid="result-state" data-last-action={lastAction}>
            Done.
          </p>
        {/if}
      </main>
    {:else}
      <main class="vict-main">
        <p class="vict-state" role="status" data-testid="route-not-found">
          This path is not part of the application.
        </p>
      </main>
    {/if}
  </div>
  {/if}
</div>

<svelte:window onkeydown={windowKeydown} />

<style>
  .vict-nav-toggle {
    display: none;
  }

  @media (max-width: 719px) {
    .vict-nav-toggle {
      display: inline-flex;
    }
    .vict-nav {
      display: none;
    }
    .vict-nav-open {
      display: flex;
    }
  }

  .vict-breadcrumbs {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--vict-spacing-unit) * 1);
    list-style: none;
    padding: 0;
    margin: 0 0 calc(var(--vict-spacing-unit) * 3);
    font-size: 0.875rem;
    color: var(--vict-color-textMuted);
  }

  .vict-breadcrumbs li + li::before {
    content: '›';
    margin-right: calc(var(--vict-spacing-unit) * 1);
    color: var(--vict-color-textMuted);
  }

  .vict-breadcrumbs a {
    color: var(--vict-color-accent);
    text-decoration: none;
  }
</style>
