/**
 * UI-foundation diagnostic catalog (API-SPEC §7 — frozen at U0).
 *
 * Structured values `{ code, message, severity, ...details }`; codes are
 * stable strings; compilation and validation never throw for invalid input.
 * Existing APPLICATION_*, RELEASE_*, DATA_* and RENDERER_* codes remain
 * governed by their owning modules and are intentionally not duplicated here.
 */

export type UiSeverity = 'error' | 'warning' | 'info';

export type UiDiagnosticCode =
  // document model
  | 'UI_DOC_UNKNOWN_SCHEMA'
  | 'UI_DOC_DUPLICATE_NODE_ID'
  | 'UI_DOC_UNKNOWN_NODE'
  | 'UI_DOC_CYCLE'
  | 'UI_DOC_REFERENCE_DANGLING'
  | 'UI_DOC_REVISION_COLLISION'
  | 'UI_DOC_UNKNOWN_COMPONENT'
  | 'UI_DOC_UNKNOWN_PROP'
  | 'UI_DOC_REQUIRED_SLOT_MISSING'
  | 'UI_DOC_UNKNOWN_PRODUCT_REFERENCE'
  | 'UI_DOC_UNKNOWN_ELEMENT'
  | 'UI_DOC_UNKNOWN_ATTRIBUTE'
  | 'UI_DOC_UNSUPPORTED_FEATURE'
  | 'UI_DOC_INVALID_LITERAL'
  // component ABI (amendment §3–§5, author-time)
  | 'UI_COMPONENT_OUTPUT_UNKNOWN'
  | 'UI_COMPONENT_OUTPUT_PAYLOAD_INVALID'
  | 'UI_COMPONENT_BINDING_INCOMPATIBLE'
  | 'UI_COMPONENT_REVISION_UNRESOLVED'
  | 'UI_COMPONENT_ABI_UNSUPPORTED'
  // application attachment
  | 'UI_APP_PRESENTATION_MODE_INVALID'
  // expressions and styles
  | 'UI_EXPR_UNKNOWN_REFERENCE'
  | 'UI_EXPR_TYPE_MISMATCH'
  | 'UI_EXPR_SCOPE_VIOLATION'
  | 'UI_STYLE_PROPERTY_UNSUPPORTED'
  | 'UI_STYLE_CONDITION_UNKNOWN'
  // editing
  | 'UI_EDIT_VALIDATION_FAILED'
  | 'UI_EDIT_REFERENCE_REMAINS'
  | 'UI_EDIT_REQUEST_CONFLICT'
  | 'UI_EDIT_UNDO_CONFLICT'
  | 'UI_EDIT_SAVE_IN_PROGRESS'
  | 'UI_DOC_STALE_REVISION'
  // extensions and occurrences
  | 'EXTENSION_UNAVAILABLE'
  | 'UI_OCCURRENCE_AMBIGUOUS'
  | 'UI_RENDER_DUPLICATE_KEY'
  // preview/scenario
  | 'SCENARIO_COVERAGE_MISSING'
  | 'OPERATION_DENIED'
  | 'DOMAIN_CONFLICT'
  | 'SESSION_STALE';

export interface UiDiagnostic {
  readonly code: UiDiagnosticCode;
  readonly message: string;
  readonly severity: UiSeverity;
  /** Stable detail fields per the §7 catalog (code-specific). */
  readonly [detail: string]: unknown;
}

/** Build a diagnostic with the severity the frozen catalog prescribes. */
export function uiDiagnostic(
  code: UiDiagnosticCode,
  message: string,
  details: Record<string, unknown> = {},
): UiDiagnostic {
  return { code, message, severity: severityFor(code), ...details };
}

/** Frozen severity per §7 (errors unless listed). */
const WARNING_CODES: ReadonlySet<UiDiagnosticCode> = new Set([
  'UI_DOC_UNSUPPORTED_FEATURE',
  'UI_STYLE_PROPERTY_UNSUPPORTED',
]);

export function severityFor(code: UiDiagnosticCode): UiSeverity {
  return WARNING_CODES.has(code) ? 'warning' : 'error';
}

/** True when the list contains at least one error-severity diagnostic. */
export function hasErrors(diagnostics: readonly UiDiagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}
