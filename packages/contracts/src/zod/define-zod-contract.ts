import type { ZodType } from 'zod';
import { validateContractIdentity } from '../define-contract.js';
import { toSafeIssue } from '../issue-mapping.js';
import type { Contract, ContractResult } from '../types.js';

export interface DefineZodContractOptions {
  /** Overrides the human-readable shape description (falls back to the schema's `.describe()` text, then the id). */
  readonly description?: string;
  /**
   * When true, the schema library's own message is preserved in
   * `issue.safeMessage`. Schema messages are author-controlled content and
   * may embed payload values — opt in only for schemas you author safely.
   * Default: false (schema messages are never copied).
   */
  readonly trustSchemaMessages?: boolean;
}

/**
 * Optional Zod adapter: build a neutral Vict `Contract` from a zod schema.
 *
 * Zod appears only here, in the optional `@vict/contracts/zod` subpath.
 * Zod issues are mapped to neutral, safe `ContractIssue` objects:
 * framework-generated messages, type-shape `received` descriptions, no
 * `ZodError` instances and no zod types in results.
 */
export function defineZodContract<T>(
  id: string,
  revision: string,
  schema: ZodType<T>,
  options: DefineZodContractOptions = {},
): Contract<T> {
  validateContractIdentity(id, revision);
  const expected = options.description ?? schema.description ?? id;
  return {
    id,
    revision,
    expected,
    parse(input: unknown): ContractResult<T> {
      const result = schema.safeParse(input);
      if (result.success) {
        return { ok: true, value: result.data };
      }
      return {
        ok: false,
        issues: result.error.issues.map((issue) =>
          toSafeIssue(
            {
              code: issue.code,
              path: issue.path,
              expected: (issue as { expected?: unknown }).expected,
              message: issue.message,
            },
            input,
            { trustSchemaMessages: options.trustSchemaMessages },
          ),
        ),
      };
    },
  };
}
