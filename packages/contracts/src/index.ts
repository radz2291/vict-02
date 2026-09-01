/**
 * `@vict/contracts` — Vict's neutral contract API.
 *
 * This base entry point is schema-library neutral: no schema library appears
 * in the signature surface or emitted declarations. Schema-library
 * convenience lives in optional adapter subpaths (e.g. `@vict/contracts/zod`,
 * which requires zod as an optional peer dependency).
 */
export type {
  Contract,
  ContractDefinition,
  ContractIssue,
  ContractResult,
  VictError,
} from './types.js';
export { defineContract, validateContractIdentity } from './define-contract.js';
export { ContractDefinitionError } from './errors.js';
export type { ContractDefinitionErrorCode } from './errors.js';
export { victError, errorSignalContract } from './error.js';
export {
  describeReceived,
  formatPath,
  safeIssueMessage,
  sanitizeContractIssues,
  toSafeIssue,
  MAX_OBSERVABLE_ISSUES,
  SAFE_ISSUE_CODES,
  UNTRUSTED_ISSUE_CODE,
} from './issue-mapping.js';
export type { ObservableContractIssue, RawSchemaIssue, SafeIssueOptions } from './issue-mapping.js';
