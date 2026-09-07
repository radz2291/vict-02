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
export {
  defineContract,
  validateContractIdentity,
  isOfficialContract,
  OFFICIAL_CONTRACT_BRAND,
  brandOfficialContract,
} from './define-contract.js';
export { neutralJsonContract, NEUTRAL_JSON_CONTRACT_ID } from './neutral.js';
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

// ---- Neutral product-agent stream contract (Stage 06A; final field-level
// schema finalized in Stage 06B — OPEN-015 decided) --------------------------
export {
  AGENT_STREAM_SCHEMA,
  AGENT_STREAM_EVENT_KINDS,
  AGENT_STREAM_DURABLE_KINDS,
  AGENT_STREAM_TRANSIENT_KINDS,
  AGENT_STREAM_ID_PATTERN,
  AGENT_STREAM_SCHEMA_CODES,
  AGENT_STREAM_CODE_PATTERN,
  isValidAgentStreamId,
  validateAgentStreamEvent,
  assertAgentStreamEvent,
} from './agent-stream.js';
export type {
  AgentStreamContext,
  AgentStreamEvent,
  AgentStreamEventKind,
  AgentStreamSchemaCode,
  AgentStreamSchemaIssue,
  AgentStreamValidationResult,
  AgentStreamTextDelta,
  AgentStreamContentCompleted,
  AgentStreamToolRequested,
  AgentStreamToolStarted,
  AgentStreamToolAwaitingApproval,
  AgentStreamToolCompleted,
  AgentStreamToolFailed,
  AgentStreamMemoryUpdated,
  AgentStreamUsage,
  AgentStreamUsageUpdated,
  AgentStreamResponseStarted,
  AgentStreamResponseCompleted,
  AgentStreamResponseFailed,
  AgentStreamResponseCancelled,
} from './agent-stream.js';
