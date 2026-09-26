/**
 * @victframework/renderer-svelte — COMPATIBILITY FACADE ONLY.
 *
 * The permanent Svelte renderer implementation (VitApp, recursive surface
 * traversal, table/form/overlay adapters, mount machinery, route resolution,
 * structural validation, presentation normalization, canonical form values)
 * lives in `@victframework/ui-svelte`. This package contains NO independent
 * renderer implementation: every export below is a re-export of the single
 * implementation, so existing consumers keep working unchanged while new
 * code should import from `@victframework/ui-svelte` directly.
 *
 * `./theme.css` is likewise a compatibility entry point that routes to
 * `@victframework/ui-svelte/styles.css` (the one production style source).
 */
export {
  BUILT_IN_ROLES,
  RendererDiagnostic,
  RENDERER_ID,
  RENDERER_REVISION,
  VitApp,
  collectSurfaces,
  createVictRenderer,
  matchPath,
  renderVictApplication,
  resolveRoute,
  themeVariables,
  validatePlanForRenderer,
} from '@victframework/ui-svelte';
export type {
  ActionResult,
  MountedVictApplication,
  RenderVictApplicationOptions,
  ResolvedRoute,
  VictPlanView,
  ViewDatum,
} from '@victframework/ui-svelte';
