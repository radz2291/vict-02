import type { ZodType } from 'zod';
import type { Contract, ContractIssue, ContractResult } from './types.js';

export interface DefineContractOptions {
  /** Overrides the human-readable shape description (falls back to the schema's `.describe()` text, then the id). */
  readonly description?: string;
}

/**
 * Define a Vict contract from a zod schema.
 *
 * The schema library is an implementation detail of this package: its types
 * are not part of Vict's public contract API, and issue mapping guarantees
 * that received values are never copied into validation results.
 */
export function defineContract<T>(
  id: string,
  schema: ZodType<T>,
  options: DefineContractOptions = {},
): Contract<T> {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Contract id must be a non-empty string.');
  }
  const expected = options.description ?? schema.description ?? id;
  return {
    id,
    expected,
    parse(input: unknown): ContractResult<T> {
      const result = schema.safeParse(input);
      if (result.success) {
        return { ok: true, value: result.data };
      }
      return { ok: false, issues: result.error.issues.map((issue) => toIssue(issue, input)) };
    },
  };
}

/** Structural subset of a zod issue we consume. Kept local so zod types never leak. */
interface RawSchemaIssue {
  readonly code: string;
  readonly path: readonly PropertyKey[];
  readonly message: string;
  readonly expected?: unknown;
}

function toIssue(issue: RawSchemaIssue, root: unknown): ContractIssue {
  const valueAtPath = readPath(root, issue.path);
  return {
    code: issue.code,
    path: formatPath(issue.path),
    message: issue.message,
    expected: typeof issue.expected === 'string' ? issue.expected : undefined,
    received: describeReceived(valueAtPath),
  };
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

function formatPath(path: readonly PropertyKey[]): string {
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
function describeReceived(value: unknown): string {
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
