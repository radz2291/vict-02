import type { UiDocument, UiValue } from '@victframework/ui';
import { compatiblePreviewValues } from './preview-state.js';
import { rebaseGraphRuntime } from './graph-authoring.js';

/** Source refresh expires simulation work without destroying live controls.
 * Explicit reset and a different document retain their separate reset boundary. */
export function sourceRuntimeRefresh(
  document: UiDocument,
  values: Readonly<Record<string, UiValue>>,
  previousDocumentId: string,
) {
  const compatible = compatiblePreviewValues(document, values);
  return {
    values: rebaseGraphRuntime(document, compatible.values),
    removed: compatible.removed,
    resetRenderer: previousDocumentId !== document.id,
  };
}
