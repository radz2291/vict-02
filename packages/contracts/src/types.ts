/**
 * Core data promises for Vict.
 *
 * A `Contract` is an executable promise about the shape of data crossing a
 * graph boundary. Validation results are structured and safe to log: issues
 * carry codes, paths, and human-readable messages, never raw received values.
 */

export interface ContractIssue {
  /** Stable machine-readable issue code (e.g. `invalid_type`). */
  readonly code: string;
  /** Dotted/bracketed path to the offending field, e.g. `items[0].qty`. `'(root)'` for the top level. */
  readonly path: string;
  /** Human-readable message. Schema-side expectations only; never embeds received values by default. */
  readonly message: string;
  /** Description of what was expected, when known. */
  readonly expected?: string;
  /** Safe type-shape description of what was received (e.g. `string(12)`, `object`). Never the value itself. */
  readonly received?: string;
}

export type ContractResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ContractIssue[] };

export interface Contract<T = unknown> {
  /** Stable identifier, unique within a runtime. */
  readonly id: string;
  /** Human-readable description of the promised shape. */
  readonly expected: string;
  /** Validate an untrusted value. Never throws for invalid input; returns issues instead. */
  parse(input: unknown): ContractResult<T>;
}

/**
 * Structured error used across Vict (kernel error signals, run failures).
 * `details` must remain safe-to-log diagnostic data, never raw payloads.
 */
export interface VictError {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
  readonly cause?: VictError;
}
