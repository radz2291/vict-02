import type { UiComponentPresentation } from '@victframework/ui-svelte';

/** Repeated parts describe the graph component's surfaces, not graph IDs or
 * additional canonical UI nodes. The host's source ownership stays intact. */
export const graphEditorParts = ['root', 'toolbar', 'canvas', 'inspector', 'node', 'node-header', 'node-body', 'field', 'field-content', 'port'] as const;

export function graphFieldPresentation(presentation: UiComponentPresentation | undefined, label: string): UiComponentPresentation {
  return {
    ownerDocument: presentation?.ownerDocument,
    scopeClass: presentation?.scopeClass,
    target(name) {
      const target = presentation?.target(name === 'content' ? 'field-content' : 'field');
      // Presentation attributes are forwarded by the registered catalog control.
      // This labels its real trigger without changing an accepted @1 prop schema.
      const labelled = { ...target, class: target?.class ?? '', ...(name === 'root' ? { 'aria-label': label } : {}) };
      return labelled;
    },
  };
}
