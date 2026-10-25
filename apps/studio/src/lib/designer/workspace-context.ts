import type { UiDocument } from '@victframework/ui';
import { compositionParent, resolveOccurrence } from '@victframework/ui-editor';

export type WorkspaceCommand = { label: string; run: () => void; disabled?: boolean; separator?: boolean };
export type WorkspaceContext = { label: string; prepare?: () => void; commands: WorkspaceCommand[] };

/** A repeated/definition occurrence is inspectable, not authority to edit its source. */
export function sourceCapabilities(document: UiDocument, occurrence: string | undefined) {
  const report = occurrence ? resolveOccurrence(occurrence, document) : undefined;
  const direct = !!report?.node && !report.repeatKeys.length && !report.instancePath.some(step => document.componentDefinitions[step.definitionId]);
  const parent = direct && report ? compositionParent(document, report.sourceNodeId) : undefined;
  const index = parent && report ? parent.children.indexOf(report.sourceNodeId) : -1;
  return { report, direct, removable: direct && report?.sourceNodeId !== document.root && !!parent,
    earlier: !!parent && index > 0, later: !!parent && index >= 0 && index < parent.children.length - 1 };
}

export function nativeContextTarget(target: Element): boolean {
  const editable = target.closest('[contenteditable]')?.getAttribute('contenteditable');
  return !!target.closest('input,textarea,select,[data-ui-inline-editor]') || (editable !== undefined && editable !== null && editable.toLowerCase() !== 'false');
}
