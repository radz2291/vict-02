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
  const result = {
    code: issue.code,
    path,
    message: safeIssueMessage(issue.code, path, expected, received),
    expected,
    received,
  };
  if (options.trustSchemaMessages === true && typeof issue.message === 'string') {
    return { ...result, safeMessage: issue.message };
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
