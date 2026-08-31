/**
 * Core data promises for Vict.
 *
 * A `Contract` is an executable promise about the shape of data crossing a
 * graph boundary. The base API is schema-library neutral: it never mentions
 * or imports any schema library. Validation results are structured and safe
 * to log: issues carry codes, paths, and framework-generated messages —
 * never raw received values and never verbatim author-supplied messages.
 */

export interface ContractIssue {
  /** Stable machine-readable issue code (e.g. `invalid_type`). */
  readonly code: string;
  /** Dotted/bracketed path to the offending field, e.g. `items[0].qty`. `'(root)'` for the top level. */
  readonly path: string;
  /** Framework-generated, safe-to-log message built from the issue code, path, expectation and safe received description. */
  readonly message: string;
  /** Description of what was expected, when known. */
  readonly expected?: string;
  /** Safe type-shape description of what was received (e.g. `string(12)`, `object`). Never the value itself. */
  readonly received?: string;
  /**
   * The schema library's own message, present ONLY when the author explicitly
   * opted in (`trustSchemaMessages`). Treat as author-controlled content:
   * never assume it is free of payload values.
   */
  readonly safeMessage?: string;
}

export type ContractResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ContractIssue[] };

export interface Contract<T = unknown> {
  /** Stable identifier, unique within a runtime. */
  readonly id: string;
  /** Author/build-owned revision marker (e.g. `'1'`). Changing contract semantics requires changing the revision. */
  readonly revision: string;
  /** Human-readable description of the promised shape. */
  readonly expected: string;
  /** Validate an untrusted value. Never throws for invalid input; returns issues instead. */
  parse(input: unknown): ContractResult<T>;
}

/**
 * Neutral contract authoring shape. This is Vict's public contract API —
 * schema libraries enter only through optional adapters (e.g. `@vict/contracts/zod`).
 */
export interface ContractDefinition<T = unknown> {
  readonly id: string;
  readonly revision: string;
  readonly expected?: string;
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
