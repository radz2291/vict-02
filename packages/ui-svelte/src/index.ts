export { default as RecordsTable } from './RecordsTable.svelte';
export { default as AppShell } from './AppShell.svelte';
export { default as Button } from './Button.svelte';
export { default as StatusBadge } from './StatusBadge.svelte';
export { default as Feedback } from './Feedback.svelte';
export { default as Tabs } from './Tabs.svelte';
export { default as Form } from './Form.svelte';
export { default as FormField } from './FormField.svelte';
export { default as Overlay } from './Overlay.svelte';
export { default as Text } from './Text.svelte';
export { default as DataView } from './DataView.svelte';
export { default as List } from './List.svelte';
export { default as Detail } from './Detail.svelte';
export { default as Chart } from './Chart.svelte';
export { default as Conversation } from './Conversation.svelte';
export { default as ComponentSlot } from './ComponentSlot.svelte';

// ---------------------------------------------------------------------------
// Renderer surface: the PERMANENT Svelte ApplicationRenderer implementation
// lives in this package (moved from @victframework/renderer-svelte, which is
// now only a compatibility facade re-exporting everything below).
// ---------------------------------------------------------------------------

export { default as VitApp } from './VitApp.svelte';
export { createVictRenderer, RENDERER_ID, RENDERER_REVISION } from './renderer.js';
export { renderVictApplication } from './mount.svelte.js';
export type { MountedVictApplication, RenderVictApplicationOptions } from './mount.svelte.js';
export {
  resolveRoute,
  matchPath,
  themeVariables,
  validatePlanForRenderer,
  collectSurfaces,
  BUILT_IN_ROLES,
  type VictPlanView,
  type ResolvedRoute,
  type ActionResult,
  type ViewDatum,
} from './logic.js';
export { RendererDiagnostic } from '@victframework/application/renderer';
