/**
 * Occurrence identity and inspection (API-SPEC §4): selection addresses
 * `documentId + sourceNodeId + componentInstancePath + repeatRecordKeyPath`
 * — never DOM handles. DOM annotations (`data-*` attributes) are renderer
 * implementation details and never persisted.
 */

import type { UiDocument } from './document.js';
import { uiDiagnostic, type UiDiagnostic } from './diagnostics.js';

/** The persisted-ish occurrence identity (a logical address, not a handle). */
export interface UiOccurrenceRef {
  readonly documentId: string;
  readonly sourceNodeId: string;
  readonly componentInstancePath: readonly string[];
  readonly repeatRecordKeyPath: readonly string[];
}

/** Canonical occurrence key (matches the renderer's annotation). */
export function occurrenceKeyOf(ref: UiOccurrenceRef): string {
  return [
    ref.documentId,
    ref.sourceNodeId,
    ...ref.componentInstancePath,
    ...ref.repeatRecordKeyPath,
  ].join('|');
}

/** Parse a renderer-emitted occurrence key back into its parts. */
export function parseOccurrenceKey(key: string): UiOccurrenceRef | undefined {
  const parts = key.split('|');
  if (parts.length < 2) return undefined;
  const [documentId, sourceNodeId, ...rest] = parts as [string, string, ...string[]];
  const instancePath = rest.filter((part) => part.includes('@'));
  const repeatKeys = rest.filter((part) => !part.includes('@'));
  return {
    documentId,
    sourceNodeId,
    componentInstancePath: instancePath,
    repeatRecordKeyPath: repeatKeys,
  };
}

/** What the renderer observed at a position (for inspection). */
export interface UiRuntimeProjection {
  /** occurrence keys observed in the rendered output (per position). */
  readonly observedOccurrenceKeys?: readonly string[];
}

export interface UiOccurrenceReport {
  readonly occurrenceKey: string;
  readonly sourceNodeId: string;
  readonly documentId: string;
  readonly componentInstancePath: readonly string[];
  readonly repeatRecordKeyPath: readonly string[];
  readonly found: boolean;
  readonly ambiguous: boolean;
  readonly diagnostics: readonly UiDiagnostic[];
}

/**
 * Map a runtime occurrence back to its source occurrence. Ambiguity is a
 * hard error (`UI_OCCURRENCE_AMBIGUOUS`) — selection must identify THE
 * source occurrence, never "one of them".
 */
export function inspectUiOccurrence(
  occurrence: UiOccurrenceRef,
  source: UiDocument,
  runtimeProjection: UiRuntimeProjection = {},
): UiOccurrenceReport {
  const diagnostics: UiDiagnostic[] = [];
  const key = occurrenceKeyOf(occurrence);
  if (occurrence.documentId !== String(source.id)) {
    diagnostics.push(
      uiDiagnostic('UI_DOC_REFERENCE_DANGLING', 'Occurrence belongs to a different document.', {
        documentId: String(source.id),
        reference: occurrence.documentId,
      }),
    );
  }
  const node = (source.nodes ?? ({} as Record<string, unknown>))[occurrence.sourceNodeId];
  const found = node !== undefined;
  if (!found) {
    diagnostics.push(
      uiDiagnostic('UI_DOC_UNKNOWN_NODE', 'Occurrence does not resolve to a source node.', {
        documentId: String(source.id),
        nodeId: occurrence.sourceNodeId,
        missingChildId: occurrence.sourceNodeId,
      }),
    );
  }
  const observed = runtimeProjection.observedOccurrenceKeys ?? [];
  const matching = observed.filter((candidate) => candidate === key);
  const ambiguous = matching.length > 1;
  if (ambiguous) {
    diagnostics.push(
      uiDiagnostic('UI_OCCURRENCE_AMBIGUOUS', 'Multiple rendered occurrences share one key.', {
        nodeId: occurrence.sourceNodeId,
        candidates: matching,
      }),
    );
  }
  return {
    occurrenceKey: key,
    sourceNodeId: occurrence.sourceNodeId,
    documentId: String(source.id),
    componentInstancePath: [...occurrence.componentInstancePath],
    repeatRecordKeyPath: [...occurrence.repeatRecordKeyPath],
    found,
    ambiguous,
    diagnostics,
  };
}
