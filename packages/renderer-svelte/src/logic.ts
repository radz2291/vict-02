import type { SurfaceRole } from '@vict/sdk';
import { RendererDiagnostic } from '@vict/application/renderer';

/**
 * Pure renderer logic: deterministic route resolution (parameters +
 * redirects), safe-condition evaluation, theme-token mapping, and the
 * structural plan view shared by the host component. This module is
 * framework neutral (DOM types only) and unit-testable without mounting.
 */

/** A dispatched action result (safe structured value; never a raw echo). */
export interface ActionResult {
  ok: boolean;
  value?: unknown;
  code?: string;
  message?: string;
}

/** Route data provided by the host per view id. */
export interface ViewDatum {
  readonly rows?: readonly Record<string, unknown>[];
  readonly record?: Record<string, unknown> | null;
  readonly total?: number;
  readonly loading?: boolean;
  readonly stale?: boolean;
  readonly partial?: boolean;
}

/** The structural view of a compiled route entry (route + screen or null). */
export interface PlanRouteEntry {
  readonly route: {
    readonly id: string;
    readonly path: string;
    readonly screenId?: string;
    readonly redirect?: string;
    readonly nav?: { readonly label: string; readonly group?: string; readonly order?: number };
  };
  readonly screen: PlanScreen | null;
}

/** Structural view of a screen (surfaces are read defensively). */
export interface PlanScreen {
  readonly id: string;
  readonly title: string;
  readonly layout: readonly { readonly name: string; readonly surfaces: readonly PlanSurface[] }[];
  /** Screen states are read defensively (the compiled plan carries the closed @1/@2 states). */
  readonly states?: unknown;
  readonly breadcrumbs?: readonly { readonly label: string; readonly routeId?: string }[];
}

export interface PlanSurface {
  readonly role: SurfaceRole | string;
  readonly id: string;
  readonly [key: string]: unknown;
}

/** The structural subset of the compiled plan the renderer consumes. */
export interface VictPlanView {
  readonly applicationId: string;
  readonly applicationRevision: string;
  readonly applicationVersion: string;
  readonly routes: readonly PlanRouteEntry[];
  readonly screens: Readonly<Record<string, PlanScreen | undefined>>;
  readonly views: Readonly<Record<string, unknown>>;
  readonly forms: Readonly<Record<string, { readonly submitActionId: string } | undefined>>;
  readonly actions: Readonly<
    Record<string, { readonly kind: string; readonly id: string } | undefined>
  >;
  readonly manifest?: { readonly theme?: unknown };
}

/** Resolved route context: the matched route, its screen, and path parameters. */
export interface ResolvedRoute {
  readonly route: PlanRouteEntry['route'];
  readonly screen: PlanScreen | null;
  readonly params: Readonly<Record<string, string>>;
}

/**
 * Deterministic route resolution: exact-segment matching with single
 * `:name` parameters, followed by bounded redirect chasing. Returns null
 * when nothing matches (structured not-found is the host's decision).
 */
export function resolveRoute(plan: VictPlanView, path: string): ResolvedRoute | null {
  const normalized = normalizePath(path);
  const match = matchRoute(plan, normalized);
  if (match === null) {
    return null;
  }
  const seen = new Set<string>();
  let current = match;
  while (current.screen === null && typeof current.route.redirect === 'string') {
    if (seen.has(current.route.id)) {
      return null; // redirect cycle guard (the compiler already rejects these)
    }
    seen.add(current.route.id);
    const target = plan.routes.find((entry) => entry.route.id === current.route.redirect);
    if (target === undefined) {
      return null;
    }
    const next = matchRoute(plan, normalizePath(target.route.path));
    if (next === null) {
      return null;
    }
    current = next;
  }
  return current;
}

function normalizePath(path: string): string {
  if (typeof path !== 'string' || path.length === 0) {
    return '/';
  }
  return path.startsWith('/') ? path : `/${path}`;
}

