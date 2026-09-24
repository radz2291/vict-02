/**
 * Shared closed-vocabulary validator helpers.
 *
 * Validator discipline (architecture §3.6): structural, dependency-light,
 * closed vocabulary (unknown fields are rejected), non-echoing diagnostics
 * (messages carry codes, paths, and expectations — never document values).
 */

export type Primitive = string | number | boolean | null;

export interface ValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export type ValidationResult =
  { readonly ok: true } | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export function ok(): ValidationResult {
  return { ok: true };
}

export function fail(issues: readonly ValidationIssue[]): ValidationResult {
  return { ok: false, issues };
}

export function issue(code: string, path: string, message: string): ValidationIssue {
  return { code, path, message };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Record an UNKNOWN_FIELD diagnostic for every field outside the allowed set. */
export function checkAllowedFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  issues: ValidationIssue[],
): void {
  for (const key of Object.keys(value).sort()) {
    if (!allowed.has(key)) {
      issues.push(
        issue(
          'UNKNOWN_FIELD',
          `${path}.${key}`,
          `Unknown field; the schema at '${path}' is closed.`,
        ),
      );
    }
  }
}

export function requireString(
  value: Record<string, unknown>,
  field: string,
  path: string,
  issues: ValidationIssue[],
  options: { readonly nonEmpty?: boolean; readonly pattern?: RegExp } = {},
): void {
  const raw = value[field];
  if (typeof raw !== 'string') {
    issues.push(issue('INVALID_TYPE', `${path}.${field}`, 'Expected a string.'));
    return;
  }
  if (options.nonEmpty === true && raw.trim().length === 0) {
    issues.push(issue('EMPTY_VALUE', `${path}.${field}`, 'Expected a non-empty string.'));
  }
  if (options.pattern !== undefined && !options.pattern.test(raw)) {
    issues.push(issue('INVALID_FORMAT', `${path}.${field}`, 'Expected the documented format.'));
  }
}

export function requireBoolean(
  value: Record<string, unknown>,
  field: string,
  path: string,
  issues: ValidationIssue[],
): void {
  if (typeof value[field] !== 'boolean') {
    issues.push(issue('INVALID_TYPE', `${path}.${field}`, 'Expected a boolean.'));
  }
}

export function requireStringArray(
  value: Record<string, unknown>,
  field: string,
  path: string,
  issues: ValidationIssue[],
  options: { readonly nonEmpty?: boolean } = {},
): void {
  const raw = value[field];
  if (!Array.isArray(raw)) {
    issues.push(issue('INVALID_TYPE', `${path}.${field}`, 'Expected an array of strings.'));
    return;
  }
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    if (typeof item !== 'string') {
      issues.push(
        issue('INVALID_TYPE', `${path}.${field}[${String(index)}]`, 'Expected a string.'),
      );
    } else if (options.nonEmpty === true && item.trim().length === 0) {
      issues.push(
        issue('EMPTY_VALUE', `${path}.${field}[${String(index)}]`, 'Expected a non-empty string.'),
      );
    }
  }
}

/** SHA-256 hex digest (64 lowercase hex characters). */
export const SHA256_PATTERN = /^[0-9a-f]{64}$/;
/** Git commit SHA: SHA-1 (40) or SHA-256 (64) lowercase hex. */
export const GIT_SHA_PATTERN = /^([0-9a-f]{40}|[0-9a-f]{64})$/;
