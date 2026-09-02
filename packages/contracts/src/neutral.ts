import type { Contract, ContractResult } from './types.js';
import { defineContract } from './define-contract.js';
import { safeIssueMessage } from './issue-mapping.js';

/**
 * The deliberate, stable NEUTRAL contract for capabilities that intentionally
 * accept or return arbitrary JSON values.
 *
 * CONT-001 requires every executable capability to declare BOTH an input and
 * an output contract. A capability whose boundary is deliberately untyped
 * must still validate: it declares this neutral contract instead of omitting
 * validation. The neutral contract accepts exactly the canonical
 * serializable JSON domain — null, booleans, finite numbers, strings,
 * arrays, and plain objects — and rejects everything else with structured
 * issues. It never validates internal shape: that is its documented purpose.
 */
/** The stable id of the neutral JSON contract. */
export const NEUTRAL_JSON_CONTRACT_ID = 'vict.neutral.json';

export const neutralJsonContract: Contract<unknown> = defineContract<unknown>({
  id: 'vict.neutral.json',
  revision: '1',
  expected: 'any canonical JSON value (null, boolean, finite number, string, array, plain object)',
  parse: (input): ContractResult<unknown> => {
    if (isCanonicalJson(input)) {
      return { ok: true as const, value: input };
    }
    return {
      ok: false as const,
      issues: [
        {
          code: 'invalid_type',
          path: '(root)',
          message: safeIssueMessage(
            'invalid_type',
            '(root)',
            'a canonical JSON value',
            describeNonJson(input),
          ),
        },
      ],
    };
  },
});

function describeNonJson(input: unknown): string {
  if (input === undefined) return 'undefined';
  if (typeof input === 'function') return 'function';
  if (typeof input === 'symbol') return 'symbol';
  if (typeof input === 'bigint') return 'bigint';
  if (typeof input === 'number') return 'non-finite number';
  if (input instanceof Date) return 'Date';
  return 'non-JSON value';
}

/** Structural JSON-domain check (no coercion, no silent conversion). */
function isCanonicalJson(value: unknown): boolean {
  if (value === null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return true;
  if (type === 'number') return Number.isFinite(value);
  if (type !== 'object') return false;
  if (Array.isArray(value)) {
    return value.every(isCanonicalJson);
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (!isCanonicalJson((value as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}
