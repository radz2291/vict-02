/**
 * Safe issue mapping helpers.
 *
 * These helpers convert adapter-specific validation failures into neutral,
 * safe `ContractIssue` objects. Two invariants matter:
 *
 * 1. Received values are never copied: `received` is always a type-shape
 *    description (e.g. `string(12)`, `object`).
 * 2. Messages are framework-generated from the issue code, path, expectation
 *    and received description. Schema-library messages are never copied into
 *    `message`; they may surface only as `safeMessage` when an author
 *    explicitly opts in.
 */

export interface RawSchemaIssue {
  readonly code: string;
  readonly path: readonly PropertyKey[];
  readonly expected?: unknown;
  /** The schema library's own message. Treated as untrusted content. */
  readonly message: string;
}

export interface SafeIssueOptions {
  /** When true, the schema library's message is preserved in `safeMessage`. Default: never. */
  readonly trustSchemaMessages?: boolean;
}

export function toSafeIssue(
  issue: RawSchemaIssue,
  root: unknown,
  options: SafeIssueOptions = {},
): {
  code: string;
  path: string;
  message: string;
  expected?: string;
  received: string;
  safeMessage?: string;
} {
  const path = formatPath(issue.path);
  const received = describeReceived(readPath(root, issue.path));
  const expected = typeof issue.expected === 'string' ? issue.expected : undefined;
  // Absent optional fields are OMITTED, never carried as explicit
  // `undefined`: persisted values must be honestly in the JSON domain.
  const result: {
    code: string;
    path: string;
    message: string;
    expected?: string;
    received: string;
    safeMessage?: string;
  } = {
    code: issue.code,
    path,
    message: safeIssueMessage(issue.code, path, expected, received),
    received,
  };
  if (expected !== undefined) {
    result.expected = expected;
  }
  if (options.trustSchemaMessages === true && typeof issue.message === 'string') {
    result.safeMessage = issue.message;
  }
  return result;
}

/** Framework-generated issue message. Contains only codes, paths and type descriptions. */
export function safeIssueMessage(
  code: string,
  path: string,
  expected: string | undefined,
  received: string,
): string {
  const at = path === '(root)' ? 'the root value' : `'${path}'`;
  switch (code) {
    case 'invalid_type':
      return `Expected ${expected ?? 'a valid value'} at ${at}, received ${received}.`;
    case 'invalid_literal':
      return `Expected the literal value at ${at} to match the schema, received ${received}.`;
    case 'invalid_enum_value':
      return `Value at ${at} is not one of the allowed options, received ${received}.`;
    case 'too_small':
      return `Value at ${at} is too small, received ${received}.`;
    case 'too_big':
      return `Value at ${at} is too big, received ${received}.`;
    case 'unrecognized_keys':
      return `Unrecognized key(s) at ${at}.`;
    case 'invalid_union':
      return `Value at ${at} did not match any allowed shape, received ${received}.`;
    case 'invalid_string':
      return `String at ${at} does not satisfy the expected format, received ${received}.`;
    case 'invalid_date':
      return `Value at ${at} is not a valid date, received ${received}.`;
    default:
      return `Validation failed (${code}) at ${at}, received ${received}.`;
  }
}

function readPath(value: unknown, path: readonly PropertyKey[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current;
}

/**
 * The closed vocabulary of issue codes considered ESTABLISHED-SAFE for
 * observation. These are the framework's own schema-issue codes; their text
 * is fixed, bounded, and payload-independent. A `parse()` implementation is
 * an author-controlled boundary: any code outside this set is untrusted
 * content and is replaced with a stable framework fallback.
 */
export const SAFE_ISSUE_CODES = Object.freeze([
  'invalid_type',
  'invalid_literal',
  'invalid_enum_value',
  'too_small',
  'too_big',
  'unrecognized_keys',
  'invalid_union',
  'invalid_string',
  'invalid_date',
] as const);

/** Stable fallback for untrusted (non-allowlisted) issue codes. */
export const UNTRUSTED_ISSUE_CODE = 'untrusted_issue';

/** Upper bound on how many issues may be observable from one rejection. */
export const MAX_OBSERVABLE_ISSUES = 10;

export interface ObservableContractIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

/**
 * Reduce RAW contract issues (the return value of an author-controlled
 * `parse()`) to structurally safe, observable diagnostics.
 *
 * Policy (fail-closed; the only information that survives is framework
 * controlled):
 * 1. `code` — copied ONLY when it is a member of `SAFE_ISSUE_CODES` (a
 *    closed, payload-independent vocabulary). Anything else — including an
 *    alphanumeric secret — becomes `UNTRUSTED_ISSUE_CODE`.
 * 2. `path` — NEVER propagated. Author- or schema-supplied paths may
 *    contain payload-derived key names (a dynamic object key can be a
 *    secret), so character filtering is insufficient by construction.
 *    Issues are located by ordinal only: `issues[<index>]`.
 * 3. `message` — always framework-GENERATED from the safe code and the
 *    ordinal. Raw `message`, `safeMessage`, `expected`, `received`, and
 *    any extra/nested properties are dropped; payload echoes cannot leak.
 *
 * The SAME policy applies to every validation boundary (input, output,
 * join, signal, operator confirmation): nothing payload-derived or
 * author-controlled is copied into observable or persistable diagnostics.
 */
export function sanitizeContractIssues(
  issues: readonly unknown[] | undefined,
): ObservableContractIssue[] {
  return (issues ?? []).slice(0, MAX_OBSERVABLE_ISSUES).map((raw, index) => {
    // Hostile-getter hardening: EVERY property access on an author-supplied
    // issue is untrusted. A getter may throw, return a proxy, or wedge —
    // any failure degrades to the stable untrusted-issue fallback without
    // propagating, leaking, or retaining hostile content.
    let candidate: unknown;
    try {
      candidate =
        typeof raw === 'object' && raw !== null ? (raw as { code?: unknown }).code : undefined;
    } catch {
      candidate = undefined;
    }
    const code: string = safeIssueCode(candidate);
    const path = `issues[${index}]`;
    return {
      code,
      path,
      message: safeIssueMessage(code, path, undefined, 'a value'),
    };
  });
}

/** Reduce a candidate issue code to the closed safe vocabulary or the stable fallback. */
function safeIssueCode(candidate: unknown): string {
  try {
    return typeof candidate === 'string' &&
      (SAFE_ISSUE_CODES as readonly string[]).includes(candidate)
      ? candidate
      : UNTRUSTED_ISSUE_CODE;
  } catch {
    return UNTRUSTED_ISSUE_CODE;
  }
}

export function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) {
    return '(root)';
  }
  let out = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      out += `[${segment}]`;
    } else {
      out = out.length === 0 ? String(segment) : `${out}.${String(segment)}`;
    }
  }
  return out;
}

/** Type-shape description only. Deliberately excludes the received value. */
export function describeReceived(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  switch (typeof value) {
    case 'string':
      return `string(${value.length})`;
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'bigint':
      return 'bigint';
    case 'symbol':
      return 'symbol';
    case 'function':
      return 'function';
    default:
      return Array.isArray(value) ? `array(${value.length})` : 'object';
  }
}
