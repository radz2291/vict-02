/** Studio host facts, not portable guarantees of the canonical document. */
export const studioPreviewHost = {
  surfaces: ['Design', 'Interact', 'Run'],
  selector: '[data-application-content]',
  container: { name: 'studio-screen', type: 'inline-size' },
  widthPresets: 'Resize the actual isolated application iframe viewport and its inner query container.',
  mediaQueries: 'Evaluate against the application iframe viewport and follow preview width presets.',
  canonicalRoot: 'The Studio host is an ancestor; the canonical root need not establish this container.',
  portability: 'Other consumers must establish a compatible host explicitly; this container is not a portable document guarantee.',
  provenance: 'packages/ui-svelte/src/viewport/ViewportContent.svelte; Studio ApplicationViewport containerName prop',
} as const;

export const studioPreviewHostGuidance = `Studio Design, Interact and Run use a real isolated application iframe viewport and establish an ancestor ${studioPreviewHost.container.type} container named ${studioPreviewHost.container.name} INSIDE that iframe (${studioPreviewHost.selector}; ${studioPreviewHost.provenance}). Width presets resize the iframe viewport and its inner container. Container conditions named ${studioPreviewHost.container.name} therefore follow preview presets even when the canonical root has no container declaration. Media conditions use the application iframe viewport and also follow preview presets; the outer browser viewport is separate. Container ancestry cannot cross document boundaries. Use current measured untrusted_workspace.viewport.model facts: if a different surface explicitly reports hosted-container, its media queries instead use its containing browser viewport. This is Studio-owned host knowledge, not a portable document guarantee: other consumers must explicitly establish a compatible host. Read current condition definitions and inspect actual results before diagnosing a responsive rule.`;
