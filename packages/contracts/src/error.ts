import { defineContract } from './define-contract.js';
import { describeReceived } from './issue-mapping.js';
import type { Contract, ContractIssue, ContractResult, VictError } from './types.js';

/** Create a structured Vict error. `details` must be safe-to-log diagnostic data. */
export function victError(
  code: string,
  message: string,
  details?: unknown,
  cause?: VictError,
): VictError {
  const error: { code: string; message: string; details?: unknown; cause?: VictError } = {
    code,
    message,
  };
  if (details !== undefined) {
    error.details = details;
  }
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
}

function readPath(value: unknown, segments: readonly string[]): unknown {
  let current: unknown = value;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Neutral structural validation for error signals. Hand-written on purpose:
 * the base contracts package has zero schema-library dependencies.
 */
function parseErrorSignal(
  input: unknown,
  prefix: readonly string[] = [],
): ContractResult<VictError> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return {
      ok: false,
      issues: [
        {
          code: 'invalid_type',
          path: formatIssuePath(prefix),
          message: `Expected an error-signal object at ${formatIssuePath(prefix) === '(root)' ? 'the root value' : `'${formatIssuePath(prefix)}'`}, received ${describeReceived(input)}.`,
          expected: 'object',
          received: describeReceived(input),
        },
      ],
    };
  }
  const candidate = input as Record<string, unknown>;
  const issues: ContractIssue[] = [];
  const expect = (path: readonly string[], condition: boolean, expectation: string): void => {
    if (!condition) {
      const display = formatIssuePath([...prefix, ...path]);
      issues.push({
        code: 'invalid_type',
        path: display,
        message: `Expected ${expectation} at ${display === '(root)' ? 'the root value' : `'${display}'`}, received ${describeReceived(readPath(input, path))}.`,
        expected: expectation,
        received: describeReceived(readPath(input, path)),
      });
    }
  };
  expect(
    ['code'],
    typeof candidate['code'] === 'string' && candidate['code'].length > 0,
    'a non-empty string',
  );
  expect(['message'], typeof candidate['message'] === 'string', 'a string');
  const cause = candidate['cause'];
  if (cause !== undefined && cause !== null) {
    const causeResult = parseErrorSignal(cause, [...prefix, 'cause']);
    if (!causeResult.ok) {
      issues.push(...causeResult.issues);
    }
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, value: input as VictError };
}

function formatIssuePath(segments: readonly string[]): string {
  if (segments.length === 0) {
    return '(root)';
  }
  let out = '';
  for (const segment of segments) {
    out = out.length === 0 ? segment : `${out}.${segment}`;
  }
  return out;
}

/**
 * Ready-made contract for nodes that handle structured error signals routed
 * over `error` edges. The validated value is a `VictError`.
 */
export const errorSignalContract: Contract<VictError> = defineContract<VictError>({
  id: 'vict.error-signal',
  revision: '1',
  expected: 'A structured Vict error signal routed over an error edge',
  parse: parseErrorSignal,
});