function matchRoute(plan: VictPlanView, path: string): ResolvedRoute | null {
  let fallback: { entry: PlanRouteEntry; params: Record<string, string>; score: number } | null =
    null;
  for (const entry of plan.routes) {
    const params = matchPath(entry.route.path, path);
    if (params === null) {
      continue;
    }
    // Prefer the pattern with the fewest parameters (most specific match).
    const score = entry.route.path.split(':').length;
    if (fallback === null || score < fallback.score) {
      fallback = { entry, params, score };
    }
  }
  if (fallback === null) {
    return null;
  }
  return {
    route: fallback.entry.route,
    screen: fallback.entry.screen,
    params: fallback.params,
  };
}

/** Match `/projects/:id` style paths; returns parameters or null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternSegments = pattern.split('/').filter((segment) => segment.length > 0);
  const pathSegments = path.split('/').filter((segment) => segment.length > 0);
  if (patternSegments.length !== pathSegments.length) {
    return null;
  }
  const params: Record<string, string> = {};
  for (const [index, patternSegment] of patternSegments.entries()) {
    const pathSegment = pathSegments[index] as string;
    if (patternSegment.startsWith(':')) {
      const name = patternSegment.slice(1);
      if (name.length === 0 || pathSegment.length === 0) {
        return null;
      }
      params[name] = safeSegment(pathSegment);
    } else if (patternSegment !== pathSegment) {
      return null;
    }
  }
  return params;
}

/** Decode one path segment defensively (never throws on malformed input). */
function safeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Safe derived-state visibility evaluation (conditions were compile-validated). */
export function isVisible(
  surface: PlanSurface,
  context: {
    readonly params: Readonly<Record<string, string>>;
    readonly viewRowCount: (viewId: string) => number;
  },
): boolean {
  const condition = surface.visibleWhen as
    | {
        readonly viewNonEmpty?: string;
        readonly viewEmpty?: string;
        readonly paramEquals?: { readonly name: string; readonly value: string };
      }
    | undefined;
  if (condition === undefined || condition === null) {
    return true;
  }
  if (typeof condition.viewNonEmpty === 'string') {
    return context.viewRowCount(condition.viewNonEmpty) > 0;
  }
  if (typeof condition.viewEmpty === 'string') {
    return context.viewRowCount(condition.viewEmpty) === 0;
  }
  if (
    condition.paramEquals !== undefined &&
    typeof condition.paramEquals === 'object' &&
    typeof condition.paramEquals.name === 'string'
  ) {
    return context.params[condition.paramEquals.name] === condition.paramEquals.value;
  }
  return true;
}

/** Disabled-state evaluation for action surfaces (presentation only — never authorization). */
export function isDisabled(
  surface: PlanSurface,
  params: Readonly<Record<string, string>>,
): boolean {
  const disabledWhen = surface.disabledWhen as { readonly paramMissing?: string } | undefined;
  if (disabledWhen === undefined || disabledWhen === null) {
    return false;
  }
  const name = disabledWhen.paramMissing;
  return typeof name === 'string' && params[name] === undefined;
}

/** Map a semantic token name to its CSS custom property. */
export function tokenToCssVariable(name: string): string {
  return `--vict-${name.replace(/\./g, '-')}`;
}

/**
 * Extract validated theme token assignments from the plan manifest theme
 * declaration (`@2` shape) into CSS custom properties. Unknown token names
 * are ignored here (the compiler already rejects them; a renderer never
 * trusts unvalidated manifest data at runtime).
 */
export function themeVariables(manifest: { readonly theme?: unknown }): Record<string, string> {
  const out: Record<string, string> = {};
  const theme = manifest.theme;
  if (theme === undefined || theme === null || typeof theme !== 'object') {
    return out;
  }
  const tokens = (theme as { readonly tokens?: unknown }).tokens;
  if (!Array.isArray(tokens)) {
    return out;
  }
  for (const assignment of tokens) {
    if (
      assignment !== null &&
      typeof assignment === 'object' &&
      typeof (assignment as { name?: unknown }).name === 'string' &&
      typeof (assignment as { value?: unknown }).value === 'string'
    ) {
      const { name, value } = assignment as { name: string; value: string };
      out[tokenToCssVariable(name)] = value;
    }
  }
  return out;
}

