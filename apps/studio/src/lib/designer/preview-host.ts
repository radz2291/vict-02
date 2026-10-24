/** Studio host facts, not portable guarantees of the canonical document. */
export const studioPreviewHost = {
  surfaces: ['Design', 'Run'],
  selector: '.workspace-screen',
  container: { name: 'studio-screen', type: 'inline-size' },
  widthPresets: 'Change the preview host width, not the outer browser viewport.',
  mediaQueries: 'Evaluate against the outer browser viewport, not the preview width preset.',
  canonicalRoot: 'The Studio host is an ancestor; the canonical root need not establish this container.',
  portability: 'Other consumers must establish a compatible host explicitly; this container is not a portable document guarantee.',
  provenance: 'apps/studio/src/lib/designer/workspace.css',
} as const;

export const studioPreviewHostGuidance = `Studio Design and Run establish an ancestor ${studioPreviewHost.container.type} container named ${studioPreviewHost.container.name} (${studioPreviewHost.selector}; ${studioPreviewHost.provenance}). Width presets change that container width, not the outer browser viewport. Container conditions named ${studioPreviewHost.container.name} can therefore respond to preview presets even when the canonical root has no container declaration. Media conditions use the outer browser viewport and do not follow preview presets. Do not replace a container condition with media merely because the canonical root has no container. This is Studio-owned host knowledge, not a portable document guarantee: other consumers must explicitly establish a compatible host. Read current condition definitions and inspect actual results before diagnosing a responsive rule.`;
