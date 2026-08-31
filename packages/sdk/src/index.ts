/**
 * `@vict/sdk` is the intended import surface for application and future
 * capability authors. Application code should not need deep kernel internals.
 *
 * The base surface is schema-library neutral. Zod convenience lives in the
 * optional `@vict/sdk/zod` subpath.
 *
 * Dependency direction: contracts <- kernel <- runtime, with the sdk layered
 * on top and lower packages never importing from it.
 */

// Neutral executable contracts and structured results.
export { defineContract, victError, errorSignalContract } from '@vict/contracts';
export type {
  Contract,
  ContractDefinition,
  ContractIssue,
  ContractResult,
  VictError,
} from '@vict/contracts';
export { ContractDefinitionError } from '@vict/contracts';
export type { ContractDefinitionErrorCode } from '@vict/contracts';

// Graph vocabulary (authoring types only; execution is runtime's job).
export type {
  ApplicationGraphDefinition,
  CompiledGraph,
  CompiledNode,
  EffectClass,
  ExecutionMode,
  GraphEdgeDefinition,
  GraphIssue,
  GraphIssueCode,
  GraphNodeDefinition,
  KernelEvent,
  OutputSummary,
  RunStatus,
} from '@vict/kernel';

// Runtime facade.
export {
  createRuntime,
  createInMemoryRunRepository,
  decideEffectAuthorization,
  VictRuntime,
  VictRuntimeError,
} from '@vict/runtime';
export type {
  ActiveGraphInfo,
  ActivationResult,
  CapabilityContext,
  CapabilityDefinition,
  DoubleInvoke,
  EffectPolicyOverrides,
  PayloadRetention,
  RunNodeOptions,
  RunOptions,
  RunRecord,
  RunRepository,
  RunResult,
  RuntimeErrorCode,
  VictRuntimeOptions,
} from '@vict/runtime';

// Authoring helpers.
export { defineCapability, defineGraph } from './authoring.js';