/** Collect every declared surface (including nested tab/dialog/drawer content). */
export function collectSurfaces(
  screen: PlanScreen,
): readonly { readonly surface: PlanSurface; readonly path: string }[] {
  const out: { surface: PlanSurface; path: string }[] = [];
  const walk = (surface: PlanSurface, path: string): void => {
    out.push({ surface, path });
    if (surface.role === 'tabs' && Array.isArray(surface.tabs)) {
      for (const [index, tab] of (
        surface.tabs as readonly { readonly surfaces?: readonly PlanSurface[] }[]
      ).entries()) {
        for (const nested of tab.surfaces ?? []) {
          walk(nested, `${path}.tabs[${index}]`);
        }
      }
    }
    if (
      (surface.role === 'dialog' || surface.role === 'drawer') &&
      Array.isArray(surface.content)
    ) {
      for (const nested of surface.content as readonly PlanSurface[]) {
        walk(nested, `${path}.content`);
      }
    }
  };
  for (const region of screen.layout) {
    for (const surface of region.surfaces) {
      walk(surface, `${screen.id}.${region.name}`);
    }
  }
  const states = (screen.states ?? {}) as Record<string, PlanSurface | undefined>;
  for (const [name, surface] of Object.entries(states)) {
    if (surface !== undefined && typeof surface === 'object') {
      walk(surface, `${screen.id}.states.${name}`);
    }
  }
  return out;
}

/**
 * Pre-render structural validation: every surface role must be supported
 * and every custom component must resolve. Throws structured
 * RendererDiagnostic failures BEFORE anything renders.
 */
export function validatePlanForRenderer(
  plan: VictPlanView,
  registry: {
    readonly resolve: (reference: { readonly componentId: string; readonly revision: string }) => {
      readonly ok: boolean;
      readonly code?: string;
      readonly message?: string;
    };
  },
  supportedRoles: readonly string[],
): void {
  if (!Array.isArray(plan.routes)) {
    throw new RendererDiagnostic('RENDERER_INVALID_PLAN', 'The plan has no routes.');
  }
  for (const entry of plan.routes) {
    const screen = entry.screen;
    if (screen === null || screen === undefined) {
      continue; // redirect route
    }
    for (const { surface, path } of collectSurfaces(screen)) {
      if (!supportedRoles.includes(String(surface.role))) {
        throw new RendererDiagnostic(
          'RENDERER_UNSUPPORTED_ROLE',
          `Surface '${String(surface.id)}' has role '${String(surface.role)}', which this renderer does not support.`,
          { surfaceId: String(surface.id), role: String(surface.role) },
        );
      }
      if (surface.role === 'component') {
        const resolved = registry.resolve({
          componentId: String(surface.componentId ?? ''),
          revision: String(surface.revision ?? ''),
        });
        if (!resolved.ok) {
          throw new RendererDiagnostic(
            resolved.code === 'UNKNOWN_COMPONENT'
              ? 'RENDERER_UNKNOWN_COMPONENT'
              : 'RENDERER_COMPONENT_RESOLUTION_FAILED',
            resolved.message ?? 'The component could not be resolved.',
            { componentId: String(surface.componentId ?? '') },
          );
        }
      }
      void path;
    }
  }
}

/** The complete Stage 05 built-in role vocabulary. */
export const BUILT_IN_ROLES: readonly SurfaceRole[] = [
  'text',
  'view',
  'form',
  'action',
  'component',
  'states',
  'list',
  'table',
  'detail',
  'chart',
  'status',
  'tabs',
  'dialog',
  'drawer',
  'conversation',
];
